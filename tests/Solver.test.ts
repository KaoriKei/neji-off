import { describe, expect, it } from 'vitest';
import type { LevelDef } from '../src/game/Level';
import { minBuffer, solve } from '../src/game/Solver';

const SAMPLE: LevelDef = {
  id: 1,
  plates: [
    {
      id: 'A', x: 240, y: 700, w: 600, h: 300, z: 0, color: 'cream',
      screws: [
        { x: 280, y: 740, color: 'red' },
        { x: 800, y: 740, color: 'red' },
        { x: 800, y: 960, color: 'blue' },
      ],
    },
    {
      id: 'B', x: 440, y: 600, w: 400, h: 300, z: 1, color: 'mint',
      screws: [
        { x: 480, y: 640, color: 'red' },
        { x: 800, y: 640, color: 'blue' },
        { x: 640, y: 860, color: 'blue' },
      ],
    },
  ],
  trays: ['red', 'blue'],
  bufferSize: 5,
};

describe('Solver', () => {
  it('サンプルは仮置き場なしで解ける', () => {
    const r = solve(SAMPLE, { bufferSize: 0 });
    expect(r.solvable).toBe(true);
    expect(r.moves.length).toBe(6);
    expect(minBuffer(SAMPLE).min).toBe(0);
  });

  it('上の板の黄3本を先に仮置きしないと解けない面は最小仮置き数 3', () => {
    // B（上）が A・C・D を全部覆う。B のネジは黄3本だが黄トレイは最後に来る
    const lv: LevelDef = {
      id: 2,
      plates: [
        {
          id: 'A', x: 150, y: 450, w: 780, h: 250, z: 0, color: 'cream',
          screws: [
            { x: 300, y: 575, color: 'red' },
            { x: 540, y: 575, color: 'red' },
            { x: 780, y: 575, color: 'red' },
          ],
        },
        {
          id: 'C', x: 150, y: 750, w: 780, h: 250, z: 1, color: 'mint',
          screws: [
            { x: 300, y: 875, color: 'blue' },
            { x: 540, y: 875, color: 'blue' },
            { x: 780, y: 875, color: 'blue' },
          ],
        },
        {
          id: 'D', x: 150, y: 1050, w: 780, h: 250, z: 2, color: 'grey',
          screws: [
            { x: 300, y: 1175, color: 'blue' },
            { x: 540, y: 1175, color: 'blue' },
            { x: 780, y: 1175, color: 'blue' },
          ],
        },
        {
          id: 'B', x: 100, y: 380, w: 880, h: 1100, z: 3, color: 'lavender',
          screws: [
            { x: 200, y: 450, color: 'yellow' },
            { x: 540, y: 450, color: 'yellow' },
            { x: 880, y: 450, color: 'yellow' },
          ],
        },
      ],
      trays: ['blue', 'blue', 'red', 'yellow'],
      bufferSize: 5,
    };
    const r = minBuffer(lv);
    expect(r.min).toBe(3);
    expect(solve(lv, { bufferSize: 2 }).solvable).toBe(false);
  });

  it('解けない面は solvable=false', () => {
    const lv: LevelDef = {
      id: 3,
      plates: [
        {
          id: 'A', x: 100, y: 400, w: 880, h: 300, z: 0, color: 'cream',
          screws: [
            { x: 200, y: 500, color: 'red' },
            { x: 500, y: 500, color: 'red' },
            { x: 800, y: 500, color: 'red' },
          ],
        },
      ],
      trays: ['blue'],
      bufferSize: 0,
    };
    expect(solve(lv).solvable).toBe(false);
  });
});
