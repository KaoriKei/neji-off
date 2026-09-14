// 平面で基本を覚えてから、六面キューブへ進む。
import type { LevelDef } from '../src/game/Level';
import { Puzzle } from './puzzle';
import flatOverlap from '../src/data/levels/02.json';
import cubeStudy from './cube-study.json';

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
  for(const screw of plate.screws){
    screw.color=easyCube.trays[i];
    // 初めてのキューブでは留め具を2か所に絞る。
    screw.blockedBy=(plate.id==='F'||plate.id==='D')?(screw.blockedBy??[]).filter(id=>id==='T'||id==='R'):[];
  }
}

export const STAGES: {kind:'flat'|'cube';name:string;level:LevelDef}[] = [
  {kind:'flat',name:'基本操作',level:basics},
  {kind:'flat',name:'重なりと一時置き',level:{...structuredClone(flatOverlap) as LevelDef,id:2,bufferSize:5}},
  {kind:'cube',name:'キューブを回す',level:easyCube},
  {kind:'cube',name:'六面を分解する',level:{...structuredClone(cubeStudy.level) as LevelDef,id:4}},
];

export class Campaign {
  index=0;
  puzzle=new Puzzle(STAGES[0].level);
  learned=new Set<string>();
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
    if(this.board.isCleared()||this.index===3)return null;
    const remaining=this.board.remainingScrews(),moves=this.board.pullableScrews();
    if(this.index===0){
      const blue=moves.find(id=>this.board.getScrew(id)!.color==='blue');
      if(!this.history.length)return{title:'ビスを外す',text:'青いビスをタップ。同じ色のトレイに入ります。',target:blue};
      if(!this.learned.has('plateDropped'))return{title:'同じ色を3本',text:'3本そろうとトレイが完了。固定したビスを全部抜くと、パーツが外れます。',target:blue??moves[0]};
      return{title:'残りのパーツも取り外す',text:'赤いビスも同じように。すべて外すと次のレベルへ進めます。',target:moves[0]};
    }
    if(this.index===1){
      if(!this.learned.has('screwToBuffer'))return{title:'重なったパーツを外す',text:'下のビスは上のパーツを外すまで抜けません。まず緑のビスを試そう。',target:moves.includes('D-0')?'D-0':moves.find(id=>this.board.getScrew(id)!.color==='green')};
      if(!this.learned.has('bufferSucked'))return{title:'一時置きは5枠',text:'トレイがない色はここで待機。赤を3本そろえると、次のトレイが来ます。',target:moves.find(id=>this.board.getScrew(id)!.color==='red')};
      return{title:'トレイが来ると自動回収',text:'待機中のビスは同じ色のトレイへ移ります。重なりを見ながら残りを外そう。'};
    }
    if(!this.learned.has('rotated'))return{title:'キューブを回す',text:'ドラッグして裏や底を見よう。トレイと一時置きは、6面で共有します。'};
    if(['F-0','D-0'].some(id=>!this.board.getScrew(id)!.pulled))return{title:'開いた面から内側を見る',text:'頭が内側のビスは、ねじ山が外側。隣のパネルを外して内側から抜こう。'};
    if(remaining>0)return{title:'残りの面を取り外す',text:'裏や底のビスも確認しよう。6枚のパネルを外すとクリアです。'};
    return null;
  }
}
