// チャレンジモード用の固定100問を生成して src/data/challenges.json に書き出す。
// 実行: npx tsx scripts/gen-challenges.ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { makeRng } from '../src/core/rng';
import { generateProblem, type Difficulty, type Problem } from '../src/core/problem';

// レベル1〜10、各10問。だんだん検証機が増え、カードが難しくなる
const LEVELS: { n: number; d: Difficulty }[] = [
  { n: 4, d: 'easy' },
  { n: 4, d: 'easy' },
  { n: 4, d: 'standard' },
  { n: 5, d: 'easy' },
  { n: 5, d: 'standard' },
  { n: 4, d: 'hard' },
  { n: 6, d: 'standard' },
  { n: 5, d: 'hard' },
  { n: 6, d: 'hard' },
  { n: 6, d: 'hard' },
];

const rng = makeRng(20260920);
const seen = new Set<string>();
const out: Problem[] = [];
LEVELS.forEach((lv) => {
  let count = 0;
  while (count < 10) {
    const p = generateProblem(rng, lv.n, lv.d);
    const key = p.cards.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    count++;
  }
});
mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/challenges.json', JSON.stringify(out));
console.log('generated', out.length, 'par avg', (out.reduce((a, p) => a + p.par, 0) / out.length).toFixed(2));
