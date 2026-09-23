import test from 'node:test';
import assert from 'node:assert/strict';
import { publicLookup, validateTarget } from '../server/ai-network.mjs';
import { validateQueries, parseSearchResults, searchDecks } from '../server/deck-search.mjs';
import { createPvpServer } from '../server/index.mjs';
import { championshipDeck } from '../server/championship-search.mjs';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const record = { deckNum: 123, deck_name: 'Blue-Eyes fixture', username: 'Source author', pretty_url: 'blue-eyes-fixture-123', format: 'Edison Format Decks', deck_description: '<p>Big dragons.</p><script>ignored()</script>', main_deck: '["89631139","89631139","89631140"]', extra_deck: '[]', side_deck: '["14558127"]' };
test('2010 champion is the original 41/15/15 Frog FTK and requires live event/image verification',async()=>{
  const data=JSON.parse(await readFile(new URL('../data/deck-research/world-champions.json',import.meta.url),'utf8'))[0];
  const bytes=Buffer.from('fixture image'),catalog=[{...data,imageSha256:createHash('sha256').update(bytes).digest('hex')}];
  const fetcher=async url=>url===data.url?new Response('<p>World Championship 2010 1st Galileo De Obaldia</p><img src="'+data.imageUrl+'">'):new Response(bytes);
  const result=await championshipDeck(2010,{catalog,fetcher});const deck=result.sources[0].deck;
  assert.deepEqual(['main','extra','side'].map(z=>deck[z].reduce((n,c)=>n+c.count,0)),[41,15,15]);assert.equal(result.sources[0].verification,'image-sha256');
  await assert.rejects(championshipDeck(2010,{catalog,fetcher:async url=>url===data.url?await fetcher(url):new Response('changed')}),{code:'championshipChanged'});
  await assert.rejects(championshipDeck(2010,{catalog,fetcher:async()=>new Response('Wrong winner')}),{code:'championshipChanged'});
  await assert.rejects(championshipDeck(2020,{catalog,fetcher}),{code:'championshipUnavailable'});
});
test('search terms and formats are bounded and cannot override the remote host', async () => {
  assert.throws(() => validateQueries([{ query: '', format: 'any' }]), { code: 'searchQuery' });
  assert.throws(() => validateQueries(Array(4).fill({ query: 'Blue-Eyes', format: 'any' })), { code: 'searchQuery' });
  const requests = [];
  const result = await searchDecks([{ query: 'Blue-Eyes&host=127.0.0.1', format: 'edison' }], { fetcher: async (url, options) => { requests.push({ url, options }); return Response.json([record]); } });
  const url = new URL(requests[0].url); assert.equal(url.hostname, 'ygoprodeck.com'); assert.equal(url.searchParams.get('name'), 'Blue-Eyes&host=127.0.0.1'); assert.equal(url.searchParams.has('host'), false);
  assert.equal(requests[0].options.headers.Authorization, undefined); assert.equal(result.sources[0].url, 'https://ygoprodeck.com/deck/blue-eyes-fixture-123');
});
test('public search rows retain exact counts, original URL, author and observed timestamp', () => {
  const source = parseSearchResults([record], { query: 'Blue-Eyes', format: 'edison' }, '2026-09-22T12:00:00.000Z')[0];
  assert.equal(source.author, 'Source author'); assert.equal(source.description, 'Big dragons.'); assert.equal(source.deck.main[0].count, 2); assert.equal(source.deck.main[0].isPassword, true);
  assert.equal(source.retrievedAt, '2026-09-22T12:00:00.000Z');
  assert.equal(parseSearchResults([{ ...record, pretty_url: '../redirect' }, { ...record, main_deck: '["not-a-password"]' }], { query: 'x', format: 'any' }).length, 0);
});
test('partial search failures retain sources; empty and blocked sites do not produce invented decks', async () => {
  let calls = 0;
  const result = await searchDecks([{ query: 'Blue-Eyes', format: 'edison' }, { query: 'Blue-Eyes', format: 'any' }], { fetcher: async () => ++calls === 1 ? new Response('blocked', { status: 403 }) : Response.json([record, record]) });
  assert.equal(result.sources.length, 1); assert.equal(result.warnings.length, 1);
  assert.equal((await searchDecks([{ query: 'missing', format: 'any' }], { fetcher: async () => Response.json({ error: 'No decks found' }) })).sources.length, 0);
  await assert.rejects(searchDecks([{ query: 'x', format: 'any' }], { fetcher: async () => new Response('<html>captcha</html>', { status: 200 }) }), { code: 'searchUnavailable' });
});
test('TUN fake DNS is re-resolved to pinned public IPs, never allowed as a private destination', async () => {
  let lookups = 0;
  const resolved = await publicLookup('public.example', { lookup: async () => [{ address: '198.18.0.1', family: 4 }], fetcher: async (url, init) => { lookups++; assert.equal(new URL(url).hostname, 'cloudflare-dns.com'); assert.equal(init.redirect, 'error'); return Response.json({ Status: 0, Answer: [{ type: 1, data: '1.1.1.1' }] }); } });
  assert.deepEqual(resolved, [{ address: '1.1.1.1', family: 4 }]); assert.equal(lookups, 1);
  await assert.rejects(publicLookup('private.example', { lookup: async () => [{ address: '198.18.0.1', family: 4 }], fetcher: async () => Response.json({ Status: 0, Answer: [{ type: 1, data: '127.0.0.1' }] }) }), { code: 'privateAddress' });
  await assert.rejects(validateTarget('https://198.18.0.1'), { code: 'privateAddress' });
  const original = await publicLookup('private.example', { lookup: async () => [{ address: '10.0.0.1', family: 4 }], fetcher: async () => { throw Error('Must not request DoH for private DNS'); } }); assert.equal(original[0].address, '10.0.0.1');
});
test('live local HTTP route exposes search capability, limits requests and forwards no API key to search', async t => {
  let headers;
  const app = await createPvpServer({ database: ':memory:', aiOptions: { env: {}, searchFetch: async (_url, init) => { headers = init.headers; return Response.json([record]); } } });
  const address = await app.listen(0), base = 'http://127.0.0.1:' + address.port; t.after(() => app.close());
  assert.equal((await (await fetch(base + '/api/ai/info')).json()).deckSearch, true);
  const response = await fetch(base + '/api/ai/search-decks', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Duel-AI-Key': 'never-forward-this' }, body: JSON.stringify({ queries: [{ query: 'Blue-Eyes', format: 'any' }] }) });
  assert.equal(response.status, 200); assert.equal((await response.json()).sources.length, 1); assert.ok(!JSON.stringify(headers).includes('never-forward-this'));
  assert.equal((await fetch(base + '/api/ai/search-decks', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://foreign.example' }, body: '{}' })).status, 403);
});
