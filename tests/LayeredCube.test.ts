import { describe,it,expect } from 'vitest';
import entries from '../prototype-3d/layered-levels.json';
import { cubePanels,coversPoint,type LayeredCubeLevel } from '../prototype-3d/layered-cube';
import { Board } from '../src/game/Board';
import { Puzzle } from '../prototype-3d/puzzle';
import { validateLevel } from '../src/game/Level';
import { stuckRate,greedyPolicy } from '../src/game/Solver';

describe('キューブに重なる追加板',()=>{
  it('Lv4〜11は実際の板の位置と覆いが一致し、頭も板の縁に埋まらない',()=>{
    for(const entry of entries){
      const level=entry.level as LayeredCubeLevel,panels=cubePanels(level);
      expect(validateLevel(level)).toEqual([]);expect(panels).toHaveLength(level.plates.length);
      for(const panel of panels){
        const plate=level.plates.find(p=>p.id===panel.id)!;
        expect(panel.screws).toHaveLength(plate.screws.length);
        panel.screws.forEach((point,i)=>{
          expect(coversPoint(panel,point,.34)).toBe(true);
          const expected=plate.screws[i].headSide==='inside'?[]:panels.filter(p=>p.faceId===panel.faceId&&p.layer>panel.layer&&coversPoint(p,point)).map(p=>p.id);
          expect(plate.screws[i].blockedBy).toEqual(expected);
          for(const id of expected)expect(coversPoint(panels.find(p=>p.id===id)!,point,.34)).toBe(true);
        });
      }
    }
  });
  it('追加板の支柱は、下のビス頭・ナットとぶつからない',()=>{
    for(const entry of entries){
      const level=entry.level as LayeredCubeLevel,panels=cubePanels(level);
      for(const panel of panels.filter(p=>p.layer>0)){
        const parent=panels.find(p=>p.id===panel.parentId)!;
        const base=level.plates.find(p=>p.id===parent.id)!;
        for(const point of panel.screws)parent.screws.forEach((under,i)=>{
          const radius=base.screws[i].headSide==='inside'?.19:.34;
          expect(Math.hypot(point[0]-under[0],point[1]-under[1])).toBeGreaterThan(radius+.17);
        });
      }
    }
  });
  it('追加板が残っている間はその固定先を外せず、板だけの取り外しでは内部が開かない',()=>{
    for(const entry of entries){
      const level=entry.level as LayeredCubeLevel,board=new Board(level),panels=cubePanels(level);
      for(const id of entry.solution){
        expect(board.pull(id).ok).toBe(true);
        for(const p of panels.filter(p=>p.parentId&&!board.getPlate(p.id)!.dropped))expect(board.getPlate(p.parentId!)!.dropped).toBe(false);
        if(!panels.some(p=>p.layer===0&&board.getPlate(p.id)!.dropped)){
          for(const p of level.plates)p.screws.forEach((s,i)=>{if(s.headSide==='inside')expect(board.isCovered(`${p.id}-${i}`)).toBe(true);});
        }
      }
      expect(board.isCleared()).toBe(true);expect(board.bufferUsed()).toBe(0);
    }
  });
  it('二段目を外すと一段目を選べ、一手戻すと再び覆われる',()=>{
    const entry=entries.find(e=>e.level.covers.some(p=>p.layer===2))!;
    const puzzle=new Puzzle(entry.level as LayeredCubeLevel);
    let checked=false;
    for(const id of entry.solution){
      const before=puzzle.board.stateKey(),r=puzzle.pull(id);expect(r.ok).toBe(true);
      if(r.ok&&r.events.some(e=>e.type==='plateDropped'&&e.plateId==='TC2')){
        expect(puzzle.board.isCovered('TC1-0')).toBe(false);expect(puzzle.undo()).toBe(true);
        expect(puzzle.board.stateKey()).toBe(before);expect(puzzle.board.isCovered('TC1-0')).toBe(true);checked=true;break;
      }
    }
    expect(checked).toBe(true);
  });
  it('5枠を保ったまま、自動プレイの詰み率を段階的に上げる',()=>{
    let previous=0;
    for(const entry of entries){
      expect(entry.level.bufferSize).toBe(5);expect(entry.min).toBeLessThanOrEqual(4);
      const rate=stuckRate(entry.level as LayeredCubeLevel,greedyPolicy,400,36);
      expect(rate).toBe(entry.rate);expect(rate).toBeGreaterThan(previous);previous=rate;
    }
    expect(previous).toBeGreaterThan(.8);
  },30000);
});
