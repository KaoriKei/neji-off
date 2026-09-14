// ゲーム本体のシーン。Board（ロジック）と Juice（演出）をつなぐ。
import Phaser from 'phaser';
import { LEVELS } from '../data/levels/index';
import { Board } from '../game/Board';
import { validateLevel, screwId as mkScrewId, type Color, type PlateDef, type ScrewDef, BASE_W, BASE_H } from '../game/Level';
import { Juice } from '../game/Juice';
import { Sfx } from '../game/Sfx';
import * as T from '../game/Theme';
import * as D from '../game/Draw';

export interface PlateView {
  c: Phaser.GameObjects.Container;
  hl: Phaser.GameObjects.Graphics;
}
export interface ScrewView {
  id: string;
  c: Phaser.GameObjects.Container;
  color: Color;
  where: 'board' | 'tray' | 'buffer' | 'flying';
}
export interface TrayView {
  c: Phaser.GameObjects.Container;
  color: Color;
  holes: Phaser.GameObjects.Graphics[];
  screws: (ScrewView | null)[];
}

export class Game extends Phaser.Scene {
  /** create() ごとに増える世代番号。古い演出が新しい盤面を触らないための番兵 */
  gen = 0;
  levelIdx = 0;
  board!: Board;
  sfx!: Sfx;
  juice!: Juice;

  plateViews = new Map<string, PlateView>();
  screwViews = new Map<string, ScrewView>();
  trayViews: (TrayView | null)[] = [null, null, null];
  bufferHoles: Phaser.GameObjects.Graphics[] = [];
  bufferScrews: (ScrewView | null)[] = [null, null, null, null, null];
  bufferGlow!: Phaser.GameObjects.Graphics;
  sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  confetti!: Phaser.GameObjects.Particles.ParticleEmitter;

  private retryBtn!: Phaser.GameObjects.Container;
  private locked = false;
  private over = false;

  constructor() {
    super('Game');
  }

  init(data: { level?: number }): void {
    this.levelIdx = Phaser.Math.Clamp(data.level ?? 0, 0, LEVELS.length - 1);
  }

  create(): void {
    this.gen++;
    this.input.enabled = true;
    this.locked = false;
    this.over = false;
    this.plateViews = new Map();
    this.screwViews = new Map();
    this.trayViews = [null, null, null];
    this.bufferHoles = [];
    this.bufferScrews = [null, null, null, null, null];

    const level = LEVELS[this.levelIdx];
    for (const w of validateLevel(level)) console.warn(w);
    this.board = new Board(level);
    this.sfx = (this.registry.get('sfx') as Sfx | undefined) ?? new Sfx();
    this.registry.set('sfx', this.sfx);

    this.ensureTextures();

    // 背景
    D.drawBackground(this.add.graphics().setDepth(T.DEPTH.bg), BASE_W, BASE_H);

    // レベル番号
    this.add
      .text(BASE_W / 2, T.LEVEL_LABEL_Y, `レベル ${level.id}`, {
        fontFamily: T.FONT, fontSize: '44px', color: '#3A3A3A', fontStyle: '800',
      })
      .setOrigin(0.5)
      .setDepth(T.DEPTH.ui);

    // トレイ（空枠の輪郭を常に敷いておく）
    const snap = this.board.snapshot();
    for (let i = 0; i < 3; i++) {
      D.drawTrayGhost(this.add.graphics({ x: T.TRAY_X[i], y: T.TRAY_Y }).setDepth(T.DEPTH.ui));
      const t = snap.trays[i];
      if (t) this.createTray(i, t.color);
    }

    // 仮置き場
    D.drawBufferFrame(this.add.graphics().setDepth(T.DEPTH.ui));
    for (let i = 0; i < 5; i++) {
      const h = this.add.graphics({ x: T.BUFFER_X[i], y: T.BUFFER_Y }).setDepth(T.DEPTH.ui + 1);
      D.drawHole(h, T.BUFFER_HOLE_R);
      this.bufferHoles.push(h);
    }
    this.bufferGlow = this.add.graphics().setDepth(T.DEPTH.ui + 2).setAlpha(0);
    D.drawBufferGlow(this.bufferGlow);

    // リトライ
    const rb = this.add.graphics();
    D.drawRetryButton(rb);
    this.retryBtn = this.add.container(T.RETRY.x, T.RETRY.y, [rb]).setDepth(T.DEPTH.ui);

    // 板とネジ
    for (const p of level.plates) {
      this.createPlate(p);
      p.screws.forEach((s, i) => this.createScrew(p, i, s));
    }

    // パーティクル
    this.sparks = this.add
      .particles(0, 0, 'dot', {
        speed: { min: 120, max: 320 },
        angle: { min: 200, max: 340 },
        lifespan: { min: 200, max: 380 },
        scale: { start: 0.7, end: 0 },
        gravityY: 1200,
        tint: [0xa89f92, 0xd9d0c2, 0x8c8478],
        emitting: false,
      })
      .setDepth(T.DEPTH.flying + 1);
    this.confetti = this.add
      .particles(0, 0, 'confetti', {
        speed: { min: 250, max: 700 },
        angle: { min: 220, max: 320 },
        lifespan: { min: 1400, max: 2200 },
        gravityY: 900,
        rotate: { min: 0, max: 360 },
        scale: { start: 1, end: 0.6 },
        alpha: { start: 1, end: 0 },
        emitting: false,
      })
      .setDepth(T.DEPTH.overlayUi);

    this.juice = new Juice(this);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p.x, p.y));
  }

  // ---------- 生成 ----------

  private ensureTextures(): void {
    if (!this.textures.exists('dot')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(4, 4, 4);
      g.generateTexture('dot', 8, 8);
      g.destroy();
    }
    if (!this.textures.exists('confetti')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 12, 18);
      g.generateTexture('confetti', 12, 18);
      g.destroy();
    }
  }

  createTray(i: number, color: Color): TrayView {
    const body = this.add.graphics();
    D.drawTrayBody(body, color);
    const holes: Phaser.GameObjects.Graphics[] = [];
    for (const dx of T.TRAY_HOLE_DX) {
      const h = this.add.graphics({ x: dx, y: 0 });
      D.drawHole(h, T.TRAY_HOLE_R);
      holes.push(h);
    }
    const c = this.add.container(T.TRAY_X[i], T.TRAY_Y, [body, ...holes]).setDepth(T.DEPTH.ui + 1);
    const tv: TrayView = { c, color, holes, screws: [null, null, null] };
    this.trayViews[i] = tv;
    return tv;
  }

  private createPlate(p: PlateDef): void {
    const body = this.add.graphics();
    D.drawPlate(body, p.w, p.h, p.color);
    const hl = this.add.graphics().setAlpha(0);
    D.drawPlateHighlight(hl, p.w, p.h);
    const c = this.add.container(p.x + p.w / 2, p.y + p.h / 2, [body, hl]).setDepth(T.DEPTH.plateBase + p.z * T.DEPTH.plateStep);
    this.plateViews.set(p.id, { c, hl });
  }

  private createScrew(p: PlateDef, i: number, s: ScrewDef): void {
    const g = this.add.graphics();
    D.drawScrew(g, s.color);
    const c = this.add.container(s.x, s.y, [g]).setDepth(T.DEPTH.plateBase + p.z * T.DEPTH.plateStep + T.DEPTH.screwOffset);
    const id = mkScrewId(p.id, i);
    this.screwViews.set(id, { id, c, color: s.color, where: 'board' });
  }

  // ---------- 入力 ----------

  private onTap(x: number, y: number): void {
    this.sfx.unlock();
    if (Phaser.Math.Distance.Between(x, y, T.RETRY.x, T.RETRY.y) <= T.RETRY.r + 12) {
      this.retry();
      return;
    }
    if (this.over || this.locked) return;

    const id = this.hitScrew(x, y);
    if (!id) return;

    const r = this.board.pull(id);
    if (!r.ok) {
      if (r.reason === 'covered') this.juice.shakeCovered(id, r.coveredBy);
      else if (r.reason === 'full') this.juice.shakeFull(id);
      return;
    }
    // 入力ロックは抜いたネジの飛行 0.4 秒だけ
    this.locked = true;
    this.time.delayedCall(400, () => {
      this.locked = false;
    });
    void this.juice.play(r.events);
  }

  /** タップ位置に一番近い（一番上の板の）盤面上のネジ。判定半径は見た目より一回り大きい */
  private hitScrew(x: number, y: number): string | null {
    let best: { id: string; z: number; d: number } | null = null;
    for (const s of this.board.allScrews()) {
      if (s.pulled) continue;
      const d = Phaser.Math.Distance.Between(x, y, s.x, s.y);
      if (d > T.TAP_R) continue;
      const z = this.board.getPlate(s.plateId)!.z;
      if (!best || z > best.z || (z === best.z && d < best.d)) best = { id: s.id, z, d };
    }
    return best?.id ?? null;
  }

  private retry(): void {
    this.scene.stop('Result');
    this.scene.restart({ level: this.levelIdx });
  }

  // ---------- 終了 ----------

  onCleared(): void {
    this.over = true;
    this.input.enabled = false;
    this.scene.launch('Result', { level: this.levelIdx, isLast: this.levelIdx >= LEVELS.length - 1 });
  }

  /** ゲームオーバー：暗くして、残ネジ本数を大きく出し、リトライだけ浮かせる。責めない。 */
  onStuck(): void {
    this.over = true;
    const dim = this.add.rectangle(BASE_W / 2, BASE_H / 2, BASE_W, BASE_H, 0x000000, 0.3).setDepth(T.DEPTH.overlay).setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 1, duration: 300 });
    this.bufferGlow.setAlpha(1);

    const n = this.board.remainingScrews();
    const num = this.add
      .text(BASE_W / 2, 880, `${n}`, { fontFamily: T.FONT, fontSize: '260px', color: '#FFFFFF', fontStyle: '800' })
      .setOrigin(0.5)
      .setDepth(T.DEPTH.overlayUi)
      .setAlpha(0);
    const unit = this.add
      .text(BASE_W / 2, 1080, 'のこり', { fontFamily: T.FONT, fontSize: '48px', color: '#FFFFFF', fontStyle: '800' })
      .setOrigin(0.5)
      .setDepth(T.DEPTH.overlayUi)
      .setAlpha(0);
    this.tweens.add({ targets: [num, unit], alpha: 1, duration: 300, delay: 150 });

    this.retryBtn.setDepth(T.DEPTH.overlayUi);
    this.tweens.add({ targets: this.retryBtn, y: T.RETRY.y - 14, scale: 1.08, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
}
