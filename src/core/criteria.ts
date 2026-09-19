// 要件カード（全48種）の定義。
// テキスト中の {B} {Y} {P} は UI 側で 青▲ / 黄■ / 紫● のアイコンに置き換える。

export type Code = readonly [number, number, number]; // [青, 黄, 紫] 各1..5

export interface Criterion {
  text: string;
  test: (b: number, y: number, p: number) => boolean;
}

export interface Card {
  id: number; // 1..48
  title: string;
  criteria: Criterion[];
}

type ColorKey = 'B' | 'Y' | 'P';
const COLORS: ColorKey[] = ['B', 'Y', 'P'];
const tok = (c: ColorKey) => `{${c}}`;
const val = (c: ColorKey, b: number, y: number, p: number) => (c === 'B' ? b : c === 'Y' ? y : p);

const C = (text: string, test: Criterion['test']): Criterion => ({ text, test });

/** 色 c を 数値 n と比較（<, =, >） */
const cmpNum = (c: ColorKey, n: number, ops: string = '<=>'): Criterion[] =>
  [...ops].map((op) =>
    C(`${tok(c)} ${op} ${n}`, (b, y, p) => {
      const v = val(c, b, y, p);
      return op === '<' ? v < n : op === '=' ? v === n : v > n;
    }),
  );

/** 色 c1 を 色 c2 と比較 */
const cmpCol = (c1: ColorKey, c2: ColorKey): Criterion[] =>
  [...'<=>'].map((op) =>
    C(`${tok(c1)} ${op} ${tok(c2)}`, (b, y, p) => {
      const v1 = val(c1, b, y, p);
      const v2 = val(c2, b, y, p);
      return op === '<' ? v1 < v2 : op === '=' ? v1 === v2 : v1 > v2;
    }),
  );

const parity = (c: ColorKey): Criterion[] => [
  C(`${tok(c)} は偶数`, (b, y, p) => val(c, b, y, p) % 2 === 0),
  C(`${tok(c)} は奇数`, (b, y, p) => val(c, b, y, p) % 2 === 1),
];

const countOf = (n: number): Criterion[] =>
  [0, 1, 2, 3].map((k) =>
    C(`「${n}」が ${k}個`, (b, y, p) => [b, y, p].filter((v) => v === n).length === k),
  );

const others = (c: ColorKey) => COLORS.filter((x) => x !== c);

/** 色 c が他の2色すべてに対して rel の関係（最小/最大） */
const extreme = (c: ColorKey, rel: '<' | '>' | '<=' | '>='): Criterion => {
  const [o1, o2] = others(c);
  const label =
    rel === '<' ? 'だけが最小' : rel === '>' ? 'だけが最大' : rel === '<=' ? 'が最小（同値OK）' : 'が最大（同値OK）';
  return C(`${tok(c)} ${label}`, (b, y, p) => {
    const v = val(c, b, y, p);
    const a = val(o1, b, y, p);
    const d = val(o2, b, y, p);
    return rel === '<' ? v < a && v < d : rel === '>' ? v > a && v > d : rel === '<=' ? v <= a && v <= d : v >= a && v >= d;
  });
};

const evens = (b: number, y: number, p: number) => [b, y, p].filter((v) => v % 2 === 0).length;
const distinct = (b: number, y: number, p: number) => new Set([b, y, p]).size;

/** 昇順の連番の最長の長さ（1,2,3）。desc=true なら降順も数える */
const runLen = (b: number, y: number, p: number, desc: boolean): number => {
  const up1 = y - b === 1;
  const up2 = p - y === 1;
  const dn1 = desc && b - y === 1;
  const dn2 = desc && y - p === 1;
  if ((up1 && up2) || (dn1 && dn2)) return 3;
  if (up1 || up2 || dn1 || dn2) return 2;
  return 1;
};

const pairSum = (c1: ColorKey, c2: ColorKey, n: number): Criterion =>
  C(`${tok(c1)} + ${tok(c2)} = ${n}`, (b, y, p) => val(c1, b, y, p) + val(c2, b, y, p) === n);

export const CARDS: Card[] = [
  { id: 1, title: '青を1と比べる', criteria: cmpNum('B', 1, '=>') },
  { id: 2, title: '青を3と比べる', criteria: cmpNum('B', 3) },
  { id: 3, title: '黄を3と比べる', criteria: cmpNum('Y', 3) },
  { id: 4, title: '黄を4と比べる', criteria: cmpNum('Y', 4) },
  { id: 5, title: '青の偶奇', criteria: parity('B') },
  { id: 6, title: '黄の偶奇', criteria: parity('Y') },
  { id: 7, title: '紫の偶奇', criteria: parity('P') },
  { id: 8, title: '「1」の個数', criteria: countOf(1) },
  { id: 9, title: '「3」の個数', criteria: countOf(3) },
  { id: 10, title: '「4」の個数', criteria: countOf(4) },
  { id: 11, title: '青と黄を比べる', criteria: cmpCol('B', 'Y') },
  { id: 12, title: '青と紫を比べる', criteria: cmpCol('B', 'P') },
  { id: 13, title: '黄と紫を比べる', criteria: cmpCol('Y', 'P') },
  { id: 14, title: 'どの色だけが最小か', criteria: COLORS.map((c) => extreme(c, '<')) },
  { id: 15, title: 'どの色だけが最大か', criteria: COLORS.map((c) => extreme(c, '>')) },
  {
    id: 16,
    title: '偶数と奇数どちらが多いか',
    criteria: [
      C('偶数の方が多い', (b, y, p) => evens(b, y, p) >= 2),
      C('奇数の方が多い', (b, y, p) => evens(b, y, p) <= 1),
    ],
  },
  {
    id: 17,
    title: '偶数の個数',
    criteria: [0, 1, 2, 3].map((k) => C(`偶数が ${k}個`, (b, y, p) => evens(b, y, p) === k)),
  },
  {
    id: 18,
    title: '合計の偶奇',
    criteria: [
      C('合計が偶数', (b, y, p) => (b + y + p) % 2 === 0),
      C('合計が奇数', (b, y, p) => (b + y + p) % 2 === 1),
    ],
  },
  {
    id: 19,
    title: '青＋黄を6と比べる',
    criteria: [
      C('{B} + {Y} < 6', (b, y) => b + y < 6),
      C('{B} + {Y} = 6', (b, y) => b + y === 6),
      C('{B} + {Y} > 6', (b, y) => b + y > 6),
    ],
  },
  {
    id: 20,
    title: '同じ数字のくり返し',
    criteria: [
      C('3つとも同じ数字', (b, y, p) => distinct(b, y, p) === 1),
      C('2つだけ同じ数字', (b, y, p) => distinct(b, y, p) === 2),
      C('ぜんぶ違う数字', (b, y, p) => distinct(b, y, p) === 3),
    ],
  },
  {
    id: 21,
    title: 'ペアがあるか',
    criteria: [
      C('ペアなし（2つだけ同じ、ではない）', (b, y, p) => distinct(b, y, p) !== 2),
      C('ペアあり（2つだけ同じ）', (b, y, p) => distinct(b, y, p) === 2),
    ],
  },
  {
    id: 22,
    title: '並びの順序',
    criteria: [
      C('昇順（{B} < {Y} < {P}）', (b, y, p) => b < y && y < p),
      C('降順（{B} > {Y} > {P}）', (b, y, p) => b > y && y > p),
      C('昇順でも降順でもない', (b, y, p) => !(b < y && y < p) && !(b > y && y > p)),
    ],
  },
  {
    id: 23,
    title: '合計を6と比べる',
    criteria: [
      C('合計 < 6', (b, y, p) => b + y + p < 6),
      C('合計 = 6', (b, y, p) => b + y + p === 6),
      C('合計 > 6', (b, y, p) => b + y + p > 6),
    ],
  },
  {
    id: 24,
    title: '昇順の連番',
    criteria: [
      C('昇順の連番が3つ（例 2-3-4）', (b, y, p) => runLen(b, y, p, false) === 3),
      C('昇順の連番が2つ（例 2-3）', (b, y, p) => runLen(b, y, p, false) === 2),
      C('昇順の連番なし', (b, y, p) => runLen(b, y, p, false) === 1),
    ],
  },
  {
    id: 25,
    title: '昇順・降順の連番',
    criteria: [
      C('連番なし', (b, y, p) => runLen(b, y, p, true) === 1),
      C('連番が2つ（昇順/降順）', (b, y, p) => runLen(b, y, p, true) === 2),
      C('連番が3つ（昇順/降順）', (b, y, p) => runLen(b, y, p, true) === 3),
    ],
  },
  { id: 26, title: 'どれかの色が3より小さい', criteria: COLORS.map((c) => cmpNum(c, 3, '<')[0]) },
  { id: 27, title: 'どれかの色が4より小さい', criteria: COLORS.map((c) => cmpNum(c, 4, '<')[0]) },
  { id: 28, title: 'どれかの色が1', criteria: COLORS.map((c) => cmpNum(c, 1, '=')[0]) },
  { id: 29, title: 'どれかの色が3', criteria: COLORS.map((c) => cmpNum(c, 3, '=')[0]) },
  { id: 30, title: 'どれかの色が4', criteria: COLORS.map((c) => cmpNum(c, 4, '=')[0]) },
  { id: 31, title: 'どれかの色が1より大きい', criteria: COLORS.map((c) => cmpNum(c, 1, '>')[0]) },
  { id: 32, title: 'どれかの色が3より大きい', criteria: COLORS.map((c) => cmpNum(c, 3, '>')[0]) },
  { id: 33, title: 'どれかの色の偶奇', criteria: COLORS.flatMap((c) => parity(c)) },
  { id: 34, title: 'どの色が最小か（同値OK）', criteria: COLORS.map((c) => extreme(c, '<=')) },
  { id: 35, title: 'どの色が最大か（同値OK）', criteria: COLORS.map((c) => extreme(c, '>=')) },
  {
    id: 36,
    title: '合計の倍数',
    criteria: [3, 4, 5].map((n) => C(`合計が ${n}の倍数`, (b, y, p) => (b + y + p) % n === 0)),
  },
  {
    id: 37,
    title: '2色の合計が4',
    criteria: [pairSum('B', 'Y', 4), pairSum('B', 'P', 4), pairSum('Y', 'P', 4)],
  },
  {
    id: 38,
    title: '2色の合計が6',
    criteria: [pairSum('B', 'Y', 6), pairSum('B', 'P', 6), pairSum('Y', 'P', 6)],
  },
  { id: 39, title: 'どれかの色を1と比べる', criteria: COLORS.flatMap((c) => cmpNum(c, 1, '=>')) },
  { id: 40, title: 'どれかの色を3と比べる', criteria: COLORS.flatMap((c) => cmpNum(c, 3)) },
  { id: 41, title: 'どれかの色を4と比べる', criteria: COLORS.flatMap((c) => cmpNum(c, 4)) },
  {
    id: 42,
    title: 'どの色だけが最小/最大か',
    criteria: [...COLORS.map((c) => extreme(c, '<')), ...COLORS.map((c) => extreme(c, '>'))],
  },
  { id: 43, title: '青を他の色と比べる', criteria: [...cmpCol('B', 'Y'), ...cmpCol('B', 'P')] },
  { id: 44, title: '黄を他の色と比べる', criteria: [...cmpCol('Y', 'B'), ...cmpCol('Y', 'P')] },
  { id: 45, title: '「1」か「3」の個数', criteria: [...countOf(1), ...countOf(3)] },
  { id: 46, title: '「3」か「4」の個数', criteria: [...countOf(3), ...countOf(4)] },
  { id: 47, title: '「1」か「4」の個数', criteria: [...countOf(1), ...countOf(4)] },
  {
    id: 48,
    title: '2つの色を比べる',
    criteria: [...cmpCol('B', 'Y'), ...cmpCol('B', 'P'), ...cmpCol('Y', 'P')],
  },
];

export const cardById = (id: number): Card => {
  const c = CARDS[id - 1];
  if (!c || c.id !== id) throw new Error(`unknown card ${id}`);
  return c;
};

/** 全125コード。index = (b-1)*25 + (y-1)*5 + (p-1) */
export const ALL_CODES: Code[] = [];
for (let b = 1; b <= 5; b++) for (let y = 1; y <= 5; y++) for (let p = 1; p <= 5; p++) ALL_CODES.push([b, y, p]);

export const codeIndex = (c: Code) => (c[0] - 1) * 25 + (c[1] - 1) * 5 + (c[2] - 1);
export const codeStr = (c: Code) => `${c[0]}${c[1]}${c[2]}`;
