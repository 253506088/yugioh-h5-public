(function () {
  'use strict';
  const { CARDS, CARD_LIST, DECKS, isMonster } = window.DuelData;
  const ART = window.DUEL_ART;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const icon = name => '<svg class="icon" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  const readStorage = (key, fallback) => { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
  const writeStorage = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const prefs = Object.assign({ sound: true, music: false, volume: .35, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, speed: 'normal' }, readStorage('duel-sanctuary-prefs-v1', {}));
  prefs.volume = Number.isFinite(Number(prefs.volume)) ? Math.max(0, Math.min(1, Number(prefs.volume))) : .35;
  const stats = Object.assign({ games: 0, wins: 0, bestDamage: 0, lastGame: '' }, readStorage('duel-sanctuary-stats-v1', {}));
  const sound = new window.DuelAudio(prefs);
  const modal = $('#modal');
  let engine, selectedUid = null, previewId = 'blue-eyes', previewHidden = false, intent = null;
  let aiTimer = null, aiEpoch = 0, modalKind = '', pendingKey = '', libraryQuery = '', libraryFilter = 'all';
  let setupOptions = { deck: 'blue', first: 1, difficulty: 'standard' }, selectionState = null, responseUid = null;
  let positionCache = new Map(), animationTimers = [], resultShown = false, cinematicTimer = null;
  let hoverId = null, savedAvailable = true;
  const phaseNames = { main1: '主要阶段 1', battle: '战斗阶段', main2: '主要阶段 2' };
  const difficultyNames = { casual: '休闲', standard: '标准' };
  document.documentElement.style.setProperty('--back-image', 'url("' + ART['card-back'] + '")');
  document.body.classList.toggle('reduce-motion', !!prefs.reducedMotion);

  function cardHTML(id, instance = null) {
    const c = CARDS[id];
    if (!c) return '';
    const monster = isMonster(c), effect = c.type === 'monster' && !!c.effect;
    const level = monster ? Array.from({ length: c.level }, () => '<span class="pc-star">★</span>').join('') : '<span class="pc-kind">【' + (c.type === 'trap' ? '陷阱卡' : '魔法卡') + '】</span>';
    const category = monster ? c.race + '／' + (c.type === 'fusion' ? '融合' : c.effect ? '效果' : '通常') : c.type === 'spell' ? c.effect === 'swords' ? '【 通常魔法 · 持续效果 】' : '【 通常魔法 】' : '【 陷阱卡 】';
    const index = CARD_LIST.findIndex(card => card.id === id) + 1;
    return '<div class="playing-card type-' + c.type + (effect ? ' is-effect' : '') + '" aria-hidden="true">' +
      '<div class="pc-heading"><span class="pc-name' + (c.name.length > 7 ? ' long' : '') + '">' + escape(c.name) + '</span><span class="pc-attribute ' + (c.attribute === '暗' ? 'dark' : c.attribute === '风' ? 'wind' : c.attribute === '地' ? 'earth' : '') + '">' + c.attribute + '</span></div>' +
      '<div class="pc-stars"' + (c.level > 8 ? ' style="gap:1%;font-size:5cqw"' : '') + '>' + level + '</div>' +
      '<img class="pc-art" src="' + ART[c.art] + '" alt="" draggable="false">' +
      '<div class="pc-serial"><span>DUEL SANCTUARY</span><span>DS–' + String(index).padStart(3, '0') + '</span></div>' +
      '<div class="pc-textbox"><div class="pc-race">' + category + '</div><p class="pc-description">' + escape(c.description) + '</p>' +
      (monster ? '<div class="pc-values"><span><small>ATK/</small> ' + c.atk + '</span><span><small>DEF/</small> ' + c.def + '</span></div>' : '') + '</div>' +
      '<div class="pc-foot"><span>LIMITED DUEL EDITION</span><b></b></div></div>';
  }
  function detailsHTML(id, instance = null) {
    const c = CARDS[id], monster = isMonster(c);
    return '<h2 class="card-name">' + escape(c.name) + '</h2><div class="card-en">' + c.en + '</div>' +
      '<div class="card-tags">' + (monster ? '<span class="card-tag gold">' + c.attribute + '属性</span><span class="card-tag">' + c.race + '</span><span class="card-tag">' + c.level + ' 星 · ' + (c.type === 'fusion' ? '融合' : c.effect ? '效果' : '通常') + '</span>' : '<span class="card-tag gold">' + (c.type === 'spell' ? '魔法卡' : '陷阱卡') + '</span><span class="card-tag">' + (c.type === 'spell' ? '主要阶段发动' : c.trigger === 'summon' ? '召唤时响应' : '攻击时响应') + '</span>') + '</div>' +
      (monster ? '<div class="preview-stats"><div><small>ATK</small><b>' + (instance ? engine.attackValue(instance) : c.atk) + '</b></div><div><small>DEF</small><b>' + c.def + '</b></div></div>' : '<div style="height:12px"></div>') +
      '<p class="card-description' + (!c.effect ? ' flavor' : '') + '">' + escape(c.description) + '</p>';
  }
  function renderInspector() {
    if (previewHidden) {
      $('#card-preview').innerHTML = '<img src="' + ART['card-back'] + '" alt="对方的里侧卡牌" style="width:100%;border-radius:6px;transform:rotate(-2deg)">';
      $('#card-information').innerHTML = '<h2 class="card-name">未知的卡牌</h2><div class="card-en">FACE-DOWN CARD</div><div class="card-tags"><span class="card-tag">里侧表示</span></div><p class="card-description" style="margin-top:15px">对方盖放的卡牌。发动或翻开后，才能查看这张卡的身份。仔细观察，谨慎出击。</p>';
      $('#context-actions').innerHTML = '<span class="context-status">相信直觉，也相信你的卡组。</span>';
      return;
    }
    const selected = selectedUid ? engine.find(selectedUid) : null;
    const instance = selected?.card.id === previewId ? selected.card : null;
    $('#card-preview').innerHTML = cardHTML(previewId, instance);
    $('#card-information').innerHTML = detailsHTML(previewId, instance);
    $('#context-actions').innerHTML = '<button class="mini-action" data-action="inspect-full">' + icon('search') + '查看完整卡面</button>';
  }
  function avatarBar(owner) {
    const p = engine.state.players[owner], deck = DECKS[p.deckId], s = engine.state;
    const enemyHand = owner === 1 ? '<div class="enemy-hand" aria-label="对方有' + p.hand.length + '张手牌">' + Array.from({ length: Math.min(p.hand.length, 8) }, (_, i) => '<span class="enemy-card" style="--angle:' + ((i - Math.min(p.hand.length, 8) / 2) * 5) + 'deg"></span>').join('') + '<small>' + p.hand.length + '</small></div>' : '<div class="normal-counter' + (s.active !== 0 || s.normalUsed ? ' used' : '') + '"><span class="counter-gem"></span>通常召唤 ' + (s.active === 0 && !s.normalUsed ? '1 / 1' : '0 / 1') + '</div>';
    return '<div class="avatar-frame"><img src="' + ART[deck.avatar] + '" alt="' + deck.player + '"></div><div class="duelist-info"><div class="duelist-name">' + deck.player + '</div><div class="duelist-sub">' + (owner === 0 ? '<span class="you-tag">YOU</span>' : '<span>AI · ' + difficultyNames[s.difficulty] + '</span>') + '<span>' + (owner === 0 ? '青睐命运的决斗者' : deck.name) + '</span></div></div>' +
      '<div class="lp-section' + (p.lp <= 2000 ? ' critical' : '') + '" id="lp-' + owner + '"><div class="lp-heading"><span>LIFE POINTS</span><b>' + p.lp.toLocaleString('en-US') + '</b></div><div class="lp-track"><div class="lp-fill" style="width:' + Math.min(100, p.lp / 80) + '%"></div></div></div>' + enemyHand;
  }
  function fieldCard(card, owner, zone, index) {
    const hidden = !card.faceUp && owner === 1;
    const c = CARDS[card.id], monster = zone === 'monsters';
    const shown = card.faceUp || owner === 0;
    const attacking = monster && owner === 0 && card.faceUp && card.position === 'attack' && !card.attacked && engine.state.active === 0 && engine.state.phase === 'battle' && !engine.state.pending && !engine.attackBlocked(0);
    const targeted = isTargetable(owner, zone, card);
    const tributeSelected = intent?.kind === 'tribute' && intent.selected.includes(card.uid);
    const face = !card.faceUp ? '<div class="card-back"' + (owner === 0 ? ' title="' + escape(c.name) + '（盖放）"' : '') + '></div>' : cardHTML(card.id, card);
    return '<button class="zone has-card' + (selectedUid === card.uid ? ' selected' : '') + (attacking ? ' attack-ready' : '') + (targeted ? ' targetable' : '') + (tributeSelected ? ' tribute-selected' : '') + '" data-action="select-card" data-card-uid="' + card.uid + '" data-owner="' + owner + '" data-zone="' + zone + '" data-slot="' + index + '" aria-label="' + (owner === 0 ? '你的' : '对方的') + (hidden ? '里侧卡牌' : escape(c.name) + (monster ? '，' + (card.position === 'attack' ? '攻击力' + engine.attackValue(card) : '守备力' + c.def) : '')) + '">' +
      '<span class="field-card' + (monster && card.position === 'defense' ? ' defense' : '') + '">' + face +
      (monster && shown ? '<span class="field-stats' + (card.position === 'defense' ? ' defense' : '') + '"><em>' + (card.position === 'defense' ? 'DEF' : 'ATK') + '</em><span class="' + (engine.attackValue(card) > c.atk && card.position === 'attack' ? 'boost' : '') + '">' + (card.position === 'defense' ? c.def : engine.attackValue(card)) + '</span></span>' : '') +
      (monster && shown && card.counters > 0 ? '<span class="field-status" title="魔力指示物">✧' + card.counters + '</span>' : monster && card.attacked && owner === engine.state.active ? '<span class="field-status attacked" title="已攻击">✓</span>' : !monster && card.faceUp && card.turnsLeft > 0 ? '<span class="field-status" title="剩余回合">' + card.turnsLeft + '</span>' : '') + '</span></button>';
  }
  function renderZone(owner, zone) {
    return engine.state.players[owner][zone].map((card, index) => card ? fieldCard(card, owner, zone, index) : '<div class="zone" data-empty-owner="' + owner + '" data-empty-zone="' + zone + '" data-slot="' + index + '"><span class="zone-empty">' + icon(zone === 'monsters' ? 'swords' : 'spark') + '<small>' + (zone === 'monsters' ? 'MONSTER' : 'SPELL & TRAP') + '</small></span></div>').join('');
  }
  function pileHTML(owner, kind) {
    const p = engine.state.players[owner];
    if (kind === 'extra') return '<button class="extra-pile" data-action="pile" data-owner="' + owner + '" data-pile="extra" aria-label="' + (owner === 0 ? '你的' : '对方的') + '额外卡组">◇ 额外 <b>' + p.extra.length + '</b></button>';
    if (kind === 'grave') {
      const last = p.grave.at(-1);
      return '<button class="pile grave-pile" data-action="pile" data-owner="' + owner + '" data-pile="grave" aria-label="' + (owner === 0 ? '你的' : '对方的') + '墓地，' + p.grave.length + '张"><span class="pile-card">' + (last ? '<img src="' + ART[CARDS[last.id].art] + '" alt="">' : icon('grave')) + '<span class="pile-count">' + p.grave.length + '</span></span><span>墓地</span></button>';
    }
    return '<button class="pile" data-action="pile" data-owner="' + owner + '" data-pile="deck" aria-label="' + (owner === 0 ? '你的' : '对方的') + '卡组，剩余' + p.deck.length + '张"><span class="pile-card"><span class="pile-count">' + p.deck.length + '</span></span><span>卡组</span></button>';
  }
  function renderPhases() {
    const s = engine.state, phases = [['draw', 'DRAW', '抽卡阶段'], ['standby', 'STANDBY', '准备阶段'], ['main1', 'MAIN 1', '主要阶段 1'], ['battle', 'BATTLE', '战斗阶段'], ['main2', 'MAIN 2', '主要阶段 2'], ['end', 'END', '结束回合']];
    const at = phases.findIndex(p => p[0] === s.phase);
    $('#phase-track').innerHTML = phases.map(([key, label, title], i) => {
      const available = s.active === 0 && s.winner === null && !s.pending && !intent && ((s.phase === 'main1' && ['battle', 'main2', 'end'].includes(key) && (key !== 'battle' || s.turn > 1)) || (s.phase === 'battle' && ['main2', 'end'].includes(key)) || (s.phase === 'main2' && key === 'end'));
      return (i ? '<span class="phase-dot">·</span>' : '') + '<button class="phase-step' + (key === s.phase ? ' active' : i < at ? ' done' : '') + '" data-action="phase" data-phase="' + key + '" title="' + title + '" aria-label="' + title + '"' + (!available ? ' disabled' : '') + '>' + label + '</button>';
    }).join('');
  }
  function canUseSpell(card, owner = 0) {
    const c = CARDS[card.id], p = engine.state.players[owner], found = engine.find(card.uid);
    if (c.type !== 'spell') return false;
    if (found?.zone === 'spells' && card.faceUp) return false;
    if (found?.zone === 'hand' && !p.spells.includes(null)) return false;
    if (c.target && !engine.targetsFor(card, owner).length) return false;
    if (['reborn', 'ancient'].includes(c.effect) && !p.monsters.includes(null)) return false;
    if (['raigeki', 'fissure'].includes(c.effect) && !engine.monsters(1 - owner).length) return false;
    if (c.effect === 'dark-hole' && !engine.monsters(0).length && !engine.monsters(1).length) return false;
    return true;
  }
  function actionOptions(found) {
    if (!found) return { actions: [], note: '' };
    const { card, owner, zone } = found, c = CARDS[card.id], s = engine.state, actions = [];
    if (s.winner !== null) return { actions, note: '本场决斗已结束，可以开始新的决斗。' };
    if (owner !== 0) return { actions, note: '对方的卡牌。观察效果，规划你的下一步。' };
    if (s.active !== 0 || s.pending) return { actions, note: '等待对方完成行动。' };
    const main = ['main1', 'main2'].includes(s.phase);
    if (zone === 'hand' && main) {
      if (c.type === 'monster') {
        const cost = engine.tributeCount(card);
        if (!s.normalUsed && engine.monsters(0).length >= cost && (engine.state.players[0].monsters.includes(null) || cost > 0)) {
          actions.push({ command: 'summon-attack', label: cost ? '上级召唤 · ' + cost + '只祭品' : '攻击表示召唤', icon: 'swords', primary: true });
          actions.push({ command: 'summon-defense', label: cost ? '解放并盖放 · ' + cost + '只祭品' : '里侧守备盖放', icon: 'shield' });
        }
        if (c.effect === 'thunder-search' && engine.state.players[0].deck.some(m => m.id === 'thunder-dragon')) actions.push({ command: 'effect', label: '丢弃并检索雷龙', icon: 'spark', primary: true });
        return { actions, note: actions.length ? '' : s.normalUsed ? '本回合已使用通常召唤。仍可使用特殊召唤效果。' : cost > engine.monsters(0).length ? '这张卡需要' + cost + '只场上怪兽作为祭品。' : '怪兽区域已满。' };
      }
      if (c.type === 'spell' && canUseSpell(card)) actions.push({ command: 'cast', label: c.effect === 'fusion' ? '发动融合召唤' : '发动魔法', icon: 'spark', primary: true });
      if (engine.state.players[0].spells.includes(null)) actions.push({ command: 'set', label: '盖放到场上', icon: 'card', primary: c.type === 'trap' });
      return { actions, note: c.type === 'trap' ? '盖放后，从下个回合起可在对应时机发动。' : c.target && !engine.targetsFor(card).length ? '当前没有可用目标，可以先盖放此卡。' : '' };
    }
    if (zone === 'monsters') {
      if (main) {
        if (card.faceUp) {
          if (c.effect === 'kaibaman' && engine.state.players[0].hand.some(m => m.id === 'blue-eyes')) actions.push({ command: 'effect', label: '解放 · 召唤青眼白龙', icon: 'spark', primary: true });
          if (c.effect === 'skilled' && card.counters >= 3 && ['hand', 'deck', 'grave'].some(z => engine.state.players[0][z].some(m => m.id === 'dark-magician'))) actions.push({ command: 'effect', label: '解放 · 召唤黑魔术师', icon: 'spark', primary: true });
          if (c.effect === 'breaker' && card.counters > 0 && engine.targetsFor(card).length) actions.push({ command: 'effect', label: '移除指示物 · 破坏卡牌', icon: 'bolt', primary: true });
        }
        if (card.summonTurn < s.turn && card.changedTurn < s.turn && !card.attacked) actions.push({ command: 'stance', label: !card.faceUp ? '反转召唤' : card.position === 'attack' ? '变为守备表示' : '变为攻击表示', icon: card.position === 'attack' ? 'shield' : 'swords' });
        return { actions, note: !actions.length ? !card.faceUp || card.summonTurn === s.turn ? '召唤／盖放当回合不能主动变更表示。' : '进入战斗阶段后，可以选择怪兽发起攻击。' : '' };
      }
      if (s.phase === 'battle' && card.faceUp && card.position === 'attack' && !card.attacked && !engine.attackBlocked(0)) actions.push({ command: 'attack', label: engine.monsters(1).length ? '选择攻击目标' : '直接攻击对方', icon: 'swords', primary: true });
      return { actions, note: actions.length ? '' : engine.attackBlocked(0) ? '光之护封剑生效中，暂时不能攻击。' : card.attacked ? '这只怪兽本回合已经攻击过了。' : '守备或里侧表示的怪兽不能攻击。' };
    }
    if (zone === 'spells') {
      if (c.type === 'spell' && main && canUseSpell(card)) actions.push({ command: 'cast', label: '发动魔法', icon: 'spark', primary: true });
      return { actions, note: c.type === 'trap' ? '陷阱将在' + (c.trigger === 'summon' ? '对手通常召唤时' : '对手攻击宣言时') + '提示发动。' : card.faceUp && c.effect === 'swords' ? '剩余持续时间：对方的' + card.turnsLeft + '个回合。' : '' };
    }
    return { actions, note: zone === 'hand' && !main ? '手牌中的卡片通常需要在主要阶段使用。' : '这张卡当前没有可进行的操作。' };
  }
  function renderHand() {
    const hand = engine.state.players[0].hand, s = engine.state;
    $('#hand-count').textContent = hand.length;
    $('#hand-hint').textContent = s.winner !== null ? '决斗结束 · 每一张卡都有它的故事' : intent ? '按提示完成选择 · Esc 取消' : s.active === 0 ? '点击卡牌，开启你的战术' : '对方正在行动 · 你可以查看卡牌';
    $('#hand-cards').innerHTML = hand.map((card, index) => {
      const mid = (hand.length - 1) / 2, angle = (index - mid) * Math.min(3.1, 16 / Math.max(1, mid * 2)), lift = Math.abs(index - mid) ** 1.55 * (hand.length > 7 ? .65 : 1.9);
      const options = actionOptions(engine.find(card.uid)), playable = options.actions.length > 0;
      return '<button class="hand-slot' + (selectedUid === card.uid ? ' selected' : '') + (!playable && s.active === 0 ? ' not-playable' : '') + '" style="--angle:' + angle.toFixed(2) + 'deg;--lift:' + lift.toFixed(2) + 'px;--order:' + (index + 1) + '" data-action="select-card" data-card-uid="' + card.uid + '" data-owner="0" data-zone="hand" aria-label="' + escape(CARDS[card.id].name) + '，' + (playable ? options.actions[0].label : '查看卡牌') + '">' + cardHTML(card.id, card) + (playable ? '<span class="playable-dot"></span><span class="hand-card-hint">' + options.actions[0].label + '</span>' : '') + '</button>';
    }).join('');
  }
  function nextPhaseInfo() {
    const s = engine.state;
    if (s.winner !== null) return { label: '再来一场决斗', action: 'new-game', phase: null };
    if (s.active !== 0) return { label: s.pending?.responder === 0 ? '等待你的响应' : '对方思考中…', disabled: true };
    if (s.phase === 'main1') {
      if (s.turn === 1) return { label: '结束先攻回合', action: 'end', phase: null };
      return engine.attackBlocked(0) ? { label: '进入主要阶段 2', action: 'phase', phase: 'main2' } : { label: '进入战斗阶段', action: 'phase', phase: 'battle' };
    }
    if (s.phase === 'battle') return { label: '进入主要阶段 2', action: 'phase', phase: 'main2' };
    return { label: '结束我的回合', action: 'end', phase: null };
  }
  function renderControls() {
    const s = engine.state, mine = s.active === 0, next = nextPhaseInfo();
    const description = s.winner !== null ? '整理你的卡组，准备迎接下一次挑战。' : s.pending ? s.pending.responder === 0 ? '一个新的时机出现了。选择你的响应。' : '对方正在决定是否响应你的行动。' : mine ? s.phase === 'battle' ? engine.attackBlocked(0) ? '光之护封剑正在生效，先寻找破解方法。' : '选择攻击表示的怪兽，然后点击攻击目标。' : s.phase === 'main2' ? '调整表示，布置后场，为下一回合做好准备。' : s.turn === 1 ? '先攻回合不能攻击。召唤怪兽，布置你的战术。' : '召唤怪兽，发动魔法，<br>让你的战术从这里展开。' : '对方正在展开战术，<br>留意每一次召唤与盖放。';
    $('#turn-panel').innerHTML = '<div class="turn-label' + (!mine ? ' ai' : '') + '"><i></i>' + (s.winner !== null ? 'DUEL COMPLETE' : mine ? 'YOUR TURN' : 'OPPONENT TURN') + '</div><div class="turn-number">' + String(s.turn).padStart(2, '0') + '</div><h2 class="turn-phase">' + (s.winner !== null ? s.winner === 0 ? '决斗胜利' : '决斗结束' : phaseNames[s.phase]) + '</h2><p class="turn-description">' + description + '</p>' +
      '<div class="summon-allowance">' + icon('clock') + '第 ' + String(s.turn).padStart(2, '0') + ' 回合 <b>' + (s.winner !== null ? '已完成' : mine ? '我的回合' : '对手回合') + '</b></div>' +
      '<button class="primary-button" data-action="' + (next.action || 'none') + '"' + (next.phase ? ' data-phase="' + next.phase + '"' : '') + (next.disabled || (s.pending && s.winner === null) || intent ? ' disabled' : '') + '>' + next.label + icon(s.winner !== null ? 'refresh' : 'arrow') + '</button>' +
      '<button class="secondary-button" data-action="' + (s.winner !== null ? 'result' : mine && s.phase !== 'main2' && s.turn > 1 ? 'end' : 'help') + '"' + ((s.pending || intent) && mine ? ' disabled' : '') + '>' + (s.winner !== null ? '查看决斗结果' : mine && s.phase !== 'main2' && s.turn > 1 ? '结束回合' : '查看玩法指南') + '</button>' +
      '<div class="keyboard-hint"><kbd>Space</kbd>切换阶段 <span>·</span> <kbd>E</kbd>结束回合</div>';
    $('#mobile-turn-control').innerHTML = '<div class="mobile-turn-copy"><small>' + (s.winner !== null ? 'DUEL COMPLETE' : mine ? 'YOUR TURN · ' + String(s.turn).padStart(2, '0') : 'OPPONENT TURN') + '</small><b>' + (s.winner !== null ? '决斗已结束' : phaseNames[s.phase]) + '</b></div><button class="primary-button" data-action="' + (next.action || 'none') + '"' + (next.phase ? ' data-phase="' + next.phase + '"' : '') + (next.disabled || (s.pending && s.winner === null) || intent ? ' disabled' : '') + '>' + next.label + icon('arrow') + '</button><button class="mobile-end-button" data-action="' + (mine && s.winner === null && s.turn > 1 ? 'end' : 'help') + '"' + ((s.pending || intent) && mine ? ' disabled' : '') + '>' + (mine && s.winner === null && s.turn > 1 ? '结束' : icon('help')) + '</button>';
    $('#duel-tip').textContent = s.phase === 'battle' ? '攻击守备怪兽时，通常不会造成生命值伤害。小心对手盖放的陷阱。' : s.normalUsed ? '通常召唤已用完？特殊召唤不受这个限制，试试海马侠、死者苏生或融合。' : '5—6星怪兽需要1只祭品，7星以上需要2只。特殊召唤不需要祭品。';
  }
  function logHTML(item, full = false) {
    const tag = item.owner !== null && !['turn', 'system', 'victory'].includes(item.kind) ? '<span class="event-owner' + (item.owner === 1 ? ' opponent' : '') + '">' + (item.owner === 0 ? '你' : '对手') + '</span>' : '';
    return '<div class="log-entry ' + escape(item.kind) + '">' + tag + escape(item.text) + (full || item.kind !== 'turn' ? '<small class="log-time">TURN ' + String(item.turn).padStart(2, '0') + ' · ' + String(item.n).padStart(3, '0') + '</small>' : '') + '</div>';
  }
  function renderTargetInstruction() {
    const el = $('#target-instruction');
    el.hidden = !intent;
    if (!intent) return;
    let text = '', confirm = '';
    if (intent.kind === 'tribute') { text = '选择 ' + intent.count + ' 只己方怪兽作为祭品（' + intent.selected.length + ' / ' + intent.count + '）'; confirm = '<button data-action="confirm-tribute"' + (intent.selected.length !== intent.count ? ' disabled' : '') + '>确认召唤</button>'; }
    if (intent.kind === 'attack') text = '选择一只对方怪兽，宣言攻击';
    if (intent.kind === 'target') text = '选择场上的一张魔法或陷阱卡，将其破坏';
    el.innerHTML = icon(intent.kind === 'attack' ? 'swords' : 'spark') + '<span>' + text + '</span>' + confirm + '<button data-action="cancel-intent">取消</button>';
  }
  function isTargetable(owner, zone, card) {
    if (!intent) return false;
    if (intent.kind === 'attack') return owner === 1 && zone === 'monsters';
    if (intent.kind === 'tribute') return owner === 0 && zone === 'monsters';
    if (intent.kind === 'target') return zone === 'spells' && card.uid !== intent.uid;
    return false;
  }
  function render() {
    const s = engine.state, deck = DECKS[s.players[0].deckId], rival = DECKS[s.players[1].deckId];
    $('#opponent-bar').innerHTML = avatarBar(1); $('#player-bar').innerHTML = avatarBar(0);
    $('#opponent-spells').innerHTML = renderZone(1, 'spells'); $('#opponent-monsters').innerHTML = renderZone(1, 'monsters');
    $('#player-monsters').innerHTML = renderZone(0, 'monsters'); $('#player-spells').innerHTML = renderZone(0, 'spells');
    $('#left-rail').innerHTML = '<div class="rail-pile-group">' + pileHTML(1, 'deck') + pileHTML(1, 'extra') + '</div><div class="rail-divider">DUEL FIELD</div>' + pileHTML(0, 'grave');
    $('#right-rail').innerHTML = pileHTML(1, 'grave') + '<div class="rail-divider">SANCTUARY</div><div class="rail-pile-group">' + pileHTML(0, 'deck') + pileHTML(0, 'extra') + '</div>';
    renderPhases(); renderHand(); renderControls(); renderInspector(); renderTargetInstruction();
    $('#duel-log').innerHTML = s.log.slice(0, 18).map(item => logHTML(item)).join('');
    $('#match-label').innerHTML = deck.name + ' <b>VS</b> ' + rival.name;
    $('#deck-summary').innerHTML = '<img src="' + ART[deck.ace] + '" alt=""><span><small>我的卡组</small><strong>' + deck.name + '</strong><span class="deck-count">40 张主卡组 · ' + DECKS[s.players[0].deckId].extra.length + ' 张额外卡组</span></span>' + icon('chevron');
    $('#character-quote').innerHTML = s.players[0].deckId === 'blue' ? '我的骄傲与灵魂，<br>青眼白龙！' : '相信卡组，<br>也相信我们的羁绊。';
    $('#quote-author').textContent = '— ' + deck.player;
    updateSoundButton();
  }
  function capturePositions() {
    positionCache = new Map();
    $$('[data-card-uid]').forEach(el => { const r = el.getBoundingClientRect(); positionCache.set(el.dataset.cardUid, { x: r.left + r.width / 2, y: r.top + r.height / 2 }); });
    for (const owner of [0, 1]) { const r = $('#lp-' + owner)?.getBoundingClientRect(); if (r) positionCache.set('lp-' + owner, { x: r.left + r.width / 2, y: r.top + r.height / 2 }); }
  }
  function showToast(message, error = false) {
    const el = document.createElement('div'); el.className = 'toast' + (error ? ' error' : '');
    el.innerHTML = icon(error ? 'help' : 'spark') + '<span>' + escape(message) + '</span>';
    $('#toast-stack').append(el);
    while ($('#toast-stack').children.length > 3) $('#toast-stack').firstElementChild.remove();
    setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 300); }, error ? 4000 : 3400);
  }
  function hidePopover() { $('#card-popover').hidden = true; }
  function clearIntent() { intent = null; hidePopover(); render(); }
  function dispatch(action) {
    capturePositions(); hidePopover();
    const result = engine.act(action);
    if (!result.ok) { showToast(result.error, true); render(); scheduleAI(); return false; }
    return true;
  }
  function chooseCard(uid, element) {
    sound.play('card');
    const found = engine.find(uid);
    if (!found) return;
    if (intent) {
      if (!isTargetable(found.owner, found.zone, found.card)) { showToast('请点击场上高亮的目标。'); return; }
      if (intent.kind === 'tribute') {
        if (intent.selected.includes(uid)) intent.selected = intent.selected.filter(id => id !== uid);
        else if (intent.selected.length < intent.count) intent.selected.push(uid);
        else { showToast('已选够祭品，点击「确认召唤」即可。'); return; }
        render(); return;
      }
      if (intent.kind === 'attack') { const action = { type: 'attack', uid: intent.uid, target: uid }; intent = null; dispatch(action); return; }
      if (intent.kind === 'target') { const action = { type: intent.action, uid: intent.uid, target: uid }; intent = null; dispatch(action); return; }
    }
    selectedUid = uid; previewHidden = found.owner === 1 && !found.card.faceUp; previewId = previewHidden ? previewId : found.card.id;
    renderInspector(); $$('.hand-slot.selected,.zone.selected').forEach(el => el.classList.remove('selected'));
    const liveElement = $('[data-card-uid="' + uid + '"]');
    if (liveElement) liveElement.classList.add('selected');
    if (previewHidden) { hidePopover(); showToast('对方的里侧卡牌尚未公开。'); return; }
    const { actions, note } = actionOptions(found), popover = $('#card-popover');
    popover.innerHTML = '<div class="popover-title">' + escape(CARDS[found.card.id].name) + '</div>' +
      actions.map(a => '<button class="' + (a.primary ? 'primary-choice' : '') + '" data-action="card-command" data-command="' + a.command + '" data-uid="' + uid + '">' + icon(a.icon) + a.label + '</button>').join('') +
      (note ? '<div class="popover-note">' + escape(note) + '</div>' : '') +
      '<button data-action="card-detail" data-card-id="' + found.card.id + '">' + icon('search') + '查看卡牌详情<span class="shortcut">↗</span></button>';
    popover.hidden = false;
    const anchor = (liveElement || element).getBoundingClientRect(), bounds = popover.getBoundingClientRect();
    const left = Math.max(12, Math.min(innerWidth - bounds.width - 12, anchor.left + anchor.width / 2 - bounds.width / 2));
    let top = anchor.top - bounds.height - 14;
    if (top < 78) top = Math.min(innerHeight - bounds.height - 16, anchor.bottom + 12);
    popover.style.left = left + 'px'; popover.style.top = Math.max(12, top) + 'px';
  }
  function cardCommand(command, uid) {
    const found = engine.find(uid);
    if (!found || found.owner !== 0) return;
    const { card } = found;
    hidePopover();
    if (command === 'summon-attack' || command === 'summon-defense') {
      const count = engine.tributeCount(card), mode = command === 'summon-defense' ? 'defense' : 'attack';
      if (!count) { dispatch({ type: 'summon', uid, mode }); return; }
      intent = { kind: 'tribute', uid, count, mode, selected: [] }; render(); showToast('点击你场上的 ' + count + ' 只怪兽作为祭品。'); return;
    }
    if (command === 'set') { dispatch({ type: 'set', uid }); return; }
    if (command === 'stance') { dispatch({ type: 'stance', uid }); return; }
    if (command === 'attack') {
      if (!engine.monsters(1).length) { dispatch({ type: 'attack', uid }); return; }
      intent = { kind: 'attack', uid }; render(); return;
    }
    if (command === 'cast' || command === 'effect') {
      const def = CARDS[card.id];
      if (def.target === 'backrow' || def.effect === 'breaker') { intent = { kind: 'target', action: command === 'cast' ? 'cast' : 'effect', uid }; render(); return; }
      if (def.target) { openTargetSelection(card); return; }
      dispatch({ type: command, uid });
    }
  }
  function saveGame() {
    savedAvailable = writeStorage('duel-sanctuary-save-v1', { ...engine.snapshot(), savedAt: Date.now() });
    $('#save-status').innerHTML = '<i></i>' + (savedAvailable ? '进度自动保存' : '当前浏览器未开放本地存档');
  }
  function scheduleAI() {
    clearTimeout(aiTimer);
    if (!engine || modal.open || engine.state.winner !== null || intent) return;
    const s = engine.state;
    if (s.pending && s.pending.responder === 0) { showPending(); return; }
    if (s.active !== 1 && !(s.pending && s.pending.responder === 1)) return;
    const token = aiEpoch;
    aiTimer = setTimeout(() => {
      if (token !== aiEpoch || modal.open || engine.state.winner !== null) return;
      const action = engine.aiNext();
      if (!action) return;
      const result = dispatch(action);
      if (!result) { showToast('对方调整了战术。'); if (!engine.state.pending && engine.state.active === 1) dispatch({ type: 'end' }); }
    }, prefs.speed === 'fast' ? 340 : s.pending ? 1150 : 850);
  }
  function bindEngine() {
    engine.onChange = events => {
      if (selectedUid && !engine.find(selectedUid)) selectedUid = null;
      for (const event of events) if (event.owner === 0 && event.kind === 'special' && event.cardId) { selectedUid = event.uid; previewId = event.cardId; previewHidden = false; }
      render(); saveGame(); playEvents(events);
      if (engine.state.winner !== null) { finishGame(); return; }
      if (!engine.state.pending) pendingKey = '';
      scheduleAI();
    };
  }
  function startGame(options = {}, instantOpening = false) {
    aiEpoch++; clearTimeout(aiTimer); clearTimeout(cinematicTimer);
    for (const timer of animationTimers) clearTimeout(timer); animationTimers = [];
    $('#cinematic').classList.remove('visible'); $('#fx-layer').innerHTML = '';
    $('#toast-stack').innerHTML = '';
    modalKind = ''; if (modal.open) modal.close(); hidePopover();
    intent = null; selectedUid = null; previewHidden = false; pendingKey = ''; resultShown = false;
    engine = new window.DuelEngine(options); previewId = DECKS[engine.state.players[0].deckId].ace;
    if (instantOpening && engine.state.active === 1) {
      let steps = 0;
      while (engine.state.active === 1 && engine.state.winner === null && steps++ < 35 && !(engine.state.pending && engine.state.pending.responder === 0)) {
        const action = engine.aiNext(); if (!action || !engine.act(action).ok) break;
      }
    }
    bindEngine(); render(); saveGame(); scheduleAI();
    if (!instantOpening) { sound.play('phase'); showToast(engine.state.active === 0 ? '决斗开始。你的先攻回合不能攻击。' : '决斗开始，对方先攻。'); }
  }

  function openModal(kind, title, kicker, body, footer = '', className = '') {
    clearTimeout(aiTimer); hidePopover();
    modalKind = kind;
    modal.className = 'modal ' + className;
    modal.innerHTML = '<header class="modal-header"><div><div class="eyebrow">' + kicker + '</div><h2 id="modal-title">' + title + '</h2></div><button class="modal-close" data-action="close-modal" aria-label="关闭窗口">' + icon('close') + '</button></header><div class="modal-body">' + body + '</div>' + (footer ? '<footer class="modal-footer">' + footer + '</footer>' : '');
    if (!modal.open) modal.showModal();
  }
  function dismissModal() {
    modalKind = ''; selectionState = null; responseUid = null; pendingKey = '';
    if (modal.open) modal.close();
  }
  function closeModal() {
    if (modalKind === 'discard') { showToast('请先选择要丢弃的手牌，完成回合结算。'); return; }
    if (modalKind === 'response' && engine.state.pending) { dismissModal(); dispatch({ type: 'respond', uid: null }); return; }
    dismissModal(); scheduleAI();
    if (engine.state.winner !== null && !resultShown) showResult();
  }
  function showLibrary() {
    openModal('library', '每一张卡，都有它的灵魂。', 'THE CARD ARCHIVE', '<div class="library-toolbar"><div class="library-filters">' +
      [['all', '全部'], ['monster', '怪兽'], ['spell', '魔法'], ['trap', '陷阱'], ['fusion', '融合']].map(([id, label]) => '<button class="filter-button' + (libraryFilter === id ? ' active' : '') + '" data-action="library-filter" data-filter="' + id + '">' + label + '</button>').join('') +
      '</div><label class="search-box">' + icon('search') + '<input id="library-search" type="search" value="' + escape(libraryQuery) + '" placeholder="搜索卡名或英文名称" aria-label="搜索卡牌"></label></div><div class="library-grid" id="library-grid"></div><p class="library-count" id="library-count"></p>', '', 'library-modal');
    renderLibraryResults();
  }
  function renderLibraryResults() {
    const query = libraryQuery.trim().toLowerCase();
    const cards = CARD_LIST.filter(c => (libraryFilter === 'all' || c.type === libraryFilter) && (!query || (c.name + c.en + c.description).toLowerCase().includes(query)));
    $('#library-grid').innerHTML = cards.length ? cards.map(c => '<button class="library-card" data-action="card-detail" data-card-id="' + c.id + '" aria-label="查看' + escape(c.name) + '">' + cardHTML(c.id) + '<h3>' + escape(c.name) + '</h3><small>' + (isMonster(c) ? c.race + ' · ATK ' + c.atk : c.type === 'spell' ? '魔法卡' : '陷阱卡') + '</small></button>').join('') : '<div class="empty-state">没有找到这张卡，试试其他名称。</div>';
    $('#library-count').textContent = cards.length + ' / ' + CARD_LIST.length + ' 张经典卡牌 · 点击查看完整效果';
    $$('.library-filters .filter-button').forEach(el => el.classList.toggle('active', el.dataset.filter === libraryFilter));
  }
  function showCardDetail(id) {
    if (!CARDS[id]) return;
    const c = CARDS[id];
    openModal('detail', '卡牌详情', 'THE HEART OF A CARD', '<div class="card-detail-layout">' + cardHTML(id) + '<div>' + detailsHTML(id) + '<p class="card-detail-note">' + (c.type === 'fusion' ? '融合素材：' + c.materials.map(m => CARDS[m].name).join(' ＋ ') : isMonster(c) && c.level >= 5 ? '通常召唤需解放' + (c.level >= 7 ? '2' : '1') + '只怪兽。通过卡牌效果特殊召唤时，无需支付通常召唤的祭品。' : c.type === 'trap' ? '需要先盖放。不能在盖放的同一回合发动，满足触发条件时会出现响应窗口。' : '本作以这张卡展示的效果文字为执行规则。') + '</p></div></div>', '<button class="secondary-button" data-action="library">' + icon('book') + '浏览图鉴</button><button class="primary-button" data-action="close-modal">返回决斗</button>', 'card-detail-modal');
  }
  function showDeck(owner = 0) {
    const p = engine.state.players[owner], deck = DECKS[p.deckId], counts = new Map();
    deck.cards.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
    const content = '<p class="modal-lead">' + deck.description + '</p><p class="deck-list-heading">主卡组 <span style="color:#829974">/ 40 张 · 卡组构筑清单</span></p><div class="library-grid">' +
      [...counts].map(([id, count]) => '<button class="library-card" data-action="card-detail" data-card-id="' + id + '" aria-label="' + escape(CARDS[id].name) + '，' + count + '张"><span class="deck-card-count">×' + count + '</span>' + cardHTML(id) + '<h3>' + escape(CARDS[id].name) + '</h3></button>').join('') +
      '</div><p class="deck-list-heading" style="margin-top:30px">额外卡组 <span style="color:#829974">/ ' + deck.extra.length + ' 张</span></p><div class="library-grid">' + deck.extra.map(id => '<button class="library-card" data-action="card-detail" data-card-id="' + id + '">' + cardHTML(id) + '<h3>' + escape(CARDS[id].name) + '</h3></button>').join('') + '</div>';
    openModal('deck', deck.name, owner === 0 ? 'YOUR DECK · CONSTRUCTION' : 'OPPONENT DECK · CONSTRUCTION', content, '<button class="secondary-button" data-action="close-modal">返回决斗</button><button class="primary-button" data-action="new-game">选择新的卡组</button>', 'library-modal');
  }
  function showPile(owner, kind) {
    if (kind === 'deck') { showDeck(owner); return; }
    const p = engine.state.players[owner], cards = kind === 'grave' ? [...p.grave].reverse() : p.extra;
    const title = (owner === 0 ? '你的' : '对方的') + (kind === 'grave' ? '墓地' : '额外卡组');
    const body = '<p class="modal-lead">' + (kind === 'grave' ? '这里沉睡着' + cards.length + '张卡。只要羁绊还在，就仍有再次登场的可能。' : '满足素材条件后，发动「融合」来召唤这些怪兽。') + '</p><div class="selection-grid">' +
      (cards.length ? cards.map(c => '<button class="selection-card" data-action="card-detail" data-card-id="' + c.id + '">' + cardHTML(c.id) + '<small>' + escape(CARDS[c.id].name) + '</small></button>').join('') : '<div class="empty-state">这里暂时没有卡牌。</div>') + '</div>';
    openModal('pile', title, kind === 'grave' ? 'THE GRAVEYARD' : 'BEYOND THE ORDINARY', body, '<button class="primary-button" data-action="close-modal">返回决斗</button>', 'selection-modal');
  }
  function showNewGame() {
    setupOptions = { deck: engine?.state.players[0].deckId || 'blue', first: 1, difficulty: engine?.state.difficulty || 'standard' };
    renderNewGame();
  }
  function renderNewGame() {
    openModal('new-game', '选择你的命运。', 'A NEW DUEL BEGINS', '<p class="modal-lead">两种信念，两条胜利之路。选择与你并肩作战的卡组。</p><div class="deck-choices">' +
      Object.values(DECKS).map(deck => '<button class="deck-choice' + (setupOptions.deck === deck.id ? ' active' : '') + '" data-action="choose-deck" data-deck="' + deck.id + '"><img src="' + ART[deck.ace] + '" alt="' + CARDS[deck.ace].name + '"><span class="deck-check">' + (setupOptions.deck === deck.id ? icon('check') : '') + '</span><div class="deck-choice-content"><h3>' + deck.name + '</h3><div class="deck-en">' + deck.en + '</div><p>' + deck.description + '</p></div></button>').join('') +
      '</div><div class="setup-options"><div><label class="setting-label">对手难度</label><div class="segmented-control">' + [['casual', '休闲练习'], ['standard', '标准对决']].map(([id, label]) => '<button class="' + (setupOptions.difficulty === id ? 'active' : '') + '" data-action="choose-difficulty" data-value="' + id + '">' + label + '</button>').join('') + '</div></div><div><label class="setting-label">出场顺序</label><div class="segmented-control">' + [[0, '我先攻'], [1, '我后攻']].map(([id, label]) => '<button class="' + (setupOptions.first === id ? 'active' : '') + '" data-action="choose-first" data-value="' + id + '">' + label + '</button>').join('') + '</div></div></div>' +
      '<p class="new-game-note">8000 初始 LP · 40 张主卡组 · 双方起手至少1只4星以下怪兽<br>先攻首回合不抽卡、不能攻击。开始新的决斗会替换当前自动存档。</p>',
      '<button class="secondary-button" data-action="close-modal">继续当前对局</button><button class="primary-button" data-action="begin-game">开始决斗 ' + icon('arrow') + '</button>', 'new-game-modal');
  }
  function showHelp() {
    openModal('help', '相信卡组，开始决斗。', 'THE DUELIST’S HANDBOOK', '<p class="modal-lead">把对方的生命值降到 0，即可获胜。卡组耗尽、无法抽卡的一方也会败北。初始生命值为 8000，双方各抽5张手牌。</p>' +
      '<div class="help-steps"><div class="help-step">' + icon('card') + '<h3>01 · 召唤与布置</h3><p>点击手牌，选择召唤、盖放或发动魔法。先建立属于你的场面。</p></div><div class="help-step">' + icon('swords') + '<h3>02 · 宣言攻击</h3><p>进入战斗阶段，点击自己的攻击怪兽，再选对方怪兽为目标。</p></div><div class="help-step">' + icon('shield') + '<h3>03 · 回应与反击</h3><p>提前盖放陷阱。对方触发条件时，你可以选择发动或保留。</p></div></div>' +
      '<div class="help-section"><h3>召唤的基本规则</h3><table class="rules-table"><thead><tr><th>类型</th><th>条件与说明</th></tr></thead><tbody><tr><td>通常召唤 / 盖放</td><td>每回合合计1次。攻击表示召唤，或里侧守备盖放。</td></tr><tr><td>1—4星</td><td>不需要祭品。需要有空的怪兽区域。</td></tr><tr><td>5—6星 / 7星以上</td><td>分别需要1只 / 2只自己场上的怪兽作为祭品。</td></tr><tr><td>特殊召唤</td><td>按卡牌效果执行，不占用通常召唤次数。</td></tr><tr><td>融合召唤</td><td>发动「融合」，使用手牌或场上的指定素材，从额外卡组召唤。</td></tr></tbody></table></div>' +
      '<div class="help-section"><h3>战斗是怎样结算的？</h3><table class="rules-table"><thead><tr><th>交战表示</th><th>结算方式</th></tr></thead><tbody><tr><td>攻击 vs 攻击</td><td>攻击力较低的怪兽破坏，其控制者受到差值伤害。攻击力相等且大于0时双方破坏。</td></tr><tr><td>攻击 vs 守备</td><td>攻击力高则守备怪兽破坏，通常不扣 LP；攻击力低则攻击方受到差值伤害，双方不破坏。</td></tr><tr><td>直接攻击</td><td>对方场上没有怪兽时，可以造成等同攻击力的伤害。</td></tr><tr><td>攻击次数</td><td>每只攻击表示怪兽每回合1次。先攻第1回合不能攻击。</td></tr></tbody></table></div>' +
      '<div class="help-section"><h3>别忘了这些细节</h3><ul><li>盖放的陷阱不能在盖放的同一回合发动。符合条件时会出现响应窗口；每次宣言最多响应1张卡。</li><li>怪兽在召唤当回合、已经攻击后，不能主动变更表示。之后的主要阶段每回合可以变更1次。</li><li>光之护封剑会阻止对方的3个回合攻击。用旋风或魔导战士 破坏者可以解除它。</li><li>栗子球可在对方攻击宣言时从手牌丢弃；只免除这次战斗对你的伤害，不阻止怪兽被破坏。</li><li>结束回合时手牌上限为6张，超过需要自行选择丢弃。</li></ul></div>' +
      '<div class="help-section"><h3>让一套组合成为你的起点</h3><p>青眼卡组：召唤「海马侠」→ 点击场上的海马侠发动效果 → 解放它，从手牌特殊召唤「青眼白龙」。黑魔术卡组：召唤「熟练的黑魔术师」→ 每发动1张魔法积累1个指示物 → 积满3个，解放并召唤「黑魔术师」。</p></div>' +
      '<div class="help-section"><h3>键盘快捷操作</h3><p><kbd>Space</kbd> 进入下一阶段　<kbd>E</kbd> 结束回合　<kbd>1</kbd>—<kbd>9</kbd> 选择手牌<br><kbd>Esc</kbd> 取消目标选择 / 关闭窗口　<kbd>M</kbd> 音效　<kbd>F</kbd> 全屏</p></div>' +
      '<div class="help-section"><h3>关于这个决斗世界</h3><p>本作致敬高桥和希的《游戏王》，采用35种经典卡牌的独立精简规则。抽卡与准备阶段自动处理，使用单张卡牌响应，不使用禁限卡表，不包含自由连锁、同调、超量、灵摆和连接召唤。卡片所展示的文字即本作执行的效果规则。所有卡面为本地绘制的矢量演绎，音效由浏览器实时合成。</p></div>',
      '<button class="primary-button" data-action="close-modal">准备好了 ' + icon('swords') + '</button>');
  }
  function showSettings() {
    const toggle = (key, title, description) => '<div class="setting-row"><div><h3>' + title + '</h3><p>' + description + '</p></div><button class="toggle-button' + (prefs[key] ? ' on' : '') + '" data-action="toggle-pref" data-pref="' + key + '" role="switch" aria-checked="' + !!prefs[key] + '" aria-label="' + title + '"></button></div>';
    openModal('settings', '你的决斗，随你设定。', 'PERSONAL SANCTUARY',
      toggle('sound', '决斗音效', '抽卡、召唤与战斗的声音。') +
      '<div class="setting-row"><div><h3>音量 <span id="volume-label" style="color:#839a76;font-size:10px">' + Math.round(prefs.volume * 100) + '%</span></h3><p>一点声音，让决斗更有温度。</p></div><input class="volume-control" id="volume-control" type="range" min="0" max="100" value="' + Math.round(prefs.volume * 100) + '" aria-label="音量"></div>' +
      toggle('music', '氛围音乐', '缓慢的和弦，陪伴你的每次思考。') +
      toggle('reducedMotion', '减少动态效果', '关闭粒子、震动和过渡动画。') +
      '<div class="setting-row"><div><h3>对手行动速度</h3><p>选择适合自己的决斗节奏。</p></div><div class="segmented-control">' + [['normal', '沉浸'], ['fast', '快速']].map(([id, label]) => '<button class="' + (prefs.speed === id ? 'active' : '') + '" data-action="set-speed" data-value="' + id + '">' + label + '</button>').join('') + '</div></div>' +
      '<div class="settings-record"><div><b>' + stats.games + '</b><small>完成对局</small></div><div><b>' + stats.wins + '</b><small>取得胜利</small></div><div><b>' + (stats.games ? Math.round(stats.wins / stats.games * 100) : 0) + '%</b><small>决斗胜率</small></div></div>',
      '<button class="primary-button" data-action="close-modal">保存并返回</button>');
  }
  function openTargetSelection(card) {
    const c = CARDS[card.id], targets = engine.targetsFor(card, 0);
    if (!targets.length) { showToast('当前没有可选择的目标。', true); return; }
    selectionState = { kind: 'target', sourceUid: card.uid, targetType: c.target, targets, selected: [], count: 1 };
    renderSelection();
  }
  function renderSelection() {
    const selection = selectionState;
    if (!selection) return;
    const discarding = selection.kind === 'discard';
    const c = !discarding ? CARDS[engine.find(selection.sourceUid)?.card.id] : null;
    const titles = { 'grave-monster': '让羁绊，再一次苏醒。', 'hand-normal': '呼唤传说中的力量。', fusion: '交织灵魂，融合召唤。' };
    const title = discarding ? '选择要送入墓地的手牌。' : titles[selection.targetType] || '选择一张卡牌';
    const lead = discarding ? '回合结束时，手牌上限为6张。请选择' + selection.count + '张卡送入墓地（已选 ' + selection.selected.length + ' / ' + selection.count + '）。' : c.name + '：' + c.description;
    openModal(discarding ? 'discard' : 'target-selection', title, discarding ? 'END PHASE · HAND LIMIT' : 'ACTIVATE YOUR STRATEGY',
      '<p class="modal-lead" id="selection-lead">' + escape(lead) + '</p><div class="selection-grid">' + selection.targets.map(t => '<button class="selection-card' + (selection.selected.includes(t.uid) ? ' chosen' : '') + '" data-action="select-target" data-uid="' + t.uid + '">' + cardHTML(t.card.id) + '<small>' + escape(CARDS[t.card.id].name) + '</small><span>' + (discarding ? '手牌' : selection.targetType === 'grave-monster' ? t.owner === 0 ? '你的墓地' : '对方墓地' : selection.targetType === 'fusion' ? '素材 ' + t.materials.length + ' 张 · 可召唤' : '你的手牌') + '</span></button>').join('') + '</div>',
      (discarding ? '' : '<button class="secondary-button" data-action="close-modal">取消发动</button>') + '<button class="primary-button" id="selection-confirm" data-action="confirm-selection"' + (selection.selected.length !== selection.count ? ' disabled' : '') + '>' + (discarding ? '确认丢弃' : selection.targetType === 'fusion' ? '融合召唤' : '特殊召唤') + ' ' + icon('spark') + '</button>', 'selection-modal');
    // openModal intentionally does not clear this workflow's selection.
    selectionState = selection;
  }
  function showPending() {
    const p = engine.state.pending;
    if (!p || p.responder !== 0 || modal.open || engine.state.winner !== null) return;
    const key = p.kind + ':' + (p.uid || '') + ':' + engine.state.turn;
    if (pendingKey === key) return;
    pendingKey = key;
    if (p.kind === 'discard') {
      selectionState = { kind: 'discard', count: p.count, selected: [], targets: engine.state.players[0].hand.map(card => ({ card, uid: card.uid, owner: 0 })) };
      renderSelection(); return;
    }
    responseUid = null;
    const source = engine.find(p.uid)?.card, sourceName = source ? CARDS[source.id].name : '对方怪兽';
    const subject = p.kind === 'summon' ? '对方通常召唤了「' + sourceName + '」。' : '「' + sourceName + '」宣言' + (p.target ? '攻击。' : '直接攻击。');
    const responses = p.choices.map(uid => engine.find(uid)).filter(Boolean);
    openModal('response', '现在，轮到你的反击。', 'CHAIN RESPONSE · YOUR CHOICE',
      '<div class="response-callout">' + icon('bolt') + ' ' + escape(subject) + '<br><b>你可以发动1张卡响应，也可以保留到下个时机。</b></div><div class="selection-grid">' +
      responses.map(f => '<button class="selection-card" data-action="select-response" data-uid="' + f.card.uid + '" aria-label="选择发动' + escape(CARDS[f.card.id].name) + '">' + cardHTML(f.card.id) + '<small>' + escape(CARDS[f.card.id].name) + '</small><span>' + (f.zone === 'hand' ? '从手牌丢弃 · 免除战斗伤害' : '已盖放 · 可以发动') + '</span></button>').join('') + '</div>',
      '<button class="secondary-button" data-action="pass-response">暂不发动</button><button class="primary-button" id="response-confirm" data-action="confirm-response" disabled>发动这张卡 ' + icon('bolt') + '</button>', 'selection-modal response-modal');
  }
  function showLog() {
    openModal('log', '属于你的决斗轨迹。', 'EVERY CHOICE MATTERS', '<div class="log-modal-list">' + engine.state.log.map(item => logHTML(item, true)).join('') + '</div>', '<button class="secondary-button" data-action="export-log">' + icon('download') + '导出记录</button><button class="primary-button" data-action="close-modal">返回决斗</button>');
  }
  function finishGame() {
    const id = String(engine.state.startedAt) + '-' + engine.state.players[0].deckId;
    if (stats.lastGame !== id) {
      stats.games++; stats.wins += engine.state.winner === 0 ? 1 : 0; stats.bestDamage = Math.max(stats.bestDamage, engine.state.damage[0]); stats.lastGame = id;
      writeStorage('duel-sanctuary-stats-v1', stats);
    }
    const token = aiEpoch;
    animationTimers.push(setTimeout(() => { if (token === aiEpoch && !modal.open && !resultShown) showResult(); }, prefs.reducedMotion ? 100 : 1400));
  }
  function showResult() {
    if (engine.state.winner === null) return;
    clearTimeout(aiTimer); hidePopover(); resultShown = true; modalKind = 'result';
    const win = engine.state.winner === 0;
    modal.className = 'modal';
    modal.innerHTML = '<div class="duel-result' + (win ? '' : ' result-defeat') + '"><div class="result-emblem">' + icon(win ? 'eye' : 'shield') + '</div><div class="result-en">' + (win ? 'VICTORY IS YOURS' : 'THE DUEL GOES ON') + '</div><h2 id="modal-title">' + (win ? '决斗胜利' : '未完的决斗') + '</h2><p class="result-sub">' + (win ? '你与卡组的羁绊，回应了这场决斗。' : '命运不会止步于这一局。<br>下一次抽卡，也许就是转机。') + '<br><span style="font-size:9px;color:#738f6b">' + escape(engine.state.resultReason) + '</span></p><div class="result-stats"><div><b>' + engine.state.turn + '</b><small>决斗回合</small></div><div><b>' + engine.state.damage[0].toLocaleString('en-US') + '</b><small>造成伤害</small></div><div><b>' + engine.state.summons[0] + '</b><small>召唤次数</small></div></div><div class="result-actions"><button class="primary-button" data-action="rematch">' + icon('refresh') + '再来一场</button><button class="secondary-button" data-action="new-game">更换卡组</button></div><button class="result-close" data-action="close-modal">回到战场，查看记录</button></div>';
    if (!modal.open) modal.showModal();
  }

  function floatingNumber(owner, amount, heal = false) {
    if (prefs.reducedMotion) return;
    const el = document.createElement('div'), point = positionCache.get('lp-' + owner);
    if (!point) return;
    el.className = 'damage-float' + (heal ? ' heal' : ''); el.textContent = (heal ? '+' : '−') + amount.toLocaleString('en-US');
    el.style.left = point.x + 'px'; el.style.top = point.y + 'px'; $('#fx-layer').append(el);
    setTimeout(() => el.remove(), 1600);
  }
  function burstAt(point) {
    if (!point || prefs.reducedMotion) return;
    const ring = document.createElement('span'); ring.className = 'impact-ring'; ring.style.left = point.x + 'px'; ring.style.top = point.y + 'px'; $('#fx-layer').append(ring); setTimeout(() => ring.remove(), 650);
    for (let i = 0; i < 15; i++) {
      const particle = document.createElement('span'), angle = Math.PI * 2 * i / 15, distance = 25 + Math.random() * 50;
      particle.className = 'particle'; particle.style.left = point.x + 'px'; particle.style.top = point.y + 'px';
      particle.style.setProperty('--dx', Math.cos(angle) * distance + 'px'); particle.style.setProperty('--dy', Math.sin(angle) * distance + 'px');
      $('#fx-layer').append(particle); setTimeout(() => particle.remove(), 1100);
    }
  }
  function attackAnimation(event) {
    if (prefs.reducedMotion) return;
    const from = positionCache.get(event.uid), to = positionCache.get(event.target || 'lp-' + (1 - event.owner));
    if (!from || !to) return;
    const ray = document.createElement('div'), distance = Math.hypot(to.x - from.x, to.y - from.y), angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
    ray.className = 'battle-ray'; ray.style.left = from.x + 'px'; ray.style.top = from.y + 'px'; ray.style.width = distance + 'px'; ray.style.transform = 'rotate(' + angle + 'deg)';
    $('#fx-layer').append(ray); setTimeout(() => { burstAt(to); }, 210); setTimeout(() => ray.remove(), 650);
  }
  function announce(cardId, type) {
    if (prefs.reducedMotion || !cardId) return;
    const c = CARDS[cardId], el = $('#cinematic');
    clearTimeout(cinematicTimer); el.className = 'cinematic' + (type === 'trap' ? ' trap-cinematic' : '');
    el.innerHTML = '<div class="cinematic-content"><img src="' + ART[c.art] + '" alt=""><div><small>' + (type === 'trap' ? 'CHAIN 01 · TRAP ACTIVATED' : c.type === 'fusion' ? 'FUSION SUMMON' : 'SPECIAL SUMMON') + '</small><h3>' + escape(c.name) + '</h3><p>' + (isMonster(c) ? 'ATK ' + c.atk + '　/　DEF ' + c.def : '命运，在这一刻逆转') + '</p></div></div>';
    void el.offsetWidth; el.classList.add('visible');
    cinematicTimer = setTimeout(() => el.classList.remove('visible'), 2200);
  }
  function playEvents(events) {
    let playedDamage = false;
    for (const event of events) {
      if (event.kind === 'attack' && engine.state.pending?.kind === 'attack') sound.play('phase');
      if (event.kind === 'battle') { sound.play('attack'); attackAnimation(event); }
      if (event.kind === 'damage') {
        floatingNumber(event.owner, event.amount);
        if (!playedDamage) { sound.play('damage'); playedDamage = true; }
        if (!prefs.reducedMotion) { $('#arena').classList.remove('shaking'); void $('#arena').offsetWidth; $('#arena').classList.add('shaking'); setTimeout(() => $('#arena').classList.remove('shaking'), 420); }
      }
      if (event.kind === 'heal') { floatingNumber(event.owner, event.amount, true); sound.play('spell'); }
      if (event.kind === 'summon' || event.kind === 'special') {
        sound.play(event.kind === 'special' ? 'special' : 'summon');
        const el = $('[data-card-uid="' + event.uid + '"]'); if (el) el.classList.add('just-summoned');
        if (event.kind === 'special' && event.cardId) announce(event.cardId, 'special');
      }
      if (event.kind === 'set') sound.play('card');
      if (event.kind === 'spell') sound.play('spell');
      if (event.kind === 'trap') { sound.play('trap'); announce(event.cardId, 'trap'); }
      if (event.kind === 'draw') sound.play('draw');
      if (event.kind === 'phase') sound.play('phase');
      if (event.kind === 'turn' && event.owner === 0) {
        sound.play('phase');
        if (!prefs.reducedMotion) { const banner = $('#turn-sweep'); banner.classList.remove('playing'); void banner.offsetWidth; banner.classList.add('playing'); setTimeout(() => banner.classList.remove('playing'), 1900); }
      }
      if (event.kind === 'victory') sound.play(event.owner === 0 ? 'victory' : 'defeat');
    }
  }
  function setupAmbient() {
    const canvas = $('#ambient'), context = canvas.getContext('2d');
    if (!context) return;
    const stars = Array.from({ length: 46 }, () => ({ x: Math.random(), y: Math.random(), radius: Math.random() * 1.1 + .2, speed: Math.random() * .000015 + .000004, phase: Math.random() * Math.PI * 2 }));
    let width = innerWidth, height = innerHeight, last = 0, lastDraw = 0;
    const resize = () => { width = innerWidth; height = innerHeight; const ratio = Math.min(devicePixelRatio || 1, 1.5); canvas.width = width * ratio; canvas.height = height * ratio; context.setTransform(ratio, 0, 0, ratio, 0, 0); };
    resize(); window.addEventListener('resize', resize, { passive: true });
    function frame(time) {
      requestAnimationFrame(frame);
      if (prefs.reducedMotion || document.hidden || time - lastDraw < 40) { last = time; return; }
      const dt = Math.min(64, time - (last || time)); last = time; lastDraw = time;
      context.clearRect(0, 0, width, height);
      for (const star of stars) {
        star.y -= star.speed * dt;
        if (star.y < -.02) { star.y = 1.02; star.x = Math.random(); }
        const alpha = .15 + (Math.sin(time / 2100 + star.phase) + 1) * .16;
        context.fillStyle = 'rgba(198,188,130,' + alpha.toFixed(3) + ')'; context.beginPath(); context.arc(star.x * width + Math.sin(time / 5000 + star.phase) * 12, star.y * height, star.radius, 0, Math.PI * 2); context.fill();
      }
    }
    requestAnimationFrame(frame);
  }
  function updateSoundButton() {
    const button = $('#sound-button'); button.innerHTML = icon(prefs.sound ? 'volume' : 'mute');
    button.title = (prefs.sound ? '关闭音效' : '开启音效') + '（M）'; button.setAttribute('aria-label', button.title); button.setAttribute('aria-pressed', String(!!prefs.sound));
  }
  function updatePrefs() {
    document.body.classList.toggle('reduce-motion', !!prefs.reducedMotion);
    writeStorage('duel-sanctuary-prefs-v1', prefs); sound.update(); updateSoundButton();
  }

  function takePhase(phase) {
    if (engine.state.active !== 0 || engine.state.winner !== null || engine.state.pending) return;
    if (intent) { showToast('请先完成或取消当前的目标选择。'); return; }
    dispatch(phase === 'end' ? { type: 'end' } : { type: 'phase', phase });
  }
  function takeNextPhase() {
    const next = nextPhaseInfo();
    if (next.disabled) return;
    if (next.action === 'new-game') { showNewGame(); return; }
    takePhase(next.action === 'end' ? 'end' : next.phase);
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else showToast('这个浏览器不支持全屏，可使用横屏获得更宽的视野。');
    } catch { showToast('浏览器未允许全屏。游戏可以继续正常运行。'); }
  }
  function exportLog() {
    const content = { game: '游戏王 · 决斗之境', date: new Date().toISOString(), decks: engine.state.players.map(p => DECKS[p.deckId].name), turn: engine.state.turn, winner: engine.state.winner, log: [...engine.state.log].reverse() };
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json;charset=utf-8' }), url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = '决斗记录-' + new Date().toISOString().slice(0, 10) + '.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('决斗记录已导出。');
  }
  document.addEventListener('pointerdown', () => sound.unlock(), { passive: true });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) { if (!event.target.closest('#card-popover')) hidePopover(); return; }
    if (button.disabled) return;
    const action = button.dataset.action;
    if (!['select-card', 'none'].includes(action)) sound.play('click');
    switch (action) {
      case 'duel': if (modal.open) closeModal(); else { hidePopover(); window.scrollTo({ top: 0, behavior: prefs.reducedMotion ? 'instant' : 'smooth' }); } break;
      case 'library': showLibrary(); break;
      case 'help': showHelp(); break;
      case 'settings': showSettings(); break;
      case 'new-game': showNewGame(); break;
      case 'close-modal': closeModal(); break;
      case 'inspect-full': if (!previewHidden) showCardDetail(previewId); else showToast('这张卡尚未公开。'); break;
      case 'card-detail': showCardDetail(button.dataset.cardId); break;
      case 'my-deck': showDeck(0); break;
      case 'pile': showPile(Number(button.dataset.owner), button.dataset.pile); break;
      case 'log': showLog(); break;
      case 'export-log': exportLog(); break;
      case 'result': showResult(); break;
      case 'sound': prefs.sound = !prefs.sound; updatePrefs(); if (prefs.sound) sound.play('phase'); showToast(prefs.sound ? '决斗音效已开启。' : '决斗音效已关闭。'); break;
      case 'fullscreen': fullscreen(); break;
      case 'select-card': chooseCard(button.dataset.cardUid, button); break;
      case 'card-command': cardCommand(button.dataset.command, button.dataset.uid); break;
      case 'phase': takePhase(button.dataset.phase); break;
      case 'end': takePhase('end'); break;
      case 'cancel-intent': clearIntent(); break;
      case 'confirm-tribute': {
        if (!intent || intent.kind !== 'tribute' || intent.selected.length !== intent.count) return;
        const summon = { type: 'summon', uid: intent.uid, mode: intent.mode, tributes: [...intent.selected] }; intent = null; dispatch(summon); break;
      }
      case 'library-filter': libraryFilter = button.dataset.filter; renderLibraryResults(); break;
      case 'choose-deck': setupOptions.deck = button.dataset.deck; renderNewGame(); break;
      case 'choose-first': setupOptions.first = Number(button.dataset.value); renderNewGame(); break;
      case 'choose-difficulty': setupOptions.difficulty = button.dataset.value; renderNewGame(); break;
      case 'begin-game': startGame({ ...setupOptions, seed: Date.now() }); break;
      case 'rematch': startGame({ deck: engine.state.players[0].deckId, difficulty: engine.state.difficulty, first: 1, seed: Date.now() }); break;
      case 'toggle-pref': {
        const key = button.dataset.pref;
        if (['sound', 'music', 'reducedMotion'].includes(key)) { prefs[key] = !prefs[key]; updatePrefs(); showSettings(); const control = $('[data-pref="' + key + '"]'); control?.focus({ preventScroll: true }); }
        break;
      }
      case 'set-speed': prefs.speed = button.dataset.value === 'fast' ? 'fast' : 'normal'; updatePrefs(); showSettings(); break;
      case 'select-target': {
        if (!selectionState) return;
        const uid = button.dataset.uid;
        if (!selectionState.targets.some(t => t.uid === uid)) return;
        if (selectionState.count === 1) selectionState.selected = [uid];
        else if (selectionState.selected.includes(uid)) selectionState.selected = selectionState.selected.filter(id => id !== uid);
        else if (selectionState.selected.length < selectionState.count) selectionState.selected.push(uid);
        else { showToast('已经选择足够的卡牌，可以确认了。'); return; }
        const oldScroll = modal.scrollTop;
        renderSelection(); modal.scrollTop = oldScroll;
        break;
      }
      case 'confirm-selection': {
        const selection = selectionState;
        if (!selection || selection.selected.length !== selection.count) return;
        const selected = [...selection.selected], source = selection.sourceUid, discarding = selection.kind === 'discard';
        dismissModal(); dispatch(discarding ? { type: 'discard', uids: selected } : { type: 'cast', uid: source, target: selected[0] }); break;
      }
      case 'select-response':
        responseUid = button.dataset.uid;
        $$('.response-modal .selection-card').forEach(el => el.classList.toggle('chosen', el.dataset.uid === responseUid));
        $('#response-confirm').disabled = false;
        break;
      case 'confirm-response': {
        if (!responseUid) return;
        const uid = responseUid; dismissModal(); dispatch({ type: 'respond', uid }); break;
      }
      case 'pass-response': dismissModal(); dispatch({ type: 'respond', uid: null }); break;
    }
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'library-search') { libraryQuery = event.target.value; renderLibraryResults(); }
    if (event.target.id === 'volume-control') { prefs.volume = Number(event.target.value) / 100; updatePrefs(); $('#volume-label').textContent = Math.round(prefs.volume * 100) + '%'; }
  });
  document.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch' || modal.open || intent) return;
    const element = event.target.closest('[data-card-uid]');
    if (!element || event.relatedTarget?.closest?.('[data-card-uid]') === element) return;
    const found = engine.find(element.dataset.cardUid);
    if (!found || (found.owner === 1 && !found.card.faceUp)) return;
    if (hoverId === found.card.uid) return;
    hoverId = found.card.uid; previewId = found.card.id; previewHidden = false; renderInspector();
  }, { passive: true });
  document.addEventListener('keydown', event => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target.isContentEditable) return;
    if (event.key === 'Escape') {
      if (modal.open) return;
      if (intent) { event.preventDefault(); clearIntent(); } else hidePopover();
      return;
    }
    if (modal.open || event.ctrlKey || event.altKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (key === 'm') { prefs.sound = !prefs.sound; sound.unlock(); updatePrefs(); showToast(prefs.sound ? '决斗音效已开启。' : '决斗音效已关闭。'); return; }
    if (key === 'f') { fullscreen(); return; }
    if (key === ' ' && event.target.tagName !== 'BUTTON') { event.preventDefault(); sound.unlock(); takeNextPhase(); return; }
    if (key === 'e') { event.preventDefault(); takePhase('end'); return; }
    if (/^[1-9]$/.test(key)) {
      const card = engine.state.players[0].hand[Number(key) - 1];
      if (card) { const el = $('.hand-slot[data-card-uid="' + card.uid + '"]'); chooseCard(card.uid, el); }
    }
  });
  modal.addEventListener('cancel', event => { event.preventDefault(); closeModal(); });
  modal.addEventListener('close', () => { if (!modal.open) scheduleAI(); });
  modal.addEventListener('click', event => {
    if (event.target !== modal) return;
    const r = modal.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeModal();
  });
  window.addEventListener('resize', hidePopover, { passive: true });
  window.addEventListener('scroll', event => { if (!event.target.closest?.('#modal')) hidePopover(); }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearTimeout(aiTimer); if (sound.context?.state === 'running') sound.context.suspend().catch(() => {}); }
    else { if (sound.context && prefs.sound) sound.context.resume().catch(() => {}); scheduleAI(); }
  });

  const stored = readStorage('duel-sanctuary-save-v1', null);
  let restored = false;
  if (stored) {
    try {
      engine = window.DuelEngine.restore(stored); previewId = DECKS[engine.state.players[0].deckId].ace;
      bindEngine(); render(); scheduleAI(); restored = true;
      if (engine.state.winner !== null) finishGame();
    } catch { restored = false; }
  }
  if (!restored) startGame({ deck: 'blue', first: 1, difficulty: 'standard', seed: 48 }, true);
  setupAmbient();
  if (!readStorage('duel-sanctuary-welcomed-v1', false)) {
    setTimeout(() => showToast('欢迎来到决斗之境。点击一张手牌，让命运开始转动。'), 800);
    writeStorage('duel-sanctuary-welcomed-v1', true);
  }
  // Small deterministic test interface. The shipped game uses the same actions.
  window.duelApp = Object.freeze({
    get engine() { return engine; },
    get preferences() { return { ...prefs }; },
    get intent() { return intent ? { ...intent } : null; },
    get modalKind() { return modalKind; },
    newGame: options => startGame(options, true),
    act: dispatch,
    render,
    restore: snapshot => {
      aiEpoch++; clearTimeout(aiTimer); dismissModal(); intent = null; selectedUid = null; previewHidden = false; resultShown = false;
      clearTimeout(cinematicTimer); $('#cinematic').classList.remove('visible'); $('#fx-layer').innerHTML = ''; $('#toast-stack').innerHTML = '';
      engine = window.DuelEngine.restore(snapshot); previewId = DECKS[engine.state.players[0].deckId].ace; bindEngine(); render(); saveGame(); scheduleAI();
    }
  });
  document.documentElement.dataset.ready = 'true';
})();
