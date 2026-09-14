// 配色・レイアウト定数（v0.4 UI：紺×オレンジ、白カード、金属フレーム）
import type { Color, PlateColor } from './Level';

export const FONT = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Rounded Mplus 1c", sans-serif';

// 基本色
export const BG = 0xf6f1e8; // クリーム
export const NAVY = 0x2e3a48; // 文字・ロゴ
export const NAVY_CSS = '#2E3A48';
export const ORANGE = 0xf08a24; // アクセント
export const ORANGE_DARK = 0xd3731a;
export const ORANGE_CSS = '#F08A24';
export const GREY_TEXT = 0x7a8088;
export const GREY_TEXT_CSS = '#7A8088';
export const CARD = 0xffffff;
export const CARD_BAND = 0xe9e3d9;
export const CARD_LINE = 0xe2dbd0;
export const TRACK = 0xe8e1d6;
export const ALERT_RED = 0xe0392b;

// 金属フレーム
export const STEEL_OUTER = 0x8b9198;
export const STEEL_INNER = 0xb3b8bd;
export const RAIL_LIGHT = 0xc9cdd1;
export const RAIL_DARK = 0xa4aaaf;
export const RIVET = 0x6e747b;

// ネジ：色つきワッシャー（リング）＋銀の頭
export const RING: Record<Color, number> = { red: 0xe5533f, blue: 0x3f86d9, yellow: 0xf0b429, green: 0x5cb36a };
export const RING_DARK: Record<Color, number> = { red: 0xb83d2d, blue: 0x2c65aa, yellow: 0xc38c14, green: 0x41894e };
export const HEAD = 0xd3d7dc;
export const HEAD_DARK = 0x8f959c;
export const SLOT = 0x4e545b;

// 板（パステル、意味なし）
export const PLATE: Record<PlateColor, number> = { cream: 0xf2e9d8, mint: 0xd7e5cf, grey: 0xd8dadd, lavender: 0xded8e8 };
export const PLATE_DARK: Record<PlateColor, number> = { cream: 0xcfc3ab, mint: 0xb1c4a6, grey: 0xb2b5ba, lavender: 0xb9b1c8 };
/** 板の透け具合（覆われたネジはゴースト描画で見せるので、板はほぼ不透明） */
export const PLATE_ALPHA = 0.94;

// ---- レイアウト（基準 1080 × 1920）----
export const HEADER = { logoX: 60, logoY: 46, levelY: 96, retryX: 966, retryY: 96, retryR: 50 };
export const PROGRESS = { x: 60, y: 172, w: 960, h: 16 };
export const HINT_Y = 232;
/** チュートリアルの説明カードの中心 y（フレーム上部の空きスペース） */
export const BUBBLE_Y = 520;

export const TRAY_Y = 308;
export const TRAY_X = [200, 540, 880];
export const TRAY_W = 300;
export const TRAY_H = 104;
export const TRAY_HOLE_DX = [-92, 0, 92];
export const TRAY_HOLE_R = 34;

/** 金属フレーム（外形） */
export const FRAME = { x: 40, y: 374, w: 1000, h: 1070, r: 36, border: 30 };
/** フレームの内側（盤面を収める領域） */
export const INNER = { x: FRAME.x + FRAME.border, y: FRAME.y + FRAME.border, w: FRAME.w - FRAME.border * 2, h: FRAME.h - FRAME.border * 2 };
/** レベルデータの座標系（仕様 5.3 の盤面領域） */
export const LEVEL_REGION = { x: 0, y: 340, w: 1080, h: 1160 };
/** レベル座標 → 画面座標の倍率とオフセット */
export const BOARD_SCALE = INNER.w / LEVEL_REGION.w;
export const BOARD_OFFSET = { x: INNER.x - LEVEL_REGION.x * BOARD_SCALE, y: INNER.y - LEVEL_REGION.y * BOARD_SCALE };

export const BUFFER_LABEL_Y = 1494;
export const BUFFER_Y = 1592;
export const BUFFER_TILE = 132;
export const BUFFER_GAP = 175;
/** i 番目のタイルの中心 x（n 枚を中央寄せ） */
export const bufferX = (i: number, n: number): number => 540 + (i - (n - 1) / 2) * BUFFER_GAP;
/** 仮置き場の行（赤枠・ラベルの基準）。n 枚ぶんの幅 */
export const bufferRow = (n: number): { x: number; y: number; w: number; h: number } => {
  const w = (n - 1) * BUFFER_GAP + BUFFER_TILE + 44;
  return { x: 540 - w / 2, y: 1516, w, h: 152 };
};
/** ラベル「一時置き」「あと N 枠」の左右端 */
export const BUFFER_LABEL_X = { left: 110, right: 970 };

export const PRODUCT = { x: 60, y: 1692, w: 960, h: 160 };
export const FOOTER_Y = 1888;

// ネジの寸法（レベル座標）
export const SCREW_R = 42; // ワッシャー半径
export const SCREW_HEAD_R = 30; // 頭の半径
/** タップ判定半径（画面座標） */
export const TAP_R = 60;
/** トレイ・仮置き場に入ったネジの表示倍率 */
export const SCREW_UI_SCALE = 0.8;

// 描画順
export const DEPTH = {
  bg: 0,
  ui: 10,
  trayScrew: 30,
  board: 50,
  flying: 500,
  overlay: 900,
  overlayUi: 950,
};
