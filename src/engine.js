(function (root) {
  'use strict';
  const { CARDS, DECKS, isMonster } = root.DuelData || require('./cards.js');
  const clone = value => JSON.parse(JSON.stringify(value));
  const occupied = slots => slots.filter(Boolean);
  class RuleError extends Error {}
  const requireRule = (condition, message) => { if (!condition) throw new RuleError(message); };

  class DuelEngine {
    constructor(options = {}) {
      this.onChange = () => {};
      this.events = [];
      this.randomState = (Number(options.seed) || Date.now()) >>> 0;
      const playerDeck = options.deck || 'blue';
      this.state = { version: 1, turn: 1, active: options.first === 0 ? 0 : 1, phase: 'main1', normalUsed: false, winner: null, resultReason: '', pending: null, nextUid: 1, nextLog: 1, log: [], damage: [0, 0], summons: [0, 0], startedAt: Date.now(), difficulty: options.difficulty || 'standard', players: [] };
      for (const deckId of [playerDeck, options.opponentDeck || (playerDeck === 'blue' ? 'dark' : 'blue')]) {
        const deck = DECKS[deckId];
        requireRule(!!deck, '找不到这套卡组。');
        const instances = deck.cards.map(id => this.makeCard(id));
        this.shuffle(instances);
        // Both sides receive the same beginner-friendly opening guarantee.
        if (options.openingGuarantee !== false && !instances.slice(0, 5).some(c => CARDS[c.id].type === 'monster' && CARDS[c.id].level <= 4)) {
          const at = instances.findIndex(c => CARDS[c.id].type === 'monster' && CARDS[c.id].level <= 4);
          if (at >= 0) [instances[0], instances[at]] = [instances[at], instances[0]];
        }
        this.state.players.push({ deckId, lp: 8000, deck: instances, hand: [], monsters: Array(5).fill(null), spells: Array(5).fill(null), grave: [], extra: deck.extra.map(id => this.makeCard(id)) });
      }
      for (let owner = 0; owner < 2; owner++) this.draw(owner, 5, true);
      this.log('system', '命运的牌组已经就绪，决斗开始。');
      this.log('turn', `${this.name(this.state.active)}先攻 · 主要阶段 1`, this.state.active);
      this.events = [];
      this.assertState();
    }

    makeCard(id, originalOwner = this.state.players.length) { return { id, uid: 'c' + this.state.nextUid++, originalOwner, faceUp: true, position: 'attack', attacked: false, summonTurn: 0, changedTurn: 0, setTurn: 0, counters: 0, turnsLeft: 0, properlySummoned: false }; }
    random() { let x = this.randomState; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.randomState = x >>> 0; return this.randomState / 4294967296; }
    shuffle(items) { for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; } }
    name(owner) { return owner === 0 ? '你' : DECKS[this.state.players[owner].deckId].player; }
    log(kind, text, owner = null, extra = {}) { const item = { n: this.state.nextLog++, turn: this.state.turn, kind, text, owner, ...extra }; this.state.log.unshift(item); this.state.log.length = Math.min(this.state.log.length, 100); this.events.push(item); }
    get activePlayer() { return this.state.players[this.state.active]; }
    get opponent() { return this.state.players[1 - this.state.active]; }
    monsters(owner) { return occupied(this.state.players[owner].monsters); }
    spells(owner) { return occupied(this.state.players[owner].spells); }
    find(uid) {
      for (let owner = 0; owner < 2; owner++) for (const zone of ['hand', 'monsters', 'spells', 'grave', 'deck', 'extra']) {
        const index = this.state.players[owner][zone].findIndex(card => card && card.uid === uid);
        if (index !== -1) return { owner, zone, index, card: this.state.players[owner][zone][index] };
      }
      return null;
    }
    remove(uid) {
      const found = this.find(uid);
      requireRule(found, '这张卡已不在原来的位置。');
      if (found.zone === 'monsters' || found.zone === 'spells') this.state.players[found.owner][found.zone][found.index] = null;
      else this.state.players[found.owner][found.zone].splice(found.index, 1);
      return found;
    }
    toGrave(uid, reason = '', event = true) {
      const found = this.remove(uid);
      const card = found.card;
      card.faceUp = true; card.counters = 0; card.turnsLeft = 0;
      const originalOwner = [0, 1].includes(card.originalOwner) ? card.originalOwner : found.owner;
      this.state.players[originalOwner].grave.push(card);
      if (event) this.log('destroy', `${CARDS[card.id].name}${reason ? ' ' + reason : ''}送入墓地`, found.owner, { cardId: card.id, uid, zone: found.zone });
      return card;
    }
    attackValue(card) {
      if (!card) return 0;
      const def = CARDS[card.id];
      let result = def.atk || 0;
      if (def.effect === 'breaker') result += card.counters * 300;
      if (def.effect === 'dark-girl') result += this.state.players.reduce((sum, p) => sum + p.grave.filter(c => c.id === 'dark-magician').length * 300, 0);
      return result;
    }
    tributeCount(card) { const level = CARDS[card.id].level; return level >= 7 ? 2 : level >= 5 ? 1 : 0; }
    mainCheck() { requireRule(['main1', 'main2'].includes(this.state.phase), '请在主要阶段进行这个操作。'); }
    ownCard(uid, zones) { const found = this.find(uid); requireRule(found && found.owner === this.state.active && zones.includes(found.zone), '无法在这个位置使用此卡。'); return found; }
    draw(owner, amount = 1, silent = false) {
      const player = this.state.players[owner];
      let actual = 0;
      for (let i = 0; i < amount; i++) {
        if (!player.deck.length) { this.finish(1 - owner, `${this.name(owner)}的卡组已空，无法抽卡。`); break; }
        player.hand.push(player.deck.shift()); actual++;
      }
      if (!silent && actual) this.log('draw', `${this.name(owner)}抽了${actual}张卡`, owner, { amount: actual });
    }
    damage(owner, amount, source = '战斗') {
      if (!amount) return;
      const player = this.state.players[owner];
      player.lp = Math.max(0, player.lp - amount);
      this.state.damage[1 - owner] += amount;
      this.log('damage', `${this.name(owner)}受到 ${amount} 点${source}伤害`, owner, { amount });
      if (player.lp <= 0) this.finish(1 - owner, `${this.name(owner)}的生命值归零。`);
    }
    finish(winner, reason) {
      if (this.state.winner !== null) return;
      this.state.winner = winner; this.state.resultReason = reason; this.state.pending = null;
      this.log('victory', winner === 0 ? '决斗胜利！属于你的命运，在此刻闪耀。' : '决斗结束。整理牌组，再一次相信自己的卡。', winner);
    }
    summonInto(owner, card, mode = 'attack', special = false) {
      const player = this.state.players[owner];
      const index = player.monsters.indexOf(null);
      requireRule(index >= 0, '怪兽区域已满。');
      card.faceUp = mode !== 'defense'; card.position = mode === 'defense' ? 'defense' : 'attack';
      card.summonTurn = this.state.turn; card.changedTurn = this.state.turn; card.attacked = false; card.counters = 0;
      if (special) card.faceUp = true;
      if (CARDS[card.id].effect === 'breaker' && !special && card.faceUp) card.counters = 1;
      player.monsters[index] = card; this.state.summons[owner]++;
      const name = card.faceUp || owner === 0 ? `「${CARDS[card.id].name}」` : '一只怪兽';
      this.log(special ? 'special' : 'summon', `${this.name(owner)}${special ? '特殊召唤' : mode === 'defense' ? '盖放' : '召唤'}${name}`, owner, { cardId: card.faceUp || owner === 0 ? card.id : null, uid: card.uid, faceUp: card.faceUp });
      return card;
    }

    act(action) {
      const before = this.snapshot();
      this.events = [];
      try {
        requireRule(this.state.winner === null, '这场决斗已经结束。');
        requireRule(action && typeof action.type === 'string', '无效的操作。');
        if (this.state.pending) requireRule(['respond', 'discard'].includes(action.type), '请先完成当前的卡牌响应。');
        else requireRule(!['respond', 'discard'].includes(action.type), '当前没有需要处理的响应。');
        switch (action.type) {
          case 'summon': this.normalSummon(action); break;
          case 'set': this.setCard(action); break;
          case 'cast': this.castSpell(action); break;
          case 'effect': this.monsterEffect(action); break;
          case 'stance': this.changeStance(action); break;
          case 'attack': this.declareAttack(action); break;
          case 'respond': this.respond(action); break;
          case 'discard': this.discard(action); break;
          case 'phase': this.changePhase(action.phase); break;
          case 'end': this.endTurn(); break;
          default: throw new RuleError('未知的操作。');
        }
        this.assertState();
        const events = clone(this.events);
        this.onChange(events);
        return { ok: true, events };
      } catch (error) {
        this.state = before.state; this.randomState = before.randomState; this.events = [];
        if (!(error instanceof RuleError)) throw error;
        return { ok: false, error: error.message };
      }
    }
    normalSummon({ uid, mode = 'attack', tributes = [] }) {
      this.mainCheck();
      requireRule(!this.state.normalUsed, '本回合已经进行过通常召唤或盖放。');
      requireRule(['attack', 'defense'].includes(mode), '无效的召唤表示。');
      const { card, owner } = this.ownCard(uid, ['hand']);
      requireRule(CARDS[card.id].type === 'monster', '这张卡不能通常召唤。');
      const cost = this.tributeCount(card);
      requireRule(Array.isArray(tributes) && tributes.length === cost, '祭品的数量与此卡等级不符。');
      requireRule(new Set(tributes).size === cost, `需要选择${cost}只怪兽作为祭品。`);
      for (const tribute of tributes) this.ownCard(tribute, ['monsters']);
      requireRule(this.activePlayer.monsters.includes(null) || cost > 0, '怪兽区域已满。');
      for (const tribute of tributes) this.toGrave(tribute, '作为祭品', true);
      this.remove(uid); this.state.normalUsed = true;
      this.summonInto(owner, card, mode);
      if (card.faceUp && this.attackValue(card) >= 1000) {
        const responses = this.reactions(1 - owner, 'summon');
        if (responses.length) this.state.pending = { kind: 'summon', owner, responder: 1 - owner, uid, choices: responses };
      }
    }
    setCard({ uid }) {
      this.mainCheck();
      const { card, owner } = this.ownCard(uid, ['hand']);
      requireRule(['spell', 'trap'].includes(CARDS[card.id].type), '请用盖放怪兽操作。');
      const index = this.activePlayer.spells.indexOf(null);
      requireRule(index >= 0, '魔法与陷阱区域已满。');
      this.remove(uid); card.faceUp = false; card.setTurn = this.state.turn;
      this.activePlayer.spells[index] = card;
      this.log('set', `${this.name(owner)}盖放了1张魔法或陷阱卡`, owner, { uid });
    }
    spellCandidates(owner = this.state.active) { const p = this.state.players[owner]; return [...p.hand, ...occupied(p.spells).filter(c => !c.faceUp)].filter(c => CARDS[c.id].type === 'spell'); }
    targetsFor(card, owner = this.state.active) {
      const def = CARDS[card.id];
      if (def.target === 'backrow' || def.effect === 'breaker') return [0, 1].flatMap(i => this.spells(i).filter(c => c.uid !== card.uid).map(c => ({ owner: i, uid: c.uid, card: c, hidden: !c.faceUp && i !== 0 })));
      if (def.target === 'grave-monster') return [0, 1].flatMap(i => this.state.players[i].grave.filter(c => isMonster(CARDS[c.id])).map(c => ({ owner: i, uid: c.uid, card: c })));
      if (def.target === 'hand-normal') return this.state.players[owner].hand.filter(c => CARDS[c.id].type === 'monster' && !CARDS[c.id].effect && CARDS[c.id].level >= 5).map(c => ({ owner, uid: c.uid, card: c }));
      if (def.target === 'fusion') return this.fusions(owner).map(f => ({ owner, uid: f.card.uid, card: f.card, materials: f.materials }));
      return [];
    }
    fusions(owner) {
      const p = this.state.players[owner];
      const available = [...p.hand, ...occupied(p.monsters)];
      return p.extra.flatMap(card => {
        const used = [];
        for (const id of CARDS[card.id].materials) {
          const material = available.find(c => c.id === id && !used.includes(c.uid));
          if (!material) return [];
          used.push(material.uid);
        }
        if (!p.monsters.includes(null) && !used.some(uid => p.monsters.some(c => c && c.uid === uid))) return [];
        return [{ card, materials: used }];
      });
    }
    castSpell({ uid, target }) {
      this.mainCheck();
      const { card, owner, zone } = this.ownCard(uid, ['hand', 'spells']);
      const def = CARDS[card.id];
      requireRule(def.type === 'spell', '陷阱卡需要在对应时机响应。');
      requireRule(zone !== 'spells' || !card.faceUp, '这张魔法卡已经生效。');
      requireRule(zone === 'spells' || this.activePlayer.spells.includes(null), '需要一个空的魔法与陷阱区域。');
      let selected = null;
      if (def.target) {
        const targets = this.targetsFor(card, owner);
        requireRule(targets.length > 0, def.effect === 'fusion' ? '手牌和场上的融合素材不足。' : '当前没有可选的目标。');
        selected = targets.find(t => t.uid === (typeof target === 'string' ? target : target?.uid));
        requireRule(selected, '请选择一个有效目标。');
      }
      if (['reborn', 'ancient'].includes(def.effect)) requireRule(this.activePlayer.monsters.includes(null), '怪兽区域已满。');
      if (['raigeki', 'fissure'].includes(def.effect)) requireRule(this.monsters(1 - owner).length, '对方场上没有怪兽。');
      if (def.effect === 'dark-hole') requireRule(this.monsters(0).length + this.monsters(1).length, '场上没有怪兽。');
      this.remove(uid); card.faceUp = true;
      this.log('spell', `${this.name(owner)}发动「${def.name}」`, owner, { cardId: card.id, uid });
      for (const p of this.state.players) for (const m of occupied(p.monsters)) if (m.faceUp && CARDS[m.id].effect === 'skilled') m.counters = Math.min(3, m.counters + 1);
      if (def.effect === 'swords') { card.turnsLeft = 3; this.activePlayer.spells[this.activePlayer.spells.indexOf(null)] = card; }
      else this.activePlayer.grave.push(card);
      switch (def.effect) {
        case 'draw2': this.draw(owner, 2); break;
        case 'reborn': {
          const revived = this.remove(selected.uid).card;
          this.summonInto(owner, revived, 'attack', true); break;
        }
        case 'raigeki': for (const m of [...this.monsters(1 - owner)]) this.toGrave(m.uid, '被雷击破坏'); break;
        case 'dark-hole': for (const i of [0, 1]) for (const m of [...this.monsters(i)]) this.toGrave(m.uid, '被黑洞破坏'); break;
        case 'fissure': {
          const all = this.monsters(1 - owner);
          const visible = all.filter(m => m.faceUp);
          const lowest = (visible.length ? visible : all).sort((a, b) => this.attackValue(a) - this.attackValue(b))[0];
          this.toGrave(lowest.uid, '被地割破坏'); break;
        }
        case 'mst': this.toGrave(selected.uid, '被旋风破坏'); break;
        case 'swords':
          for (const m of this.monsters(1 - owner)) m.faceUp = true;
          this.log('effect', '光之护封剑展开，对方3个回合内不能攻击', owner); break;
        case 'fusion': {
          for (const material of selected.materials) this.toGrave(material, '作为融合素材');
          const fused = this.remove(selected.uid).card; fused.properlySummoned = true;
          this.summonInto(owner, fused, 'attack', true); break;
        }
        case 'ancient': this.summonInto(owner, this.remove(selected.uid).card, 'attack', true); break;
        case 'heal': this.activePlayer.lp += 1000; this.log('heal', `${this.name(owner)}回复 1000 点生命值`, owner, { amount: 1000 }); break;
        default: throw new Error('Unimplemented spell: ' + def.effect);
      }
    }
    monsterEffect({ uid, target }) {
      this.mainCheck();
      const { card, owner, zone } = this.ownCard(uid, ['monsters', 'hand']);
      const effect = CARDS[card.id].effect;
      if (effect === 'thunder-search') {
        requireRule(zone === 'hand', '雷龙的检索效果需要从手牌发动。');
        const copies = this.activePlayer.deck.filter(c => c.id === 'thunder-dragon').slice(0, 2);
        requireRule(copies.length > 0, '卡组中没有其他雷龙。');
        this.toGrave(uid, '发动效果，从手牌丢弃');
        for (const copy of copies) this.activePlayer.hand.push(this.remove(copy.uid).card);
        this.log('effect', `${this.name(owner)}将${copies.length}张「雷龙」加入手牌`, owner, { cardId: 'thunder-dragon' });
        return;
      }
      requireRule(zone === 'monsters' && card.faceUp, '只有场上表侧怪兽可以发动此效果。');
      if (effect === 'kaibaman') {
        const dragon = this.activePlayer.hand.find(c => c.id === 'blue-eyes');
        requireRule(dragon, '手牌中需要有「青眼白龙」。');
        this.toGrave(uid, '解放以发动效果'); this.summonInto(owner, this.remove(dragon.uid).card, 'attack', true);
      } else if (effect === 'skilled') {
        requireRule(card.counters >= 3, '需要3个魔力指示物。');
        const magician = [...this.activePlayer.hand, ...this.activePlayer.deck, ...this.activePlayer.grave].find(c => c.id === 'dark-magician');
        requireRule(magician, '手牌、卡组或墓地中没有黑魔术师。');
        this.toGrave(uid, '解放并移除3个魔力指示物'); this.summonInto(owner, this.remove(magician.uid).card, 'attack', true);
      } else if (effect === 'breaker') {
        requireRule(card.counters > 0, '没有可移除的魔力指示物。');
        const selected = this.targetsFor(card, owner).find(t => t.uid === (typeof target === 'string' ? target : target?.uid));
        requireRule(selected, '请选择1张场上的魔法或陷阱卡。');
        card.counters--; this.toGrave(selected.uid, '被破坏者的效果破坏');
        this.log('effect', '魔导战士 破坏者移除1个魔力指示物', owner, { cardId: card.id });
      } else throw new RuleError('这张怪兽没有可主动发动的效果。');
    }
    changeStance({ uid }) {
      this.mainCheck();
      const { card, owner } = this.ownCard(uid, ['monsters']);
      requireRule(card.summonTurn < this.state.turn && card.changedTurn < this.state.turn && !card.attacked, '召唤当回合、攻击后，或已变更表示的怪兽不能再次变更。');
      if (!card.faceUp) { card.faceUp = true; card.position = 'attack'; }
      else card.position = card.position === 'attack' ? 'defense' : 'attack';
      card.changedTurn = this.state.turn;
      this.log('stance', `${CARDS[card.id].name}变为${card.position === 'attack' ? '攻击' : '守备'}表示`, owner, { uid, cardId: card.id });
    }
    attackBlocked(owner) { return this.spells(1 - owner).some(c => c.faceUp && CARDS[c.id].effect === 'swords' && c.turnsLeft > 0); }
    reactions(owner, trigger) {
      const result = this.spells(owner).filter(c => !c.faceUp && c.setTurn < this.state.turn && CARDS[c.id].type === 'trap' && CARDS[c.id].trigger === trigger).map(c => c.uid);
      if (trigger === 'attack') result.push(...this.state.players[owner].hand.filter(c => CARDS[c.id].effect === 'kuriboh').map(c => c.uid));
      return result;
    }
    declareAttack({ uid, target = null }) {
      requireRule(this.state.phase === 'battle', '请先进入战斗阶段。');
      requireRule(!this.attackBlocked(this.state.active), '光之护封剑的效果仍在持续，无法攻击。');
      const { card, owner } = this.ownCard(uid, ['monsters']);
      requireRule(card.faceUp && card.position === 'attack' && !card.attacked, '请选择尚未攻击的攻击表示怪兽。');
      const targets = this.monsters(1 - owner);
      const targetUid = typeof target === 'string' ? target : target?.uid || null;
      requireRule(targetUid ? targets.some(c => c.uid === targetUid) : targets.length === 0, '需要先攻击对方场上的怪兽。');
      card.attacked = true;
      const targetCard = targets.find(c => c.uid === targetUid);
      this.log('attack', `${CARDS[card.id].name}${targetCard ? ' 攻击' + (targetCard.faceUp ? '「' + CARDS[targetCard.id].name + '」' : '里侧怪兽') : ' 发动直接攻击'}`, owner, { uid, target: targetUid, cardId: card.id });
      const pending = { kind: 'attack', owner, responder: 1 - owner, uid, target: targetUid, choices: this.reactions(1 - owner, 'attack') };
      if (pending.choices.length) this.state.pending = pending;
      else this.resolveBattle(pending);
    }
    respond({ uid = null }) {
      const pending = this.state.pending;
      requireRule(pending && ['attack', 'summon'].includes(pending.kind), '现在不是响应时机。');
      requireRule(uid === null || pending.choices.includes(uid), '无法使用这张卡响应。');
      this.state.pending = null;
      let preventDamage = false;
      if (uid) {
        const response = this.find(uid);
        requireRule(response && response.owner === pending.responder, '响应卡片已离场。');
        const def = CARDS[response.card.id];
        this.log('trap', `${this.name(pending.responder)}${def.effect === 'kuriboh' ? '丢弃' : '发动'}「${def.name}」`, pending.responder, { cardId: def.id, uid });
        this.toGrave(uid, '', false);
        const attacker = this.find(pending.uid)?.card;
        switch (def.effect) {
          case 'trap-hole': if (attacker) this.toGrave(attacker.uid, '落入陷阱'); return;
          case 'mirror-force': for (const card of [...this.monsters(pending.owner)]) if (card.position === 'attack') this.toGrave(card.uid, '被反射镜力破坏'); return;
          case 'magic-cylinder': if (attacker) this.damage(pending.owner, this.attackValue(attacker), '效果'); return;
          case 'negate-attack': this.state.phase = 'main2'; this.log('phase', '攻击被无效，战斗阶段结束', pending.owner); return;
          case 'kuriboh': preventDamage = true; break;
          default: throw new Error('Unimplemented response: ' + def.effect);
        }
      }
      if (pending.kind === 'attack') this.resolveBattle(pending, preventDamage);
    }
    resolveBattle(pending, preventDamage = false) {
      const attackFound = this.find(pending.uid);
      if (!attackFound || attackFound.zone !== 'monsters') return;
      const attacker = attackFound.card;
      this.events.push({ kind: 'battle', uid: pending.uid, target: pending.target, owner: pending.owner });
      const value = this.attackValue(attacker);
      const defenderOwner = 1 - pending.owner;
      const defendFound = pending.target ? this.find(pending.target) : null;
      if (!pending.target) {
        if (!preventDamage) this.damage(defenderOwner, value);
      } else if (defendFound && defendFound.zone === 'monsters') {
        const defender = defendFound.card;
        if (!defender.faceUp) { defender.faceUp = true; this.log('reveal', `盖放的怪兽是「${CARDS[defender.id].name}」`, defenderOwner, { cardId: defender.id, uid: defender.uid }); }
        const opposingValue = defender.position === 'defense' ? CARDS[defender.id].def : this.attackValue(defender);
        const diff = value - opposingValue;
        if (defender.position === 'attack') {
          if (diff > 0) { this.toGrave(defender.uid, '被战斗破坏'); if (!preventDamage) this.damage(defenderOwner, diff); }
          else if (diff < 0) { this.toGrave(attacker.uid, '被战斗破坏'); this.damage(pending.owner, -diff); }
          else if (value > 0) { this.toGrave(defender.uid, '被战斗破坏'); this.toGrave(attacker.uid, '被战斗破坏'); }
          else this.log('effect', '双方攻击力均为0，没有怪兽被破坏', pending.owner);
        } else {
          if (diff > 0) { this.toGrave(defender.uid, '被战斗破坏'); if (CARDS[attacker.id].effect === 'pierce' && !preventDamage) this.damage(defenderOwner, diff, '贯穿'); }
          else if (diff < 0) this.damage(pending.owner, -diff);
          else this.log('effect', '攻击与守备相等，没有怪兽被破坏', pending.owner);
        }
      }
      if (CARDS[attacker.id].effect === 'pierce' && this.find(attacker.uid)?.zone === 'monsters') {
        attacker.position = 'defense'; attacker.changedTurn = this.state.turn;
        this.log('stance', '长枪龙在攻击后变为守备表示', pending.owner, { uid: attacker.uid });
      }
    }
    changePhase(phase) {
      const current = this.state.phase;
      if (phase === 'end') { this.endTurn(); return; }
      requireRule((current === 'main1' && ['battle', 'main2'].includes(phase)) || (current === 'battle' && phase === 'main2'), '不能返回之前的阶段。');
      requireRule(!(phase === 'battle' && this.state.turn === 1), '先攻玩家的第1回合不能进入战斗阶段。');
      this.state.phase = phase;
      this.log('phase', phase === 'battle' ? '进入战斗阶段' : '进入主要阶段 2', this.state.active);
    }
    endTurn() {
      const amount = this.activePlayer.hand.length - 6;
      if (amount > 0) { this.state.pending = { kind: 'discard', owner: this.state.active, responder: this.state.active, count: amount }; return; }
      this.finishTurn();
    }
    discard({ uids }) {
      const pending = this.state.pending;
      requireRule(pending?.kind === 'discard', '不需要丢弃手牌。');
      requireRule(Array.isArray(uids) && new Set(uids).size === pending.count, `请丢弃${pending.count}张卡，使手牌回到6张。`);
      for (const uid of uids) this.ownCard(uid, ['hand']);
      for (const uid of uids) this.toGrave(uid, '因手牌上限而丢弃');
      this.state.pending = null;
      this.finishTurn();
    }
    finishTurn() {
      const ending = this.state.active;
      for (const card of [...this.spells(1 - ending)]) if (card.faceUp && CARDS[card.id].effect === 'swords') {
        card.turnsLeft--;
        if (card.turnsLeft <= 0) this.toGrave(card.uid, '持续时间结束，');
      }
      this.log('end', `${this.name(ending)}结束了回合`, ending);
      this.state.active = 1 - ending; this.state.turn++; this.state.phase = 'main1'; this.state.normalUsed = false;
      for (const card of this.monsters(this.state.active)) card.attacked = false;
      this.log('turn', `第 ${this.state.turn} 回合 · ${this.name(this.state.active)}的回合`, this.state.active);
      this.draw(this.state.active);
    }

    aiReaction(pending) {
      const choices = pending.choices.map(uid => this.find(uid)?.card).filter(Boolean);
      if (pending.kind === 'summon') return { type: 'respond', uid: choices[0]?.uid || null };
      const attacker = this.find(pending.uid)?.card;
      if (!attacker) return { type: 'respond', uid: null };
      const atk = this.attackValue(attacker);
      const byEffect = effect => choices.find(c => CARDS[c.id].effect === effect);
      const cylinder = byEffect('magic-cylinder');
      const mirror = byEffect('mirror-force');
      const negate = byEffect('negate-attack');
      const kuriboh = byEffect('kuriboh');
      if (cylinder && (atk >= this.state.players[pending.owner].lp || !mirror)) return { type: 'respond', uid: cylinder.uid };
      if (mirror && atk >= 1000) return { type: 'respond', uid: mirror.uid };
      if (cylinder) return { type: 'respond', uid: cylinder.uid };
      if (negate) return { type: 'respond', uid: negate.uid };
      const target = this.find(pending.target)?.card;
      const possibleDamage = target ? target.position === 'attack' ? Math.max(0, atk - this.attackValue(target)) : CARDS[attacker.id].effect === 'pierce' ? Math.max(0, atk - CARDS[target.id].def) : 0 : atk;
      if (kuriboh && possibleDamage >= Math.min(1000, this.state.players[pending.responder].lp)) return { type: 'respond', uid: kuriboh.uid };
      return { type: 'respond', uid: null };
    }
    aiNext() {
      const s = this.state;
      if (s.winner !== null) return null;
      if (s.pending) {
        if (s.pending.kind === 'discard') {
          const values = [...this.activePlayer.hand].sort((a, b) => this.cardUtility(a) - this.cardUtility(b));
          return { type: 'discard', uids: values.slice(0, s.pending.count).map(c => c.uid) };
        }
        return this.aiReaction(s.pending);
      }
      const owner = s.active, player = this.activePlayer;
      const enemy = this.monsters(1 - owner), mine = this.monsters(owner);
      const visibleValue = card => !card.faceUp ? 1500 : card.position === 'defense' ? CARDS[card.id].def : this.attackValue(card);
      if (s.phase === 'battle') {
        if (this.attackBlocked(owner)) return { type: 'phase', phase: 'main2' };
        const attackers = mine.filter(c => c.faceUp && c.position === 'attack' && !c.attacked).sort((a, b) => this.attackValue(b) - this.attackValue(a));
        for (const attacker of attackers) {
          if (!enemy.length) return { type: 'attack', uid: attacker.uid };
          const targets = enemy.filter(c => visibleValue(c) < this.attackValue(attacker) || (s.difficulty === 'casual' && visibleValue(c) === this.attackValue(attacker))).sort((a, b) => visibleValue(b) - visibleValue(a));
          if (targets.length) return { type: 'attack', uid: attacker.uid, target: targets[0].uid };
        }
        return { type: 'phase', phase: 'main2' };
      }
      if (!['main1', 'main2'].includes(s.phase)) return { type: 'end' };
      if (!s.normalUsed && player.monsters.includes(null)) {
        const earlyMage = player.hand.find(c => c.id === 'skilled-magician');
        if (earlyMage && this.spellCandidates().some(c => !CARDS[c.id].target || this.targetsFor(c).length)) return { type: 'summon', uid: earlyMage.uid, mode: 'attack' };
      }
      const spells = this.spellCandidates().filter(c => this.find(c.uid).zone === 'spells' || player.spells.includes(null));
      const spellFor = effect => spells.find(c => CARDS[c.id].effect === effect);
      const cast = (card, target) => ({ type: 'cast', uid: card.uid, ...(target ? { target: target.uid } : {}) });
      if (spellFor('draw2') && player.deck.length >= 2) return cast(spellFor('draw2'));
      const hostileBack = this.spells(1 - owner).sort((a, b) => Number(b.id === 'swords' && b.faceUp) - Number(a.id === 'swords' && a.faceUp));
      if (spellFor('mst') && hostileBack.length) return cast(spellFor('mst'), hostileBack[0]);
      const breaker = mine.find(c => c.faceUp && CARDS[c.id].effect === 'breaker' && c.counters > 0);
      if (breaker && hostileBack.length) return { type: 'effect', uid: breaker.uid, target: hostileBack[0].uid };
      if (spellFor('raigeki') && enemy.length) return cast(spellFor('raigeki'));
      if (spellFor('fissure') && enemy.length) return cast(spellFor('fissure'));
      const enemyPower = enemy.reduce((sum, c) => sum + visibleValue(c), 0);
      const ownPower = mine.reduce((sum, c) => sum + this.attackValue(c), 0);
      if (spellFor('dark-hole') && enemy.length && enemyPower > ownPower + 500) return cast(spellFor('dark-hole'));
      if (spellFor('heal') && player.lp <= 7000) return cast(spellFor('heal'));
      if (spellFor('fusion')) {
        const fusions = this.fusions(owner).sort((a, b) => CARDS[b.card.id].atk - CARDS[a.card.id].atk);
        if (fusions.length) return cast(spellFor('fusion'), fusions[0].card);
      }
      const thunder = player.hand.find(c => CARDS[c.id].effect === 'thunder-search');
      if (thunder && player.deck.some(c => c.id === 'thunder-dragon')) return { type: 'effect', uid: thunder.uid };
      if (spellFor('reborn') && player.monsters.includes(null)) {
        const targets = this.targetsFor(spellFor('reborn')).sort((a, b) => CARDS[b.card.id].atk - CARDS[a.card.id].atk);
        if (targets.length) return cast(spellFor('reborn'), targets[0]);
      }
      if (spellFor('ancient') && player.monsters.includes(null)) {
        const targets = this.targetsFor(spellFor('ancient')).sort((a, b) => CARDS[b.card.id].atk - CARDS[a.card.id].atk);
        if (targets.length) return cast(spellFor('ancient'), targets[0]);
      }
      const kaibaman = mine.find(c => c.faceUp && CARDS[c.id].effect === 'kaibaman');
      if (kaibaman && player.hand.some(c => c.id === 'blue-eyes')) return { type: 'effect', uid: kaibaman.uid };
      const skilled = mine.find(c => c.faceUp && CARDS[c.id].effect === 'skilled' && c.counters >= 3);
      if (skilled && [...player.hand, ...player.deck, ...player.grave].some(c => c.id === 'dark-magician')) return { type: 'effect', uid: skilled.uid };
      if (!s.normalUsed) {
        const monsters = player.hand.filter(c => CARDS[c.id].type === 'monster').sort((a, b) => {
          const score = c => CARDS[c.id].atk + (c.id === 'kaibaman' && player.hand.some(h => h.id === 'blue-eyes') ? 3000 : 0) + (c.id === 'skilled-magician' ? 120 : 0);
          return score(b) - score(a);
        });
        const sacrificial = [...mine].sort((a, b) => this.attackValue(a) - this.attackValue(b));
        for (const card of monsters) {
          const cost = this.tributeCount(card);
          if (cost > mine.length || (!cost && !player.monsters.includes(null))) continue;
          if (cost && sacrificial.slice(0, cost).reduce((sum, c) => sum + this.attackValue(c), 0) >= CARDS[card.id].atk + 300) continue;
          const strongestEnemy = Math.max(0, ...enemy.map(visibleValue));
          const def = CARDS[card.id];
          const mode = def.def > def.atk && strongestEnemy > def.atk ? 'defense' : 'attack';
          return { type: 'summon', uid: card.uid, mode, tributes: sacrificial.slice(0, cost).map(c => c.uid) };
        }
      }
      if (spellFor('swords') && !this.spells(owner).some(c => c.faceUp && c.id === 'swords') && enemy.length) return cast(spellFor('swords'));
      for (const card of mine) if (card.position === 'defense' && card.summonTurn < s.turn && card.changedTurn < s.turn && !card.attacked) {
        if (!enemy.length || enemy.some(e => this.attackValue(card) > visibleValue(e))) return { type: 'stance', uid: card.uid };
      }
      const trap = player.hand.find(c => CARDS[c.id].type === 'trap');
      if (trap && occupied(player.spells).length < (s.difficulty === 'casual' ? 2 : 4)) return { type: 'set', uid: trap.uid };
      if (s.phase === 'main1' && s.turn > 1 && mine.some(c => c.faceUp && c.position === 'attack') && !this.attackBlocked(owner)) return { type: 'phase', phase: 'battle' };
      return { type: 'end' };
    }
    cardUtility(card) {
      const def = CARDS[card.id];
      if (def.id === 'pot-of-greed') return 10000;
      if (def.type === 'trap') return 4000;
      if (def.type === 'spell') return this.targetsFor(card).length || !def.target ? 3500 : 500;
      return def.atk + (def.level <= 4 ? 2200 : 0) + (def.id === 'blue-eyes' && this.activePlayer.hand.some(c => c.id === 'ancient-rules') ? 3000 : 0);
    }
    snapshot() { return { state: clone(this.state), randomState: this.randomState }; }
    static restore(saved) {
      requireRule(saved && saved.state?.version === 1, '存档版本不兼容。');
      const game = Object.create(DuelEngine.prototype);
      game.state = clone(saved.state); game.randomState = saved.randomState >>> 0; game.events = []; game.onChange = () => {};
      game.assertState(); return game;
    }
    assertState() {
      const s = this.state;
      if (!s || s.version !== 1 || !Array.isArray(s.players) || s.players.length !== 2 || ![0, 1].includes(s.active) || !['main1', 'battle', 'main2'].includes(s.phase) || ![null, 0, 1].includes(s.winner) || !Number.isInteger(s.turn) || s.turn < 1) throw new Error('Invalid duel state');
      const uids = new Set();
      for (const p of s.players) {
        if (!DECKS[p.deckId] || !Number.isFinite(p.lp) || p.lp < 0 || p.monsters.length !== 5 || p.spells.length !== 5) throw new Error('Invalid player state');
        for (const zone of ['deck', 'hand', 'monsters', 'spells', 'grave', 'extra']) {
          if (!Array.isArray(p[zone]) || p[zone].length > 100) throw new Error('Invalid zone');
          for (const c of occupied(p[zone])) {
            if (!CARDS[c.id] || typeof c.uid !== 'string' || uids.has(c.uid)) throw new Error('Invalid or duplicate card');
            uids.add(c.uid);
            if (zone === 'monsters' && !isMonster(CARDS[c.id])) throw new Error('Non-monster in monster zone');
            if (zone === 'spells' && !['spell', 'trap'].includes(CARDS[c.id].type)) throw new Error('Non-spell in back row');
          }
        }
      }
      if (!Array.isArray(s.log) || s.log.length > 100) throw new Error('Invalid log');
      if (s.pending && !['summon', 'attack', 'discard'].includes(s.pending.kind)) throw new Error('Invalid pending action');
    }
  }
  root.DuelEngine = DuelEngine;
  root.DuelRuleError = RuleError;
  if (typeof module !== 'undefined' && module.exports) module.exports = { DuelEngine, RuleError };
})(typeof globalThis !== 'undefined' ? globalThis : this);
