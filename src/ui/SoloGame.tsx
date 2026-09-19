import { useEffect, useRef, useState } from 'react';
import { cardById } from '../core/criteria';
import { starsFor, thresholds, type Problem } from '../core/problem';
import { newSession, questionCount, roundCount, submitGuess, type Session } from '../game/session';
import { addPlay, recordChallenge, saveSession, type SessionSource } from '../store';
import GameBoard from './GameBoard';
import Reveal from './Reveal';
import { Modal, Robot, Stars } from './bits';

export const freshSession = (problem: Problem): Session =>
  newSession(problem, problem.cards.map((id) => cardById(id).criteria.length));

interface Props {
  source: SessionSource;
  initial: Session;
  title: string;
  sub: string;
  onExit: () => void;
  /** エンドレス：次のランダム問題へ / チャレンジ：次の問題へ（なければ undefined） */
  onNext?: () => void;
}

export default function SoloGame({ source, initial, title, sub, onExit, onNext }: Props) {
  const [session, setSession] = useState(initial);
  const [newRecord, setNewRecord] = useState(false);
  const recorded = useRef(initial.status !== 'playing');

  // 中断セーブ
  useEffect(() => {
    saveSession(session.status === 'playing' ? { source, session } : null);
  }, [session, source]);

  const finish = (s: Session) => {
    if (recorded.current || s.status === 'playing') return;
    recorded.current = true;
    const questions = questionCount(s);
    const solved = s.status === 'won';
    const stars = solved ? starsFor(questions, s.problem) : 0;
    if (source.kind === 'endless') addPlay(source.historyId, { at: Date.now(), questions, rounds: roundCount(s), solved, stars });
    else if (solved && stars) setNewRecord(recordChallenge(source.index, questions, stars));
  };

  const q = questionCount(session);
  const par = session.problem.par;
  const { star3, star2 } = thresholds(session.problem);
  const won = session.status === 'won';

  return (
    <>
      <GameBoard
        session={session}
        onChange={setSession}
        title={title}
        sub={sub}
        target={star3}
        onBack={onExit}
        mode="solo"
        onGuess={(code) => {
          const next = submitGuess(session, code);
          finish(next);
          setSession(next);
        }}
      />
      {session.status !== 'playing' && (
        <Modal>
          <div className="result">
            <Robot index={0} mood={won ? 'ok' : 'ng'} size={84} />
            <h2>{won ? 'コード解読！' : 'ざんねん…'}</h2>
            {won ? (
              <>
                <Stars n={starsFor(q, session.problem)} big />
                {newRecord && <div className="badge-new">★ 最高記録を更新！</div>}
                <p className="result-stat">
                  検証 <b>{q}</b> 回（{roundCount(session)}ラウンド）
                  <br />
                  <small>
                    ☆3は{star3}回まで・☆2は{star2}回まで
                    <br />
                    {q <= par ? `マシンの記録（${par}回）にも勝利！` : q <= star3 ? `参考：マシンの記録は${par}回` : `あと${q - star3}回へらせば☆3`}
                  </small>
                </p>
              </>
            ) : (
              <p className="result-stat">コードがちがいました。もう一度ちょうせんしよう！</p>
            )}
            {won && <Reveal problem={session.problem} />}
            <div className="modal-actions col">
              {onNext && (won || source.kind === 'endless') && (
                <button className="btn primary" onClick={onNext}>
                  次の問題へ ▶
                </button>
              )}
              <button
                className={`btn ${won ? 'ghost' : 'primary'}`}
                onClick={() => {
                  recorded.current = false;
                  setNewRecord(false);
                  setSession(freshSession(session.problem));
                }}
              >
                もう一度この問題
              </button>
              <button className="btn ghost" onClick={onExit}>
                ホームへ
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
