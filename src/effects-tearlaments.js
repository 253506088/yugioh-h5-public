(function(root){
  'use strict';
  const E=root.DuelEffects,D=root.DuelData,H=E.H,{CARDS,isMonster}=D;
  const {source,self,first,args,group,customGroup,deck,grave,hand,monsters,specialable,once}=H;
  const tear=c=>!!CARDS[c.id].tearlaments,tearMonster=c=>tear(c)&&isMonster(CARDS[c.id]),tearTrap=c=>tear(c)&&CARDS[c.id].type==='trap';
  const visas=c=>c.id==='visas-starfrost',controller=(e,p)=>monsters(e,p,m=>m.faceUp&&(tearMonster(m)||visas(m))).length>0;
  const sameSource=(e,c,zone)=>{const f=source(e,c);return f&&f.zone===zone&&(f.card.generation||0)===c.source.generation?f:null;};
  const canMove=(e,c,m)=>{const f=e.find(m.uid);return f&&(!(H.fieldZone(f.zone)||['spells','fieldSpell'].includes(f.zone))||!e.unaffected(m,c.source));};
  const send=(e,c,uid)=>{const f=e.find(uid);return f&&canMove(e,c,f.card)?e.move(uid,'grave',{kind:'effect-send',source:c.source,byOwner:c.owner}):null;};
  function choose(e,c,title,list,op,role='tear-send',extra={},min=1,max=1){if(list.length>=min)e.queueChoice(c.owner,title,H.options(e,c,list),min,Math.min(max,list.length),op,{source:c.source,role,...extra});}
  function sendChoice(e,c,list,title='选择被效果送墓的卡片'){choose(e,c,title,list.filter(m=>canMove(e,c,m)),'tear-send-selected');}
  const returnChoice=(e,c,list,title)=>choose(e,c,title,list,'tear-return-selected','tear-search');
  E.op('tear-send-selected',(e,t)=>{for(const uid of t.picks)send(e,{owner:t.owner,source:t.context.source},uid);});
  E.op('tear-return-selected',(e,t)=>{for(const uid of t.picks){const f=e.find(uid);if(f&&['grave','banished'].includes(f.zone))e.move(uid,'hand',{kind:'effect-return',source:t.context.source,byOwner:t.owner});}});
  function fusionProfile(e,c){return {id:'tear-fusion',zones:['hand','monsters','extraMonster','grave'],destination:'deck',bottom:true,noTokens:true,requiredUid:c.uid,requiredZone:'grave',requiredGeneration:c.source.generation};}
  H.tear=tear;H.tearMonster=tearMonster;H.tearFusionProfile=fusionProfile;
  for(const id of ['tear-scheiren','tear-havnis','tear-merrli'])E.trigger(id,'fusion',{
    label:'珠泪：返回素材，融合召唤',zones:['grave'],once:once('fusion'),summons:true,
    condition:(e,c)=>!!sameSource(e,c,'grave')&&e.fusions(c.owner,fusionProfile(e,c)).length>0,
    resolve:(e,c)=>{if(!sameSource(e,c,'grave'))return;const profile=fusionProfile(e,c),list=e.fusions(c.owner,profile).map(o=>o.card);choose(e,c,'珠泪融合 · 选择融合怪兽',list,'select-fusion','tear-fusion',{spellId:profile});}
  });
  E.trigger('tear-reinoheart','send',{label:'雷诺哈特：将珠泪怪兽送墓',once:once('send'),condition:(e,c)=>deck(e,c.owner,m=>tearMonster(m)&&m.id!==c.sourceId).length>0,
    resolve:(e,c)=>sendChoice(e,c,deck(e,c.owner,m=>tearMonster(m)&&m.id!==c.sourceId),'雷诺哈特：选择珠泪怪兽送墓')});
  E.trigger('tear-reinoheart','revive',{label:'雷诺哈特：复活，再将手牌珠泪送墓',zones:['grave'],once:once('revive'),summons:true,
    condition:(e,c)=>e.freeMain(c.owner)>0&&hand(e,c.owner,tear).length>0&&e.canSpecial(c.owner,source(e,c).card,{via:'revive'}),
    resolve:(e,c)=>{if(!sameSource(e,c,'grave'))return;const m=e.special(c.owner,c.uid,{via:'revive',banishOnLeave:true});if(m)sendChoice(e,c,hand(e,c.owner,tear),'雷诺哈特：将手牌1张珠泪送墓');}});
  E.register('tear-scheiren','hand-special',{label:'塞壬：特殊召唤，送墓手牌并堆墓3张',zones:['hand'],once:once('hand-special'),summons:true,
    condition:(e,c)=>H.mainPhase(e)&&hand(e,c.owner,m=>m.uid!==c.uid&&isMonster(CARDS[m.id])).length>0&&e.freeMain(c.owner)>0&&e.canSpecial(c.owner,source(e,c).card),
    resolve:(e,c)=>{if(!sameSource(e,c,'hand'))return;const m=e.special(c.owner,c.uid,{via:'effect'});if(m)choose(e,c,'塞壬：选择被效果送墓的手牌怪兽',hand(e,c.owner,m=>isMonster(CARDS[m.id])),'tear-scheiren-send');},aiScore:1750});
  E.op('tear-scheiren-send',(e,t)=>{const moved=send(e,{owner:t.owner,source:t.context.source},t.picks[0]);if(moved?.to==='grave')e.mill(t.owner,3,t.context.source);});
  E.quick('tear-havnis','hand-special',{label:'哈弗：响应场上怪兽效果，特殊召唤并堆墓',zones:['hand'],main:false,once:once('hand-special'),summons:true,
    condition:(e,c)=>{const last=c.event.window?.chainLast;return !!last&&last.owner!==c.owner&&H.fieldZone(last.source.zone)&&isMonster(CARDS[last.sourceId])&&e.freeMain(c.owner)>0&&e.canSpecial(c.owner,source(e,c).card);},
    resolve:(e,c)=>{if(sameSource(e,c,'hand')&&e.special(c.owner,c.uid,{via:'effect'}))e.mill(c.owner,3,c.source);},aiResponse:()=>2200});
  E.trigger('tear-merrli','mill',{label:'梅洛：将卡组顶3张送墓',once:once('mill'),condition:(e,c)=>e.state.players[c.owner].deck.length>=3,resolve:(e,c)=>e.mill(c.owner,3,c.source)});
  E.quick('tear-kashtira','hand-special',{label:'珠泪俱舍：特殊召唤并除外1张系列卡',zones:['hand'],once:once('hand-special'),summons:true,
    condition:(e,c)=>H.mainPhase(e)&&e.freeMain(c.owner)>0&&e.canSpecial(c.owner,source(e,c).card)&&H.cards(e,c.owner,['hand','grave'],m=>m.uid!==c.uid&&(tear(m)||CARDS[m.id].kashtira)).length>0,
    resolve:(e,c)=>{if(!sameSource(e,c,'hand')||!e.special(c.owner,c.uid,{via:'effect'}))return;choose(e,c,'珠泪俱舍：选择除外的手牌／墓地系列卡',H.cards(e,c.owner,['hand','grave'],m=>tear(m)||CARDS[m.id].kashtira),'tear-kashtira-banish','cost');},aiScore:1550,aiResponse:(e,c,w)=>w.chainLast?.owner!==c.owner?1200:0});
  E.op('tear-kashtira-banish',(e,t)=>{const f=e.find(t.picks[0]);if(f&&['hand','grave'].includes(f.zone))e.move(f.card.uid,'banished',{kind:'effect-banish',source:t.context.source,byOwner:t.owner});});
  E.trigger('tear-kashtira','mill-three',{label:'珠泪俱舍：选择一方堆墓3张',once:once('mill-three'),condition:e=>e.state.players.some(p=>p.deck.length>=3),
    inputs:(e,c)=>[customGroup('player','选择将哪一方卡组顶3张送墓',[0,1].filter(p=>e.state.players[p].deck.length>=3).map(p=>({uid:'player:'+p,label:p===c.owner?'自己的卡组':'对方的卡组',detail:'将顶端3张送墓，不会触发抽空败北',value:p===c.owner?100:0})))],
    resolve:(e,c)=>e.mill(Number(first(c,'player').split(':')[1]),3,c.source)});
  E.trigger('tear-kashtira','mill-two',{label:'珠泪俱舍：堆墓2张',zones:['grave'],once:once('mill-two'),condition:(e,c)=>e.state.players[c.owner].deck.length>=2,resolve:(e,c)=>e.mill(c.owner,2,c.source)});
  E.trigger('tear-kitkallos','search-send',{label:'水仙：检索或送墓1张珠泪',once:once('search-send'),condition:(e,c)=>deck(e,c.owner,tear).length>0,
    inputs:()=>[customGroup('mode','水仙女人鱼 · 选择处理方式',[{uid:'mode:hand',label:'加入手牌',detail:'检索需要的展开或后场',value:10},{uid:'mode:grave',label:'送去墓地',detail:'以效果送墓，触发珠泪的墓地效果',value:0}])],
    resolve:(e,c)=>{if(first(c,'mode')==='mode:grave')sendChoice(e,c,deck(e,c.owner,tear),'水仙：选择送墓的珠泪卡');else choose(e,c,'水仙：选择加入手牌的珠泪卡',deck(e,c.owner,tear),'search-selected','tear-search');}});
  E.register('tear-kitkallos','exchange',{label:'水仙：展开珠泪，再将场上对象送墓',once:once('exchange'),summons:true,
    condition:(e,c)=>e.freeMain(c.owner)>0&&specialable(e,c.owner,H.cards(e,c.owner,['hand','grave'],tearMonster),'revive').length>0,
    inputs:(e,c)=>[group(e,c,'target','选择稍后被效果送墓的自己怪兽',monsters(e,c.owner,m=>canMove(e,c,m)),1,1,{role:'tear-send'})],
    resolve:(e,c)=>{const target=H.legalTarget(e,c,first(c),(m,f)=>f.owner===c.owner&&H.fieldZone(f.zone));if(!target)return;choose(e,c,'水仙：选择特殊召唤的珠泪',specialable(e,c.owner,H.cards(e,c.owner,['hand','grave'],tearMonster),'revive'),'tear-kit-exchange','tear-special',{target:target.card.uid,targetGeneration:target.card.generation||0});},
    aiScore:(e,c)=>self(e,c)&&H.cards(e,c.owner,['hand','grave'],m=>m.id==='tear-merrli').length?1400:600});
  E.op('tear-kit-exchange',(e,t)=>{const f=e.find(t.picks[0]);if(!f||!['hand','grave'].includes(f.zone))return;const m=e.special(t.owner,f.card.uid,{via:f.zone==='grave'?'revive':'effect'});if(!m)return;const target=e.find(t.context.target);if(target&&H.fieldZone(target.zone)&&(target.card.generation||0)===t.context.targetGeneration)send(e,{owner:t.owner,source:t.context.source},target.card.uid);});
  E.trigger('tear-kitkallos','mill-five',{label:'水仙：将卡组顶5张送墓',zones:['grave'],once:once('mill-five'),condition:(e,c)=>e.state.players[c.owner].deck.length>=5,resolve:(e,c)=>e.mill(c.owner,5,c.source)});
  E.passive('tear-rulkallos',{protect:(e,s,m,battle)=>battle&&e.find(m.uid)?.owner===s.owner&&m.uid!==s.card.uid&&CARDS[m.id].race==='水族'});
  E.quick('tear-rulkallos','negate',{label:'鲁莎卡：无效特殊召唤效果并破坏',main:false,once:once('negate'),destroys:true,
    condition:(e,c)=>{const last=c.event.window?.chainLast;return last?.owner===1-c.owner&&E.willSummon(e,last)&&H.cards(e,c.owner,['hand','monsters','extraMonster','spells','fieldSpell'],(m,f)=>tear(m)&&(f.zone==='hand'||m.faceUp)).length>0;},
    resolve:(e,c)=>{if(e.negateLink(c.responseTo,c.source,true,true))sendChoice(e,c,H.cards(e,c.owner,['hand','monsters','extraMonster','spells','fieldSpell'],(m,f)=>tear(m)&&(f.zone==='hand'||m.faceUp)),'鲁莎卡：将自己1张珠泪送墓');},aiResponse:()=>2400});
  E.trigger('tear-rulkallos','revive',{label:'鲁莎卡：融合召唤的自身从墓地回归',zones:['grave'],once:once('revive'),summons:true,
    condition:(e,c)=>e.freeMain(c.owner)>0&&e.canSpecial(c.owner,source(e,c).card,{via:'revive'}),resolve:(e,c)=>{if(sameSource(e,c,'grave'))e.special(c.owner,c.uid,{via:'revive'});}});
  E.trigger('tear-kaleido-heart','shuffle',{label:'卡雷多：将对方1张卡洗回卡组',once:once('shuffle'),
    inputs:(e,c)=>[group(e,c,'target','选择洗回卡组的对方卡片',e.field(1-c.owner),1,1,{role:'bounce'})],
    resolve:(e,c)=>{const f=H.legalTarget(e,c,first(c));if(f){const owner=f.card.originalOwner;e.move(f.card.uid,'deck',{kind:'effect-return',source:c.source,byOwner:c.owner});e.shuffle(e.state.players[owner].deck);}}});
  E.trigger('tear-kaleido-heart','revive',{label:'卡雷多：复活并将珠泪卡送墓',zones:['grave'],once:once('revive'),summons:true,
    condition:(e,c)=>e.freeMain(c.owner)>0&&e.canSpecial(c.owner,source(e,c).card,{via:'revive'})&&deck(e,c.owner,tear).length>0,
    resolve:(e,c)=>{if(sameSource(e,c,'grave')&&e.special(c.owner,c.uid,{via:'revive'}))sendChoice(e,c,deck(e,c.owner,tear),'卡雷多：从卡组将1张珠泪送墓');}});
  E.spell('perlereino',{label:'珍珠世界：检索珠泪并展开场地',once:once('activate'),onlyActivate:true,
    resolve:(e,c)=>choose(e,c,'珍珠世界：可以检索1只珠泪怪兽',deck(e,c.owner,m=>tearMonster(m)||visas(m)),'search-selected','tear-search',{},0,1),aiScore:1800});
  E.passive('perlereino',{stat:(e,s,m,stat)=>stat==='atk'&&e.find(m.uid)?.owner===s.owner&&(CARDS[m.id].type==='fusion'||tearMonster(m))?500:0});
  E.trigger('perlereino','destroy',{label:'珍珠世界：珠泪返回卡组，破坏1张卡',zones:['fieldSpell'],once:once('destroy'),requiresField:true,effectType:'spell',destroys:true,
    inputs:(e,c)=>[group(e,c,'target','珍珠世界：选择破坏的卡片',[0,1].flatMap(p=>e.field(p)),1,1,{role:'destroy'})],resolve:H.destroyTargets,aiTrigger:(e,c)=>e.field(1-c.owner).length>0});
  E.spell('tear-scream',{label:'发动弦声，准备召唤时堆墓',resolve:()=>{},aiScore:(e,c)=>e.spells(c.owner).some(m=>m.id===c.sourceId&&e.activeSpell(m))?-100:1650});
  E.trigger('tear-scream','mill',{label:'弦声：堆墓3张，并削弱对方500攻击力',zones:['spells'],effectType:'spell',requiresField:true,once:once('mill'),
    condition:(e,c)=>controller(e,c.owner)&&e.state.players[c.owner].deck.length>=3,
    resolve:(e,c)=>{if(e.mill(c.owner,3,c.source).length)for(const m of e.monsters(1-c.owner))if(m.faceUp)e.modify(m.uid,'atk','add',-500,e.state.turn,c.source);}});
  E.trigger('tear-scream','trap-search',{label:'弦声送墓：检索珠泪陷阱',zones:['grave'],once:once('trap-search'),condition:(e,c)=>deck(e,c.owner,tearTrap).length>0,
    resolve:(e,c)=>choose(e,c,'弦声：选择珠泪陷阱',deck(e,c.owner,tearTrap),'search-selected','tear-search')});
  E.spell('tear-heartbeat',{label:'鼓动：将魔法／陷阱洗回卡组',once:once('cast'),
    condition:(e,c)=>hand(e,c.owner,m=>m.uid!==c.uid).length>0,
    inputs:(e,c)=>[group(e,c,'target','鼓动：选择洗回的魔法／陷阱',[0,1].flatMap(p=>e.spells(p)).filter(m=>m.uid!==c.uid),1,monsters(e,c.owner,m=>m.faceUp&&visas(m)).length?2:1,{role:'bounce'})],
    resolve:(e,c)=>{let moved=false;for(const uid of args(c)){const f=H.legalTarget(e,c,uid,(m,f)=>['spells','fieldSpell'].includes(f.zone));if(f){const owner=f.card.originalOwner;e.move(uid,'deck',{kind:'effect-return',source:c.source,byOwner:c.owner});e.shuffle(e.state.players[owner].deck);moved=true;}}if(moved)sendChoice(e,c,hand(e,c.owner),'鼓动：将1张手牌送墓');},aiScore:(e,c)=>e.spells(1-c.owner).length?1500:-100,
    aiResponse:(e,c,w)=>w.chainLast?.owner!==c.owner&&e.spells(1-c.owner).some(m=>m.faceUp)?1700:0});
  E.trigger('tear-heartbeat','recover',{label:'鼓动送墓：回收珠泪陷阱',zones:['grave'],once:once('recover'),
    inputs:(e,c)=>[group(e,c,'target','选择墓地的珠泪陷阱',grave(e,c.owner,tearTrap),1,1,{role:'search'})],resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='grave')e.move(f.card.uid,'hand',{kind:'effect-return',source:c.source,byOwner:c.owner});}});
  E.spell('tear-grief',{label:'悲恸：从卡组展开，再送墓同族或同属性怪兽',once:once('cast'),summons:true,
    condition:(e,c)=>specialable(e,c.owner,deck(e,c.owner,m=>tearMonster(m)||visas(m))).length>0,
    resolve:(e,c)=>choose(e,c,'悲恸：选择从卡组登场的怪兽',specialable(e,c.owner,deck(e,c.owner,m=>tearMonster(m)||visas(m))),'tear-grief-special','tear-special'),aiScore:1500});
  E.op('tear-grief-special',(e,t)=>{const f=e.find(t.picks[0]);if(f?.zone!=='deck')return;const m=e.special(t.owner,f.card.uid,{via:'effect'});if(!m)return;const c={owner:t.owner,source:t.context.source},race=CARDS[m.id].race,attribute=e.attribute(m);sendChoice(e,c,monsters(e,t.owner,x=>x.faceUp&&(CARDS[x.id].race===race||e.attribute(x)===attribute)),'悲恸：送墓同种族或同属性怪兽');e.shuffle(e.state.players[t.owner].deck);});
  E.trigger('tear-grief','recover',{label:'悲恸送墓：回收除外的珠泪陷阱',zones:['grave'],once:once('recover'),
    inputs:(e,c)=>[group(e,c,'target','选择除外的珠泪陷阱',H.cards(e,c.owner,['banished'],tearTrap),1,1,{role:'search'})],resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='banished')e.move(f.card.uid,'hand',{kind:'effect-return',source:c.source,byOwner:c.owner});}});
  function canSulliek(e,c){return controller(e,c.owner)&&monsters(e,1-c.owner,m=>m.faceUp).length>0&&!e.wasUsed(c.owner,source(e,c).card,'negate','name');}
  function resolveSulliek(e,c){const f=H.legalTarget(e,c,first(c),(m,f)=>f.owner!==c.owner&&H.fieldZone(f.zone)&&m.faceUp);if(!f)return;f.card.effectNegated=true;sendChoice(e,c,monsters(e,c.owner),'哀唱：将自己1只怪兽送墓');}
  const sulliekTarget=(e,c)=>group(e,c,'target','哀唱：选择无效效果的对方怪兽',monsters(e,1-c.owner,m=>m.faceUp),1,1,{role:'destroy'});
  E.trap('tear-sulliek',{label:'发动哀唱／无效怪兽效果',
    inputs:(e,c)=>[customGroup('mode','选择哀唱的发动方式',[...(canSulliek(e,c)?[{uid:'mode:negate',label:'发动并使用无效效果',detail:'随后将自己1只怪兽送墓',value:100}]:[]),{uid:'mode:place',label:'仅发动永续陷阱',detail:'留在场上，等待以后使用效果',value:0}]),...(first(c,'mode')==='mode:negate'?[sulliekTarget(e,c)]:[])],
    cost:(e,c)=>{if(first(c,'mode')==='mode:negate')e.useKey(c.owner,source(e,c).card,'negate','name');},resolve:(e,c)=>{if(first(c,'mode')==='mode:negate')resolveSulliek(e,c);},aiScore:(e,c)=>canSulliek(e,c)?1300:-100,aiResponse:(e,c,w)=>canSulliek(e,c)&&w.chainLast?.owner!==c.owner?1900:0});
  E.quick('tear-sulliek','negate',{label:'哀唱：无效效果，再送墓自己怪兽',zones:['spells'],effectType:'trap',requiresField:true,once:once('negate'),condition:(e,c)=>e.activeSpell(source(e,c)?.card)&&controller(e,c.owner),inputs:(e,c)=>[sulliekTarget(e,c)],resolve:resolveSulliek,aiScore:1100,aiResponse:(e,c,w)=>w.chainLast?.owner!==c.owner?1800:0});
  E.trigger('tear-sulliek','search',{label:'哀唱送墓：检索珠泪怪兽',zones:['grave'],once:once('search'),condition:(e,c)=>deck(e,c.owner,tearMonster).length>0,resolve:(e,c)=>choose(e,c,'哀唱：选择珠泪怪兽',deck(e,c.owner,tearMonster),'search-selected','tear-search')});
  E.trap('tear-metanoise',{label:'爪音：里侧守备，再将珠泪送墓',once:once('cast'),condition:(e,c)=>controller(e,c.owner)&&deck(e,c.owner,tearMonster).length>0,
    inputs:(e,c)=>[group(e,c,'target','爪音：选择可以变为里侧守备的怪兽',monsters(e,1-c.owner,m=>m.faceUp&&!['link','token'].includes(CARDS[m.id].type)),1,1,{role:'destroy'})],
    resolve:(e,c)=>{const f=H.legalTarget(e,c,first(c),(m,f)=>H.fieldZone(f.zone)&&m.faceUp&&!['link','token'].includes(CARDS[m.id].type));if(!f)return;f.card.faceUp=false;f.card.position='defense';f.card.mods=[];f.card.effectNegated=false;f.card.levelOverride=null;f.card.attributeOverride=null;e.cleanupEquips(f.card.uid);sendChoice(e,c,deck(e,c.owner,tearMonster),'爪音：将卡组1只珠泪送墓');},aiScore:1250,aiResponse:(e,c,w)=>w.attack||w.chainLast?.owner!==c.owner?1700:0});
  E.trigger('tear-metanoise','recover',{label:'爪音送墓：回收珠泪怪兽',zones:['grave'],once:once('recover'),inputs:(e,c)=>[group(e,c,'target','选择墓地的珠泪怪兽',grave(e,c.owner,tearMonster),1,1,{role:'search'})],resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='grave')e.move(f.card.uid,'hand',{kind:'effect-return',source:c.source,byOwner:c.owner});}});
  E.trap('tear-cryme',{label:'残响：无效发动，洗回卡组并送墓手牌怪兽',main:false,once:once('cast'),
    condition:(e,c)=>controller(e,c.owner)&&hand(e,c.owner,m=>isMonster(CARDS[m.id])).length>0&&!!c.event.window?.chainLast,
    resolve:(e,c)=>{const link=e.state.chain.find(l=>l.id===c.responseTo);if(!link||!e.negateLink(c.responseTo,c.source,true,false))return;const f=e.find(link.uid);if(f&&(f.card.generation||0)===link.source.generation){const owner=f.card.originalOwner;e.move(f.card.uid,'deck',{kind:'effect-return',source:c.source,byOwner:c.owner});e.shuffle(e.state.players[owner].deck);sendChoice(e,c,hand(e,c.owner,m=>isMonster(CARDS[m.id])),'残响：将手牌1只怪兽送墓');}},aiResponse:(e,c,w)=>w.chainLast?.owner!==c.owner?2700:0});
  E.trigger('tear-cryme','recover',{label:'残响送墓：回收除外的珠泪怪兽',zones:['grave'],once:once('recover'),inputs:(e,c)=>[group(e,c,'target','选择除外的珠泪怪兽',H.cards(e,c.owner,['banished'],tearMonster),1,1,{role:'search'})],resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='banished')e.move(f.card.uid,'hand',{kind:'effect-return',source:c.source,byOwner:c.owner});}});
  E.trigger('supreme-sea-mare','send',{label:'绝海之马：将水族送墓',once:once('send'),condition:(e,c)=>deck(e,c.owner,m=>isMonster(CARDS[m.id])&&CARDS[m.id].race==='水族'&&m.id!==c.sourceId).length>0,
    resolve:(e,c)=>sendChoice(e,c,deck(e,c.owner,m=>isMonster(CARDS[m.id])&&CARDS[m.id].race==='水族'&&m.id!==c.sourceId),'绝海之马：将水族送墓')});
  E.trigger('supreme-sea-mare','recover',{label:'结束阶段：解放绝海之马，回收水族',once:once('recover'),leavesAsCost:true,inputs:(e,c)=>[group(e,c,'target','选择回收的水族',grave(e,c.owner,m=>isMonster(CARDS[m.id])&&CARDS[m.id].race==='水族'&&m.id!==c.sourceId),1,1,{role:'search'})],cost:(e,c)=>H.tributeCost(e,c,[c.uid]),resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='grave')e.move(f.card.uid,'hand',{kind:'effect-return',source:c.source,byOwner:c.owner});}});
  E.quick('dd-crow','banish',{label:'丢弃乌鸦，除外对方墓地1张卡',zones:['hand'],inputs:(e,c)=>[group(e,c,'target','选择对方墓地的卡片',grave(e,1-c.owner),1,1,{role:'banish'})],cost:(e,c)=>H.discard(e,c,[c.uid]),resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='grave')e.move(f.card.uid,'banished',{kind:'effect-banish',source:c.source,byOwner:c.owner});},aiScore:()=>-100,aiResponse:(e,c,w)=>w.chainLast?.owner!==c.owner&&w.chainLast?.source?.zone==='grave'?2300:0});
  E.spell('terraforming',{label:'检索场地魔法',condition:(e,c)=>deck(e,c.owner,m=>CARDS[m.id].spellKind==='field').length>0,resolve:(e,c)=>H.searchChoice(e,c,m=>CARDS[m.id].spellKind==='field'),aiScore:1850});
  E.quick('abyss-dweller','lock',{label:'潜伏者：移除素材，封锁对方墓地发动',once:once('lock','card'),condition:(e,c)=>(source(e,c)?.card.overlays.length||0)>0&&e.state.players[1-c.owner].graveLockTurn!==e.state.turn,
    inputs:(e,c)=>[H.detachInput(e,c,1)],cost:(e,c)=>e.detach(c.uid,args(c,'cost')),resolve:(e,c)=>{e.state.players[1-c.owner].graveLockTurn=e.state.turn;e.log('effect','本回合'+e.name(1-c.owner)+'不能发动墓地的卡片效果',c.owner);},aiScore:(e,c)=>e.state.active===c.owner?-100:1300,aiResponse:(e,c,w)=>e.state.active!==c.owner?1800:0});
  E.passive('abyss-dweller',{stat:(e,s,m,stat)=>stat==='atk'&&e.find(m.uid)?.owner===s.owner&&e.attribute(m)==='水'&&(s.card.overlays||[]).some(x=>CARDS[x.id].attribute==='水')?500:0});
  E.on('summon',(e,v)=>{
    if(v.kind==='flip')return;const key={'tear-reinoheart':'send','tear-merrli':'mill','tear-kashtira':'mill-three','tear-kitkallos':'search-send','tear-kaleido-heart':'shuffle','supreme-sea-mare':'send'}[v.id];if(key)e.addTrigger(v.uid,v.id+'::'+key,v);
    for(const owner of [0,1])for(const m of e.spells(owner))if(m.id==='tear-scream'&&e.activeSpell(m)&&controller(e,owner))e.addTrigger(m.uid,'tear-scream::mill',v,{owner});
  });
  E.on('move',(e,v)=>{
    const c=CARDS[v.id];if(v.to==='grave'&&v.byEffect){
      const key={'tear-scheiren':'fusion','tear-havnis':'fusion','tear-merrli':'fusion','tear-reinoheart':'revive','tear-kashtira':'mill-two','tear-kitkallos':'mill-five','tear-kaleido-heart':'revive','tear-scream':'trap-search','tear-heartbeat':'recover','tear-grief':'recover','tear-sulliek':'search','tear-metanoise':'recover','tear-cryme':'recover'}[v.id];if(key)e.addTrigger(v.uid,v.id+'::'+key,v,{owner:v.previous.originalOwner});
      if(v.id==='tear-rulkallos'&&v.previous.summonKind==='fusion')e.addTrigger(v.uid,'tear-rulkallos::revive',v,{owner:v.previous.originalOwner});
      if(isMonster(c)&&c.race==='水族')for(const m of e.monsters(v.previous.originalOwner))if(m.id==='tear-kaleido-heart'&&m.faceUp)e.addTrigger(m.uid,'tear-kaleido-heart::shuffle',v,{owner:v.previous.originalOwner});
    }
    if(['deck','extra-down'].includes(v.to)&&tearMonster({id:v.id})&&['grave','monsters','extraMonster'].includes(v.from)){const owner=H.fieldZone(v.from)?v.previous.owner:v.previous.originalOwner;for(const m of e.spells(owner))if(m.id==='perlereino'&&e.activeSpell(m))e.addTrigger(m.uid,'perlereino::destroy',v,{owner});}
  });
  E.on('end-phase',(e,v)=>{for(const m of e.monsters(v.owner))if(m.id==='supreme-sea-mare'&&m.faceUp)e.addTrigger(m.uid,'supreme-sea-mare::recover',v,{owner:v.owner});});
  const priorScore=E.extraCandidateScore;
  E.extraCandidateScore=(e,c,o,role)=>{
    const d=CARDS[o.cardId],f=e.find(o.uid);if(!d||!f)return priorScore?.(e,c,o,role);
    const p=e.state.players[c.owner];
    if(role==='tear-fusion'){
      const same=e.monsters(c.owner).some(m=>m.id===d.id&&m.faceUp);
      return (same?0:7000)+({'tear-kitkallos':!e.wasUsed(c.owner,f.card,'search-send')?18000:7000,'tear-rulkallos':14500,'tear-kaleido-heart':e.field(1-c.owner).length?16000:12500}[d.id]||d.atk||0);
    }
    if(['tear-send','send-deck'].includes(role)&&d.tearlaments){
      if(['tear-scheiren','tear-havnis','tear-merrli'].includes(d.id))return e.wasUsed(c.owner,f.card,'fusion')?800:17000;
      if(d.id==='tear-kitkallos')return e.wasUsed(c.owner,f.card,'mill-five')?500:19000;
      return ({'tear-reinoheart':9500,'tear-kashtira':14500,'tear-scream':11000,'tear-sulliek':10500,'tear-heartbeat':6000,'tear-grief':2000,'tear-cryme':2000,'tear-metanoise':7000}[d.id]||4000);
    }
    if(role==='tear-send')return -e.cardUtility(f.card,c.owner);
    if(['tear-search','search'].includes(role)&&d.tearlaments){
      const have=p.hand.some(m=>m.id===d.id)||e.field(c.owner).some(m=>m.id===d.id);
      return (have?-5000:0)+({'tear-merrli':11000,'tear-scheiren':15000,'tear-reinoheart':e.state.normalUsed?7000:16000,'tear-havnis':12000,'tear-kashtira':12500,'tear-sulliek':14000,'tear-cryme':11500,'tear-scream':13000}[d.id]||6000);
    }
    if(role==='tear-special')return {'tear-merrli':16000,'tear-reinoheart':14500,'tear-kashtira':14000,'tear-kitkallos':19000,'tear-rulkallos':17000,'tear-kaleido-heart':17000}[d.id]||9000;
    return priorScore?.(e,c,o,role);
  };
})(globalThis);
