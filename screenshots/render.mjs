import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../store/screenshots');
mkdirSync(outDir, { recursive: true });

const screens = process.argv.slice(2);
if (screens.length === 0) {
  screens.push('today', 'reconstitute', 'cycle', 'peptide', 'stacks');
}

const W = 412, H = 824, SCALE = 3;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: W, height: H },
  deviceScaleFactor: SCALE,
});

for (const name of screens) {
  const html = resolve(here, `${name}.html`);
  if (!existsSync(html)) { console.log(`skip (missing): ${name}.html`); continue; }
  await page.goto('file://' + html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(120);
  const out = resolve(outDir, `${name}.png`);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: H } });
  console.log(`rendered ${name} -> ${out} (${W*SCALE}x${H*SCALE})`);
}

await browser.close();
