/* 2020 contracts: source identity, playable effects and historical lists stay distinct. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,extend,card,def,field,monster,series,locked}=X;
 const Y=X.year2020={...X.year2019,limit:n=>H.once('2020-'+n,'name')};
 for(const d of D.CARD_LIST.filter(c=>c.releaseYear===2020)){
  if(!d.existing&&d.effect){d.implementationStatus='pending';d.implementationNote='2020 年效果待落实，不可编入正式构筑';}
  if(d.type==='fusion'&&/Must be Fusion Summoned/.test(d.originalDescription||''))d.fusionOnly=true;
 }
 Y.opponentEnd=(e,p)=>e.state.turn+(e.state.active===p?1:0);
 Y.ownNextEnd=(e,p)=>e.state.turn+(e.state.active===p?2:1);
 Y.extra=(e,p)=>e.state.players[p].extra;
 Y.ban=(e,p,pred=()=>true)=>e.state.players[p].banished.filter(m=>m.faceUp!==false&&pred(m));
 Y.extraMonster=m=>['fusion','synchro','xyz','link'].includes(def(m)?.type);
 Y.rank=(e,m)=>m.y20Rank?.turn>=e.state.turn?m.y20Rank.value:def(m)?.rank||0;
 Y.chooseSets=(e,c,title,pool,sets,op,data={})=>{if(!sets.length)return;const us=new Set(sets.flat());e.queueChoice(c.owner,title,pool.filter(m=>us.has(m.uid)).map(m=>e.option(m,{viewer:c.owner})),Math.min(...sets.map(s=>s.length)),Math.max(...sets.map(s=>s.length)),op,{source:c.source,...data},{sets});};
 extend('chooseAI',function(prior,p){if(p.kind==='choice'&&p.sets?.length)return {type:'choose',uids:p.sets.slice().sort((a,b)=>b.reduce((n,u)=>n+this.cardUtility(card(this,u),p.owner),0)-a.reduce((n,u)=>n+this.cardUtility(card(this,u),p.owner),0))[0]};return prior.call(this,p);});
 extend('canSpecial',function(prior,p,m,o={}){return !(locked(this,p,'y20Zombie')&&this.race(m)!=='不死族'||locked(this,p,'y20Rock')&&this.race(m)!=='岩石族'||locked(this,p,'y20NoExtra')&&this.find(m.uid)?.zone==='extra'||locked(this,p,'y20Level3')&&(def(m)?.type==='link'||(def(m)?.type==='xyz'?Y.rank(this,m):this.level(m))<3))&&prior.call(this,p,m,o);});
 extend('linkValid',function(prior,p,m,ms,...a){const s=def(m)?.link||{};return ms.every(q=>!s.minLinkRating||def(q).linkRating>=s.minLinkRating)&&(!s.includingSeriesAttribute||ms.some(q=>series(q,s.includingSeries)&&this.attribute(q)===s.includingSeriesAttribute))&&(!s.includingSeriesLink||ms.some(q=>series(q,s.includingSeries)&&def(q).type==='link'))&&prior.call(this,p,m,ms,...a);});
 extend('xyzValid',function(prior,p,m,ms,up=false){const d=def(m);return (up||(!d.xyzSameRace||new Set(ms.map(q=>this.race(q))).size===1)&&(!d.xyzSameAttribute||new Set(ms.map(q=>this.attribute(q))).size===1))&&prior.call(this,p,m,ms,up);});
 // Fossil Fusion cards remain pending; their imported qualifications are still enforced.
 extend('materialMatches',function(prior,m,s,p=null){const f=this.find(m.uid),owner=p??this._y20FusionOwner??this.state.active;return (s.minAtk===undefined||this.attackValue(m)>=s.minAtk)&&(!s.levels||s.levels.includes(this.level(m)))&&(!s.graveOnly||f?.zone==='grave')&&(!s.graveOpponent||f?.owner!==owner)&&(!s.graveOwn||f?.owner===owner)&&(!s.specialSummonedThisTurn||Y.fm(f?.zone)&&m.summonTurn===this.state.turn&&m.summonKind&&!['normal','set','flip'].includes(m.summonKind))&&prior.call(this,m,s,p);});
 for(const key of ['fusionValid','fusionCombos'])extend(key,function(prior,p,...a){const prev=this._y20FusionOwner;this._y20FusionOwner=p;try{return prior.call(this,p,...a);}finally{this._y20FusionOwner=prev;}});
 extend('describe',function(prior,m,...a){return {...prior.call(this,m,...a),...Object.fromEntries(Object.entries(m).filter(([k])=>k.startsWith('y20')))};});
 extend('move',function(prior,u,to,o={}){const f=this.find(u),m=f?.card,r=prior.call(this,u,to,o);if(m&&r&&r.from!==r.to&&field(f.zone))for(const k of Object.keys(m))if(k.startsWith('y20'))delete m[k];return r;});
 if(typeof module!=='undefined'){for(const part of ['eldlich','dogmatika','adamancipator','virtual-world','support','final'])require('./effects-2020-'+part+'.js');module.exports=X;}
})(globalThis);
