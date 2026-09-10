const { DuelEngine } = require('../src/engine.js');
const { DECKS, CARDS } = require('../src/cards.js');
const fs = require('node:fs');
const path = require('node:path');
const originalDeck = [...require('../output/balance-baseline/cards.js').DECKS.dark.cards];
const originalAI = require('../output/balance-baseline/engine.js').DuelEngine.prototype.aiNext;
const expand = entries => entries.flatMap(([id, n]) => Array(n).fill(id));
const revisedDeck = expand([['dark-magician', 3], ['dark-girl', 1], ['skilled-magician', 3], ['breaker', 3], ['celtic-guardian', 1], ['stone-soldier', 2], ['summoned-skull', 1], ['gaia', 1], ['curse-dragon', 2], ['kuriboh', 1], ['pot-of-greed', 2], ['monster-reborn', 2], ['dark-hole', 1], ['fissure', 2], ['mst', 2], ['swords', 1], ['polymerization', 1], ['dian-keto', 1], ['ancient-rules', 2], ['mirror-force', 3], ['magic-cylinder', 2], ['trap-hole', 1], ['negate-attack', 2]]);
function improvedAI() {
  const s = this.state;
  if (s.winner === null && !s.pending && ['main1', 'main2'].includes(s.phase) && !s.normalUsed && this.activePlayer.monsters.includes(null)) {
    const skilled = this.activePlayer.hand.find(c => c.id === 'skilled-magician');
    if (skilled && this.spellCandidates().some(c => !CARDS[c.id].target || this.targetsFor(c).length)) return { type: 'summon', uid: skilled.uid, mode: 'attack' };
  }
  return originalAI.call(this);
}
const reports = [];
for (const variant of ['original', 'mage-priority', 'revised-deck-and-priority']) {
  DECKS.dark.cards = variant === 'revised-deck-and-priority' ? revisedDeck : originalDeck;
  DuelEngine.prototype.aiNext = variant === 'original' ? originalAI : improvedAI;
  const report = { variant, deckSize: DECKS.dark.cards.length, matches: 240, blueWins: 0, darkWins: 0, totalTurns: 0 };
  for (let seed = 1; seed <= report.matches; seed++) {
    const g = new DuelEngine({ seed: seed * 719, deck: seed % 2 ? 'blue' : 'dark', first: Math.floor(seed / 2) % 2 });
    let actions = 0;
    while (g.state.winner === null && actions++ < 1500) { const r = g.act(g.aiNext()); if (!r.ok) throw new Error(r.error); }
    if (g.state.winner === null) throw new Error('Unfinished match');
    report[g.state.players[g.state.winner].deckId + 'Wins']++; report.totalTurns += g.state.turn;
  }
  reports.push(report); console.log(JSON.stringify(report));
}
DECKS.dark.cards = originalDeck; DuelEngine.prototype.aiNext = originalAI;
fs.writeFileSync(path.join(__dirname, '../output/balance-study.json'), JSON.stringify(reports, null, 2));
