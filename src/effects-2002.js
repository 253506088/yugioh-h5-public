/* 2002 OCG batch: shared helpers, Union mechanic, engine hooks and tokens. */
(function(root){
 'use strict';
 const X=root.DuelEarly,{E,D,H,C,I,is,mark,S,T,A,Q,R,passive,allM,allS,allF,monster,face,ownM,foeM,exact,moved,destroy,choose,g,target,drawDiscard,randomDiscard,pay,once,declare,declared,onEntry,onFlip,onMove,onStandby,onDamage,onBattleWin,src,active,ctx,GYbattle,GYfield,discardCost,tributeInput,tribute,burn,races,attrs}=X,{CARDS}=D;
 const first=H.first,args=H.args,self=H.self,hand=H.hand,deck=H.deck,grave=H.grave;
 const P=root.ModernDuelEngine.prototype;
 const rule=(name,values,note)=>{C(name).earlyRules={...(C(name).earlyRules||{}),...values};mark(name,note);};
 function extend(name,fn){const prior=P[name];P[name]=function(...a){return fn.call(this,prior,...a);};}
 const gk=m=>!!m&&CARDS[m.id].officialName.startsWith("Gravekeeper's");
 const amazoness=m=>!!m&&CARDS[m.id].officialName.startsWith('Amazoness');
 const guardian=m=>!!m&&CARDS[m.id].officialName.startsWith('Guardian ');
 const darkScorpion=m=>!!m&&CARDS[m.id].officialName.startsWith('Dark Scorpion');
 // Series labels let both decks and the archive filter the new 2002 themes.
 D.families.gravekeeper='守墓';D.families.amazoness='亚马逊';D.families.guardian='守护者';D.families.toon='卡通';D.families.darkscorpion='黑蝎';
 for(const c of D.CARD_LIST){
  if(gk(c))c.families=[...new Set([...(c.families||[]),'gravekeeper'])];
  if(amazoness(c))c.families=[...new Set([...(c.families||[]),'amazoness'])];
  if(CARDS[c.id].toon)c.families=[...new Set([...(c.families||[]),'toon'])];
  if(guardian(c)&&!['Celtic Guardian','Winged Dragon, Guardian of the Fortress #1','Winged Dragon, Guardian of the Fortress #2','Guardian of the Labyrinth','The Reliable Guardian'].includes(c.officialName))c.families=[...new Set([...(c.families||[]),'guardian'])];
  if(darkScorpion(c))c.families=[...new Set([...(c.families||[]),'darkscorpion'])];
 }
 // Tokens introduced by 2002 cards.
 for(const [id,name,officialName,atk,def,attribute,race,note] of [
  ['2002-wicked-token','恶魔衍生物','Wicked Token',1000,1000,'暗','恶魔族','陷阱像被破坏时登场的衍生物。'],
  ['2002-snake-token','毒蛇衍生物','Poisonous Snake Token',1200,1200,'地','爬虫类族','眼镜蛇壶的衍生物；被战斗破坏时给予500伤害。'],
  ['2002-ojama-token','扰乱衍生物','Ojama Token',0,1000,'光','兽族','扰乱三人组；不能作为祭品召唤的解放，被破坏时控制者受300伤害。'],
  ['2002-metal-fiend-token','金属恶魔衍生物','Metal Fiend Token',0,0,'暗','恶魔族','恶魔圣域的衍生物；不能攻击，战斗伤害由召唤者承受。'],
  ['2002-wicked-plant-token','邪恶植物衍生物','Wicked Plant Token',800,800,'地','植物族','吸血兰魔掌之棘的衍生物。'],
  ['2002-mirage-token','蜃景衍生物','Mirage Token',0,0,'光','战士族','身体分裂的衍生物；复制对象能力数值，结束阶段破坏。']
 ])if(!CARDS[id]){const c={id,name,officialName,en:officialName.toUpperCase(),type:'token',level:1,atk,def,attribute,race,description:note,family:'early',notCollectible:true};CARDS[id]=c;D.CARD_LIST.push(c);}
 // ---------------------------------------------------------------- Union monsters
 function union(name,partners,spec={}){
  const def=C(name);def.earlyRules={...(def.earlyRules||{}),union:true,unionPartners:partners};
  A(name,'union-equip',{label:'同盟装备 · 变为装备魔法',once:{key:'union-2002',scope:'card'},
   condition:(e,c)=>!!self(e,c)&&e.state.players[c.owner].spells.includes(null)&&ownM(e,c).some(m=>partners.some(n=>is(m,n))&&!e.activeEquip(m).some(eq=>CARDS[eq.id].earlyRules?.union)),
   inputs:(e,c)=>[g(e,c,'target','选择装备对象的同盟搭档',ownM(e,c).filter(m=>partners.some(n=>is(m,n))&&!e.activeEquip(m).some(eq=>CARDS[eq.id].earlyRules?.union)),1,1,'own-boost')],
   resolve:(e,c)=>{if(self(e,c))e.equipMonster(c.uid,first(c),c.owner,c.source);},aiScore:120});
  A(name,'union-unequip',{zones:['spells'],label:'同盟解除 · 变回怪兽',once:{key:'union-2002',scope:'card'},
   condition:(e,c)=>{const f=H.source(e,c);return !!f&&f.zone==='spells'&&f.card.monsterEquip&&!f.card.unionRiderLocked&&e.freeMain(c.owner)>0&&e.canSpecial(c.owner,f.card,{via:'union'});},
   resolve:(e,c)=>{const f=H.source(e,c);if(f&&f.zone==='spells')e.special(c.owner,c.uid,{via:'union'});},
   aiScore:(e,c)=>e.state.phase==='main1'?80:-100});
  mark(name,'同盟怪兽：每回合1次装备到指定搭档或解除装备；搭档被战斗破坏时改为破坏此卡');
  passive(name,{
   stat:(e,s,m,k)=>s.card.equipTarget===m.uid?(spec.stat?.[k]||0):0,
   protect:(e,s,m,battle,source)=>{
    if(s.card.equipTarget!==m.uid||e.find(s.card.uid)?.zone!=='spells')return false;
    if(!battle&&!spec.effectProtect)return false;
    return e.destroy(s.card.uid,{id:s.card.id,uid:s.card.uid,owner:e.find(s.card.uid).owner,effectType:'monster'})||false;
   }
  });
 }
 X.union=union;
 // Union equipped monsters cannot be absorbed by a second Union at the same time.
 extend('canAttack',function(prior,card,owner=this.state.active,target=null){
  if(!prior.call(this,card,owner,target))return false;
  const t=target?this.find(target)?.card:null;
  if(t&&face(t)&&amazoness(t)&&!is(t,'Amazoness Tiger')&&this.monsters(1-owner).some(m=>m.faceUp&&is(m,'Amazoness Tiger')&&!this.negated(m)))return false;
  if(this.hasEarly('Gora Turtle')&&this.attackValue(card)>=1900)return false;
  if(t&&this.rawEarly('Metalsilver Armor').some(f=>this.activeSpell(f.card)&&f.owner!==owner&&f.card.equipTarget!==t.uid&&this.find(t.uid)?.owner===f.owner))return false;
  if(target&&this.state.staunchDefender?.turn===this.state.turn&&this.state.staunchDefender.owner!==owner&&target!==this.state.staunchDefender.uid)return false;
  return true;
 });
 extend('takeControl',function(prior,uid,owner,options={}){
  const f=this.find(uid);
  if(f&&CARDS[f.card.id].earlyRules?.controlLocked&&!this.negated(f.card))return false;
  return prior.call(this,uid,owner,options);
 });
 extend('tributeWeight',function(prior,card,target){
  if(is(card,'Kaiser Sea Horse')&&(target?this.attribute(target):'')==='光')return 2;
  return prior.call(this,card,target);
 });
 // Guardians may only be Summoned while their named Equip Card is face-up on the field.
 extend('canNormal',function(prior,card,owner=this.state.active){
  if(!prior.call(this,card,owner))return false;
  const r=CARDS[card.id].earlyRules||{};
  if(r.requiresEquip&&!this.hasEarly(r.requiresEquip))return false;
  if(this.summonCapped?.(owner,card))return false;
  return true;
 });
 extend('canSpecial',function(prior,owner,card,options={}){
  if(!prior.call(this,owner,card,options))return false;
  const r=CARDS[card.id].earlyRules||{};
  if(r.requiresEquip&&!this.hasEarly(r.requiresEquip))return false;
  if(this.summonCapped?.(owner,card))return false;
  const f=this.find(card.uid);
  if(f&&f.zone==='grave'&&!options.ignoreNecrovalley&&this.hasEarly('Necrovalley')&&!this.hasEarly("Gravekeeper's Chief",f.owner))return false;
  return true;
 });
 // Necrovalley stops effect moves and effect banishment from the Graveyard.
 extend('move',function(prior,uid,dest,options={}){
  const f=this.find(uid);
  if(f&&f.zone==='grave'&&dest!=='grave'&&dest!=='overlays'&&!options.ignoreNecrovalley&&this.hasEarly('Necrovalley')&&this._advancedReady){
   const kind=options.kind||'';
   if(!kind.startsWith('rule')&&!kind.startsWith('cost-')&&!(this.hasEarly("Gravekeeper's Chief",f.owner))){
    this.log('negate','王家长眠之谷封锁了墓地的移动',options.byOwner??this.state.active,{cardId:f.card.id});
    return {card:f.card,from:f.zone,to:f.zone,owner:f.owner,destroyed:false};
   }
  }
  return prior.call(this,uid,dest,options);
 });
 // Spell Canceller suppresses all Spell Cards and their field effects.
 rule('Spell Canceller',{},'魔法卡不能发动，场上的魔法效果全部无效');
 extend('activeSpell',function(prior,card){
  if(CARDS[card.id]?.type==='spell'&&this.rawEarly('Spell Canceller').length)return false;
  return prior.call(this,card);
 });
 extend('earlyCanUse',function(prior,c,a){
  if(!prior.call(this,c,a)&&!c.event?.forcedTrap)return false;
  const d=CARDS[c.sourceId];
  if(a.cardActivation&&d.type==='spell'&&this.rawEarly('Spell Canceller').length)return false;
  return true;
 });
 extend('earlyNegatesLink',function(prior,link,probe=false){
  if(prior.call(this,link,probe))return true;
  const f=this.find(link.uid);
  if(link.source.effectType==='spell'&&f&&['spells','fieldSpell'].includes(f.zone)&&this.rawEarly('Spell Canceller').length)return true;
  return false;
 });
 // Non-Spellcasting Area protects non-Effect monsters from other Spell effects.
 extend('unaffected',function(prior,card,source){
  if(prior.call(this,card,source))return true;
  if(!source||!card.faceUp||this.negated(card))return false;
  const sourceType=source.effectType||CARDS[source.id]?.type;
  if(this.rawEarly('Non-Spellcasting Area').some(f=>f.owner===this.find(card.uid)?.owner)&&!CARDS[card.id].effect&&['spell','pendulum-spell'].includes(sourceType))return true;
  return false;
 });
 // Timidity shields Set back row; several monsters resist specific destruction.
 extend('destroy',function(prior,uid,source=null,battle=false,options={}){
  const f=this.find(uid);
  if(!f)return prior.call(this,uid,source,battle,options);
  if(!battle&&!f.card.faceUp&&['spells','fieldSpell'].includes(f.zone)&&this.state.timidityUntil>=this.state.turn)return false;
  const r=CARDS[f.card.id].earlyRules||{};
  if(!this.negated(f.card)&&f.card.faceUp){
   if(r.spellTrapIndestructible&&!battle&&['spell','trap','pendulum-spell'].includes(source?.effectType||CARDS[source?.id]?.type))return false;
   if(r.battleSpellTrapIndestructible&&battle)return false;
   if(r.battleAttributeImmune&&battle&&r.battleAttributeImmune.includes(this.attribute(this.find(source?.uid)?.card||{})))return false;
   if(r.sameAttackImmune&&battle){const atk=this.attackValue(this.find(source?.uid)?.card||{});if(atk===this.attackValue(f.card))return false;}
   if(r.nonTargetImmune&&!battle){const targeted=Object.values(this.state.resolvingLink?.targetMeta||{}).some(map=>Object.keys(map).includes(uid));if(!targeted)return false;}
  }
  return prior.call(this,uid,source,battle,options);
 });
 // Continuous summoning restrictions from 2002 Spells and Traps.
 P.summonCapped=function(owner,card){
  if(!this._advancedReady||!D.isMonster(CARDS[card.id]))return false;
  for(const f of this.rawEarly('Kaiser Colosseum')){
   const host=f.owner;
   if(host===owner)continue;
   const mine=this.monsters(host).length;
   if(mine>=1&&this.monsters(owner).length>=mine)return true;
  }
  if(this.rawEarly('Rivalry of Warlords').length){
   const kinds=this.monsters(owner).filter(m=>m.faceUp).map(m=>this.race(m));
   if(kinds.length&&kinds.some(k=>k!==this.race(card)))return true;
  }
  if(this.state.noSummonUntil&&this.state.noSummonUntil[owner]>=this.state.turn)return true;
  if(this.rawEarly('Narrow Pass').length){
   const used=this.state.players[owner].narrowPassSummons||0;
   if(used>=2)return true;
  }
  return false;
 };
 P.noteNarrowSummon=function(owner){
  if(this.rawEarly('Narrow Pass').length){const p=this.state.players[owner];p.narrowPassSummons=(p.narrowPassSummons||0)+1;}
 };
 extend('normalSummon',function(prior,a){
  const card=this.find(a.uid)?.card;
  let garzett=0;
  if(card&&is(card,'Maju Garzett')&&(a.tributes||[]).length)garzett=(a.tributes||[]).reduce((n,uid)=>{const f=this.find(uid);return n+(f?this.originalAttack(f.card):0);},0);
  const result=prior.call(this,a);
  const summoned=this.find(a.uid)?.card;
  if(summoned&&garzett>0)summoned.majuAttack=garzett;
  if(summoned&&this.find(a.uid)?.zone&&['monsters','extraMonster'].includes(this.find(a.uid).zone))this.noteNarrowSummon(a.uid?this.find(a.uid).owner:this.state.active);
  return result;
 });
 S('Necrovalley',{resolve:()=>{},aiScore:450});
 passive('Necrovalley',{stat:(e,s,m)=>gk(m)?500:0});
 mark('Necrovalley','守墓全体+500攻守；封锁双方墓地的效果移动与除外，守墓长的控制者墓地不受影响');
 // VWXYZ contact fusion: banish the on-field components to Summon the machine fusions.
 const vwxyzNames=['XY-Dragon Cannon','YZ-Tank Dragon','XZ-Tank Cannon','XYZ-Dragon Cannon'];
 for(const name of vwxyzNames)rule(name,{noGraveSpecial:true});
 for(const anchor of ['X-Head Cannon','Y-Dragon Head','Z-Metal Tank']){
  A(anchor,'vwxyz',{label:'除外部件，特殊召唤XYZ战机',summons:true,
   condition:(e,c)=>c.owner===e.state.active&&H.mainPhase(e)&&e.fusions(c.owner,{zones:['monsters','extraMonster'],destination:'banished'}).some(o=>vwxyzNames.some(n=>is(o.card,n))),
   resolve:(e,c)=>choose(e,c,'选择以除外部件特殊召唤的战机',e.fusions(c.owner,{zones:['monsters','extraMonster'],destination:'banished'}).map(o=>o.card).filter(m=>vwxyzNames.some(n=>is(m,n))),1,1,'select-fusion',{spellId:{zones:['monsters','extraMonster'],destination:'banished'},role:'fusion-choice'}),
   aiScore:1100});
 }
 const equip=X.equip,eventTrap=X.eventTrap;
 X.rule2002=rule;
 const API={E,D,H,C,I,is,mark,S,T,A,Q,R,passive,allM,allS,allF,monster,face,ownM,foeM,exact,moved,destroy,choose,g,target,drawDiscard,randomDiscard,pay,once,declare,declared,onEntry,onFlip,onMove,onStandby,onDamage,onBattleWin,src,active,ctx,GYbattle,GYfield,discardCost,tributeInput,tribute,burn,races,attrs,first,args,self,hand,deck,grave,P,extend,rule,gk,amazoness,guardian,darkScorpion,union,vwxyzNames,equip,eventTrap};
 root.Duel2002=API;
 if(typeof module!=='undefined'){module.exports=API;require('./effects-2002-monsters.js');require('./effects-2002-spells.js');require('./effects-2002-traps.js');}
})(globalThis);
