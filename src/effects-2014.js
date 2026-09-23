/* 2014 shared rules. Each card is registered explicitly in its own volume.
 * Metadata alone never upgrades a pending effect to a playable card. */
(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,I,is,extend,card,def,series,active,allM,allF,field}=X;
 const fieldMonster=z=>z==='monsters'||z==='extraMonster';
 const live=(e,n,p=null)=>allF(e).map(m=>e.find(m.uid)).filter(f=>(p===null||f.owner===p)&&is(f.card,n)&&active(e,f.card));
 const overlay=(e,c,n)=>card(e,c.uid)?.overlays?.some(m=>is(m,n));
 const overlays=(e,c)=>card(e,c.uid)?.overlays||[];
 const limit=n=>H.once('2014-'+n,'name');
 const banish=(e,c,uids)=>X.moved(e,c,uids,'banished','effect-banish');
 const back=(e,c,uids)=>{X.moved(e,c,uids,'deck','effect-return');for(const p of [0,1])e.shuffle(e.state.players[p].deck);};
 const burn=(e,c,n)=>e.damage(1-c.owner,n,'效果',c.source);
 const setFlag=(e,c,key,value=true)=>{const m=card(e,c.uid);if(m)m[key]=value;};
 const stamp=(e,c,key)=>setFlag(e,c,key,e.state.turn);
 Object.assign(X,{year2014:{fieldMonster,live,overlay,overlays,limit,banish,back,burn,setFlag,stamp}});
 for(const d of D.CARD_LIST.filter(c=>c.releaseYear===2014)){
  if(d.type==='fusion'&&/Must (?:first )?be Fusion Summoned/.test(d.originalDescription||''))d.fusionOnly=true;
  if(d.masked)d.specialOnly='mask';
  if(/(?:This card c|C)annot be Special Summoned\./.test(d.originalDescription||''))d.noSpecial=true;
  if(/cannot be Special Summoned by other ways/i.test(d.originalDescription||''))d.eraStrictSummon=true;
 }
 // Same-name Fusion materials and heterogeneous Extra Deck materials were
 // introduced by the retained source grammar in this batch.
 extend('materialMatches',function(prior,m,s,...a){return (!s.types||s.types.includes(def(m)?.type))&&prior.call(this,m,s,...a);});
 extend('fusionValid',function(prior,p,m,list,s){return prior.call(this,p,m,list,s)&&(!def(m).fusionSameName||list.every(q=>this.cardNameId(q)===this.cardNameId(list[0])));});
 extend('synchroValid',function(prior,p,m,list,...a){return !def(m)?.synchro?.noSummon&&prior.call(this,p,m,list,...a);});
 extend('xyzValid',function(prior,p,m,list,rankUp=false){
  const d=def(m);if(d?.xyzMaterialType!=='xyz'||rankUp)return prior.call(this,p,m,list,rankUp);
  if(!this.canSpecial(p,m,{via:'xyz'})||list.length!==(d.xyzCount||2)||new Set(list.map(q=>q.uid)).size!==list.length)return false;
  if(!this.freeZones(p,m,{materials:list.map(q=>q.uid)}).length)return false;
  return list.every(q=>{const f=this.find(q.uid);return f?.owner===p&&fieldMonster(f.zone)&&q.faceUp&&def(q).type==='xyz'&&!def(q).cannotXyz&&(!d.xyzExcludeNameIncludes||!series(q,d.xyzExcludeNameIncludes))&&(!d.xyzSameRank||def(q).rank===def(list[0]).rank);});
 });
 // Store battle-end information before cards are moved. It survives a save
 // between damage calculation and the ensuing trigger choices.
 extend('finishBattle',function(prior,a){
  const participants=[a.uid,a.target].map(uid=>this.find(uid)).filter(Boolean).map(f=>({uid:f.card.uid,id:f.card.id,owner:f.owner,card:this.describe(f.card)}));
  const result=prior.call(this,a);
  if(this.state.winner===null&&!a.cancelDamage){for(const f of participants){const m=card(this,f.uid);if(m)m.eraBattled2014=this.state.turn;}this.emit({type:'2014-battle-finished',owner:a.owner,attack:JSON.parse(JSON.stringify(a)),participants});}
  return result;
 });
 // These serializable flags are used only by authored effects below.
 extend('unaffected',function(prior,m,s){if(prior.call(this,m,s))return true;return !!s&&fieldMonster(this.find(m?.uid)?.zone)&&m.faceUp&&(m.era2014Immune>=this.state.turn&&s.uid!==m.uid||m.era2014MonsterImmune&&s.effectType==='monster'&&s.uid!==m.uid);});
 extend('move',function(prior,uid,to,o={}){const f=this.find(uid),m=f?.card,was=f&&fieldMonster(f.zone),r=prior.call(this,uid,to,o);if(was&&r?.from!==r?.to&&m){for(const k of ['era2014Immune','era2014MonsterImmune','eraBattled2014','era2014OnlyAttacker'])delete m[k];}return r;});
 if(typeof module!=='undefined'){for(const v of ['themes','nekroz','support','pendulum','samurai','monarch','knights','archetypes','monsters','spells','traps','xyz','final'])require('./effects-2014-'+v+'.js');module.exports=X;}
})(globalThis);
