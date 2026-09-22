import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';
import Provider from '../src/ai-provider.js';

const failure = (code, status = 400) => Object.assign(new Error(code), { code, status });
export function isPublicAddress(address) {
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 ||
      a === 192 && (b === 168 || b === 0 || b === 2 || b === 88 && c === 99) || a === 100 && b >= 64 && b <= 127 ||
      a === 198 && (b === 18 || b === 19 || b === 51 && c === 100) || a === 203 && b === 0 && c === 113);
  }
  if (family !== 6) return false;
  // Only globally routed IPv6; exclude translation, tunnel and documentation ranges.
  const normalized = new URL('https://[' + address + ']').hostname.slice(1, -1).toLowerCase();
  const parts = normalized.split(':'), first = parseInt(parts[0], 16), second = parseInt(parts[1] || '0', 16);
  return first >= 0x2000 && first <= 0x3fff && first !== 0x2002 && !(first === 0x2001 && (second < 0x200 || second === 0xdb8)) && first !== 0x3fff;
}
export async function validateTarget(value, { lookup = dnsLookup, upstreams = [] } = {}) {
  let url; try { url = new URL(value); } catch { throw failure('url'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw failure('url');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (upstreams.length && !upstreams.includes(url.host.toLowerCase())) throw failure('upstreamDenied', 403);
  const records = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await lookup(hostname, { all: true, verbatim: true });
  if (!records.length || records.some(r => !isPublicAddress(r.address))) throw failure('privateAddress', 403);
  return { url, records };
}
export async function safeFetch(value, init = {}, options = {}) {
  const { url, records } = await validateTarget(value, options);
  const request = options.request || httpsRequest, limit = options.limit || 2 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    // Pin the validated DNS records to this TLS connection; no second DNS lookup or rebinding.
    const req = request(url, { method: init.method || 'GET', headers: init.headers, signal: init.signal,
      lookup: (_host, opts, callback) => opts.all ? callback(null, records) : callback(null, records[0].address, records[0].family) }, res => {
      let size = 0; const chunks = [];
      if (Number(res.headers['content-length']) > limit) { res.destroy(failure('responseLimit', 413)); reject(failure('responseLimit', 413)); return; }
      res.on('data', chunk => { size += chunk.length; if (size > limit) res.destroy(failure('responseLimit', 413)); else chunks.push(chunk); });
      res.on('error', reject);
      res.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers: Object.fromEntries(Object.entries(res.headers).filter(([, v]) => v !== undefined).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v)])) })));
    });
    req.on('error', reject); req.setTimeout(options.timeout || 60000, () => req.destroy(failure('timeout', 504)));
    if (init.body) req.write(init.body); req.end();
  });
}
function decodeEntities(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', times: '×', middot: '·', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, entity) => {
    if (!entity.startsWith('#')) return named[entity.toLowerCase()] ?? all;
    const point = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
  });
}
export function extractText(html) {
  return decodeEntities(html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(?:br|\/p|\/div|\/h[1-6]|\/li|\/tr|\/section|\/article)\b[^>]*>/gi, '\n').replace(/<\/(?:td|th)>/gi, '\t').replace(/<[^>]*>/g, ''))
    .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
export async function fetchPage(value, { fetcher = safeFetch, signal } = {}) {
  const timeout = AbortSignal.any([AbortSignal.timeout(15000), ...(signal ? [signal] : [])]);
  let url = value;
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetcher(url, { signal: timeout, headers: { Accept: 'text/html, text/plain', 'Accept-Encoding': 'identity', 'User-Agent': 'Duel-Sanctuary-Deck-Import/1.0' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirects === 3 || !response.headers.get('location')) throw failure('redirects');
      url = new URL(response.headers.get('location'), url).href; continue;
    }
    if (!response.ok) throw failure('pageFetch');
    const type = response.headers.get('content-type') || '';
    if (!/^text\/(html|plain)(?:;|$)/i.test(type)) throw failure('pageType');
    const raw = await Provider.limitedText(response), text = /^text\/html/i.test(type) ? extractText(raw) : raw.trim();
    const bytes = new TextEncoder().encode(text), truncated = bytes.length > 60000;
    return { text: truncated ? new TextDecoder().decode(bytes.slice(0, 59996)).replace(/\uFFFD$/, '') : text, truncated, url };
  }
}
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
      if (pathname === '/api/ai/info' && request.method === 'GET') { send(response, 200, { available: true, hosted: Boolean(env.DUEL_AI_DEFAULT_KEY && env.DUEL_AI_DEFAULT_URL && env.DUEL_AI_DEFAULT_MODEL) }); return true; }
      if (!['/api/ai/complete', '/api/ai/fetch-url'].includes(pathname)) throw failure('endpoint', 404);
      if (request.method !== 'POST') throw failure('method', 405);
      if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) throw failure('request', 415);
      if (total >= 8 || (active.get(peer) || 0) >= 2) throw failure('busy', 429);
      total++; active.set(peer, (active.get(peer) || 0) + 1); acquired = true;
      const body = await readBody(request, pathname.endsWith('fetch-url') ? 4096 : 23 * 1024 * 1024);
      if (pathname.endsWith('fetch-url')) {
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
