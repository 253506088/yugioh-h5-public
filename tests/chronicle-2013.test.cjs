/* 2013 dedicated rule checks. These use the real engine, real costs and real
 * card movement; they do not assert against display text. */
const test=require('node:test'),fs=require('node:fs'),path=require('node:path');
const {assert,D,E,DuelEngine,put,fresh,fieldCard}=require('./gx-helpers.cjs');
const id=n=>D.cardByName(n).id;
function act(e,a){const r=e.act(a);assert.equal(r.ok,true,JSON.stringify(a)+' / '+r.error);}
function drain(e,{triggers=[],pick}={}){let n=0;while(e.state.pending&&e.state.winner===null&&n++<220){const p=e.state.pending;let a=pick?.(p,e);if(!a){if(p.kind==='window')a={type:'pass'};else if(p.kind==='trigger'&&!p.trigger.mandatory&&!triggers.includes(p.trigger.uid))a={type:'pass'};else a=e.chooseAI(p);}act(e,a);}assert.ok(n<220,'bounded chain/choice resolution');e.assertState();}
// Field a monster the way the engine expects once it has been summoned: the
// summon event is what registers the printed ability as available.
function summoned(e,owner,name,props={}){
 const m=put(e,owner,'monsters',name,{properlySummoned:true,normalSummoned:true,summonKind:'normal',materialCount:0,...props});
 e.emit({type:'summon',owner,id:m.id,uid:m.uid,kind:m.summonKind,from:D.isExtra(D.CARDS[m.id])?'extra':'hand',materials:[],previous:null});e.pump();return m;
}
function activated(e,owner,name){const m=put(e,owner,'spells',name,{faceUp:false,setTurn:0,changedTurn:0});return m;}
function ability(e,uid,key){const a=E.available(e,e.find(uid)?.owner??0,{kind:'main'}).find(a=>a.uid===uid&&a.key===key);assert.ok(a,'expected '+key+' to be available');return a.key;}
function use(e,uid,key,choices={},options={}){act(e,{type:'activate',uid,key,choices});drain(e,options);}
const tokens=(e,p=0)=>e.monsters(p).filter(m=>m.id==='era-mpb-token');
const totalTokens=(e,p=0)=>tokens(e,p).length;
function overlord(e,name,materials=[]){
 const m=put(e,0,'monsters',name,{properlySummoned:true,summonKind:D.CARDS[id(name)].type,materialCount:materials.length||2});
 for(const mat of materials)e.attach(m.uid,mat.uid);
 e.emit({type:'summon',owner:0,id:m.id,uid:m.uid,kind:'xyz',from:'extra',materials:[],previous:null});e.pump();
 // Re-attach after the summon event so the overlay contents survive.
 for(const mat of materials)if(!(m.overlays||[]).some(q=>q.uid===mat.uid))e.attach(m.uid,mat.uid);
 return m;
}
// ---------------------------------------------------------------------------
test('Mecha Phantom Beast tokens raise the printed Level and then block destruction',()=>{
 const e=fresh(),t=fieldCard(e,0,'Mecha Phantom Beast Tetherwolf');
 const base=e.level(t);
 assert.equal(e.attackValue(t),1700);
 e.createTokens(0,'era-mpb-token',1);e.pump();
 assert.equal(totalTokens(e),1);
 assert.equal(e.level(t),base+3);
 assert.equal(e.defenseValue(t),1200);
 assert.equal(e.destroy(t.uid,{owner:1,id:id('Raigeki'),effectType:'spell'}),false);
 assert.equal(e.find(t.uid).zone,'monsters');
});
test('the shared token cost turns an opposing monster face-down and spends the token',()=>{
 const e=fresh(),b=summoned(e,0,'Mecha Phantom Beast Blackfalcon'),foe=fieldCard(e,1,'Blue-Eyes White Dragon');
 e.createTokens(0,'era-mpb-token',1);e.pump();
 const token=tokens(e)[0];
 use(e,b.uid,ability(e,b.uid,b.id+'::era-effect'),{cost:[token.uid],target:[foe.uid]});
 assert.equal(e.find(token.uid),null,'the tributed token left the field');
 assert.equal(e.find(foe.uid).card.position,'defense');
 assert.equal(totalTokens(e),0);
});
test('Dracossack turns a detached material into two tokens that then protect it',()=>{
 const e=fresh(),m1=put(e,0,'grave','Battle Ox'),m2=put(e,0,'grave','Battle Ox');
 const x=overlord(e,'Mecha Phantom Beast Dracossack',[m1,m2]);
 use(e,x.uid,ability(e,x.uid,x.id+'::era-token'),{cost:[m1.uid]});
 assert.equal(e.find(m1.uid).zone,'grave');
 assert.equal(totalTokens(e),2);
 assert.equal(e.destroy(x.uid,{owner:1,id:id('Raigeki'),effectType:'spell'}),false);
});
test('Bujingi Quilin banishes itself to destroy a face-up opposing card',()=>{
 const e=fresh(),yamato=fieldCard(e,0,'Bujin Yamato'),foe=fieldCard(e,1,'Blue-Eyes White Dragon'),q=put(e,0,'grave','Bujingi Quilin');
 use(e,q.uid,ability(e,q.uid,q.id+'::era-quilin'),{target:[foe.uid]});
 assert.equal(e.find(q.uid).zone,'banished');assert.equal(e.find(foe.uid).zone,'grave');
});
test('Bujingi Boar sets the opposing monster to defense and zeroes its DEF',()=>{
 const e=fresh(),yamato=fieldCard(e,0,'Bujin Yamato'),foe=fieldCard(e,1,'Blue-Eyes White Dragon'),b=put(e,0,'grave','Bujingi Boar');
 use(e,b.uid,ability(e,b.uid,b.id+'::era-boar'),{target:[foe.uid]});
 assert.equal(e.find(b.uid).zone,'banished');
 assert.equal(e.find(foe.uid).card.position,'defense');
 assert.equal(e.defenseValue(e.find(foe.uid).card),0);
});
test('Bujingi Wolf protects the Beast-family monsters in battle',()=>{
 const e=fresh(),w=fieldCard(e,0,'Bujingi Wolf'),beast=fieldCard(e,0,'Mother Grizzly'),att=fieldCard(e,1,'Blue-Eyes White Dragon');
 e.state.phase='battle';e.state.active=1;
 act(e,{type:'attack',uid:att.uid,target:beast.uid});drain(e);
 assert.equal(e.find(beast.uid).zone,'monsters');
});
test('Battlin Boxer Glassjaw adds a different Boxer back when a card effect sends it to the GY',()=>{
 const e=fresh(),g=fieldCard(e,0,'Battlin\' Boxer Glassjaw'),other=put(e,0,'grave','Battlin\' Boxer Headgeared');
 e.move(g.uid,'grave',{kind:'effect-send'});e.pump();drain(e,{triggers:[g.uid]});
 assert.equal(e.find(other.uid).zone,'hand');
});
test('Noble Knight Medraut becomes DARK and gains a Level while it holds a Noble Arms',()=>{
 const e=fresh(),k=fieldCard(e,0,'Noble Knight Medraut'),arms=put(e,0,'hand','Noble Arms - Gallatin');
 assert.equal(e.isNormalMonster(k),true);
 use(e,arms.uid,ability(e,arms.uid,arms.id+'::cast'),{target:[k.uid]});
 assert.equal(e.attribute(k),'暗');
 assert.equal(e.level(k),5);
 assert.equal(e.isNormalMonster(k),false);
 assert.equal(e.attackValue(k),2700);
});
test('Archfiend Emperor halves its stats when Normal Summoned without a tribute',()=>{
 const e=fresh(),em=put(e,0,'hand','Archfiend Emperor, the First Lord of Horror');
 assert.equal(e.tributeCount(em),0);
 e.state.normalUsed=false;
 act(e,{type:'summon',uid:em.uid});drain(e);
 assert.equal(e.attackValue(em),1500);
 assert.equal(e.level(em),8);
});
test('Sacred Sword of Seven Stars banishes a Level 7 as a real cost and draws two',()=>{
 const e=fresh(),s=put(e,0,'hand','Sacred Sword of Seven Stars'),ruler=put(e,0,'hand','Blaster, Dragon Ruler of Infernos');
 const before=e.state.players[0].deck.length;
 use(e,s.uid,ability(e,s.uid,s.id+'::cast'),{cost:[ruler.uid]});

 assert.equal(e.find(ruler.uid).zone,'banished');
 assert.equal(e.state.players[0].deck.length,before-2);
 assert.equal(e.find(s.uid).zone,'grave');
});
test('Ghostrick members require another Ghostrick on the field to be Normal Summoned',()=>{
 const e=fresh(),stein=put(e,0,'hand','Ghostrick Stein');
 assert.equal(e.canNormal(stein,0),false);
 fieldCard(e,0,'Ghostrick Jiangshi');
 assert.equal(e.canNormal(stein,0),true);
});
test('Evilswarm Exciton Knight wipes the board and stops all further damage',()=>{
 const e=fresh(),m=put(e,0,'grave','Sangan');
 const x=overlord(e,'Evilswarm Exciton Knight',[m]);
 const a=fieldCard(e,0,'Battle Ox'),b=fieldCard(e,1,'Blue-Eyes White Dragon');
 // Exciton needs the opponent to hold more cards than you do.
 fieldCard(e,1,'Man-Eater Bug');put(e,1,'hand','Battle Ox');put(e,1,'hand','Sangan');
 use(e,x.uid,ability(e,x.uid,x.id+'::era-reset'),{cost:[m.uid]});
 assert.equal(e.find(a.uid).zone,'grave');assert.equal(e.find(b.uid).zone,'grave');
 assert.notEqual(e.find(x.uid).zone,'grave');
 e.damage(0,1000,'效果');
 assert.equal(e.state.players[0].lp,8000);
});
test('the five 2013 annual decks exist, are localized and are legal',()=>{
 const Decks=require('../src/deck-tools.js');
 const table=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/decks-2013.json')));
 assert.equal(table.decks.length,5);
 assert.equal(Object.values(D.DECKS).filter(d=>d.year===2013).length,5);
 for(const d of table.decks){
  const deck=D.DECKS[d.id];
  assert.ok(deck,'deck registered: '+d.id);
  assert.equal(deck.year,2013);
  assert.equal(deck.cards.length,40);
  assert.ok(deck.extra.length<=15);
  assert.ok([...deck.cards,...deck.extra].every(i=>D.CARDS[i].releaseYear<=2013));
  assert.ok(Decks.analyze(deck).valid,JSON.stringify(Decks.analyze(deck).errors));
  assert.ok(d.descriptionEn&&d.descriptionJa,'both translations are present');
 }
});
test('the two archetype decks are built from cards this batch implemented',()=>{
 // Fire Fist and Bujin exist because of the 2013 rollout: their 2013 members were
 // pending until this batch, so a deck carrying them is genuine coverage.
 const Decks=require('../src/deck-tools.js');
 const cars={
  'fire-fist-2013':/Fire Fist|Fire Formation/,
  'bujin-2013':/Bujin/
 };
 for(const [id,re] of Object.entries(cars)){
  const deck=D.DECKS[id];
  assert.ok(deck,'deck exists: '+id);
  const theme=[...deck.cards,...deck.extra].filter(i=>re.test(D.CARDS[i].officialName||''));
  assert.ok(theme.length>=15,id+' should be built around its own archetype, found '+theme.length);
  assert.ok(theme.every(i=>D.CARDS[i].releaseYear<=2013),id+' stays within the year');
  // The archetype's 2013 members must all be registered, not pending.
  const mine=theme.filter(i=>D.CARDS[i].releaseYear===2013);
  assert.ok(mine.length>=8,id+' should lean on 2013 members, found '+mine.length);
  assert.ok(mine.every(i=>D.CARDS[i].implementationStatus!=='pending'),id+' uses an unimplemented card');
  assert.ok(Decks.analyze(deck).valid,JSON.stringify(Decks.analyze(deck).errors));
 }
});
test('every 2013 identity is either implemented or explicitly pending, never silently absent',()=>{
 const rows=D.CARD_LIST.filter(c=>c.early&&c.releaseYear===2013);
 assert.equal(rows.length,528);
 for(const c of rows)assert.ok(['implemented','pending','existing'].includes(c.implementationStatus),c.officialName);
 const booleans=D.CARD_LIST.filter(c=>c.releaseYear===2013&&c.implementationStatus==='pending');
 assert.ok(booleans.every(c=>c.implementationNote&&/待落实/.test(c.implementationNote)),'pending rows carry a note');
});
