(function(root){ 'use strict'; const E=root.DuelEffects,D=root.DuelData,H=E.H;
const {CARDS,isMonster,isFamily}=D;
const {source,self,first,args,group,customGroup,deck,grave,hand,monsters,specialable,once}=H;
const onomat=c=>['gagaga','gogogo','dododo','zubaba'].some(f=>isFamily(CARDS[c.id],f));
E.register('gagaga-magician','level',{label:'宣言1—8星，改变等级',once:once('level','card'),
  inputs:()=>[customGroup('level','宣言我我我魔术师的等级',Array.from({length:8},(_,i)=>({uid:'level:'+(i+1),label:(i+1)+' 星',value:i+1})),1,1,{aiValues:()=>['level:4']})],
  resolve:(e,c)=>{const m=self(e,c);if(m)m.levelOverride={value:Number(first(c,'level').split(':')[1]),until:e.state.turn};},aiScore:(e,c)=>e.level(source(e,c).card)!==4?650:-100});
E.register('gagaga-girl','level',{label:'与另一只我我我同步等级',once:once('level','card'),
  inputs:(e,c)=>[group(e,c,'target','选择等级参照怪兽',monsters(e,c.owner,m=>m.uid!==c.uid&&m.faceUp&&isFamily(CARDS[m.id],'gagaga')&&e.level(m)>0),1,1,{role:'own-boost'})],
  resolve:(e,c)=>{const m=self(e,c),target=e.find(first(c));if(m&&target&&H.fieldZone(target.zone)&&target.card.faceUp)m.levelOverride={value:e.level(target.card)};},aiScore:(e,c)=>monsters(e,c.owner,m=>m.uid!==c.uid&&isFamily(CARDS[m.id],'gagaga')&&e.level(m)===4).length&&e.level(source(e,c).card)!==4?800:-100});
E.trigger('goblindbergh','special',{label:'哥布林德伯格：展开低星手牌',condition:(e,c)=>specialable(e,c.owner,hand(e,c.owner,m=>isMonster(CARDS[m.id])&&CARDS[m.id].level<=4)).length>0,
  resolve:(e,c)=>{const list=specialable(e,c.owner,hand(e,c.owner,m=>isMonster(CARDS[m.id])&&CARDS[m.id].level<=4));if(list.length)e.queueChoice(c.owner,'选择特殊召唤的4星以下怪兽',H.options(e,c,list),1,1,'goblin-special',{source:c.source,role:'special'});}});
E.op('goblin-special',(e,t)=>{
  const f=e.find(t.picks[0]);if(!f||f.zone!=='hand'||!e.canSpecial(t.owner,f.card)||!e.freeMain(t.owner))return;e.special(t.owner,f.card.uid,{via:'effect'});
  const actor=e.find(t.context.source.uid);if(actor&&H.fieldZone(actor.zone)&&(actor.card.generation||0)===t.context.source.generation){actor.card.position='defense';actor.card.changedTurn=e.state.turn;}
});
E.trigger('kagetokage','special',{label:'影蜥蜴：响应4星通常召唤',zones:['hand'],condition:(e,c)=>e.canSpecial(c.owner,source(e,c).card,{via:'kagetokage-hand'})&&e.freeMain(c.owner)>0,resolve:(e,c)=>{if(e.find(c.uid)?.zone==='hand')e.special(c.owner,c.uid,{via:'kagetokage-hand'});}});
E.register('zs-ascended-sage','special',{label:'场上没有卡，特殊召唤升华贤者',zones:['hand'],inherent:true,condition:(e,c)=>e.field(c.owner).length===0&&e.canSpecial(c.owner,source(e,c).card),resolve:(e,c)=>e.special(c.owner,c.uid,{via:'effect'}),aiScore:1600});
E.trigger('zs-ascended-sage','grant-search',{label:'升华贤者赋予：检索升阶魔法',virtual:true,once:{key:'grant-search',scope:'name',cardId:'zs-ascended-sage'},
  condition:(e,c)=>!!source(e,c)?.card.granted?.sage&&deck(e,c.owner,m=>CARDS[m.id].rankUpSpell).length>0,resolve:(e,c)=>H.searchChoice(e,c,m=>CARDS[m.id].rankUpSpell)});
E.register('utopic-onomatopoeia','expand',{label:'拟声展开，每个系列最多1只',once:once('expand'),
  condition:(e,c)=>specialable(e,c.owner,hand(e,c.owner,m=>onomat(m)&&m.id!=='utopic-onomatopoeia')).length>0,
  resolve:(e,c)=>{
    const list=specialable(e,c.owner,hand(e,c.owner,m=>onomat(m)&&m.id!=='utopic-onomatopoeia'));
    e.addLock(c.owner,'extra','xyz');
    if(list.length)e.queueChoice(c.owner,'每个拟声系列最多选择1只',H.options(e,c,list),1,Math.min(4,e.freeMain(c.owner),list.length),'onomat-expand',{source:c.source,role:'special',validator:'onomat'});
  },aiScore:1050});
E.op('onomat-expand',(e,t)=>{
  if(E.validateInput(e,{owner:t.owner},{validator:'onomat'},t.picks)!==true)throw new root.DuelRuleError('每个拟声系列最多特殊召唤1只。');
  for(const uid of t.picks){const f=e.find(uid);if(f?.zone==='hand'&&e.freeMain(t.owner))e.special(t.owner,uid,{via:'effect',position:'defense'});}
});
E.register('zubaba-gagagacoat','special',{label:'控制刷拉拉／我我我，特殊召唤外套',zones:['hand'],once:once('special'),
  condition:(e,c)=>monsters(e,c.owner,m=>m.faceUp&&m.id!=='zubaba-gagagacoat'&&(isFamily(CARDS[m.id],'gagaga')||isFamily(CARDS[m.id],'zubaba'))).length>0&&e.canSpecial(c.owner,source(e,c).card)&&e.freeMain(c.owner)>0,
  resolve:(e,c)=>e.special(c.owner,c.uid,{via:'effect'}),aiScore:900});
E.register('zubaba-gagagacoat','revive',{label:'外套：复活隆隆隆／怒怒怒',once:once('revive'),
  inputs:(e,c)=>[group(e,c,'target','选择墓地的隆隆隆／怒怒怒',specialable(e,c.owner,grave(e,c.owner,m=>isFamily(CARDS[m.id],'gogogo')||isFamily(CARDS[m.id],'dododo')),'revive'),1,1,{role:'special'})],
  resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='grave')e.special(c.owner,f.card.uid,{via:'revive'});e.addLock(c.owner,'extra','xyz');},aiScore:1050});
E.register('dododo-gogogoglove','expand',{label:'手套：特殊召唤刷拉拉／我我我',once:once('expand'),
  condition:(e,c)=>specialable(e,c.owner,hand(e,c.owner,m=>isFamily(CARDS[m.id],'zubaba')||isFamily(CARDS[m.id],'gagaga'))).length>0,
  resolve:(e,c)=>H.specialChoice(e,c,hand(e,c.owner,m=>isFamily(CARDS[m.id],'zubaba')||isFamily(CARDS[m.id],'gagaga'))),aiScore:950});
E.register('dododo-gogogoglove','revive',{label:'控制隆隆隆／怒怒怒，复活手套',zones:['grave'],once:once('revive'),
  condition:(e,c)=>monsters(e,c.owner,m=>m.faceUp&&m.id!==c.sourceId&&(isFamily(CARDS[m.id],'gogogo')||isFamily(CARDS[m.id],'dododo'))).length>0&&e.canSpecial(c.owner,source(e,c).card)&&e.freeMain(c.owner)>0,
  resolve:(e,c)=>e.special(c.owner,c.uid,{via:'revive',banishOnLeave:true}),aiScore:900});
E.spell('onomatopaira',{label:'手牌送墓，检索拟声怪兽',once:once('activate'),onlyActivate:true,
  condition:(e,c)=>deck(e,c.owner,onomat).length>0,
  inputs:(e,c)=>[group(e,c,'cost','选择送墓的手牌',hand(e,c.owner,m=>m.uid!==c.uid&&H.canSendGY(e,m)),1,1,{role:'send-cost'})],
  cost:(e,c)=>H.sendCost(e,c,args(c,'cost')),
  resolve:(e,c)=>{const list=deck(e,c.owner,onomat);if(list.length)e.queueChoice(c.owner,'选择最多2个不同拟声系列',H.options(e,c,list),1,Math.min(2,list.length),'onomat-search',{source:c.source,role:'search',validator:'onomat'});},aiScore:1200});
E.op('onomat-search',(e,t)=>{if(E.validateInput(e,{owner:t.owner},{validator:'onomat'},t.picks)!==true)throw new root.DuelRuleError('每个拟声系列最多检索1只。');const ids=t.picks.filter(uid=>e.find(uid)?.zone==='deck');if(ids.length)e.search(t.owner,ids);});
E.spell('xyz-change-tactics',{label:'展开超量变化战术',condition:(e,c)=>!e.spells(c.owner).some(s=>s.id===c.sourceId&&e.activeSpell(s)),resolve:()=>{},aiScore:1000});
E.trigger('xyz-change-tactics','draw',{label:'支付500LP，抽1张',zones:['spells'],requiresField:true,condition:(e,c)=>e.state.players[c.owner].lp>500&&e.state.players[c.owner].deck.length>0,cost:(e,c)=>e.payLP(c.owner,500),resolve:(e,c)=>e.draw(c.owner,1)});
E.trigger('utopia','negate-attack',{label:'霍普：移除1素材，无效攻击',condition:(e,c)=>(source(e,c)?.card.overlays.length||0)>0&&!!c.event.attack&&!e.state.frame?.attack?.negated,
  inputs:(e,c)=>[H.detachInput(e,c,1)],cost:(e,c)=>e.detach(c.uid,args(c,'cost')),resolve:e=>e.negateAttack(false),
  aiTrigger:(e,c)=>c.event.attack.owner!==c.owner?H.damageThreat(e,c.event.attack,c.owner)>0:!c.event.attack.double&&hand(e,c.owner,m=>m.id==='double-or-nothing').length>0});
E.trigger('utopia','empty-destroy',{label:'没有素材的霍普被攻击，自身破坏',mandatory:true,condition:(e,c)=>(source(e,c)?.card.overlays.length||0)===0,resolve:(e,c)=>{const m=self(e,c);if(m)e.destroy(m.uid,c.source);}});
E.spell('double-or-nothing',{label:'翻倍机会，再次攻击',main:false,
  condition:(e,c)=>{const w=c.event.window,f=e.find(w?.attack?.uid);return w?.kind==='attack-negated'&&f&&H.fieldZone(f.zone)&&f.card.faceUp;},
  resolve:(e,c)=>{const a=e.state.frame?.attack,f=a?e.find(a.uid):null;if(f&&H.fieldZone(f.zone)){f.card.doubleAllowance=Math.max(f.card.doubleAllowance||0,1);f.card.doubleNextAttack=true;e.log('effect',CARDS[f.card.id].name+'获得再攻击的机会，下一次攻击伤害计算时攻击力翻倍',c.owner,{uid:f.card.uid});}},
  aiResponse:(e,c,w)=>w.kind==='attack-negated'&&w.attack.owner===c.owner?2500:0});
E.quick('utopia-double','upgrade',{label:'移除素材，检索翻倍机会并叠放希望皇',once:once('upgrade','card'),
  condition:(e,c)=>(source(e,c)?.card.overlays.length||0)>=1&&deck(e,c.owner,m=>m.id==='double-or-nothing').length>0&&e.state.players[c.owner].extra.some(m=>CARDS[m.id].family==='utopia'&&CARDS[m.id].type==='xyz'&&m.id!=='utopia-double'&&e.canSpecial(c.owner,m,{via:'xyz'})),
  inputs:(e,c)=>[H.detachInput(e,c,1)],cost:(e,c)=>e.detach(c.uid,args(c,'cost')),
  resolve:(e,c)=>{const m=self(e,c),spell=deck(e,c.owner,m=>m.id==='double-or-nothing')[0];if(!m||!spell)return;e.search(c.owner,[spell.uid]);const list=e.state.players[c.owner].extra.filter(m=>CARDS[m.id].family==='utopia'&&CARDS[m.id].type==='xyz'&&m.id!=='utopia-double'&&e.canSpecial(c.owner,m,{via:'xyz'}));if(list.length)e.queueChoice(c.owner,'选择叠放的希望皇',H.options(e,c,list),1,1,'utopia-double-upgrade',{source:c.source,role:'xyz-upgrade'});},
  aiScore:1800,aiResponse:(e,c,w)=>w.attack||w.chainLast?.owner!==c.owner?1800:0});
E.op('utopia-double-upgrade',(e,t)=>{const actor=e.find(t.context.source.uid);if(!actor||!H.fieldZone(actor.zone)||(actor.card.generation||0)!==t.context.source.generation)return;const summoned=e.performXyz(t.owner,t.picks[0],[actor.card.uid],{byEffect:true,rankUp:true});if(summoned){e.modify(summoned.uid,'atk','multiply',2,null,t.context.source);summoned.noDirect=true;}});
E.quick('utopia-lightning','five-thousand',{label:'电光皇：移除2素材，攻击力变为5000',main:false,damageStep:true,
  condition:(e,c)=>{const m=source(e,c)?.card,a=c.event.window?.attack;return !!m&&H.isDamageWindow(c.event.window)&&!!a.target&&(a.uid===c.uid||a.target===c.uid)&&m.overlays.length>=2&&m.overlays.some(x=>CARDS[x.id].family==='utopia')&&m.lightningUseSerial!==a.serial;},
  inputs:(e,c)=>[H.detachInput(e,c,2)],cost:(e,c)=>{source(e,c).card.lightningUseSerial=c.event.window.attack.serial;e.detach(c.uid,args(c,'cost'));},
  resolve:(e,c)=>{const m=self(e,c),a=e.state.frame?.attack;if(m&&a){m.lightningTurn=e.state.turn;m.lightningAttack=a.serial;}},aiResponse:()=>2200});
E.register('utopia-ray','boost',{label:'LP1000以下：移除素材，逆转攻守',condition:(e,c)=>e.state.players[c.owner].lp<=1000&&(source(e,c)?.card.overlays.length||0)>0&&monsters(e,1-c.owner,m=>m.faceUp).length>0,
  inputs:(e,c)=>[H.detachInput(e,c,1),group(e,c,'target','选择攻击力下降1000的怪兽',monsters(e,1-c.owner,m=>m.faceUp),1,1,{role:'destroy'})],cost:(e,c)=>e.detach(c.uid,args(c,'cost')),
  resolve:(e,c)=>{const m=self(e,c);if(m)e.modify(m.uid,'atk','add',500,e.state.turn,c.source);e.modify(first(c),'atk','add',-1000,e.state.turn,c.source);},aiScore:1400});
E.register('gagaga-cowboy','effect',{label:'移除1素材：攻击强化／800伤害',once:once('effect','card'),condition:(e,c)=>(source(e,c)?.card.overlays.length||0)>0,
  inputs:(e,c)=>[H.detachInput(e,c,1)],cost:(e,c)=>{c.chosenPosition=source(e,c).card.position;e.detach(c.uid,args(c,'cost'));},
  resolve:(e,c)=>{if(c.chosenPosition==='defense')e.damage(1-c.owner,800,'效果');else{const m=self(e,c);if(m)m.battleBoost='cowboy';}},aiScore:(e,c)=>source(e,c).card.position==='defense'?900:500});
E.register('castel','book',{label:'移除1素材，使怪兽里侧守备',once:once('one-effect'),condition:(e,c)=>(source(e,c)?.card.overlays.length||0)>=1,
  inputs:(e,c)=>[H.detachInput(e,c,1),group(e,c,'target','选择变为里侧守备的怪兽',[0,1].flatMap(p=>monsters(e,p,m=>m.faceUp&&!['token','link'].includes(CARDS[m.id].type))),1,1,{role:'destroy'})],
  cost:(e,c)=>e.detach(c.uid,args(c,'cost')),resolve:(e,c)=>{
    const f=H.legalTarget(e,c,first(c),(m,f)=>H.fieldZone(f.zone)&&m.faceUp);if(!f)return;
    const m=f.card;m.faceUp=false;m.position='defense';m.mods=[];m.counters=0;m.levelOverride=null;m.attributeOverride=null;m.effectNegated=false;m.noDirect=false;m.doubleAllowance=0;m.extraAttacks=0;
    e.cleanupEquips(m.uid);
  },aiScore:(e,c)=>(source(e,c)?.card.overlays.length||0)<2&&e.monsters(1-c.owner).length?900:-100});
E.register('castel','shuffle',{label:'移除2素材，将表侧卡洗回卡组',once:once('one-effect'),condition:(e,c)=>(source(e,c)?.card.overlays.length||0)>=2&&[0,1].flatMap(p=>e.field(p)).some(m=>m.faceUp&&m.uid!==c.uid),
  inputs:(e,c)=>[H.detachInput(e,c,2),group(e,c,'target','选择洗回卡组的表侧卡',[0,1].flatMap(p=>e.field(p)).filter(m=>m.uid!==c.uid&&m.faceUp),1,1,{role:'bounce'})],
  cost:(e,c)=>e.detach(c.uid,args(c,'cost')),resolve:(e,c)=>{const f=H.legalTarget(e,c,first(c),m=>m.faceUp);if(f){const owner=f.card.originalOwner;e.move(f.card.uid,'deck',{kind:'effect-return',source:c.source,byOwner:c.owner});e.shuffle(e.state.players[owner].deck);}},aiScore:(e,c)=>e.field(1-c.owner).some(m=>m.faceUp)?1300:-100});
E.spell('limited-barians-force',{label:'在4阶怪兽上叠放5阶混沌No.',
  inputs:(e,c)=>[group(e,c,'target','选择4阶超量怪兽',monsters(e,c.owner,m=>m.faceUp&&CARDS[m.id].type==='xyz'&&CARDS[m.id].rank===4&&!CARDS[m.id].cannotXyz),1,1,{role:'own-boost'})],
  condition:(e,c)=>e.state.players[c.owner].extra.some(m=>CARDS[m.id].chaosNumber&&CARDS[m.id].rank===5&&e.canSpecial(c.owner,m,{via:'xyz'})),
  resolve:(e,c)=>{const f=H.legalTarget(e,c,first(c),(m,f)=>f.owner===c.owner&&H.fieldZone(f.zone)&&m.faceUp);if(!f)return;const list=e.state.players[c.owner].extra.filter(m=>CARDS[m.id].chaosNumber&&CARDS[m.id].rank===5&&e.canSpecial(c.owner,m,{via:'xyz'}));if(list.length)e.queueChoice(c.owner,'选择5阶混沌No.',H.options(e,c,list),1,1,'rankup-selected',{source:c.source,target:f.card.uid,role:'xyz-upgrade'});},aiScore:1100});
E.op('rankup-selected',(e,t)=>{const f=e.find(t.context.target);if(f&&H.fieldZone(f.zone))e.performXyz(t.owner,t.picks[0],[f.card.uid],{byEffect:true,rankUp:true});});
E.register('utopia-ray-v','destroy',{label:'霍普雷V：破坏怪兽并给予伤害',once:once('destroy','card'),
  condition:(e,c)=>(source(e,c)?.card.overlays||[]).some(m=>m.id==='utopia')&&e.monsters(1-c.owner).length>0,
  inputs:(e,c)=>[H.detachInput(e,c,1),group(e,c,'target','选择要破坏的怪兽',e.monsters(1-c.owner),1,1,{role:'destroy'})],
  cost:(e,c)=>e.detach(c.uid,args(c,'cost')),resolve:(e,c)=>{const f=H.legalTarget(e,c,first(c),(m,f)=>H.fieldZone(f.zone));if(f){const atk=CARDS[f.card.id].atk||0;if(e.destroy(f.card.uid,c.source))e.damage(1-c.owner,atk,'效果');}},aiScore:1400});
E.trigger('utopia-ray-v','recover',{label:'霍普雷V：将墓地超量怪兽返回额外卡组',zones:['grave'],inputs:(e,c)=>[group(e,c,'target','选择回收的超量怪兽',grave(e,c.owner,m=>CARDS[m.id].type==='xyz'),1,1,{role:'search'})],resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='grave')e.move(f.card.uid,'deck',{kind:'effect-return',source:c.source,byOwner:c.owner});}});
E.trigger('gagaga-girl','grant-zero',{label:'我我我少女赋予：特殊召唤怪兽攻击力归零',virtual:true,
  condition:(e,c)=>!!source(e,c)?.card.granted?.girl,
  inputs:(e,c)=>[group(e,c,'target','选择攻击力变为0的怪兽',monsters(e,1-c.owner,m=>m.faceUp&&!!m.summonKind&&!['normal','set','flip'].includes(m.summonKind)),1,1,{role:'destroy'})],
  resolve:(e,c)=>e.modify(first(c),'atk','set',0,null,c.source)});
E.on('summon',(e,v)=>{
  if(v.kind==='normal'){
    if(v.id==='goblindbergh')e.addTrigger(v.uid,'goblindbergh::special',v);
    const summoned=e.find(v.uid)?.card;if(summoned&&e.level(summoned)===4)for(const m of hand(e,v.owner,m=>m.id==='kagetokage'))e.addTrigger(m.uid,'kagetokage::special',v,{owner:v.owner,priority:30});
  }
  if(v.kind==='xyz'){
    const card=e.find(v.uid)?.card;if(!card)return;
    if(card.granted?.sage)e.addTrigger(card.uid,'zs-ascended-sage::grant-search',v,{owner:v.owner});
    if(card.granted?.girl)e.addTrigger(card.uid,'gagaga-girl::grant-zero',v,{owner:v.owner});
    if(CARDS[v.id].family==='utopia')for(const s of e.spells(v.owner))if(s.id==='xyz-change-tactics'&&e.activeSpell(s))e.addTrigger(s.uid,'xyz-change-tactics::draw',v,{owner:v.owner,priority:30});
  }
});
E.on('attack',(e,v)=>{
  for(const owner of[0,1])for(const m of monsters(e,owner,m=>m.id==='utopia'&&m.faceUp)){
    if(m.uid===v.target&&!m.overlays.length)e.addTrigger(m.uid,'utopia::empty-destroy',v,{owner,mandatory:true,priority:5});
    else if(m.overlays.length)e.addTrigger(m.uid,'utopia::negate-attack',v,{owner,priority:10});
  }
});
E.on('move',(e,v)=>{if(v.id==='utopia-ray-v'&&v.to==='grave'&&H.fieldZone(v.from)&&['battle','destroy'].includes(v.kind)&&v.byOwner!==v.previous.owner&&v.previous.owner===v.previous.originalOwner)e.addTrigger(v.uid,'utopia-ray-v::recover',v);});
})(typeof globalThis!=='undefined'?globalThis:this);
