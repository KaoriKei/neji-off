// 金属の造形・照明・入力座標を担当する。盤面の判断は Puzzle に任せる。
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { COLORS } from './puzzle.ts';
import { flightPosition } from './motion.mjs';

const SCALE=1/120;
const xy=(x,y)=>[(x-540)*SCALE,(890-y)*SCALE];
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp=THREE.MathUtils.clamp;
const ease=t=>1-(1-t)**3;

export function roundedShape(w,h,r) {
  const s=new THREE.Shape(),x=-w/2,y=-h/2;
  s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
  s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
  s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;
}
export function circularHole(shape,x,y,r){const p=new THREE.Path();p.absarc(x,y,r,0,Math.PI*2,true);shape.holes.push(p);}
export function extrude(shape,depth,bevel=.03){return new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:24});}
function grainTexture(wood=false){
  const c=document.createElement('canvas');c.width=c.height=512;
  const ctx=c.getContext('2d'),data=ctx.createImageData(512,512);
  let seed=4907;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){
    const i=(y*512+x)*4;
    const grain=wood ? Math.sin(y*.31+Math.sin(x*.015)*1.4+Math.sin(y*.037)*2.3)*8+Math.sin(y*1.7)*2 : Math.sin(y*1.31)*2;
    const n=(rand()-.5)*(wood?7:12)+grain;
    data.data[i]=wood?185+n:194+n;data.data[i+1]=wood?162+n:196+n;data.data[i+2]=wood?132+n:197+n;data.data[i+3]=255;
  }
  ctx.putImageData(data,0,0);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(wood?1.5:2,wood?1.5:2);return t;
}

export class MetalScene {
  constructor(stage,level,{onPull,onMove}={}){
    this.stage=stage;this.level=level;this.onPull=onPull;this.onMove=onMove;
    this.low=matchMedia('(pointer: coarse)').matches||new URLSearchParams(location.search).has('light');
    this.scene=new THREE.Scene();
    const canvas=document.createElement('canvas');
    let lastError;
    for(const powerPreference of ['default','low-power']){
      try{this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:!this.low,powerPreference});break;}catch(e){lastError=e;}
    }
    if(!this.renderer)throw lastError;
    // 盤面と飛行中のネジを同じ描画器で描き、トレイまで立体の姿を保つ。
    document.body.append(canvas);canvas.className='scene-canvas';canvas.setAttribute('aria-hidden','true');
    this.renderer.autoClear=false;
    this.renderer.setPixelRatio(this.low?1:Math.min(devicePixelRatio,1.8));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.94;
    this.renderer.shadowMap.enabled=!this.low;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.camera=new THREE.PerspectiveCamera(33,1,.1,100);this.camera.position.set(0,0,22);this.camera.lookAt(0,0,0);
    const pmrem=new THREE.PMREMGenerator(this.renderer),room=new RoomEnvironment();
    this.environment=pmrem.fromScene(room,.035);this.scene.environment=this.environment.texture;room.dispose();pmrem.dispose();
    const key=new THREE.DirectionalLight(0xfff8ef,1.2);key.position.set(-4,7,10);key.castShadow=!this.low;
    key.shadow.mapSize.set(1536,1536);Object.assign(key.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:.1,far:35});key.shadow.bias=-.0004;key.shadow.normalBias=.025;key.shadow.radius=4;this.scene.add(key);
    const fill=new THREE.DirectionalLight(0xe7f5ff,.35);fill.position.set(6,-1,8);this.scene.add(fill);
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x95a4b1,.35));
    this.flightScene=new THREE.Scene();this.flightScene.environment=this.environment.texture;
    for(const light of this.scene.children.filter(o=>o.isLight)){const copy=light.clone();copy.castShadow=false;copy.position.multiplyScalar(1000);this.flightScene.add(copy);}
    this.flightCamera=new THREE.OrthographicCamera(0,1,1,0,.1,2000);this.flightCamera.position.z=1000;
    this.root=new THREE.Group();this.scene.add(this.root);
    this.rotation={x:-.23,y:-.20};this.targetRotation={...this.rotation};this.root.rotation.set(this.rotation.x,this.rotation.y,0);
    const metal=grainTexture(),wood=grainTexture(true);this.textures=[metal,wood];
    this.materials={
      silver:new THREE.MeshStandardMaterial({color:0xb6bec3,metalness:.8,roughness:.47,map:metal,bumpMap:metal,bumpScale:.012,envMapIntensity:.95}),
      dark:new THREE.MeshStandardMaterial({color:0x424b51,metalness:.55,roughness:.69,map:metal,bumpMap:metal,bumpScale:.025,envMapIntensity:.7}),
      wood:new THREE.MeshStandardMaterial({color:0xf0e6d5,map:wood,bumpMap:wood,bumpScale:.014,roughness:.82,metalness:0}),
      head:new THREE.MeshStandardMaterial({color:0xc0c8cd,metalness:.94,roughness:.42,envMapIntensity:1}),
      recess:new THREE.MeshStandardMaterial({color:0x30383d,roughness:.75,metalness:.4}),
      thread:new THREE.MeshStandardMaterial({color:0x87939a,metalness:.85,roughness:.5}),
    };
    this.washerMaterials=Object.fromEntries(Object.entries(COLORS).map(([k,c])=>[k,new THREE.MeshStandardMaterial({color:c.hex,metalness:.15,roughness:.51,envMapIntensity:.20})]));
    this.buildBackdrop();
    this.plates=new Map();this.screws=new Map();this.jobs=[];this.inspect=0;this.inspectTarget=0;this.locked=false;this.lastTime=performance.now();
    this.makeScrewGeometry();
    this.buildPuzzle();
    // 最初の1本だけ描画準備で止まらないよう、飛行用の材質も先に準備する。
    const warm=this.screws.values().next().value.group.clone();warm.traverse(o=>{o.castShadow=o.receiveShadow=false;});this.flightScene.add(warm);this.renderer.compile(this.flightScene,this.flightCamera);this.flightScene.remove(warm);
    this.bindInputs();
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(stage);this.resize();
    this.onResize=()=>this.resize();window.addEventListener('resize',this.onResize);
    this.contextLost=e=>{e.preventDefault();this.locked=true;this.onContextLost?.();};canvas.addEventListener('webglcontextlost',this.contextLost);
    this.renderer.setAnimationLoop(t=>this.frame(t));
  }

  buildBackdrop(){
    const backing=new THREE.Mesh(extrude(roundedShape(7.6,8.15,.22),.24,.08),this.materials.wood);backing.position.set(0,-.02,-.4);backing.castShadow=true;backing.receiveShadow=true;this.root.add(backing);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.14}));floor.position.z=-.57;floor.receiveShadow=true;this.scene.add(floor);
    this.addContactShadow(10.6,11,.1,-.2,-.56);
  }
  addContactShadow(w,h,x,y,z){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(64,64,5,64,64,64);
    gradient.addColorStop(0,'rgba(42,57,65,.28)');gradient.addColorStop(.65,'rgba(42,57,65,.12)');gradient.addColorStop(1,'rgba(42,57,65,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
    const texture=new THREE.CanvasTexture(canvas);this.textures.push(texture);
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));mesh.position.set(x,y,z);this.scene.add(mesh);return mesh;
  }
  buildPuzzle(){for(const p of this.level.plates)this.makePlate(p);}

  makeScrewGeometry(){
    const washer=new THREE.Shape();washer.absarc(0,0,.245,0,Math.PI*2,false);circularHole(washer,0,0,.108);
    const head=new THREE.Shape();head.absarc(0,0,.18,0,Math.PI*2,false);
    const cross=new THREE.Path();const arm=.125,neck=.045;
    const points=[[-neck,-arm],[-neck,-neck],[-arm,-neck],[-arm,neck],[-neck,neck],[-neck,arm],[neck,arm],[neck,neck],[arm,neck],[arm,-neck],[neck,-neck],[neck,-arm]];
    cross.moveTo(...points[0]);points.slice(1).forEach(p=>cross.lineTo(...p));cross.closePath();head.holes.push(cross);
    this.geo={washer:extrude(washer,.055,.012),head:extrude(head,.10,.018),shaft:new THREE.CylinderGeometry(.077,.065,.43,16),thread:new THREE.TorusGeometry(.081,.012,5,18),recess:new THREE.CircleGeometry(.164,24)};
    this.geo.shaft.rotateX(Math.PI/2);
  }

  makePlate(p){
    const [cx,cy]=xy(p.x+p.w/2,p.y+p.h/2),group=new THREE.Group();group.position.set(cx,cy,p.z*.25);
    const shape=roundedShape(p.w*SCALE,p.h*SCALE,.10);
    for(const s of p.screws){const [x,y]=xy(s.x,s.y);circularHole(shape,x-cx,y-cy,.115);}
    // 空の加工穴にも実際の奥行きを持たせる。
    const candidates=p.w>p.h ? [[p.x+p.w*.36,p.y+p.h*.5],[p.x+p.w*.72,p.y+p.h*.5]] : [[p.x+p.w*.5,p.y+p.h*.37],[p.x+p.w*.5,p.y+p.h*.72]];
    for(const [x,y] of candidates){if(p.screws.every(s=>Math.hypot(s.x-x,s.y-y)>65)){const [hx,hy]=xy(x,y);circularHole(shape,hx-cx,hy-cy,.15);}}
    const mesh=new THREE.Mesh(extrude(shape,.115,.027),p.z%2?this.materials.dark:this.materials.silver);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);this.root.add(group);
    this.plates.set(p.id,{group,mesh,base:group.position.clone(),falling:false,fallen:false});
    p.screws.forEach((s,i)=>{
      const id=`${p.id}-${i}`,sg=new THREE.Group(),[x,y]=xy(s.x,s.y);sg.position.set(x-cx,y-cy,.14);
      const washer=new THREE.Mesh(this.geo.washer,this.washerMaterials[s.color]);washer.castShadow=washer.receiveShadow=true;sg.add(washer);
      const head=new THREE.Mesh(this.geo.head,this.materials.head);head.position.z=.075;head.castShadow=true;head.receiveShadow=true;sg.add(head);
      const recess=new THREE.Mesh(this.geo.recess,this.materials.recess);recess.position.z=.078;sg.add(recess);
      const shaft=new THREE.Mesh(this.geo.shaft,this.materials.thread);shaft.position.z=-.15;sg.add(shaft);
      for(let n=0;n<6;n++){const t=new THREE.Mesh(this.geo.thread,this.materials.thread);t.position.z=-.34+n*.055;sg.add(t);}
      sg.rotation.z=((i*13+p.z*7)%10)*.15;sg.scale.setScalar(1.48);group.add(sg);
      this.screws.set(id,{group:sg,base:sg.position.clone(),plateId:p.id,color:s.color,pulled:false,covered:false,button:null,spinning:false});
    });
  }

  resize(){
    const r=this.stage.getBoundingClientRect();this.width=r.width;this.height=r.height;
    this.resizeCanvas();this.camera.aspect=r.width/r.height;
    const vertical=Math.max(9.6,9.2/this.camera.aspect);
    this.cameraDistance=vertical/(2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2)));
    this.camera.position.z=this.cameraDistance;
    this.camera.updateProjectionMatrix();this.camera.lookAt(0,0,0);
  }
  resizeCanvas(){
    this.screenWidth=document.documentElement.clientWidth;this.screenHeight=window.innerHeight;
    this.renderer.setSize(this.screenWidth,this.screenHeight,false);
    this.flightCamera.right=this.screenWidth;this.flightCamera.top=this.screenHeight;this.flightCamera.updateProjectionMatrix();
  }
  render(){
    const r=this.stage.getBoundingClientRect(),renderer=this.renderer;
    renderer.setScissorTest(false);renderer.setViewport(0,0,this.screenWidth,this.screenHeight);renderer.clear();
    renderer.setViewport(r.left,this.screenHeight-r.bottom,r.width,r.height);
    renderer.setScissor(r.left,this.screenHeight-r.bottom,r.width,r.height);renderer.setScissorTest(true);
    renderer.render(this.scene,this.camera);
    if(this.flying){
      renderer.setScissorTest(false);renderer.setViewport(0,0,this.screenWidth,this.screenHeight);renderer.clearDepth();renderer.render(this.flightScene,this.flightCamera);
    }
    renderer.setScissorTest(false);
  }
  bindInputs(){
    let down=null;
    this.stage.addEventListener('pointerdown',e=>{
      if(this.locked||e.button!==0)return;
      down={id:e.pointerId,x:e.clientX,y:e.clientY,rx:this.targetRotation.x,ry:this.targetRotation.y,target:e.target.closest('[data-screw]')?.dataset.screw};
      this.stage.setPointerCapture(e.pointerId);
    });
    this.stage.addEventListener('pointermove',e=>{
      if(!down||e.pointerId!==down.id)return;
      const dx=e.clientX-down.x,dy=e.clientY-down.y;
      if(Math.hypot(dx,dy)>6){this.stage.classList.add('dragging');this.targetRotation.y=clamp(down.ry+dx*.007,-.85,.85);this.targetRotation.x=clamp(down.rx+dy*.006,-.70,.70);this.onMove?.();}
    });
    this.stage.addEventListener('pointerup',e=>{
      if(!down||e.pointerId!==down.id)return;
      const d=down;down=null;this.stage.classList.remove('dragging');
      if(this.stage.hasPointerCapture(e.pointerId))this.stage.releasePointerCapture(e.pointerId);
      if(Math.hypot(e.clientX-d.x,e.clientY-d.y)<6&&d.target&&!this.inspectTarget)this.onPull?.(d.target);
    });
    const cancel=()=>{down=null;this.stage.classList.remove('dragging');};
    this.stage.addEventListener('pointercancel',cancel);this.stage.addEventListener('lostpointercapture',cancel);
  }
  turn(delta){this.targetRotation.y=clamp(this.targetRotation.y+delta,-.85,.85);}
  resetView(){this.targetRotation={x:-.23,y:-.20};}
  setInspect(value){this.inspectTarget=value?1:0;this.targetRotation=value?{x:-.52,y:-.45}:{x:-.23,y:-.20};}
  sync(board){
    for(const [id,pv]of this.plates){const p=board.getPlate(id);pv.group.visible=!p.dropped;pv.fallen=p.dropped;pv.falling=false;pv.group.position.copy(pv.base);pv.group.rotation.set(0,0,0);}
    for(const [id,sv]of this.screws){const s=board.getScrew(id);sv.pulled=s.pulled;sv.covered=board.isCovered(id);sv.group.position.copy(sv.base);sv.group.scale.setScalar(1.48);sv.spinning=false;sv.group.visible=!sv.pulled&&!sv.covered;}
  }
  setCovered(board){for(const[id,sv]of this.screws)sv.covered=board.isCovered(id);}
  project(id){const v=this.screws.get(id).group.getWorldPosition(new THREE.Vector3());v.project(this.camera);return{x:(v.x+1)*this.width/2,y:(1-v.y)*this.height/2};}
  animate(duration,update){
    return new Promise(resolve=>{this.jobs.push({start:performance.now(),duration:reduced?Math.min(duration,60):duration,update,resolve});});
  }
  async lift(id){
    const s=this.screws.get(id),r0=s.group.rotation.z;s.spinning=true;
    await this.animate(140,t=>{s.group.rotation.z=r0+ease(t)*Math.PI*2;s.group.position.z=s.base.z+ease(t)*.48;});
    const pos=this.project(id);s.pulled=true;s.spinning=false;s.group.visible=false;return pos;
  }
  async flyScrew(id,destination){
    const s=this.screws.get(id),mesh=s.group.clone(),origin=this.project(id),rect=this.stage.getBoundingClientRect();
    const from={x:rect.left+origin.x,y:rect.top+origin.y};
    const world=s.group.getWorldPosition(new THREE.Vector3()).applyMatrix4(this.camera.matrixWorldInverse);
    const pixels=this.height/(2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2))*-world.z);
    const startScale=s.group.getWorldScale(new THREE.Vector3()).x*pixels;
    const startRotation=this.camera.quaternion.clone().invert().multiply(s.group.getWorldQuaternion(new THREE.Quaternion()));
    const endRotation=new THREE.Quaternion(),spin=new THREE.Quaternion(),axis=new THREE.Vector3(0,0,1);
    const targetScale=destination.diameter/.514;
    mesh.visible=true;mesh.traverse(o=>{o.castShadow=o.receiveShadow=false;});this.flightScene.add(mesh);this.flying=mesh;
    const update=t=>{const p=flightPosition(from,destination,t);mesh.position.set(p.x,this.screenHeight-p.y,0);mesh.scale.setScalar(THREE.MathUtils.lerp(startScale,targetScale,p.progress));mesh.quaternion.copy(startRotation).slerp(endRotation,p.progress).multiply(spin.setFromAxisAngle(axis,p.progress*Math.PI*2));};
    update(0);
    try{await this.animate(260,update);}finally{this.flightScene.remove(mesh);this.flying=null;}
  }
  async drop(id){
    const p=this.plates.get(id);p.falling=true;
    await this.animate(580,t=>{const q=ease(t);p.group.position.x=p.base.x+q*(p.base.x>0?2.8:-2.8);p.group.position.y=p.base.y-t*t*5.5;p.group.position.z=p.base.z+Math.sin(t*Math.PI)*1.8;p.group.rotation.z=(p.base.x>0?1:-1)*q*.40;p.group.rotation.x=q*.65;});
    p.group.visible=false;p.fallen=true;p.falling=false;
  }
  shake(id){const s=this.screws.get(id);return this.animate(230,t=>{s.group.position.x=s.base.x+Math.sin(t*Math.PI*6)*.045*(1-t);});}
  frame(now){
    const dt=Math.min((now-this.lastTime)/1000,.05);this.lastTime=now;
    const blend=reduced?1:1-Math.exp(-11*dt);
    this.rotation.x+=(this.targetRotation.x-this.rotation.x)*blend;this.rotation.y+=(this.targetRotation.y-this.rotation.y)*blend;this.root.rotation.set(this.rotation.x,this.rotation.y,0);
    this.inspect+=(this.inspectTarget-this.inspect)*blend;
    this.camera.position.z=this.cameraDistance*(1+this.inspect*.24);
    for(const p of this.plates.values())if(!p.falling&&!p.fallen)p.group.position.z=p.base.z+this.inspect*(p.base.z*1.7+.12);
    for(const s of this.screws.values())if(!s.spinning)s.group.visible=!s.pulled&&(!s.covered||this.inspect>.1);
    for(let i=this.jobs.length-1;i>=0;i--){const j=this.jobs[i],t=clamp((now-j.start)/j.duration,0,1);j.update(t);if(t===1){this.jobs.splice(i,1);j.resolve();}}
    this.root.updateMatrixWorld(true);
    for(const[id,s]of this.screws){if(!s.button)continue;s.button.hidden=s.pulled||s.covered||this.inspect>.08||!this.plates.get(s.plateId).group.visible;if(!s.button.hidden){const p=this.project(id);s.button.style.transform=`translate3d(${p.x}px,${p.y}px,0) translate(-50%,-50%)`;}}
    this.render();
  }
  dispose(){
    this.renderer.setAnimationLoop(null);this.resizeObserver.disconnect();window.removeEventListener('resize',this.onResize);
    const geometries=new Set(Object.values(this.geo)),materials=new Set([...Object.values(this.materials),...Object.values(this.washerMaterials)]);
    this.scene.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());this.environment.dispose();this.renderer.dispose();this.renderer.domElement.remove();
  }
}
