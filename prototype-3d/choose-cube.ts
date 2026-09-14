// 5枠を前提に、外側の6面だけで先読みが成立する配色を探す。
import { makeCubeLevel } from './cube-model';
import { solve, minBuffer, stuckRate, greedyPolicy, mulberry32 } from '../src/game/Solver';
import { validateLevel, type Color } from '../src/game/Level';
const rng=mulberry32(62091);
function shuffle<T>(a:T[]):T[]{for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
let best;
for(let i=0;i<1500;i++){
  const trays=shuffle<Color>(['blue','blue','yellow','green','green','red']);
  const level=makeCubeLevel(shuffle(trays.flatMap(c=>[c,c,c])),trays);
  const proof=solve(level,{maxVisited:40000});if(!proof.solvable)continue;
  const rate=stuckRate(level,greedyPolicy,100,36);if(rate<.18||rate>.48)continue;
  const min=minBuffer(level,{maxVisited:80000});if(min.min===null||min.min<2||min.min>4)continue;
  best={level,solution:proof.moves,rate:stuckRate(level,greedyPolicy,300,36),min:min.min,warnings:validateLevel(level)};break;
}
if(!best)throw new Error('条件を満たすキューブが見つかりませんでした');
process.stdout.write(JSON.stringify(best,null,2));
