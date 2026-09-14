// レベルデータの型定義と形式チェック（Phaser に依存しない）

export type Color = 'red' | 'blue' | 'yellow' | 'green';
export const COLORS: Color[] = ['red', 'blue', 'yellow', 'green'];

export type PlateColor = 'cream' | 'mint' | 'grey' | 'lavender';
export const PLATE_COLORS: PlateColor[] = ['cream', 'mint', 'grey', 'lavender'];

export interface ScrewDef {
  x: number;
  y: number;
  color: Color;
  /** 立体の別面など、座標の重なりで表せない覆い。空配列は覆いなし。 */
  blockedBy?: string[];
}

export interface PlateDef {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  color: PlateColor;
  screws: ScrewDef[];
}

export interface LevelDef {
  id: number;
  plates: PlateDef[];
  trays: Color[];
  bufferSize?: number;
  /** チュートリアル面：画面上に短い説明を出す（1面のみ） */
  tutorial?: boolean;
}

// 基準解像度
export const BASE_W = 1080;
export const BASE_H = 1920;
// 盤面の領域（仕様 5.3）
export const BOARD_TOP = 340;
export const BOARD_BOTTOM = 1500;
// 上の板のフチからネジ中心までの最小距離（仕様 2.4）
export const COVER_MARGIN = 40;
// トレイ1つの穴数
export const TRAY_CAP = 3;
// 仮置き場の既定穴数
export const DEFAULT_BUFFER = 5;

/** ネジID（板ID + 通し番号） */
export function screwId(plateId: string, index: number): string {
  return `${plateId}-${index}`;
}

/** 点が矩形内か（境界含む） */
export function inRect(px: number, py: number, r: { x: number; y: number; w: number; h: number }): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

/**
 * 形式チェック。違反があれば警告文の配列を返す（空なら合格）。
 * 解けるかどうかはここでは見ない（Solver の仕事）。
 */
export function validateLevel(level: LevelDef): string[] {
  const warns: string[] = [];
  const tag = `[level ${level.id}]`;

  // 板IDの重複
  const ids = new Set<string>();
  const zs = new Set<number>();
  for (const p of level.plates) {
    if (ids.has(p.id)) warns.push(`${tag} 板ID重複: ${p.id}`);
    ids.add(p.id);
    if (zs.has(p.z)) warns.push(`${tag} 板 ${p.id}: z=${p.z} が他の板と重複`);
    zs.add(p.z);

    if (p.screws.length < 1 || p.screws.length > 4) {
      warns.push(`${tag} 板 ${p.id}: ネジ本数は1〜4本（現在 ${p.screws.length}）`);
    }
    if (p.x < 0 || p.y < BOARD_TOP || p.x + p.w > BASE_W || p.y + p.h > BOARD_BOTTOM) {
      warns.push(`${tag} 板 ${p.id}: 盤面領域（x 0–${BASE_W}, y ${BOARD_TOP}–${BOARD_BOTTOM}）からはみ出し`);
    }
    if (!PLATE_COLORS.includes(p.color)) {
      warns.push(`${tag} 板 ${p.id}: 板の色 ${p.color} は未定義`);
    }
    p.screws.forEach((s, i) => {
      if (!inRect(s.x, s.y, p)) warns.push(`${tag} ネジ ${screwId(p.id, i)}: 自分の板の外にある`);
      if (!COLORS.includes(s.color)) warns.push(`${tag} ネジ ${screwId(p.id, i)}: 色 ${s.color} は未定義`);
    });
  }

  // 色ごとの本数は3の倍数、トレイ数は本数÷3
  for (const p of level.plates) {
    p.screws.forEach((s, i) => {
      for (const id of s.blockedBy ?? []) {
        if (!ids.has(id) || id === p.id) warns.push(`${tag} ネジ ${screwId(p.id, i)}: 覆いの板ID ${id} が不正`);
      }
    });
  }
  const count: Record<string, number> = {};
  for (const p of level.plates) for (const s of p.screws) count[s.color] = (count[s.color] ?? 0) + 1;
  const trayCount: Record<string, number> = {};
  for (const c of level.trays) trayCount[c] = (trayCount[c] ?? 0) + 1;

  for (const c of COLORS) {
    const n = count[c] ?? 0;
    const t = trayCount[c] ?? 0;
    if (n % TRAY_CAP !== 0) warns.push(`${tag} ${c} のネジが ${n} 本（3の倍数にする）`);
    if (t !== n / TRAY_CAP) warns.push(`${tag} ${c} のトレイ数 ${t} ≠ ネジ ${n} 本 ÷ 3`);
  }

  // 上の板のフチから 40px 以上（覆われているか一目で分かるように）
  for (const p of level.plates) {
    const uppers = level.plates.filter((q) => q.z > p.z);
    p.screws.forEach((s, i) => {
      if (s.blockedBy !== undefined) return;
      for (const q of uppers) {
        const d = distanceToRectEdge(s.x, s.y, q);
        if (d < COVER_MARGIN) {
          warns.push(
            `${tag} ネジ ${screwId(p.id, i)}: 上の板 ${q.id} のフチまで ${d.toFixed(0)}px（${COVER_MARGIN}px 以上離す）`,
          );
        }
      }
    });
  }

  return warns;
}

/** 点から矩形のフチまでの距離（内側でも外側でも正の値） */
export function distanceToRectEdge(px: number, py: number, r: { x: number; y: number; w: number; h: number }): number {
  if (inRect(px, py, r)) {
    return Math.min(px - r.x, r.x + r.w - px, py - r.y, r.y + r.h - py);
  }
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
  const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
  return Math.hypot(dx, dy);
}
