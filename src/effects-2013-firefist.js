/* 2013 per-card rules: the Fire Fist / Fire Formation and Fire King themes.
 * Registered from effects-2013.js. Fire Formation Spell/Trap cards are Set
 * straight from the Deck, so they reuse the real Set and zone rules. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,I,is,A,Q,R,passive,mark,extend,allM,allS,allF,monster,face,ownM,foeM,hand,deck,grave,first,args,self,src,active,field,has,g,choose,target,moved,destroy,pay,once,onEntry,onFlip,onMove,onEnd,onStandby,onDamage,onBattleWin,revive,search,specialChoice,series,guard,defer,card,def,names,effect,cast,watch,sent,aura,ownAura,protect,lock,locked,stat,summonCost,specialSelf}=X,{CARDS}=D;
 const S=cast,T=cast;
 const firefist=m=>series(m,'Fire Fist'),formation=m=>series(m,'Fire Formation'),fireking=m=>series(m,'Fire King');
 const beastWarrior=m=>monster(m)&&D.CARDS[m.id]?.race==='兽战士族';
 function setFromDeck(e,c,pred){
  const list=deck(e,c.owner,pred);if(!list.length)return null;
  const slot=e.freeSpellZones(c.owner)[0];if(slot===undefined)return null;
  const card=e.makeCard(list[0].id,c.owner);Object.assign(card,{faceUp:false,position:'defense',setTurn:e.state.turn,changedTurn:0});
  e.remove(list[0].uid);e.state.players[c.owner].spells[slot]=card;
  e.state.originalCardCount=e.physicalCards().filter(m=>CARDS[m.id].type!=='token').length;
  e.shuffle(e.state.players[c.owner].deck);return card;
 }
 // ==========================================================================
 // Monster effects
 // ==========================================================================
 onEntry('Brotherhood of the Fire Fist - Rooster','era-search',{condition:(e,c)=>c.event.kind==='special'||c.event.from==='extra',once:H.once('rooster'),resolve:(e,c)=>search(e,c,deck(e,c.owner,firefist))},['special']);
 effect('Brotherhood of the Fire Fist - Rooster',null,(e,c)=>setFromDeck(e,c,m=>formation(m)),{mode:'era-set',once:H.once('rooster-set'),summons:false,inputs:(e,c)=>[g(e,c,'cost','选择送去墓地的炎舞',e.refs(c.owner,['spells','fieldSpell']).filter(f=>f.card.faceUp&&formation(f.card)).map(f=>f.card),1,1,'cost')],cost:(e,c)=>moved(e,c,args(c,'cost'),'grave','effect-send')});
 effect('Brotherhood of the Fire Fist - Leopard',null,(e,c)=>setFromDeck(e,c,m=>formation(m)),{mode:'era-set',once:H.once('leopard'),summons:false,condition:(e,c)=>self(e,c)?.summonTurn===e.state.turn,inputs:(e,c)=>[g(e,c,'cost','选择解放的炎星',ownM(e,c).filter(firefist),1,1,'cost')],cost:(e,c)=>X.tribute(e,c,args(c,'cost'))});
 onFlip('Brotherhood of the Fire Fist - Wolf',{resolve:(e,c)=>{setFromDeck(e,c,m=>formation(m)&&def(m).type==='trap');if(c.event.kind==='flip')setFromDeck(e,c,m=>formation(m)&&def(m).type==='spell');}});
 onEntry('Brotherhood of the Fire Fist - Boar','era-set',{condition:(e,c)=>c.event.from==='extra',once:H.once('boar'),resolve:(e,c)=>setFromDeck(e,c,m=>formation(m)&&def(m).type==='spell')},['special']);
 sent('Brotherhood of the Fire Fist - Boar',(e,c)=>{const list=deck(e,c.owner,m=>firefist(m)&&e.level(m)===4&&m.id!==c.sourceId);if(list.length)revive(e,c,list[0].uid,{shuffle:true});},(e,v)=>v.to==='grave'&&v.kind==='battle');
 effect('Brotherhood of the Fire Fist - Buffalo',null,(e,c)=>revive(e,c,c.uid),{zones:['grave'],mode:'era-buffalo',summons:true,once:H.once('buffalo'),inputs:(e,c)=>[g(e,c,'cost','选择送去墓地的两张炎星／炎舞',[...hand(e,c.owner,m=>firefist(m)||formation(m)),...e.refs(c.owner,['spells','fieldSpell']).filter(f=>f.card.faceUp&&formation(f.card)).map(f=>f.card)],2,2,'cost')],cost:(e,c)=>moved(e,c,args(c,'cost'),'grave','effect-send')});
 effect('Brotherhood of the Fire Fist - Rhino',null,(e,c)=>{const a=c.event.attack,h=a&&card(e,a.owner===c.owner?a.uid:a.target);if(h)e.modify(h.uid,'atk','add',c.eraAtk||0,e.state.turn,c.source);},{mode:'era-rhino',quick:true,main:false,role:'own-boost',condition:(e,c)=>{const a=c.event.window?.attack;if(!a)return false;const h=card(e,a.owner===c.owner?a.uid:a.target);return !!h&&firefist(h)&&hand(e,c.owner,m=>firefist(m)||(monster(m)&&beastWarrior(m))).length>0&&e.refs(c.owner,['spells','fieldSpell']).some(f=>f.card.faceUp&&formation(f.card));},inputs:(e,c)=>[g(e,c,'cost','选择送去墓地的炎舞与炎星手牌',[...e.refs(c.owner,['spells','fieldSpell']).filter(f=>f.card.faceUp&&formation(f.card)).map(f=>f.card).slice(0,1),...hand(e,c.owner,firefist).slice(0,1)],1,2,'cost')],cost:(e,c)=>{c.eraAtk=0;for(const uid of args(c,'cost')){const m=card(e,uid);if(m&&firefist(m))c.eraAtk=e.originalAttack(m);}moved(e,c,args(c,'cost'),'grave','effect-send');}});
 effect('Brotherhood of the Fire Fist - Caribou',null,(e,c)=>setFromDeck(e,c,m=>formation(m)&&def(m).type==='spell'),{zones:['grave'],mode:'era-caribou',condition:(e,c)=>!!(c.event?.materials||[]).includes(c.uid)&&firefist({id:c.event?.id})});
 E.on('move',(e,v)=>{if(v.to==='grave'&&v.kind==='destroy'&&CARDS[v.id]?.officialName==='Brotherhood of the Fire Fist - Caribou'){const m=card(e,v.uid);if(m)m.eraDestroyedTurn=e.state.turn;}});
 onEnd('Brotherhood of the Fire Fist - Caribou',{zones:['grave'],once:H.once('caribou'),condition:(e,c)=>card(e,c.uid)?.eraDestroyedTurn===e.state.turn,resolve:(e,c)=>{const list=deck(e,c.owner,m=>firefist(m)&&e.level(m)===4&&m.id!==c.sourceId);if(list.length)revive(e,c,list[0].uid,{shuffle:true});}});
 specialSelf('Brotherhood of the Fire Fist - Coyote',(e,c)=>ownM(e,c).length===0&&e.refs(c.owner,['spells','fieldSpell']).some(f=>f.card.faceUp&&formation(f.card)));
 R('Brotherhood of the Fire Fist - Cardinal','era-shuffle',{zones:['extraMonster','monsters'],label:C('Brotherhood of the Fire Fist - Cardinal').name,once:H.once('cardinal'),inputs:(e,c)=>[H.detachInput(e,c,2),g(e,c,'cost','选择洗回卡组的炎星／炎舞',[...grave(e,c.owner,m=>firefist(m)||formation(m)),...e.refs(c.owner,['spells','fieldSpell']).filter(f=>f.card.faceUp&&(firefist(f.card)||formation(f.card))).map(f=>f.card)],2,2,'cost'),g(e,c,'target','选择洗回卡组的对方卡片',[...grave(e,1-c.owner),...e.field(1-c.owner).filter(f=>f.faceUp).map(f=>f.card)],2,2,'target')],cost:(e,c)=>{e.detach(c.uid,args(c,'cost'));moved(e,c,args(c,'cost'),'deck','effect-return');},resolve:(e,c)=>{moved(e,c,args(c,'target'),'deck','effect-return');e.shuffle(e.state.players[c.owner].deck);e.shuffle(e.state.players[1-c.owner].deck);}});
 E.on('summon',(e,v)=>{if(CARDS[v.id]?.officialName!=='Brotherhood of the Fire Fist - Kirin')return;e.addTrigger(v.uid,I('Brotherhood of the Fire Fist - Kirin')+'::era-kirin',v,{owner:v.owner,mandatory:true});});
 R('Brotherhood of the Fire Fist - Kirin','era-kirin',{zones:['extraMonster','monsters'],label:C('Brotherhood of the Fire Fist - Kirin').name,mandatory:true,resolve:(e,c)=>setFromDeck(e,c,m=>formation(m))});
 passive('Brotherhood of the Fire Fist - Kirin',{stat:(e,s,m,k)=>{const host=e.find(s.card.uid);if(!host||k!=='atk')return 0;if(e.find(m.uid)?.owner!==1-host.owner)return 0;return -100*e.refs(host.owner,['spells','fieldSpell']).filter(f=>f.card.faceUp).length;}});
 // ==========================================================================
 // Fire Formation support
 // ==========================================================================
 const formationBonus={'Fire Formation - Gyokkou':100,'Fire Formation - Yoko':100,'Fire Formation - Kaiyo':300};
 for(const [name,bonus] of Object.entries(formationBonus))aura(name,(e,m)=>monster(m)&&e.race(m)==='兽战士族',bonus);
 S('Fire Formation - Gyokkou',{inputs:(e,c)=>[g(e,c,'target','选择对方的盖卡',e.refs(1-c.owner,['spells','fieldSpell']).filter(f=>!f.card.faceUp).map(f=>f.card),1,1,'target')],resolve:(e,c)=>{const m=card(e,first(c));if(m)m.gyokkouTarget=true;}});
 S('Fire Formation - Yoko',{inputs:(e,c)=>[g(e,c,'target','选择破坏的对方表侧卡',e.field(1-c.owner).filter(f=>f.faceUp).map(f=>f.card),1,1,'destroy')],resolve:(e,c)=>{const d=hand(e,c.owner,m=>monster(m)&&e.race(m)==='兽战士族')[0];if(!d)return;H.discard(e,c,[d.uid]);destroy(e,c,args(c));}});
 T('Fire Formation - Kaiyo',{resolve:(e,c)=>{for(const m of ownM(e,c).filter(m=>m.faceUp&&e.race(m)==='兽战士族'))m.eraPiercing=true;}});
 // ==========================================================================
 // Fire King
 // ==========================================================================
 for(const [name,mode] of [['Fire King Avatar Yaksha','era-yaksha'],['Fire King Avatar Garunix','era-garunix']])watch(name,mode,'move',(e,v)=>v.to==='grave'&&v.kind==='destroy'&&fireking({id:v.id}),{summons:true,resolve:(e,c)=>revive(e,c,c.uid)},{zones:['hand']});
 sent('Fire King Avatar Yaksha',(e,c)=>{const list=[...hand(e,c.owner),...e.refs(c.owner,['monsters']).map(f=>f.card)].filter(m=>monster(m));if(list.length)destroy(e,c,[list[0].uid]);},(e,v)=>v.to==='grave'&&v.kind==='destroy',{once:H.once('yaksha')});
 sent('Fire King Avatar Garunix',(e,c)=>{const list=deck(e,c.owner,m=>series(m,'Fire King Avatar'));if(list.length)revive(e,c,list[0].uid,{shuffle:true});},(e,v)=>v.to==='grave'&&v.kind==='destroy');
 if(typeof module!=='undefined')module.exports=X;
})(globalThis);
