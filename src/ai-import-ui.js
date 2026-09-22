(function (root) {
  'use strict';
  const P = root.DuelAIProvider, t = root.DuelAIImportText, esc = root.DuelView.escape;
  const WISHES = 'duel-sanctuary-ai-wishlist-v1', zones = ['main', 'extra', 'side'];
  const button = (action, label, className = 'ai-small-button', attrs = '') => '<button type="button" class="' + className + '" data-ai-action="' + action + '" ' + attrs + '>' + esc(label) + '</button>';
  const icon = name => '<svg class="icon" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  const cardName = item => item.id ? root.DuelI18n.name(item.id) : item.names?.[root.DuelI18n.language] || item.names?.en || item.original;
  const errorHTML = e => '<div class="ai-error" role="alert"><strong>' + esc(t('errorTitle')) + '</strong><div>' + esc(t('err_' + (e.code || 'request'))) + '</div>' + (e.preview ? '<pre>' + esc(e.preview) + '</pre>' : '') + '</div>';
  function create(host) {
    let resolver, tab = 'text', text = '', url = '', images = [], imageContext = '', decks = [], selected = 0;
    let view = 'input', screen = 'import', error = null, warnings = [], controller = null, stage = 0, busy = false, imageBusy = false;
    let server = false, configDraft = P.load(), revealKey = false, feedback = '', format = '', generation = 0;
    let settingsReturn = 'import', settingsView = 'input';
    let wishlist = [];
    try { const saved = JSON.parse(localStorage.getItem(WISHES) || '[]'); if (Array.isArray(saved)) wishlist = saved.filter(v => v && typeof v.password === 'string' && v.names).slice(0, 2000); } catch {}
    const getResolver = () => resolver ||= root.DuelCardResolver.create();
    const $ = s => document.querySelector('#modal ' + s);
    function cancel() { generation++; controller?.abort(); controller = null; busy = false; }
    async function detectServer() {
      if (!/^https?:$/.test(location.protocol)) return;
      try { const response = await fetch('/api/ai/info', { signal: AbortSignal.timeout(2500), credentials: 'omit' }); if (response.ok) server = (await response.json()).available === true; } catch {}
    }
    const probe = detectServer();
    function open(body, footer) {
      const previous = document.querySelector('#modal'), active = document.activeElement;
      const viewKey = screen + '-' + view + (view === 'results' ? '-' + selected : '');
      const preserve = previous?.querySelector('[data-ai-view]')?.dataset.aiView === viewKey;
      const scroll = preserve ? previous.querySelector('.modal-body').scrollTop : 0;
      const focusedConfig = preserve ? active?.dataset.aiConfig : null, focusedId = preserve ? active?.id : null;
      host.open(screen === 'settings' ? 'ai-settings' : 'ai-import', screen === 'settings' ? t('settings') : t('title'), 'THE DECK READER · ' + t('subtitle'),
        '<div class="ai-import-shell" data-i18n-skip data-ai-view="' + viewKey + '">' + body + '</div>', '<div class="ai-import-shell ai-actions-row" data-i18n-skip>' + footer + '</div>', 'ai-import-modal');
      const modal = document.querySelector('#modal');
      modal.querySelector('.modal-body').scrollTop = scroll;
      if (focusedConfig) modal.querySelector('[data-ai-config="' + focusedConfig + '"]')?.focus({ preventScroll: true });
      else if (focusedId) document.getElementById(focusedId)?.focus({ preventScroll: true });
      modal.querySelector('.modal-header h2')?.setAttribute('data-i18n-skip', '');
      modal.onclick = event => { const b = event.target.closest('[data-ai-action]'); if (b && !b.disabled) void action(b.dataset.aiAction, b); };
      modal.oninput = event => input(event.target);
      modal.onchange = event => void change(event.target);
      modal.ondragover = event => { if (event.target.closest('.ai-dropzone,[data-ai-zone]')) { event.preventDefault(); event.target.closest('.ai-dropzone')?.classList.add('dragging'); } };
      modal.ondragleave = event => event.target.closest('.ai-dropzone')?.classList.remove('dragging');
      modal.ondrop = event => {
        if (event.target.closest('.ai-dropzone')) { event.preventDefault(); void addImages([...event.dataTransfer.files]); }
        const zone = event.target.closest('[data-ai-zone]')?.dataset.aiZone;
        if (zone && zone !== 'side') { const value = event.dataTransfer.getData('text/duel-side'); if (/^\d+$/.test(value)) { event.preventDefault(); moveSide(Number(value), zone); } }
      };
      modal.ondragstart = event => { const row = event.target.closest('[data-side-index]'); if (row) event.dataTransfer.setData('text/duel-side', row.dataset.sideIndex); };
      modal.onkeydown = event => {
        if (event.target.getAttribute('role') !== 'tab' || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); const tabs = ['text', 'images', 'url'], index = tabs.indexOf(tab);
        tab = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3]; renderInput(); $('#ai-tab-' + tab)?.focus();
      };
    }
    function show() { screen = 'import'; busy = false; if (view === 'progress') view = 'input'; render(); void probe.then(() => { if ($('#ai-url-panel') || $('#ai-provider-form')) render(); }); }
    function showSettings(from = 'settings') { cancel(); settingsReturn = from; settingsView = view === 'progress' ? 'input' : view; screen = 'settings'; configDraft = P.load(); error = null; feedback = ''; render(); void probe.then(() => { if ($('#ai-provider-form')) render(); }); }
    function render() {
      if (screen === 'settings') return renderSettings();
      if (view === 'results') return renderResults();
      if (view === 'progress') return renderProgress();
      renderInput();
    }
    function renderInput() {
      const intro = '<div class="ai-intro"><div><h3>' + esc(t('intro')) + '</h3><p>' + esc(t('description')) + '</p></div><div class="ai-local-seal"><b>LOCAL FIRST</b><span>' + esc(t('offline')) + '</span></div></div>';
      const tabs = '<div class="ai-source-tabs" role="tablist">' + [['text', 'text', 'book'], ['images', 'images', 'card'], ['url', 'urlTab', 'arrow']].map(([id, label, glyph]) => '<button type="button" role="tab" id="ai-tab-' + id + '" aria-controls="ai-source-panel" aria-selected="' + (tab === id) + '" data-ai-action="tab" data-tab="' + id + '">' + icon(glyph) + esc(t(label)) + '</button>').join('') + '</div>';
      let body;
      if (tab === 'text') body = '<label for="ai-source-text">' + esc(t('sourceText')) + '</label><textarea id="ai-source-text" spellcheck="false" placeholder="' + esc(t('placeholder')) + '">' + esc(text) + '</textarea><div class="ai-text-meta">' + button('file', t('file')) + button('sample', t('sample')) + '<span id="ai-text-size">' + new TextEncoder().encode(text).length.toLocaleString() + ' / 60,000 bytes</span></div><input type="file" id="ai-list-file" accept=".ydk,.txt,.json,text/plain,application/json" hidden>';
      else if (tab === 'images') body = '<button type="button" class="ai-dropzone" data-ai-action="images" ' + (imageBusy ? 'disabled' : '') + '>' + icon('card') + '<strong>' + esc(t('upload')) + '</strong><p>' + esc(t('imageHelp')) + '</p></button><input type="file" id="ai-image-files" accept="image/jpeg,image/png,image/webp" multiple hidden><div class="ai-thumbnails">' + images.map((img, index) => '<div class="ai-thumbnail"><img src="' + img.data + '" alt="' + esc(img.name) + '"><small>' + esc(img.name) + ' · ' + img.width + ' × ' + img.height + '</small>' + button('remove-image', t('remove'), 'ai-small-button', 'data-index="' + index + '"') + '</div>').join('') + '</div><label>' + esc(t('imageContext')) + '<input id="ai-image-context" maxlength="1000" value="' + esc(imageContext) + '"></label>';
      else body = '<div id="ai-url-panel"><label>' + esc(t('pageUrl')) + '<input type="url" id="ai-page-url" placeholder="https://…" value="' + esc(url) + '" ' + (!server ? 'disabled' : '') + '></label><p class="ai-notice">' + esc(t(server ? 'urlHelp' : 'static')) + '</p></div>';
      open(intro + tabs + '<section id="ai-source-panel" role="tabpanel" aria-labelledby="ai-tab-' + tab + '">' + body + '</section>' + warnings.map(w => '<p class="ai-notice">' + esc(w) + '</p>').join('') + (error ? errorHTML(error) : ''),
        button('back', t('back'), 'secondary-button') + button('settings', t('settings'), 'secondary-button') + button('run', t('start') + ' →', 'primary-button', (!server && tab === 'url' || imageBusy ? 'disabled' : '')));
    }
    function renderProgress() {
      open('<div class="ai-progress" role="status" aria-live="polite" aria-busy="true"><ol>' + ['reading', 'modelStage', 'matching'].map((key, i) => '<li class="' + (i === stage ? 'active' : i < stage ? 'done' : '') + '">0' + (i + 1) + ' · ' + esc(t(key)) + '</li>').join('') + '</ol><p>' + esc(t('working')) + '</p></div>', button('cancel', t('cancel'), 'secondary-button'));
    }
    function stats(deck) {
      const counts = Object.fromEntries(['playable', 'ambiguous', 'not-in-pool', 'unknown', 'pending'].map(s => [s, 0]));
      for (const zone of zones) for (const item of deck[zone]) counts[item.status] += item.count;
      return counts;
    }
    function row(item, zone, index) {
      const id = zone + '-' + index, badge = item.confirmed ? t('confirmed') : item.corrected ? t('corrected') : t(item.status);
      const artwork = item.id ? root.DuelArt.html(item.id, 'ai-card-art') : '<div class="ai-card-art placeholder" aria-hidden="true">◇</div>';
      let body = '<div class="ai-card-top">' + artwork + '<div class="ai-card-copy"><span class="ai-card-badge ai-status-' + item.status + '">' + esc(badge) + '</span><strong>' + esc(cardName(item)) + '</strong><small>' + esc(t('original')) + ' · ' + esc(item.original) + (item.password ? ' · ' + item.password.padStart(8, '0') : '') + '</small></div><b class="ai-card-count">×' + item.count + '</b></div>';
      if (item.corrected || item.confirmed) body += '<p class="ai-card-detail">' + esc(item.original) + ' → ' + esc(cardName(item)) + '</p>';
      if (item.status === 'ambiguous') body += '<select data-ai-candidate="' + id + '" aria-label="' + esc(t('select')) + '"><option value="">' + esc(t('select')) + '</option>' + item.candidates.map((c, i) => '<option value="' + i + '">' + esc(cardName(c)) + ' · ' + esc(t(c.status)) + '</option>').join('') + '</select>';
      if (['unknown', 'ambiguous', 'not-in-pool'].includes(item.status)) body += '<div class="ai-retry-row"><input id="ai-rename-' + id + '" aria-label="' + esc(t('rename')) + '" placeholder="' + esc(t('rename')) + '" maxlength="200">' + button('resolve', t('resolve'), 'ai-small-button', 'data-entry="' + id + '"') + '</div>';
      if (item.status === 'not-in-pool') {
        const wished = wishlist.some(v => v.password === item.password);
        body += '<p class="ai-card-detail">' + esc(t('poolHelp')) + '</p><div class="ai-actions-row"><a href="https://ygoprodeck.com/card/?search=' + encodeURIComponent(item.names.en || item.password) + '" target="_blank" rel="noopener noreferrer">' + esc(t('encyclopedia')) + '</a>' + button('wish', t(wished ? 'wished' : 'wish'), 'ai-small-button', 'data-entry="' + id + '"' + (wished ? ' disabled' : '')) + '</div>';
      }
      if (item.status === 'pending') body += '<p class="ai-card-detail">' + esc(t('pendingHelp')) + '</p>';
      if (item.modelUnconfirmed) body += '<p class="ai-card-detail">' + esc(t('modelUnconfirmed')) + '</p>';
      if (zone === 'side' && item.status === 'playable') body += '<div class="ai-actions-row">' + button('move', t('move'), 'ai-small-button', 'data-index="' + index + '"') + '</div>';
      return '<article class="ai-card-row" data-status="' + item.status + '"' + (zone === 'side' && item.status === 'playable' ? ' draggable="true" data-side-index="' + index + '"' : '') + '>' + body + '</article>';
    }
    function renderResults() {
      const deck = decks[selected], result = getResolver().draft(deck), check = result.check, counts = stats(deck);
      const sidebar = '<nav class="ai-deck-list" aria-label="' + esc(t('results')) + '">' + decks.map((d, i) => '<button type="button" data-ai-action="deck" data-index="' + i + '" class="' + (i === selected ? 'active' : '') + '" aria-current="' + (i === selected) + '"><small>DECK ' + String(i + 1).padStart(2, '0') + '</small>' + esc(d.name) + '</button>').join('') + '</nav>';
      const summary = '<div class="ai-summary">' + Object.entries(counts).filter(([s, n]) => n || s === 'playable').map(([status, n]) => '<span class="ai-status-' + status + '"><b>' + n + '</b>' + esc(t(status)) + '</span>').join('') + '</div>';
      const sections = zones.map(zone => '<section data-ai-zone="' + zone + '"><div class="ai-zone-heading"><h4>' + esc(t(zone)) + '</h4><b>' + deck[zone].reduce((n, c) => n + c.count, 0) + '</b></div>' + (zone === 'side' ? '<p class="ai-footnote">' + esc(t('sideHelp')) + '</p>' : '') + '<div class="ai-card-grid">' + (deck[zone].map((item, i) => row(item, zone, i)).join('') || '<p class="ai-footnote">' + esc(t('empty')) + '</p>') + '</div></section>').join('');
      const validation = '<div class="ai-validation ' + (check.valid ? 'valid' : '') + '" role="status"><strong>' + esc(t(check.valid ? 'valid' : 'incomplete')) + '</strong>' + (check.mainCount < 40 ? '<p>' + esc(t('missing', { n: 40 - check.mainCount })) + '</p>' : '') + '<div>' + esc(t('main')) + ' ' + check.mainCount + ' / 40–60 · ' + esc(t('extra')) + ' ' + check.extraCount + ' / 15</div>' + (!check.valid ? '<ul>' + check.errors.map(e => '<li>' + esc(root.DuelI18n.text(e)) + '</li>').join('') + '</ul>' : '') + result.warnings.map(w => '<p>' + esc(t('copies', { name: w.name })) + '</p>').join('') + '</div>';
      const uncertainty = deck.uncertain.length ? '<details class="ai-notice"><summary>' + esc(t('sourceWarnings')) + '</summary><ul>' + deck.uncertain.map(s => '<li>' + esc(s) + '</li>').join('') + '</ul></details>' : '';
      open('<div class="ai-result-layout">' + sidebar + '<div class="ai-result-main"><p class="ai-footnote">' + esc(t('review')) + ' · ' + esc(format.toUpperCase()) + '</p><h3 class="ai-result-name">' + esc(deck.name) + '</h3>' + summary + warnings.map(w => '<p class="ai-notice">' + esc(w) + '</p>').join('') + (error ? errorHTML(error) : '') + uncertainty + sections + validation + '<p class="ai-footnote">' + esc(t('notesHelp')) + '</p></div></div>',
        button('edit', t('retry'), 'secondary-button') + button('load', t('load') + ' →', 'primary-button', result.deck.cards.length + result.deck.extra.length ? '' : 'disabled'));
    }
    function field(key, label, options) {
      return '<label>' + esc(t(label)) + (options ? '<select data-ai-config="' + key + '">' + options.map(([v, text]) => '<option value="' + v + '"' + (configDraft[key] === v ? ' selected' : '') + '>' + esc(text) + '</option>').join('') + '</select>' : '<input data-ai-config="' + key + '" value="' + esc(configDraft[key]) + '" autocomplete="off" spellcheck="false" maxlength="500">') + '</label>';
    }
    function renderSettings() {
      const form = '<div id="ai-provider-form" class="ai-settings-grid">' + field('protocol', 'protocol', [['openai', 'OpenAI'], ['anthropic', 'Anthropic']]) + (configDraft.protocol === 'openai' ? field('openaiEndpoint', 'endpoint', [['responses', 'Responses'], ['chat-completions', 'Chat Completions']]) : '<div></div>') +
        '<div class="wide">' + field('baseUrl', 'apiUrl') + '</div><label class="wide">' + esc(t('token')) + '<div class="ai-key-row"><input data-ai-config="apiKey" type="' + (revealKey ? 'text' : 'password') + '" value="' + esc(configDraft.apiKey) + '" autocomplete="off" spellcheck="false" maxlength="4096">' + button('reveal', t(revealKey ? 'hideKey' : 'showKey')) + button('clear-key', t('clearKey')) + '</div></label>' +
        field('model', 'model') + field('transport', 'transport', [['browser', t('browser')], ...(server ? [['server', t('server')]] : [])]) +
        '<div class="wide"><div class="ai-actions-row">' + button('deepseek', t('deepseek')) + '</div><p>' + esc(t('modelHelp')) + '</p><label class="ai-switch-label"><input type="checkbox" data-ai-config="secondPass" ' + (configDraft.secondPass ? 'checked' : '') + '>' + esc(t('second')) + '</label><p>' + esc(t('secondHelp')) + '</p></div></div>';
      open(form + '<p class="ai-notice">' + esc(t('privacy')) + '</p><div class="ai-actions-row">' + button('test', busy ? t('working') : t('test'), 'ai-small-button', busy ? 'disabled' : '') + (busy ? button('cancel-test', t('cancel')) : '') + '<span class="ai-settings-feedback" role="status">' + esc(feedback) + '</span></div>' + (error ? errorHTML(error) : '') + '<details class="ai-wishlist"><summary>' + esc(t('wishlist')) + ' · ' + wishlist.length + '</summary><ul>' + wishlist.map(v => '<li>' + esc(cardName(v)) + ' · ' + esc(v.password) + '</li>').join('') + '</ul>' + (wishlist.length ? button('clear-wishes', t('clearWishes')) : '') + '</details>',
        button('settings-back', t(settingsReturn === 'import' ? 'retry' : 'settings'), 'secondary-button') + button('save-settings', t('saveSettings'), 'primary-button'));
    }
    function input(el) {
      if (el.id === 'ai-source-text') { text = el.value; const counter = $('#ai-text-size'); if (counter) counter.textContent = new TextEncoder().encode(text).length.toLocaleString() + ' / 60,000 bytes'; }
      if (el.id === 'ai-page-url') url = el.value;
      if (el.id === 'ai-image-context') imageContext = el.value;
      if (el.dataset.aiConfig) configDraft[el.dataset.aiConfig] = el.type === 'checkbox' ? el.checked : el.value;
    }
    async function change(el) {
      input(el);
      if (['protocol', 'openaiEndpoint', 'transport'].includes(el.dataset.aiConfig)) renderSettings();
      if (el.id === 'ai-image-files') await addImages([...el.files]);
      if (el.id === 'ai-list-file' && el.files[0]) {
        try { const file = el.files[0]; if (file.size > 60000) throw new P.ProviderError('textLimit'); text = await file.text(); error = null; } catch (e) { error = e; } if (screen === 'import' && view === 'input') renderInput();
      }
      if (el.dataset.aiCandidate && el.value !== '') {
        const [zone, index] = el.dataset.aiCandidate.split('-'), old = decks[selected][zone][index], chosen = old.candidates[Number(el.value)];
        decks[selected][zone][index] = { ...chosen, original: old.original, count: old.count, language: old.language, confirmed: true }; renderResults();
      }
    }
    async function addImages(files) {
      if (imageBusy) return;
      imageBusy = true;
      try {
        if (images.length + files.length > 4) throw new P.ProviderError('imageLimit');
        const prepared = []; for (const file of files) prepared.push(await P.prepareImage(file)); images.push(...prepared); error = null;
      } catch (e) { error = e; } finally { imageBusy = false; if (screen === 'import' && view === 'input') renderInput(); }
    }
    function moveSide(index, requestedZone) {
      const item = decks[selected]?.side[index]; if (!item || item.status !== 'playable') return;
      const zone = requestedZone || (root.DuelData.isExtra(root.DuelData.CARDS[item.id]) ? 'extra' : 'main');
      decks[selected].side.splice(index, 1); decks[selected][zone].push(item); renderResults();
    }
    function mergeRows(deck) {
      for (const zone of zones) {
        const groups = new Map();
        for (const item of deck[zone]) {
          const key = item.original + '|' + (item.id || item.password || item.status);
          if (groups.has(key)) groups.get(key).count += item.count; else groups.set(key, item);
        }
        deck[zone] = [...groups.values()];
      }
      return deck;
    }
    async function secondPass(c, signal) {
      const unknowns = [...new Set(decks.flatMap(d => zones.flatMap(z => d[z].filter(v => v.status === 'unknown').map(v => v.original))))].slice(0, 100);
      if (!c.secondPass || !unknowns.length) return;
      try {
        const response = await P.complete(c, { inputs: unknowns }, { operation: 'normalize', signal });
        for (const answer of response.data.items) {
          const hits = new Map();
          if (answer.isCard) for (const name of [answer.zh, answer.en, answer.ja].filter(Boolean)) {
            const result = getResolver().resolve(name, { fuzzy: false });
            if (['playable', 'pending', 'not-in-pool'].includes(result.status)) hits.set(result.id || result.password, result);
          }
          for (const deck of decks) for (const zone of zones) deck[zone] = deck[zone].map(item => {
            if (item.status !== 'unknown' || item.original !== answer.input) return item;
            // A model-proposed replacement requires confirmation even when it is a real card.
            return hits.size ? { ...item, status: 'ambiguous', method: 'model', candidates: [...hits.values()].slice(0, 5) } : { ...item, modelUnconfirmed: true };
          });
        }
      } catch (e) { if (signal.aborted) throw e; warnings.push(t('secondFailed')); }
    }
    async function run() {
      if (busy || imageBusy) return;
      cancel(); const ticket = generation; controller = new AbortController(); const signal = controller.signal;
      busy = true; error = null; warnings = []; stage = 0; view = 'progress'; renderProgress();
      try {
        await new Promise(resolve => setTimeout(resolve, 20));
        let content = text;
        if (tab === 'url') {
          if (!server) throw new P.ProviderError('pageFetch');
          const response = await fetch('/api/ai/fetch-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }), signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]), credentials: 'omit' });
          const data = await response.json(); if (!response.ok) throw new P.ProviderError(data.code || 'pageFetch'); content = data.text; if (data.truncated) warnings.push(t('truncatedText'));
        }
        const bytes = new TextEncoder().encode(content); if (bytes.length > 60000) { content = new TextDecoder().decode(bytes.slice(0, 59996)).replace(/\uFFFD$/, ''); warnings.push(t('truncatedText')); }
        let parsed = tab === 'images' ? null : root.DuelDeckParse.parse(content);
        const c = P.load(); if (!server) c.transport = 'browser';
        if (!parsed) {
          if (tab === 'images' && !images.length || tab !== 'images' && !content.trim()) throw new P.ProviderError('request');
          stage = 1; renderProgress();
          parsed = (await P.complete(c, { text: tab === 'images' ? imageContext : content, images: tab === 'images' ? images.map(v => v.data) : [] }, { signal })).data;
          format = 'AI';
        } else format = parsed.format;
        signal.throwIfAborted(); if (!parsed.decks.length || !parsed.decks.some(d => zones.some(z => d[z].length))) { error = { code: 'request' }; throw Object.assign(new Error('noDecks'), { code: 'noDecks' }); }
        stage = 2; renderProgress(); await new Promise(resolve => setTimeout(resolve, 20));
        const resolvedDecks = []; let matched = 0;
        for (const source of parsed.decks) {
          const resolved = getResolver().resolveDeck({ ...source, name: source.name === 'Imported deck' ? t('imported') : source.name, main: [], extra: [], side: [] });
          for (const zone of zones) for (const entry of source[zone]) {
            signal.throwIfAborted();
            resolved[zone].push({ ...getResolver().resolve(entry), count: entry.count, language: entry.language || 'unknown' });
            if (++matched % 12 === 0) await new Promise(resolve => setTimeout(resolve, 0));
          }
          resolvedDecks.push(mergeRows(resolved));
        }
        decks = resolvedDecks; selected = 0;
        await secondPass(c, signal); signal.throwIfAborted();
        if (ticket !== generation) return;
        view = 'results'; busy = false; controller = null; renderResults();
      } catch (e) {
        if (ticket !== generation) return;
        busy = false; controller = null; view = 'input'; error = e;
        if (e.code === 'noDecks') { error = null; warnings.push(t('noDecks')); }
        renderInput();
      }
    }
    async function action(name, b) {
      try {
        if (name === 'tab') { tab = b.dataset.tab; error = null; renderInput(); }
        if (name === 'file') $('#ai-list-file').click();
        if (name === 'images') $('#ai-image-files').click();
        if (name === 'remove-image') { images.splice(Number(b.dataset.index), 1); renderInput(); }
        if (name === 'sample') { text = '主卡组\n3 强欲而谦虚之壶\n2 效果遮蒙者\n1 增殖的G\n2 灰流丽\n1 青眼白尤\n1 雷 鸣\n\n额外卡组\n1 No.39 希望皇 霍普'; error = null; renderInput(); }
        if (name === 'run') await run();
        if (name === 'cancel') { cancel(); view = 'input'; error = new P.ProviderError('cancelled'); renderInput(); }
        if (name === 'back') { cancel(); host.workshop(); }
        if (name === 'settings') showSettings('import');
        if (name === 'edit') { view = 'input'; error = null; renderInput(); }
        if (name === 'deck') { selected = Number(b.dataset.index); error = null; renderResults(); }
        if (name === 'load') { host.load(getResolver().draft(decks[selected]).deck); }
        if (name === 'move') moveSide(Number(b.dataset.index));
        if (name === 'resolve') {
          const [zone, index] = b.dataset.entry.split('-'), value = $('#ai-rename-' + b.dataset.entry).value.trim(); if (!value) return;
          const old = decks[selected][zone][index], resolved = getResolver().resolve(value);
          decks[selected][zone][index] = { ...resolved, original: old.original, count: old.count, language: old.language, confirmed: ['playable', 'pending', 'not-in-pool'].includes(resolved.status) }; renderResults();
        }
        if (name === 'wish') {
          const [zone, index] = b.dataset.entry.split('-'), item = decks[selected][zone][index];
          if (!wishlist.some(v => v.password === item.password)) { const next = [...wishlist, { password: item.password, names: item.names }].slice(-2000); localStorage.setItem(WISHES, JSON.stringify(next)); wishlist = next; }
          renderResults();
        }
        if (name === 'clear-wishes') { localStorage.removeItem(WISHES); wishlist = []; renderSettings(); }
        if (name === 'deepseek') { configDraft = { ...configDraft, protocol: 'openai', baseUrl: 'https://api.deepseek.com', openaiEndpoint: 'chat-completions', model: 'deepseek-flash' }; renderSettings(); }
        if (name === 'reveal') { revealKey = !revealKey; renderSettings(); }
        if (name === 'clear-key') { configDraft.apiKey = ''; const saved = P.load(); saved.apiKey = ''; P.save(saved); revealKey = false; renderSettings(); }
        if (name === 'save-settings') { if (!server) configDraft.transport = 'browser'; P.endpoint(configDraft); P.save(configDraft); feedback = t('saved'); error = null; renderSettings(); }
        if (name === 'settings-back') { cancel(); if (settingsReturn === 'import') { screen = 'import'; view = settingsView; error = null; render(); } else host.settings(); }
        if (name === 'cancel-test') { cancel(); feedback = t('err_cancelled'); renderSettings(); }
        if (name === 'test') {
          if (busy) return;
          controller = new AbortController(); const signal = controller.signal, ticket = ++generation; busy = true; error = null; feedback = ''; renderSettings();
          try { const result = await P.complete({ ...configDraft, transport: server ? configDraft.transport : 'browser' }, {}, { operation: 'test', signal }); if (ticket === generation) feedback = t('connected', { model: result.model, ms: result.elapsed }); }
          catch (e) { if (ticket === generation) error = e; }
          finally { if (ticket === generation) { busy = false; controller = null; renderSettings(); } }
        }
      } catch (e) { error = e.code ? e : new P.ProviderError('storage'); render(); }
    }
    return { show, showSettings, cancel, refresh: render };
  }
  root.DuelAIImport = { create };
})(globalThis);
