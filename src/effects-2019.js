/* 2019 contracts. A catalog identity is not an implemented Duel effect. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,extend,card,def,field,series}=X;
 const Y=X.year2019={...X.year2018,limit:n=>H.once('2019-'+n,'name')};
 // Synchronous destruction groups share one replacement payment. A later
 // named continuation starts a fresh group, so sequential choices do not.
 Y.destructionBatch=(e,fn)=>{if(e._y19DestroyBatch)return fn();e._y19DestroyBatch={saved:{}};try{return fn();}finally{delete e._y19DestroyBatch;}};
 for(const key of ['resolve','operation']){const prior=E[key];E[key]=function(e,...args){return Y.destructionBatch(e,()=>prior.call(this,e,...args));};}
 extend('finishBattle',function(prior,...args){return Y.destructionBatch(this,()=>prior.apply(this,args));});
 for(const d of D.CARD_LIST.filter(c=>c.releaseYear===2019)){
  if(!d.existing&&d.effect){d.implementationStatus='pending';d.implementationNote='2019 年效果待落实，不可编入正式构筑';}
  if(d.type==='fusion'&&/Must be Fusion Summoned/.test(d.originalDescription||''))d.fusionOnly=true;
 }
 extend('linkValid',function(prior,p,m,ms,...a){const s=def(m)?.link||{};
  return ms.every(q=>(s.maxAtk===undefined||this.attackValue(q)<=s.maxAtk)&&(!s.xyzOnly||def(q).type==='xyz')&&(!s.extraMonsterZone||this.find(q.uid)?.zone==='extraMonster'))&&
   (!s.includingTypes||ms.some(q=>s.includingTypes.includes(def(q).type)))&&(!s.includingRace||ms.some(q=>this.race(q)===s.includingRace))&&
   (!s.differentLevels||ms.every(q=>this.level(q)>0)&&new Set(ms.map(q=>this.level(q))).size===ms.length)&&
   (!s.sameLevel||ms.every(q=>this.level(q)>0)&&new Set(ms.map(q=>this.level(q))).size===1)&&
   (!s.sameRaceOrAttribute||new Set(ms.map(q=>this.race(q))).size===1||new Set(ms.map(q=>this.attribute(q))).size===1)&&prior.call(this,p,m,ms,...a);
 });
 extend('materialMatches',function(prior,m,s,...a){return (!s.anyOf||s.anyOf.some(t=>this.materialMatches(m,t,...a)))&&prior.call(this,m,s,...a);});
 extend('xyzValid',function(prior,p,m,ms,up=false){const d=def(m);
  if(!up&&d?.releaseYear===2019&&d.xyzMaterialType==='xyz')return ms.length===d.xyzCount&&new Set(ms.map(q=>q.uid)).size===ms.length&&ms.every(q=>{const f=this.find(q.uid);return f?.owner===p&&Y.fm(f.zone)&&q.faceUp&&def(q).type==='xyz'&&(!d.xyzExcludeNameIncludes||!series(q,d.xyzExcludeNameIncludes))&&(!d.xyzSameRank||def(q).rank===def(ms[0]).rank);})&&this.canSpecial(p,m,{via:'xyz'})&&this.freeZones(p,m,{materials:ms.map(q=>q.uid)}).length>0;
  return prior.call(this,p,m,ms,up);
 });
 // Effect state travels in snapshots and is cleared by an actual field exit.
 extend('describe',function(prior,m,...a){return {...prior.call(this,m,...a),...Object.fromEntries(Object.entries(m).filter(([k])=>k.startsWith('y19')))};});
 extend('move',function(prior,u,to,o={}){const f=this.find(u),m=f?.card,r=prior.call(this,u,to,o);if(m&&r&&r.from!==r.to&&field(f.zone))for(const k of Object.keys(m))if(k.startsWith('y19'))delete m[k];return r;});
 if(typeof module!=='undefined'){for(const part of ['salamangreat','orcust','dragons','endymion','support','final'])require('./effects-2019-'+part+'.js');module.exports=X;}
})(globalThis);
