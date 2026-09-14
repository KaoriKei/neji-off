// npm run verify — 全レベルの形式チェック＋解けるか＋最小仮置き数を検証する（開発時のみ）
import { LEVELS } from '../src/data/levels/index';
import { validateLevel } from '../src/game/Level';
import { minBuffer, solve } from '../src/game/Solver';

// 仕様 6.1 の「最小仮置き数」の許容範囲
const EXPECTED: Record<number, [number, number]> = {
  1: [0, 0], 2: [0, 0], 3: [0, 0], 4: [0, 0],
  5: [1, 2], 6: [1, 2],
  7: [2, 3], 8: [2, 3], 9: [2, 3],
  10: [3, 4],
};

let ng = 0;
const rows: string[] = [];
rows.push('面 | 板 | ネジ | 色 | 最小仮置き | 期待 | 手順長 | 状態数 | 判定');
rows.push('---|---|---|---|---|---|---|---|---');

for (const lv of LEVELS) {
  const warns = validateLevel(lv);
  for (const w of warns) console.warn('⚠️ ' + w);
  if (warns.length > 0) ng++;

  const screws = lv.plates.reduce((n, p) => n + p.screws.length, 0);
  const colors = new Set(lv.plates.flatMap((p) => p.screws.map((s) => s.color))).size;
  const full = solve(lv);
  const mb = minBuffer(lv);
  const exp = EXPECTED[lv.id];
  let verdict = 'OK';
  if (!full.solvable) {
    verdict = full.aborted ? '打ち切り' : '解けない';
    ng++;
  } else if (mb.min === null) {
    verdict = '最小仮置き算出不能';
    ng++;
  } else if (exp && (mb.min < exp[0] || mb.min > exp[1])) {
    verdict = `期待外(${exp[0]}〜${exp[1]})`;
    ng++;
  }
  rows.push(
    `${lv.id} | ${lv.plates.length} | ${screws} | ${colors} | ${mb.min ?? '-'} | ${exp ? `${exp[0]}〜${exp[1]}` : '-'} | ${full.moves.length} | ${full.visited} | ${verdict}`,
  );
}

console.log(rows.join('\n'));
if (ng > 0) {
  console.error(`\n❌ ${ng} 件の問題あり`);
  process.exit(1);
}
console.log('\n✅ 全レベル合格');
