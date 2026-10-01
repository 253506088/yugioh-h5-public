/* 2017 common contracts. Only explicit effect registrations unlock cards. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,extend,card,def,field,monster,active,allF}=X;
 const notes=new Map(),priorMark=X.mark;X.mark=function(n,note,status){if(note?.startsWith('本作适配')){const s=notes.get(C(n).id)||new Set();s.add(note);notes.set(C(n).id,s);}return priorMark(n,note,status);};
 const fm=z=>z==='monsters'||z==='extraMonster',st=m=>['spell','trap'].includes(def(m)?.type),kind=m=>monster(m)?'monster':def(m)?.type;
 const live=(e,n,p=null)=>allF(e).filter(m=>X.is(m,n)).map(m=>e.find(m.uid)).filter(f=>(p===null||f.owner===p)&&active(e,f.card));
 const limit=n=>H.once('2017-'+n,'name'),points=(e,u)=>X.allM(e).filter(m=>e.pointsTo(u,m.uid));
 const zones=(e,c)=>e.linkedZones(c.owner,c.uid).filter(z=>!e.state.players[c.owner].monsters[z]);
 const Y=X.year2017={...X.year2016,fm,st,kind,live,limit,points,zones,notes};
 Y.materialChoices=(e,c,g,predicate)=>{const valid=root.DuelModernUtils.subsets(g.candidates.map(o=>card(e,o.uid)),g.min,g.max).filter(ms=>predicate(ms.map(m=>m.uid)));return {...g,sets:valid.map(ms=>ms.map(m=>m.uid)),candidates:g.candidates.filter(o=>valid.some(ms=>ms.some(m=>m.uid===o.uid)))};};
 extend('chooseAI',function(prior,p){if(p.kind==='input'&&p.group?.sets?.length){const sets=p.group.sets,owner=p.owner??p.responder;const best=sets.slice().sort((a,b)=>a.reduce((n,u)=>n+this.cardUtility(card(this,u),owner),0)-b.reduce((n,u)=>n+this.cardUtility(card(this,u),owner),0))[0];return {type:'choose',uids:best};}return prior.call(this,p);});
 Y.top=(e,c,u)=>{const f=e.find(u);if(!f)return;const p=f.card.originalOwner;X.moved(e,c,[u],'deck','effect-return');if(e.find(u)?.zone==='deck'){const a=e.state.players[p].deck,i=a.findIndex(m=>m.uid===u);a.unshift(...a.splice(i,1));}};
 Y.linkedSpecial=(e,c,pool,o={})=>{if(zones(e,c).length)X.specialChoice(e,c,pool,{via:'effect',zone:zones(e,c)[0],...o});};
 // Preserve effect attribution across older wrappers that accept only three
 // damage arguments. Continuous burn and battle follow-ups need that source.
 extend('damage',function(prior,p,n,k='战斗',s,...a){const old=this._y17DamageSource;const battle=this._y17Battle;let origin=s||this.state.resolvingLink?.source;if(k==='战斗'&&battle){const u=p===battle.owner?battle.target:battle.uid,m=card(this,u);if(m)origin=X.src(this,m,1-p);}this._y17DamageSource=origin;try{return prior.call(this,p,n,k,s,...a);}finally{this._y17DamageSource=old;}});
 extend('emit',function(prior,v){return prior.call(this,v.type==='damage'&&this._y17DamageSource?{...v,effectSource:this._y17DamageSource}:v);});
 extend('responseOptions',function(prior,p,c=this.windowContext()){if(E.get(c.chainLast?.key)?.unanswerable)return [];return prior.call(this,p,c);});
 for(const d of D.CARD_LIST.filter(c=>c.releaseYear===2017)){
  if(!d.existing&&d.effect){d.implementationStatus='pending';d.implementationNote='2017 年效果待落实，不可编入正式构筑';}
  if(d.type==='fusion'&&/Must be Fusion Summoned/.test(d.originalDescription||''))d.fusionOnly=true;
 }
 extend('materialMatches',function(prior,m,s,...a){if(s.type==='pendulum'&&def(m)?.pendulum)s={...s,type:undefined};return (!s.tuner||this.isTuner(m))&&prior.call(this,m,s,...a);});
 extend('fusionValid',function(prior,p,m,ms,...a){const d=def(m);return (!d.fusionSameAttribute||new Set(ms.map(q=>this.attribute(q))).size===1)&&(!d.fusionDifferentAttributes||new Set(ms.map(q=>this.attribute(q))).size===ms.length)&&(!d.fusionDifferentRaces||new Set(ms.map(q=>this.race(q))).size===ms.length)&&prior.call(this,p,m,ms,...a);});
 extend('linkValid',function(prior,p,m,ms,...a){const s=def(m)?.link||{};return ms.every(q=>(!s.maxLevel||this.level(q)>0&&this.level(q)<=s.maxLevel)&&(!s.flip||def(q).flip)&&(!s.races||s.races.includes(this.race(q)))&&(!s.summonedFromExtra||q.y16FromExtra))&&prior.call(this,p,m,ms,...a);});
 extend('describe',function(prior,m,...a){return {...prior.call(this,m,...a),...Object.fromEntries(Object.entries(m).filter(([k])=>k.startsWith('y17')))};});
 extend('move',function(prior,u,to,o={}){const f=this.find(u),m=f?.card,r=prior.call(this,u,to,o);if(m&&r&&r.from!==r.to&&field(f.zone))for(const k of Object.keys(m))if(k.startsWith('y17'))delete m[k];return r;});
 if(typeof module!=='undefined'){for(const part of ['dinosaur','draco','trickstar','spyral','links','support','expansion','final'])require('./effects-2017-'+part+'.js');module.exports=X;}
})(globalThis);
