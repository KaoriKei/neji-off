import {describe,it,expect} from 'vitest';
import {nearestScrew} from '../prototype-3d/screw-hit.mjs';

describe('ビスの当たり範囲',()=>{
  it('44pxの当たり範囲が重なっても、頭の中心を狙えばそのビスを選ぶ',()=>{
    const heads=[{id:'B-0',x:100,y:100},{id:'B-2',x:116,y:109}];
    expect(nearestScrew(heads,100,100)).toBe('B-0');
    expect(nearestScrew([...heads].reverse(),100,100)).toBe('B-0');
    expect(nearestScrew(heads,116,109)).toBe('B-2');
  });
  it('頭の近くのタップは許容し、盤面の空白からは抜かない',()=>{
    const heads=[{id:'L-1',x:90,y:60}];
    expect(nearestScrew(heads,99,68)).toBe('L-1');
    expect(nearestScrew(heads,120,80)).toBeNull();
    expect(nearestScrew([],90,60)).toBeNull();
  });
});
