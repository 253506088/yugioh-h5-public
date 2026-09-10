(function(root){ 'use strict'; const E=root.DuelEffects,D=root.DuelData,H=E.H;
const {CARDS,isMonster}=D;
const {source,self,first,args,group,deck,grave,hand,monsters,specialable,normal,once}=H;
const qliMonster=c=>isMonster(CARDS[c.id])&&CARDS[c.id].family==='qliphort';
const qliCard=c=>qliMonster(c)||c.id==='saqlifice';
E.register('qli-scout','search',{label:'支付800LP，检索机壳',zones:['spells'],effectType:'spell',once:once('search','card'),
  condition:(e,c)=>e.activeSpell(source(e,c)?.card)&&e.state.players[c.owner].lp>800&&deck(e,c.owner,m=>qliCard(m)&&m.id!=='qli-scout').length>0,
  cost:(e,c)=>e.payLP(c.owner,800),resolve:(e,c)=>H.searchChoice(e,c,m=>qliCard(m)&&m.id!=='qli-scout','侦察机：选择机壳卡'),aiScore:1500});
E.trigger('qli-monolith','draw',{label:'单体：按本回合解放数量抽卡',zones:['spells'],effectType:'spell',
  condition:(e,c)=>e.activeSpell(source(e,c)?.card)&&e.state.players[c.owner].turnStats.qliTributes>0,
  resolve:(e,c)=>e.draw(c.owner,e.state.players[c.owner].turnStats.qliTributes)});
E.trigger('qli-carrier','bounce',{label:'运载者被解放：返回1只怪兽',zones:['extra','grave','banished'],
  inputs:(e,c)=>[group(e,c,'target','选择返回手牌的怪兽',[0,1].flatMap(p=>e.monsters(p)),1,1,{role:'bounce'})],resolve:H.bounceTargets});
E.trigger('qli-helix','destroy',{label:'螺旋机被解放：破坏魔法／陷阱',zones:['extra','grave','banished'],
  inputs:(e,c)=>[group(e,c,'target','选择破坏的魔法／陷阱',[0,1].flatMap(p=>e.spells(p)),1,1,{role:'destroy'})],resolve:H.destroyTargets});
E.trigger('qli-disk','recruit',{label:'磁盘机：从卡组展开2只机壳',
  condition:(e,c)=>e.freeMain(c.owner)>=2&&specialable(e,c.owner,deck(e,c.owner,qliMonster)).length>=2,
  resolve:(e,c)=>{
    const list=specialable(e,c.owner,deck(e,c.owner,qliMonster));
    if(e.freeMain(c.owner)>=2&&list.length>=2)e.queueChoice(c.owner,'选择2只机壳（结束阶段破坏）',H.options(e,c,list),2,2,'qli-disk-recruit',{source:c.source,role:'special'});
  }});
E.op('qli-disk-recruit',(e,t)=>{
  for(const uid of t.picks){const f=e.find(uid);if(f?.zone==='deck'&&e.freeMain(t.owner)){const summoned=e.special(t.owner,uid,{via:'effect'});if(summoned)e.state.delayed.push({kind:'destroy',owner:t.owner,turn:e.state.turn,uid,generation:summoned.generation,source:t.context.source});}}
  e.shuffle(e.state.players[t.owner].deck);
});
E.trigger('qli-stealth','bounce',{label:'隐藏者：不可响应的返回手牌',unanswerableByOpponent:true,
  inputs:(e,c)=>[group(e,c,'target','选择返回手牌的场上卡',[0,1].flatMap(p=>e.field(p)),1,1,{role:'bounce'})],resolve:H.bounceTargets});
E.register('qli-towers','send',{label:'令对方选择1只怪兽送墓',once:once('send','card'),
  condition:(e,c)=>H.monsterCards(e,1-c.owner,['hand','monsters','extraMonster']).length>0,
  resolve:(e,c)=>{
    const owner=1-c.owner,list=H.monsterCards(e,owner,['hand','monsters','extraMonster']);
    if(list.length)e.queueChoice(owner,'隐藏的机壳 杀手：选择自己1只怪兽送墓',list.map(m=>e.option(m,{viewer:owner})),1,1,'towers-send',{source:c.source,role:'discard'});
  },aiScore:1250});
E.op('towers-send',(e,t)=>{const f=e.find(t.picks[0]);if(f&&f.owner===t.owner&&['hand','monsters','extraMonster'].includes(f.zone))e.move(f.card.uid,'grave',{kind:'effect-player-send',source:t.context.source,byOwner:t.context.source.owner});});
function equip(id,filter){
  E.spell(id,{label:'装备魔法',inputs:(e,c)=>[group(e,c,'target','选择装备对象',[0,1].flatMap(p=>monsters(e,p,m=>m.faceUp&&filter(m))),1,1,{role:'own-boost'})],
    resolve:(e,c)=>{
      const spell=source(e,c),target=H.legalTarget(e,c,first(c),(m,f)=>H.fieldZone(f.zone)&&m.faceUp&&filter(m));
      if(spell&&['spells','fieldSpell'].includes(spell.zone)&&target)spell.card.equipTarget=target.card.uid;
      else if(spell&&['spells','fieldSpell'].includes(spell.zone))e.move(spell.card.uid,'grave',{kind:'rule-equip',reason:'装备对象失效'});
    },aiScore:550});
}
H.registerEquip=equip;
equip('saqlifice',qliMonster);
E.trigger('saqlifice','search',{label:'牲祭送墓：检索机壳',zones:['grave'],condition:(e,c)=>deck(e,c.owner,qliMonster).length>0,resolve:(e,c)=>H.searchChoice(e,c,qliMonster)});
E.spell('summoners-art',{label:'检索高星通常怪兽',condition:(e,c)=>deck(e,c.owner,m=>normal(m)&&CARDS[m.id].level>=5).length>0,resolve:(e,c)=>H.searchChoice(e,c,m=>normal(m)&&CARDS[m.id].level>=5),aiScore:1400});
E.spell('wavering-eyes',{label:'破坏灵摆区，依数量处理效果',
  condition:e=>[0,1].some(p=>e.scales(p).some(Boolean)),
  resolve:(e,c)=>{
    let n=0;const scales=[0,1].flatMap(p=>e.scales(p).filter(Boolean).map(s=>s.card));
    for(const scale of scales)if(e.destroy(scale.uid,c.source))n++;
    e.log('effect','摇晃的目光破坏了'+n+'张灵摆区卡牌',c.owner);
    if(n>=1)e.damage(1-c.owner,500,'效果');
    if(e.state.winner!==null)return;
    if(n>=2)H.searchChoice(e,c,m=>CARDS[m.id].type==='pendulum','选择检索的灵摆怪兽');
    if(n>=3){const list=[0,1].flatMap(p=>e.field(p));if(list.length)e.queueChoice(c.owner,'选择除外1张场上卡',H.options(e,c,list),1,1,'banish-selected',{source:c.source,role:'banish'});}
    if(n>=4)H.searchChoice(e,c,m=>m.id==='wavering-eyes','检索另一张摇晃的目光');
  },aiScore:(e,c)=>e.scales(1-c.owner).filter(Boolean).length?1200:-100,
  aiResponse:(e,c,w)=>e.scales(1-c.owner).filter(Boolean).length>=1&&w.chainLast?.owner!==c.owner?1000:0});
E.on('summon',(e,v)=>{
  if(v.kind!=='normal')return;const card=e.find(v.uid)?.card;if(!card?.tributedQli)return;
  if(v.id==='qli-disk')e.addTrigger(v.uid,'qli-disk::recruit',v);
  if(v.id==='qli-stealth')e.addTrigger(v.uid,'qli-stealth::bounce',v);
});
E.on('move',(e,v)=>{
  if(['tribute','cost-tribute'].includes(v.kind)){
    if(v.id==='qli-carrier')e.addTrigger(v.uid,'qli-carrier::bounce',v);
    if(v.id==='qli-helix')e.addTrigger(v.uid,'qli-helix::destroy',v);
  }
  if(v.id==='saqlifice'&&['spells','fieldSpell'].includes(v.from)&&v.to==='grave')e.addTrigger(v.uid,'saqlifice::search',v);
});
E.on('end-phase',(e,v)=>{for(const s of e.spells(v.owner))if(s.id==='qli-monolith'&&e.activeSpell(s))e.addTrigger(s.uid,'qli-monolith::draw',v,{owner:v.owner,priority:10});});
})(typeof globalThis!=='undefined'?globalThis:this);
