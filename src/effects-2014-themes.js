/* 2014 Duelist Alliance / The New Challengers themes.
 * Authored rules, shared-name limits and serializable choices; no text parser
 * is used to pretend that an unimplemented effect has executed. */
(function(root){
 'use strict';
 const X=root.DuelChronicle,{D,E,H,C,I,is,A,Q,R,passive,mark,extend,allM,allS,allF,monster,ownM,foeM,hand,deck,grave,first,args,self,src,active,field,g,choose,target,moved,destroy,onEntry,onFlip,onMove,onEnd,revive,search,specialChoice,series,guard,defer,card,def,effect,cast,watch,lock,locked}=X;
 const sh=m=>series(m,'Shaddoll'),tell=m=>series(m,'tellarknight'),yang=m=>series(m,'Yang Zing'),nek=m=>series(m,'Nekroz');
 const live=(e,n,p=null)=>allF(e).map(m=>e.find(m.uid)).filter(f=>(p===null||f.owner===p)&&is(f.card,n)&&active(e,f.card));
 const nonMonster=m=>['spell','trap'].includes(def(m)?.type),stSh=m=>sh(m)&&nonMonster(m);
 const present=n=>!!C(n),byEffect=(e,v)=>v.to==='grave'&&!!v.byEffect;
 const destroyed=(e,v)=>v.to==='grave'&&field(v.from)&&['battle','destroy'].includes(v.kind);
 const fromExtra=m=>m?.summonFrom==='extra';
 const limit=n=>H.once('2014-'+n,'name');
 const send=(e,c,uids)=>moved(e,c,uids,'grave','effect-send');
 const shuffleBack=(e,c,uids)=>{moved(e,c,uids,'deck','effect-return');for(const p of [0,1])e.shuffle(e.state.players[p].deck);};
 function pickSend(e,c,list){choose(e,c,'选择送去墓地的卡片',list,1,1,'early-move',{to:'grave',kind:'effect-send',shuffle:true,role:'search'});}
 function onSummoned(n,s){if(present(n))onEntry(n,'theme-entry',{once:limit(n),...s},['normal','special','flip']);}
 // Track the origin independently of the monster's current type. Reviving an
 // Extra Deck monster from the GY does not make it "summoned from the Extra Deck".
 E.on('summon',(e,v)=>{const m=card(e,v.uid);if(m)m.summonFrom=v.from;});
 for(const [key,label,pred] of [['shaddoll','影依',sh],['tellarknight','星因士',tell],['yangzing','龙星',yang],['nekroz','影灵衣',nek]]){D.families[key]=label;for(const c of D.CARD_LIST)if(pred(c))c.families=[...new Set([...(c.families||[]),key])];}

 // SHADDOLL: the FLIP and sent-by-effect effects share ONE use, including
 // different copies. A discard/tribute cost and a Synchro material do not trigger.
 const flips={
  'Shaddoll Beast':{resolve:(e,c)=>X.drawDiscard(e,c,2,1)},
  'Shaddoll Hedgehog':{resolve:(e,c)=>search(e,c,deck(e,c.owner,stSh))},
  'Shaddoll Squamata':{inputs:target('选择破坏的怪兽',allM),resolve:(e,c)=>destroy(e,c,args(c))},
  'Shaddoll Dragon':{inputs:target('选择返回手牌的对方卡片',(e,c)=>e.field(1-c.owner),'bounce'),resolve:(e,c)=>moved(e,c,args(c),'hand','effect-return')},
  'Shaddoll Falco':{summons:true,inputs:target('选择里侧守备特殊召唤的影依',(e,c)=>grave(e,c.owner,m=>sh(m)&&monster(m)&&m.id!==c.sourceId),'special'),resolve:(e,c)=>revive(e,c,first(c),{faceDown:true,position:'defense'})},
  'Shaddoll Hound':{inputs:target('选择回收的影依卡片',(e,c)=>grave(e,c.owner,sh),'search'),resolve:(e,c)=>moved(e,c,args(c),'hand','effect-return')}
 };
 const sentRules={
  'Shaddoll Beast':{resolve:(e,c)=>e.draw(c.owner,1)},
  'Shaddoll Hedgehog':{resolve:(e,c)=>search(e,c,deck(e,c.owner,m=>sh(m)&&monster(m)&&m.id!==c.sourceId))},
  'Shaddoll Squamata':{resolve:(e,c)=>pickSend(e,c,deck(e,c.owner,m=>sh(m)&&m.id!==c.sourceId))},
  'Shaddoll Dragon':{inputs:target('选择破坏的魔法陷阱',allS),resolve:(e,c)=>destroy(e,c,args(c))},
  'Shaddoll Falco':{summons:true,resolve:(e,c)=>revive(e,c,c.uid,{faceDown:true,position:'defense'})},
  'Shaddoll Hound':{inputs:target('选择改变表示的怪兽',allM),resolve:(e,c)=>{const m=card(e,first(c));if(!m)return;if(!m.faceUp)e.flipFaceUp(m.uid,{position:'attack',suppress:!sh(m),source:c.source});else e.setPosition(m.uid,m.position==='attack'?'defense':'attack',c.source);}}
 };
 for(const n of Object.keys(flips))if(present(n)){onFlip(n,{once:limit(n),...flips[n]});onMove(n,'theme-sent',{once:limit(n),...sentRules[n]},byEffect);}
 for(const [n,attribute] of [['El Shaddoll Construct','光'],['El Shaddoll Winda','暗'],['El Shaddoll Grysta','炎'],['El Shaddoll Shekhinaga','地'],['El Shaddoll Wendigo','风']])if(present(n)){
  const d=C(n);d.fusion=[{family:'shaddoll'},{attribute}];d.fusionOnly=false;d.specialOnly='fusion';
  onMove(n,'theme-recover',{inputs:target('选择回收的影依魔法陷阱',(e,c)=>grave(e,c.owner,stSh),'search'),resolve:(e,c)=>moved(e,c,args(c),'hand','effect-return')},(e,v)=>v.to==='grave');
 }
 if(present('El Shaddoll Construct')){
  onEntry('El Shaddoll Construct','theme-send',{resolve:(e,c)=>pickSend(e,c,deck(e,c.owner,sh))},['special']);
  watch('El Shaddoll Construct','theme-battle','damage-start',(e,v,f)=>[v.attack.uid,v.attack.target].includes(f.card.uid)&&!!card(e,v.attack.uid===f.card.uid?v.attack.target:v.attack.uid)?.summonKind&&!['normal','flip','set'].includes(card(e,v.attack.uid===f.card.uid?v.attack.target:v.attack.uid)?.summonKind),{resolve:(e,c)=>destroy(e,c,[c.event.attack.uid===c.uid?c.event.attack.target:c.event.attack.uid])},{mandatory:true});
 }
 if(present('El Shaddoll Winda')){
  passive('El Shaddoll Winda',{protect:(e,s,m,b,source)=>m.uid===s.card.uid&&!b&&source?.owner!==s.owner});
  extend('canSpecial',function(prior,p,m,o={}){return !(live(this,'El Shaddoll Winda').length&&(this.state.players[p].turnStats?.special||0)>=1)&&prior.call(this,p,m,o);});
 }
 if(present('El Shaddoll Wendigo'))Q('El Shaddoll Wendigo','theme-protect',{once:limit('wendigo'),inputs:target('选择受到战斗保护的怪兽',ownM,'own-boost'),resolve:(e,c)=>{const m=card(e,first(c));if(m)m.eraWendigoUntil=e.state.turn;},aiResponse:()=>650});
 extend('destroy',function(prior,uid,s,b=false,...rest){const m=card(this,uid),att=card(this,s?.uid);if(b&&m?.eraWendigoUntil>=this.state.turn&&att?.summonKind&&!['normal','flip','set'].includes(att.summonKind))return false;return prior.call(this,uid,s,b,...rest);});
 if(present('El Shaddoll Shekhinaga'))Q('El Shaddoll Shekhinaga','theme-negate',{main:false,once:limit('shekhinaga'),condition:(e,c)=>{const l=c.event.window?.chainLast,m=card(e,l?.uid);return l?.source.effectType==='monster'&&m&&m.summonKind&&!['normal','flip','set'].includes(m.summonKind)&&hand(e,c.owner,sh).length>0;},resolve:(e,c)=>{if(e.negateLink(c.responseTo,c.source,true,true))pickSend(e,c,hand(e,c.owner,sh));},aiResponse:()=>1800});
 if(present('El Shaddoll Grysta'))Q('El Shaddoll Grysta','theme-negate',{main:false,summonNegation:true,once:limit('grysta'),condition:(e,c)=>{const w=c.event.window;return w?.kind==='summon-attempt'&&w.owner!==c.owner&&!['normal','flip','set'].includes(w.summonKind)&&hand(e,c.owner,sh).length>0;},resolve:(e,c)=>{if(e.negateSummon(c.source))pickSend(e,c,hand(e,c.owner,sh));},aiResponse:()=>1800});
 // Preserve the normal fusion selection/material UI and revalidate the Deck
 // permission at resolution. Shadow Prison's optional opponent material is paid
 // only if the selected, legal material set actually uses it.
 const shProfile=(e,p,id)=>({theme2014:'shaddoll',spellId:id,zones:['hand','monsters','extraMonster',...(is({id},'Shaddoll Fusion')&&foeM(e,{owner:p}).some(m=>m.faceUp&&fromExtra(m))?['deck']:[])]});
 extend('fusionAllowed',function(prior,m,id){return (!id?.theme2014||id.theme2014!=='shaddoll'||sh(m))&&prior.call(this,m,id);});
 extend('fusionPool',function(prior,p,id){if(id?.theme2014!=='shaddoll')return prior.call(this,p,id);const pool=prior.call(this,p,shProfile(this,p,id.spellId)),prison=live(this,'Curse of the Shadow Prison',p).find(f=>(f.card.eraSpellstones||0)>=3);return prison?[...pool,...foeM(this,{owner:p}).filter(m=>m.faceUp)]:pool;});
 extend('fusionValid',function(prior,p,m,list,id){if(sh(m)&&list.filter(q=>this.find(q.uid)?.owner!==p).length>1)return false;return prior.call(this,p,m,list,id);});
 extend('performFusion',function(prior,p,uid,uids,id,s,...rest){const ms=uids.map(u=>card(this,u));if(id?.theme2014==='shaddoll'&&ms.some(m=>this.find(m?.uid)?.owner!==p)){if(!this.fusionValid(p,card(this,uid),ms,id))return null;const prison=live(this,'Curse of the Shadow Prison',p).find(f=>(f.card.eraSpellstones||0)>=3);if(!prison)return null;prison.card.eraSpellstones-=3;}return prior.call(this,p,uid,uids,id,s,...rest);});
 E.op('theme2014-fusion',(e,t)=>{if(t.picks[0])e.queue({op:'fusion-materials',owner:t.owner,extraUid:t.picks[0],spellId:t.context.profile,source:t.context.source});});
 for(const n of ['Shaddoll Fusion','El Shaddoll Fusion'])if(present(n))cast(n,null,(e,c)=>{const profile=shProfile(e,c.owner,c.sourceId);choose(e,c,'选择影依融合怪兽',e.fusions(c.owner,profile).map(f=>f.card),1,1,'theme2014-fusion',{profile,role:'special'});},{once:limit(n),summons:true,condition:(e,c)=>e.fusions(c.owner,shProfile(e,c.owner,c.sourceId)).length>0});
 if(present('Curse of the Shadow Prison')){
  cast('Curse of the Shadow Prison',null,(e,c)=>{const m=card(e,c.uid);if(m)m.eraSpellstones=0;});
  E.on('move',(e,v)=>{if(!byEffect(e,v)||!sh({id:v.id})||!monster({id:v.id}))return;for(const f of live(e,'Curse of the Shadow Prison'))f.card.eraSpellstones=(f.card.eraSpellstones||0)+1;});
  passive('Curse of the Shadow Prison',{stat:(e,s,m,k)=>k==='atk'&&e.state.active!==s.owner&&e.find(m.uid)?.owner!==s.owner?-(s.card.eraSpellstones||0)*100:0});
 }
 if(present('Shaddoll Core')){
  cast('Shaddoll Core',null,(e,c)=>{const m=card(e,c.uid);if(m){m.asMonster={level:9,atk:1450,def:1950,race:'魔法师族',attribute:'暗'};m.eraShaddollCore=true;revive(e,c,m.uid,{via:'effect'});}},{summons:true,condition:(e,c)=>e.freeMain(c.owner)>0});
  onMove('Shaddoll Core','theme-recover',{inputs:target('选择回收的影依魔法陷阱',(e,c)=>grave(e,c.owner,m=>stSh(m)&&m.id!==c.sourceId),'search'),resolve:(e,c)=>moved(e,c,args(c),'hand','effect-return')},byEffect);
  extend('materialMatches',function(prior,m,s,p){return m.eraShaddollCore&&s.attribute?true:prior.call(this,m,s,p);});
 }
 if(present('Purushaddoll Aeon'))cast('Purushaddoll Aeon',null,(e,c)=>{const m=card(e,first(c));const h=card(e,first(c,'send'));if(!m||!h||e.find(h.uid)?.zone!=='hand')return;send(e,c,[h.uid]);if(e.find(h.uid)?.zone==='grave'){e.modify(m.uid,'both','add',1000,null,c.source);defer(e,c,'end',e.state.turn,'theme2014-set',{uid:m.uid,generation:m.generation});}},{inputs:(e,c)=>[g(e,c,'target','选择影依怪兽',ownM(e,c).filter(sh)),g(e,c,'send','选择送墓的影依手牌',hand(e,c.owner,sh),1,1,'search')]});
 E.op('theme2014-set',(e,t)=>{const m=card(e,t.data?.uid??t.context?.uid);if(m&&m.generation===(t.data?.generation??t.context?.generation))e.setPosition(m.uid,'defense',t.source,true);});

 // TELLARKNIGHTS: all five initial bodies and the NECH follow-up bodies.
 onSummoned('Satellarknight Deneb',{resolve:(e,c)=>search(e,c,deck(e,c.owner,m=>tell(m)&&monster(m)&&m.id!==c.sourceId))});
 onSummoned('Satellarknight Unukalhai',{resolve:(e,c)=>pickSend(e,c,deck(e,c.owner,m=>tell(m)&&m.id!==c.sourceId))});
 onSummoned('Satellarknight Vega',{summons:true,resolve:(e,c)=>specialChoice(e,c,hand(e,c.owner,m=>tell(m)&&monster(m)&&m.id!==c.sourceId))});
 onSummoned('Satellarknight Altair',{summons:true,inputs:target('选择复活的星因士',(e,c)=>grave(e,c.owner,m=>tell(m)&&monster(m)&&m.id!==c.sourceId),'special'),resolve:(e,c)=>{revive(e,c,first(c),{position:'defense'});lock(e,c.owner,'tellAttacks');}});
 onSummoned('Satellarknight Alsahm',{resolve:(e,c)=>X.burn(e,c,1000)});
 onSummoned('Satellarknight Procyon',{condition:(e,c)=>hand(e,c.owner,m=>tell(m)&&monster(m)).length>0,inputs:(e,c)=>[g(e,c,'send','选择送墓的星因士手牌',hand(e,c.owner,m=>tell(m)&&monster(m)),1,1,'search')],resolve:(e,c)=>{const uid=first(c,'send');if(e.find(uid)?.zone==='hand'){send(e,c,[uid]);if(e.find(uid)?.zone==='grave')e.draw(c.owner,1);}}});
 onSummoned('Satellarknight Sirius',{inputs:target('选择洗回的5只星因士',(e,c)=>grave(e,c.owner,m=>tell(m)&&monster(m)),'search',5,5),resolve:(e,c)=>{const uids=args(c);if(uids.every(u=>e.find(u)?.zone==='grave')){shuffleBack(e,c,uids);e.draw(c.owner,1);}}});
 onSummoned('Satellarknight Betelgeuse',{inputs:target('选择回收的星因士卡片',(e,c)=>grave(e,c.owner,m=>tell(m)&&m.id!==c.sourceId),'search'),resolve:(e,c)=>{if(field(e.find(c.uid)?.zone)){send(e,c,[c.uid]);if(e.find(c.uid)?.zone==='grave')moved(e,c,args(c),'hand','effect-return');}}});
 onSummoned('Satellarknight Rigel',{inputs:target('选择提升攻击力的星因士',(e,c)=>allM(e).filter(m=>tell(m)&&m.faceUp),'own-boost'),resolve:(e,c)=>{const m=card(e,first(c));if(m){e.modify(m.uid,'atk','add',500,null,c.source);defer(e,c,'end',e.state.turn,'theme2014-send-end',{uid:m.uid,generation:m.generation});}}});
 E.op('theme2014-send-end',(e,t)=>{const d=t.data||t.context,m=card(e,d.uid);if(m&&m.generation===d.generation&&field(e.find(m.uid)?.zone))send(e,{source:t.source,owner:t.owner},[m.uid]);});
 onSummoned('Satellarknight Capella',{resolve:(e,c)=>lock(e,c.owner,'tellCapella')});
 extend('xyzValid',function(prior,p,m,list,...rest){if(locked(this,p,'tellCapella')&&list.length>=3&&def(m)?.rank===5&&list.every(q=>tell(q)&&this.level(q)<=4)){const old=list.map(q=>q.levelOverride);try{list.forEach(q=>q.levelOverride={value:5,until:this.state.turn});return prior.call(this,p,m,list,...rest);}finally{list.forEach((q,i)=>{if(old[i]===undefined)delete q.levelOverride;else q.levelOverride=old[i];});}}return prior.call(this,p,m,list,...rest);});
 extend('canAttack',function(prior,m,p,t){return !(locked(this,p??this.state.active,'tellAttacks')&&!tell(m))&&prior.call(this,m,p,t);});
 if(present('Stellarknight Delteros')){
  effect('Stellarknight Delteros',allF,(e,c)=>destroy(e,c,args(c)),{mode:'theme-destroy',detach:1});
  onMove('Stellarknight Delteros','theme-recruit',{summons:true,resolve:(e,c)=>specialChoice(e,c,[...hand(e,c.owner,m=>tell(m)&&monster(m)),...deck(e,c.owner,m=>tell(m)&&monster(m))],{shuffle:true})},(e,v)=>v.to==='grave'&&field(v.from));
 }
 if(present('Stellarknight Triverr')){
  C('Stellarknight Triverr').xyz={...(C('Stellarknight Triverr').xyz||{}),count:3,family:'tellarknight'};
  onEntry('Stellarknight Triverr','theme-bounce',{mandatory:true,resolve:(e,c)=>moved(e,c,allF(e).filter(f=>f.uid!==c.uid).map(f=>f.uid),'hand','effect-return')},['xyz']);
  effect('Stellarknight Triverr',null,(e,c)=>{const list=hand(e,1-c.owner);if(list.length)send(e,c,[list[Math.floor(e.random()*list.length)].uid]);},{mode:'theme-discard',detach:1,condition:(e,c)=>(self(e,c)?.overlays||[]).length>0&&hand(e,1-c.owner).length>0});
  onMove('Stellarknight Triverr','theme-revive',{inputs:target('选择复活的星因士',(e,c)=>grave(e,c.owner,m=>tell(m)&&monster(m)),'special'),summons:true,resolve:(e,c)=>revive(e,c,first(c))},(e,v)=>v.to==='grave'&&(v.previous?.overlays||[]).length>0);
  E.on('summon',(e,v)=>{if(v.kind==='xyz'&&is({id:v.id},'Stellarknight Triverr'))lock(e,v.owner,'triverrSpecial');if(!['normal','flip','set'].includes(v.kind)&&!tell({id:v.id}))lock(e,v.owner,'specialNonTell');});
 }
 extend('canSpecial',function(prior,p,m,o={}){if(locked(this,p,'triverrSpecial')&&!tell(m))return false;if(is(m,'Stellarknight Triverr')&&o.via==='xyz'&&locked(this,p,'specialNonTell'))return false;if(live(this,'Satellarknight Skybridge',p).length){}if(ownM(this,{owner:p}).some(q=>q.faceUp&&q.eraSkybridge)&&!tell(m))return false;return prior.call(this,p,m,o);});
 if(present('Satellarknight Skybridge'))cast('Satellarknight Skybridge',(e,c)=>ownM(e,c).filter(m=>m.faceUp&&tell(m)),(e,c)=>{const m=card(e,first(c));if(!m)return;choose(e,c,'选择特殊召唤的不同名星因士',deck(e,c.owner,q=>tell(q)&&monster(q)&&q.id!==m.id),1,1,'theme2014-skybridge',{oldUid:m.uid,oldGeneration:m.generation,role:'special'});},{once:limit('skybridge'),summons:true});
 E.op('theme2014-skybridge',(e,t)=>{const c={owner:t.owner,source:t.context.source},m=card(e,t.context.oldUid);if(!m||m.generation!==t.context.oldGeneration||!field(e.find(m.uid)?.zone))return;const result=revive(e,c,t.picks[0]);if(result){result.eraSkybridge=true;shuffleBack(e,c,[m.uid]);}e.shuffle(e.state.players[t.owner].deck);});
 if(present('Stellarnova Alpha'))cast('Stellarnova Alpha',null,(e,c)=>{if(e.negateLink(c.responseTo,c.source,true,true))e.draw(c.owner,1);},{main:false,condition:(e,c)=>!!c.event.window?.chainLast,inputs:(e,c)=>[g(e,c,'cost','选择送墓的表侧星因士',ownM(e,c).filter(m=>m.faceUp&&tell(m)),1,1,'cost')],cost:(e,c)=>H.sendCost(e,c,args(c,'cost')),aiResponse:()=>1800});
 if(present('Stellarnova Wave')){cast('Stellarnova Wave',null,()=>{});Q('Stellarnova Wave','theme-recruit',{zones:['spells'],once:H.once('wave','card'),summons:true,condition:(e,c)=>e.state.active===c.owner&&/^main/.test(e.state.phase)||e.state.active!==c.owner&&e.state.phase==='battle',resolve:(e,c)=>specialChoice(e,c,hand(e,c.owner,m=>tell(m)&&monster(m))),aiResponse:()=>900});}
 if(present('Stellarknight Alpha')){
  cast('Stellarknight Alpha',(e,c)=>ownM(e,c).filter(m=>m.faceUp&&tell(m)),(e,c)=>{const m=card(e,c.uid);if(m)m.equipTarget=first(c);});
  passive('Stellarknight Alpha',{stat:(e,s,m)=>s.card.equipTarget===m.uid?500:0});
  extend('unaffected',function(prior,m,s){if(s?.owner!==this.find(m.uid)?.owner&&live(this,'Stellarknight Alpha').some(f=>f.card.equipTarget===m.uid))return true;return prior.call(this,m,s);});
  E.on('summon',(e,v)=>{for(const f of live(e,'Stellarknight Alpha'))if(ownM(e,{owner:f.owner}).some(m=>m.faceUp&&!tell(m)))e.destroy(f.uid,src(e,f.card));});
 }
 // Protection of activation windows is checked at the same gate used by the
 // client and server; no special AI exception bypasses the restriction.
 extend('earlyCanUse',function(prior,c,a){const w=c.event?.window;if(w?.owner!==undefined&&w.owner!==c.owner&&['summon','summon-attempt'].includes(w.kind)&&live(this,'Stellarknight Delteros',w.owner).some(f=>f.card.overlays?.length))return false;const l=w?.chainLast;if(l&&l.owner!==c.owner&&nek({id:l.sourceId})&&def({id:l.sourceId})?.spellKind==='ritual'&&live(this,'Dance Princess of the Nekroz',l.owner).length)return false;return prior.call(this,c,a);});

 // YANG ZING: destruction floaters, optional opponent-turn Synchros, and the
 // permanent abilities granted by the *actual* materials of that summon.
 const yzNames=[['Suanni, Fire of the Yang Zing','defense'],["Bi'an, Earth of the Yang Zing",'defense'],['Bixi, Water of the Yang Zing','attack'],['Pulao, Wind of the Yang Zing','attack'],['Taotie, Shadow of the Yang Zing','defense'],['Chiwen, Light of the Yang Zing','attack'],['Jiaotu, Darkness of the Yang Zing','attack']];
 const synchroChoices=(e,p,allYang=true)=>e.extraOptions(p).filter(o=>o.type==='synchro').flatMap(o=>o.combos.filter(s=>{const ms=s.materials.map(u=>card(e,u));return allYang?ms.every(yang):ms.some(yang);}).map(s=>({uid:o.card.uid+'|'+s.materials.join('|'),label:def(o.card).name+' · '+s.materials.map(u=>def(card(e,u)).name).join(' + '),value:def(o.card).atk||1000})));
 function quickSynchro(n,allYang=true,trap=false){Q(n,'theme-synchro',{zones:trap?['spells']:['monsters','extraMonster'],once:trap?undefined:H.once('yang-synchro','card'),summons:true,condition:(e,c)=>(trap||e.state.active!==c.owner)&&['main1','main2','battle'].includes(e.state.phase)&&synchroChoices(e,c.owner,allYang).length>0,cost:trap?(e,c)=>H.sendCost(e,c,[c.uid]):undefined,resolve:(e,c)=>{const choices=synchroChoices(e,c.owner,allYang);if(choices.length)e.queueChoice(c.owner,'选择同调怪兽与素材',choices,1,1,'theme2014-synchro',{source:c.source,allYang});},aiResponse:()=>1200});}
 E.op('theme2014-synchro',(e,t)=>{const [uid,...materials]=(t.picks[0]||'').split('|'),m=card(e,uid),list=materials.map(u=>card(e,u));if(m&&list.every(Boolean)&&(t.context.allYang?list.every(yang):list.some(yang))&&e.synchroValid(t.owner,m,list))e.performSynchro(t.owner,uid,materials,{source:t.context.source});});
 for(const [n,position] of yzNames)if(present(n)){
  onMove(n,'theme-recruit',{once:limit(n),summons:true,resolve:(e,c)=>specialChoice(e,c,deck(e,c.owner,m=>yang(m)&&monster(m)&&m.id!==c.sourceId),{position,shuffle:true})},destroyed);
  if(!/Chiwen|Jiaotu/.test(n))quickSynchro(n);
 }
 if(present('Chiwen, Light of the Yang Zing'))watch('Chiwen, Light of the Yang Zing','theme-self','move',(e,v,f)=>v.uid!==f.card.uid&&destroyed(e,v)&&v.owner===f.owner&&yang({id:v.id}),{once:limit('Chiwen, Light of the Yang Zing'),summons:true,resolve:(e,c)=>revive(e,c,c.uid,{banishOnLeave:true})},{zones:['grave']});
 if(present('Jiaotu, Darkness of the Yang Zing'))effect('Jiaotu, Darkness of the Yang Zing',null,(e,c)=>{for(const uid of [...args(c,'atk'),...args(c,'def')]){const m=revive(e,c,uid);if(m)X.delayMove(e,c,m,'banished');}e.shuffle(e.state.players[c.owner].deck);},{mode:'theme-recruit-two',once:limit('Jiaotu, Darkness of the Yang Zing'),summons:true,condition:(e,c)=>ownM(e,c).length===1&&e.freeMain(c.owner)>=2,inputs:(e,c)=>[g(e,c,'cost','选择送墓的2张龙星手牌',hand(e,c.owner,yang),2,2,'cost'),g(e,c,'atk','选择攻击力0的龙星',deck(e,c.owner,m=>yang(m)&&monster(m)&&def(m).atk===0),1,1,'special'),g(e,c,'def','选择守备力0的龙星',deck(e,c.owner,m=>yang(m)&&monster(m)&&def(m).def===0&&!args(c,'atk').includes(m.uid)),1,1,'special')],cost:(e,c)=>H.sendCost(e,c,args(c,'cost'))});
 E.on('summon',(e,v)=>{if(v.kind!=='synchro')return;const m=card(e,v.uid);if(!m)return;const ns=(v.materials||[]).map(q=>def(q)?.officialName);m.eraYangMaterials=ns; if(ns.includes('Suanni, Fire of the Yang Zing')){e.modify(m.uid,'atk','add',500,null,src(e,m));e.modify(m.uid,'def','add',500,null,src(e,m));}});
 extend('unaffected',function(prior,m,s){const ns=m?.eraYangMaterials||[],type=s?.effectType||def({id:s?.id})?.type;if(!this.negated(m)&&(ns.includes('Bixi, Water of the Yang Zing')&&type==='trap'||ns.includes('Pulao, Wind of the Yang Zing')&&['spell','pendulum-spell'].includes(type)))return true;return prior.call(this,m,s);});
 extend('destroy',function(prior,uid,s,b=false,...rest){const m=card(this,uid);if(b&&m?.eraYangMaterials?.includes("Bi'an, Earth of the Yang Zing")&&!this.negated(m))return false;return prior.call(this,uid,s,b,...rest);});
 extend('takeControl',function(prior,uid,p,o){const m=card(this,uid);if(m?.eraYangMaterials?.includes('Taotie, Shadow of the Yang Zing')&&!this.negated(m))return false;return prior.call(this,uid,p,o);});
 if(present('Baxia, Brightness of the Yang Zing')){
  C('Baxia, Brightness of the Yang Zing').synchro={...(C('Baxia, Brightness of the Yang Zing').synchro||{}),nonTunerRace:'幻龙族'};
  onEntry('Baxia, Brightness of the Yang Zing','theme-shuffle',{inputs:(e,c)=>[g(e,c,'target','选择洗回卡组的卡片',allF(e),1,new Set((c.event.materials||[]).filter(m=>def(m)?.race==='幻龙族').map(m=>def(m).attribute)).size,'bounce')],resolve:(e,c)=>shuffleBack(e,c,args(c))},['synchro']);
  effect('Baxia, Brightness of the Yang Zing',null,(e,c)=>{if(e.destroy(first(c,'own'),c.source))revive(e,c,first(c));},{mode:'theme-revive',summons:true,inputs:(e,c)=>[g(e,c,'own','选择破坏的自己卡片',e.field(c.owner)),g(e,c,'target','选择复活的4星以下怪兽',grave(e,c.owner,m=>monster(m)&&e.level(m)<=4),1,1,'special')]});
 }
 if(present('Yazi, Evil of the Yang Zing')){
  guard('target','Yazi, Evil of the Yang Zing',(e,m,s)=>!active(e,m)||s?.owner===e.find(m.uid)?.owner);
  effect('Yazi, Evil of the Yang Zing',null,(e,c)=>destroy(e,c,[...args(c,'own'),...args(c)]),{mode:'theme-destroy',once:limit('yazi-pop'),inputs:(e,c)=>[g(e,c,'own','选择破坏的自己龙星',ownM(e,c).filter(yang)),g(e,c,'target','选择破坏的对方卡片',e.field(1-c.owner))]});
  onMove('Yazi, Evil of the Yang Zing','theme-recruit',{once:limit('yazi-recruit'),summons:true,resolve:(e,c)=>specialChoice(e,c,deck(e,c.owner,m=>monster(m)&&e.race(m)==='幻龙族'),{position:'defense',shuffle:true})},destroyed);
 }
 if(present('Yang Zing Path'))cast('Yang Zing Path',(e,c)=>grave(e,c.owner,m=>yang(m)&&monster(m)),(e,c)=>{if(args(c).every(u=>e.find(u)?.zone==='grave')){shuffleBack(e,c,args(c));e.draw(c.owner,2);}},{min:3,max:3,once:limit('yang-path'),role:'search'});
 if(present('Yang Zing Creation')){
  cast('Yang Zing Creation',null,()=>{});
  watch('Yang Zing Creation','theme-recruit','move',(e,v,f)=>v.owner===f.owner&&field(v.from)&&monster({id:v.id})&&['battle','destroy'].includes(v.kind),{once:H.once('creation','card'),summons:true,resolve:(e,c)=>specialChoice(e,c,deck(e,c.owner,m=>yang(m)&&monster(m)),{shuffle:true})});
  extend('canSpecial',function(prior,p,m,o={}){return !(this.find(m.uid)?.zone==='extra'&&def(m).type!=='synchro'&&live(this,'Yang Zing Creation',p).length)&&prior.call(this,p,m,o);});
 }
 if(present('Yang Zing Unleashed')){cast('Yang Zing Unleashed',null,()=>{});quickSynchro('Yang Zing Unleashed',false,true);extend('mustAttack',function(prior,m,p){return live(this,'Yang Zing Unleashed',1-(p??this.find(m.uid)?.owner)).length>0||!!prior?.call(this,m,p);});}
 if(present('Yang Zing Brutality'))cast('Yang Zing Brutality',null,(e,c)=>{const a=c.event.window.attack,m=[a.uid,a.target].map(u=>card(e,u)).find(m=>m&&e.find(m.uid)?.owner===c.owner&&yang(m));if(m){e.modify(m.uid,'atk','set',Math.max(0,def(m).atk)*2,e.state.turn,c.source);e.modify(m.uid,'def','set',Math.max(0,def(m).def)*2,e.state.turn,c.source);m.eraBrutality={source:c.source};}},{main:false,damageStep:true,condition:(e,c)=>{const a=c.event.window?.attack;return !!a?.target&&['calc','resolving'].includes(a.stage)&&[a.uid,a.target].some(u=>card(e,u)&&e.find(u)?.owner===c.owner&&yang(card(e,u)));},aiResponse:()=>1200});
 E.on('damage-end',(e,v)=>{for(const uid of [v.attack.uid,v.attack.target]){const m=card(e,uid);if(m?.eraBrutality){const s=m.eraBrutality.source;delete m.eraBrutality;e.destroy(uid,s);}}});
 // Temporary grants are removed when an object becomes a new field instance.
 E.on('move',(e,v)=>{if(!field(v.from)||v.from===v.to)return;const m=card(e,v.uid);if(m){delete m.eraSkybridge;delete m.eraYangMaterials;delete m.eraWendigoUntil;}});
 Object.assign(X,{shaddoll2014:sh,tellarknight2014:tell,yangzing2014:yang,nekroz2014:nek});
 if(typeof module!=='undefined')module.exports=X;
})(globalThis);
