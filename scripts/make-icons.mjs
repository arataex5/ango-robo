// assets-src/icon.svg から PWA アイコン PNG を作る（開発時のみ使用）。実行: node scripts/make-icons.mjs
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';

const svg = readFileSync('assets-src/icon.svg', 'utf8');
mkdirSync('public/icons', { recursive: true });
const browser = await chromium.launch();
const shot = async (file, size, pad, rounded) => {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const inner = Math.round(size * (1 - pad * 2));
  await page.setContent(
    `<body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${rounded ? 'transparent' : '#FFC93C'}">
     <div style="width:${inner}px;height:${inner}px;${rounded ? `border-radius:${size * 0.22}px;overflow:hidden` : ''}">${svg}</div></body>`,
  );
  await page.screenshot({ path: file, omitBackground: true });
  await page.close();
};
await shot('public/icons/icon-192.png', 192, 0, true);
await shot('public/icons/icon-512.png', 512, 0, true);
await shot('public/icons/apple-touch-icon.png', 180, 0, false);
await shot('public/icons/icon-maskable-512.png', 512, 0.1, false);
// Capacitor（APK）用：@capacitor/assets が読む素材
mkdirSync('assets', { recursive: true });
await shot('assets/icon-only.png', 1024, 0, false);
await shot('assets/icon-foreground.png', 1024, 0.17, true);
{
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
  await page.setContent('<body style="margin:0;background:#FFC93C"></body>');
  await page.screenshot({ path: 'assets/icon-background.png' });
  await page.close();
}
await browser.close();
