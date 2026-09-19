import { ALL_CODES, CARDS, cardById, type Code } from './criteria';
import { makeRng, type Rng } from './rng';

export type Difficulty = 'easy' | 'standard' | 'hard';

/** 1問の定義。cards[i] が検証機 i(A..F) の要件カード、secret[i] がその検証機が実際に見ている要件の番号 */
export interface Problem {
  cards: number[];
  secret: number[];
  code: Code;
  difficulty: Difficulty;
  /** マシンの記録（最適に質問するAIの検証数。参考表示用） */
  par: number;
  /** ☆3 / ☆2 をもらえる検証数の上限（人間のプレイを模したシミュレーションから算出） */
  star3?: number;
  star2?: number;
}

/** あり得る「世界」= 各検証機の要件の組合せ（唯一解＆全検証機が不可欠）とそのコード */
export interface World {
  crit: number[];
  code: number; // ALL_CODES の index
}

// ---- 125bit ビットセット（32bit × 4） ----
type Bits = [number, number, number, number];
const and = (a: Bits, b: Bits): Bits => [a[0] & b[0], a[1] & b[1], a[2] & b[2], a[3] & b[3]];
const isEmpty = (a: Bits) => (a[0] | a[1] | a[2] | a[3]) === 0;
const pop32 = (x: number) => {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
};
const popcount = (a: Bits) => pop32(a[0]) + pop32(a[1]) + pop32(a[2]) + pop32(a[3]);
const firstBit = (a: Bits) => {
  for (let i = 0; i < 4; i++) if (a[i] !== 0) return i * 32 + (31 - Math.clz32(a[i] & -a[i]));
  return -1;
};
const FULL: Bits = [-1, -1, -1, (1 << 29) - 1]; // 125 = 96 + 29

/** MASKS[cardId][critIdx] = その要件を満たすコード集合 */
const MASKS: Bits[][] = [];
for (const card of CARDS) {
  MASKS[card.id] = card.criteria.map((cr) => {
    const m: Bits = [0, 0, 0, 0];
    ALL_CODES.forEach(([b, y, p], i) => {
      if (cr.test(b, y, p)) m[i >> 5] |= 1 << (i & 31);
    });
    return m;
  });
}

export const satisfies = (cardId: number, critIdx: number, code: Code): boolean =>
  cardById(cardId).criteria[critIdx].test(code[0], code[1], code[2]);

/** カードの並びに対して成立し得る全ての世界を列挙 */
export function enumerateWorlds(cards: number[], requireEssential = true): World[] {
  const n = cards.length;
  const out: World[] = [];
  const pick: number[] = new Array(n).fill(0);
  const dfs = (i: number, acc: Bits) => {
    if (i === n) {
      if (popcount(acc) !== 1) return;
      // 不可欠チェック：どの1台を除いても解が一意に定まらないこと
      for (let skip = 0; requireEssential && skip < n; skip++) {
        let rest: Bits = FULL;
        for (let j = 0; j < n; j++) if (j !== skip) rest = and(rest, MASKS[cards[j]][pick[j]]);
        if (popcount(rest) === 1) return;
      }
      out.push({ crit: pick.slice(), code: firstBit(acc) });
      return;
    }
    const ms = MASKS[cards[i]];
    for (let c = 0; c < ms.length; c++) {
      const next = and(acc, ms[c]);
      if (isEmpty(next)) continue;
      pick[i] = c;
      dfs(i + 1, next);
    }
  };
  dfs(0, FULL);
  return out;
}

// ---- ソルバー：期待検証数が最小になる質問戦略（マシンの記録の算出用） ----

/** 世界の集合 S（ビットマスク, n<=30）に対する、最適戦略の「合計」検証数（= 期待値 × |S|） */
export function optimalExpectedQuestions(worlds: World[], cards: number[]): number {
  const n = worlds.length;
  if (n === 0) return 0;
  if (n > 30) return greedyExpectedQuestions(worlds, cards);

  // 質問(検証機v, 提案p) → Yes と答える世界の集合。重複は除去
  const splitSet = new Set<number>();
  for (let v = 0; v < cards.length; v++) {
    const ms = MASKS[cards[v]];
    for (let p = 0; p < 125; p++) {
      let yes = 0;
      for (let w = 0; w < n; w++) {
        const m = ms[worlds[w].crit[v]];
        if ((m[p >> 5] >>> (p & 31)) & 1) yes |= 1 << w;
      }
      splitSet.add(yes);
    }
  }
  const splits = [...splitSet];
  const codeOf = worlds.map((w) => w.code);
  const memo = new Map<number, number>();
  let budget = 400000;

  const solved = (s: number) => {
    let code = -1;
    for (let w = 0; w < n; w++) {
      if (!((s >>> w) & 1)) continue;
      if (code === -1) code = codeOf[w];
      else if (code !== codeOf[w]) return false;
    }
    return true;
  };

  const f = (s: number): number => {
    if (solved(s)) return 0;
    const hit = memo.get(s);
    if (hit !== undefined) return hit;
    const size = pop32(s);
    let best = Infinity;
    const seen = new Set<number>();
    for (const sp of splits) {
      const a = s & sp;
      const b = s & ~sp;
      if (a === 0 || b === 0) continue;
      const key = a < b ? a : b;
      if (seen.has(key)) continue;
      seen.add(key);
      if (--budget < 0) {
        // 予算切れ：均等分割に近いものを貪欲に
        const bal = size + greedyTotal(a) + greedyTotal(b);
        if (bal < best) best = bal;
        continue;
      }
      const total = size + f(a) + f(b);
      if (total < best) best = total;
    }
    memo.set(s, best);
    return best;
  };
  const greedyTotal = (s: number): number => {
    if (solved(s)) return 0;
    const size = pop32(s);
    let bestA = 0;
    let bestScore = Infinity;
    for (const sp of splits) {
      const a = s & sp;
      const b = s & ~sp;
      if (a === 0 || b === 0) continue;
      const score = Math.abs(pop32(a) - pop32(b));
      if (score < bestScore) {
        bestScore = score;
        bestA = a;
      }
    }
    return size + greedyTotal(bestA) + greedyTotal(s & ~bestA);
  };

  return f((1 << n) - 1) / n;
}

/** 世界が多すぎるときの近似（配列ベースの貪欲） */
function greedyExpectedQuestions(worlds: World[], cards: number[]): number {
  const rec = (ws: World[]): number => {
    if (ws.every((w) => w.code === ws[0].code)) return 0;
    let bestYes: World[] = [];
    let bestNo: World[] = [];
    let bestScore = Infinity;
    for (let v = 0; v < cards.length; v++) {
      const ms = MASKS[cards[v]];
      for (let p = 0; p < 125; p++) {
        const yes: World[] = [];
        const no: World[] = [];
        for (const w of ws) (((ms[w.crit[v]][p >> 5] >>> (p & 31)) & 1) ? yes : no).push(w);
        if (yes.length === 0 || no.length === 0) continue;
        const score = Math.abs(yes.length - no.length);
        if (score < bestScore) {
          bestScore = score;
          bestYes = yes;
          bestNo = no;
        }
      }
    }
    return ws.length + rec(bestYes) + rec(bestNo);
  };
  return rec(worlds) / worlds.length;
}

/**
 * 人間のプレイを模したシミュレーション。
 * - 1ラウンド = コードを1つ決め、答えがまだ読めない検証機に最大3回まで質問する（ルールどおり）
 * - コードの選び方：ランダムに k 個思いつき、その中で「役に立つ質問が多くできる」ものを選ぶ
 *   k=1 は気ままに選ぶ人、k が大きいほど慎重に選ぶ人
 * - 推理は「解は1つだけ」を使う（マシンと同じ知識）。違いは質問の選び方が最適ではないこと
 * 戻り値：解けるまでの平均検証数
 */
export function humanExpectedQuestions(cards: number[], k: number, samples = 24): number {
  const worlds = enumerateWorlds(cards, false);
  const n = worlds.length;
  if (n === 0) return 0;
  const nv = cards.length;
  const rng = makeRng(cards.reduce((a, c) => (a * 53 + c) >>> 0, k * 7919 + 1));
  const bit = (v: number, p: number, w: number) => {
    const m = MASKS[cards[v]][worlds[w].crit[v]];
    return (m[p >> 5] >>> (p & 31)) & 1;
  };
  const solved = (alive: number[]) => alive.every((w) => worlds[w].code === worlds[alive[0]].code);
  const useful = (alive: number[], v: number, p: number) => {
    const first = bit(v, p, alive[0]);
    for (let i = 1; i < alive.length; i++) if (bit(v, p, alive[i]) !== first) return true;
    return false;
  };
  const usefulCount = (alive: number[], p: number) => {
    let c = 0;
    for (let v = 0; v < nv; v++) if (useful(alive, v, p)) c++;
    return Math.min(c, 3);
  };

  let total = 0;
  const count = Math.min(samples, n);
  for (let s = 0; s < count; s++) {
    const truth = Math.floor((s * n) / count);
    let alive = worlds.map((_, i) => i);
    let q = 0;
    while (!solved(alive) && q < 60) {
      // コードを決める
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
        // 思いついたコードがどれも役に立たない → 役に立つコードを探す
        for (let p = 0; p < 125 && best < 0; p++) if (usefulCount(alive, p) > 0) best = p;
        if (best < 0) break;
      }
      // 同じコードで最大3回まで質問
      let asked = 0;
      const order = [...Array(nv).keys()].sort(() => rng.next() - 0.5);
      for (const v of order) {
        if (asked >= 3 || solved(alive)) break;
        if (!useful(alive, v, best)) continue;
        const a = bit(v, best, truth);
        alive = alive.filter((w) => bit(v, best, w) === a);
        asked++;
        q++;
      }
    }
    total += q;
  }
  return total / count;
}

/**
 * 「地道に確かめる人」のシミュレーション。
 * 「解は1つだけ」という裏読みを使わず、各検証機の要件を質問で1つずつ消していき、
 * 残った要件の組合せで成り立つコードが1つになったら解答する。
 */
export function directExpectedQuestions(cards: number[], k: number, samples = 24): number {
  const worlds = enumerateWorlds(cards); // 出題され得る正解の候補
  const n = worlds.length;
  if (n === 0) return 0;
  const nv = cards.length;
  const rng = makeRng(cards.reduce((a, c) => (a * 59 + c) >>> 0, k * 104729 + 3));
  const has = (m: Bits, p: number) => (m[p >> 5] >>> (p & 31)) & 1;
  let total = 0;
  const count = Math.min(samples, n);
  for (let s = 0; s < count; s++) {
    const truth = worlds[Math.floor((s * n) / count)];
    // remain[v] = まだ消えていない要件
    const remain = cards.map((c) => MASKS[c].map((_, i) => i));
    const candidates = () => {
      let acc: Bits = FULL;
      for (let v = 0; v < nv; v++) {
        const u: Bits = [0, 0, 0, 0];
        for (const i of remain[v]) {
          const m = MASKS[cards[v]][i];
          u[0] |= m[0]; u[1] |= m[1]; u[2] |= m[2]; u[3] |= m[3];
        }
        acc = and(acc, u);
      }
      return popcount(acc);
    };
    const useful = (v: number, p: number) => {
      const first = has(MASKS[cards[v]][remain[v][0]], p);
      return remain[v].some((i) => has(MASKS[cards[v]][i], p) !== first);
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
      for (let i = 0; i < k; i++) {
        const p = rng.int(0, 124);
        const sc = usefulCount(p);
        if (sc > bestScore) { bestScore = sc; best = p; }
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
        const a = has(MASKS[cards[v]][truth.crit[v]], best);
        remain[v] = remain[v].filter((i) => has(MASKS[cards[v]][i], best) === a);
        asked++;
        q++;
      }
    }
    total += q;
  }
  return total / count;
}

/**
 * マシンの記録（par）。
 * マシンは「解は1つだけ」という知識を使って、期待検証数が最小になるように質問するAI。
 * ただし「どの検証機も不可欠」という上級テクニックは使わない（人間がこれを使えばマシンに勝てる余地がある）。
 * その期待検証数を四捨五入した値を par とする。
 */
export function machinePar(cards: number[]): number {
  const worlds = enumerateWorlds(cards, false);
  return Math.max(2, Math.round(optimalExpectedQuestions(worlds, cards)));
}

// ---- 問題生成 ----

const RANGE: Record<Difficulty, [number, number]> = {
  easy: [1, 17], // 基本カードのみ
  standard: [1, 22], // 18〜22 を最低1枚含む
  hard: [1, 48], // 23〜48 を最低1枚含む
};
const MUST_FROM: Record<Difficulty, number> = { easy: 1, standard: 18, hard: 23 };

export function generateProblem(rng: Rng, nVerifiers: number, difficulty: Difficulty): Problem {
  const [lo, hi] = RANGE[difficulty];
  for (let tries = 0; tries < 5000; tries++) {
    const set = new Set<number>();
    set.add(rng.int(MUST_FROM[difficulty], hi));
    while (set.size < nVerifiers) set.add(rng.int(lo, hi));
    const cards = [...set].sort((a, b) => a - b);
    const worlds = enumerateWorlds(cards);
    if (worlds.length < 2 || worlds.length > 30) continue;
    const codes = new Set(worlds.map((w) => w.code));
    if (codes.size < 2) continue; // 質問なしで解けてしまう問題は除外
    const expected = optimalExpectedQuestions(worlds, cards);
    if (expected < 1.5) continue;
    const truth = worlds[rng.int(0, worlds.length - 1)];
    return {
      cards,
      secret: truth.crit,
      code: ALL_CODES[truth.code],
      difficulty,
      ...ratingFor(cards),
    };
  }
  throw new Error('問題を生成できませんでした');
}

/** 検証：提案コードが検証機 v の（秘密の）要件を満たすか */
export const verify = (problem: Problem, v: number, proposal: Code): boolean =>
  satisfies(problem.cards[v], problem.secret[v], proposal);

/** 問題データの整合性チェック（受信データやテスト用） */
export function isValidProblem(p: Problem): boolean {
  const worlds = enumerateWorlds(p.cards);
  return worlds.some(
    (w) => w.crit.every((c, i) => c === p.secret[i]) && ALL_CODES[w.code].every((d, i) => d === p.code[i]),
  );
}

export type Stars = 1 | 2 | 3;

/**
 * 評価基準（人間がプレイする想定）。
 * - 「地道に確かめる人」= 平均的なプレイヤーの検証数 H
 * - 「マシンと同じ推理ができる人」= 上級者の検証数 L
 * ☆3：L と H の中間以下（平均より上手）／ ☆2：H + 1 以下（平均的）／ ☆1：それ以上
 */
export function ratingFor(cards: number[]): { par: number; star3: number; star2: number } {
  const par = machinePar(cards);
  const skilled = humanExpectedQuestions(cards, 3);
  const average = directExpectedQuestions(cards, 2);
  const star3 = Math.max(par + 1, Math.round((skilled + average) / 2));
  const star2 = Math.max(star3 + 2, Math.round(average) + 1);
  return { par, star3, star2 };
}

const ratingCache = new Map<string, { star3: number; star2: number }>();
/** 問題の☆基準。古い保存データ（基準なし）はその場で計算する */
export function thresholds(p: Problem): { star3: number; star2: number } {
  if (p.star3 !== undefined && p.star2 !== undefined) return { star3: p.star3, star2: p.star2 };
  const key = p.cards.join(',');
  let hit = ratingCache.get(key);
  if (!hit) {
    hit = ratingFor(p.cards);
    ratingCache.set(key, hit);
  }
  return hit;
}

export const starsFor = (questions: number, p: Problem): Stars => {
  const t = thresholds(p);
  return questions <= t.star3 ? 3 : questions <= t.star2 ? 2 : 1;
};
