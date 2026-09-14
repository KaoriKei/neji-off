import { CubePuzzle as Puzzle, LEVEL, COLORS, FACES } from './cube-puzzle.ts';
import { CubeScene as MetalScene } from './cube-renderer.mjs';

const $=selector=>document.querySelector(selector);
const puzzle=new Puzzle(),stage=$('#stage'),result=$('#result');
let view,busy=false,inspecting=false,sound=true,audioContext,display=puzzle.board.snapshot(),lastFocus=null;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait=ms=>new Promise(r=>setTimeout(r,reduced?Math.min(ms,50):ms));
const screwMarkup=color=>`<span class="mini-screw" style="--screw-color:${COLORS[color].hex}" aria-hidden="true"></span>`;
function say(text,alert=false){$('#status').textContent=text;$('#status').classList.toggle('alert',alert);}
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
  $('#queue').innerHTML=display.queue.map(c=>`<span class="queue-dot" style="--screw-color:${COLORS[c].hex}" aria-label="${COLORS[c].name}"></span>`).join('')||'<span>—</span>';
}
function paintBuffer(){
  const ids=display.buffer;
  $('#buffer').innerHTML=Array.from({length:LEVEL.bufferSize},(_,i)=>`<div class="buffer-slot" data-buffer="${i}" aria-label="一時置き ${i+1}: ${ids[i]?COLORS[puzzle.board.getScrew(ids[i]).color].name:'空き'}">${ids[i]?screwMarkup(puzzle.board.getScrew(ids[i]).color):''}</div>`).join('');
  $('#buffer-count').innerHTML=`あと <b>${LEVEL.bufferSize-ids.length}</b> 枠`;
  $('.buffer-section').classList.toggle('danger',ids.length>=LEVEL.bufferSize-1);
}
function paintProgress(){
  const remaining=puzzle.board.remainingScrews(),total=18;
  $('#progress-fill').style.width=`${(total-remaining)/total*100}%`;
  $('.progress').setAttribute('aria-valuenow',String(total-remaining));$('#remaining').textContent=`残り${remaining}本`;
  $('#undo').disabled=busy||inspecting||puzzle.history.length===0;
  $('#restart').disabled=busy;$('#structure').disabled=busy;$('#turn-left').disabled=busy;$('#turn-right').disabled=busy;$('#view-reset').disabled=busy;
  for(const face of FACES){const button=$(`[data-face="${face.id}"]`);const p=puzzle.board.getPlate(face.id);const n=p.screwIds.filter(id=>!puzzle.board.getScrew(id).pulled).length;button.disabled=busy;button.setAttribute('aria-label',`面${face.number}を見る（${face.name}・残り${n}本）`);button.classList.toggle('face-cleared',p.dropped);button.querySelector('.face-dots').textContent='●'.repeat(n)+'○'.repeat(3-n);}
  $('.game').classList.toggle('pulling',busy);
  stage.setAttribute('aria-busy',String(busy));
}
function paintAll(){paintTrays();paintBuffer();paintProgress();}
function createButtons(){
  const host=$('#screw-buttons');
  for(const s of puzzle.board.allScrews()){
    const button=document.createElement('button');button.type='button';button.className='screw-button';button.dataset.screw=s.id;
    button.setAttribute('aria-label',`${COLORS[s.color].name}のネジ ${s.id}を抜く`);
    // ポインター操作は盤面が受け持つ。キーボードでも同じ操作ができる。
    button.addEventListener('click',e=>{if(e.detail===0)void pull(s.id);});host.append(button);view.screws.get(s.id).button=button;
  }
}
function rectCenter(element){const r=element.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};}
async function fly(from,to,color){
  const el=document.createElement('div');el.className='flying-screw';el.innerHTML=screwMarkup(color);el.style.left=`${from.x}px`;el.style.top=`${from.y}px`;document.body.append(el);
  const duration=reduced?60:300;
  const animation=el.animate([{transform:'translate(-50%,-50%) scale(1.2)',left:`${from.x}px`,top:`${from.y}px`},{offset:.46,transform:'translate(-50%,-50%) scale(1.08) rotate(125deg)',left:`${(from.x+to.x)/2}px`,top:`${Math.min(from.y,to.y)-32}px`},{transform:'translate(-50%,-50%) scale(1) rotate(270deg)',left:`${to.x}px`,top:`${to.y}px`}],{duration,easing:'cubic-bezier(.2,.65,.35,1)',fill:'forwards'});
  try{await animation.finished;}finally{el.remove();}
}
async function pull(id){
  if(busy||inspecting||!view||!result.hidden||!view.visibleScrews.has(id))return;
  const attempted=puzzle.pull(id);
  if(!attempted.ok){tone('knock');say(attempted.reason==='covered'?'上に重なるパーツを先に外そう。':'一時置きがいっぱい。同じ色のトレイへ入るネジを探そう。',true);await view.shake(id);return;}
  busy=true;view.locked=true;paintProgress();tone('lift');
  try{
    const s=puzzle.board.getScrew(id),start=await view.lift(id),sr=stage.getBoundingClientRect();
    for(const e of attempted.events){
      if(e.type==='screwToTray'||e.type==='screwToBuffer'){
        const target=e.type==='screwToTray'?$(`[data-tray="${e.trayIndex}"] [data-slot="${e.slot}"]`):$(`[data-buffer="${e.bufferIndex}"]`);
        await fly({x:sr.left+start.x,y:sr.top+start.y},rectCenter(target),s.color);tone('land');
        if(e.type==='screwToTray')display.trays[e.trayIndex].count++;
        else display.buffer.push(id);
        paintTrays();paintBuffer();
        say(e.type==='screwToBuffer'?'次のトレイが来るまで、ここで待機。':'あと何本でそろうか、次の色も見てみよう。');
      }else if(e.type==='plateDropped'){
        tone('plate');await view.drop(e.plateId);view.setCovered(puzzle.board);say('パネルが外れた。隣の面の留め具も確認してみよう。');
      }else if(e.type==='trayCompleted'){
        tone('complete');$(`[data-tray="${e.trayIndex}"]`).classList.add('completed');await wait(330);display.trays[e.trayIndex]=null;paintTrays();say('3本そろった。次のトレイへ。');
      }else if(e.type==='trayArrived'){
        display.trays[e.trayIndex]={color:e.color,count:0};display.queue.shift();paintTrays();$(`[data-tray="${e.trayIndex}"]`).classList.add('arrived');await wait(150);
      }else if(e.type==='bufferSucked'){
        const index=display.buffer.indexOf(e.screwId),target=$(`[data-tray="${e.trayIndex}"] [data-slot="${e.slot}"]`);
        if(index>=0){const from=rectCenter($(`[data-buffer="${index}"]`));const source=puzzle.board.getScrew(e.screwId);display.buffer.splice(index,1);paintBuffer();await fly(from,rectCenter(target),source.color);display.trays[e.trayIndex].count++;paintTrays();tone('land');}
      }else if(e.type==='cleared'){
        tone('clear');await wait(250);showResult(true);
      }else if(e.type==='stuck'){
        tone('knock');await wait(150);showResult(false);
      }
    }
    display=puzzle.board.snapshot();view.setCovered(puzzle.board);
  }catch(error){console.error('ネジの演出を復元しました',error);display=puzzle.board.snapshot();view.sync(puzzle.board);say('盤面を整えました。そのまま続けられます。');}
  finally{busy=false;view.locked=false;paintAll();}
}
function showResult(clear){
  $('#result-kicker').textContent=clear?'COMPLETE':'TAKE A BREATH';
  $('#result-title').textContent=clear?'きれいに、ほどけた。':'少し、順番を変えてみよう。';
  $('#result-text').textContent=clear?'6つの面と18本のネジ。\nキューブをすべて分解できました。':'6面を通して、抜けるネジの行き先がありません。\n一手戻して、別の順番を試せます。';
  $('#result-undo').hidden=clear;result.hidden=false;lastFocus=document.activeElement;$('.game').inert=true;$('#again').focus();
}
function closeResult(){result.hidden=true;$('.game').inert=false;lastFocus?.focus();}
function reset(){if(busy)return;closeResult();puzzle.reset();display=puzzle.board.snapshot();inspecting=false;$('.game').classList.remove('inspect');$('#structure').setAttribute('aria-pressed','false');$('#structure').textContent='重なりを見る';view.setInspect(false);view.sync(puzzle.board);view.resetView();paintAll();say('ネジをタップ。同じ色を3本そろえよう。');}
function undo(){if(busy||inspecting)return;const previous=puzzle.history.at(-1);const undone=previous?.allScrews().find(s=>!s.pulled&&puzzle.board.getScrew(s.id).pulled);if(!puzzle.undo())return;closeResult();display=puzzle.board.snapshot();view.sync(puzzle.board);if(undone)view.focusFace(undone.plateId);paintAll();say('一手戻した。別の面のネジも探してみよう。');}
$('#restart').addEventListener('click',reset);$('#again').addEventListener('click',reset);$('#undo').addEventListener('click',undo);$('#result-undo').addEventListener('click',undo);
$('#turn-left').addEventListener('click',()=>view?.turn(-.30));$('#turn-right').addEventListener('click',()=>view?.turn(.30));$('#view-reset').addEventListener('click',()=>view?.resetView());
$('#structure').addEventListener('click',()=>{if(busy)return;inspecting=!inspecting;view.setInspect(inspecting);$('.game').classList.toggle('inspect',inspecting);$('#structure').setAttribute('aria-pressed',String(inspecting));$('#structure').textContent=inspecting?'重なりを閉じる':'重なりを見る';say(inspecting?'パーツの間を広げて確認中。閉じるとネジを抜けます。':'ネジをタップ。同じ色を3本そろえよう。');paintProgress();});
$('#sound').addEventListener('click',()=>{sound=!sound;$('#sound').textContent=sound?'音 ON':'音 OFF';$('#sound').setAttribute('aria-pressed',String(sound));$('#sound').setAttribute('aria-label',sound?'効果音をオフにする':'効果音をオンにする');if(sound)tone('land');});
result.addEventListener('keydown',e=>{if(e.key==='Tab'){const buttons=[...result.querySelectorAll('button:not([hidden])')];if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0].focus();}}});
$('#face-nav').innerHTML=FACES.map(f=>`<button class="face-button" data-face="${f.id}" aria-label="面${f.number}を見る（${f.name}・残り3本）" aria-pressed="false"><b>${f.number}</b><span class="face-dots" aria-hidden="true">●●●</span></button>`).join('');
for(const b of document.querySelectorAll('[data-face]'))b.addEventListener('click',()=>view?.focusFace(b.dataset.face));
paintAll();
try{
  view=new MetalScene(stage,LEVEL,{onPull:pull});view.sync(puzzle.board);createButtons();
  view.onFace=id=>{for(const button of document.querySelectorAll('[data-face]'))button.setAttribute('aria-pressed',String(button.dataset.face===id));};
  view.onContextLost=()=>{busy=true;paintProgress();const el=$('#stage-error');el.hidden=false;el.innerHTML='<p>3D表示が中断しました。<br><button id="reload-3d">画面を開き直す</button></p>';$('#reload-3d').onclick=()=>location.reload();};
}catch(error){
  console.error('3D表示を開始できませんでした',error);const el=$('#stage-error');el.hidden=false;el.innerHTML='<p>この設定では3D画面を開けませんでした。<br><button id="light-3d">軽量モードで開く</button></p>';$('#light-3d').onclick=()=>{const u=new URL(location.href);u.searchParams.set('light','1');location.href=u.href;};busy=true;paintProgress();say('3D表示の設定を変更できます。');
}
window.addEventListener('pagehide',event=>{if(!event.persisted)view?.dispose();});
