const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'output/ai-import');
const checks = [], errors = [], requests = [];
const check = async (name, fn) => { await fn(); checks.push(name); console.log('OK', name); };
(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.DUEL_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--no-first-run', '--disable-background-networking', '--mute-audio'] });
  let app;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(() => {
      localStorage.setItem('duel-sanctuary-welcomed-v3', 'true'); localStorage.setItem('duel-sanctuary-online-art-v2', 'false');
      localStorage.setItem('duel-sanctuary-prefs-v1', JSON.stringify({ sound: false, music: false, reducedMotion: true }));
    });
    let modelOutput = null, responseDelay = 0, lastBody = null, secondFailure = false;
    await context.route('https://fixture.example/**', async route => {
      requests.push(route.request().url()); lastBody = route.request().postDataJSON();
      if (responseDelay) await new Promise(resolve => setTimeout(resolve, responseDelay));
      const second = lastBody.response_format?.json_schema?.schema?.properties?.items;
      if (second && secondFailure) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"fixture failure"}' });
      const payload = second ? { items: JSON.parse(lastBody.messages[1].content[0].text).map(input => ({ input, isCard: true, zh: '青眼白龙', en: 'Blue-Eyes White Dragon', ja: '青眼の白龍' })) } : modelOutput;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ model: 'fixture-model', choices: [{ message: { content: lastBody.max_tokens === 128 ? 'OK' : JSON.stringify(payload) } }] }) }).catch(() => {});
    });
    await context.route(/https?:\/\/(?!fixture\.example)/, route => route.abort());
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    const entry = pathToFileURL(path.resolve(root, process.env.DUEL_AI_TEST_PAGE || 'index.html')).href;
    await page.goto(entry); await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
    const click = action => page.locator('[data-ai-action="' + action + '"]').click();
    const workshop = async () => { await page.evaluate(() => duelApp.showWorkshop()); await page.click('[data-action="ws-ai-import"]'); };
    await check('offline example matches real pool and requires confirmation for Chinese OCR/collisions', async () => {
      await workshop(); await page.screenshot({ path: path.join(output, 'input-desktop.png') });
      await click('sample'); await click('run'); await page.waitForSelector('.ai-card-grid');
      assert.equal(await page.locator('[data-status="ambiguous"]').count(), 2); assert.equal(await page.locator('[data-status="not-in-pool"]').count(), 1);
      assert.match(await page.locator('.ai-summary').innerText(), /7/); assert.equal(requests.length, 0);
      await page.screenshot({ path: path.join(output, 'results-desktop.png') });
      await page.selectOption('[data-ai-candidate="main-4"]', '0'); await page.selectOption('[data-ai-candidate="main-5"]', '0');
      await click('wish'); assert.equal(await page.locator('[data-ai-action="wish"]').isDisabled(), true);
      await click('load'); const draft = await page.evaluate(() => duelApp.workshopDraft);
      assert.equal(draft.cards.length, 8); assert.equal(draft.extra.length, 1); assert.match(draft.notes, /14558127/); assert.equal(draft.cards.includes('blue-eyes'), true);
      await page.click('[data-action="ws-undo"]'); assert.equal((await page.evaluate(() => duelApp.workshopDraft)).cards.length, 0);
      await page.click('[data-action="ws-redo"]'); assert.equal((await page.evaluate(() => duelApp.workshopDraft)).cards.length, 8);
    });
    await check('settings persist, mask key, test connection and fully localize in English and Japanese', async () => {
      await workshop(); await click('edit'); await click('settings');
      await page.fill('[data-ai-config="baseUrl"]', 'https://fixture.example'); await page.fill('[data-ai-config="apiKey"]', 'test-browser-key');
      await page.fill('[data-ai-config="model"]', 'fixture-model'); await page.selectOption('[data-ai-config="openaiEndpoint"]', 'chat-completions');
      assert.equal(await page.locator('[data-ai-config="apiKey"]').getAttribute('type'), 'password');
      await click('save-settings'); await click('test'); await page.waitForFunction(() => document.querySelector('.ai-settings-feedback')?.textContent.includes('fixture-model'));
      for (const language of ['en', 'ja']) { await page.selectOption('#modal .locale-select', language); await page.waitForSelector('#ai-provider-form'); assert.ok(!(await page.locator('#ai-provider-form').innerText()).includes('令牌')); }
      await page.selectOption('#modal .locale-select', 'zh-CN');
      await page.screenshot({ path: path.join(output, 'settings-desktop.png') }); await click('settings-back');
    });
    await check('multi-deck model extraction, original text safety, save/export and note persistence', async () => {
      const valid = await page.evaluate(() => {
        const preset = Object.values(DuelData.DECKS).find(d => d.preset && DuelDecks.analyze(d).valid);
        const convert = list => { const counts = new Map(); for (const id of list) { const name = DuelCardLocales[id].locales.en.name; counts.set(name, (counts.get(name) || 0) + 1); } return [...counts].map(([name, count]) => ({ name, count, language: 'en' })); };
        return { name: 'Model fixture', main: convert(preset.cards), extra: convert(preset.extra), side: [], uncertain: ['Original note <script>alert(1)</script>'] };
      });
      modelOutput = { decks: [{ name: 'Needs review', main: [{ name: 'zzzzzzzzzzzz', count: 1, language: 'unknown' }], extra: [], side: [], uncertain: [] }, valid] };
      await page.fill('#ai-source-text', 'Please read these two deck lists from the supplied article.'); await click('run'); await page.waitForSelector('.ai-deck-list');
      assert.equal(await page.locator('.ai-deck-list button').count(), 2);
      await page.fill('#ai-rename-main-0', 'Blue-Eyes White Dragon'); await click('resolve'); assert.equal(await page.locator('[data-status="playable"]').count(), 1);
      await page.click('[data-ai-action="deck"][data-index="1"]'); assert.equal(await page.locator('.ai-validation.valid').count(), 1);
      assert.ok(!JSON.stringify(lastBody).includes('test-browser-key')); assert.equal(await page.locator('#modal script').count(), 0);
      await click('load'); await page.click('[data-action="ws-save"]');
      const saved = await page.evaluate(() => DuelDecks.getSaved().find(v => v.name === 'Model fixture')); assert.ok(saved?.id); assert.match(saved.notes, /Original note/);
      const exported = await page.evaluate(() => DuelDecks.exportJSON(duelApp.workshopDraft)); assert.ok(!exported.includes('test-browser-key')); assert.ok(!exported.includes('baseUrl'));
      await page.reload(); await page.waitForFunction(() => document.documentElement.dataset.ready === 'true'); await page.evaluate(() => duelApp.showWorkshop());
      assert.match(await page.locator('#ws-notes').inputValue(), /Original note/);
    });
    await check('YDK file aliases work offline, side cards can move into construction', async () => {
      await workshop(); await page.setInputFiles('#ai-list-file', { name: 'fixture.ydk', mimeType: 'text/plain', buffer: Buffer.from('#main\n89631140\n#extra\n!side\n97268402') });
      const before = requests.length; await click('run'); await page.waitForSelector('.ai-card-grid'); assert.equal(requests.length, before);
      await click('move'); assert.equal(await page.locator('[data-ai-zone="side"] .ai-card-row').count(), 0);
      await click('load'); assert.deepEqual((await page.evaluate(() => duelApp.workshopDraft)).cards, ['blue-eyes', 'early-97268402']);
    });
    await check('image preprocessing, vision payload and mobile layout at large font size', async () => {
      await workshop(); await click('edit'); await page.click('[data-ai-action="tab"][data-tab="images"]');
      const buffer = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#ece9d5' } }).png().toBuffer();
      await page.setInputFiles('#ai-image-files', { name: 'deck.png', mimeType: 'image/png', buffer }); await page.waitForSelector('.ai-thumbnail');
      modelOutput = { decks: [{ name: 'Image deck', main: [{ name: 'Blue-Eyes White Dragon', count: 3, language: 'en' }], extra: [], side: [], uncertain: [] }] };
      await click('run'); await page.waitForSelector('.ai-card-grid'); const content = lastBody.messages[1].content;
      assert.match(content[1].image_url.url, /^data:image\/jpeg;base64,/);
      const metadata = await sharp(Buffer.from(content[1].image_url.url.split(',')[1], 'base64')).metadata(); assert.equal(metadata.width, 1568);
      await page.setViewportSize({ width: 390, height: 844 });
      for (const language of ['zh-CN', 'en', 'ja']) {
        await page.selectOption('#modal .locale-select', language); await page.evaluate(() => document.documentElement.style.setProperty('--ui-scale', '1.5'));
        const geometry = await page.evaluate(() => { const modal = document.querySelector('#modal'), footer = modal.querySelector('.modal-footer').getBoundingClientRect(); return { width: innerWidth, scroll: modal.scrollWidth, client: modal.clientWidth, bottom: footer.bottom }; });
        assert.ok(geometry.scroll <= geometry.client + 2, JSON.stringify(geometry)); assert.ok(geometry.bottom <= 844);
        await page.screenshot({ path: path.join(output, 'mobile-' + language + '.png') });
      }
      await page.selectOption('#modal .locale-select', 'zh-CN'); await page.setViewportSize({ width: 1440, height: 1000 });
    });
    await check('cancelled response cannot replace the current modal', async () => {
      await click('edit'); await page.click('[data-ai-action="tab"][data-tab="text"]'); await page.fill('#ai-source-text', 'An unstructured article with a deck list.');
      responseDelay = 500; await click('run'); await page.waitForSelector('.ai-progress'); await click('cancel');
      await page.waitForTimeout(650); assert.equal(await page.locator('#ai-source-text').count(), 1); responseDelay = 0;
    });
    await check('second-pass names require local verification and confirmation; failure preserves first pass', async () => {
      await page.evaluate(() => DuelAIProvider.save({ ...DuelAIProvider.load(), secondPass: true }));
      modelOutput = { decks: [{ name: 'Second pass', main: [{ name: 'zzzzzzzzzzzz', count: 1, language: 'unknown' }], extra: [], side: [], uncertain: [] }] };
      await click('run'); await page.waitForSelector('[data-status="ambiguous"]');
      assert.equal(await page.locator('[data-status="playable"]').count(), 0);
      assert.deepEqual(JSON.parse(lastBody.messages[1].content[0].text), ['zzzzzzzzzzzz']);
      await page.selectOption('[data-ai-candidate="main-0"]', '0'); assert.equal(await page.locator('[data-status="playable"]').count(), 1);
      secondFailure = true; await click('edit'); await click('run'); await page.waitForSelector('[data-status="unknown"]');
      assert.match(await page.locator('.ai-notice').innerText(), /第二轮/); secondFailure = false;
      await page.evaluate(() => DuelAIProvider.save({ ...DuelAIProvider.load(), secondPass: false }));
    });
    await check('invalid imported zoning remains visible after reload instead of dropping cards', async () => {
      await click('edit'); await page.fill('#ai-source-text', '主卡组\n1 No.39 希望皇 霍普'); await click('run'); await page.waitForSelector('.ai-card-grid');
      assert.equal(await page.locator('.ai-validation.valid').count(), 0); await click('load');
      assert.deepEqual((await page.evaluate(() => duelApp.workshopDraft)).cards, ['utopia']);
      await page.reload(); await page.waitForFunction(() => document.documentElement.dataset.ready === 'true'); await page.evaluate(() => duelApp.showWorkshop());
      assert.deepEqual((await page.evaluate(() => duelApp.workshopDraft)).cards, ['utopia']);
    });
    await check('server capability, URL extraction and proxy routing work through the browser', async () => {
      const { createPvpServer } = await import('../server/index.mjs');
      app = await createPvpServer({ database: ':memory:', aiOptions: { env: {}, pageFetch: async () => new Response('<h1>Main Deck</h1><p>3 Blue-Eyes White Dragon</p>', { headers: { 'Content-Type': 'text/html' } }) } });
      const address = await app.listen(0), base = 'http://127.0.0.1:' + address.port;
      await context.unroute(/https?:\/\/(?!fixture\.example)/); await page.goto(base); await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
      await workshop(); await page.click('[data-ai-action="tab"][data-tab="url"]'); await page.waitForFunction(() => !document.querySelector('#ai-page-url')?.disabled);
      await page.fill('#ai-page-url', 'https://public.example/deck'); await click('run'); await page.waitForSelector('.ai-card-grid');
      assert.equal(await page.locator('[data-status="playable"]').count(), 1);
    });
    assert.deepEqual(errors, []);
  } finally { if (app) await app.close(); await browser.close(); await fs.writeFile(path.join(output, 'browser-report.json'), JSON.stringify({ checks, errors, requests }, null, 2)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
