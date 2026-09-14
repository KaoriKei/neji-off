// 面ごとの難易度の目安（仕様 6.1）。verify と generate が共有する。
// 「素直詰み率」＝トレイに入るなら入れる／無理なら仮置き、という素直な打ち方で何回に1回詰むか。
export interface DifficultyBand {
  id: number;
  /** 仮置き場の穴数 */
  bufferSize: number;
  /** 最小仮置き数の許容範囲 */
  minBuf: [number, number];
  /** 素直に打つ人の詰み率の許容範囲（0〜1） */
  greedy: [number, number];
  /** 生成時の構成（板・ネジ・色） */
  gen?: { plates: number; screws: number; colors: number };
}

export const BANDS: DifficultyBand[] = [
  { id: 1, bufferSize: 5, minBuf: [1, 2], greedy: [0, 0.08] },
  { id: 2, bufferSize: 5, minBuf: [1, 2], greedy: [0, 0.15] },
  { id: 3, bufferSize: 4, minBuf: [1, 2], greedy: [0.15, 0.35], gen: { plates: 4, screws: 15, colors: 4 } },
  { id: 4, bufferSize: 4, minBuf: [1, 3], greedy: [0.25, 0.45], gen: { plates: 5, screws: 15, colors: 4 } },
  { id: 5, bufferSize: 4, minBuf: [2, 3], greedy: [0.35, 0.55], gen: { plates: 5, screws: 18, colors: 4 } },
  { id: 6, bufferSize: 4, minBuf: [2, 3], greedy: [0.4, 0.6], gen: { plates: 5, screws: 18, colors: 4 } },
  { id: 7, bufferSize: 4, minBuf: [2, 3], greedy: [0.5, 0.7], gen: { plates: 6, screws: 18, colors: 4 } },
  { id: 8, bufferSize: 4, minBuf: [2, 4], greedy: [0.55, 0.75], gen: { plates: 6, screws: 21, colors: 4 } },
  { id: 9, bufferSize: 4, minBuf: [3, 4], greedy: [0.6, 0.8], gen: { plates: 7, screws: 21, colors: 4 } },
  { id: 10, bufferSize: 5, minBuf: [3, 5], greedy: [0.7, 0.9], gen: { plates: 7, screws: 24, colors: 4 } },
];

export const bandOf = (id: number): DifficultyBand | undefined => BANDS.find((b) => b.id === id);
