import { describe, expect, it } from 'vitest';
import { ALL_CODES, cardById } from './criteria';
import { critCounts, generateAny } from './modes';
import { secretOf, starsFor, verify, type Problem } from './problem';
import { makeRng } from './rng';
import extra from '../data/challenges-extra.json';

/** 各検証機が実際に見ている要件だけを使って、解が1つ・どの検証機も不可欠であることを確かめる */
function checkSound(p: Problem) {
  const n = p.cards.length;
  const passAll = (skip: number) => ALL_CODES.filter((c) => p.cards.every((_, v) => v === skip || verify(p, v, c)));
  const all = passAll(-1);
  expect(all.length).toBe(1);
  expect(all[0]).toEqual(p.code);
  for (let v = 0; v < n; v++) expect(passAll(v).length, `verifier ${v} は不可欠`).toBeGreaterThan(1);
}

describe('エクストリーム', () => {
  it('検証機ごとにカード2枚、唯一解で全検証機が不可欠', () => {
    const rng = makeRng(7);
    for (const d of ['easy', 'standard', 'hard'] as const)
      for (const n of [4, 5, 6]) {
        const p = generateAny(rng, 'extreme', n, d);
        expect(p.mode).toBe('extreme');
        expect(p.cards2!.length).toBe(n);
        expect(new Set([...p.cards, ...p.cards2!]).size).toBe(2 * n); // カードの重複なし
        p.cards.forEach((_, v) => {
          const s = secretOf(p, v);
          expect([p.cards[v], p.cards2![v]]).toContain(s.card);
          expect(s.crit).toBeLessThan(cardById(s.card).criteria.length);
        });
        expect(critCounts(p)).toEqual(p.cards.map((a, v) => cardById(a).criteria.length + cardById(p.cards2![v]).criteria.length));
        checkSound(p);
        expect(p.star2!).toBeGreaterThan(p.star3!);
      }
  });
});

describe('ナイトメア', () => {
  it('perm は並べ替えで、そのままの並びではない。唯一解で全検証機が不可欠', () => {
    const rng = makeRng(8);
    for (const n of [4, 5, 6]) {
      const p = generateAny(rng, 'nightmare', n, 'standard');
      expect(p.mode).toBe('nightmare');
      expect([...p.perm!].sort()).toEqual(p.cards.map((_, i) => i));
      expect(p.perm!.some((c, v) => c !== v)).toBe(true);
      p.cards.forEach((_, v) => expect(secretOf(p, v).card).toBe(p.cards[p.perm![v]]));
      checkSound(p);
    }
  });
  it('同じカードならクラシックより基準がゆるい', () => {
    const c = generateAny(makeRng(9), 'classic', 5, 'hard');
    const nm = generateAny(makeRng(9), 'nightmare', 5, 'hard');
    expect(nm.cards).toEqual(c.cards);
    expect(nm.star3!).toBeGreaterThan(c.star3!);
  });
});

describe('追加チャレンジ', () => {
  it('各30問がすべて有効', () => {
    const packs = extra as unknown as Record<string, Problem[]>;
    for (const mode of ['extreme', 'nightmare']) {
      expect(packs[mode].length).toBe(30);
      for (const p of packs[mode]) {
        expect(p.mode).toBe(mode);
        checkSound(p);
        expect(starsFor(1, p)).toBe(3);
      }
    }
  });
  it('同じシードなら同じ問題', () => {
    expect(generateAny(makeRng(1), 'extreme', 5, 'hard')).toEqual(generateAny(makeRng(1), 'extreme', 5, 'hard'));
    expect(generateAny(makeRng(1), 'nightmare', 5, 'hard')).toEqual(generateAny(makeRng(1), 'nightmare', 5, 'hard'));
  });
});
