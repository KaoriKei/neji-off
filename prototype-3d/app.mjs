import { Campaign, STAGES } from './campaign.ts';
import { COLORS } from './puzzle.ts';
import { CubeScene } from './cube-renderer.mjs';
import { FlatScene } from './flat-renderer.mjs';
import { flightPosition } from './motion.mjs';

const $=selector=>document.querySelector(selector);
// 開発用の直接表示は公開ビルドに含めない。通常は必ずLv1から始める。
const initialLevel=import.meta.env.DEV?Number(new URLSearchParams(location.search).get('level')??1):1;
const puzzle=new Campaign(initialLevel),stage=$('#stage'),result=$('#result');
const pendingDrops=new Set();
let view,busy=false,inspecting=false,sound=true,audioContext,display=puzzle.board.snapshot(),lastFocus=null;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait=ms=>new Promise(r=>setTimeout(r,reduced?Math.min(ms,50):ms));
const screwMarkup=color=>`<span class="mini-screw" style="--screw-color:${COLORS[color].hex}" aria-hidden="true"></span>`;
let statusTimer;
function say(text='',alert=false){clearTimeout(statusTimer);$('#status').textContent=text;$('#status').classList.toggle('alert',alert);if(text&&!inspecting)statusTimer=setTimeout(()=>say(),3500);}
function tone(kind){
  if(!sound)return;
  try{
    audioContext??=new (window.AudioContext||window.webkitAudioContext)();
    void audioContext.resume();
    const t=audioContext.currentTime;
    const tones=kind==='clear'?[659,831,988]:kind==='complete'?[660,990]:kind==='knock'?[170]:kind==='lift'?[460,580]:kind==='plate'?[130,215]:[1250,1900];
    tones.forEach((freq,i)=>{const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='sine';osc.frequency.setValueAtTime(freq,t+i*.055);osc.frequency.exponentialRampToValueAtTime(freq*.6,t+i*.055+.10);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(kind==='plate'?.045:.022,t+i*.055+.004);gain.gain.exponentialRampToValueAtTime(.0001,t+i*.055+.15);osc.connect(gain);gain.connect(audioContext.destination);osc.start(t+i*.055);osc.stop(t+i*.055+.17);osc.onended=()=>{osc.disconnect();gain.disconnect();};});
  }catch{/* 音が使えない場合も、操作は続けられる。 */}
}
function paintTrays(){
  $('#trays').innerHTML=display.trays.map((t,i)=>{
    const c=t?COLORS[t.color]:null;
    return `<div class="tray ${t?'':'empty'}" data-tray="${i}" style="--tray-color:${c?.hex??'#bfc8cd'}" aria-label="${c?`${c.name}のトレイ ${t.count}/3`:'空のトレイ'}"><div class="tray-holes">${[0,1,2].map(n=>`<span class="hole" data-slot="${n}">${t&&n<t.count?screwMarkup(t.color):''}</span>`).join('')}</div></div>`;
  }).join('');
  $('#queue').innerHTML=display.queue.slice(0,4).map(c=>`<span class="queue-dot" style="--screw-color:${COLORS[c].hex}" aria-label="${COLORS[c].name}"></span>`).join('')||'<span>—</span>';
}
function paintBuffer(){
  const ids=display.buffer;
  $('#buffer').innerHTML=Array.from({length:puzzle.board.bufferSize},(_,i)=>`<div class="buffer-slot" data-buffer="${i}" aria-label="一時置き ${i+1}: ${ids[i]?COLORS[puzzle.board.getScrew(ids[i]).color].name:'空き'}">${ids[i]?screwMarkup(puzzle.board.getScrew(ids[i]).color):''}</div>`).join('');
  $('#buffer-count').innerHTML=`空き <b>${puzzle.board.bufferSize-ids.length}</b>`;
  $('.buffer-section').classList.toggle('danger',ids.length>=puzzle.board.bufferSize-1);
}
function paintProgress(){
  const remaining=puzzle.board.remainingScrews(),total=puzzle.board.allScrews().length;
  $('#progress-fill').style.width=`${(total-remaining)/total*100}%`;
  $('.progress').setAttribute('aria-valuemax',String(total));$('.progress').setAttribute('aria-valuenow',String(total-remaining));$('#remaining').textContent=`残り${remaining}本`;
  $('#undo').disabled=busy||pendingDrops.size>0||inspecting||puzzle.history.length===0;
  $('#restart').disabled=busy||pendingDrops.size>0;$('#structure').disabled=busy||pendingDrops.size>0;$('#turn-left').disabled=busy;$('#turn-right').disabled=busy;$('#view-reset').disabled=busy;
  $('.game').classList.toggle('pulling',busy);
  stage.setAttribute('aria-busy',String(busy));
}
function paintTutorial(){
  const lesson=puzzle.lesson();$('#tutorial').hidden=inspecting||!lesson;
  if(lesson){$('#lesson-title').textContent=lesson.title;$('#lesson-text').textContent=lesson.text;}
  for(const button of document.querySelectorAll('.screw-button'))button.classList.toggle('lesson-target',button.dataset.screw===lesson?.target);
}
function paintAll(){paintTrays();paintBuffer();paintProgress();paintTutorial();}
function createButtons(){
  const host=$('#screw-buttons');host.replaceChildren();
  for(const s of puzzle.board.allScrews()){
    const button=document.createElement('button');button.type='button';button.className='screw-button';button.dataset.screw=s.id;
    button.setAttribute('aria-label',`${COLORS[s.color].name}のビス ${s.id}を抜く`);
    // ポインター操作は盤面が受け持つ。キーボードでも同じ操作ができる。
    button.addEventListener('click',e=>{if(e.detail===0)void pull(s.id);});host.append(button);view.screws.get(s.id).button=button;
  }
}
function rectCenter(element){const r=element.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};}
function destination(element){return{...rectCenter(element),diameter:element.classList.contains('hole')?element.getBoundingClientRect().width+5:31};}
function land(selector){const el=$(selector);el?.animate([{transform:'scale(1)'},{transform:'scale(.91)',offset:.4},{transform:'scale(1)'}],{duration:reduced?40:110,easing:'ease-out'});tone('land');}
async function fly(from,to,color){
  const el=document.createElement('div');el.className='flying-screw';el.innerHTML=screwMarkup(color);document.body.append(el);
  const frames=Array.from({length:41},(_,i)=>{const t=i/40,p=flightPosition(from,to,t),scale=1+(to.diameter/31-1)*p.progress;return{offset:t,transform:`translate3d(${p.x}px,${p.y}px,0) translate(-50%,-50%) scale(${scale}) rotate(${p.progress*360}deg)`};});
  const animation=el.animate(frames,{duration:reduced?60:180,easing:'linear',fill:'forwards'});
  try{await animation.finished;}finally{el.remove();}
}
async function recoverBuffer(events){
  // 元の位置を保って少しずつ続けて飛ばす。途中で左詰めして飛行開始位置をずらさない。
  const flights=events.map(e=>{const index=display.buffer.indexOf(e.screwId),source=$(`[data-buffer="${index}"] .mini-screw`),selector=`[data-tray="${e.trayIndex}"] [data-slot="${e.slot}"]`;return{e,source,from:rectCenter(source),to:destination($(selector)),selector};});
  await Promise.all(flights.map(async(f,i)=>{if(i)await wait(i*55);f.source.style.visibility='hidden';await fly(f.from,f.to,puzzle.board.getScrew(f.e.screwId).color);display.trays[f.e.trayIndex].count++;paintTrays();land(f.selector);}));
  const moved=new Set(events.map(e=>e.screwId));display.buffer=display.buffer.filter(id=>!moved.has(id));paintBuffer();
}
async function pull(id){
  if(busy||inspecting||!view||!result.hidden||!view.visibleScrews.has(id))return;
  const attempted=puzzle.pull(id);
  if(!attempted.ok){tone('knock');say(attempted.reason==='covered'?'上に重なるパーツを先に外そう。':'一時置きがいっぱい。同じ色のトレイへ入るビスを探そう。',true);await view.shake(id);return;}
  busy=true;view.locked=true;say();paintProgress();tone('lift');
  try{
    await view.lift(id);
    for(let i=0;i<attempted.events.length;i++){
      const e=attempted.events[i];
      if(e.type==='screwToTray'||e.type==='screwToBuffer'){
        const selector=e.type==='screwToTray'?`[data-tray="${e.trayIndex}"] [data-slot="${e.slot}"]`:`[data-buffer="${e.bufferIndex}"]`;
        await view.flyScrew(id,destination($(selector)));
        if(e.type==='screwToTray')display.trays[e.trayIndex].count++;
        else display.buffer.push(id);
        paintTrays();paintBuffer();land(selector);
      }else if(e.type==='plateDropped'){
        tone('plate');const drop=view.drop(e.plateId);pendingDrops.add(drop);
        void drop.finally(()=>{pendingDrops.delete(drop);paintProgress();});
        view.setCovered(puzzle.board);
      }else if(e.type==='trayCompleted'){
        tone('complete');$(`[data-tray="${e.trayIndex}"]`).classList.add('completed');await wait(220);display.trays[e.trayIndex]=null;paintTrays();
      }else if(e.type==='trayArrived'){
        display.trays[e.trayIndex]={color:e.color,count:0};display.queue.shift();paintTrays();$(`[data-tray="${e.trayIndex}"]`).classList.add('arrived');await wait(120);
      }else if(e.type==='bufferSucked'){
        const group=[e];while(attempted.events[i+1]?.type==='bufferSucked')group.push(attempted.events[++i]);await recoverBuffer(group);
      }else if(e.type==='cleared'){
        await Promise.all(pendingDrops);tone('clear');await wait(150);showResult(true);
      }else if(e.type==='stuck'){
        await Promise.all(pendingDrops);tone('knock');await wait(100);showResult(false);
      }
    }
    display=puzzle.board.snapshot();view.setCovered(puzzle.board);
  }catch(error){console.error('ネジの演出を復元しました',error);await Promise.allSettled(pendingDrops);display=puzzle.board.snapshot();view.sync(puzzle.board);say('盤面を整えました。そのまま続けられます。');}
  finally{busy=false;view.locked=false;paintAll();}
}
function showResult(clear){
  $('#result-kicker').textContent=clear?`LEVEL ${String(puzzle.index+1).padStart(2,'0')} COMPLETE`:'TRY AGAIN';
  $('#result-title').textContent=clear?'分解完了':'取り外す順番を見直そう';
  const next=puzzle.index===1?'次は、キューブの6面を分解します。':puzzle.index===0?'次は、パーツの重なりと一時置きに挑戦。':'次は、色と取り外す順番を見極めよう。';
  $('#result-text').textContent=clear?(puzzle.isLast?`全${STAGES.length}レベルをクリア。`:puzzle.index<2?next:`次は、${STAGES[puzzle.index+1].name}。`):'一時置きがいっぱいです。\n一手戻して、別の順番を試せます。';
  $('#next').hidden=!clear||puzzle.isLast;$('#next').textContent=`LEVEL ${String(puzzle.index+2).padStart(2,'0')} へ進む`;
  $('#again').textContent=clear&&puzzle.isLast?'最初から遊ぶ':'このレベルをやり直す';
  $('#again').className=clear&&!puzzle.isLast?'text-button':'primary-button';
  $('#result-undo').hidden=clear;result.hidden=false;lastFocus=document.activeElement;$('.game').inert=true;($('#next').hidden?$('#again'):$('#next')).focus();
}
function closeResult(){result.hidden=true;$('.game').inert=false;if(lastFocus?.isConnected&&!lastFocus.hidden)lastFocus.focus();}
function clearInspect(){
  inspecting=false;$('.game').classList.remove('inspect');$('#structure').setAttribute('aria-pressed','false');$('#structure').textContent='重なりを見る';view?.setInspect(false);
}
function reset(){
  if(busy||pendingDrops.size)return;
  const startOver=!result.hidden&&puzzle.isLast&&puzzle.board.isCleared();closeResult();
  if(startOver){puzzle.startOver();initLevel();return;}
  puzzle.reset();display=puzzle.board.snapshot();clearInspect();view.sync(puzzle.board);view.resetView();paintAll();say();
}
function undo(){
  if(busy||pendingDrops.size||inspecting)return;const previous=puzzle.history.at(-1),undone=previous?.allScrews().find(s=>!s.pulled&&puzzle.board.getScrew(s.id).pulled);
  if(!puzzle.undo())return;closeResult();display=puzzle.board.snapshot();view.sync(puzzle.board);if(undone)view.focusScrew?.(undone.id);paintAll();say('一手戻しました');
}
$('#restart').addEventListener('click',reset);$('#again').addEventListener('click',reset);$('#undo').addEventListener('click',undo);$('#result-undo').addEventListener('click',undo);
$('#next').addEventListener('click',()=>{if(busy||pendingDrops.size||!puzzle.advance())return;closeResult();initLevel();});
function rotated(){if(puzzle.stage.kind==='cube'&&!puzzle.learned.has('rotated')){puzzle.learned.add('rotated');paintTutorial();}}
$('#turn-left').addEventListener('click',()=>{view?.turn(-.30);rotated();});$('#turn-right').addEventListener('click',()=>{view?.turn(.30);rotated();});$('#view-reset').addEventListener('click',()=>view?.resetView());
$('#structure').addEventListener('click',()=>{if(busy||pendingDrops.size)return;inspecting=!inspecting;view.setInspect(inspecting);$('.game').classList.toggle('inspect',inspecting);$('#structure').setAttribute('aria-pressed',String(inspecting));$('#structure').textContent=inspecting?'重なりを閉じる':'重なりを見る';say(inspecting?'確認中 · 閉じると操作できます':'');paintProgress();paintTutorial();});
$('#sound').addEventListener('click',()=>{sound=!sound;$('#sound').textContent=sound?'音 ON':'音 OFF';$('#sound').setAttribute('aria-pressed',String(sound));$('#sound').setAttribute('aria-label',sound?'効果音をオフにする':'効果音をオンにする');if(sound)tone('land');});
result.addEventListener('keydown',e=>{if(e.key==='Tab'){const buttons=[...result.querySelectorAll('button:not([hidden])')];if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0].focus();}}});
function initLevel(){
  clearInspect();view?.dispose();view=null;lastFocus=null;busy=false;
  display=puzzle.board.snapshot();$('#screw-buttons').replaceChildren();$('#stage-error').hidden=true;
  const cube=puzzle.stage.kind==='cube';$('.game').dataset.kind=puzzle.stage.kind;
  const tutorial=$('#tutorial');tutorial.classList.toggle('floating',!cube);
  if(cube)stage.before(tutorial);else stage.prepend(tutorial);
  $('.level b').textContent=String(puzzle.index+1).padStart(2,'0');
  stage.setAttribute('aria-label',cube?'ドラッグで360度回転できる金属のキューブ':'ドラッグで傾けられる金属の平面パズル');
  $('#restart').setAttribute('aria-label','このレベルをやり直す');$('#restart').title='このレベルをやり直す';
  paintAll();say();
  try{
    view=new (cube?CubeScene:FlatScene)(stage,puzzle.level,{onPull:pull,onMove:rotated});view.sync(puzzle.board);createButtons();paintTutorial();
    view.onContextLost=()=>{busy=true;paintProgress();const el=$('#stage-error');el.hidden=false;el.innerHTML='<p>3D表示が中断しました。<br><button id="reload-3d">画面を開き直す</button></p>';$('#reload-3d').onclick=()=>location.reload();};
  }catch(error){
    console.error('3D表示を開始できませんでした',error);const el=$('#stage-error');el.hidden=false;el.innerHTML='<p>この設定では3D画面を開けませんでした。<br><button id="light-3d">軽量モードで開く</button></p>';$('#light-3d').onclick=()=>{const u=new URL(location.href);u.searchParams.set('light','1');location.href=u.href;};busy=true;paintProgress();say('3D表示の設定を変更できます。');
  }
}
initLevel();
window.addEventListener('pagehide',event=>{if(!event.persisted)view?.dispose();});
