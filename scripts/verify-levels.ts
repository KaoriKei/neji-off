// npm run verify — 全レベルの形式チェック＋解けるか＋最小仮置き数＋難易度の目安を検証する（開発時のみ）
import { LEVELS } from '../src/data/levels/index';
import { validateLevel } from '../src/game/Level';
import { greedyPolicy, minBuffer, randomPolicy, solve, stuckRate } from '../src/game/Solver';
import { bandOf } from './difficulty';

let ng = 0;
const rows: string[] = [];
rows.push('面 | 板 | ネジ | 色 | 穴 | 最小仮置き | 期待 | 素直詰み% | 期待 | でたらめ詰み% | 状態数 | 判定');
rows.push('---|---|---|---|---|---|---|---|---|---|---|---');

for (const lv of LEVELS) {
  const warns = validateLevel(lv);
  for (const w of warns) console.warn('⚠️ ' + w);
  if (warns.length > 0) ng++;

  const screws = lv.plates.reduce((n, p) => n + p.screws.length, 0);
  const colors = new Set(lv.plates.flatMap((p) => p.screws.map((s) => s.color))).size;
  const full = solve(lv);
  const mb = minBuffer(lv);
  const band = bandOf(lv.id);
  const g = stuckRate(lv, greedyPolicy, 400, 7);
  const r = stuckRate(lv, randomPolicy, 400, 7);
  const bufferSize = lv.bufferSize ?? 5;

  const problems: string[] = [];
  if (!full.solvable) problems.push(full.aborted ? '打ち切り' : '解けない');
  else if (mb.min === null) problems.push('最小仮置き算出不能');
  if (band) {
    if (bufferSize !== band.bufferSize) problems.push(`穴数${bufferSize}≠${band.bufferSize}`);
    if (mb.min !== null && (mb.min < band.minBuf[0] || mb.min > band.minBuf[1])) problems.push('最小仮置きが期待外');
    if (g < band.greedy[0] || g > band.greedy[1]) problems.push('素直詰み率が期待外');
  }
  if (problems.length > 0) ng++;

  const pct = (v: number): string => `${Math.round(v * 100)}`;
  rows.push(
    `${lv.id} | ${lv.plates.length} | ${screws} | ${colors} | ${bufferSize} | ${mb.min ?? '-'} | ${band ? `${band.minBuf[0]}〜${band.minBuf[1]}` : '-'} | ${pct(g)} | ${band ? `${pct(band.greedy[0])}〜${pct(band.greedy[1])}` : '-'} | ${pct(r)} | ${full.visited} | ${problems.length ? problems.join('・') : 'OK'}`,
  );
}

console.log(rows.join('\n'));
if (ng > 0) {
  console.error(`\n❌ ${ng} 件の問題あり`);
  process.exit(1);
}
console.log('\n✅ 全レベル合格');
