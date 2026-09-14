// 開発用：指定した面の「正解手順」「覆われているネジ1本」「詰ませる手順」を座標つきで JSON 出力する
// 使い方: npx tsx scripts/solution.ts 5
import { LEVELS } from '../src/data/levels/index';
import { Board } from '../src/game/Board';
import { solve } from '../src/game/Solver';

const n = Number(process.argv[2] ?? '1');
const lv = LEVELS.find((l) => l.id === n);
if (!lv) {
  console.error(`level ${n} not found`);
  process.exit(1);
}
const b = new Board(lv);
const pos = (id: string) => {
  const s = b.getScrew(id)!;
  return { id, x: s.x, y: s.y, color: s.color };
};
const sol = solve(lv);
const covered = b.allScrews().find((s) => b.isCovered(s.id));

// 詰ませる手順：状態を全探索して isStuck になる列を探す（仮置き場に入る手を優先）
function findStuck(): string[] | null {
  const seen = new Set<string>();
  const path: string[] = [];
  let visited = 0;
  const dfs = (bd: Board): boolean => {
    if (bd.isStuck()) return true;
    if (bd.isCleared()) return false;
    const key = bd.stateKey();
    if (seen.has(key)) return false;
    seen.add(key);
    if (++visited > 200000) return false;
    const moves = bd.pullableScrews();
    // 仮置き場行きを先に試す
    moves.sort((p, q) => {
      const cp = bd.findTray(bd.getScrew(p)!.color) < 0 ? 0 : 1;
      const cq = bd.findTray(bd.getScrew(q)!.color) < 0 ? 0 : 1;
      return cp - cq;
    });
    for (const m of moves) {
      const nb = bd.clone();
      nb.pull(m);
      path.push(m);
      if (dfs(nb)) return true;
      path.pop();
    }
    return false;
  };
  return dfs(b.clone()) ? [...path] : null;
}

const stuck = findStuck();
console.log(
  JSON.stringify({
    level: n,
    moves: sol.moves.map(pos),
    covered: covered ? pos(covered.id) : null,
    stuck: stuck ? stuck.map(pos) : null,
  }),
);
