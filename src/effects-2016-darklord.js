/* Darklords apply a Spell/Trap's resolution without activating that card or
 * paying its printed activation cost. The subsequent shuffle is a saved task. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,I,is,A,Q,passive,mark,extend,card,def,field,monster,active,allF,allM,ownM,foeM,hand,deck,grave,first,args,self,src,g,choose,target,moved,destroy,onEntry,revive,search,specialChoice,series,effect,cast}=X;
 const Y=X.year2016,{fm,live,limit,back,canSend,pickSend}=Y,dark=m=>series(m,'Darklord'),dm=m=>monster(m)&&dark(m),copies=['Darklord Nasten','Darklord Amdusc','Darklord Ixchel','Darklord Tezcatlipoca'];
 const copyCards=['Darklord Contact','Darklord Rebellion','Banishment of the Darklords','Darklord Enchantment'];
 const applicable=(e,c,n)=>n==='Darklord Contact'?e.freeMain(c.owner)>0&&grave(e,c.owner,m=>dm(m)&&e.canSpecial(c.owner,m,{via:'revive'})).length>0:n==='Banishment of the Darklords'?deck(e,c.owner,m=>dark(m)&&!is(m,n)).length>0:n==='Darklord Rebellion'?allF(e).length>0:n==='Darklord Enchantment'?e.freeMain(c.owner)>0&&foeM(e,c).some(m=>m.faceUp):false;
 const apply=(e,c,n)=>{
  if(n==='Darklord Contact')specialChoice(e,c,grave(e,c.owner,dm),{via:'revive',position:'defense'});
  else if(n==='Banishment of the Darklords')search(e,c,deck(e,c.owner,m=>dark(m)&&!is(m,n)));
  else if(n==='Darklord Rebellion')choose(e,c,'选择破坏的卡片',allF(e),1,1,'gx-destroy',{role:'destroy'});
  else if(n==='Darklord Enchantment')choose(e,c,'选择对方怪兽',foeM(e,c).filter(m=>m.faceUp),1,1,'y16-darklord-control',{role:'control'});
 };
 E.op('y16-darklord-control',(e,t)=>e.takeControl(t.picks[0],t.owner,{until:e.state.turn,source:t.context.source}));
 E.op('y16-darklord-shuffle',(e,t)=>{const m=card(e,t.context.uid);if(m&&e.find(m.uid)?.zone==='grave'&&(m.generation||0)===t.context.generation)back(e,{owner:t.owner,source:t.context.source},[m.uid]);});
 for(const n of copyCards)cast(n,null,(e,c)=>apply(e,c,n),{once:limit(n),summons:n==='Darklord Contact',condition:(e,c)=>applicable(e,c,n),...(['Darklord Rebellion','Darklord Enchantment'].includes(n)?{inputs:(e,c)=>[g(e,c,'cost','选择送墓的怪兽',[...hand(e,c.owner),...ownM(e,c).filter(m=>m.faceUp)].filter(m=>dm(m)&&canSend(e,m)),1,1,'cost')],cost:(e,c)=>H.sendCost(e,c,args(c,'cost'))}:{})});
 for(const n of copies){
  Q(n,'y16-copy',{once:limit(n+'-copy'),condition:(e,c)=>e.state.players[c.owner].lp>1000,inputs:target('选择墓地魔法陷阱',(e,c)=>grave(e,c.owner,m=>copyCards.includes(def(m).officialName)&&applicable(e,c,def(m).officialName)),'search'),cost:(e,c)=>e.payLP(c.owner,1000),resolve:(e,c)=>{const m=card(e,first(c));if(!m||e.find(m.uid)?.zone!=='grave')return;const generation=m.generation||0;apply(e,c,def(m).officialName);e.queue({op:'y16-darklord-shuffle',owner:c.owner,context:{source:c.source,uid:m.uid,generation}});},aiScore:900,aiResponse:()=>600});
 }
 extend('canSpecial',function(prior,p,m,o={}){return !(copies.some(n=>is(m,n))&&this.state.players[p].usedTurn['y16-special-'+m.id]===this.state.turn)&&prior.call(this,p,m,o);});
 E.on('summon',(e,v)=>{if(copies.some(n=>is({id:v.id},n))&&!['normal','flip','set'].includes(v.kind))e.state.players[v.owner].usedTurn['y16-special-'+v.id]=e.state.turn;});
 A('Darklord Nasten','y16-special',{zones:['hand'],summons:true,condition:(e,c)=>e.freeMain(c.owner)>0&&e.canSpecial(c.owner,card(e,c.uid),{via:'effect'}),inputs:(e,c)=>[g(e,c,'cost','选择丢弃的卡片',hand(e,c.owner,m=>m.uid!==c.uid&&dark(m)),2,2,'cost')],cost:(e,c)=>H.discard(e,c,args(c,'cost')),resolve:(e,c)=>revive(e,c,c.uid,{via:'effect'}),aiScore:1000});
 for(const n of ['Darklord Amdusc','Darklord Ixchel'])A(n,'y16-discard',{zones:['hand'],once:limit(n+'-discard'),targetAfterCost:n==='Darklord Amdusc',inputs:(e,c)=>[g(e,c,'cost','选择丢弃的卡片',hand(e,c.owner,m=>m.uid!==c.uid&&dark(m)),1,1,'cost'),...(n==='Darklord Amdusc'?[g(e,c,'target','选择回收的卡片',[...grave(e,c.owner,dark),...[c.uid,...args(c,'cost')].map(u=>card(e,u)).filter(m=>m&&canSend(e,m))],1,1,'search')]:[])],cost:(e,c)=>H.discard(e,c,[c.uid,...args(c,'cost')]),resolve:(e,c)=>n==='Darklord Ixchel'?e.draw(c.owner,2):moved(e,c,args(c).filter(u=>e.find(u)?.zone==='grave'),'hand','effect-return'),aiScore:1000});
 extend('destroy',function(prior,u,s,b=false,...rest){const f=this.find(u);if(f&&fm(f.zone)&&dm(f.card)&&!(!b&&this.unaffected(f.card,s))){const guard=hand(this,f.owner,m=>is(m,'Darklord Tezcatlipoca'))[0];if(guard){H.discard(this,{owner:f.owner,source:src(this,guard)},[guard.uid]);return false;}}return prior.call(this,u,s,b,...rest);});
 mark('Darklord Tezcatlipoca','本作适配：丢弃自身代替堕天使怪兽破坏的可选效果自动适用。');
 onEntry('Darklord Morningstar','y16-recruit',{summons:true,condition:(e,c)=>!!card(e,c.uid)?.tributeCount&&foeM(e,c).some(m=>m.faceUp&&!e.isNormalMonster(m)),resolve:(e,c)=>specialChoice(e,c,[...hand(e,c.owner),...deck(e,c.owner)].filter(dm),{via:'effect',max:Math.min(e.freeMain(c.owner),foeM(e,c).filter(m=>m.faceUp&&!e.isNormalMonster(m)).length),shuffle:true})},['normal']);
 extend('canTarget',function(prior,m,s){return !(is(m,'Darklord Morningstar')&&active(this,m)&&fm(this.find(m.uid)?.zone)&&s?.owner!==this.find(m.uid)?.owner&&this.monsters(this.find(m.uid).owner).some(q=>q.uid!==m.uid&&q.faceUp&&dm(q)))&&prior.call(this,m,s);});
 effect('Darklord Morningstar',null,(e,c)=>{const us=deck(e,c.owner).slice(0,allM(e).filter(m=>m.faceUp&&dm(m)).length).map(m=>m.uid);Y.send(e,c,us);e.heal(c.owner,500*us.filter(u=>e.find(u)?.zone==='grave'&&dark(card(e,u))).length,c.source);},{mode:'y16-mill'});
 onEntry('Darklord Ukoback','y16-send',{once:limit('ukoback'),resolve:(e,c)=>pickSend(e,c,deck(e,c.owner,dark))},['normal','special']);
})(globalThis);
