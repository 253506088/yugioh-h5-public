/* Cost replacements, draw replacements, and preserving original card identities. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,I,is,allM,allS,monster,hand,deck,grave,first,args,src,field,has,extend,g,moved,choose,revive,search,card,def,series,locked,raw,rawHas}=X,{CARDS}=D,P=root.ModernDuelEngine.prototype;
 // Reused pre-chronicle identities keep the existing tested handler. Registering
 // an annual listener must never give the same card two identical triggers.
 const reused={'hero-the-shining':['era-sent'],'bw-shura':['battle-win'],'bw-blizzard':['era-revive'],'bw-kalut':['era-damage'],'black-whirlwind':['era-search'],'junk-archer':['era-effect'],'gagaga-girl':['era-effect'],'cardcar-d':['era-effect']};
 for(const [id,modes] of Object.entries(reused))for(const mode of modes){const a=E.get(id+'::'+mode);if(a){a.condition=()=>false;a.supersededByOriginal=true;}}
 // Imported members must be visible to the original handlers, which consume
 // family/flags. The frozen CDB setcodes guard these centralized name rules.
 const treated=c=>[...String(c.originalDescription||'').matchAll(/This card is always treated as an? "([^"]+)" card/g)].map(m=>m[1]);
 const legacyTags=[['blackwing',/Blackwing/,'monster',true],['synchron',/Synchron\b/,'monster',true],['utopia',/Utopia/,'xyz',true],['galaxy',/Galaxy/,'monster',true],['bamboo',/Bamboo Sword/,'any',true],['junk',/\bJunk\b/,'monster',false],['hero',/\bHERO\b/,'monster',false],['gagaga',/Gagaga/,'monster',false],['gogogo',/Gogogo/,'monster',false],['dododo',/Dododo/,'monster',false],['zubaba',/Zubaba/,'monster',false]];
 function applyLegacyTags(c){
  const also=treated(c);if(also.length)c.series=[...new Set([...(c.series||[]),...also])];
  const names=[c.officialName||'',...also],scope={monster:D.isMonster(c),xyz:c.type==='xyz',any:true};
  for(const [key,re,where,primary] of legacyTags)if(scope[where]&&names.some(n=>re.test(n))){if(primary&&['early','generic'].includes(c.family))c.family=key;c.families=[...new Set([...(c.families||[]),key])];}
  if(scope.monster&&names.some(n=>/\bJunk\b/.test(n)))c.junk=true;
  if(scope.monster&&names.some(n=>/\bElemental HERO\b/.test(n)))c.elemental=true;
  if(names.some(n=>/Cyber Dragon/.test(n)))c.cyberDragon=true;
  if(names.some(n=>/^Crystron(?: |$)/.test(n)))c.crystron=true;
 }
 for(const c of D.CARD_LIST)applyLegacyTags(c);
 // Later annual volumes create tokens after this file has loaded.
 const createToken=X.token;X.token=function(...args){const result=createToken(...args);const c=CARDS[args[0]];if(c)applyLegacyTags(c);return result;};
 const uo=C('Utopic Onomatopoeia');if(uo)uo.series=[...new Set([...(uo.series||[]),'Gagaga','Gogogo','Dododo','Zubaba'])];
 if(E.passives['hero-the-shining'])delete E.passives['hero-the-shining'].stat;
 if(E.passives['bw-armed-wing'])delete E.passives['bw-armed-wing'].battleStat;
 if(CARDS['bw-armed-wing'].earlyRules)delete CARDS['bw-armed-wing'].earlyRules.piercing;
 for(const n of ['Ronintoadin','Pain Painter','Forgotten Temple of the Deep'])delete C(n).nameAlias;
 extend('cardNameId',function(prior,m,...a){const zone=this.find(m?.uid)?.zone;if(field(zone)){if(is(m,'Ronintoadin'))return I('Des Frog');if(is(m,'Pain Painter'))return I('Plaguespreader Zombie');if(is(m,'Forgotten Temple of the Deep'))return I('Umi');}return prior.call(this,m,...a);});
 extend('materialMatches',function(prior,m,s,...a){if(s.id&&m.id!==s.id&&this.cardNameId(m)===s.id)return prior.call(this,m,{...s,id:undefined},...a);return prior.call(this,m,s,...a);});
 // A selection contains actual card UIDs. Xyz Unit and Freezadon remain in their
 // real zones until payment; neither creates a fictitious overlay.
 P.detachCapacity=function(uid){const f=this.find(uid);if(!f)return 0;const units=this.activeEquip(f.card).filter(m=>is(m,'Xyz Unit')).length,free=this.monsters(f.owner).some(m=>m.uid!==uid&&is(m,'Number 19: Freezadon')&&m.faceUp&&m.overlays.length&&!this.wasUsed(f.owner,m,'freezadon','card'));return f.card.overlays.length+units+Number(free);};
 const detachInput=H.detachInput;H.detachInput=function(e,c,n=1){const result=detachInput(e,c,n),f=e.find(c.uid);if(!f||def(f.card).type!=='xyz')return result;const unit=e.activeEquip(f.card).filter(m=>is(m,'Xyz Unit')),free=e.monsters(c.owner).find(m=>m.uid!==c.uid&&is(m,'Number 19: Freezadon')&&m.faceUp&&m.overlays.length&&!e.wasUsed(c.owner,m,'freezadon','card'));return {...result,candidates:[...result.candidates,...unit.map(m=>e.option(m,{detail:'Xyz Unit'})),...(free?[e.option(free.overlays[0],{detail:'Freezadon'})]:[])]};};
 const detach=P.detach;P.detach=function(uid,uids){const source=this._eraCostSource,host=this.find(uid);if(!source||source.uid!==uid||!host||def(host.card).type!=='xyz')return detach.call(this,uid,uids);const normal=[],replacements=[];for(const id of uids){const f=this.find(id);if(f?.parentUid===uid)normal.push(id);else replacements.push(f);}if(!replacements.length)return detach.call(this,uid,uids);
  const isFree=f=>f?.zone==='overlays'&&f.owner===host.owner&&is(f.parent,'Number 19: Freezadon')&&!this.wasUsed(host.owner,f.parent,'freezadon','card');
  if(replacements.some(f=>!f||!(f.zone==='spells'&&is(f.card,'Xyz Unit')&&f.card.equipTarget===uid||isFree(f)))||replacements.filter(isFree).length>1||new Set(uids).size!==uids.length)throw new root.DuelRuleError('超量素材代替支付不合法。');
  if(normal.length)detach.call(this,uid,normal);for(const f of replacements){if(isFree(f))this.useKey(host.owner,f.parent,'freezadon','card');this.move(f.card.uid,'grave',{kind:'detach',source,asCost:true,byOwner:host.owner});}
 };
 // AI solves variable-count costs as complete combinations, instead of rejecting
 // every partial choice below the required total Level.
 extend('chooseAI',function(prior,p){if(p.kind==='input'&&p.group?.validator==='era-fortress'){const pool=p.group.candidates.map(o=>card(this,o.uid)).filter(Boolean),sets=[];const walk=(at,list,n)=>{if(n>=8){sets.push(list);return;}if(list.length>=p.group.max)return;for(let i=at;i<pool.length;i++)walk(i+1,[...list,pool[i]],n+this.level(pool[i]));};walk(0,[],0);sets.sort((a,b)=>a.reduce((n,m)=>n+this.cardUtility(m,p.owner),0)-b.reduce((n,m)=>n+this.cardUtility(m,p.owner),0));if(sets.length)return {type:'choose',uids:sets[0].map(m=>m.uid)};}return prior.call(this,p);});
 // The same normal-draw replacement menu supports all seven named era cards.
 extend('draw',function(prior,p,n=1,...a){if(this._advancedReady&&this.state.inDrawPhase&&n===1&&!this._eraDrawBypass){const options=[{uid:'draw',label:'通常抽卡',value:5}];for(const name of ["Iron Core of Koa'ki Meiru",'Spirit Burner','Meteor Flare']){const m=grave(this,p,q=>is(q,name))[0];if(m)options.push({uid:'return:'+m.uid,label:'回收 '+def(m).name,value:8});}
   if(rawHas(this,'Skull Flame',p)&&grave(this,p,m=>is(m,'Burning Skull Head')).length)options.push({uid:'skull',label:C('Burning Skull Head').name,value:9});
   if(rawHas(this,'Dark General Freed',p)&&deck(this,p,m=>monster(m)&&this.hasAttribute(m,'暗')&&this.level(m)===4).length)options.push({uid:'freed',label:'检索4星暗属性怪兽',value:10});
   if(rawHas(this,'Malefic World',p)&&deck(this,p,m=>series(m,'Malefic')).length>=3)options.push({uid:'malefic',label:'罪世界 · 选择三张',value:10});
   const tiger=grave(this,p,m=>is(m,'Flame Tiger'))[0];if(tiger&&!this.monsters(p).length&&this.canSpecial(p,tiger,{via:'revive'}))options.push({uid:'tiger:'+tiger.uid,label:'特殊召唤炎虎',value:9});
   if(options.length>1){this.queueChoice(p,'选择通常抽卡的处理',options,1,1,'era-draw-replacement',{});return [];}}
  return prior.call(this,p,n,...a);
 });
 E.op('era-draw-replacement',(e,t)=>{const selected=t.picks[0],source={id:I('Upstart Goblin'),owner:t.owner,effectType:'spell'},c={owner:t.owner,source};if(selected==='draw'){const before=e.state.inDrawPhase;e.state.inDrawPhase=true;e._eraDrawBypass=true;try{e.draw(t.owner,1);}finally{e._eraDrawBypass=false;e.state.inDrawPhase=before;}}else if(selected.startsWith('return:'))moved(e,c,[selected.slice(7)],'hand','effect-return');else if(selected.startsWith('tiger:'))revive(e,c,selected.slice(6),{banishOnLeave:true});else if(selected==='skull')search(e,c,grave(e,t.owner,m=>is(m,'Burning Skull Head')));else if(selected==='freed')search(e,c,deck(e,t.owner,m=>monster(m)&&e.hasAttribute(m,'暗')&&e.level(m)===4));else if(selected==='malefic')choose(e,c,'选择罪世界的三张候选',deck(e,t.owner,m=>series(m,'Malefic')),3,3,'era-malefic-draw',{role:'search'});});
 E.op('era-malefic-draw',(e,t)=>{const uid=t.picks[Math.floor(e.random()*t.picks.length)];if(uid)e.search(t.owner,[uid]);});
 for(const [n,key] of [['Constellar Pollux','pollux'],['Evilswarm Castor','castor'],['Dverg of the Nordic Alfar','dverg']]){const a=E.get(I(n)+'::era-extra-normal')||E.get(I(n)+'::era-normal');if(a)a.once=H.once(key);}
 // Maxx C draws once for a simultaneous token Summon too.
 extend('createTokens',function(prior,p,id,count,options={}){const previous=this._eraSummonBatch,batch=previous||{owners:new Set()};this._eraSummonBatch=batch;let result;try{result=prior.call(this,p,id,count);if(options.position==='defense')for(const m of result)m.position='defense';return result;}finally{this._eraSummonBatch=previous;if(!previous)for(const owner of batch.owners)if(locked(this,1-owner,'maxxC'))this.draw(1-owner,1);}});
})(globalThis);
