# アンゴウロボ（ango-robo）

ボードゲーム「チューリングマシン」のルールをベースにした推理パズルの PWA / APK。名称・見た目は完全オリジナル（公式の名称・アートワーク・問題データは使わない）。

## 構成
- Vite + React + TypeScript。`base: './'` で GitHub Pages と Capacitor の両対応
- `src/core/` ルールエンジン（UI 非依存・テストあり）
  - `criteria.ts` 要件カード全48種。`{B}{Y}{P}` は 青▲/黄■/紫● のプレースホルダ
  - `problem.ts` クラシックの世界列挙（唯一解＋全検証機が不可欠）、問題生成、マシンの記録（par）、☆評価、verify/secretOf（全モード共通）
  - `modes.ts` エクストリーム／ナイトメアの生成と評価基準、`generateAny()`（全モードの入口）、`critCounts()`
- `src/game/session.ts` 1プレイの状態（ラウンド、質問、メモ）。純粋関数
- `src/online/room.ts` オンラインのルーム状態（ホスト権威・純粋関数・テストあり）、`net.ts` PeerJS / `?mock=番号` の BroadcastChannel
- `src/ui/` 画面。`src/store.ts` localStorage（キーは `ar.*.v1`）
- `src/data/challenges.json` クラシック100問、`challenges-extra.json` エクストリーム30問＋ナイトメア30問（`npm run gen:challenges` で再生成。シード固定）

## 決めたこと
- ☆評価（人間想定・2026-09-20 緩和）：問題ごとに2種のシミュレーションで決める。L=「解は1つだけ」の推理を使う上級者、H=要件を地道に1つずつ消す平均的な人（どちらも1ラウンド同一コード最大3問・コードは半ランダム）。☆3 ≦ round((L+H)/2)（ただしマシン+1以上）、☆2 ≦ round(H)+1、それ以上☆1。誤答は失敗。「マシンの記録」(par=最適質問AI)は結果画面の参考表示のみ。基準は Problem.star3/star2 に保存、無い古いデータは thresholds() がその場で計算。☆は保存値ではなくベスト検証数から毎回再計算
- 難易度：やさしい=カード1〜17 / ふつう=〜22（18〜22を1枚以上）/ むずかしい=〜48（23〜48を1枚以上）
- チャレンジ：レベル1〜10 × 10問。全問開放
- オンライン：2〜4人、5桁ルーム番号、ホストが問題を生成して配布。ラウンドごとに全員が「パス/解答」を宣言して同期。同ラウンド正解は検証数が少ない人の勝ち、誤答は脱落、最後の1人は不戦勝
- 3モード（2026-09-21 追加）。Problem.mode（省略=classic）
  - エクストリーム：cards[v]＋cards2[v] の2枚。secret[v] は2枚の要件の通し番号。中身が同じ要件は1つとして扱う。メモ notes.crit[v] も通し番号
  - ナイトメア：中身はクラシックの問題＋perm[v]（検証機v→カード位置）。画面は「ロボの列（上に固定）」と「カード一覧＋担当ロボのメモ notes.assign[カード][ロボ]」に分ける
  - ☆基準：エクストリームは同じ考え方（上級者L=唯一解＋不可欠まで使う／平均H=選択肢を地道に消す）。ナイトメアはクラシックの L・H に「対応が不明なぶんの追加検証数 extra」（対応既知/未知のシミュレーション差）を足す（Hには1.5倍）
  - エンドレス設定・オンラインのルーム設定・チャレンジのタブで選べる。チャレンジ記録キー：クラシック 0〜99 / エクストリーム 1000〜 / ナイトメア 2000〜

## 運用
- Claude が接続フォルダに書き込み → arata が GitHub Desktop で Commit & Push
- `.github/` は Claude から書けないため `github-workflows/` に置いてある → `.github/workflows/` に移動して使う
- APK は GitHub Actions でビルド（android/ は CI で毎回生成、署名は `android-signing/debug.keystore` 固定）

## コマンド
`npm run dev` / `npm test` / `npm run build` / `npm run e2e`（`npm run preview` を別で起動してから）
