import Provider from '../src/ai-provider.js';
import { safeFetch, fetchPage } from './ai-network.mjs';
import { searchDecks } from './deck-search.mjs';
import { championshipDeck } from './championship-search.mjs';
export { isPublicAddress, validateTarget, safeFetch, extractText, fetchPage } from './ai-network.mjs';
const failure = (code, status = 400) => Object.assign(new Error(code), { code, status });
async function readBody(request, limit) {
  if (Number(request.headers['content-length']) > limit) throw failure('requestLimit', 413);
  let size = 0; const chunks = [];
  for await (const chunk of request) { size += chunk.length; if (size > limit) throw failure('requestLimit', 413); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw failure('json'); }
}
export function createAIProxy(options = {}) {
  const env = options.env || process.env, rates = new Map(), active = new Map(); let total = 0;
  const upstreams = (env.DUEL_AI_UPSTREAMS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const hostedLimit = Math.max(1, Math.min(1000, Number(env.DUEL_AI_HOURLY_LIMIT) || 30));
  const send = (response, status, data) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); response.end(JSON.stringify(data)); };
  function allowance(peer, hosted) {
    const now = Date.now(); for (const [key, r] of rates) if (now - r.at > 3600000) rates.delete(key);
    if (!rates.has(peer)) { if (rates.size >= 10000) throw failure('rate', 429); rates.set(peer, { at: now, calls: 0, hosted: 0 }); }
    const r = rates.get(peer); if (++r.calls > 120 || hosted && ++r.hosted > hostedLimit) throw failure('rate', 429);
  }
  return async function handle(request, response, pathname) {
    if (!pathname.startsWith('/api/ai/')) return false;
    const peer = options.peerOf?.(request) || request.socket.remoteAddress;
    let acquired = false; const controller = new AbortController();
    const onClose = () => { if (!response.writableEnded) controller.abort(); };
    response.on('close', onClose);
    try {
      // Browser calls must be same-origin. Never allow a foreign website to use a hosted key.
      if (request.headers.origin && new URL(request.headers.origin).host !== request.headers.host || request.headers['sec-fetch-site'] === 'cross-site') throw failure('origin', 403);
      if (pathname === '/api/ai/info' && request.method === 'GET') { send(response, 200, { available: true, deckSearch: true, searchProvider: 'YGOPRODeck', hosted: Boolean(env.DUEL_AI_DEFAULT_KEY && env.DUEL_AI_DEFAULT_URL && env.DUEL_AI_DEFAULT_MODEL) }); return true; }
      if (!['/api/ai/complete', '/api/ai/fetch-url', '/api/ai/search-decks'].includes(pathname)) throw failure('endpoint', 404);
      if (request.method !== 'POST') throw failure('method', 405);
      if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) throw failure('request', 415);
      if (total >= 8 || (active.get(peer) || 0) >= 2) throw failure('busy', 429);
      total++; active.set(peer, (active.get(peer) || 0) + 1); acquired = true;
      const body = await readBody(request, pathname.endsWith('complete') ? 23 * 1024 * 1024 : 4096);
      if (pathname.endsWith('search-decks')) {
        allowance(peer, false);
        send(response, 200, body.championshipYear ? await championshipDeck(body.championshipYear, { fetcher: options.championshipFetch || safeFetch, signal: controller.signal }) : await searchDecks(body.queries, { fetcher: options.searchFetch || safeFetch, signal: controller.signal }));
      } else if (pathname.endsWith('fetch-url')) {
        allowance(peer, false);
        send(response, 200, await fetchPage(body.url, { fetcher: options.pageFetch || safeFetch, signal: controller.signal }));
      } else {
        const c = Provider.config(body.config), supplied = String(request.headers['x-duel-ai-key'] || '');
        // A deployment key is bound to an operator-selected endpoint/model, never a caller URL.
        const hosted = !supplied;
        if (hosted) {
          if (!env.DUEL_AI_DEFAULT_KEY || !env.DUEL_AI_DEFAULT_URL || !env.DUEL_AI_DEFAULT_MODEL) throw failure('key', 401);
          const configured = Provider.config({ ...c, baseUrl: env.DUEL_AI_DEFAULT_URL, model: env.DUEL_AI_DEFAULT_MODEL || c.model, protocol: env.DUEL_AI_DEFAULT_PROTOCOL || 'openai', openaiEndpoint: env.DUEL_AI_DEFAULT_ENDPOINT || 'responses' });
          if (Provider.endpoint(c) !== Provider.endpoint(configured) || c.model !== configured.model) throw failure('hostedTarget', 403);
          c.apiKey = env.DUEL_AI_DEFAULT_KEY;
        } else c.apiKey = supplied;
        allowance(peer, hosted); c.transport = 'server';
        const result = await Provider.complete(c, body.input, { operation: body.operation, direct: true, signal: controller.signal,
          fetch: options.completeFetch || ((url, init) => safeFetch(url, init, { upstreams })) });
        send(response, 200, result);
      }
    } catch (e) {
      // Neither upstream bodies nor request headers/keys are logged or reflected.
      const code = typeof e.code === 'string' && /^[a-zA-Z]+$/.test(e.code) ? e.code : e.name === 'TimeoutError' ? 'timeout' : 'network';
      if (!response.headersSent && !response.destroyed) send(response, e.status >= 400 && e.status <= 599 ? e.status : 400, { code });
    } finally {
      response.off('close', onClose);
      if (acquired) { total--; const n = (active.get(peer) || 1) - 1; if (n) active.set(peer, n); else active.delete(peer); }
    }
    return true;
  };
}
