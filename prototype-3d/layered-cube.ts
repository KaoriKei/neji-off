import type { Color, LevelDef } from '../src/game/Level';
import { FACES, makeCubeLevel } from './cube-model';

export interface CoverDef { face: string; layer: number }
export interface LayeredCubeLevel extends LevelDef { covers?: CoverDef[] }
export interface CubePanel {
  id: string;
  faceId: string;
  number: number;
  rotation: number[];
  normal: number[];
  center: number[];
  size: number[];
  surface: number;
  layer: number;
  screws: number[][];
  parentId?: string;
}

const SHAPES: Record<string, {center:number[];size:number[]}> = {
  F:{center:[0,.90],size:[3.42,1.82]},
  R:{center:[0,.80],size:[3.42,1.82]},
  T:{center:[0,.75],size:[3.42,1.82]},
  D:{center:[0,-.80],size:[3.42,1.82]},
  L:{center:[-.45,-.26],size:[2.92,1.92]},
  B:{center:[0,.90],size:[3.42,1.82]},
};

export const coverId = (face:string,layer:number) => `${face}C${layer}`;

/** 表示と覆い判定で、同じ面内座標と板の寸法を使う。 */
export function cubePanels(level:LayeredCubeLevel):CubePanel[] {
  const panels:CubePanel[]=FACES.map(f=>({id:f.id,faceId:f.id,number:f.number,rotation:f.rotation,normal:f.normal,
    center:[0,0],size:[3.82,3.82],surface:1.95,layer:0,screws:f.screws.map(p=>[...p])}));
  for(const cover of [...level.covers??[]].sort((a,b)=>a.layer-b.layer)){
    const face=FACES.find(f=>f.id===cover.face);
    if(!face)throw new Error(`追加板の面が不正です: ${cover.face}`);
    const shape=SHAPES[face.id],offset=cover.layer-1;
    const center=[shape.center[0]+offset*.08,shape.center[1]-offset*.06];
    const spread=face.id==='L'?1.05:1.20;
    // 二段目の支柱は、一段目のビス頭とぶつからない位置に置く。
    let holes=cover.layer%2?[[-spread,-.52],[spread,-.52],[0,.50]]:[[-spread,.42],[spread,.42],[0,-.52]];
    if(face.id==='F')holes=cover.layer%2?[[-spread,-.52],[spread,.50],[0,-.25]]:[[-spread,.42],[spread,-.52],[0,.50]];
    if(face.id==='B'||face.id==='L')holes=cover.layer%2?[[-spread,.50],[spread,-.52],[0,-.29]]:[[-spread,-.52],[spread,.42],[0,.50]];
    if(face.id==='D'&&cover.layer%2)holes[2]=[0,.55];
    panels.push({id:coverId(face.id,cover.layer),faceId:face.id,number:face.number,rotation:face.rotation,normal:face.normal,
      center,size:[shape.size[0],shape.size[1]+offset*.20],surface:1.95+cover.layer*.62,layer:cover.layer,
      screws:holes.map(([u,v])=>[center[0]+u,center[1]+v]),
      parentId:cover.layer===1?face.id:coverId(face.id,cover.layer-1)});
  }
  return panels;
}

export function coversPoint(panel:CubePanel,point:number[],margin=0):boolean {
  return Math.abs(point[0]-panel.center[0])<=panel.size[0]/2-margin
    &&Math.abs(point[1]-panel.center[1])<=panel.size[1]/2-margin;
}

/** 頭の上に実在する追加板だけを覆いにする。内締めの頭には外側の板を適用しない。 */
export function makeLayeredCube(id:number,covers:CoverDef[],colors:Color[],trays:Color[]):LayeredCubeLevel {
  const level:LayeredCubeLevel={...makeCubeLevel(colors.slice(0,18),trays),id,covers:structuredClone(covers)};
  const panels=cubePanels(level);
  for(const panel of panels.filter(p=>p.layer>0)){
    const base=level.plates.find(p=>p.id===panel.faceId)!;
    level.plates.push({id:panel.id,x:base.x,y:base.y,w:base.w,h:base.h,z:level.plates.length,color:panel.layer%2?'grey':'cream',
      screws:panel.screws.map(([u,v],i)=>({x:base.x+130+u*60,y:base.y+210-v*60,
        color:colors[(level.plates.length)*3+i],headSide:'outside',blockedBy:[]}))});
  }
  for(const panel of panels){
    level.plates.find(p=>p.id===panel.id)!.screws.forEach((s,i)=>{
      s.blockedBy=s.headSide==='inside'?[]:panels.filter(p=>p.faceId===panel.faceId&&p.layer>panel.layer&&coversPoint(p,panel.screws[i])).map(p=>p.id);
    });
  }
  return level;
}
