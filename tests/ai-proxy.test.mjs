import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { isPublicAddress, validateTarget, safeFetch, fetchPage, extractText } from '../server/ai-proxy.mjs';
import { createPvpServer } from '../server/index.mjs';

test('private, local, reserved and disguised IPv4/IPv6 addresses are rejected', async () => {
  for (const ip of ['127.0.0.1', '10.1.1.1', '172.16.1.1', '192.168.1.1', '169.254.169.254', '100.64.1.1', '0.0.0.0', '198.19.0.1', '224.0.0.1', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '2002:7f00:1::', '2001:db8::1']) assert.equal(isPublicAddress(ip), false, ip);
  for (const ip of ['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111', '2001:4860:4860::8888']) assert.equal(isPublicAddress(ip), true, ip);
  for (const url of ['https://127.1', 'https://2130706433', 'https://0x7f000001', 'https://[::ffff:127.0.0.1]']) await assert.rejects(validateTarget(url), { code: 'privateAddress' });
  await assert.rejects(validateTarget('https://mixed.example', { lookup: async () => [{ address: '1.1.1.1', family: 4 }, { address: '10.0.0.1', family: 4 }] }), { code: 'privateAddress' });
  await assert.rejects(validateTarget('https://not-allowed.example', { upstreams: ['allowed.example'] }), { code: 'upstreamDenied' });
});
test('the TLS connection uses the already checked DNS records and bounded response', async () => {
  let lookups = 0, pinned;
  const response = await safeFetch('https://public.example', {}, { lookup: async () => { lookups++; return [{ address: '1.1.1.1', family: 4 }]; }, request: (_url, options, callback) => {
    options.lookup('public.example', {}, (_error, address) => { pinned = address; });
    const req = new EventEmitter(); req.setTimeout = () => {}; req.write = () => {}; req.end = () => { const stream = new PassThrough(); stream.statusCode = 200; stream.headers = { 'content-type': 'text/plain' }; callback(stream); stream.end('deck'); }; return req;
  } });
  assert.equal(lookups, 1); assert.equal(pinned, '1.1.1.1'); assert.equal(await response.text(), 'deck');
  await assert.rejects(safeFetch('https://public.example', {}, { limit: 3, lookup: async () => [{ address: '1.1.1.1', family: 4 }], request: (_u, _o, callback) => {
    const req = new EventEmitter(); req.setTimeout = () => {}; req.end = () => { const stream = new PassThrough(); stream.statusCode = 200; stream.headers = {}; callback(stream); stream.end('too large'); }; return req;
  } }), { code: 'responseLimit' });
  await assert.rejects(safeFetch('https://public.example', {}, { limit: 3, lookup: async () => [{ address: '1.1.1.1', family: 4 }], request: (_u, _o, callback) => {
    const req = new EventEmitter(); req.setTimeout = () => {}; req.end = () => { const stream = new PassThrough(); stream.statusCode = 200; stream.headers = { 'content-length': '9999999' }; callback(stream); }; return req;
  } }), { code: 'responseLimit' });
});
test('web text preserves lists and table text, removes scripts and follows at most three redirects', async () => {
  const html = '<script>bad</script><style>bad</style><h1>Deck</h1><table><tr><td>3</td><td>Blue-Eyes &amp; friends</td></tr></table><ul><li>1 Maxx &quot;C&quot;</li></ul>';
  assert.equal(extractText(html), 'Deck\n3 Blue-Eyes & friends\n1 Maxx "C"');
  let calls = 0;
  const output = await fetchPage('https://public.example', { fetcher: async () => ++calls === 1 ? new Response(null, { status: 302, headers: { location: '/final' } }) : new Response(html, { headers: { 'Content-Type': 'text/html' } }) });
  assert.equal(output.url, 'https://public.example/final'); assert.match(output.text, /Blue-Eyes/);
  calls = 0; await assert.rejects(fetchPage('https://public.example', { fetcher: async () => { calls++; return new Response(null, { status: 302, headers: { location: '/again' } }); } }), { code: 'redirects' }); assert.equal(calls, 4);
  await assert.rejects(fetchPage('https://public.example', { fetcher: async () => new Response('pdf', { headers: { 'Content-Type': 'application/pdf' } }) }), { code: 'pageType' });
  await assert.rejects(fetchPage('https://public.example', { fetcher: async url => { if (url.startsWith('https://127.')) return safeFetch(url); return new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/private' } }); } }), { code: 'privateAddress' });
});
async function server(t, aiOptions) { const app = await createPvpServer({ database: ':memory:', aiOptions }); const address = await app.listen(0); t.after(() => app.close()); return 'http://127.0.0.1:' + address.port; }
const config = { protocol: 'openai', baseUrl: 'https://provider.example', model: 'fixture', openaiEndpoint: 'chat-completions', transport: 'server' };
const post = (base, body, headers = {}) => fetch(base + '/api/ai/complete', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
test('real server routes forward via key header, enforce origin and preserve private file protections', async t => {
  let seen;
  const base = await server(t, { env: {}, completeFetch: async (url, options) => { seen = { url, ...options }; return new Response(JSON.stringify({ model: 'fixture', choices: [{ message: { content: 'OK' } }] })); } });
  const info = await (await fetch(base + '/api/ai/info')).json(); assert.equal(info.available, true); assert.equal(info.hosted, false);
  const result = await post(base, { config, input: {}, operation: 'test' }, { 'X-Duel-AI-Key': 'test-secret' }); assert.equal(result.status, 200); assert.equal((await result.json()).data, 'OK'); assert.equal(seen.headers.Authorization, 'Bearer test-secret');
  assert.ok(!seen.body.includes('test-secret'));
  assert.equal((await post(base, { config, operation: 'test' }, { Origin: 'https://foreign.example', 'X-Duel-AI-Key': 'test-secret' })).status, 403);
  assert.equal((await post(base, { config, operation: 'test' })).status, 401);
  assert.equal((await fetch(base + '/.env')).status, 404); assert.equal((await fetch(base + '/server/ai-proxy.mjs')).status, 404);
});
test('hosted keys are endpoint/model-bound and hourly rate limited', async t => {
  let forwarded = 0;
  const base = await server(t, { env: { DUEL_AI_DEFAULT_KEY: 'hosted-secret', DUEL_AI_DEFAULT_URL: config.baseUrl, DUEL_AI_DEFAULT_MODEL: config.model, DUEL_AI_DEFAULT_ENDPOINT: config.openaiEndpoint, DUEL_AI_HOURLY_LIMIT: '1' }, completeFetch: async () => { forwarded++; return new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] })); } });
  assert.equal((await post(base, { config: { ...config, baseUrl: 'https://attacker.example' }, operation: 'test' })).status, 403);
  assert.equal((await post(base, { config: { ...config, model: 'expensive-model' }, operation: 'test' })).status, 403);
  assert.equal((await post(base, { config, operation: 'test' })).status, 200);
  assert.equal((await post(base, { config, operation: 'test' })).status, 429); assert.equal(forwarded, 1);
});
