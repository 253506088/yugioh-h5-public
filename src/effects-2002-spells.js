/* 2002 OCG Spell Cards. */
(function(root){
 'use strict';
 const X=root.Duel2002,{E,D,H,C,I,is,mark,S,T,A,Q,R,passive,allM,allS,allF,monster,face,ownM,foeM,exact,moved,destroy,choose,g,target,drawDiscard,randomDiscard,pay,once,declare,declared,onMove,onStandby,src,active,ctx,discardCost,tributeInput,tribute,burn,races,attrs,first,args,self,hand,deck,grave,P,extend,rule,gk,amazoness}=X,{CARDS}=D;
 const equipTo=(e,c,t)=>{const f=H.source(e,c);if(f&&f.zone==='spells'&&t&&H.fieldZone(t.zone)&&!e.unaffected(t.card,c.source)){f.card.equipTarget=t.card.uid;e.emit({type:'equip',owner:c.owner,uid:c.uid,id:c.sourceId,target:t.card.uid});return true;}return false;};
 // Equip Spells with activation costs or special targeting.
 function customEquip(name,spec,activation={}){
  const def=C(name);def.equipRules=spec;
  const valid=(e,c,m)=>m.faceUp&&(!spec.race||e.race(m)===spec.race)&&(!spec.attr||e.attribute(m)===spec.attr)&&(!spec.maxAtk||e.attackValue(m)<=spec.maxAtk)&&(!spec.minAtk||e.attackValue(m)>=spec.minAtk);
  S(name,{...activation,condition:(e,c)=>allM(e).some(m=>valid(e,c,m))&&(!activation.condition||activation.condition(e,c)),inputs:(e,c)=>[...(activation.costInput?activation.costInput(e,c):[]),g(e,c,'target','选择装备对象',allM(e).filter(m=>valid(e,c,m)),1,1,'own-boost')],resolve:(e,c)=>{equipTo(e,c,e.find(first(c)));}});
  passive(name,{stat:(e,s,m,k)=>{if(s.card.equipTarget!==m.uid)return spec.aura?spec.aura(e,s,m,k):0;return spec.stat?spec.stat(e,s,m,k):spec[k]||0;},...(spec.battleStat?{battleStat:spec.battleStat}:{}),...(spec.protect?{protect:spec.protect}:{})});
 }
 // Instance fields that must survive into move-event snapshots.
 extend('describe',function(prior,card,found){return {...prior.call(this,card,found),gatePairs:card.gatePairs,capsuleUid:card.capsuleUid,waveCounters:card.waveCounters,darkSnakeDamage:card.darkSnakeDamage,mirageDrawn:card.mirageDrawn};});
 extend('normalSummon',function(prior,a){
  const result=prior.call(this,a);
  const summoned=this.find(a.uid)?.card;
  if(summoned&&(a.tributes||[]).length)summoned.tributeMaterialIds=(a.tributes||[]).map(uid=>this.find(uid)?.card.id).filter(Boolean);
  return result;
 });
 // ---- Zombie support -----------------------------------------------------------------
 S('Call of the Mummy',{resolve:()=>{},aiScore:350});Q('Call of the Mummy','special',{zones:['spells'],requiresField:true,summons:true,condition:(e,c)=>e.monsters(c.owner).length===0&&H.specialable(e,c.owner,hand(e,c.owner,m=>monster(m)&&e.race(m)==='不死族'),'effect').length>0,resolve:(e,c)=>choose(e,c,'特殊召唤手牌的不死族',H.specialable(e,c.owner,hand(e,c.owner,m=>monster(m)&&e.race(m)==='不死族'),'effect'),1,1,'early-special',{role:'special'}),aiScore:800});
 S('Book of Life',{summons:true,condition:(e,c)=>H.specialable(e,c.owner,grave(e,c.owner,m=>monster(m)&&e.race(m)==='不死族'),'revive').length>0&&grave(e,1-c.owner,monster).length>0,inputs:(e,c)=>[g(e,c,'target','选择复活的不死族',H.specialable(e,c.owner,grave(e,c.owner,m=>monster(m)&&e.race(m)==='不死族'),'revive'),1,1,'special'),g(e,c,'banish','选择除外的对方墓地怪兽',grave(e,1-c.owner,monster),1,1,'banish')],resolve:(e,c)=>{const f=e.find(first(c)),b=e.find(first(c,'banish'));if(b?.zone==='grave')e.move(b.card.uid,'banished',{kind:'effect-banish',source:c.source,byOwner:c.owner});if(f?.zone==='grave'&&e.canSpecial(c.owner,f.card,{via:'revive'}))e.special(c.owner,f.card.uid,{via:'revive'});},aiScore:800});
 // ---- Book of Moon / Taiyou -----------------------------------------------------------
 S('Book of Moon',{damageStep:true,condition:(e,c)=>allM(e).some(m=>m.faceUp&&!['link','token'].includes(CARDS[m.id].type)),inputs:target('选择变为里侧守备的表侧怪兽',e=>allM(e).filter(m=>m.faceUp&&!['link','token'].includes(CARDS[m.id].type)),'destroy'),resolve:(e,c)=>e.setPosition(first(c),'defense',c.source,true),aiResponse:(e,c,w)=>w.attack&&w.attack.stage==='declare'?1200:0});
 S('Book of Taiyou',{condition:(e,c)=>allM(e).some(m=>!m.faceUp&&CARDS[m.id].type!=='token'),inputs:target('选择翻开的里侧怪兽',e=>allM(e).filter(m=>!m.faceUp&&CARDS[m.id].type!=='token'),'destroy'),resolve:(e,c)=>e.flipFaceUp(first(c),{position:'attack',source:c.source}),aiScore:300});
 S('Timidity',{condition:e=>allS(e).some(m=>!m.faceUp),resolve:(e,c)=>{e.state.timidityUntil=e.state.turn+(e.state.active===c.owner?2:1);},aiScore:150});
 // ---- Draw, search and deck manipulation ------------------------------------------------
 S('Mirage of Nightmare',{resolve:()=>{},aiScore:500});
 E.on('standby',(e,v)=>{
  for(const m of e.spells(1-v.owner))if(active(e,m)&&is(m,'Mirage of Nightmare')&&hand(e,1-v.owner).length<4){const n=Math.min(4-hand(e,1-v.owner).length,e.state.players[1-v.owner].deck.length);if(n>0){e.draw(1-v.owner,n);m.mirageDrawn=n;}else m.mirageDrawn=0;}
  for(const m of e.spells(v.owner))if(active(e,m)&&is(m,'Mirage of Nightmare')&&(m.mirageDrawn||0)>0){const n=m.mirageDrawn;delete m.mirageDrawn;randomDiscard(e,v.owner,n,src(e,m));}
 });
 S('Toon Table of Contents',{condition:(e,c)=>deck(e,c.owner,m=>CARDS[m.id].toon||CARDS[m.id].officialName.startsWith('Toon ')).length>0,inputs:target('选择加入手牌的卡通卡',(e,c)=>deck(e,c.owner,m=>CARDS[m.id].toon||CARDS[m.id].officialName.startsWith('Toon ')),'search'),resolve:(e,c)=>{if(e.find(first(c))?.zone==='deck')e.search(c.owner,args(c));},aiScore:900});
 S('Gather Your Mind',{condition:(e,c)=>deck(e,c.owner,m=>is(m,'Gather Your Mind')).length>0&&!e.wasUsed(c.owner,{id:c.sourceId},'gather-2002','name'),inputs:target('选择加入手牌的集中',(e,c)=>deck(e,c.owner,m=>is(m,'Gather Your Mind')),'search'),resolve:(e,c)=>{e.useKey(c.owner,{id:c.sourceId},'gather-2002','name');if(e.find(first(c))?.zone==='deck')e.search(c.owner,args(c));},aiScore:300});
 S('Emblem of Dragon Destroyer',{condition:(e,c)=>H.cards(e,c.owner,['deck','grave'],m=>is(m,'Buster Blader')).length>0,inputs:target('选择加入手牌的破坏剑士',(e,c)=>H.cards(e,c.owner,['deck','grave'],m=>is(m,'Buster Blader')),'search'),resolve:(e,c)=>moved(e,c,args(c),'hand','effect-return'),aiScore:700});
 S('Dark Designator',{inputs:()=>[H.customGroup('name','宣言怪兽卡名',D.CARD_LIST.filter(m=>monster(m)&&!m.notCollectible).map(m=>({uid:m.id,cardId:m.id,label:m.name})))],resolve:(e,c)=>{const id=first(c,'name');const pool=deck(e,1-c.owner,m=>m.id===id);if(pool.length){e.search(1-c.owner,[pool[0].uid]);e.log('effect','对方把宣言的卡加入手牌',c.owner);}else e.log('effect','对方卡组没有宣言的卡',c.owner);},aiScore:200});
 S('Double Spell',{condition:(e,c)=>hand(e,c.owner,m=>CARDS[m.id].type==='spell').length>0&&grave(e,1-c.owner,m=>CARDS[m.id].type==='spell'&&!CARDS[m.id].unplayableFromHand).length>0&&e.state.players[c.owner].spells.includes(null),inputs:(e,c)=>[discardCost(1,m=>CARDS[m.id].type==='spell')(e,c),g(e,c,'target','选择发动的对方墓地魔法',grave(e,1-c.owner,m=>CARDS[m.id].type==='spell'&&!CARDS[m.id].unplayableFromHand),1,1,'search')],cost:(e,c)=>H.discard(e,c,args(c,'cost')),resolve:(e,c)=>{const f=e.find(first(c));if(!f||f.zone!=='grave')return;const key=f.card.id+'::cast',def=E.get(key);if(!def)return;const context=e.abilityContext(f.card.uid,key,'main',{owner:c.owner});if(!def.condition||def.condition(e,context)){e.move(f.card.uid,'hand',{owner:c.owner,kind:'effect-add',source:c.source});context.uid=f.card.uid;context.event.forcedSpell=true;e.queue({op:'2002-double-spell',owner:c.owner,context});}},note:'把对方墓地的魔法放到自己场上并发动一次',aiScore:700});
 E.op('2002-double-spell',(e,t)=>e.prepare(t.context));
 extend('earlyCanUse',function(prior,c,a){
  if(c.event?.forcedSpell&&a.cardActivation)return true;
  return prior.call(this,c,a);
 });
 S('Question',{condition:(e,c)=>grave(e,c.owner,monster).length>0,resolve:(e,c)=>{const list=grave(e,c.owner,monster);e.queueChoice(1-c.owner,'猜对方墓地最下面的怪兽',H.options(e,{...c,owner:1-c.owner},list),1,1,'2002-question',{source:c.source,bottom:list[0].uid});},aiScore:350});
 E.op('2002-question',(e,t)=>{const f=e.find(t.context.bottom);if(!f||f.zone!=='grave')return;if(t.picks[0]===t.context.bottom){e.move(f.card.uid,'banished',{kind:'effect-banish',source:t.context.source,byOwner:t.owner});e.log('effect','猜对了，怪兽被除外',t.owner);}else{e.log('effect','猜错了，怪兽特殊召唤',t.owner);if(e.canSpecial(t.owner,f.card,{via:'effect'})&&e.freeMain(t.owner))e.special(t.owner,f.card.uid,{via:'effect'});}});
 S('Reasoning',{condition:(e,c)=>e.state.players[c.owner].deck.length>0,resolve:(e,c)=>{e.queueChoice(1-c.owner,'宣言等级',[1,2,3,4,5,6,7,8].map(n=>({uid:String(n),label:n+'星'})),1,1,'2002-reasoning',{source:c.source,owner:c.owner});},aiScore:700});
 E.op('2002-reasoning',(e,t)=>{const owner=t.context.owner,declared=Number(t.picks[0]);const list=[];let found=null;
  for(const m of deck(e,owner)){list.push(m);if(monster(m)&&!CARDS[m.id].noNormal){found=m;break;}}
  e.revealCards(owner,list,'翻到的卡');
  if(!found){moved(e,{owner,source:t.context.source},list.map(m=>m.uid),'grave','effect-send');return;}
  const rest=list.filter(m=>m!==found);
  if(e.level(found)===declared){moved(e,{owner,source:t.context.source},list.map(m=>m.uid),'grave','effect-send');return;}
  moved(e,{owner,source:t.context.source},rest.map(m=>m.uid),'grave','effect-send');
  if(e.freeMain(owner)>0&&e.canSpecial(owner,found,{via:'effect'}))e.special(owner,found.uid,{via:'effect'});
 });
 S('Different Dimension Capsule',{condition:(e,c)=>e.state.players[c.owner].deck.length>0,inputs:target('选择里侧除外的卡组卡',(e,c)=>deck(e,c.owner),'search'),resolve:(e,c)=>{const f=e.find(first(c));const m=H.source(e,c)?.card;if(f?.zone==='deck'&&m){e.move(f.card.uid,'banished',{kind:'effect-banish',source:c.source,byOwner:c.owner});const banished=e.find(f.card.uid)?.card;if(banished)banished.faceUp=false;m.capsuleUid=f.card.uid;m.capsuleTurn=e.state.turn;}},aiScore:400});
 E.on('standby',(e,v)=>{for(const owner of [0,1])for(const m of [...e.spells(owner)])if(active(e,m)&&is(m,'Different Dimension Capsule')&&m.capsuleUid!==undefined&&e.state.turn>=m.capsuleTurn+2){const f=e.find(m.capsuleUid);delete m.capsuleUid;if(e.find(m.uid))e.destroy(m.uid,{id:m.id,uid:m.uid,owner,effectType:'spell'});if(f?.zone==='banished'&&f.card.originalOwner===owner)e.move(f.card.uid,'hand',{kind:'effect-return',source:{id:m.id,uid:m.uid,owner}});}});
 S('Spellbook Organization',{condition:(e,c)=>e.state.players[c.owner].deck.length>=3,resolve:(e,c)=>{const list=deck(e,c.owner).slice(0,3);e.revealCards(c.owner,list,'确认卡组顶3张');choose(e,c,'按从顶到底的顺序选择卡组顶卡片',list,list.length,list.length,'early-order-top',{ordered:true});},aiScore:250});
 S('Card Shuffle',{resolve:()=>{},aiScore:150});Q('Card Shuffle','shuffle',{zones:['spells'],requiresField:true,condition:(e,c)=>e.state.players[c.owner].lp>300,inputs:()=>[H.customGroup('deck','选择洗切的卡组',[{uid:'self',label:'自己的卡组'},{uid:'opponent',label:'对方的卡组'}])],cost:(e,c)=>pay(e,c,300),resolve:(e,c)=>{const owner=first(c,'deck')==='self'?c.owner:1-c.owner;e.shuffle(e.state.players[owner].deck);},aiScore:50});
 S('Reversal Quiz',{condition:(e,c)=>[...hand(e,c.owner),...ownM(e,c),...e.spells(c.owner)].some(m=>m.uid!==c.uid),inputs:()=>[H.customGroup('kind','宣言卡组顶的种类',[{uid:'monster',label:'怪兽'},{uid:'spell',label:'魔法'},{uid:'trap',label:'陷阱'}])],resolve:(e,c)=>{moved(e,c,[...hand(e,c.owner),...ownM(e,c),...e.spells(c.owner).filter(m=>m.uid!==c.uid)].map(m=>m.uid),'grave','effect-send');const top=e.state.players[c.owner].deck[0];if(!top)return;e.revealCards(c.owner,[top],'确认卡组顶');if((monster(top)?'monster':CARDS[top.id].type)===first(c,'kind')){const a=e.state.players[c.owner].lp,b=e.state.players[1-c.owner].lp;e.state.players[c.owner].lp=b;e.state.players[1-c.owner].lp=a;e.log('effect','生命值交换！',c.owner);}},aiScore:150});
 S('Ante',{condition:(e,c)=>hand(e,c.owner).length>1&&hand(e,1-c.owner).length>0,resolve:(e,c)=>{e.revealCards(c.owner,hand(e,1-c.owner),'查看对方手牌');choose(e,c,'选择公开的手牌怪兽',hand(e,c.owner,monster),1,1,'2002-ante-first',{reveal:true});},aiScore:100});
 E.op('2002-ante-first',(e,t)=>{const mine=e.find(t.picks[0])?.card;const monsterCards=hand(e,1-t.owner,monster);if(!mine)return;if(monsterCards.length){e.queueChoice(1-t.owner,'选择公开的手牌怪兽',H.options(e,{owner:1-t.owner},monsterCards,{reveal:true}),1,1,'2002-ante-last',{source:t.context.source,mine:mine.uid});}else{const la=CARDS[mine.id].level||0;e.log('effect','对方没有怪兽卡，公开方失败',t.owner);moved(e,{owner:t.owner,source:t.context.source},[mine.uid],'grave','effect-discard');e.damage(t.owner,1000,'效果');}});
 E.op('2002-ante-last',(e,t)=>{const a=e.find(t.context.mine)?.card,b=e.find(t.picks[0])?.card;if(!a||!b)return;const la=CARDS[a.id].level||0,lb=CARDS[b.id].level||0;
  if(la>lb){moved(e,{owner:1-t.owner,source:t.context.source},[b.uid],'grave','effect-discard');e.damage(1-t.owner,1000,'效果');}
  else if(lb>la){moved(e,{owner:t.owner,source:t.context.source},[a.uid],'grave','effect-discard');e.damage(t.owner,1000,'效果');}
 });
 S('Hieroglyph Lithograph',{condition:(e,c)=>e.state.players[c.owner].lp>1000,cost:(e,c)=>pay(e,c,1000),resolve:(e,c)=>{e.state.players[c.owner].handSizeLimit=7;},aiScore:100});
 // ---- Removal and battle tricks ----------------------------------------------------------
 S('Dark Core',{condition:(e,c)=>hand(e,c.owner).length>0&&allM(e).some(m=>m.faceUp),inputs:(e,c)=>[discardCost()(e,c),g(e,c,'target','选择除外的表侧怪兽',allM(e).filter(face),1,1,'banish')],cost:(e,c)=>H.discard(e,c,args(c,'cost')),resolve:(e,c)=>{const f=e.find(first(c));if(f&&(!H.fieldZone(f.zone)||!e.unaffected(f.card,c.source)))e.move(f.card.uid,'banished',{kind:'effect-banish',source:c.source,byOwner:c.owner});},aiScore:750});
 S('Tribute Doll',{summons:true,condition:(e,c)=>hand(e,c.owner,m=>CARDS[m.id].level===7&&!CARDS[m.id].noNormal&&monster(m)).some(m=>e.canSpecial(c.owner,m,{via:'effect'}))&&ownM(e,c).some(m=>e.canTribute(m,c.owner))&&e.freeMain(c.owner)>0,inputs:(e,c)=>[tributeInput()(e,c),g(e,c,'target','选择特殊召唤的7星怪兽',H.specialable(e,c.owner,hand(e,c.owner,m=>CARDS[m.id].level===7&&!CARDS[m.id].noNormal&&monster(m)),'effect'),1,1,'special')],cost:(e,c)=>tribute(e,c),resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='hand'){const m=e.special(c.owner,f.card.uid,{via:'effect'});if(m)m.cannotAttackUntil=e.state.turn;}},aiScore:800});
 S('Metamorphosis',{summons:true,condition:(e,c)=>ownM(e,c).some(m=>e.canTribute(m,c.owner))&&e.state.players[c.owner].extra.some(m=>CARDS[m.id].type==='fusion'&&e.level(m)>0),inputs:(e,c)=>[tributeInput()(e,c)],cost:(e,c)=>{const f=e.find(first(c,'cost'));c.morphLevel=f?e.level(f.card):0;tribute(e,c);},resolve:(e,c)=>{const pool=H.specialable(e,c.owner,e.state.players[c.owner].extra.filter(m=>CARDS[m.id].type==='fusion'&&e.level(m)===c.morphLevel),'effect');if(pool.length)choose(e,c,'选择同等级的融合怪兽',pool,1,1,'early-special',{role:'special'});else e.log('effect','没有同等级的融合怪兽',c.owner);},aiScore:850});
 S('Secret Pass to the Treasures',{condition:(e,c)=>ownM(e,c).some(m=>m.faceUp&&e.attackValue(m)<=1000),inputs:target('选择可直接攻击的怪兽',(e,c)=>ownM(e,c).filter(m=>m.faceUp&&e.attackValue(m)<=1000),'own-boost'),resolve:(e,c)=>{const m=e.find(first(c))?.card;if(m)m.directAttackTurn=e.state.turn;},aiScore:(e,c)=>foeM(e,c).length?600:-100});
 S('Cost Down',{condition:(e,c)=>hand(e,c.owner,m=>m.uid!==c.uid&&monster(m)&&CARDS[m.id].level>2).length>0,inputs:(e,c)=>[discardCost()(e,c)],cost:(e,c)=>H.discard(e,c,args(c,'cost')),resolve:(e,c)=>{e.state.players[c.owner].costDownTurn=e.state.turn;},aiScore:350});
 extend('level',function(prior,card){let n=prior.call(this,card);const f=this.find(card.uid);if(n>2&&f&&f.zone==='hand'&&this.state.players[f.owner].costDownTurn===this.state.turn)n-=2;return n;});
 S('Token Thanksgiving',{condition:e=>allM(e).some(m=>CARDS[m.id].type==='token'),resolve:(e,c)=>{let n=0;for(const m of [...allM(e)])if(CARDS[m.id].type==='token'){if(e.destroy(m.uid,c.source))n++;}if(n)e.heal(c.owner,n*800);},aiScore:300});
 // ---- Continuous Spells --------------------------------------------------------------------
 S('Banner of Courage',{resolve:()=>{},aiScore:250});passive('Banner of Courage',{stat:(e,s,m,k)=>k==='atk'&&e.find(m.uid)?.owner===s.owner&&e.state.phase==='battle'&&e.state.active===s.owner?200:0});
 S('Kishido Spirit',{resolve:()=>{},aiScore:300});passive('Kishido Spirit',{protect:(e,s,m,battle,source)=>battle&&e.find(m.uid)?.owner===s.owner&&e.attackValue(m)===e.attackValue(e.find(source?.uid)?.card||{})});
 S('Dark Room of Nightmare',{resolve:()=>{},aiScore:300});
 E.on('damage',(e,v)=>{if(v.battle||e.state.winner!==null||v.amount<=0)return;for(const p of [0,1])for(const m of e.spells(p))if(active(e,m)&&is(m,'Dark Room of Nightmare')&&v.owner!==p)e.queue({op:'2002-dark-room',owner:p,context:{source:src(e,m),target:1-p,amount:300}});});
 E.op('2002-dark-room',(e,t)=>{if(e.state.winner===null)e.damage(t.context.target,t.context.amount,'效果');});
 S('Dark Snake Syndrome',{resolve:()=>{},aiScore:150});onStandby('Dark Snake Syndrome',{resolve:(e,c)=>{const m=H.source(e,c)?.card;if(!m)return;m.darkSnakeDamage=(m.darkSnakeDamage||100)*2;e.damage(0,m.darkSnakeDamage,'效果');if(e.state.winner===null)e.damage(1,m.darkSnakeDamage,'效果');}},{optional:false});
 S('Wave-Motion Cannon',{resolve:()=>{},aiScore:300});Q('Wave-Motion Cannon','fire',{zones:['spells'],requiresField:true,condition:(e,c)=>(H.source(e,c)?.card?.waveCounters||0)>0,resolve:(e,c)=>{const m=H.source(e,c)?.card;if(!m)return;const n=m.waveCounters||0;delete m.waveCounters;if(e.find(c.uid)&&n>0){e.move(c.uid,'grave',{kind:'effect-send',source:c.source,byOwner:c.owner});burn(e,c,n*1000);}},aiScore:(e,c)=>((H.source(e,c)?.card?.waveCounters||0)*1000>=e.state.players[1-c.owner].lp)?5000:0});
 E.on('standby',(e,v)=>{for(const m of e.spells(v.owner))if(active(e,m)&&is(m,'Wave-Motion Cannon'))m.waveCounters=(m.waveCounters||0)+1;});
 S('Senri Eye',{resolve:()=>{},aiScore:150});Q('Senri Eye','peek',{zones:['spells'],requiresField:true,condition:(e,c)=>e.state.players[c.owner].lp>100&&e.state.players[1-c.owner].deck.length>0,cost:(e,c)=>pay(e,c,100),resolve:(e,c)=>{const top=e.state.players[1-c.owner].deck[0];if(top)e.revealCards(c.owner,[top],'确认对方卡组顶');},aiScore:50});
 S('Frontline Base',{resolve:()=>{},aiScore:400});Q('Frontline Base','special',{zones:['spells'],requiresField:true,summons:true,condition:(e,c)=>H.specialable(e,c.owner,hand(e,c.owner,m=>CARDS[m.id].earlyRules?.union&&e.level(m)<=4),'effect').length>0,resolve:(e,c)=>choose(e,c,'特殊召唤手牌的低星同盟怪兽',H.specialable(e,c.owner,hand(e,c.owner,m=>CARDS[m.id].earlyRules?.union&&e.level(m)<=4),'effect'),1,1,'early-special',{role:'special'}),aiScore:750});
 S('Mass Driver',{resolve:()=>{},aiScore:200});Q('Mass Driver','burn',{zones:['spells'],requiresField:true,condition:(e,c)=>ownM(e,c).some(m=>e.canTribute(m,c.owner)),inputs:(e,c)=>[g(e,c,'cost','选择解放的怪兽',ownM(e,c).filter(m=>e.canTribute(m,c.owner)),1,1,'cost')],cost:(e,c)=>tribute(e,c),resolve:(e,c)=>burn(e,c,400),aiScore:(e,c)=>e.state.players[1-c.owner].lp<=400?4000:100});
 S('Kaiser Colosseum',{resolve:()=>{},aiScore:350});mark('Kaiser Colosseum','自己场上有怪兽时，对方的怪兽数量不能超过自己场上怪兽数');
 S('Non-Spellcasting Area',{resolve:()=>{},aiScore:300});mark('Non-Spellcasting Area','除效果怪兽外的表侧怪兽不受其他魔法效果影响');
 S('Precious Cards from Beyond',{resolve:()=>{},aiScore:400});
 E.on('summon',(e,v)=>{if(v.kind!=='normal'||!v.materials||v.materials.length<2)return;for(const m of e.spells(v.owner))if(active(e,m)&&is(m,'Precious Cards from Beyond')&&e.state.players[v.owner].deck.length)e.draw(v.owner,2);});
 S('Continuous Destruction Punch',{resolve:()=>{},aiScore:300});
 E.on('damage-end',(e,v)=>{const a=v.attack;if(!a||!a.target)return;const af=e.find(a.uid),df=e.find(a.target);if(!af||!df)return;if(df.card.position==='defense'&&e.defenseValue(df.card,a)>e.attackValue(af.card,a))for(const m of e.spells(df.owner))if(active(e,m)&&is(m,'Continuous Destruction Punch'))e.destroy(a.uid,{id:m.id,uid:m.uid,owner:df.owner,effectType:'spell'},true);});
 S('Different Dimension Gate',{condition:(e,c)=>ownM(e,c).length>0&&foeM(e,c).length>0,inputs:(e,c)=>[g(e,c,'own','选择除外的自己怪兽',ownM(e,c),1,1,'search'),g(e,c,'foe','选择除外的对方怪兽',foeM(e,c),1,1,'banish')],resolve:(e,c)=>{const m=H.source(e,c)?.card,a=e.find(first(c,'own')),b=e.find(first(c,'foe'));if(!m||!a||!b)return;m.gatePairs=[{uid:a.card.uid,generation:a.card.generation,zone:a.index,owner:a.owner,position:a.card.position},{uid:b.card.uid,generation:b.card.generation,zone:b.index,owner:b.owner,position:b.card.position}];for(const f of [a,b])e.move(f.card.uid,'banished',{kind:'effect-banish',source:c.source,byOwner:c.owner});},aiScore:250});
 E.on('move',(e,v)=>{if(v.kind!=='destroy'||!v.previous.gatePairs)return;for(const pair of v.previous.gatePairs){const f=e.find(pair.uid);if(f?.zone!=='banished')continue;const p=e.state.players[pair.owner];if(p.monsters[pair.zone])continue;const m=e.remove(pair.uid).card;m.faceUp=true;m.position=pair.position;p.monsters[pair.zone]=m;}});
 S('Yu-Jo Friendship',{resolve:(e,c)=>{const hasUnity=hand(e,c.owner,m=>is(m,'Unity')).length>0;e.queueChoice(1-c.owner,hasUnity?'对方手牌有同心协力，必须接受握手':'是否接受握手？',[{uid:'accept',label:'接受握手',value:10},{uid:'refuse',label:'拒绝',value:0}],1,1,'2002-yujo',{source:c.source});},aiScore:50});
 E.op('2002-yujo',(e,t)=>{if(t.picks[0]!=='accept')return;const total=e.state.players[0].lp+e.state.players[1].lp;e.state.players[0].lp=Math.floor(total/2);e.state.players[1].lp=Math.floor(total/2);e.log('effect','握手成立，双方生命值平分',t.owner);});
 S('A Deal with Dark Ruler',{summons:true,condition:(e,c)=>e.state.dealWithDarkRuler?.turn===e.state.turn&&e.state.dealWithDarkRuler.owner===c.owner&&H.cards(e,c.owner,['hand','deck'],m=>is(m,'Berserk Dragon')).length>0,resolve:(e,c)=>{const list=H.cards(e,c.owner,['hand','deck'],m=>is(m,'Berserk Dragon'));if(list.length)choose(e,c,'特殊召唤狂暴龙',list,1,1,'early-special',{via:'dark-ruler-deal',shuffle:true,role:'special'});},aiScore:600});
 E.on('move',(e,v)=>{if(v.to==='grave'&&H.fieldZone(v.from)&&CARDS[v.id]&&(CARDS[v.id].level||0)>=8&&v.owner!==undefined)e.state.dealWithDarkRuler={turn:e.state.turn,owner:v.owner};});
 S('Contract with Exodia',{summons:true,condition:(e,c)=>{const p=e.state.players[c.owner];return ['Exodia the Forbidden One','Right Arm of the Forbidden One','Left Arm of the Forbidden One','Right Leg of the Forbidden One','Left Leg of the Forbidden One'].every(n=>p.grave.some(m=>is(m,n)))&&hand(e,c.owner,m=>is(m,'Exodia Necross')).length>0;},inputs:target('选择特殊召唤的艾克佐迪亚之灵',(e,c)=>hand(e,c.owner,m=>is(m,'Exodia Necross')),'special'),resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='hand'&&e.canSpecial(c.owner,f.card,{via:'exodia-necross'}))e.special(c.owner,f.card.uid,{via:'exodia-necross'});},aiScore:1200});
 S('Royal Tribute',{condition:(e,c)=>e.hasEarly('Necrovalley',c.owner)&&[0,1].some(p=>hand(e,p,monster).length),resolve:(e,c)=>{for(const p of [0,1])moved(e,c,hand(e,p,monster).map(m=>m.uid),'grave','effect-discard');},aiScore:700});
 S('Combination Attack',{condition:(e,c)=>ownM(e,c).some(m=>m.attacksMade>0&&e.activeEquip(m).some(eq=>CARDS[eq.id].earlyRules?.union)),inputs:target('选择再次攻击的装备怪兽',(e,c)=>ownM(e,c).filter(m=>m.attacksMade>0&&e.activeEquip(m).some(eq=>CARDS[eq.id].earlyRules?.union)),'own-boost'),resolve:(e,c)=>{const f=e.find(first(c));if(!f)return;for(const eq of e.activeEquip(f.card)){if(CARDS[eq.id].earlyRules?.union&&e.freeMain(c.owner)>0&&e.canSpecial(c.owner,eq,{via:'union'}))e.special(c.owner,eq.uid,{via:'union'});}f.card.attacksMade=0;f.card.attacked=false;},aiScore:600});
 // ---- Equip Spells -------------------------------------------------------------------------
 customEquip('Buster Rancher',{maxAtk:1000,battleStat:(e,s,m,k,a)=>{if(k!=='atk'||!a||s.card.equipTarget!==m.uid)return 0;const foe=e.find(a.uid===m.uid?a.target:a.uid)?.card;if(!foe)return 0;return foe.position==='attack'&&e.attackValue(foe,a)>=2500||foe.position==='defense'&&e.defenseValue(foe,a)>=2500?2500:0;}});
 X.equip('Metalsilver Armor',{atk:0,def:0});mark('Metalsilver Armor','对方不能使用指定装备怪兽以外怪兽的指定效果与攻击');
 X.equip('Raregold Armor',{magnet:true});mark('Raregold Armor','对方只能选择装备怪兽作为攻击对象');
 X.equip('Demotion',{atk:0,def:0});
 extend('level',function(prior,card){let n=prior.call(this,card);const f=this.find(card.uid);if(n>2&&f&&H.fieldZone(f.zone)&&this.activeEquip(card).some(m=>is(m,'Demotion')))n=Math.max(1,n-2*this.activeEquip(card).filter(m=>is(m,'Demotion')).length);return n;});
 mark('Demotion','装备怪兽等级-2');
 X.equip('Big Bang Shot',{atk:400,piercing:true});
 E.on('move',(e,v)=>{if(is({id:v.id},'Big Bang Shot')&&['destroy','battle'].includes(v.kind)&&v.previous.equipTarget){const t=e.find(v.previous.equipTarget);if(t&&H.fieldZone(t.zone))e.move(t.card.uid,'banished',{kind:'effect-banish',source:{id:v.id,uid:v.uid,owner:v.owner}});}});
 mark('Big Bang Shot','装备怪兽+400攻击与贯穿；此卡离场时装备怪兽除外');
 X.equip('Twin Swords of Flashing Light - Tryce',{atk:-500});
 S('Twin Swords of Flashing Light - Tryce',{condition:(e,c)=>hand(e,c.owner,m=>m.uid!==c.uid).length>0&&allM(e).some(m=>m.faceUp),inputs:(e,c)=>[discardCost()(e,c),g(e,c,'target','选择装备对象（攻击力-500，攻击2次）',allM(e).filter(face),1,1,'own-boost')],cost:(e,c)=>H.discard(e,c,args(c,'cost')),resolve:(e,c)=>{equipTo(e,c,e.find(first(c)));},aiScore:500});
 extend('attackAllowance',function(prior,card){let n=prior.call(this,card);if(this.activeEquip(card).some(m=>is(m,'Twin Swords of Flashing Light - Tryce')))n+=1;return n;});
 X.equip('Gravity Axe - Grarl',{atk:500});
 extend('positionLocked',function(prior,card){if([0,1].some(p=>this.monsters(p).some(m=>m.faceUp&&this.activeEquip(m).some(eq=>is(eq,'Gravity Axe - Grarl')))))return true;return prior.call(this,card);});
 mark('Gravity Axe - Grarl','装备怪兽+500攻击；有装备存在时对方怪兽不能变更表示');
 X.equip('Rod of the Mind\'s Eye',{});
 extend('damage',function(prior,owner,amount,source){
  const a=this.state.frame?.attack;
  if(this._advancedReady&&source==='战斗'&&amount>0&&a){
   const dealer=owner===a.owner?this.find(a.uid)?.card:this.find(a.target)?.card;
   if(dealer&&this.activeEquip(dealer).some(m=>is(m,'Rod of the Mind\'s Eye'))&&amount!==1000)return prior.call(this,owner,1000,'战斗');
  }
  return prior.call(this,owner,amount,source);
 });
 mark('Rod of the Mind\'s Eye','装备怪兽给予的战斗伤害固定为1000');
 X.equip('Rod of Silence - Kay\'est',{def:500});
 extend('earlyNegatesLink',function(prior,link,probe=false){
  if(prior.call(this,link,probe))return true;
  if(link.source.effectType!=='spell'||CARDS[link.sourceId]?.type!=='spell')return false;
  const targets=Object.values(link.targetMeta||{}).flatMap(x=>Object.keys(x)).map(uid=>this.find(uid)).filter(f=>f&&H.fieldZone(f.zone));
  for(const t of targets)for(const eq of this.activeEquip(t.card)){
   if(is(eq,'Rod of Silence - Kay\'est')){if(!probe&&this.find(link.uid))this.destroy(link.uid,{id:eq.id,uid:eq.uid,owner:this.find(eq.uid).owner,effectType:'spell'});return true;}
  }
  return false;
 });
 mark('Rod of Silence - Kay\'est','装备怪兽+500守备；指定装备怪兽的其他魔法无效并破坏');
 X.equip('Shooting Star Bow - Ceal',{atk:-1000});
 mark('Shooting Star Bow - Ceal','装备怪兽攻击力-1000，可以直接攻击对方');
 X.equip('Wicked-Breaking Flamberge - Baou',{atk:500});
 S('Wicked-Breaking Flamberge - Baou',{condition:(e,c)=>hand(e,c.owner,m=>m.uid!==c.uid).length>0&&allM(e).some(m=>m.faceUp),inputs:(e,c)=>[discardCost()(e,c),g(e,c,'target','选择装备对象（攻击力+500）',allM(e).filter(face),1,1,'own-boost')],cost:(e,c)=>H.discard(e,c,args(c,'cost')),resolve:(e,c)=>{equipTo(e,c,e.find(first(c)));},aiScore:550});
 extend('destroy',function(prior,uid,source=null,battle=false,options={}){
  const f=this.find(uid);
  if(battle&&source){const s=this.find(source.uid);if(s&&H.fieldZone(s.zone)&&!this.negated(s.card)&&(s.card.diffusionTurn===this.state.turn||is(s.card,'Ultimate Obedient Fiend')||this.activeEquip(s.card).some(eq=>is(eq,'Wicked-Breaking Flamberge - Baou')))&&CARDS[f?.card.id]?.effect)f.card.earlyBattleNegated=true;}
  return prior.call(this,uid,source,battle,options);
 });
 X.equip('Butterfly Dagger - Elma',{atk:300});
 onMove('Butterfly Dagger - Elma','return',{condition:(e,c)=>e.find(c.uid)?.zone==='grave',resolve:(e,c)=>{if(e.find(c.uid)?.zone==='grave')e.move(c.uid,'hand',{kind:'effect-return',source:c.source});}},(e,v)=>v.to==='grave'&&['destroy','battle'].includes(v.kind)&&v.previous.equipTarget);
 S('Fairy of the Spring',{condition:(e,c)=>grave(e,c.owner,m=>CARDS[m.id].type==='spell'&&CARDS[m.id].spellKind==='equip').length>0,inputs:target('选择回收的装备魔法',(e,c)=>grave(e,c.owner,m=>CARDS[m.id].type==='spell'&&CARDS[m.id].spellKind==='equip'),'search'),resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='grave'){e.move(f.card.uid,'hand',{kind:'effect-return',source:c.source});(e.state.players[c.owner].fairyLocks||=[]).push({id:f.card.id,turn:e.state.turn});}},aiScore:350});
 extend('earlyCanUse',function(prior,c,a){
  if(!prior.call(this,c,a))return false;
  if(a.cardActivation&&CARDS[c.sourceId].type==='spell'&&(this.state.players[c.owner].fairyLocks||[]).some(l=>l.id===c.sourceId&&l.turn>=this.state.turn))return false;
  return true;
 });
 S('Autonomous Action Unit',{summons:true,condition:(e,c)=>e.state.players[c.owner].lp>1500&&H.specialable(e,c.owner,grave(e,1-c.owner,monster),'revive').length>0&&e.state.players[c.owner].spells.filter(m=>m&&m.uid!==c.uid).length<5,inputs:target('选择复活并装备的对方墓地怪兽',(e,c)=>H.specialable(e,c.owner,grave(e,1-c.owner,monster),'revive'),'special'),cost:(e,c)=>pay(e,c,1500),resolve:(e,c)=>{const f=e.find(first(c)),s=H.source(e,c);if(f?.zone==='grave'&&s?.zone==='spells'){const m=e.special(c.owner,f.card.uid,{via:'revive'});if(m){s.card.equipTarget=m.uid;e.emit({type:'equip',owner:c.owner,uid:c.uid,id:c.sourceId,target:m.uid});}}},aiScore:850});
 E.on('move',(e,v)=>{if(is({id:v.id},'Autonomous Action Unit')&&['destroy','battle'].includes(v.kind)&&v.previous.equipTarget){const t=e.find(v.previous.equipTarget);if(t&&H.fieldZone(t.zone))e.destroy(t.card.uid,{id:v.id,uid:v.uid,owner:v.owner});}});
 S('Unity',{condition:(e,c)=>ownM(e,c).some(m=>m.faceUp),inputs:target('选择提升守备力的怪兽',(e,c)=>ownM(e,c).filter(face),'own-boost'),resolve:(e,c)=>{const m=e.find(first(c))?.card;if(m){const total=ownM(e,c).filter(x=>x.faceUp).reduce((n,x)=>n+e.originalDefense(x),0);e.modify(m.uid,'def','set',total,e.state.turn,c.source);}},aiScore:250});
 S('Diffusion Wave-Motion',{condition:(e,c)=>e.state.players[c.owner].lp>1000&&ownM(e,c).some(m=>m.faceUp&&e.level(m)>=7&&e.race(m)==='魔法师族')&&foeM(e,c).length>0,inputs:target('选择发动的魔法师族',(e,c)=>ownM(e,c).filter(m=>m.faceUp&&e.level(m)>=7&&e.race(m)==='魔法师族'),'own-boost'),cost:(e,c)=>pay(e,c,1000),resolve:(e,c)=>{const m=e.find(first(c))?.card;if(m){m.diffusionTurn=e.state.turn;e.state.players[c.owner].diffusionCaster=m.uid;}},aiScore:1000});
 extend('attackAllowance',function(prior,card){let n=prior.call(this,card);if(card.diffusionTurn===this.state.turn)n=Math.max(n,this.monsters(1-this.find(card.uid).owner).length);return n;});
 extend('canAttack',function(prior,card,owner=this.state.active,target=null){
  if(!prior.call(this,card,owner,target))return false;
  const caster=this.state.players[owner]?.diffusionCaster;
  if(caster&&this.find(caster)?.card?.diffusionTurn===this.state.turn&&card.uid!==caster)return false;
  return true;
 });
 S('Amazoness Spellcaster',{condition:(e,c)=>ownM(e,c,m2=>amazoness(m2)).some(m2=>m2.faceUp)&&foeM(e,c).some(m2=>m2.faceUp),inputs:(e,c)=>[g(e,c,'own','选择自己的亚马逊怪兽',ownM(e,c,m2=>amazoness(m2)).filter(face),1,1,'own-boost'),g(e,c,'foe','选择对方表侧怪兽',foeM(e,c).filter(face),1,1,'destroy')],resolve:(e,c)=>{const a=e.find(first(c,'own'))?.card,b=e.find(first(c,'foe'))?.card;if(!a||!b)return;const av=e.originalAttack(a),bv=e.originalAttack(b);e.modify(a.uid,'atk','set',bv,e.state.turn,c.source);e.modify(b.uid,'atk','set',av,e.state.turn,c.source);},aiScore:600});
 S('Poison of the Old Man',{inputs:()=>[H.customGroup('mode','选择效果',[{uid:'heal',label:'回复1200LP',value:5},{uid:'burn',label:'给予800伤害',value:10}])],resolve:(e,c)=>first(c,'mode')==='heal'?e.heal(c.owner,1200):burn(e,c,800),aiScore:400});
 S('Spell Shattering Arrow',{destroys:true,condition:(e,c)=>e.spells(1-c.owner).some(m=>m.faceUp),resolve:(e,c)=>{const list=e.spells(1-c.owner).filter(m=>m.faceUp);let n=0;for(const m of list)if(e.destroy(m.uid,c.source))n++;if(n)burn(e,c,n*500);},aiScore:700});
 S('Pyramid Energy',{condition:(e,c)=>ownM(e,c).some(face),inputs:()=>[H.customGroup('stat','选择提升攻击力或守备力',[{uid:'atk',label:'全体攻击力+200',value:10},{uid:'def',label:'全体守备力+500',value:8}])],resolve:(e,c)=>{const stat=first(c,'stat'),amount=stat==='atk'?200:500;for(const m of ownM(e,c).filter(face))e.modify(m.uid,stat,'add',amount,e.state.turn,c.source);},aiScore:300});
 S('Spell of Pain',{main:false,condition:(e,c)=>{const l=c.event.window?.chainLast;return !!l&&l.owner!==c.owner&&['spell','monster'].includes(l.source.effectType||'');},resolve:(e,c)=>{const l=e.state.chain.find(x=>x.id===c.responseTo);if(l)l.painRedirect=c.owner;},note:'连锁对方给予效果伤害的魔法或怪兽效果，实际发生伤害时转给对方',aiResponse:()=>1300});
 extend('damage',function(prior,owner,amount,source){
  if(this.state.chainResolving&&source==='效果'&&amount>0){
   for(const link of [...this.state.chain]){
    if(link.painRedirect===owner){const reflector=link.painRedirect;link.painRedirect=undefined;this.log('effect','痛苦之咒言：伤害转给对方',reflector);return prior.call(this,1-owner,amount,'效果');}
   }
  }
  return prior.call(this,owner,amount,source);
 });
 S('My Body as a Shield',{main:false,damageStep:true,condition:(e,c)=>{const l=c.event.window?.chainLast;return e.state.players[c.owner].lp>1500&&!!l&&l.owner!==c.owner&&E.willDestroy(e,l)&&Object.values(l.args||{}).flat().some(uid=>{const f=e.find(uid);return f&&H.fieldZone(f.zone);});},cost:(e,c)=>pay(e,c,1500),resolve:(e,c)=>e.negateLink(c.responseTo,c.source,true,true),aiResponse:()=>1600});
 S('Jar Robber',{main:false,condition:(e,c)=>{const l=c.event.window?.chainLast;return !!l&&l.owner!==c.owner&&is({id:l.sourceId},'Pot of Greed');},resolve:(e,c)=>{if(e.negateLink(c.responseTo,c.source,false,false))e.draw(c.owner,1);},aiResponse:()=>900});
 S('Mega Ton Magical Cannon',{condition:(e,c)=>[...allM(e),...allS(e)].filter(m=>m.faceUp&&(m.counters||0)>0&&e.find(m.uid)?.owner===c.owner).reduce((n,m)=>n+(m.counters||0),0)>=10,resolve:(e,c)=>{const holders=[...allM(e),...allS(e)].filter(m=>m.faceUp&&(m.counters||0)>0&&e.find(m.uid)?.owner===c.owner);let left=10;for(const m of holders){if(left<=0)break;const take=Math.min(left,m.counters||0);m.counters-=take;left-=take;}destroy(e,c,e.field(1-c.owner).map(m=>m.uid));},aiScore:900});
 S('Fiend\'s Sanctuary',{summons:true,condition:(e,c)=>e.freeMain(c.owner)>0,resolve:(e,c)=>{for(const m of e.createTokens(c.owner,'2002-metal-fiend-token',1))m.metalFiend=true;},aiScore:300});
 E.on('standby',(e,v)=>{for(const f of e.refs(v.owner,['monsters','extraMonster'])){const m=f.card;if(m.id==='2002-metal-fiend-token'&&m.metalFiend&&e.find(m.uid)){const list=[{uid:'pay',label:'支付 1000 LP',value:10},{uid:'destroy',label:'破坏衍生物',value:0}].filter(o=>o.uid!=='pay'||e.state.players[v.owner].lp>1000);e.queueChoice(v.owner,'恶魔圣域：支付1000LP或破坏衍生物',list,1,1,'2002-metal-sanctuary',{source:{id:I('Fiend\'s Sanctuary'),owner:v.owner}});}}});
 E.op('2002-metal-sanctuary',(e,t)=>{const token=e.monsters(t.owner).find(m=>m.id==='2002-metal-fiend-token');if(!token)return;if(t.picks[0]==='pay'&&e.state.players[t.owner].lp>1000)e.payLP(t.owner,1000);else e.destroy(token.uid,t.context.source);});
})(globalThis);
