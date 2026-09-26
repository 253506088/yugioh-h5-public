/* 2015 common operations. All registrations are explicit, and every saved
 * choice/continuation is JSON data. Load before the shared destiny-rule layer. */
(function(root){
 'use strict';
 const X=root.DuelChronicle,{D,E,H,C,I,is,A,extend,card,def,field,monster,active,allF,allM,moved,choose,deck,search,series,g,first,args}=X;
 const authoredNotes=new Map(),previousMark=X.mark;X.mark=function(name,note,status){if(note?.startsWith('本作适配')&&C(name)?.releaseYear===2015){const notes=authoredNotes.get(C(name).id)||new Set();notes.add(note);authoredNotes.set(C(name).id,notes);}return previousMark(name,note,status);};
 const fm=z=>z==='monsters'||z==='extraMonster',pend=m=>def(m)?.type==='pendulum'||!!def(m)?.pendulum;
 const live=(e,n,p=null)=>allF(e).filter(m=>is(m,n)).map(m=>e.find(m.uid)).filter(f=>(p===null||f.owner===p)&&active(e,f.card));
 const limit=n=>H.once('2015-'+n,'name'),other=(e,c)=>[0,4].map(i=>e.state.players[c.owner].spells[i]).find(m=>m&&m.uid!==c.uid&&m.faceUp&&!m.pendingActivation&&e.isPendulumScale(m));
 const ps=(n,mode,s)=>A(n,mode,{zones:['spells'],effectType:'spell',once:H.once(mode,'card'),...s,condition:(e,c)=>e.isPendulumScale(card(e,c.uid))&&(!s.condition||s.condition(e,c))});
 const back=(e,c,uids)=>{moved(e,c,uids,'deck','effect-return');for(const p of e.state.players)e.shuffle(p.deck);};
 const send=(e,c,uids)=>moved(e,c,uids,'grave','effect-send');
 const banish=(e,c,uids)=>moved(e,c,uids,'banished','effect-banish');
 const destroyed=(e,v)=>field(v.from)&&['battle','destroy'].includes(v.kind);
 const pickSend=(e,c,list)=>choose(e,c,'选择送去墓地的卡片',list,1,1,'early-move',{to:'grave',kind:'effect-send',shuffle:true,role:'search'});
 const placeScale=(e,c,uid,slot=null)=>{
  const f=e.find(uid),p=e.state.players[c.owner];if(!f||!pend(f.card))return false;
  slot??=[0,4].find(i=>!p.spells[i]);if(![0,4].includes(slot)||p.spells[slot])return false;
  // Moving into the back row has no generic move destination. Follow the same
  // remove/generation contract as existing field/equip placement operations.
  const m=e.remove(uid).card;m.generation=(m.generation||0)+1;m.faceUp=true;m.pendingActivation=false;m.mods=[];m.used={};delete m.faceUpExtra;
  p.spells[slot]=m;e.shuffle(p.deck);return true;
 };
 E.op('y15-place-scale',(e,t)=>placeScale(e,{owner:t.owner,source:t.context.source},t.picks[0],t.context.slot));
 E.op('y15-end-search',(e,t)=>search(e,{owner:t.owner,source:t.context.source},deck(e,t.owner,m=>t.context.pend?pend(m):series(m,t.context.series))));
 const fusionProfile=(e,c,theme,zones=['hand','monsters','extraMonster'])=>({year2015:theme,spellId:c.sourceId,zones});
 const fusion=(e,c,profile)=>choose(e,c,'选择融合怪兽',e.fusions(c.owner,profile).map(f=>f.card),1,1,'theme2014-fusion',{profile,role:'special'});
 Object.assign(X,{year2015:{fm,pend,live,limit,other,ps,back,send,banish,destroyed,pickSend,placeScale,fusionProfile,fusion,authoredNotes}});
 // Bound negations ask whether their target is immune, which may in turn ask
 // whether that same target is negated. Break only that evaluation cycle; the
 // saved duel state and the ordinary negation layers remain unchanged.
 X.year2015.bindingActive=(e,name,key,uid)=>{const sources=allF(e).filter(m=>is(m,name)&&m[key]===uid&&m.uid!==uid);if(!sources.length||!fm(e.find(uid)?.zone))return false;const checking=e._y15BindingChecks||=(new Set()),token=name+'|'+uid;if(checking.has(token))return false;checking.add(token);try{return sources.some(m=>active(e,m)&&!e.unaffected(card(e,uid),X.src(e,m)));}finally{checking.delete(token);}};
 X.year2015.canNegate=(e,m,source)=>{if(!m)return false;const checking=e._y15BindingChecks||=(new Set()),token='negate|'+source.uid+'|'+m.uid;if(checking.has(token))return false;checking.add(token);try{return !e.unaffected(m,source);}finally{checking.delete(token);}};
 X.year2015.mustEntry=(n,mode,s,kinds)=>X.watch(n,mode,'summon',(e,v,f)=>v.uid===f.card.uid&&(kinds.includes(v.kind)||kinds.includes('special')&&!['normal','flip','set'].includes(v.kind)),s,{mandatory:true});
 extend('damage',function(prior,p,n,kind,s,...a){const old=this._y15DamageSource;this._y15DamageSource=s||this.state.resolvingLink?.source;try{return prior.call(this,p,n,kind,s,...a);}finally{this._y15DamageSource=old;}});
 extend('emit',function(prior,v){return prior.call(this,v.type==='damage'&&this._y15DamageSource?{...v,effectSource:this._y15DamageSource}:v);});
 E.on('summon',(e,v)=>{const p=e.state.players[v.owner];if(p.y15SummonHistory?.turn!==e.state.turn)p.y15SummonHistory={turn:e.state.turn,cards:[]};p.y15SummonHistory.cards.push({id:v.id,kind:v.kind,from:v.from});});
 X.year2015.summonedOutside=(e,p,pred)=>e.state.players[p].y15SummonHistory?.turn===e.state.turn&&e.state.players[p].y15SummonHistory.cards.some(v=>!['normal','flip','set'].includes(v.kind)&&!pred({id:v.id}));
 for(const d of D.CARD_LIST.filter(c=>c.releaseYear===2015)){
  if(d.type==='fusion'&&/Must be Fusion Summoned/.test(d.originalDescription||''))d.fusionOnly=true;
  if(d.type==='fusion'&&/Must first be Fusion Summoned/.test(d.originalDescription||''))d.specialOnly='fusion';
  if(d.legendaryFusion)d.specialOnly=d.legendaryFusion==='The Claw of Hermos'?'hermos':'critias';
  if(d.masked)d.specialOnly='mask';
  if(/(?:This card c|C)annot be Special Summoned\./.test(d.originalDescription||''))d.noSpecial=true;
 }
 extend('materialMatches',function(prior,m,s,...a){return (!s.level||this.level(m)===s.level)&&prior.call(this,m,s,...a);});
 extend('earlyValidateInput',function(prior,c,g,uids){if(g.validator==='early-y15-different')return new Set(uids.map(u=>card(this,u)?.id)).size===uids.length||'请选择不同名的卡片。';return prior.call(this,c,g,uids);});
 extend('fusionValid',function(prior,p,m,ms,s){return (!def(m)?.fusionDifferentNames||new Set(ms.map(q=>this.cardNameId(q))).size===ms.length)&&prior.call(this,p,m,ms,s);});
 extend('fusionAllowed',function(prior,m,s){return !def(m)?.legendaryFusion&&prior.call(this,m,s);});
 extend('xyzValid',function(prior,p,m,ms,rankUp=false){
  const d=def(m);if(!rankUp&&d?.xyzMaterialType==='xyz'&&d.releaseYear===2015){
   return ms.length>=d.xyzCount&&ms.length<=(d.xyzMax||d.xyzCount)&&new Set(ms.map(q=>q.uid)).size===ms.length&&this.canSpecial(p,m,{via:'xyz'})&&this.freeZones(p,m,{materials:ms.map(q=>q.uid)}).length>0&&ms.every(q=>{const f=this.find(q.uid);return f?.owner===p&&fm(f.zone)&&q.faceUp&&def(q).type==='xyz'&&(!d.xyzNameIncludes||series(q,d.xyzNameIncludes))&&(!d.xyzSameRank||def(q).rank===def(ms[0]).rank)&&(!d.xyzRequireOverlay||q.overlays?.length);});
  }
  return (!d?.xyzPendulum||rankUp||ms.every(pend))&&prior.call(this,p,m,ms,rankUp);
 });
 extend('canSpecial',function(prior,p,m,o={}){return !(def(m)?.legendaryFusion&&o.via!==def(m).specialOnly&&!o.ignoreConditions)&&prior.call(this,p,m,o);});
 // A monster revived by a Dracoslayer must retain its material restriction
 // through save/restore, and lose it when it changes location.
 for(const [method,key] of [['fusionValid','fusion'],['synchroValid','synchro'],['xyzValid','xyz']])extend(method,function(prior,p,m,ms,...a){return !ms.some(q=>q.y15NoMaterial===key||is(q,'Luster Pendulum, the Dracoslayer')&&!series(m,'Dracoslayer'))&&prior.call(this,p,m,ms,...a);});
 extend('move',function(prior,u,to,o={}){const f=this.find(u),m=f?.card,r=prior.call(this,u,to,o);if(m&&field(f.zone)&&r&&r.from!==r.to){for(const k of Object.keys(m))if(k.startsWith('y15'))delete m[k];}return r;});
 extend('describe',function(prior,m,...a){return {...prior.call(this,m,...a),...Object.fromEntries(Object.entries(m).filter(([k])=>k.startsWith('y15')))};});
 if(typeof module!=='undefined'){for(const v of ['pendulum','support','abyss','monarch','machines','zefra','dd','phantom','speedroid','spells','traps','fusion','red-eyes','legend','toon','raidraptor','garden','athletes','quantum','samurai','buster','performers','magicians','monsters','extra','xyz','void','ritual','final-cards','final'])require('./effects-2015-'+v+'.js');module.exports=X;}
})(globalThis);
