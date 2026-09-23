/* 2003 OCG rules. Shared continuations are serializable and reused by later years. */
(function(root){
 'use strict';
 const X=root.Duel2002,{E,D,H,C,I,is,mark,S,T,A,Q,R,passive,allM,allS,allF,monster,face,ownM,foeM,exact,moved,destroy,choose,g,target,drawDiscard,randomDiscard,pay,once,declare,declared,onEntry,onFlip,onMove,onStandby,onDamage,onBattleWin,src,active,ctx,GYbattle,GYfield,discardCost,tributeInput,tribute,burn,races,attrs,first,args,self,hand,deck,grave,P,extend,rule}=X,{CARDS}=D;
 const cp=v=>JSON.parse(JSON.stringify(v)),field=H.fieldZone;
 const has=(e,name,owner=null)=>e.hasEarly(name,owner),named=(m,part)=>!!m&&CARDS[m.id].officialName.includes(part);
 const arch=m=>named(m,'Archfiend')||!!m&&/always treated as an "Archfiend"/.test(CARDS[m.id].originalDescription||'');
 const ninja=m=>named(m,'Ninja'),scorpion=m=>X.darkScorpion(m)||is(m,'Don Zaloog');
 D.families.archfiend='恶魔棋子';D.families.chaos='混沌';D.families.agent='代行者';D.families.ojama='扰乱';
 for(const c of D.CARD_LIST)for(const [key,yes] of [['archfiend',arch(c)],['chaos',/Chaos|Envoy/.test(c.officialName)],['agent',c.officialName.startsWith('The Agent of ')],['ojama',c.officialName.startsWith('Ojama')]])if(yes)c.families=[...new Set([...(c.families||[]),key])];
 function token(id,name,en,level,atk,def,attribute,race,extra={}){if(CARDS[id])return;const c={id,name,officialName:en,en:en.toUpperCase(),type:'token',level,atk,def,attribute,race,family:'early',description:name,notCollectible:true,...extra};CARDS[id]=c;D.CARD_LIST.push(c);}
 token('2003-lekunga-token','勒昆加衍生物','Lekunga Token',2,700,700,'水','植物族');
 token('2003-ant-token','兵队蚁衍生物','Army Ant Token',4,500,1200,'地','昆虫族',{cannotTributeSummon:true});
 token('2003-lamb-token','迷途羊衍生物','Lamb Token',1,0,0,'地','兽族');
 token('2003-clone-token','克隆衍生物','Clone Token',1,0,0,'光','机械族');
 const guards={attack:{},normal:{},special:{},direct:{},protect:{},target:{},effect:{}};
 function guard(kind,name,fn,note){guards[kind][I(name)]=fn;mark(name,note);}
 const ends=new Map();
 function onEnd(name,s,{zones=['monsters','extraMonster','spells','fieldSpell'],both=false,opponent=false,mandatory=false}={}){R(name,'year-end',{zones,...s});ends.set(I(name),{zones,both,opponent,mandatory});}
 E.on('end-phase',(e,v)=>{for(const owner of [0,1])for(const f of e.refs(owner)){const d=ends.get(f.card.id);if(!d||!d.zones.includes(f.zone)||(['spells','fieldSpell','monsters','extraMonster'].includes(f.zone)&&!active(e,f.card)))continue;if(d.both||(d.opponent?v.owner!==owner:v.owner===owner))e.addTrigger(f.card.uid,f.card.id+'::year-end',v,{owner,mandatory:d.mandatory});}});
 function die(e,c){let n=1+Math.floor(e.random()*6);const p=e.state.players[c.owner];if(p.diceRerollTurn===e.state.turn){p.diceRerollTurn=-1;n=1+Math.floor(e.random()*6);}e.log('effect','骰子结果：'+n,c.owner);if(e.adjustDie){const m=e.adjustDie(n,c);if(m!==n){n=m;e.log('effect','骰子结果改为：'+n,c.owner);}}return n;}
 const coin=(e,c,n=3)=>Array.from({length:n},()=>e.random()<.5).filter(Boolean).length;
 const defer=(e,c,phase,turn,operation,data={},owner=c.owner)=>(e.state.earlyDelayed||=[]).push({phase,turn,operation,owner,source:c.source,data});
 function banishCost(n,predicate){return (e,c)=>g(e,c,'cost','选择除外的墓地卡片',grave(e,c.owner,m=>predicate(e,m,c)),n,n,'cost');}
 const banishPay=(e,c)=>moved(e,c,args(c,'cost'),'banished','cost-banish');
 function handSummon(name,{cost,inputs,condition=()=>true,only=false,score=1300}={}){
  const via='year-special:'+I(name),def=C(name);def.noNormal=true;def.specialOnly=via;
  if(only)guard('special',name,(e,owner,m,o)=>o.via===via);
  A(name,'year-special',{zones:['hand'],inherent:true,summons:true,inputs,cost,condition:(e,c)=>e.freeMain(c.owner)>0&&condition(e,c)&&e.canSpecial(c.owner,H.source(e,c).card,{via}),resolve:(e,c)=>{if(e.find(c.uid)?.zone==='hand'&&e.freeMain(c.owner))e.special(c.owner,c.uid,{via});},aiScore:score});return via;
 }
 function revive(e,c,uid,options={}){const f=e.find(uid);if(f&&e.canSpecial(c.owner,f.card,{via:options.via||'revive',...options})&&e.freeMain(c.owner))return e.special(c.owner,uid,{via:'revive',...options});return null;}
 function search(e,c,list,n=1){choose(e,c,'选择加入手牌的卡片',list,1,Math.min(n,list.length),'early-move',{to:'hand',kind:'effect-search',shuffle:true,role:'search'});}
 function recruit(e,c,list,options={}){choose(e,c,'选择特殊召唤的怪兽',H.specialable(e,c.owner,list,options.via||'effect'),1,1,'early-special',{role:'special',...options});}
 function original(name,attack,defense){passive(name,{originalAttack:attack,...(defense?{originalDefense:defense}:{})});}
 extend('originalDefense',function(prior,m){const fn=this.fx?.passives[m.id]?.originalDefense;return this._advancedReady&&fn&&!this.negated(m)?fn(this,m):prior.call(this,m);});
 extend('originalAttack',function(prior,m){const value=prior.call(this,m);return m.originalAtkHalfUntil>=this.state.turn?Math.floor(value/2):value;});
 extend('describe',function(prior,m,...rest){return {...prior.call(this,m,...rest),...(m.yearly?{yearly:cp(m.yearly)}:{})};});
 extend('canNormal',function(prior,m,owner=this.state.active){return prior.call(this,m,owner)&&(!guards.normal[m.id]||guards.normal[m.id](this,m,owner))&&(!has(this,'Spatial Collapse')||this.field(owner).length<5);});
 extend('canSpecial',function(prior,owner,m,o={}){return prior.call(this,owner,m,o)&&(!guards.special[m.id]||guards.special[m.id](this,owner,m,o))&&(!has(this,'Spatial Collapse')||this.field(owner).length<5)&&!(this.state.players[owner].noSummonsTurn===this.state.turn);});
 extend('setCard',function(prior,a){if(has(this,'Spatial Collapse')&&this.field(this.state.active).length>=5)throw new root.DuelRuleError('场上的卡片数量已达到限制。');return prior.call(this,a);});
 extend('earlyCanUse',function(prior,c,a){
  if(!prior.call(this,c,a))return false;const d=CARDS[c.sourceId],p=this.state.players[c.owner],f=this.find(c.uid);
  if(a.cardActivation&&f?.zone==='hand'&&has(this,'Spatial Collapse')&&this.field(c.owner).length>=5)return false;
  if(p.chaosEmperorTurn===this.state.turn&&c.key!==p.chaosEmperorKey)return false;
  if(this.state.noSpellTrapTurn===this.state.turn&&a.cardActivation)return false;
  if(a.cardActivation&&d.type==='spell'&&(p.spellLockedUntil>=this.state.turn||(p.forbiddenSpellNames||[]).includes(d.id)||d.spellKind==='quick'&&has(this,'Invader of Darkness',1-c.owner)||has(this,'Talisman of Spell Sealing')))return false;
  if(a.cardActivation&&d.type==='trap'&&has(this,'Talisman of Trap Sealing'))return false;
  if(a.cost&&has(this,'Goblin of Greed')&&a.inputs){const groups=a.inputs(this,c)||[];if(groups.some(g=>g?.key==='cost'&&g.candidates?.some(o=>this.find(o.uid)?.zone==='hand')&&String(a.cost).includes('discard')))return false;}
  return !guards.effect[c.sourceId]||guards.effect[c.sourceId](this,c,a);
 });
 extend('commitPrepared',function(prior,c){const result=prior.call(this,c);if(!this.fx.get(c.key).inherent){const p=this.state.players[c.owner];p.effectActivations||={};p.effectActivations[this.state.turn]=(p.effectActivations[this.state.turn]||0)+1;}return result;});
 extend('activeSpell',function(prior,m){if(!prior.call(this,m))return false;const d=CARDS[m.id];if(d.type==='spell'&&this.rawEarly('Talisman of Spell Sealing').some(f=>!f.card.spellNegated&&!f.card.pendingActivation))return false;if(d.type==='trap'&&this.rawEarly('Talisman of Trap Sealing').some(f=>!f.card.spellNegated&&!f.card.pendingActivation))return false;return true;});
 extend('attackBlocked',function(prior,owner){return prior.call(this,owner)||this.state.players[owner].skipBattleTurn===this.state.turn||allS(this).some(m=>active(this,m)&&is(m,'D.D. Borderline')&&!grave(this,this.find(m.uid).owner,x=>CARDS[x.id].type==='spell').length);});
 extend('canDirect',function(prior,m,owner=this.state.active){return !this.negated(m)&&guards.direct[m.id]?.(this,m,owner)||this.activeEquip(m).some(eq=>CARDS[eq.id].equipRules?.direct)||prior.call(this,m,owner);});
 extend('canAttack',function(prior,m,owner=this.state.active,targetUid=null){
  if(!prior.call(this,m,owner,targetUid)||m.cannotAttack||m.yearAttackLocked)return false;
  if(guards.attack[m.id]&&!this.negated(m)&&!guards.attack[m.id](this,m,owner,targetUid))return false;
  if(allM(this).some(x=>active(this,x)&&(x.unhappyTargets||[]).includes(m.uid)&&x.position==='attack'))return false;
  if(this.spells(1-owner).some(s=>active(this,s)&&is(s,'Wall of Revealing Light')&&this.attackValue(m)<=(s.wallPaid||0)))return false;
  const target=this.find(targetUid)?.card;if(!target)return true;
  for(const s of this.monsters(1-owner).filter(x=>active(this,x))){
   if(is(s,"Magician's Valkyria")&&s.uid!==targetUid&&target.faceUp&&this.race(target)==='魔法师族')return false;
   if(is(s,'Vilepawn Archfiend')&&s.uid!==targetUid&&arch(target))return false;
   if(is(s,'Prickle Fairy')&&this.race(target)==='昆虫族')return false;
  }
  const guarded={'Goblin King':'恶魔族','Solar Flare Dragon':'炎族','Soul-Absorbing Bone Tower':'不死族'}[CARDS[target.id].officialName];
  return !(guarded&&active(this,target)&&this.monsters(1-owner).some(x=>x.uid!==targetUid&&x.faceUp&&this.race(x)===guarded));
 });
 extend('positionLocked',function(prior,m){return prior.call(this,m)||allM(this).some(x=>active(this,x)&&(x.unhappyTargets||[]).includes(m.uid)&&x.position==='attack');});
 extend('destroy',function(prior,uid,source=null,battle=false,...rest){const f=this.find(uid);if(f&&active(this,f.card)&&guards.protect[f.card.id]?.(this,f.card,source,battle))return false;if(f&&is(f.card,'Pandemonium')&&source?.owner!==f.owner&&has(this,'Pandemonium Watchbear',f.owner))return false;return prior.call(this,uid,source,battle,...rest);});
 extend('canTarget',function(prior,m,source){return prior.call(this,m,source)&&(!guards.target[m.id]||guards.target[m.id](this,m,source));});
 extend('attribute',function(prior,m){const s=allS(this).filter(x=>active(this,x)&&is(x,'DNA Transplant')).at(-1);return s&&m.faceUp&&field(this.find(m.uid)?.zone)?s.declaredAttribute||prior.call(this,m):prior.call(this,m);});
 extend('unaffected',function(prior,m,source){return prior.call(this,m,source)||!!source&&active(this,m)&&is(m,'The Agent of Force - Mars')&&(source.effectType||CARDS[source.id]?.type)==='spell';});
 E.on('end-phase',(e,v)=>{for(const m of allM(e))if(active(e,m)&&is(m,'The Agent of Wisdom - Mercury')&&v.owner!==e.find(m.uid).owner)m.mercuryReady=!hand(e,e.find(m.uid).owner).length;});
 const api={...X,cp,field,has,named,arch,ninja,scorpion,guards,guard,onEnd,die,coin,defer,banishCost,banishPay,handSummon,revive,search,recruit,original,token};root.Duel2003=api;
 if(typeof module!=='undefined'){module.exports=api;for(const file of ['monsters','spells','traps'])require('./effects-2003-'+file+'.js');}
})(globalThis);
