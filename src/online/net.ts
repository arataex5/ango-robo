// 通信層。PeerJS（本番）と BroadcastChannel（?mock=1：同じブラウザのタブ同士で検証用）を同じ形で扱う。
import type { DataConnection, Peer as PeerType } from 'peerjs';
import type { Code } from '../core/criteria';
import { generateProblem } from '../core/problem';
import { makeRng, randomSeed } from '../core/rng';
import { initialRoom, redactFor, roomReduce, type RoomEvent, type RoomSettings, type RoomState } from './room';

type ToHost =
  | { t: 'join'; name: string }
  | { t: 'roundDone'; gameNo: number; round: number; questions: number; guess: Code | null };
type ToClient = { t: 'state'; state: RoomState } | { t: 'rejected'; reason: string };

const PREFIX = 'angorobo-v1-';
export const isMock = () => new URLSearchParams(location.search).has('mock');
export const makeRoomCode = () => String(Math.floor(10000 + Math.random() * 90000)); // 5桁

export interface RoomHandle {
  readonly myId: string;
  readonly isHost: boolean;
  readonly roomCode: string;
  getState(): RoomState | null;
  subscribe(cb: () => void): () => void;
  roundDone(questions: number, guess: Code | null): void;
  setSettings(s: RoomSettings): void; // ホストのみ
  start(): void; // ホストのみ
  toLobby(): void; // ホストのみ
  close(): void;
  /** 切断などの致命的エラー（UIで表示） */
  getError(): string | null;
}

// ---------- トランスポート ----------
interface HostTransport {
  send(peerId: string, msg: ToClient): void;
  close(): void;
}
interface HostCallbacks {
  onMessage(peerId: string, msg: ToHost): void;
  onDisconnect(peerId: string): void;
}
interface ClientTransport {
  send(msg: ToHost): void;
  close(): void;
}
interface ClientCallbacks {
  onMessage(msg: ToClient): void;
  onClose(): void;
}

async function loadPeer(): Promise<typeof PeerType> {
  return (await import('peerjs')).Peer;
}

async function peerHost(code: string, cb: HostCallbacks): Promise<HostTransport> {
  const Peer = await loadPeer();
  const peer = new Peer(PREFIX + code);
  const conns = new Map<string, DataConnection>();
  await new Promise<void>((res, rej) => {
    peer.on('open', () => res());
    peer.on('error', (e) => rej(e));
  });
  peer.on('connection', (conn) => {
    conns.set(conn.peer, conn);
    conn.on('data', (d) => cb.onMessage(conn.peer, d as ToHost));
    conn.on('close', () => {
      conns.delete(conn.peer);
      cb.onDisconnect(conn.peer);
    });
  });
  // シグナリングサーバーとの接続が切れても、既存の対戦は続けつつ再接続を試みる
  peer.on('disconnected', () => {
    if (!peer.destroyed) peer.reconnect();
  });
  return {
    send: (id, msg) => conns.get(id)?.send(msg),
    close: () => peer.destroy(),
  };
}

async function peerClient(code: string, cb: ClientCallbacks): Promise<{ transport: ClientTransport; myId: string }> {
  const Peer = await loadPeer();
  const peer = new Peer();
  const myId = await new Promise<string>((res, rej) => {
    peer.on('open', (id) => res(id));
    peer.on('error', (e) => rej(e));
  });
  const conn = peer.connect(PREFIX + code, { reliable: true });
  await new Promise<void>((res, rej) => {
    const timer = setTimeout(() => rej(new Error('timeout')), 15000);
    conn.on('open', () => {
      clearTimeout(timer);
      res();
    });
    peer.on('error', (e) => {
      clearTimeout(timer);
      rej(e);
    });
  });
  conn.on('data', (d) => cb.onMessage(d as ToClient));
  conn.on('close', () => cb.onClose());
  return { transport: { send: (m) => conn.send(m), close: () => peer.destroy() }, myId };
}

interface MockPacket {
  to: string;
  from: string;
  bye?: boolean;
  hello?: boolean;
  payload?: ToHost | ToClient;
}
function mockHost(code: string, cb: HostCallbacks): HostTransport {
  const ch = new BroadcastChannel(PREFIX + code);
  ch.onmessage = (ev: MessageEvent<MockPacket>) => {
    const p = ev.data;
    if (p.to !== 'host') return;
    if (p.hello) ch.postMessage({ to: p.from, from: 'host', hello: true } satisfies MockPacket);
    else if (p.bye) cb.onDisconnect(p.from);
    else if (p.payload) cb.onMessage(p.from, p.payload as ToHost);
  };
  const bye = () => ch.postMessage({ to: '*', from: 'host', bye: true } satisfies MockPacket);
  window.addEventListener('pagehide', bye);
  return {
    send: (id, msg) => ch.postMessage({ to: id, from: 'host', payload: msg } satisfies MockPacket),
    close: () => {
      bye();
      window.removeEventListener('pagehide', bye);
      ch.close();
    },
  };
}
async function mockClient(code: string, cb: ClientCallbacks): Promise<{ transport: ClientTransport; myId: string }> {
  const ch = new BroadcastChannel(PREFIX + code);
  const myId = 'mock-' + Math.random().toString(36).slice(2, 8);
  await new Promise<void>((res, rej) => {
    const timer = setTimeout(() => rej(Object.assign(new Error('no room'), { type: 'peer-unavailable' })), 1500);
    ch.onmessage = (ev: MessageEvent<MockPacket>) => {
      if (ev.data.to === myId && ev.data.hello) {
        clearTimeout(timer);
        res();
      }
    };
    ch.postMessage({ to: 'host', from: myId, hello: true } satisfies MockPacket);
  });
  ch.onmessage = (ev: MessageEvent<MockPacket>) => {
    const p = ev.data;
    if (p.from === 'host' && p.bye) cb.onClose();
    else if (p.to === myId && p.payload) cb.onMessage(p.payload as ToClient);
  };
  const bye = () => ch.postMessage({ to: 'host', from: myId, bye: true } satisfies MockPacket);
  window.addEventListener('pagehide', bye);
  return {
    myId,
    transport: {
      send: (m) => ch.postMessage({ to: 'host', from: myId, payload: m } satisfies MockPacket),
      close: () => {
        bye();
        window.removeEventListener('pagehide', bye);
        ch.close();
      },
    },
  };
}

// ---------- ルームの操作 ----------
function makeEmitter() {
  const subs = new Set<() => void>();
  return {
    subscribe: (cb: () => void) => {
      subs.add(cb);
      return () => void subs.delete(cb);
    },
    emit: () => subs.forEach((cb) => cb()),
  };
}

export function describeError(e: unknown): string {
  const type = (e as { type?: string })?.type;
  if (type === 'peer-unavailable') return 'ルームが見つかりません。番号を確認してください。';
  if (type === 'unavailable-id') return 'そのルーム番号は使用中です。もう一度お試しください。';
  if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed')
    return '通信サーバーに接続できません。ネットワークを確認してください。';
  if ((e as Error)?.message === 'timeout') return '接続がタイムアウトしました。';
  return '接続に失敗しました。';
}

export async function hostRoom(name: string): Promise<RoomHandle> {
  const HOST_ID = 'host';
  let state = initialRoom(HOST_ID, name.trim().slice(0, 12) || 'ホスト');
  const em = makeEmitter();
  let transport: HostTransport | null = null;

  const publish = () => {
    const view = redactFor(state);
    for (const p of state.players) if (p.id !== HOST_ID && p.status !== 'left') transport?.send(p.id, { t: 'state', state: view });
    em.emit();
  };
  const dispatch = (e: RoomEvent) => {
    const next = roomReduce(state, e);
    if (next !== state) {
      state = next;
      publish();
    }
  };
  const cb: HostCallbacks = {
    onMessage: (peerId, msg) => {
      if (msg.t === 'join') {
        dispatch({ type: 'join', id: peerId, name: msg.name });
        if (!state.players.some((p) => p.id === peerId))
          transport?.send(peerId, { t: 'rejected', reason: state.phase === 'lobby' ? 'ルームが満員です。' : 'すでに対戦が始まっています。' });
      } else if (msg.t === 'roundDone') {
        dispatch({ type: 'roundDone', id: peerId, gameNo: msg.gameNo, round: msg.round, questions: msg.questions, guess: msg.guess });
      }
    },
    onDisconnect: (peerId) => dispatch({ type: 'leave', id: peerId }),
  };

  let roomCode = makeRoomCode();
  if (isMock()) {
    roomCode = new URLSearchParams(location.search).get('mock') || roomCode;
    transport = mockHost(roomCode, cb);
  } else {
    for (let i = 0; ; i++) {
      try {
        transport = await peerHost(roomCode, cb);
        break;
      } catch (e) {
        if ((e as { type?: string }).type === 'unavailable-id' && i < 3) roomCode = makeRoomCode();
        else throw e;
      }
    }
  }

  return {
    myId: HOST_ID,
    isHost: true,
    roomCode,
    getState: () => state,
    subscribe: em.subscribe,
    roundDone: (questions, guess) =>
      dispatch({ type: 'roundDone', id: HOST_ID, gameNo: state.gameNo, round: state.round, questions, guess }),
    setSettings: (settings) => dispatch({ type: 'settings', settings }),
    start: () => {
      const problem = generateProblem(makeRng(randomSeed()), state.settings.verifiers, state.settings.difficulty);
      dispatch({ type: 'start', problem });
    },
    toLobby: () => dispatch({ type: 'toLobby' }),
    close: () => transport?.close(),
    getError: () => null,
  };
}

export async function joinRoom(code: string, name: string): Promise<RoomHandle> {
  let state: RoomState | null = null;
  let error: string | null = null;
  const em = makeEmitter();
  const cb: ClientCallbacks = {
    onMessage: (msg) => {
      if (msg.t === 'state') state = msg.state;
      else error = msg.reason;
      em.emit();
    },
    onClose: () => {
      error = 'ホストとの接続が切れました。';
      em.emit();
    },
  };
  const { transport, myId } = isMock() ? await mockClient(code, cb) : await peerClient(code, cb);
  transport.send({ t: 'join', name });
  return {
    myId,
    isHost: false,
    roomCode: code,
    getState: () => state,
    subscribe: em.subscribe,
    roundDone: (questions, guess) => {
      if (state) transport.send({ t: 'roundDone', gameNo: state.gameNo, round: state.round, questions, guess });
    },
    setSettings: () => {},
    start: () => {},
    toLobby: () => {},
    close: () => transport.close(),
    getError: () => error,
  };
}
