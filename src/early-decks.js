(function(root){
 'use strict';
 const D=root.DuelData?.earlyLoaded?root.DuelData:require('./early-cards.js');
 if(D.earlyDecksLoaded)return;
 const id=name=>{const c=D.cardByName(name);if(!c)throw new Error('Missing preset card: '+name);return c.id;};
 const entries=pairs=>pairs.flatMap(([name,n])=>Array(n).fill(id(name)));
 function preset(key,name,en,ace,mechanic,description,pairs,extra,combo){D.DECKS[key]={id:key,name,en,ace:id(ace),mechanic,description,player:name.split(' · ')[0],avatar:'early',subtitle:'从最初的一张卡，走向自己的决斗。',preset:true,cards:entries(pairs),extra:entries(extra),combo};}
 preset('early-ritual','仪式 · 混沌的降临','RITUAL · THE FIRST OATH','Black Luster Soldier','仪式 / 1999—2001','千手神寻找仪式怪兽，音速鸟寻找仪式魔法。用手牌与场上怪兽的等级完成解放，呼唤混沌战士与纳祭之魔。',[
  ['Black Luster Soldier',3],['Magician of Black Chaos',2],['Relinquished',2],['Senju of the Thousand Hands',3],['Sonic Bird',3],['Sangan',2],['Man-Eater Bug',2],['Blue-Eyes White Dragon',2],['Thunder Dragon',3],['Black Luster Ritual',3],['Black Magic Ritual',2],['Black Illusion Ritual',2],['Graceful Charity',2],['Pot of Greed',2],['Monster Reborn',1],['Mystical Space Typhoon',2],['Trap Hole',2],['Mirror Force',2]
 ],[],['千手神 / 音速鸟通常召唤检索缺少的一半。发动仪式魔法，在结算时选择仪式怪兽与解放素材。','8星青眼可以单独满足混沌战士的等级；纳祭之魔可吸收对方怪兽作装备，取得其攻击力与守备力。']);
 preset('early-fusion','融合 · 初代的羁绊','FUSION · ORIGINS','Blue-Eyes Ultimate Dragon','融合 / 初代','围绕早期通常怪兽与融合素材，利用检索、装备与反转效果稳住战场。',[
  ['Blue-Eyes White Dragon',3],['Thunder Dragon',3],['Battle Ox',3],['Mystic Horseman',3],['Gaia the Fierce Knight',2],['Curse of Dragon',2],['Man-Eater Bug',3],['Witch of the Black Forest',2],['Polymerization',3],['Fusion Sage',3],['Pot of Greed',2],['Graceful Charity',2],['Monster Reborn',1],['Raigeki',1],['Mystical Space Typhoon',2],['Swords of Revealing Light',1],['Trap Hole',3],['Mirror Force',1]
 ],[['Blue-Eyes Ultimate Dragon',2],['Twin-Headed Thunder Dragon',3],['Rabid Horseman',3],['Gaia the Dragon Champion',2]],['雷龙丢弃检索同名卡，用融合召唤双头雷龙。融合贤者可以寻找融合魔法。']);
 preset('gravekeeper-2002','守墓 · 王家长眠之谷','GRAVEKEEPER · NECROVALLEY','Gravekeeper\'s Chief','守墓 / 2002','王家长眠之谷让全体守墓+500攻守并封锁墓地移动。间谍与守卫以反转展开，首领解放召唤复活同伴，灵魂的仪式无视山谷直接苏生。',[
  ['Gravekeeper\'s Chief',2],['Gravekeeper\'s Assailant',2],['Gravekeeper\'s Spy',3],['Gravekeeper\'s Guard',2],['Gravekeeper\'s Spear Soldier',2],['Gravekeeper\'s Cannonholder',2],['Gravekeeper\'s Curse',1],['Gravekeeper\'s Vassal',1],
  ['Necrovalley',3],['Royal Tribute',2],['Book of Moon',2],['Mystical Space Typhoon',2],['Pot of Greed',1],['Dark Core',1],['Scapegoat',1],
  ['Rite of Spirit',3],['Coffin Seller',2],['Bottomless Trap Hole',2],['Torrential Tribute',1],['Needle Wall',2],['Trap Dustshoot',1],['Raigeki Break',2]
 ],[],['王家长眠之谷在场时，守墓全体+500攻守，双方墓地的移动与除外被封锁；守墓长的控制者墓地不受影响。','间谍反转拉出低攻守墓，守卫反转弹回对方怪兽；灵魂的仪式的复活不受王家长眠之谷影响。']);
 preset('chaos-2003','混沌 · 光与暗的使者','CHAOS · LIGHT AND DARK','Black Luster Soldier - Envoy of the Beginning','混沌 / 2003','用光与暗的怪兽积累墓地资源，混沌巫师与开辟的使者除外登场。反转与回收支撑中盘，保留防御牌等待反击。',[
  ['Black Luster Soldier - Envoy of the Beginning',2],['Chaos Sorcerer',2],['Thunder Dragon',3],['Shining Angel',3],['Mystic Tomato',3],['Breaker the Magical Warrior',2],['Magician of Faith',2],['Tsukuyomi',1],['Sangan',1],['Spirit Reaper',1],
  ['Pot of Greed',1],['Graceful Charity',2],['Foolish Burial',1],['Book of Moon',2],['Mystical Space Typhoon',2],['Snatch Steal',1],['Monster Reborn',1],['Raigeki',1],['Heavy Storm',1],['Waboku',2],['Sakuretsu Armor',2],['Torrential Tribute',1],['Mirror Force',1],['Compulsory Evacuation Device',2]
 ],[],['光暗各一只作为除外代价，特殊召唤混沌巫师或开辟的使者。','月之书与月读命帮助反转怪兽再次使用效果；没有额外收益的重复保护留待以后回合。']);
 preset('level-2004','LV · 龙的进化阶梯','LV · DRAGON ASCENSION','Horus the Black Flame Dragon LV8','LV升级 / 2004','武装龙在准备阶段升级，荷鲁斯在战斗破坏后进化。等级上升加速展开，沉默与反击保护成长中的怪兽。',[
  ['Horus the Black Flame Dragon LV4',3],['Horus the Black Flame Dragon LV6',2],['Horus the Black Flame Dragon LV8',1],['Armed Dragon LV3',3],['Armed Dragon LV5',2],['Armed Dragon LV7',1],['Masked Dragon',3],['Mirage Dragon',2],['Dekoichi the Battlechanted Locomotive',2],['Sangan',1],
  ['Pot of Greed',1],['Graceful Charity',1],['Level Up!',3],['Mystical Space Typhoon',2],['Book of Moon',2],['Monster Reborn',1],['The Graveyard in the Fourth Dimension',1],['Swords of Revealing Light',1],['Waboku',2],['Sakuretsu Armor',2],['Divine Wrath',2],['Call of the Haunted',1],['Torrential Tribute',1]
 ],[],['武装龙LV3在准备阶段送墓升级；荷鲁斯需要先取得战斗破坏。','等级上升无视登场条件，但不把魔法卡的升级当成前一级怪兽的效果。']);
 preset('darkworld-2005','暗黑界 · 从弃牌中归来','DARK WORLD · RETURN FROM DISCARD','Goldd, Wu-Lord of Dark World','暗黑界 / 2005','天使的施舍与暗黑界之雷以效果丢弃怪兽，武神与军神从墓地返回。暗之取引会把对方法术改写为弃牌，激活更强的追加效果。',[
  ['Goldd, Wu-Lord of Dark World',3],['Sillva, Warlord of Dark World',3],['Beiige, Vanguard of Dark World',3],['Broww, Huntsman of Dark World',3],['Brron, Mad King of Dark World',2],['Scarr, Scout of Dark World',2],['Sangan',1],['Dekoichi the Battlechanted Locomotive',2],['Des Wombat',1],
  ['Graceful Charity',3],['Dark World Lightning',3],['Gateway to Dark World',2],['Pot of Greed',1],['Card Destruction',1],['Mystical Space Typhoon',1],['Monster Reborn',1],['Dark Deal',2],['Divine Wrath',2],['Karma Cut',2],['Mirror Force',1],['Torrential Tribute',1]
 ],[],['暗黑界只响应卡片效果的丢弃；天罚或因果切断的弃牌代价不会让它们复活。','暗黑界之雷先破坏盖卡再丢弃；被对方效果丢弃时，武神与军神还有追加处理。']);
 if(typeof module!=='undefined'){require('./year-decks.js');require('./chronicle-decks.js');}
 D.earlyDecksLoaded=true;if(typeof module!=='undefined')module.exports=D;
})(globalThis);
