import { useCallback, useEffect, useState } from 'react';
import challengesJson from './data/challenges.json';
import { generateProblem, type Problem } from './core/problem';
import { makeRng, randomSeed } from './core/rng';
import type { Session } from './game/session';
import {
  addHistoryItem,
  bestPlay,
  deleteHistoryItem,
  loadChallenge,
  loadEndless,
  loadHistory,
  loadSession,
  saveEndless,
  saveSession,
  type EndlessSettings,
  type SessionSource,
} from './store';
import HowTo from './ui/HowTo';
import Online from './ui/Online';
import SoloGame, { freshSession } from './ui/SoloGame';
import { DIFF_LABEL, Robot, Seg, Stars } from './ui/bits';

const CHALLENGES = challengesJson as unknown as Problem[];
const PER_LEVEL = 10;
export const APP_NAME = 'アンゴウロボ';

type Screen =
  | { name: 'home' }
  | { name: 'endless' }
  | { name: 'history' }
  | { name: 'challenge' }
  | { name: 'howto' }
  | { name: 'online' }
  | { name: 'game'; source: SessionSource; session: Session; key: number };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  // Android の戻るボタン / ブラウザの戻るでホームへ。履歴は常に「ホーム → 今の画面」の2段だけにする
  const go = useCallback((s: Screen) => {
    if (s.name !== 'home') {
      if (history.state?.inApp) history.replaceState({ inApp: true }, '');
      else history.pushState({ inApp: true }, '');
    }
    setScreen(s);
  }, []);
  const home = useCallback(() => {
    if (history.state?.inApp) history.back();
    else setScreen({ name: 'home' });
  }, []);
  useEffect(() => {
    const onPop = () => setScreen({ name: 'home' });
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const startEndless = (settings: EndlessSettings) => {
    const problem = generateProblem(makeRng(randomSeed()), settings.verifiers, settings.difficulty);
    const item = addHistoryItem(problem);
    go({ name: 'game', source: { kind: 'endless', historyId: item.id }, session: freshSession(problem), key: Date.now() });
  };
  const startChallenge = (index: number) =>
    go({ name: 'game', source: { kind: 'challenge', index }, session: freshSession(CHALLENGES[index]), key: Date.now() });

  switch (screen.name) {
    case 'home':
      return <Home go={go} />;
    case 'endless':
      return <EndlessSetup onExit={home} onStart={startEndless} />;
    case 'history':
      return (
        <History
          onExit={home}
          onRetry={(id, problem) => go({ name: 'game', source: { kind: 'endless', historyId: id }, session: freshSession(problem), key: Date.now() })}
        />
      );
    case 'challenge':
      return <ChallengeList onExit={home} onPlay={startChallenge} />;
    case 'howto':
      return <HowTo onExit={home} />;
    case 'online':
      return <Online onExit={home} />;
    case 'game': {
      const { source, session } = screen;
      const p = session.problem;
      const isCh = source.kind === 'challenge';
      return (
        <SoloGame
          key={screen.key}
          source={source}
          initial={session}
          title={isCh ? `チャレンジ No.${source.index + 1}` : 'エンドレス'}
          sub={isCh ? `レベル${Math.floor(source.index / PER_LEVEL) + 1}` : `ロボ${p.cards.length}台・${DIFF_LABEL[p.difficulty]}`}
          onExit={home}
          onNext={
            isCh
              ? source.index + 1 < CHALLENGES.length
                ? () => startChallenge(source.index + 1)
                : undefined
              : () => startEndless({ verifiers: p.cards.length as 4 | 5 | 6, difficulty: p.difficulty })
          }
        />
      );
    }
  }
}

function Home({ go }: { go: (s: Screen) => void }) {
  const saved = loadSession();
  const records = loadChallenge();
  const totalStars = Object.values(records).reduce((a, r) => a + r.stars, 0);
  return (
    <div className="screen home">
      <div className="hero">
        <div className="hero-robots">
          <Robot index={0} size={54} />
          <Robot index={1} size={76} mood="ok" />
          <Robot index={2} size={54} />
        </div>
        <h1>{APP_NAME}</h1>
        <p>ロボに質問して 3けたの暗号を見やぶれ！</p>
      </div>
      <main className="page">
        {saved && (
          <button
            className="menu resume"
            onClick={() => go({ name: 'game', source: saved.source, session: saved.session, key: Date.now() })}
          >
            <span className="menu-ico">▶</span>
            <span>
              <strong>つづきから</strong>
              <small>{saved.source.kind === 'challenge' ? `チャレンジ No.${saved.source.index + 1}` : 'エンドレス'} をプレイ中</small>
            </span>
          </button>
        )}
        <button className="menu m1" onClick={() => go({ name: 'endless' })}>
          <span className="menu-ico">∞</span>
          <span>
            <strong>ソロ：エンドレス</strong>
            <small>ランダムな問題をどんどん解こう</small>
          </span>
        </button>
        <button className="menu m2" onClick={() => go({ name: 'challenge' })}>
          <span className="menu-ico">★</span>
          <span>
            <strong>ソロ：チャレンジ</strong>
            <small>
              全{CHALLENGES.length}問・あつめた星 {totalStars}/{CHALLENGES.length * 3}
            </small>
          </span>
        </button>
        <button className="menu m3" onClick={() => go({ name: 'online' })}>
          <span className="menu-ico">⚡</span>
          <span>
            <strong>オンライン対戦</strong>
            <small>ルーム番号で友だちと勝負</small>
          </span>
        </button>
        <div className="menu-row">
          <button className="btn ghost" onClick={() => go({ name: 'history' })}>
            プレイ履歴
          </button>
          <button className="btn ghost" onClick={() => go({ name: 'howto' })}>
            あそびかた
          </button>
        </div>
      </main>
    </div>
  );
}

function TopBar({ title, sub, onExit }: { title: string; sub?: string; onExit: () => void }) {
  return (
    <header className="topbar">
      <button className="iconbtn" onClick={onExit} aria-label="もどる">
        ←
      </button>
      <div className="topbar-title">
        <strong>{title}</strong>
        {sub && <small>{sub}</small>}
      </div>
    </header>
  );
}

function EndlessSetup({ onExit, onStart }: { onExit: () => void; onStart: (s: EndlessSettings) => void }) {
  const [settings, setSettings] = useState(loadEndless());
  const update = (s: EndlessSettings) => {
    setSettings(s);
    saveEndless(s);
  };
  return (
    <div className="screen">
      <TopBar title="エンドレス" sub="ランダムな問題" onExit={onExit} />
      <main className="page">
        <div className="panel">
          <h3>ロボ（検証機）の数</h3>
          <Seg value={settings.verifiers} options={[4, 5, 6].map((n) => ({ value: n as 4 | 5 | 6, label: `${n}台` }))} onChange={(v) => update({ ...settings, verifiers: v })} />
          <h3>むずかしさ</h3>
          <Seg
            value={settings.difficulty}
            options={(['easy', 'standard', 'hard'] as const).map((d) => ({ value: d, label: DIFF_LABEL[d] }))}
            onChange={(d) => update({ ...settings, difficulty: d })}
          />
          <p className="hint">
            {settings.difficulty === 'easy' ? '基本のカード（1〜17）だけ。' : settings.difficulty === 'standard' ? 'すこしひねったカード（〜22）が入ります。' : '全48種。どの色のことか分からないカードも登場！'}
          </p>
        </div>
        <button
          className="btn primary wide"
          onClick={() => {
            saveSession(null);
            onStart(settings);
          }}
        >
          スタート！
        </button>
      </main>
    </div>
  );
}

function History({ onExit, onRetry }: { onExit: () => void; onRetry: (id: string, p: Problem) => void }) {
  const [items, setItems] = useState(loadHistory());
  return (
    <div className="screen">
      <TopBar title="プレイ履歴" sub="エンドレスで遊んだ問題・いつでも再トライ" onExit={onExit} />
      <main className="page">
        {items.length === 0 && <p className="hint center">まだ履歴がありません。</p>}
        {items.map((h) => {
          const best = bestPlay(h);
          const last = h.plays[h.plays.length - 1];
          return (
            <div className="hist" key={h.id}>
              <div className="hist-main">
                <strong>
                  ロボ{h.problem.cards.length}台・{DIFF_LABEL[h.problem.difficulty]}
                </strong>
                <small>
                  {new Date(h.createdAt).toLocaleDateString('ja-JP')} ・カード {h.problem.cards.join(', ')}
                </small>
                <small>
                  {best ? (
                    <>
                      ベスト 検証{best.questions}回（マシン {h.problem.par}回）・{h.plays.length}回プレイ
                    </>
                  ) : last ? (
                    <>未クリア・{h.plays.length}回プレイ</>
                  ) : (
                    <>未プレイ（中断）</>
                  )}
                </small>
              </div>
              <div className="hist-side">
                <Stars n={best?.stars ?? 0} />
                <div className="hist-btns">
                  <button className="btn small primary" onClick={() => onRetry(h.id, h.problem)}>
                    再トライ
                  </button>
                  <button
                    className="btn small ghost"
                    aria-label="削除"
                    onClick={() => {
                      deleteHistoryItem(h.id);
                      setItems(loadHistory());
                    }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}

function ChallengeList({ onExit, onPlay }: { onExit: () => void; onPlay: (i: number) => void }) {
  const records = loadChallenge();
  const levels = Array.from({ length: Math.ceil(CHALLENGES.length / PER_LEVEL) }, (_, l) => l);
  return (
    <div className="screen">
      <TopBar title="チャレンジ" sub="固定の100問・最高記録をめざそう" onExit={onExit} />
      <main className="page">
        {levels.map((l) => {
          const first = CHALLENGES[l * PER_LEVEL];
          const stars = Array.from({ length: PER_LEVEL }, (_, k) => records[l * PER_LEVEL + k]?.stars ?? 0).reduce<number>((a, b) => a + b, 0);
          return (
            <section className="level" key={l}>
              <h3>
                レベル {l + 1}
                <small>
                  ロボ{first.cards.length}台・{DIFF_LABEL[first.difficulty]}
                </small>
                <span className="level-stars">★ {stars}/{PER_LEVEL * 3}</span>
              </h3>
              <div className="tiles">
                {Array.from({ length: PER_LEVEL }, (_, k) => {
                  const i = l * PER_LEVEL + k;
                  const r = records[i];
                  return (
                    <button className={`tile ${r ? 'cleared' : ''}`} key={i} onClick={() => onPlay(i)}>
                      <strong>{i + 1}</strong>
                      <Stars n={r?.stars ?? 0} />
                      <small>{r ? `${r.best}回` : '—'}</small>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
