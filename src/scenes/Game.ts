// ゲーム本体のシーン。Board（ロジック）と Juice（演出）をつなぐ。
// 盤面（板とネジ）は boardLayer に入れて、レベル座標 → 画面座標へ縮小して金属フレームに収める。
import Phaser from 'phaser';
import { LEVELS } from '../data/levels/index';
import { Board, type BoardEvent } from '../game/Board';
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
  /** 覆われているときに板の上に出すグレーのシルエット */
  ghost?: Phaser.GameObjects.Graphics;
}
export interface TrayView {
  c: Phaser.GameObjects.Container;
  color: Color;
  holes: Phaser.GameObjects.Graphics[];
  screws: (ScrewView | null)[];
}

const TEXT = (size: number, color = T.NAVY_CSS): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: T.FONT, fontSize: `${size}px`, color, fontStyle: '800',
});

export class Game extends Phaser.Scene {
  /** create() ごとに増える世代番号。古い演出が新しい盤面を触らないための番兵 */
  gen = 0;
  levelIdx = 0;
  board!: Board;
  sfx!: Sfx;
  juice!: Juice;

  boardLayer!: Phaser.GameObjects.Container;
  plateViews = new Map<string, PlateView>();
  screwViews = new Map<string, ScrewView>();
  trayViews: (TrayView | null)[] = [null, null, null];
  bufferTiles: Phaser.GameObjects.Graphics[] = [];
  bufferMarks: Phaser.GameObjects.Graphics[] = [];
  bufferScrews: (ScrewView | null)[] = [];
  bufferGlow!: Phaser.GameObjects.Graphics;
  sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  confetti!: Phaser.GameObjects.Particles.ParticleEmitter;

  private retryBtn!: Phaser.GameObjects.Container;
  private progressFill!: Phaser.GameObjects.Graphics;
  private progress = { p: 0 };
  private bufferCount!: { ato: Phaser.GameObjects.Text; num: Phaser.GameObjects.Text; waku: Phaser.GameObjects.Text };
  private totalScrews = 0;
  private locked = false;
  private over = false;

  // チュートリアル（1面）：ひとことを状況に合わせて切り替える
  private hint!: Phaser.GameObjects.Text;
  /** 1面だけ：盤面の上に浮かぶ説明カード */
  private bubble?: { c: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text };
  private pointer?: Phaser.GameObjects.Container;
  private tutorial = false;
  private tut = { started: false, tray: false, plate: false };

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
    this.bufferTiles = [];
    this.bufferMarks = [];
    this.bufferScrews = [];
    this.progress = { p: 0 };
    this.tut = { started: false, tray: false, plate: false };
    this.pointer = undefined;
    this.bubble = undefined;

    const level = LEVELS[this.levelIdx];
    this.tutorial = level.tutorial === true;
    for (const w of validateLevel(level)) console.warn(w);
    this.board = new Board(level);
    this.totalScrews = this.board.allScrews().length;
    this.sfx = (this.registry.get('sfx') as Sfx | undefined) ?? new Sfx();
    this.registry.set('sfx', this.sfx);

    this.ensureTextures();

    // 背景
    D.drawBackground(this.add.graphics().setDepth(T.DEPTH.bg), BASE_W, BASE_H);

    // ---- ヘッダー ----
    D.makeLogo(this, T.HEADER.logoX, T.HEADER.logoY).setDepth(T.DEPTH.ui);
    const rb = this.add.graphics();
    D.drawRetryButton(rb);
    this.retryBtn = this.add.container(T.HEADER.retryX, T.HEADER.retryY, [rb]).setDepth(T.DEPTH.ui);
    this.add
      .text(T.HEADER.retryX - T.HEADER.retryR - 26, T.HEADER.levelY, `LEVEL ${String(level.id).padStart(2, '0')}`, TEXT(40))
      .setOrigin(1, 0.5)
      .setLetterSpacing(2)
      .setDepth(T.DEPTH.ui);
    const track = this.add.graphics({ x: T.PROGRESS.x, y: T.PROGRESS.y }).setDepth(T.DEPTH.ui);
    D.drawProgressTrack(track);
    this.progressFill = this.add.graphics({ x: T.PROGRESS.x, y: T.PROGRESS.y }).setDepth(T.DEPTH.ui + 1);
    D.drawProgressFill(this.progressFill, 0);

    // ひとこと（チュートリアル面は状況に合わせて切り替える）
    this.hint = this.add
      .text(BASE_W / 2, T.HINT_Y, this.tutorial ? 'ネジをタップして抜いてみよう' : '同じ色を3本そろえよう', TEXT(36))
      .setOrigin(0.5)
      .setDepth(T.DEPTH.ui);

    // ---- トレイ ----
    const snap = this.board.snapshot();
    for (let i = 0; i < 3; i++) {
      D.drawTrayGhost(this.add.graphics({ x: T.TRAY_X[i], y: T.TRAY_Y }).setDepth(T.DEPTH.ui));
      const t = snap.trays[i];
      if (t) this.createTray(i, t.color);
    }

    // ---- 盤面（金属フレーム＋板＋ネジ）----
    D.drawFrame(this.add.graphics().setDepth(T.DEPTH.ui));
    this.boardLayer = this.add.container(T.BOARD_OFFSET.x, T.BOARD_OFFSET.y).setScale(T.BOARD_SCALE).setDepth(T.DEPTH.board);
    // コンテナ内は追加順＝描画順なので、z の小さい板から順に「板→そのネジ」で入れる
    const plates = [...level.plates].sort((a, b) => a.z - b.z);
    for (const p of plates) {
      this.createPlate(p);
      p.screws.forEach((s, i) => this.createScrew(p, i, s));
    }
    // 覆われたネジのゴーストは全部の板より上に
    for (const sv of this.screwViews.values()) {
      const gh = this.add.graphics({ x: sv.c.x, y: sv.c.y });
      D.drawGhostScrew(gh);
      this.boardLayer.add(gh);
      sv.ghost = gh;
    }
    this.refreshGhosts();

    // ---- 仮置き場 ----
    const nBuf = this.board.bufferSize;
    this.bufferScrews = new Array<ScrewView | null>(nBuf).fill(null);
    this.add.text(T.BUFFER_LABEL_X.left, T.BUFFER_LABEL_Y, '一時置き', TEXT(40)).setOrigin(0, 0.5).setDepth(T.DEPTH.ui);
    const waku = this.add.text(T.BUFFER_LABEL_X.right, T.BUFFER_LABEL_Y + 22, '枠', TEXT(36)).setOrigin(1, 1).setDepth(T.DEPTH.ui);
    const num = this.add.text(0, T.BUFFER_LABEL_Y + 26, '5', TEXT(72, T.ORANGE_CSS)).setOrigin(1, 1).setDepth(T.DEPTH.ui);
    const ato = this.add.text(0, T.BUFFER_LABEL_Y + 22, 'あと', TEXT(36)).setOrigin(1, 1).setDepth(T.DEPTH.ui);
    this.bufferCount = { ato, num, waku };
    for (let i = 0; i < nBuf; i++) {
      const tile = this.add.graphics({ x: this.bufferX(i), y: T.BUFFER_Y }).setDepth(T.DEPTH.ui);
      D.drawTile(tile);
      this.bufferTiles.push(tile);
      const mark = this.add.graphics({ x: this.bufferX(i), y: T.BUFFER_Y }).setDepth(T.DEPTH.ui + 1);
      D.drawTileEmptyMark(mark);
      this.bufferMarks.push(mark);
    }
    this.bufferGlow = this.add.graphics().setDepth(T.DEPTH.ui + 2).setAlpha(0);
    D.drawBufferGlow(this.bufferGlow, nBuf);
    this.updateBufferCount();

    // ---- 商品カード ----
    this.createProductCard();

    // ---- フッター ----
    this.add.text(BASE_W / 2, T.FOOTER_Y, 'NEJI OFF', TEXT(24, T.GREY_TEXT_CSS)).setOrigin(0.5).setLetterSpacing(8).setDepth(T.DEPTH.ui);

    // ---- パーティクル ----
    this.sparks = this.add
      .particles(0, 0, 'dot', {
        speed: { min: 120, max: 320 },
        angle: { min: 200, max: 340 },
        lifespan: { min: 200, max: 380 },
        scale: { start: 0.7, end: 0 },
        gravityY: 1200,
        tint: [0xa8adb3, 0xd9dde1, 0x8c9198],
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

    // チュートリアル：説明は盤面上部に浮かぶカードで大きく出す（ヘッダー下の行は隠す）
    if (this.tutorial) {
      this.hint.setVisible(false);
      const bg = this.add.graphics();
      const text = this.add
        .text(0, 0, '', { ...TEXT(42), align: 'center', wordWrap: { width: 800, useAdvancedWrap: true }, lineSpacing: 10 })
        .setOrigin(0.5);
      const c = this.add.container(BASE_W / 2, T.BUBBLE_Y, [bg, text]).setDepth(T.DEPTH.flying + 3);
      this.bubble = { c, bg, text };
      this.tweens.add({ targets: c, y: T.BUBBLE_Y - 8, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.setHint('ネジをタップして抜いてみよう', true);
    }

    // チュートリアル：最初に抜けるネジを矢印で指す
    if (this.tutorial) {
      const first = this.board.pullableScrews()[0];
      if (first) {
        const s = this.board.getScrew(first)!;
        const p = this.toScreen(s.x, s.y);
        const g = this.add.graphics();
        D.drawPointer(g);
        this.pointer = this.add.container(p.x, p.y - 52, [g]).setDepth(T.DEPTH.flying + 2);
        this.tweens.add({ targets: this.pointer, y: p.y - 70, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    }
  }

  // ---------- チュートリアル ----------

  private setHint(text: string, force = false): void {
    if (this.bubble) {
      const { c, bg, text: t } = this.bubble;
      if (!force && t.text === text) return;
      t.setText(text);
      D.drawBubble(bg, Math.min(900, Math.max(520, t.width + 88)), t.height + 56);
      c.setScale(0.9).setAlpha(0.6);
      this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
      return;
    }
    if (!force && this.hint.text === text) return;
    this.hint.setText(text);
    this.hint.setScale(1.06);
    this.tweens.add({ targets: this.hint, scale: 1, duration: 220, ease: 'Back.easeOut' });
  }

  /** 抜けた結果に応じて説明を切り替える（1面のみ）。仮置き場の説明はどの面でも初回だけ出す */
  private tutorialOnEvents(events: BoardEvent[]): void {
    const has = (t: BoardEvent['type']): boolean => events.some((e) => e.type === t);
    if (has('screwToBuffer') && !this.registry.get('hintBufferShown')) {
      this.registry.set('hintBufferShown', true);
      this.setHint('入らないネジは一時置きへ。満杯になるとゲームオーバー');
      return;
    }
    if (!this.tutorial) return;
    if (this.pointer) {
      this.pointer.destroy();
      this.pointer = undefined;
    }
    if (!this.tut.started) {
      this.tut.started = true;
      this.setHint('同じ色のトレイに入るよ。3本そろえよう');
    }
    if (has('plateDropped') && !this.tut.plate) {
      this.tut.plate = true;
      this.time.delayedCall(700, () => this.setHint('板のネジを全部抜くと、板が外れる'));
    }
    if (has('trayCompleted') && !this.tut.tray) {
      this.tut.tray = true;
      const next = has('trayArrived') ? '次のトレイが来る' : '全部そろえたらクリア';
      this.time.delayedCall(700, () => this.setHint(`3本そろうとトレイが消える。${next}`));
    }
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
    D.drawTrayCard(body, color);
    const holes: Phaser.GameObjects.Graphics[] = [];
    for (const dx of T.TRAY_HOLE_DX) {
      const h = this.add.graphics({ x: dx, y: 0 });
      D.drawTrayHole(h, color);
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
    const c = this.add.container(p.x + p.w / 2, p.y + p.h / 2, [body, hl]);
    this.boardLayer.add(c);
    this.plateViews.set(p.id, { c, hl });
  }

  private createScrew(p: PlateDef, i: number, s: ScrewDef): void {
    const g = this.add.graphics();
    D.drawScrew(g, s.color);
    const c = this.add.container(s.x, s.y, [g]);
    this.boardLayer.add(c);
    const id = mkScrewId(p.id, i);
    this.screwViews.set(id, { id, c, color: s.color, where: 'board' });
  }

  private createProductCard(): void {
    const { x, y, w, h } = T.PRODUCT;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const card = this.add.graphics();
    D.drawCard(card, w, h, 28);
    const name = this.add.text(-w / 2 + 40, -22, 'タイヨウビス', TEXT(44)).setOrigin(0, 0.5);
    const sub = this.add.text(-w / 2 + 40, 28, 'D6皿ドリル', TEXT(28, T.GREY_TEXT_CSS)).setOrigin(0, 0.5);
    const line = this.add.graphics();
    line.lineStyle(2, T.CARD_LINE, 1);
    line.beginPath();
    line.moveTo(-w / 2 + 330, -h / 2 + 30);
    line.lineTo(-w / 2 + 330, h / 2 - 30);
    line.strokePath();
    const sg = this.add.graphics();
    D.drawSideScrew(sg);
    // 仕切りの右側はネジのイラストだけ（文言なし）。残り幅の中央に置く
    const screw = this.add.container(-w / 2 + 330 + 215, 34, [sg]).setAngle(-22).setScale(1.05);
    this.add.container(cx, cy, [card, name, sub, line, screw]).setDepth(T.DEPTH.ui);
  }

  // ---------- 盤面 ⇄ 画面 ----------

  /** 仮置き場 i 番目のタイルの中心 x */
  bufferX(i: number): number {
    return T.bufferX(i, this.board.bufferSize);
  }

  /** レベル座標 → 画面座標 */
  toScreen(lx: number, ly: number): { x: number; y: number } {
    return { x: this.boardLayer.x + lx * T.BOARD_SCALE, y: this.boardLayer.y + ly * T.BOARD_SCALE };
  }

  /** 盤面レイヤーからネジを取り出して、画面座標の直下オブジェクトにする（飛ばす前に呼ぶ） */
  detachFromBoard(sv: ScrewView): void {
    if (sv.c.parentContainer !== this.boardLayer) return;
    const p = this.toScreen(sv.c.x, sv.c.y);
    this.boardLayer.remove(sv.c);
    this.add.existing(sv.c);
    sv.c.setPosition(p.x, p.y).setScale(T.BOARD_SCALE).setDepth(T.DEPTH.flying);
  }

  /** 覆われているネジだけゴーストを出す */
  refreshGhosts(): void {
    for (const s of this.board.allScrews()) {
      const sv = this.screwViews.get(s.id);
      sv?.ghost?.setVisible(!s.pulled && this.board.isCovered(s.id));
    }
  }

  /** 進捗バーと「あと N 枠」を今の盤面状態に合わせる */
  refreshHud(): void {
    this.refreshGhosts();
    const pulled = this.totalScrews - this.board.remainingScrews();
    const target = this.totalScrews > 0 ? pulled / this.totalScrews : 0;
    this.tweens.add({
      targets: this.progress,
      p: target,
      duration: 300,
      ease: 'Quad.easeOut',
      onUpdate: () => D.drawProgressFill(this.progressFill, this.progress.p),
    });
    this.updateBufferCount();
  }

  private updateBufferCount(): void {
    const s = this.board.snapshot();
    const n = s.bufferSize - s.buffer.length;
    const { ato, num, waku } = this.bufferCount;
    num.setText(`${n}`);
    num.setX(waku.x - waku.width - 6);
    ato.setX(num.x - num.width - 8);
    num.setColor(n === 0 ? '#E0392B' : T.ORANGE_CSS);
    this.bufferMarks.forEach((m, i) => m.setVisible(i >= s.buffer.length));
  }

  // ---------- 入力 ----------

  private onTap(x: number, y: number): void {
    this.sfx.unlock();
    if (Phaser.Math.Distance.Between(x, y, T.HEADER.retryX, T.HEADER.retryY) <= T.HEADER.retryR + 14) {
      this.retry();
      return;
    }
    if (this.over || this.locked) return;

    const id = this.hitScrew(x, y);
    if (!id) return;

    const r = this.board.pull(id);
    if (!r.ok) {
      if (r.reason === 'covered') {
        this.juice.shakeCovered(id, r.coveredBy);
        if (this.tutorial) this.setHint('上の板にかくれたネジは抜けない。上の板から外そう');
      } else if (r.reason === 'full') {
        this.juice.shakeFull(id);
        this.setHint('一時置きが満杯。同じ色のトレイが来るまで抜けない');
      }
      return;
    }
    this.tutorialOnEvents(r.events);
    // 入力ロックは抜いたネジの飛行 0.4 秒だけ
    this.locked = true;
    this.time.delayedCall(400, () => {
      this.locked = false;
    });
    this.refreshHud();
    void this.juice.play(r.events);
  }

  /** タップ位置に一番近い（一番上の板の）盤面上のネジ。判定半径は見た目より一回り大きい（画面座標） */
  private hitScrew(x: number, y: number): string | null {
    let best: { id: string; z: number; d: number } | null = null;
    for (const s of this.board.allScrews()) {
      if (s.pulled) continue;
      const p = this.toScreen(s.x, s.y);
      const d = Phaser.Math.Distance.Between(x, y, p.x, p.y);
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
    const dim = this.add.rectangle(BASE_W / 2, BASE_H / 2, BASE_W, BASE_H, 0x1d2630, 0.45).setDepth(T.DEPTH.overlay).setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 1, duration: 300 });
    this.bufferGlow.setAlpha(1);

    const n = this.board.remainingScrews();
    const num = this.add.text(BASE_W / 2, 880, `${n}`, TEXT(260, '#FFFFFF')).setOrigin(0.5).setDepth(T.DEPTH.overlayUi).setAlpha(0);
    const unit = this.add.text(BASE_W / 2, 1080, 'のこり', TEXT(48, '#FFFFFF')).setOrigin(0.5).setDepth(T.DEPTH.overlayUi).setAlpha(0);
    this.tweens.add({ targets: [num, unit], alpha: 1, duration: 300, delay: 150 });

    this.retryBtn.setDepth(T.DEPTH.overlayUi);
    this.tweens.add({ targets: this.retryBtn, y: T.HEADER.retryY - 10, scale: 1.12, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
}
