(function (root) {
  'use strict';
  const P = root.DuelAIProvider, R = root.DuelDeckResearch, t = root.DuelAIImportText, esc = root.DuelView.escape;
  const WISHES = 'duel-sanctuary-ai-wishlist-v1', zones = ['main', 'extra', 'side'];
  const button = (action, label, className = 'ai-small-button', attrs = '') => '<button type="button" class="' + className + '" data-ai-action="' + action + '" ' + attrs + '>' + esc(label) + '</button>';
  const icon = name => '<svg class="icon" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  const cardName = item => item.id ? root.DuelI18n.name(item.id) : item.names?.[root.DuelI18n.language] || item.names?.en || item.original;
  const errorHTML = e => '<div class="ai-error" role="alert"><strong>' + esc(t('errorTitle')) + '</strong><div>' + esc(t('err_' + (e.code || 'request'))) + '</div>' + (e.preview ? '<pre>' + esc(e.preview) + '</pre>' : '') + '</div>';
  function create(host) {
    let resolver, tab = 'text', text = '', url = '', images = [], imageContext = '', decks = [], selected = 0;
    let view = 'input', screen = 'import', error = null, warnings = [], controller = null, stage = 0, busy = false, imageBusy = false;
    let server = false, configDraft = P.load(), revealKey = false, feedback = '', format = '', generation = 0;
    let canSearch = false, request = '', researchMode = 'adapt', researchYear = 0, researchSources = [], searches = [], researchSummary = '';
    let settingsReturn = 'import', settingsView = 'input';
    let wishlist = [];
    try { const saved = JSON.parse(localStorage.getItem(WISHES) || '[]'); if (Array.isArray(saved)) wishlist = saved.filter(v => v && typeof v.password === 'string' && v.names).slice(0, 2000); } catch {}
    const getResolver = () => resolver ||= root.DuelCardResolver.create();
    const $ = s => document.querySelector('#modal ' + s);
    function cancel() { generation++; controller?.abort(); controller = null; busy = false; }
    async function detectServer() {
      if (!/^https?:$/.test(location.protocol)) return;
      try { const response = await fetch('/api/ai/info', { signal: AbortSignal.timeout(2500), credentials: 'omit' }); if (response.ok) { const info = await response.json(); server = info.available === true; canSearch = info.deckSearch === true; } } catch {}
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
        event.preventDefault(); const tabs = ['text', 'images', 'url', 'research'], index = tabs.indexOf(tab);
        tab = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (index + (event.key === 'ArrowRight' ? 1 : 3)) % 4]; renderInput(); $('#ai-tab-' + tab)?.focus();
      };
    }
    function show() { screen = 'import'; busy = false; if (view === 'progress') view = 'input'; render(); void probe.then(() => { if ($('#ai-url-panel') || $('#ai-provider-form') || $('#ai-research-panel')) render(); }); }
    function showSettings(from = 'settings') { cancel(); settingsReturn = from; settingsView = view === 'progress' ? 'input' : view; screen = 'settings'; configDraft = P.load(); error = null; feedback = ''; render(); void probe.then(() => { if ($('#ai-provider-form')) render(); }); }
    function render() {
      if (screen === 'settings') return renderSettings();
      if (view === 'results') return renderResults();
      if (view === 'progress') return renderProgress();
      renderInput();
    }
    function renderInput() {
      const intro = '<div class="ai-intro"><div><h3>' + esc(t(tab === 'research' ? 'researchIntro' : 'intro')) + '</h3><p>' + esc(t(tab === 'research' ? 'researchHelp' : 'description')) + '</p></div><div class="ai-local-seal"><b>' + (tab === 'research' ? 'WEB → DECK' : 'LOCAL FIRST') + '</b><span>' + esc(t(tab === 'research' ? 'sources' : 'offline')) + '</span></div></div>';
      const tabs = '<div class="ai-source-tabs" role="tablist">' + [['text', 'text', 'book'], ['images', 'images', 'card'], ['url', 'urlTab', 'arrow'], ['research', 'research', 'spark']].map(([id, label, glyph]) => '<button type="button" role="tab" id="ai-tab-' + id + '" aria-controls="ai-source-panel" aria-selected="' + (tab === id) + '" data-ai-action="tab" data-tab="' + id + '">' + icon(glyph) + esc(t(label)) + '</button>').join('') + '</div>';
      let body;
      if (tab === 'text') body = '<label for="ai-source-text">' + esc(t('sourceText')) + '</label><textarea id="ai-source-text" spellcheck="false" placeholder="' + esc(t('placeholder')) + '">' + esc(text) + '</textarea><div class="ai-text-meta">' + button('file', t('file')) + button('sample', t('sample')) + '<span id="ai-text-size">' + new TextEncoder().encode(text).length.toLocaleString() + ' / 60,000 bytes</span></div><input type="file" id="ai-list-file" accept=".ydk,.txt,.json,text/plain,application/json" hidden>';
      else if (tab === 'images') body = '<button type="button" class="ai-dropzone" data-ai-action="images" ' + (imageBusy ? 'disabled' : '') + '>' + icon('card') + '<strong>' + esc(t('upload')) + '</strong><p>' + esc(t('imageHelp')) + '</p></button><input type="file" id="ai-image-files" accept="image/jpeg,image/png,image/webp" multiple hidden><div class="ai-thumbnails">' + images.map((img, index) => '<div class="ai-thumbnail"><img src="' + img.data + '" alt="' + esc(img.name) + '"><small>' + esc(img.name) + ' · ' + img.width + ' × ' + img.height + '</small>' + button('remove-image', t('remove'), 'ai-small-button', 'data-index="' + index + '"') + '</div>').join('') + '</div><label>' + esc(t('imageContext')) + '<input id="ai-image-context" maxlength="1000" value="' + esc(imageContext) + '"></label>';
      else if (tab === 'url') body = '<div id="ai-url-panel"><label>' + esc(t('pageUrl')) + '<input type="url" id="ai-page-url" placeholder="https://…" value="' + esc(url) + '" ' + (!server ? 'disabled' : '') + '></label><p class="ai-notice">' + esc(t(server ? 'urlHelp' : 'static')) + '</p></div>';
      else body = '<div id="ai-research-panel"><label for="ai-research-request">' + esc(t('request')) + '</label><textarea id="ai-research-request" maxlength="2000" placeholder="' + esc(t('requestPlaceholder')) + '">' + esc(request) + '</textarea><div class="ai-actions-row">' + button('research-example', t('researchExample')) + '</div><div class="ai-settings-grid"><label>' + esc(t('researchMode')) + '<select id="ai-research-mode"><option value="adapt"' + (researchMode === 'adapt' ? ' selected' : '') + '>' + esc(t('adapt')) + '</option><option value="copy"' + (researchMode === 'copy' ? ' selected' : '') + '>' + esc(t('copy')) + '</option></select></label><label>' + esc(t('cutoff')) + '<select id="ai-research-year"><option value="0">' + esc(t('currentPool')) + '</option>' + [...root.DuelData.earlyYears].reverse().map(year => '<option value="' + year + '"' + (researchYear === year ? ' selected' : '') + '>' + year + '</option>').join('') + '</select></label></div><p class="ai-footnote">' + esc(t('researchUnknownYear')) + '</p><p class="ai-notice">' + esc(t(canSearch ? 'researchPrivacy' : 'researchStatic')) + '</p>' + searchHTML() + '</div>';
      open(intro + tabs + '<section id="ai-source-panel" role="tabpanel" aria-labelledby="ai-tab-' + tab + '">' + body + '</section>' + warnings.map(w => '<p class="ai-notice">' + esc(w) + '</p>').join('') + (error ? errorHTML(error) : ''),
        button('back', t('back'), 'secondary-button') + button('settings', t('settings'), 'secondary-button') + button('run', t(tab === 'research' ? 'researchStart' : 'start') + ' →', 'primary-button', (!server && tab === 'url' || tab === 'research' && !canSearch || imageBusy ? 'disabled' : '')));
    }
    function renderProgress() {
      const steps = tab === 'research' ? ['planning', 'searching', 'checkingSources', 'building'] : ['reading', 'modelStage', 'matching'];
      open('<div class="ai-progress" role="status" aria-live="polite" aria-busy="true"><ol>' + steps.map((key, i) => '<li class="' + (i === stage ? 'active' : i < stage ? 'done' : '') + '">0' + (i + 1) + ' · ' + esc(t(key)) + '</li>').join('') + '</ol><p>' + esc(t('working')) + '</p>' + (tab === 'research' ? '<p>' + esc(researchSummary) + '</p>' + searchHTML() : '') + '</div>', button('cancel', t('cancel'), 'secondary-button'));
    }
    function searchHTML() {
      if (!searches.length) return '';
      return '<details class="ai-query-log"><summary>' + esc(t('searched')) + '</summary><ul>' + searches.map(q => '<li><span>' + esc(q.query) + '</span><small>' + esc(q.format) + ' · ' + (q.status === 'failed' ? esc(t('searchFailed')) : q.status === 'pending' ? '…' : Number(q.count) || 0) + '</small></li>').join('') + '</ul></details>';
    }
    function activeSources(deck=decks[selected]){return researchSources.filter(source=>source.group===deck?.research?.group);}
    function sourcesHTML(deck) {
      if (!deck.research) return '';
      const meta = deck.research;
      const sources=activeSources(deck),compared = meta.comparison && sources.find(s => s.id === meta.comparison.sourceId);
      const diff = compared ? '<details class="ai-verified-changes"><summary>' + esc(t('verifiedChanges')) + '</summary><p>' + esc(compared.title) + '</p><ul>' + meta.comparison.changed.map(c => '<li>' + (c.count > 0 ? '+' : '−') + Math.abs(c.count) + ' ' + esc(root.DuelI18n.name(c.id)) + '</li>').join('') + '</ul></details>' : '';
      return '<section class="ai-research-evidence"><div class="ai-evidence-heading"><b>' + icon('book') + esc(t(meta.mode === 'adapted' ? 'sourceAdapted' : 'sourceReference')) + '</b><span>'+esc(sources[0]?.provider||'YGOPRODeck')+'</span></div>' +
        (meta.rationale ? '<p class="ai-research-rationale"><strong>' + esc(t('researchRationale')) + '</strong>' + esc(meta.rationale) + '</p>' : '') +
        (meta.changes.length ? '<details><summary>' + esc(t('researchChanges')) + '</summary><ul>' + meta.changes.map(s => '<li>' + esc(s) + '</li>').join('') + '</ul></details>' : '') + diff +
        '<details class="ai-source-library"><summary>' + esc(t('sources')) + ' · ' + sources.length + '</summary><div class="ai-source-list">' + sources.map((source, i) => '<article class="ai-web-source' + (meta.sourceIds.includes(source.id) ? ' used' : '') + '"><small>' + esc(t('source')) + ' ' + (i + 1) + ' · ' + esc(source.author) + '</small><a href="' + esc(source.url) + '" target="_blank" rel="noopener noreferrer">' + esc(source.title) + ' ↗</a><p>' + esc(source.format) + '</p><span class="ai-source-coverage">' + esc(t('sourceCoverage', { usable: source.counts.inScope, total: source.counts.total })) + '</span><small>' + esc(t('sourceReadAt')) + ' · ' + esc(source.retrievedAt.slice(0, 19).replace('T', ' ')) + ' UTC</small>' + button('source-deck', t('sourceOriginal'), 'ai-small-button', 'data-source="' + source.id + '"') + '</article>').join('') + '</div></details>' + searchHTML() + '</section>';
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
      if (item.labelMismatch) body += '<p class="ai-card-detail">' + esc(t('bilingualLabel', { name: item.matchedName })) + '</p>';
      if (item.zoneInferred) body += '<p class="ai-card-detail">' + esc(t('zoneInferred')) + '</p>';
      if (item.status === 'ambiguous') body += '<select data-ai-candidate="' + id + '" aria-label="' + esc(t('select')) + '"><option value="">' + esc(t('select')) + '</option>' + item.candidates.map((c, i) => '<option value="' + i + '">' + esc(cardName(c)) + ' · ' + esc(t(c.status)) + '</option>').join('') + '</select>';
      if (['unknown', 'ambiguous', 'not-in-pool'].includes(item.status)) body += '<div class="ai-retry-row"><input id="ai-rename-' + id + '" aria-label="' + esc(t('rename')) + '" placeholder="' + esc(t('rename')) + '" maxlength="200">' + button('resolve', t('resolve'), 'ai-small-button', 'data-entry="' + id + '"') + '</div>';
      if (item.status === 'not-in-pool') {
        const wished = wishlist.some(v => v.password === item.password);
        body += '<p class="ai-card-detail">' + esc(t('poolHelp', { start: root.DuelData.earlyYears[0], end: root.DuelData.earlyYears.at(-1) })) + '</p><div class="ai-actions-row"><a href="https://ygoprodeck.com/card/?search=' + encodeURIComponent(item.names.en || item.password) + '" target="_blank" rel="noopener noreferrer">' + esc(t('encyclopedia')) + '</a>' + button('wish', t(wished ? 'wished' : 'wish'), 'ai-small-button', 'data-entry="' + id + '"' + (wished ? ' disabled' : '')) + '</div>';
      }
      if (item.status === 'pending') body += '<p class="ai-card-detail">' + esc(t('pendingHelp')) + '</p>';
      if (item.modelUnconfirmed) body += '<p class="ai-card-detail">' + esc(t('modelUnconfirmed')) + '</p>';
      if (item.provenance?.length) body += '<div class="ai-card-provenance">' + item.provenance.slice(0, 3).map(id => { const index = activeSources().findIndex(s => s.id === id), source = activeSources()[index]; return source ? '<a href="' + esc(source.url) + '" target="_blank" rel="noopener noreferrer">' + esc(t('source')) + ' ' + (index + 1) + ' ↗</a>' : ''; }).join(' ') + (item.provenance.length > 3 ? '<span>+' + (item.provenance.length - 3) + '</span>' : '') + '</div>';
      if (item.status === 'playable' && item.researchInScope === false) body += '<p class="ai-card-detail">' + esc(t('researchOutsideYear')) + '</p>';
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
      open('<div class="ai-result-layout">' + sidebar + '<div class="ai-result-main"><p class="ai-footnote">' + esc(t('review')) + ' · ' + esc(format.toUpperCase()) + '</p><h3 class="ai-result-name">' + esc(deck.name) + '</h3>' + summary + warnings.map(w => '<p class="ai-notice">' + esc(w) + '</p>').join('') + (error ? errorHTML(error) : '') + sourcesHTML(deck) + uncertainty + sections + validation + '<p class="ai-footnote">' + esc(t('notesHelp')) + '</p></div></div>',
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
      if (el.id === 'ai-research-request') request = el.value;
      if (el.id === 'ai-research-mode') researchMode = el.value;
      if (el.id === 'ai-research-year') researchYear = Number(el.value);
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
      if (tab === 'research') return runResearch();
      if (tab === 'text' && R.isBuildRequest(text)) {request=text;tab='research';if(canSearch)return runResearch();renderInput();return;}
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
            const hit = getResolver().resolve(entry), inferred = zone === 'main' && entry.autoZone && hit.id && root.DuelData.isExtra(root.DuelData.CARDS[hit.id]);
            resolved[inferred ? 'extra' : zone].push({ ...hit, count: entry.count, language: entry.language || 'unknown', ...(inferred ? { zoneInferred: true } : {}) });
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
    async function runResearch() {
      if (!canSearch || !request.trim()) { error = new P.ProviderError('searchQuery'); renderInput(); return; }
      cancel(); const ticket = generation; controller = new AbortController();
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(300000)]);
      busy = true; error = null; warnings = []; researchSources = []; searches = []; researchSummary = ''; stage = 0; view = 'progress'; renderProgress();
      try {
        const c = P.load(), language = root.DuelI18n.language;
        const plan = R.quickPlan(request) || (await P.complete(c, { text: JSON.stringify({ request, language, releaseYears: [root.DuelData.earlyYears[0], root.DuelData.earlyYears.at(-1)], maxYear: researchYear }) }, { operation: 'plan', signal })).data;
        signal.throwIfAborted(); if (ticket !== generation) return;
        warnings.push(...plan.warnings);
        const targets = plan.targets.length ? plan.targets : [{ ...plan, name: plan.summary, description: request }], results = [];
        for (const [group, target] of targets.entries()) {
          signal.throwIfAborted(); researchSummary = (targets.length > 1 ? (group + 1) + '/' + targets.length + ' · ' : '') + target.name;
          stage = 1; renderProgress();
          const payload = target.championshipYear ? { championshipYear: target.championshipYear } : { queries: target.queries };
          let result;
          try {
            const response = await fetch('/api/ai/search-decks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.any([signal, AbortSignal.timeout(50000)]), credentials: 'omit', redirect: 'error' });
            result = JSON.parse(await P.limitedText(response));
            if (!response.ok) throw new P.ProviderError(result.code || 'searchUnavailable');
          } catch (e) { if (signal.aborted) throw e; warnings.push(target.name + ' · ' + t('err_' + (e.code || 'network'))); continue; }
          signal.throwIfAborted(); if (ticket !== generation) return;
          searches.push(...result.searches.map(q => ({ ...q, target: target.name, provider: result.provider })));
          if (result.warnings?.length) warnings.push(t('researchPartial'));
          if (!result.sources?.length) { warnings.push(target.name + ' · ' + t('researchNoResults')); continue; }
          stage = 2; renderProgress(); await new Promise(resolve => setTimeout(resolve, 20)); signal.throwIfAborted();
          const maxYear = researchYear && target.maxYear ? Math.min(researchYear, target.maxYear) : researchYear || target.maxYear;
          const spec = { description: target.description, language, maxYear, anchorCards: target.anchorCards }, prepared = R.prepare(result.sources, getResolver(), spec);
          if (!prepared.sources.length) { warnings.push(target.name + ' · ' + t('researchNoResults')); continue; }
          researchSources.push(...prepared.sources.map(source => ({ ...source, group })));
          let chosen = [];
          if (target.championshipYear) {
            chosen = prepared.sources.map(source => R.reference(source, target.description, t('championshipVerified')));
          } else {
            stage = 3; renderProgress();
            const operation = researchMode === 'copy' ? 'rank' : 'build', sent = R.context(prepared, spec, operation === 'build');
            let recommendation;
            try {
              let model;
              try {
                model = (await P.complete(c, { text: sent.text }, { operation, signal })).data;
                recommendation = operation === 'rank' ? R.rank(model, prepared, spec, sent) : R.build(model, prepared, spec, getResolver(), sent);
              } catch (validationError) {
                if (operation !== 'build' || !['grounding', 'buildInvalid', 'json', 'schema'].includes(validationError.code)) throw validationError;
                researchSummary = t('repairing'); renderProgress();
                model = (await P.complete(c, { text: R.repairContext(sent, model, validationError) }, { operation, signal })).data;
                recommendation = R.completeQuantities(model, prepared, spec, getResolver(), sent);
              }
              warnings.push(...recommendation.warnings);
            } catch (e) { if (signal.aborted) throw e; warnings.push(target.name + ' · ' + t('err_' + (e.code || 'request'))); }
            chosen = recommendation?.decks || [];
            if (!chosen.length) { warnings.push(target.name + ' · ' + t('researchFallback')); chosen = prepared.sources.slice(0, 2).map(source => R.reference(source, target.description)); }
          }
          for (const deck of chosen) { if(targets.length>1)deck.name=(target.name+' · '+deck.name).slice(0,40);deck.research.group = group; results.push(deck); }
        }
        signal.throwIfAborted(); if (ticket !== generation) return;
        decks = results;
        if (!decks.length) { if(!warnings.length)warnings.push(t('researchNoResults')); view = 'input'; }
        else { selected = 0; format = 'WEB'; view = 'results'; }
        busy = false; controller = null; render();
      } catch (e) {
        if (ticket !== generation) return;
        busy = false; controller = null; view = 'input'; error = e.code ? e : new P.ProviderError(signal.aborted ? 'timeout' : 'network'); renderInput();
      }
    }
    async function action(name, b) {
      try {
        if (name === 'tab') { tab = b.dataset.tab; error = null; renderInput(); }
        if (name === 'file') $('#ai-list-file').click();
        if (name === 'images') $('#ai-image-files').click();
        if (name === 'remove-image') { images.splice(Number(b.dataset.index), 1); renderInput(); }
        if (name === 'sample') { text = '主卡组\n3 强欲而谦虚之壶\n2 效果遮蒙者\n1 增殖的G\n2 灰流丽\n1 青眼白尤\n1 雷 鸣\n\n额外卡组\n1 No.39 希望皇 霍普'; error = null; renderInput(); }
        if (name === 'research-example') { request = t('requestPlaceholder'); error = null; renderInput(); }
        if (name === 'run') await run();
        if (name === 'cancel') { cancel(); view = 'input'; error = new P.ProviderError('cancelled'); renderInput(); }
        if (name === 'back') { cancel(); if(!host.back?.())host.workshop(); }
        if (name === 'settings') showSettings('import');
        if (name === 'edit') { view = 'input'; error = null; renderInput(); }
        if (name === 'deck') { selected = Number(b.dataset.index); error = null; renderResults(); }
        if (name === 'source-deck') {
          const source = activeSources().find(s => s.id === b.dataset.source); if (!source) return;
          const existing = decks.findIndex(d => d.research?.mode === 'reference' && d.research.sourceIds.length === 1 && d.research.sourceIds[0] === source.id && d.research.group === source.group);
          if (existing >= 0) selected = existing;
          else { const reference=R.reference(source, request);reference.research.group=source.group;decks.push(reference); selected = decks.length - 1; }
          error = null; renderResults();
        }
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
        if (name === 'deepseek') { configDraft = { ...configDraft, protocol: 'openai', baseUrl: 'https://api.deepseek.com', openaiEndpoint: 'chat-completions', model: 'deepseek-flash', transport: server ? 'server' : 'browser' }; renderSettings(); }
        if (name === 'reveal') { revealKey = !revealKey; renderSettings(); }
        if (name === 'clear-key') { configDraft.apiKey = ''; const saved = P.load(); saved.apiKey = ''; P.save(saved); revealKey = false; renderSettings(); }
        if (name === 'save-settings') { if (!server) configDraft.transport = 'browser'; P.endpoint(configDraft); P.save(configDraft); feedback = t('saved'); error = null; renderSettings(); }
        if (name === 'settings-back') { cancel(); if(!host.back?.()){if (settingsReturn === 'import') { screen = 'import'; view = settingsView; error = null; render(); } else host.settings();} }
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
    function resume(kind,saved){screen=kind==='ai-settings'?'settings':'import';if(screen==='import'){const previous=saved?.view||settingsView;view=previous==='progress'?'input':previous;}render();}
    return { show, showSettings, cancel, resume, snapshot:()=>({view}), refresh: render };
  }
  root.DuelAIImport = { create };
})(globalThis);
