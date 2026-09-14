import {describe,it,expect} from 'vitest';
import {Campaign,STAGES} from '../prototype-3d/campaign';
import {solve,minBuffer} from '../src/game/Solver';
import {validateLevel} from '../src/game/Level';

describe('平面からキューブへの進行',()=>{
  it('初回は6本の平面チュートリアルで、未クリアでは次へ進めない',()=>{
    const game=new Campaign();expect(game.index).toBe(0);expect(game.stage.kind).toBe('flat');
    expect(game.board.remainingScrews()).toBe(6);expect(game.advance()).toBe(false);
    expect(game.lesson()?.target).toBe('A-0');expect(minBuffer(game.level).min).toBe(0);
  });
  it('全4面を順番にクリアでき、Lv3からキューブになる',()=>{
    const game=new Campaign();
    for(let i=0;i<4;i++){
      expect(game.index).toBe(i);expect(game.stage.kind).toBe(i<2?'flat':'cube');
      expect(validateLevel(game.level)).toEqual([]);expect(game.board.bufferSize).toBe(5);
      const proof=solve(game.level);expect(proof.solvable).toBe(true);
      for(const id of proof.moves)expect(game.pull(id).ok).toBe(true);
      expect(game.board.isCleared()).toBe(true);expect(game.advance()).toBe(i<3);
    }
  });
  it('Lv2で一時置きと自動回収を実際に体験できる',()=>{
    const game=new Campaign();for(const id of solve(game.level).moves)game.pull(id);game.advance();
    expect(game.lesson()?.target).toBe('D-0');game.pull('D-0');
    expect(game.board.bufferUsed()).toBe(1);expect(game.lesson()?.title).toBe('トレイがない色は一時置きへ');
    expect(minBuffer(game.level).min).toBe(1);
    game.reset();for(const id of solve(game.level).moves)game.pull(id);
    expect(game.learned.has('bufferSucked')).toBe(true);
  });
  it('Lv3は内締めを2か所に絞り、Lv4は6か所で色も混在する',()=>{
    const inside=(n:number)=>STAGES[n].level.plates.flatMap(p=>p.screws).filter(s=>s.headSide==='inside').length;
    expect(inside(2)).toBe(2);expect(inside(3)).toBe(6);
    expect(minBuffer(STAGES[2].level).min).toBe(0);expect(minBuffer(STAGES[3].level).min).toBe(1);
  });
  it('一手戻す・同じレベルの再挑戦・最初からの再開を区別する',()=>{
    const game=new Campaign();for(const id of solve(game.level).moves)game.pull(id);game.advance();
    const initial=game.board.stateKey();game.pull('D-0');game.undo();expect(game.board.stateKey()).toBe(initial);
    game.pull('D-0');game.reset();expect(game.index).toBe(1);expect(game.history).toHaveLength(0);expect(game.learned.size).toBe(0);
    game.startOver();expect(game.index).toBe(0);expect(game.board.remainingScrews()).toBe(6);expect(game.lesson()?.title).toBe('青いビスをタップ');
  });
});
