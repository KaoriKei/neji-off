// 立体のネジと一時置きからの移動で、同じ滑らかな軌道を使う。
export function flightPosition(from,to,t){
  const p=(1-Math.cos(Math.PI*t))/2,u=1-p;
  const arc=Math.min(100,Math.max(38,Math.hypot(to.x-from.x,to.y-from.y)*.22));
  return {
    x:u*u*from.x+2*u*p*(from.x+to.x)/2+p*p*to.x,
    y:u*u*from.y+2*u*p*(Math.min(from.y,to.y)-arc)+p*p*to.y,
    progress:p,
  };
}
