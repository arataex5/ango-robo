// オンライン対戦のルーム状態（ホストが唯一の正）。純粋関数なのでテスト可能。
import type { Code } from '../core/criteria';
import type { Difficulty, Problem } from '../core/problem';

export const MAX_PLAYERS = 4;

export interface PlayerInfo {
  id: string;
  name: string;
  status: 'active' | 'eliminated' | 'left';
  done: boolean; // このラウンドの宣言を済ませたか
  questions: number;
  guess: Code | null; // このラウンドで解答したコード（パスなら null）
}
export interface RoomSettings {
  verifiers: 4 | 5 | 6;
  difficulty: Difficulty;
}
export interface RoomState {
  phase: 'lobby' | 'playing' | 'finished';
  settings: RoomSettings;
  players: PlayerInfo[];
  hostId: string;
  gameNo: number;
  round: number;
  problem: Problem | null;
  winners: string[]; // finished 時。空なら勝者なし
  lastEliminated: string[]; // 直前のラウンドで脱落した人
}

export type RoomEvent =
  | { type: 'join'; id: string; name: string }
  | { type: 'leave'; id: string }
  | { type: 'settings'; settings: RoomSettings }
  | { type: 'start'; problem: Problem }
  | { type: 'roundDone'; id: string; gameNo: number; round: number; questions: number; guess: Code | null }
  | { type: 'toLobby' };

export const initialRoom = (hostId: string, hostName: string): RoomState => ({
  phase: 'lobby',
  settings: { verifiers: 4, difficulty: 'easy' },
  players: [{ id: hostId, name: hostName, status: 'active', done: false, questions: 0, guess: null }],
  hostId,
  gameNo: 0,
  round: 1,
  problem: null,
  winners: [],
  lastEliminated: [],
});

const sameCode = (a: Code, b: Code) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const actives = (s: RoomState) => s.players.filter((p) => p.status === 'active');

/** 全員の宣言がそろったらラウンドを決着させる */
function resolve(s: RoomState): RoomState {
  if (s.phase !== 'playing' || !s.problem) return s;
  const act = actives(s);
  if (act.length === 0) return { ...s, phase: 'finished', winners: [] };
  if (!act.every((p) => p.done)) return s;

  const code = s.problem.code;
  const correct = act.filter((p) => p.guess && sameCode(p.guess, code));
  if (correct.length > 0) {
    const min = Math.min(...correct.map((p) => p.questions));
    return { ...s, phase: 'finished', winners: correct.filter((p) => p.questions === min).map((p) => p.id), lastEliminated: [] };
  }
  const wrong = act.filter((p) => p.guess).map((p) => p.id);
  const players = s.players.map((p) =>
    wrong.includes(p.id) ? { ...p, status: 'eliminated' as const } : p,
  );
  const remain = players.filter((p) => p.status === 'active');
  if (remain.length === 0) return { ...s, players, phase: 'finished', winners: [], lastEliminated: wrong };
  if (remain.length === 1 && wrong.length > 0)
    return { ...s, players, phase: 'finished', winners: [remain[0].id], lastEliminated: wrong };
  return {
    ...s,
    players: players.map((p) => (p.status === 'active' ? { ...p, done: false, guess: null } : p)),
    round: s.round + 1,
    lastEliminated: wrong,
  };
}

export function roomReduce(s: RoomState, e: RoomEvent): RoomState {
  switch (e.type) {
    case 'join': {
      if (s.phase !== 'lobby' || s.players.length >= MAX_PLAYERS || s.players.some((p) => p.id === e.id)) return s;
      const name = e.name.trim().slice(0, 12) || `プレイヤー${s.players.length + 1}`;
      return { ...s, players: [...s.players, { id: e.id, name, status: 'active', done: false, questions: 0, guess: null }] };
    }
    case 'leave': {
      if (!s.players.some((p) => p.id === e.id)) return s;
      if (s.phase === 'lobby') return { ...s, players: s.players.filter((p) => p.id !== e.id) };
      const players = s.players.map((p) => (p.id === e.id ? { ...p, status: 'left' as const } : p));
      const next = { ...s, players };
      if (s.phase !== 'playing') return next;
      const remain = actives(next);
      // 1人だけ残ったら不戦勝
      if (remain.length === 1 && s.players.filter((p) => p.status === 'active').length > 1)
        return { ...next, phase: 'finished', winners: [remain[0].id] };
      return resolve(next);
    }
    case 'settings':
      return s.phase === 'lobby' ? { ...s, settings: e.settings } : s;
    case 'start': {
      if (s.phase !== 'lobby' || s.players.length < 2) return s;
      return {
        ...s,
        phase: 'playing',
        gameNo: s.gameNo + 1,
        round: 1,
        problem: e.problem,
        winners: [],
        lastEliminated: [],
        players: s.players.map((p) => ({ ...p, status: 'active', done: false, questions: 0, guess: null })),
      };
    }
    case 'roundDone': {
      if (s.phase !== 'playing' || e.gameNo !== s.gameNo || e.round !== s.round) return s;
      const me = s.players.find((p) => p.id === e.id);
      if (!me || me.status !== 'active' || me.done) return s;
      const players = s.players.map((p) =>
        p.id === e.id ? { ...p, done: true, questions: e.questions, guess: e.guess } : p,
      );
      return resolve({ ...s, players });
    }
    case 'toLobby':
      return s.phase === 'finished'
        ? { ...s, phase: 'lobby', problem: null, players: s.players.filter((p) => p.status !== 'left') }
        : s;
  }
}

/** クライアントへ送る前に、進行中は他人の解答・検証数を伏せる */
export function redactFor(s: RoomState): RoomState {
  if (s.phase !== 'playing') return s;
  return { ...s, players: s.players.map((p) => ({ ...p, guess: null })) };
}
