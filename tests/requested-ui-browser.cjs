const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output', 'requested-ui-browser');
const report = { ok: false, checks: [], errors: [], requests: [] };

async function check(name, fn) {
  await fn();
  report.checks.push(name);
  console.log('OK', name);
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.DUEL_BROWSER ? { executablePath: process.env.DUEL_BROWSER } : { executablePath: edge }),
      args: ['--no-first-run', '--disable-background-networking', '--mute-audio']
    });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(() => {
      localStorage.setItem('duel-sanctuary-welcomed-v3', 'true');
      localStorage.setItem('duel-sanctuary-online-art-v2', 'false');
      localStorage.setItem('duel-sanctuary-prefs-v1', JSON.stringify({ sound: false, music: false, reducedMotion: true, responseMode: 'on' }));
    });
    await context.route(/https?:\/\//, route => route.abort());
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.stack || error.message));
    page.on('request', request => {
      if (/^https?:/.test(request.url())) report.requests.push(request.url());
    });

    await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');

    await check('own and opponent deck selectors support search', async () => {
      await page.click('#home-screen [data-action="new-game"]');
      await page.waitForSelector('#setup-deck-search');

      await page.fill('#setup-deck-search', 'blue');
      const ownCount = await page.locator('#setup-deck-roster [data-action="choose-deck"]').count();
      assert.ok(ownCount > 0 && ownCount < 38, `unexpected own-deck result count: ${ownCount}`);
      const ownIds = await page.locator('#setup-deck-roster [data-action="choose-deck"]').evaluateAll(elements => elements.map(element => element.dataset.deck));
      assert.ok(ownIds.length === ownCount && ownIds.every(Boolean));
      assert.equal(await page.locator('#setup-year').isVisible(), true);

      await page.fill('#opponent-deck-search', '2012');
      assert.equal((await page.locator('#opponent-search-count').textContent()).trim(), '3 / 38');
      const opponentOptions = await page.locator('#opponent-deck option').allTextContents();
      assert.ok(opponentOptions.some(text => text.includes('2012')));
      assert.equal(await page.locator('#opponent-deck').isVisible(), true);
    });

    await check('difficulty and turn-order changes preserve deck scroll position', async () => {
      await page.fill('#setup-deck-search', '');
      const roster = page.locator('#setup-deck-roster');
      await roster.evaluate(element => { element.scrollTop = Math.max(120, element.scrollHeight - element.clientHeight - 20); });
      const before = await roster.evaluate(element => element.scrollTop);
      await page.click('[data-action="choose-difficulty"][data-value="casual"]');
      assert.equal(await roster.evaluate(element => element.scrollTop), before);
      await page.click('[data-action="choose-first"][data-value="1"]');
      assert.equal(await roster.evaluate(element => element.scrollTop), before);
    });

    await check('selection dialog separates cards by controller', async () => {
      const ids = await page.evaluate(() => {
        const e = new DuelEngine({ deck: 'early-ritual', opponentDeck: 'early-fusion', first: 0, seed: 991 });
        e.state.turn = 3;
        e.state.active = 0;
        e.state.phase = 'main1';
        for (const player of e.state.players) { player.hand = []; player.deck.push(...player.hand); }
        const put = (owner, zone, name) => {
          const id = DuelData.cardByName(name).id;
          const card = e.makeCard(id, owner);
          Object.assign(card, { faceUp: true, position: 'attack', summonTurn: 0, changedTurn: 0, setTurn: 0 });
          const player = e.state.players[owner];
          if (zone === 'monsters') player.monsters[player.monsters.indexOf(null)] = card;
          else player.hand.push(card);
          return card.uid;
        };
        const moon = put(0, 'hand', 'Book of Moon');
        const own = put(0, 'monsters', 'Battle Ox');
        const opponent = put(1, 'monsters', 'Dark Magician');
        e.state.originalCardCount = e.physicalCards().filter(card => DuelData.CARDS[card.id].type !== 'token').length;
        const result = e.act({ type: 'activate', uid: moon, key: DuelData.cardByName('Book of Moon').id + '::cast' });
        if (!result.ok) throw new Error(result.error);
        duelApp.restore(e.snapshot());
        return { own, opponent };
      });

      await page.waitForSelector('#modal [data-action="pending-pick"]');
      assert.equal(await page.locator('.selection-side-heading[data-selection-side="0"]').count(), 1);
      assert.equal(await page.locator('.selection-side-heading[data-selection-side="1"]').count(), 1);
      assert.equal(await page.locator('[data-action="pending-pick"][data-selection-owner="0"]').count(), 1);
      assert.equal(await page.locator('[data-action="pending-pick"][data-selection-owner="1"]').count(), 1);
      assert.match(await page.locator(`[data-action="pending-pick"][data-uid="${ids.own}"]`).getAttribute('aria-label'), /我方/);
      assert.match(await page.locator(`[data-action="pending-pick"][data-uid="${ids.opponent}"]`).getAttribute('aria-label'), /对方/);
    });

    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.requests, []);
    report.ok = true;
  } finally {
    if (browser) await browser.close();
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  }
  console.log(JSON.stringify(report, null, 2));
})().catch(error => {
  report.errors.push(error.stack || String(error));
  console.error(error.stack || error);
  process.exitCode = 1;
});
