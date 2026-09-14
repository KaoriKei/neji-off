// レベル検証用の探索（開発時のみ使用）。Phaser に依存しない。
// - solve(): 正解手順が存在するか（存在すれば手順を返す）
// - minBuffer(): 解くのに必要な仮置き場の最小穴数

import { Board } from './Board';
import { DEFAULT_BUFFER, type LevelDef } from './Level';

export interface SolveResult {
  solvable: boolean;
  /** 抜いたネジIDの順（解けた場合） */
  moves: string[];
  /** 訪れた状態数 */
  visited: number;
  /** 探索上限に達して打ち切った */
  aborted: boolean;
}

export function solve(level: LevelDef, opts: { bufferSize?: number; maxVisited?: number } = {}): SolveResult {
  const maxVisited = opts.maxVisited ?? 3_000_000;
  const root = new Board(level, { bufferSize: opts.bufferSize });
  const seen = new Set<string>();
  const path: string[] = [];
  let visited = 0;
  let aborted = false;

  const dfs = (b: Board): boolean => {
    if (b.isCleared()) return true;
    if (aborted) return false;
    const key = b.stateKey();
    if (seen.has(key)) return false;
    seen.add(key);
    visited++;
    if (visited > maxVisited) {
      aborted = true;
      return false;
    }

    // 同じ板・同じ色のネジは入れ替え可能なので1本だけ試す
    const tried = new Set<string>();
    for (const sid of b.pullableScrews()) {
      const s = b.getScrew(sid)!;
      const mk = `${s.plateId}:${s.color}`;
      if (tried.has(mk)) continue;
      tried.add(mk);

      const nb = b.clone();
      const r = nb.pull(sid);
      if (!r.ok) continue;
      path.push(sid);
      if (dfs(nb)) return true;
      path.pop();
    }
    return false;
  };

  const solvable = dfs(root);
  return { solvable, moves: solvable ? [...path] : [], visited, aborted };
}

export interface MinBufferResult {
  /** 最小仮置き数。解けなければ null */
  min: number | null;
  /** 各穴数での結果 */
  byBuffer: { bufferSize: number; solvable: boolean; visited: number; aborted: boolean }[];
}

/** 仮置き場の穴数を 0 から順に増やし、最初に解ける穴数を返す */
export function minBuffer(level: LevelDef, opts: { maxBuffer?: number; maxVisited?: number } = {}): MinBufferResult {
  const maxBuffer = opts.maxBuffer ?? level.bufferSize ?? DEFAULT_BUFFER;
  const byBuffer: MinBufferResult['byBuffer'] = [];
  for (let n = 0; n <= maxBuffer; n++) {
    const r = solve(level, { bufferSize: n, maxVisited: opts.maxVisited });
    byBuffer.push({ bufferSize: n, solvable: r.solvable, visited: r.visited, aborted: r.aborted });
    if (r.solvable) return { min: n, byBuffer };
  }
  return { min: null, byBuffer };
}
