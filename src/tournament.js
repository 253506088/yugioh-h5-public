(function (root) {
  'use strict';
  const Engine = root.DuelEngine || require('./advanced-engine.js').DuelEngine;
  const Decks = root.DuelDecks || require('./deck-tools.js');
  const copy = value => JSON.parse(JSON.stringify(value));
  const demand = (condition, message) => { if (!condition) throw new Error(message); };
  const FORMAT = 'duel-sanctuary-tournament';
  const LIMITS = Object.freeze({ min:2, max:64, actions:2400, turns:160, rematches:2, fileBytes:48 * 1024 * 1024 });
  const done = match => ['complete', 'bye'].includes(match.status);

  function integer(value, min, max, label) {
    const n = Number(value);
    demand(Number.isInteger(n) && n >= min && n <= max, label + '超出允许范围。');
    return n;
  }
  function seedValue(value) {
    return integer(value ?? Date.now() % 4294967295, 1, 4294967295, '抽签种子');
  }
  function random(seed) {
    let state = seedValue(seed);
    return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
  }
  function hash(value) {
    let h = 2166136261;
    for (const c of String(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return (h >>> 0) || 1;
  }
  function shuffle(values, seed) {
    const result = [...values], next = random(seed);
    for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
    return result;
  }
  function randomRoster(pool, count = 16, seed, duplicates = true) {
    count = integer(count, LIMITS.min, LIMITS.max, '机器人数量');
    const ids = [...new Set(pool.map(deck => typeof deck === 'string' ? deck : deck.id))];
    demand(ids.length, '当前卡组池为空，请先保存一副自定义卡组或选择全部卡组。');
    demand(duplicates || count <= ids.length, '不重复抽签时，机器人数量不能超过卡组池数量。');
    if (!duplicates) return shuffle(ids, seed).slice(0, count);
    const next = random(seed);
    return Array.from({length:count}, () => ids[Math.floor(next() * ids.length)]);
  }
  function settings(input = {}) {
    return {
      concurrency:integer(input.concurrency ?? 4, 1, 8, '同时对局数量'),
      pace:['normal', 'fast', 'turbo'].includes(input.pace) ? input.pace : 'fast',
      difficulty:input.difficulty === 'casual' ? 'casual' : 'standard',
      maxActions:LIMITS.actions, maxTurns:LIMITS.turns
    };
  }
  function bracket(participants) {
    const size = 2 ** Math.ceil(Math.log2(participants.length)), half = size / 2;
    // Distribute byes across the tree; no empty-vs-empty matches or double byes.
    const bits = Math.log2(half), reverse = n => parseInt(n.toString(2).padStart(bits, '0').split('').reverse().join(''), 2) || 0;
    const byePairs = new Set(Array.from({length:half}, (_, i) => reverse(i)).slice(0, size - participants.length));
    const matches = [];
    let cursor = 0;
    for (let round = 0, count = half; count >= 1; round++, count /= 2) {
      for (let index = 0; index < count; index++) {
        const entrants = round ? [null, null] : [participants[cursor++].id, byePairs.has(index) ? null : participants[cursor++].id];
        matches.push({id:'r' + (round + 1) + '-m' + (index + 1), round, index, entrants,
          sources:round ? ['r' + round + '-m' + (index * 2 + 1), 'r' + round + '-m' + (index * 2 + 2)] : [],
          status:round ? 'waiting' : entrants[1] ? 'ready' : 'bye', winnerId:!round && !entrants[1] ? entrants[0] : null,
          games:[], reason:'', finishedAt:null});
      }
    }
    return {size, matches};
  }
  function create(options = {}, available = Decks.list()) {
    const count = integer(options.count ?? options.deckIds?.length ?? 16, LIMITS.min, LIMITS.max, '机器人数量');
    const seed = seedValue(options.seed), deckIds = options.deckIds || randomRoster(available, count, seed, options.duplicates !== false);
    demand(deckIds.length === count, '每个参赛席位都需要一副卡组。');
    const book = {}, names = new Map(), used = new Map();
    for (const id of deckIds) {
      const deck = available.find(d => d.id === id);
      demand(deck, '有参赛卡组已被删除，请重新选择。');
      const check = Decks.analyze(deck);
      demand(check.valid, deck.name + '：' + check.errors.join(' '));
      book[id] ||= copy(deck);
      names.set(deck.name, (names.get(deck.name) || 0) + 1);
    }
    const participants = deckIds.map((id, index) => {
      const deck = book[id], number = (used.get(deck.name) || 0) + 1;
      used.set(deck.name, number);
      return {id:'p' + (index + 1), seed:index + 1, deckId:id, copy:names.get(deck.name) > 1 ? number : 0,
        name:deck.name + (names.get(deck.name) > 1 ? ' ' + number + '号' : '')};
    });
    const draw = bracket(participants), now = Date.now();
    return new Tournament({format:FORMAT, version:1, id:'cup-' + now.toString(36) + '-' + hash(seed + ':' + Math.random()).toString(36),
      name:String(options.name || '机器人死斗大会').trim().slice(0, 60) || '机器人死斗大会', seed, createdAt:now, updatedAt:now,
      status:'draft', settings:settings(options), participants, decks:book, size:draw.size, matches:draw.matches, championId:null});
  }
  function rps(seed) {
    const next = random(seed), rounds = [];
    let a, b;
    do { a = Math.floor(next() * 3); b = Math.floor(next() * 3); rounds.push([a, b]); } while (a === b && rounds.length < 24);
    return {rounds, first:a === b ? Math.floor(next() * 2) : (a - b + 3) % 3 === 2 ? 0 : 1};
  }

  class Tournament {
    constructor(data) {
      this.data = data;
      this.engines = new Map();
      this.revision = 0;
      this.nextMatch = 0;
      this.propagate();
    }
    get status() { return this.data.status; }
    get matches() { return this.data.matches; }
    participant(id) { return this.data.participants.find(p => p.id === id) || null; }
    match(id) { return this.matches.find(m => m.id === id) || null; }
    touch() { this.data.updatedAt = Date.now(); this.revision++; }
    propagate() {
      for (const match of this.matches) {
        if (match.status !== 'waiting') continue;
        const parents = match.sources.map(id => this.match(id));
        match.entrants = parents.map(parent => parent.winnerId);
        if (parents.every(done)) match.status = 'ready';
      }
      const final = this.matches.at(-1);
      if (done(final)) { this.data.championId = final.winnerId; this.data.status = 'completed'; }
    }
    progress() {
      const played = this.matches.filter(m => m.status === 'complete').length;
      return {total:this.data.participants.length - 1, played, remaining:this.data.participants.length - played,
        live:this.matches.filter(m => m.status === 'running').length, errors:this.matches.filter(m => m.status === 'error').length,
        byes:this.matches.filter(m => m.status === 'bye').length};
    }
    configure(values) {
      this.data.settings = settings({...this.data.settings, ...values});
      this.touch();
    }
    resume() { if (this.status !== 'completed') { this.data.status = 'running'; this.touch(); } return this; }
    pause() { if (this.status === 'running') { this.data.status = 'paused'; this.touch(); } return this; }
    eligible() {
      if (this.status !== 'running') return [];
      const pending = this.matches.find(match => !done(match));
      if (!pending) return [];
      // A round only opens once all matches in the previous round have resolved.
      return this.matches.filter(m => m.round === pending.round && ['ready', 'running'].includes(m.status)).slice(0, this.data.settings.concurrency);
    }
    openGame(match) {
      const number = match.games.length, seed = hash(this.data.seed + ':' + match.id + ':' + number), opening = rps(seed);
      const specs = match.entrants.map(id => this.data.decks[this.participant(id).deckId]);
      const engine = new Engine({deck:specs[0].id, opponentDeck:specs[1].id, deckSpecs:specs,
        first:opening.first, seed:hash(seed + ':shuffle'), difficulty:this.data.settings.difficulty});
      engine.state.mode = 'spectate';
      const game = {id:match.id + '-g' + (number + 1), seed, opening, startedAt:Date.now(), initial:engine.snapshot(),
        steps:[], final:null, verdict:null, error:null};
      match.games.push(game);
      match.status = 'running';
      this.engines.set(match.id, engine);
      this.touch();
      return engine;
    }
    engineFor(match) {
      let engine = this.engines.get(match.id);
      if (!engine && match.games.length) {
        const game = match.games.at(-1);
        engine = Engine.restore(game.current || game.final || game.initial);
        this.engines.set(match.id, engine);
      }
      return engine;
    }
    judge(game, engine, kind) {
      const s = engine.state;
      let winner, reason;
      if (s.players[0].lp !== s.players[1].lp) { winner = s.players[0].lp > s.players[1].lp ? 0 : 1; reason = 'LP 较高者晋级'; }
      else if (s.damage[0] !== s.damage[1]) { winner = s.damage[0] > s.damage[1] ? 0 : 1; reason = '累计伤害较高者晋级'; }
      else { winner = Math.floor(random(hash(game.seed + ':tiebreak'))() * 2); reason = '同分，按赛前种子抽签晋级'; }
      return {winner, kind, reason};
    }
    settle(match, engine, kind = null) {
      const game = match.games.at(-1), s = engine.state;
      game.final = engine.snapshot(); delete game.current;
      game.finishedAt = Date.now();
      if (s.winner === 'draw' && match.games.filter(g => g.verdict?.kind === 'draw').length < LIMITS.rematches) {
        game.verdict = {winner:null, kind:'draw', reason:s.resultReason || '平局，重新开局'};
        match.status = 'ready';
        this.engines.delete(match.id);
      } else {
        game.verdict = kind || s.winner === 'draw' ? this.judge(game, engine, kind || 'draw-limit') : {winner:s.winner, kind:'normal', reason:s.resultReason};
        match.winnerId = match.entrants[game.verdict.winner];
        match.status = 'complete'; match.reason = game.verdict.reason; match.finishedAt = game.finishedAt;
        this.engines.delete(match.id);
        this.propagate();
      }
      this.touch();
    }
    stepMatch(match) {
      try {
        const engine = match.status === 'ready' ? this.openGame(match) : this.engineFor(match), game = match.games.at(-1);
        if (engine.state.winner !== null) { this.settle(match, engine); return; }
        const action = engine.aiNext();
        demand(action, '机器人没有找到合法行动。');
        // AI evaluation may consume RNG. Store the RNG immediately before act(),
        // so playback never reruns AI or depends on the scheduler's interleaving.
        const randomState = engine.randomState, result = engine.act(action);
        demand(result.ok, result.error || '机器人行动未能执行。');
        const event = [...result.events].reverse().find(e => !['window', 'chain-pass'].includes(e.kind));
        game.steps.push({action:copy(action), randomState, turn:engine.state.turn, active:engine.state.active,
          phase:engine.state.phase, text:event?.text || '', kind:event?.kind || action.type});
        this.touch();
        if (engine.state.winner !== null) this.settle(match, engine);
        else if (game.steps.length >= this.data.settings.maxActions || engine.state.turn > this.data.settings.maxTurns) this.settle(match, engine, 'limit');
      } catch (error) {
        const game = match.games.at(-1), engine = this.engines.get(match.id);
        if (game) { game.error = String(error.message || error); if (engine) game.final = engine.snapshot(); }
        match.status = 'error'; match.reason = String(error.message || error);
        this.touch();
      }
    }
    advance(batches = 1, budgetMs = Infinity) {
      const started = Date.now();
      let steps = 0;
      for (let i = 0; i < batches && this.status === 'running'; i++) {
        const eligible = this.eligible();
        if (!eligible.length) { this.pause(); break; }
        const start = this.nextMatch % eligible.length;
        for (let at = 0; at < eligible.length; at++) {
          this.nextMatch = (start + at + 1) % eligible.length;
          this.stepMatch(eligible[(start + at) % eligible.length]); steps++;
          if (Date.now() - started >= budgetMs) return steps;
        }
      }
      return steps;
    }
    retry(id) {
      const match = this.match(id);
      demand(match?.status === 'error', '只能重赛发生异常的场次。');
      demand(match.games.length < 32, '本场重赛次数已达上限，请导出记录。');
      this.engines.delete(id); match.status = 'ready'; match.reason = '';
      this.resume();
    }
    gameSnapshot(id, gameIndex) {
      const match = this.match(id), game = match?.games[gameIndex ?? match.games.length - 1];
      if (!game) return null;
      const live = game === match.games.at(-1) ? this.engines.get(id) : null;
      return live ? live.snapshot() : copy(game.final || game.current || game.initial);
    }
    snapshot() {
      const saved = copy(this.data);
      for (const match of saved.matches) {
        const engine = this.engines.get(match.id);
        if (engine && match.games.length && match.status === 'running') match.games.at(-1).current = engine.snapshot();
      }
      return saved;
    }
    static restore(input) {
      const data = copy(input);
      demand(data?.format === FORMAT && data.version === 1, '这不是受支持的死斗赛事文件。');
      demand(typeof data.id === 'string' && /^cup-[a-z0-9-]{1,80}$/.test(data.id), '赛事标识无效。');
      demand(typeof data.name === 'string' && data.name.length <= 60, '赛事名称无效。');
      seedValue(data.seed);
      demand(Array.isArray(data.participants), '参赛名单无效。');
      integer(data.participants.length, LIMITS.min, LIMITS.max, '机器人数量');
      data.settings = settings(data.settings);
      demand(['draft', 'running', 'paused', 'completed'].includes(data.status), '赛事状态无效。');
      demand(data.decks && typeof data.decks === 'object', '赛事卡组缺失。');
      for (const [index, entrant] of data.participants.entries()) {
        demand(entrant.id === 'p' + (index + 1) && entrant.seed === index + 1, '参赛席位无效。');
        demand(typeof entrant.name === 'string' && entrant.name.length <= 90, '机器人名称无效。');
        integer(entrant.copy, 0, LIMITS.max, '机器人编号');
        const spec = Object.hasOwn(data.decks, entrant.deckId) && data.decks[entrant.deckId];
        demand(spec && spec.id === entrant.deckId && Decks.analyze(spec).valid, '赛事包含无效卡组。');
      }
      const expected = bracket(data.participants);
      demand(data.size === expected.size && data.matches?.length === expected.matches.length, '赛事对阵表不完整。');
      const actual = new Map();
      let totalSteps = 0;
      for (const [index, match] of data.matches.entries()) {
        const reference = expected.matches[index];
        demand(match.id === reference.id && match.round === reference.round && match.index === reference.index && JSON.stringify(match.sources) === JSON.stringify(reference.sources), '赛事晋级关系无效。');
        const entrants = match.round ? match.sources.map(id => actual.get(id)?.winnerId ?? null) : reference.entrants;
        demand(JSON.stringify(match.entrants) === JSON.stringify(entrants), '参赛者与上轮晋级结果不一致。');
        demand(['waiting', 'ready', 'running', 'complete', 'bye', 'error'].includes(match.status), '场次状态无效。');
        demand(done(match) ? entrants.includes(match.winnerId) && !!match.winnerId : match.winnerId === null, '晋级者无效。');
        demand((match.status === 'bye') === (reference.status === 'bye'), '轮空场次无效。');
        demand(['waiting', 'bye'].includes(match.status) || entrants.every(Boolean), '比赛缺少参赛者。');
        demand(Array.isArray(match.games) && match.games.length <= 32, '录像数量无效。');
        for (const game of match.games) {
          demand(Array.isArray(game.steps) && game.steps.length <= LIMITS.actions, '录像操作数量无效。');
          totalSteps += game.steps.length;
          demand(totalSteps <= 200000, '赛事录像过大。');
          seedValue(game.seed);
          demand(game.initial?.state?.players?.length === 2, '录像起始局面缺失。');
          demand([0, 1].includes(game.opening?.first) && Array.isArray(game.opening.rounds) && game.opening.rounds.length > 0 && game.opening.rounds.length <= 24 && game.opening.rounds.every(round => Array.isArray(round) && round.length === 2 && round.every(n => [0, 1, 2].includes(n))), '录像猜拳信息无效。');
          Engine.restore(game.initial);
          if (game.final) Engine.restore(game.final);
          if (game.verdict) demand(['normal', 'draw', 'limit', 'draw-limit'].includes(game.verdict.kind) && [null, 0, 1].includes(game.verdict.winner), '比赛判定无效。');
          for (const step of game.steps) {
            demand(step.action && typeof step.action.type === 'string' && step.action.type.length < 40 && Number.isInteger(step.randomState), '录像操作无效。');
          }
        }
        if (match.status === 'complete') {
          const finalGame = match.games.at(-1);
          demand(finalGame?.final && [0, 1].includes(finalGame.verdict?.winner) && match.winnerId === match.entrants[finalGame.verdict.winner], '完赛场次缺少有效录像结果。');
        }
        if (match.status === 'running') {
          demand(match.games.length && match.games.at(-1).current, '进行中场次的存档缺失。');
          Engine.restore(match.games.at(-1).current);
        }
        actual.set(match.id, match);
      }
      demand(data.championId === (actual.get(expected.matches.at(-1).id).winnerId || null), '冠军与决赛结果不一致。');
      demand((data.status === 'completed') === !!data.championId, '赛事完成状态不一致。');
      if (data.status === 'running') data.status = 'paused';
      return new Tournament(data);
    }
  }

  class ReplayCursor {
    constructor(game) {
      demand(game?.initial, '这场比赛还没有录像。');
      this.game = game; this.index = 0; this.engine = Engine.restore(game.initial);
      this.frames = new Map([[0, game.initial]]);
    }
    next() {
      if (this.index >= this.game.steps.length) return false;
      const step = this.game.steps[this.index];
      this.engine.randomState = step.randomState;
      const result = this.engine.act(copy(step.action));
      demand(result.ok, '录像无法继续：' + result.error);
      this.index++;
      if (this.index % 40 === 0) this.frames.set(this.index, this.engine.snapshot());
      return true;
    }
    beginSeek(index) {
      index = Math.max(0, Math.min(this.game.steps.length, Math.trunc(Number(index) || 0)));
      if (index === this.game.steps.length && this.game.final) {
        this.engine = Engine.restore(this.game.final); this.index = index; return index;
      }
      if (this.index > index || index - this.index > 40) {
        const start = Math.max(...[...this.frames.keys()].filter(at => at <= index));
        this.engine = Engine.restore(this.frames.get(start)); this.index = start;
      }
      return index;
    }
    seek(index) { const target = this.beginSeek(index); while (this.index < target) this.next(); return this.engine; }
    async seekAsync(index, cancelled = () => false) {
      const target = this.beginSeek(index);
      while (this.index < target) {
        if (cancelled()) return null;
        const started = Date.now();
        do { this.next(); } while (this.index < target && Date.now() - started < 10);
        if (this.index < target) await new Promise(resolve => setTimeout(resolve, 0));
      }
      return cancelled() ? null : this.engine;
    }
  }
  const api = {FORMAT, LIMITS, create, Tournament, ReplayCursor, randomRoster, shuffle, random, hash, bracket, rps};
  root.DuelTournament = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
