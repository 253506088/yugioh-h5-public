/* 2016 shared rules. Effect modules use explicit card registrations; pending
 * cards remain unavailable until an executable implementation is registered. */
(function(root){
 'use strict';
 const X=root.DuelChronicle,{D,E,H,C,I,extend,card,def,field,monster,series,allF,active}=X;
 const authoredNotes=new Map(),previousMark=X.mark;
 X.mark=function(name,note,status){if(note?.startsWith('本作适配')&&C(name)?.releaseYear===2016){const notes=authoredNotes.get(C(name).id)||new Set();notes.add(note);authoredNotes.set(C(name).id,notes);}return previousMark(name,note,status);};
 const fm=z=>z==='monsters'||z==='extraMonster',pend=m=>!!def(m)?.pendulum||def(m)?.type==='pendulum';
 const live=(e,n,p=null)=>allF(e).filter(m=>X.is(m,n)).map(m=>e.find(m.uid)).filter(f=>(p===null||f.owner===p)&&active(e,f.card));
 const limit=n=>H.once('2016-'+n,'name');
 const Y=X.year2016={...X.year2015,fm,pend,live,limit,authoredNotes};
 Y.canSend=(e,m)=>H.canSendGY(e,m)&&(!e.graveCostAllowed||e.graveCostAllowed(m));
 // Material qualifications are checked against the actual card instance.
 extend('materialMatches',function(prior,m,s,...a){const f=this.find(m.uid);return (!s.maxAtk||this.attackValue(m)<=s.maxAtk)&&(!s.originalMinLevel||def(m).level>=s.originalMinLevel)&&(!s.effect||!this.isNormalMonster(m))&&(!s.fieldOnly||fm(f?.zone))&&(!s.noTokens||def(m).type!=='token')&&(!s.summonedFromExtra||fm(f?.zone)&&!!m.y16FromExtra)&&prior.call(this,m,s,...a);});
 E.on('summon',(e,v)=>{const m=card(e,v.uid);if(m)m.y16FromExtra=v.from==='extra';});
 extend('ritualAccepts',function(prior,id,m){return !!m&&def(m).type==='ritual'&&!!D.CARDS[id]?.ritualSeriesAny?.some(n=>series(m,n))||prior.call(this,id,m);});
 extend('xyzValid',function(prior,p,m,ms,rankUp=false){const d=def(m);if(!rankUp&&d?.xyzMaterialType==='xyz'&&d.releaseYear===2016)return ms.length===d.xyzCount&&new Set(ms.map(q=>q.uid)).size===ms.length&&this.canSpecial(p,m,{via:'xyz'})&&this.freeZones(p,m,{materials:ms.map(q=>q.uid)}).length>0&&ms.every(q=>{const f=this.find(q.uid);return f?.owner===p&&fm(f.zone)&&q.faceUp&&def(q).type==='xyz'&&!def(q).cannotXyz&&(!d.xyzNameIncludes||series(q,d.xyzNameIncludes))&&(!d.xyzSameRank||def(q).rank===def(ms[0]).rank)&&(!d.xyzSameName||this.cardNameId(q)===this.cardNameId(ms[0]));});return (!d?.xyzGemini||rankUp||ms.every(q=>def(q).gemini))&&prior.call(this,p,m,ms,rankUp);});
 for(const d of D.CARD_LIST.filter(c=>c.releaseYear===2016)){
  // Older generic Spirit/Gemini/Ritual builders register their shared procedure
  // for future cards too. That does not implement those cards' other effects.
  if(!d.existing&&d.effect){d.implementationStatus='pending';d.implementationNote='2016 年效果待落实，不可编入正式构筑';}
  const text=d.originalDescription||'';
  if(d.type==='fusion'&&/Must be Fusion Summoned/.test(text))d.fusionOnly=true;
  if(d.type==='fusion'&&/Must first be Fusion Summoned/.test(text))d.specialOnly='fusion';
  if(/Must be (Synchro|Ritual) Summoned, and cannot/.test(text)){d.specialOnly=d.type;d.eraStrictSummon=true;}
  if(/(?:This card c|C)annot be Special Summoned\./.test(text))d.noSpecial=true;
 }
 extend('move',function(prior,u,to,o={}){const f=this.find(u),m=f?.card,r=prior.call(this,u,to,o);if(m&&field(f.zone)&&r&&r.from!==r.to)for(const k of Object.keys(m))if(k.startsWith('y16'))delete m[k];return r;});
 extend('describe',function(prior,m,...a){return {...prior.call(this,m,...a),...Object.fromEntries(Object.entries(m).filter(([k])=>k.startsWith('y16')))};});
 if(typeof module!=='undefined'){for(const part of ['blue-eyes','zoodiac','staples','kaiju','ritual','abc','metalfoes','invoked','darklord','lunalight','kozmo','final'])require('./effects-2016-'+part+'.js');module.exports=X;}
})(globalThis);
