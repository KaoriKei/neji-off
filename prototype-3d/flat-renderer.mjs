// キューブと同じ金属・ビスを使う平面の導入ステージ。
import * as THREE from 'three';
import { MetalScene,roundedShape,extrude } from './renderer.mjs';

export class FlatScene extends MetalScene {
  buildBackdrop(){
    const plates=this.level.plates;
    const left=Math.min(...plates.map(p=>p.x)),right=Math.max(...plates.map(p=>p.x+p.w));
    const top=Math.min(...plates.map(p=>p.y)),bottom=Math.max(...plates.map(p=>p.y+p.h));
    const x=((left+right)/2-540)/120,y=(890-(top+bottom)/2)/120;
    this.boardWidth=(right-left)/120+.7;this.boardHeight=(bottom-top)/120+.7;
    const panel=new THREE.Mesh(extrude(roundedShape(this.boardWidth,this.boardHeight,.2),.14,.04),this.materials.dark);
    panel.position.set(x,y,-.35);panel.receiveShadow=true;this.root.add(panel);
    for(const dx of [-1,1])for(const dy of [-1,1]){
      const joint=new THREE.Mesh(new THREE.BoxGeometry(.15,.15,.12),this.materials.wood);
      joint.position.set(x+dx*(this.boardWidth/2-.18),y+dy*(this.boardHeight/2-.18),-.12);this.root.add(joint);
    }
    this.addContactShadow(this.boardWidth+1,this.boardHeight+1,x,y,-.43);
    this.root.position.set(-x,-y,0);
  }
  resize(){
    const r=this.stage.getBoundingClientRect();this.width=r.width;this.height=r.height;this.resizeCanvas();this.camera.aspect=r.width/r.height;
    // 説明は盤面の手前に浮かせ、ビスの頭には重ねない。
    const topSpace=104,contentHeight=Math.max(140,r.height-topSpace);
    const vertical=Math.max(this.boardHeight+1.1,(this.boardWidth+1.1)/(r.width/contentHeight))*r.height/contentHeight;
    this.cameraDistance=vertical/(2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2)));
    const offsetY=vertical*topSpace/(2*r.height);
    this.camera.position.set(0,offsetY,this.cameraDistance);this.camera.updateProjectionMatrix();this.camera.lookAt(0,offsetY,0);
  }
}
