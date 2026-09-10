(function(root){ 'use strict'; const E=root.DuelEffects,D=root.DuelData,H=E.H;
const {CARDS,isMonster}=D;
const {source,self,first,args,group,deck,grave,hand,monsters,specialable,once}=H;
const cryMonster=c=>isMonster(CARDS[c.id])&&CARDS[c.id].crystron;
const cryCard=c=>CARDS[c.id].crystron;
const cryTuner=c=>cryMonster(c)&&CARDS[c.id].tuner;
E.register('cry-sulfefnir','special',{label:'丢弃水晶机巧，特殊召唤并破坏己方卡',zones:['hand','grave'],once:once('special'),
  condition:(e,c)=>e.canSpecial(c.owner,source(e,c).card)&&e.freeMain(c.owner)>0,
  inputs:(e,c)=>[group(e,c,'cost','选择丢弃的其他水晶机巧',hand(e,c.owner,m=>cryCard(m)&&m.id!=='cry-sulfefnir'),1,1,{role:'cost'})],
  cost:(e,c)=>H.discard(e,c,args(c,'cost')),
  resolve:(e,c)=>{
    const f=source(e,c);if(!f||!['hand','grave'].includes(f.zone)||!e.canSpecial(c.owner,f.card)||!e.freeMain(c.owner))return;
    e.special(c.owner,c.uid,{via:'effect',position:'defense'});
    const list=e.field(c.owner);if(list.length)e.queueChoice(c.owner,'硫黄石英：破坏自己1张卡',H.options(e,c,list),1,1,'destroy-selected',{source:c.source,role:'self-destroy',sourceId:c.sourceId});
  },aiScore:1200});
E.trigger('cry-sulfefnir','recruit',{label:'硫黄石英：从卡组展开水晶机巧',zones:['grave','banished'],once:once('recruit'),
  condition:(e,c)=>specialable(e,c.owner,deck(e,c.owner,cryMonster)).length>0,
  resolve:(e,c)=>H.specialChoice(e,c,deck(e,c.owner,cryMonster),{position:'defense'})});
for(const id of ['cry-thystvern','cry-smiger','cry-rosenix','cry-prasiortle']){
  E.register(id,'tuner',{label:'破坏自己表侧卡，展开水晶机巧调整',once:once('one-effect'),
    condition:(e,c)=>deck(e,c.owner,m=>cryTuner(m)&&e.canSpecial(c.owner,m)).length>0,
    inputs:(e,c)=>[group(e,c,'target','选择破坏的己方表侧卡',e.field(c.owner).filter(m=>m.faceUp&&(e.freeMain(c.owner)>0||e.find(m.uid).zone==='monsters')),1,1,{role:'self-destroy'})],
    resolve:(e,c)=>{
      e.addLock(c.owner,'machine-synchro');
      const f=H.legalTarget(e,c,first(c),m=>m.faceUp);if(f&&e.destroy(f.card.uid,c.source))H.specialChoice(e,c,deck(e,c.owner,cryTuner));
    },aiScore:(e,c)=>monsters(e,c.owner,m=>m.faceUp&&CARDS[m.id].tuner).length?350:1050});
}
E.register('cry-thystvern','search',{label:'除外紫晶龙，检索水晶机巧怪兽',zones:['grave'],once:once('one-effect'),
  condition:(e,c)=>deck(e,c.owner,m=>cryMonster(m)&&m.id!==c.sourceId).length>0,
  cost:(e,c)=>e.move(c.uid,'banished',{kind:'cost-banish',source:c.source,byOwner:c.owner}),
  resolve:(e,c)=>H.searchChoice(e,c,m=>cryMonster(m)&&m.id!=='cry-thystvern'),aiScore:1150});
E.register('cry-smiger','search',{label:'除外烟晶虎，检索水晶机巧魔陷',zones:['grave'],once:once('one-effect'),
  condition:(e,c)=>deck(e,c.owner,m=>cryCard(m)&&['spell','trap'].includes(CARDS[m.id].type)).length>0,
  cost:(e,c)=>e.move(c.uid,'banished',{kind:'cost-banish',source:c.source,byOwner:c.owner}),
  resolve:(e,c)=>H.searchChoice(e,c,m=>cryCard(m)&&['spell','trap'].includes(CARDS[m.id].type)),aiScore:900});
E.register('cry-rosenix','token',{label:'除外玫晶鸳，产生1星衍生物',zones:['grave'],once:once('one-effect'),
  condition:(e,c)=>e.freeMain(c.owner)>0&&e.canSpecial(c.owner,{id:'cry-token',uid:'preview-token'}),
  cost:(e,c)=>e.move(c.uid,'banished',{kind:'cost-banish',source:c.source,byOwner:c.owner}),resolve:(e,c)=>e.createTokens(c.owner,'cry-token',1),aiScore:750});
E.register('cry-prasiortle','special',{label:'除外绿晶龟，展开手牌水晶机巧',zones:['grave'],once:once('one-effect'),
  condition:(e,c)=>specialable(e,c.owner,hand(e,c.owner,cryMonster)).length>0,
  cost:(e,c)=>e.move(c.uid,'banished',{kind:'cost-banish',source:c.source,byOwner:c.owner}),
  resolve:(e,c)=>H.specialChoice(e,c,hand(e,c.owner,cryMonster)),aiScore:950});
function pairTargets(e,c,zone){
  const actor=source(e,c)?.card;if(!actor||e.freeMain(c.owner)<1)return [];
  return H.cards(e,c.owner,[zone],m=>isMonster(CARDS[m.id])&&!CARDS[m.id].tuner&&CARDS[m.id].type!=='xyz'&&e.canSpecial(c.owner,m,{via:'revive'})).filter(m=>
    e.state.players[c.owner].extra.some(x=>CARDS[x.id].type==='synchro'&&CARDS[x.id].race==='机械族'&&e.synchroValid(c.owner,x,[actor,m],{virtual:true}))
  );
}
for(const [id,zone,destination]of[['cry-citree','grave','banished'],['cry-quan','hand','grave'],['cry-rion','banished','deck']]){
  E.quick(id,'quick-synchro',{label:'对方回合：复活／展开后立即同调',main:false,once:once('quick-synchro'),
    condition:(e,c)=>c.owner!==e.state.active&&['main1','main2','battle'].includes(e.state.phase)&&pairTargets(e,c,zone).length>0,
    inputs:zone==='hand'?undefined:(e,c)=>[group(e,c,'target','选择非调整素材',pairTargets(e,c,zone),1,1,{role:'special'})],
    resolve:(e,c)=>{
      if(zone==='hand'){
        const list=pairTargets(e,c,zone);if(list.length)e.queueChoice(c.owner,'选择从手牌登场的非调整',H.options(e,c,list),1,1,'cry-pair-special',{source:c.source,zone,destination,role:'special'});
      }else E.operation(e,{op:'cry-pair-special',owner:c.owner,picks:args(c),context:{source:c.source,zone,destination}});
    },
    aiResponse:(e,c,w)=>w.attack||w.kind==='battle-open'?1800:w.chainLast&&w.chainLast.owner!==c.owner&&E.willDestroy(e,w.chainLast)?2000:0
  });
}
E.op('cry-pair-special',(e,t)=>{
  const chosen=e.find(t.picks[0]);if(!chosen||chosen.zone!==t.context.zone||!e.canSpecial(t.owner,chosen.card,{via:'revive'})||!e.freeMain(t.owner))return;
  const summoned=e.special(t.owner,chosen.card.uid,{via:t.context.zone==='hand'?'effect':'revive',negated:true});
  if(!summoned)return;
  const actor=e.find(t.context.source.uid);
  if(!actor||!H.fieldZone(actor.zone)||(actor.card.generation||0)!==t.context.source.generation)return;
  const list=e.state.players[t.owner].extra.filter(x=>CARDS[x.id].type==='synchro'&&CARDS[x.id].race==='机械族'&&e.synchroValid(t.owner,x,[actor.card,summoned]));
  if(list.length)e.queueChoice(t.owner,'立即同调召唤机械族怪兽',list.map(c=>e.option(c,{viewer:t.owner})),1,1,'cry-pair-synchro',{source:t.context.source,materials:[actor.card.uid,summoned.uid],destination:t.context.destination,role:'special'});
});
E.op('cry-pair-synchro',(e,t)=>{
  const f=e.find(t.picks[0]);if(!f||f.zone!=='extra')return;
  e.performSynchro(t.owner,f.card.uid,t.context.materials,{source:t.context.source,materialDestination:t.context.destination});
});
E.trigger('scrap-recycler','dump',{label:'废铁回收员：将机械族送墓',condition:(e,c)=>deck(e,c.owner,m=>isMonster(CARDS[m.id])&&CARDS[m.id].race==='机械族').length>0,
  resolve:(e,c)=>{const list=deck(e,c.owner,m=>isMonster(CARDS[m.id])&&CARDS[m.id].race==='机械族');if(list.length)e.queueChoice(c.owner,'选择送墓的机械族',H.options(e,c,list),1,1,'send-deck-selected',{source:c.source,role:'send-deck'});}});
E.op('send-deck-selected',(e,t)=>{for(const uid of t.picks){const f=e.find(uid);if(f?.zone==='deck')e.move(uid,'grave',{kind:'effect-send',source:t.context.source,byOwner:t.owner});}e.shuffle(e.state.players[t.owner].deck);});
E.register('scrap-recycler','recycle',{label:'洗回2只地属性4星机械，抽1张',once:once('recycle','card'),
  inputs:(e,c)=>[group(e,c,'cost','选择洗回卡组的机械族',grave(e,c.owner,m=>CARDS[m.id].race==='机械族'&&CARDS[m.id].attribute==='地'&&CARDS[m.id].level===4),2,2,{role:'cost'})],
  cost:(e,c)=>{for(const uid of args(c,'cost'))e.move(uid,'deck',{kind:'cost-return',source:c.source,byOwner:c.owner});e.shuffle(e.state.players[c.owner].deck);},resolve:(e,c)=>e.draw(c.owner,1),aiScore:550});
E.spell('crystolic-potential',{label:'展开水晶机巧潜能',resolve:()=>{},aiScore:(e,c)=>e.state.players[c.owner].fieldSpell?.id==='crystolic-potential'?-100:1000});
E.trigger('crystolic-potential','draw',{label:'潜能：按本回合水晶同调数量抽卡',zones:['fieldSpell'],requiresField:true,
  condition:(e,c)=>e.state.players[c.owner].turnStats.crySynchros>0,resolve:(e,c)=>e.draw(c.owner,e.state.players[c.owner].turnStats.crySynchros)});
E.trap('cry-impact',{label:'复活除外的水晶机巧，对方守备归零',once:once('cast'),
  inputs:(e,c)=>[group(e,c,'target','选择除外的水晶机巧',specialable(e,c.owner,H.cards(e,c.owner,['banished'],cryMonster),'revive'),1,1,{role:'special'})],
  resolve:(e,c)=>{
    const f=e.find(first(c));if(f?.zone!=='banished'||!e.canSpecial(c.owner,f.card,{via:'revive'})||!e.freeMain(c.owner))return;
    e.special(c.owner,f.card.uid,{via:'revive'});for(const m of e.monsters(1-c.owner))if(m.faceUp)e.modify(m.uid,'def','set',0,null,c.source);
  },aiScore:950,aiResponse:(e,c,w)=>w.attack&&w.attack.owner!==c.owner?1300:0});
E.quick('cry-impact','negate',{label:'除外墓地冲击，保护被取对象的水晶机巧',zones:['grave'],effectType:'trap',main:false,once:once('negate'),
  condition:(e,c)=>{
    if(source(e,c).card.sentTurn>=e.state.turn)return false;
    const last=c.event.window?.chainLast;if(!last)return false;
    return (last.args.target||[]).some(uid=>{const f=e.find(uid);return f&&f.owner===c.owner&&H.fieldZone(f.zone)&&cryMonster(f.card);});
  },cost:(e,c)=>e.move(c.uid,'banished',{kind:'cost-banish',source:c.source,byOwner:c.owner}),
  resolve:(e,c)=>e.negateLink(c.responseTo,c.source,false,false),aiResponse:(e,c,w)=>w.chainLast?.owner!==c.owner?2300:0});
E.trap('cry-entry',{label:'从手牌和墓地各展开1只水晶调整',once:once('cast'),
  condition:(e,c)=>e.freeMain(c.owner)>=2&&specialable(e,c.owner,hand(e,c.owner,cryTuner)).length>0&&specialable(e,c.owner,grave(e,c.owner,cryTuner),'revive').length>0,
  resolve:(e,c)=>{const list=specialable(e,c.owner,hand(e,c.owner,cryTuner));if(list.length&&e.freeMain(c.owner)>=2)e.queueChoice(c.owner,'选择手牌中的水晶调整',H.options(e,c,list),1,1,'cry-entry-hand',{source:c.source,role:'special'});},
  aiScore:800,aiResponse:(e,c,w)=>w.kind==='main-open'&&e.monsters(c.owner).length<=2?700:0});
E.op('cry-entry-hand',(e,t)=>{
  const list=specialable(e,t.owner,grave(e,t.owner,cryTuner),'revive');if(list.length)e.queueChoice(t.owner,'选择墓地中的水晶调整',list.map(c=>e.option(c,{viewer:t.owner})),1,1,'cry-entry-pair',{source:t.context.source,handUid:t.picks[0],role:'special'});
});
E.op('cry-entry-pair',(e,t)=>{
  const h=e.find(t.context.handUid),g=e.find(t.picks[0]);if(!h||h.zone!=='hand'||!g||g.zone!=='grave'||e.freeMain(t.owner)<2)return;
  if(e.canSpecial(t.owner,h.card)&&e.canSpecial(t.owner,g.card,{via:'revive'})){e.special(t.owner,h.card.uid,{via:'effect'});e.special(t.owner,g.card.uid,{via:'revive'});}
});
E.quick('cry-entry','level',{label:'除外入场，送墓水晶机巧并调整等级',zones:['grave'],effectType:'trap',once:once('level'),
  condition:(e,c)=>source(e,c).card.sentTurn<e.state.turn,
  inputs:(e,c)=>[group(e,c,'target','选择要调整等级的水晶机巧',monsters(e,c.owner,m=>m.faceUp&&cryMonster(m)&&e.level(m)>0&&deck(e,c.owner,x=>cryMonster(x)&&CARDS[x.id].level!==e.level(m)).length>0),1,1,{role:'own-boost'})],
  cost:(e,c)=>e.move(c.uid,'banished',{kind:'cost-banish',source:c.source,byOwner:c.owner}),
  resolve:(e,c)=>{const f=H.legalTarget(e,c,first(c),(m,f)=>H.fieldZone(f.zone)&&m.faceUp);if(!f)return;const list=deck(e,c.owner,m=>cryMonster(m)&&CARDS[m.id].level!==e.level(f.card));if(list.length)e.queueChoice(c.owner,'选择不同等级的水晶机巧送墓',H.options(e,c,list),1,1,'cry-entry-level',{source:c.source,target:f.card.uid,role:'send-deck'});},
  aiScore:()=>-100,aiResponse:()=>0});
E.op('cry-entry-level',(e,t)=>{
  const f=e.find(t.picks[0]),target=e.find(t.context.target);if(!f||f.zone!=='deck'||!target||!H.fieldZone(target.zone))return;
  const level=CARDS[f.card.id].level,result=e.move(f.card.uid,'grave',{kind:'effect-send',source:t.context.source,byOwner:t.owner});e.shuffle(e.state.players[t.owner].deck);
  if(result.to==='grave'&&!e.unaffected(target.card,t.context.source))target.card.levelOverride={value:level};
});
E.trigger('cry-ametrix','defense',{label:'紫黄晶：对方特殊召唤怪兽变为守备',resolve:(e,c)=>{for(const m of e.monsters(1-c.owner))if(m.faceUp&&CARDS[m.id].type!=='link'&&m.summonKind&&!['normal','set','flip'].includes(m.summonKind)&&!e.unaffected(m,c.source)){m.position='defense';m.changedTurn=e.state.turn;}}});
H.registerQuickSynchro('cry-quandax',true);
E.trigger('cry-phoenix','banish',{label:'凤凰：除外对方场上及墓地全部魔陷',mandatory:true,
  resolve:(e,c)=>{
    for(const m of [...e.spells(1-c.owner),...grave(e,1-c.owner,m=>['spell','trap'].includes(CARDS[m.id].type))]){
      const f=e.find(m.uid);if(f&&!e.unaffected(f.card,c.source))e.move(m.uid,'banished',{kind:'effect-banish',source:c.source,byOwner:c.owner});
    }
  }});
E.trigger('cry-quariongandrax','banish',{label:'中枢大蛇：按素材数除外对方怪兽',
  inputs:(e,c)=>[group(e,c,'target','选择除外的场上或墓地怪兽',[...e.monsters(1-c.owner),...grave(e,1-c.owner,m=>isMonster(CARDS[m.id]))],1,Math.min(c.event.materials.length,e.monsters(1-c.owner).length+grave(e,1-c.owner,m=>isMonster(CARDS[m.id])).length),{role:'banish'})],
  resolve:H.banishTargets});
for(const id of ['cry-ametrix','cry-quandax']){
  E.trigger(id,'revive',{label:'水晶同调被破坏：复活非同调水晶机巧',zones:['grave','banished'],
    inputs:(e,c)=>[group(e,c,'target','选择墓地的水晶机巧',specialable(e,c.owner,grave(e,c.owner,m=>cryMonster(m)&&CARDS[m.id].type!=='synchro'),'revive'),1,1,{role:'special'})],
    resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='grave')e.special(c.owner,f.card.uid,{via:'revive'});}});
}
E.trigger('cry-phoenix','revive',{label:'凤凰被破坏：复活墓地怪兽',zones:['grave','banished'],
  inputs:(e,c)=>[group(e,c,'target','选择复活的怪兽',specialable(e,c.owner,grave(e,c.owner,m=>isMonster(CARDS[m.id])&&m.uid!==c.uid),'revive'),1,1,{role:'special'})],
  resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='grave')e.special(c.owner,f.card.uid,{via:'revive'});}});
E.trigger('cry-quariongandrax','revive',{label:'中枢大蛇被破坏：特殊召唤除外怪兽',zones:['grave','banished'],
  inputs:(e,c)=>[group(e,c,'target','选择双方除外区的怪兽',[0,1].flatMap(p=>specialable(e,c.owner,H.cards(e,p,['banished'],m=>isMonster(CARDS[m.id])&&m.uid!==c.uid),'revive')),1,1,{role:'special'})],
  resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='banished')e.special(c.owner,f.card.uid,{via:'revive'});}});
E.trigger('samurai-destroyer','revive',{label:'武士破坏王离场：复活机械族',zones:['grave','banished'],
  inputs:(e,c)=>[group(e,c,'target','选择墓地机械族',specialable(e,c.owner,grave(e,c.owner,m=>isMonster(CARDS[m.id])&&CARDS[m.id].race==='机械族'),'revive'),1,1,{role:'special'})],
  resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='grave')e.special(c.owner,f.card.uid,{via:'revive'});}});
E.trigger('powered-inzektron','protect',{label:'强力独角仙：本回合免伤与破坏保护',mandatory:true,
  resolve:(e,c)=>{const m=self(e,c);if(m){m.effectProtectedUntil=e.state.turn;m.battleProtectedUntil=e.state.turn;}e.state.players[c.owner].preventDamageUntil=Math.max(e.state.players[c.owner].preventDamageUntil,e.state.turn);}});
E.on('summon',(e,v)=>{
  if(v.id==='scrap-recycler'&&v.kind!=='flip')e.addTrigger(v.uid,'scrap-recycler::dump',v);
  if(v.kind==='synchro'){
    const modes={'cry-ametrix':'defense','cry-phoenix':'banish','cry-quariongandrax':'banish','powered-inzektron':'protect'};
    if(modes[v.id])e.addTrigger(v.uid,v.id+'::'+modes[v.id],v,{mandatory:['cry-phoenix','powered-inzektron'].includes(v.id)});
  }
});
E.on('move',(e,v)=>{
  if(!H.fieldZone(v.from))return;
  if(v.id==='cry-sulfefnir'&&['battle','destroy'].includes(v.kind))e.addTrigger(v.uid,'cry-sulfefnir::recruit',v);
  if(['cry-ametrix','cry-quandax','cry-phoenix','cry-quariongandrax'].includes(v.id)&&v.previous.summonKind==='synchro'&&['battle','destroy'].includes(v.kind))e.addTrigger(v.uid,v.id+'::revive',v);
  if(v.id==='samurai-destroyer'&&v.previous.faceUp&&v.previous.owner===v.previous.originalOwner&&v.source&&v.byOwner!==v.previous.owner&&!String(v.kind).startsWith('cost')&&v.kind!=='battle')e.addTrigger(v.uid,'samurai-destroyer::revive',v);
});
E.on('end-phase',(e,v)=>{for(const owner of[0,1]){const f=e.state.players[owner].fieldSpell;if(f?.id==='crystolic-potential'&&e.activeSpell(f))e.addTrigger(f.uid,'crystolic-potential::draw',v,{owner,priority:10});}});
})(typeof globalThis!=='undefined'?globalThis:this);
