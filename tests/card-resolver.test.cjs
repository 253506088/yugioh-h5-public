const test = require('node:test'), assert = require('node:assert/strict');
require('../src/advanced-engine.js'); require('../src/advanced-effects.js'); require('../src/deck-tools.js');
const D = globalThis.DuelData, locales = require('../src/card-locales.js'), catalog = require('../src/card-catalog.js'), aliases = require('../data/card-aliases.json');
const R = require('../src/card-resolver.js'), r = R.create({ cards: D.CARDS, locales, catalog, aliases });
test('reported bilingual Frog list resolves offline into a valid 40/15 deck', () => {
  const input = require('node:fs').readFileSync(require('node:path').join(__dirname, 'fixtures/frog-bilingual.txt'), 'utf8');
  const parsed = require('../src/deck-parse.js').parse(input), deck = r.resolveDeck(parsed.decks[0]);
  assert.ok([...deck.main, ...deck.extra].every(c => c.status === 'playable'));
  assert.equal(r.draft(deck).check.valid, true); assert.equal(r.draft(deck).check.mainCount, 40); assert.equal(r.draft(deck).check.extraCount, 15);
  assert.equal(r.resolve('光帝 克莱斯（Kuraz the Light Monarch）').id, r.resolve('Kuraz the Light Monarch').id);
  assert.equal(r.resolve('一击必杀 侍女（One for One）').id, r.resolve('One for One').id);
  assert.equal(r.resolve('青眼白龙（Dark Magician）').labelMismatch, true);
  const explicit = r.resolveDeck(require('../src/deck-parse.js').parse('主卡组\n1 星尘龙（Stardust Dragon）').decks[0]);
  assert.equal(explicit.main.length, 1); assert.equal(explicit.extra.length, 0);
});
test('four ordered exact indexes, multilingual normalization and all five known collisions', () => {
  for (const name of ['青眼白龙', 'Blue-Eyes White Dragon', '青眼の白龍', 'blue-eyes white dragon']) assert.equal(r.resolve(name).id, 'blue-eyes');
  assert.equal(r.resolve('Blue Eyes White Dragon').method, 'C'); assert.equal(r.resolve('Maxx “C”').id, 'early-23434538');
  assert.equal(r.resolve('No.39希望皇霍普').id, 'utopia'); assert.equal(r.resolve('Ｅ・ＨＥＲＯ シャドー・ミスト').id, 'hero-shadow-mist');
  for (const [name, id] of [['暗灵使 达克', 'early-19327348'], ['混沌之黑魔术师', 'early-40737112'], ['恶魔之镜', 'early-15150371'], ['假面魔兽 死亡护法师', 'early-48948935'], ['死之信息「A」', 'early-67287533']]) assert.equal(r.resolve(name).id, id, name);
  assert.equal(r.resolve('雷鸣').id, 'early-56260110'); assert.equal(r.resolve('雷-鸣').id, 'early-63223467'); assert.equal(r.resolve('雷 鸣').status, 'ambiguous');
});
test('full pool name regression: zero ambiguities and only the five documented own-name collisions', () => {
  let checked = 0, overrides = [];
  for (const card of D.CARD_LIST.filter(c => !c.notCollectible)) for (const name of [...Object.values(locales[card.id]?.locales || {}).map(v => v.name), card.name, card.en, card.officialName].filter(Boolean)) {
    const result = r.resolve(name, { fuzzy: false }); assert.notEqual(result.status, 'ambiguous', name); assert.ok(result.id, name); checked++;
    if (result.id !== card.id) overrides.push([card.id, name, result.id]);
  }
  assert.ok(checked >= 25100); assert.equal(new Set(overrides.map(v => v[0])).size, 5);
});
test('passwords resolve aliases and cards that have no providerId', () => {
  assert.equal(r.resolve('89631139').id, 'blue-eyes'); assert.equal(r.resolve('89631140').id, 'blue-eyes');
  const shadow = catalog.find(row => row[2] === 'Elemental HERO Shadow Mist' && !row[4]); assert.equal(r.resolve(String(shadow[0])).id, 'hero-shadow-mist');
  assert.equal(r.resolve('00000000').status, 'unknown');
  assert.equal(r.resolve('7').id, 'early-67048711'); assert.equal(r.resolve({ name: '7', isPassword: true }).status, 'unknown');
});
test('catalog versus unknown, aliases, fuzzy thresholds and short Chinese OCR', () => {
  const ash = r.resolve('灰流丽'); assert.equal(ash.status, 'not-in-pool'); assert.equal(ash.password, '14558127'); assert.equal(r.resolve('Ash').password, ash.password);
  assert.equal(r.resolve('增 G').id, 'early-23434538'); assert.equal(r.resolve('青眼白龍').id, 'blue-eyes');
  const typo = r.resolve('青眼白尤'); assert.equal(typo.status, 'ambiguous'); assert.equal(typo.candidates[0].id, 'blue-eyes');
  const duality = r.resolve('Pot of Dualty'); assert.equal(duality.id, 'early-98645731'); assert.equal(duality.corrected, true);
  assert.equal(r.resolve('zzzzzzzzzzzz').status, 'unknown');
  const outside = r.resolve('Ash Blossom & Joyous Sprin'); assert.equal(outside.status, 'not-in-pool'); assert.equal(outside.corrected, true);
});
test('pending, tokens, duplicate cap across main/extra, side exclusion and notes', () => {
  const cards = { a: { id: 'a', name: 'Alpha fixture', type: 'monster' }, p: { id: 'p', name: 'Pending fixture', implementationStatus: 'pending' }, token: { id: 'token', name: 'Token fixture', notCollectible: true } };
  const resolver = R.create({ cards, locales: {}, catalog: [], aliases: {} }); assert.equal(resolver.resolve('Pending fixture').status, 'pending'); assert.equal(resolver.resolve('Token fixture', { fuzzy: false }).status, 'unknown');
  const e = (name, count) => ({ name, count, language: 'en' });
  const d = r.resolveDeck({ name: 'Test', main: [e('Blue-Eyes White Dragon', 3), e('青眼白龙', 2), e('灰流丽', 2)], extra: [], side: [e('Effect Veiler', 1)], uncertain: [] });
  const output = r.draft(d); assert.deepEqual(output.deck.cards, ['blue-eyes', 'blue-eyes', 'blue-eyes']); assert.equal(output.warnings.length, 1); assert.match(output.deck.notes, /14558127/); assert.match(output.deck.notes, /side/); assert.equal(output.check.valid, false);
});
