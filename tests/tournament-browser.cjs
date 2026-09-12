const {chromium} = require('playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'output/tournament-browser');
const target = process.env.DUEL_TOURNAMENT_HTML || path.join(root, 'index.html');
const executablePath = process.env.DUEL_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const report = {checks:[], errors:[], geometry:[], artifact:target};
async function check(label, run) { await run(); report.checks.push(label); console.log('OK', label); }
async function shot(page, name) { await page.screenshot({path:path.join(out, name + '.png'), animations:'disabled'}); }
async function ready(page) { await page.waitForFunction(() => window.duelApp && document.documentElement.dataset.ready === 'true'); await page.evaluate(() => duelApp.tournament.ready); }
async function geometry(page, label) {
  const result = await page.evaluate(() => {
    const viewport = [innerWidth, innerHeight], doc = [document.documentElement.scrollWidth, document.documentElement.scrollHeight];
    const bar = document.querySelector('#tournament-viewer-bar'), board = document.querySelector('#duel-board');
    return {viewport, doc, viewing:document.body.classList.contains('tournament-viewing'),
      bar:bar && !bar.hidden ? (() => {const r = bar.getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};})() : null,
      board:board && document.body.dataset.screen === 'duel' ? (() => {const r = board.getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};})() : null};
  });
  result.label = label; report.geometry.push(result);
  assert.ok(result.doc[0] <= result.viewport[0] + 1, JSON.stringify(result));
  assert.ok(result.doc[1] <= result.viewport[1] + 1, JSON.stringify(result));
  if (!result.viewing) assert.equal(await page.locator('#mobile-turn-control').isVisible(), false, 'duel controls stay out of the tournament screen');
  if (result.bar) { assert.ok(result.bar.x >= 0 && result.bar.right <= result.viewport[0] + 1); assert.ok(result.board.y >= result.bar.bottom - 1, JSON.stringify(result)); }
}

(async () => {
  await fs.mkdir(out, {recursive:true});
  const browser = await chromium.launch({headless:true, executablePath, args:['--no-first-run', '--disable-background-networking', '--mute-audio']});
  const context = await browser.newContext({viewport:{width:1440,height:1000}, acceptDownloads:true});
  await context.route(/https?:\/\//, route => route.abort());
  await context.addInitScript(() => {
    if (!localStorage.getItem('tournament-browser-fixture')) {
      localStorage.setItem('duel-sanctuary-prefs-v1', JSON.stringify({sound:false,music:false,reducedMotion:true,speed:'fast'}));
      localStorage.setItem('duel-sanctuary-online-art-v2', 'false');
      localStorage.setItem('tournament-browser-fixture', 'true');
    }
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.setDefaultTimeout(18000);
  let customId, normalSave, normalState;
  try {
    await page.goto(pathToFileURL(target).href); await ready(page);
    await check('home and existing duel setup both expose the tournament entrance', async () => {
      assert.equal(await page.locator('[data-action="tournament"]').count(), 1);
      await page.click('[data-action="new-game"]');
      await page.click('[data-action="choose-mode"][data-value="tournament"]');
      await page.waitForSelector('.t-roster-grid');
      assert.equal(await page.locator('.t-seat').count(), 16);
      await geometry(page, 'setup 1440');
    });
    await check('local custom decks can fill multiple numbered seats and special characters stay text', async () => {
      customId = await page.evaluate(() => {
        const raw = DuelDecks.copy('blue'); raw.name = '青眼 <自定义> & "星耀"';
        return DuelDecks.save(raw).id;
      });
      await page.evaluate(() => { duelApp.showHome(); duelApp.showTournament(); });
      await page.waitForSelector('#t-seat-0');
      await page.locator('.t-advanced summary').click();
      await page.fill('#t-seed', '20260912'); await page.locator('#t-seed').blur();
      const presets = await page.evaluate(() => DuelDecks.list().filter(d => d.preset).map(d => d.id));
      for (const [i, id] of [...presets, customId, customId].entries()) await page.selectOption('#t-seat-' + i, id);
      const identities = await page.locator('.t-seat-identity strong').allTextContents();
      assert.ok(identities[14].endsWith('1号')); assert.ok(identities[15].endsWith('2号'));
      assert.ok(identities[14].includes('<自定义>'));
      assert.equal(await page.locator('.t-seat-identity 自定义').count(), 0);
      await page.fill('#t-name', '十六席 · 王座争夺战');
      await page.selectOption('#t-pace', 'fast');
      await shot(page, '01-roster-desktop');
      await page.click('[data-t-action="setup-tab"][data-value="preview"]');
      assert.equal(await page.locator('.t-match').count(), 15);
      assert.equal(await page.locator('.t-connectors path').count(), 14);
      await shot(page, '02-draw-preview');
      normalSave = await page.evaluate(() => localStorage.getItem('duel-sanctuary-save-v2'));
      normalState = await page.evaluate(() => JSON.stringify(duelApp.engine.snapshot()));
    });
    await check('sixteen entrants start four live matches and scheduler modes can switch', async () => {
      await page.click('[data-t-action="start"]');
      await page.waitForFunction(() => duelApp.tournament.current.progress().live === 4);
      await page.selectOption('[data-t-field="run-concurrency"]', '1');
      assert.equal(await page.evaluate(() => duelApp.tournament.current.data.settings.concurrency), 1);
      await page.selectOption('[data-t-field="run-concurrency"]', '4');
      await page.click('[data-t-action="toggle"]');
      assert.equal(await page.evaluate(() => duelApp.tournament.current.status), 'paused');
      const count = await page.evaluate(() => duelApp.tournament.current.matches.reduce((n,m) => n + m.games.reduce((n,g) => n + g.steps.length, 0), 0));
      await page.waitForTimeout(360);
      assert.equal(await page.evaluate(() => duelApp.tournament.current.matches.reduce((n,m) => n + m.games.reduce((n,g) => n + g.steps.length, 0), 0)), count);
      await shot(page, '03-live-bracket');
      await page.click('[data-t-action="toggle"]');
    });
    await check('live viewing, scrubbing and single-stepping use the real board without altering the regular save', async () => {
      await page.waitForFunction(() => duelApp.tournament.current.matches[0].games[0]?.steps.length >= 8);
      await page.click('.t-match[data-match="r1-m1"]');
      await page.waitForSelector('body.tournament-viewing');
      assert.equal(await page.evaluate(() => duelApp.tournament.viewer.live), true);
      const sliderHandle = await page.locator('#t-replay-slider').elementHandle();
      await page.waitForTimeout(450);
      assert.equal(await sliderHandle.evaluate(el => el.isConnected), true, 'live frames must not replace the range input');
      await geometry(page, 'live 1440'); await shot(page, '04-live-duel');
      await page.locator('#t-replay-slider').click({position:{x:1,y:7}});
      await page.waitForFunction(() => !duelApp.tournament.viewer.busy && duelApp.tournament.viewer.cursor.index === 0);
      assert.equal(await page.evaluate(() => JSON.stringify(duelApp.engine.snapshot()) === JSON.stringify(duelApp.tournament.current.matches[0].games[0].initial)), true);
      const before = await page.evaluate(() => duelApp.tournament.current.matches.reduce((n,m) => n + m.games.reduce((n,g) => n + g.steps.length, 0), 0));
      await page.waitForTimeout(380);
      assert.ok(await page.evaluate(() => duelApp.tournament.current.matches.reduce((n,m) => n + m.games.reduce((n,g) => n + g.steps.length, 0), 0)) > before);
      await page.click('[data-t-action="next-step"]');
      await page.waitForFunction(() => duelApp.tournament.viewer.cursor.index === 1 && !duelApp.tournament.viewer.busy);
      await page.click('[data-t-action="play"]');
      await page.waitForFunction(() => duelApp.tournament.viewer.cursor.index >= 2);
      await page.click('[data-t-action="play"]');
      assert.equal(await page.evaluate(() => duelApp.tournament.viewer.playing), false);
      await shot(page, '05-replay-theater');
      assert.equal(await page.evaluate(() => localStorage.getItem('duel-sanctuary-save-v2')), normalSave);
      assert.equal(await page.evaluate(() => duelApp.act({type:'end'})), false);
      await page.click('[data-t-action="go-live"]');
      await page.waitForFunction(() => duelApp.tournament.viewer.live);
      await page.selectOption('#t-watch-match', 'r1-m2');
      assert.equal(await page.evaluate(() => duelApp.tournament.viewer.matchId), 'r1-m2');
      await page.click('.t-back-arena');
      await page.waitForSelector('.t-bracket-panel');
      assert.equal(await page.evaluate(() => JSON.stringify(duelApp.engine.snapshot())), normalState);
      await page.click('[data-t-action="toggle"]');
      await page.evaluate(() => duelApp.tournament.flush());
    });
    await check('paused events survive reload and custom deck edits do not change enrolled decks', async () => {
      await page.evaluate(id => { const d = DuelDecks.getSaved().find(d => d.id === id); DuelDecks.save({...d,cards:[...DuelData.DECKS.dark.cards],extra:[...DuelData.DECKS.dark.extra]}); }, customId);
      const saved = await page.evaluate(() => ({id:duelApp.tournament.current.data.id, steps:duelApp.tournament.current.matches.map(m => m.games.map(g => g.steps.length))}));
      await page.reload(); await ready(page);
      assert.equal(await page.evaluate(() => duelApp.tournament.current.status), 'paused');
      assert.equal(await page.evaluate(() => duelApp.tournament.current.data.id), saved.id);
      assert.deepEqual(await page.evaluate(() => duelApp.tournament.current.matches.map(m => m.games.map(g => g.steps.length))), saved.steps);
      assert.equal(await page.evaluate(id => JSON.stringify(duelApp.tournament.current.data.decks[id].cards) === JSON.stringify(DuelData.DECKS.blue.cards), customId), true);
      await page.click('[data-action="tournament"]');
      await page.waitForSelector('.t-bracket-panel');
      for (const locale of ['en', 'ja', 'zh-CN']) {
        await page.selectOption('.header-tools [data-locale-select]', locale);
        assert.equal(await page.evaluate(() => duelApp.tournament.current.data.name), '十六席 · 王座争夺战');
        await shot(page, '06-bracket-' + locale);
      }
    });
    await check('all fourteen presets and two custom bots complete a real sixteen-player tournament', async () => {
      await page.selectOption('[data-t-field="run-pace"]', 'turbo');
      await page.selectOption('[data-t-field="run-concurrency"]', '8');
      await page.click('[data-t-action="toggle"]');
      await page.waitForFunction(() => duelApp.tournament.current.status === 'completed' || duelApp.tournament.current.progress().errors > 0, null, {timeout:180000});
      const result = await page.evaluate(() => ({status:duelApp.tournament.current.status, progress:duelApp.tournament.current.progress(), errors:duelApp.tournament.current.matches.filter(m => m.status === 'error').map(m => ({id:m.id,reason:m.reason})), champion:duelApp.tournament.current.data.championId}));
      assert.equal(result.status, 'completed', JSON.stringify(result));
      assert.equal(result.progress.played, 15); assert.equal(result.progress.remaining, 1); assert.ok(result.champion);
      assert.equal(await page.evaluate(() => duelApp.tournament.current.matches[7].games[0].initial.state.players.every(p => JSON.stringify(p.deckSpec.cards) === JSON.stringify(DuelData.DECKS.blue.cards))), true, 'future custom match uses the enrolled deck, even after editing the original');
      await page.waitForSelector('[data-t-action="watch-final"]');
      await shot(page, '07-champion');
      await page.click('[data-t-action="arena-tab"][data-value="standings"]');
      assert.equal(await page.locator('.t-standings tbody tr').count(), 16);
      assert.equal(await page.locator('.t-standings tbody tr.champion').count(), 1);
      await shot(page, '08-standings');
      await page.click('[data-t-action="arena-tab"][data-value="matches"]');
      assert.equal(await page.locator('.t-match-row').count(), 15);
      await page.click('[data-t-action="arena-tab"][data-value="bracket"]');
      report.tournament = await page.evaluate(() => ({progress:duelApp.tournament.current.progress(), matches:duelApp.tournament.current.matches.map(m => ({id:m.id,winner:m.winnerId,games:m.games.map(g => ({steps:g.steps.length,turn:g.final?.state.turn,verdict:g.verdict}))}))}));
    });
    await check('a completed event exports and imports with every recording preserved', async () => {
      const downloadPromise = page.waitForEvent('download'); await page.click('[data-t-action="export"]');
      const download = await downloadPromise, file = path.join(out, 'exported-tournament.json'); await download.saveAs(file);
      const exported = JSON.parse(await fs.readFile(file, 'utf8'));
      assert.equal(exported.format, 'duel-sanctuary-tournament'); assert.equal(exported.matches.length, 15);
      assert.ok(exported.matches.every(m => m.games[0].initial && m.games.at(-1).final));
      await page.click('[data-t-action="history"]');
      assert.equal(await page.locator('.t-history-card').count(), 1);
      const choose = page.waitForEvent('filechooser'); await page.click('[data-t-action="import"]');
      await (await choose).setFiles(file);
      await page.waitForSelector('.t-bracket-panel');
      assert.equal(await page.evaluate(() => duelApp.tournament.current.progress().played), 15);
      assert.match(await page.evaluate(() => duelApp.tournament.current.data.id), /^cup-import-/);
    });
    await check('mobile arena and replay layouts stay inside the viewport', async () => {
      await page.setViewportSize({width:390,height:844});
      await page.evaluate(() => document.getElementById('tournament-screen').scrollTop = 0);
      await geometry(page, 'arena 390'); await shot(page, '09-mobile-arena');
      await page.click('[data-t-action="watch-final"]');
      await page.waitForSelector('body.tournament-viewing');
      await geometry(page, 'replay 390'); await shot(page, '10-mobile-replay');
      await page.locator('#t-replay-slider').evaluate(el => { el.value = el.max; el.dispatchEvent(new Event('change', {bubbles:true})); });
      await page.waitForFunction(() => !duelApp.tournament.viewer.busy && duelApp.tournament.viewer.cursor.index === duelApp.tournament.viewer.cursor.game.steps.length);
      assert.equal(await page.evaluate(() => JSON.stringify(duelApp.engine.snapshot()) === JSON.stringify(duelApp.tournament.viewer.cursor.game.final)), true);
      for (const viewport of [{width:844,height:390}, {width:320,height:568}, {width:1024,height:768}]) {
        await page.setViewportSize(viewport); await geometry(page, 'replay ' + viewport.width); await shot(page, '11-replay-' + viewport.width);
      }
      await page.click('.t-back-arena');
      await page.setViewportSize({width:1440,height:1000});
    });
    await check('non-power-of-two rosters automatically advance byes and complete all real matches', async () => {
      await page.click('[data-t-action="new"]');
      await page.fill('#t-count', '6'); await page.locator('#t-count').blur();
      await page.waitForFunction(() => document.querySelectorAll('.t-seat').length === 6);
      for (let i = 0; i < 6; i++) await page.selectOption('#t-seat-' + i, i % 2 ? 'dark' : 'blue');
      await page.selectOption('#t-pace', 'turbo');
      await page.click('[data-t-action="start"]');
      await page.waitForFunction(() => duelApp.tournament.current.status === 'completed', null, {timeout:60000});
      assert.equal(await page.evaluate(() => duelApp.tournament.current.progress().byes), 2);
      assert.equal(await page.evaluate(() => duelApp.tournament.current.progress().played), 5);
      await shot(page, '12-six-bot-byes');
      await page.click('[data-t-action="new"]');
      await page.click('[data-t-action="setup-tab"][data-value="roster"]');
      await page.click('[data-t-action="count"][data-value="64"]');
      assert.equal(await page.locator('.t-seat').count(), 64);
      await page.setViewportSize({width:390,height:844});
      await geometry(page, 'setup 64 on mobile'); await shot(page, '13-mobile-setup-64');
    });
    await check('storage failures stay visible and unsaved events remain recoverable in this session', async () => {
      const isolated = await browser.newContext({viewport:{width:1024,height:768}});
      await isolated.route(/https?:\/\//, r => r.abort());
      await isolated.addInitScript(() => {
        localStorage.setItem('duel-sanctuary-prefs-v1', JSON.stringify({sound:false,music:false,reducedMotion:true}));
        localStorage.setItem('duel-sanctuary-online-art-v2', 'false');
        Object.defineProperty(window, 'indexedDB', {value:undefined});
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
          if (String(key).startsWith('duel-sanctuary-tournaments-v1')) throw new DOMException('Fixture storage quota', 'QuotaExceededError');
          return original.call(this, key, value);
        };
      });
      const limited = await isolated.newPage();
      try {
        await limited.goto(pathToFileURL(target).href + '#arena'); await ready(limited);
        await limited.fill('#t-count', '2'); await limited.locator('#t-count').blur();
        await limited.selectOption('#t-seat-0', 'blue'); await limited.selectOption('#t-seat-1', 'dark');
        await limited.click('[data-t-action="start"]');
        await limited.waitForSelector('.t-save-error');
        const id = await limited.evaluate(() => duelApp.tournament.current.data.id);
        await limited.click('[data-t-action="new"]');
        await limited.waitForSelector('.t-roster-grid');
        await limited.click('[data-t-action="history"]');
        assert.equal(await limited.locator('.t-history-card').count(), 1);
        await limited.click('.t-history-card');
        await limited.waitForSelector('.t-bracket-panel');
        assert.equal(await limited.evaluate(() => duelApp.tournament.current.data.id), id);
        assert.equal(await limited.evaluate(() => duelApp.tournament.current.status), 'paused');
        await limited.waitForSelector('.t-save-error');
      } finally { await isolated.close(); }
    });
    assert.deepEqual(report.errors, []);
  } catch (error) {
    report.failure = {message:error.message,stack:error.stack};
    console.error(error); await shot(page, 'failure').catch(() => {}); process.exitCode = 1;
  } finally {
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
})();
