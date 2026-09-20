import { useCallback, useEffect, useState } from 'react';
import challengesJson from './data/challenges.json';
import extraJson from './data/challenges-extra.json';
import { MODE_LABEL, generateAny, modeOf } from './core/modes';
import { starsFor, thresholds, type Mode, type Problem } from './core/problem';
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

const PER_LEVEL = 10;
/** チャレンジのパック。記録のキーは offset + 問題番号（クラシックは従来どおり 0〜99） */
const PACKS: { mode: Mode; offset: number; problems: Problem[]; prefix: string }[] = [
  { mode: 'classic', offset: 0, problems: challengesJson as unknown as Problem[], prefix: 'No.' },
  { mode: 'extreme', offset: 1000, problems: (extraJson as unknown as Record<string, Problem[]>).extreme, prefix: 'EX-' },
  { mode: 'nightmare', offset: 2000, problems: (extraJson as unknown as Record<string, Problem[]>).nightmare, prefix: 'NM-' },
];
const packOf = (index: number) => PACKS.find((p) => index >= p.offset && index < p.offset + p.problems.length)!;
const challengeAt = (index: number): Problem | undefined => packOf(index)?.problems[index - packOf(index).offset];
const challengeName = (index: number) => `${packOf(index).prefix}${index - packOf(index).offset + 1}`;
const MODE_HINT: Record<Mode, string> = {
  classic: 'ロボ1台にカード1枚。基本のルール。',
  extreme: 'ロボ1台にカードが2枚！ ロボが見ているのは、2枚の要件のうちどれか1つだけ。',
  nightmare: 'どのロボがどのカードを担当しているか分からない！ 上級者向け。',
};
const TOTAL_CHALLENGES = PACKS.reduce((a, p) => a + p.problems.length, 0);
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
    const problem = generateAny(makeRng(randomSeed()), settings.mode, settings.verifiers, settings.difficulty);
    const item = addHistoryItem(problem);
    go({ name: 'game', source: { kind: 'endless', historyId: item.id }, session: freshSession(problem), key: Date.now() });
  };
  const startChallenge = (index: number) =>
    go({ name: 'game', source: { kind: 'challenge', index }, session: freshSession(challengeAt(index)!), key: Date.now() });

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
          title={isCh ? `チャレンジ ${challengeName(source.index)}` : `エンドレス`}
          sub={`${MODE_LABEL[modeOf(p)]}・${p.cards.length}台・${DIFF_LABEL[p.difficulty]}`}
          onExit={home}
          onNext={
            isCh
              ? challengeAt(source.index + 1)
                ? () => startChallenge(source.index + 1)
                : undefined
              : () => startEndless({ mode: modeOf(p), verifiers: p.cards.length as 4 | 5 | 6, difficulty: p.difficulty })
          }
        />
      );
    }
  }
}

function Home({ go }: { go: (s: Screen) => void }) {
  const saved = loadSession();
  const records = loadChallenge();
  const totalStars = Object.entries(records).reduce((a, [i, r]) => {
    const p = challengeAt(Number(i));
    return a + (p ? starsFor(r.best, p) : 0);
  }, 0);
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
              <small>{saved.source.kind === 'challenge' ? `チャレンジ ${challengeName(saved.source.index)}` : 'エンドレス'} をプレイ中</small>
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
              全{TOTAL_CHALLENGES}問・あつめた星 {totalStars}/{TOTAL_CHALLENGES * 3}
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
          <h3>モード</h3>
          <Seg
            value={settings.mode}
            options={(['classic', 'extreme', 'nightmare'] as const).map((m) => ({ value: m, label: MODE_LABEL[m] }))}
            onChange={(m) => update({ ...settings, mode: m })}
          />
          <p className="hint">{MODE_HINT[settings.mode]}</p>
        </div>
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
                  <span className={`mode-tag ${modeOf(h.problem)}`}>{MODE_LABEL[modeOf(h.problem)]}</span>
                  ロボ{h.problem.cards.length}台・{DIFF_LABEL[h.problem.difficulty]}
                </strong>
                <small>
                  {new Date(h.createdAt).toLocaleDateString('ja-JP')} ・カード {[...h.problem.cards, ...(h.problem.cards2 ?? [])].sort((a, b) => a - b).join(', ')}
                </small>
                <small>
                  {best ? (
                    <>
                      ベスト 検証{best.questions}回（☆3は{thresholds(h.problem).star3}回まで）・{h.plays.length}回プレイ
                    </>
                  ) : last ? (
                    <>未クリア・{h.plays.length}回プレイ</>
                  ) : (
                    <>未プレイ（中断）</>
                  )}
                </small>
              </div>
              <div className="hist-side">
                <Stars n={best ? starsFor(best.questions, h.problem) : 0} />
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
  const [tab, setTab] = useState<Mode>(() => {
    try {
      return (sessionStorage.getItem('ar.chtab') as Mode) || 'classic';
    } catch {
      return 'classic';
    }
  });
  const pack = PACKS.find((p) => p.mode === tab) ?? PACKS[0];
  const levels = Array.from({ length: Math.ceil(pack.problems.length / PER_LEVEL) }, (_, l) => l);
  const starOf = (i: number) => (records[i] ? starsFor(records[i].best, challengeAt(i)!) : 0);
  return (
    <div className="screen">
      <TopBar title="チャレンジ" sub="固定の問題・最高記録をめざそう" onExit={onExit} />
      <main className="page">
        <Seg
          value={tab}
          options={PACKS.map((p) => ({ value: p.mode, label: `${MODE_LABEL[p.mode]} ${p.problems.length}` }))}
          onChange={(m) => {
            setTab(m);
            try {
              sessionStorage.setItem('ar.chtab', m);
            } catch {
              /* 無視 */
            }
          }}
        />
        {tab !== 'classic' && <p className="hint">{MODE_HINT[tab]}</p>}
        {levels.map((l) => {
          const first = pack.problems[l * PER_LEVEL];
          const stars = Array.from({ length: PER_LEVEL }, (_, k) => starOf(pack.offset + l * PER_LEVEL + k)).reduce<number>((a, b) => a + b, 0);
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
                  const i = pack.offset + l * PER_LEVEL + k;
                  const r = records[i];
                  return (
                    <button className={`tile ${r ? 'cleared' : ''}`} key={i} onClick={() => onPlay(i)}>
                      <strong>{l * PER_LEVEL + k + 1}</strong>
                      <Stars n={starOf(i)} />
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
