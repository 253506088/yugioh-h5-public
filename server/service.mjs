import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { ServerEngine, Data, validateDeck } from './engine.mjs';
import { project } from './projection.mjs';

export const PROTOCOL = 1;
const hash = token => createHash('sha256').update(token).digest('hex');
const requestId = /^[a-zA-Z0-9_-]{1,80}$/;
const day = 86_400_000;
class ClientError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const need = (condition, code, message) => { if (!condition) throw new ClientError(code, message); };
const nameOf = value => typeof value === 'string' ? value.normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, 20) : '';
const changes = () => ({ sessions: new Set(), rooms: new Set(), games: [], deleteRooms: [], deleteSessions: [] });

export class PvpService {
  constructor({ store, now = Date.now, maxRooms = 100, disconnectMs = 60_000, waitingMs = 30 * 60_000, retentionMs = day, onError = console.error }) {
    Object.assign(this, { store, now, maxRooms, disconnectMs, waitingMs, retentionMs, onError });
    this.sessions = new Map(); this.tokens = new Map(); this.rooms = new Map(); this.connections = new Map(); this.queue = new Map();
    this.healthy = true; this.lastCheckpoint = now(); this.lastPrune = now();
    const saved = store.load();
    for (const s of saved.sessions) { this.sessions.set(s.id, s); this.tokens.set(s.tokenHash, s.id); }
    for (const data of saved.rooms) {
      const room = { ...data, engine: data.engine ? ServerEngine.restore(data.engine) : null, frames: new Map(), events: [] };
      for (const member of room.seats.filter(Boolean)) {
        member.disconnectRemaining ??= disconnectMs;
        if(!member.connected&&member.disconnectedAt!==null&&room.status==='playing')member.disconnectRemaining=Math.max(0,member.disconnectRemaining-Math.max(0,Math.min(now(),room.clockAt)-member.disconnectedAt));
        member.connected = false; member.disconnectedAt = now();
      }
      room.clockAt = now(); room.revision++;
      this.rooms.set(room.code, room);
    }
    const c = changes(); for (const r of this.rooms.values()) c.rooms.add(r); this.save(c);
  }

  serialize(room) {
    const { engine, frames, events, ...data } = room;
    return { ...data, engine: engine?.snapshot() || null };
  }

  save(c) {
    try {
      this.store.commit({ sessions: [...c.sessions], rooms: [...c.rooms].map(r => this.serialize(r)), games: c.games, deleteRooms: c.deleteRooms, deleteSessions: c.deleteSessions });
    } catch (error) {
      this.healthy = false; this.onError(error);
      for (const connection of this.connections.values()) connection.close(1011, 'Storage unavailable');
      throw error;
    }
  }

  touch(room, c) { room.revision++; room.updatedAt = this.now(); room.frames.clear(); room.events = []; c.rooms.add(room); }
  frame(room, seat) {
    if (!room.frames.has(seat)) room.frames.set(seat, project(room, seat));
    return room.frames.get(seat);
  }
  seat(room, s) { return room.seats.findIndex(m => m?.sessionId === s.id); }
  roomFor(s) {
    const room = this.rooms.get(s.roomCode);
    need(room && this.seat(room, s) >= 0, 'NO_ROOM', '你当前没有加入房间。');
    return room;
  }
  actor(room) { return room.engine.state.pending?.responder ?? room.engine.state.active; }
  paused(room) { return room.status === 'playing' && room.seats.some(m => !m?.connected); }
  clock(room) {
    return { type: 'clock', code: room.code, serverTime: this.now(), remaining: [...room.remaining],
      actor: room.engine && room.status === 'playing' ? this.actor(room) : null, paused: this.paused(room),
      reconnectUntil: room.seats.map(m => m && !m.connected && m.disconnectedAt !== null ? m.disconnectedAt + (m.disconnectRemaining??this.disconnectMs) : null) };
  }

  view(room, s) {
    const you = this.seat(room, s);
    return { type: 'room', code: room.code, title: room.title, visibility: room.visibility, status: room.status,
      revision: room.revision, you, clockSeconds: room.clockSeconds, incrementSeconds: 20,
      seats: room.seats.map((m, i) => m ? { name: m.name, connected: m.connected, ready: m.ready, hasDeck: !!m.deck,
        rematch: !!m.rematch, ...(i === you && m.deck ? { deckName: m.deck.name } : {}) } : null),
      gameId: room.gameId, result: room.result, clock: this.clock(room),
      game: room.engine ? this.frame(room, you).data : null };
  }
  sendRoom(room, s) { this.connections.get(s.id)?.send(this.view(room, s)); }
  broadcast(room) { for (const m of room.seats.filter(Boolean)) { const s = this.sessions.get(m.sessionId); if (s && this.connections.has(s.id)) this.sendRoom(room, s); } }

  lobby() {
    return { type: 'lobby', online: this.connections.size, playing: [...this.rooms.values()].filter(r => r.status === 'playing').length,
      queued: this.queue.size, rooms: [...this.rooms.values()].filter(r => r.visibility === 'public' && r.status === 'waiting' && r.seats.filter(Boolean).length === 1 && r.seats.some(m => m?.connected))
        .sort((a, b) => b.createdAt - a.createdAt).slice(0, 50).map(r => ({ code: r.code, title: r.title, host: r.seats.find(Boolean).name, clockSeconds: r.clockSeconds, createdAt: r.createdAt })) };
  }
  broadcastLobby() { const data = this.lobby(); for (const connection of this.connections.values()) connection.send(data); }

  hello(connection, message) {
    need(message.version === PROTOCOL, 'VERSION', '客户端版本不兼容，请刷新页面。');
    need(!connection.sessionId, 'ALREADY_AUTHENTICATED', '连接已经建立。');
    need(!message.token || typeof message.token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(message.token), 'SESSION', '重连凭证无效。');
    this.tick();
    let token = message.token, s = token ? this.sessions.get(this.tokens.get(hash(token))) : null;
    if (token) need(s, 'SESSION_EXPIRED', '重连凭证已过期，请重新连接。');
    const c = changes();
    if (!s) {
      const name = nameOf(message.name);
      need(name, 'NAME', '请先填写决斗者昵称。');
      token = randomBytes(32).toString('base64url');
      s = { id: randomUUID(), tokenHash: hash(token), name, createdAt: this.now(), seenAt: this.now(), roomCode: null, receipts: [] };
      this.sessions.set(s.id, s); this.tokens.set(s.tokenHash, s.id);
    }
    s.seenAt = this.now(); c.sessions.add(s);
    const old = this.connections.get(s.id);
    connection.sessionId = s.id; this.connections.set(s.id, connection);
    if (old && old !== connection) { old.send({ type: 'replaced' }); old.close(4001, 'Session opened elsewhere'); }
    const room = this.rooms.get(s.roomCode);
    if (room) {
      this.settleClock(room, c);
      const member = room.seats[this.seat(room, s)];
      if(room.status==='playing'&&!member.connected&&member.disconnectedAt!==null){
        const elapsed=Math.max(0,this.now()-member.disconnectedAt),budget=member.disconnectRemaining??this.disconnectMs;
        if(elapsed>=budget){
          const otherSeat=1-this.seat(room,s),other=room.seats[otherSeat];
          const eligible=other.connected||this.now()<other.disconnectedAt+(other.disconnectRemaining??this.disconnectMs);
          this.finish(room,eligible?otherSeat:'draw',eligible?'disconnect':'abandoned',c);
        }
        member.disconnectRemaining=Math.max(0,budget-elapsed);
      }
      member.connected = true; member.disconnectedAt = null; room.clockAt = this.now(); this.touch(room, c);
    }
    this.save(c);
    connection.send({ type: 'welcome', version: PROTOCOL, token, name: s.name, resumed: !!message.token, serverTime: this.now(), disconnectSeconds: this.disconnectMs / 1000 });
    if (room) this.broadcast(room);
    connection.send({type:'queue',active:this.queue.has(s.id),joinedAt:this.queue.get(s.id)?.joinedAt});
    this.broadcastLobby();
  }

  disconnect(connection) {
    const s = this.sessions.get(connection.sessionId);
    if (!s || this.connections.get(s.id) !== connection) return;
    this.connections.delete(s.id); this.queue.delete(s.id);
    if (!this.healthy) return;
    const room = this.rooms.get(s.roomCode), c = changes();
    s.seenAt = this.now(); c.sessions.add(s);
    if (room) {
      this.settleClock(room, c);
      const m = room.seats[this.seat(room, s)]; m.connected = false; m.disconnectedAt = this.now();
      room.clockAt = this.now(); this.touch(room, c);
    }
    this.save(c); if (room) this.broadcast(room); this.broadcastLobby();
  }

  handle(connection, message) {
    try {
      need(this.healthy, 'UNAVAILABLE', '服务器存储暂不可用，请稍后重连。');
      need(message && typeof message === 'object' && !Array.isArray(message), 'MESSAGE', '消息格式无效。');
      if (message.type === 'hello') { this.hello(connection, message); return; }
      const s = this.sessions.get(connection.sessionId);
      need(s && this.connections.get(s.id) === connection, 'AUTH', '请先连接联机服务。');
      if (message.type === 'ping') { connection.send({ type: 'pong', sentAt: message.sentAt, serverTime: this.now() }); return; }
      need(typeof message.id === 'string' && requestId.test(message.id), 'REQUEST_ID', '请求编号无效。');
      if (message.type === 'validate') {
        const data = this.validate(s, message);
        connection.send({ type: 'ack', id: message.id, ok: true, data }); return;
      }
      if (message.type === 'list') { connection.send(this.lobby()); connection.send({ type: 'ack', id: message.id, ok: true }); return; }
      const receipt = s.receipts.find(r => r.id === message.id);
      if (receipt) { connection.send(receipt.ack); const room = this.rooms.get(s.roomCode); if (room) this.sendRoom(room, s); return; }
      const c = changes();
      const data = this.command(s, message, c);
      const ack = { type: 'ack', id: message.id, ok: true, data };
      s.receipts.push({ id: message.id, ack }); s.receipts = s.receipts.slice(-64); s.seenAt = this.now(); c.sessions.add(s);
      this.save(c); connection.send(ack);
      for (const room of c.rooms) this.broadcast(room);
      for (const code of c.deleteRooms) connection.send({ type: 'left', code });
      if (message.type === 'leave') connection.send({ type: 'left' });
      if (message.type === 'queue' || message.type === 'cancel-queue') connection.send({ type: 'queue', active: this.queue.has(s.id), joinedAt: this.queue.get(s.id)?.joinedAt });
      if (message.type !== 'act') this.broadcastLobby();
    } catch (error) {
      if (!(error instanceof ClientError)) this.onError(error);
      connection.send({ type: 'error', id: message?.id, code: error.code || 'INTERNAL', message: error instanceof ClientError ? error.message : '服务器未能完成本次操作，请重试或重新连接。' });
      const s = this.sessions.get(connection.sessionId), room = this.rooms.get(s?.roomCode);
      if (room && ['STALE', 'PAUSED', 'NOT_YOUR_TURN', 'FINISHED'].includes(error.code)) this.sendRoom(room, s);
    }
  }

  requireFree(s) { need(!s.roomCode && !this.queue.has(s.id), 'ALREADY_JOINED', '请先离开当前房间或取消匹配。'); }
  readDeck(value) {
    try { return validateDeck(value); } catch (error) { throw new ClientError('DECK', error.message); }
  }
  member(s, deck = null) { return { sessionId: s.id, name: s.name, deck, ready: false, connected: true, disconnectedAt: null, disconnectRemaining:this.disconnectMs, rematch: false }; }

  createRoom(s, message, c) {
    need(this.rooms.size < this.maxRooms, 'CAPACITY', '当前房间已满，请稍后重试。');
    need([180, 300, 600].includes(message.clockSeconds ?? 300), 'CLOCK', '请选择 3、5 或 10 分钟思考时间。');
    need(!message.visibility || ['public', 'private'].includes(message.visibility), 'VISIBILITY', '房间类型无效。');
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code; do { code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(''); } while (this.rooms.has(code));
    const room = { code, secret: randomBytes(32).toString('hex'), title: nameOf(message.title) || `${s.name}的决斗房间`, visibility: message.visibility || 'public',
      status: 'waiting', revision: 1, createdAt: this.now(), updatedAt: this.now(), seats: [this.member(s), null],
      clockSeconds: message.clockSeconds ?? 300, remaining: [0, 0], clockAt: this.now(), gameId: null, result: null,
      engine: null, frames: new Map(), events: [], actions: 0 };
    this.rooms.set(code, room); s.roomCode = code; c.sessions.add(s); c.rooms.add(room);
    return room;
  }

  start(room, decks) {
    const gameId = randomUUID();
    const specs = decks.map((deck, i) => ({ ...structuredClone(deck), id: deck.preset ? deck.id : `custom-pvp-${gameId}-${i}`,
      player: room.seats[i].name, ace: deck.ace || [...deck.extra, ...deck.cards].sort((a, b) => (Data.CARDS[b].atk || 0) - (Data.CARDS[a].atk || 0))[0],
      mechanic: deck.mechanic || '自由构筑', description: deck.description || '由决斗者亲手构筑的卡组。' }));
    const engine = new ServerEngine({ deck: specs[0].id, opponentDeck: specs[1].id, deckSpecs: specs, first: randomInt(2), openingGuarantee: false });
    return { engine, gameId, status: 'playing', startedAt: this.now(), clockAt: this.now(), remaining: [room.clockSeconds * 1000, room.clockSeconds * 1000], actions: 0, result: null };
  }

  command(s, m, c) {
    if (m.type === 'profile') {
      this.requireFree(s); const name = nameOf(m.name); need(name, 'NAME', '请填写决斗者昵称。');
      s.name = name; c.sessions.add(s); return { name };
    }
    if (m.type === 'create') { this.requireFree(s); return { code: this.createRoom(s, m, c).code }; }
    if (m.type === 'join') {
      this.requireFree(s);
      const code = typeof m.code === 'string' ? m.code.trim().toUpperCase() : '';
      const room = this.rooms.get(code);
      need(room && room.status === 'waiting', 'ROOM_NOT_FOUND', '房间不存在、已开局或已过期，请检查房间码。');
      const seat = room.seats.findIndex(member => !member);
      need(seat >= 0, 'ROOM_FULL', '房间已经满员。');
      room.seats[seat] = this.member(s); s.roomCode = room.code; c.sessions.add(s); this.touch(room, c); return { code };
    }
    if (m.type === 'queue') {
      this.requireFree(s); const deck = this.readDeck(m.deck);
      const peer = [...this.queue.values()].find(q => this.connections.has(q.sessionId));
      if (!peer) { this.queue.set(s.id, { sessionId: s.id, deck, joinedAt: this.now() }); return {}; }
      const other = this.sessions.get(peer.sessionId), room = this.createRoom(other, { title: '快速匹配', visibility: 'private', clockSeconds: 300 }, c);
      room.seats[1] = this.member(s, deck); room.seats[0].deck = peer.deck;
      try { Object.assign(room, this.start(room, [peer.deck, deck])); }
      catch (error) { this.rooms.delete(room.code); other.roomCode = null; c.rooms.delete(room); throw error; }
      for (const member of room.seats) {member.ready = true;member.disconnectRemaining=this.disconnectMs;}
      this.queue.delete(other.id); s.roomCode = room.code; c.sessions.add(s); this.touch(room, c);
      if(room.engine.state.winner!==null)this.finish(room,room.engine.state.winner,room.engine.state.outcome?.kind||'special',c);
      this.connections.get(other.id)?.send({ type: 'queue', active: false }); return { code: room.code };
    }
    if (m.type === 'cancel-queue') { this.queue.delete(s.id); return {}; }
    const room = this.roomFor(s), seat = this.seat(room, s), member = room.seats[seat];
    if (m.type === 'ready') {
      need(room.status === 'waiting', 'STARTED', '对局已开始，不能更换构筑。');
      need(typeof m.ready === 'boolean', 'READY', '准备状态无效。');
      const deck = m.ready ? this.readDeck(m.deck) : member.deck;
      const opponent = room.seats[1 - seat];
      if (m.ready && opponent?.ready) {
        need(opponent.connected, 'PAUSED', '请等待对手重新连接后开始。');
        const decks = room.seats.map((p, i) => i === seat ? deck : p.deck);
        const game = this.start(room, decks); Object.assign(room, game);
        for(const p of room.seats)p.disconnectRemaining=this.disconnectMs;
      }
      member.deck = deck; member.ready = m.ready; this.touch(room, c);
      if(room.engine&&room.engine.state.winner!==null)this.finish(room,room.engine.state.winner,room.engine.state.outcome?.kind||'special',c);
      return {};
    }
    if (m.type === 'act') return this.act(room, seat, m, c);
    if (m.type === 'surrender') {
      need(room.status === 'playing', 'FINISHED', '本局已经结束。');
      this.settleClock(room,c);
      if(room.status==='finished'){this.touch(room,c);return {finished:true};}
      this.finish(room, 1 - seat, 'surrender', c); this.touch(room, c); return {};
    }
    if (m.type === 'rematch') {
      need(room.status === 'finished' && room.seats.every(p=>p?.connected), 'REMATCH', '请等待双方都连接到房间后申请再战。');
      member.rematch = true;
      if (room.seats.every(p => p.rematch && p.connected)) {
        room.status = 'waiting'; room.engine = null; room.gameId = null; room.result = null;
        for (const p of room.seats) { p.ready = false; p.rematch = false; }
      }
      this.touch(room, c); return {};
    }
    if (m.type === 'leave') {
      need(room.status !== 'playing', 'ACTIVE_GAME', '对局进行中，请先认输再离开房间。');
      this.removeMember(room, seat, c); return {};
    }
    throw new ClientError('UNKNOWN', '未知的联机请求。');
  }

  current(room, seat, m) {
    need(room.status === 'playing', 'FINISHED', '本局已经结束。');
    need(!this.paused(room), 'PAUSED', '对手断线，对局已暂停，等待重新连接。');
    need(Number.isSafeInteger(m.revision) && m.revision === room.revision, 'STALE', '局面已经更新，已同步最新状态，请重新选择。');
    need(this.actor(room) === seat, 'NOT_YOUR_TURN', '现在不是你的行动或响应时机。');
  }
  decode(frame, uid) {
    need(typeof uid === 'string' && frame.refs.has(uid), 'CARD', '卡片或选项已经失效，请重新选择。');
    return frame.refs.get(uid);
  }
  decodePicks(frame, uids) {
    need(Array.isArray(uids) && uids.length <= 256 && new Set(uids).size === uids.length, 'CHOICE', '选择列表无效。');
    return uids.map(uid => this.decode(frame, uid));
  }

  validate(s, m) {
    const room = this.roomFor(s), seat = this.seat(room, s);
    this.current(room, seat, m);
    const p = room.engine.state.pending;
    need(p && p.responder === seat && !['window', 'trigger'].includes(p.kind), 'CHOICE', '当前没有需要校验的卡片选择。');
    const frame = this.frame(room, seat), uids = this.decodePicks(frame, m.uids), check = room.engine.validatePick(p, uids);
    const extra = room.engine.find(p.uid)?.card;
    return { ...check, revision: room.revision, uids: m.uids, zones: check.valid && extra && ['extra', 'link-effect'].includes(p.purpose) ? room.engine.freeZones(p.owner, extra, { materials: uids }) : [] };
  }

  act(room, seat, m, c) {
    this.settleClock(room, c);
    if (room.status !== 'playing') { this.touch(room, c); return { finished: true }; }
    this.current(room, seat, m);
    const input = m.action;
    need(input && typeof input === 'object' && !Array.isArray(input), 'ACTION', '操作格式无效。');
    need(input.owner === undefined || input.owner === seat, 'OWNER', '不能代替对手操作。');
    const frame = this.frame(room, seat), pending = room.engine.state.pending;
    let action;
    if (pending) {
      need(['respond', 'pass', 'choose'].includes(input.type), 'CHOICE', '请先完成当前选择。');
      action = { type: input.type };
      if (input.type === 'respond') { action.uid = this.decode(frame, input.uid); if (typeof input.key === 'string') action.key = input.key; }
      if (input.type === 'choose') {
        if (input.cancel === true) action.cancel = true;
        else action.uids = this.decodePicks(frame, input.uids);
      }
    } else if (input.type === 'phase' || input.type === 'end') {
      action = { type: input.type };
      if (input.type === 'phase') { need(['battle', 'main2'].includes(input.phase), 'PHASE', '不能进入这个阶段。'); action.phase = input.phase; }
    } else {
      const uid = input.uid ? this.decode(frame, input.uid) : undefined;
      const candidate = frame.legal.find(a => a.type === input.type && a.uid === uid && a.key === input.key && a.mode === input.mode && a.slot === input.slot && !!a.noTribute === !!input.noTribute);
      need(candidate, 'ILLEGAL_ACTION', '这张卡当前不能进行这个操作。');
      action = { ...candidate };
      if (input.type === 'attack') action.target = input.target == null ? null : this.decode(frame, input.target);
    }
    if (input.position !== undefined) { need(['attack', 'defense'].includes(input.position), 'POSITION', '表示形式无效。'); action.position = input.position; }
    if (input.zone !== undefined) { need([0, 1, 2, 3, 4, 'extra', 'extra2'].includes(input.zone), 'ZONE', '召唤区域无效。'); action.zone = input.zone; }
    // All other caller fields (choices, no-cost flags, RNG, state, materials…) are ignored.
    action.owner = seat;
    const oldTurn = room.engine.state.turn, result = room.engine.act(action);
    need(result.ok, 'RULE', result.error);
    room.actions++;
    if (room.engine.state.turn !== oldTurn) {
      const next = room.engine.state.active;
      room.remaining[next] = Math.min(room.clockSeconds * 1000, room.remaining[next] + 20_000);
    }
    room.clockAt = this.now(); this.touch(room, c); room.events = result.events;
    if (room.engine.state.winner !== null) this.finish(room, room.engine.state.winner, room.engine.state.outcome?.kind || 'special', c);
    else if (room.actions >= 5000 || this.now() - room.startedAt >= 2 * 60 * 60_000) this.finish(room, 'draw', 'limit', c);
    return { revision: room.revision };
  }

  settleClock(room, c) {
    if (room.status !== 'playing') return;
    const at = this.now(), elapsed = Math.max(0, at - room.clockAt);
    if (!this.paused(room)) {
      const actor = this.actor(room); room.remaining[actor] = Math.max(0, room.remaining[actor] - elapsed);
      if (room.remaining[actor] <= 0) this.finish(room, 1 - actor, 'timeout', c);
    }
    room.clockAt = at;
  }
  finish(room, winner, kind, c) {
    if (room.status === 'finished') return;
    const e = room.engine;
    if (e.state.winner === null) {
      e.state.winner = winner; e.state.pending = null;
      e.state.outcome = { kind, winner, loser: winner === 'draw' ? null : 1 - winner, turn: e.state.turn };
      e.log('victory', '决斗结束', winner === 'draw' ? null : winner);
      room.events.push(e.state.log[0]);
    }
    room.status = 'finished'; room.result = { gameId: room.gameId, winner, kind, turn: e.state.turn, finishedAt: this.now() };
    room.frames.clear(); c.rooms.add(room);
    c.games.push({ id: room.gameId, finishedAt: this.now(), result: room.result, players: room.seats.map(m => ({ name: m.name, sessionId: m.sessionId })), snapshot: e.snapshot() });
  }

  removeMember(room, seat, c) {
    const s = this.sessions.get(room.seats[seat].sessionId);
    if (s) { s.roomCode = null; c.sessions.add(s); }
    room.seats[seat] = null;
    if (room.seats.every(m => !m)) { this.rooms.delete(room.code); c.rooms.delete(room); c.deleteRooms.push(room.code); }
    else this.touch(room, c);
  }

  tick() {
    if (!this.healthy) return;
    const c = changes(), at = this.now(); let lobbyChanged = false;
    for (const room of this.rooms.values()) {
      const before = room.status; this.settleClock(room, c);
      const expired = room.seats.map(m => m && !m.connected && m.disconnectedAt !== null && at >= m.disconnectedAt + (m.disconnectRemaining??this.disconnectMs));
      if (room.status === 'playing' && expired.some(Boolean)) {
        const connected = room.seats.map(m => m.connected);
        // Never award a disconnected participant a win when both players disappeared.
        if (connected.some(Boolean)) this.finish(room, connected[0] ? 0 : 1, 'disconnect', c);
        else if (expired.every(Boolean)) this.finish(room, 'draw', 'abandoned', c);
      }
      if (room.status === 'playing' && at - room.startedAt >= 2 * 60 * 60_000) this.finish(room, 'draw', 'limit', c);
      if (before !== room.status) { this.touch(room, c); lobbyChanged = true; }
      if (room.status === 'waiting') for (const seat of [0, 1]) if (expired[seat] && room.seats[seat]) { this.removeMember(room, seat, c); lobbyChanged = true; }
      if (room.status === 'waiting' && at - room.updatedAt > this.waitingMs || room.status === 'finished' && at - room.result.finishedAt > this.retentionMs) {
        for (const m of room.seats.filter(Boolean)) { const s = this.sessions.get(m.sessionId); s.roomCode = null; c.sessions.add(s); this.connections.get(s.id)?.send({ type: 'left', expired: true }); }
        this.rooms.delete(room.code); c.rooms.delete(room); c.deleteRooms.push(room.code); lobbyChanged = true;
      }
      if (this.rooms.has(room.code) && room.status === 'playing') {
        const clock = this.clock(room);
        for (const member of room.seats) this.connections.get(member.sessionId)?.send(clock);
        if (at - this.lastCheckpoint >= 5000) c.rooms.add(room);
      }
    }
    if (at - this.lastPrune >= 60_000) {
      for (const s of this.sessions.values()) if (!s.roomCode && !this.connections.has(s.id) && at - s.seenAt > 7 * day) {
        this.sessions.delete(s.id); this.tokens.delete(s.tokenHash); c.deleteSessions.push(s.id);
      }
      this.store.pruneGames(at - 7 * day); this.lastPrune = at;
    }
    if (c.rooms.size || c.sessions.size || c.deleteRooms.length || c.deleteSessions.length) this.save(c);
    if (at - this.lastCheckpoint >= 5000) this.lastCheckpoint = at;
    // Clock checkpoints do not change the board or interrupt pending selections.
    for (const room of c.rooms) if (room.status !== 'playing' || room.updatedAt === at) this.broadcast(room);
    if (lobbyChanged) this.broadcastLobby();
  }

  shutdown() {
    if (!this.healthy) return;
    const c = changes();
    for (const room of this.rooms.values()) {
      this.settleClock(room, c);
      for (const m of room.seats.filter(Boolean)) {
        if(!m.connected&&m.disconnectedAt!==null&&room.status==='playing')m.disconnectRemaining=Math.max(0,(m.disconnectRemaining??this.disconnectMs)-Math.max(0,this.now()-m.disconnectedAt));
        m.connected = false; m.disconnectedAt = this.now();
      }
      c.rooms.add(room);
    }
    this.save(c);
  }
}
