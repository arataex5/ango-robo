// エクストリーム／ナイトメアのチャレンジ（各30問）を生成して src/data/challenges-extra.json に書き出す。
// 実行: npx tsx scripts/gen-challenges-extra.ts
import { writeFileSync } from 'node:fs';
import { generateAny } from '../src/core/modes';
import type { Difficulty, Mode, Problem } from '../src/core/problem';
import { makeRng } from '../src/core/rng';

const LEVELS: { n: number; d: Difficulty }[] = [
  { n: 4, d: 'easy' },
  { n: 5, d: 'standard' },
  { n: 5, d: 'hard' },
];
const out: Record<string, Problem[]> = {};
for (const [mode, seed] of [['extreme', 20260921], ['nightmare', 20260922]] as [Mode, number][]) {
  const rng = makeRng(seed);
  const seen = new Set<string>();
  const list: Problem[] = [];
  for (const lv of LEVELS) {
    let count = 0;
    while (count < 10) {
      const p = generateAny(rng, mode, lv.n, lv.d);
      const key = [...p.cards, ...(p.cards2 ?? [])].join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(p);
      count++;
    }
  }
  out[mode] = list;
  console.log(mode, list.length, '☆3 avg', (list.reduce((a, p) => a + p.star3!, 0) / list.length).toFixed(1));
}
writeFileSync('src/data/challenges-extra.json', JSON.stringify(out));
