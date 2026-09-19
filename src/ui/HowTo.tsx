import { CodeChips, Robot, Shape, Stars } from './bits';

export default function HowTo({ onExit }: { onExit: () => void }) {
  return (
    <div className="screen">
      <header className="topbar">
        <button className="iconbtn" onClick={onExit} aria-label="もどる">
          ←
        </button>
        <div className="topbar-title">
          <strong>あそびかた</strong>
        </div>
      </header>
      <main className="page howto">
        <div className="panel">
          <h3>1. 目的</h3>
          <p>
            かくされた3けたのコード <CodeChips code={[2, 4, 1]} size="sm" /> を当てよう。
            <Shape color={0} /> 青・<Shape color={1} /> 黄・<Shape color={2} /> 紫 は、それぞれ 1〜5 の数字。すべてのロボの条件を満たすコードは <b>1つだけ</b>。
          </p>
        </div>
        <div className="panel">
          <h3>2. ロボに検証してもらう</h3>
          <p>
            <Robot index={0} size={30} /> ロボ（検証機）は、カードに書かれた要件のうち <b>どれか1つだけ</b> をチェックしています。どれをチェックしているかはヒミツ。
          </p>
          <p>コードを決めて「検証」を押すと、そのコードがロボの要件を満たすか ○／× で教えてくれます。</p>
        </div>
        <div className="panel">
          <h3>3. ラウンド</h3>
          <p>1ラウンドでは <b>同じコード</b> で <b>最大3台</b> まで質問できます。コードを変えたいときは次のラウンドへ。</p>
        </div>
        <div className="panel">
          <h3>4. 推理のコツ</h3>
          <p>・要件をタップすると ×／○ のメモがつきます。「✎ メモ」で数字にもメモできます。</p>
          <p>・どのロボも、コードの特定に <b>欠かせない</b> 情報を持っています。ほかのロボと同じ情報しか持たない要件は、選ばれていません。</p>
        </div>
        <div className="panel">
          <h3>5. 評価</h3>
          <p>
            問題ごとに「マシンの記録」（AIが解いたときの検証回数）があります。
            <br />
            <Stars n={3} /> マシンの記録以下
            <br />
            <Stars n={2} /> マシン＋2回まで
            <br />
            <Stars n={1} /> それ以上
          </p>
        </div>
        <div className="panel">
          <h3>6. オンライン対戦</h3>
          <p>全員が同じ問題に同時にちょうせん。各ラウンドの終わりに「パス」か「解答」を宣言します。</p>
          <p>・正解者が出たら終了。同じラウンドに複数いたら、検証回数が少ない人の勝ち（同数なら引き分け勝ち）。</p>
          <p>・まちがえたら脱落。最後の1人になったらその人の勝ち。</p>
        </div>
      </main>
    </div>
  );
}
