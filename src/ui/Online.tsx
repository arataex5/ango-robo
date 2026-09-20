import { useEffect, useState } from 'react';
import type { Code } from '../core/criteria';
import { endRound, questionCount, type Session } from '../game/session';
import { describeError, hostRoom, joinRoom, type RoomHandle } from '../online/net';
import { MAX_PLAYERS, type RoomState } from '../online/room';
import { MODE_LABEL } from '../core/modes';
import { loadName, saveName } from '../store';
import GameBoard from './GameBoard';
import Reveal from './Reveal';
import { freshSession } from './SoloGame';
import { CodeChips, DIFF_LABEL, Modal, Robot, Seg } from './bits';

export default function Online({ onExit }: { onExit: () => void }) {
  const [room, setRoom] = useState<RoomHandle | null>(null);
  const [name, setName] = useState(loadName());
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const leave = () => {
    room?.close();
    setRoom(null);
    onExit();
  };
  useEffect(() => () => room?.close(), [room]);

  const connect = async (fn: () => Promise<RoomHandle>) => {
    setBusy(true);
    setErr(null);
    saveName(name);
    try {
      setRoom(await fn());
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  if (room) return <RoomView room={room} onLeave={leave} />;

  return (
    <div className="screen">
      <header className="topbar">
        <button className="iconbtn" onClick={onExit} aria-label="もどる">
          ←
        </button>
        <div className="topbar-title">
          <strong>オンライン対戦</strong>
          <small>2〜{MAX_PLAYERS}人・ルーム番号で集合</small>
        </div>
      </header>
      <main className="page">
        <label className="field">
          <span>なまえ</span>
          <input value={name} maxLength={12} placeholder="プレイヤー" onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="panel">
          <h3>ルームを作る（ホスト）</h3>
          <p className="hint">ルーム番号が発行されます。友だちに伝えて集まろう。</p>
          <button className="btn primary wide" disabled={busy} onClick={() => connect(() => hostRoom(name))}>
            ルームを作る
          </button>
        </div>
        <div className="panel">
          <h3>ルームに入る</h3>
          <label className="field">
            <span>ルーム番号（5けた）</span>
            <input value={code} inputMode="numeric" maxLength={5} placeholder="12345" onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          </label>
          <button className="btn primary wide" disabled={busy || code.length !== 5} onClick={() => connect(() => joinRoom(code, name))}>
            参加する
          </button>
        </div>
        {busy && (
          <p className="hint center">
            <span className="spinner" /> 接続中…
          </p>
        )}
        {err && <p className="error">{err}</p>}
      </main>
    </div>
  );
}

function useRoomState(room: RoomHandle): [RoomState | null, string | null] {
  const [, force] = useState(0);
  useEffect(() => {
    const off = room.subscribe(() => force((n) => n + 1));
    // 画面の準備が終わる前に届いた状態を取りこぼさないよう、購読直後に一度描き直す
    force((n) => n + 1);
    return off;
  }, [room]);
  return [room.getState(), room.getError()];
}

function RoomView({ room, onLeave }: { room: RoomHandle; onLeave: () => void }) {
  const [state, error] = useRoomState(room);
  const [sess, setSess] = useState<{ gameNo: number; s: Session } | null>(null);

  // 新しいゲームが始まったら自分の盤面を用意
  useEffect(() => {
    if (state?.phase === 'playing' && state.problem && state.gameNo !== sess?.gameNo)
      setSess({ gameNo: state.gameNo, s: freshSession(state.problem) });
  }, [state, sess]);
  const session = sess && state && sess.gameNo === state.gameNo ? sess.s : null;
  const setSession = (s: Session) => setSess((cur) => (cur ? { ...cur, s } : cur));

  if (error)
    return (
      <div className="screen">
        <main className="page center">
          <Robot index={1} mood="ng" size={84} />
          <p className="error">{error}</p>
          <button className="btn primary" onClick={onLeave}>
            もどる
          </button>
        </main>
      </div>
    );
  if (!state)
    return (
      <div className="screen">
        <main className="page center">
          <p className="hint">
            <span className="spinner" /> ルームに入っています…
          </p>
        </main>
      </div>
    );

  const me = state.players.find((p) => p.id === room.myId);

  if (state.phase === 'lobby' || !session || !state.problem) {
    return (
      <div className="screen">
        <header className="topbar">
          <button className="iconbtn" onClick={onLeave} aria-label="退出">
            ←
          </button>
          <div className="topbar-title">
            <strong>ロビー</strong>
            <small>{room.isHost ? 'あなたがホストです' : 'ホストの開始を待っています'}</small>
          </div>
        </header>
        <main className="page">
          <div className="roomcode">
            <small>ルーム番号</small>
            <strong>{room.roomCode}</strong>
          </div>
          <div className="panel">
            <h3>
              プレイヤー（{state.players.length}/{MAX_PLAYERS}）
            </h3>
            <ul className="players">
              {state.players.map((p, i) => (
                <li key={p.id}>
                  <Robot index={i} size={36} />
                  <span>{p.name}</span>
                  {p.id === state.hostId && <em>ホスト</em>}
                  {p.id === room.myId && <em className="me">あなた</em>}
                </li>
              ))}
            </ul>
          </div>
          <div className="panel">
            <h3>ルール設定</h3>
            {room.isHost ? (
              <>
                <Seg
                  value={state.settings.mode}
                  options={(['classic', 'extreme', 'nightmare'] as const).map((m) => ({ value: m, label: MODE_LABEL[m] }))}
                  onChange={(m) => room.setSettings({ ...state.settings, mode: m })}
                />
                <Seg
                  value={state.settings.verifiers}
                  options={[4, 5, 6].map((n) => ({ value: n as 4 | 5 | 6, label: `ロボ${n}台` }))}
                  onChange={(v) => room.setSettings({ ...state.settings, verifiers: v })}
                />
                <Seg
                  value={state.settings.difficulty}
                  options={(['easy', 'standard', 'hard'] as const).map((d) => ({ value: d, label: DIFF_LABEL[d] }))}
                  onChange={(d) => room.setSettings({ ...state.settings, difficulty: d })}
                />
              </>
            ) : (
              <p>
                {MODE_LABEL[state.settings.mode]}・ロボ{state.settings.verifiers}台・{DIFF_LABEL[state.settings.difficulty]}
              </p>
            )}
          </div>
          {room.isHost && (
            <button className="btn primary wide" disabled={state.players.length < 2} onClick={() => room.start()}>
              {state.players.length < 2 ? '2人以上で開始できます' : 'ゲーム開始！'}
            </button>
          )}
        </main>
      </div>
    );
  }

  const declare = (guess: Code | null) => {
    room.roundDone(questionCount(session), guess);
    setSession(endRound(session));
  };
  const waiting = !me || me.status !== 'active' || me.done;
  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? '?';

  return (
    <>
      <div className="online-strip">
        {state.players.map((p) => (
          <span key={p.id} className={`ptag ${p.status} ${p.done ? 'done' : ''}`}>
            {p.name}
            {p.status === 'eliminated' ? ' ✕脱落' : p.status === 'left' ? ' 退出' : p.done ? ' ✓' : ' …'}
          </span>
        ))}
      </div>
      <GameBoard
        key={state.gameNo}
        session={session}
        onChange={setSession}
        title={`ルーム ${room.roomCode}`}
        sub={me?.status === 'eliminated' ? '脱落しました（観戦中）' : `${MODE_LABEL[state.settings.mode]}・${state.settings.verifiers}台・${DIFF_LABEL[state.settings.difficulty]}`}
        onBack={onLeave}
        mode="online"
        roundLabel={`ラウンド ${state.round}`}
        waiting={waiting && state.phase === 'playing'}
        onPass={() => declare(null)}
        onGuess={(c) => declare(c)}
      />
      {state.phase === 'finished' && (
        <Modal>
          <div className="result">
            <Robot index={0} mood={state.winners.includes(room.myId) ? 'ok' : 'ng'} size={84} />
            <h2>
              {state.winners.length === 0
                ? '勝者なし…'
                : state.winners.includes(room.myId)
                  ? 'あなたの勝ち！'
                  : `${state.winners.map(nameOf).join('・')} の勝ち！`}
            </h2>
            <table className="scoreboard">
              <thead>
                <tr>
                  <th>プレイヤー</th>
                  <th>検証</th>
                  <th>解答</th>
                </tr>
              </thead>
              <tbody>
                {state.players.map((p) => (
                  <tr key={p.id} className={state.winners.includes(p.id) ? 'win' : ''}>
                    <td>
                      {state.winners.includes(p.id) ? '👑 ' : ''}
                      {p.name}
                    </td>
                    <td>{p.questions}回</td>
                    <td>{p.guess ? <CodeChips code={p.guess} size="sm" /> : p.status === 'left' ? '退出' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Reveal problem={state.problem} />
            <div className="modal-actions col">
              {room.isHost ? (
                <button className="btn primary" onClick={() => room.toLobby()}>
                  ロビーにもどる（もう一戦）
                </button>
              ) : (
                <p className="hint">ホストが次のゲームを準備するのを待っています…</p>
              )}
              <button className="btn ghost" onClick={onLeave}>
                退出する
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
