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
 D.earlyDecksLoaded=true;if(typeof module!=='undefined')module.exports=D;
})(globalThis);
