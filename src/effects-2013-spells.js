/* 2013 per-card rules: Spell Cards. Registered from effects-2013.js.
 * Shared Spell/Trap support for themes that live in their own parts
 * (Fire Formation, Sylvan, Vampire, Archfiend, Noble Arms) stays there. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,I,is,A,Q,R,passive,mark,extend,allM,allS,allF,monster,face,ownM,foeM,hand,deck,grave,first,args,self,src,active,field,has,g,choose,target,moved,destroy,pay,once,onEntry,onFlip,onMove,onEnd,onStandby,onDamage,onBattleWin,revive,search,specialChoice,series,guard,defer,card,def,names,effect,cast,watch,sent,aura,ownAura,protect,lock,locked,stat,summonCost,specialSelf}=X,{CARDS}=D;
 const S=cast;
 // --- Sacred Sword of Seven Stars ------------------------------------------
 // Banishing is the cost, so the monster is gone even if the draw is later
 // stopped by a deck-out or a replacement effect. This one carries only a cost
 // group, so it registers through E.spell rather than the pool-taking helper.
 {
  const level7=(e,c)=>[...hand(e,c.owner,m=>monster(m)&&e.level(m)===7),...ownM(e,c).filter(m=>m.faceUp&&e.level(m)===7)];
  E.spell(I('Sacred Sword of Seven Stars'),{once:H.once('sacred-sword','name'),condition:(e,c)=>level7(e,c).length>0,inputs:(e,c)=>[g(e,c,'cost','选择除外的7星怪兽',level7(e,c),1,1,'cost')],cost:(e,c)=>moved(e,c,args(c,'cost'),'banished','cost-banish'),resolve:(e,c)=>e.draw(c.owner,2)});
  mark('Sacred Sword of Seven Stars','除外1只7星怪兽作为代价并抽2张；同名卡每回合只能发动1张');
 }
 // --- Overlay Capture (2013 Xyz support) lives with the Overlay group --------
 // --- Rank-Up-Magic --------------------------------------------------------
 // Barian's Force / Numeron Force / Astral Force share one resolution: use an
 // Xyz Monster you control as material for a Chaos Xyz one Rank higher.
 const rankUp=(name,pred,extra={})=>S(name,null,null,{summons:true,once:H.once(name,'name'),inputs:(e,c)=>[g(e,c,'cost','选择作为素材的超量怪兽',ownM(e,c).filter(m=>CARDS[m.id].type==='xyz'),1,1,'cost')],cost:(e,c)=>{c.eraHost=first(c,'cost');moved(e,c,[first(c,'cost')],'grave','cost-return');},resolve:(e,c)=>{const host=c.eraHost&&e.find(c.eraHost);if(!host)return;const rank=(def(host.card).rank||0)+1;const list=e.state.players[c.owner].extra.filter(m=>CARDS[m.id].type==='xyz'&&def(m).rank===rank&&pred(CARDS[m.id],host.card));if(list.length)specialChoice(e,c,list,{via:'xyz',...extra});}});
 rankUp('Rank-Up-Magic Barian\'s Force',(d)=>/Number C|CXyz/.test(d.officialName||''));
 rankUp('Rank-Up-Magic Numeron Force',(d)=>/Number C|CXyz/.test(d.officialName||''));
 rankUp('Rank-Up-Magic Astral Force',(d,host)=>(d.rank||0)===(CARDS[host.id].rank||0)+1);
 // --- Gimmick / Gagaga / ZW support spells already registered in their parts -
 // --- Chronomaly and Gogogo spells live with their themes ------------------
 if(typeof module!=='undefined')module.exports=X;
})(globalThis);
