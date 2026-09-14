// 盤面ロジック（Phaser に依存しない純粋ロジック）
// 覆い判定・トレイ/仮置き場の状態・詰み判定・クリア判定。
// pull() は1回の呼び出しで連鎖（トレイ完了→次トレイ→吸い込み→…）を全て確定し、
// 発生順のイベント列を返す。演出側はそれを順番に再生するだけ。

import { DEFAULT_BUFFER, TRAY_CAP, inRect, screwId, type Color, type LevelDef, type PlateColor } from './Level';

export const TRAY_SLOTS = 3;

export interface ScrewState {
  id: string;
  plateId: string;
  x: number;
  y: number;
  color: Color;
  pulled: boolean;
}

export interface PlateState {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  color: PlateColor;
  dropped: boolean;
  screwIds: string[];
}

export interface TraySlot {
  color: Color;
  count: number;
}

export interface BoardState {
  screws: ScrewState[];
  plates: PlateState[];
  trays: (TraySlot | null)[];
  /** まだ出ていないトレイ（先頭が次） */
  queue: Color[];
  /** 仮置き場（左詰め、ネジID） */
  buffer: string[];
  bufferSize: number;
}

export type FailReason = 'covered' | 'full' | 'pulled';

export type PullFail = { ok: false; reason: FailReason; coveredBy?: string };
export type PullResult = PullFail | { ok: true; events: BoardEvent[] };

export type BoardEvent =
  | { type: 'screwToTray'; screwId: string; trayIndex: number; slot: number }
  | { type: 'screwToBuffer'; screwId: string; bufferIndex: number }
  | { type: 'trayCompleted'; trayIndex: number }
  | { type: 'trayArrived'; trayIndex: number; color: Color }
  | { type: 'bufferSucked'; screwId: string; fromBufferIndex: number; trayIndex: number; slot: number }
  | { type: 'bufferCompacted'; moves: { screwId: string; from: number; to: number }[] }
  | { type: 'plateDropped'; plateId: string }
  | { type: 'cleared' }
  | { type: 'stuck' };

export class Board {
  private readonly screws = new Map<string, ScrewState>();
  private readonly screwList: ScrewState[] = [];
  private readonly plates = new Map<string, PlateState>();
  private readonly plateList: PlateState[] = [];
  /** ネジID → そのネジを（幾何的に）覆う板ID。z の大きい順。 */
  private readonly coverMap: Map<string, string[]>;

  private trays: (TraySlot | null)[] = [];
  private readonly queue: Color[];
  private queueIdx = 0;
  private buffer: string[] = [];
  readonly bufferSize: number;

  constructor(level: LevelDef, opts: { bufferSize?: number } = {}) {
    this.bufferSize = opts.bufferSize ?? level.bufferSize ?? DEFAULT_BUFFER;
    this.queue = [...level.trays];

    for (const p of level.plates) {
      const plate: PlateState = {
        id: p.id, x: p.x, y: p.y, w: p.w, h: p.h, z: p.z, color: p.color, dropped: false, screwIds: [],
      };
      p.screws.forEach((s, i) => {
        const id = screwId(p.id, i);
        const screw: ScrewState = { id, plateId: p.id, x: s.x, y: s.y, color: s.color, pulled: false };
        this.screws.set(id, screw);
        this.screwList.push(screw);
        plate.screwIds.push(id);
      });
      this.plates.set(p.id, plate);
      this.plateList.push(plate);
    }
    this.plateList.sort((a, b) => b.z - a.z);

    // 覆い関係は幾何的に固定なので最初に計算しておく
    this.coverMap = new Map();
    for (const s of this.screwList) {
      const own = this.plates.get(s.plateId)!;
      const covering = this.plateList.filter((q) => q.z > own.z && inRect(s.x, s.y, q)).map((q) => q.id);
      this.coverMap.set(s.id, covering);
    }

    // 初期トレイ（先頭3つ。足りなければ空枠）
    for (let i = 0; i < TRAY_SLOTS; i++) {
      const c = this.queue[this.queueIdx];
      if (c !== undefined) {
        this.trays.push({ color: c, count: 0 });
        this.queueIdx++;
      } else {
        this.trays.push(null);
      }
    }
  }

  // ---------- 参照系 ----------

  getScrew(id: string): ScrewState | undefined {
    return this.screws.get(id);
  }

  getPlate(id: string): PlateState | undefined {
    return this.plates.get(id);
  }

  /** 全ネジ（定義順） */
  allScrews(): readonly ScrewState[] {
    return this.screwList;
  }

  /** 全板（z の大きい順） */
  allPlates(): readonly PlateState[] {
    return this.plateList;
  }

  /** 残っているネジの本数 */
  remainingScrews(): number {
    return this.screwList.filter((s) => !s.pulled).length;
  }

  /** 演出側が「最終状態」を参照するためのスナップショット */
  snapshot(): BoardState {
    return {
      screws: this.screwList.map((s) => ({ ...s })),
      plates: this.plateList.map((p) => ({ ...p, screwIds: [...p.screwIds] })),
      trays: this.trays.map((t) => (t ? { ...t } : null)),
      queue: this.queue.slice(this.queueIdx),
      buffer: [...this.buffer],
      bufferSize: this.bufferSize,
    };
  }

  /** ネジを今覆っている板ID（z の大きい順）。空なら覆われていない。 */
  coveringPlates(id: string): string[] {
    return (this.coverMap.get(id) ?? []).filter((pid) => !this.plates.get(pid)!.dropped);
  }

  isCovered(id: string): boolean {
    return this.coveringPlates(id).length > 0;
  }

  /** 同色トレイで空きのある一番左の枠。無ければ -1。 */
  findTray(color: Color): number {
    for (let i = 0; i < this.trays.length; i++) {
      const t = this.trays[i];
      if (t && t.color === color && t.count < TRAY_CAP) return i;
    }
    return -1;
  }

  canPull(id: string): { ok: true } | PullFail {
    const s = this.screws.get(id);
    if (!s || s.pulled) return { ok: false, reason: 'pulled' };
    const cov = this.coveringPlates(id);
    if (cov.length > 0) return { ok: false, reason: 'covered', coveredBy: cov[0] };
    if (this.findTray(s.color) >= 0) return { ok: true };
    if (this.buffer.length < this.bufferSize) return { ok: true };
    return { ok: false, reason: 'full' };
  }

  /** 今抜けるネジのID一覧 */
  pullableScrews(): string[] {
    return this.screwList.filter((s) => !s.pulled && this.canPull(s.id).ok).map((s) => s.id);
  }

  isCleared(): boolean {
    return this.plateList.every((p) => p.dropped);
  }

  /** 詰み：板が残っているのに抜けるネジが1本も無い */
  isStuck(): boolean {
    if (this.isCleared()) return false;
    return this.pullableScrews().length === 0;
  }

  // ---------- 操作系 ----------

  pull(id: string): PullResult {
    const can = this.canPull(id);
    if (!can.ok) return can;

    const s = this.screws.get(id)!;
    const events: BoardEvent[] = [];
    s.pulled = true;

    const ti = this.findTray(s.color);
    let completedTray = -1;
    if (ti >= 0) {
      const t = this.trays[ti]!;
      events.push({ type: 'screwToTray', screwId: id, trayIndex: ti, slot: t.count });
      t.count++;
      if (t.count >= TRAY_CAP) completedTray = ti;
    } else {
      events.push({ type: 'screwToBuffer', screwId: id, bufferIndex: this.buffer.length });
      this.buffer.push(id);
    }

    // 板のネジが全部抜けたら落下（ネジが着地した直後に落ちる方が自然なので、トレイ連鎖より先）
    const plate = this.plates.get(s.plateId)!;
    if (plate.screwIds.every((sid) => this.screws.get(sid)!.pulled)) {
      plate.dropped = true;
      events.push({ type: 'plateDropped', plateId: plate.id });
    }

    if (completedTray >= 0) this.resolveTrayCompletion(completedTray, events);

    if (this.isCleared()) events.push({ type: 'cleared' });
    else if (this.isStuck()) events.push({ type: 'stuck' });

    return { ok: true, events };
  }

  /** トレイ完了 → 次トレイ → 仮置き場から吸い込み → （即満杯なら繰り返し） */
  private resolveTrayCompletion(ti: number, events: BoardEvent[]): void {
    events.push({ type: 'trayCompleted', trayIndex: ti });

    const next = this.queue[this.queueIdx];
    if (next === undefined) {
      this.trays[ti] = null; // キュー切れ → 空枠
      return;
    }
    this.queueIdx++;
    const tray: TraySlot = { color: next, count: 0 };
    this.trays[ti] = tray;
    events.push({ type: 'trayArrived', trayIndex: ti, color: next });

    // 仮置き場から同色を左から順に吸い込む（最大3本）
    const remaining: { screwId: string; from: number }[] = [];
    let sucked = 0;
    this.buffer.forEach((sid, i) => {
      const sc = this.screws.get(sid)!;
      if (sc.color === next && tray.count < TRAY_CAP) {
        events.push({ type: 'bufferSucked', screwId: sid, fromBufferIndex: i, trayIndex: ti, slot: tray.count });
        tray.count++;
        sucked++;
      } else {
        remaining.push({ screwId: sid, from: i });
      }
    });
    if (sucked > 0) {
      this.buffer = remaining.map((r) => r.screwId);
      const moves = remaining
        .map((r, to) => ({ screwId: r.screwId, from: r.from, to }))
        .filter((m) => m.from !== m.to);
      if (moves.length > 0) events.push({ type: 'bufferCompacted', moves });
    }

    if (tray.count >= TRAY_CAP) this.resolveTrayCompletion(ti, events);
  }

  // ---------- ソルバー用 ----------

  /** 状態の複製（探索用） */
  clone(): Board {
    const b = Object.create(Board.prototype) as Board;
    // readonly フィールドは Object.assign で流し込む
    Object.assign(b, {
      screws: new Map<string, ScrewState>(),
      screwList: [] as ScrewState[],
      plates: new Map<string, PlateState>(),
      plateList: [] as PlateState[],
      coverMap: this.coverMap, // 幾何は不変なので共有
      trays: this.trays.map((t) => (t ? { ...t } : null)),
      queue: this.queue,
      queueIdx: this.queueIdx,
      buffer: [...this.buffer],
      bufferSize: this.bufferSize,
    });
    for (const s of this.screwList) {
      const c = { ...s };
      b.screws.set(c.id, c);
      b.screwList.push(c);
    }
    for (const p of this.plateList) {
      const c = { ...p, screwIds: [...p.screwIds] };
      b.plates.set(c.id, c);
      b.plateList.push(c);
    }
    return b;
  }

  /**
   * 探索用の状態キー。
   * 仮置き場は「色の多重集合」だけで同一視する（同色なら順序は解けるかどうかに影響しない）。
   */
  stateKey(): string {
    let bits = '';
    for (const s of this.screwList) bits += s.pulled ? '1' : '0';
    const trays = this.trays.map((t) => (t ? `${t.color[0]}${t.count}` : '-')).join('');
    const buf = this.buffer
      .map((sid) => this.screws.get(sid)!.color[0])
      .sort()
      .join('');
    return `${bits}|${trays}|${this.queueIdx}|${buf}`;
  }
}
