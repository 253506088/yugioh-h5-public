const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const { DuelEngine } = require('../src/engine.js');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.resolve(path.dirname(process.execPath), '../node_modules/playwright'))); }
const root = path.resolve(__dirname, '..');
const screenshots = path.join(root, 'output/screenshots', 'interactions-' + new Date().toISOString().replace(/[:.]/g, '-'));
const checks = [], errors = [], externalRequests = [];
function fresh() {
  const g = new DuelEngine({ seed: 45, first: 0 });
  g.state.turn = 2; g.state.log = [];
  for (const p of g.state.players) { p.hand = []; p.monsters = Array(5).fill(null); p.spells = Array(5).fill(null); p.grave = []; }
  return g;
}
function put(g, owner, zone, id, props = {}) {
  const card = Object.assign(g.makeCard(id, owner), props), target = g.state.players[owner][zone];
  if (['spells', 'monsters'].includes(zone)) target[target.indexOf(null)] = card;
  else target.push(card);
  return card;
}
let browser, page;
(async () => {
  await fs.mkdir(screenshots, { recursive: true });
  browser = await chromium.launch({ headless: true, executablePath: process.env.DUEL_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', args: ['--no-first-run', '--disable-background-networking'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    localStorage.setItem('duel-sanctuary-prefs-v1', JSON.stringify({ sound: false, reducedMotion: true, speed: 'normal' }));
    localStorage.setItem('duel-sanctuary-welcomed-v1', 'true');
  });
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) externalRequests.push(request.url()); });
  const gameUrl = pathToFileURL(path.join(root, 'index.html')).href;
  await page.goto(gameUrl); await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  const restore = async game => { await page.evaluate(saved => duelApp.restore(saved), game.snapshot()); };
  const locateHand = async id => await page.evaluate(cardId => duelApp.engine.state.players[0].hand.find(c => c.id === cardId)?.uid, id);
  const useHand = async (id, command) => {
    const uid = await locateHand(id); assert.ok(uid, 'Missing hand card ' + id);
    await page.click('.hand-slot[data-card-uid="' + uid + '"]');
    await page.click('#card-popover [data-command="' + command + '"]');
    return uid;
  };
  const state = async () => await page.evaluate(() => duelApp.engine.snapshot());

  const heights = await page.evaluate(() => [...document.querySelectorAll('.zone-row')].map(e => Math.round(e.getBoundingClientRect().height)));
  assert.ok(heights.every(h => h === heights[0]), 'Monster/spell rows must have equal height');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.ok(await page.evaluate(() => document.getElementById('hand-cards').getBoundingClientRect().bottom <= innerHeight + 2), 'Hand is visible in a 900px viewport');
  checks.push('Consistent field slots and the complete hand fit the desktop viewport');

  await page.locator('#opponent-spells .has-card').first().click();
  assert.match(await page.locator('#card-information').innerText(), /未知的卡牌/);
  checks.push('Face-down opponent cards remain hidden during inspection');
  const kaibaUid = await useHand('kaibaman', 'summon-attack');
  assert.equal((await state()).state.normalUsed, true);
  await page.click('#player-monsters [data-card-uid="' + kaibaUid + '"]');
  await page.click('#card-popover [data-command="effect"]');
  let s = (await state()).state;
  assert.equal(s.players[0].monsters.filter(Boolean)[0].id, 'blue-eyes');
  assert.equal(s.players[0].grave.find(c => c.uid === kaibaUid).id, 'kaibaman');
  checks.push('Real clicks summon Kaibaman and activate its Blue-Eyes special summon');

  const mstUid = await locateHand('mst');
  await useHand('mst', 'cast');
  assert.equal(await page.evaluate(() => duelApp.intent.kind), 'target');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => duelApp.intent), null);
  assert.ok((await state()).state.players[0].hand.some(c => c.uid === mstUid));
  await useHand('mst', 'cast'); await page.locator('#opponent-spells .has-card').first().click();
  assert.ok((await state()).state.players[1].grave.some(c => c.id === 'negate-attack'));
  checks.push('A spell target can be cancelled without cost, then selected and destroyed');
  await useHand('mirror-force', 'set'); await useHand('magic-cylinder', 'set');
  s = (await state()).state;
  assert.equal(s.players[0].spells.filter(Boolean).length, 2);
  await page.screenshot({ path: path.join(screenshots, '01-ready-to-battle.png'), fullPage: true });
  const savedBeforeReload = (await state()).state;
  await page.reload(); await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  assert.deepEqual((await state()).state, savedBeforeReload);
  checks.push('An in-progress duel survives a complete file reload');

  await page.click('#turn-panel [data-action="phase"][data-phase="battle"]');
  const attacker = (await state()).state.players[0].monsters.find(Boolean);
  const defender = (await state()).state.players[1].monsters.find(Boolean);
  await page.click('#player-monsters [data-card-uid="' + attacker.uid + '"]');
  await page.click('#card-popover [data-command="attack"]');
  assert.equal(await page.evaluate(() => duelApp.intent.kind), 'attack');
  await page.click('#opponent-monsters [data-card-uid="' + defender.uid + '"]');
  assert.equal((await state()).state.players[1].lp, 6900);
  assert.equal((await state()).state.players[1].monsters.filter(Boolean).length, 0);
  checks.push('Battle-phase buttons, target picking, destruction, and LP updates agree');
  await page.screenshot({ path: path.join(screenshots, '02-blue-eyes-battle.png'), fullPage: true });

  const tribute = fresh(), t1 = put(tribute, 0, 'monsters', 'battle-ox'), t2 = put(tribute, 0, 'monsters', 'celtic-guardian'), high = put(tribute, 0, 'hand', 'blue-eyes');
  await restore(tribute);
  await useHand('blue-eyes', 'summon-attack');
  await page.click('#player-monsters [data-card-uid="' + t1.uid + '"]');
  await page.keyboard.press('Escape'); assert.equal((await state()).state.players[0].monsters.filter(Boolean).length, 2);
  await useHand('blue-eyes', 'summon-attack');
  await page.click('#player-monsters [data-card-uid="' + t1.uid + '"]');
  await page.click('#player-monsters [data-card-uid="' + t2.uid + '"]');
  await page.click('[data-action="confirm-tribute"]');
  assert.equal((await state()).state.players[0].monsters.find(Boolean).uid, high.uid);
  assert.equal((await state()).state.players[0].grave.length, 2);
  checks.push('Tribute selection supports cancellation, unique choices, and confirmation');

  const revive = fresh(), departed = put(revive, 1, 'grave', 'dark-magician');
  put(revive, 0, 'hand', 'monster-reborn'); await restore(revive);
  await useHand('monster-reborn', 'cast');
  assert.equal(await page.locator('#selection-confirm').isDisabled(), true);
  await page.click('.selection-card[data-uid="' + departed.uid + '"]');
  await page.click('#selection-confirm');
  s = (await state()).state;
  assert.equal(s.players[0].monsters.find(Boolean).id, 'dark-magician');
  assert.equal(s.players[0].monsters.find(Boolean).originalOwner, 1);
  checks.push('The revival picker takes a monster from the opposing graveyard');

  const fusion = fresh(); for (let i = 0; i < 3; i++) put(fusion, 0, 'hand', 'blue-eyes');
  put(fusion, 0, 'hand', 'polymerization'); await restore(fusion);
  await useHand('polymerization', 'cast');
  assert.match(await page.locator('#modal-title').innerText(), /融合/);
  await page.locator('.selection-card').first().click(); await page.click('#selection-confirm');
  s = (await state()).state; assert.equal(s.players[0].monsters.find(Boolean).id, 'ultimate-dragon');
  assert.equal(s.players[0].grave.filter(c => c.id === 'blue-eyes').length, 3);
  await page.screenshot({ path: path.join(screenshots, '03-fusion-summon.png'), fullPage: true });
  checks.push('Fusion selection consumes three Blue-Eyes and summons the Ultimate Dragon');

  const response = fresh(); response.state.active = 1; response.state.turn = 3; response.state.phase = 'battle';
  const attacking = put(response, 1, 'monsters', 'blue-eyes'), mirror = put(response, 0, 'spells', 'mirror-force', { faceUp: false, setTurn: 2 });
  put(response, 0, 'spells', 'magic-cylinder', { faceUp: false, setTurn: 2 });
  response.act({ type: 'attack', uid: attacking.uid }); await restore(response);
  await page.locator('.response-modal').waitFor();
  await page.screenshot({ path: path.join(screenshots, '04-chain-response.png'), fullPage: true });
  await page.reload(); await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  await page.locator('.response-modal').waitFor();
  assert.equal(await page.locator('#response-confirm').isDisabled(), true);
  await page.click('.selection-card[data-uid="' + mirror.uid + '"]'); await page.click('#response-confirm');
  s = (await state()).state; assert.equal(s.players[0].lp, 8000); assert.equal(s.players[1].monsters.filter(Boolean).length, 0);
  assert.ok(s.players[0].spells.some(c => c && c.id === 'magic-cylinder'));
  checks.push('Trap responses resume after reload, activate the chosen card, and preserve the other trap');

  const discard = fresh(); for (let i = 0; i < 8; i++) put(discard, 0, 'hand', 'battle-ox');
  await restore(discard); await page.click('#turn-panel [data-action="end"]');
  await page.locator('#selection-confirm').waitFor();
  assert.equal(await page.evaluate(() => duelApp.modalKind), 'discard');
  await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => document.getElementById('modal').open), true);
  await page.locator('.selection-card').nth(0).click(); await page.locator('.selection-card').nth(1).click();
  await page.click('#selection-confirm'); s = (await state()).state;
  assert.equal(s.players[0].hand.length, 6); assert.equal(s.active, 1);
  checks.push('The mandatory end-phase discard cannot be skipped and advances only after confirmation');

  const victory = fresh(); victory.state.phase = 'battle'; victory.state.players[1].lp = 2000;
  const winningDragon = put(victory, 0, 'monsters', 'blue-eyes'); await restore(victory);
  await page.click('#player-monsters [data-card-uid="' + winningDragon.uid + '"]');
  await page.click('#card-popover [data-command="attack"]');
  await page.locator('.duel-result').waitFor();
  assert.match(await page.locator('#modal-title').innerText(), /胜利/);
  await page.screenshot({ path: path.join(screenshots, '05-victory.png'), fullPage: true });
  await page.click('[data-action="close-modal"]');
  assert.equal((await state()).state.winner, 0);
  checks.push('Direct lethal damage displays the result and allows returning to the final board');

  await page.locator('.heading-right [data-action="new-game"]').click();
  await page.click('[data-action="choose-deck"][data-deck="dark"]');
  await page.click('[data-action="choose-first"][data-value="0"]');
  await page.click('[data-action="choose-difficulty"][data-value="casual"]');
  await page.click('[data-action="begin-game"]');
  s = (await state()).state;
  assert.equal(s.players[0].deckId, 'dark'); assert.equal(s.active, 0); assert.equal(s.turn, 1); assert.equal(s.players[0].hand.length, 5); assert.equal(s.difficulty, 'casual');
  assert.equal(await page.locator('#turn-panel .primary-button').innerText(), '结束先攻回合');
  checks.push('New-game options apply the selected deck, turn order, and difficulty');

  for (const [width, height] of [[1366, 768], [1920, 1080], [1024, 768]]) {
    await page.setViewportSize({ width, height });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Overflow at ' + width + '×' + height);
    if (width >= 1081) assert.ok(await page.evaluate(() => document.getElementById('hand-cards').getBoundingClientRect().bottom <= innerHeight + 2), 'Hand does not fit at ' + width + '×' + height);
    await page.screenshot({ path: path.join(screenshots, 'layout-' + width + 'x' + height + '.png'), fullPage: true });
  }
  checks.push('1366×768, 1920×1080, and tablet layouts have no horizontal overflow');

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const phone = await mobileContext.newPage(); phone.on('pageerror', e => errors.push(e.message));
  await phone.goto(gameUrl); await phone.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  assert.equal(await phone.locator('#mobile-turn-control').isVisible(), true);
  const mobileKaiba = await phone.evaluate(() => duelApp.engine.state.players[0].hand.find(c => c.id === 'kaibaman').uid);
  await phone.locator('.hand-slot[data-card-uid="' + mobileKaiba + '"]').tap();
  const popoverBounds = await phone.locator('#card-popover').boundingBox();
  assert.ok(popoverBounds.x >= 0 && popoverBounds.x + popoverBounds.width <= 390);
  await phone.locator('#card-popover [data-command="summon-attack"]').tap();
  assert.equal(await phone.evaluate(() => duelApp.engine.state.players[0].monsters.find(Boolean).id), 'kaibaman');
  await phone.locator('#player-monsters [data-card-uid="' + mobileKaiba + '"]').tap();
  await phone.locator('#card-popover [data-command="effect"]').tap();
  assert.equal(await phone.evaluate(() => duelApp.engine.state.players[0].monsters.find(Boolean).id), 'blue-eyes');
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await phone.screenshot({ path: path.join(screenshots, '06-mobile-touch-duel.png'), fullPage: true });
  checks.push('Touch taps can summon and activate effects, with an always-visible phase control');

  assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []);
  checks.push('No JavaScript exceptions and no HTTP requests in standalone offline play');
  const report = { ok: true, count: checks.length, checks, screenshots: path.relative(root, screenshots), externalRequests, errors };
  await fs.writeFile(path.join(root, 'output/interaction-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(async error => {
  console.error(error);
  if (page) await page.screenshot({ path: path.join(screenshots, 'failure.png'), fullPage: true }).catch(() => {});
  await fs.writeFile(path.join(root, 'output/interaction-failure.json'), JSON.stringify({ error: error.message, completedChecks: checks, errors, externalRequests, screenshots: path.relative(root, screenshots) }, null, 2));
  process.exitCode = 1;
}).finally(async () => { if (browser) await browser.close(); });
