// 六面の向き、隣の面へ折り返す留め具、自由回転を担当する。
import * as THREE from 'three';
import { MetalScene, roundedShape, circularHole, extrude } from './renderer.mjs';
import { FACES, FLAPS } from './cube-model.ts';
import { mountFastener } from './fastener-mount.mjs';
import { nearestScrew } from './screw-hit.mjs';

const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const Z=new THREE.Vector3(0,0,1),X=new THREE.Vector3(1,0,0),Y=new THREE.Vector3(0,1,0);
const clamp=THREE.MathUtils.clamp;
export class CubeScene extends MetalScene {
  buildBackdrop(){
    const shadow=this.addContactShadow(7,2.0,0,-3.1,-3.1);shadow.material.opacity=.7;
    // パネルを外すと残る骨組み。追加の攻略レイヤーではない。
    const geo=new THREE.BoxGeometry(3.65,.105,.105);
    for(let axis=0;axis<3;axis++)for(const a of [-1.82,1.82])for(const b of [-1.82,1.82]){
      const bar=new THREE.Mesh(geo,this.materials.dark);
      if(axis===0)bar.position.set(0,a,b);
      if(axis===1){bar.rotation.z=Math.PI/2;bar.position.set(a,0,b);}
      if(axis===2){bar.rotation.y=Math.PI/2;bar.position.set(a,b,0);}
      bar.castShadow=bar.receiveShadow=true;this.root.add(bar);
    }
    for(const x of [-1.82,1.82])for(const y of [-1.82,1.82])for(const z of [-1.82,1.82]){
      const joint=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,.18),this.materials.wood);joint.position.set(x,y,z);joint.castShadow=true;this.root.add(joint);
    }
  }
  buildPuzzle(){
    this.homeQuaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(.53,-.58,0));
    this.targetQuaternion=this.homeQuaternion.clone();this.root.quaternion.copy(this.targetQuaternion);
    this.raycaster=new THREE.Raycaster();this.blockerMeshes=[];this.visibleScrews=new Set();
    for(const face of FACES)this.makeFace(face);
    this.root.updateMatrixWorld(true);
    for(const flap of FLAPS)if(this.level.plates.find(p=>p.id===flap.to).screws[flap.screw].headSide==='inside')this.makeFlap(flap);
  }
  makeFace(face){
    const p=this.level.plates.find(p=>p.id===face.id),group=new THREE.Group();
    const normal=new THREE.Vector3(...face.normal),orientation=new THREE.Quaternion().setFromEuler(new THREE.Euler(...face.rotation));
    group.position.copy(normal).multiplyScalar(1.95);group.quaternion.copy(orientation);
    const shape=roundedShape(3.82,3.82,.13);
    for(const[u,v]of face.screws)circularHole(shape,u,v,.12);
    circularHole(shape,.43,.04,.105);
    const material=face.number%2?this.materials.silver:this.materials.dark;
    const mesh=new THREE.Mesh(extrude(shape,.10,.035),material);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);this.root.add(group);this.blockerMeshes.push(mesh);
    this.plates.set(p.id,{group,mesh,base:group.position.clone(),orientation,normal,face,falling:false,fallen:false});
    const c=document.createElement('canvas');c.width=256;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle=face.number%2?'#65717b':'#a9b5bc';ctx.font='500 54px sans-serif';ctx.textAlign='center';ctx.fillText(String(face.number).padStart(2,'0'),128,60);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;this.textures.push(texture);
    const label=new THREE.Mesh(new THREE.PlaneGeometry(.62,.23),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));label.position.set(.95,-1.54,.143);group.add(label);
    p.screws.forEach((s,i)=>{
      const id=`${p.id}-${i}`,[u,v]=face.screws[i],sg=new THREE.Group();
      const mount=mountFastener(sg,{x:u,y:v,inside:s.headSide==='inside',angle:i*.32});
      const washer=new THREE.Mesh(this.geo.washer,this.washerMaterials[s.color]);washer.castShadow=washer.receiveShadow=true;sg.add(washer);
      const head=new THREE.Mesh(this.geo.head,this.materials.head);head.position.z=.075;head.castShadow=head.receiveShadow=true;sg.add(head);
      const recess=new THREE.Mesh(this.geo.recess,this.materials.recess);recess.position.z=.078;sg.add(recess);
      const shaft=new THREE.Mesh(this.geo.shaft,this.materials.thread);shaft.position.z=-.15;sg.add(shaft);
      for(let n=0;n<6;n++){const thread=new THREE.Mesh(this.geo.thread,this.materials.thread);thread.position.z=-.34+n*.055;sg.add(thread);}
      group.add(sg);this.screws.set(id,{group:sg,...mount,plateId:p.id,color:s.color,pulled:false,covered:false,button:null,spinning:false});
      this.makeReceiver(group,orientation,normal,u,v,mount.inside);
    });
  }
  makeReceiver(panel,orientation,normal,u,v,inside){
    // フレームの耳を板の裏に置く。内締めでは板側の外ナットへ、外締めでは耳のナットへねじ込む。
    const support=new THREE.Group();support.position.copy(normal).multiplyScalar(1.95);support.quaternion.copy(orientation);
    const nearX=Math.abs(u)>Math.abs(v),edge=(nearX?Math.sign(u):Math.sign(v))*1.80;
    const start=(nearX?u:v)+Math.sign(edge)*.20,length=Math.abs(edge-start);
    const bar=new THREE.Mesh(new THREE.BoxGeometry(nearX?length:.16,nearX?.16:length,.07),this.materials.dark);
    bar.position.set(nearX?(start+edge)/2:u,nearX?v:(start+edge)/2,-.08);bar.castShadow=true;support.add(bar);
    const earShape=roundedShape(.46,.46,.06);circularHole(earShape,0,0,.105);
    const ear=new THREE.Mesh(extrude(earShape,.10,.01),this.materials.silver);ear.position.set(u,v,-.14);support.add(ear);this.root.add(support);
    const nutShape=new THREE.Shape();for(let n=0;n<6;n++){const a=n*Math.PI/3,x=Math.cos(a)*.18,y=Math.sin(a)*.18;if(n===0)nutShape.moveTo(x,y);else nutShape.lineTo(x,y);}nutShape.closePath();circularHole(nutShape,0,0,.082);
    const nut=new THREE.Mesh(extrude(nutShape,.14,.008),this.materials.thread);nut.position.set(u,v,inside?.14:-.30);nut.castShadow=true;(inside?panel:support).add(nut);
  }
  makeFlap(def){
    const target=this.plates.get(def.to),owner=this.plates.get(def.from),[u,v]=target.face.screws[def.screw];
    const vertical=def.edge==='top',w=vertical?.84:1.14,h=vertical?1.14:.84;
    const center=vertical?new THREE.Vector3(u,1.50,.40):new THREE.Vector3(def.edge==='right'?1.50:-1.50,v,.40);
    const group=new THREE.Group();group.position.copy(center.applyQuaternion(target.orientation).add(target.base));group.quaternion.copy(target.orientation);
    const plate=new THREE.Mesh(extrude(roundedShape(w,h,.065),.08,.018),owner.mesh.material);plate.castShadow=plate.receiveShadow=true;group.add(plate);this.blockerMeshes.push(plate);
    // 縁の折り返しで、どの隣接パネルにつながるかを見せる。
    const bend=new THREE.Mesh(new THREE.BoxGeometry(vertical?w:.30,vertical?.30:h,.40),owner.mesh.material);
    bend.position.set(vertical?0:(def.edge==='right'?.45:-.45),vertical?.45:0,-.16);bend.castShadow=bend.receiveShadow=true;group.add(bend);this.blockerMeshes.push(bend);
    const markShape=new THREE.Shape();markShape.absarc(0,0,.12,0,Math.PI*2,false);const mark=new THREE.Mesh(new THREE.ShapeGeometry(markShape),new THREE.MeshBasicMaterial({color:owner.face.number%2?0x869199:0x77858d}));
    mark.position.set(vertical?0:(def.edge==='right'?-.26:.26),vertical?-.26:0,.108);group.add(mark);
    this.root.add(group);this.root.updateMatrixWorld(true);owner.group.attach(group);
  }
  resize(){
    const r=this.stage.getBoundingClientRect();this.width=r.width;this.height=r.height;this.resizeCanvas();this.camera.aspect=r.width/r.height;
    const vertical=Math.max(7.8,7.8/this.camera.aspect);this.cameraDistance=vertical/(2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2)));
    this.camera.position.set(0,0,this.cameraDistance);this.camera.updateProjectionMatrix();this.camera.lookAt(0,0,0);
  }
  bindInputs(){
    let down=null;
    this.listen('pointerdown',e=>{
      if(this.locked||e.button!==0||down)return;
      this.hoverPointer={x:e.clientX,y:e.clientY};
      down={id:e.pointerId,x:e.clientX,y:e.clientY,quaternion:this.targetQuaternion.clone(),target:this.pickScrew(e.clientX,e.clientY),moved:false};this.stage.setPointerCapture(e.pointerId);
    });
    this.listen('pointermove',e=>{
      this.hoverPointer={x:e.clientX,y:e.clientY};
      if(!down||e.pointerId!==down.id)return;const dx=e.clientX-down.x,dy=e.clientY-down.y;
      if(Math.hypot(dx,dy)>6){down.moved=true;this.stage.classList.add('dragging');
        const qx=new THREE.Quaternion().setFromAxisAngle(X,dy*.009),qy=new THREE.Quaternion().setFromAxisAngle(Y,dx*.009);
        this.targetQuaternion.copy(qx).multiply(qy).multiply(down.quaternion).normalize();this.onMove?.();
      }
    });
    this.listen('pointerup',e=>{
      if(!down||e.pointerId!==down.id)return;const d=down;down=null;this.stage.classList.remove('dragging');
      if(this.stage.hasPointerCapture(e.pointerId))this.stage.releasePointerCapture(e.pointerId);
      if(!d.moved&&d.target&&!this.inspectTarget&&this.visibleScrews.has(d.target))this.onPull?.(d.target);
    });
    const cancel=()=>{down=null;this.stage.classList.remove('dragging');};this.listen('pointercancel',cancel);this.listen('lostpointercapture',cancel);
    this.listen('pointerleave',()=>{this.hoverPointer=null;});
  }
  turn(angle){this.targetQuaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(Y,angle)).normalize();}
  resetView(){this.targetQuaternion.copy(this.homeQuaternion);}
  focusFace(id){
    const face=this.plates.get(id);if(!face)return;
    const angle=new THREE.Quaternion().setFromEuler(new THREE.Euler(.16,-.20,0));
    this.targetQuaternion.copy(angle).multiply(face.orientation.clone().invert());
  }
  focusScrew(id){
    const screw=this.screws.get(id);if(!screw)return;
    if(!screw.inside)this.focusFace(screw.plateId);
    // 内締めは開口部との位置関係が必要なので、元の視点を保つ。
  }
  setInspect(value){this.inspectTarget=value?1:0;}
  sync(board){
    for(const[id,p]of this.plates){p.fallen=board.getPlate(id).dropped;p.falling=false;p.group.visible=!p.fallen;p.group.position.copy(p.base);p.group.quaternion.copy(p.orientation);}
    for(const[id,s]of this.screws){s.pulled=board.getScrew(id).pulled;s.covered=board.isCovered(id);s.group.position.copy(s.base);s.group.quaternion.copy(s.mountRotation);s.group.scale.setScalar(1.30);s.spinning=false;s.group.visible=!s.pulled;}
  }
  async drop(id){
    const p=this.plates.get(id);p.falling=true;
    const start=p.group.position.clone();
    await this.animate(420,t=>{
      const q=1-(1-t)**3;p.group.position.copy(start).addScaledVector(p.normal,q*3.1);p.group.position.y-=t*t*1.2;
      p.group.quaternion.copy(p.orientation).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(q*.35,q*.25,q*.12)));
    });p.group.visible=false;p.fallen=true;p.falling=false;
  }
  worldPoint(s){return s.group.localToWorld(new THREE.Vector3(0,0,.19));}
  projectHead(id){const v=this.worldPoint(this.screws.get(id)).project(this.camera);return{x:(v.x+1)*this.width/2,y:(1-v.y)*this.height/2};}
  pickScrew(clientX,clientY){
    const rect=this.stage.getBoundingClientRect();
    return nearestScrew([...this.visibleScrews].map(id=>({id,...this.projectHead(id)})),clientX-rect.left,clientY-rect.top);
  }
  headFacing(s){const direction=Z.clone().applyQuaternion(s.group.getWorldQuaternion(new THREE.Quaternion()));return direction.dot(this.camera.position.clone().sub(this.worldPoint(s)).normalize());}
  facing(p){return p.normal.clone().applyQuaternion(this.root.quaternion).dot(this.camera.position.clone().sub(p.group.getWorldPosition(new THREE.Vector3())).normalize());}
  unobstructed(s,blockers){
    const point=this.worldPoint(s),direction=point.clone().sub(this.camera.position),distance=direction.length();this.raycaster.set(this.camera.position,direction.normalize());
    // 頭は板の表側または裏側の外にある。自分の板は頭の直近の誤判定から除く。
    const own=this.plates.get(s.plateId).mesh;
    this.raycaster.far=distance-.035;return this.raycaster.intersectObjects(blockers.filter(m=>m!==own),false).length===0;
  }
  frame(now){
    const dt=Math.min((now-this.lastTime)/1000,.05);this.lastTime=now;const blend=reduced?1:1-Math.exp(-13*dt);
    this.root.quaternion.slerp(this.targetQuaternion,blend);this.inspect+=(this.inspectTarget-this.inspect)*blend;this.camera.position.z=this.cameraDistance*(1+this.inspect*.30);
    for(const p of this.plates.values())if(!p.falling&&!p.fallen)p.group.position.copy(p.base).addScaledVector(p.normal,this.inspect*1.0);
    for(const s of this.screws.values())if(!s.spinning)s.group.visible=!s.pulled;
    for(let i=this.jobs.length-1;i>=0;i--){const j=this.jobs[i],t=clamp((now-j.start)/j.duration,0,1);j.update(t);if(t===1){this.jobs.splice(i,1);j.resolve();}}
    this.root.updateMatrixWorld(true);
    const blockers=this.blockerMeshes.filter(m=>{for(let o=m;o&&o!==this.root;o=o.parent)if(!o.visible)return false;return true;});
    this.visibleScrews.clear();
    for(const[id,s]of this.screws){
      if(!s.button)continue;const p=this.plates.get(s.plateId);
      const visible=!s.pulled&&!s.covered&&this.inspect<.08&&p.group.visible&&this.headFacing(s)>.04&&this.unobstructed(s,blockers);
      s.button.hidden=!visible;if(visible){this.visibleScrews.add(id);const pos=this.projectHead(id);s.button.style.transform=`translate3d(${pos.x}px,${pos.y}px,0) translate(-50%,-50%)`;}
    }
    const hovered=this.hoverPointer&&!this.locked&&this.inspect<.08?this.pickScrew(this.hoverPointer.x,this.hoverPointer.y):null;
    for(const[id,s]of this.screws)s.button?.classList.toggle('hovered',id===hovered);
    this.render();
  }
}
