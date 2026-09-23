const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'output/ai-research');
const checks = [], errors = [], modelCalls = [], webCalls = [];
(async () => {
  await fs.mkdir(output, { recursive: true });
  const { createPvpServer } = await import('../server/index.mjs');
  require('../src/card-locales.js');
  const D = globalThis.DuelData, preset = Object.values(D.DECKS).find(d => d.preset && globalThis.DuelDecks.analyze(d).valid);
  const passwords = ids => JSON.stringify(ids.map(id => String(D.CARDS[id].providerId || DuelCardLocales[id].providerId)));
  const record = { deckNum: 100, deck_name: 'Verified source fixture', username: 'Fixture Author', pretty_url: 'verified-source-100', format: 'Public fixture', deck_description: 'Source recipe for a playable deck.', main_deck: passwords(preset.cards), extra_deck: passwords(preset.extra), side_deck: '[]' };
  const blue=D.DECKS.blue,galaxyId=D.cardByName('Galaxy-Eyes Photon Dragon').id;
  const blueRecord={...record,deckNum:101,pretty_url:'blue-eyes-101',deck_name:'Blue-Eyes source',main_deck:passwords(blue.cards),extra_deck:passwords(blue.extra)};
  const galaxyRecord={...record,deckNum:102,pretty_url:'galaxy-eyes-102',deck_name:'Galaxy-Eyes source',main_deck:passwords(blue.cards.map(id=>id==='blue-eyes'?galaxyId:id)),extra_deck:passwords(blue.extra)};
  let behavior = 'valid', delay = 0, buildAttempts = 0;
  const app = await createPvpServer({ database: ':memory:', aiOptions: { env: {},
    searchFetch: async (url, options) => {
      webCalls.push({ url, headers: options.headers }); assert.ok(!JSON.stringify(options.headers).includes('research-test-key'));
      if (behavior === 'unavailable') return new Response('temporarily unavailable', { status: 503 });
      const query=new URL(url).searchParams.get('name');
      return Response.json(behavior === 'empty' ? { error: 'No decks found' } : [behavior==='multi'?(query.includes('Galaxy')?galaxyRecord:blueRecord):record]);
    },
    completeFetch: async (_url, options) => {
      const body = JSON.parse(options.body), schema = body.response_format.json_schema.schema, input = JSON.parse(body.messages[1].content[0].text);
      const operation = schema.properties.queries ? 'plan' : schema.properties.recommendations ? 'rank' : 'build';
      modelCalls.push({ operation, input }); if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      let value;
      if (operation === 'plan') value = { summary: 'Find source-backed decks.', maxYear: 0, championshipYear: 0, targets: [], anchorCards: [], queries: [{ query: 'Fixture', format: 'any' }], warnings: [] };
      else if (operation === 'rank') value = { recommendations: [{ sourceId: input.sources[0].id, rationale: 'Matches the request.' }], warnings: [] };
      else {
        buildAttempts++;
        const source = input.sources[0], convert = zone => source.cards[zone].map(({ name, count }) => ({ name, count, language: 'en' }));
        value = { decks: [{ name: 'Web-built fixture', main: convert('main'), extra: convert('extra'), side: [], uncertain: [], rationale: 'Built from the retrieved source.', changes: [] }], warnings: [] };
        if (behavior === 'repairAlways' || behavior === 'repair' && !input.repairInstruction) value.decks[0].main.pop();
        if (behavior === 'hallucination') value.decks[0].main[0].name = 'Completely invented card';
      }
      return Response.json({ model: 'fixture-model', choices: [{ message: { content: JSON.stringify(value) } }] });
    }
  } });
  const address = await app.listen(0), base = 'http://127.0.0.1:' + address.port;
  const browser = await chromium.launch({ executablePath: process.env.DUEL_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--mute-audio'] });
  const check = async (name, fn) => { await fn(); checks.push(name); console.log('OK', name); };
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      localStorage.setItem('duel-sanctuary-welcomed-v3', 'true'); localStorage.setItem('duel-sanctuary-online-art-v2', 'false');
      localStorage.setItem('duel-sanctuary-prefs-v1', JSON.stringify({ sound: false, music: false, reducedMotion: true }));
      localStorage.setItem('duel-sanctuary-ai-provider-v1', JSON.stringify({ protocol: 'openai', openaiEndpoint: 'chat-completions', transport: 'server', baseUrl: 'https://model.fixture.example', apiKey: 'research-test-key', model: 'fixture' }));
    });
    await page.route('https://**/*', route => route.abort());
    await page.goto(base); await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
    const click = action => page.locator('[data-ai-action="' + action + '"]').click();
    await page.evaluate(() => duelApp.showWorkshop()); await page.click('[data-action="ws-ai-import"]'); await page.click('[data-ai-action="tab"][data-tab="research"]');
    await page.waitForFunction(() => !document.querySelector('[data-ai-action="run"]').disabled);
    await check('description triggers real server search orchestration and a source-backed playable build', async () => {
      await page.fill('#ai-research-request', 'Build a playable deck using actual public source lists.');
      await page.screenshot({ path: path.join(output, 'research-input-desktop.png') });
      await click('run'); await page.waitForSelector('.ai-research-evidence');
      assert.deepEqual(modelCalls.map(c => c.operation), ['plan', 'build']); assert.equal(webCalls.length, 1);
      assert.equal(await page.locator('.ai-validation.valid').count(), 1); assert.ok(await page.locator('.ai-card-provenance a').count() > 0);
      await page.click('.ai-source-library>summary');
      assert.match(await page.locator('.ai-web-source').innerText(), /Fixture Author/);
      assert.equal(await page.locator('.ai-web-source>a').getAttribute('href'), 'https://ygoprodeck.com/deck/verified-source-100');
      assert.equal(await page.locator('.ai-verified-changes').count(), 1);
      await page.click('.ai-source-library>summary');
      await page.screenshot({ path: path.join(output, 'research-results-desktop.png') });
    });
    await check('source review is unchanged, and saving/exporting preserves citations without secrets', async () => {
      const calls = modelCalls.length; await page.click('.ai-source-library>summary'); await click('source-deck'); assert.equal(modelCalls.length, calls);
      await click('load'); await page.click('[data-action="ws-save"]');
      const draft = await page.evaluate(() => duelApp.workshopDraft); assert.equal(draft.cards.length, preset.cards.length);
      assert.match(draft.notes, /https:\/\/ygoprodeck.com\/deck\/verified-source-100/);
      const exported = await page.evaluate(() => DuelDecks.exportJSON(duelApp.workshopDraft)); assert.ok(!exported.includes('research-test-key'));
      await page.click('[data-action="ws-ai-import"]'); await click('edit');
    });
    await check('a failed quantity check gets exactly one repair before a valid build is shown', async () => {
      behavior = 'repair'; const before = buildAttempts; await click('run'); await page.waitForSelector('.ai-validation.valid');
      assert.equal(buildAttempts - before, 2); assert.ok(modelCalls.at(-1).input.repairInstruction);
      await click('edit');
    });
    await check('fabricated cards fail both checks and fall back only to retrieved originals', async () => {
      behavior = 'hallucination'; const before = buildAttempts; await click('run'); await page.waitForSelector('.ai-research-evidence');
      assert.equal(buildAttempts - before, 2); assert.match(await page.locator('.ai-evidence-heading').innerText(), /来源原构筑/);
      assert.ok(!(await page.locator('.ai-card-grid').allInnerTexts()).join('').includes('Completely invented'));
      assert.match((await page.locator('.ai-notice').allInnerTexts()).join(' '), /原牌表/); await click('edit');
    });
    await check('repeated small count mistakes are completed using actual source quantities and disclosed',async()=>{
      behavior='repairAlways';const before=buildAttempts;await click('run');await page.waitForSelector('.ai-validation.valid');assert.equal(buildAttempts-before,2);
      assert.match(await page.locator('.ai-research-evidence').textContent(),/本地依据来源/);await click('edit');
    });
    await check('empty or unavailable searches do not ask the model to invent a deck', async () => {
      for (const mode of ['empty', 'unavailable']) { behavior = mode; const before = modelCalls.length; await click('run'); await page.waitForSelector('#ai-research-request'); assert.equal(modelCalls.length - before, 1); assert.equal(await page.locator('.ai-card-grid').count(), 0); }
    });
    await check('original-list recommendation and three mobile languages retain working controls', async () => {
      behavior = 'valid'; await page.selectOption('#ai-research-mode', 'copy'); await click('run'); await page.waitForSelector('.ai-research-evidence'); assert.equal(modelCalls.at(-1).operation, 'rank');
      await page.setViewportSize({ width: 390, height: 844 });
      for (const language of ['zh-CN', 'en', 'ja']) {
        await page.selectOption('#modal .locale-select', language);
        const layout = await page.evaluate(() => { const m = document.querySelector('#modal'); return { scroll: m.scrollWidth, client: m.clientWidth, footer: m.querySelector('.modal-footer').getBoundingClientRect().bottom }; });
        assert.ok(layout.scroll <= layout.client + 2, JSON.stringify(layout)); assert.ok(layout.footer <= 844);
        assert.ok(!(await page.locator('.ai-research-evidence').innerText()).includes('undefined'));
        await page.screenshot({ path: path.join(output, 'research-mobile-' + language + '.png') });
      }
      await page.selectOption('#modal .locale-select', 'zh-CN'); await page.setViewportSize({ width: 1440, height: 1000 }); await click('edit');
    });
    await check('cancellation cannot resurrect a late search or model result', async () => {
      delay = 700; await click('run'); await page.waitForSelector('.ai-progress'); await click('cancel'); await page.waitForTimeout(900);
      assert.equal(await page.locator('#ai-research-request').count(), 1); assert.equal(await page.locator('.ai-card-grid').count(), 0);
    });
    await check('one description creates separate Galaxy-Eyes and Blue-Eyes decks with separate source evidence',async()=>{
      delay=0;behavior='multi';await page.selectOption('#ai-research-mode','adapt');await page.fill('#ai-research-request','弄一套银河眼卡组和一套青眼补强卡组');const before=modelCalls.length;
      await click('run');await page.waitForSelector('.ai-result-layout');assert.equal(await page.locator('.ai-deck-list button').count(),2);
      assert.deepEqual(modelCalls.slice(before).map(c=>c.operation),['build','build']);assert.match(await page.locator('.ai-result-name').innerText(),/银河眼/);
      assert.equal(await page.locator('.ai-web-source>a').getAttribute('href'),'https://ygoprodeck.com/deck/galaxy-eyes-102');
      await page.click('[data-ai-action="deck"][data-index="1"]');assert.match(await page.locator('.ai-result-name').innerText(),/青眼/);assert.equal(await page.locator('.ai-web-source>a').getAttribute('href'),'https://ygoprodeck.com/deck/blue-eyes-101');
    });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close(); await app.close();
    await fs.writeFile(path.join(output, 'browser-report.json'), JSON.stringify({ checks, errors, modelCalls: modelCalls.map(v => v.operation), searches: webCalls.map(v => v.url) }, null, 2));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
