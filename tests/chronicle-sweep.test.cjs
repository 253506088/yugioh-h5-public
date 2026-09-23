/* Runtime sweep, not an official-ruling certificate. Each card receives a
 * populated fixture, legal activation opportunities and real turn/battle acts.
 * Dedicated Chronicle tests separately verify costs, summon procedures and outcomes. */
const test=require('node:test'),fs=require('node:fs'),path=require('node:path');
const {assert,D,E,put,act,settle,run,fresh,fieldCard}=require('./gx-helpers.cjs');
const report={cards:[],errors:[]},out=path.resolve(__dirname,'../output/chronicle-sweep');fs.mkdirSync(out,{recursive:true});
const cards=D.CARD_LIST.filter(c=>c.early&&c.releaseYear>=2009&&c.releaseYear<=2014&&(!process.env.DUEL_YEAR||c.releaseYear===Number(process.env.DUEL_YEAR)));
const quoted=d=>[...d.originalDescription.matchAll(/"([^"]+)"/g)].map(m=>D.cardByName(m[1])).filter(c=>c&&c.id!==d.id&&!c.notCollectible).slice(0,8);
function fixture(d){const e=fresh(d.providerId);for(const p of e.state.players)p.lp=16000;
 for(const n of ['Battle Ox','Mystical Shine Ball'])fieldCard(e,0,n);fieldCard(e,1,'Blue-Eyes White Dragon');fieldCard(e,1,'Man-Eater Bug',{faceUp:false,position:'defense'});
 for(const p of [0,1])for(const n of ['Blue-Eyes White Dragon','Sangan','Harpie Lady','Mother Grizzly','UFO Turtle','Giant Rat','Pot of Greed','Monster Reborn'])put(e,p,'grave',n);
 for(const p of [0,1])for(const n of ['Dark Magician','Battle Ox','Sparks','Mystical Space Typhoon','Pot of Greed'])put(e,p,'hand',n);
 for(const q of quoted(d)){if(D.isExtra(q)){put(e,0,'extra',q.id);continue;}put(e,0,'deck',q.id);put(e,0,'hand',q.id);put(e,0,'grave',q.id);}
 return e;
}
for(const d of cards)test(d.releaseYear+' runtime sweep · '+d.officialName,()=>{
 const e=fixture(d);let source;
 try{
  if(D.isMonster(d)){source=fieldCard(e,0,d.id,{properlySummoned:D.isExtra(d)||d.type==='ritual',normalSummoned:true,summonKind:D.isExtra(d)?d.type:'normal',materialCount:3});
   e.emit({type:'summon',owner:0,id:d.id,uid:source.uid,kind:D.isExtra(d)?d.type:'normal',from:D.isExtra(d)?'extra':'hand',materials:[],previous:null});e.pump();settle(e,source.uid);
   if(d.flip&&e.find(source.uid)?.zone==='monsters'){source.faceUp=false;e.flipFaceUp(source.uid,{source:src(d)});e.pump();settle(e,source.uid);}
  }else source=put(e,0,d.type==='trap'||d.spellKind==='quick'?'spells':'hand',d.id,{faceUp:false});
  if(e.state.winner===null){e.state.active=0;e.state.phase='main1';const a=E.available(e,0,{kind:'main'}).find(a=>a.uid===source.uid);if(a)run(e,{type:'activate',uid:a.uid,key:a.key},source.uid);}
  for(const owner of [0,1]){if(e.state.winner!==null)break;e.state.active=owner;e.state.phase='main1';e.state.frame={kind:'standby',owner,stage:1,windowOffered:true};e.emit({type:'standby',owner});e.pump();settle(e,source.uid);}
  if(e.state.winner===null){e.state.frame=null;e.state.active=1;e.state.phase='main1';const spell=e.state.players[1].hand.find(m=>D.CARDS[m.id].officialName==='Pot of Greed'),a=spell&&E.available(e,1,{kind:'main'}).find(a=>a.uid===spell.uid);if(a)run(e,{type:'activate',uid:a.uid,key:a.key},source.uid);}
  if(e.state.winner===null){e.state.active=1;e.state.phase='battle';const attacker=e.monsters(1).find(m=>m.faceUp&&m.position==='attack'),target=e.monsters(0)[0];if(attacker&&e.canAttack(attacker,1,target?.uid))run(e,{type:'attack',uid:attacker.uid,...(target?{target:target.uid}:{})},source.uid);}
  if(e.state.winner===null){e.state.active=0;e.state.phase='main1';e.state.frame=null;run(e,{type:'end'},source.uid);}
  if(e.state.winner===null&&e.find(source.uid)&&!['grave','banished'].includes(e.find(source.uid).zone)){e.destroy(source.uid,src(d));e.pump();settle(e,source.uid);}
  e.assertState();report.cards.push({id:d.id,year:d.releaseYear,effectExecuted:e.state.log.some(l=>l.key?.startsWith(d.id+'::')),events:e.state.log.length});
 }catch(error){report.errors.push({id:d.id,name:d.officialName,error:error.stack});fs.writeFileSync(path.join(out,d.id+'.json'),JSON.stringify(e.snapshot()));throw error;}
});
function src(){return {id:D.cardByName('Raigeki').id,owner:1,effectType:'spell'};}
test.after(()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)));
