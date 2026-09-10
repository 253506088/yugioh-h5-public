(function(root){ 'use strict'; const E=root.DuelEffects,D=root.DuelData,H=E.H;
const {CARDS,isMonster,isFamily}=D;
const {source,self,first,args,group,customGroup,deck,grave,hand,monsters,specialable,discard,once}=H;
const hero=c=>isMonster(CARDS[c.id])&&isFamily(CARDS[c.id],'hero');
const elemental=c=>isMonster(CARDS[c.id])&&!!CARDS[c.id].elemental;
function searchChoice(e,c,filter,title='选择加入手牌的卡牌'){
  const list=deck(e,c.owner,filter);if(list.length)e.queueChoice(c.owner,title,H.options(e,c,list),1,1,'search-selected',{source:c.source,role:'search'});
}
function specialChoice(e,c,list,options={}){
  const choices=specialable(e,c.owner,list,options.via||'effect');
  if(choices.length)e.queueChoice(c.owner,'选择特殊召唤的怪兽',H.options(e,c,choices),1,1,'special-selected',{owner:c.owner,source:c.source,role:'special',...options});
}
H.searchChoice=searchChoice;H.specialChoice=specialChoice;
const otherHero=(e,c)=>monsters(e,c.owner,m=>m.uid!==c.uid&&m.faceUp&&hero(m));
E.trigger('hero-stratos','entry',{label:'天空侠：检索或破坏后场',
  inputs:(e,c)=>[customGroup('mode','选择天空侠的效果',[
    ...(deck(e,c.owner,hero).length?[{uid:'mode:search',label:'检索HERO',detail:'从卡组将1只HERO加入手牌'}]:[]),
    ...(otherHero(e,c).length&&[0,1].some(p=>e.spells(p).length)?[{uid:'mode:destroy',label:'破坏魔法／陷阱',detail:'最多为其他HERO怪兽的数量'}]:[])
  ])],
  resolve:(e,c)=>{
    if(first(c,'mode')==='mode:search')searchChoice(e,c,hero);
    else {const max=otherHero(e,c).length,list=[0,1].flatMap(p=>e.spells(p));if(max&&list.length)e.queueChoice(c.owner,'选择要破坏的魔法／陷阱',H.options(e,c,list),1,Math.min(max,list.length),'destroy-selected',{source:c.source,role:'destroy'});}
  }});
E.trigger('hero-shadow-mist','special-search',{label:'影雾：检索变化速攻魔法',once:once('one-effect'),condition:(e,c)=>deck(e,c.owner,m=>m.id==='mask-change').length>0,resolve:(e,c)=>searchChoice(e,c,m=>m.id==='mask-change')});
E.trigger('hero-shadow-mist','grave-search',{label:'影雾：检索HERO',zones:['grave'],once:once('one-effect'),condition:(e,c)=>deck(e,c.owner,m=>hero(m)&&m.id!=='hero-shadow-mist').length>0,resolve:(e,c)=>searchChoice(e,c,m=>hero(m)&&m.id!=='hero-shadow-mist')});
E.trigger('hero-solid-soldier','normal-special',{label:'固态侠：展开手牌HERO',condition:(e,c)=>specialable(e,c.owner,hand(e,c.owner,m=>hero(m)&&CARDS[m.id].level<=4)).length>0,resolve:(e,c)=>specialChoice(e,c,hand(e,c.owner,m=>hero(m)&&CARDS[m.id].level<=4))});
E.trigger('hero-solid-soldier','grave-revive',{label:'固态侠：复活HERO',zones:['grave'],once:once('revive'),inputs:(e,c)=>[group(e,c,'target','选择墓地的HERO',specialable(e,c.owner,grave(e,c.owner,m=>hero(m)&&m.id!=='hero-solid-soldier'),'revive'),1,1,{role:'special'})],resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='grave')e.special(c.owner,f.card.uid,{via:'revive',position:'defense'});}});
E.trigger('hero-liquid-soldier','revive',{label:'液态侠：复活低星HERO',once:once('one-effect'),inputs:(e,c)=>[group(e,c,'target','选择4星以下HERO',specialable(e,c.owner,grave(e,c.owner,m=>hero(m)&&m.id!=='hero-liquid-soldier'&&CARDS[m.id].level<=4),'revive'),1,1,{role:'special'})],resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='grave')e.special(c.owner,f.card.uid,{via:'revive'});}});
E.trigger('hero-liquid-soldier','material-draw',{label:'液态侠：抽2张再弃1张',zones:['grave','banished'],once:once('one-effect'),condition:(e,c)=>e.state.players[c.owner].deck.length>0,resolve:(e,c)=>e.queue({op:'draw-discard',owner:c.owner,count:2,source:c.source})});
E.trigger('hero-blazeman','poly-search',{label:'烈焰侠：检索融合',once:once('one-effect'),condition:(e,c)=>deck(e,c.owner,m=>m.id==='polymerization').length>0,resolve:(e,c)=>searchChoice(e,c,m=>m.id==='polymerization')});
E.register('hero-blazeman','copy',{label:'送墓元素英雄，复制攻守与属性',once:once('one-effect'),condition:(e,c)=>deck(e,c.owner,m=>elemental(m)&&m.id!=='hero-blazeman').length>0,
  resolve:(e,c)=>{
    const list=deck(e,c.owner,m=>elemental(m)&&m.id!=='hero-blazeman');
    if(list.length)e.queueChoice(c.owner,'选择送墓并复制的元素英雄',H.options(e,c,list),1,1,'blazeman-copy',{source:c.source,uid:c.uid,role:'send-deck'});
  },aiScore:400});
E.op('blazeman-copy',(e,t)=>{
  const f=e.find(t.picks[0]),actor=e.find(t.context.uid);if(!f||f.zone!=='deck')return;
  const d=CARDS[f.card.id];e.move(f.card.uid,'grave',{kind:'effect-send',source:t.context.source,byOwner:t.owner});e.shuffle(e.state.players[t.owner].deck);
  if(actor&&H.fieldZone(actor.zone)&&(actor.card.generation||0)===t.context.source.generation){
    e.modify(actor.card.uid,'atk','set',d.atk,e.state.turn,t.context.source);e.modify(actor.card.uid,'def','set',d.def,e.state.turn,t.context.source);
    actor.card.attributeOverride={value:d.attribute,until:e.state.turn};
  }e.addLock(t.owner,'fusion-only');
});
E.quick('hero-honest-neos','hand-boost',{label:'丢弃真诚新宇侠，HERO攻击力＋2500',zones:['hand'],once:once('hand-boost'),damageStep:true,inputs:(e,c)=>[group(e,c,'target','选择获得2500攻击力的HERO',[0,1].flatMap(p=>monsters(e,p,m=>m.faceUp&&hero(m))),1,1,{role:'own-boost'})],cost:(e,c)=>discard(e,c,[c.uid]),resolve:(e,c)=>e.modify(first(c),'atk','add',2500,e.state.turn,c.source),aiScore:()=>-100,aiResponse:(e,c,w)=>w.attack&&H.damageThreat(e,w,c.owner)>0?1100:w.attack&&w.attack.owner===c.owner?800:0});
E.quick('hero-honest-neos','field-boost',{label:'丢弃HERO，获得其攻击力',once:once('field-boost'),damageStep:true,inputs:(e,c)=>[group(e,c,'cost','选择丢弃的HERO',hand(e,c.owner,hero),1,1,{role:'cost'})],cost:(e,c)=>{c.discardedATK=CARDS[e.find(first(c,'cost')).card.id].atk||0;discard(e,c,args(c,'cost'));},resolve:(e,c)=>{const m=self(e,c);if(m)e.modify(m.uid,'atk','add',c.discardedATK,e.state.turn,c.source);},aiScore:()=>-100,aiResponse:(e,c,w)=>w.attack&&(w.attack.uid===c.uid||w.attack.target===c.uid)?800:0});
E.register('hero-bubbleman','special',{label:'仅此手牌，特殊召唤水泡侠',zones:['hand'],inherent:true,condition:(e,c)=>hand(e,c.owner).length===1&&e.canSpecial(c.owner,source(e,c).card)&&e.freeMain(c.owner)>0,resolve:(e,c)=>e.special(c.owner,c.uid,{via:'effect'}),aiScore:900});
E.trigger('hero-bubbleman','draw',{label:'水泡侠：抽2张',condition:(e,c)=>hand(e,c.owner).length===0&&e.field(c.owner).every(m=>m.uid===c.uid),resolve:(e,c)=>{if(hand(e,c.owner).length===0&&e.field(c.owner).every(m=>m.uid===c.uid))e.draw(c.owner,2);}});
E.spell('e-emergency-call',{label:'检索元素英雄',condition:(e,c)=>deck(e,c.owner,elemental).length>0,resolve:(e,c)=>searchChoice(e,c,elemental),aiScore:1100});
E.spell('a-hero-lives',{label:'支付一半LP，从卡组展开HERO',condition:(e,c)=>!monsters(e,c.owner,m=>m.faceUp).length&&e.state.players[c.owner].lp>1&&specialable(e,c.owner,deck(e,c.owner,m=>elemental(m)&&CARDS[m.id].level<=4)).length>0,cost:(e,c)=>e.payLP(c.owner,Math.floor(e.state.players[c.owner].lp/2)),resolve:(e,c)=>specialChoice(e,c,deck(e,c.owner,m=>elemental(m)&&CARDS[m.id].level<=4)),aiScore:1050});
E.spell('mask-change',{label:'假面变化',inputs:(e,c)=>[group(e,c,'target','选择变化的HERO',monsters(e,c.owner,m=>m.faceUp&&hero(m)&&e.state.players[c.owner].extra.some(x=>CARDS[x.id].masked&&CARDS[x.id].attribute===e.attribute(m)&&e.canSpecial(c.owner,x,{via:'mask'}))),1,1,{role:'mask-target'})],
  resolve:(e,c)=>{
    const f=H.legalTarget(e,c,first(c),(m,f)=>f.owner===c.owner&&H.fieldZone(f.zone)&&m.faceUp&&hero(m));if(!f)return;
    const attribute=e.attribute(f.card),result=e.move(f.card.uid,'grave',{kind:'effect-send',source:c.source,byOwner:c.owner});
    if(result.to!=='grave')return;
    const list=e.state.players[c.owner].extra.filter(m=>CARDS[m.id].masked&&CARDS[m.id].attribute===attribute&&e.canSpecial(c.owner,m,{via:'mask'})&&e.freeZones(c.owner,m).length);
    if(list.length)e.queueChoice(c.owner,'选择假面英雄',H.options(e,c,list),1,1,'special-selected',{source:c.source,via:'mask',role:'special'});
  },aiScore:(e,c)=>monsters(e,c.owner,m=>m.id==='hero-absolute-zero').length?1200:monsters(e,c.owner,m=>m.id==='hero-shadow-mist').length?1000:-100,
  aiResponse:(e,c,w)=>w.chainLast&&w.chainLast.owner!==c.owner?1100:w.attack&&w.attack.owner!==c.owner?1000:0});
E.trigger('hero-sunrise','search',{label:'日出侠：检索奇迹融合',once:once('search'),condition:(e,c)=>deck(e,c.owner,m=>m.id==='miracle-fusion').length>0,resolve:(e,c)=>searchChoice(e,c,m=>m.id==='miracle-fusion')});
E.trigger('hero-sunrise','battle-destroy',{label:'日出侠：破坏1张卡',once:once('battle-destroy'),inputs:(e,c)=>[group(e,c,'target','选择日出侠要破坏的卡',[0,1].flatMap(p=>e.field(p)),1,1,{role:'destroy'})],resolve:H.destroyTargets});
E.trigger('hero-absolute-zero','leave-wipe',{label:'绝对零度：破坏对方全部怪兽',zones:['grave','banished'],mandatory:true,resolve:(e,c)=>{for(const m of[...e.monsters(1-c.owner)])e.destroy(m.uid,c.source);}});
E.trigger('hero-the-shining','recover',{label:'闪光侠：回收除外的元素英雄',zones:['grave'],inputs:(e,c)=>[group(e,c,'target','选择最多2只元素英雄',H.cards(e,c.owner,['banished'],elemental),1,2,{role:'search'})],resolve:(e,c)=>{for(const uid of args(c)){const f=e.find(uid);if(f?.zone==='banished')e.move(uid,'hand',{kind:'effect-return',source:c.source,byOwner:c.owner});}}});
E.trigger('hero-great-tornado','halve',{label:'大龙卷：对方全体攻守减半',mandatory:true,resolve:(e,c)=>{for(const m of e.monsters(1-c.owner))if(m.faceUp){e.modify(m.uid,'atk','half',0,null,c.source);e.modify(m.uid,'def','half',0,null,c.source);}}});
E.trigger('hero-flame-wingman','burn',{label:'火焰翼侠：给予原本攻击力伤害',mandatory:true,resolve:(e,c)=>e.damage(1-c.owner,CARDS[c.event.victim.id].atk||0,'效果')});
E.trigger('masked-acid','wipe',{label:'酸水：清除后场并削弱攻击',mandatory:true,resolve:(e,c)=>{
  let destroyed=0;for(const s of[...e.spells(1-c.owner)])if(e.destroy(s.uid,c.source))destroyed++;
  if(destroyed)for(const m of e.monsters(1-c.owner))if(m.faceUp)e.modify(m.uid,'atk','add',-300,null,c.source);
}});
E.trigger('masked-dark-law','banish-hand',{label:'暗爪：随机除外1张对方手牌',once:once('banish-hand'),condition:(e,c)=>hand(e,1-c.owner).length>0,resolve:(e,c)=>{
  const list=hand(e,1-c.owner);if(list.length)e.move(list[Math.floor(e.random()*list.length)].uid,'banished',{kind:'effect-banish',source:c.source,byOwner:c.owner});
}});
E.on('summon',(e,v)=>{
  if(v.kind==='flip')return;const id=v.id,isNormal=v.kind==='normal';
  if(id==='hero-stratos')e.addTrigger(v.uid,id+'::entry',v);
  if(id==='hero-blazeman')e.addTrigger(v.uid,id+'::poly-search',v);
  if(id==='hero-solid-soldier'&&isNormal)e.addTrigger(v.uid,id+'::normal-special',v);
  if(id==='hero-liquid-soldier'&&isNormal)e.addTrigger(v.uid,id+'::revive',v);
  if(id==='hero-shadow-mist'&&!isNormal)e.addTrigger(v.uid,id+'::special-search',v);
  if(id==='hero-bubbleman')e.addTrigger(v.uid,id+'::draw',v);
  if(id==='hero-sunrise'&&!isNormal)e.addTrigger(v.uid,id+'::search',v);
  if(id==='hero-great-tornado'&&v.kind==='fusion')e.addTrigger(v.uid,id+'::halve',v,{mandatory:true});
  if(id==='masked-acid'&&!isNormal)e.addTrigger(v.uid,id+'::wipe',v,{mandatory:true});
});
E.on('move',(e,v)=>{
  if(v.id==='hero-shadow-mist'&&v.to==='grave')e.addTrigger(v.uid,v.id+'::grave-search',v);
  if(v.id==='hero-solid-soldier'&&v.to==='grave'&&H.fieldZone(v.from)&&v.source?.effectType==='spell'&&!String(v.kind).startsWith('cost'))e.addTrigger(v.uid,v.id+'::grave-revive',v);
  if(v.id==='hero-liquid-soldier'&&['grave','banished'].includes(v.to)&&v.kind==='fusion-material'&&CARDS[v.summoningId]?.family==='hero')e.addTrigger(v.uid,v.id+'::material-draw',v);
  if(v.id==='hero-absolute-zero'&&H.fieldZone(v.from)&&['grave','banished'].includes(v.to))e.addTrigger(v.uid,v.id+'::leave-wipe',v,{mandatory:true});
  if(v.id==='hero-the-shining'&&H.fieldZone(v.from)&&v.to==='grave')e.addTrigger(v.uid,v.id+'::recover',v);
});
E.on('attack',(e,v)=>{
  for(const owner of [0,1]){
    const participants=[e.find(v.uid),e.find(v.target)].filter(Boolean);
    if(participants.some(f=>f.owner===owner&&hero(f.card)&&f.card.id!=='hero-sunrise'))for(const m of monsters(e,owner,m=>m.id==='hero-sunrise'&&m.faceUp))e.addTrigger(m.uid,'hero-sunrise::battle-destroy',v,{owner});
  }
});
E.on('battle-win',(e,v)=>{if(v.id==='hero-flame-wingman'&&v.victimDestination==='grave'&&e.find(v.uid))e.addTrigger(v.uid,'hero-flame-wingman::burn',v,{mandatory:true});});
E.on('added',(e,v)=>{
  if(v.normalDraw||v.from!=='deck')return;
  const owner=1-v.owner;for(const m of monsters(e,owner,m=>m.id==='masked-dark-law'&&m.faceUp&&!e.negated(m)))e.addTrigger(m.uid,'masked-dark-law::banish-hand',v,{owner});
});
})(typeof globalThis!=='undefined'?globalThis:this);
