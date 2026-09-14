import { createRequire } from 'node:module';
import { randomInt } from 'node:crypto';

const require = createRequire(import.meta.url);
const { DuelEngine } = require('../src/advanced-engine.js');
export const Data = globalThis.DuelData;
export const Decks = globalThis.DuelDecks;

const publicZones = new Set(['grave', 'monsters', 'extraMonster', 'spells', 'fieldSpell', 'overlays']);
export function visible(engine, ref, viewer) {
  if (!ref) return false;
  const { card, owner, zone } = ref;
  if (zone === 'deck') return engine.publicDeckTop?.(owner)?.uid === card.uid;
  if (owner === viewer) return true;
  if (zone === 'hand') return !!engine.handRevealed?.(owner, viewer);
  if (zone === 'extra') return !!card.faceUpExtra;
  if (zone === 'banished') return card.faceUp !== false;
  return publicZones.has(zone) && (zone === 'grave' || zone === 'overlays' || card.faceUp !== false);
}

const verbs = {
  draw: '抽卡', search: '检索卡片', set: '盖放卡片', summon: '通常召唤', special: '特殊召唤',
  fusion: '融合召唤', synchro: '同调召唤', xyz: '超量召唤', link: '连接召唤', ritual: '仪式召唤',
  pendulum: '灵摆召唤', spell: '发动魔法', trap: '发动陷阱', effect: '发动效果',
  attack: '宣言攻击', damage: '受到伤害', heal: '回复生命值', cost: '支付代价',
  'lp-change': '生命值变化', move: '移动卡片', destroy: '卡片被破坏', discard: '丢弃卡片',
  mill: '卡组卡片送墓', overlay: '叠放素材', stance: '改变表示', reveal: '公开卡片',
  negate: '效果无效', return: '卡片返回', equip: '装备卡片', control: '控制权改变',
  phase: '阶段推进', end: '结束回合', turn: '回合开始', victory: '决斗结束', system: '决斗开始'
};

// Never forward free-form engine text: older card handlers can interpolate private names.
// Capture what was visible at the event, so a later reveal cannot rewrite earlier secrecy.
function journalEntry(engine, item, viewer) {
  const owner = [0, 1].includes(item.owner) ? Number(item.owner !== viewer) : null;
  const out = { n: item.n, turn: item.turn, kind: item.kind, owner };
  for (const key of ['amount', 'count', 'chain', 'chainId', 'linkId']) {
    if (typeof item[key] === 'number' || key === 'linkId' && typeof item[key] === 'string') out[key] = item[key];
  }
  const f = item.uid ? engine.find(item.uid) : null;
  const seen = f && visible(engine, f, viewer) && !(item.kind === 'set' && item.owner !== viewer);
  if (item.cardId && seen && f.card.id === item.cardId && !item.hidden) out.cardId = item.cardId;
  if (out.cardId && item.key) out.key = item.key;
  const tr = item.trace;
  if (tr) {
    const trace = { version: 1, phase: tr.phase, turnPlayer: Number(engine.state.active !== viewer) };
    for (const key of ['lpBefore', 'lpAfter', 'from', 'to', 'moveKind', 'damageType']) {
      if (typeof tr[key] === 'string' || typeof tr[key] === 'number') trace[key] = tr[key];
    }
    for (const key of ['fromOwner', 'toOwner']) if ([0, 1].includes(tr[key])) trace[key] = Number(tr[key] !== viewer);
    if (out.cardId) trace.card = { cardId: out.cardId, owner, public: true };
    const cause = tr.cause, source = cause?.uid ? engine.find(cause.uid) : null;
    if (cause?.cardId && source && source.card.id === cause.cardId && visible(engine, source, viewer)) {
      trace.cause = { kind: cause.kind, cardId: cause.cardId, owner: Number(cause.owner !== viewer), public: true };
      for (const key of ['chainNumber', 'chainId']) if (Number.isInteger(cause[key])) trace.cause[key] = cause[key];
    }
    out.trace = trace;
  }
  const actor = owner === null ? '' : owner === 0 ? '你 · ' : '对方 · ';
  out.text = actor + (verbs[item.kind] || (item.kind.startsWith('chain-') ? '连锁处理' : '规则处理'))
    + (out.cardId ? ' · ' + Data.CARDS[out.cardId].name : '')
    + (typeof out.amount === 'number' ? ' · ' + out.amount : typeof out.count === 'number' ? ' · ' + out.count : '');
  return out;
}

export class ServerEngine extends DuelEngine {
  // The browser never gets the seed; all shuffles and effect rolls use the OS RNG.
  random() { return randomInt(0x100000000) / 0x100000000; }

  log(...args) {
    super.log(...args);
    const item = this.state.log[0];
    item.pvpLog = [0, 1].map(viewer => journalEntry(this, item, viewer));
  }

  static restore(snapshot) {
    const engine = DuelEngine.restore(snapshot);
    Object.setPrototypeOf(engine, ServerEngine.prototype);
    return engine;
  }
}

export function validateDeck(input) {
  let deck;
  if (input?.preset && typeof input.preset === 'string' && Object.hasOwn(Data.DECKS, input.preset) && Data.DECKS[input.preset].preset) {
    deck = structuredClone(Data.DECKS[input.preset]);
  } else {
    if (!input || !Array.isArray(input.cards) || !Array.isArray(input.extra) || input.cards.length > 60 || input.extra.length > 15) {
      throw new Error('请选择一套预设卡组，或提交 40–60 张主卡组与至多 15 张额外卡组。');
    }
    deck = { name: typeof input.name === 'string' ? input.name.trim() : '', cards: [...input.cards], extra: [...input.extra] };
  }
  const check = Decks.analyze(deck);
  if (!check.valid) throw new Error(check.errors.slice(0, 4).join(' '));
  return deck;
}
