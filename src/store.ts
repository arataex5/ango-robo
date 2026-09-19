// localStorage への保存（プレイ履歴・チャレンジ記録・中断セーブ）
import type { Problem, Stars } from './core/problem';
import type { Session } from './game/session';

export interface Play {
  at: number;
  questions: number;
  rounds: number;
  solved: boolean;
  stars: Stars | 0;
}
export interface HistoryItem {
  id: string;
  createdAt: number;
  problem: Problem;
  plays: Play[];
}
export type ChallengeRecords = Record<number, { best: number; stars: Stars; plays: number }>;

export type SessionSource = { kind: 'endless'; historyId: string } | { kind: 'challenge'; index: number };
export interface SavedSession {
  source: SessionSource;
  session: Session;
}

const K = { history: 'ar.history.v1', challenge: 'ar.challenge.v1', session: 'ar.session.v1', name: 'ar.name.v1', endless: 'ar.endless.v1' };
const HISTORY_MAX = 200;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 容量超過などは無視 */
  }
}

export const loadHistory = () => read<HistoryItem[]>(K.history, []);
export function addHistoryItem(problem: Problem): HistoryItem {
  const item: HistoryItem = { id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`, createdAt: Date.now(), problem, plays: [] };
  write(K.history, [item, ...loadHistory()].slice(0, HISTORY_MAX));
  return item;
}
export function addPlay(historyId: string, play: Play) {
  write(
    K.history,
    loadHistory().map((h) => (h.id === historyId ? { ...h, plays: [...h.plays, play] } : h)),
  );
}
export function deleteHistoryItem(id: string) {
  write(K.history, loadHistory().filter((h) => h.id !== id));
}
export const bestPlay = (h: HistoryItem): Play | null =>
  h.plays.filter((p) => p.solved).sort((a, b) => a.questions - b.questions)[0] ?? null;

export const loadChallenge = () => read<ChallengeRecords>(K.challenge, {});
/** 記録を更新したら true */
export function recordChallenge(index: number, questions: number, stars: Stars): boolean {
  const all = loadChallenge();
  const prev = all[index];
  const improved = !prev || questions < prev.best;
  all[index] = { best: improved ? questions : prev.best, stars: improved ? stars : prev.stars, plays: (prev?.plays ?? 0) + 1 };
  write(K.challenge, all);
  return improved;
}

export const loadSession = () => read<SavedSession | null>(K.session, null);
export const saveSession = (s: SavedSession | null) => (s ? write(K.session, s) : localStorage.removeItem(K.session));

export const loadName = () => read<string>(K.name, '');
export const saveName = (n: string) => write(K.name, n);

export interface EndlessSettings {
  verifiers: 4 | 5 | 6;
  difficulty: Problem['difficulty'];
}
export const loadEndless = () => read<EndlessSettings>(K.endless, { verifiers: 4, difficulty: 'easy' });
export const saveEndless = (s: EndlessSettings) => write(K.endless, s);
