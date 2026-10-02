/* 2018 shared contracts. Collection does not imply executable effect coverage. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,is,extend,card,def,field,monster,series}=X;
 const Y=X.year2018={...X.year2017,limit:n=>H.once('2018-'+n,'name')};
 for(const d of D.CARD_LIST.filter(c=>c.releaseYear===2018)){
  if(!d.existing&&d.effect){d.implementationStatus='pending';d.implementationNote='2018 年效果待落实，不可编入正式构筑';}
  if(d.type==='fusion'&&/Must be Fusion Summoned/.test(d.originalDescription||''))d.fusionOnly=true;
 }
 Y.choiceContext=t=>({owner:t.owner,source:t.context.source});
 Y.spellsInGY=(e,p)=>X.grave(e,p,m=>def(m).type==='spell').length;
 Y.set=(e,c,u)=>{E.ops['gx-set'](e,{owner:c.owner,picks:[u],context:{source:c.source}});return e.find(u)?.zone==='spells'?card(e,u):null;};
 Y.negate=(e,c,u,until=e.state.turn)=>{const m=card(e,u);if(m&&m.faceUp&&field(e.find(u)?.zone)&&!e.unaffected(m,c.source)){X.negateMonster(e,u,until);return true;}return false;};
 Y.banishDown=(e,c,us,kind='effect-banish')=>{for(const u of us){const f=e.find(u);if(f&&def(f.card).type!=='token'&&(!kind.startsWith('effect')||!field(f.zone)||!e.unaffected(f.card,c.source)))e.move(u,'banished',{kind,source:c.source,byOwner:c.owner,faceDown:true});}};
 extend('emit',function(prior,v){if(v.type==='move'&&v.to==='banished'&&v.faceDown){const m=card(this,v.uid);if(m)m.faceUp=false;}return prior.call(this,v.type==='summon'&&this.state.resolvingLink?{...v,effectSource:this.state.resolvingLink.source}:v);});
 extend('addTrigger',function(prior,u,...a){const f=this.find(u);if(f?.zone==='banished'&&f.card.faceUp===false)return;return prior.call(this,u,...a);});
 extend('linkValid',function(prior,p,m,ms,...a){const s=def(m)?.link||{};
  return ms.every(q=>(!s.minLevel||this.level(q)>=s.minLevel)&&(!s.excludeAttribute||this.attribute(q)!==s.excludeAttribute)&&(!s.excludeName||!is(q,s.excludeName)))&&
   (!s.includingType||ms.some(q=>def(q).type===s.includingType))&&(!s.includingToken||ms.some(q=>def(q).type==='token'))&&
   (!s.includingName||ms.some(q=>is(q,s.includingName)))&&(!s.includingMinAtk||ms.some(q=>this.attackValue(q)>=s.includingMinAtk))&&
   (!s.includingSeries||ms.some(q=>series(q,s.includingSeries)&&(!s.includingSeriesTuner||this.isTuner(q))))&&prior.call(this,p,m,ms,...a);
 });
 extend('materialMatches',function(prior,m,s,...a){return (!s.extraMonsterZone||this.find(m.uid)?.zone==='extraMonster')&&(!s.maxLevel||this.level(m)>0&&this.level(m)<=s.maxLevel)&&prior.call(this,m,s,...a);});
 extend('fusionValid',function(prior,p,m,ms,...a){const d=def(m);return (!d.neoSpacianDifferentAttributes||new Set(ms.filter(q=>series(q,'Neo-Spacian')).map(q=>this.attribute(q))).size===3)&&prior.call(this,p,m,ms,...a);});
 extend('describe',function(prior,m,...a){return {...prior.call(this,m,...a),...Object.fromEntries(Object.entries(m).filter(([k])=>k.startsWith('y18')))};});
 extend('move',function(prior,u,to,o={}){const f=this.find(u),m=f?.card,r=prior.call(this,u,to,o);if(m&&r&&r.from!==r.to&&field(f.zone))for(const k of Object.keys(m))if(k.startsWith('y18'))delete m[k];return r;});
 if(typeof module!=='undefined'){for(const part of ['striker','altergeist','gouki','thunder','links','support','final'])require('./effects-2018-'+part+'.js');module.exports=X;}
})(globalThis);
