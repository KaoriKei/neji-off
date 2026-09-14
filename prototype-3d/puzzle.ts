// 3D表示から独立した盤面。既存のルールとソルバーをそのまま使う。
import { Board } from '../src/game/Board';
import type { LevelDef } from '../src/game/Level';
import study from './layout-study.json';

export const LEVEL = study.level as LevelDef;
export const COLORS = {
  blue: { hex:'#008ebc', name:'青', mark:'●' },
  red: { hex:'#bc304f', name:'赤', mark:'◆' },
  yellow: { hex:'#7438b8', name:'紫', mark:'▲' },
  green: { hex:'#228536', name:'緑', mark:'■' },
} as const;

export class Puzzle {
  board: Board;
  history: Board[] = [];
  constructor(readonly level: LevelDef = LEVEL) { this.board = new Board(level); }
  pull(id: string) {
    if(!this.board.canPull(id).ok) return this.board.pull(id);
    this.history.push(this.board.clone());
    return this.board.pull(id);
  }
  undo() {
    const previous=this.history.pop();
    if(!previous)return false;
    this.board=previous;
    return true;
  }
  reset() { this.board=new Board(this.level); this.history=[]; }
}
