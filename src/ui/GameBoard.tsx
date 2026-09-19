import { useState } from 'react';
import { cardById, type Code } from '../core/criteria';
import {
  MAX_QUESTIONS_PER_ROUND,
  ask,
  canAsk,
  currentRound,
  endRound,
  questionCount,
  setDraft,
  toggleCrit,
  toggleDigit,
  type Session,
} from '../game/session';
import { COLOR_CLASS, CodeChips, CritText, LETTERS, Modal, Robot, Shape } from './bits';

interface Props {
  session: Session;
  onChange: (s: Session) => void;
  title: string;
  sub?: string;
  onBack: () => void;
  /** solo: 「次のラウンドへ」で自分のペースで進む / online: ラウンド終了時にパスか解答を宣言 */
  mode: 'solo' | 'online';
  onGuess: (code: Code) => void;
  onPass?: () => void;
  /** online: 宣言済みで他の人を待っている */
  waiting?: boolean;
  roundLabel?: string;
  /** マシンの記録（ソロのみ表示） */
  par?: number;
}

export function DigitPicker({
  value,
  onPick,
  marks,
  locked,
}: {
  value: Code;
  onPick: (color: number, digit: number) => void;
  marks?: number[][];
  locked?: boolean;
}) {
  return (
    <div className={`picker ${locked ? 'locked' : ''}`}>
      {[0, 1, 2].map((c) => (
        <div className="picker-row" key={c}>
          <span className="picker-shape">
            <Shape color={c} size={22} />
          </span>
          {[1, 2, 3, 4, 5].map((d) => {
            const m = marks?.[c][d - 1] ?? 0;
            return (
              <button
                key={d}
                className={`pbtn ${COLOR_CLASS[c]} ${value[c] === d ? 'sel' : ''} ${m === 1 ? 'mk-x' : m === 2 ? 'mk-o' : ''}`}
                onClick={() => onPick(c, d)}
                aria-pressed={value[c] === d}
              >
                {d}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function GameBoard({ session, onChange, title, sub, onBack, mode, onGuess, onPass, waiting, roundLabel, par }: Props) {
  const [memoMode, setMemoMode] = useState(false);
  const [guessing, setGuessing] = useState(false);
  const [guess, setGuess] = useState<Code>(session.draft);
  const [confirmBack, setConfirmBack] = useState(false);

  const { problem } = session;
  const cur = currentRound(session);
  const lastRound = session.rounds[session.rounds.length - 1];
  const shown = cur ?? null;
  const playing = session.status === 'playing' && !waiting;
  const usedUp = !!cur && cur.answers.length >= MAX_QUESTIONS_PER_ROUND;
  const roundNo = session.rounds.length + (session.roundOpen ? 0 : 1);

  const pick = (c: number, d: number) => {
    if (memoMode) onChange(toggleDigit(session, c, d));
    else onChange(setDraft(session, c, d));
  };

  return (
    <div className="screen game">
      <header className="topbar">
        <button className="iconbtn" onClick={() => (session.status === 'playing' ? setConfirmBack(true) : onBack())} aria-label="もどる">
          ←
        </button>
        <div className="topbar-title">
          <strong>{title}</strong>
          {sub && <small>{sub}</small>}
        </div>
        <div className="counters">
          <span className="pill">{roundLabel ?? `ラウンド ${roundNo}`}</span>
          <span className="pill strong">
            検証 {questionCount(session)}回{par !== undefined && <small> / マシン {par}回</small>}
          </span>
        </div>
      </header>

      <main className="game-body">
        <section className="verifiers">
          {problem.cards.map((cardId, v) => {
            const card = cardById(cardId);
            const ans = shown?.answers.find((a) => a.v === v);
            const askable = playing && canAsk(session, v);
            return (
              <article className={`vcard ${ans ? (ans.ok ? 'ok' : 'ng') : ''}`} key={v}>
                <div className="vhead">
                  <div className="vrobot">
                    <Robot index={v} mood={ans ? (ans.ok ? 'ok' : 'ng') : 'idle'} size={46} />
                    <span className="vletter">{LETTERS[v]}</span>
                  </div>
                  <div className="vtitle">
                    <small>カード {card.id}</small>
                    <strong>{card.title}</strong>
                  </div>
                  {ans ? (
                    <span className={`verdict ${ans.ok ? 'ok' : 'ng'}`}>{ans.ok ? '○' : '×'}</span>
                  ) : (
                    <button className="btn ask" disabled={!askable} onClick={() => onChange(ask(session, v))}>
                      検証
                    </button>
                  )}
                </div>
                <ul className="crits">
                  {card.criteria.map((cr, i) => {
                    const m = session.notes.crit[v]?.[i] ?? 0;
                    return (
                      <li key={i}>
                        <button className={`crit ${m === 1 ? 'mk-x' : m === 2 ? 'mk-o' : ''}`} onClick={() => onChange(toggleCrit(session, v, i))}>
                          <CritTextLine text={cr.text} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })}
        </section>

        <section className="log">
          <h3>きろく</h3>
          {session.rounds.length === 0 ? (
            <p className="hint">コードを決めて、ロボの「検証」をタップ。1ラウンドに同じコードで3回まで質問できます。要件をタップすると ×／○ のメモがつけられます。</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>R</th>
                  <th>コード</th>
                  {problem.cards.map((_, v) => (
                    <th key={v}>{LETTERS[v]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {session.rounds.map((r, i) => (
                  <tr key={i} className={r === lastRound && session.roundOpen ? 'current' : ''}>
                    <td>{i + 1}</td>
                    <td>
                      <CodeChips code={r.proposal} size="sm" />
                    </td>
                    {problem.cards.map((_, v) => {
                      const a = r.answers.find((x) => x.v === v);
                      return (
                        <td key={v} className={a ? (a.ok ? 'ok' : 'ng') : ''}>
                          {a ? (a.ok ? '○' : '×') : ''}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>

      <footer className="dock">
        {waiting ? (
          <div className="waiting">
            <span className="spinner" /> ほかのプレイヤーを待っています…
          </div>
        ) : (
          <>
            <div className="dock-top">
              <span className="dock-label">
                {memoMode ? 'メモ：数字をタップして ×→○' : session.roundOpen ? `このラウンドのコード（あと${MAX_QUESTIONS_PER_ROUND - (cur?.answers.length ?? 0)}回）` : 'コードをえらぶ'}
              </span>
              <button className={`chipbtn ${memoMode ? 'on' : ''}`} onClick={() => setMemoMode(!memoMode)} aria-pressed={memoMode}>
                ✎ メモ
              </button>
            </div>
            <DigitPicker
              value={cur ? cur.proposal : session.draft}
              onPick={pick}
              marks={session.notes.digits}
              locked={session.roundOpen && !memoMode}
            />
            <div className="dock-actions">
              {mode === 'solo' ? (
                <button className="btn ghost" disabled={!session.roundOpen} onClick={() => onChange(endRound(session))}>
                  {usedUp ? '次のラウンドへ ▶' : '次のラウンドへ'}
                </button>
              ) : (
                <button className="btn ghost" disabled={!playing} onClick={onPass}>
                  パス（次のラウンド）
                </button>
              )}
              <button
                className="btn primary"
                disabled={!playing}
                onClick={() => {
                  setGuess(cur ? cur.proposal : session.draft);
                  setGuessing(true);
                }}
              >
                解答する！
              </button>
            </div>
          </>
        )}
      </footer>

      {guessing && (
        <Modal onClose={() => setGuessing(false)}>
          <h2>コードを解答</h2>
          <p className="hint">まちがえると{mode === 'solo' ? '失敗' : '脱落'}になります。</p>
          <div className="guess-preview">
            <CodeChips code={guess} size="lg" />
          </div>
          <DigitPicker
            value={guess}
            marks={session.notes.digits}
            onPick={(c, d) => {
              const g = guess.slice() as [number, number, number];
              g[c] = d;
              setGuess(g);
            }}
          />
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setGuessing(false)}>
              やめる
            </button>
            <button
              className="btn primary"
              onClick={() => {
                setGuessing(false);
                onGuess(guess);
              }}
            >
              これで解答！
            </button>
          </div>
        </Modal>
      )}

      {confirmBack && (
        <Modal onClose={() => setConfirmBack(false)}>
          <h2>中断しますか？</h2>
          <p className="hint">{mode === 'solo' ? 'とちゅうの状態は保存され、ホームから再開できます。' : 'ルームから退出します。'}</p>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setConfirmBack(false)}>
              つづける
            </button>
            <button className="btn primary" onClick={onBack}>
              {mode === 'solo' ? '中断する' : '退出する'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CritTextLine({ text }: { text: string }) {
  return (
    <span className="crit-text">
      <CritText text={text} />
    </span>
  );
}
