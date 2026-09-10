const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DuelEngine } = require('../src/engine.js');
const { CARDS, DECKS, CARD_LIST } = require('../src/cards.js');

function fresh() {
  const game = new DuelEngine({ first: 0, seed: 72 });
  game.state.turn = 2;
  game.state.log = [];
  for (const player of game.state.players) { player.hand = []; player.monsters = Array(5).fill(null); player.spells = Array(5).fill(null); player.grave = []; }
  return game;
}
function put(game, owner, zone, id, props = {}) {
  const card = Object.assign(game.makeCard(id, owner), props);
  const target = game.state.players[owner][zone];
  if (zone === 'monsters' || zone === 'spells') {
    const index = target.indexOf(null);
    assert.ok(index >= 0, 'Fixture zone full'); target[index] = card;
  } else target.push(card);
  return card;
}
function ok(game, action) { const result = game.act(action); assert.equal(result.ok, true, JSON.stringify(action) + ': ' + result.error); return result; }
function rejectedWithoutMutation(game, action) { const before = game.snapshot(); const result = game.act(action); assert.equal(result.ok, false); assert.deepEqual(game.snapshot(), before); return result; }
function allCards(game) { return game.state.players.flatMap(p => ['deck', 'hand', 'monsters', 'spells', 'grave', 'extra'].flatMap(zone => p[zone].filter(Boolean))); }

test('two complete 40-card decks and 35 illustrated card definitions', () => {
  assert.equal(CARD_LIST.length, 35);
  for (const deck of Object.values(DECKS)) { assert.equal(deck.cards.length, 40); assert.ok(deck.cards.every(id => CARDS[id])); assert.ok(deck.extra.every(id => CARDS[id].type === 'fusion')); }
  for (const c of CARD_LIST) assert.ok(fs.existsSync(path.join(__dirname, '../assets/art', c.art + '.svg')), c.id);
});
test('shuffle is reproducible, all cards are conserved, and both sides get an opening monster', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const a = new DuelEngine({ seed }), b = new DuelEngine({ seed });
    assert.deepEqual(a.state.players, b.state.players);
    assert.equal(allCards(a).length, 83);
    assert.equal(new Set(allCards(a).map(c => c.uid)).size, 83);
    for (const p of a.state.players) { assert.equal(p.hand.length, 5); assert.equal(p.deck.length, 35); assert.ok(p.hand.some(c => CARDS[c.id].type === 'monster' && CARDS[c.id].level <= 4)); }
  }
});
test('normal summon and set share one allowance; invalid actions are atomic', () => {
  const g = fresh(), a = put(g, 0, 'hand', 'luster-dragon'), b = put(g, 0, 'hand', 'battle-ox');
  ok(g, { type: 'summon', uid: a.uid }); assert.equal(g.state.normalUsed, true);
  rejectedWithoutMutation(g, { type: 'summon', uid: b.uid, mode: 'defense' });
  rejectedWithoutMutation(g, { type: 'summon', uid: 'missing' });
  assert.equal(g.monsters(0).length, 1);
});
test('upper-level monsters require the exact number of unique owned tributes', () => {
  const g = fresh(), dragon = put(g, 0, 'hand', 'blue-eyes'), a = put(g, 0, 'monsters', 'battle-ox'), b = put(g, 0, 'monsters', 'kaibaman', { faceUp: false, position: 'defense' }), enemy = put(g, 1, 'monsters', 'celtic-guardian');
  rejectedWithoutMutation(g, { type: 'summon', uid: dragon.uid });
  rejectedWithoutMutation(g, { type: 'summon', uid: dragon.uid, tributes: [a.uid] });
  rejectedWithoutMutation(g, { type: 'summon', uid: dragon.uid, tributes: [a.uid, a.uid] });
  rejectedWithoutMutation(g, { type: 'summon', uid: dragon.uid, tributes: [a.uid, enemy.uid] });
  ok(g, { type: 'summon', uid: dragon.uid, tributes: [a.uid, b.uid] });
  assert.equal(g.monsters(0)[0].id, 'blue-eyes'); assert.equal(g.state.players[0].grave.length, 2);
});
test('5–6 star tribute summon can use a full field', () => {
  const g = fresh(), skull = put(g, 0, 'hand', 'summoned-skull');
  const monsters = Array.from({ length: 5 }, () => put(g, 0, 'monsters', 'celtic-guardian'));
  ok(g, { type: 'summon', uid: skull.uid, tributes: [monsters[0].uid] });
  assert.equal(g.monsters(0).length, 5); assert.equal(g.find(skull.uid).zone, 'monsters');
});
test('Kaibaman releases itself to special summon Blue-Eyes without consuming another normal summon', () => {
  const g = fresh(), kaiba = put(g, 0, 'hand', 'kaibaman'), dragon = put(g, 0, 'hand', 'blue-eyes');
  ok(g, { type: 'summon', uid: kaiba.uid }); ok(g, { type: 'effect', uid: kaiba.uid });
  assert.equal(g.find(kaiba.uid).zone, 'grave'); assert.equal(g.find(dragon.uid).zone, 'monsters'); assert.equal(g.state.normalUsed, true);
  assert.equal(g.attackValue(dragon), 3000);
});
test('a monster cannot change position on its summon turn or after attacking', () => {
  const g = fresh(), a = put(g, 0, 'hand', 'battle-ox');
  ok(g, { type: 'summon', uid: a.uid, mode: 'defense' });
  rejectedWithoutMutation(g, { type: 'stance', uid: a.uid });
  g.state.turn += 2;
  ok(g, { type: 'stance', uid: a.uid }); assert.equal(g.find(a.uid).card.faceUp, true); assert.equal(g.find(a.uid).card.position, 'attack');
  rejectedWithoutMutation(g, { type: 'stance', uid: a.uid });
  g.state.turn += 2; g.find(a.uid).card.attacked = true;
  rejectedWithoutMutation(g, { type: 'stance', uid: a.uid });
});
test('phase progression is forward-only and the first player cannot attack on turn 1', () => {
  const g = fresh(); g.state.turn = 1;
  rejectedWithoutMutation(g, { type: 'phase', phase: 'battle' });
  g.state.turn = 2; ok(g, { type: 'phase', phase: 'battle' });
  rejectedWithoutMutation(g, { type: 'phase', phase: 'main1' });
  ok(g, { type: 'phase', phase: 'main2' });
  rejectedWithoutMutation(g, { type: 'phase', phase: 'battle' });
});
test('attack vs attack destroys the weaker monster and inflicts the difference', () => {
  const g = fresh(), a = put(g, 0, 'monsters', 'blue-eyes'), b = put(g, 1, 'monsters', 'dark-magician');
  g.state.phase = 'battle'; ok(g, { type: 'attack', uid: a.uid, target: b.uid });
  assert.equal(g.state.players[1].lp, 7500); assert.equal(g.find(b.uid).zone, 'grave'); assert.equal(g.find(a.uid).card.attacked, true);
  rejectedWithoutMutation(g, { type: 'attack', uid: a.uid });
});
test('equal nonzero attacks destroy both monsters without LP damage', () => {
  const g = fresh(), a = put(g, 0, 'monsters', 'battle-ox'), b = put(g, 1, 'monsters', 'battle-ox');
  g.state.phase = 'battle'; ok(g, { type: 'attack', uid: a.uid, target: b.uid });
  assert.equal(g.monsters(0).length, 0); assert.equal(g.monsters(1).length, 0); assert.equal(g.state.players[0].lp, 8000);
});
test('a failed attack on defense damages the attacker without destroying either monster', () => {
  const g = fresh(), a = put(g, 0, 'monsters', 'luster-dragon'), b = put(g, 1, 'monsters', 'stone-soldier', { position: 'defense', faceUp: false });
  g.state.phase = 'battle'; ok(g, { type: 'attack', uid: a.uid, target: b.uid });
  assert.equal(g.state.players[0].lp, 7900); assert.equal(g.state.players[1].lp, 8000); assert.equal(g.find(b.uid).card.faceUp, true); assert.equal(g.monsters(1).length, 1);
});
test('defense destruction causes no damage unless the attacker has piercing', () => {
  const g = fresh(), a = put(g, 0, 'monsters', 'luster-dragon'), b = put(g, 1, 'monsters', 'celtic-guardian', { position: 'defense' });
  g.state.phase = 'battle'; ok(g, { type: 'attack', uid: a.uid, target: b.uid }); assert.equal(g.state.players[1].lp, 8000);
  const spear = put(g, 0, 'monsters', 'spear-dragon'), defender = put(g, 1, 'monsters', 'celtic-guardian', { position: 'defense' });
  ok(g, { type: 'attack', uid: spear.uid, target: defender.uid });
  assert.equal(g.state.players[1].lp, 7300); assert.equal(g.find(spear.uid).card.position, 'defense');
});
test('direct attacks are illegal while a defending monster exists and can finish a duel', () => {
  const g = fresh(), a = put(g, 0, 'monsters', 'blue-eyes'), b = put(g, 1, 'monsters', 'kuriboh');
  g.state.phase = 'battle'; rejectedWithoutMutation(g, { type: 'attack', uid: a.uid });
  g.toGrave(b.uid, '', false); g.state.players[1].lp = 2300;
  ok(g, { type: 'attack', uid: a.uid }); assert.equal(g.state.winner, 0); assert.equal(g.state.players[1].lp, 0);
  rejectedWithoutMutation(g, { type: 'end' });
});
test('a trap cannot respond on the turn it was set', () => {
  const g = fresh(), a = put(g, 0, 'monsters', 'blue-eyes');
  put(g, 1, 'spells', 'mirror-force', { faceUp: false, setTurn: g.state.turn });
  g.state.phase = 'battle'; ok(g, { type: 'attack', uid: a.uid });
  assert.equal(g.state.pending, null); assert.equal(g.state.players[1].lp, 5000);
});
test('Mirror Force destroys all attacking-side attack monsters and preserves defense monsters', () => {
  const g = fresh(), a = put(g, 0, 'monsters', 'blue-eyes'), b = put(g, 0, 'monsters', 'battle-ox'), defender = put(g, 0, 'monsters', 'stone-soldier', { position: 'defense' });
  const trap = put(g, 1, 'spells', 'mirror-force', { faceUp: false, setTurn: 1 });
  g.state.phase = 'battle'; ok(g, { type: 'attack', uid: a.uid }); assert.equal(g.state.pending.kind, 'attack');
  rejectedWithoutMutation(g, { type: 'end' });
  ok(g, { type: 'respond', uid: trap.uid });
  assert.equal(g.find(a.uid).zone, 'grave'); assert.equal(g.find(b.uid).zone, 'grave'); assert.equal(g.find(defender.uid).zone, 'monsters');
  assert.equal(g.state.players[1].lp, 8000);
});
test('Magic Cylinder negates the attack and reflects damage, including lethal damage', () => {
  const g = fresh(), a = put(g, 0, 'monsters', 'blue-eyes'), t = put(g, 1, 'spells', 'magic-cylinder', { faceUp: false, setTurn: 1 });
  g.state.phase = 'battle'; g.state.players[0].lp = 2400;
  ok(g, { type: 'attack', uid: a.uid }); ok(g, { type: 'respond', uid: t.uid });
  assert.equal(g.state.winner, 1); assert.equal(g.state.players[0].lp, 0); assert.equal(g.state.players[1].lp, 8000); assert.equal(g.find(a.uid).zone, 'monsters');
});
test('Trap Hole responds to an eligible normal summon, not special summons', () => {
  const g = fresh(), a = put(g, 0, 'hand', 'luster-dragon'), t = put(g, 1, 'spells', 'trap-hole', { faceUp: false, setTurn: 1 });
  ok(g, { type: 'summon', uid: a.uid }); assert.equal(g.state.pending.kind, 'summon'); ok(g, { type: 'respond', uid: t.uid });
  assert.equal(g.find(a.uid).zone, 'grave'); assert.equal(g.state.normalUsed, true);
  put(g, 1, 'spells', 'trap-hole', { faceUp: false, setTurn: 1 });
  const reborn = put(g, 0, 'hand', 'monster-reborn'); ok(g, { type: 'cast', uid: reborn.uid, target: a.uid }); assert.equal(g.state.pending, null);
});
test('Negate Attack ends the battle phase without destroying the attacker', () => {
  const g = fresh(), a = put(g, 0, 'monsters', 'blue-eyes'), t = put(g, 1, 'spells', 'negate-attack', { faceUp: false, setTurn: 1 });
  g.state.phase = 'battle'; ok(g, { type: 'attack', uid: a.uid }); ok(g, { type: 'respond', uid: t.uid });
  assert.equal(g.state.phase, 'main2'); assert.equal(g.find(a.uid).zone, 'monsters'); assert.equal(g.state.players[1].lp, 8000);
});
test('Kuriboh protects battle damage but not the defending monster from destruction', () => {
  const g = fresh(), a = put(g, 0, 'monsters', 'blue-eyes'), b = put(g, 1, 'monsters', 'celtic-guardian'), k = put(g, 1, 'hand', 'kuriboh');
  g.state.phase = 'battle'; ok(g, { type: 'attack', uid: a.uid, target: b.uid }); ok(g, { type: 'respond', uid: k.uid });
  assert.equal(g.state.players[1].lp, 8000); assert.equal(g.find(k.uid).zone, 'grave'); assert.equal(g.find(b.uid).zone, 'grave');
});
test('declining a response resolves the battle and keeps the unused trap hidden', () => {
  const g = fresh(), a = put(g, 0, 'monsters', 'battle-ox'), t = put(g, 1, 'spells', 'mirror-force', { faceUp: false, setTurn: 1 });
  g.state.phase = 'battle'; ok(g, { type: 'attack', uid: a.uid }); ok(g, { type: 'respond', uid: null });
  assert.equal(g.state.players[1].lp, 6300); assert.equal(g.find(t.uid).card.faceUp, false);
});
test('Pot of Greed draws two cards; failing a mandatory draw loses the duel', () => {
  const g = fresh(), pot = put(g, 0, 'hand', 'pot-of-greed'), initial = g.state.players[0].deck.length;
  ok(g, { type: 'cast', uid: pot.uid }); assert.equal(g.state.players[0].hand.length, 2); assert.equal(g.state.players[0].deck.length, initial - 2);
  const g2 = fresh(), pot2 = put(g2, 0, 'hand', 'pot-of-greed'); g2.state.players[0].deck.length = 1;
  ok(g2, { type: 'cast', uid: pot2.uid }); assert.equal(g2.state.winner, 1);
});
test('Monster Reborn takes either graveyard and a captured card returns to its original owner on destruction', () => {
  const g = fresh(), dragon = put(g, 1, 'grave', 'blue-eyes'), reborn = put(g, 0, 'hand', 'monster-reborn');
  ok(g, { type: 'cast', uid: reborn.uid, target: dragon.uid });
  assert.equal(g.find(dragon.uid).owner, 0); assert.equal(g.find(dragon.uid).zone, 'monsters'); assert.equal(g.state.normalUsed, false);
  const hole = put(g, 0, 'hand', 'dark-hole'); ok(g, { type: 'cast', uid: hole.uid });
  assert.equal(g.find(dragon.uid).owner, 1); assert.equal(g.find(dragon.uid).zone, 'grave');
});
test('target validation and full zones reject spells without paying their cost', () => {
  const g = fresh(), reborn = put(g, 0, 'hand', 'monster-reborn'), dragon = put(g, 1, 'grave', 'blue-eyes');
  rejectedWithoutMutation(g, { type: 'cast', uid: reborn.uid, target: 'unknown' });
  for (let i = 0; i < 5; i++) put(g, 0, 'monsters', 'battle-ox');
  rejectedWithoutMutation(g, { type: 'cast', uid: reborn.uid, target: dragon.uid });
  const pot = put(g, 0, 'hand', 'pot-of-greed'); for (let i = 0; i < 5; i++) put(g, 0, 'spells', 'mirror-force', { faceUp: false });
  rejectedWithoutMutation(g, { type: 'cast', uid: pot.uid });
});
test('Raigeki and Fissure affect the intended enemy monsters', () => {
  const g = fresh(), weak = put(g, 1, 'monsters', 'kuriboh'), strong = put(g, 1, 'monsters', 'blue-eyes'), mine = put(g, 0, 'monsters', 'battle-ox'), fissure = put(g, 0, 'hand', 'fissure');
  ok(g, { type: 'cast', uid: fissure.uid }); assert.equal(g.find(weak.uid).zone, 'grave'); assert.equal(g.find(strong.uid).zone, 'monsters');
  const raigeki = put(g, 0, 'hand', 'raigeki'); ok(g, { type: 'cast', uid: raigeki.uid }); assert.equal(g.monsters(1).length, 0); assert.equal(g.find(mine.uid).zone, 'monsters');
});
test('Swords reveals set monsters, blocks precisely three opponent turns, and expires', () => {
  const g = fresh(), swords = put(g, 0, 'hand', 'swords'), enemy = put(g, 1, 'monsters', 'celtic-guardian', { faceUp: false, position: 'defense' });
  ok(g, { type: 'cast', uid: swords.uid }); assert.equal(g.find(enemy.uid).card.faceUp, true);
  for (let i = 0; i < 3; i++) {
    ok(g, { type: 'end' }); assert.equal(g.state.active, 1); assert.equal(g.attackBlocked(1), true);
    if (i === 0) { g.state.phase = 'battle'; g.find(enemy.uid).card.position = 'attack'; rejectedWithoutMutation(g, { type: 'attack', uid: enemy.uid }); }
    ok(g, { type: 'end' }); assert.equal(g.state.active, 0);
  }
  assert.equal(g.attackBlocked(1), false); assert.equal(g.find(swords.uid).zone, 'grave');
});
test('Mystical Space Typhoon breaks a Swords lock immediately', () => {
  const g = fresh(), swords = put(g, 1, 'spells', 'swords', { faceUp: true, turnsLeft: 3 }), mst = put(g, 0, 'hand', 'mst');
  assert.equal(g.attackBlocked(0), true); ok(g, { type: 'cast', uid: mst.uid, target: swords.uid }); assert.equal(g.attackBlocked(0), false);
});
test('fusion consumes unique materials from hand and field and removes the extra-deck card', () => {
  const g = fresh(), a = put(g, 0, 'hand', 'blue-eyes'), b = put(g, 0, 'hand', 'blue-eyes'), c = put(g, 0, 'monsters', 'blue-eyes'), poly = put(g, 0, 'hand', 'polymerization');
  const fusion = g.fusions(0).find(f => f.card.id === 'ultimate-dragon');
  assert.equal(fusion.materials.length, 3); ok(g, { type: 'cast', uid: poly.uid, target: fusion.card.uid });
  for (const material of [a, b, c]) assert.equal(g.find(material.uid).zone, 'grave');
  assert.equal(g.find(fusion.card.uid).zone, 'monsters'); assert.equal(g.find(fusion.card.uid).card.properlySummoned, true); assert.equal(g.state.normalUsed, false);
});
test('fusion can free material slots on an otherwise full field', () => {
  const g = fresh(); put(g, 0, 'monsters', 'thunder-dragon'); put(g, 0, 'monsters', 'thunder-dragon');
  for (let i = 0; i < 3; i++) put(g, 0, 'monsters', 'battle-ox');
  const poly = put(g, 0, 'hand', 'polymerization'), fusion = g.fusions(0).find(f => f.card.id === 'twin-thunder');
  assert.ok(fusion); ok(g, { type: 'cast', uid: poly.uid, target: fusion.card.uid }); assert.equal(g.monsters(0).length, 4);
});
test('Skilled Dark Magician counts both players’ spells, caps at three, and can release to summon', () => {
  const g = fresh(), mage = put(g, 0, 'monsters', 'skilled-magician'), dark = put(g, 0, 'grave', 'dark-magician');
  for (let i = 0; i < 4; i++) { g.state.active = i % 2; const spell = put(g, g.state.active, 'hand', 'dian-keto'); ok(g, { type: 'cast', uid: spell.uid }); }
  g.state.active = 0;
  assert.equal(g.find(mage.uid).card.counters, 3);
  ok(g, { type: 'effect', uid: mage.uid }); assert.equal(g.find(mage.uid).zone, 'grave'); assert.equal(g.find(dark.uid).zone, 'monsters');
});
test('Breaker spends its counter, loses 300 ATK, and destroys a chosen back-row card', () => {
  const g = fresh(), breaker = put(g, 0, 'hand', 'breaker'), target = put(g, 1, 'spells', 'mirror-force', { faceUp: false });
  ok(g, { type: 'summon', uid: breaker.uid }); assert.equal(g.attackValue(g.find(breaker.uid).card), 1900);
  ok(g, { type: 'effect', uid: breaker.uid, target: target.uid }); assert.equal(g.attackValue(g.find(breaker.uid).card), 1600); assert.equal(g.find(target.uid).zone, 'grave');
  rejectedWithoutMutation(g, { type: 'effect', uid: breaker.uid, target: target.uid });
});
test('Dark Magician Girl receives 300 ATK for each Dark Magician in either graveyard', () => {
  const g = fresh(), girl = put(g, 0, 'monsters', 'dark-girl');
  put(g, 0, 'grave', 'dark-magician'); put(g, 1, 'grave', 'dark-magician'); assert.equal(g.attackValue(girl), 2600);
});
test('Ancient Rules special summons only a high-level normal monster from hand', () => {
  const g = fresh(), spell = put(g, 0, 'hand', 'ancient-rules'), dragon = put(g, 0, 'hand', 'blue-eyes'), girl = put(g, 0, 'hand', 'dark-girl');
  rejectedWithoutMutation(g, { type: 'cast', uid: spell.uid, target: girl.uid });
  ok(g, { type: 'cast', uid: spell.uid, target: dragon.uid }); assert.equal(g.find(dragon.uid).zone, 'monsters'); assert.equal(g.state.normalUsed, false);
});
test('Thunder Dragon discards itself and finds up to two remaining copies', () => {
  const g = fresh(), thunder = put(g, 0, 'hand', 'thunder-dragon');
  g.state.players[0].deck = g.state.players[0].deck.filter(c => c.id !== 'thunder-dragon');
  put(g, 0, 'deck', 'thunder-dragon'); put(g, 0, 'deck', 'thunder-dragon');
  ok(g, { type: 'effect', uid: thunder.uid }); assert.equal(g.find(thunder.uid).zone, 'grave'); assert.equal(g.state.players[0].hand.filter(c => c.id === 'thunder-dragon').length, 2);
});
test('end-phase discard waits for exactly the required cards, then advances and draws', () => {
  const g = fresh(); for (let i = 0; i < 8; i++) put(g, 0, 'hand', 'battle-ox');
  ok(g, { type: 'end' }); assert.equal(g.state.pending.kind, 'discard'); assert.equal(g.state.pending.count, 2); assert.equal(g.state.active, 0);
  const uids = g.state.players[0].hand.slice(0, 2).map(c => c.uid);
  rejectedWithoutMutation(g, { type: 'discard', uids: [uids[0], uids[0]] });
  ok(g, { type: 'discard', uids }); assert.equal(g.state.players[0].hand.length, 6); assert.equal(g.state.active, 1); assert.equal(g.state.players[1].hand.length, 1);
});
test('hidden enemy cards are not named in set logs and AI attacks use an assumed defense value', () => {
  const g = fresh(); g.state.active = 1;
  const hidden = put(g, 1, 'hand', 'stone-soldier'); ok(g, { type: 'summon', uid: hidden.uid, mode: 'defense' });
  assert.equal(g.state.log.some(e => e.text.includes('岩石巨兵')), false);
  g.state.active = 0; g.state.phase = 'battle'; const attacker = put(g, 0, 'monsters', 'luster-dragon');
  const action = g.aiNext(); assert.equal(action.type, 'attack'); assert.equal(action.uid, attacker.uid); assert.equal(action.target, hidden.uid);
});
test('save/restore preserves pending trap responses and rejects corrupted card identities', () => {
  const g = fresh(), a = put(g, 0, 'monsters', 'blue-eyes'), t = put(g, 1, 'spells', 'mirror-force', { faceUp: false, setTurn: 1 });
  g.state.phase = 'battle'; ok(g, { type: 'attack', uid: a.uid });
  const restored = DuelEngine.restore(JSON.parse(JSON.stringify(g.snapshot()))); assert.deepEqual(restored.state, g.state);
  ok(restored, { type: 'respond', uid: t.uid }); assert.equal(restored.find(a.uid).zone, 'grave');
  const bad = g.snapshot(); bad.state.players[0].deck[0].id = 'not-a-card'; assert.throws(() => DuelEngine.restore(bad));
});
test('240 complete AI matches preserve all 83 cards and finish without illegal actions or deadlock', () => {
  const report = { matches: 240, blueWins: 0, darkWins: 0, longestTurn: 0, maximumActions: 0, totalActions: 0 };
  for (let seed = 1; seed <= report.matches; seed++) {
    const g = new DuelEngine({ seed: seed * 719, deck: seed % 2 ? 'blue' : 'dark', first: Math.floor(seed / 2) % 2, difficulty: seed % 3 ? 'standard' : 'casual' });
    let steps = 0;
    while (g.state.winner === null && steps++ < 1500) {
      const action = g.aiNext(); assert.ok(action, 'AI returned no action at seed ' + seed);
      ok(g, action); assert.equal(allCards(g).length, 83, 'Card conservation at seed ' + seed);
    }
    assert.notEqual(g.state.winner, null, 'Stalled at seed ' + seed);
    report[g.state.players[g.state.winner].deckId + 'Wins']++;
    report.longestTurn = Math.max(report.longestTurn, g.state.turn); report.maximumActions = Math.max(report.maximumActions, steps); report.totalActions += steps;
  }
  fs.mkdirSync(path.join(__dirname, '../output'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '../output/ai-simulation-report.json'), JSON.stringify(report, null, 2));
});
