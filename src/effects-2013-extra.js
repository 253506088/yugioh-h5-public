/* 2013 per-card rules: Extra Deck monsters (Xyz and Synchro) that are not part
 * of the Mecha Phantom Beast or Bujin volumes. Registered from effects-2013.js. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,I,is,A,Q,R,passive,mark,extend,allM,allS,allF,monster,face,ownM,foeM,hand,deck,grave,first,args,self,src,active,field,has,g,choose,target,moved,destroy,pay,once,onEntry,onFlip,onMove,onEnd,onStandby,onDamage,onBattleWin,revive,search,specialChoice,series,guard,defer,card,def,names,effect,cast,watch,sent,aura,ownAura,protect,lock,locked,stat,xzy}=X,{CARDS}=D;
 const S=cast,T=cast;
 const ghostrick=m=>series(m,'Ghostrick');
 const faceDownDefense=m=>!!m&&!m.faceUp&&m.position==='defense';
 // -- Ghostrick Alucard / Dullahan ------------------------------------------
 R('Ghostrick Alucard','era-pop',{zones:['extraMonster','monsters'],label:C('Ghostrick Alucard').name,once:H.once('alucard'),role:'destroy',inputs:(e,c)=>[H.detachInput(e,c,1),g(e,c,'target','选择破坏的对方盖卡',e.refs(1-c.owner,['spells','fieldSpell','monsters']).filter(f=>!f.card.faceUp).map(f=>f.card),1,1,'destroy')],cost:(e,c)=>e.detach(c.uid,args(c,'cost')),resolve:(e,c)=>destroy(e,c,args(c))});
 extend('attackTargets',function(prior,m,p=this.state.active){let list=prior.call(this,m,p);if(!allM(this).some(q=>q.faceUp&&is(q,'Ghostrick Alucard')))return list;const alucard=allM(this).find(q=>q.faceUp&&is(q,'Ghostrick Alucard'));return list.filter(uid=>{const f=this.find(uid);if(!f||f.owner===p)return true;return f.card.uid===alucard.uid;});});
 // Dullahan gains 200 ATK per Ghostrick card and can halve any face-up monster.
 passive('Ghostrick Dullahan',{stat:(e,s,m,stat)=>stat==='atk'&&m.uid===s.card.uid?[0,1].reduce((n,p)=>n+e.refs(p,['monsters','extraMonster','spells','fieldSpell']).filter(f=>f.card.faceUp&&ghostrick(f.card)).length,0)*200:0});
 effect('Ghostrick Dullahan',(e,c)=>allM(e).filter(m=>m.faceUp),(e,c)=>{const m=card(e,first(c));if(m)e.modify(m.uid,'atk','mul',0.5,e.state.turn,c.source);},{mode:'era-halve',quick:true,role:'own-boost',inputs:(e,c)=>[H.detachInput(e,c,1),g(e,c,'target','选择减半攻击力的表侧怪兽',allM(e).filter(m=>m.faceUp),1,1,'target')],cost:(e,c)=>e.detach(c.uid,args(c,'cost'))});
 // Both recover another Ghostrick card when they reach the Graveyard.
 for(const n of ['Ghostrick Alucard','Ghostrick Dullahan']){
  R(n,'era-recover',{zones:['grave'],label:C(n).name,role:'search',inputs:(e,c)=>[g(e,c,'target','选择回收的幽灵卡片',grave(e,c.owner,m=>ghostrick(m)&&m.uid!==c.uid),1,1,'search')],resolve:(e,c)=>moved(e,c,args(c),'hand','effect-return')});
  E.on('move',(e,v)=>{if(!['monsters','extraMonster'].includes(v.from)||v.to!=='grave')return;if(CARDS[v.id]?.officialName!==n)return;e.addTrigger(v.uid,I(n)+'::era-recover',v,{owner:v.owner});});
 }
 // -- Battlin' Boxing Spirits -----------------------------------------------
 S('Battlin\' Boxing Spirits',{summons:true,once:H.once('boxing-spirits','name'),inputs:(e,c)=>[g(e,c,'target','选择复活的拳击手',grave(e,c.owner,m=>series(m,'Battlin\' Boxer')),1,1,'special')],resolve:(e,c)=>{const p=e.state.players[c.owner];if(p.deck.length)moved(e,c,[p.deck[p.deck.length-1].uid],'grave','effect-send');revive(e,c,first(c),{position:'defense'});}});
 // -- Number 85: Crazy Box --------------------------------------------------
 // The die is drawn from the engine's saved random stream, so a replay makes
 // the same roll; the six branches are applied straight from the printed text.
 R('Number 85: Crazy Box','era-die',{zones:['extraMonster','monsters'],label:C('Number 85: Crazy Box').name,once:H.once('crazy-box'),inputs:(e,c)=>[H.detachInput(e,c,1)],cost:(e,c)=>e.detach(c.uid,args(c,'cost')),resolve:(e,c)=>{const roll=1+Math.floor(e.random()*6);const p=e.state.players[c.owner];if(roll===1)p.lp=Math.floor(p.lp/2);else if(roll===2)e.draw(c.owner,1);else if(roll===3){const h=e.state.players[1-c.owner].hand;if(h.length){const pick=h[Math.floor(e.random()*h.length)];moved(e,c,[pick.uid],'grave','effect-discard');}}else if(roll===4){const list=e.field(1-c.owner).filter(f=>f.faceUp);if(list.length){const m=list[0].card;m.eraNegatedUntil=e.state.turn;}}else if(roll===5){const list=allF(e);if(list.length)destroy(e,c,[list[0].card.uid]);}else destroy(e,c,[c.uid]);}});
 extend('canAttack',function(prior,m,p,t){return is(m,'Number 85: Crazy Box')?false:prior.call(this,m,p,t);});
 if(typeof module!=='undefined')module.exports=X;
})(globalThis);
