import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import { createPvpServer } from '../server/index.mjs';

async function server(t, options = {}) {
  const errors = [], app = await createPvpServer({ database: ':memory:', serviceOptions: { onError: e => errors.push(e) }, ...options });
  const address = await app.listen(0);
  t.after(async () => { await app.close(); assert.deepEqual(errors, []); });
  return { app, http: `http://127.0.0.1:${address.port}`, ws: `ws://127.0.0.1:${address.port}/pvp/ws` };
}
async function client(t, endpoint, name = 'Duelist', token) {
  const socket = new WebSocket(endpoint), messages = [], waiters = [];
  socket.on('error', () => {});
  socket.on('message', buffer => {
    const data = JSON.parse(buffer.toString()); messages.push(data);
    if (data.type === 'room') socket.room = data;
    for (const w of [...waiters]) if (w.predicate(data)) { clearTimeout(w.timer); waiters.splice(waiters.indexOf(w), 1); w.resolve(data); }
  });
  socket.wait = predicate => {
    const found = messages.find(predicate); if (found) return Promise.resolve(found);
    return new Promise((resolve, reject) => {
      const w = { predicate, resolve, timer: setTimeout(() => { waiters.splice(waiters.indexOf(w), 1); reject(Error('Timed out waiting for WebSocket message')); }, 5000) }; waiters.push(w);
    });
  };
  let serial = 0;
  socket.request = async (type, data = {}) => {
    const id = 'wire_' + ++serial; socket.send(JSON.stringify({ type, ...data, id }));
    const response = await socket.wait(m => m.id === id && ['ack', 'error'].includes(m.type));
    return response;
  };
  t.after(() => socket.terminate());
  await once(socket, 'open'); socket.send(JSON.stringify({ type: 'hello', version: 1, name, token }));
  const welcome = await socket.wait(m => m.type === 'welcome'); socket.token = welcome.token; socket.messages = messages;
  return socket;
}

test('health endpoint, browser entry, security headers and a strict public file allowlist', async t => {
  const s = await server(t), health = await fetch(s.http + '/api/health');
  assert.equal(health.status, 200); assert.equal((await health.json()).mode, 'best-of-one');
  const page = await fetch(s.http + '/', { method: 'HEAD' });
  assert.equal(page.status, 200); assert.match(page.headers.get('content-type'), /text\/html/);
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff'); assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal((await fetch(s.http + '/', { method: 'POST' })).status, 405);
  for (const path of ['/.git/config', '/.pvp-data/pvp.sqlite', '/server/store.mjs', '/package.json', '/src/engine.js', '/%2e%2e/server/index.mjs', '/assets/duel/art/../../../server/store.mjs']) {
    assert.equal((await fetch(s.http + path)).status, 404, path);
  }
});
test('the legacy static preview also refuses private files and databases in the checkout',async t=>{
  const root=fileURLToPath(new URL('../',import.meta.url)),base=resolve(root,'output');await mkdir(base,{recursive:true});
  const directory=await mkdtemp(join(base,'static-private-'));
  const child=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,DUEL_PORT:'0'},stdio:['ignore','pipe','pipe']});
  t.after(async()=>{if(child.exitCode===null){const ended=once(child,'exit');child.kill();await ended;}assert.ok(directory.startsWith(join(base,'static-private-')));await rm(directory,{recursive:true,force:true});});
  await writeFile(join(directory,'.env'),'PRIVATE_TEST_VALUE');await writeFile(join(directory,'pvp.sqlite'),'PRIVATE_TEST_VALUE');await writeFile(join(directory,'public.txt'),'public');
  const [line]=await once(child.stdout,'data'),url=String(line).match(/http:\/\/127\.0\.0\.1:\d+/)[0],folder=directory.slice(root.length).replaceAll('\\','/');
  for(const name of ['.env','pvp.sqlite','pvp.sqlite::$DATA'])assert.equal((await fetch(url+'/'+folder+'/'+name)).status,404);
  assert.equal(await(await fetch(url+'/'+folder+'/public.txt')).text(),'public');
});
test('cross-origin WebSocket upgrades are denied before authentication', async t => {
  const s = await server(t);
  const socket = new WebSocket(s.ws, { origin: 'https://untrusted.example' }); socket.on('error', () => {});
  const status = await new Promise(resolve => socket.once('unexpected-response', (_request, response) => { response.resume(); resolve(response.statusCode); socket.terminate(); }));
  assert.equal(status, 403); assert.equal(s.app.service.connections.size, 0);
});
test('an explicitly configured frontend origin can connect', async t => {
  const s = await server(t, { origins: ['https://duel.example.com'] });
  const socket = new WebSocket(s.ws, { origin: 'https://duel.example.com' }); socket.on('error', () => {}); t.after(() => socket.terminate());
  await once(socket, 'open'); socket.send(JSON.stringify({ type: 'hello', version: 1, name: 'Allowed origin' }));
  const [data] = await once(socket, 'message'); assert.equal(JSON.parse(data.toString()).type, 'welcome');
});
test('real WebSockets create, join, prepare, submit moves, reject outsiders, and reconnect', async t => {
  const s = await server(t), a = await client(t, s.ws, 'Player A'), b = await client(t, s.ws, 'Player B'), stranger = await client(t, s.ws, 'Outsider');
  const created = await a.request('create', { visibility: 'private' }); assert.equal(created.ok, true); const code = created.data.code;
  assert.equal((await b.request('join', { code })).ok, true);
  assert.equal((await a.request('ready', { ready: true, deck: { preset: 'blue' } })).ok, true);
  assert.equal((await b.request('ready', { ready: true, deck: { preset: 'dark' } })).ok, true);
  await Promise.all([a.wait(m => m.type === 'room' && m.status === 'playing'), b.wait(m => m.type === 'room' && m.status === 'playing')]);
  assert.equal((await stranger.request('act', { revision: a.room.revision, action: { type: 'end' }, code })).code, 'NO_ROOM');
  const actor = a.room.game.state.active === 0 ? a : b;
  const result = await actor.request('act', { revision: actor.room.revision, action: { type: 'end' } }); assert.equal(result.ok, true);
  await actor.wait(m => m.type === 'room' && m.revision === result.data.revision);
  const snapshot = structuredClone(s.app.service.rooms.get(code).engine.snapshot());
  a.terminate(); await b.wait(m => m.type === 'room' && m.status === 'playing' && m.clock.paused);
  const resumed = await client(t, s.ws, 'Ignored', a.token); await resumed.wait(m => m.type === 'room' && m.status === 'playing');
  assert.deepEqual(s.app.service.rooms.get(code).engine.snapshot(), snapshot);
  assert.equal(resumed.room.seats[resumed.room.you].name, 'Player A');
  assert.equal(resumed.room.game.state.players[1].deckSpec.cards.length, 0);
  assert.ok(resumed.room.game.state.players[1].hand.every(c => !c.id));
});
test('invalid JSON and oversized messages are contained to the offending socket', async t => {
  const s = await server(t), a = await client(t, s.ws, 'Malformed'), b = await client(t, s.ws, 'Unaffected');
  a.send('{ this is not JSON'); assert.equal((await a.wait(m => m.code === 'JSON')).type, 'error');
  const closed = once(a, 'close'); a.send(JSON.stringify({ type: 'ping', data: 'x'.repeat(40_000) }));
  assert.equal((await closed)[0], 1009);
  assert.equal((await b.request('create')).ok, true); assert.equal((await fetch(s.http + '/api/health')).status, 200);
});
test('message floods are rate limited without disconnecting another player', async t => {
  const s = await server(t), a = await client(t, s.ws, 'Flood'), b = await client(t, s.ws, 'Normal');
  const closed = once(a, 'close'); for (let i = 0; i < 120; i++) a.send(JSON.stringify({ type: 'ping', sentAt: i }));
  assert.equal((await closed)[0], 4008); assert.equal((await b.request('create')).ok, true);
});
test('a disk-backed server restart restores the room and authenticated seats over a new socket', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'duel-pvp-test-'));
  let first, second;
  t.after(async () => {
    await second?.close(); await first?.close();
    assert.equal(directory.startsWith(join(tmpdir(), 'duel-pvp-test-')), true);
    await rm(directory, { recursive: true, force: true });
  });
  const database = join(directory, 'pvp.sqlite');
  first = await createPvpServer({ database }); const address = await first.listen(0); const endpoint = `ws://127.0.0.1:${address.port}/pvp/ws`;
  const a = await client(t, endpoint, 'Durable A'), b = await client(t, endpoint, 'Durable B');
  const code = (await a.request('create')).data.code; await b.request('join', { code });
  await a.request('ready', { ready: true, deck: { preset: 'blue' } }); await b.request('ready', { ready: true, deck: { preset: 'dark' } });
  await a.wait(m => m.type === 'room' && m.status === 'playing'); const snapshot = first.service.rooms.get(code).engine.snapshot();
  await first.close();
  second = await createPvpServer({ database }); const nextAddress = await second.listen(0);
  const recovered = await client(t, `ws://127.0.0.1:${nextAddress.port}/pvp/ws`, 'Ignored', a.token);
  const state = await recovered.wait(m => m.type === 'room'); assert.equal(state.code, code); assert.equal(state.clock.paused, true);
  assert.deepEqual(second.service.rooms.get(code).engine.snapshot(), snapshot);
});
