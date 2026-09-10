(function(root){ 'use strict'; const E=root.DuelEffects,D=root.DuelData,H=E.H;
const {CARDS,isMonster}=D;
const {source,self,first,args,group,deck,grave,hand,monsters,normal,once}=H;
E.register('royal-library','draw',{label:'移除3个魔力指示物，抽1张卡',condition:(e,c)=>(source(e,c)?.card.counters||0)>=3&&e.state.players[c.owner].deck.length>0,cost:(e,c)=>{source(e,c).card.counters-=3;},resolve:(e,c)=>e.draw(c.owner,1),aiScore:1800});
for(const [id,stat]of[['sangan','atk'],['witch-forest','def']]){
  E.trigger(id,'search',{label:id==='sangan'?'三眼怪：检索低攻击力怪兽':'魔女：检索低守备力怪兽',zones:['grave'],once:once('search'),mandatory:true,
    condition:(e,c)=>deck(e,c.owner,m=>isMonster(CARDS[m.id])&&CARDS[m.id][stat]<=1500).length>0,
    resolve:(e,c)=>{const list=deck(e,c.owner,m=>isMonster(CARDS[m.id])&&CARDS[m.id][stat]<=1500);if(list.length)e.queueChoice(c.owner,'选择检索的怪兽（本回合同名效果不能发动）',H.options(e,c,list),1,1,'search-name-lock',{source:c.source,role:'search'});}});
}
E.op('search-name-lock',(e,t)=>{const f=e.find(t.picks[0]);if(!f||f.zone!=='deck')return;const id=f.card.id;e.search(t.owner,[f.card.uid]);(e.state.players[t.owner].nameLocks||=[]).push({id,turn:e.state.turn});});
E.trigger('battle-fader','stop',{label:'战斗消失者：特殊召唤并结束战斗',zones:['hand'],
  condition:(e,c)=>c.event.attack?.owner!==c.owner&&!c.event.attack?.target&&e.canSpecial(c.owner,source(e,c).card)&&e.freeMain(c.owner)>0,
  resolve:(e,c)=>{if(e.find(c.uid)?.zone==='hand'&&e.freeMain(c.owner)&&e.canSpecial(c.owner,e.find(c.uid).card)){e.special(c.owner,c.uid,{via:'effect',position:'defense',banishOnLeave:true});e.negateAttack(true);}},
  aiTrigger:(e,c)=>H.damageThreat(e,c.event.attack,c.owner)>0});
E.register('cardcar-d','draw',{label:'解放汽车，抽2张并进入结束阶段',wholeTurnNoSpecial:true,leavesAsCost:true,
  condition:(e,c)=>{const m=self(e,c);return !!m&&e.state.phase==='main1'&&m.summonKind==='normal'&&m.summonTurn===e.state.turn&&e.state.players[c.owner].deck.length>0;},
  cost:(e,c)=>H.tributeCost(e,c,[c.uid]),
  resolve:(e,c)=>{e.draw(c.owner,2);e.addLock(c.owner,'no-special');if(e.state.winner===null)e.state.frame={kind:'end',owner:c.owner,stage:0,windowOffered:true};},
  aiScore:(e,c)=>e.state.players[c.owner].deck.length>=2?300:-100});
E.spell('upstart-goblin',{label:'抽1张，对方回复1000LP',condition:(e,c)=>e.state.players[c.owner].deck.length>0,resolve:(e,c)=>{e.draw(c.owner,1);if(e.state.winner===null)e.heal(1-c.owner,1000);},aiScore:1400});
E.spell('dark-factory',{label:'回收墓地2只通常怪兽',inputs:(e,c)=>[group(e,c,'target','选择2只通常怪兽',grave(e,c.owner,normal),2,2,{role:'search'})],
  resolve:(e,c)=>{for(const uid of args(c)){const f=e.find(uid);if(f?.zone==='grave')e.move(uid,'hand',{kind:'effect-return',source:c.source,byOwner:c.owner});}},aiScore:1100});
E.spell('one-day-peace',{label:'双方抽卡，并进入短暂和平',
  resolve:(e,c)=>{
    const left=e.state.players[0].deck.length,right=e.state.players[1].deck.length;
    if(!left&&!right){e.finish('draw','双方都无法完成同时抽卡。');return;}
    if(!left){e.finish(1,'你的卡组已空，无法抽卡。');return;}
    if(!right){e.finish(0,'对方卡组已空，无法抽卡。');return;}
    e.draw(c.owner,1);e.draw(1-c.owner,1);
    for(const p of e.state.players)p.preventDamageUntil=Math.max(p.preventDamageUntil,e.state.turn+1);
  },aiScore:1250});
H.registerEquip('broken-bamboo',()=>true);H.registerEquip('cursed-bamboo',()=>true);
H.registerEquip('wonder-wand',c=>CARDS[c.id].race==='魔法师族');
E.spell('golden-bamboo',{label:'控制竹光装备，抽2张卡',condition:(e,c)=>e.state.players[c.owner].deck.length>0&&e.spells(c.owner).some(s=>e.activeSpell(s)&&CARDS[s.id].family==='bamboo'&&s.equipTarget),
  resolve:(e,c)=>e.draw(c.owner,2),aiScore:(e,c)=>e.state.players[c.owner].deck.length>=2?1600:-100});
E.register('cursed-bamboo','direct',{label:'返回另一张竹光，获得直接攻击',zones:['spells'],effectType:'spell',requiresField:true,once:once('direct'),
  condition:(e,c)=>!!e.find(source(e,c)?.card.equipTarget),
  inputs:(e,c)=>[group(e,c,'target','选择返回手牌的另一张竹光',e.spells(c.owner).filter(s=>s.uid!==c.uid&&s.faceUp&&CARDS[s.id].family==='bamboo'),1,1,{role:'bounce'})],
  resolve:(e,c)=>{const equipped=e.find(source(e,c)?.card.equipTarget),f=H.legalTarget(e,c,first(c));if(equipped&&f){e.move(f.card.uid,'hand',{kind:'effect-return',source:c.source,byOwner:c.owner});equipped.card.directAttackTurn=e.state.turn;}},aiScore:(e,c)=>{const m=e.find(source(e,c)?.card.equipTarget)?.card;return m&&e.attackValue(m)>0?100:-100;}});
E.trigger('cursed-bamboo','search',{label:'妖刀竹光：检索其他竹光',zones:['grave'],condition:(e,c)=>deck(e,c.owner,m=>CARDS[m.id].family==='bamboo'&&m.id!=='cursed-bamboo').length>0,
  resolve:(e,c)=>H.searchChoice(e,c,m=>CARDS[m.id].family==='bamboo'&&m.id!=='cursed-bamboo')});
E.register('wonder-wand','draw',{label:'魔杖与装备怪兽送墓，抽2张',zones:['spells'],effectType:'spell',leavesAsCost:true,
  condition:(e,c)=>{const s=source(e,c)?.card,m=e.find(s?.equipTarget);return !!m&&m.owner===c.owner&&H.fieldZone(m.zone)&&H.canSendGY(e,m.card)&&H.canSendGY(e,s)&&e.state.players[c.owner].deck.length>0;},
  cost:(e,c)=>{const target=source(e,c).card.equipTarget;c.costMonster=target;H.sendCost(e,c,[c.uid,target]);},
  resolve:(e,c)=>e.draw(c.owner,2),aiScore:(e,c)=>{const m=e.find(source(e,c)?.card.equipTarget)?.card;return m&&m.id!=='royal-library'&&e.state.players[c.owner].deck.length>=2?850:-100;}});
E.trap('reckless-greed',{label:'抽2张，跳过之后2次抽卡阶段',condition:(e,c)=>e.state.players[c.owner].deck.length>0,
  resolve:(e,c)=>{e.draw(c.owner,2);e.state.players[c.owner].skipDraws=Math.max(2,e.state.players[c.owner].skipDraws);},
  aiScore:(e,c)=>e.state.players[c.owner].deck.length>=2?1200:-100,aiResponse:(e,c)=>e.state.players[c.owner].deck.length>=2?1100:0});
E.on('move',(e,v)=>{
  if(v.to!=='grave')return;
  if(['sangan','witch-forest'].includes(v.id)&&H.fieldZone(v.from))e.addTrigger(v.uid,v.id+'::search',v,{mandatory:true});
  if(v.id==='cursed-bamboo')e.addTrigger(v.uid,'cursed-bamboo::search',v);
});
E.on('attack',(e,v)=>{if(v.target)return;const owner=1-v.owner;for(const c of hand(e,owner,m=>m.id==='battle-fader'))e.addTrigger(c.uid,'battle-fader::stop',v,{owner});});
})(typeof globalThis!=='undefined'?globalThis:this);
