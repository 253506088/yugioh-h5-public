(function (root) {
  'use strict';
  const light = value => String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[‐‑‒–—−－ー]/g, '-')
    .replace(/･/g, '・').replace(/\s+/g, ' ').trim();
  const heavy = value => light(value).replace(/[\s\p{P}\p{S}]/gu, '');
  const namesOf = record => Object.values(record?.locales || {}).map(v => v.name).filter(Boolean);
  function add(map, key, value) {
    if (!key) return;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(value);
  }
  function distance(a, b) {
    let prior = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 0; i < a.length; i++) {
      const next = [i + 1];
      for (let j = 0; j < b.length; j++) next.push(Math.min(next[j] + 1, prior[j + 1] + 1, prior[j] + (a[i] !== b[j])));
      prior = next;
    }
    return prior[b.length];
  }
  const script = name => /[\u3040-\u30ff]/u.test(name) ? 'ja' : /\p{Script=Han}/u.test(name) ? 'han' : 'latin';
  function create({ cards = root.DuelData.CARDS, locales = root.DuelCardLocales, catalog = root.DuelCardCatalog, aliases = root.DuelCardAliases || {} } = {}) {
    const tables = [new Map(), new Map(), new Map(), new Map()], passwords = new Map();
    const rows = new Map((catalog || []).map(row => [String(row[0]), row]));
    const catalogLight = new Map(), catalogHeavy = new Map(), catalogCards = new Map(), fuzzyNames = new Map();
    const aliasMap = new Map(Object.entries(aliases).map(([a, b]) => [light(a), b]));
    function canonical(value) {
      let id = String(Number(value)), seen = new Set();
      while (rows.get(id)?.[4] && rows.has(String(rows.get(id)[4])) && !seen.has(id)) {
        seen.add(id); id = String(rows.get(id)[4]);
      }
      return id;
    }
    function poolResult(id, method) {
      const card = cards[id];
      return { status: card.implementationStatus === 'pending' ? 'pending' : 'playable', id, method,
        password: card.providerId ? canonical(card.providerId) : '',
        names: { 'zh-CN': locales?.[id]?.locales?.['zh-CN']?.name || card.name, en: locales?.[id]?.locales?.en?.name || card.en || card.officialName || '', ja: locales?.[id]?.locales?.ja?.name || '' } };
    }
    function select(ids, method, get = poolResult) {
      const candidates = [...ids].map(id => get(id, method));
      return candidates.length === 1 ? candidates[0] : { status: 'ambiguous', method, candidates: candidates.slice(0, 5) };
    }
    function exact(name) {
      const keys = [light(name), light(name), heavy(name), heavy(name)];
      for (let i = 0; i < 4; i++) if (tables[i].has(keys[i])) return select(tables[i].get(keys[i]), 'ABCD'[i]);
      return null;
    }
    for (const card of Object.values(cards)) {
      if (card.notCollectible || card.type === 'token') continue;
      if (card.providerId) add(passwords, canonical(card.providerId), card.id);
      for (const name of namesOf(locales?.[card.id])) { add(tables[0], light(name), card.id); add(tables[2], heavy(name), card.id); }
      for (const name of [card.name, card.en, card.officialName].filter(Boolean)) { add(tables[1], light(name), card.id); add(tables[3], heavy(name), card.id); }
    }
    // The catalog also provides passwords for hand-authored cards without providerId.
    for (const row of rows.values()) {
      const id = canonical(row[0]);
      if (!catalogCards.has(id)) {
        const primary = rows.get(id) || row;
        let match = passwords.has(id) ? select(passwords.get(id), 'password') : null;
        if (!match) for (const name of primary.slice(1, 4).filter(Boolean)) {
          const hit = exact(name); if (hit && hit.status !== 'ambiguous') { match = hit; break; }
        }
        catalogCards.set(id, match || { status: 'not-in-pool', password: id,
          names: { 'zh-CN': primary[1], en: primary[2], ja: primary[3] },
          url: 'https://ygoprodeck.com/card/?search=' + encodeURIComponent(primary[2] || id) });
      }
      for (const name of row.slice(1, 4).filter(Boolean)) { add(catalogLight, light(name), id); add(catalogHeavy, heavy(name), id); }
    }
    const catalogResult = (id, method) => ({ ...catalogCards.get(id), method });
    function addFuzzy(name, result) {
      const key = light(name); if (!key) return;
      const identity = result.id || 'catalog:' + result.password;
      if (!fuzzyNames.has(key)) fuzzyNames.set(key, { name: key, heavy: heavy(key), script: script(key), results: new Map() });
      fuzzyNames.get(key).results.set(identity, result);
    }
    // Resolve authoritative names first so legacy display names cannot override them.
    for (const map of [tables[0], tables[1]]) for (const name of map.keys()) {
      const hit = exact(name);
      for (const result of hit.candidates || [hit]) addFuzzy(name, result);
    }
    for (const [name, ids] of catalogLight) for (const id of ids) addFuzzy(name, catalogResult(id, 'catalog'));
    const fuzzyList = [...fuzzyNames.values()], cache = new Map();
    function fuzzy(input) {
      const query = light(input), qHeavy = heavy(input), system = script(query), matches = new Map();
      if (query.length < 3 || query.length > 160) return { status: 'unknown', method: 'none' };
      for (const item of fuzzyList) {
        if (system !== item.script) continue;
        const min = Math.min(query.length, item.name.length), max = Math.max(query.length, item.name.length);
        const substring = Math.min(qHeavy.length, item.heavy.length) >= 4 && (qHeavy.includes(item.heavy) || item.heavy.includes(qHeavy));
        if (!substring && Math.abs(query.length - item.name.length) > Math.max(2, max * .14)) continue;
        const d = distance(query, item.name), similarity = 1 - d / max;
        if (!(d <= 1 && min >= 3 || d <= 2 && min >= 8 || similarity >= .86 || substring)) continue;
        for (const [id, result] of item.results) {
          const candidate = { ...result, method: 'fuzzy', distance: d, similarity, matchedName: item.name, auto: d <= 1 && min >= 5 || similarity >= .94 };
          if (!matches.has(id) || matches.get(id).similarity < similarity) matches.set(id, candidate);
        }
      }
      const sorted = [...matches.values()].sort((a, b) => b.similarity - a.similarity || a.distance - b.distance);
      if (sorted.length === 1 && sorted[0].auto) return { ...sorted[0], corrected: true };
      return sorted.length ? { status: 'ambiguous', method: 'fuzzy', candidates: sorted.slice(0, 5) } : { status: 'unknown', method: 'none' };
    }
    function resolve(input, { fuzzy: useFuzzy = true } = {}) {
      const name = String(typeof input === 'object' ? input.name : input).trim();
      const passwordOnly = input?.isPassword === true;
      const cacheKey = (passwordOnly ? 'p:' : '') + (useFuzzy ? 'f:' : 'e:') + name;
      if (cache.has(cacheKey)) return structuredClone(cache.get(cacheKey));
      let result;
      // Passwords in real YDK files may omit leading zeroes (1–8 digits).
      if (/^\d{1,8}$/.test(name)) {
        const id = canonical(name);
        // "7" is also an official card name; YDK/YDKe explicitly mark password entries.
        result = !passwordOnly && name.length < 8 ? exact(name) : null;
        result ||= passwords.has(id) ? select(passwords.get(id), 'password') : catalogCards.has(id) ? catalogResult(id, 'password') : null;
      } else {
        result = exact(name);
        const alias = aliasMap.get(light(name));
        if (!result && alias) {
          result = exact(alias);
          if (!result) { const ids = catalogLight.get(light(alias)) || catalogHeavy.get(heavy(alias)); if (ids) result = select(ids, 'alias', catalogResult); }
          if (result) result = { ...result, method: 'alias' };
        }
        if (!result) for (const [map, key] of [[catalogLight, light(name)], [catalogHeavy, heavy(name)]]) {
          if (map.has(key)) { result = select(map.get(key), 'catalog', catalogResult); break; }
        }
        if (!result && useFuzzy) result = fuzzy(name);
      }
      result = { ...(result || { status: 'unknown', method: 'none' }), original: name };
      if (cache.size > 2000) cache.clear();
      cache.set(cacheKey, result); return structuredClone(result);
    }
    function resolveDeck(deck) {
      return { name: deck.name.slice(0, 40), uncertain: [...(deck.uncertain || [])], notes: deck.notes || '',
        ...Object.fromEntries(['main', 'extra', 'side'].map(zone => [zone, (deck[zone] || []).map(entry => ({ ...resolve(entry), count: entry.count, language: entry.language || 'unknown' }))])) };
    }
    function draft(deck) {
      const output = { name: deck.name.slice(0, 40), cards: [], extra: [], notes: '' }, counts = new Map(), warnings = [], omitted = [];
      for (const zone of ['main', 'extra', 'side']) for (const entry of deck[zone]) {
        if (zone === 'side' || entry.status !== 'playable') {
          omitted.push('[' + zone + '/' + entry.status + '] ' + entry.original + ' ×' + entry.count +
            (entry.names ? ' — ' + Object.values(entry.names).filter(Boolean).join(' / ') : '') + (entry.password ? ' (' + entry.password.padStart(8, '0') + ')' : ''));
          continue;
        }
        const card = cards[entry.id], identity = light(card.nameAlias || card.officialName || card.en || card.name);
        const count = Math.min(entry.count, Math.max(0, 3 - (counts.get(identity) || 0)));
        counts.set(identity, (counts.get(identity) || 0) + count);
        if (count < entry.count) warnings.push({ code: 'copies', name: entry.names?.['zh-CN'] || entry.original });
        output[zone === 'main' ? 'cards' : 'extra'].push(...Array(count).fill(entry.id));
      }
      output.notes = [deck.notes, ...(deck.uncertain || []), ...omitted].filter(Boolean).join('\n').slice(0, 16000);
      return { deck: output, warnings, check: root.DuelDecks?.analyze(output) };
    }
    return { resolve, resolveDeck, draft, tables, passwords, canonical };
  }
  const api = { create, light, heavy, distance };
  root.DuelCardResolver = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
