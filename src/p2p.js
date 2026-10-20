(function (root) {
  'use strict';
  const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
  const need = (ok, message) => { if (!ok) throw Error(message); };
  const { visible, journalEntry } = root.DuelPublic.create(root.DuelData);
  class HostEngine extends root.DuelEngine {
    random() { return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296; }
    log(...args) { super.log(...args); const item = this.state.log[0]; item.pvpLog = [0, 1].map(seat => journalEntry(this, item, seat)); }
  }
  function validateDeck(input) {
    need(input && Array.isArray(input.cards) && input.cards.length <= 60 && Array.isArray(input.extra) && input.extra.length <= 15 && (!input.side || Array.isArray(input.side) && input.side.length <= 15), 'Invalid deck');
    const deck = { id: 'p2p-' + randomId(), name: String(input.name || 'Deck').slice(0, 60), cards: [...input.cards], extra: [...input.extra], side: [...(input.side || [])], ace: input.cards[0], mechanic: 'P2P', player: 'Friend' };
    const check = root.DuelDecks.analyze(deck); need(check.valid, check.errors.join(' ')); return deck;
  }
  function validateFrame(frame) {
    const s=frame?.state;
    need(frame&&/^[a-f0-9]{32}$/.test(frame.gameId)&&Number.isSafeInteger(frame.revision)&&frame.revision>0,'Invalid duel frame');
    need(s?.version===3&&s.mode==='pvp'&&[0,1].includes(s.active)&&[null,0,1,'draw'].includes(s.winner)&&Number.isSafeInteger(s.turn)&&s.turn>0,'Invalid duel state');
    need(Array.isArray(s.players)&&s.players.length===2&&Array.isArray(frame.actions)&&Array.isArray(frame.choices),'Invalid duel view');
    for(const key of ['log','chain','chainHistory','damage','summons'])need(Array.isArray(s[key]),'Invalid state collection');
    need(s.damage.length===2&&s.summons.length===2&&Array.isArray(frame.pendulumUids)&&Array.isArray(frame.topCards)&&frame.topCards.length===2,'Invalid board collection');
    for(const p of s.players){
      need(p&&Number.isFinite(p.lp)&&p.lp>=0&&p.deckSpec,'Invalid player view');
      for(const zone of ['deck','hand','monsters','spells','grave','extra','banished'])need(Array.isArray(p[zone]),'Invalid zone');
    }
    // Existing renderers accept trusted server identifiers and numeric stats.
    // A peer is a separate trust boundary: never let it supply HTML through
    // an identifier, a purported number, a choice title, or an object key.
    const escapedText=new Set(['name','player','description','subtitle','text']);
    const choiceText=new Set(['title','label','detail','note','message','reason','hint']);
    const numeric=new Set(['atk','def','lp','level','rank','linkRating','scale','turn','n','nextLog','owner','responder','active','originalOwner','amount','count','number','chainNumber','byNumber','deckCount','extraCount','summonTurn','changedTurn','setTurn','sentTurn','attacksMade','counters','extraSlot','min','max','startedAt']);
    let nodes=0;
    function walk(value,key='',depth=0){
      need(++nodes<200000&&depth<36,'Duel view is too large');
      if(value===null||value===undefined)return;
      if(escapedText.has(key)||choiceText.has(key))need(typeof value==='string','Invalid text field');
      if(numeric.has(key))need(typeof value==='number'&&Number.isFinite(value),'Invalid numeric field');
      if(typeof value==='string'){
        if(escapedText.has(key))return;
        need(!(choiceText.has(key)?/[<>]/:/[<>"'`\\\u0000-\u001f]/).test(value),'Invalid display field');return;
      }
      if(typeof value==='number'){need(Number.isFinite(value),'Invalid number');return;}
      if(typeof value==='boolean')return;
      need(typeof value==='object','Invalid field');
      if(Array.isArray(value)){for(const item of value)walk(item,['damage','summons'].includes(key)?'amount':'',depth+1);return;}
      if(value.publicStats)need(Object.hasOwn(root.DuelData.CARDS,value.id),'Unknown visible card');
      for(const [k,v]of Object.entries(value)){need(!['__proto__','constructor','prototype'].includes(k)&&!/[<>"'`\\\u0000-\u001f]/.test(k),'Invalid field name');walk(v,k,depth+1);}
    }
    walk(frame);return frame;
  }
  class Host {
    constructor(decks, first) {
      const specs=decks.map(validateDeck);
      this.room = { engine: new HostEngine({ deck:specs[0].id,opponentDeck:specs[1].id,deckSpecs: specs, first, seed: 1 }), gameId: randomId(), revision: 1, seats: [{ name: 'Host' }, { name: 'Guest' }], events: [] };
      this.frames = new Map(); this.opaque = new Map();
      this.project = root.DuelProjection.create({ Data: root.DuelData, Lingering: root.DuelLingering, visible, opaque: (room, seat, uid) => {
        const key = seat + ':' + room.revision + ':' + uid; if (!this.opaque.has(key)) this.opaque.set(key, 'h_' + randomId()); return this.opaque.get(key);
      } });
    }
    frame(seat) {
      if (!this.frames.has(seat)) this.frames.set(seat, this.project(this.room, seat));
      return JSON.parse(JSON.stringify({ ...this.frames.get(seat).data, revision: this.room.revision, gameId: this.room.gameId }));
    }
    request(seat, type, message) {
      need([0, 1].includes(seat), 'Invalid seat');
      need(message.gameId === this.room.gameId && message.revision === this.room.revision, 'The board changed. Please select again.');
      const e = this.room.engine;
      need(e.state.winner === null, 'This duel has ended.');
      need((e.state.pending?.responder ?? e.state.active) === seat || type === 'surrender', 'Wait for your turn.');
      this.frame(seat); const frame = this.frames.get(seat);
      if (type === 'validate') {
        const p = e.state.pending; need(p && p.responder === seat && !['window', 'trigger'].includes(p.kind), 'No card choice to validate.');
        const uids = root.DuelIntent.decodePicks(frame, message.uids), check = e.validatePick(p, uids), extra = e.find(p.uid)?.card;
        return { ...check, revision: this.room.revision, uids: message.uids, zones: check.valid && extra && ['extra', 'link-effect'].includes(p.purpose) ? e.freeZones(p.owner, extra, { materials: uids }) : [] };
      }
      if (type === 'surrender') { e.state.winner = 1 - seat; e.state.pending = null; e.state.outcome = { kind: 'surrender', winner: 1 - seat, turn: e.state.turn }; e.log('victory', '决斗结束', 1 - seat); }
      else { need(type === 'act', 'Unsupported request'); const result = e.act(root.DuelIntent.decodeAction(e, frame, seat, message)); need(result.ok, result.error); this.room.events = result.events; }
      this.room.revision++; this.frames.clear(); this.opaque.clear(); return { revision: this.room.revision };
    }
  }
  class Peer {
    constructor({ host = false, stun = true, message, status }) {
      this.host = host; this.onMessage = message; this.onStatus = status; this.pending = new Map(); this.parts = new Map(); this.serial = 0;
      this.pc = new RTCPeerConnection({ iceServers: stun ? [{ urls: 'stun:stun.l.google.com:19302' }] : [] });
      this.pc.ondatachannel = event => this.bind(event.channel);
      this.pc.onconnectionstatechange = () => this.onStatus?.(this.pc.connectionState);
      if (host) this.bind(this.pc.createDataChannel('duel', { ordered: true }));
    }
    get connected() { return this.channel?.readyState === 'open' && this.pc.connectionState === 'connected'; }
    bind(channel) {
      this.channel = channel;
      channel.onopen = () => this.onStatus?.('connected');
      channel.onclose = () => { this.onStatus?.('disconnected'); for (const job of this.pending.values()) { clearTimeout(job.timer); job.reject(Error('Peer disconnected')); } this.pending.clear(); };
      channel.onmessage = event => {
        try {
          need(typeof event.data === 'string' && event.data.length < 20000, 'Invalid channel message');
          const chunk = JSON.parse(event.data);
          need(typeof chunk.mid === 'string' && chunk.mid.length <= 48 && Number.isInteger(chunk.total) && chunk.total > 0 && chunk.total <= 256 && Number.isInteger(chunk.index) && chunk.index >= 0 && chunk.index < chunk.total && typeof chunk.part === 'string' && chunk.part.length <= 12000, 'Invalid chunk');
          for (const [id, entry] of this.parts) if (Date.now() - entry.at > 10000) this.parts.delete(id);
          let entry = this.parts.get(chunk.mid);
          if (!entry) { need(this.parts.size < 4, 'Too many incomplete messages'); entry = { at: Date.now(), total: chunk.total, parts: new Map() }; this.parts.set(chunk.mid, entry); }
          need(entry.total === chunk.total, 'Chunk size changed'); entry.parts.set(chunk.index, chunk.part);
          if (entry.parts.size !== entry.total) return;
          this.parts.delete(chunk.mid);
          const data = JSON.parse(Array.from({ length: entry.total }, (_, i) => entry.parts.get(i)).join(''));
          if (data.type === 'ack') { const job = this.pending.get(data.id); if (job) { clearTimeout(job.timer); this.pending.delete(data.id); data.error ? job.reject(Error(data.error)) : job.resolve(data.result); } }
          else this.onMessage?.(data);
        } catch (error) { this.onStatus?.('error', error.message); }
      };
    }
    send(data) {
      need(this.channel?.readyState === 'open', 'Peer disconnected');
      const text = JSON.stringify(data); need(text.length <= 3 * 1024 * 1024, 'Message is too large');
      need(this.channel.bufferedAmount < 4 * 1024 * 1024, 'Connection is busy. Try again.');
      const mid = randomId(), total = Math.max(1, Math.ceil(text.length / 12000));
      for (let index = 0; index < total; index++) this.channel.send(JSON.stringify({ mid, total, index, part: text.slice(index * 12000, (index + 1) * 12000) }));
    }
    request(type, payload) {
      const id = ++this.serial;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { this.pending.delete(id); reject(Error('Peer did not acknowledge the request')); }, 15000);
        this.pending.set(id, { resolve, reject, timer });
        try { this.send({ type: 'request', id, request: type, payload }); } catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
      });
    }
    async gather() {
      if (this.pc.iceGatheringState !== 'complete') await new Promise(resolve => {
        const done = () => { clearTimeout(timer); this.pc.removeEventListener('icegatheringstatechange', changed); resolve(); };
        const changed = () => { if (this.pc.iceGatheringState === 'complete') done(); };
        const timer = setTimeout(done, 12000); this.pc.addEventListener('icegatheringstatechange', changed);
      });
      return btoa(JSON.stringify({ version: 1, description: this.pc.localDescription }));
    }
    async offer(restart = false) { await this.pc.setLocalDescription(await this.pc.createOffer({ iceRestart: restart })); return this.gather(); }
    async accept(code) {
      need(typeof code === 'string' && code.length < 180000, 'Invalid invitation');
      const data = JSON.parse(atob(code.trim())); need(data.version === 1 && ['offer', 'answer'].includes(data.description?.type) && typeof data.description.sdp === 'string', 'Invalid invitation');
      need(data.description.type === (this.host ? 'answer' : 'offer'), 'Use the other player’s code.');
      await this.pc.setRemoteDescription(data.description);
      if (!this.host) { await this.pc.setLocalDescription(await this.pc.createAnswer()); return this.gather(); }
    }
    close() { this.channel?.close(); this.pc.close(); this.parts.clear(); }
  }
  root.DuelP2P = { Host, Peer, validateDeck, validateFrame, randomId };
})(globalThis);
