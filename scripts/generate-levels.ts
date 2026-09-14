// レベル自動生成（開発時のみ）。
// ランダムに板とネジを置き、形式チェック→ソルバー→難易度指標でふるいにかけて、目標帯に一番近い候補を書き出す。
// 使い方: npx tsx scripts/generate-levels.ts 3 4 5 --seed 1 --write
import fs from 'node:fs';
import path from 'node:path';
import {
  COLORS, PLATE_COLORS, validateLevel, distanceToRectEdge, inRect,
  type Color, type LevelDef, type PlateColor, type PlateDef,
} from '../src/game/Level';
import { greedyPolicy, minBuffer, mulberry32, randomPolicy, solve, stuckRate } from '../src/game/Solver';
import { BANDS, type DifficultyBand } from './difficulty';

const REGION = { x0: 70, y0: 380, x1: 1010, y1: 1460 };
const INSET = 64; // 自分の板のフチからネジ中心まで
const UPPER_MARGIN = 50; // 上の板のフチから（仕様は 40 以上）
const SCREW_GAP = 104; // ネジ同士の距離（ゴーストも含めて重ならないように）
const PLAYOUTS = 300;

type Rng = () => number;
const rint = (rng: Rng, lo: number, hi: number, step = 10): number => lo + Math.floor(rng() * (Math.floor((hi - lo) / step) + 1)) * step;
const pick = <T>(arr: T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)];
const shuffle = <T>(arr: T[], rng: Rng): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
type Rect = { x: number; y: number; w: number; h: number };
const overlapArea = (a: Rect, b: Rect): number => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

/** 板を z=0 から順に置く。上の板は下のどれかと 15〜85% 重なり、下の板を丸ごと隠さない */
function genPlates(n: number, rng: Rng, dense = false): PlateDef[] | null {
  const plates: PlateDef[] = [];
  const ids = 'ABCDEFGHIJ';
  for (let z = 0; z < n; z++) {
    let placed = false;
    for (let t = 0; t < 400 && !placed; t++) {
      const base = z === 0;
      const w = base ? rint(rng, dense ? 720 : 620, 920) : rint(rng, dense ? 380 : 320, dense ? 760 : 680);
      const h = base ? rint(rng, dense ? 520 : 440, dense ? 720 : 640) : rint(rng, dense ? 280 : 240, dense ? 560 : 500);
      const x = rint(rng, REGION.x0, REGION.x1 - w);
      const y = rint(rng, REGION.y0, REGION.y1 - h);
      const r = { x, y, w, h };
      if (z > 0) {
        let good = false;
        let bad = false;
        for (const p of plates) {
          const a = overlapArea(r, p);
          const frac = a / Math.min(w * h, p.w * p.h);
          if (frac >= 0.12 && frac <= 0.9) good = true;
          if (a >= p.w * p.h * 0.9) bad = true; // 下の板を丸ごと隠す
          // ほぼ同じ矩形（見分けがつかない）
          if (Math.abs(p.x - x) < 40 && Math.abs(p.y - y) < 40 && Math.abs(p.w - w) < 80 && Math.abs(p.h - h) < 80) bad = true;
        }
        if (!good || bad) continue;
      }
      plates.push({ id: ids[z], x, y, w, h, z, color: 'cream', screws: [] });
      placed = true;
    }
    if (!placed) return null;
  }
  // 板の色：重なる板同士は違う色に
  for (const p of plates) {
    const used = new Set<PlateColor>(plates.filter((q) => q.z < p.z && overlapArea(p, q) > 0).map((q) => q.color));
    const cands = PLATE_COLORS.filter((c) => !used.has(c));
    p.color = cands.length > 0 ? pick(cands, rng) : pick(PLATE_COLORS, rng);
  }
  return plates;
}

/** 板ごとに「ネジを置ける余地」を格子点で数え、置ける上限本数（1〜4）を出す */
function capacity(plates: PlateDef[]): number[] {
  return plates.map((p) => {
    const uppers = plates.filter((q) => q.z > p.z);
    let valid = 0;
    for (let x = p.x + INSET; x <= p.x + p.w - INSET; x += 40) {
      for (let y = p.y + INSET; y <= p.y + p.h - INSET; y += 40) {
        if (uppers.every((q) => distanceToRectEdge(x, y, q) >= UPPER_MARGIN)) valid++;
      }
    }
    // 1本あたりおよそ 9 格子点（≈ SCREW_GAP² ＋余裕）
    return Math.min(4, Math.floor(valid / 9));
  });
}

/** ネジ本数を板に配る（各 1〜cap 本） */
function distribute(total: number, caps: number[], rng: Rng): number[] | null {
  const plates = caps.length;
  if (caps.some((c) => c < 1)) return null;
  const capSum = caps.reduce((a, b) => a + b, 0);
  if (total < plates || total > capSum) return null;
  const counts = new Array<number>(plates).fill(1);
  let rest = total - plates;
  let guard = 0;
  while (rest > 0 && guard++ < 2000) {
    const i = Math.floor(rng() * plates);
    if (counts[i] < caps[i]) {
      counts[i]++;
      rest--;
    }
  }
  return rest === 0 ? counts : null;
}

/** ネジを置く。自分の板の内側、上の板のフチから離す、ネジ同士も離す。
 *  上の板ごとに「覆われるネジ」が最低1本できるよう、まず重なり領域に意図的に置く。 */
function genScrews(plates: PlateDef[], counts: number[], rng: Rng): boolean {
  const all: { x: number; y: number }[] = [];
  const coveredBy = new Set<string>(); // 既に下のネジを覆っている上の板
  const tryPlace = (p: PlateDef, uppers: PlateDef[], area: Rect, tries: number): boolean => {
    for (let t = 0; t < tries; t++) {
      const x = rint(rng, area.x, area.x + area.w);
      const y = rint(rng, area.y, area.y + area.h);
      if (x < p.x + INSET || x > p.x + p.w - INSET || y < p.y + INSET || y > p.y + p.h - INSET) continue;
      if (all.some((s) => Math.hypot(s.x - x, s.y - y) < SCREW_GAP)) continue;
      if (uppers.some((q) => distanceToRectEdge(x, y, q) < UPPER_MARGIN)) continue;
      p.screws.push({ x, y, color: 'red' });
      all.push({ x, y });
      for (const q of uppers) if (inRect(x, y, q)) coveredBy.add(q.id);
      return true;
    }
    return false;
  };
  for (const p of plates) {
    const uppers = plates.filter((q) => q.z > p.z);
    const own: Rect = { x: p.x + INSET, y: p.y + INSET, w: p.w - INSET * 2, h: p.h - INSET * 2 };
    // 1) まだ何も覆っていない上の板があれば、その重なり領域に置く
    for (const q of shuffle(uppers, rng)) {
      if (p.screws.length >= counts[p.z]) break;
      if (coveredBy.has(q.id)) continue;
      const ix = Math.max(own.x, q.x + UPPER_MARGIN);
      const iy = Math.max(own.y, q.y + UPPER_MARGIN);
      const ax = Math.min(own.x + own.w, q.x + q.w - UPPER_MARGIN);
      const ay = Math.min(own.y + own.h, q.y + q.h - UPPER_MARGIN);
      if (ax - ix < 20 || ay - iy < 20) continue;
      tryPlace(p, uppers, { x: ix, y: iy, w: ax - ix, h: ay - iy }, 60);
    }
    // 2) 残りはランダム
    while (p.screws.length < counts[p.z]) {
      if (!tryPlace(p, uppers, own, 500)) return false;
    }
  }
  return true;
}

/** 色を配る：各色 3 の倍数、合計 = ネジ本数 */
function assignColors(plates: PlateDef[], colorCount: number, rng: Rng): Color[] | null {
  const total = plates.reduce((n, p) => n + p.screws.length, 0);
  if (total % 3 !== 0) return null;
  const units = total / 3;
  if (units < colorCount) return null;
  const colors = shuffle(COLORS, rng).slice(0, colorCount);
  const perColor = new Array<number>(colorCount).fill(1);
  for (let i = 0; i < units - colorCount; i++) perColor[Math.floor(rng() * colorCount)]++;
  const bag: Color[] = [];
  colors.forEach((c, i) => {
    for (let k = 0; k < perColor[i] * 3; k++) bag.push(c);
  });
  const mixed = shuffle(bag, rng);
  let i = 0;
  for (const p of plates) for (const s of p.screws) s.color = mixed[i++];
  // トレイキュー：色ごとに 本数÷3 枚、順番はランダム
  const trays: Color[] = [];
  colors.forEach((c, k) => {
    for (let t = 0; t < perColor[k]; t++) trays.push(c);
  });
  return shuffle(trays, rng);
}

const STAGES = { plates: 0, counts: 0, screws: 0, cover: 0, colors: 0, validate: 0, unsolvable: 0, minBuf: 0, ok: 0 };
type Stage = keyof typeof STAGES;
const fail = (st: Stage): null => {
  STAGES[st]++;
  return null;
};

function genLevel(band: DifficultyBand, rng: Rng): LevelDef | null {
  const g = band.gen!;
  const plates = genPlates(g.plates, rng, g.screws / g.plates >= 3);
  if (!plates) return fail('plates');
  const counts = distribute(g.screws, capacity(plates), rng);
  if (!counts) return fail('counts');
  if (!genScrews(plates, counts, rng)) return fail('screws');
  // 上の板は必ず下のネジを1本以上覆う（飾りの板を作らない）
  for (const q of plates) {
    if (q.z === 0) continue;
    const covers = plates.some((p) => p.z < q.z && p.screws.some((s) => inRect(s.x, s.y, q)));
    if (!covers) return fail('cover');
  }
  const trays = assignColors(plates, g.colors, rng);
  if (!trays) return fail('colors');
  return { id: band.id, plates, trays, bufferSize: band.bufferSize };
}

interface Scored {
  level: LevelDef;
  minBuf: number;
  greedy: number;
  random: number;
  seed: number;
}

function evaluate(level: LevelDef, band: DifficultyBand, seed: number): Scored | null {
  if (validateLevel(level).length > 0) return fail('validate');
  const s = solve(level, { maxVisited: 400_000 });
  if (!s.solvable) return fail('unsolvable');
  const mb = minBuffer(level, { maxVisited: 400_000 }).min;
  if (mb === null || mb < band.minBuf[0] || mb > band.minBuf[1]) return fail('minBuf');
  STAGES.ok++;
  const greedy = stuckRate(level, greedyPolicy, PLAYOUTS, 7);
  const random = stuckRate(level, randomPolicy, PLAYOUTS, 7);
  return { level, minBuf: mb, greedy, random, seed };
}

function formatLevel(level: LevelDef): string {
  const json = JSON.stringify(level, null, 2);
  return json.replace(/\{\s+"x": (\d+),\s+"y": (\d+),\s+"color": "(\w+)"\s+\}/g, '{ "x": $1, "y": $2, "color": "$3" }') + '\n';
}

function generateFor(band: DifficultyBand, baseSeed: number, want = 12, maxAttempts = 40000): Scored | null {
  const center = (band.greedy[0] + band.greedy[1]) / 2;
  const inBand: Scored[] = [];
  let best: Scored | null = null;
  let attempts = 0;
  let evaluated = 0;
  for (let seed = baseSeed; attempts < maxAttempts && inBand.length < want; seed++, attempts++) {
    const rng = mulberry32(seed * 7919 + band.id * 104729);
    const lv = genLevel(band, rng);
    if (!lv) continue;
    const sc = evaluate(lv, band, seed);
    if (!sc) continue;
    evaluated++;
    const d = Math.abs(sc.greedy - center);
    if (!best || d < Math.abs(best.greedy - center)) best = sc;
    if (sc.greedy >= band.greedy[0] && sc.greedy <= band.greedy[1]) inBand.push(sc);
  }
  console.log(`  stages: ${JSON.stringify(STAGES)}`);
  for (const k of Object.keys(STAGES) as Stage[]) STAGES[k] = 0;
  const chosen = inBand.length > 0 ? inBand.sort((a, b) => Math.abs(a.greedy - center) - Math.abs(b.greedy - center))[0] : best;
  console.log(
    `level ${band.id}: attempts=${attempts} evaluated=${evaluated} inBand=${inBand.length}` +
      (chosen ? ` → seed=${chosen.seed} minBuf=${chosen.minBuf} greedy=${Math.round(chosen.greedy * 100)}% random=${Math.round(chosen.random * 100)}%` : ' → なし'),
  );
  return chosen;
}

// ---- CLI ----
const args = process.argv.slice(2);
const write = args.includes('--write');
const seedIdx = args.indexOf('--seed');
const baseSeed = seedIdx >= 0 ? Number(args[seedIdx + 1]) : 1;
const ids = args.filter((a) => /^\d+$/.test(a)).map(Number);
const targets = BANDS.filter((b) => b.gen && (ids.length === 0 || ids.includes(b.id)));

for (const band of targets) {
  const chosen = generateFor(band, baseSeed);
  if (!chosen) continue;
  if (write) {
    const file = path.join('src/data/levels', `${String(band.id).padStart(2, '0')}.json`);
    fs.writeFileSync(file, formatLevel(chosen.level));
    console.log(`  wrote ${file}`);
  }
}
