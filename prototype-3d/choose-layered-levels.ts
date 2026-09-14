// 元のレベル生成と同様に、最小仮置き数と素直な打ち方の詰み率で段階を作る。
import { readFileSync, writeFileSync } from 'node:fs';
import { makeLayeredCube, type CoverDef } from './layered-cube';
import { solve, minBuffer, stuckRate, greedyPolicy, mulberry32 } from '../src/game/Solver';
import { validateLevel, type Color } from '../src/game/Level';

const faceOrder=['T','F','R','B','L','D'];
export const STEPS = [
  {id:4,name:'追加プレート',faces:1,stack:0,min:[1,2],rate:[.02,.16]},
  {id:5,name:'二面の重なり',faces:2,stack:0,min:[1,2],rate:[.16,.30]},
  {id:6,name:'三面の重なり',faces:3,stack:0,min:[2,3],rate:[.30,.43]},
  {id:7,name:'四面の重なり',faces:4,stack:0,min:[2,3],rate:[.43,.55]},
  {id:8,name:'二段のプレート',faces:4,stack:1,min:[2,3],rate:[.55,.65]},
  {id:9,name:'重なる二つの面',faces:4,stack:2,min:[2,4],rate:[.65,.75]},
  {id:10,name:'六面の重なり',faces:6,stack:2,min:[2,4],rate:[.75,.83]},
  {id:11,name:'最後の分解',faces:6,stack:3,min:[2,4],rate:[.83,.91]},
];

const output=new URL('./layered-levels.json',import.meta.url),from=Number(process.argv[2]??4);
const entries=from>4?JSON.parse(readFileSync(output,'utf8')).filter((entry:{level:{id:number}})=>entry.level.id<from):[];
for(const step of STEPS.filter(step=>step.id>=from)){
  const rng=mulberry32(91400+step.id);
  const shuffle=<T>(items:T[]):T[]=>{for(let i=items.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[items[i],items[j]]=[items[j],items[i]];}return items;};
  const covers:CoverDef[]=[...faceOrder.slice(0,step.faces).map(face=>({face,layer:1})),...faceOrder.slice(0,step.stack).map(face=>({face,layer:2}))];
  const palette:Color[]=['blue','red','green','yellow'];
  let entry;
  for(let attempt=0;attempt<6000;attempt++){
    const trays=shuffle(Array.from({length:6+covers.length},(_,i)=>palette[i%palette.length]));
    const level=makeLayeredCube(step.id,covers,shuffle(trays.flatMap(c=>[c,c,c])),trays);
    const rate=stuckRate(level,greedyPolicy,100,36);
    if(rate<step.rate[0]||rate>step.rate[1])continue;
    const proof=solve(level,{maxVisited:80000});if(!proof.solvable)continue;
    const mb=minBuffer(level,{maxVisited:80000});
    if(mb.min===null||mb.min<step.min[0]||mb.min>step.min[1]||mb.byBuffer.some(b=>b.aborted))continue;
    const measured=stuckRate(level,greedyPolicy,400,36);
    if(measured<step.rate[0]||measured>step.rate[1])continue;
    const warnings=validateLevel(level);if(warnings.length)throw new Error(warnings.join('\n'));
    entry={name:step.name,level,solution:proof.moves,min:mb.min,rate:measured,attempt};break;
  }
  if(!entry)throw new Error(`Lv${step.id}の条件を満たす配置が見つかりませんでした`);
  entries.push(entry);writeFileSync(output,JSON.stringify(entries,null,2)+'\n');
  console.log(`Lv${step.id}: ${entry.level.plates.length}枚 / ${entry.solution.length}本 / 最小${entry.min}枠 / 詰み率${Math.round(entry.rate*100)}% / 試行${entry.attempt}`);
}
