import { safeFetch, extractText } from './ai-network.mjs';
import Provider from '../src/ai-provider.js';

const fail = (code, status = 400) => Object.assign(new Error(code), { code, status });
export const FORMATS = { any: '', edison: 'edison format decks', goat: 'goat format decks', casual: 'fun/casual decks', ocg: 'Tournament Meta Decks OCG', tcg: 'Tournament Meta Decks' };
export function validateQueries(input) {
  if (!Array.isArray(input) || !input.length || input.length > 3) throw fail('searchQuery');
  const queries = input.map(v => {
    if (!v || typeof v.query !== 'string' || !v.query.trim() || v.query.length > 100 || !Object.hasOwn(FORMATS, v.format) || /[\u0000-\u001f]/.test(v.query)) throw fail('searchQuery');
    return { query: v.query.trim(), format: v.format };
  });
  return queries.filter((v, i) => queries.findIndex(x => x.query === v.query && x.format === v.format) === i);
}
function cardEntries(raw) {
  const input = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!Array.isArray(input) || input.length > 100) throw fail('searchData');
  const counts = new Map();
  for (const value of input) {
    if (!/^\d{1,8}$/.test(String(value)) || Number(value) < 1) throw fail('searchData');
    const key = String(Number(value)); counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts].map(([name, count]) => ({ name, count, language: 'unknown', isPassword: true }));
}
export function parseSearchResults(payload, search, retrievedAt = new Date().toISOString()) {
  if (!Array.isArray(payload)) { if (payload?.error) return []; throw fail('searchData', 502); }
  const results = [];
  for (const value of payload.slice(0, 16)) {
    try {
      if (!value || typeof value.deck_name !== 'string' || !Number.isSafeInteger(Number(value.deckNum)) || Number(value.deckNum) < 1 || typeof value.pretty_url !== 'string' || !/^[a-z0-9-]{1,240}$/i.test(value.pretty_url) || !value.pretty_url.endsWith('-' + value.deckNum)) continue;
      const main = cardEntries(value.main_deck), extra = cardEntries(value.extra_deck || '[]'), side = cardEntries(value.side_deck || '[]');
      if (!main.length) continue;
      const source = { id: 'web-' + value.deckNum, provider: 'YGOPRODeck', title: value.deck_name.slice(0, 200),
        url: 'https://ygoprodeck.com/deck/' + value.pretty_url, author: String(value.username || '').slice(0, 100),
        format: String(value.format || '').slice(0, 100), retrievedAt, query: search.query, searchFormat: search.format,
        description: extractText(String(value.deck_description || value.deck_excerpt || '').slice(0, 100000)).slice(0, 2400),
        deck: { name: value.deck_name.slice(0, 40), main, extra, side, uncertain: [] } };
      results.push(source);
    } catch { /* Skip malformed upstream rows without discarding other usable lists. */ }
  }
  return results;
}
export async function searchDecks(input, { fetcher = safeFetch, signal } = {}) {
  const queries = validateQueries(input), sources = new Map(), batches = [], searches = [], warnings = [];
  const deadline = AbortSignal.any([AbortSignal.timeout(45000), ...(signal ? [signal] : [])]);
  for (const query of queries) {
    deadline.throwIfAborted();
    const url = new URL('https://ygoprodeck.com/api/decks/getDecks.php');
    url.searchParams.set('name', query.query); url.searchParams.set('limit', '6'); url.searchParams.set('sort', 'Deck Views');
    if (FORMATS[query.format]) url.searchParams.set('_sft_category', FORMATS[query.format]);
    try {
      const response = await fetcher(url.href, { signal: AbortSignal.any([deadline, AbortSignal.timeout(15000)]), headers: { Accept: 'application/json', 'Accept-Encoding': 'identity', 'User-Agent': 'Duel-Sanctuary-Deck-Research/1.0' } });
      if (!response.ok) throw fail('searchUnavailable', 502);
      let payload; try { payload = JSON.parse(await Provider.limitedText(response)); } catch { throw fail('searchUnavailable', 502); }
      const found = parseSearchResults(payload, query);
      searches.push({ ...query, count: found.length, status: 'ok' });
      batches.push(found);
    } catch (error) {
      if (deadline.aborted) throw error;
      searches.push({ ...query, count: 0, status: 'failed' }); warnings.push({ code: 'searchPartial', query: query.query });
    }
  }
  if (searches.every(s => s.status === 'failed')) throw fail('searchUnavailable', 502);
  // Round-robin across queries so a broad first search cannot crowd out a precise one.
  for (let i = 0; i < 16 && sources.size < 12; i++) for (const batch of batches) {
    const source = batch[i]; if (source && !sources.has(source.id) && sources.size < 12) sources.set(source.id, source);
  }
  return { provider: 'YGOPRODeck', sources: [...sources.values()], searches, warnings };
}
