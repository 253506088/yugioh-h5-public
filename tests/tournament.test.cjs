const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/tournament.js');
const {DuelEngine} = require('../src/advanced-engine.js');
const D = globalThis.DuelData, Decks = globalThis.DuelDecks;
const copy = value => JSON.parse(JSON.stringify(value));
function finish(cup) {
  cup.resume();
  for (let guard = 0; cup.status === 'running' && guard < 18000; guard++) cup.advance(1);
  assert.equal(cup.status, 'completed', JSON.stringify(cup.matches.filter(m => m.status === 'error')));
  return cup;
}
function roster(n) { return Array.from({length:n}, (_, i) => ['blue', 'dark', 'early-ritual', 'early-fusion'][i % 4]); }

test('2–64 entrants get a connected bracket with evenly spread byes and no empty matches', () => {
  for (let n = 2; n <= 64; n++) {
    const participants = Array.from({length:n}, (_, i) => ({id:'p' + (i + 1)})), result = T.bracket(participants);
    const first = result.matches.filter(m => m.round === 0);
    assert.equal(result.matches.length, result.size - 1);
    assert.equal(first.filter(m => m.status === 'bye').length, result.size - n);
    assert.equal(first.flatMap(m => m.entrants).filter(Boolean).length, n);
    assert.equal(new Set(first.flatMap(m => m.entrants).filter(Boolean)).size, n);
    assert.ok(first.every(m => m.entrants[0]));
    for (const m of result.matches.filter(m => m.round)) assert.equal(m.sources.length, 2);
  }
});
test('random rosters are reproducible and duplicates work even when the pool is larger', () => {
  const pool = Object.values(D.DECKS).filter(d => d.preset);
  assert.deepEqual(T.randomRoster(pool, 16, 71), T.randomRoster(pool, 16, 71));
  const sample = T.randomRoster(pool, 10, 11, true);
  assert.ok(new Set(sample).size < sample.length);
  assert.equal(new Set(T.randomRoster(pool, 10, 11, false)).size, 10);
  assert.throws(() => T.randomRoster(pool, 64, 11, false));
  assert.throws(() => T.randomRoster([], 16, 11));
  for (const n of [0, 1, 2.5, 65, NaN]) assert.throws(() => T.create({count:n}));
});
test('duplicate names receive stable numbered bot identities, including custom decks', () => {
  const custom = {...copy(D.DECKS.blue), id:'custom-cup-test', name:'青眼 <测试> & "名字"', custom:true, preset:false};
  const cup = T.create({deckIds:['custom-cup-test', 'blue', 'custom-cup-test', 'blue'], seed:117}, [...Decks.list(), custom]);
  assert.deepEqual(cup.data.participants.map(p => p.copy), [1, 1, 2, 2]);
  assert.equal(cup.data.participants[0].name, custom.name + ' 1号');
  assert.equal(cup.data.participants[2].name, custom.name + ' 2号');
  custom.cards[0] = 'dark-magician';
  assert.notEqual(cup.data.decks['custom-cup-test'].cards[0], custom.cards[0]);
});
test('deck snapshots survive edits and deletion without changing the local preset registry', () => {
  const source = {...copy(D.DECKS.blue), id:'custom-frozen-test', custom:true, preset:false};
  const originalBlue = JSON.stringify(D.DECKS.blue);
  const cup = T.create({deckIds:[source.id, 'dark'], seed:890}, [...Decks.list(), source]);
  source.cards = [...D.DECKS.dark.cards];
  cup.resume().advance(1);
  const match = cup.matches[0], initial = match.games[0].initial;
  assert.deepEqual(initial.state.players[0].deckSpec.cards, D.DECKS.blue.cards);
  assert.equal(JSON.stringify(D.DECKS.blue), originalBlue);
  const restored = T.Tournament.restore(cup.snapshot());
  assert.equal(restored.status, 'paused');
  finish(restored);
  assert.deepEqual(restored.matches[0].games[0].final.state.players[0].deckSpec.cards, D.DECKS.blue.cards);
  delete D.DECKS[source.id];
});
test('parallel scheduling gets a fair slice even when an action exhausts the time budget', () => {
  const cup = T.create({deckIds:roster(8), concurrency:4, seed:913});
  cup.resume();
  for (let i = 0; i < 4; i++) cup.advance(24, 0);
  assert.equal(cup.matches.filter(m => m.status === 'running').length, 4);
  assert.deepEqual(cup.matches.slice(0, 4).map(m => m.games[0].steps.length), [1, 1, 1, 1]);
  cup.configure({concurrency:1});
  const frozen = cup.matches[1].games[0].steps.length;
  cup.advance(3);
  assert.equal(cup.matches[1].games[0].steps.length, frozen);
  cup.configure({concurrency:4}); cup.advance(1);
  assert.ok(cup.matches[1].games[0].steps.length > frozen);
});
test('six-bot event completes five real duels, propagates byes, and resumes exactly', () => {
  const cup = T.create({deckIds:roster(6), seed:1209, concurrency:2});
  cup.resume().advance(7); cup.pause();
  const saved = cup.snapshot(), before = JSON.stringify(saved);
  cup.advance(10); assert.equal(JSON.stringify(cup.snapshot()), before);
  const resumed = T.Tournament.restore(saved);
  finish(cup); finish(resumed);
  assert.equal(cup.progress().played, 5);
  assert.equal(cup.progress().byes, 2);
  assert.equal(cup.progress().remaining, 1);
  assert.equal(cup.data.championId, resumed.data.championId);
  assert.deepEqual(cup.matches.map(m => m.games.map(g => g.steps)), resumed.matches.map(m => m.games.map(g => g.steps)));
  assert.equal(T.Tournament.restore(cup.snapshot()).data.championId, cup.data.championId);
});
test('a full sixteen-bot bracket is independent of serial vs concurrent scheduling', () => {
  const serial = finish(T.create({deckIds:roster(16), seed:61607, concurrency:1}));
  const parallel = finish(T.create({deckIds:roster(16), seed:61607, concurrency:8}));
  assert.equal(serial.progress().played, 15);
  assert.equal(parallel.progress().played, 15);
  assert.deepEqual(serial.matches.map(m => m.winnerId), parallel.matches.map(m => m.winnerId));
  for (let i = 0; i < serial.matches.length; i++) assert.deepEqual(serial.matches[i].games.map(g => g.steps), parallel.matches[i].games.map(g => g.steps));
  assert.equal(serial.matches.at(-1).winnerId, serial.data.championId);
});
test('replay actions reproduce exact snapshots, support backwards seeks, and never mutate the recording', async () => {
  const cup = T.create({deckIds:['early-fusion', 'dark'], seed:538});
  cup.resume(); const snapshots = [];
  while (cup.status === 'running') {
    cup.advance(1);
    if (cup.matches[0].status === 'error') throw new Error(cup.matches[0].reason);
    snapshots.push(cup.gameSnapshot(cup.matches[0].id));
  }
  const game = cup.matches[0].games[0], before = JSON.stringify(game), cursor = new T.ReplayCursor(game);
  for (let i = 0; i < game.steps.length; i++) { assert.equal(cursor.next(), true); assert.deepEqual(cursor.engine.snapshot(), snapshots[i]); }
  assert.deepEqual(cursor.engine.snapshot(), game.final);
  for (const index of [0, 12, 3, game.steps.length, 2, Math.floor(game.steps.length / 2)]) {
    assert.deepEqual(cursor.seek(index).snapshot(), index ? snapshots[index - 1] : game.initial);
  }
  await cursor.seekAsync(7); assert.deepEqual(cursor.engine.snapshot(), snapshots[6]);
  assert.equal(JSON.stringify(game), before);
});
test('AI errors remain reviewable and retry without silently advancing a bot', () => {
  const cup = T.create({deckIds:roster(4), seed:329, concurrency:2});
  cup.resume().advance(1);
  const match = cup.matches[0], e = cup.engines.get(match.id);
  e.aiNext = () => { throw new Error('test decision failure'); };
  cup.advance(1);
  assert.equal(match.status, 'error'); assert.equal(match.winnerId, null);
  assert.match(match.games[0].error, /test decision failure/);
  assert.ok(match.games[0].final);
  assert.equal(cup.matches[1].status, 'running');
  cup.retry(match.id); cup.advance(1);
  assert.equal(match.games.length, 2);
  assert.notEqual(match.games[0].seed, match.games[1].seed);
  finish(cup);
  assert.equal(cup.progress().played, 3);
});
test('draws rematch twice, then use a labeled deterministic tiebreak', () => {
  const cup = T.create({deckIds:['blue', 'blue'], seed:222});
  cup.resume(); const m = cup.matches[0];
  for (let attempt = 0; attempt < 3; attempt++) {
    const e = cup.openGame(m); e.state.winner = 'draw'; e.state.resultReason = 'fixture draw';
    cup.settle(m, e);
    assert.equal(m.status, attempt === 2 ? 'complete' : 'ready');
  }
  assert.equal(m.games.length, 3);
  assert.deepEqual(m.games.map(g => g.verdict.kind), ['draw', 'draw', 'draw-limit']);
  assert.ok(m.entrants.includes(m.winnerId));
});
test('action-limit rulings keep the actual final position and explain advancement', () => {
  const cup = T.create({deckIds:['blue', 'dark'], seed:9});
  const match = cup.matches[0], e = cup.openGame(match);
  e.state.players[0].lp = 6000; e.state.players[1].lp = 7000;
  cup.settle(match, e, 'limit');
  assert.equal(match.winnerId, 'p2');
  assert.equal(match.games[0].verdict.kind, 'limit');
  assert.equal(match.games[0].final.state.winner, null);
  assert.match(match.reason, /LP/);
});
test('malformed imported brackets cannot rewrite qualification or hide missing recordings', () => {
  const valid = finish(T.create({deckIds:roster(4), seed:112})).snapshot();
  const mutations = [
    d => { d.format = 'other'; },
    d => { d.participants[1].id = d.participants[0].id; },
    d => { d.matches[2].entrants.reverse(); },
    d => { d.matches[0].winnerId = 'not-a-bot'; },
    d => { d.matches[0].games = []; },
    d => { d.matches[0].games[0].opening = null; },
    d => { d.championId = 'p99'; },
    d => { d.settings.concurrency = 30; },
    d => { d.decks.blue.cards = []; }
  ];
  for (const mutate of mutations) { const bad = copy(valid); mutate(bad); assert.throws(() => T.Tournament.restore(bad)); }
});
