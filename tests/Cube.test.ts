import { describe,it,expect } from 'vitest';
import { CubePuzzle,LEVEL,FACES,FLAPS } from '../prototype-3d/cube-puzzle';
import { solve,minBuffer,stuckRate,greedyPolicy } from '../src/game/Solver';
import { Board } from '../src/game/Board';
import { validateLevel } from '../src/game/Level';

describe('六面キューブ',()=>{
  it('6面・18本を共有の5枠で最後まで分解できる',()=>{
    expect(FACES).toHaveLength(6);expect(validateLevel(LEVEL)).toEqual([]);
    const p=new CubePuzzle();expect(p.board.bufferSize).toBe(5);
    const proof=solve(LEVEL);expect(proof.solvable).toBe(true);
    for(const id of proof.moves)expect(p.pull(id).ok).toBe(true);
    expect(p.board.isCleared()).toBe(true);expect(p.board.bufferUsed()).toBe(0);expect(p.board.remainingScrews()).toBe(0);
  });
  it('隣の面の留め具が外れるまでは、覆われたネジを抜けない',()=>{
    const p=new CubePuzzle();
    for(const flap of FLAPS)expect(p.board.coveringPlates(`${flap.to}-${flap.screw}`)).toContain(flap.from);
    expect(p.pull('F-0')).toMatchObject({ok:false,reason:'covered'});
    for(const id of ['T-0','T-1','T-2'])expect(p.pull(id).ok).toBe(true);
    expect(p.board.isCovered('F-0')).toBe(false);expect(p.board.isCovered('B-0')).toBe(false);
    expect(p.board.isCovered('L-0')).toBe(true);expect(p.board.isCovered('D-0')).toBe(true);
  });
  it('一手戻すと外れたパネルと隣の面の覆いが復元する',()=>{
    const p=new CubePuzzle();for(const id of ['T-0','T-1'])p.pull(id);
    const before=p.board.stateKey();p.pull('T-2');expect(p.board.getPlate('T')!.dropped).toBe(true);
    p.undo();expect(p.board.stateKey()).toBe(before);expect(p.board.isCovered('F-0')).toBe(true);
    expect(p.board.getPlate('T')!.dropped).toBe(false);
  });
  it('コピー後も面をまたぐ覆いを保持し、元の盤面に影響しない',()=>{
    const p=new CubePuzzle(),copy=p.board.clone();
    for(const id of ['T-0','T-1','T-2'])copy.pull(id);
    expect(copy.isCovered('F-0')).toBe(false);expect(p.board.isCovered('F-0')).toBe(true);
  });
  it('枠を減らさなくても順番を考える必要がある',()=>{
    expect(minBuffer(LEVEL).min).toBe(2);
    const rate=stuckRate(LEVEL,greedyPolicy,300,36);expect(rate).toBeGreaterThan(.15);expect(rate).toBeLessThan(.5);
  });
  it('明示した覆いは平面座標の重なりに影響されない',()=>{
    const level=structuredClone(LEVEL);
    const f=level.plates[0],r=level.plates[1];r.x=f.x;r.y=f.y;r.w=f.w;r.h=f.h;
    const b=new Board(level);expect(b.isCovered('F-1')).toBe(false);expect(b.coveringPlates('F-0')).toEqual(['T']);
    f.screws[0].blockedBy=['unknown'];expect(validateLevel(level).some(s=>s.includes('覆いの板ID unknown が不正'))).toBe(true);
  });
  it('すべての手を逆に戻して、5枠の初期盤面に戻れる',()=>{
    const p=new CubePuzzle(),initial=p.board.stateKey();for(const id of solve(LEVEL).moves)p.pull(id);
    while(p.undo()){}expect(p.board.stateKey()).toBe(initial);
    p.pull('F-2');p.reset();expect(p.board.stateKey()).toBe(initial);expect(p.history).toHaveLength(0);
  });
});
