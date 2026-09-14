// 当たり範囲が重なっても、DOMの順番ではなく、狙った頭に近いビスを選ぶ。
export function nearestScrew(points,x,y,radius=22){
  let selected=null,distance=radius*radius;
  for(const point of points){
    const d=(point.x-x)**2+(point.y-y)**2;
    if(d<distance){selected=point.id;distance=d;}
  }
  return selected;
}
