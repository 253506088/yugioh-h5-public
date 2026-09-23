const test = require('node:test'), assert = require('node:assert/strict');
require('../src/advanced-engine.js'); require('../src/advanced-effects.js'); require('../src/deck-tools.js');
const locales = require('../src/card-locales.js'), catalog = require('../src/card-catalog.js');
const P = require('../src/ai-provider.js'), R = require('../src/deck-research.js');
const D = globalThis.DuelData, resolver = require('../src/card-resolver.js').create({ cards: D.CARDS, locales, catalog });
const preset = Object.values(D.DECKS).find(d => d.preset && globalThis.DuelDecks.analyze(d).valid);
const entries = list => { const counts = new Map(); for (const id of list) { const password = String(D.CARDS[id].providerId || locales[id].providerId); counts.set(password, (counts.get(password) || 0) + 1); } return [...counts].map(([name, count]) => ({ name, count, language: 'unknown', isPassword: true })); };
const fixture = { id: 'web-100', title: 'Public source fixture', url: 'https://ygoprodeck.com/deck/source-100', author: 'Fixture Author', format: 'Edison', description: 'Public source list used for testing.', retrievedAt: '2026-09-22T12:00:00.000Z', deck: { name: 'Fixture', main: entries(preset.cards), extra: entries(preset.extra), side: [], uncertain: [] } };
const prepared = R.prepare([fixture], resolver), request = { description: 'Build using this source', language: 'en', maxYear: 0 }, sent = R.context(prepared, request, true);
test('slang, independent themes and championship requests are understood before model generation',()=>{
  const junk=R.quickPlan('我想要一套废2卡组');assert.equal(junk.queries[0].query,'Junk Doppel');assert.equal(P.validate(junk,'plan'),junk);
  const multiple=R.quickPlan('弄一套银河眼卡组和一套青眼补强卡组');assert.equal(multiple.targets.length,2);assert.deepEqual(multiple.targets.map(t=>t.anchorCards[0]),['Galaxy-Eyes Photon Dragon','Blue-Eyes White Dragon']);P.validate(multiple,'plan');
  const champion=R.quickPlan('2010年冠军卡组给我抓取来放到卡组里一份');assert.equal(champion.championshipYear,2010);assert.equal(champion.queries.length,0);P.validate(champion,'plan');
  assert.equal(R.isBuildRequest('我想要一套废2卡组'),true);assert.equal(R.isBuildRequest('青眼白龙 ×3'),false);assert.equal(R.quickPlan('不要青眼，我想玩别的'),null);
});
function proposal() {
  const s = prepared.sources[0];
  return { decks: [{ name: 'Adapted', main: s.names.main.map(({ name, count }) => ({ name, count, language: 'en' })), extra: s.names.extra.map(({ name, count }) => ({ name, count, language: 'en' })), side: [], uncertain: [], rationale: 'Uses the retrieved source.', changes: [] }], warnings: [] };
}
test('planning is a small, typed model request with compatible provider schemas', () => {
  const plan = { summary: 'Blue-Eyes', maxYear: 2013, championshipYear: 0, targets: [], anchorCards: ['Blue-Eyes White Dragon'], queries: [{ query: 'Blue-Eyes', format: 'edison' }, { query: 'Blue-Eyes 2013', format: 'any' }], warnings: [] };
  assert.equal(P.validate(plan, 'plan'), plan);
  assert.throws(() => P.validate({ ...plan, queries: [{ query: 'Blue-Eyes', format: 'invented' }] }, 'plan'), { code: 'schema' });
  for (const config of [{ protocol: 'openai', openaiEndpoint: 'responses' }, { protocol: 'openai', openaiEndpoint: 'chat-completions' }, { protocol: 'anthropic' }]) {
    const spec = P.buildRequest({ ...config, baseUrl: 'https://fixture.example', apiKey: 'test', model: 'fixture' }, { text: 'request' }, 'plan');
    assert.equal(spec.body.max_tokens || spec.body.max_output_tokens, 2048);
    assert.ok(JSON.stringify(spec.body).includes('maxYear'));
  }
});
test('real source passwords become names and only playable, in-year cards become candidates', () => {
  const source = structuredClone(fixture); source.deck.main = [{ name: '89631140', count: 3, language: 'unknown', isPassword: true }, { name: '14558127', count: 1, language: 'unknown', isPassword: true }]; source.deck.extra = [];
  const result = R.prepare([source], resolver, { maxYear: 2013 });
  assert.equal(result.sources[0].counts.playable, 3); assert.equal(result.sources[0].counts.outside, 1);
  assert.equal(result.eligible.get('blue-eyes').name, 'Blue-Eyes White Dragon'); assert.equal(result.eligible.size, 1);
  assert.equal(R.prepare([source], resolver, { maxYear: 1998 }).eligible.size, 0);
  assert.throws(() => R.prepare([{ ...source, url: 'https://attacker.example/fake' }], resolver), { code: 'searchData' });
});
test('adapted builds must cite retrieved sources and contain only source-backed cards', () => {
  const output = R.build(proposal(), prepared, request, resolver, sent).decks[0];
  assert.equal(resolver.draft(output).check.valid, true); assert.match(output.notes, /https:\/\/ygoprodeck.com\/deck\/source-100/);
  assert.deepEqual(output.main[0].provenance, ['web-100']); assert.equal(output.research.mode, 'adapted');
  const fabricatedSource = proposal(); fabricatedSource.decks[0].sourceIds = ['web-999']; assert.throws(() => R.build(fabricatedSource, prepared, request, resolver, sent), { code: 'schema' });
  const outsider = Object.values(D.CARDS).find(c => !c.notCollectible && c.implementationStatus !== 'pending' && !prepared.eligible.has(c.id));
  const fabricatedCard = proposal(); fabricatedCard.decks[0].main[0].name = locales[outsider.id].locales.en.name; assert.throws(() => R.build(fabricatedCard, prepared, request, resolver, sent), { code: 'grounding' });
  const hiddenCandidate = { ...sent, candidateNames: new Set() }; assert.throws(() => R.build(proposal(), prepared, request, resolver, hiddenCandidate), { code: 'grounding' });
});
test('invalid zones, quantity overflow and undersized generated builds are rejected, not silently repaired', () => {
  const tooShort = proposal(); tooShort.decks[0].main = tooShort.decks[0].main.slice(0, 2); assert.throws(() => R.build(tooShort, prepared, request, resolver, sent), { code: 'buildInvalid' });
  const wrongZone = proposal(); wrongZone.decks[0].extra.push(wrongZone.decks[0].main.pop()); assert.throws(() => R.build(wrongZone, prepared, request, resolver, sent), { code: 'grounding' });
  const overflow = proposal(); const card = overflow.decks[0].main[0]; card.count = 3; overflow.decks[0].main.push({ ...card }); assert.throws(() => R.build(overflow, prepared, request, resolver, sent), { code: 'grounding' });
});
test('repair preserves the supplied source/candidate constraints and includes concrete validation errors', () => {
  const error = { code: 'buildInvalid', details: { errors: ['Main deck has 38 cards'] } };
  const retry = JSON.parse(R.repairContext(sent, proposal(), error)), original = JSON.parse(sent.text);
  assert.deepEqual(retry.sources, original.sources); assert.deepEqual(retry.eligibleCards, original.eligibleCards);
  assert.deepEqual(retry.validationFailure, error.details); assert.ok(retry.previousProposal);
});
test('small quantity mistakes can be corrected from actual source counts, never by inventing a card',()=>{
  const short=proposal();short.decks[0].main.pop();
  const result=R.completeQuantities(short,prepared,request,resolver,sent);assert.equal(resolver.draft(result.decks[0]).check.mainCount,40);assert.equal(result.decks[0].research.quantityRepaired,true);
  const forged=proposal();forged.decks[0].main[0].name='Never existed';assert.throws(()=>R.completeQuantities(forged,prepared,request,resolver,sent),{code:'grounding'});
  const over=proposal(),available=over.decks[0].main.find(c=>c.count<3);available.count++;
  const exact={...request,description:'主卡保持40张'};assert.throws(()=>R.build(over,prepared,exact,resolver,sent),{code:'buildInvalid'});
  assert.equal(resolver.draft(R.completeQuantities(over,prepared,exact,resolver,sent).decks[0]).check.mainCount,40);
});
test('ranking returns unmodified source lists and rejects invented references', () => {
  const ranked = R.rank({ recommendations: [{ sourceId: fixture.id, rationale: 'Matches the request.' }], warnings: [] }, prepared, request, sent);
  assert.equal(ranked.decks[0].research.mode, 'reference'); assert.deepEqual(ranked.decks[0].main.map(c => [c.id, c.count]), prepared.sources[0].resolved.main.map(c => [c.id, c.count]));
  assert.throws(() => R.rank({ recommendations: [{ sourceId: 'web-999', rationale: '' }], warnings: [] }, prepared, request, sent), { code: 'grounding' });
});
