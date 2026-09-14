import type { Color, LevelDef } from '../src/game/Level';

export const FACES = [
  { id:'F', number:1, name:'正面', rotation:[0,0,0], normal:[0,0,1], screws:[[-1.05,1.23],[1.05,.45],[-.6,-1.12]] },
  { id:'R', number:2, name:'右面', rotation:[0,Math.PI/2,0], normal:[1,0,0], screws:[[-1.02,.8],[1.02,.8],[0,-1.05]] },
  { id:'T', number:3, name:'上面', rotation:[-Math.PI/2,0,0], normal:[0,1,0], screws:[[-1.02,.75],[1.02,.75],[0,-1.05]] },
  { id:'D', number:4, name:'底面', rotation:[Math.PI/2,0,0], normal:[0,-1,0], screws:[[1.23,-.8],[-1.23,.6],[0,-.85]] },
  { id:'L', number:5, name:'左面', rotation:[0,-Math.PI/2,0], normal:[-1,0,0], screws:[[1.23,.8],[-1.23,-.6],[-.15,.12]] },
  { id:'B', number:6, name:'背面', rotation:[0,Math.PI,0], normal:[0,0,-1], screws:[[.9,1.23],[-1.08,.4],[.6,-1.12]] },
];

// 折り返した留め具が、隣の面にあるネジを覆う。内側の追加レイヤーはない。
export const FLAPS = [
  { from:'T', to:'F', screw:0, edge:'top' },
  { from:'T', to:'B', screw:0, edge:'top' },
  { from:'F', to:'L', screw:0, edge:'right' },
  { from:'B', to:'L', screw:1, edge:'left' },
  { from:'R', to:'D', screw:0, edge:'right' },
  { from:'L', to:'D', screw:1, edge:'left' },
] as const;

export function makeCubeLevel(colors: Color[], trays: Color[]): LevelDef {
  return {
    id:1,bufferSize:5,trays,
    plates:FACES.map((f,i)=>{
      // ルール検証用の展開図。3Dの位置は面ごとの向きと局所座標から作る。
      const x=60+(i%3)*335,y=390+Math.floor(i/3)*510;
      return { id:f.id,x,y,w:260,h:420,z:i,color:i%2?'grey':'cream',
        screws:f.screws.map(([u,v],j)=>({x:x+130+u*60,y:y+210-v*60,color:colors[i*3+j],blockedBy:FLAPS.filter(t=>t.to===f.id&&t.screw===j).map(t=>t.from)})) };
    }),
  };
}
