(function(root){
  'use strict';
  const E=root.DuelEffects,D=root.DuelData,H=E.H,{CARDS,isMonster}=D;
  const {source,self,first,args,group,hand,grave,deck,monsters,once}=H;
  const link=c=>CARDS[c.id].type==='link';
  const monsterEffect=last=>last&&isMonster(CARDS[last.sourceId])&&!['spell','trap','pendulum-spell'].includes(last.source.effectType);
  E.quick('ip-masquerena','quick-link',{label:'I：P：对方主要阶段，立即连接召唤',main:false,once:once('quick-link'),summons:true,
    condition:(e,c)=>e.state.active!==c.owner&&H.mainPhase(e)&&e.linkOptions(c.owner,c.uid).length>0,
    resolve:(e,c)=>{if(!self(e,c))return;const list=e.linkOptions(c.owner,c.uid).map(o=>o.card);if(list.length)e.queueChoice(c.owner,'I：P · 选择连接召唤的怪兽',H.options(e,c,list),1,1,'ip-choose-link',{source:c.source,role:'link-choice'});},
    aiResponse:(e,c,w)=>w.chainLast?.owner!==c.owner||w.kind==='main-open'?1700:0});
  E.op('ip-choose-link',(e,t)=>{const f=e.find(t.context.source.uid);if(!f||!H.fieldZone(f.zone)||(f.card.generation||0)!==t.context.source.generation)return;e.queue({op:'link-materials',owner:t.owner,extraUid:t.picks[0],requiredUid:f.card.uid,source:t.context.source});});
  function knightmare(id,mode){
    E.trigger(id,'entry',{label:id==='knightmare-phoenix'?'凤凰：丢弃手牌，破坏后场':'独角兽：丢弃手牌，将卡洗回卡组',once:once('entry'),destroys:mode==='destroy',
      inputs:(e,c)=>[group(e,c,'cost','选择丢弃的手牌（这是代价）',hand(e,c.owner),1,1,{role:'cost'}),group(e,c,'target',mode==='destroy'?'选择对方魔法／陷阱':'选择洗回卡组的场上卡',mode==='destroy'?e.spells(1-c.owner):[0,1].flatMap(p=>e.field(p)),1,1,{role:mode==='destroy'?'destroy':'bounce'})],
      cost:(e,c)=>{c.coLinkedOnActivation=e.coLinked(c.uid).length>0;H.discard(e,c,args(c,'cost'));},
      resolve:(e,c)=>{
        const f=H.legalTarget(e,c,first(c));let applied=false;
        if(f){if(mode==='destroy')applied=e.destroy(f.card.uid,c.source);else{const owner=f.card.originalOwner;e.move(f.card.uid,'deck',{kind:'effect-return',source:c.source,byOwner:c.owner});e.shuffle(e.state.players[owner].deck);applied=true;}}
        if(applied&&c.coLinkedOnActivation&&e.state.players[c.owner].deck.length)e.queueChoice(c.owner,'互相连接奖励 · 是否抽1张卡？',[{uid:'draw',label:'抽1张卡',value:10},{uid:'skip',label:'不抽卡',value:0}],1,1,'knightmare-draw',{source:c.source,role:'optional'});
      },aiTrigger:(e,c)=>e.field(1-c.owner).length>0
    });
  }
  knightmare('knightmare-phoenix','destroy');knightmare('knightmare-unicorn','shuffle');
  E.op('knightmare-draw',(e,t)=>{if(t.picks[0]==='draw')e.draw(t.owner,1);});
  E.passive('knightmare-phoenix',{protect:(e,s,m,battle)=>battle&&e.find(m.uid)?.owner===s.owner&&e.coLinked(m.uid).length>0});
  E.passive('knightmare-unicorn',{drawCount:e=>Math.max(1,new Set([0,1].flatMap(p=>e.monsters(p)).filter(m=>m.faceUp&&['knightmare-phoenix','knightmare-unicorn'].includes(m.id)&&e.coLinked(m.uid).length>0).map(m=>m.id)).size)});
  function charmer(id,attribute){
    const availableZones=(e,c)=>e.linkedZones(c.owner,c.uid).filter(i=>!e.state.players[c.owner].monsters[i]);
    E.register(id,'revive',{label:'灵使：复活对方墓地的'+attribute+'属性怪兽',once:once('revive'),summons:true,
      condition:(e,c)=>availableZones(e,c).length>0,
      inputs:(e,c)=>[group(e,c,'target','选择对方墓地的'+attribute+'属性怪兽',grave(e,1-c.owner,m=>isMonster(CARDS[m.id])&&CARDS[m.id].attribute===attribute&&e.canSpecial(c.owner,m,{via:'revive'})),1,1,{role:'special'})],
      resolve:(e,c)=>{
        const m=self(e,c),f=e.find(first(c));if(!m||!f||f.zone!=='grave')return;
        const zones=availableZones(e,c);if(zones.length)e.queueChoice(c.owner,'灵使：选择箭头指向的空区域',zones.map(i=>({uid:'zone:'+i,label:'主怪兽区 '+(i+1),detail:'位于灵使的连接箭头方向'})),1,1,'charmer-revive',{source:c.source,target:f.card.uid,targetGeneration:f.card.generation||0,role:'zone'});
      },aiScore:1450});
    E.trigger(id,'search',{label:'灵使被破坏：检索低守备力'+attribute+'属性怪兽',zones:['grave','banished'],once:once('search'),
      condition:(e,c)=>deck(e,c.owner,m=>isMonster(CARDS[m.id])&&CARDS[m.id].attribute===attribute&&CARDS[m.id].def!==null&&CARDS[m.id].def<=1500).length>0,
      resolve:(e,c)=>H.searchChoice(e,c,m=>isMonster(CARDS[m.id])&&CARDS[m.id].attribute===attribute&&CARDS[m.id].def!==null&&CARDS[m.id].def<=1500)});
  }
  charmer('dharc-charmer','暗');charmer('eria-charmer','水');
  E.op('charmer-revive',(e,t)=>{const source=e.find(t.context.source.uid),target=e.find(t.context.target),zone=Number(t.picks[0].split(':')[1]);if(!source||!H.fieldZone(source.zone)||(source.card.generation||0)!==t.context.source.generation||!target||target.zone!=='grave'||(target.card.generation||0)!==t.context.targetGeneration)return;if(e.linkedZones(t.owner,source.card.uid).includes(zone)&&!e.state.players[t.owner].monsters[zone])e.special(t.owner,target.card.uid,{via:'revive',zone});});
  function sheepTypes(e,uid){return new Set([0,1].flatMap(p=>e.monsters(p)).filter(m=>m.faceUp&&e.pointsTo(uid,m.uid)).map(m=>CARDS[m.id].type));}
  E.trigger('cross-sheep','follow',{label:'交织绵羊：按指向怪兽类型继续展开',once:once('follow'),summons:(e,c)=>sheepTypes(e,c.uid).has('fusion'),
      condition:(e,c)=>self(e,c)&&[...sheepTypes(e,c.uid)].some(t=>['ritual','fusion','synchro','xyz'].includes(t)),
    resolve:(e,c)=>{
        const types=[...sheepTypes(e,c.uid)];if(types.includes('ritual')){e.draw(c.owner,2);const list=hand(e,c.owner);if(list.length)e.queueChoice(c.owner,'交织绵羊：仪式效果丢弃2张手牌',H.options(e,c,list),Math.min(2,list.length),Math.min(2,list.length),'discard-selected',{source:c.source,role:'discard'});}if(types.includes('fusion')){
        const list=H.specialable(e,c.owner,grave(e,c.owner,m=>isMonster(CARDS[m.id])&&CARDS[m.id].level>0&&CARDS[m.id].level<=4),'revive');
        if(list.length)e.queueChoice(c.owner,'交织绵羊：复活4星以下怪兽',H.options(e,c,list),1,1,'special-selected',{source:c.source,via:'revive',role:'tear-special'});
      }
      e.queue({op:'cross-sheep-followup',owner:c.owner,context:{source:c.source,types}});
    }});
  E.op('cross-sheep-followup',(e,t)=>{for(const [type,owner,amount] of [['synchro',t.owner,700],['xyz',1-t.owner,-700]])if(t.context.types.includes(type))for(const m of e.monsters(owner))if(m.faceUp)e.modify(m.uid,'atk','add',amount,null,t.context.source);});
  E.passive('apollousa',{originalAttack:(e,m)=>(m.materialCount||0)*800});
  E.quick('apollousa','negate',{label:'神弓：下降800攻击力，无效怪兽效果发动',main:false,damageStep:true,
    condition:(e,c)=>{const last=c.event.window?.chainLast,m=self(e,c);return m&&last?.owner!==c.owner&&monsterEffect(last)&&e.attackValue(m)>=800&&m.apollousaChain!==last.chainId;},
    cost:(e,c)=>{source(e,c).card.apollousaChain=c.event.window.chainLast.chainId;},
    resolve:(e,c)=>{const m=self(e,c);if(m&&e.attackValue(m)>=800&&e.modify(m.uid,'atk','add',-800,null,c.source))e.negateLink(c.responseTo,c.source,true,false);},aiResponse:()=>2400});
  E.trigger('accesscode-talker','gain',{label:'访问码：取得连接素材的Link值×1000攻击力',unanswerableByOpponent:true,
    inputs:(e,c)=>[group(e,c,'target','选择作为连接素材的Link怪兽',[0,1].flatMap(p=>H.cards(e,p,['grave','banished'],m=>link(m)&&(self(e,c)?.linkMaterialUids||[]).includes(m.uid))),1,1,{role:'accesscode-gain'})],
    resolve:(e,c)=>{const m=self(e,c),f=e.find(first(c));if(m&&f&&['grave','banished'].includes(f.zone)&&link(f.card))e.modify(m.uid,'atk','add',CARDS[f.card.id].linkRating*1000,null,c.source);}});
  const accessCosts=(e,c)=>H.cards(e,c.owner,['monsters','extraMonster','grave'],(m,f)=>link(m)&&(f.zone==='grave'||m.faceUp)&&!e.wasUsed(c.owner,{id:'accesscode-talker'},'attribute:'+e.attribute(m),'name'));
  E.register('accesscode-talker','destroy',{label:'访问码：除外Link怪兽，破坏对方1张卡',unanswerableByOpponent:true,destroys:true,
    condition:(e,c)=>e.field(1-c.owner).length>0,
    inputs:(e,c)=>[group(e,c,'cost','选择除外的Link怪兽（本回合未使用的属性）',accessCosts(e,c),1,1,{role:'accesscode-cost'})],
    cost:(e,c)=>{const f=e.find(first(c,'cost'));c.banishedAttribute=e.attribute(f.card);e.move(f.card.uid,'banished',{kind:'cost-banish',source:c.source,byOwner:c.owner});},
    resolve:(e,c)=>{e.useKey(c.owner,{id:c.sourceId},'attribute:'+c.banishedAttribute,'name');const targets=e.field(1-c.owner);if(targets.length)e.queueChoice(c.owner,'访问码：选择破坏的对方卡片',H.options(e,c,targets),1,1,'destroy-selected',{source:c.source,role:'destroy'});},aiScore:1950});
  E.trigger('linkuriboh','attack-zero',{label:'连接栗子球：解放自身，使攻击怪兽攻击力归零',leavesAsCost:true,
    cost:(e,c)=>H.tributeCost(e,c,[c.uid]),
    resolve:(e,c)=>{const a=e.state.frame?.attack,f=a?e.find(a.uid):null;if(f&&H.fieldZone(f.zone)&&(f.card.generation||0)===a.generation)e.modify(f.card.uid,'atk','set',0,e.state.turn,c.source);},aiTrigger:(e,c)=>H.damageThreat(e,c.event.attack,c.owner)>0});
  E.quick('linkuriboh','revive',{label:'解放1星怪兽，复活连接栗子球',zones:['grave'],once:once('revive'),summons:true,
    condition:(e,c)=>e.canSpecial(c.owner,source(e,c).card,{via:'revive'}),
    inputs:(e,c)=>[group(e,c,'cost','选择解放的1星怪兽',monsters(e,c.owner,m=>m.faceUp&&e.level(m)===1&&!CARDS[m.id].cannotTribute),1,1,{role:'cost'})],cost:(e,c)=>H.tributeCost(e,c,args(c,'cost')),
    resolve:(e,c)=>{if(e.find(c.uid)?.zone==='grave')e.special(c.owner,c.uid,{via:'revive'});},aiScore:300,aiResponse:(e,c,w)=>w.attack&&w.attack.owner!==c.owner?1700:0});
  E.on('summon',(e,v)=>{
    if(v.kind==='link'&&['knightmare-phoenix','knightmare-unicorn'].includes(v.id))e.addTrigger(v.uid,v.id+'::entry',v);
    if(v.kind==='link'&&v.id==='accesscode-talker')e.addTrigger(v.uid,'accesscode-talker::gain',v);
    if(['normal','flip','set'].includes(v.kind))return;
    for(const owner of [0,1])for(const m of e.monsters(owner))if(m.id==='cross-sheep'&&m.faceUp&&e.pointsTo(m.uid,v.uid))e.addTrigger(m.uid,'cross-sheep::follow',v,{owner});
  });
  E.on('move',(e,v)=>{if(['dharc-charmer','eria-charmer'].includes(v.id)&&v.previous.summonKind==='link'&&v.previous.owner===v.previous.originalOwner&&(v.kind==='battle'||v.kind==='destroy'&&v.byOwner!==v.previous.owner))e.addTrigger(v.uid,v.id+'::search',v,{owner:v.previous.originalOwner});});
  E.on('attack',(e,v)=>{for(const m of e.monsters(1-v.owner))if(m.id==='linkuriboh'&&m.faceUp)e.addTrigger(m.uid,'linkuriboh::attack-zero',v,{owner:1-v.owner});});
  const priorScore=E.extraCandidateScore;
  E.extraCandidateScore=(e,c,o,role)=>{
    const d=CARDS[o.cardId];if(!d)return priorScore?.(e,c,o,role);
    if(role==='accesscode-gain')return (d.linkRating||0)*1000;
    if(role==='accesscode-cost'){const f=e.find(o.uid);return f?.zone==='grave'?10000+(d.linkRating||0):o.uid===c.uid?-20000:-e.cardUtility(f.card,c.owner);}
    if(role==='link-choice')return {'knightmare-unicorn':e.field(1-c.owner).length?20000:5000,'apollousa':18000,'accesscode-talker':e.field(1-c.owner).length?17000:5000,'knightmare-phoenix':e.spells(1-c.owner).length?15000:1000,'cross-sheep':7000}[d.id]||5000;
    return priorScore?.(e,c,o,role);
  };
  E.linkScore=(e,c,opt)=>{
    const owner=e.state.active,own=e.monsters(owner),foes=e.field(1-owner),p=e.state.players[owner];
    if(own.some(m=>m.faceUp&&m.id===c.id))return -100;
    const minLoss=Math.min(...opt.combos.map(set=>set.materials.reduce((n,uid)=>{const m=e.find(uid).card;return n+e.attackValue(m)+(CARDS[m.id].type==='fusion'?1700:0);},0)));
    let value={'linkuriboh':300,'cross-sheep':900,'ip-masquerena':1000,'knightmare-phoenix':e.spells(1-owner).length&&p.hand.length?1400:-100,'knightmare-unicorn':foes.length&&p.hand.length?1450:-100,'dharc-charmer':grave(e,1-owner,m=>isMonster(CARDS[m.id])&&CARDS[m.id].attribute==='暗').length?1500:700,'eria-charmer':grave(e,1-owner,m=>isMonster(CARDS[m.id])&&CARDS[m.id].attribute==='水').length?1500:700,'apollousa':1550,'accesscode-talker':foes.length?1800:950}[c.id]||500;
    return value>0?value-minLoss/12:-100;
  };
})(globalThis);
