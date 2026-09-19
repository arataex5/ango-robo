import { describe, expect, it } from 'vitest';
import { ALL_CODES, CARDS, codeStr } from './criteria';
import { enumerateWorlds, generateProblem, isValidProblem, machinePar, starsFor, verify } from './problem';
import { makeRng } from './rng';
import challenges from '../data/challenges.json';
import type { Problem } from './problem';

describe('要件カード', () => {
  it('48種あり、IDが連番', () => {
    expect(CARDS.length).toBe(48);
    CARDS.forEach((c, i) => expect(c.id).toBe(i + 1));
  });
  it('どの要件も「満たすコード」と「満たさないコード」の両方がある', () => {
    for (const card of CARDS)
      for (const cr of card.criteria) {
        const n = ALL_CODES.filter(([b, y, p]) => cr.test(b, y, p)).length;
        expect(n, `card ${card.id} ${cr.text}`).toBeGreaterThan(0);
        expect(n, `card ${card.id} ${cr.text}`).toBeLessThan(125);
      }
  });
  it('排他的なカード（1〜25）は、どのコードもちょうど1つの要件だけ満たす', () => {
    for (const card of CARDS.filter((c) => c.id <= 25 && ![14, 15].includes(c.id)))
      for (const [b, y, p] of ALL_CODES)
        expect(card.criteria.filter((cr) => cr.test(b, y, p)).length, `card ${card.id}`).toBe(1);
  });
});

describe('問題', () => {
  it('公式の入門問題1（カード4,9,11,14 → 241）が成立する', () => {
    const worlds = enumerateWorlds([4, 9, 11, 14]);
    expect(worlds.map((w) => codeStr(ALL_CODES[w.code]))).toContain('241');
  });
  it('生成した問題は唯一解で、どの検証機も不可欠', () => {
    const rng = makeRng(1);
    for (const d of ['easy', 'standard', 'hard'] as const)
      for (const n of [4, 5, 6]) {
        const p = generateProblem(rng, n, d);
        expect(p.cards.length).toBe(n);
        expect(isValidProblem(p)).toBe(true);
        // 正解コードは全検証機を通る
        p.cards.forEach((_, v) => expect(verify(p, v, p.code)).toBe(true));
        // 正解以外で全検証機を通るコードはない
        const pass = ALL_CODES.filter((c) => p.cards.every((_, v) => verify(p, v, c)));
        expect(pass.length).toBe(1);
        expect(p.par).toBeGreaterThanOrEqual(2);
      }
  });
  it('同じシードなら同じ問題になる', () => {
    expect(generateProblem(makeRng(42), 5, 'hard')).toEqual(generateProblem(makeRng(42), 5, 'hard'));
  });
  it('チャレンジ100問はすべて有効で par が一致する', () => {
    const list = challenges as unknown as Problem[];
    expect(list.length).toBe(100);
    for (const p of list) {
      expect(isValidProblem(p)).toBe(true);
      expect(machinePar(p.cards)).toBe(p.par);
    }
  });
  it('星評価', () => {
    expect(starsFor(4, 5)).toBe(3);
    expect(starsFor(5, 5)).toBe(3);
    expect(starsFor(7, 5)).toBe(2);
    expect(starsFor(8, 5)).toBe(1);
  });
});
