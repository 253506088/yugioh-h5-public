/* 2013 per-card rules: the Chronomaly, Gimmick Puppet and Sylvan themes.
 * Registered from effects-2013.js. Sylvan cards share one excavate routine so
 * the "place the rest on the bottom" ordering stays in one place. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,I,is,A,Q,R,passive,mark,extend,allM,allS,allF,monster,face,ownM,foeM,hand,deck,grave,first,args,self,src,active,field,has,g,choose,target,moved,destroy,pay,once,onEntry,onFlip,onMove,onEnd,onStandby,onDamage,onBattleWin,revive,search,specialChoice,series,guard,defer,card,def,names,effect,cast,watch,sent,aura,ownAura,protect,lock,locked,stat,summonCost,specialSelf}=X,{CARDS}=D;
 const S=cast,T=cast;
 const chronomaly=m=>series(m,'Chronomaly'),puppet=m=>series(m,'Gimmick Puppet');
 const sylvan=m=>series(m,'Sylvan'),plant=(e,m)=>monster(m)&&e.race(m)==='植物族';
 // Excavate the top n cards: Plant-Type monsters go to the Graveyard, the rest
 // keep their order and are placed on the bottom of the Deck.
 function excavate(e,c,n,pred){
  const p=e.state.players[c.owner],kept=[],milled=[];
  for(let i=0;i<n&&p.deck.length;i++){const m=p.deck.pop();if(pred(m)){milled.push(m);moved(e,c,[m.uid],'grave','effect-send');}else kept.unshift(m);}
  for(const m of kept)p.deck.unshift(m);
  return {kept,milled};
 }
 function sylvanExcavate(e,c,n,event){
  const {milled}=excavate(e,c,n,m=>plant(e,m));
  for(const m of milled)e.addTrigger(m.uid,m.id+'::era-sylvan',event||c.event,{owner:c.owner});
 }
 // ==========================================================================
 // Chronomaly
 // ==========================================================================
 onEntry('Chronomaly Nebra Disk','era-search',{resolve:(e,c)=>search(e,c,deck(e,c.owner,m=>chronomaly(m)&&m.id!==c.sourceId))},['normal']);
 effect('Chronomaly Nebra Disk',null,(e,c)=>revive(e,c,c.uid,{position:'defense'}),{zones:['grave'],mode:'era-nebra',summons:true,once:H.once('nebra'),condition:(e,c)=>ownM(e,c).length>0&&ownM(e,c).every(m=>chronomaly(m))});
 effect('Chronomaly Cabrera Trebuchet',(e,c)=>foeM(e,c).filter(m=>m.faceUp),(e,c)=>{const m=card(e,first(c,'target'));if(m)e.modify(m.uid,'atk','set',0,e.state.turn,c.source);},{mode:'era-zero',inputs:(e,c)=>[g(e,c,'cost','选择解放的其他先史遗产',ownM(e,c).filter(m=>chronomaly(m)&&m.uid!==c.uid),1,1,'cost'),g(e,c,'target','选择攻击力归零的对方怪兽',foeM(e,c).filter(m=>m.faceUp),1,1,'target')],cost:(e,c)=>X.tribute(e,c,args(c,'cost'))});
 effect('Chronomaly Sol Monolith',(e,c)=>ownM(e,c).filter(m=>m.faceUp&&chronomaly(m)),(e,c)=>{const m=card(e,first(c));if(m)m.levelOverride={value:6,until:e.state.turn};lock(e,c.owner,'chronomalyOnly');},{mode:'era-level',once:H.once('sol'),role:'own-boost',inputs:(e,c)=>[g(e,c,'target','选择等级变为6的先史遗产',ownM(e,c).filter(m=>m.faceUp&&chronomaly(m)),1,1,'own-boost')]});
 specialSelf('Chronomaly Tula Guardian',(e,c)=>allS(e).some(m=>m.faceUp&&CARDS[m.id].type==='spell'&&CARDS[m.id].spellKind==='field'));
 specialSelf('Chronomaly Aztec Mask Golem',(e,c)=>e.state.players[c.owner].eraChronoSpell===e.state.turn&&ownM(e,c).length===0);
 E.on('era-activation',(e,v)=>{if(CARDS[v.id]?.type!=='spell')return;const m=card(e,v.uid);if(m&&chronomaly(m))e.state.players[v.owner].eraChronoSpell=e.state.turn;});
 specialSelf('Chronomaly Moai Carrier',(e,c)=>ownM(e,c).length===0&&e.field(1-c.owner).length>0);
 onEntry('Chronomaly Winged Sphinx','era-revive',{summons:true,inputs:(e,c)=>[g(e,c,'target','选择复活的5星先史遗产',grave(e,c.owner,m=>chronomaly(m)&&e.level(m)===5),1,1,'special')],resolve:(e,c)=>{if(revive(e,c,first(c)))lock(e,c.owner,'chronomalyOnly');}},['normal']);
 cast('Chronomaly City Babylon',null,(e,c)=>{}, {zones:['hand'],role:'field'});
 effect('Chronomaly City Babylon',null,(e,c)=>{}, {zones:['fieldSpell'],mode:'era-babylon',summons:true,once:H.once('babylon','name'),inputs:(e,c)=>[g(e,c,'cost','选择除外的先史遗产',grave(e,c.owner,chronomaly),1,1,'cost')],cost:(e,c)=>{c.eraLevel=e.level(card(e,first(c,'cost')));moved(e,c,args(c,'cost'),'banished','cost-banish');},resolve:(e,c)=>{const list=grave(e,c.owner,m=>chronomaly(m)&&e.level(m)===c.eraLevel);if(list.length)choose(e,c,'选择复活的同等级先史遗产',list,0,1,'era-babylon-revive',{role:'special'});}});
 E.op('era-babylon-revive',(e,t)=>{if(t.picks[0])revive(e,{owner:t.owner,source:t.context.source},t.picks[0]);});
 // ==========================================================================
 // Gimmick Puppet
 // ==========================================================================
 specialSelf('Gimmick Puppet Magnet Doll',(e,c)=>foeM(e,c).length>0&&ownM(e,c).length>0&&ownM(e,c).every(m=>m.faceUp&&puppet(m)));
 effect('Gimmick Puppet Dreary Doll',null,(e,c)=>revive(e,c,c.uid),{zones:['grave'],mode:'era-dreary',summons:true,once:H.once('dreary'),inputs:(e,c)=>[g(e,c,'cost','选择除外的其他机关傀儡',grave(e,c.owner,m=>puppet(m)&&m.uid!==c.uid),1,1,'cost')],cost:(e,c)=>moved(e,c,args(c,'cost'),'banished','cost-banish')});
 effect('Gimmick Puppet Des Troy',(e,c)=>allM(e).filter(puppet),(e,c)=>destroy(e,c,args(c)),{mode:'era-troy',once:H.once('troy'),inputs:(e,c)=>[g(e,c,'target','选择破坏的机关傀儡',allM(e).filter(puppet),1,1,'destroy')]});
 sent('Gimmick Puppet Des Troy',(e,c)=>{const list=hand(e,c.owner,puppet);if(list.length)specialChoice(e,c,list.slice(0,2));},(e,v)=>v.from==='monsters'&&v.to==='grave');
 effect('Gimmick Puppet Egg Head',null,(e,c)=>{if(c.eraPick==='burn')X.burn(e,c,800);else if(self(e,c))self(e,c).levelOverride={value:8,until:e.state.turn};},{mode:'era-egg',inputs:(e,c)=>[g(e,c,'cost','选择丢弃的机关傀儡',hand(e,c.owner,puppet),1,1,'cost'),H.customGroup('pick','选择效果',[{uid:'burn',label:'造成800伤害',value:1},{uid:'level',label:'等级变为8',value:2}],1,1)],cost:(e,c)=>{H.discard(e,c,args(c,'cost'));c.eraPick=first(c,'pick');}});
 onEntry('Gimmick Puppet Scissor Arms','era-mill',{inputs:(e,c)=>[g(e,c,'send','选择送去墓地的机关傀儡',deck(e,c.owner,puppet),1,1,'cost')],cost:(e,c)=>moved(e,c,args(c,'send'),'grave','effect-send'),resolve:()=>{}},['normal']);
 effect('Gimmick Puppet Nightmare',null,(e,c)=>{const list=[...hand(e,c.owner,m=>is(m,'Gimmick Puppet Nightmare')),...grave(e,c.owner,m=>is(m,'Gimmick Puppet Nightmare'))];if(list.length)revive(e,c,list[0].uid);lock(e,c.owner,'puppetOnly');},{mode:'era-nightmare',summons:true,once:H.once('nightmare'),inputs:(e,c)=>[g(e,c,'cost','选择解放的超量怪兽',ownM(e,c).filter(m=>CARDS[m.id].type==='xyz'),1,1,'cost')],cost:(e,c)=>X.tribute(e,c,args(c,'cost'))});
 effect('Gimmick Puppet Gear Changer',(e,c)=>ownM(e,c).filter(m=>puppet(m)&&m.uid!==c.uid),(e,c)=>{const m=card(e,first(c));if(m&&self(e,c))self(e,c).levelOverride={value:e.level(m),until:e.state.turn};},{mode:'era-gear',once:H.once('gear'),role:'own-boost',inputs:(e,c)=>[g(e,c,'target','选择复制等级的其他机关傀儡',ownM(e,c).filter(m=>puppet(m)&&m.uid!==c.uid),1,1,'own-boost')]});
 watch('Gimmick Puppet Twilight Joker','era-special','move',(e,v)=>v.to==='grave'&&v.kind==='battle'&&puppet({id:v.id}),{summons:true,resolve:(e,c)=>{moved(e,c,[c.event.uid],'banished','effect-banish');revive(e,c,c.uid);}},{zones:['hand']});
 // ==========================================================================
 // Sylvan
 // ==========================================================================
 onEntry('Sylvan Flowerknight','era-excavate',{resolve:(e,c)=>sylvanExcavate(e,c,1)},['normal']);
 onEntry('Sylvan Peaskeeper','era-excavate',{resolve:(e,c)=>sylvanExcavate(e,c,1)},['normal','special']);
 onEntry('Sylvan Marshalleaf','era-excavate',{resolve:(e,c)=>sylvanExcavate(e,c,2)},['normal']);
 onFlip('Sylvan Komushroomo',{resolve:(e,c)=>sylvanExcavate(e,c,5)});
 effect('Sylvan Guardioak',null,(e,c)=>sylvanExcavate(e,c,c.eraN||3),{mode:'era-excavate',once:H.once('guardioak'),inputs:(e,c)=>[H.customGroup('n','选择翻开的张数',[1,2,3].map(n=>({uid:String(n),label:String(n),value:n})),1,1)],cost:(e,c)=>{c.eraN=Number(first(c,'n'));}});
 effect('Sylvan Hermitree',null,(e,c)=>{const top=deck(e,c.owner);if(!top.length)return;if(plant(e,top[0])){moved(e,c,[top[0].uid],'grave','effect-send');e.draw(c.owner,1);const t=e.find(top[0].uid);}else e.putOnDeck(top[0].uid,'bottom',c.source);},{mode:'era-hermitree',once:H.once('hermitree')});
 R('Sylvan Flowerknight','era-sylvan',{zones:['grave'],label:C('Sylvan Flowerknight').name,role:'search',inputs:(e,c)=>[g(e,c,'target','选择置顶的森罗',deck(e,c.owner,sylvan),1,1,'search')],resolve:(e,c)=>e.putOnDeck(first(c),'top',c.source)});
 R('Sylvan Peaskeeper','era-sylvan',{zones:['grave'],label:C('Sylvan Peaskeeper').name,summons:true,once:H.once('peaskeeper'),resolve:(e,c)=>{const list=grave(e,c.owner,m=>plant(e,m)&&e.level(m)<=4&&e.canSpecial(c.owner,m,{via:'revive'}));if(list.length)revive(e,c,list[0].uid);}});
 R('Sylvan Marshalleaf','era-sylvan',{zones:['grave'],label:C('Sylvan Marshalleaf').name,role:'destroy',inputs:(e,c)=>[g(e,c,'target','选择破坏的怪兽',allM(e).filter(m=>m.faceUp),1,1,'destroy')],resolve:(e,c)=>destroy(e,c,args(c))});
 R('Sylvan Komushroomo','era-sylvan',{zones:['grave'],label:C('Sylvan Komushroomo').name,role:'destroy',inputs:(e,c)=>[g(e,c,'target','选择破坏的魔法／陷阱',allS(e),1,1,'destroy')],resolve:(e,c)=>destroy(e,c,args(c))});
 R('Sylvan Guardioak','era-sylvan',{zones:['grave'],label:C('Sylvan Guardioak').name,role:'search',inputs:(e,c)=>[g(e,c,'target','选择置顶的其他植物族',grave(e,c.owner,m=>m.uid!==c.uid&&plant(e,m)),1,1,'search')],resolve:(e,c)=>e.putOnDeck(first(c),'top',c.source)});
 R('Sylvan Hermitree','era-sylvan',{zones:['grave'],label:C('Sylvan Hermitree').name,mandatory:true,resolve:(e,c)=>{const p=e.state.players[c.owner];if(p.deck.length)p.deck.unshift(p.deck.pop());}});
 T('Sylvan Blessing',{summons:true,inputs:(e,c)=>[g(e,c,'cost','选择放回卡组的手牌',hand(e,c.owner),1,1,'cost'),g(e,c,'target','选择复活的森罗',[...hand(e,c.owner,sylvan),...grave(e,c.owner,sylvan)],1,1,'special'),H.customGroup('where','选择放回位置',[{uid:'top',label:'卡组顶',value:1},{uid:'bottom',label:'卡组底',value:2}],1,1)],cost:(e,c)=>e.putOnDeck(first(c,'cost'),first(c,'where'),c.source),resolve:(e,c)=>revive(e,c,first(c))});
 if(typeof module!=='undefined')module.exports=X;
})(globalThis);
