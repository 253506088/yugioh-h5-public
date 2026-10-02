/* 2021 shared contracts. Imported identities stay locked until authored. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,extend,card,def,field,monster,locked}=X;
 const Y=X.year2021={...X.year2020,limit:n=>H.once('2021-'+n,'name')};
 const groups={swordsoul:['相剑','Swordsoul'],tribrigade:['铁兽战线','Tri-Brigade'],floowandereeze:['随风旅鸟','Floowandereeze'],tenyi:['天威','Tenyi']};
 for(const[key,[label,name]]of Object.entries(groups)){D.families[key]=label;for(const d of D.CARD_LIST)if(X.series(d,name))d.families=[...new Set([...(d.families||[]),key])];}
 for(const d of D.CARD_LIST.filter(c=>c.releaseYear===2021))if(!d.existing&&d.effect){d.implementationStatus='pending';d.implementationNote='2021 年效果待落实，不可编入正式构筑';}
 Y.wyrm=(e,m)=>monster(m)&&e.race(m)==='幻龙族';
 Y.beast=(e,m)=>monster(m)&&['兽族','兽战士族','鸟兽族'].includes(e.race(m));
 Y.bird=(e,m)=>monster(m)&&e.race(m)==='鸟兽族';
 Y.nonEffect=(e,m)=>monster(m)&&(!def(m).effect||e.isNormalMonster(m)||m.asMonster?.normal);
 Y.specialKind=k=>!['normal','set','flip'].includes(k);
 extend('synchroValid',function(prior,p,m,ms,...a){const s=def(m)?.synchro;return !s?.cannotSummon&&(!s?.includingNon||ms.some(q=>!this.isTuner(q)&&this.materialMatches(q,s.includingNon)))&&prior.call(this,p,m,ms,...a);});
 extend('fusionAllowed',function(prior,m,...a){return !def(m)?.fusionProhibited&&prior.call(this,m,...a);});
 extend('xyzValid',function(prior,p,m,ms,up=false){return (up||!def(m)?.xyzDifferentAttributes||new Set(ms.map(q=>this.attribute(q))).size===ms.length)&&prior.call(this,p,m,ms,up);});
 extend('canSpecial',function(prior,p,m,o={}){return !(locked(this,p,'y21Wyrm')&&!Y.wyrm(this,m)||locked(this,p,'y21Tri')&&!X.series(m,'Tri-Brigade')||locked(this,p,'y21LinkExtra')&&this.find(m.uid)?.zone==='extra'&&def(m).type!=='link')&&prior.call(this,p,m,o);});
 extend('linkValid',function(prior,p,m,ms,...a){return (!locked(this,p,'y21BeastMaterials')||ms.every(q=>Y.beast(this,q)))&&prior.call(this,p,m,ms,...a);});
 extend('describe',function(prior,m,...a){return {...prior.call(this,m,...a),...Object.fromEntries(Object.entries(m).filter(([k])=>k.startsWith('y21')))};});
 extend('move',function(prior,u,to,o={}){const f=this.find(u),m=f?.card,r=prior.call(this,u,to,o);if(m&&r&&r.from!==r.to&&field(f.zone))for(const k of Object.keys(m))if(k.startsWith('y21'))delete m[k];return r;});
 // Explicit UID choices and named continuations survive JSON save and replay.
 Y.bottom=(e,c,us)=>{X.moved(e,c,us,'deck','effect-return');Y.orderDeck(e,c,us);};
 Y.normalPool=(e,p,pred=()=>true)=>X.hand(e,p,m=>{const used=e.state.normalUsed;e.state.normalUsed=false;try{return pred(m)&&e.canNormal(m,p)&&e.tributeSets(m,false,p).length;}finally{e.state.normalUsed=used;}});
 Y.normalChoice=(e,c,pool,required=false)=>X.choose(e,c,'选择立即通常召唤的怪兽',pool,required?1:0,1,'y21-normal-select',{role:'special'});
 E.op('y21-normal-select',(e,t)=>{const m=card(e,t.picks[0]);if(!m||e.find(m.uid)?.zone!=='hand')return;const sets=e.tributeSets(m,false,t.owner);if(!sets.length)return;e.queueChoice(t.owner,'选择上级召唤的祭品',sets.map(us=>({uid:JSON.stringify(us),label:us.length?us.map(u=>def(card(e,u)).name).join(' + '):'无需祭品',value:-us.reduce((n,u)=>n+e.cardUtility(card(e,u),t.owner),0)})),1,1,'y21-normal',{uid:m.uid,source:t.context.source});});
 E.op('y21-normal',(e,t)=>{const m=card(e,t.context.uid),us=JSON.parse(t.picks[0]);if(!m||e.find(m.uid)?.zone!=='hand'||!e.tributeSets(m,false,t.owner).some(s=>s.length===us.length&&s.every(u=>us.includes(u))))return;const p=e.state.players[t.owner],saved={active:e.state.active,normal:e.state.normalUsed,phase:e.state.phase,extra:p.extraNormalUsed};try{e.state.active=t.owner;e.state.phase='main1';e.state.normalUsed=false;e._y21EffectNormal=true;if(e.canNormal(m,t.owner))e.normalSummon({uid:m.uid,tributes:us});}finally{delete e._y21EffectNormal;e.state.active=saved.active;e.state.normalUsed=saved.normal;e.state.phase=saved.phase;p.extraNormalUsed=saved.extra;}});
 if(typeof module!=='undefined'){for(const part of ['swordsoul','tenyi','tri-brigade','floowandereeze','support','final'])require('./effects-2021-'+part+'.js');module.exports=X;}
})(globalThis);
