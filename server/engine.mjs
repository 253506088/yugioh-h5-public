import { createRequire } from 'node:module';
import { randomInt } from 'node:crypto';

const require = createRequire(import.meta.url);
const { DuelEngine } = require('../src/advanced-engine.js');
export const Match = require('../src/match-core.js');
export const Data = globalThis.DuelData;
export const Decks = globalThis.DuelDecks;
export const Lingering = globalThis.DuelLingering;

const {visible,journalEntry}=require('../src/pvp-public.js').create(Data);
export {visible};

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
    if (!input || !Array.isArray(input.cards) || !Array.isArray(input.extra) || input.cards.length > 60 || input.extra.length > 15 || input.side !== undefined && (!Array.isArray(input.side) || input.side.length > 15)) {
      throw new Error('请选择一套预设卡组，或提交 40–60 张主卡组与至多 15 张额外卡组。');
    }
    deck = { name: typeof input.name === 'string' ? input.name.trim() : '', cards: [...input.cards], extra: [...input.extra], side: [...(input.side||[])] };
  }
  const check = Decks.analyze(deck);
  if (!check.valid) throw new Error(check.errors.slice(0, 4).join(' '));
  return deck;
}
