import { describe, expect, it } from 'vitest';
import { generateProblem } from '../core/problem';
import { makeRng } from '../core/rng';
import { initialRoom, roomReduce, type RoomEvent, type RoomState } from './room';
import type { Code } from '../core/criteria';

const problem = generateProblem(makeRng(5), 4, 'easy');
const wrongCode: Code = problem.code[0] === 1 ? [2, 1, 1] : [1, 1, 1];
const run = (s: RoomState, ...es: RoomEvent[]) => es.reduce(roomReduce, s);
const lobby3 = () =>
  run(initialRoom('h', 'ホスト'), { type: 'join', id: 'a', name: 'A' }, { type: 'join', id: 'b', name: 'B' });
const done = (id: string, round: number, questions: number, guess: Code | null): RoomEvent => ({
  type: 'roundDone', id, gameNo: 1, round, questions, guess,
});

describe('room', () => {
  it('1人では開始できない／満員は5人目を断る', () => {
    expect(roomReduce(initialRoom('h', 'H'), { type: 'start', problem }).phase).toBe('lobby');
    const full = run(lobby3(), { type: 'join', id: 'c', name: 'C' }, { type: 'join', id: 'd', name: 'D' });
    expect(full.players.length).toBe(4);
  });
  it('全員パスなら次のラウンドへ', () => {
    const s = run(lobby3(), { type: 'start', problem }, done('h', 1, 3, null), done('a', 1, 2, null));
    expect(s.round).toBe(1);
    const s2 = roomReduce(s, done('b', 1, 3, null));
    expect(s2.round).toBe(2);
    expect(s2.players.every((p) => !p.done)).toBe(true);
  });
  it('同じラウンドに複数正解なら検証数が少ない人が勝ち、同数なら全員勝ち', () => {
    const s = run(lobby3(), { type: 'start', problem }, done('h', 1, 3, problem.code), done('a', 1, 2, problem.code), done('b', 1, 2, problem.code));
    expect(s.phase).toBe('finished');
    expect(s.winners.sort()).toEqual(['a', 'b']);
  });
  it('誤答は脱落し、残り1人なら不戦勝', () => {
    const s = run(lobby3(), { type: 'start', problem }, done('h', 1, 3, wrongCode), done('a', 1, 3, null), done('b', 1, 3, null));
    expect(s.phase).toBe('playing');
    expect(s.players.find((p) => p.id === 'h')!.status).toBe('eliminated');
    const s2 = run(s, done('a', 2, 5, wrongCode), done('b', 2, 6, null));
    expect(s2.phase).toBe('finished');
    expect(s2.winners).toEqual(['b']);
  });
  it('全員誤答なら勝者なし', () => {
    const s = run(lobby3(), { type: 'start', problem }, done('h', 1, 1, wrongCode), done('a', 1, 1, wrongCode), done('b', 1, 1, wrongCode));
    expect(s.phase).toBe('finished');
    expect(s.winners).toEqual([]);
  });
  it('待たれている人が抜けたらラウンドが進む', () => {
    const s = run(lobby3(), { type: 'start', problem }, done('h', 1, 3, null), done('a', 1, 3, null), { type: 'leave', id: 'b' });
    expect(s.round).toBe(2);
  });
  it('古いラウンドの宣言は無視', () => {
    const s = run(lobby3(), { type: 'start', problem }, done('h', 2, 3, null));
    expect(s.players[0].done).toBe(false);
  });
});
