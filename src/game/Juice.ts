// 演出まとめ。Board のイベント列を順番に再生するだけで、判断はしない。
import Phaser from 'phaser';
import type { BoardEvent } from './Board';
import type { Color } from './Level';
import type { Game, ScrewView } from '../scenes/Game';
import { BUFFER_X, BUFFER_Y, DEPTH, SCREW, TRAY_HOLE_DX, TRAY_X, TRAY_Y } from './Theme';

/** 同じ場所（トレイ枠・仮置き場）に触る演出を順番待ちさせる小さな行列 */
class Lane {
  private tail: Promise<void> = Promise.resolve();
  run<T>(fn: () => Promise<T>): Promise<T> {
    const p = this.tail.then(fn);
    this.tail = p.then(
      () => undefined,
      () => undefined,
    );
    return p;
  }
}

type TrayChainEvent = Extract<BoardEvent, { type: 'trayCompleted' | 'trayArrived' | 'bufferSucked' | 'bufferCompacted' }>;

export class Juice {
  private readonly trayLane = [new Lane(), new Lane(), new Lane()];
  private readonly bufferLane = new Lane();
  private readonly drops: Promise<void>[] = [];
  private readonly gen: number;

  constructor(private readonly g: Game) {
    this.gen = g.gen;
  }

  // ---------- 小道具 ----------

  private alive(): boolean {
    return this.g.gen === this.gen;
  }

  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((res) => {
      if (!this.alive()) return;
      this.g.tweens.add({ ...cfg, onComplete: () => res() });
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((res) => {
      if (!this.alive()) return;
      this.g.time.delayedCall(ms, () => res());
    });
  }

  // ---------- 再生 ----------

  async play(events: BoardEvent[]): Promise<void> {
    let i = 0;
    while (i < events.length && this.alive()) {
      const e = events[i];
      if (e.type === 'trayCompleted') {
        // トレイ完了〜次トレイ〜吸い込み（連鎖含む）は同じ枠で連続するので、1つの仕事としてまとめる
        const ti = e.trayIndex;
        const group: TrayChainEvent[] = [];
        while (i < events.length) {
          const x = events[i];
          if (x.type === 'trayCompleted' || x.type === 'trayArrived' || x.type === 'bufferSucked' || x.type === 'bufferCompacted') {
            group.push(x);
            i++;
          } else break;
        }
        await this.trayLane[ti].run(() => this.playTrayChain(ti, group));
        continue;
      }
      await this.handle(e);
      i++;
    }
  }

  private async handle(e: BoardEvent): Promise<void> {
    switch (e.type) {
      case 'screwToTray': {
        const sv = this.g.screwViews.get(e.screwId)!;
        sv.where = 'flying';
        sv.c.setDepth(DEPTH.flying);
        await this.lift(sv);
        await this.trayLane[e.trayIndex].run(async () => {
          const tv = this.g.trayViews[e.trayIndex];
          if (!tv) return;
          await this.fly(sv, tv.c.x + TRAY_HOLE_DX[e.slot], tv.c.y);
          this.land(sv, tv.holes[e.slot], DEPTH.trayScrew);
          tv.screws[e.slot] = sv;
          sv.where = 'tray';
        });
        return;
      }
      case 'screwToBuffer': {
        const sv = this.g.screwViews.get(e.screwId)!;
        sv.where = 'flying';
        sv.c.setDepth(DEPTH.flying);
        await this.lift(sv);
        await this.bufferLane.run(async () => {
          await this.fly(sv, BUFFER_X[e.bufferIndex], BUFFER_Y);
          this.land(sv, this.g.bufferHoles[e.bufferIndex], DEPTH.trayScrew);
          this.g.bufferScrews[e.bufferIndex] = sv;
          sv.where = 'buffer';
        });
        return;
      }
      case 'plateDropped': {
        this.drops.push(this.dropPlate(e.plateId));
        return;
      }
      case 'cleared': {
        await Promise.all(this.drops);
        await this.wait(300);
        this.confetti();
        this.g.onCleared();
        return;
      }
      case 'stuck': {
        await Promise.all(this.drops);
        this.g.onStuck();
        return;
      }
      default:
        return;
    }
  }

  private async playTrayChain(ti: number, group: TrayChainEvent[]): Promise<void> {
    let k = 0;
    while (k < group.length && this.alive()) {
      const e = group[k];
      if (e.type === 'trayCompleted') {
        await this.trayComplete(ti);
        k++;
      } else if (e.type === 'trayArrived') {
        await this.trayArrive(ti, e.color);
        k++;
      } else if (e.type === 'bufferSucked') {
        // 連続する吸い込みはまとめて、ずらして飛ばす
        const sucks: Extract<BoardEvent, { type: 'bufferSucked' }>[] = [];
        while (k < group.length && group[k].type === 'bufferSucked') {
          sucks.push(group[k] as Extract<BoardEvent, { type: 'bufferSucked' }>);
          k++;
        }
        const compact = k < group.length && group[k].type === 'bufferCompacted' ? (group[k] as Extract<BoardEvent, { type: 'bufferCompacted' }>) : null;
        if (compact) k++;
        await this.bufferLane.run(async () => {
          await Promise.all(sucks.map((s, n) => this.wait(n * 80).then(() => this.suck(s))));
          if (compact) await this.compact(compact.moves);
        });
      } else {
        // 吸い込み無しの compacted は来ないが、念のため
        await this.bufferLane.run(() => this.compact(e.moves));
        k++;
      }
    }
  }

  // ---------- 失敗フィードバック（イベントではない） ----------

  /** 覆われていて抜けない：震え＋覆っている板をハイライト＋「コツ」 */
  shakeCovered(screwId: string, plateId?: string): void {
    const sv = this.g.screwViews.get(screwId);
    if (sv) this.shake(sv);
    this.g.sfx.knock();
    const pv = plateId ? this.g.plateViews.get(plateId) : undefined;
    if (pv) {
      pv.hl.setAlpha(0.55);
      void this.tween({ targets: pv.hl, alpha: 0, duration: 300, ease: 'Quad.easeOut' });
    }
  }

  /** 仮置き場が満杯：震え＋仮置き場の枠が赤く2回点滅＋「ブッ」 */
  shakeFull(screwId: string): void {
    const sv = this.g.screwViews.get(screwId);
    if (sv) this.shake(sv);
    this.g.sfx.buzz();
    const glow = this.g.bufferGlow;
    glow.setAlpha(0);
    void this.tween({ targets: glow, alpha: 1, duration: 90, yoyo: true, repeat: 1 });
  }

  private shake(sv: ScrewView): void {
    const x0 = sv.c.x;
    void this.tween({ targets: sv.c, x: x0 + 3, duration: 33, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' }).then(() => {
      if (this.alive()) sv.c.x = x0;
    });
  }

  // ---------- 個別の演出 ----------

  /** 360°回りながら 1.2 倍に浮く（0.15秒） */
  private lift(sv: ScrewView): Promise<void> {
    return this.tween({ targets: sv.c, scale: 1.2, angle: '+=360', duration: 150, ease: 'Quad.easeOut' });
  }

  /** 放物線で目的地へ（0.25秒） */
  private fly(sv: ScrewView, tx: number, ty: number): Promise<void> {
    const x0 = sv.c.x;
    const y0 = sv.c.y;
    const cx = (x0 + tx) / 2;
    const cy = Math.min(y0, ty) - 180;
    const o = { t: 0 };
    return this.tween({
      targets: o,
      t: 1,
      duration: 250,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const t = o.t;
        const u = 1 - t;
        sv.c.x = u * u * x0 + 2 * u * t * cx + t * t * tx;
        sv.c.y = u * u * y0 + 2 * u * t * cy + t * t * ty;
        sv.c.angle += 6;
      },
    });
  }

  /** 穴に「カチッ」：スケール戻し、穴が一瞬へこむ、金属粉 */
  private land(sv: ScrewView, hole: Phaser.GameObjects.Graphics, depth: number): void {
    sv.c.setScale(1).setAngle(0).setDepth(depth);
    this.g.sfx.click();
    void this.tween({ targets: hole, scale: 0.86, duration: 60, yoyo: true, ease: 'Quad.easeOut' });
    this.g.sparks.explode(Phaser.Math.Between(6, 10), sv.c.x, sv.c.y - 6);
  }

  /** 板が外れる：傾き→重力落下、画面が縦に 2px 揺れる、「ガタン」 */
  private async dropPlate(plateId: string): Promise<void> {
    const pv = this.g.plateViews.get(plateId);
    if (!pv) return;
    const dir = Math.random() < 0.5 ? -1 : 1;
    await this.tween({ targets: pv.c, angle: 5 * dir, duration: 100, ease: 'Quad.easeOut' });
    this.g.sfx.clunk();
    this.g.cameras.main.shake(120, new Phaser.Math.Vector2(0, 0.0011));
    await this.tween({ targets: pv.c, y: pv.c.y + 1900, angle: 9 * dir, duration: 400, ease: 'Quad.easeIn' });
    if (this.alive()) pv.c.destroy();
    this.g.plateViews.delete(plateId);
  }

  /** トレイ満杯：軽く跳ねて縮んで消える（0.3秒）、「ポン」 */
  private async trayComplete(ti: number): Promise<void> {
    const tv = this.g.trayViews[ti];
    if (!tv) return;
    const targets = [tv.c, ...tv.screws.filter((s): s is ScrewView => s !== null).map((s) => s.c)];
    this.g.sfx.pop();
    await this.tween({ targets, scale: 1.1, duration: 80, ease: 'Quad.easeOut' });
    await this.tween({ targets, scale: 0, duration: 220, ease: 'Back.easeIn' });
    if (!this.alive()) return;
    for (const t of targets) t.destroy();
    for (const s of tv.screws) if (s) this.g.screwViews.delete(s.id);
    this.g.trayViews[ti] = null;
  }

  /** 次トレイが右からスライドイン（0.25秒） */
  private async trayArrive(ti: number, color: Color): Promise<void> {
    if (!this.alive()) return;
    const tv = this.g.createTray(ti, color);
    tv.c.x = TRAY_X[ti] + 420;
    tv.c.alpha = 0;
    await this.tween({ targets: tv.c, x: TRAY_X[ti], alpha: 1, duration: 250, ease: 'Back.easeOut' });
  }

  /** 仮置き場から新トレイへ（1本 0.15秒） */
  private async suck(e: Extract<BoardEvent, { type: 'bufferSucked' }>): Promise<void> {
    const sv = this.g.bufferScrews[e.fromBufferIndex];
    const tv = this.g.trayViews[e.trayIndex];
    if (!sv || !tv) return;
    this.g.bufferScrews[e.fromBufferIndex] = null;
    sv.where = 'flying';
    sv.c.setDepth(DEPTH.flying);
    const tx = tv.c.x + TRAY_HOLE_DX[e.slot];
    const ty = tv.c.y;
    const x0 = sv.c.x;
    const y0 = sv.c.y;
    const o = { t: 0 };
    await this.tween({
      targets: o,
      t: 1,
      duration: 150,
      ease: 'Quad.easeInOut',
      onUpdate: () => {
        const t = o.t;
        sv.c.x = x0 + (tx - x0) * t;
        sv.c.y = y0 + (ty - y0) * t - Math.sin(t * Math.PI) * 120;
      },
    });
    this.land(sv, tv.holes[e.slot], DEPTH.trayScrew);
    tv.screws[e.slot] = sv;
    sv.where = 'tray';
  }

  /** 残ったネジを左詰め（0.15秒） */
  private async compact(moves: { screwId: string; from: number; to: number }[]): Promise<void> {
    const ps: Promise<void>[] = [];
    for (const m of moves) {
      const sv = this.g.bufferScrews[m.from];
      if (!sv) continue;
      this.g.bufferScrews[m.from] = null;
      this.g.bufferScrews[m.to] = sv;
      ps.push(this.tween({ targets: sv.c, x: BUFFER_X[m.to], duration: 150, ease: 'Quad.easeInOut' }));
    }
    await Promise.all(ps);
  }

  /** クリア：紙吹雪 */
  private confetti(): void {
    const colors = Object.values(SCREW);
    for (let i = 0; i < colors.length; i++) {
      this.g.confetti.setParticleTint(colors[i]);
      this.g.confetti.explode(22, 540 + Phaser.Math.Between(-300, 300), 500);
    }
  }
}
