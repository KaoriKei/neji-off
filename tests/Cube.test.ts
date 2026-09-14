import { describe,it,expect } from 'vitest';
import { CubePuzzle,LEVEL,FACES,FLAPS } from '../prototype-3d/cube-puzzle';
import { solve,minBuffer } from '../src/game/Solver';
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
  it('閉じたキューブでは内締めを抜けず、どれかの面が開くと内側へ届く',()=>{
    const p=new CubePuzzle();
    for(const flap of FLAPS)expect(p.board.isCovered(`${flap.to}-${flap.screw}`)).toBe(true);
    expect(p.pull('F-0')).toMatchObject({ok:false,reason:'covered'});
    for(const id of ['T-0','T-1','T-2'])expect(p.pull(id).ok).toBe(true);
    for(const flap of FLAPS)expect(p.board.isCovered(`${flap.to}-${flap.screw}`)).toBe(false);
  });
  it('写真の紫と青は、正面・背面が残っていても右の開口部から抜ける',()=>{
    const p=new CubePuzzle();for(const id of ['R-0','R-1','R-2'])expect(p.pull(id).ok).toBe(true);
    expect(p.board.getPlate('F')!.dropped).toBe(false);expect(p.board.getPlate('B')!.dropped).toBe(false);
    expect(p.pull('L-1').ok).toBe(true);expect(p.pull('L-0').ok).toBe(true);
    expect(p.board.remainingScrews()).toBe(13);
  });
  it('一手戻して唯一の開口部を閉じると、内締めに届かなくなる',()=>{
    const p=new CubePuzzle();for(const id of ['T-0','T-1'])p.pull(id);
    const before=p.board.stateKey();p.pull('T-2');expect(p.board.getPlate('T')!.dropped).toBe(true);
    p.undo();expect(p.board.stateKey()).toBe(before);expect(p.board.isCovered('F-0')).toBe(true);
    expect(p.board.getPlate('T')!.dropped).toBe(false);
  });
  it('別の開口部が残っていれば、一面を戻しても内締めに届く',()=>{
    const p=new CubePuzzle();for(const id of ['R-0','R-1','R-2','T-0','T-1','T-2'])p.pull(id);
    p.undo();expect(p.board.getPlate('T')!.dropped).toBe(false);expect(p.board.getPlate('R')!.dropped).toBe(true);
    expect(p.board.canPull('L-1').ok).toBe(true);
  });
  it('コピー後も面をまたぐ覆いを保持し、元の盤面に影響しない',()=>{
    const p=new CubePuzzle(),copy=p.board.clone();
    for(const id of ['T-0','T-1','T-2'])copy.pull(id);
    expect(copy.isCovered('F-0')).toBe(false);expect(p.board.isCovered('F-0')).toBe(true);
  });
  it('最初の開口部を作るには一時置きを使い、5枠で解ける',()=>{
    expect(minBuffer(LEVEL).min).toBe(1);expect(solve(LEVEL,{bufferSize:0}).solvable).toBe(false);
  });
  it('明示した覆いは平面座標の重なりに影響されない',()=>{
    const level=structuredClone(LEVEL);
    const f=level.plates[0],r=level.plates[1];r.x=f.x;r.y=f.y;r.w=f.w;r.h=f.h;
    const b=new Board(level);expect(b.isCovered('F-1')).toBe(false);expect(b.coveringPlates('F-0')).toEqual(['R','T','D','L','B']);
    f.screws[0].blockedBy=['unknown'];expect(validateLevel(level).some(s=>s.includes('覆いの板ID unknown が不正'))).toBe(true);
  });
  it('開口部の定義に存在しない面や自分の面を指定できない',()=>{
    const level=structuredClone(LEVEL);level.plates[0].screws[0].accessThrough=['F','unknown'];
    expect(validateLevel(level).filter(s=>s.includes('開口部の板ID'))).toHaveLength(2);
  });
  it('すべての手を逆に戻して、5枠の初期盤面に戻れる',()=>{
    const p=new CubePuzzle(),initial=p.board.stateKey();for(const id of solve(LEVEL).moves)p.pull(id);
    while(p.undo()){}expect(p.board.stateKey()).toBe(initial);
    p.pull('F-2');p.reset();expect(p.board.stateKey()).toBe(initial);expect(p.history).toHaveLength(0);
  });
});
