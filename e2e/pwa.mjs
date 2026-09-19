// PWA の確認：Service Worker 登録後、オフラインでも起動してチャレンジが遊べること
import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/');
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForTimeout(1500);
const manifest = await (await page.request.get('http://localhost:4173/manifest.webmanifest')).json();
console.log('manifest:', manifest.name, manifest.display, manifest.icons.map((i) => i.sizes + (i.purpose ? ':' + i.purpose : '')).join(' '));
await ctx.setOffline(true);
await page.reload();
console.log('offline home:', await page.getByText('ソロ：エンドレス').isVisible());
await page.getByText('ソロ：チャレンジ').click();
await page.locator('.tile').nth(99).click();
await page.waitForSelector('.vcard');
console.log('offline challenge 100 robots:', await page.locator('.vcard').count());
await browser.close();
