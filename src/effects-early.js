(function(root){
 'use strict';
 const E=root.DuelEffects,D=root.DuelData,{CARDS,isMonster}=D,H=E.H;
 const cardIds=new Map();
 const C=name=>{let id=cardIds.get(name);if(!id){const card=D.cardByName(name);if(!card)return undefined;id=card.id;cardIds.set(name,id);}return CARDS[id];},I=name=>{const c=C(name);if(!c)throw new Error('Unknown early card: '+name);return c.id;};
 const is=(m,name)=>!!m&&m.id===C(name)?.id;
 const p=(e,c)=>e.state.players[c.owner],opp=c=>1-c.owner;
 const mark=(name,note='效果已接入本作规则',status='implemented')=>{const c=C(name);if(c){c.implementationStatus=status;c.implementationNote=note;}};
 const label=(name,s)=>{mark(name,s.note);return {label:C(name).name,...s};};
 const S=(name,s)=>E.spell(I(name),label(name,s)),T=(name,s)=>E.trap(I(name),label(name,s));
 const A=(name,mode,s)=>E.register(I(name),mode,label(name,s)),Q=(name,mode,s)=>E.quick(I(name),mode,label(name,s)),R=(name,mode,s)=>E.trigger(I(name),mode,label(name,s));
 const passive=(name,handlers,note)=>{mark(name,note);E.passive(I(name),handlers);};
 const allM=e=>[...e.monsters(0),...e.monsters(1)],allS=e=>[...e.spells(0),...e.spells(1)],allF=e=>[...e.field(0),...e.field(1)];
 const monster=m=>!!m&&!!CARDS[m.id]&&isMonster(CARDS[m.id]),face=m=>m.faceUp,ownM=(e,c)=>e.monsters(c.owner),foeM=(e,c)=>e.monsters(1-c.owner);
 const exact=(e,c,uid,predicate=()=>true)=>{const f=e.find(uid);return f&&predicate(f)&&(!H.fieldZone(f.zone)||!e.unaffected(f.card,c.source))?f:null;};
 const moved=(e,c,uids,destination,kind='effect-move')=>{for(const uid of uids){const f=exact(e,c,uid);if(f)e.move(uid,destination,{kind,source:c.source,byOwner:c.owner});}};
 const destroy=(e,c,uids)=>{for(const uid of uids)if(exact(e,c,uid))e.destroy(uid,c.source);};
 const chosen=(e,c,key='target')=>H.args(c,key).map(uid=>e.find(uid)).filter(Boolean).map(f=>f.card);
 const choose=(e,c,title,list,min,max,op,context={})=>{if(list.length>=min)e.queueChoice(c.owner,title,H.options(e,c,list,{reveal:!!context.reveal}),min,Math.min(max,list.length),op,{source:c.source,...context});};
 const g=(e,c,key,title,list,min=1,max=1,role='destroy')=>H.group(e,c,key,title,list,min,max,{role});
 const target=(title,list,role='destroy',min=1,max=1)=>(e,c)=>[g(e,c,'target',title,list(e,c),min,max,role)];
 const drawDiscard=(e,c,draw,n,owner=c.owner)=>{if(draw)e.draw(owner,draw);if(e.state.winner===null){const list=H.hand(e,owner);if(list.length)e.queueChoice(owner,'选择丢弃'+Math.min(n,list.length)+'张手牌',H.options(e,{...c,owner},list),Math.min(n,list.length),Math.min(n,list.length),'early-discard',{source:c.source,role:'discard'});}};
 const randomDiscard=(e,owner,count,source)=>{for(let i=0;i<count;i++){const hand=e.state.players[owner].hand;if(!hand.length)break;const card=hand[Math.floor(e.random()*hand.length)];e.move(card.uid,'grave',{kind:'effect-discard',source,byOwner:source?.owner});}};
 const pay=(e,c,n)=>e.payLP(c.owner,n),once=()=>H.once('early','card');
 const races=['战士族','魔法师族','龙族','恶魔族','天使族','不死族','机械族','兽族','兽战士族','鸟兽族','水族','鱼族','海龙族','雷族','炎族','岩石族','植物族','昆虫族','爬虫类族','恐龙族','念动力族','电子界族','幻龙族'];
 const attrs=['光','暗','地','水','炎','风','神'];
 const declare=(key,title,values)=>H.customGroup(key,title,values.map(x=>({uid:key+':'+x,label:x}))),declared=(c,key)=>H.first(c,key)?.slice(key.length+1);
 const entry=new Map(),flips=new Map(),moves=new Map(),standby=new Map(),damage=new Map(),battleWins=new Map();
 function onEntry(name,mode,s,kinds=['normal','flip']){R(name,mode,s);const id=I(name);(entry.get(id)||entry.set(id,[]).get(id)).push({mode,kinds});}
 function onFlip(name,s){R(name,'flip',{zones:['monsters','extraMonster','grave','banished'],...s});flips.set(I(name),true);}
 function onMove(name,mode,s,test){R(name,mode,{zones:['grave','banished','deck','hand','spells'],...s});(moves.get(I(name))||moves.set(I(name),[]).get(I(name))).push({mode,test,mandatory:!!s.mandatory});}
 function onStandby(name,s,{opponent=false,grave=false,both=false,optional=true}={}){R(name,'standby',{zones:grave?['grave']:['monsters','extraMonster','spells','fieldSpell'],...s});standby.set(I(name),{opponent,grave,both,optional});}
 function onDamage(name,s){R(name,'battle-damage',{zones:['monsters','extraMonster'],...s});damage.set(I(name),true);}
 function onBattleWin(name,s){R(name,'battle-win',s);battleWins.set(I(name),true);}
 const src=(e,m,owner=e.find(m.uid)?.owner)=>({id:m.id,uid:m.uid,generation:m.generation||0,owner,effectType:isMonster(CARDS[m.id])?'monster':CARDS[m.id].type});
 const active=(e,m)=>m.faceUp&&(H.fieldZone(e.find(m.uid)?.zone)?!e.negated(m):e.activeSpell(m));
 const ctx=(e,m,owner)=>({uid:m.uid,owner:owner??e.find(m.uid)?.owner,sourceId:m.id,source:src(e,m,owner),args:{},event:{}});
 const GYbattle=v=>v.to==='grave'&&v.kind==='battle',GYfield=v=>v.to==='grave'&&H.fieldZone(v.from);
 const discardCost=(n=1,pred=()=>true)=>(e,c)=>g(e,c,'cost','选择丢弃的手牌',H.hand(e,c.owner,m=>m.uid!==c.uid&&pred(m)),n,n,'cost');
 const tributeInput=(n=1,pred=()=>true)=>(e,c)=>g(e,c,'cost','选择解放的怪兽',ownM(e,c).filter(m=>e.canTribute(m,c.owner)&&pred(m)),n,n,'cost');
 const tribute=(e,c,uids=H.args(c,'cost'))=>{for(const uid of uids){const f=e.find(uid);if(!f||!e.canTribute(f.card,c.owner))throw new root.DuelRuleError('不能解放选择的卡片。');}for(const uid of uids)e.move(uid,'grave',{kind:'cost-tribute',source:c.source,byOwner:c.owner});};
 const burn=(e,c,n)=>e.damage(1-c.owner,n,'效果');
 E.op('early-confirm',()=>{});
 E.op('early-discard',(e,t)=>moved(e,{source:t.context.source,owner:t.context.source?.owner??t.owner},t.picks,'grave','effect-discard'));
 E.op('early-special',(e,t)=>{for(const uid of t.picks){const f=e.find(uid);if(f&&e.canSpecial(t.owner,f.card,{via:t.context.via||'effect'})&&e.freeZones(t.owner,f.card).length)e.special(t.owner,uid,{via:t.context.via||'effect',position:t.context.position||'attack',faceDown:!!t.context.faceDown});}if(t.context.shuffle)e.shuffle(e.state.players[t.owner].deck);});
 E.op('early-move',(e,t)=>{moved(e,{owner:t.owner,source:t.context.source},t.picks,t.context.to,t.context.kind||'effect-move');if(t.context.shuffle)e.shuffle(e.state.players[t.owner].deck);});
 E.op('early-ritual-target',(e,t)=>e.queue({op:'ritual-materials',uid:t.picks[0],owner:t.owner,spellId:t.context.spellId,source:t.context.source}));
 for(const c of D.CARD_LIST.filter(c=>c.spellKind==='ritual')){
  S(c.officialName,{label:'仪式召唤 · '+(c.ritualTarget?CARDS[c.ritualTarget].name:c.name),summons:true,condition:(e,x)=>e.ritualOptions(x.owner,x.sourceId).length>0,resolve:(e,x)=>choose(e,x,'选择要降临的仪式怪兽',e.ritualOptions(x.owner,x.sourceId),1,1,'early-ritual-target',{spellId:x.sourceId,role:'special'}),aiScore:1080});
 }
 E.on('summon',(e,v)=>{for(const def of entry.get(v.id)||[])if(def.kinds.includes(v.kind)||def.kinds.includes('*')||def.kinds.includes('special')&&!['normal','flip','set'].includes(v.kind))e.addTrigger(v.uid,v.id+'::'+def.mode,v);const m=e.find(v.uid)?.card;if(m&&CARDS[m.id].spirit)m.spiritReturnTurn=e.state.turn;e.state.earlyLastSummon={...cp(v),turn:e.state.turn};});
 function cp(v){return JSON.parse(JSON.stringify(v));}
 E.on('flip',(e,v)=>{const m=e.find(v.uid)?.card;if(m&&CARDS[m.id].spirit)m.spiritReturnTurn=e.state.turn;if(flips.has(v.id)&&!v.previous?.wasNegated&&!e.hasEarly('Royal Command')&&!e.hasEarly('Fiend Skull Dragon'))e.addTrigger(v.uid,v.id+'::flip',v,{owner:v.owner,mandatory:true});});
 E.on('move',(e,v)=>{for(const def of moves.get(v.id)||[])if(def.test.length<2?def.test(v):def.test(e,v))e.addTrigger(v.uid,v.id+'::'+def.mode,v,{owner:e.find(v.uid)?.owner??v.owner,mandatory:def.mandatory});if(v.to==='grave'){const m=e.find(v.uid)?.card;if(m)m.earlySent={turn:e.state.turn,from:v.from,kind:v.kind,byOwner:v.byOwner,byEffect:v.byEffect,previous:v.previous};}});
 E.on('standby',(e,v)=>{for(const owner of [0,1])for(const f of e.refs(owner,['monsters','extraMonster','spells','fieldSpell','grave'])){const def=standby.get(f.card.id);if(!def||(def.grave?f.zone!=='grave':f.zone==='grave'||!active(e,f.card)))continue;if(def.both||def.opponent?v.owner!==owner||def.both:v.owner===owner)e.addTrigger(f.card.uid,f.card.id+'::standby',v,{owner,mandatory:!def.optional});}});
 E.on('damage',(e,v)=>{if(!v.battle||!v.attack)return;const uid=v.owner===v.attack.owner?v.attack.target:v.attack.uid,m=e.find(uid)?.card;if(m&&damage.has(m.id)&&!e.negated(m))e.addTrigger(uid,m.id+'::battle-damage',v,{owner:1-v.owner});});
 E.on('battle-win',(e,v)=>{if(battleWins.has(v.id)&&!e.negated(e.find(v.uid)?.card||{}))e.addTrigger(v.uid,v.id+'::battle-win',v);});
 const API={E,D,H,C,I,is,p,opp,mark,S,T,A,Q,R,passive,allM,allS,allF,monster,face,ownM,foeM,exact,moved,destroy,chosen,choose,g,target,drawDiscard,randomDiscard,pay,once,races,attrs,declare,declared,onEntry,onFlip,onMove,onStandby,onDamage,onBattleWin,src,active,ctx,GYbattle,GYfield,discardCost,tributeInput,tribute,burn};
 root.DuelEarly=API;
 if(typeof module!=='undefined'){module.exports=API;require('./effects-early-spells.js');require('./effects-early-monsters.js');require('./effects-early-traps.js');}
})(globalThis);
