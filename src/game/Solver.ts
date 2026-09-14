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

// ---------- 難易度の目安（プレイアウト） ----------
// 「素直に打つ人」と「でたらめに打つ人」を何百回も遊ばせて、詰む確率を測る。
// 解けるかどうかだけでは分からない「引っかかりやすさ」の指標。

/** 再現できる乱数（seed が同じなら同じ列） */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Policy = (b: Board, rng: () => number) => string | null;

const pick = <T>(arr: T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)];

/** でたらめ：抜けるネジから均等に選ぶ */
export const randomPolicy: Policy = (b, rng) => {
  const m = b.pullableScrews();
  return m.length ? pick(m, rng) : null;
};

/** 素直：トレイに入るネジがあればそれ（3本目になるものを優先）、無ければ仕方なく仮置き */
export const greedyPolicy: Policy = (b, rng) => {
  const m = b.pullableScrews();
  if (m.length === 0) return null;
  const toTray = m.filter((id) => b.findTray(b.getScrew(id)!.color) >= 0);
  if (toTray.length > 0) {
    const completing = toTray.filter((id) => {
      const ti = b.findTray(b.getScrew(id)!.color);
      return (b.trayAt(ti)?.count ?? 0) === 2;
    });
    return pick(completing.length > 0 ? completing : toTray, rng);
  }
  return pick(m, rng);
};

export interface PlayoutResult {
  cleared: boolean;
  moves: number;
  /** 仮置き場の最大使用数 */
  peakBuffer: number;
}

/** 1回遊ばせる */
export function playout(level: LevelDef, policy: Policy, rng: () => number, bufferSize?: number): PlayoutResult {
  const b = new Board(level, { bufferSize });
  let moves = 0;
  let peak = 0;
  while (!b.isCleared() && !b.isStuck()) {
    const id = policy(b, rng);
    if (!id) break;
    const r = b.pull(id);
    if (!r.ok) break;
    moves++;
    peak = Math.max(peak, b.bufferUsed());
    if (moves > 200) break;
  }
  return { cleared: b.isCleared(), moves, peakBuffer: peak };
}

/** n 回遊ばせて詰む確率（0〜1） */
export function stuckRate(level: LevelDef, policy: Policy, n = 300, seed = 1, bufferSize?: number): number {
  const rng = mulberry32(seed);
  let stuck = 0;
  for (let i = 0; i < n; i++) if (!playout(level, policy, rng, bufferSize).cleared) stuck++;
  return stuck / n;
}
