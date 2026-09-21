/* 2013 per-card rules: main-deck monsters, part two, plus the last Synchro
 * Monsters. Registered from effects-2013.js. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,I,is,A,Q,R,passive,mark,extend,allM,allS,allF,monster,face,ownM,foeM,hand,deck,grave,first,args,self,src,active,field,has,g,choose,target,moved,destroy,pay,once,onEntry,onFlip,onMove,onEnd,onStandby,onDamage,onBattleWin,revive,search,specialChoice,series,guard,defer,card,def,names,isGY,fromField,destroyed,effect,cast,watch,sent,aura,ownAura,protect,lock,locked,stat,xyz,quickNegate,specialSelf,summonCost,negateMonster,equip,endBanish,revivalSpell,rule}=X,{CARDS}=D;
 const S=cast,T=cast;
 const guardMat=(name,fn)=>protect(name,fn);
 const trib=(e,c,uids)=>X.tribute(e,c,uids);
 const frontM=(e,c)=>foeM(e,c).filter(m=>m.faceUp);
 const mineM=(e,c)=>ownM(e,c).filter(m=>m.faceUp);
 const gyAll=(e)=>[...grave(e,0),...grave(e,1)];
 const LIGHT='光',DARK='暗';
 // --- Level 8 self-summoners and no-tribute bodies -------------------------
 C('Parsec, the Interstellar Dragon').tributeCount=0;
 extend('tributeCount',function(prior,m){if(is(m,'Parsec, the Interstellar Dragon')&&this.monsters(this.state.active).some(q=>q.faceUp&&this.level(q)===8))return 0;return prior.call(this,m);});
 C('Bachibachibachi').xyzGrant=true;
 extend('performXyz',function(prior,p,uid,uids,o={}){const r=prior.call(this,p,uid,uids,o);if(r&&uids.some(u=>is(card(this,u),'Bachibachibachi'))){const m=card(this,uid);if(m)m.eraPiercing=true;}return r;});
 extend('unaffected',function(prior,m,source){if(m&&CARDS[m.id]?.holeImmune&&source?.effectType==='trap'&&CARDS[source.id]?.hole)return true;return prior.call(this,m,source);});
 extend('canActivate',function(prior,e,c){if(CARDS[c.sourceId]?.holeImmune&&c.cardActivation&&CARDS[c.sourceId]?.hole)return false;return prior.call(this,e,c);});
 extend('earlyCanUse',function(prior,c,a){if(card(this,c.uid)?.holeImmune&&a.cardActivation&&CARDS[c.sourceId]?.type==='trap'&&CARDS[c.sourceId]?.hole&&this.find(c.uid)?.zone==='hand')return true;return prior.call(this,c,a);});
 specialSelf('Flying "C"',()=>true,{only:false});
 E.on('summon',(e,v)=>{const f=hand(e,v.owner).find(m=>m.id===I('Flying "C"'));if(!f)return;e.addTrigger(f.uid,I('Flying "C"')+'::era-fly',v,{owner:v.owner});});
 R('Flying "C"','era-fly',{zones:['hand'],label:C('Flying "C"').name,summons:true,resolve:(e,c)=>{const foe=1-c.owner;const m=revive(e,{...c,owner:foe},c.uid,{position:'defense'});if(m)e.takeControl(m.uid,foe,{source:c.source});}});
 extend('xyzValid',function(prior,p,extra,list,rankUp=false){if(list.some(m=>is(m,'Flying "C"')))return false;return prior.call(this,p,extra,list,rankUp);});
 C('Tardy Orc').tardyAttack=true;
 extend('canAttack',function(prior,m,p,t){const f=this.find(m.uid);if(is(m,'Tardy Orc')&&f&&f.card.normalSummoned&&f.card.summonTurn===this.state.turn)return false;return prior.call(this,m,p,t);});
 // Genomix Fighter: no-tribute body with a Type declaration.
 C('Genomix Fighter').tributeCount=0;
 extend('tributeCount',function(prior,m){if(is(m,'Genomix Fighter')||is(m,'Hundred-Footed Horror')||is(m,'Night Express Knight')||is(m,'Majiosheldon')||is(m,'Depth Shark'))return 0;return prior.call(this,m);});
 E.on('summon',(e,v)=>{const n=CARDS[v.id]?.officialName;if(!['Genomix Fighter','Hundred-Footed Horror','Night Express Knight'].includes(n)||v.kind!=='normal')return;const m=card(e,v.uid);if(!m)return;if(n==='Genomix Fighter'){m.atkOverride=Math.floor((CARDS[m.id].atk||0)/2);m.levelOverride={value:3,until:999999};}else if(n==='Hundred-Footed Horror')m.atkOverride=1300;else m.atkOverride=0;});
 C('Soul Drain Dragon').noNormal=true;
 C('Chronomaly Mud Golem').mudGolem=true;
 passive('Chronomaly Mud Golem',{piercing:(e,s,m)=>monster(m)&&series(m,'Chronomaly')&&e.find(s.card.uid)?.owner===e.find(m.uid)?.owner});
 sent('Box of Friends',(e,c)=>{const list=deck(e,c.owner,m=>monster(m)&&e.isNormalMonster(m)&&(e.originalAttack(m)===0||e.originalDefense(m)===0));const seen=new Set(),out=[];for(const m of list){if(seen.has(m.id))continue;seen.add(m.id);out.push(m);if(out.length===2)break;}if(out.length)specialChoice(e,c,out,{position:'defense',shuffle:true});},isGY,{once:H.once('box-friends')});
 R('Heroic Challenger - Ambush Soldier','era-ambush',{zones:['monsters'],label:C('Heroic Challenger - Ambush Soldier').name,summons:true,once:H.once('ambush'),inputs:(e,c)=>[g(e,c,'cost','选择解放自身',ownM(e,c).filter(m=>m.uid===c.uid),1,1,'cost')],cost:(e,c)=>trib(e,c,[c.uid]),resolve:(e,c)=>{const list=[...hand(e,c.owner,m=>series(m,'Heroic Challenger')&&m.id!==c.sourceId),...grave(e,c.owner,m=>series(m,'Heroic Challenger')&&m.id!==c.sourceId)].slice(0,2);if(list.length)specialChoice(e,c,list);if(e.find(c.uid)?.zone==='grave'){moved(e,c,[c.uid],'banished','effect-banish');for(const m of ownM(e,c).filter(m=>series(m,'Heroic Challenger')))m.levelOverride={value:1,until:e.state.turn};}}});
 onStandby('Heroic Challenger - Ambush Soldier',{zones:['monsters'],resolve:(e,c)=>{}});
 // Gaia pair
 effect('Gaia, the Polar Knight',null,(e,c)=>search(e,c,deck(e,c.owner,m=>monster(m)&&e.level(m)===4&&e.hasAttribute(m,LIGHT)&&e.race(m)==='战士族')),{mode:'era-gaia-polar',role:'search',once:H.once('gaia-polar'),inputs:(e,c)=>[g(e,c,'cost','选择解放的暗属性怪兽',ownM(e,c).filter(m=>m.uid!==c.uid&&e.hasAttribute(m,DARK)),1,1,'cost'),g(e,c,'cost2','选择送去墓地的手牌',hand(e,c.owner),1,1,'cost')],cost:(e,c)=>{trib(e,c,args(c,'cost'));moved(e,c,args(c,'cost2'),'grave','effect-send');}});
 effect('Gaia, the Polar Knight',(e,c)=>allM(e).filter(m=>m.faceUp),(e,c)=>{const m=card(e,first(c,'target'));if(m)e.modify(m.uid,'atk','add',500,e.state.turn+1,c.source);},{mode:'era-gaia-polar-boost',once:H.once('gaia-polar-boost'),role:'own-boost',inputs:(e,c)=>[g(e,c,'cost','选择除外的光属性怪兽',grave(e,c.owner,m=>e.hasAttribute(m,LIGHT)),1,1,'cost'),g(e,c,'target','选择提升攻击力的怪兽',allM(e).filter(m=>m.faceUp),1,1,'own-boost')],cost:(e,c)=>moved(e,c,args(c,'cost'),'banished','cost-banish')});
 effect('Gaia, the Mid-Knight Sun',null,(e,c)=>search(e,c,deck(e,c.owner,m=>monster(m)&&e.level(m)===4&&e.hasAttribute(m,DARK)&&e.race(m)==='战士族')),{mode:'era-gaia-mid',role:'search',once:H.once('gaia-mid'),inputs:(e,c)=>[g(e,c,'cost','选择解放的光属性怪兽',ownM(e,c).filter(m=>m.uid!==c.uid&&e.hasAttribute(m,LIGHT)),1,1,'cost'),g(e,c,'cost2','选择送去墓地的手牌',hand(e,c.owner),1,1,'cost')],cost:(e,c)=>{trib(e,c,args(c,'cost'));moved(e,c,args(c,'cost2'),'grave','effect-send');}});
 effect('Gaia, the Mid-Knight Sun',frontM,(e,c)=>{const m=card(e,first(c,'target'));if(m)e.modify(m.uid,'atk','add',-500,e.state.turn+1,c.source);},{mode:'era-gaia-mid-boost',once:H.once('gaia-mid-boost'),role:'own-boost',inputs:(e,c)=>[g(e,c,'cost','选择除外的暗属性怪兽',grave(e,c.owner,m=>e.hasAttribute(m,DARK)),1,1,'cost'),g(e,c,'target','选择降低攻击力的怪兽',allM(e).filter(m=>m.faceUp),1,1,'target')],cost:(e,c)=>moved(e,c,args(c,'cost'),'banished','cost-banish')});
 // Black Luster Soldier - Envoy of the Evening Twilight
 C('Black Luster Soldier - Envoy of the Evening Twilight').noNormal=true;
 specialSelf('Black Luster Soldier - Envoy of the Evening Twilight',(e,c)=>{
  const light=grave(e,c.owner,m=>monster(m)&&e.hasAttribute(m,LIGHT)),dark=grave(e,c.owner,m=>monster(m)&&e.hasAttribute(m,DARK));
  return light.length>0&&light.length===dark.length;},{only:true,banish:true});
 E.get(I('Black Luster Soldier - Envoy of the Evening Twilight')+'::gx-special').cost=(e,c)=>{
  const light=grave(e,c.owner,m=>monster(m)&&e.hasAttribute(m,LIGHT)).map(m=>m.uid);
  const dark=grave(e,c.owner,m=>monster(m)&&e.hasAttribute(m,DARK)).map(m=>m.uid);
  c.eraBanishedAttribute=light.length>=dark.length?LIGHT:DARK;
  moved(e,c,[...light,...dark],'banished','cost-banish');};
 E.on('summon',(e,v)=>{if(CARDS[v.id]?.officialName!=='Black Luster Soldier - Envoy of the Evening Twilight')return;const m=card(e,v.uid);if(m)m.attributeOverride={value:LIGHT,until:999999};e.addTrigger(v.uid,I('Black Luster Soldier - Envoy of the Evening Twilight')+'::era-envoy',v,{owner:v.owner});});
 R('Black Luster Soldier - Envoy of the Evening Twilight','era-envoy',{zones:['monsters'],label:C('Black Luster Soldier - Envoy of the Evening Twilight').name,mandatory:true,role:'banish',inputs:(e,c)=>[g(e,c,'target','选择除外的场上怪兽',allM(e).filter(m=>m.faceUp),0,1,'target')],resolve:(e,c)=>{const m=card(e,first(c,'target'));if(m)moved(e,c,[m.uid],'banished','effect-banish');else{const h=e.state.players[1-c.owner].hand;if(h.length)moved(e,c,[h[0].uid],'banished','effect-banish');}lock(e,c.owner,'skipBattle');}});
 // Xyz-hate bodies
 specialSelf('Doggy Diver',(e,c)=>foeM(e,c).length>0&&ownM(e,c).length>0&&ownM(e,c).every(m=>m.faceUp&&e.level(m)===4));
 extend('xyzValid',function(prior,p,extra,list,rankUp=false){if(list.some(m=>is(m,'Doggy Diver'))&&this.race(extra)!=='战士族')return false;return prior.call(this,p,extra,list,rankUp);});
 C('Toy Knight').noDeckSpecial=true;
 specialSelf('Toy Knight',(e,c)=>foeM(e,c).length>ownM(e,c).length);
 onEntry('Toy Knight','era-toy',{summons:true,resolve:(e,c)=>{const list=hand(e,c.owner,m=>is(m,'Toy Knight'));if(list.length)specialChoice(e,c,list);}},['normal','special']);
 effect('Explossum',(e,c)=>allM(e).filter(m=>m.faceUp&&CARDS[m.id].type==='xyz'),(e,c)=>{const t=card(e,first(c,'target'));if(t)e.equipMonster(c.uid,t.uid,c.owner,c.source);},{mode:'era-explossum',role:'own-boost',inputs:(e,c)=>[g(e,c,'target','选择装备的对方超量怪兽',foeM(e,c).filter(m=>m.faceUp&&CARDS[m.id].type==='xyz'),1,1,'target')]});
 onStandby('Explossum',{zones:['spells'],condition:(e,c)=>{const s=card(e,c.uid);return !!s?.equipTarget;},resolve:(e,c)=>{const s=card(e,c.uid),h=s?.equipTarget;if(!h)return;const f=e.find(h);if(!f)return;if(!(f.card.overlays||[]).length)destroy(e,c,[h]);else e.detach(h,[f.card.overlays[0].uid]);}});
 effect('Thunder Sea Horse',null,(e,c)=>{const list=deck(e,c.owner,m=>monster(m)&&e.level(m)===4&&e.hasAttribute(m,LIGHT)&&e.race(m)==='雷族'&&e.originalAttack(m)<=1600);const seen=new Map();for(const m of list)if(!seen.has(m.id))seen.set(m.id,m);const out=[...seen.values()].slice(0,2);if(out.length===2)search(e,c,out);if(out.length===2)search(e,c,[out[0]]);lock(e,c.owner,'noSpecial');},{zones:['hand'],mode:'era-sea-horse',role:'search',once:H.once('sea-horse'),cost:(e,c)=>H.discard(e,c,[c.uid])});
 Q('Swordsman of Revealing Light','era-revealing',{zones:['hand'],main:false,condition:(e,c)=>{const a=c.event.window?.attack;return !!a&&!a.target&&a.owner!==c.owner;},resolve:(e,c)=>{revive(e,c,c.uid,{position:'defense'});const a=e.state.frame?.attack,att=a&&card(e,a.uid);if(att&&e.originalDefense({id:c.sourceId})>e.attackValue(att))destroy(e,c,[att.uid]);}});
 E.on('summon',(e,v)=>{if(v.kind!=='xyz'||!(v.materials||[]).some(m=>is(m,'Swordsman of Revealing Light')))return;e.addTrigger(v.uid,I('Swordsman of Revealing Light')+'::era-revealing-grant',v,{owner:v.owner});});
 R('Swordsman of Revealing Light','era-revealing-grant',{zones:['extraMonster','monsters'],label:C('Swordsman of Revealing Light').name,mandatory:true,resolve:(e,c)=>{const m=card(e,c.uid);if(m)m.eraFirstBattleSave=true;}});
 extend('destroy',function(prior,uid,source=null,battle=false,extra={}){const m=card(this,uid);if(battle&&m?.eraFirstBattleSave&&m.eraFirstSaveUsed!==this.state.turn){m.eraFirstSaveUsed=this.state.turn;return false;}return prior.call(this,uid,source,battle,extra);});
 C('Depth Shark').tributeCount=0;
 extend('tributeCount',function(prior,m){if(is(m,'Depth Shark')&&ownM(this,{owner:this.state.active}).length===0)return 0;return prior.call(this,m);});
 onStandby('Depth Shark',{zones:['monsters'],resolve:(e,c)=>{const m=card(e,c.uid);if(m)e.modify(c.uid,'atk','mul',2,e.state.turn,c.source);}},{opponent:true});
 effect('Saber Shark',(e,c)=>allM(e).filter(m=>m.faceUp&&e.race(m)==='鱼族'),(e,c)=>{const m=card(e,first(c,'target'));if(m)m.levelOverride={value:e.level(m)+(c.eraUp?1:-1),until:e.state.turn};lock(e,c.owner,'waterOnly');},{mode:'era-saber',oncePerTurn:false,upTo:2,role:'own-boost',inputs:(e,c)=>[g(e,c,'target','选择调整等级的鱼族',allM(e).filter(m=>m.faceUp&&e.race(m)==='鱼族'),1,1,'own-boost'),H.customGroup('dir','选择等级变化',[{uid:'up',label:'上升1级',value:1},{uid:'down',label:'下降1级',value:2}],1,1)],cost:(e,c)=>{c.eraUp=first(c,'dir')==='up';}});
 extend('synchroValid',function(prior,p,extra,list,o={}){if(list.some(m=>is(m,'Saber Shark')))return false;return prior.call(this,p,extra,list,o);});
 onEntry('Double Fin Shark','era-fin',{summons:true,once:H.once('double-fin'),inputs:(e,c)=>[g(e,c,'target','选择复活的3／4星水属性鱼族',grave(e,c.owner,m=>monster(m)&&e.race(m)==='鱼族'&&e.hasAttribute(m,'水')&&[3,4].includes(e.level(m))&&e.canSpecial(c.owner,m,{via:'revive'})),1,1,'special')],resolve:(e,c)=>{const m=revive(e,c,first(c),{position:'defense'});if(m)m.effectNegated=true;lock(e,c.owner,'waterOnly');}},['normal']);
 specialSelf('Silent Angler',(e,c)=>ownM(e,c).some(m=>m.faceUp&&e.hasAttribute(m,'水')));
 E.on('summon',(e,v)=>{if(CARDS[v.id]?.officialName!=='Silent Angler')return;lock(e,v.owner,'noHandSpecial');});
 R('Guard Penguin','era-guard',{zones:['hand'],label:C('Guard Penguin').name,summons:true,resolve:(e,c)=>{revive(e,c,c.uid);e.heal(c.owner,c.event.amount||0);}});
 E.on('damage',(e,v)=>{if(v.kind!=='效果'&&v.battle)return;if(v.kind!=='效果')return;for(const f of e.refs(v.owner,['hand']))if(f.card.id===I('Guard Penguin'))e.addTrigger(f.card.uid,I('Guard Penguin')+'::era-guard',v,{owner:v.owner});});
 specialSelf('Deep-Space Cruiser IX',(e,c)=>hand(e,c.owner,m=>monster(m)&&e.race(m)==='机械族').length>0);
 E.get(I('Deep-Space Cruiser IX')+'::gx-special').cost=(e,c)=>H.discard(e,c,[hand(e,c.owner,m=>monster(m)&&e.race(m)==='机械族')[0].uid]);
 effect('Photon Chargeman',null,(e,c)=>{const m=self(e,c);if(m)e.modify(c.uid,'atk','set',e.originalAttack(m),e.state.turn+2,c.source);lock(e,c.owner,'noAttacks');},{mode:'era-chargeman',once:H.once('chargeman')});
 Q('Rainbow Kuriboh','era-rainbow-equip',{zones:['hand'],main:false,condition:(e,c)=>{const a=c.event.window?.attack;return !!a&&a.owner!==c.owner;},resolve:(e,c)=>{const a=e.state.frame?.attack;if(!a)return;e.equipMonster(c.uid,a.uid,c.owner,c.source);const f=e.find(a.uid);if(f)f.card.eraNoAttackUntil=999999;}});
 R('Rainbow Kuriboh','era-rainbow-revive',{zones:['grave'],label:C('Rainbow Kuriboh').name,summons:true,once:H.once('rainbow'),condition:(e,c)=>{const a=c.event?.attack;return !!a&&!a.target&&a.owner!==c.owner;},resolve:(e,c)=>{const m=revive(e,c,c.uid);if(m)m.banishOnLeave=true;}});
 E.on('attack',(e,v)=>{if(v.target)return;for(const f of e.refs(1-v.owner,['grave']))if(f.card.id===I('Rainbow Kuriboh'))e.addTrigger(f.card.uid,I('Rainbow Kuriboh')+'::era-rainbow-revive',v,{owner:f.owner});});
 sent('Tackle Crusader',(e,c)=>{const foe=1-c.owner;const canA=foeM(e,{owner:foe}).some(m=>m.faceUp&&m.position==='attack');const canB=e.refs(foe,['spells','fieldSpell']).some(f=>f.card.faceUp);if(!canA&&!canB)return;e.queueChoice(c.owner,'选择顽抗的岩石人效果',[{uid:'a',label:'对方怪兽变为里侧守备',value:1,disabled:!canA},{uid:'b',label:'对方魔法／陷阱回到手牌',value:2,disabled:!canB}],1,1,'era-tackle',{source:c.source});},isGY);
 E.op('era-tackle',(e,t)=>{const pick=t.picks[0],foe=1-t.owner;if(pick==='a'){const list=foeM(e,{owner:foe}).filter(m=>m.faceUp&&m.position==='attack');if(list.length){e.setPosition(list[0].uid,'defense',t.context.source,true);}}else{const list=e.refs(foe,['spells','fieldSpell']).filter(f=>f.card.faceUp);if(list.length)moved(e,{owner:t.owner,source:t.context.source},[list[0].card.uid],'hand','effect-return');}});
 // Gravekeeper's Oracle
 extend('tributeCount',function(prior,m){if(is(m,'Gravekeeper\'s Oracle'))return 1;return prior.call(this,m);});
 E.on('summon',(e,v)=>{if(CARDS[v.id]?.officialName!=='Gravekeeper\'s Oracle'||v.kind!=='normal')return;e.addTrigger(v.uid,I('Gravekeeper\'s Oracle')+'::era-oracle',v,{owner:v.owner});});
 R('Gravekeeper\'s Oracle','era-oracle',{zones:['monsters'],label:C('Gravekeeper\'s Oracle').name,mandatory:true,resolve:(e,c)=>{const sums=(c.event.materials||[]).filter(q=>/Gravekeeper/.test(def(q)?.officialName||''));const n=Math.max(1,sums.length);const total=(c.event.materials||[]).reduce((s,q)=>s+(q.level||0),0);if(self(e,c))e.modify(c.uid,'atk','add',total*100,null,c.source);if(n>=2)destroy(e,c,e.refs(1-c.owner,['monsters']).filter(f=>!f.card.faceUp).map(f=>f.card.uid));if(n>=3)for(const m of frontM(e,c)){e.modify(m.uid,'atk','add',-2000,null,c.source);e.modify(m.uid,'def','add',-2000,null,c.source);}}});
 effect('Sirenorca',null,(e,c)=>{const lv=c.eraLv||4;for(const m of mineM(e,c))m.levelOverride={value:lv,until:e.state.turn};lock(e,c.owner,'waterEffectsOnly');},{mode:'era-sirenorca',summons:true,condition:(e,c)=>ownM(e,c).some(m=>e.race(m)==='鱼族')&&ownM(e,c).some(m=>e.race(m)==='鸟兽族'),inputs:(e,c)=>[H.customGroup('lv','宣言等级',[3,4,5].map(n=>({uid:String(n),label:String(n),value:n})),1,1)],cost:(e,c)=>{c.eraLv=Number(first(c,'lv'));}});
 E.on('summon',(e,v)=>{if(CARDS[v.id]?.officialName!=='Sirenorca'||v.kind==='normal')return;e.addTrigger(v.uid,I('Sirenorca')+'::era-sirenorca',v,{owner:v.owner});});
 onEntry('Black Brachios','era-brachios',{resolve:(e,c)=>{const list=allM(e).filter(m=>m.faceUp);if(list.length)e.setPosition(list[0].uid,'defense',c.source);}},['normal']);
 effect('Mystic Macrocarpa Seed',(e,c)=>allM(e).filter(m=>m.faceUp&&monster(m)&&e.hasAttribute(m,'地')),(e,c)=>{const m=card(e,first(c,'target'));if(m)m.levelOverride={value:Math.max(1,e.level(m)-1),until:e.state.turn};},{mode:'era-macrocarpa',oncePerTurn:false,upTo:2,role:'own-boost',inputs:(e,c)=>[g(e,c,'target','选择降低等级的植物族',allM(e).filter(m=>m.faceUp&&monster(m)&&e.hasAttribute(m,'地')),1,1,'own-boost')]});
 extend('synchroValid',function(prior,p,extra,list,o={}){if(list.some(m=>is(m,'Mystic Macrocarpa Seed'))&&!this.hasAttribute(extra,'地'))return false;return prior.call(this,p,extra,list,o);});
 C('Majiosheldon').noNormal=false;
 extend('canSpecial',function(prior,p,m,o={}){if(is(m,'Majiosheldon')&&o.via!=='majiosheldon')return false;return prior.call(this,p,m,o);});
 effect('Majiosheldon',null,(e,c)=>revive(e,c,c.uid,{via:'majiosheldon'}),{zones:['grave'],mode:'era-majiosheldon',summons:true,once:H.once('majiosheldon'),condition:(e,c)=>!!e.find(c.uid)?.card.eraTributeSummonTurn,inputs:()=>[]});
 E.on('move',(e,v)=>{if(v.to!=='grave'||v.kind!=='cost-tribute'||CARDS[v.id]?.officialName!=='Majiosheldon')return;e.addTrigger(v.uid,I('Majiosheldon')+'::era-majiosheldon',v,{owner:v.owner});const m=card(e,v.uid);if(m)m.eraTributeSummonTurn=true;});
 specialSelf('Gillagillancer',(e,c)=>foeM(e,c).length>0&&ownM(e,c).length===0);
 onEnd('Gillagillancer',{zones:['monsters'],mandatory:true,resolve:(e,c)=>X.burn(e,c,500)},{both:true});
 extend('unaffected',function(prior,m,source){if(is(m,'Xyz Avenger')&&CARDS[source?.id]?.type==='xyz')return true;return prior.call(this,m,source);});
 sent('Xyz Avenger',(e,c)=>{const a=c.event.attack?.uid,m=a&&card(e,a);if(!m)return;const rank=def(m).rank||0;if(rank>=5){const ex=e.state.players[1-c.owner].extra;if(ex.length)moved(e,c,[ex[0].uid],'grave','effect-send');}else if(rank===4){const ex=e.state.players[1-c.owner].extra;if(ex.length)moved(e,c,[ex[0].uid],'grave','effect-send');}else{const ex=e.state.players[1-c.owner].extra;if(ex.length)moved(e,c,[ex[0].uid],'grave','effect-send');}},(e,v)=>true);
 sent('Chirubimé, Princess of Autumn Leaves',(e,c)=>{const list=deck(e,c.owner,m=>monster(m)&&e.race(m)==='植物族'&&m.id!==c.sourceId);if(list.length)specialChoice(e,c,list);},(e,v)=>v.to==='grave'&&v.source?.owner!==v.owner);
 extend('attackTargets',function(prior,m,p=this.state.active){let list=prior.call(this,m,p);const chiru=allM(this).find(q=>q.faceUp&&is(q,'Chirubimé, Princess of Autumn Leaves'));if(!chiru||this.find(chiru.uid)?.owner===p)return list;return list.filter(uid=>{const f=this.find(uid);return !(f&&monster(f.card)&&this.race(f.card)==='植物族')||uid===chiru.uid;});});
 watch('Kalantosa, Mystical Beast of the Forest','era-kalantosa','summon',(e,v)=>{const m=card(e,v.uid);return v.kind!=='normal'&&v.id===I('Kalantosa, Mystical Beast of the Forest');},{role:'destroy',inputs:(e,c)=>[g(e,c,'target','选择破坏的场上卡片',allF(e).map(f=>f.card),1,1,'destroy')],resolve:(e,c)=>destroy(e,c,args(c))},{zones:['monsters']});
 onEntry('Geargiauger','era-auger',{resolve:(e,c)=>search(e,c,deck(e,c.owner,m=>monster(m)&&e.level(m)===4&&e.hasAttribute(m,'地')&&e.race(m)==='机械族'&&m.id!==c.sourceId))},['normal']);
 E.on('summon',(e,v)=>{if(CARDS[v.id]?.officialName!=='Geargiauger')return;lock(e,v.owner,'machineOnly');lock(e,v.owner,'noAttacks');});
 onEntry('Minerva, Lightsworn Maiden','era-minerva',{resolve:(e,c)=>{const n=new Set(grave(e,c.owner,m=>series(m,'Lightsworn')).map(m=>m.id)).size;const list=deck(e,c.owner,m=>monster(m)&&e.race(m)==='龙族'&&e.hasAttribute(m,LIGHT)&&e.level(m)<=n);if(list.length)search(e,c,list);}},['normal']);
 for(const n of ['Minerva, Lightsworn Maiden','Raiden, Hand of the Lightsworn','Michael, the Arch-Lightsworn'])
  onEnd(n,{zones:['monsters'].concat(n==='Michael, the Arch-Lightsworn'?[]:[]),mandatory:true,resolve:(e,c)=>{const k=n==='Minerva, Lightsworn Maiden'?2:2,p=e.state.players[c.owner],lim=Math.min(k,p.deck.length);for(let i=0;i<lim;i++){const m=p.deck[p.deck.length-1];if(!m)break;moved(e,c,[m.uid],'grave','effect-send');}}});
 sent('Minerva, Lightsworn Maiden',(e,c)=>{const p=e.state.players[c.owner];if(p.deck.length)moved(e,c,[p.deck[p.deck.length-1].uid],'grave','effect-send');},(e,v)=>v.from==='deck'||v.from==='hand');
 effect('Raiden, Hand of the Lightsworn',null,(e,c)=>{const p=e.state.players[c.owner],lim=Math.min(2,p.deck.length);let hit=false;for(let i=0;i<lim;i++){const m=p.deck[p.deck.length-1];if(!m)break;if(series(m,'Lightsworn'))hit=true;moved(e,c,[m.uid],'grave','effect-send');}if(hit&&self(e,c))e.modify(c.uid,'atk','add',200,e.state.turn+1,c.source);},{mode:'era-raiden',once:H.once('raiden')});
 Q('Snow Plow Hustle Rustle','era-snow',{zones:['hand'],main:false,condition:(e,c)=>{const a=c.event.window?.attack;return !!a&&!a.target&&a.owner!==c.owner&&e.spells(c.owner).filter(Boolean).length>0;},resolve:(e,c)=>{revive(e,c,c.uid);const list=e.spells(c.owner).filter(Boolean);for(const m of list){destroy(e,c,[m.uid]);X.burn(e,c,200);}lock(e,c.owner,'machineOnly');}});
 effect('Ruffian Railcar',null,(e,c)=>{X.burn(e,c,500);lock(e,c.owner,'skipBattle');},{mode:'era-railcar',once:H.once('railcar')});
 onEnd('Ruffian Railcar',{zones:['grave'],once:H.once('railcar-gy'),condition:(e,c)=>card(e,c.uid)?.eraSentTurn===e.state.turn,resolve:(e,c)=>search(e,c,deck(e,c.owner,m=>monster(m)&&e.level(m)===10&&e.hasAttribute(m,'地')&&e.race(m)==='机械族'))});
 E.on('move',(e,v)=>{if(v.to==='grave'&&CARDS[v.id]?.officialName==='Ruffian Railcar'){const m=card(e,v.uid);if(m)m.eraSentTurn=e.state.turn;}});
 C('Night Express Knight').noDeckSpecial=true;
 effect('Fishborg Doctor',null,(e,c)=>revive(e,c,c.uid),{zones:['grave'],mode:'era-fishborg',summons:true,once:H.once('fishborg'),condition:(e,c)=>ownM(e,c).length>0&&ownM(e,c).every(m=>series(m,'Fishborg')),inputs:()=>[]});
 specialSelf('Santa Claws',(e,c)=>foeM(e,c).length>0);
 E.get(I('Santa Claws')+'::gx-special').cost=(e,c)=>{const l=foeM(e,c);if(!l.length)return;trib(e,{...c,owner:1-c.owner},[l[0].uid]);};
 E.on('summon',(e,v)=>{if(CARDS[v.id]?.officialName!=='Santa Claws')return;const m=card(e,v.uid);if(m)m.eraSantaDraw=(e.find(v.uid)?.owner===1)?e.state.turn:null;});
 onEnd('Santa Claws',{zones:['monsters'],once:H.once('santa'),condition:(e,c)=>card(e,c.uid)?.eraSantaDraw===e.state.turn,resolve:(e,c)=>e.draw(c.owner,1)});
 C('Felis, Lightsworn Archer').noNormal=true;
 effect('Felis, Lightsworn Archer',null,(e,c)=>{const list=foeM(e,c);if(list.length)destroy(e,c,[list[0].uid]);const p=e.state.players[c.owner];for(let i=0;i<Math.min(3,p.deck.length);i++){const m=p.deck[p.deck.length-1];if(!m)break;moved(e,c,[m.uid],'grave','effect-send');}},{mode:'era-felis',role:'destroy',inputs:(e,c)=>[g(e,c,'cost','选择解放自身',ownM(e,c).filter(m=>m.uid===c.uid),1,1,'cost'),g(e,c,'target','选择破坏的对方怪兽',foeM(e,c),1,1,'destroy')],cost:(e,c)=>trib(e,c,[c.uid])});
 E.on('move',(e,v)=>{if(v.from!=='deck'||v.to!=='grave')return;if(CARDS[v.id]?.officialName!=='Felis, Lightsworn Archer')return;e.addTrigger(v.uid,I('Felis, Lightsworn Archer')+'::era-felis',v,{owner:v.owner,mandatory:true});});
 R('Felis, Lightsworn Archer','era-felis',{zones:['grave'],label:C('Felis, Lightsworn Archer').name,summons:true,mandatory:true,resolve:(e,c)=>revive(e,c,c.uid)});
 // --- Last Synchro Monsters ------------------------------------------------
 E.on('summon',(e,v)=>{if(CARDS[v.id]?.officialName!=='Star Eater')return;const m=card(e,v.uid);if(m)m.eraSynchroUnnegatable=true;});
 extend('unaffected',function(prior,m,source){if(m&&is(m,'Star Eater')&&this.state.frame?.attack){const b=this.state.frame.attack;if(b.uid===m.uid)return true;}return prior.call(this,m,source);});
 extend('canTarget',function(prior,m,source){if(is(m,'Leo, the Keeper of the Sacred Tree')&&source&&this.state.phase!=='main2')return false;return prior.call(this,m,source);});
 extend('battleLocked',function(prior,p,attack){const m=attack&&this.find(attack.uid),t=attack&&this.find(attack.target);if((m&&is(m.card,'Armades, Keeper of Boundaries'))||(t&&is(t.card,'Armades, Keeper of Boundaries')))return true;return prior.call(this,p,attack);});
 if(typeof module!=='undefined')module.exports=X;
})(globalThis);
