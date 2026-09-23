const test = require('node:test'), assert = require('node:assert/strict');
require('../src/advanced-engine.js'); require('../src/advanced-effects.js'); require('../src/card-locales.js');
const T = require('../src/deck-tools.js'), { parse } = require('../src/deck-parse.js');
test('YDK preserves zones, alternate art passwords and leading-zero numbers', () => {
  const { decks: [d], format } = parse('#created by a player\n#main\n89631140\n00521154\n#extra\n84013237\n!side\n14558127');
  assert.equal(format, 'ydk'); assert.equal(d.main[1].name, '00521154'); assert.equal(d.extra.length, 1); assert.equal(d.side.length, 1);
  assert.throws(() => parse('#main\n89631139\nnot a password'), { code: 'invalidYdk' });
});
test('YDKe decodes unsigned little-endian passwords and validates base64/length', () => {
  const b = Buffer.alloc(8); b.writeUInt32LE(89631139); b.writeUInt32LE(14558127, 4);
  const d = parse('ydke://' + b.toString('base64') + '!!!').decks[0]; assert.deepEqual(d.main.map(v => v.name), ['89631139', '14558127']);
  for (const invalid of ['ydke://abc!!!', 'ydke://!!!!', 'ydke://YWJj!!!']) assert.throws(() => parse(invalid), { code: 'invalidYdke' });
});
test('line lists support both quantity directions and multilingual zones without dropping prose', () => {
  for (const line of ['3 青眼白龙', '3x青眼白龙', '3 × 青眼白龙', '青眼白龙 x3']) assert.deepEqual(parse(line).decks[0].main[0], { name: '青眼白龙', count: 3, language: 'unknown', autoZone: true });
  const d = parse('Main Deck (40)\n3 Blue-Eyes White Dragon\nエクストラデッキ\n1 Stardust Dragon\n副卡组\n2 灰流丽').decks[0]; assert.equal(d.extra.length, 1); assert.equal(d.side.length, 1);
  assert.equal(parse('This article uses\n3 Blue-Eyes White Dragon\nand two other cards'), null);
  assert.equal(parse(''), null);
});
test('local deck JSON roundtrip and notes; arbitrary config never enters a saved/exported deck', () => {
  const original = { name: 'Round trip', notes: 'Missing: Ash', apiKey: 'NEVER-EXPORT', provider: { apiKey: 'NEVER-EXPORT' } };
  // Use a known preset independently of roster naming.
  original.cards = [...Object.values(globalThis.DuelData.DECKS).find(d => d.preset).cards]; original.extra = [...Object.values(globalThis.DuelData.DECKS).find(d => d.preset).extra];
  const encoded = T.exportJSON(original), parsed = parse(encoded);
  assert.ok(!encoded.includes('NEVER-EXPORT')); assert.equal(parsed.decks[0].main.length, original.cards.length); assert.equal(T.parseJSON(encoded).notes, original.notes);
  assert.equal(T.clean(original).apiKey, undefined); assert.equal(T.clean(original).notes, original.notes);
});
test('malformed structured input is rejected rather than sent to AI', () => {
  for (const text of ['{broken}', '{"name":"bad","main":[{"name":"x","count":0}]}', '{"decks":[]}']) assert.throws(() => parse(text), { code: 'invalidJSON' });
  assert.throws(() => parse('汉'.repeat(20001)), { code: 'textLimit' });
  assert.throws(() => parse(Array(401).fill('1 Blue-Eyes White Dragon').join('\n')), { code: 'entryLimit' });
});
