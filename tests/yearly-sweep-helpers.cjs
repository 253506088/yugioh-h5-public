const assert=require('node:assert/strict');
const {DuelEngine}=require('../src/advanced-engine.js');
const D=global.DuelData,E=global.DuelEffects;
const id=name=>D.CARDS[name]?name:D.cardByName(name)?.id;
function put(e,p,z,name,props={}){const key=id(name);assert.ok(key,'unknown fixture card '+name);const m=e.makeCard(key,p);Object.assign(m,{faceUp:true,position:'attack',summonTurn:0,setTurn:0,changedTurn:0},props);const state=e.state.players[p];if(['monsters','spells'].includes(z)){assert.ok(state[z].includes(null),'fixture has no '+z+' slot for '+name);state[z][props.slot??state[z].indexOf(null)]=m;}else if(z==='fieldSpell')state.fieldSpell=m;else state[z].push(m);e.state.originalCardCount=e.physicalCards().filter(m=>D.CARDS[m.id].type!=='token').length;return m;}
function act(e,a){const r=e.act(a);assert.ok(r.ok,JSON.stringify(a)+' : '+r.error);return r;}
function settle(e,focus=null,seen=new Set()){let guard=0;while(e.state.pending&&e.state.winner===null&&guard++<180){const p=e.state.pending;let a;if(p.kind==='window'){const option=p.options.find(o=>o.uid===focus&&!seen.has(o.uid+'|'+o.key));if(option){seen.add(option.uid+'|'+option.key);a={type:'respond',uid:option.uid,key:option.key};}else a={type:'pass'};}else if(p.kind==='trigger'&&!p.trigger.mandatory&&p.trigger.uid!==focus)a={type:'pass'};else a=e.chooseAI(p);act(e,a);}assert.ok(guard<180,'effect pipeline did not terminate');e.assertState();}
function run(e,a,focus=null){act(e,a);settle(e,focus);}
function clear(e,p,zone){for(const f of [...e.refs(p,[zone])])e.move(f.card.uid,'grave',{kind:'rule-fixture'});e.state.triggers=[];e.state.tasks=[];e.state.pending=null;e.state.frame=null;}
function fresh(){const e=new DuelEngine({deck:'blue',opponentDeck:'dark',seed:200305,first:0});e.state.turn=6;e.state.phase='main1';for(const p of e.state.players){p.deck.push(...p.hand);p.hand=[];p.lp=16000;}
 put(e,0,'monsters','Battle Ox');put(e,0,'monsters','Blue-Eyes White Dragon');put(e,1,'monsters','Blue-Eyes White Dragon');put(e,1,'monsters','Man-Eater Bug',{faceUp:false,position:'defense'});
 for(const name of ['Dark Magician','Battle Ox','Mystical Shine Ball','Harpie Lady','Red Medicine','Sparks','Mystical Space Typhoon'])put(e,0,'hand',name);
 for(const name of ['Blue-Eyes White Dragon','Mystic Tomato','Harpie Lady','Mother Grizzly','UFO Turtle','Giant Rat','Mystical Shine Ball','Pot of Greed','Monster Reborn','Sword of Deep-Seated'])put(e,0,'grave',name);
 for(const name of ['Dark Magician','Battle Ox','Sparks','Pot of Greed','Monster Reborn'])put(e,1,'hand',name);
 put(e,1,'grave','Blue-Eyes White Dragon');put(e,1,'grave','Pot of Greed');put(e,1,'spells','Call of the Haunted',{faceUp:false});return e;}
function knownAction(e,c){return e.state.log.some(l=>l.key?.startsWith(c.id+'::')||l.cardId===c.id&&['summon','special','spell','trap','ritual','stance','reveal'].includes(l.kind));}
function battle(e,p,uid,target,focus){if(e.state.winner!==null)return;e.state.active=p;e.state.phase='battle';const f=e.find(uid);if(f&&e.canAttack(f.card,p,target)){const r=e.act({type:'attack',uid,...(target?{target}:{})});if(r.ok)settle(e,focus);}}
function battery(e,m){if(e.state.winner!==null)return;
 for(const p of [0,1]){e.state.active=p;e.state.phase='main1';e.state.frame={kind:'standby',owner:p,stage:1,windowOffered:true};e.emit({type:'standby',owner:p});e.pump();settle(e,m.uid);if(e.state.winner!==null)return;}
 e.state.active=1;e.state.phase='main1';e.state.frame=null;
 for(const name of ['Pot of Greed','Sparks','Monster Reborn','Mystical Space Typhoon','Raigeki','Giant Trunade']){const c=e.state.players[1].hand.find(m=>m.id===id(name));if(c){const ability=E.available(e,1,{kind:'main',phase:'main1'}).find(a=>a.uid===c.uid);if(ability)run(e,{type:'activate',uid:c.uid,key:ability.key},m.uid);}}
 if(e.state.winner!==null)return;e.state.normalUsed=false;const summoning=D.CARDS[m.id].officialName==='Blast Held by a Tribute'?'Summoned Skull':D.CARDS[m.id].officialName==='Chain Disappearance'?'Mystical Shine Ball':'Battle Ox';const summoned=put(e,1,'hand',summoning);if(e.canNormal(summoned,1)&&e.tributeSets(summoned,false,1).length)run(e,{type:'summon',uid:summoned.uid,...(D.CARDS[m.id].officialName==='D.D. Trap Hole'?{mode:'defense'}:{}),...(summoning==='Summoned Skull'?{tributes:[e.monsters(1)[0].uid]}:{})},m.uid);
 if(D.CARDS[m.id].officialName==='Trap Jammer'){e.state.phase='battle';const trap=put(e,1,'spells','Jar of Greed',{faceUp:false});run(e,{type:'activate',uid:trap.uid,key:trap.id+'::cast'},m.uid);}
 const attacker=e.monsters(1).find(x=>x.faceUp&&x.position==='attack');if(attacker)battle(e,1,attacker.uid,e.monsters(0)[0]?.uid,m.uid);
 if(D.CARDS[m.id].officialName==='Hero Spirit'){const next=e.monsters(1).find(x=>x.uid!==attacker?.uid&&x.faceUp&&x.position==='attack');if(next)battle(e,1,next.uid,null,m.uid);}
 if(e.state.winner!==null)return;const mine=e.find(m.uid);if(mine&&['monsters','extraMonster'].includes(mine.zone))battle(e,0,m.uid,e.monsters(1).find(x=>x.faceUp)?.uid,m.uid);
 if(e.state.winner!==null)return;e.state.active=0;e.state.phase='main1';e.state.frame=null;e.endTurn();e.pump();settle(e,m.uid);
 if(e.state.winner!==null)return;if(e.find(m.uid)&&!['grave','banished'].includes(e.find(m.uid).zone)){e.destroy(m.uid,{id:id('Raigeki'),owner:1,effectType:'spell'});e.pump();settle(e,m.uid);}e.assertState();}
const setup2003={
 'Checkmate':e=>{put(e,0,'monsters','Terrorking Archfiend');put(e,0,'monsters','Archfiend Soldier');},
 'Terrorking Archfiend':e=>put(e,0,'monsters','Archfiend Soldier'),
 'Falling Down':e=>put(e,0,'monsters','Archfiend Soldier'),
 "Archfiend's Roar":e=>put(e,0,'grave','Archfiend Soldier'),
 'Battle-Scarred':e=>put(e,0,'monsters','Archfiend Soldier'),
 "Sage's Stone":e=>put(e,0,'monsters','Dark Magician Girl'),
 "Knight's Title":e=>{put(e,0,'monsters','Dark Magician');put(e,0,'deck','Dark Magician Knight');},
 'Dedication through Light and Darkness':e=>{put(e,0,'monsters','Dark Magician');put(e,0,'deck','Dark Magician of Chaos');},
 'Primal Seed':e=>{put(e,0,'monsters','Black Luster Soldier - Envoy of the Beginning');put(e,0,'banished','Pot of Greed');put(e,0,'banished','Battle Ox');},
 'Ojama Delta Hurricane!!':e=>{clear(e,0,'monsters');for(const name of ['Ojama Green','Ojama Yellow','Ojama Black'])put(e,0,'monsters',name);},
 'Dark Scorpion Combination':e=>{clear(e,0,'monsters');for(const name of ['Don Zaloog','Dark Scorpion - Cliff the Trap Remover','Dark Scorpion - Chick the Yellow','Dark Scorpion - Gorg the Strong','Dark Scorpion - Meanae the Thorn'])put(e,0,'monsters',name);},
 'Mustering of the Dark Scorpions':e=>{put(e,0,'monsters','Don Zaloog');put(e,0,'hand','Dark Scorpion - Meanae the Thorn');},
 'Fuhma Shuriken':e=>put(e,0,'monsters','Strike Ninja'),
 'Ninjitsu Art of Transformation':e=>{put(e,0,'monsters','Strike Ninja');put(e,0,'deck','Battle Ox');},
 'Magic Formula':e=>put(e,0,'monsters','Dark Magician'),
 'Cestus of Dagla':e=>put(e,0,'monsters','Mystical Shine Ball'),
 'Amplifier':e=>put(e,0,'monsters','Jinzo'),
 'Opti-Camouflage Armor':e=>put(e,0,'monsters','Kuriboh'),
 'Spell Reproduction':e=>put(e,0,'hand','Pot of Greed'),
 'Chaos End':e=>{for(let i=0;i<7;i++)put(e,0,'banished','Battle Ox');},
 'Chaos Greed':e=>{for(const f of [...e.refs(0,['grave'])])e.move(f.card.uid,'banished',{kind:'rule-fixture'});},
 'Dimension Distortion':e=>{for(const f of [...e.refs(0,['grave'])])e.move(f.card.uid,'banished',{kind:'rule-fixture'});},
 'Dimension Fusion':e=>{put(e,0,'banished','Blue-Eyes White Dragon');put(e,1,'banished','Dark Magician');},
 'Ultra Evolution Pill':e=>{put(e,0,'monsters','Gagagigo');put(e,0,'hand','Dark Driceratops');},
 'Multiplication of Ants':e=>put(e,0,'monsters','Pinch Hopper'),
 'Jade Insect Whistle':e=>put(e,1,'deck','Pinch Hopper'),
 'Salvage':e=>{put(e,0,'grave','Mother Grizzly');},
 'Magical Dimension':e=>put(e,0,'monsters','Dark Magician'),
 'Ray of Hope':e=>put(e,0,'grave','Mystical Shine Ball'),
 'Solar Ray':e=>put(e,0,'monsters','Mystical Shine Ball'),
 'Light of Judgment':e=>put(e,0,'fieldSpell','The Sanctuary in the Sky'),
 'Frozen Soul':e=>{e.state.players[0].lp=10000;},
 'Self-Destruct Button':e=>{e.state.players[0].lp=1000;},
 'Blasting the Ruins':e=>{for(let i=0;i<30;i++)put(e,0,'grave','Battle Ox');},
 'Talisman of Trap Sealing':e=>put(e,0,'monsters','Sealmaster Meisei'),
 'Talisman of Spell Sealing':e=>put(e,0,'monsters','Sealmaster Meisei'),
 'Levia-Dragon - Daedalus':e=>put(e,0,'fieldSpell','Umi'),
 'Fenrir':e=>put(e,0,'grave','Mother Grizzly'),
 'Mazera DeVille':e=>{put(e,0,'fieldSpell','Pandemonium');put(e,0,'monsters','Warrior of Zera');},
 'Archlord Zerato':e=>{put(e,0,'fieldSpell','The Sanctuary in the Sky');put(e,0,'monsters','Warrior of Zera');},
 'Dark Magician Knight':e=>{put(e,0,'monsters','Dark Magician');put(e,0,'hand',"Knight's Title");},
 'Victory Dragon':e=>{clear(e,0,'monsters');for(let i=0;i<3;i++)put(e,0,'monsters','Blue-Eyes White Dragon');},
 'Judgment of Anubis':e=>put(e,1,'hand','Mystical Space Typhoon'),
 "Fiend's Hand Mirror":e=>{put(e,1,'hand','Mystical Space Typhoon');put(e,0,'spells','Soul Absorption');},
};
function exercise(card,setup={}){const e=fresh(),fn=setup[card.officialName]||setup2003[card.officialName];fn?.(e);let m;
 if(card.type==='fusion'){m=put(e,0,'extra',card.id);const via=card.specialOnly||'fusion';if(e.canSpecial(0,m,{via}))e.special(0,m.uid,{via});e.pump();settle(e,m.uid);}
 else if(card.type==='ritual'){m=put(e,0,'hand',card.id);const spell=D.CARD_LIST.find(c=>c.ritualTarget===card.id||c.ritualTargets?.includes(card.id));assert.ok(spell,'ritual spell exists');const s=put(e,0,'hand',spell.id);put(e,0,'hand','Blue-Eyes White Dragon');run(e,{type:'activate',uid:s.uid,key:s.id+'::cast'},m.uid);}
 else if(card.type==='monster'){m=put(e,0,'hand',card.id);if(card.noNormal){if(card.officialName==='Dark Magician Knight'){const s=e.state.players[0].hand.find(m=>m.id===id("Knight's Title"));run(e,{type:'activate',uid:s.uid,key:s.id+'::cast'},m.uid);}else{const a=E.available(e,0,{kind:'main',phase:'main1'}).find(a=>a.uid===m.uid);if(a)run(e,{type:'activate',uid:m.uid,key:a.key},m.uid);else{assert.ok(e.canSpecial(0,m,{via:card.specialOnly||'effect'}),'a legal special-summon channel exists for '+card.officialName);e.special(0,m.uid,{via:card.specialOnly||'effect'});settle(e,m.uid);}}}else if(card.flip){e.remove(m.uid);e.state.players[0].monsters[e.state.players[0].monsters.indexOf(null)]=m;m.faceUp=false;m.position='defense';run(e,{type:'stance',uid:m.uid},m.uid);}else run(e,{type:'summon',uid:m.uid,...(card.setOnly?{mode:'defense'}:{})},m.uid);}
 else{m=put(e,0,card.type==='trap'||card.spellKind==='quick'?'spells':'hand',card.id,{faceUp:false});if(card.spellKind==='ritual'){const target=card.ritualTarget||card.ritualTargets?.[0]||D.CARD_LIST.find(c=>c.type==='ritual'&&c.attribute===card.ritualAttribute)?.id;put(e,0,'hand',target);put(e,0,'hand','Blue-Eyes White Dragon');}
  if(card.unplayableFromHand&&/Sarcophagus/.test(card.officialName)){for(let i=0;i<2;i++){e.emit({type:'end-phase',owner:1});e.pump();settle(e,m.uid);}}
  if(card.officialName==='Serial Spell'){const spell=put(e,0,'hand','Pot of Greed');run(e,{type:'activate',uid:spell.uid,key:spell.id+'::cast'},m.uid);}
  if(card.officialName==='Divine Wrath'){e.state.active=1;const foe=put(e,1,'monsters','Chaos Sorcerer');run(e,{type:'activate',uid:foe.uid,key:foe.id+'::banish',choices:{target:[e.monsters(0)[0].uid]}},m.uid);e.state.active=0;}
  if(card.officialName==='Tragedy'){e.setPosition(e.monsters(1)[0].uid,'defense',{id:id('Enemy Controller'),owner:0,effectType:'spell'});e.pump();settle(e,m.uid);}
  const responseSpell={'Spell-Stopping Statute':'Soul Absorption','Royal Surrender':'Gravity Bind','Armor Break':'Black Pendant','Ring of Defense':'Just Desserts','Malfunction':'Jar of Greed'}[card.officialName];
  if(responseSpell){e.state.active=1;const def=D.CARDS[id(responseSpell)],s=put(e,1,def.type==='trap'?'spells':'hand',responseSpell,{faceUp:false});run(e,{type:'activate',uid:s.uid,key:s.id+'::cast'},m.uid);e.state.active=0;}
  if(['Mispolymerization','Chthonian Polymer'].includes(card.officialName)){const f=put(e,1,'extra','Steam Gyroid');e.special(1,f.uid,{via:'fusion'});e.pump();settle(e,m.uid);}
  if(card.officialName==='Token Feastevil'){e.createTokens(1,'early-sheep-token',1);e.pump();settle(e,m.uid);}
  if(card.officialName==='Inferno Reckless Summon'){const f=put(e,0,'grave','Hero Kid'),s=put(e,0,'hand','Monster Reborn');run(e,{type:'activate',uid:s.uid,key:s.id+'::cast',choices:{target:[f.uid]}},m.uid);}
  const a=E.available(e,0,{kind:'main',phase:'main1'}).find(a=>a.uid===m.uid);if(a)run(e,{type:'activate',uid:m.uid,key:a.key},m.uid);
 }
 if(e.state.winner===null){e.state.active=0;e.state.phase='main1';const a=E.available(e,0,{kind:'main',phase:'main1'}).find(a=>a.uid===m.uid);if(a)run(e,{type:'activate',uid:m.uid,key:a.key},m.uid);battery(e,m);}
 assert.ok(knownAction(e,card),card.officialName+' did not perform a real summon or effect');e.assertState();return e;
}
module.exports={D,E,id,put,act,settle,run,clear,fresh,exercise,setup2003};
