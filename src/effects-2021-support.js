/* 2021 finishers and explicitly counted older interaction dependencies. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,I,is,A,Q,passive,extend,card,def,field,monster,allF,allM,ownM,hand,deck,grave,first,args,g,choose,target,moved,destroy,onEntry,onStandby,revive,series,cast,lock,locked}=X;
 const Y=X.year2021,{limit,choiceContext,canSend,fm}=Y;
 const anima='Relinquished Anima';
 A(anima,'y21-equip',{once:limit('anima-equip'),condition:(e,c)=>!e.spells(c.owner).some(m=>m.equipTarget===c.uid&&m.y21AnimaEquip)&&e.state.players[c.owner].spells.includes(null),inputs:target('选择装备的怪兽',(e,c)=>allM(e).filter(m=>m.faceUp&&e.pointsTo(c.uid,m.uid))),resolve:(e,c)=>{const u=first(c),m=card(e,u);if(m&&m.faceUp&&e.pointsTo(c.uid,u)&&e.equipMonster(u,c.uid,c.owner,c.source))m.y21AnimaEquip=true;},aiScore:1300});
 passive(anima,{stat:(e,s,m,k)=>m.uid===s.card.uid&&k==='atk'?e.spells(s.owner).filter(q=>q.equipTarget===m.uid&&q.y21AnimaEquip).reduce((n,q)=>n+(q.equipStats?.atk||0),0):0});
 const baronne='Baronne de Fleur';
 A(baronne,'y21-destroy',{once:H.once('y21-baronne-destroy','card'),inputs:target('选择破坏的卡片',e=>allF(e)),resolve:(e,c)=>destroy(e,c,args(c)),aiScore:1300});
 Q(baronne,'y21-negate',{main:false,damageStep:true,once:limit('baronne-negate'),condition:(e,c)=>!!c.event.window?.chainLast&&!card(e,c.uid)?.y21BaronneUsed,cost:(e,c)=>card(e,c.uid).y21BaronneUsed=true,resolve:(e,c)=>e.negateLink(c.responseTo,c.source,true,true),aiResponse:(e,c)=>c.event.window.chainLast.owner!==c.owner?2300:0});
 onStandby(baronne,{once:H.once('y21-baronne-return','card'),inputs:target('选择特殊召唤的怪兽',(e,c)=>grave(e,c.owner,m=>monster(m)&&e.level(m)<=9&&e.canSpecial(c.owner,m,{via:'revive'})),'special'),resolve:(e,c)=>{moved(e,c,[c.uid],'extra','effect-return');if(e.find(c.uid)?.zone==='extra')revive(e,c,first(c));}},{both:true});
 const rose='Ruddy Rose Dragon';
 onEntry(rose,'y21-banish',{resolve:(e,c)=>{moved(e,c,[...grave(e,0),...grave(e,1)].map(m=>m.uid),'banished','effect-banish');if(c.event.materials?.some(m=>is(m,'Black Rose Dragon')||def(m).type==='synchro'&&def(m).race==='植物族'))destroy(e,c,allF(e).filter(m=>m.uid!==c.uid).map(m=>m.uid));}},['synchro']);
 Q(rose,'y21-negate',{main:false,damageStep:true,summons:true,condition:(e,c)=>c.event.window?.chainLast?.owner===1-c.owner&&E.willDestroy(e,c.event.window.chainLast)&&e.canTribute(card(e,c.uid),c.owner),cost:(e,c)=>X.tribute(e,c,[c.uid]),resolve:(e,c)=>{if(e.negateLink(c.responseTo,c.source,true,false))X.specialChoice(e,c,[...Y.extra(e,c.owner),...grave(e,c.owner)].filter(m=>is(m,'Black Rose Dragon')),{via:'effect'});},aiResponse:()=>2000});
 const protos='Archnemeses Protos';C(protos).specialOnly='year-special:y21-protos';
 const protoPool=(e,c)=>[...grave(e,c.owner),...ownM(e,c).filter(m=>m.faceUp)].filter(monster);
 A(protos,'y21-special',{zones:['hand'],inherent:true,summons:true,banishesCost:true,inputs:(e,c)=>[Y.materialChoices(e,c,g(e,c,'cost','选择不同属性的怪兽',protoPool(e,c),3,3,'cost'),us=>new Set(us.map(u=>e.attribute(card(e,u)))).size===3)],cost:(e,c)=>moved(e,c,args(c,'cost'),'banished','cost-banish'),resolve:(e,c)=>revive(e,c,c.uid,{via:'year-special:y21-protos'}),aiScore:1500});
 passive(protos,{protect:(e,s,m,b)=>!b&&m.uid===s.card.uid});
 A(protos,'y21-destroy',{once:limit('protos-destroy'),inputs:(e,c)=>[H.customGroup('attribute','选择属性',[...new Set(allM(e).filter(m=>m.faceUp).map(m=>e.attribute(m)))].map(uid=>({uid,label:uid,value:e.monsters(1-c.owner).filter(m=>m.faceUp&&e.attribute(m)===uid).length*1000})))],resolve:(e,c)=>{const attr=first(c,'attribute');destroy(e,c,allM(e).filter(m=>m.faceUp&&e.attribute(m)===attr).map(m=>m.uid));for(const p of [0,1])lock(e,p,'y21Protos-'+attr,true,e.state.turn+1);},aiScore:1500});
 extend('canSpecial',function(prior,p,m,o={}){return !locked(this,p,'y21Protos-'+this.attribute(m))&&prior.call(this,p,m,o);});
 Q('Dimension Shifter','y21-banish',{zones:['hand'],main:true,condition:(e,c)=>!grave(e,c.owner).length&&canSend(e,card(e,c.uid)),cost:(e,c)=>H.sendCost(e,c,[c.uid]),resolve:(e,c)=>e.state.y21ShifterUntil=e.state.turn+1,aiScore:900,aiResponse:()=>1600});
 extend('move',function(prior,u,to,o={}){if(to==='grave'&&this.state.y21ShifterUntil>=this.state.turn)to='banished';return prior.call(this,u,to,o);});
 extend('graveCostAllowed',function(prior,m){return !(this.state.y21ShifterUntil>=this.state.turn)&&(prior?.call(this,m)??true);});
 const nameKey=id=>{const d=D.CARDS[id];return d?.nameAlias||d?.officialName||d?.en||id;};
 cast('Crossout Designator',null,(e,c)=>{const id=first(c,'name'),m=deck(e,c.owner,q=>nameKey(q.id)===nameKey(id))[0];if(!m)return;moved(e,c,[m.uid],'banished','effect-banish');if(e.find(m.uid)?.zone==='banished')(e.state.y21Crossout||=[]).push({name:nameKey(id),turn:e.state.turn});e.shuffle(e.state.players[c.owner].deck);},{once:limit('crossout'),deckInteraction:true,inputs:(e,c)=>[H.customGroup('name','宣言卡名',[...new Set(deck(e,c.owner).map(m=>m.id))].map(uid=>({uid,label:D.CARDS[uid].name,value:nameKey(uid)===nameKey(c.event.window?.chainLast?.sourceId)?2000:0})))],aiResponse:()=>1700});
 const crossed=(e,id)=>(e.state.y21Crossout||[]).some(r=>r.turn===e.state.turn&&r.name===nameKey(id));
 extend('negated',function(prior,m){return !!(m&&field(this.find(m.uid)?.zone)&&m.faceUp&&crossed(this,m.id))||prior.call(this,m);});
 extend('activeSpell',function(prior,m,...a){return !(m&&crossed(this,m.id))&&prior.call(this,m,...a);});
 extend('earlyNegatesLink',function(prior,l,...a){return crossed(this,l.sourceId)||prior.call(this,l,...a);});
 // Lingering card effects (including Maxx "C") also draw outside a chain.
 // Rule rewards use ruleDraw; opening hands and normal draws remain separate.
 extend('draw',function(prior,p,n,...a){const effect=this._advancedReady&&!this.state.inDrawPhase&&!this._ruleRewardDraw;if(effect&&locked(this,p,'y21NoEffectDraw'))return;const before=this.state.players[p].hand.length,r=prior.call(this,p,n,...a);if(effect&&this.state.players[p].hand.length>before)this.state.players[p].y21EffectDraw=this.state.turn;return r;});
 extend('earlyCanUse',function(prior,c,a){return !(a.drawsOnly&&locked(this,c.owner,'y21NoEffectDraw'))&&prior.call(this,c,a);});
 const pot='Pot of Prosperity';
 cast(pot,null,(e,c)=>{lock(e,1-c.owner,'y21HalfDamage');const top=deck(e,c.owner).slice(0,args(c,'cost').length);e.revealCards(c.owner,top,'翻开卡组');choose(e,c,'选择加入手牌的卡片',top,1,1,'y21-prosperity',{top:top.map(m=>m.uid),role:'search',reveal:true});},{once:limit('prosperity'),deckInteraction:true,condition:(e,c)=>e.state.players[c.owner].y21EffectDraw!==e.state.turn&&deck(e,c.owner).length>=3,inputs:(e,c)=>{const n=Y.extra(e,c.owner).length;return [H.customGroup('count','选择除外数量',[3,6].filter(k=>n>=k&&deck(e,c.owner).length>=k).map(k=>({uid:String(k),label:String(k),value:k}))),g(e,c,'cost','选择里侧除外的额外卡片',Y.extra(e,c.owner),Number(first(c,'count')||3),Number(first(c,'count')||3),'cost')];},cost:(e,c)=>{Y.banishDown(e,c,args(c,'cost'),'cost-banish');lock(e,c.owner,'y21NoEffectDraw');}});
 E.op('y21-prosperity',(e,t)=>{moved(e,choiceContext(t),t.picks,'hand','effect-search');Y.orderDeck(e,choiceContext(t),t.context.top.filter(u=>!t.picks.includes(u)));});
 extend('damage',function(prior,p,n,k,...a){return prior.call(this,p,locked(this,p,'y21HalfDamage')?Math.ceil(n/2):n,k,...a);});
 for(const [name,mode]of [['Pot of Greed','cast'],['Pot of Desires','cast'],['Card of Demise','cast'],['Upstart Goblin','cast'],['One Day of Peace','cast'],['Maxx "C"','era-draw'],['Swordsoul of Mo Ye','y21-draw'],['Swordsoul Sinister Sovereign - Qixing Longyuan','y21-draw'],['Tri-Brigade Ferrijit the Barren Blossom','y21-draw'],['Floowandereeze and the Unexplored Winds','y21-cycle']]){const a=E.get(C(name)?.id+'::'+mode);if(a)a.drawsOnly=true;}
})(globalThis);
