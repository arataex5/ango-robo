# アンゴウロボ

ロボ（検証機）に質問して、3けたの暗号を見やぶる推理パズル。PWA（ブラウザ／ホーム画面に追加）と Android APK に対応。

- **ソロ：エンドレス** … ランダム問題。プレイ履歴が残り、いつでも再トライ。検証回数で ☆1〜3 の評価
- **ソロ：チャレンジ** … 固定100問（レベル1〜10）。最高記録（検証回数・☆）を更新していく
- **オンライン対戦** … PeerJS の P2P 通信。ホストがルームを作り、5桁のルーム番号で2〜4人が参加

## はじめての公開手順

1. GitHub で新しいリポジトリを作る（例：`ango-robo`、Public）
2. このフォルダを GitHub Desktop で「Add existing repository」→ なければ「create a repository」→ Publish
3. フォルダ `github-workflows` の中の2ファイルを `.github/workflows/` に移動する（フォルダを作って移動）→ Commit & Push
4. リポジトリの **Settings → Pages → Source** を **GitHub Actions** にする
5. **Actions** タブで2つのワークフローが緑になるのを待つ
   - PWA: `https://<ユーザー名>.github.io/<リポジトリ名>/`
   - APK: **Releases → 最新の APK**（または Actions の Artifacts）から `ango-robo.apk` をダウンロード

## 開発

```
npm install
npm run dev        # 開発サーバー
npm test           # ルールエンジンとルーム進行のテスト
npm run build      # dist/ に本番ビルド
```

オンライン対戦を1台で試すとき：`http://localhost:5173/?mock=12345` を2つのタブで開く（同じブラウザ内だけで通信するテスト用モード。ルーム番号は 12345 になる）。

## 権利について

ゲームのルールはボードゲーム「チューリングマシン」（Scorpion Masqué）を参考にしていますが、名称・イラスト・問題データはすべてオリジナルです。公式とは関係ありません。
