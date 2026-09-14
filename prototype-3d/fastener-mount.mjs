import * as THREE from 'three';

// 頭の向き、軸の向き、抜く方向を同じ座標系で定義する。
export function mountFastener(group,{x,y,inside=false,scale=1.30,angle=0}){
  const side=inside?-1:1;
  group.position.set(x,y,inside?-.16:.15);
  group.rotation.set(inside?Math.PI:0,0,angle);
  group.scale.setScalar(scale);
  return{base:group.position.clone(),pullAxis:new THREE.Vector3(0,0,side),mountRotation:group.quaternion.clone(),inside};
}
