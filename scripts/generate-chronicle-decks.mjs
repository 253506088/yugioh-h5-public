import {readFile,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
import {writeAtomic} from './lib/io.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url),D=require('../src/early-cards.js');
require('../src/advanced-engine.js');
const sourceFiles=(await readdir(join(root,'data'))).filter(name=>name==='decks-2009-2012.json'||/^decks-\d{4}\.json$/.test(name)&&Number(name.slice(6,10))>=2013).sort();
const inputs=await Promise.all(sourceFiles.map(name=>readFile(join(root,'data',name),'utf8').then(JSON.parse)));
const input={scope:inputs.flatMap(i=>i.scope),decks:inputs.flatMap(i=>i.decks),sources:inputs.flatMap(i=>i.sources)};
const sideReport=[];
const decks=input.decks.map(row=>{
 const expand=(pairs,extra)=>pairs.flatMap(([name,count])=>{
  const card=D.cardByName(name);if(!card)throw Error('Unknown deck card: '+name);
  if(card.implementationStatus==='pending')throw Error('Unimplemented deck card: '+row.id+' / '+name);
  if(!Number.isInteger(count)||count<1||count>3)throw Error('Invalid count: '+row.id+' / '+name);
  if(!card.releaseYear||card.releaseYear>row.year)throw Error('Future card: '+row.id+' / '+name);
  if(D.isExtra(card)!==extra)throw Error('Wrong deck zone: '+name);
  return Array(count).fill(card.id);
 });
 const cards=expand(row.main,false),extra=expand(row.extra,true),ace=D.cardByName(row.ace);
 if((cards.length<40||cards.length>60)||extra.length>15||!ace)throw Error('Invalid deck size or ace: '+row.id);
 const counts=new Map();for(const id of [...cards,...extra])counts.set(id,(counts.get(id)||0)+1);if([...counts.values()].some(n=>n>3))throw Error('Combined copy limit: '+row.id);
 const side=[];for(const [name,n] of row.side||[]){const c=D.cardByName(name);let reason=!c?'unknown':c.implementationStatus==='pending'?'pending':!c.releaseYear||c.releaseYear>row.year?'future':null;const used=c?[...cards,...extra,...side].filter(id=>{const a=D.CARDS[id];return (a.nameAlias||a.officialName||a.en||a.name)===(c.nameAlias||c.officialName||c.en||c.name);}).length:0;if(!reason&&(used+n>3||side.length+n>15))reason='limit';if(reason)sideReport.push({deck:row.id,name,count:n,reason});else side.push(...Array(n).fill(c.id));}
 if(row.year>=2017&&sideReport.some(r=>r.deck===row.id))throw Error('Unavailable or invalid side deck card: '+row.id);
 return {side,sideSourceCount:(row.side||[]).reduce((n,p)=>n+p[1],0),id:row.id,name:row.title+' · '+row.year,en:row.en.toUpperCase(),ace:ace.id,mechanic:row.year+' / '+row.title,description:row.description,player:row.title,avatar:'early',subtitle:'重返这一年的决斗现场。',preset:true,year:row.year,sourceKind:row.sourceKind,sourceRefs:row.sourceRefs,cards,extra,combo:row.combo};
});
// 2021–2022 retain their delivered scope; 2023 onward requires five distinct builds.
for(const file of inputs)for(const year of file.scope){const minimum=year>=2023||year>=2017&&year<=2020?5:3;if(file.decks.filter(d=>d.year===year).length<minimum)throw Error('Expected at least '+minimum+' decks for '+year+' in one source file');}
if(new Set(decks.map(d=>d.id)).size!==decks.length)throw Error('Duplicate annual deck id');
const safe=v=>JSON.stringify(v).replace(/</g,'\\u003c');
await writeAtomic(join(root,'src/chronicle-decks.js'),`/* Generated from the data/decks-*.json rollout tables. */\n(function(root){'use strict';const D=root.DuelData;if(D.chronicleDecksLoaded)return;for(const deck of ${safe(decks)})D.DECKS[deck.id]=deck;D.chronicleDecksLoaded=true;if(typeof module!=='undefined')module.exports=D;})(globalThis);\n`);
const names=Object.fromEntries(input.decks.map(d=>[d.id,[d.en+' · '+d.year,d.ja+' · '+d.year]]));
// The 2009—2012 rows keep their translations here; newer rows carry descriptionEn /
// descriptionJa beside the decklist so a new year stays self-contained.
const legacyDescriptions={
 'blackwing-2009':['Black Whirlwind searches, Kalut protects battles, and Blizzard enables Synchro plays. Inspired by the 2009 world champion.','黒い旋風でサーチし、カルートで戦闘を支援。ブリザードからシンクロへ。2009年世界王者の戦術を参考にした構築。'],
 'cat-gladiator-2009':['Rescue Cat supports Gladiator Beast tag-outs and Contact Fusion. Inspired by the 2009 runner-up.','レスキューキャットから剣闘獣を展開し、戦闘後の交代とコンタクト融合へ。2009年世界準優勝の戦術が基礎。'],
 'cat-synchro-2009':['A popular 2009 alternative: Summoner Monk, Rescue Cat and Flamvell build flexible Synchro combinations.','2009年に活躍した猫シンクロ。サモンプリースト、レスキューキャット、フレムベルでレベルを組み合わせる。'],
 'frog-ftk-2010':['Inspired by the 2010 champion: Swap Frog, Substitoad and Ronintoadin recycle resources into Mass Driver damage.','2010年世界王者のガエルを参考に、鬼ガエル、イレカエル、粋カエルをマスドライバーのダメージへつなぐ。'],
 'blackwing-2010':['The 2010 Blackwing engine adds Zephyros and resource Spells. Draw cards before committing to a Summon route.','2010年のBFにゼピュロスやドロー魔法を採用。特殊召喚を制限する魔法の使用順に注意。'],
 'herald-2010':['Inspired by the 2010 third-place strategy: exact Ritual Levels and Fairy cards in hand support Herald negation.','2010年世界3位の宣告者を参考にした構築。儀式のレベル合計と手札の天使族で神光の宣告者を支える。'],
 'agents-2011':['Inspired by the 2011 champion: Earth searches, Venus summons Shine Balls, and Hyperion converts the Graveyard into removal.','2011年世界王者の代行天使。アースでサーチ、ヴィーナスで球体を展開し、ヒュペリオンで墓地を除去に使う。'],
 'junk-doppel-2011':['Junk Doppel links Tokens and Plant Tuners into Formula Synchron, Hyper Librarian and Shooting Quasar Dragon.','ジャンクドッペル。トークンと植物チューナーからフォーミュラ、ライブラリアン、シューティング・クェーサーへ。'],
 'six-samurai-2011':['A popular 2011 alternative: Kageki and Kagemusha summon Shi En, while Dojo and United replenish resources.','2011年の代表的な真六武衆。カゲキと影武者からシエンへ。道場と結束で展開を継続。'],
 'inzektor-2012':['Inspired by the Inzektor-heavy 2012 Worlds: Hornet leaving its host triggers Dragonfly or Centipede; Ladybug changes Levels.','甲虫装機が上位を占めた2012年世界大会が基礎。ホーネットの装備解除からダンセルとセンチピードを展開。'],
 'wind-up-2012':['A varied 2012 alternative: Shark adjusts Levels, Magician and Rat extend plays, and Zenmaity connects Rank 3 monsters.','2012年を代表するゼンマイ。シャークのレベル調整とマジシャン、ネズミの展開でランク3につなぐ。'],
 'mermail-atlantean-2012':['A late-2012 WATER strategy. Discard Atlanteans as WATER monster costs, and use Abyss-sphere and Linde to extend plays.','2012年後半の水精鱗海皇。水属性の効果コストで海皇を墓地へ送り、アビスフィアーとリンデで展開を継続。']
};
const descriptions=Object.fromEntries(input.decks.map(d=>[d.id,d.descriptionEn?[d.descriptionEn,d.descriptionJa]:legacyDescriptions[d.id]]));
for(const [id,value] of Object.entries(descriptions))if(!value?.[0]||!value?.[1])throw Error('Missing localized description: '+id);
await writeAtomic(join(root,'src/i18n-chronicle.js'),`/* Annual preset translations generated by generate-chronicle-decks.mjs. */\n(function(root){'use strict';const ui=root.DuelUITranslations;const names=${safe(names)},descriptions=${safe(descriptions)};for(const [id,labels] of Object.entries(names)){ui.deckNames[id]=labels;ui.deckDescriptions[id]=descriptions[id];const d=root.DuelData.DECKS[id];ui.messages[d.player]={en:labels[0].split(' · ')[0],ja:labels[1].split(' · ')[0]};ui.messages[d.mechanic]={en:labels[0].replace(' · ',' / '),ja:labels[1].replace(' · ',' / ')};}const chronicle=root.DuelData.families.early,lastYear=Math.max(...root.DuelData.earlyYears);ui.messages[chronicle]={en:'Card Chronicle · 1999–'+lastYear,ja:'カード年代記 · 1999–'+lastYear};})(globalThis);\n`);
await writeAtomic(join(root,'docs/side-deck-availability.json'),JSON.stringify({decks:decks.map(d=>({id:d.id,available:d.side.length,source:d.sideSourceCount})),excluded:sideReport},null,2)+'\n');
console.log(`Generated ${decks.length} annual decks, all 40–60 cards and within their OCG candidate year.`);
