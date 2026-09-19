// オンライン対戦の通し確認（?mock で BroadcastChannel 通信。同じブラウザ内の3ページ）
import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
const open = async (name) => {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(name + ': ' + e));
  await page.goto('http://localhost:4173/?mock=55555');
  await page.getByText('オンライン対戦').click();
  await page.getByPlaceholder('プレイヤー').fill(name);
  return page;
};
const host = await open('ホスト太郎');
await host.getByRole('button', { name: 'ルームを作る' }).click();
await host.waitForSelector('.roomcode');
const join = async (name) => {
  const p = await open(name);
  await p.getByPlaceholder('12345').fill('55555');
  await p.getByRole('button', { name: '参加する' }).click();
  await p.waitForSelector('.roomcode');
  return p;
};
const a = await join('はなこ');
const b = await join('じろう');
await host.waitForFunction(() => document.querySelectorAll('.players li').length === 3);
await host.getByRole('radio', { name: 'ロボ5台' }).click();
await host.screenshot({ path: 'shots/20-lobby-host.png' });
await a.waitForFunction(() => document.body.innerText.includes('ロボ5台'));
await a.screenshot({ path: 'shots/21-lobby-guest.png' });
await host.getByText('ゲーム開始！').click();
for (const p of [host, a, b]) await p.waitForSelector('.vcard');
console.log('cards equal:', (await host.locator('.vtitle').allInnerTexts()).join() === (await b.locator('.vtitle').allInnerTexts()).join());

const askN = async (p, n) => { for (let i = 0; i < n; i++) await p.locator('.vcard').nth(i).getByText('検証', { exact: true }).click(); };
const guess = async (p, code) => {
  await p.getByText('解答する！').click();
  for (let c = 0; c < 3; c++) await p.locator('.modal .picker-row').nth(c).locator('.pbtn').nth(code[c] - 1).click();
  await p.getByText('これで解答！').click();
};
// ラウンド1：ホスト3問パス、はなこ2問パス、じろう1問で誤答 → 脱落
await askN(host, 3); await host.getByText('パス（次のラウンド）').click();
await host.screenshot({ path: 'shots/22-host-waiting.png' });
await askN(a, 2); await a.getByText('パス（次のラウンド）').click();
await askN(b, 1);
// 正解はホストだけが知っている状態を作れないので、誤答は「全検証機の最初の要件と無関係に 1-1-1 か 5-5-5」
// → どちらかは必ず不正解なので、まず結果を見て判断する代わりに、ホストの内部状態は使わず b のページから問題を読む手段は無い。
//   そこで b は 1-1-1 を解答し、もし正解でゲームが終わったらテストをやり直す。
await guess(b, [1, 1, 1]);
await host.waitForFunction(() => document.body.innerText.includes('ラウンド 2') || document.querySelector('.result'));
if (await host.locator('.result').count()) { console.log('1-1-1 が偶然正解。再実行してください'); process.exit(2); }
await b.screenshot({ path: 'shots/23-eliminated.png' });
console.log('b strip:', (await b.locator('.online-strip').innerText()).replace(/\n/g, ' | '));
// ラウンド2：総当たりはできないので、はなこは 5-5-5 誤答 → ホストが不戦勝
await askN(host, 1); await host.getByText('パス（次のラウンド）').click();
await guess(a, [5, 5, 5]);
await host.waitForSelector('.result');
await host.waitForTimeout(500);
await host.screenshot({ path: 'shots/24-host-result.png' });
await a.screenshot({ path: 'shots/25-guest-result.png' });
console.log('host:', await host.locator('.result h2').innerText(), '| guest:', await a.locator('.result h2').innerText());
console.log('scoreboard:', (await a.locator('.scoreboard tbody').innerText()).replace(/\s+/g, ' '));
// もう一戦
await host.getByText('ロビーにもどる（もう一戦）').click();
await a.waitForSelector('.roomcode');
// じろう退出 → ロビーの人数が減る
await b.close();
await host.waitForFunction(() => document.querySelectorAll('.players li').length === 2);
await host.getByText('ゲーム開始！').click();
await a.waitForSelector('.vcard');
console.log('game 2 started, round label:', await a.locator('.counters .pill').first().innerText());
// ホスト退出 → ゲストにエラー表示
await host.close({ runBeforeUnload: true });
await a.waitForSelector('.error');
console.log('guest sees:', await a.locator('.error').innerText());
// 存在しないルーム
const c = await open('まいご');
await c.goto('http://localhost:4173/?mock=1');
await c.getByText('オンライン対戦').click();
await c.getByPlaceholder('12345').fill('99999');
await c.getByRole('button', { name: '参加する' }).click();
await c.waitForSelector('.error');
console.log('no room:', await c.locator('.error').innerText());
console.log('errors:', errors);
await browser.close();
