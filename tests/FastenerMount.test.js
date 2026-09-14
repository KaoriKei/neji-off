import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {mountFastener} from '../prototype-3d/fastener-mount.mjs';
import {FACES} from '../prototype-3d/cube-model';

describe('ビスを留める側と抜く方向',()=>{
  for(const inside of [false,true])it(`${inside?'内':'外'}締めの頭とねじ先が六面すべてで反対側にあり、抜くと板から離れる`,()=>{
    for(const face of FACES){
      const panel=new THREE.Group(),screw=new THREE.Group(),normal=new THREE.Vector3(...face.normal);
      panel.quaternion.setFromEuler(new THREE.Euler(...face.rotation));panel.position.copy(normal).multiplyScalar(1.95);panel.add(screw);
      const mount=mountFastener(screw,{x:.2,y:.3,inside,angle:.64}),center=panel.getWorldPosition(new THREE.Vector3());
      const side=point=>screw.localToWorld(point).sub(center).dot(normal);
      const head=side(new THREE.Vector3(0,0,.18)),tip=side(new THREE.Vector3(0,0,-.365));
      expect(inside?head<0:head>0).toBe(true);expect(inside?tip>0:tip<0).toBe(true);
      screw.position.copy(mount.base).addScaledVector(mount.pullAxis,.48);
      const removedHead=side(new THREE.Vector3(0,0,.18)),removedTip=side(new THREE.Vector3(0,0,-.365));
      expect(inside?removedHead<head:removedHead>head).toBe(true);
      // 抜き終わった先端も、頭と同じ側へ板を通り抜けている。
      expect(inside?removedTip<-.14:removedTip>.13).toBe(true);
    }
  });
});
