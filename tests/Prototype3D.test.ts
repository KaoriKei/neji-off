import { describe, it, expect } from 'vitest';
import { Puzzle, LEVEL } from '../prototype-3d/puzzle';
import { validateLevel } from '../src/game/Level';
import { solve, minBuffer, stuckRate, greedyPolicy } from '../src/game/Solver';

describe('金属の3D試作', () => {
  it('造形が形式条件を満たし、仮置きを使って最後まで解ける', () => {
    expect(validateLevel(LEVEL)).toEqual([]);
    expect(minBuffer(LEVEL).min).toBe(2);
    const solution=solve(LEVEL);
    expect(solution.solvable).toBe(true);
    const p=new Puzzle();
    for(const id of solution.moves)expect(p.pull(id).ok).toBe(true);
    expect(p.board.isCleared()).toBe(true);
    expect(p.board.remainingScrews()).toBe(0);
  });
  it('素直な順番では詰む場合があり、順番の工夫に意味がある', () => {
    const rate=stuckRate(LEVEL,greedyPolicy,300,28);
    expect(rate).toBeGreaterThan(.25);
    expect(rate).toBeLessThan(.7);
  });
  it('覆われたネジの操作は履歴を増やさない', () => {
    const p=new Puzzle(),before=p.board.stateKey();
    expect(p.pull('A-0')).toMatchObject({ok:false,reason:'covered'});
    expect(p.history).toHaveLength(0);
    expect(p.board.stateKey()).toBe(before);
  });
  it('トレイ完了と仮置きの吸い込みを含め、どの手も正確に戻せる', () => {
    const p=new Puzzle(),solution=solve(LEVEL),keys=[p.board.stateKey()];
    for(const id of solution.moves){p.pull(id);keys.push(p.board.stateKey());}
    for(let n=keys.length-2;n>=0;n--){expect(p.undo()).toBe(true);expect(p.board.stateKey()).toBe(keys[n]);}
    expect(p.undo()).toBe(false);
  });
  it('やり直すと盤面・仮置き・履歴が初期状態になる', () => {
    const p=new Puzzle();p.pull('B-2');expect(p.board.bufferUsed()).toBe(1);
    p.reset();expect(p.history).toHaveLength(0);expect(p.board.bufferUsed()).toBe(0);
    expect(p.board.stateKey()).toBe(new Puzzle().board.stateKey());
  });
});
