(function(root){ 'use strict'; const E=root.DuelEffects,D=root.DuelData,H=E.H;
const {CARDS,isMonster}=D;
const {source,self,first,args,group,deck,grave,hand,monsters,specialable,once}=H;
E.trigger('junk-synchron','revive',{label:'废品同调士：复活2星以下怪兽',inputs:(e,c)=>[group(e,c,'target','选择墓地2星以下怪兽',specialable(e,c.owner,grave(e,c.owner,m=>isMonster(CARDS[m.id])&&CARDS[m.id].level<=2),'revive'),1,1,{role:'special'})],
  resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='grave')e.special(c.owner,f.card.uid,{via:'revive',position:'defense',negated:true});}});
E.register('junk-converter','search',{label:'丢弃转换者与调整，检索同调士',zones:['hand'],once:once('search'),
  condition:(e,c)=>deck(e,c.owner,m=>CARDS[m.id].family==='synchron').length>0,
  inputs:(e,c)=>[group(e,c,'cost','选择一起丢弃的调整',hand(e,c.owner,m=>m.uid!==c.uid&&CARDS[m.id].tuner),1,1,{role:'cost'})],
  cost:(e,c)=>H.discard(e,c,[c.uid,...args(c,'cost')]),resolve:(e,c)=>H.searchChoice(e,c,m=>CARDS[m.id].family==='synchron'),aiScore:1250});
E.trigger('junk-converter','revive',{label:'转换者：复活调整',zones:['grave'],once:once('revive'),inputs:(e,c)=>[group(e,c,'target','选择墓地的调整',specialable(e,c.owner,grave(e,c.owner,m=>CARDS[m.id].tuner),'revive'),1,1,{role:'special'})],resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='grave')e.special(c.owner,f.card.uid,{via:'revive',position:'defense',cannotActivate:true});}});
E.trigger('doppelwarrior','special',{label:'二重身战士：从手牌展开',zones:['hand'],condition:(e,c)=>e.freeMain(c.owner)>0&&e.canSpecial(c.owner,source(e,c).card),resolve:(e,c)=>{if(e.find(c.uid)?.zone==='hand')e.special(c.owner,c.uid,{via:'effect'});}});
E.trigger('doppelwarrior','tokens',{label:'二重身：产生2只衍生物',zones:['grave'],condition:(e,c)=>e.freeMain(c.owner)>=2,resolve:(e,c)=>e.createTokens(c.owner,'doppel-token',2)});
E.register('quillbolt','revive',{label:'控制调整，复活螺丝刺猬',zones:['grave'],condition:(e,c)=>monsters(e,c.owner,m=>m.faceUp&&e.isTuner(m)).length>0&&e.canSpecial(c.owner,source(e,c).card)&&e.freeMain(c.owner)>0,
  resolve:(e,c)=>e.special(c.owner,c.uid,{via:'revive',banishOnLeave:true}),aiScore:850});
E.register('jet-synchron','revive',{label:'手牌送墓，复活喷气同调士',zones:['grave'],once:once('one-effect'),
  inputs:(e,c)=>[group(e,c,'cost','选择送去墓地的手牌',hand(e,c.owner,m=>H.canSendGY(e,m)),1,1,{role:'send-cost'})],
  condition:(e,c)=>e.canSpecial(c.owner,source(e,c).card)&&e.freeMain(c.owner)>0,
  cost:(e,c)=>H.sendCost(e,c,args(c,'cost')),resolve:(e,c)=>e.special(c.owner,c.uid,{via:'revive',banishOnLeave:true}),aiScore:800});
E.trigger('jet-synchron','search',{label:'喷气同调士：检索废品怪兽',zones:['grave'],once:once('one-effect'),condition:(e,c)=>deck(e,c.owner,m=>!!CARDS[m.id].junk).length>0,resolve:(e,c)=>H.searchChoice(e,c,m=>!!CARDS[m.id].junk)});
E.register('quickdraw-synchron','special',{label:'手牌怪兽送墓，特殊召唤速攻同调士',zones:['hand'],inherent:true,condition:(e,c)=>e.canSpecial(c.owner,source(e,c).card)&&e.freeMain(c.owner)>0,
  inputs:(e,c)=>[group(e,c,'cost','选择送去墓地的其他怪兽',hand(e,c.owner,m=>m.uid!==c.uid&&isMonster(CARDS[m.id])&&H.canSendGY(e,m)),1,1,{role:'send-cost'})],
  cost:(e,c)=>H.sendCost(e,c,args(c,'cost')),resolve:(e,c)=>e.special(c.owner,c.uid,{via:'effect'}),aiScore:680});
E.trigger('fleur-synchron','special',{label:'花之同调士：展开低星手牌',zones:['grave'],condition:(e,c)=>specialable(e,c.owner,hand(e,c.owner,m=>isMonster(CARDS[m.id])&&CARDS[m.id].level<=2)).length>0,resolve:(e,c)=>H.specialChoice(e,c,hand(e,c.owner,m=>isMonster(CARDS[m.id])&&CARDS[m.id].level<=2))});
E.spell('tuning',{label:'检索同调士调整，再送墓卡组顶',condition:(e,c)=>deck(e,c.owner,m=>CARDS[m.id].family==='synchron'&&CARDS[m.id].tuner).length>0,
  resolve:(e,c)=>{const list=deck(e,c.owner,m=>CARDS[m.id].family==='synchron'&&CARDS[m.id].tuner);if(list.length)e.queueChoice(c.owner,'调律：选择同调士调整',H.options(e,c,list),1,1,'tuning-search',{source:c.source,role:'search'});},aiScore:1300});
E.op('tuning-search',(e,t)=>{
  const f=e.find(t.picks[0]);if(!f||f.zone!=='deck')return;e.search(t.owner,[f.card.uid]);
  const top=e.state.players[t.owner].deck[0];if(top)e.move(top.uid,'grave',{kind:'effect-send',source:t.context.source,byOwner:t.owner});
});
E.trigger('junk-warrior','gain',{label:'废品战士：吸收低星怪兽攻击力',mandatory:true,resolve:(e,c)=>{const m=self(e,c);if(m){const value=monsters(e,c.owner,x=>x.faceUp&&x.uid!==m.uid&&e.level(x)<=2&&e.level(x)>0).reduce((n,x)=>n+e.attackValue(x),0);e.modify(m.uid,'atk','add',value,null,c.source);}}});
E.trigger('junk-speeder','recruit',{label:'增速者：展开不同等级同调士',once:once('recruit'),wholeTurnExtra:'synchro',
  condition:(e,c)=>e.freeMain(c.owner)>0&&specialable(e,c.owner,deck(e,c.owner,m=>CARDS[m.id].family==='synchron'&&CARDS[m.id].tuner)).length>0,
  resolve:(e,c)=>{
    e.addLock(c.owner,'extra','synchro');
    const list=specialable(e,c.owner,deck(e,c.owner,m=>CARDS[m.id].family==='synchron'&&CARDS[m.id].tuner)),count=Math.min(e.freeMain(c.owner),new Set(list.map(m=>CARDS[m.id].level)).size);
    if(count)e.queueChoice(c.owner,'选择等级各不相同的同调士',list.map(m=>e.option(m,{viewer:c.owner,level:CARDS[m.id].level})),count,count,'speeder-recruit',{source:c.source,role:'synchrons',distinct:'level'});
  }});
E.op('speeder-recruit',(e,t)=>{
  if(new Set(t.picks.map(uid=>CARDS[e.find(uid).card.id].level)).size!==t.picks.length)throw new root.DuelRuleError('增速者召唤的同调士必须等级各不相同。');
  for(const uid of t.picks){const f=e.find(uid);if(f?.zone==='deck'&&e.freeMain(t.owner))e.special(t.owner,uid,{via:'effect',position:'defense'});}e.shuffle(e.state.players[t.owner].deck);
});
E.trigger('junk-speeder','double',{label:'增速者：攻击力变为原本的2倍',once:once('double'),condition:(e,c)=>{const m=self(e,c),a=c.event.attack;return !!m&&m.summonKind==='synchro'&&m.summonTurn===e.state.turn&&a?.target&&(a.uid===c.uid||a.target===c.uid);},
  resolve:(e,c)=>{const m=self(e,c);if(m)e.modify(m.uid,'atk','set',CARDS[m.id].atk*2,e.state.turn,c.source);}});
function destructionNegator(id,release=false){
  E.quick(id,'negate-destruction',{label:'无效并破坏将破坏场上卡的效果',main:false,damageStep:true,once:release?null:once('negate','card'),leavesAsCost:release,
    condition:(e,c)=>{const w=c.event.window,last=w?.chainLast;return !!last&&E.willDestroy(e,last);},
    cost:release?(e,c)=>{H.tributeCost(e,c,[c.uid]);c.returnGeneration=e.find(c.uid)?.card.generation;}:undefined,
    resolve:(e,c)=>{
      if(e.negateLink(c.responseTo,c.source,true,true)&&release){const f=e.find(c.uid);if(f?.zone==='grave'&&f.owner===c.owner)e.state.delayed.push({kind:'stardust',turn:e.state.turn,owner:c.owner,uid:c.uid,generation:f.card.generation});}
    },aiResponse:(e,c,w)=>w.chainLast?.owner!==c.owner?2200:0});
}
destructionNegator('stardust-dragon',true);destructionNegator('shooting-star',false);
E.trigger('stardust-dragon','return',{label:'星尘龙：结束阶段归来',zones:['grave'],condition:(e,c)=>source(e,c)?.owner===c.owner&&e.canSpecial(c.owner,source(e,c).card,{via:'revive'})&&e.freeMain(c.owner)>0&&source(e,c).card.generation===c.event.delayed?.generation,
  resolve:(e,c)=>{const f=source(e,c);if(f?.zone==='grave'&&f.card.generation===c.event.delayed.generation)e.special(c.owner,c.uid,{via:'revive'});}});
E.trigger('formula-synchron','draw',{label:'方程式：抽1张',resolve:(e,c)=>e.draw(c.owner,1)});
function quickSynchro(id,battleAllowed){
  E.quick(id,'quick-synchro',{label:'对方回合同调',main:false,once:once('quick-synchro','card'),
    condition:(e,c)=>c.owner!==e.state.active&&(H.mainPhase(e)||(battleAllowed&&e.state.phase==='battle'))&&e.extraOptions(c.owner,{requiredUid:c.uid}).some(o=>o.type==='synchro'),
    resolve:(e,c)=>{
      const options=e.extraOptions(c.owner,{requiredUid:c.uid}).filter(o=>o.type==='synchro');
      if(options.length)e.queueChoice(c.owner,'选择加速同调的怪兽',H.options(e,c,options.map(o=>o.card)),1,1,'quick-synchro-select',{source:c.source,requiredUid:c.uid,role:'special'});
    },aiResponse:(e,c,w)=>w.kind==='battle-open'||w.attack||w.chainLast?.owner!==c.owner?1400:0});
}
quickSynchro('formula-synchron',false);
H.registerQuickSynchro=quickSynchro;
E.op('quick-synchro-select',(e,t)=>{
  const extra=e.find(t.picks[0])?.card;if(!extra)return;
  const combos=e.synchroCombos(t.owner,extra,t.context.requiredUid);if(!combos.length)return;
  e.queueChoice(t.owner,'选择同调素材（包括发动效果的调整）',e.monsters(t.owner).filter(m=>m.faceUp).map(m=>e.option(m,{viewer:t.owner})),2,6,'quick-synchro-materials',{source:t.context.source,extraUid:extra.uid,requiredUid:t.context.requiredUid,role:'materials'},{sets:combos});
});
E.op('quick-synchro-materials',(e,t)=>{if(t.picks.includes(t.context.requiredUid))e.performSynchro(t.owner,t.context.extraUid,t.picks,{source:t.context.source});});
E.register('shooting-star','excavate',{label:'翻开5张卡，决定本回合攻击次数',once:once('excavate','card'),condition:(e,c)=>e.state.players[c.owner].deck.length>=5,
  resolve:(e,c)=>{const m=self(e,c);if(!m)return;const top=e.state.players[c.owner].deck.slice(0,5),n=top.filter(x=>CARDS[x.id].tuner).length;m.shootingTurn=e.state.turn;m.shootingAttackCount=n;e.log('effect','流星龙翻开：'+top.map(x=>CARDS[x.id].name).join('、')+'；本回合可攻击'+n+'次',c.owner);e.shuffle(e.state.players[c.owner].deck);},aiScore:(e,c)=>deck(e,c.owner,m=>CARDS[m.id].tuner).length>=4?500:-100});
E.trigger('shooting-star','dodge',{label:'除外流星龙，使攻击无效',once:once('dodge','card'),condition:(e,c)=>c.event.attack?.owner!==c.owner,
  resolve:(e,c)=>{const m=self(e,c),a=e.state.frame?.attack;if(!m||!a||a.negated)return;const pos=m.position,kind=m.summonKind;e.move(m.uid,'banished',{kind:'effect-banish',source:c.source,byOwner:c.owner});e.negateAttack(false);const f=e.find(m.uid);e.state.delayed.push({kind:'return',turn:e.state.turn,owner:c.owner,uid:m.uid,generation:f.card.generation,position:pos,oldSummonKind:kind});},
  aiTrigger:(e,c)=>H.damageThreat(e,c.event.attack,c.owner)>0});
E.register('junk-archer','banish',{label:'暂时除外对方怪兽',once:once('banish','card'),inputs:(e,c)=>[group(e,c,'target','选择暂时除外的怪兽',monsters(e,1-c.owner),1,1,{role:'banish'})],
  resolve:(e,c)=>{const f=H.legalTarget(e,c,first(c),(m,f)=>H.fieldZone(f.zone));if(!f)return;const previous=e.describe(f.card);const result=e.move(f.card.uid,'banished',{kind:'effect-banish',source:c.source,byOwner:c.owner});e.state.delayed.push({kind:'return',turn:e.state.turn,owner:previous.owner,uid:result.card.uid,generation:result.card.generation,position:previous.position,oldSummonKind:previous.summonKind});},aiScore:1150});
E.trigger('junk-destroyer','destroy',{label:'废品破坏王：按非调整素材数破坏卡牌',inputs:(e,c)=>[group(e,c,'target','选择要破坏的卡牌',[0,1].flatMap(p=>e.field(p)),1,Math.min([0,1].flatMap(p=>e.field(p)).length,c.event.materials.filter(m=>!m.tuner).length),{role:'destroy'})],resolve:H.destroyTargets});
E.on('summon',(e,v)=>{
  if(v.id==='junk-synchron'&&v.kind==='normal')e.addTrigger(v.uid,'junk-synchron::revive',v);
  if(v.kind==='synchro'){
    const keys={'junk-warrior':'gain','junk-speeder':'recruit','formula-synchron':'draw','junk-destroyer':'destroy'};
    if(keys[v.id])e.addTrigger(v.uid,v.id+'::'+keys[v.id],v,{mandatory:v.id==='junk-warrior'});
  }
  if(v.from==='grave')for(const m of hand(e,v.owner,c=>c.id==='doppelwarrior'))e.addTrigger(m.uid,'doppelwarrior::special',v,{owner:v.owner,priority:30});
});
E.on('move',(e,v)=>{
  if(v.to!=='grave'||v.kind!=='synchro-material')return;
  const keys={'junk-converter':'revive','doppelwarrior':'tokens','jet-synchron':'search','fleur-synchron':'special'};
  if(keys[v.id])e.addTrigger(v.uid,v.id+'::'+keys[v.id],v,{priority:20});
});
E.on('attack',(e,v)=>{
  for(const owner of[0,1])for(const m of monsters(e,owner,m=>m.faceUp)){
    if(m.id==='junk-speeder'&&(v.uid===m.uid||v.target===m.uid))e.addTrigger(m.uid,'junk-speeder::double',v,{owner});
    if(m.id==='shooting-star'&&v.owner!==owner)e.addTrigger(m.uid,'shooting-star::dodge',v,{owner});
  }
});
})(typeof globalThis!=='undefined'?globalThis:this);
