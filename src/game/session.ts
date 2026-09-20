import type { Code } from '../core/criteria';
import { verify, type Problem } from '../core/problem';

export interface Answer {
  v: number; // 検証機の番号 0..5
  ok: boolean;
}
export interface Round {
  proposal: Code;
  answers: Answer[];
}
/** メモの印：0=なし 1=× 2=○ */
export type Mark = 0 | 1 | 2;
export interface Notes {
  digits: Mark[][]; // [色][数字-1]
  crit: Mark[][]; // [検証機][要件]（エクストリームは2枚ぶん通し番号、ナイトメアは [カード][要件]）
  assign?: Mark[][]; // ナイトメア用：[カード][検証機]「このカードの担当はこのロボ？」のメモ
}
export interface Session {
  problem: Problem;
  rounds: Round[];
  roundOpen: boolean; // true の間は提案コードを変えられない
  draft: Code;
  notes: Notes;
  status: 'playing' | 'won' | 'lost';
  guess?: Code;
}

export const MAX_QUESTIONS_PER_ROUND = 3;

export function newSession(problem: Problem, critCounts: number[]): Session {
  return {
    problem,
    rounds: [],
    roundOpen: false,
    draft: [1, 1, 1],
    notes: {
      digits: [0, 1, 2].map(() => [0, 0, 0, 0, 0]),
      crit: critCounts.map((n) => new Array<Mark>(n).fill(0)),
      assign: problem.cards.map(() => new Array<Mark>(problem.cards.length).fill(0)),
    },
    status: 'playing',
  };
}

export const questionCount = (s: Session) => s.rounds.reduce((a, r) => a + r.answers.length, 0);
export const roundCount = (s: Session) => s.rounds.length;
export const currentRound = (s: Session): Round | null => (s.roundOpen ? s.rounds[s.rounds.length - 1] : null);

export function canAsk(s: Session, v: number): boolean {
  if (s.status !== 'playing') return false;
  const cur = currentRound(s);
  if (!cur) return true;
  return cur.answers.length < MAX_QUESTIONS_PER_ROUND && !cur.answers.some((a) => a.v === v);
}

/** 検証機 v に現在の提案コードを質問する */
export function ask(s: Session, v: number): Session {
  if (!canAsk(s, v)) return s;
  const rounds = s.rounds.map((r) => ({ ...r, answers: r.answers.slice() }));
  if (!s.roundOpen) rounds.push({ proposal: s.draft, answers: [] });
  const cur = rounds[rounds.length - 1];
  cur.answers.push({ v, ok: verify(s.problem, v, cur.proposal) });
  return { ...s, rounds, roundOpen: true };
}

export const endRound = (s: Session): Session => ({ ...s, roundOpen: false });

export function setDraft(s: Session, color: number, digit: number): Session {
  if (s.roundOpen || s.status !== 'playing') return s;
  const draft = s.draft.slice() as [number, number, number];
  draft[color] = digit;
  return { ...s, draft };
}

export function submitGuess(s: Session, guess: Code): Session {
  if (s.status !== 'playing') return s;
  const ok = guess.every((d, i) => d === s.problem.code[i]);
  return { ...s, roundOpen: false, guess, status: ok ? 'won' : 'lost' };
}

const cycle = (m: Mark): Mark => ((m + 1) % 3) as Mark;

export function toggleDigit(s: Session, color: number, digit: number): Session {
  const digits = s.notes.digits.map((row) => row.slice());
  digits[color][digit - 1] = cycle(digits[color][digit - 1]);
  return { ...s, notes: { ...s.notes, digits } };
}

export function toggleCrit(s: Session, v: number, idx: number): Session {
  const crit = s.notes.crit.map((row) => row.slice());
  crit[v][idx] = cycle(crit[v][idx]);
  return { ...s, notes: { ...s.notes, crit } };
}

export function toggleAssign(s: Session, card: number, v: number): Session {
  const n = s.problem.cards.length;
  const assign = (s.notes.assign ?? s.problem.cards.map(() => new Array<Mark>(n).fill(0))).map((row) => row.slice());
  assign[card][v] = cycle(assign[card][v]);
  return { ...s, notes: { ...s.notes, assign } };
}
