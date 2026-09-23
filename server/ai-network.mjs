import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';
import Provider from '../src/ai-provider.js';

const failure = (code, status = 400) => Object.assign(new Error(code), { code, status });
const dnsCache = new Map();
export async function publicLookup(hostname, { lookup = dnsLookup, fetcher = fetch } = {}) {
  const records = await lookup(hostname, { all: true, verbatim: true });
  // TUN proxies commonly replace public DNS answers with 198.18/15 fake IPs.
  // Never connect to those addresses. Resolve the public name over fixed HTTPS DNS,
  // validate those answers below and pin the actual public IP to the TLS socket.
  if (!records.length || !records.every(r => /^198\.(18|19)\./.test(r.address))) return records;
  const cached = dnsCache.get(hostname);
  if (fetcher === fetch && cached?.expires > Date.now()) return cached.records;
  const response = await fetcher('https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(hostname) + '&type=A', {
    headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(8000), redirect: 'error', credentials: 'omit'
  });
  if (!response.ok) throw failure('dns', 502);
  let payload; try { payload = JSON.parse(await Provider.limitedText(response, 64000)); } catch { throw failure('dns', 502); }
  const answers = Array.isArray(payload.Answer) ? payload.Answer : [];
  const resolved = answers.filter(r => r.type === 1).map(r => ({ address: r.data, family: 4 }));
  if (payload.Status !== 0 || !resolved.length || resolved.some(r => !isPublicAddress(r.address))) throw failure('privateAddress', 403);
  if (fetcher === fetch) { if (dnsCache.size > 1000) dnsCache.clear(); dnsCache.set(hostname, { expires: Date.now() + 30000, records: resolved }); }
  return resolved;
}
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
export async function validateTarget(value, { lookup = publicLookup, upstreams = [] } = {}) {
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
    const req = request(url, { method: init.method || 'GET', headers: { 'Accept-Encoding': 'identity', ...init.headers }, signal: init.signal,
      lookup: (_host, opts, callback) => opts.all ? callback(null, records) : callback(null, records[0].address, records[0].family) }, res => {
      let size = 0; const chunks = [];
      res.on('error', reject);
      if (Number(res.headers['content-length']) > limit) { res.destroy(failure('responseLimit', 413)); reject(failure('responseLimit', 413)); return; }
      res.on('data', chunk => { size += chunk.length; if (size > limit) res.destroy(failure('responseLimit', 413)); else chunks.push(chunk); });
      res.on('end', () => {
        try { resolve(new Response([204, 205, 304].includes(res.statusCode) ? null : Buffer.concat(chunks), { status: res.statusCode, headers: Object.fromEntries(Object.entries(res.headers).filter(([, v]) => v !== undefined).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v)])) })); }
        catch { reject(failure('network', 502)); }
      });
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
