import { Puzzle, COLORS } from './puzzle';
import type { LevelDef } from '../src/game/Level';
import study from './cube-study.json';
export { COLORS };
export { FACES, FLAPS } from './cube-model';
export const LEVEL=study.level as LevelDef;
export class CubePuzzle extends Puzzle { constructor(){super(LEVEL);} }
