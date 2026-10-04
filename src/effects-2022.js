/* 2022 identity, material and save-state contracts. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,is,extend,card,def,field,monster,locked,series}=X;
 const Y=X.year2022={...X.year2021,limit:n=>H.once('2022-'+n,'name')};
 for(const d of D.CARD_LIST.filter(c=>c.releaseYear===2022))if(!d.existing&&d.effect){d.implementationStatus='pending';d.implementationNote='2022 年效果待落实，不可编入正式构筑';}
 D.families.spright='雷精';for(const d of D.CARD_LIST)if(series(d,'Spright'))d.families=[...new Set([...(d.families||[]),'spright'])];
 Y.two=(e,m)=>monster(m)&&(def(m).type==='link'?def(m).linkRating===2:def(m).type==='xyz'?Y.rank(e,m)===2:e.level(m)===2);
 Y.levelTwo=(e,m)=>monster(m)&&!['xyz','link'].includes(def(m).type)&&e.level(m)===2;
 // Battle-destruction triggers resolve while the attack frame is finished;
 // the Damage Step ends only when that frame is cleared.
 Y.damageStep=e=>['calc','resolving','finished'].includes(e.state.frame?.attack?.stage);
 extend('canSpecial',function(prior,p,m,o={}){return !(locked(this,p,'y22Two')&&!Y.two(this,m))&&prior.call(this,p,m,o);});
 extend('xyzMaterialLevel',function(prior,m,x){return is(x,'Gigantic Spright')&&def(m).type==='link'&&def(m).linkRating===2?2:prior.call(this,m,x);});
 extend('xyzValid',function(prior,p,m,ms,up=false){const d=def(m);if(!up&&d?.xyzMaterialRank)return ms.length===d.xyzCount&&new Set(ms.map(q=>q.uid)).size===ms.length&&this.canSpecial(p,m,{via:'xyz'})&&this.freeZones(p,m,{materials:ms.map(q=>q.uid)}).length>0&&ms.every(q=>{const f=this.find(q.uid);return f?.owner===p&&Y.fm(f.zone)&&q.faceUp&&def(q).type==='xyz'&&!def(q).cannotXyz&&Y.rank(this,q)===d.xyzMaterialRank&&series(q,d.xyzNameIncludes);});return prior.call(this,p,m,ms,up);});
 extend('linkValid',function(prior,p,m,ms,...a){const s=def(m)?.link||{};return ms.every(q=>!(q.summonKind==='link'&&q.summonTurn===this.state.turn&&['Spright Elf','Spright Sprind'].some(n=>is(q,n)))&&(!s.materialAnyOf||s.materialAnyOf.some(v=>v.series?series(q,v.series):is(q,v.name)))&&(!s.attributes||s.attributes.includes(this.attribute(q))))&&(!s.includingTwo||ms.some(q=>Y.two(this,q)))&&(!s.includingPendulum||ms.some(q=>Y.pend(q)))&&(!s.includingRaces||ms.some(q=>s.includingRaces.includes(this.race(q))))&&prior.call(this,p,m,ms,...a);});
 extend('describe',function(prior,m,...a){return {...prior.call(this,m,...a),...Object.fromEntries(Object.entries(m).filter(([k])=>k.startsWith('y22')))};});
 extend('move',function(prior,u,to,o={}){const f=this.find(u),m=f?.card,r=prior.call(this,u,to,o);if(m&&r&&r.from!==r.to&&field(f.zone))for(const k of Object.keys(m))if(k.startsWith('y22'))delete m[k];return r;});
 extend('takeMaterial',function(prior,u,...a){const r=prior.call(this,u,...a);for(const m of r.cards)for(const k of Object.keys(m))if(k.startsWith('y22'))delete m[k];return r;});
 if(typeof module!=='undefined'){for(const part of ['spright','ishizu','support','final'])require('./effects-2022-'+part+'.js');module.exports=X;}
})(globalThis);
