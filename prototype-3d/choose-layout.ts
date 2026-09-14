// 同じ造形で配色とトレイ順を探索し、先読みが必要な一面を選ぶ。
import { solve, minBuffer, stuckRate, greedyPolicy, mulberry32 } from '../src/game/Solver';
import { validateLevel, type LevelDef, type Color } from '../src/game/Level';

const specs = [
  ['A', 120, 1110, 830, 240, 0, [[265, 1230], [540, 1230], [835, 1170]]],
  ['B', 150, 500, 230, 830, 1, [[265, 610], [265, 970], [265, 1200]]],
  ['C', 720, 430, 230, 780, 2, [[835, 545], [835, 970], [835, 1130]]],
  ['D', 380, 730, 350, 430, 3, [[465, 970], [650, 970], [565, 1095]]],
  ['E', 130, 470, 820, 220, 4, [[235, 580], [535, 580], [845, 580]]],
  ['F', 170, 885, 740, 170, 5, [[285, 970], [540, 970], [805, 970]]],
] as const;
const base: LevelDef = { id: 1, bufferSize: 4, plates: specs.map(([id,x,y,w,h,z,ps]) => ({ id,x,y,w,h,z,color:z % 2 ? 'grey' : 'cream',screws:ps.map(([x,y]) => ({x,y,color:'blue'})) })), trays: [] };
const rng = mulberry32(97041);
function shuffle<T>(a:T[]):T[] { for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a; }
for(let attempt=0;attempt<400;attempt++){
  const level=structuredClone(base);
  level.trays=shuffle<Color>(['blue','blue','red','yellow','yellow','green']);
  const colors=shuffle(level.trays.flatMap(c=>[c,c,c]));
  level.plates.flatMap(p=>p.screws).forEach((s,i)=>s.color=colors[i]);
  const sol=solve(level,{maxVisited:20000});
  if(!sol.solvable)continue;
  const rate=stuckRate(level,greedyPolicy,100,28);
  if(rate<0.3||rate>0.65)continue;
  const min=minBuffer(level,{maxVisited:30000});
  if(min.min!==2)continue;
  process.stdout.write(JSON.stringify({level,solution:sol.moves,rate,min:min.min,warnings:validateLevel(level)},null,2));
  break;
}
