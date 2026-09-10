(function(root){ 'use strict'; const E=root.DuelEffects,D=root.DuelData,H=E.H;
const {CARDS,isMonster}=D;
const {source,self,first,args,group,deck,grave,hand,monsters,specialable,once}=H;
const blackwing=c=>isMonster(CARDS[c.id])&&CARDS[c.id].family==='blackwing';
for(const id of ['bw-bora','bw-gale','bw-kris']){
  E.register(id,'special',{label:'从手牌特殊召唤黑羽',zones:['hand'],inherent:true,once:id==='bw-kris'?once('hand-special'):null,
    condition:(e,c)=>monsters(e,c.owner,m=>m.faceUp&&blackwing(m)&&m.id!==c.sourceId).length>0&&e.canSpecial(c.owner,source(e,c).card)&&e.freeMain(c.owner)>0,
    resolve:(e,c)=>e.special(c.owner,c.uid,{via:'effect'}),aiScore:880});
}
E.register('bw-gale','halve',{label:'使对方怪兽攻守减半',once:once('halve','card'),inputs:(e,c)=>[group(e,c,'target','选择攻守减半的怪兽',monsters(e,1-c.owner,m=>m.faceUp),1,1,{role:'destroy'})],
  resolve:(e,c)=>{const f=H.legalTarget(e,c,first(c),(m,f)=>H.fieldZone(f.zone)&&m.faceUp);if(f){e.modify(f.card.uid,'atk','half',0,null,c.source);e.modify(f.card.uid,'def','half',0,null,c.source);}},aiScore:1050});
E.trigger('bw-blizzard','revive',{label:'极北：复活低星黑羽',inputs:(e,c)=>[group(e,c,'target','选择墓地4星以下黑羽',specialable(e,c.owner,grave(e,c.owner,m=>blackwing(m)&&CARDS[m.id].level<=4),'revive'),1,1,{role:'special'})],
  resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='grave')e.special(c.owner,f.card.uid,{via:'revive',position:'defense'});}});
E.trigger('bw-shura','recruit',{label:'苍炎：从卡组展开黑羽',condition:(e,c)=>specialable(e,c.owner,deck(e,c.owner,m=>blackwing(m)&&CARDS[m.id].atk<=1500)).length>0,
  resolve:(e,c)=>H.specialChoice(e,c,deck(e,c.owner,m=>blackwing(m)&&CARDS[m.id].atk<=1500),{negated:true})});
E.quick('bw-kalut','boost',{label:'丢弃月影，黑羽攻击力＋1400',zones:['hand'],main:false,damageStep:true,
  condition:(e,c)=>{const a=c.event.window?.attack;return !!a&&H.isDamageWindow(c.event.window)&&[e.find(a.uid),e.find(a.target)].some(f=>f&&f.owner===c.owner&&blackwing(f.card));},
  cost:(e,c)=>H.discard(e,c,[c.uid]),
  resolve:(e,c)=>{const a=e.state.frame?.attack;if(!a)return;const f=[e.find(a.uid),e.find(a.target)].find(f=>f&&f.owner===c.owner&&blackwing(f.card));if(f)e.modify(f.card.uid,'atk','add',1400,e.state.turn,c.source);},
  aiResponse:(e,c,w)=>H.damageThreat(e,w,c.owner)>0?1350:w.attack.owner===c.owner?850:0});
E.register('bw-zephyros','return',{label:'返回自己表侧卡，复活精锐',zones:['grave'],once:{key:'return',scope:'name',duel:true},
  condition:(e,c)=>e.canSpecial(c.owner,source(e,c).card)&&e.field(c.owner).some(m=>m.faceUp&&CARDS[m.id].type!=='token'&&(e.freeMain(c.owner)>0||e.find(m.uid).zone==='monsters')),
  inputs:(e,c)=>[group(e,c,'cost','选择返回手牌的表侧卡',e.field(c.owner).filter(m=>m.faceUp&&CARDS[m.id].type!=='token'&&(e.freeMain(c.owner)>0||e.find(m.uid).zone==='monsters')),1,1,{role:'cost'})],
  cost:(e,c)=>{for(const uid of args(c,'cost'))e.move(uid,'hand',{kind:'cost-return',source:c.source,byOwner:c.owner});},
  resolve:(e,c)=>{if(e.find(c.uid)?.zone==='grave'&&e.canSpecial(c.owner,e.find(c.uid).card)&&e.freeMain(c.owner)){e.special(c.owner,c.uid,{via:'revive'});e.damage(c.owner,400,'效果');}},aiScore:(e,c)=>e.state.players[c.owner].lp>400?720:-100});
E.spell('black-whirlwind',{label:'展开黑旋风',resolve:()=>{},aiScore:(e,c)=>!e.state.normalUsed?1500:300});
E.trigger('black-whirlwind','search',{label:'黑旋风：检索攻击力更低的黑羽',zones:['spells'],requiresField:true,
  condition:(e,c)=>{const f=e.find(c.event.uid);return f&&H.fieldZone(f.zone)&&f.card.faceUp&&deck(e,c.owner,m=>blackwing(m)&&CARDS[m.id].atk<e.attackValue(f.card)).length>0;},
  resolve:(e,c)=>{const f=e.find(c.event.uid);if(f&&H.fieldZone(f.zone)&&f.card.faceUp)H.searchChoice(e,c,m=>blackwing(m)&&CARDS[m.id].atk<e.attackValue(f.card),'黑旋风：选择攻击力更低的黑羽');}});
E.trap('icarus-attack',{label:'解放鸟兽，破坏2张卡',condition:(e,c)=>e.field(0).length+e.field(1).length-1>=2,
  inputs:(e,c)=>[
    group(e,c,'cost','选择解放的鸟兽族',monsters(e,c.owner,m=>CARDS[m.id].race==='鸟兽族'&&!CARDS[m.id].cannotTribute),1,1,{role:'cost'}),
    group(e,c,'target','选择要破坏的2张卡',[0,1].flatMap(p=>e.field(p)).filter(m=>!args(c,'cost').includes(m.uid)),2,2,{role:'destroy'})
  ],cost:(e,c)=>H.tributeCost(e,c,args(c,'cost')),resolve:H.destroyTargets,
  aiScore:(e,c)=>e.field(1-c.owner).length>=2?850:-100,aiResponse:(e,c,w)=>e.field(1-c.owner).length>=2?1250:0});
E.register('bw-armor-master','wedge',{label:'移除楔指示物，使对方攻守归零',condition:(e,c)=>monsters(e,1-c.owner,m=>m.faceUp&&(m.wedge||0)>0).length>0,
  cost:(e,c)=>{c.wedgeTargets=monsters(e,1-c.owner,m=>(m.wedge||0)>0).map(m=>({uid:m.uid,generation:m.generation||0}));for(const t of c.wedgeTargets)e.find(t.uid).card.wedge=0;},
  resolve:(e,c)=>{for(const t of c.wedgeTargets){const f=e.find(t.uid);if(f&&H.fieldZone(f.zone)&&(f.card.generation||0)===t.generation){e.modify(t.uid,'atk','set',0,e.state.turn,c.source);e.modify(t.uid,'def','set',0,e.state.turn,c.source);}}},aiScore:1000});
E.trigger('bw-nothung','weaken',{label:'苦剑鸟：800伤害并削弱怪兽',once:once('weaken'),mandatory:true,
  resolve:(e,c)=>{
    e.damage(1-c.owner,800,'效果');if(e.state.winner!==null)return;
    const list=monsters(e,1-c.owner,m=>m.faceUp);if(list.length)e.queueChoice(c.owner,'选择攻守下降800的怪兽',H.options(e,c,list),1,1,'nothung-weaken',{source:c.source,role:'destroy'});
  }});
E.op('nothung-weaken',(e,t)=>{for(const uid of t.picks){e.modify(uid,'atk','add',-800,null,t.context.source);e.modify(uid,'def','add',-800,null,t.context.source);}});
E.register('bw-raikiri','destroy',{label:'雷切：按其他黑羽数量破坏卡牌',once:once('destroy','card'),
  condition:(e,c)=>monsters(e,c.owner,m=>m.uid!==c.uid&&m.faceUp&&blackwing(m)).length>0,
  inputs:(e,c)=>[group(e,c,'target','选择要破坏的对方卡牌',e.field(1-c.owner),1,Math.min(e.field(1-c.owner).length,monsters(e,c.owner,m=>m.uid!==c.uid&&m.faceUp&&blackwing(m)).length),{role:'destroy'})],
  resolve:H.destroyTargets,aiScore:1250});
E.on('summon',(e,v)=>{
  if(v.kind==='normal'){
    if(v.id==='bw-blizzard')e.addTrigger(v.uid,'bw-blizzard::revive',v);
    if(blackwing({id:v.id}))for(const s of e.spells(v.owner))if(s.id==='black-whirlwind'&&e.activeSpell(s))e.addTrigger(s.uid,'black-whirlwind::search',v,{owner:v.owner,priority:30});
  }
  if(v.id==='bw-nothung'&&v.kind!=='normal'&&v.kind!=='flip')e.addTrigger(v.uid,'bw-nothung::weaken',v,{mandatory:true});
});
E.on('battle-win',(e,v)=>{if(v.id==='bw-shura'&&v.victimDestination==='grave'&&e.find(v.uid))e.addTrigger(v.uid,'bw-shura::recruit',v);});
})(typeof globalThis!=='undefined'?globalThis:this);
