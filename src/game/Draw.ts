// コード描画（Phaser Graphics）。画像素材は後から差し替える前提の仮の見た目。
// v0.4：紺×オレンジのロゴ、白カード、金属フレーム、色つきワッシャー×銀頭のネジ。
import type Phaser from 'phaser';
import type { Color, PlateColor } from './Level';
import * as T from './Theme';

type G = Phaser.GameObjects.Graphics;

const rad = (d: number): number => (d * Math.PI) / 180;

/** 背景（クリーム、フラット） */
export function drawBackground(g: G, w: number, h: number): void {
  g.clear();
  g.fillStyle(T.BG, 1);
  g.fillRect(0, 0, w, h);
}

/** ロゴ「NEJI OFF / by NEJICO」。左上 (x,y) 基準のコンテナを返す */
export function makeLogo(scene: Phaser.Scene, x: number, y: number, size = 84): Phaser.GameObjects.Container {
  const neji = scene.add.text(0, 0, 'NEJI', { fontFamily: T.FONT, fontSize: `${size}px`, color: T.NAVY_CSS, fontStyle: '800' }).setOrigin(0, 0);
  const off = scene.add
    .text(neji.width + size * 0.16, 0, 'OFF', { fontFamily: T.FONT, fontSize: `${size}px`, color: T.ORANGE_CSS, fontStyle: '800' })
    .setOrigin(0, 0);
  const by = scene.add
    .text(size * 0.06, size * 1.06, 'by NEJICO', { fontFamily: T.FONT, fontSize: `${Math.round(size * 0.3)}px`, color: T.NAVY_CSS, fontStyle: '800' })
    .setOrigin(0, 0)
    .setLetterSpacing(2);
  return scene.add.container(x, y, [neji, off, by]);
}

/** 進捗バーの下地 */
export function drawProgressTrack(g: G): void {
  const { w, h } = T.PROGRESS;
  g.clear();
  g.fillStyle(T.TRACK, 1);
  g.fillRoundedRect(0, 0, w, h, h / 2);
}

/** 進捗バーの中身（0〜1） */
export function drawProgressFill(g: G, p: number): void {
  const { w, h } = T.PROGRESS;
  const fw = Math.max(h, w * Math.min(1, Math.max(0, p)));
  g.clear();
  g.fillStyle(T.ORANGE, 1);
  g.fillRoundedRect(0, 0, fw, h, h / 2);
  g.fillStyle(0xffffff, 0.35);
  g.fillRoundedRect(4, 3, fw - 8, h * 0.35, h * 0.2);
}

/** オレンジの丸リトライボタン。中心 (0,0) */
export function drawRetryButton(g: G): void {
  const r = T.HEADER.retryR;
  g.clear();
  g.fillStyle(0x000000, 0.12);
  g.fillEllipse(0, 10, r * 2.1, r * 1.7);
  g.fillStyle(T.ORANGE_DARK, 1);
  g.fillCircle(0, 6, r);
  g.fillStyle(T.ORANGE, 1);
  g.fillCircle(0, 0, r);
  g.fillStyle(0xffffff, 0.25);
  g.fillEllipse(-8, -18, r * 1.1, r * 0.5);
  g.lineStyle(9, 0xffffff, 1);
  g.beginPath();
  g.arc(0, 0, 21, rad(-30), rad(255), false);
  g.strokePath();
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(30, -24, 9, -27, 21, -6);
}

/** 金属フレーム＋レール＋リベット */
export function drawFrame(g: G): void {
  const { x, y, w, h, r, border } = T.FRAME;
  g.clear();
  // 影
  g.fillStyle(0x000000, 0.1);
  g.fillRoundedRect(x - 6, y + 16, w + 12, h + 6, r + 6);
  // 外枠（鋼）
  g.fillStyle(T.STEEL_OUTER, 1);
  g.fillRoundedRect(x, y, w, h, r);
  g.lineStyle(4, 0xffffff, 0.35);
  g.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, r - 3);
  g.lineStyle(3, 0x000000, 0.15);
  g.strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, r - 1);
  // 内側のくぼみ
  const ix = x + border;
  const iy = y + border;
  const iw = w - border * 2;
  const ih = h - border * 2;
  g.fillStyle(T.STEEL_INNER, 1);
  g.fillRoundedRect(ix, iy, iw, ih, 16);
  // レール（縦）
  const railW = 96;
  const gap = 40;
  const n = Math.floor((iw - gap) / (railW + gap));
  const start = ix + (iw - (n * railW + (n - 1) * gap)) / 2;
  for (let i = 0; i < n; i++) {
    const rx = start + i * (railW + gap);
    g.fillStyle(T.RAIL_LIGHT, 1);
    g.fillRoundedRect(rx, iy + 14, railW, ih - 28, 14);
    g.fillStyle(T.RAIL_DARK, 1);
    g.fillRoundedRect(rx + railW - 14, iy + 14, 14, ih - 28, { tl: 0, tr: 14, bl: 0, br: 14 });
    g.fillStyle(0xffffff, 0.35);
    g.fillRoundedRect(rx + 6, iy + 14, 6, ih - 28, 3);
  }
  // 内側の落ち影
  g.lineStyle(12, 0x000000, 0.1);
  g.strokeRoundedRect(ix + 4, iy + 4, iw - 8, ih - 8, 14);
  // リベット
  const rv = [
    [x + border / 2, y + border / 2],
    [x + w - border / 2, y + border / 2],
    [x + border / 2, y + h - border / 2],
    [x + w - border / 2, y + h - border / 2],
  ];
  for (const [cx, cy] of rv) {
    g.fillStyle(0x000000, 0.2);
    g.fillCircle(cx, cy + 2, 9);
    g.fillStyle(T.RIVET, 1);
    g.fillCircle(cx, cy, 9);
    g.fillStyle(0xffffff, 0.45);
    g.fillCircle(cx - 3, cy - 3, 3.5);
  }
}

/** 板。中心 (0,0)、幅 w・高さ h（レベル座標） */
export function drawPlate(g: G, w: number, h: number, color: PlateColor): void {
  const main = T.PLATE[color];
  const dark = T.PLATE_DARK[color];
  const r = 26;
  const x = -w / 2;
  const y = -h / 2;
  g.clear();
  // 柔らかい影（3層）
  g.fillStyle(0x000000, 0.05);
  g.fillRoundedRect(x - 10, y + 18, w + 20, h + 14, r + 10);
  g.fillStyle(0x000000, 0.07);
  g.fillRoundedRect(x - 5, y + 14, w + 10, h + 8, r + 5);
  g.fillStyle(0x000000, 0.1);
  g.fillRoundedRect(x, y + 10, w, h + 4, r);
  // 厚み
  g.fillStyle(dark, 1);
  g.fillRoundedRect(x, y + h - r, w, r + 6, { tl: 0, tr: 0, bl: r, br: r });
  // 本体（少し透ける）
  g.fillStyle(main, T.PLATE_ALPHA);
  g.fillRoundedRect(x, y, w, h, r);
  // 上辺・左辺のベベル
  g.lineStyle(3, 0xffffff, 0.6);
  g.beginPath();
  g.moveTo(x + r, y + 2);
  g.lineTo(x + w - r, y + 2);
  g.strokePath();
  g.beginPath();
  g.moveTo(x + 2, y + r);
  g.lineTo(x + 2, y + h - r);
  g.strokePath();
  // ふち
  g.lineStyle(2, dark, 0.5);
  g.strokeRoundedRect(x, y, w, h, r);
}

/** 板のハイライト用（白い面。普段は alpha 0） */
export function drawPlateHighlight(g: G, w: number, h: number): void {
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 26);
}

/** ネジ（真上視点）：色つきワッシャー＋銀の頭＋プラス溝。中心 (0,0) */
export function drawScrew(g: G, color: Color): void {
  const R = T.SCREW_R;
  const H = T.SCREW_HEAD_R;
  g.clear();
  // 落ち影
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(0, 9, R * 2.1, R * 1.7);
  // ワッシャー
  g.fillStyle(T.RING_DARK[color], 1);
  g.fillCircle(0, 4, R);
  g.fillStyle(T.RING[color], 1);
  g.fillCircle(0, 0, R);
  g.fillStyle(0xffffff, 0.28);
  g.fillEllipse(-5, -15, R * 1.15, R * 0.5);
  // 頭（銀）
  g.fillStyle(0x000000, 0.15);
  g.fillCircle(0, 3, H + 2);
  g.fillStyle(T.HEAD_DARK, 1);
  g.fillCircle(0, 2, H);
  g.fillStyle(T.HEAD, 1);
  g.fillCircle(0, 0, H - 1);
  g.fillStyle(0xffffff, 0.6);
  g.fillEllipse(-7, -10, H * 1.0, H * 0.55);
  // プラス溝
  g.fillStyle(T.SLOT, 1);
  g.fillRoundedRect(-18, -4, 36, 8, 3);
  g.fillRoundedRect(-4, -18, 8, 36, 3);
  g.fillStyle(0xffffff, 0.3);
  g.fillRoundedRect(-18, -4, 36, 2, 1);
  g.fillRoundedRect(-4, -18, 2, 36, 1);
}

/** 覆われたネジのゴースト（板の上にグレーのシルエット）。中心 (0,0) */
export function drawGhostScrew(g: G): void {
  const R = T.SCREW_R;
  const H = T.SCREW_HEAD_R;
  g.clear();
  g.fillStyle(0xffffff, 0.35);
  g.fillCircle(0, 2, R);
  g.fillStyle(T.SLOT, 0.1);
  g.fillCircle(0, 0, R);
  g.lineStyle(3, T.SLOT, 0.22);
  g.strokeCircle(0, 0, R);
  g.fillStyle(T.HEAD_DARK, 0.3);
  g.fillCircle(0, 0, H);
  g.fillStyle(T.SLOT, 0.32);
  g.fillRoundedRect(-18, -4, 36, 8, 3);
  g.fillRoundedRect(-4, -18, 8, 36, 3);
}

/** 点線の円 */
export function drawDashedCircle(g: G, r: number, color: number, width = 4, dashes = 12, alpha = 1): void {
  g.lineStyle(width, color, alpha);
  const step = (Math.PI * 2) / dashes;
  for (let i = 0; i < dashes; i++) {
    const a0 = i * step;
    g.beginPath();
    g.arc(0, 0, r, a0, a0 + step * 0.55, false);
    g.strokePath();
  }
}

/** 点線の角丸四角。中心 (0,0) */
export function drawDashedRoundedRect(g: G, w: number, h: number, r: number, color: number, width = 4, alpha = 1): void {
  g.lineStyle(width, color, alpha);
  const x = -w / 2;
  const y = -h / 2;
  const dash = 14;
  const gap = 10;
  const edge = (x0: number, y0: number, x1: number, y1: number): void => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const ux = (x1 - x0) / len;
    const uy = (y1 - y0) / len;
    for (let d = 0; d < len; d += dash + gap) {
      const e = Math.min(len, d + dash);
      g.beginPath();
      g.moveTo(x0 + ux * d, y0 + uy * d);
      g.lineTo(x0 + ux * e, y0 + uy * e);
      g.strokePath();
    }
  };
  edge(x + r, y, x + w - r, y);
  edge(x + w, y + r, x + w, y + h - r);
  edge(x + w - r, y + h, x + r, y + h);
  edge(x, y + h - r, x, y + r);
  const corner = (cx: number, cy: number, a0: number): void => {
    g.beginPath();
    g.arc(cx, cy, r, a0, a0 + Math.PI / 2, false);
    g.strokePath();
  };
  corner(x + w - r, y + r, -Math.PI / 2);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  corner(x + r, y + r, Math.PI);
}

/** トレイの白カード。中心 (0,0)。受け入れ色でふち取り */
export function drawTrayCard(g: G, color: Color): void {
  const w = T.TRAY_W;
  const h = T.TRAY_H;
  const r = 24;
  g.clear();
  g.fillStyle(0x000000, 0.07);
  g.fillRoundedRect(-w / 2 - 3, -h / 2 + 10, w + 6, h + 2, r + 3);
  g.fillStyle(T.CARD_BAND, 1);
  g.fillRoundedRect(-w / 2, -h / 2 + 6, w, h, r);
  g.fillStyle(T.CARD, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
  g.lineStyle(6, T.RING[color], 1);
  g.strokeRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, r - 4);
}

/** トレイの空枠（薄い点線） */
export function drawTrayGhost(g: G): void {
  g.clear();
  drawDashedRoundedRect(g, T.TRAY_W, T.TRAY_H, 24, T.RAIL_DARK, 4, 0.6);
}

/** トレイの穴（点線の円）。中心 (0,0) */
export function drawTrayHole(g: G, color: Color): void {
  g.clear();
  g.fillStyle(T.RING[color], 0.08);
  g.fillCircle(0, 0, T.TRAY_HOLE_R);
  drawDashedCircle(g, T.TRAY_HOLE_R - 3, T.RING[color], 4, 12, 0.7);
}

/** 仮置き場のタイル（白い角丸）。中心 (0,0) */
export function drawTile(g: G): void {
  const s = T.BUFFER_TILE;
  const r = 24;
  g.clear();
  g.fillStyle(0x000000, 0.07);
  g.fillRoundedRect(-s / 2 - 3, -s / 2 + 10, s + 6, s + 2, r + 3);
  g.fillStyle(T.CARD_BAND, 1);
  g.fillRoundedRect(-s / 2, -s / 2 + 6, s, s, r);
  g.fillStyle(T.CARD, 1);
  g.fillRoundedRect(-s / 2, -s / 2, s, s, r);
  g.lineStyle(2, T.CARD_LINE, 1);
  g.strokeRoundedRect(-s / 2, -s / 2, s, s, r);
}

/** 仮置き場の空きタイルの中の点線 */
export function drawTileEmptyMark(g: G): void {
  g.clear();
  drawDashedRoundedRect(g, T.BUFFER_TILE - 44, T.BUFFER_TILE - 44, 16, T.RAIL_DARK, 4, 0.8);
}

/** 仮置き場の赤い光る枠（普段 alpha 0） */
export function drawBufferGlow(g: G): void {
  const { x, y, w, h } = T.BUFFER_ROW;
  g.clear();
  g.lineStyle(10, T.ALERT_RED, 1);
  g.strokeRoundedRect(x, y, w, h, 34);
}

/** 白いカード（商品カード・リザルト）。中心 (0,0) */
export function drawCard(g: G, w: number, h: number, r = 30): void {
  g.clear();
  g.fillStyle(0x000000, 0.08);
  g.fillRoundedRect(-w / 2 - 3, -h / 2 + 12, w + 6, h + 2, r + 3);
  g.fillStyle(T.CARD_BAND, 1);
  g.fillRoundedRect(-w / 2, -h / 2 + 7, w, h, r);
  g.fillStyle(T.CARD, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
}

/** 横長のオレンジボタン。中心 (0,0) */
export function drawWideButton(g: G, w: number, h: number): void {
  const r = h / 2;
  g.clear();
  g.fillStyle(0x000000, 0.1);
  g.fillRoundedRect(-w / 2 - 2, -h / 2 + 12, w + 4, h, r);
  g.fillStyle(T.ORANGE_DARK, 1);
  g.fillRoundedRect(-w / 2, -h / 2 + 7, w, h, r);
  g.fillStyle(T.ORANGE, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
  g.fillStyle(0xffffff, 0.22);
  g.fillRoundedRect(-w / 2 + 12, -h / 2 + 8, w - 24, h * 0.35, r * 0.6);
}

/** ドリルビスの横向きイラスト（商品カード用）。左端の頭が (0,0)、右に向かって伸びる。全長 ≈ 190 */
export function drawSideScrew(g: G): void {
  g.clear();
  // 影
  g.fillStyle(0x000000, 0.12);
  g.fillRoundedRect(-4, -12 + 8, 190, 24, 8);
  // 軸
  g.fillStyle(T.HEAD_DARK, 1);
  g.fillRect(16, -9, 140, 18);
  g.fillStyle(T.HEAD, 1);
  g.fillRect(16, -9, 140, 11);
  // ねじ山
  g.lineStyle(3, T.SLOT, 0.55);
  for (let x = 24; x < 150; x += 12) {
    g.beginPath();
    g.moveTo(x, -9);
    g.lineTo(x + 6, 9);
    g.strokePath();
  }
  // ドリル先端
  g.fillStyle(T.HEAD_DARK, 1);
  g.fillTriangle(156, -9, 156, 9, 186, 0);
  g.fillStyle(T.HEAD, 1);
  g.fillTriangle(156, -9, 156, 0, 184, -1);
  // 皿頭
  g.fillStyle(T.HEAD_DARK, 1);
  g.fillTriangle(0, -22, 0, 22, 18, 9);
  g.fillTriangle(0, -22, 18, -9, 18, 9);
  g.fillStyle(T.HEAD, 1);
  g.fillTriangle(0, -22, 0, 0, 18, -9);
  g.fillStyle(T.SLOT, 1);
  g.fillRoundedRect(-4, -14, 6, 28, 2);
}
