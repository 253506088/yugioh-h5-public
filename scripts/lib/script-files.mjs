export const styleFiles = ['style.css', 'expansion.css', 'link.css', 'early.css','experience.css','tournament.css','polish.css','log.css','pvp.css','lingering.css'];
export const scriptFiles = ['cards.js', 'expansion-cards.js', 'link-cards.js', 'early-cards.js', 'early-decks.js', 'link-rules.js', 'deck-tools.js', 'engine.js', 'advanced-engine.js', 'early-engine.js', 'advanced-effects.js', 'effects-classic.js', 'effects-hero.js', 'effects-blackwing.js', 'effects-synchron.js', 'effects-utopia.js', 'effects-qliphort.js', 'effects-exodia.js', 'effects-cyber.js', 'effects-crystron.js', 'effects-tearlaments.js', 'effects-link.js', 'effects-early.js', 'effects-early-spells.js', 'effects-early-monsters.js', 'effects-early-traps.js', 'audio.js', 'artwork-hybrid.js', 'card-view.js', 'workshop.js', 'game-v2.js'];
scriptFiles.splice(scriptFiles.indexOf('engine.js'),0,'duel-outcome.js');
scriptFiles.splice(scriptFiles.indexOf('engine.js'),0,'duel-log.js');
scriptFiles.splice(scriptFiles.indexOf('audio.js'),0,'effects-early-complex.js','effects-early-advanced.js');
scriptFiles.splice(scriptFiles.indexOf('audio.js'),0,'effects-2002.js','effects-2002-monsters.js','effects-2002-spells.js','effects-2002-traps.js');
scriptFiles.splice(scriptFiles.indexOf('audio.js'),0,'effects-2003.js','effects-2003-monsters.js','effects-2003-spells.js','effects-2003-traps.js');
scriptFiles.splice(scriptFiles.indexOf('audio.js'),0,'effects-2004.js','effects-2004-monsters.js','effects-2004-spells.js','effects-2004-traps.js');
scriptFiles.splice(scriptFiles.indexOf('audio.js'),0,'effects-2005.js','effects-2005-monsters.js','effects-2005-monsters-extra.js','effects-2005-spells.js','effects-2005-traps.js');
for(const y of [2006,2007,2008]){const files=y===2006?['','-monsters','-monsters-extra','-spells','-traps']:y===2007?['','-monsters','-extra','-spells','-traps']:['','-monsters','-extra','-spells','-traps'];scriptFiles.splice(scriptFiles.indexOf('audio.js'),0,...files.map(s=>'effects-'+y+s+'.js'));}
scriptFiles.splice(scriptFiles.indexOf('audio.js'),0,'effects-year-final.js','effects-chronicle.js','effects-2009.js','effects-2009-monsters.js','effects-2009-monsters-extra.js','effects-2009-extra.js','effects-2009-final.js','effects-2009-spells.js','effects-2009-traps.js','effects-2010.js','effects-2010-monsters.js','effects-2010-monsters-extra.js','effects-2010-extra.js','effects-2010-spells.js','effects-2010-spells-extra.js','effects-2010-traps.js','effects-2011.js','effects-2011-monsters.js','effects-2011-monsters-extra.js','effects-2011-extra.js','effects-2011-spells.js','effects-2011-traps.js','effects-2012.js','effects-2012-monsters.js','effects-2012-monsters-extra.js','effects-2012-extra.js','effects-2012-spells.js','effects-2012-traps.js','effects-2013.js','effects-2013-monsters.js','effects-2013-monsters-extra.js','effects-2013-mecha.js','effects-2013-extra.js','effects-2013-firefist.js','effects-2013-sylvan.js','effects-2013-themes.js','effects-2013-gagaga.js','effects-2013-xyz.js','effects-2013-monsters-b.js','effects-2013-extra-b.js','effects-2013-monsters-c.js','effects-2013-spells-b.js','effects-2013-traps-b.js','effects-2013-final.js','effects-2013-spells.js','effects-2013-traps.js','effects-chronicle-contracts.js','chronicle-rules.js','chronicle-continuous.js','chronicle-costs.js','chronicle-copies.js','effects-2014.js','effects-2014-themes.js','effects-2014-nekroz.js','effects-2014-support.js','effects-2014-pendulum.js','effects-2014-samurai.js','effects-2014-monarch.js','effects-2014-knights.js','effects-2014-archetypes.js','effects-2014-monsters.js','effects-2014-spells.js','effects-2014-traps.js','effects-2014-xyz.js','effects-2014-final.js','effects-2015.js','effects-2015-pendulum.js','effects-2015-support.js','effects-2015-abyss.js','effects-2015-monarch.js','effects-2015-machines.js','effects-2015-zefra.js','effects-2015-dd.js','effects-2015-phantom.js','effects-2015-speedroid.js','effects-2015-spells.js','effects-2015-traps.js','effects-2015-fusion.js','effects-2015-red-eyes.js','effects-2015-legend.js','effects-2015-toon.js','effects-2015-raidraptor.js','effects-2015-garden.js','effects-2015-athletes.js','effects-2015-quantum.js','effects-2015-samurai.js','effects-2015-buster.js','effects-2015-performers.js','effects-2015-magicians.js','effects-2015-monsters.js','effects-2015-extra.js','effects-2015-xyz.js','effects-2015-void.js','effects-2015-ritual.js','effects-2015-final-cards.js','effects-2015-final.js','effects-2016.js','effects-2016-blue-eyes.js','effects-2016-zoodiac.js','effects-2016-staples.js','effects-2016-kaiju.js','effects-2016-ritual.js','effects-2016-abc.js','effects-2016-metalfoes.js','effects-2016-invoked.js','effects-2016-darklord.js','effects-2016-lunalight.js','effects-2016-kozmo.js','effects-2016-final.js','effects-2017.js','effects-2017-dinosaur.js','effects-2017-draco.js','effects-2017-trickstar.js','effects-2017-spyral.js','effects-2017-links.js','effects-2017-support.js','effects-2017-expansion.js','effects-2017-final.js','effects-2018.js','effects-2018-striker.js','effects-2018-altergeist.js','effects-2018-gouki.js','effects-2018-thunder.js','effects-2018-links.js','effects-2018-support.js','effects-2018-final.js','effects-2019.js','effects-2019-salamangreat.js','effects-2019-orcust.js','effects-2019-dragons.js','effects-2019-endymion.js','effects-2019-support.js','effects-2019-final.js','effects-2020.js','effects-2020-eldlich.js','effects-2020-dogmatika.js','effects-2020-adamancipator.js','effects-2020-virtual-world.js','effects-2020-support.js','effects-2020-final.js','effects-2021.js','effects-2021-swordsoul.js','effects-2021-tenyi.js','effects-2021-tri-brigade.js','effects-2021-floowandereeze.js','effects-2021-support.js','effects-2021-final.js','effects-2022.js','effects-2022-spright.js','effects-2022-ishizu.js','effects-2022-support.js','effects-2022-final.js','effects-2023.js','effects-2023-bystial.js','effects-2023-vanquish.js','effects-2023-purrely.js','effects-2023-rescue.js','effects-2023-support.js','effects-2023-final.js','effects-2024.js','effects-2024-fiendsmith.js','effects-2024-yubel.js','effects-2024-snake-eye.js','effects-2024-tenpai.js','effects-2024-final.js','effects-2025.js','effects-2025-maliss.js','effects-2025-ryzeal.js','effects-2025-k9.js','effects-2025-lunalight.js','effects-2025-striker.js','effects-2025-support.js','effects-2025-final.js','field-copies.js');
scriptFiles.splice(scriptFiles.indexOf('early-decks.js')+1,0,'year-decks.js','chronicle-decks.js');
scriptFiles.splice(scriptFiles.indexOf('audio.js'),0,'log-engine.js');
scriptFiles.splice(scriptFiles.indexOf('advanced-effects.js'),0,'early-engine-extra.js');
scriptFiles.splice(scriptFiles.indexOf('advanced-effects.js'),0,'ai-marginal.js');
scriptFiles.splice(scriptFiles.indexOf('advanced-effects.js'),0,'ai-tactics.js');
scriptFiles.splice(scriptFiles.indexOf('advanced-effects.js'),0,'ai-planner.js');
scriptFiles.splice(scriptFiles.indexOf('advanced-engine.js'),0,'lingering.js');
scriptFiles.splice(scriptFiles.indexOf('i18n.js'),0,'i18n-lingering.js');
scriptFiles.splice(scriptFiles.indexOf('engine.js'),0,'card-locales.js','archetype-data.js','archetypes.js');
scriptFiles.splice(scriptFiles.indexOf('audio.js'),0,'i18n-data.js','i18n-effects.js','i18n-help.js','i18n-experience.js','i18n-tournament.js','i18n.js','experience.js');
scriptFiles.splice(scriptFiles.indexOf('game-v2.js'),0,'tournament.js','tournament-storage.js','tournament-ui.js');
scriptFiles.splice(scriptFiles.indexOf('game-v2.js'),0,'log-ui.js');
scriptFiles.splice(scriptFiles.indexOf('i18n.js'),0,'i18n-ai.js');
scriptFiles.splice(scriptFiles.indexOf('i18n.js'),0,'i18n-years.js','i18n-years-gx.js','i18n-chronicle.js','i18n-chronicle-ui.js','i18n-2016.js','i18n-2017.js','i18n-2018.js','i18n-2019.js','i18n-2020.js','i18n-2021.js','i18n-2022.js','i18n-2023.js','i18n-2024.js','i18n-2025.js');
scriptFiles.splice(scriptFiles.indexOf('i18n.js'),0,'i18n-polish.js','i18n-pvp.js');
scriptFiles.splice(scriptFiles.indexOf('game-v2.js'),0,'pvp-client.js','pvp-ui.js');
styleFiles.push('ai-import.css');
scriptFiles.splice(scriptFiles.indexOf('card-locales.js')+1,0,'card-catalog.js');
scriptFiles.splice(scriptFiles.indexOf('i18n.js'),0,'i18n-ai-import.js');
scriptFiles.splice(scriptFiles.indexOf('workshop.js'),0,'deck-parse.js','card-resolver.js','deck-research.js','ai-provider.js','ai-import-ui.js');
scriptFiles.splice(scriptFiles.indexOf('log-engine.js')+1,0,'rule-modes.js');
scriptFiles.splice(scriptFiles.indexOf('game-v2.js'),0,'rule-modes-ui.js');
styleFiles.push('rule-modes.css');
scriptFiles.splice(scriptFiles.indexOf('deck-tools.js')+1,0,'deck-editor.js','match-core.js');
scriptFiles.splice(scriptFiles.indexOf('pvp-ui.js'),0,'match-ui.js');
scriptFiles.splice(scriptFiles.indexOf('game-v2.js'),0,'match-ai.js');
styleFiles.push('workshop.css');
scriptFiles.splice(scriptFiles.indexOf('i18n.js'),0,'i18n-matches.js');

styleFiles.push('optimization.css');
scriptFiles.splice(scriptFiles.indexOf('game-v2.js'),0,'board-layout.js');

scriptFiles.splice(scriptFiles.indexOf('i18n.js'),0,'i18n-optimization.js');
scriptFiles.splice(scriptFiles.indexOf('i18n.js'),0,'literal-pattern.js');

scriptFiles.splice(scriptFiles.indexOf('game-v2.js'),0,'worker-client.js');

scriptFiles.splice(scriptFiles.indexOf('pvp-ui.js'),0,'pvp-public.js','pvp-projection.js','pvp-intent.js','p2p.js','p2p-ui.js');
