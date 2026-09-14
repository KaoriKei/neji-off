// コード描画（Phaser Graphics）。画像素材は後から差し替える前提の仮の見た目。
// 「厚みのあるプラスチックのおもちゃ」：フラット＋上部ハイライト＋下辺の暗い帯＋柔らかい影。
import type Phaser from 'phaser';
import type { Color, PlateColor } from './Level';
import * as T from './Theme';

type G = Phaser.GameObjects.Graphics;

/** ネジ頭（真上視点、プラス溝）。中心 (0,0)、半径 SCREW_R */
export function drawScrew(g: G, color: Color): void {
  const r = T.SCREW_R;
  const main = T.SCREW[color];
  const dark = T.SCREW_DARK[color];
  g.clear();
  // 落ち影
  g.fillStyle(0x000000, 0.16);
  g.fillEllipse(0, 9, r * 2.15, r * 1.75);
  // 厚み
  g.fillStyle(dark, 1);
  g.fillCircle(0, 5, r);
  // 頭
  g.fillStyle(main, 1);
  g.fillCircle(0, 0, r);
  // ふち
  g.lineStyle(3, dark, 0.55);
  g.strokeCircle(0, 0, r);
  // ハイライト
  g.fillStyle(0xffffff, 0.28);
  g.fillEllipse(-7, -12, r * 1.05, r * 0.55);
  // プラス溝
  g.fillStyle(T.INK, 1);
  g.fillRoundedRect(-19, -4, 38, 8, 4);
  g.fillRoundedRect(-4, -19, 8, 38, 4);
  g.fillStyle(0xffffff, 0.14);
  g.fillRoundedRect(-19, -4, 38, 3, 2);
  g.fillRoundedRect(-4, -19, 3, 38, 2);
}

/** 板。中心 (0,0)、幅 w・高さ h */
export function drawPlate(g: G, w: number, h: number, color: PlateColor): void {
  const main = T.PLATE[color];
  const dark = T.PLATE_DARK[color];
  const r = 28;
  const x = -w / 2;
  const y = -h / 2;
  g.clear();
  // 柔らかい影（3層でぼかしの代わり）
  g.fillStyle(0x000000, 0.045);
  g.fillRoundedRect(x - 10, y + 18, w + 20, h + 14, r + 10);
  g.fillStyle(0x000000, 0.06);
  g.fillRoundedRect(x - 5, y + 14, w + 10, h + 8, r + 5);
  g.fillStyle(0x000000, 0.08);
  g.fillRoundedRect(x, y + 10, w, h + 4, r);
  // 厚み（下辺の暗い帯）
  g.fillStyle(dark, 1);
  g.fillRoundedRect(x, y + h - r, w, r + 6, { tl: 0, tr: 0, bl: r, br: r });
  // 本体（少し透けて、下のネジがうっすら見える）
  g.fillStyle(main, T.PLATE_ALPHA);
  g.fillRoundedRect(x, y, w, h, r);
  // 上部ハイライト
  g.fillStyle(0xffffff, 0.2);
  g.fillRoundedRect(x + 10, y + 8, w - 20, Math.min(72, h * 0.3), { tl: r - 8, tr: r - 8, bl: 14, br: 14 });
  // ふち
  g.lineStyle(3, dark, 0.5);
  g.strokeRoundedRect(x, y, w, h, r);
}

/** 板のハイライト用（白い面。普段は alpha 0） */
export function drawPlateHighlight(g: G, w: number, h: number): void {
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 28);
}

/** へこんだ穴。中心 (0,0) */
export function drawHole(g: G, r: number): void {
  g.clear();
  g.fillStyle(T.HOLE, 1);
  g.fillCircle(0, 0, r);
  g.fillStyle(0x000000, 0.07);
  g.fillEllipse(0, -r * 0.2, r * 1.6, r * 1.0);
  g.lineStyle(4, T.HOLE_DARK, 0.55);
  g.strokeCircle(0, 0, r);
}

/** トレイ本体。中心 (0,0)。受け入れ色でふち取り */
export function drawTrayBody(g: G, color: Color): void {
  const w = T.TRAY_W;
  const h = T.TRAY_H;
  const r = 26;
  g.clear();
  g.fillStyle(0x000000, 0.06);
  g.fillRoundedRect(-w / 2 - 4, -h / 2 + 12, w + 8, h + 4, r + 4);
  g.fillStyle(T.TRAY_BAND, 1);
  g.fillRoundedRect(-w / 2, -h / 2 + 6, w, h, r);
  g.fillStyle(T.TRAY_FILL, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
  g.lineStyle(8, T.SCREW[color], 1);
  g.strokeRoundedRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, r - 5);
  g.fillStyle(0xffffff, 0.35);
  g.fillRoundedRect(-w / 2 + 14, -h / 2 + 12, w - 28, 22, 10);
}

/** トレイの空枠（薄い輪郭だけ）。中心 (0,0) */
export function drawTrayGhost(g: G): void {
  g.clear();
  g.lineStyle(4, T.HOLE_DARK, 0.35);
  g.strokeRoundedRect(-T.TRAY_W / 2, -T.TRAY_H / 2, T.TRAY_W, T.TRAY_H, 26);
}

/** 仮置き場の枠。左上 (x,y) 基準 */
export function drawBufferFrame(g: G): void {
  const { x, y, w, h } = T.BUFFER_FRAME;
  const r = 30;
  g.clear();
  g.fillStyle(0x000000, 0.06);
  g.fillRoundedRect(x - 4, y + 12, w + 8, h + 4, r + 4);
  g.fillStyle(T.TRAY_BAND, 1);
  g.fillRoundedRect(x, y + 6, w, h, r);
  g.fillStyle(T.BUFFER_FILL, 1);
  g.fillRoundedRect(x, y, w, h, r);
  g.lineStyle(3, T.HOLE_DARK, 0.5);
  g.strokeRoundedRect(x, y, w, h, r);
}

/** 仮置き場の赤い光る枠（普段 alpha 0） */
export function drawBufferGlow(g: G): void {
  const { x, y, w, h } = T.BUFFER_FRAME;
  g.clear();
  g.lineStyle(10, T.ALERT_RED, 1);
  g.strokeRoundedRect(x - 2, y - 2, w + 4, h + 4, 32);
}

/** 丸ボタン（リトライ）。中心 (0,0) */
export function drawRetryButton(g: G): void {
  const r = T.RETRY.r;
  g.clear();
  g.fillStyle(0x000000, 0.12);
  g.fillEllipse(0, 12, r * 2.1, r * 1.7);
  g.fillStyle(T.BUTTON_BLUE_DARK, 1);
  g.fillCircle(0, 7, r);
  g.fillStyle(T.BUTTON_BLUE, 1);
  g.fillCircle(0, 0, r);
  g.fillStyle(0xffffff, 0.22);
  g.fillEllipse(-10, -24, r * 1.1, r * 0.55);
  // ↺ 矢印
  g.lineStyle(11, 0xffffff, 1);
  g.beginPath();
  g.arc(0, 0, 27, Phaser_DegToRad(-30), Phaser_DegToRad(255), false);
  g.strokePath();
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(38, -30, 12, -34, 26, -8);
}

/** 四角いボタン（リザルト用）。中心 (0,0) */
export function drawWideButton(g: G, w: number, h: number): void {
  const r = 32;
  g.clear();
  g.fillStyle(0x000000, 0.1);
  g.fillRoundedRect(-w / 2 - 2, -h / 2 + 12, w + 4, h, r);
  g.fillStyle(T.BUTTON_BLUE_DARK, 1);
  g.fillRoundedRect(-w / 2, -h / 2 + 7, w, h, r);
  g.fillStyle(T.BUTTON_BLUE, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
  g.fillStyle(0xffffff, 0.2);
  g.fillRoundedRect(-w / 2 + 10, -h / 2 + 8, w - 20, h * 0.35, { tl: r - 8, tr: r - 8, bl: 10, br: 10 });
}

/** 背景（クリーム＋ごく薄いビネット） */
export function drawBackground(g: G, w: number, h: number): void {
  g.clear();
  g.fillStyle(T.BG, 1);
  g.fillRect(0, 0, w, h);
  // ごく薄いビネット（外周だけ、縞が見えない程度に）
  for (let i = 0; i < 3; i++) {
    g.lineStyle(90, 0x6b5a3e, 0.012);
    g.strokeRoundedRect(-70 + i * 30, -70 + i * 30, w + 140 - i * 60, h + 140 - i * 60, 200);
  }
}

function Phaser_DegToRad(d: number): number {
  return (d * Math.PI) / 180;
}
