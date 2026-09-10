(function(root){
  'use strict';
  const E=root.DuelEffects,D=root.DuelData,{CARDS,isMonster}=D,H=E.H;
  const {source,self,first,args,group,customGroup,deck,grave,hand,field,monsters,specialable,normal,discard,sendCost,tributeCost,once}=H;
  const currentAttack=(e,ctx)=>ctx.event.window?.attack||ctx.event.attack||e.state.frame?.attack;
  function damageThreat(e,w,owner){
    const a=w.attack||w,af=e.find(a.uid),df=a.target?e.find(a.target):null;
    if(!af||!H.fieldZone(af.zone))return 0;
    if(e.state.players[owner].wabokuTurn===e.state.turn||e.state.players[owner].preventDamageUntil>=e.state.turn||(a.preventDamageFor||[]).includes(owner))return 0;
    if([af,df].some(f=>f&&f.owner===owner&&f.card.id==='bw-armor-master'&&!e.negated(f.card)))return 0;
    const attack=e.attackValue(af.card,a),defend=df?(df.card.position==='defense'?e.defenseValue(df.card,a):e.attackValue(df.card,a)):0;
    if(a.owner===owner)return df?Math.max(0,defend-attack):0;
    if(!df)return attack;
    if(df.card.position==='attack')return Math.max(0,attack-defend);
    return ['spear-dragon','bw-bora','bw-armed-wing','cyber-end'].includes(af.card.id)?Math.max(0,attack-defend):0;
  }
  H.damageThreat=damageThreat;H.currentAttack=currentAttack;
  const opponentAttack=(e,c)=>{const w=c.event.window;return !!w?.attack&&w.attack.owner!==c.owner&&w.attack.stage==='declare'&&!w.attack.negated;};
  const allMonsters=(e,owner,zones)=>H.monsterCards(e,owner,zones);
  E.register('$pendulum','place',{label:'设置灵摆刻度',generic:c=>c.type==='pendulum',zones:['hand'],cardActivation:true,pendulum:true,effectType:'spell',
    inputs:(e,c)=>[customGroup('slot','选择灵摆区',[0,4].filter(i=>!e.state.players[c.owner].spells[i]).map(i=>({uid:'slot:'+i,label:i===0?'左灵摆区':'右灵摆区',detail:'刻度 '+CARDS[c.sourceId].scale})))],resolve:()=>{}});
  E.spell('pot-of-greed',{label:'抽2张卡',condition:(e,c)=>e.state.players[c.owner].deck.length>0,resolve:(e,c)=>e.draw(c.owner,2),aiScore:(e,c)=>e.state.players[c.owner].deck.length>=2?1300:-100});
  E.spell('dian-keto',{label:'回复1000LP',resolve:(e,c)=>e.heal(c.owner,1000),aiScore:(e,c)=>e.state.players[c.owner].lp<=7000?200:-100});
  E.spell('monster-reborn',{label:'从墓地特殊召唤',inputs:(e,c)=>[group(e,c,'target','选择要复活的怪兽',[0,1].flatMap(p=>specialable(e,c.owner,allMonsters(e,p,['grave']),'revive')),1,1,{role:'special'})],resolve:(e,c)=>{const uid=first(c),f=e.find(uid);if(f?.zone==='grave'&&e.canSpecial(c.owner,f.card,{via:'revive'})&&e.freeMain(c.owner))e.special(c.owner,uid,{via:'revive'});},aiScore:700});
  E.spell('ancient-rules',{label:'特殊召唤高星通常怪兽',inputs:(e,c)=>[group(e,c,'target','选择手牌的高星通常怪兽',specialable(e,c.owner,hand(e,c.owner,m=>normal(m)&&CARDS[m.id].level>=5)),1,1,{role:'special'})],resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='hand')e.special(c.owner,f.card.uid,{via:'effect'});},aiScore:850});
  E.spell('raigeki',{label:'破坏对方全部怪兽',condition:(e,c)=>e.monsters(1-c.owner).length>0,resolve:(e,c)=>{for(const m of [...e.monsters(1-c.owner)])e.destroy(m.uid,c.source);},aiScore:(e,c)=>e.monsters(1-c.owner).length?1400:-100});
  E.spell('dark-hole',{label:'破坏全部怪兽',condition:e=>e.monsters(0).length+e.monsters(1).length>0,resolve:(e,c)=>{for(const p of[0,1])for(const m of[...e.monsters(p)])e.destroy(m.uid,c.source);},aiScore:(e,c)=>e.monsters(1-c.owner).reduce((n,m)=>n+e.enemyValue(m),0)>e.monsters(c.owner).reduce((n,m)=>n+e.attackValue(m),0)+500?1300:-100});
  E.spell('fissure',{label:'破坏攻击力最低的表侧怪兽',condition:(e,c)=>e.monsters(1-c.owner).some(m=>m.faceUp),resolve:(e,c)=>{
    const targets=e.monsters(1-c.owner).filter(m=>m.faceUp),lowest=Math.min(...targets.map(m=>e.attackValue(m))),cards=targets.filter(m=>e.attackValue(m)===lowest);
    if(cards.length===1)e.destroy(cards[0].uid,c.source);
    else if(cards.length)e.queueChoice(c.owner,'选择攻击力最低的怪兽',H.options(e,c,cards),1,1,'destroy-selected',{source:c.source,role:'destroy'});
  },aiScore:1150});
  E.spell('mst',{label:'破坏1张魔法／陷阱',inputs:(e,c)=>[group(e,c,'target','选择要破坏的魔法或陷阱',[0,1].flatMap(p=>e.spells(p)).filter(m=>m.uid!==c.uid),1,1,{role:'destroy'})],resolve:(e,c)=>{const f=e.find(first(c));if(f&&['spells','fieldSpell'].includes(f.zone))e.destroy(f.card.uid,c.source);},
    aiScore:(e,c)=>e.spells(1-c.owner).length?500:-100,
    aiResponse:(e,c,w)=>w.chainLast&&w.chainLast.owner!==c.owner&&['continuous','field','equip'].includes(CARDS[w.chainLast.sourceId].spellKind)?1300:!w.chainLast&&e.spells(1-c.owner).some(s=>s.faceUp&&s.id==='swords')?1000:0});
  E.spell('swords',{label:'封锁3个对方回合',keepField:true,resolve:(e,c)=>{
    const f=source(e,c);if(f&&['spells','fieldSpell'].includes(f.zone))f.card.turnsLeft=3;
    for(const m of e.monsters(1-c.owner))if(!m.faceUp){m.faceUp=true;e.log('reveal','光之护封剑翻开「'+CARDS[m.id].name+'」',c.owner,{cardId:m.id,uid:m.uid});}
  },aiScore:(e,c)=>e.spells(c.owner).some(m=>m.id==='swords'&&e.activeSpell(m))?-100:e.monsters(1-c.owner).length?600:80});
  for(const id of ['polymerization','miracle-fusion','power-bond','overload-fusion','cyberload-fusion']){
    E.spell(id,{label:'融合召唤',once:id==='cyberload-fusion'?once('activate'):null,onlyActivate:id==='cyberload-fusion',condition:(e,c)=>e.fusions(c.owner,c.sourceId).length>0,
      resolve:(e,c)=>{const list=e.fusions(c.owner,c.sourceId).map(o=>o.card);if(list.length)e.queueChoice(c.owner,'选择融合召唤的怪兽',H.options(e,c,list),1,1,'select-fusion',{owner:c.owner,source:c.source,spellId:c.sourceId,role:'fusion-choice'});},
      aiScore:(e,c)=>{
        const options=e.fusions(c.owner,c.sourceId);if(!options.length)return -100;
        const score=Math.max(...options.map(o=>(CARDS[o.card.id].atk||2500)+(o.card.id==='hero-sunrise'?1800:o.card.id==='chimeratech-rampage'?2200:0)));
        const best=options.sort((a,b)=>(CARDS[b.card.id].atk||2500)-(CARDS[a.card.id].atk||2500))[0];
        const value=best.materials.reduce((n,uid)=>{const f=e.find(uid);return n+(H.fieldZone(f?.zone)?e.attackValue(f.card):0);},0);
        return score>=value||c.sourceId==='miracle-fusion'||c.sourceId==='overload-fusion'?700+score/20:-100;
      },
      aiResponse:(e,c,w)=>c.sourceId==='cyberload-fusion'&&w.attack&&w.attack.owner!==c.owner&&damageThreat(e,w,c.owner)>0?1200:0
    });
  }
  E.register('kaibaman','transform',{label:'解放，呼唤青眼白龙',leavesAsCost:true,condition:(e,c)=>hand(e,c.owner,m=>m.id==='blue-eyes'&&e.canSpecial(c.owner,m)).length>0,cost:(e,c)=>tributeCost(e,c,[c.uid]),resolve:(e,c)=>{const dragon=hand(e,c.owner,m=>m.id==='blue-eyes')[0];if(dragon&&e.freeMain(c.owner))e.special(c.owner,dragon.uid,{via:'effect'});},aiScore:1500});
  E.register('skilled-magician','transform',{label:'移除3个魔力，呼唤黑魔术师',leavesAsCost:true,condition:(e,c)=>(source(e,c)?.card.counters||0)>=3&&H.cards(e,c.owner,['hand','deck','grave'],m=>m.id==='dark-magician'&&e.canSpecial(c.owner,m)).length>0,cost:(e,c)=>tributeCost(e,c,[c.uid]),resolve:(e,c)=>{const m=H.cards(e,c.owner,['hand','deck','grave'],m=>m.id==='dark-magician')[0];if(m&&e.freeMain(c.owner)){const from=e.find(m.uid).zone;e.special(c.owner,m.uid,{via:'effect'});if(from==='deck')e.shuffle(e.state.players[c.owner].deck);}},aiScore:1500});
  E.register('breaker','break',{label:'移除指示物，破坏魔法／陷阱',condition:(e,c)=>(source(e,c)?.card.counters||0)>0,inputs:(e,c)=>[group(e,c,'target','选择要破坏的魔法或陷阱',[0,1].flatMap(p=>e.spells(p)),1,1,{role:'destroy'})],cost:(e,c)=>{source(e,c).card.counters--;},resolve:(e,c)=>{const f=e.find(first(c));if(f&&['spells','fieldSpell'].includes(f.zone))e.destroy(f.card.uid,c.source);},aiScore:(e,c)=>e.spells(1-c.owner).length?700:-100});
  E.register('thunder-dragon','search',{label:'丢弃并检索雷龙',zones:['hand'],condition:(e,c)=>deck(e,c.owner,m=>m.id==='thunder-dragon').length>0,cost:(e,c)=>discard(e,c,[c.uid]),resolve:(e,c)=>{const list=deck(e,c.owner,m=>m.id==='thunder-dragon').slice(0,2);if(list.length)e.search(c.owner,list.map(m=>m.uid));},aiScore:750});
  E.trap('mirror-force',{label:'反射镜力',main:false,condition:opponentAttack,resolve:(e,c)=>{for(const m of[...e.monsters(1-c.owner)])if(m.position==='attack')e.destroy(m.uid,c.source);},aiResponse:()=>1600});
  E.trap('magic-cylinder',{label:'无效攻击并反射伤害',main:false,condition:opponentAttack,resolve:(e,c)=>{
    const a=e.state.frame?.attack,f=a?e.find(a.uid):null;
    if(f&&H.fieldZone(f.zone)&&f.card.position==='attack'&&!a.negated&&!e.unaffected(f.card,c.source)){const amount=e.attackValue(f.card);e.negateAttack(false);e.damage(a.owner,amount,'效果');}
  },aiResponse:(e,c,w)=>{const a=e.find(w.attack.uid)?.card;return a&&e.attackValue(a)>=e.state.players[1-c.owner].lp?3000:1500;}});
  E.trap('negate-attack',{label:'无效攻击并结束战斗阶段',main:false,condition:opponentAttack,resolve:(e,c)=>{
    const a=e.state.frame?.attack,f=a?e.find(a.uid):null;if(f&&H.fieldZone(f.zone)&&f.card.position==='attack'&&!a.negated)e.negateAttack(true);
  },aiResponse:()=>1000});
  E.trap('trap-hole',{label:'破坏刚通常或反转召唤的怪兽',main:false,condition:(e,c)=>{const w=c.event.window,f=e.find(w?.uid);return w?.kind==='summon'&&w.owner!==c.owner&&['normal','flip'].includes(w.summonKind)&&f&&H.fieldZone(f.zone)&&f.card.faceUp&&e.attackValue(f.card)>=1000;},resolve:(e,c)=>{const f=e.find(c.event.window.uid);if(f&&H.fieldZone(f.zone)&&f.card.faceUp&&e.attackValue(f.card)>=1000)e.destroy(f.card.uid,c.source);},aiResponse:()=>1400});
  E.quick('kuriboh','protect',{label:'丢弃栗子球，免除战斗伤害',zones:['hand'],main:false,damageStep:true,condition:(e,c)=>H.isDamageWindow(c.event.window)&&damageThreat(e,c.event.window,c.owner)>0,cost:(e,c)=>discard(e,c,[c.uid]),resolve:(e,c)=>{const a=e.state.frame?.attack;if(a&&!a.preventDamageFor.includes(c.owner))a.preventDamageFor.push(c.owner);},aiResponse:(e,c,w)=>damageThreat(e,w,c.owner)>0?1200:0});
  E.spell('reinforcement-army',{label:'检索低星战士族',inputs:(e,c)=>[group(e,c,'target','选择4星以下战士族',deck(e,c.owner,m=>isMonster(CARDS[m.id])&&CARDS[m.id].race==='战士族'&&CARDS[m.id].level<=4),1,1,{role:'search'})],resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='deck')e.search(c.owner,[f.card.uid]);},aiScore:950});
  E.spell('foolish-burial',{label:'将1只怪兽送墓',inputs:(e,c)=>[group(e,c,'target','选择要送墓的怪兽',deck(e,c.owner,m=>isMonster(CARDS[m.id])),1,1,{role:'send-deck'})],resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='deck'){e.move(f.card.uid,'grave',{kind:'effect-send',source:c.source,byOwner:c.owner});e.shuffle(e.state.players[c.owner].deck);}},aiScore:800});
  E.spell('one-for-one',{label:'送墓1只怪兽，特殊召唤1星怪兽',
    inputs:(e,c)=>[group(e,c,'cost','选择送去墓地的手牌怪兽',hand(e,c.owner,m=>isMonster(CARDS[m.id])&&H.canSendGY(e,m)),1,1,{role:'send-cost'})],
    condition:(e,c)=>specialable(e,c.owner,H.cards(e,c.owner,['hand','deck'],m=>isMonster(CARDS[m.id])&&CARDS[m.id].level===1)).length>0,
    cost:(e,c)=>sendCost(e,c,args(c,'cost')),
    resolve:(e,c)=>{const list=specialable(e,c.owner,H.cards(e,c.owner,['hand','deck'],m=>isMonster(CARDS[m.id])&&CARDS[m.id].level===1));if(list.length)e.queueChoice(c.owner,'选择1星怪兽特殊召唤',H.options(e,c,list),1,1,'special-selected',{owner:c.owner,source:c.source,role:'special',via:'effect'});},aiScore:720});
  E.trap('skill-drain',{label:'支付1000LP，展开技能抽取',condition:(e,c)=>e.state.players[c.owner].lp>1000,cost:(e,c)=>e.payLP(c.owner,1000),resolve:()=>{},aiScore:(e,c)=>e.deckInfo(c.owner).id==='qliphort'?600:-100,aiResponse:(e,c,w)=>e.deckInfo(c.owner).id==='qliphort'?1300:0});
  E.trap('waboku',{label:'本回合战斗保护',condition:(e,c)=>e.state.players[c.owner].wabokuTurn!==e.state.turn,resolve:(e,c)=>{e.state.players[c.owner].wabokuTurn=e.state.turn;},aiScore:()=>-100,aiResponse:(e,c,w)=>w.attack&&damageThreat(e,w,c.owner)>0?950:0});
  E.trap('pendulum-reborn',{label:'特殊召唤灵摆怪兽',inputs:(e,c)=>[group(e,c,'target','选择要特殊召唤的灵摆怪兽',specialable(e,c.owner,H.cards(e,c.owner,['grave','extra'],m=>CARDS[m.id].type==='pendulum'&&(e.find(m.uid).zone==='grave'||m.faceUpExtra))),1,1,{role:'special'})],resolve:(e,c)=>{const f=e.find(first(c));if(f&&['grave','extra'].includes(f.zone)&&e.canSpecial(c.owner,f.card)&&e.freeZones(c.owner,f.card).length)e.special(c.owner,f.card.uid,{via:'effect',position:'defense'});},aiScore:650,aiResponse:(e,c,w)=>w.attack&&w.attack.owner!==c.owner?650:0});
  E.op('select-fusion',(e,t)=>e.queue({op:'fusion-materials',owner:t.owner,extraUid:t.picks[0],spellId:t.context.spellId,source:t.context.source}));
  E.op('destroy-selected',(e,t)=>{for(const uid of t.picks)if(e.find(uid))e.destroy(uid,t.context.source);});
  E.op('banish-selected',(e,t)=>{for(const uid of t.picks){const f=e.find(uid);if(f&&!e.unaffected(f.card,t.context.source))e.move(uid,'banished',{kind:'effect-banish',source:t.context.source,byOwner:t.owner});}});
  E.op('bounce-selected',(e,t)=>{for(const uid of t.picks){const f=e.find(uid);if(f&&!e.unaffected(f.card,t.context.source))e.move(uid,'hand',{kind:'effect-return',source:t.context.source,byOwner:t.owner});}});
  E.op('discard-selected',(e,t)=>{for(const uid of t.picks)if(e.find(uid)?.zone==='hand')e.move(uid,'grave',{kind:'effect-discard',source:t.context.source,byOwner:t.owner});});
  E.op('special-selected',(e,t)=>{for(const uid of t.picks){const f=e.find(uid);if(!f)continue;const from=f.zone;if(e.canSpecial(t.owner,f.card,{via:t.context.via||'effect'})&&e.freeZones(t.owner,f.card).length)e.special(t.owner,uid,{via:t.context.via||'effect',position:t.context.position||'attack',negated:!!t.context.negated,cannotActivate:!!t.context.cannotActivate,banishOnLeave:!!t.context.banishOnLeave});if(from==='deck')e.shuffle(e.state.players[t.owner].deck);}});
  E.op('search-selected',(e,t)=>{const ids=t.picks.filter(uid=>e.find(uid)?.zone==='deck');if(ids.length)e.search(t.owner,ids);});
  E.op('return-hand-selected',(e,t)=>{for(const uid of t.picks)if(e.find(uid))e.move(uid,'hand',{kind:'effect-return',source:t.context.source,byOwner:t.owner});});
  E.op('draw-discard',(e,t)=>{
    e.draw(t.owner,t.count||2);
    if(e.state.winner===null){const list=hand(e,t.owner);if(list.length)e.queueChoice(t.owner,'抽卡后选择丢弃1张手牌',list.map(c=>e.option(c,{viewer:t.owner})),1,1,'discard-selected',{source:t.source,role:'discard'});}
  });
  E.op('delayed-destroy',(e,t)=>{const f=e.find(t.uid);if(f&&H.fieldZone(f.zone)&&(f.card.generation||0)===t.generation)e.destroy(t.uid,t.source);});
  E.op('delayed-return',(e,t)=>{
    const f=e.find(t.uid);if(!f||f.zone!=='banished'||(f.card.generation||0)!==t.generation)return;
    const p=e.state.players[t.owner],slot=p.monsters.indexOf(null);
    if(slot<0){e.move(t.uid,'grave',{kind:'rule-return-failed',reason:'返回场上时没有区域'});return;}
    const card=e.remove(t.uid).card;card.faceUp=true;card.faceUpExtra=false;card.position=t.position||'attack';card.summonKind=t.oldSummonKind||'return';card.generation=(card.generation||0)+1;p.monsters[slot]=card;
    e.log('return',CARDS[card.id].name+'返回场上',t.owner,{uid:card.uid,cardId:card.id});
  });
  E.trigger('power-bond','end-damage',{label:'力量结合的结束阶段代价',virtual:true,zones:['*'],condition:(e,c)=>!!c.event.delayed,resolve:(e,c)=>e.damage(c.owner,c.event.delayed.amount,'效果')});
  E.endHandlers.push((e,owner)=>{
    const due=e.state.delayed.filter(d=>d.turn===e.state.turn),keep=e.state.delayed.filter(d=>d.turn!==e.state.turn);e.state.delayed=keep;
    for(const d of due){
      if(d.kind==='power-bond')e.addTrigger(d.sourceUid,'power-bond::end-damage',{type:'delayed',owner:d.owner,delayed:d},{owner:d.owner,sourceId:'power-bond',mandatory:true,priority:20});
      if(d.kind==='destroy')e.queue({op:'delayed-destroy',...d});
      if(d.kind==='return')e.queue({op:'delayed-return',...d});
      if(d.kind==='stardust')e.addTrigger(d.uid,'stardust-dragon::return',{type:'delayed',owner:d.owner,delayed:d},{owner:d.owner,sourceId:'stardust-dragon',priority:10});
    }
  });
})(typeof globalThis!=='undefined'?globalThis:this);
