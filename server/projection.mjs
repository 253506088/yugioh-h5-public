import { createHmac } from 'node:crypto';
import { Data, Lingering, visible } from './engine.mjs';

const fieldZones = new Set(['monsters', 'extraMonster', 'spells', 'fieldSpell']);
const pick = (object, keys) => Object.fromEntries(keys.filter(key => object?.[key] !== undefined).map(key => [key, object[key]]));

// This is an allowlist, not a copy of an engine snapshot. Every field crossing the
// trust boundary is defined here. Each revision has fresh opaque card handles.
export function project(room, viewer) {
  const e = room.engine, s = e.state, refs = new Map(), choices = [];
  const side = owner => [0, 1].includes(owner) ? Number(owner !== viewer) : owner;
  const handle = uid => {
    if (uid === null || uid === undefined) return uid;
    const value = 'h_' + createHmac('sha256', room.secret).update(`${viewer}:${room.revision}:${uid}`).digest('base64url').slice(0, 22);
    refs.set(value, uid);
    return value;
  };
  const hidden = card => ({ hidden: true, faceUp: false, position: card?.position || 'defense', overlays: [] });

  function card(ref, forceKnown = false) {
    if (!ref?.card) return null;
    const { card: c, owner, zone } = ref, known = forceKnown || visible(e, ref, viewer);
    if (!known && !fieldZones.has(zone) && zone !== 'banished') return hidden(c);
    if (!known) return { ...hidden(c), uid: handle(c.uid) };
    const out = {
      ...pick(c, ['id', 'faceUp', 'position', 'faceUpExtra', 'counters', 'attacksMade', 'summonTurn', 'changedTurn', 'setTurn', 'properlySummoned', 'summonKind']),
      uid: handle(c.uid), originalOwner: side(c.originalOwner), hidden: false,
      overlays: (c.overlays || []).map(m => card({ card: m, owner, zone: 'overlays' })),
      publicStats: {
        atk: Data.isMonster(Data.CARDS[c.id]) ? e.attackValue(c) : 0,
        def: Data.isMonster(Data.CARDS[c.id]) ? e.defenseValue(c) : 0,
        level: Data.isMonster(Data.CARDS[c.id]) ? e.level(c) : 0,
        negated: !!e.negated(c),
        ...(Data.CARDS[c.id]?.type === 'pendulum' ? { scale: e.pendulumScale(c), pendulumZone: e.isPendulumScale(c), pendingActivation: !!c.pendingActivation } : {})
      }
    };
    if (Number.isInteger(c.extraSlot)) out.extraSlot = side(c.extraSlot);
    return out;
  }

  function player(owner) {
    const p = s.players[owner], own = owner === viewer, deck = e.deckInfo(owner);
    const spec = own ? {
      ...pick(deck, ['id', 'name', 'ace', 'mechanic', 'description', 'subtitle', 'combo', 'preset']),
      cards: [...deck.cards], extra: [...deck.extra], player: room.seats[owner]?.name || deck.player
    } : {
      id: 'pvp-opponent', name: '对手的卡组', player: room.seats[owner]?.name || deck.player,
      ace: 'dark-magician', mechanic: '真人决斗者', cards: [], extra: [], description: '对手的构筑在本局中保密。'
    };
    const result = { lp: p.lp, deckId: spec.id, deckSpec: spec, deck: Array.from({ length: p.deck.length }, () => hidden()),
      deckCount: deck.cards.length, extraCount: deck.extra.length };
    for (const zone of ['hand', 'monsters', 'spells', 'grave', 'extra', 'banished']) {
      result[zone] = p[zone].map(c => c ? card({ card: c, owner, zone }) : null);
    }
    for (const zone of ['extraMonster', 'extraMonster2', 'fieldSpell']) {
      result[zone] = p[zone] ? card({ card: p[zone], owner, zone: zone.startsWith('extraMonster') ? 'extraMonster' : zone }) : null;
    }
    return result;
  }

  function candidate(c) {
    const f = e.find(c.uid), known = !!c.cardId && !c.hidden;
    const out = { ...pick(c, ['zone', 'mandatory']), uid: handle(c.uid), owner: side(c.owner ?? f?.owner), hidden: !!c.hidden };
    if (known) out.cardId = c.cardId;
    out.label = c.hidden ? '未公开卡片' : String(c.label || (known ? Data.CARDS[c.cardId]?.name : c.uid) || '选择');
    if (!c.hidden && c.detail) out.detail = String(c.detail);
    if (f && known) choices.push({ owner: side(f.owner), zone: f.zone, index: f.index, card: card(f, true) });
    return out;
  }

  function link(l) {
    const out = { ...pick(l, ['id', 'chainId', 'chainNumber', 'number', 'status', 'reason', 'byNumber', 'finished', 'key']), owner: side(l.owner), uid: handle(l.uid) };
    if (l.sourceId) out.sourceId = l.sourceId;
    if (l.cardId) out.cardId = l.cardId;
    // Source cards on a chain are public; target snapshots are not necessarily public.
    if (l.targetMeta) out.targetMeta = Object.fromEntries(Object.entries(l.targetMeta).map(([group, items]) => [group,
      Object.fromEntries(Object.entries(items).map(([uid, m]) => [handle(uid), {
        owner: side(m.owner), public: !!m.public,
        ...(m.public || m.owner === viewer ? { cardId: m.cardId } : {})
      }]))
    ]));
    if (l.targets) out.targets = l.targets.map(t => ({ owner: side(t.owner), byNumber: t.byNumber }));
    return out;
  }

  function pending(p) {
    if (!p) return null;
    if (p.responder !== viewer) return { kind: 'waiting', responder: 1, owner: side(p.owner), title: '等待对手完成选择' };
    const out = { ...pick(p, ['kind', 'purpose', 'title', 'min', 'max', 'cancelable']), responder: 0, owner: side(p.owner), uid: handle(p.uid) };
    if (p.candidates) out.candidates = p.candidates.map(candidate);
    if (p.group) out.group = { ...pick(p.group, ['key', 'title', 'role', 'min', 'max']), candidates: (p.group.candidates || []).map(candidate) };
    if (p.options) out.options = p.options.map(o => ({ ...pick(o, ['key', 'label', 'cardId']), uid: handle(o.uid) }));
    if (p.trigger) out.trigger = { ...pick(p.trigger, ['key', 'sourceId', 'mandatory']), owner: side(p.trigger.owner), uid: handle(p.trigger.uid) };
    if (p.ctx) out.ctx = { ...pick(p.ctx, ['key', 'sourceId', 'origin']), uid: handle(p.ctx.uid), owner: side(p.ctx.owner) };
    if (p.action) out.action = pick(p.action, ['type', 'position', 'mode']);
    if (p.sets) out.sets = p.sets.map(set => set.map(handle));
    if (p.spellId?.requiredUid) out.spellId = { requiredUid: handle(p.spellId.requiredUid) };
    if (p.context) {
      const c = p.context;
      out.context = { ...pick(c, ['kind']), owner: side(c.owner), uid: handle(c.uid) };
      if (c.chainLast) out.context.chainLast = link(c.chainLast);
      if (c.attack) out.context.attack = { ...pick(c.attack, ['stage']), owner: side(c.attack.owner), uid: handle(c.attack.uid), target: handle(c.attack.target) };
    }
    if (p.purpose === 'ritual' && e.find(p.uid)) out.ritualRequirement = e.ritualRequirement(p.spellId, e.find(p.uid).card);
    return out;
  }

  const state = {
    version: 3, logVersion: 1, mode: 'pvp', ...pick(s, ['turn', 'phase', 'normalUsed', 'startedAt', 'winKind']),
    active: side(s.active), winner: side(s.winner), resultReason: '', players: [player(viewer), player(1 - viewer)],
    damage: [s.damage[viewer], s.damage[1 - viewer]], summons: [s.summons[viewer], s.summons[1 - viewer]],
    chain: s.chain.map(link), chainHistory: s.chainHistory.map(link), pending: pending(s.pending),
    log: s.log.map(item => item.pvpLog?.[viewer]).filter(Boolean), nextLog: s.nextLog
  };
  // Effects still in force are public: they were created by resolved chain links.
  // Face-down cards keep their identity hidden from the other seat.
  state.activeEffects = (Lingering ? Lingering.collect(e) : []).map(entry => {
    const owner = [0, 1].includes(entry.owner) ? side(entry.owner) : null;
    const out = { ...pick(entry, ['n', 'scope', 'key', 'value', 'turn', 'until', 'chain', 'sourceId']), owner, by: [0, 1].includes(entry.by) ? side(entry.by) : null };
    if (entry.scope === 'card') {
      const ref = e.find(entry.uid), known = ref ? visible(e, ref, viewer) : false;
      out.uid = handle(entry.uid); out.faceUp = !!entry.faceUp; out.cardId = known ? entry.cardId : null;
    }
    return out;
  });
  if (s.winner !== null) {
    const kind = room.result?.kind || s.outcome?.kind || 'special';
    state.outcome = { kind, winner: side(s.winner), loser: side(s.winner === 0 ? 1 : s.winner === 1 ? 0 : null), turn: s.turn };
    if (s.outcome?.sourceId) state.outcome.sourceId = s.outcome.sourceId;
  }
  const legal = s.winner === null ? e.allActions(viewer) : [];
  const actions = legal.map(a => ({ ...pick(a, ['type', 'key', 'label', 'icon', 'mode', 'noTribute', 'slot']), ...(a.uid ? { uid: handle(a.uid) } : {}) }));
  const attackTargets = {};
  for (const a of legal.filter(a => a.type === 'attack')) {
    const c = e.find(a.uid).card;
    attackTargets[handle(a.uid)] = {
      targets: e.monsters(1 - viewer).filter(m => e.canAttack(c, viewer, m.uid)).map(m => handle(m.uid)),
      direct: !!e.canAttack(c, viewer, null) && (!e.monsters(1 - viewer).length || c.directAttackTurn === s.turn || !!e.canDirect?.(c, viewer))
    };
  }
  const topCards = [viewer, 1 - viewer].map(owner => {
    const c = e.publicDeckTop?.(owner);
    return c ? card({ card: c, owner, zone: 'deck' }, true) : null;
  });
  const coLinks = {};
  for (const owner of [0, 1]) for (const c of e.monsters(owner)) if (c.faceUp && Data.CARDS[c.id].type === 'link') coLinks[handle(c.uid)] = e.coLinked(c.uid).map(handle);
  const events = (room.events || []).flatMap(event => {
    if (event.kind.startsWith('chain-') && event.cardId) return [{ ...link(event), kind: event.kind, ...(event.entry ? { entry: link(event.entry) } : {}) }];
    if (event.pvpLog?.[viewer]) return [{ ...event.pvpLog[viewer], ...(event.uid && e.find(event.uid) && visible(e, e.find(event.uid), viewer) ? { uid: handle(event.uid) } : {}) }];
    if (event.kind === 'battle') return [{ kind: 'battle', owner: side(event.owner), uid: handle(event.uid), target: handle(event.target) }];
    return [];
  });
  const pendulumUids = legal.some(a => a.type === 'pendulum-summon') ? e.pendulumCandidates(viewer).map(c => handle(c.uid)) : [];
  return { refs, legal, data: { state, actions, choices, attackTargets, coLinks, topCards, pendulumUids,
    attackBlocked: [e.attackBlocked(viewer), e.attackBlocked(1 - viewer)],
    handRevealed: !!e.handRevealed?.(1 - viewer, viewer), events } };
}
