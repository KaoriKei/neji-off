// 配色・レイアウト定数（仕様 5.2 / 5.3）
import type { Color, PlateColor } from './Level';

export const FONT = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Rounded Mplus 1c", sans-serif';

export const BG = 0xf5efe3;
export const INK = 0x3a3a3a;

// ネジ（板より一段濃い）
export const SCREW: Record<Color, number> = { red: 0xd94e3d, blue: 0x3e7fd1, yellow: 0xe0ad2a, green: 0x5fa864 };
export const SCREW_DARK: Record<Color, number> = { red: 0xb03a2b, blue: 0x2f65a8, yellow: 0xb98a1c, green: 0x47864d };

// 板（ニュートラル4色、意味なし）
export const PLATE: Record<PlateColor, number> = { beige: 0xe9dcc3, sand: 0xdcc9a6, greige: 0xcfc8bc, milktea: 0xd7b896 };
export const PLATE_DARK: Record<PlateColor, number> = { beige: 0xc7b795, sand: 0xbca57a, greige: 0xaba397, milktea: 0xb5946b };
/** 板の透け具合。覆われたネジが板越しにうっすら見えるように（順番を考えられるようにするため） */
export const PLATE_ALPHA = 0.8;

export const TRAY_FILL = 0xffffff;
export const TRAY_BAND = 0xe6dfd3;
export const HOLE = 0xd8d0c4;
export const HOLE_DARK = 0xbfb6a8;
export const BUFFER_FILL = 0xf0eae0;
export const ALERT_RED = 0xe0392b;
export const BUTTON_BLUE = 0x3e7fd1;
export const BUTTON_BLUE_DARK = 0x2f65a8;

// レイアウト（基準 1080 × 1920）
export const SCREW_R = 32;
export const TAP_R = 60;
export const LEVEL_LABEL_Y = 80;

export const TRAY_Y = 240;
export const TRAY_X = [200, 540, 880];
export const TRAY_W = 300;
export const TRAY_H = 120;
export const TRAY_HOLE_DX = [-90, 0, 90];
export const TRAY_HOLE_R = 38;

export const BUFFER_Y = 1600;
export const BUFFER_X = [240, 390, 540, 690, 840];
export const BUFFER_HOLE_R = 40;
export const BUFFER_FRAME = { x: 150, y: 1540, w: 780, h: 120 };

export const RETRY = { x: 540, y: 1790, r: 64 };

// 描画順
export const DEPTH = {
  bg: 0,
  ui: 10,
  trayScrew: 30,
  plateBase: 100,
  plateStep: 10,
  screwOffset: 5,
  flying: 500,
  overlay: 900,
  overlayUi: 950,
};
