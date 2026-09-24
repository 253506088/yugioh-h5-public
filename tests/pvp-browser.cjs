const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'output/pvp-browser');
const report = { ok: false, checks: [], errors: [], serverErrors: [], screenshots: [] };
let browser, app, pages = [], createPvpServer, ServerEngine, Data;
const check = title => { report.checks.push(title); console.log('PASS ' + title); };
const idle = page => page.waitForFunction(() => window.duelApp?.engine.remote && !duelApp.engine.busy && !duelApp.chainPlaying, { timeout: 20_000 });
const roomOf = () => [...app.service.rooms.values()][0];
async function noHorizontalOverflow(page){
  const dimensions=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,lobby:document.querySelector('#pvp-screen').scrollWidth,client:document.querySelector('#pvp-screen').clientWidth}));
  assert.ok(dimensions.document<=dimensions.viewport+1,JSON.stringify(dimensions));assert.ok(dimensions.lobby<=dimensions.client+1,JSON.stringify(dimensions));
}
async function shot(page, name) {
  if(name!=='failure')await page.waitForFunction(()=>!document.querySelector('#toast-stack .toast'),null,{timeout:7000});
  await page.screenshot({ path: path.join(out, name + '.png'), animations: 'disabled' }); report.screenshots.push(name + '.png');
}
async function load(page, url) { await page.goto(url, { waitUntil: 'load' }); await page.waitForFunction(() => window.duelApp && document.documentElement.dataset.ready === 'true'); }
function fixture(active = 0) {
  const room = roomOf(), engine = room.engine = new ServerEngine({ deck: 'blue', opponentDeck: 'dark', first: active });
  for (const p of engine.state.players) { p.deck.push(...p.hand); p.hand = []; }
  engine.state.turn = 6; engine.state.phase = 'main1';
  room.events = []; room.remaining = [300_000, 300_000]; room.clockAt = Date.now();
  return engine;
}
function put(e, owner, zone, name, attributes = {}) {
  const c = e.makeCard(Data.cardByName(name)?.id || name, owner); Object.assign(c, { faceUp: true, summonTurn: 0, setTurn: 0, changedTurn: 0 }, attributes);
  if (['monsters', 'spells'].includes(zone)) e.state.players[owner][zone][e.state.players[owner][zone].indexOf(null)] = c;
  else e.state.players[owner][zone].push(c);
  e.state.originalCardCount = e.physicalCards().filter(m => Data.CARDS[m.id].type !== 'token').length; return c;
}
async function publish() {
  const room = roomOf(); room.revision++; room.frames.clear(); app.service.broadcast(room);
  await Promise.all(pages.map(page => page.waitForFunction(revision => duelApp.pvp.room.revision === revision, room.revision)));
}
async function selectHand(page, id) {
  await idle(page);
  const uid = await page.evaluate(cardId => duelApp.engine.state.players[0].hand.find(c => c.id === cardId).uid, id);
  const command = await page.evaluate(uid => duelApp.engine.actionsFor(uid,0).findIndex(a=>a.type==='activate'), uid);
  assert.ok(command>=0);
  await page.locator(`#hand-cards [data-card-uid="${uid}"]`).click();
  await page.locator(`#card-popover [data-action="card-command"][data-command="${command}"]`).click();
}
async function respond(page) {
  await page.waitForFunction(() => duelApp.modalKind === 'pending' && duelApp.engine.state.pending?.responder === 0 && ['window', 'trigger'].includes(duelApp.engine.state.pending.kind));
  await page.locator('#modal [data-action="pending-response"]').first().click();
  await page.locator('#pending-confirm').click();
}
async function choose(page, count) {
  await page.waitForFunction(() => duelApp.modalKind === 'pending' && document.querySelectorAll('#modal [data-action="pending-pick"]').length > 0);
  for (let n = 0; n < count; n++) await page.locator('#modal [data-action="pending-pick"]').nth(n).click();
  await page.waitForFunction(() => !document.querySelector('#pending-confirm')?.disabled);
  await page.locator('#pending-confirm').click();
}
async function returnToRoom(page) {
  await page.waitForFunction(() => duelApp.modalKind === 'result');
  await page.locator('#modal [data-pvp-action="room"]').click();
  await page.waitForFunction(() => duelApp.screen === 'pvp');
}

(async () => {
  await fs.mkdir(out, { recursive: true });
  ({ createPvpServer } = await import('../server/index.mjs'));
  ({ ServerEngine, Data } = await import('../server/engine.mjs'));
  const database = path.join(out, 'run-' + Date.now() + '.sqlite');
  const start = async port => {
    app = await createPvpServer({ database, serviceOptions: { onError: error => report.serverErrors.push(error.stack) } });
    return app.listen(port || 0);
  };
  const address = await start(), url = `http://127.0.0.1:${address.port}`;
  let executablePath = process.env.DUEL_BROWSER;
  if (!executablePath) { const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'; try { await fs.access(edge); executablePath = edge; } catch {} }
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}), args: ['--disable-background-networking', '--mute-audio'] });
  const contexts = await Promise.all([0, 1].map(async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route(/https?:\/\//, route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await context.addInitScript(() => {
      localStorage.setItem('duel-sanctuary-welcomed-v3', 'true'); localStorage.setItem('duel-sanctuary-online-art-v2', 'false');
      localStorage.setItem('duel-sanctuary-prefs-v1', JSON.stringify({ sound: false, music: false, reducedMotion: true, responseMode: 'on', speed: 'fast', fontScale: 110 }));
    });
    return context;
  }));
  pages = await Promise.all(contexts.map(c => c.newPage())); const [a, b] = pages;
  for (const page of pages) page.on('pageerror', error => report.errors.push(error.stack));
  await Promise.all(pages.map(page => load(page, url + '/#pvp')));
  await Promise.all(pages.map(page => page.waitForFunction(() => duelApp.pvp.connected)));
  const offlineSave = await a.evaluate(() => localStorage.getItem('duel-sanctuary-save-v2'));
  await shot(a, '01-desktop-lobby');
  check('Production HTML connects two isolated browser sessions to a real HTTP/WebSocket server');

  await a.locator('#pvp-name').fill('星尘 Aster'); await a.locator('#pvp-deck').selectOption('blue');
  await a.locator('#pvp-room-title').fill('星夜对决'); await a.locator('#pvp-visibility').selectOption('private');
  await a.locator('#pvp-rule-mode').selectOption('random');
  await a.locator('[data-pvp-action="create"]').click(); await a.waitForFunction(() => !!duelApp.pvp.room);
  const code = await a.evaluate(() => duelApp.pvp.room.code);
  await b.locator('#pvp-name').fill('月影 Luna'); await b.locator('#pvp-deck').selectOption('dark'); await b.locator('#pvp-code').fill(code);
  await b.locator('#pvp-join-form button').click(); await a.waitForFunction(() => duelApp.pvp.room.seats.every(Boolean));
  await shot(a, '02-private-room');
  check('UI creates a private room, joins by code, and keeps the opponent’s deck private');
  for(let n=0;n<8;n++)await a.locator('[data-action="font-larger"]').click();
  for(const [width,height] of [[390,844],[320,568]]){
    await a.setViewportSize({width,height});await a.waitForTimeout(120);await noHorizontalOverflow(a);await shot(a,`02-room-${width}-150pct`);
  }
  await a.setViewportSize({width:1440,height:1000});for(let n=0;n<8;n++)await a.locator('[data-action="font-smaller"]').click();
  check('Room seats, readiness and invitation controls fit a 320px phone at 150% type size');
  await a.locator('[data-pvp-action="ready"]').click(); await b.locator('[data-pvp-action="ready"]').click();
  await Promise.all(pages.map(page => page.waitForFunction(() => duelApp.engine.remote && duelApp.screen === 'duel')));
  const decree=roomOf().engine.state.ruleMode.id;
  for(const page of pages){assert.equal(await page.evaluate(()=>duelApp.engine.state.ruleMode.id),decree);assert.ok(await page.locator('#fate-duel-bar').isVisible());}
  check('Fate room selects its rule on the server and both isolated clients show the same decree');
  for (let seat = 0; seat < 2; seat++) {
    const state = await pages[seat].evaluate(() => duelApp.engine.state);
    assert.deepEqual(state.players[0].hand.map(c => c.id), roomOf().engine.state.players[seat].hand.map(c => c.id));
    assert.ok(state.players[1].hand.every(c => !c.id && !c.uid)); assert.deepEqual(state.players[1].deckSpec.cards, []);
  }
  await shot(a, '03-online-board');
  const firstActor = roomOf().engine.state.active;
  await pages[firstActor].locator('#turn-panel [data-action="end"]').first().click();
  await pages[1 - firstActor].waitForFunction(() => duelApp.engine.state.active === 0);
  const steps = roomOf().actions; await new Promise(resolve => setTimeout(resolve, 1100)); assert.equal(roomOf().actions, steps);
  check('Both perspectives show the right hand; a real end-turn click transfers control and no local AI moves');

  let e = fixture(0); const pot = put(e, 0, 'hand', 'Pot of Greed');
  put(e, 0, 'spells', 'Seven Tools of the Bandit', { faceUp: false }); put(e, 1, 'spells', 'Magic Jammer', { faceUp: false }); put(e, 1, 'hand', 'Battle Ox');
  await publish(); await selectHand(a, pot.id); await respond(b); await choose(b, 1); await respond(a);
  await a.waitForFunction(() => duelApp.engine.state.chainHistory.length === 3 && duelApp.engine.state.chainHistory.every(c => c.finished));
  assert.equal(e.state.players[0].lp, 7000); assert.equal(e.state.players[0].hand.length, 2);
  assert.equal(e.state.chainHistory[1].status, 'negated');
  await shot(b, '04-chain-response');
  for (const page of pages) if (await page.locator('[data-action="skip-chain"]').isVisible()) await page.locator('[data-action="skip-chain"]').click();
  check('Real three-link chain: opponent response, discard cost, counter-trap, LP payment and reverse resolution');

  e = fixture(0); put(e, 0, 'monsters', 'Gene-Warped Warwolf'); put(e, 0, 'monsters', 'Gene-Warped Warwolf');
  const xyz = put(e, 0, 'extra', 'Number 39: Utopia'); await publish();
  await a.locator('[data-action="extra-menu"]').click();
  await a.locator(`.pile-entry:has([data-card-id="${xyz.id}"]) [data-action="pile-command"]`).first().click();
  await a.waitForFunction(() => duelApp.modalKind === 'pending' && duelApp.engine.state.pending?.purpose === 'extra');
  const pending = JSON.parse(JSON.stringify(e.state.pending));
  await a.reload(); await a.waitForFunction(() => window.duelApp?.engine.remote && duelApp.modalKind === 'pending');
  assert.deepEqual(e.state.pending, pending); assert.equal(await a.evaluate(() => localStorage.getItem('duel-sanctuary-save-v2')), offlineSave);
  await choose(a, 2); await a.waitForFunction(() => duelApp.engine.monsters(0).some(c => c.overlays?.length === 2));
  assert.equal(e.find(xyz.uid).card.overlays.length, 2);
  for (const page of pages) if (await page.locator('[data-action="skip-chain"]').isVisible()) await page.locator('[data-action="skip-chain"]').click();
  await shot(a, '05-xyz-materials');
  check('XYZ material selection is validated by the server; reload restores the pending choice and preserves the offline save');

  const beforeDisconnect = e.snapshot();
  await contexts[0].setOffline(true); await a.evaluate(() => duelApp.pvp.connection.socket.close(4000, 'Test interruption'));
  await b.waitForFunction(() => duelApp.pvp.room.clock.paused);
  assert.equal(await b.locator('.pvp-board-network').isVisible(), true);
  const remaining = [...roomOf().remaining]; await new Promise(resolve => setTimeout(resolve, 1200)); assert.deepEqual(roomOf().remaining, remaining);
  await contexts[0].setOffline(false); await a.waitForFunction(() => duelApp.pvp.connected && !duelApp.pvp.room.clock.paused);
  assert.deepEqual(e.snapshot(), beforeDisconnect);
  check('A real socket interruption pauses both clocks and automatically reconnects to the same duel');

  const beforeRestart = roomOf().engine.snapshot(); await app.close(); await start(address.port);
  await Promise.all(pages.map(page => page.waitForFunction(() => duelApp.pvp.connected && !duelApp.pvp.room.clock.paused, { timeout: 30_000 })));
  assert.deepEqual(roomOf().engine.snapshot(), beforeRestart);
  await shot(a, '06-restored-server');
  check('Restarting the HTTP/WebSocket process restores SQLite state and both browsers resume automatically');

  await a.locator('#pvp-duel-bar [data-pvp-action="surrender"]').click(); await a.locator('[data-pvp-action="confirm-surrender"]').click();
  await Promise.all(pages.map(page => page.waitForFunction(() => duelApp.pvp.room.status === 'finished')));
  assert.equal(roomOf().result.kind, 'surrender'); assert.equal(roomOf().result.winner, 1);
  await b.waitForFunction(() => duelApp.modalKind === 'result'); await shot(b, '07-server-confirmed-result');
  await b.setViewportSize({width:320,height:568});await b.evaluate(()=>duelApp.setLanguage('ja'));
  await b.waitForFunction(()=>[...document.querySelectorAll('#modal .modal-footer>button')].every(button=>{const r=button.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}));
  await shot(b,'07-result-mobile-exit');
  await b.setViewportSize({width:1440,height:1000});await b.evaluate(()=>duelApp.setLanguage('zh-CN'));
  await returnToRoom(a); const oldGameId = roomOf().gameId;
  await a.locator('[data-pvp-action="rematch"]').click();
  const invitation='星尘 Aster 已准备，希望与你再战一局';
  await b.waitForFunction(text=>document.querySelector('#pvp-result-notice')?.textContent.includes(text),invitation);
  assert.equal(await b.evaluate(()=>duelApp.modalKind),'result');
  assert.equal(roomOf().seats[1].rematch,false);
  app.service.broadcast(roomOf());app.service.broadcast(roomOf());await b.waitForTimeout(150);
  assert.equal(await b.locator('#toast-stack .toast').filter({hasText:invitation}).count(),1);
  await shot(b,'11-rematch-notice-result');
  await returnToRoom(b);
  assert.ok((await b.locator('#pvp-screen .pvp-peer-notice').textContent()).includes(invitation));
  await b.evaluate(()=>duelApp.setLanguage('en'));
  assert.match(await b.locator('#pvp-screen .pvp-peer-notice').textContent(),/星尘 Aster is ready and would like a rematch/);
  await b.evaluate(()=>duelApp.setLanguage('zh-CN'));
  await b.reload();await b.waitForFunction(()=>window.duelApp?.modalKind==='result'&&document.querySelector('#pvp-result-notice .pvp-peer-notice'));
  await returnToRoom(b);await shot(b,'11-rematch-notice-room');
  await b.locator('[data-pvp-action="rematch"]').click();
  await a.waitForFunction(() => duelApp.pvp.room.status === 'waiting');
  await a.locator('[data-pvp-action="ready"]').click();
  await b.waitForFunction(()=>document.querySelector('#pvp-screen .pvp-peer-notice[data-notice-kind="ready"]'));
  assert.match(await b.locator('#pvp-screen .pvp-peer-notice').textContent(),/星尘 Aster 已准备，等你一起开始下一局/);
  assert.equal(roomOf().status,'waiting');assert.equal(roomOf().seats[1].ready,false);
  await a.locator('[data-pvp-action="ready"]').click();
  await b.waitForFunction(()=>!document.querySelector('#pvp-screen .pvp-peer-notice'));
  await a.locator('[data-pvp-action="ready"]').click();
  await b.waitForFunction(()=>document.querySelector('#pvp-screen .pvp-peer-notice[data-notice-kind="ready"]'));
  await shot(b,'11-ready-notice-room');
  await b.locator('[data-pvp-action="ready"]').click();
  await a.waitForFunction(() => duelApp.pvp.room.status === 'playing'); assert.notEqual(roomOf().gameId, oldGameId);
  check('Named rematch and ready notices reach the peer, survive reload, deduplicate snapshots and clear on cancellation before a new BO1');

  await a.locator('#pvp-duel-bar [data-pvp-action="surrender"]').click(); await a.locator('[data-pvp-action="confirm-surrender"]').click();
  await a.waitForFunction(()=>duelApp.modalKind==='result');
  await a.locator('#modal [data-pvp-action="leave"]').click();
  await returnToRoom(b);await b.locator('.pvp-room-bottom [data-pvp-action="leave"]').scrollIntoViewIfNeeded();await shot(b,'10-room-leave-button');
  await b.locator('.pvp-room-bottom [data-pvp-action="leave"]').click();
  await Promise.all(pages.map(page => page.waitForFunction(() => !duelApp.pvp.room&&duelApp.screen==='pvp'&&!document.querySelector('#modal').open)));
  await a.locator('[data-pvp-action="quick"]').click(); await a.waitForSelector('[data-pvp-action="cancel-queue"]');
  await a.locator('[data-pvp-action="cancel-queue"]').click(); await a.waitForSelector('[data-pvp-action="quick"]');
  await a.locator('[data-pvp-action="quick"]').click(); await b.locator('[data-pvp-action="quick"]').click();
  await Promise.all(pages.map(page => page.waitForFunction(() => duelApp.engine.remote && duelApp.pvp.room.status === 'playing')));
  assert.equal(roomOf().visibility, 'private');
  check('Leaving from either the result or room returns to the lobby; quick matching can be cancelled and restarted');

  for(let n=0;n<8;n++)await a.locator('[data-action="font-larger"]').click();
  for(const [width,height] of [[390,844],[320,568],[844,390],[640,360]]){
    await a.setViewportSize({width,height});
    await a.waitForFunction(()=>['#pvp-duel-bar','#player-bar','#opponent-bar','#player-monsters','#opponent-monsters','#player-spells','#opponent-spells','#phase-track','#hand-zone'].every(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;}),null,{timeout:5000});
    const bounds=await a.evaluate(()=>['#pvp-duel-bar','#player-bar','#opponent-bar','#player-monsters','#opponent-monsters','#player-spells','#opponent-spells','#phase-track','#hand-zone'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {selector,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight};}));
    assert.ok(bounds.every(r=>r.left>=-1&&r.top>=-1&&r.right<=r.width+1&&r.bottom<=r.height+1),JSON.stringify(bounds));
    await shot(a,`09-board-${width}-${height}-150pct`);
  }
  await a.setViewportSize({width:1440,height:1000});for(let n=0;n<8;n++)await a.locator('[data-action="font-smaller"]').click();
  check('The live board, both clocks, hand and field stay inside mobile and short-landscape viewports at 150% type');

  await a.locator('#pvp-duel-bar [data-pvp-action="surrender"]').click(); await a.locator('[data-pvp-action="confirm-surrender"]').click();
  await Promise.all(pages.map(returnToRoom)); await a.locator('.pvp-room-bottom [data-pvp-action="leave"]').click(); await b.locator('.pvp-room-bottom [data-pvp-action="leave"]').click();
  await Promise.all(pages.map(page => page.waitForFunction(() => !duelApp.pvp.room)));
  for (const [width, height, language] of [[1440, 1000, 'zh-CN'], [1024, 768, 'en'], [390, 844, 'zh-CN'], [320, 568, 'ja'], [844, 390, 'en']]) {
    await a.setViewportSize({ width, height }); await a.evaluate(language => duelApp.setLanguage(language), language);
    await a.waitForTimeout(150);
    const dimensions = await a.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, lobby: document.querySelector('#pvp-screen').scrollWidth, client: document.querySelector('#pvp-screen').clientWidth }));
    assert.ok(dimensions.document <= width + 1, JSON.stringify(dimensions)); assert.ok(dimensions.lobby <= dimensions.client + 1, JSON.stringify(dimensions));
    await shot(a, `08-lobby-${width}-${height}-${language}`);
  }
  check('Chinese, English and Japanese lobbies fit desktop, tablet, 320px mobile and short landscape screens');
  await b.locator('[data-pvp-action="create"]').click();await b.waitForFunction(()=>!!duelApp.pvp.room);
  const oldToken=await b.evaluate(()=>duelApp.pvp.connection.session);
  const replacement=await contexts[1].newPage();replacement.on('pageerror',error=>report.errors.push(error.stack));
  await replacement.addInitScript(session=>sessionStorage.setItem('duel-sanctuary-pvp-session-v1:'+location.host,JSON.stringify(session)),oldToken);
  await load(replacement,url+'/#pvp');await replacement.waitForFunction(()=>duelApp.pvp.connected&&!!duelApp.pvp.room);
  await b.waitForFunction(()=>duelApp.pvp.connection.status==='replaced'&&!duelApp.pvp.room);
  await b.locator('[data-pvp-action="reconnect"]').click();await b.waitForFunction(()=>duelApp.pvp.connected);
  assert.equal(await b.evaluate(()=>duelApp.pvp.room),null);
  assert.notEqual(await b.evaluate(()=>duelApp.pvp.connection.session.token),oldToken.token);
  check('Session takeover releases the old page safely and lets it reconnect as a separate guest');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.serverErrors, []); report.ok = true;
})().catch(async error => {
  report.failure = error.stack; console.error(error);
  if (pages[0]) { try { await shot(pages[0], 'failure'); report.browserState = await pages[0].evaluate(() => ({ ready: !!window.duelApp, screen: window.duelApp?.screen, modal: window.duelApp?.modalKind, connection: window.duelApp?.pvp?.connection.status, pending: window.duelApp?.engine?.state.pending, toasts: document.querySelector('#toast-stack')?.textContent })); } catch {} }
  process.exitCode = 1;
}).finally(async () => {
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser?.close(); await app?.close(); console.log(JSON.stringify({ ok: report.ok, checks: report.checks.length, errors: report.errors.length, report: path.join(out, 'report.json') }));
});
