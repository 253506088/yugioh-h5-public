(function (root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const read = (storage, key) => { try { return JSON.parse(storage.getItem(key) || 'null'); } catch { return null; } };
  const write = (storage, key, value) => { try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const id = () => root.crypto.randomUUID?.() || Array.from(root.crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');

  class Connection {
    constructor(callbacks = {}) {
      this.callbacks = callbacks; this.status = 'idle'; this.pending = new Map(); this.attempt = 0;
      this.key = 'duel-sanctuary-pvp-session-v1:' + root.location.host;
      try { this.storage = root.sessionStorage; } catch { this.storage = null; }
      this.session = read(this.storage, this.key); this.name = this.session?.name || '';
      this.stopped = false; this.latency = null; this.socket = null;
      root.addEventListener('online', () => { if (!this.stopped && this.status === 'reconnecting') this.connect(this.name); });
    }
    setStatus(status) { this.status = status; this.callbacks.status?.(status); }
    get connected() { return this.status === 'connected' && this.socket?.readyState === 1; }
    connect(name) {
      this.name = name || this.name;
      if (this.socket && [0, 1].includes(this.socket.readyState)) return;
      if (!['http:', 'https:'].includes(root.location.protocol)) { this.setStatus('unavailable'); return; }
      clearTimeout(this.retryTimer); this.stopped = false;
      this.setStatus(this.attempt ? 'reconnecting' : 'connecting');
      const socket = this.socket = new WebSocket((root.location.protocol === 'https:' ? 'wss://' : 'ws://') + root.location.host + '/pvp/ws');
      socket.onopen = () => socket.send(JSON.stringify({ type: 'hello', version: 1, name: this.name, token: this.session?.token }));
      socket.onmessage = event => {
        let data; try { data = JSON.parse(event.data); } catch { return; }
        if (data.type === 'welcome') {
          this.session = { token: data.token, name: data.name }; this.name = data.name;
          if (!write(this.storage, this.key, this.session)) this.callbacks.error?.({ code: 'STORAGE', message: '浏览器禁止保存重连凭证，刷新后无法恢复席位。' });
          this.attempt = 0; this.lastPong = Date.now(); this.setStatus('connected');
          clearInterval(this.pingTimer);
          this.pingTimer = setInterval(() => {
            if (!this.connected) return;
            if (Date.now() - this.lastPong > 25_000) { socket.close(4000, 'Heartbeat timeout'); return; }
            socket.send(JSON.stringify({ type: 'ping', sentAt: Date.now() }));
          }, 5000);
          for (const entry of this.pending.values()) if (entry.retry) socket.send(JSON.stringify(entry.message));
          this.callbacks.welcome?.(data); return;
        }
        if (data.type === 'pong') { this.lastPong = Date.now(); this.latency = Math.max(0, Date.now() - data.sentAt); this.callbacks.latency?.(this.latency); return; }
        if (data.type === 'replaced') { this.stopped = true; this.setStatus('replaced'); return; }
        if (data.type === 'ack' || data.type === 'error') {
          const entry = this.pending.get(data.id);
          if (entry) {
            clearTimeout(entry.timer); this.pending.delete(data.id);
            if (data.type === 'error' || data.ok === false) entry.reject(data); else entry.resolve(data.data || {});
          } else if (data.type === 'error') this.callbacks.error?.(data);
          if (['SESSION_EXPIRED', 'SESSION', 'VERSION'].includes(data.code)) { this.stopped = true; this.setStatus('unavailable'); socket.close(); }
          return;
        }
        this.callbacks.message?.(data);
      };
      socket.onerror = () => {};
      socket.onclose = () => {
        if (this.socket !== socket) return;
        clearInterval(this.pingTimer);
        for (const [id, entry] of this.pending) if (!entry.retry || this.stopped) {
          clearTimeout(entry.timer); entry.reject({ code: 'CONNECTION', message: '连接已断开，重新连接后可继续。' }); this.pending.delete(id);
        }
        if (this.stopped) return;
        this.attempt++; this.setStatus('reconnecting');
        this.retryTimer = setTimeout(() => this.connect(this.name), Math.min(10_000, 500 * 2 ** Math.min(this.attempt, 4)) + Math.random() * 300);
      };
    }
    request(type, data = {}) {
      if (!this.connected) return Promise.reject({ code: 'CONNECTION', message: '正在恢复连接，请稍候。' });
      const requestId = id(), message = { ...data, type, id: requestId };
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(requestId); reject({ code: 'TIMEOUT', message: '未收到服务器确认，正在重新同步局面。' });
          this.socket?.close(4000, 'Resynchronize');
        }, 30_000);
        this.pending.set(requestId, { message, resolve, reject, timer, retry: type === 'act' });
        this.socket.send(JSON.stringify(message));
      });
    }
    async rename(name) {
      const result = await this.request('profile', { name }); this.name = result.name; this.session.name = result.name;
      write(this.storage, this.key, this.session); return result;
    }
    reset() {
      for(const entry of this.pending.values()){clearTimeout(entry.timer);entry.reject({code:'SESSION_RESET',message:'已重置联机席位。'});}this.pending.clear();
      this.stopped = true; clearTimeout(this.retryTimer); this.socket?.close(); this.socket = null;
      this.session = null; try { this.storage?.removeItem(this.key); } catch {}
      this.attempt = 0; this.connect(this.name);
    }
  }

  // Presentation facade. It cannot shuffle, resolve effects, or run an opponent AI.
  class RemoteEngine {
    constructor(data, connection, onError) {
      this.remote = true; this.connection = connection; this.onError = onError;
      this.onChange = () => {}; this.onPickUpdate = () => {}; this.onBusyUpdate = () => {}; this.busy = false;
      this.update(data, false);
    }
    update(data, notify = true) {
      if (this.data && data.revision === this.revision) return;
      this.data = data; this.revision = data.revision; this.state = data.state; this.index = new Map(); this.pickCache = new Map();
      if(this.busy && this.revision > this.pendingRevision)this.busy=false;
      clearTimeout(this.pickTimer);
      for (const owner of [0, 1]) {
        const p = this.state.players[owner];
        for (const zone of ['hand', 'monsters', 'spells', 'grave', 'extra', 'banished', 'deck']) {
          p[zone].forEach((card, index) => { if (card?.uid) this.index.set(card.uid, { owner, zone, index, card }); });
        }
        for (const key of ['extraMonster', 'extraMonster2', 'fieldSpell']) {
          const card = p[key]; if (card) this.index.set(card.uid, { owner, zone: key === 'fieldSpell' ? key : 'extraMonster', index: card.extraSlot ?? owner, card });
        }
      }
      for (const entry of [...this.index.values()]) for (const card of entry.card.overlays || []) this.index.set(card.uid, { owner: entry.owner, zone: 'overlays', card });
      for (const entry of data.choices || []) this.index.set(entry.card.uid, entry);
      if (notify) this.onChange(data.events || []);
    }
    find(uid) { return this.index.get(uid) || null; }
    deckInfo(owner) { return this.state.players[owner].deckSpec; }
    monsters(owner) { const p = this.state.players[owner]; return [...p.monsters, p.extraMonster, p.extraMonster2].filter(Boolean); }
    attackValue(card) { return card?.publicStats?.atk ?? root.DuelData.CARDS[card?.id]?.atk ?? 0; }
    defenseValue(card) { return card?.publicStats?.def ?? root.DuelData.CARDS[card?.id]?.def ?? 0; }
    level(card) { return card?.publicStats?.level ?? root.DuelData.CARDS[card?.id]?.level ?? 0; }
    negated(card) { return !!card?.publicStats?.negated; }
    actionsFor(uid, owner = 0) { return owner === 0 && !this.busy && !this.blocked && this.connection.connected ? this.data.actions.filter(a => a.uid === uid && a.type !== 'extra-summon').map(a => ({ ...a })) : []; }
    extraOptions(owner) { return owner === 0 ? this.data.actions.filter(a => a.type === 'extra-summon').map(a => ({ type: root.DuelData.CARDS[this.find(a.uid)?.card.id]?.type, card: this.find(a.uid)?.card })).filter(a => a.card) : []; }
    pendulumCandidates(owner) { return owner === 0 ? (this.data.pendulumUids || []).map(uid => this.find(uid)?.card).filter(Boolean) : []; }
    pendulumScale(card) { return card?.publicStats?.scale ?? root.DuelData.CARDS[card?.id]?.scale; }
    scales(owner) { const p = this.state.players[owner]; return [p.spells[0], p.spells[4]].map(card => card?.faceUp && card.publicStats?.pendulumZone && !card.publicStats?.pendingActivation ? { card, scale: this.pendulumScale(card) } : null); }
    attackBlocked(owner) { return !!this.data.attackBlocked[owner]; }
    canAttack(card, owner, target = null) { const options = this.data.attackTargets[card?.uid]; return owner === 0 && !!options && (target === null ? options.direct : options.targets.includes(target)); }
    canDirect(card, owner) { return this.canAttack(card, owner, null); }
    handRevealed() { return this.data.handRevealed; }
    publicDeckTop(owner) { return this.data.topCards[owner]; }
    coLinked(uid) { return this.data.coLinks[uid] || []; }
    extraAt(slot) { return [...this.index.values()].find(f => f.zone === 'extraMonster' && f.card.extraSlot === slot) || null; }
    extraSlot(owner, zone) { return zone === 'extra' ? owner : 1 - owner; }
    ritualRequirement() { return this.state.pending?.ritualRequirement || 0; }
    freeZones(owner, card, { materials = [] } = {}) { return this.pickCache.get(JSON.stringify(materials))?.zones || []; }
    validatePick(pending, uids) {
      const key = JSON.stringify(uids), cached = this.pickCache.get(key);
      if (cached) return cached;
      if (!this.connection.connected || this.busy || this.blocked) return { valid: false, message: '等待服务器连接与确认…' };
      if (this.queryKey !== key || this.queryRevision !== this.revision) {
        this.queryKey = key; this.queryRevision = this.revision; clearTimeout(this.pickTimer);
        const revision = this.revision;
        this.pickTimer = setTimeout(() => {
          this.connection.request('validate', { revision, uids: [...uids] }).then(result => {
            if (revision !== this.revision) return;
            this.pickCache.set(key, result); if (this.queryKey === key) this.onPickUpdate();
          }).catch(error => {
            if (revision !== this.revision) return;
            this.pickCache.set(key, { valid: false, message: error.message || '选择校验失败，请重新选择。' }); this.onPickUpdate();
          });
        }, 65);
      }
      return { valid: false, message: '正在校验选择…' };
    }
    act(input) {
      if (!this.connection.connected || this.busy || this.blocked) return { ok: false, error: '等待服务器连接与确认…' };
      const keys = ['type', 'uid', 'key', 'mode', 'noTribute', 'slot', 'target', 'position', 'zone', 'phase', 'cancel', 'uids'];
      const action = Object.fromEntries(keys.filter(key => input[key] !== undefined).map(key => [key, input[key]]));
      this.busy = true; this.pendingRevision = this.revision; this.onBusyUpdate();
      this.connection.request('act', { revision: this.revision, action }).then(() => {
        if(this.revision>this.pendingRevision){this.busy=false;this.onBusyUpdate();}
      }).catch(error => { this.busy=false;this.onError(error);this.onBusyUpdate(); });
      return { ok: true, pending: true };
    }
    snapshot() { return { state: clone(this.state) }; }
    aiNext() { return null; }
  }

  root.DuelPVPClient = { Connection, RemoteEngine };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.DuelPVPClient;
})(globalThis);
