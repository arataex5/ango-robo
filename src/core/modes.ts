// エクストリーム / ナイトメア モードの問題生成と評価基準。
// クラシックのロジック（problem.ts）はそのまま使い、ここでは2モード分だけを扱う。
import { ALL_CODES, cardById } from './criteria';
import {
  FULL,
  MASKS,
  and,
  directExpectedQuestions,
  enumerateWorlds,
  firstBit,
  generateProblem,
  humanExpectedQuestions,
  isEmpty,
  popcount,
  type Bits,
  type Difficulty,
  type Mode,
  type Problem,
} from './problem';
import { makeRng, type Rng } from './rng';

const has = (m: Bits, p: number) => (m[p >> 5] >>> (p & 31)) & 1;
const sameBits = (a: Bits, b: Bits) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];

// ---------- 共通：世界の上でのプレイ・シミュレーション ----------

interface WorldModel {
  nv: number; // 検証機の数
  n: number; // 世界の数
  codeOf(w: number): number;
  /** 世界 w で、検証機 v にコード p を見せたときの答え */
  bit(v: number, p: number, w: number): number;
}

/**
 * 推理は完ぺきだが、質問するコードは思いつき（k 個の中でいちばん役に立つもの）で選ぶ人の平均検証数。
 * 1ラウンド = 同じコードで最大3問。
 */
function simulate(m: WorldModel, k: number, samples: number, seed: number): number {
  if (m.n === 0) return 0;
  const rng = makeRng(seed);
  const solved = (alive: number[]) => {
    const c = m.codeOf(alive[0]);
    for (let i = 1; i < alive.length; i++) if (m.codeOf(alive[i]) !== c) return false;
    return true;
  };
  const useful = (alive: number[], v: number, p: number) => {
    const first = m.bit(v, p, alive[0]);
    for (let i = 1; i < alive.length; i++) if (m.bit(v, p, alive[i]) !== first) return true;
    return false;
  };
  const usefulCount = (alive: number[], p: number) => {
    let c = 0;
    for (let v = 0; v < m.nv && c < 3; v++) if (useful(alive, v, p)) c++;
    return c;
  };
  const count = Math.min(samples, m.n);
  let total = 0;
  for (let s = 0; s < count; s++) {
    const truth = Math.floor((s * m.n) / count);
    let alive = Array.from({ length: m.n }, (_, i) => i);
    let q = 0;
    while (!solved(alive) && q < 80) {
      let best = -1;
      let bestScore = 0;
      for (let i = 0; i < k; i++) {
        const p = rng.int(0, 124);
        const sc = usefulCount(alive, p);
        if (sc > bestScore) {
          bestScore = sc;
          best = p;
        }
      }
      if (best < 0) {
        for (let p = 0; p < 125 && best < 0; p++) if (usefulCount(alive, p) > 0) best = p;
        if (best < 0) break;
      }
      let asked = 0;
      const order = [...Array(m.nv).keys()].sort(() => rng.next() - 0.5);
      for (const v of order) {
        if (asked >= 3 || solved(alive)) break;
        if (!useful(alive, v, best)) continue;
        const a = m.bit(v, best, truth);
        alive = alive.filter((w) => m.bit(v, best, w) === a);
        asked++;
        q++;
      }
    }
    total += q;
  }
  return total / count;
}

/** 質問を「なるべく半々に分かれるもの」で選ぶAIの平均検証数（マシンの記録の算出用） */
function greedyExpected(m: WorldModel): number {
  const rec = (alive: number[]): number => {
    const c0 = m.codeOf(alive[0]);
    if (alive.every((w) => m.codeOf(w) === c0)) return 0;
    let bestYes: number[] = [];
    let bestNo: number[] = [];
    let bestScore = Infinity;
    for (let v = 0; v < m.nv; v++)
      for (let p = 0; p < 125; p++) {
        let yes = 0;
        for (const w of alive) yes += m.bit(v, p, w);
        if (yes === 0 || yes === alive.length) continue;
        const score = Math.abs(alive.length - 2 * yes);
        if (score < bestScore) {
          bestScore = score;
          bestYes = alive.filter((w) => m.bit(v, p, w) === 1);
          bestNo = alive.filter((w) => m.bit(v, p, w) === 0);
          if (score <= 1) break;
        }
      }
    if (bestScore === Infinity) return 0;
    return alive.length + rec(bestYes) + rec(bestNo);
  };
  return rec(Array.from({ length: m.n }, (_, i) => i)) / m.n;
}

const seedOf = (nums: number[], salt: number) => nums.reduce((a, c) => (a * 61 + c) >>> 0, salt);

// ---------- エクストリーム ----------

interface Option {
  idx: number; // secret に入れる通し番号（カード1の要件 → カード2の要件）
  mask: Bits;
}
/** 検証機ごとの選択肢（2枚のカードの要件。中身が同じ要件は1つにまとめる） */
function extremeOptions(cardsA: number[], cardsB: number[]): Option[][] {
  return cardsA.map((a, v) => {
    const opts: Option[] = [];
    [...MASKS[a], ...MASKS[cardsB[v]]].forEach((mask, idx) => {
      if (!opts.some((o) => sameBits(o.mask, mask))) opts.push({ idx, mask });
    });
    return opts;
  });
}

interface OptWorld {
  pick: number[]; // 検証機ごとの選択肢の番号
  code: number;
}
/** 唯一解＆全検証機が不可欠、となる選択肢の組合せを列挙 */
function enumerateOptionWorlds(opts: Option[][], limit: number): OptWorld[] | null {
  const n = opts.length;
  const out: OptWorld[] = [];
  const pick = new Array<number>(n).fill(0);
  let overflow = false;
  const dfs = (i: number, acc: Bits, size: number) => {
    if (overflow) return;
    if (i === n) {
      if (size !== 1) return;
      for (let skip = 0; skip < n; skip++) {
        let rest: Bits = FULL;
        for (let j = 0; j < n; j++) if (j !== skip) rest = and(rest, opts[j][pick[j]].mask);
        if (popcount(rest) === 1) return;
      }
      out.push({ pick: pick.slice(), code: firstBit(acc) });
      if (out.length > limit) overflow = true;
      return;
    }
    for (let c = 0; c < opts[i].length; c++) {
      const next = and(acc, opts[i][c].mask);
      if (isEmpty(next)) continue;
      const nsize = popcount(next);
      // この要件で候補が1つも減らないなら、この検証機は不要ということなので打ち切り
      if (nsize === size) continue;
      // 最後の1台より前にコードが確定するなら、残りの検証機が不要になるので打ち切り
      if (nsize === 1 && i < n - 1) continue;
      pick[i] = c;
      dfs(i + 1, next, nsize);
    }
  };
  dfs(0, FULL, 125);
  return overflow ? null : out;
}

const RANGE: Record<Difficulty, [number, number]> = { easy: [1, 17], standard: [1, 22], hard: [1, 48] };
const MUST_FROM: Record<Difficulty, number> = { easy: 1, standard: 18, hard: 23 };

function extremeRating(opts: Option[][], worlds: OptWorld[], seedNums: number[]) {
  const nv = opts.length;
  const model: WorldModel = {
    nv,
    n: worlds.length,
    codeOf: (w) => worlds[w].code,
    bit: (v, p, w) => has(opts[v][worlds[w].pick[v]].mask, p),
  };
  const par = Math.max(2, Math.round(greedyExpected(model)));
  const skilled = simulate(model, 3, 24, seedOf(seedNums, 11));
  const average = directOptions(opts, worlds, seedOf(seedNums, 13));
  const star3 = Math.max(par + 1, Math.round((skilled + average) / 2));
  const star2 = Math.max(star3 + 2, Math.round(average) + 1);
  return { par, star3, star2 };
}

/** 「地道に確かめる人」：検証機ごとに選択肢を1つずつ消し、成り立つコードが1つになるまで質問する */
function directOptions(opts: Option[][], worlds: OptWorld[], seed: number): number {
  const nv = opts.length;
  const rng = makeRng(seed);
  const count = Math.min(24, worlds.length);
  let total = 0;
  for (let s = 0; s < count; s++) {
    const truth = worlds[Math.floor((s * worlds.length) / count)];
    const remain = opts.map((o) => o.map((_, i) => i));
    const candidates = () => {
      let acc: Bits = FULL;
      for (let v = 0; v < nv; v++) {
        const u: Bits = [0, 0, 0, 0];
        for (const i of remain[v]) {
          const m = opts[v][i].mask;
          u[0] |= m[0];
          u[1] |= m[1];
          u[2] |= m[2];
          u[3] |= m[3];
        }
        acc = and(acc, u);
      }
      return popcount(acc);
    };
    const useful = (v: number, p: number) => {
      const first = has(opts[v][remain[v][0]].mask, p);
      return remain[v].some((i) => has(opts[v][i].mask, p) !== first);
    };
    const usefulCount = (p: number) => {
      let c = 0;
      for (let v = 0; v < nv; v++) if (useful(v, p)) c++;
      return Math.min(c, 3);
    };
    let q = 0;
    while (candidates() > 1 && q < 80) {
      let best = -1;
      let bestScore = 0;
      for (let i = 0; i < 2; i++) {
        const p = rng.int(0, 124);
        const sc = usefulCount(p);
        if (sc > bestScore) {
          bestScore = sc;
          best = p;
        }
      }
      if (best < 0) {
        for (let p = 0; p < 125 && best < 0; p++) if (usefulCount(p) > 0) best = p;
        if (best < 0) break;
      }
      let asked = 0;
      const order = [...Array(nv).keys()].sort(() => rng.next() - 0.5);
      for (const v of order) {
        if (asked >= 3 || candidates() <= 1) break;
        if (!useful(v, best)) continue;
        const a = has(opts[v][truth.pick[v]].mask, best);
        remain[v] = remain[v].filter((i) => has(opts[v][i].mask, best) === a);
        asked++;
        q++;
      }
    }
    total += q;
  }
  return total / count;
}

export function generateExtreme(rng: Rng, nVerifiers: number, difficulty: Difficulty): Problem {
  const [lo, hi] = RANGE[difficulty];
  for (let tries = 0; tries < 3000; tries++) {
    const set = new Set<number>();
    set.add(rng.int(MUST_FROM[difficulty], hi));
    while (set.size < nVerifiers * 2) set.add(rng.int(lo, hi));
    // シャッフルして2枚ずつ組にする
    const pool = [...set];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const pairs = Array.from({ length: nVerifiers }, (_, v) => [pool[2 * v], pool[2 * v + 1]].sort((a, b) => a - b));
    pairs.sort((a, b) => a[0] - b[0]);
    const cards = pairs.map((p) => p[0]);
    const cards2 = pairs.map((p) => p[1]);
    const opts = extremeOptions(cards, cards2);
    const worlds = enumerateOptionWorlds(opts, 400);
    if (!worlds || worlds.length < 2) continue;
    if (new Set(worlds.map((w) => w.code)).size < 2) continue;
    const truth = worlds[rng.int(0, worlds.length - 1)];
    return {
      mode: 'extreme',
      cards,
      cards2,
      secret: truth.pick.map((c, v) => opts[v][c].idx),
      code: ALL_CODES[truth.code],
      difficulty,
      ...extremeRating(opts, worlds, [...cards, ...cards2]),
    };
  }
  throw new Error('問題を生成できませんでした');
}

// ---------- ナイトメア ----------

function permutations(n: number): number[][] {
  const out: number[][] = [];
  const cur: number[] = [];
  const used = new Array<boolean>(n).fill(false);
  const rec = () => {
    if (cur.length === n) return void out.push(cur.slice());
    for (let i = 0; i < n; i++)
      if (!used[i]) {
        used[i] = true;
        cur.push(i);
        rec();
        cur.pop();
        used[i] = false;
      }
  };
  rec();
  return out;
}

/**
 * 「どの検証機がどのカードか分からない」ことで、検証数が何回ぶん増えるか。
 * 同じ推理力の人が、対応が分かっている場合／分からない場合でそれぞれ解く様子をシミュレーションして差を取る。
 */
function nightmareExtra(cards: number[]): number {
  const base = enumerateWorlds(cards);
  const nv = cards.length;
  const perms = permutations(nv);
  const P = perms.length;
  const known: WorldModel = {
    nv,
    n: base.length,
    codeOf: (w) => base[w].code,
    bit: (v, p, w) => has(MASKS[cards[v]][base[w].crit[v]], p),
  };
  const unknown: WorldModel = {
    nv,
    n: base.length * P,
    codeOf: (w) => base[(w / P) | 0].code,
    bit: (v, p, w) => {
      const b = base[(w / P) | 0];
      const i = perms[w % P][v];
      return has(MASKS[cards[i]][b.crit[i]], p);
    },
  };
  const a = simulate(known, 3, 24, seedOf(cards, 17));
  const b = simulate(unknown, 3, nv >= 6 ? 8 : 16, seedOf(cards, 19));
  return Math.max(2, b - a);
}

export function generateNightmare(rng: Rng, nVerifiers: number, difficulty: Difficulty): Problem {
  const base = generateProblem(rng, nVerifiers, difficulty);
  // 検証機とカードの対応をシャッフル（そのままの並びは避ける）
  let perm = base.cards.map((_, i) => i);
  for (let t = 0; t < 20; t++) {
    for (let i = perm.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    if (perm.some((c, v) => c !== v)) break;
    perm = perm.slice();
  }
  const extra = nightmareExtra(base.cards);
  // クラシックの基準（マシン／上級者／平均的な人）を、対応が不明なぶんだけ引き上げる。
  // 平均的な人は対応の見きわめにも手間どるので 1.5 倍ぶん上乗せする
  const skilled = humanExpectedQuestions(base.cards, 3) + extra;
  const average = directExpectedQuestions(base.cards, 2) + extra * 1.5;
  const par = Math.round(base.par + extra);
  const star3 = Math.max(par + 1, Math.round((skilled + average) / 2));
  const star2 = Math.max(star3 + 2, Math.round(average) + 1);
  return { ...base, mode: 'nightmare', perm, par, star3, star2 };
}

// ---------- 入口 ----------

export function generateAny(rng: Rng, mode: Mode, nVerifiers: number, difficulty: Difficulty): Problem {
  if (mode === 'extreme') return generateExtreme(rng, nVerifiers, difficulty);
  if (mode === 'nightmare') return generateNightmare(rng, nVerifiers, difficulty);
  return generateProblem(rng, nVerifiers, difficulty);
}

export const MODE_LABEL: Record<Mode, string> = { classic: 'クラシック', extreme: 'エクストリーム', nightmare: 'ナイトメア' };
export const modeOf = (p: Problem): Mode => p.mode ?? 'classic';

/** メモ欄の数：検証機（ナイトメアはカード）ごとの要件の個数 */
export function critCounts(p: Problem): number[] {
  if (modeOf(p) === 'extreme' && p.cards2)
    return p.cards.map((a, v) => cardById(a).criteria.length + cardById(p.cards2![v]).criteria.length);
  return p.cards.map((c) => cardById(c).criteria.length);
}
