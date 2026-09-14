// 平面で基本を覚えてから、六面キューブへ進む。
import type { LevelDef } from '../src/game/Level';
import { Puzzle } from './puzzle';
import flatOverlap from '../src/data/levels/02.json';
import cubeStudy from './cube-study.json';
import layeredLevels from './layered-levels.json';

const basics: LevelDef = {
  id:1,bufferSize:5,trays:['blue','red'],
  plates:[
    {id:'A',x:210,y:650,w:660,h:150,z:0,color:'cream',screws:[280,540,800].map(x=>({x,y:725,color:'blue'}))},
    {id:'B',x:210,y:980,w:660,h:150,z:1,color:'grey',screws:[280,540,800].map(x=>({x,y:1055,color:'red'}))},
  ],
};
const easyCube=structuredClone(cubeStudy.level) as LevelDef;
easyCube.id=3;
easyCube.trays=['blue','red','green','blue','red','green'];
for(const [i,plate] of easyCube.plates.entries()){
  for(const [j,screw] of plate.screws.entries()){
    screw.color=easyCube.trays[i];
    // 初めてのキューブでは内締めを2か所に絞る。
    const inside=(plate.id==='F'||plate.id==='D')&&j===0;
    screw.headSide=inside?'inside':'outside';
    if(!inside)delete screw.accessThrough;
  }
}

export const STAGES: {kind:'flat'|'cube';name:string;level:LevelDef}[] = [
  {kind:'flat',name:'基本操作',level:basics},
  {kind:'flat',name:'重なりと一時置き',level:{...structuredClone(flatOverlap) as LevelDef,id:2,bufferSize:5}},
  {kind:'cube',name:'キューブを回す',level:easyCube},
  ...layeredLevels.map(entry=>({kind:'cube' as const,name:entry.name,level:entry.level as LevelDef})),
];

export class Campaign {
  index:number;
  puzzle:Puzzle;
  learned=new Set<string>();
  constructor(initialLevel=1){
    this.index=Number.isInteger(initialLevel)&&initialLevel>=1&&initialLevel<=STAGES.length?initialLevel-1:0;
    this.puzzle=new Puzzle(this.level);
  }
  get stage(){return STAGES[this.index];}
  get level(){return this.stage.level;}
  get board(){return this.puzzle.board;}
  get history(){return this.puzzle.history;}
  get isLast(){return this.index===STAGES.length-1;}
  pull(id:string){
    const result=this.puzzle.pull(id);
    if(result.ok)for(const event of result.events)this.learned.add(event.type);
    return result;
  }
  undo(){return this.puzzle.undo();}
  reset(){this.puzzle.reset();this.learned.clear();}
  advance(){
    if(!this.board.isCleared()||this.isLast)return false;
    this.index++;this.puzzle=new Puzzle(this.level);this.learned.clear();return true;
  }
  startOver(){this.index=0;this.puzzle=new Puzzle(this.level);this.learned.clear();}
  lesson(): {title:string;text:string;target?:string}|null {
    if(this.board.isCleared()||this.index>=3)return null;
    const moves=this.board.pullableScrews();
    if(this.index===0){
      const blue=moves.find(id=>this.board.getScrew(id)!.color==='blue');
      if(!this.history.length)return{title:'青いビスをタップ',text:'同じ色のトレイに入ります。',target:blue};
      if(!this.learned.has('plateDropped'))return{title:'同じ色を3本そろえよう',text:'ビスを全部抜くと、パーツが外れます。',target:blue??moves[0]};
      return{title:`${blue?'青':'赤'}いビスも外そう`,text:'残りのパーツを外せばクリア。',target:blue??moves[0]};
    }
    if(this.index===1){
      if(!this.learned.has('screwToBuffer'))return{title:'まず緑のビスを外そう',text:'重なったパーツは、上から順に。',target:moves.includes('D-0')?'D-0':moves.find(id=>this.board.getScrew(id)!.color==='green')};
      if(!this.learned.has('bufferSucked'))return{title:'トレイがない色は一時置きへ',text:'赤を3本そろえて、次のトレイを出そう。',target:moves.find(id=>this.board.getScrew(id)!.color==='red')};
      return{title:'トレイが来ると自動で移動',text:'残りのビスも、上から順に外そう。'};
    }
    if(!this.learned.has('rotated'))return{title:'キューブを回す',text:'ドラッグして、裏や底のビスも探そう。'};
    return null;
  }
}
