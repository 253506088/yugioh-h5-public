import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../server/store.mjs';
import { PvpService } from '../server/service.mjs';
import { ServerEngine, Data } from '../server/engine.mjs';
import { project } from '../server/projection.mjs';

function setup(t, options = {}) {
  const store = new Store(':memory:'); let time = 100_000, serial = 0; const errors = [];
  const service = new PvpService({ store, now: () => time, onError: error => errors.push(error), ...options });
  t.after(() => { store.close(); assert.deepEqual(errors, []); });
  function client(name, token) {
    const connection = { messages: [], send(data) { this.messages.push(structuredClone(data)); }, close(code) { this.closed = code; } };
    service.handle(connection, { type: 'hello', version: 1, name, token });
    connection.token = connection.messages.find(m => m.type === 'welcome')?.token;
    return connection;
  }
  function send(connection, type, data = {}, expected = true) {
    const id = data.id || 'request_' + ++serial;
    service.handle(connection, { ...data, type, id });
    const response = connection.messages.filter(m => m.id === id).at(-1);
    if (expected) assert.equal(response?.ok, true, JSON.stringify(response));
    return response;
  }
  const clients = [client('Alice'), client('Bob')];
  function start(decks = ['blue', 'dark'], visibility = 'public') {
    const created = send(clients[0], 'create', { visibility });
    send(clients[1], 'join', { code: created.data.code });
    send(clients[0], 'ready', { ready: true, deck: { preset: decks[0] } });
    send(clients[1], 'ready', { ready: true, deck: { preset: decks[1] } });
    return service.rooms.get(created.data.code);
  }
  function act(room, seat, action, extra = {}, expected = true) { return send(clients[seat], 'act', { revision: room.revision, action, ...extra }, expected); }
  return { service, store, clients, client, send, start, act, errors, advance: ms => { time += ms; service.tick(); } };
}
function fixture(room, active = 0) {
  const e = room.engine = new ServerEngine({ deck: 'blue', opponentDeck: 'dark', first: active });
  for (const p of e.state.players) { p.deck.push(...p.hand); p.hand = []; }
  e.state.turn = 6; e.state.phase = 'main1'; room.revision++; room.frames.clear(); return e;
}
function put(e, owner, zone, name, attributes = {}) {
  const card = e.makeCard(Data.cardByName(name)?.id || name, owner);
  Object.assign(card, { faceUp: true, summonTurn: 0, setTurn: 0, changedTurn: 0 }, attributes);
  if (['monsters', 'spells'].includes(zone)) e.state.players[owner][zone][e.state.players[owner][zone].indexOf(null)] = card;
  else e.state.players[owner][zone].push(card);
  e.state.originalCardCount = e.physicalCards().filter(c => Data.CARDS[c.id].type !== 'token').length;
  return card;
}
function handle(service, room, seat, uid) { return [...service.frame(room, seat).refs].find(([, raw]) => raw === uid)?.[0]; }
function wire(service, room, seat, action) {
  const out = { ...action };
  if (out.uid) out.uid = handle(service, room, seat, out.uid);
  if (out.target) out.target = handle(service, room, seat, typeof out.target === 'string' ? out.target : out.target.uid);
  if (out.uids) out.uids = out.uids.map(uid => handle(service, room, seat, uid));
  return out;
}

test('room lifecycle: two verified decks, mutual readiness, 8000 LP, five-card opening and one game', t => {
  const s = setup(t), room = s.start();
  assert.equal(room.status, 'playing'); assert.ok(room.gameId);
  assert.deepEqual(room.engine.state.players.map(p => p.lp), [8000, 8000]);
  assert.deepEqual(room.engine.state.players.map(p => p.hand.length), [5, 5]);
  assert.ok(room.engine instanceof ServerEngine);
  for (const viewer of [0, 1]) {
    const view = s.service.view(room, s.service.sessions.get(s.clients[viewer].sessionId));
    assert.equal(view.you, viewer); assert.equal(view.game.state.active, Number(room.engine.state.active !== viewer));
    assert.equal(view.game.state.players[0].deckSpec.player, viewer ? 'Bob' : 'Alice');
    assert.equal(view.game.state.players[1].deckSpec.player, viewer ? 'Alice' : 'Bob');
  }
});
test('private rooms are joinable by code and absent from the public room list', t => {
  const s = setup(t); const r = s.send(s.clients[0], 'create', { visibility: 'private' });
  assert.equal(s.service.lobby().rooms.length, 0);
  s.send(s.clients[1], 'join', { code: r.data.code.toLowerCase() });
  const third = s.client('Third');
  assert.equal(s.send(third, 'join', { code: r.data.code }, false).code, 'ROOM_FULL');
});
test('one seat per session and invalid room codes cannot change membership', t => {
  const s = setup(t); s.send(s.clients[0], 'create');
  assert.equal(s.send(s.clients[0], 'create', {}, false).code, 'ALREADY_JOINED');
  assert.equal(s.send(s.clients[1], 'join', { code: '../data' }, false).code, 'ROOM_NOT_FOUND');
  assert.equal(s.service.rooms.size, 1);
});
test('decks are checked on the server, including same-name copy limits and extra-deck types', t => {
  const s = setup(t); const r = s.send(s.clients[0], 'create');
  for (const deck of [{ preset: '__proto__' }, { name: 'X', cards: Array(40).fill('blue-eyes'), extra: [] }, { name: 'X', cards: Data.DECKS.blue.cards, extra: ['blue-eyes'] }, { name: 'X', cards: ['unknown'], extra: [] }]) {
    assert.equal(s.send(s.clients[0], 'ready', { ready: true, deck }, false).code, 'DECK');
  }
  assert.equal(s.service.rooms.get(r.data.code).seats[0].ready, false);
});
test('a valid custom deck is frozen at readiness and private to its owner', t => {
  const s = setup(t), custom = { name: '<secret custom deck>', cards: [...Data.DECKS.blue.cards], extra: [...Data.DECKS.blue.extra] };
  const r = s.send(s.clients[0], 'create'); s.send(s.clients[1], 'join', { code: r.data.code });
  s.send(s.clients[0], 'ready', { ready: true, deck: custom }); custom.cards.length = 0;
  s.send(s.clients[1], 'ready', { ready: true, deck: { preset: 'dark' } });
  const room = s.service.rooms.get(r.data.code);
  assert.equal(room.engine.deckInfo(0).cards.length, 40);
  assert.ok(!JSON.stringify(project(room, 1).data).includes('<secret custom deck>'));
  assert.equal(s.send(s.clients[0], 'ready', { ready: false }, false).code, 'STARTED');
});
test('projection never serializes RNG, full opponent construction, deck order or real instance IDs', t => {
  const s = setup(t), room = s.start();
  room.engine.state.privateDebug = { password: 'do-not-send' };
  for (const viewer of [0, 1]) {
    const data = project(room, viewer).data, text = JSON.stringify(data);
    assert.ok(!text.includes('randomState')); assert.ok(!text.includes('do-not-send'));
    assert.deepEqual(data.state.players[1].deckSpec.cards, []);
    assert.ok(data.state.players.every(p => p.deck.every(c => !c.id && !c.uid)));
    assert.ok(data.state.players[1].hand.every(c => !c.id && !c.uid));
    assert.ok(!/"uid":"c\d+"/.test(text));
    assert.ok(data.state.players[0].hand.every(c => c.id && /^h_/.test(c.uid)));
  }
});
test('opponent face-down cards, banished cards, input context and free-form logs remain secret', t => {
  const s = setup(t), room = s.start(), e = fixture(room, 1);
  const secret = put(e, 1, 'spells', 'Mirror Force', { faceUp: false });
  put(e, 1, 'banished', 'Lava Golem', { faceUp: false });
  e.log('set', 'Secret name: Mirror Force', 1, { cardId: secret.id, uid: secret.uid, diagnostic: 'private value' });
  e.state.pending = { kind: 'input', responder: 1, owner: 1, title: '秘密选择', group: { candidates: [{ uid: secret.uid, cardId: secret.id }] }, ctx: { secret: 'private context' } };
  const data = project(room, 0).data;
  assert.equal(data.state.players[1].spells[0].id, undefined);
  assert.equal(data.state.players[1].banished[0].id, undefined);
  assert.deepEqual(data.state.pending, { kind: 'waiting', responder: 1, owner: 1, title: '等待对手完成选择' });
  assert.ok(!JSON.stringify(data).includes('private value')); assert.ok(!JSON.stringify(data).includes('private context'));
  assert.ok(!data.state.log[0].cardId); assert.ok(!data.state.log[0].text.includes('Mirror Force'));
});
test('old hidden log entries stay hidden after the card is revealed', t => {
  const s = setup(t), room = s.start(), e = fixture(room);
  const card = put(e, 1, 'spells', 'Mirror Force', { faceUp: false });
  e.log('set', Data.CARDS[card.id].name, 1, { cardId: card.id, uid: card.uid });
  card.faceUp = true;
  assert.equal(project(room, 0).data.state.log[0].cardId, undefined);
  assert.equal(project(room, 1).data.state.log[0].cardId, card.id);
});
test('an effect actor never gains a hidden opponent card through log ownership or cause metadata', t => {
  const s=setup(t),room=s.start(),e=fixture(room),card=put(e,1,'hand','Lava Golem');
  e.log('move','Actor moved a private opponent card',0,{uid:card.uid,cardId:card.id});
  assert.equal(project(room,0).data.state.log[0].cardId,undefined);
  assert.equal(project(room,1).data.state.log[0].cardId,card.id);
});
test('card handles differ between viewers and revisions, preventing identity tracking', t => {
  const s = setup(t), room = s.start(), e = fixture(room), card = put(e, 0, 'monsters', 'Blue-Eyes White Dragon');
  const a = project(room, 0).data.state.players[0].monsters[0].uid;
  const b = project(room, 1).data.state.players[1].monsters[0].uid;
  room.revision++;
  const c = project(room, 0).data.state.players[0].monsters[0].uid;
  assert.notEqual(a, b); assert.notEqual(a, c); assert.notEqual(a, card.uid);
});
test('second-player perspective rotates shared extra zones without altering main-zone indices', t => {
  const s = setup(t), room = s.start(), e = fixture(room);
  const c = e.makeCard('stardust-dragon', 1); c.extraSlot = 0; e.state.players[1].extraMonster = c;
  const data = project(room, 1).data;
  assert.equal(data.state.players[0].extraMonster.extraSlot, 1);
  assert.equal(data.state.players[0].extraMonster.originalOwner, 0);
});
test('out-of-turn commands and forged ownership are rejected without changing cards', t => {
  const s = setup(t), room = s.start(), seat = room.engine.state.active, before = room.engine.snapshot();
  assert.equal(s.act(room, 1 - seat, { type: 'end' }, {}, false).code, 'NOT_YOUR_TURN');
  assert.equal(s.act(room, seat, { type: 'end', owner: 1 - seat }, {}, false).code, 'OWNER');
  assert.deepEqual(room.engine.snapshot(), before);
});
test('stale state and raw UIDs cannot be used to command cards', t => {
  const s = setup(t), room = s.start(), seat = room.engine.state.active;
  assert.equal(s.act(room, seat, { type: 'end' }, { revision: room.revision - 1 }, false).code, 'STALE');
  assert.equal(s.act(room, seat, { type: 'summon', uid: room.engine.state.players[seat].hand[0].uid }, {}, false).code, 'CARD');
});
test('legal server actions ignore caller snapshots and cannot inject tribute exemptions', t => {
  const s = setup(t), room = s.start(), e = fixture(room), dragon = put(e, 0, 'hand', 'Blue-Eyes White Dragon');
  const uid = handle(s.service, room, 0, dragon.uid);
  assert.equal(s.act(room, 0, { type: 'summon', uid, mode: 'attack', noTribute: true }, {}, false).code, 'ILLEGAL_ACTION');
  s.act(room, 0, { type: 'end', state: { winner: 0 }, randomState: 1 });
  assert.equal(e.state.winner, null);
});
test('normal summon and hidden set are accepted from both seats with correct ownership', t => {
  const s = setup(t), room = s.start(), e = fixture(room, 1), card = put(e, 1, 'hand', 'Battle Ox');
  const a = s.service.frame(room, 1).data.actions.find(a => a.type === 'summon' && a.mode === 'defense');
  assert.ok(a); s.act(room, 1, a);
  assert.equal(e.state.players[1].monsters[0].uid, card.uid); assert.equal(e.state.players[1].monsters[0].faceUp, false);
  assert.equal(s.service.frame(room, 0).data.state.players[1].monsters[0].id, undefined);
});
test('duplicate action receipts survive reconnect and are applied exactly once', t => {
  const s = setup(t), room = s.start(), seat = room.engine.state.active;
  const message = { id: 'same_request', revision: room.revision, action: { type: 'end' } };
  s.send(s.clients[seat], 'act', message);
  const before = room.engine.snapshot(); s.send(s.clients[seat], 'act', message);
  assert.deepEqual(room.engine.snapshot(), before);
  s.service.disconnect(s.clients[seat]); const resumed = s.client('Ignored name', s.clients[seat].token);
  s.send(resumed, 'act', message); assert.deepEqual(room.engine.snapshot(), before);
});
test('extra-summon material validation is authoritative and reveals only offered choices', t => {
  const s = setup(t), room = s.start(), e = fixture(room);
  const a = put(e, 0, 'monsters', 'Gene-Warped Warwolf'), b = put(e, 0, 'monsters', 'Gene-Warped Warwolf');
  const xyz = put(e, 0, 'extra', 'Number 39: Utopia');
  const action = s.service.frame(room, 0).data.actions.find(x => x.type === 'extra-summon' && x.uid === handle(s.service, room, 0, xyz.uid));
  assert.ok(action); s.act(room, 0, action);
  const one = [handle(s.service, room, 0, a.uid)], two = [...one, handle(s.service, room, 0, b.uid)];
  const invalid = s.send(s.clients[0], 'validate', { revision: room.revision, uids: one }); assert.equal(invalid.data.valid, false);
  const valid = s.send(s.clients[0], 'validate', { revision: room.revision, uids: two }); assert.equal(valid.data.valid, true); assert.ok(valid.data.zones.length);
  s.act(room, 0, { type: 'choose', uids: two, zone: valid.data.zones[0], position: 'attack' });
  assert.equal(e.find(xyz.uid).card.overlays.length, 2);
});
test('response windows debit the responding player, not the turn player', t => {
  const s = setup(t), room = s.start(), e = fixture(room);
  const pot = put(e, 0, 'hand', 'Pot of Greed'); put(e, 1, 'spells', 'Magic Jammer', { faceUp: false }); put(e, 1, 'hand', 'Battle Ox');
  const action = s.service.frame(room, 0).data.actions.find(a => a.type === 'activate' && a.uid === handle(s.service, room, 0, pot.uid));
  s.act(room, 0, action); assert.equal(e.state.pending.responder, 1);
  const before = [...room.remaining]; s.advance(6000);
  assert.equal(room.remaining[0], before[0]); assert.equal(room.remaining[1], before[1] - 6000);
  assert.equal(s.service.frame(room, 0).data.state.pending.options, undefined);
  assert.ok(s.service.frame(room, 1).data.state.pending.options.length);
});
test('failed or repeated messages do not reset the thinking clock', t => {
  const s = setup(t), room = s.start(), seat = room.engine.state.active;
  s.advance(4000); const before = room.remaining[seat];
  for (let n = 0; n < 10; n++) s.act(room, seat, { type: 'hack' }, {}, false);
  s.advance(6000); assert.equal(room.remaining[seat], before - 6000);
});
test('clock expiry settles once and cannot be undone by a late command', t => {
  const s = setup(t), room = s.start(), seat = room.engine.state.active;
  s.advance(300_001); assert.equal(room.status, 'finished'); assert.equal(room.result.winner, 1 - seat); assert.equal(room.result.kind, 'timeout');
  const result = structuredClone(room.result); s.act(room, seat, { type: 'end' });
  assert.deepEqual(room.result, result);
  assert.equal(s.store.db.prepare('SELECT count(*) AS n FROM games').get().n, 1);
});
test('disconnect pauses both clocks and reconnect resumes the exact pending decision', t => {
  const s = setup(t), room = s.start(), before = room.engine.snapshot(), remaining = [...room.remaining];
  s.service.disconnect(s.clients[1]); s.advance(30_000);
  assert.deepEqual(room.remaining, remaining); assert.equal(room.status, 'playing');
  const next = s.client('New name ignored', s.clients[1].token);
  assert.equal(s.service.sessions.get(next.sessionId).name, 'Bob');
  assert.deepEqual(room.engine.snapshot(), before); assert.equal(room.seats[1].connected, true);
});
test('disconnect deadline awards a connected opponent; both missing players get a draw', t => {
  const s = setup(t), room = s.start();
  s.service.disconnect(s.clients[0]); s.advance(60_001);
  assert.equal(room.result.winner, 1); assert.equal(room.result.kind, 'disconnect');
});
test('simultaneous abandoned sessions cannot win by disconnect ordering', t => {
  const s = setup(t), room = s.start();
  s.service.disconnect(s.clients[0]); s.advance(2000); s.service.disconnect(s.clients[1]); s.advance(59_000);
  assert.equal(room.status, 'playing'); s.advance(2000);
  assert.equal(room.result.winner, 'draw'); assert.equal(room.result.kind, 'abandoned');
});
test('late reconnect cannot reclaim a duel past its deadline', t => {
  const s = setup(t), room = s.start(); s.service.disconnect(s.clients[0]); s.advance(65_000);
  s.client('Alice', s.clients[0].token); assert.equal(room.result.winner, 1); assert.equal(room.result.kind, 'disconnect');
});
test('repeated reconnects spend one shared 60-second budget and cannot indefinitely pause the opponent', t => {
  const s=setup(t),room=s.start();s.service.disconnect(s.clients[0]);s.advance(40_000);
  const back=s.client('Alice',s.clients[0].token);assert.equal(room.seats[0].disconnectRemaining,20_000);
  s.service.disconnect(back);s.advance(20_001);assert.equal(room.result.kind,'disconnect');assert.equal(room.result.winner,1);
});
test('an expired participant cannot revive while the opponent is still within reconnection grace', t => {
  const s=setup(t),room=s.start();s.service.disconnect(s.clients[0]);s.advance(2000);s.service.disconnect(s.clients[1]);s.advance(59_000);
  s.client('Alice',s.clients[0].token);assert.equal(room.result.winner,1);assert.equal(room.result.kind,'disconnect');
});
test('SQLite recovery retains state, clocks, capabilities, and idempotency receipts', t => {
  const s = setup(t), room = s.start(), seat = room.engine.state.active;
  const message = { id: 'durable_action', revision: room.revision, action: { type: 'end' } }; s.send(s.clients[seat], 'act', message);
  s.advance(4000); s.service.shutdown(); const before = room.engine.snapshot();
  const recovered = new PvpService({ store: s.store, now: () => 110_000, onError: e => s.errors.push(e) });
  const loaded = recovered.rooms.get(room.code); assert.deepEqual(loaded.engine.snapshot(), before); assert.deepEqual(loaded.remaining, room.remaining);
  assert.ok(loaded.seats.every(m => !m.connected));
  const connection = { messages: [], send(m) { this.messages.push(m); }, close() {} };
  recovered.handle(connection, { type: 'hello', version: 1, token: s.clients[seat].token });
  recovered.handle(connection, { type: 'act', ...message });
  assert.ok(connection.messages.find(m => m.type === 'ack' && m.id === 'durable_action'));
  assert.deepEqual(loaded.engine.snapshot(), before);
  assert.ok(!JSON.stringify(s.store.load()).includes(s.clients[seat].token));
});
test('another tab with the same capability replaces the socket without forfeiting the seat', t => {
  const s = setup(t), room = s.start();
  const replacement = s.client('Ignored', s.clients[0].token);
  assert.equal(s.clients[0].closed, 4001); s.service.disconnect(s.clients[0]);
  assert.equal(room.seats[0].connected, true); assert.equal(s.service.connections.get(replacement.sessionId), replacement);
});
test('surrender, mutual rematch, readiness reset and independent game records', t => {
  const s = setup(t), room = s.start(), first = room.gameId;
  s.send(s.clients[1], 'surrender'); assert.equal(room.result.winner, 0); assert.equal(room.result.kind, 'surrender');
  s.send(s.clients[0], 'rematch'); assert.equal(room.status, 'finished');
  s.send(s.clients[1], 'rematch'); assert.equal(room.status, 'waiting'); assert.equal(room.engine, null);
  assert.ok(room.seats.every(m => !m.ready));
  for (const c of s.clients) s.send(c, 'ready', { ready: true, deck: { preset: 'blue' } });
  assert.notEqual(room.gameId, first); s.send(s.clients[0], 'surrender');
  assert.equal(s.store.db.prepare('SELECT count(*) AS n FROM games').get().n, 2);
});
test('a victory found in the opening hand is persisted immediately, before any command', t => {
  const s=setup(t),start=s.service.start.bind(s.service);
  s.service.start=(...args)=>{const game=start(...args);game.engine.state.winner=0;game.engine.state.outcome={kind:'exodia',winner:0,loser:1};return game;};
  const room=s.start();assert.equal(room.status,'finished');assert.equal(room.result.kind,'exodia');
  assert.equal(s.store.db.prepare('SELECT count(*) AS n FROM games').get().n,1);
});
test('rematch cannot become stuck with both votes while the opponent is disconnected', t => {
  const s=setup(t),room=s.start();s.send(s.clients[0],'surrender');s.send(s.clients[0],'rematch');s.service.disconnect(s.clients[0]);
  assert.equal(s.send(s.clients[1],'rematch',{},false).code,'REMATCH');assert.equal(room.seats[1].rematch,false);
  s.client('Alice',s.clients[0].token);s.send(s.clients[1],'rematch');assert.equal(room.status,'waiting');
});
test('quick match pairs distinct connected sessions and can be cancelled without creating a room', t => {
  const s = setup(t);
  s.send(s.clients[0], 'queue', { deck: { preset: 'blue' } }); assert.equal(s.service.queue.size, 1);
  s.send(s.clients[0], 'cancel-queue'); assert.equal(s.service.queue.size, 0); assert.equal(s.service.rooms.size, 0);
  s.send(s.clients[0], 'queue', { deck: { preset: 'blue' } }); s.send(s.clients[1], 'queue', { deck: { preset: 'dark' } });
  assert.equal(s.service.queue.size, 0); const room = [...s.service.rooms.values()][0];
  assert.equal(room.status, 'playing'); assert.equal(room.visibility, 'private'); assert.equal(room.clockSeconds, 300);
});
test('reconnecting after leaving the matchmaking queue explicitly clears the client’s queued state',t=>{
  const s=setup(t);s.send(s.clients[0],'queue',{deck:{preset:'blue'}});s.service.disconnect(s.clients[0]);
  const resumed=s.client('Alice',s.clients[0].token);
  assert.equal(resumed.messages.find(m=>m.type==='queue').active,false);assert.equal(s.service.queue.size,0);
});
test('leaving a finished duel preserves the other player’s safe result view', t => {
  const s = setup(t), room = s.start(); s.send(s.clients[0], 'surrender'); s.send(s.clients[0], 'leave');
  const view = s.service.view(room, s.service.sessions.get(s.clients[1].sessionId));
  assert.equal(view.game.state.winner, 0); assert.equal(view.seats[0], null);
  s.send(s.clients[1], 'leave'); assert.equal(s.service.rooms.size, 0);
});
test('idle room and guest cleanup free capacity while active guests remain protected', t => {
  const s = setup(t, { maxRooms: 1 }); s.send(s.clients[0], 'create');
  assert.equal(s.send(s.clients[1], 'create', {}, false).code, 'CAPACITY');
  s.service.disconnect(s.clients[0]); s.advance(60_001); assert.equal(s.service.rooms.size, 0);
  s.send(s.clients[1], 'create'); assert.equal(s.service.rooms.size, 1);
});
test('protocol rejects malformed input, unknown commands and invalid session capabilities', t => {
  const s = setup(t); assert.equal(s.send(s.clients[0], 'unknown', {}, false).code, 'NO_ROOM');
  const invalid = s.client('Imposter', 'not-a-valid-token'); assert.equal(invalid.messages.at(-1).code, 'SESSION');
  const another = { messages: [], send(m) { this.messages.push(m); }, close() {} };
  s.service.handle(another, { type: 'hello', version: 99, name: 'Old browser' }); assert.equal(another.messages.at(-1).code, 'VERSION');
});
test('complete network-style duel uses only seat-scoped commands, choices and server outcomes', { timeout: 120_000 }, t => {
  const s = setup(t), room = s.start(); let steps = 0;
  while (room.status === 'playing' && steps++ < 1500) {
    const seat = s.service.actor(room), action = room.engine.aiNext(); assert.ok(action);
    s.act(room, seat, wire(s.service, room, seat, action));
  }
  assert.equal(room.status, 'finished'); assert.ok(steps > 10); assert.ok([0, 1, 'draw'].includes(room.result.winner));
  assert.notEqual(room.result.kind, 'limit'); assert.equal(s.store.db.prepare('SELECT count(*) AS n FROM games').get().n, 1);
});
test('all 38 preset families can submit their opening sequence through the PVP protocol', {timeout:120_000},t=>{
  const s=setup(t),presets=Object.values(Data.DECKS).filter(d=>d.preset);
  assert.ok(presets.length>=38);
  for(const deck of presets){
    const room=s.start([deck.id,'blue']);
    for(let step=0;step<16&&room.status==='playing';step++){
      const seat=s.service.actor(room),action=room.engine.aiNext();assert.ok(action,deck.id);
      s.act(room,seat,wire(s.service,room,seat,action));
      const view=s.service.frame(room,seat).data;
      assert.deepEqual(view.state.players[1].deckSpec.cards,[],deck.id);
    }
    if(room.status==='playing')s.send(s.clients[0],'surrender');
    for(const client of s.clients)s.send(client,'leave');
    for(const client of s.clients)client.messages=[];
  }
});
