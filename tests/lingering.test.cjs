const test=require('node:test'),assert=require('node:assert/strict');
const {DuelEngine}=require('../src/advanced-engine.js');
require('../src/advanced-effects.js');
const L=require('../src/lingering.js'),I=require('../src/i18n.js');
const {D,put,act,settle,run}=require('./yearly-sweep-helpers.cjs');
function fresh(owner=0){
  const e=new DuelEngine({deck:'blue',opponentDeck:'dark',first:owner,seed:91306});
  e.state.turn=4;e.state.phase='main1';e.state.active=owner;
  for(const p of e.state.players){p.deck.push(...p.hand);p.hand=[];}
  return e;
}
const cast=c=>({type:'activate',uid:c.uid,key:c.id+'::cast'});
function peace(){const e=fresh(),card=put(e,0,'hand','One Day of Peace');for(const owner of [0,1])for(let i=0;i<3;i++)put(e,owner,'deck','Battle Ox');run(e,cast(card));return {e,card};}

test('One Day of Peace is recorded for both players and attributed to the card that resolved',()=>{
  const {e,card}=peace();
  assert.equal(e.state.lingering.length,2);
  for(const [index,owner] of [0,1].entries()){
    const entry=e.state.lingering[index];
    assert.equal(entry.scope,'player');assert.equal(entry.owner,owner);assert.equal(entry.key,'preventDamageUntil');assert.equal(entry.value,5);
    assert.equal(entry.sourceId,'one-day-peace');assert.equal(entry.by,0);assert.equal(entry.sourceUid,card.uid);assert.equal(entry.chain,1);
  }
  const active=L.collect(e);assert.equal(active.length,2);
  assert.deepEqual(L.forOwner(active,0).map(x=>x.owner),[0]);assert.deepEqual(L.forOwner(active,1).map(x=>x.owner),[1]);
  const zh=L.describe(active[0],{language:'zh-CN',turn:e.state.turn});
  assert.equal(zh.text,'不会受到任何伤害');assert.equal(zh.duration,'至第 5 回合');assert.equal(zh.source,'一时休战');assert.equal(zh.until,5);
  assert.equal(L.describe(active[0],{language:'en',turn:e.state.turn}).text,'Takes no damage');
  assert.equal(L.describe(active[0],{language:'ja',turn:e.state.turn}).duration,'5ターン目まで');
  assert.equal(L.describe(active[0],{language:'en',turn:e.state.turn,cardName:id=>I.references[id]?.locales.en.name||id}).source,'One Day of Peace');
});

test('entries expire with the rule they describe and are pruned at the start of a turn',()=>{
  const {e}=peace();
  e.state.turn=5;assert.equal(L.collect(e).length,2,'still protected on the following turn');
  e.state.turn=6;assert.equal(L.collect(e).length,0,'protection has lapsed');
  assert.equal(e.state.lingering.length,2,'raw records remain until the engine prunes them');
  L.prune(e);assert.equal(e.state.lingering.length,0);
});

test('turn progression through the real engine prunes stale records',()=>{
  const {e}=peace();
  for(let i=0;i<2;i++){run(e,{type:'end'});}
  assert.equal(e.state.turn,6);assert.equal(e.state.lingering.filter(x=>x.key==='preventDamageUntil').length,0);
});

test('Pot of Duality records the era lock with its own duration and Japanese label',()=>{
  const e=fresh(),pot=put(e,0,'hand','Pot of Duality');for(let i=0;i<5;i++)put(e,0,'deck','Battle Ox');
  run(e,cast(pot));
  const entry=e.state.lingering.find(x=>x.key==='eraLocks.noSpecial');assert.ok(entry);assert.equal(entry.owner,0);assert.equal(entry.sourceId,pot.id);
  const view=L.describe(entry,{language:'ja',turn:e.state.turn});assert.equal(view.text,'特殊召喚できない');assert.equal(view.duration,'このターン');
  assert.equal(L.describe(entry,{language:'zh-CN',turn:e.state.turn}).text,'不能特殊召唤');
  assert.equal(L.collect(e).length,1);e.state.turn++;assert.equal(L.collect(e).length,0);
});

test('Effect Veiler produces a card-scoped entry that names the negated monster',()=>{
  const e=fresh(1),veiler=put(e,0,'hand','Effect Veiler'),target=put(e,1,'monsters','Sangan');put(e,1,'monsters','Blue-Eyes White Dragon');
  e.state.frame={kind:'main-open',owner:1,windowOffered:false};e.pump();
  const p=e.state.pending;assert.equal(p?.kind,'window');assert.ok(p.options.some(o=>o.uid===veiler.uid));
  act(e,{type:'respond',uid:veiler.uid,key:veiler.id+'::era-negate',choices:{target:[target.uid]}});settle(e);
  assert.equal(e.negated(e.find(target.uid).card),true);
  const [entry]=L.collect(e);assert.equal(entry.scope,'card');assert.equal(entry.uid,target.uid);assert.equal(entry.owner,1);assert.equal(entry.cardId,'sangan');assert.equal(entry.sourceId,veiler.id);
  assert.equal(L.describe(entry,{language:'zh-CN',turn:e.state.turn}).text,'效果无效');
  assert.deepEqual(L.forOwner(L.collect(e),1).length,1);assert.equal(L.forOwner(L.collect(e),0).length,0);
});

test('Waboku is attributed to the responder who activated it',()=>{
  const e=fresh(),waboku=put(e,1,'spells','Waboku',{faceUp:false}),attacker=put(e,0,'monsters','Blue-Eyes White Dragon'),ox=put(e,1,'monsters','Battle Ox');e.state.phase='battle';
  act(e,{type:'attack',uid:attacker.uid,target:ox.uid});
  const p=e.state.pending;assert.equal(p?.kind,'window');
  act(e,{type:'respond',uid:waboku.uid,key:waboku.id+'::cast'});settle(e);
  const entry=e.state.lingering.find(x=>x.key==='wabokuTurn');assert.ok(entry);assert.equal(entry.owner,1);assert.equal(entry.by,1);assert.equal(entry.sourceId,'waboku');
  assert.equal(L.describe(entry,{language:'en',turn:e.state.turn}).text,'No battle damage; monsters are not destroyed by battle');
  assert.equal(e.find(ox.uid).zone,'monsters','Waboku kept the monster');
});

test('bookkeeping flags that merely remember what happened are not shown as effects',()=>{
  const e=fresh(),before=L.fingerprint(e.state);
  const p=e.state.players[0];p.eraSpecialTurn=e.state.turn;p.summonedThisTurn=2;p.usedTurn['x']=e.state.turn;e.state.players[1].eraXyzTurn=e.state.turn;
  assert.deepEqual(L.record(e,before,{sourceId:'blue-eyes',by:0}),[]);
  p.threateningRoarTurn=e.state.turn;
  const added=L.record(e,before,{sourceId:'early-36361633',by:1});
  assert.equal(added.length,1);assert.equal(added[0].key,'threateningRoarTurn');
  assert.equal(L.describe(added[0],{language:'zh-CN',turn:e.state.turn}).text,'不能宣言攻击');
});

test('unknown future flags fall back to a label that still names the source card',()=>{
  const e=fresh(),before=L.fingerprint(e.state);
  e.state.players[1].somethingNewUntil=e.state.turn+2;
  const [entry]=L.record(e,before,{sourceId:'dark-hole',by:0});
  assert.equal(entry.owner,1);
  const view=L.describe(entry,{language:'zh-CN',turn:e.state.turn});assert.equal(view.text,'「黑洞」的效果生效中');assert.equal(view.duration,'至第 6 回合');
  assert.equal(L.describe(entry,{language:'en',turn:e.state.turn,cardName:()=>'Dark Hole'}).text,'"Dark Hole" is in effect');
});

test('records survive save and restore, and legacy saves without them still load',()=>{
  const {e}=peace();
  const restored=DuelEngine.restore(e.snapshot());assert.equal(L.collect(restored).length,2);assert.deepEqual(restored.state.lingering,e.state.lingering);
  const legacy=e.snapshot();delete legacy.state.lingering;delete legacy.state.nextLingering;
  const old=DuelEngine.restore(legacy);assert.deepEqual(old.state.lingering,[]);assert.equal(L.collect(old).length,0);
  assert.equal(old.state.players[0].preventDamageUntil,5,'the rule itself is untouched by the missing display record');
});

test('observing lingering effects never changes the duel state or the AI decision',()=>{
  const {e}=peace();
  const before=e.snapshot();L.collect(e);L.describe(e.state.lingering[0],{language:'en',turn:e.state.turn});L.forOwner(L.collect(e),1);
  assert.deepEqual(e.snapshot(),before);
  const M=require('../src/ai-marginal.js'),copy=M.clone(e);copy.state.lingering.push({n:99,scope:'player',owner:0,key:'wabokuTurn',value:e.state.turn,sourceId:'waboku'});
  const options={ownTriggers:true,allowShuffle:true,unknownDraws:true,redactOpponent:true};
  assert.deepEqual(M.project(e,{type:'end'},0,undefined,options).engine.state.turn,M.project(copy,{type:'end'},0,undefined,options).engine.state.turn);
});

test('the PVP projection ships a public list of active effects with hidden identities preserved',async()=>{
  const {project}=await import('../server/projection.mjs');
  const e=fresh(1),veiler=put(e,0,'hand','Effect Veiler'),target=put(e,1,'monsters','Sangan');put(e,1,'monsters','Blue-Eyes White Dragon');
  e.state.frame={kind:'main-open',owner:1,windowOffered:false};e.pump();
  act(e,{type:'respond',uid:veiler.uid,key:veiler.id+'::era-negate',choices:{target:[target.uid]}});settle(e);
  const odp=put(e,1,'hand','One Day of Peace');for(const owner of [0,1])for(let i=0;i<3;i++)put(e,owner,'deck','Battle Ox');run(e,cast(odp));
  const room={engine:e,secret:'test-secret',revision:3,seats:[{name:'甲'},{name:'乙'}],events:[]};
  for(const viewer of [0,1]){
    const view=project(room,viewer).data;
    assert.ok(Array.isArray(view.state.activeEffects));assert.equal(view.state.activeEffects.length,3);
    const card=view.state.activeEffects.find(x=>x.scope==='card');assert.ok(card);assert.equal(card.cardId,'sangan','a face-up monster is public');assert.ok(card.uid.startsWith('h_'));
    assert.equal(card.owner,viewer===1?0:1);
    const peaceEntries=view.state.activeEffects.filter(x=>x.key==='preventDamageUntil');assert.deepEqual(peaceEntries.map(x=>x.owner).sort(),[0,1]);
    const remote={remote:true,state:view.state};assert.equal(L.collect(remote).length,3);
    assert.equal(L.describe(peaceEntries[0],{language:'en',turn:e.state.turn}).text,'Takes no damage');
  }
});
