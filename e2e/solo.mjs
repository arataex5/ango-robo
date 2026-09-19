import { chromium } from 'playwright';
const URL = 'http://localhost:4173/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ja-JP' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(URL);
await page.screenshot({ path: 'shots/01-home.png' });

// エンドレス
await page.getByText('ソロ：エンドレス').click();
await page.getByRole('radio', { name: '5台' }).click();
await page.getByRole('radio', { name: 'むずかしい' }).click();
await page.screenshot({ path: 'shots/02-endless-setup.png' });
await page.getByText('スタート！').click();
await page.waitForSelector('.vcard');
await page.screenshot({ path: 'shots/03-game-start.png', fullPage: false });

// 2-3-4 を選んで A,B,C に質問
const pick = async (c, d) => page.locator('.dock .picker-row').nth(c).locator('.pbtn').nth(d - 1).click();
await pick(0, 2); await pick(1, 3); await pick(2, 4);
for (const i of [0, 1, 2]) await page.locator('.vcard').nth(i).getByText('検証', { exact: true }).click();
// 4台目は聞けない（3回まで）
const disabled = await page.locator('.vcard').nth(3).getByText('検証', { exact: true }).isDisabled();
console.log('4th ask disabled:', disabled);
// 要件メモ
await page.locator('.vcard').nth(0).locator('.crit').nth(0).click();
await page.locator('.vcard').nth(0).locator('.crit').nth(1).click();
await page.locator('.vcard').nth(0).locator('.crit').nth(1).click();
await page.screenshot({ path: 'shots/04-game-round1.png' });
await page.getByText('次のラウンドへ').click();
await pick(0, 5);
await page.locator('.vcard').nth(3).getByText('検証', { exact: true }).click();
// 数字メモ
await page.getByText('✎ メモ').click();
await pick(2, 1); await pick(2, 2); await pick(2, 2);
await page.getByText('✎ メモ').click();
await page.locator('.game-body').evaluate((el) => (el.scrollTop = el.scrollHeight));
await page.screenshot({ path: 'shots/05-game-log.png' });

// 中断セーブから正解を取り出して解答
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ar.session.v1')));
const code = saved.session.problem.code;
console.log('code', code, 'par', saved.session.problem.par, 'questions so far', saved.session.rounds.flatMap((r) => r.answers).length);
await page.getByText('解答する！').click();
const gp = (c, d) => page.locator('.modal .picker-row').nth(c).locator('.pbtn').nth(d - 1).click();
for (let c = 0; c < 3; c++) await gp(c, code[c]);
await page.screenshot({ path: 'shots/06-guess.png' });
await page.getByText('これで解答！').click();
await page.waitForTimeout(900);
await page.screenshot({ path: 'shots/07-result.png' });
console.log('result title:', await page.locator('.result h2').innerText());
await page.getByText('ホームへ').click();
await page.getByText('プレイ履歴').click();
await page.screenshot({ path: 'shots/08-history.png' });
console.log('history rows:', await page.locator('.hist').count(), '|', await page.locator('.hist-main').first().innerText());
// 再トライ → 誤答 → 失敗
await page.getByRole('button', { name: '再トライ' }).first().click();
await page.getByText('解答する！').click();
const wrong = code[0] === 1 ? 2 : 1;
await gp(0, wrong);
await page.getByText('これで解答！').click();
console.log('fail title:', await page.locator('.result h2').innerText());
await page.screenshot({ path: 'shots/09-fail.png' });
await page.getByText('ホームへ').click();

// チャレンジ
await page.getByText('ソロ：チャレンジ').click();
await page.screenshot({ path: 'shots/10-challenge.png' });
await page.locator('.tile').first().click();
await page.waitForSelector('.vcard');
await page.locator('.vcard').nth(0).getByText('検証', { exact: true }).click();
// 中断 → つづきから
await page.getByLabel('もどる').click();
await page.getByText('中断する').click();
await page.screenshot({ path: 'shots/11-home-resume.png' });
await page.getByText('つづきから').click();
const s2 = await page.evaluate(() => JSON.parse(localStorage.getItem('ar.session.v1')));
console.log('resumed questions:', s2.session.rounds.flatMap((r) => r.answers).length);
await page.getByText('解答する！').click();
for (let c = 0; c < 3; c++) await gp(c, s2.session.problem.code[c]);
await page.getByText('これで解答！').click();
await page.waitForTimeout(900);
await page.screenshot({ path: 'shots/12-challenge-result.png' });
console.log('challenge record:', await page.evaluate(() => localStorage.getItem('ar.challenge.v1')));
await page.getByText('ホームへ').click();
await page.getByText('あそびかた').click();
await page.screenshot({ path: 'shots/13-howto.png', fullPage: false });
// ブラウザの戻るでホームへ
await page.goBack();
console.log('after back, home visible:', await page.getByText('ソロ：エンドレス').isVisible());
console.log('errors:', errors);
await browser.close();
