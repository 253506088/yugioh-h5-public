const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.resolve(path.dirname(process.execPath), '../node_modules/playwright'))); }
const root = path.resolve(__dirname, '..'), out = path.join(root, 'output/screenshots', 'final-' + new Date().toISOString().replace(/[:.]/g, '-'));
let browser;
(async () => {
  await fs.mkdir(out, { recursive: true });
  browser = await chromium.launch({ headless: true, executablePath: process.env.DUEL_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', args: ['--disable-background-networking', '--no-first-run'] });
  const report = { ok: true, screenshots: path.relative(root, out), layouts: [], errors: [] };
  for (const [width, height, mobile] of [[1440, 900, false], [1440, 1000, false], [1366, 768, false], [1920, 1080, false], [1024, 768, false], [390, 844, true], [360, 800, true]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
    await context.addInitScript(() => localStorage.setItem('duel-sanctuary-welcomed-v1', 'true'));
    const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
    const layout = await page.evaluate(() => ({
      width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth,
      handBottom: Math.max(...[...document.querySelectorAll('.hand-slot')].map(el => el.getBoundingClientRect().bottom)),
      mobileControlTop: getComputedStyle(document.getElementById('mobile-turn-control')).display === 'none' ? null : document.getElementById('mobile-turn-control').getBoundingClientRect().top,
      fieldHeights: [...document.querySelectorAll('.zone-row')].map(el => Math.round(el.getBoundingClientRect().height)),
      brokenImages: [...document.images].filter(image => !image.complete || image.naturalWidth === 0).length
    }));
    assert.equal(layout.overflow, false, 'Overflow at ' + width);
    assert.ok(layout.fieldHeights.every(h => h === layout.fieldHeights[0]), 'Inconsistent card slots');
    assert.equal(layout.brokenImages, 0);
    if (width >= 761) assert.ok(layout.handBottom < height, 'Hand clipped at ' + width + '×' + height);
    if (mobile) assert.ok(layout.handBottom < layout.mobileControlTop + 2, 'Floating toolbar overlaps cards at ' + width + '×' + height);
    await page.screenshot({ path: path.join(out, 'duel-' + width + 'x' + height + '.png'), fullPage: true });
    if (width === 1440 && height === 900) {
      await page.click('[data-action="library"]'); await page.screenshot({ path: path.join(out, 'card-library.png'), fullPage: true });
      await page.click('#library-grid [data-card-id="blue-eyes"]'); await page.screenshot({ path: path.join(out, 'blue-eyes-detail.png'), fullPage: true });
      await page.click('#modal [data-action="close-modal"]');
      await page.click('.heading-right [data-action="new-game"]'); await page.screenshot({ path: path.join(out, 'deck-selection.png'), fullPage: true });
    }
    report.layouts.push(layout); await context.close();
  }
  assert.deepEqual(report.errors, []);
  await fs.writeFile(path.join(root, 'output/visual-qa-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); });
