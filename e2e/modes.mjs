// エクストリーム／ナイトメアの通し確認
import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ja-JP' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:4173/');
const pick = (c, d) => page.locator('.dock .picker-row').nth(c).locator('.pbtn').nth(d - 1).click();
const gp = (c, d) => page.locator('.modal .picker-row').nth(c).locator('.pbtn').nth(d - 1).click();
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('ar.session.v1')));

for (const [label, shot] of [['エクストリーム', '30-extreme'], ['ナイトメア', '31-nightmare']]) {
  await page.getByText('ソロ：エンドレス').click();
  await page.getByRole('radio', { name: label }).click();
  await page.getByRole('radio', { name: '5台' }).click();
  await page.getByRole('radio', { name: 'ふつう' }).click();
  if (label === 'エクストリーム') await page.screenshot({ path: 'shots/29-setup-modes.png' });
  await page.getByText('スタート！').click();
  await page.waitForSelector('.vcard');
  await pick(0, 3); await pick(1, 2); await pick(2, 5);
  const askBtns = page.getByRole('button', { name: '検証', exact: true });
  await askBtns.nth(0).click(); await askBtns.nth(0).click(); await askBtns.nth(0).click();
  console.log(label, '4th disabled:', await askBtns.first().isDisabled());
  if (label === 'エクストリーム') {
    const blocks = page.locator('.vcard').first().locator('.critblock');
    console.log(' critblocks per robot:', await blocks.count());
    await blocks.nth(1).locator('.crit').first().click(); // 2枚目のカードの要件にメモ
  } else {
    console.log(' robots:', await page.locator('.nm-robot').count(), 'cards:', await page.locator('.vcard').count());
    const a = page.locator('.vcard').first().locator('.assign-btn');
    await a.nth(0).click(); await a.nth(1).click(); await a.nth(1).click();
  }
  await page.screenshot({ path: `shots/${shot}.png` });
  const s = await saved();
  const p = s.session.problem;
  console.log(' mode:', p.mode, 'cards:', p.cards, p.cards2 ?? p.perm, '☆3≦', p.star3, '☆2≦', p.star2, 'memo saved:', label === 'エクストリーム' ? s.session.notes.crit[0] : s.session.notes.assign[0]);
  await page.getByText('解答する！').click();
  for (let c = 0; c < 3; c++) await gp(c, p.code[c]);
  await page.getByText('これで解答！').click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `shots/${shot}-result.png` });
  console.log(' result:', await page.locator('.result h2').innerText(), '|', (await page.locator('.reveal li').first().innerText()).replace(/\n/g, ' '));
  await page.getByText('ホームへ').click();
}
await page.getByText('プレイ履歴').click();
console.log('history tags:', await page.locator('.mode-tag').allInnerTexts());
await page.goBack();
await page.getByText('ソロ：チャレンジ').click();
await page.getByRole('radio', { name: /ナイトメア/ }).click();
await page.screenshot({ path: 'shots/32-challenge-nightmare.png' });
await page.locator('.tile').first().click();
await page.waitForSelector('.nm-robot');
const s2 = await saved();
console.log('challenge source:', JSON.stringify(s2.source), 'title:', await page.locator('.topbar-title').innerText());
await page.getByText('解答する！').click();
for (let c = 0; c < 3; c++) await gp(c, s2.session.problem.code[c]);
await page.getByText('これで解答！').click();
await page.waitForTimeout(500);
console.log('record:', await page.evaluate(() => localStorage.getItem('ar.challenge.v1')));
await page.getByText('ホームへ').click();
console.log('home stars:', await page.locator('.menu.m2 small').innerText());
console.log('errors:', errors);
await browser.close();
