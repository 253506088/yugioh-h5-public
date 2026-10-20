const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const target = process.argv[2] || 'index.html';
  const label = process.argv[3] || 'current';
  const output = path.resolve('output/performance', label);
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.DUEL_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--mute-audio'] });
  const report = { at: new Date().toISOString(), target, label, profiles: [] };
  try {
    for (const profile of [{ name: 'desktop', width: 1920, height: 1080, cpu: 1 }, { name: 'mobile-cpu4', width: 360, height: 800, cpu: 4 }]) {
      const context = await browser.newContext({ viewport: profile, isMobile: profile.width === 360, hasTouch: profile.width === 360 });
      await context.addInitScript(() => {
        localStorage.setItem('duel-sanctuary-welcomed-v3', 'true');
        localStorage.setItem('duel-sanctuary-online-art-v2', 'false');
        localStorage.setItem('duel-sanctuary-prefs-v1', JSON.stringify({ sound: false, music: false, reducedMotion: true }));
        window.perfSamples = { tasks: [], lcp: [] };
        new PerformanceObserver(list => window.perfSamples.tasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true });
        new PerformanceObserver(list => window.perfSamples.lcp.push(...list.getEntries().map(e => e.startTime))).observe({ type: 'largest-contentful-paint', buffered: true });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
      await page.goto(/^https?:/.test(target) ? target : pathToFileURL(path.resolve(target)).href, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForFunction(() => document.documentElement.dataset.ready === 'true' || document.documentElement.dataset.bootReady === 'true', null, { timeout: 120000 });
      const home = await page.evaluate(() => ({ readyMs: performance.now(), ...window.perfSamples, resources: performance.getEntriesByType('resource').map(e => ({ name: e.name, encoded: e.encodedBodySize, decoded: e.decodedBodySize })) }));
      await page.screenshot({ path: path.join(output, profile.name + '-home.png') });
      // Paint entries can arrive after the boot script marks the page ready.
      await page.waitForTimeout(100);
      Object.assign(home,await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];return {lcp:window.perfSamples.lcp,paint:performance.getEntriesByType('paint').map(e=>({name:e.name,start:e.startTime})),navigation:{encoded:n.encodedBodySize,decoded:n.decodedBodySize,transfer:n.transferSize}};}));
      if (!await page.evaluate(() => !!window.duelApp)) {
        await page.click('#home-continue');
        await page.waitForFunction(() => !!window.duelApp, null, { timeout: 120000 });
      }
      await page.evaluate(() => { duelApp.newGame({deck:'early-ritual',opponentDeck:'early-fusion',first:0,seed:48}); });
      await page.waitForTimeout(250);
      const duel = await page.evaluate(() => {
        const rect = sel => { const el = document.querySelector(sel), r = el?.getBoundingClientRect(); return r ? { width: r.width, height: r.height } : null; };
        return { readyMs: performance.now(), zone: rect('.zone-row .zone'), hand: rect('.hand-slot'), overflow: document.documentElement.scrollWidth > innerWidth, tasks: window.perfSamples.tasks };
      });
      await page.screenshot({ path: path.join(output, profile.name + '-duel.png') });
      report.profiles.push({ ...profile, home, duel, errors });
      await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
      console.log(profile.name, JSON.stringify({ homeMs: home.readyMs, duelMs: duel.readyMs, longTasks: home.tasks.length, tbtMs: home.tasks.reduce((n, e) => n + Math.max(0, e.duration - 50), 0), zone: duel.zone, hand: duel.hand, errors }));
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
