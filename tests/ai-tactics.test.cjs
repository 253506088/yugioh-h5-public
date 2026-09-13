const test=require('node:test'),assert=require('node:assert/strict');
const {DuelEngine}=require('../src/advanced-engine.js');
const T=require('../src/ai-tactics.js'),{D,put,act,settle,run}=require('./yearly-sweep-helpers.cjs');
function fresh(owner=0){
  const e=new DuelEngine({deck:'blue',opponentDeck:'dark',first:owner,seed:91306});
  e.state.turn=4;e.state.phase='main1';e.state.active=owner;
  for(const p of e.state.players){p.deck.push(...p.hand);p.hand=[];}
  return e;
}
function cast(c){return {type:'activate',uid:c.uid,key:c.id+'::cast'};}
function winBoard(owner=0){
  const e=fresh(owner),strong=put(e,owner,'monsters','Blue-Eyes White Dragon'),weak=put(e,1-owner,'monsters','Battle Ox');
  e.state.players[1-owner].lp=500;return {e,strong,weak};
}

for(const owner of [0,1])test('bot '+owner+' takes the winning battle before drawing or extending its board',()=>{
  const {e,strong,weak}=winBoard(owner),spell=put(e,owner,'hand','Pot of Greed');
  const before=e.snapshot(),plan=T.battlePlan(e);
  assert.deepEqual(e.aiNext(),{type:'phase',phase:'battle'});assert.deepEqual(e.snapshot(),before);
  assert.deepEqual(plan.actions,[{type:'phase',phase:'battle'},{type:'attack',uid:strong.uid,target:weak.uid}]);
  run(e,e.aiNext());run(e,e.aiNext());assert.equal(e.state.winner,owner);assert.equal(e.find(spell.uid).zone,'hand');
});

test('the smaller attacker clears a defender so the stronger attacker can finish directly',()=>{
  const e=fresh(),strong=put(e,0,'monsters','Blue-Eyes White Dragon'),small=put(e,0,'monsters','Battle Ox'),target=put(e,1,'monsters','Kuriboh',{position:'defense'});
  e.state.players[1].lp=3000;
  const plan=T.battlePlan(e);assert.ok(plan);
  assert.deepEqual(plan.actions.slice(1),[{type:'attack',uid:small.uid,target:target.uid},{type:'attack',uid:strong.uid}]);
  for(let i=0;e.state.winner===null&&i<8;i++)run(e,e.aiNext());assert.equal(e.state.winner,0);
});

test('a legal change to Attack Position is used to finish the duel',()=>{
  const e=fresh(),m=put(e,0,'monsters','Blue-Eyes White Dragon',{position:'defense'});e.state.players[1].lp=2500;
  assert.deepEqual(e.aiNext(),{type:'stance',uid:m.uid});run(e,e.aiNext());run(e,e.aiNext());run(e,e.aiNext());assert.equal(e.state.winner,0);
});

for(const lock of ['first-turn','waboku','battle-lock','new-defense','facedown'])test('no claimed winning battle through '+lock,()=>{
  const {e,strong,weak}=winBoard();
  if(lock==='first-turn')e.state.turn=1;
  if(lock==='waboku')e.state.players[1].wabokuTurn=e.state.turn;
  if(lock==='battle-lock')e.state.players[0].cannotAttackTurn=e.state.turn;
  if(lock==='new-defense'){strong.position='defense';strong.summonTurn=e.state.turn;}
  if(lock==='facedown')weak.faceUp=false;
  assert.equal(T.battlePlan(e),null);
});

test('unknown opposing hand and deck order cannot change the public winning line',()=>{
  const {e}=winBoard();put(e,1,'hand','Battle Fader');put(e,1,'hand','Kuriboh');
  const before=e.snapshot(),plan=T.battlePlan(e),copy=DuelEngine.restore(before);
  for(const m of copy.state.players[1].hand)m.id='blue-eyes';copy.state.players[1].deck.reverse();copy.state.players[0].deck.reverse();
  assert.deepEqual(T.battlePlan(copy),plan);assert.deepEqual(e.snapshot(),before);
});

test('an actual hidden response still resolves even after the bot chose a public winning line',()=>{
  const e=fresh(),strong=put(e,0,'monsters','Blue-Eyes White Dragon');put(e,1,'hand','Battle Fader');e.state.players[1].lp=1000;
  assert.ok(T.battlePlan(e));run(e,e.aiNext());act(e,{type:'attack',uid:strong.uid});
  for(let i=0;e.state.pending&&i<20;i++)act(e,e.aiNext());
  assert.equal(e.state.winner,null);assert.ok(e.monsters(1).some(m=>m.id==='battle-fader'));assert.equal(e.state.players[1].lp,1000);
});

for(const name of ['Dark Hole','Metamorphosis','Card of Sanctity'])test('preserves a strong board instead of a wasteful '+name,()=>{
  const e=fresh();e.state.phase='main2';const strong=put(e,0,'monsters','Blue-Eyes White Dragon'),s=put(e,0,'hand',name);
  if(name==='Dark Hole')put(e,1,'monsters','Kuriboh');
  if(name==='Card of Sanctity')put(e,0,'hand','Battle Ox');
  e.state.normalUsed=true;
  const before=e.snapshot(),decision=T.evaluate(e,cast(s));assert.equal(decision.useful,false,JSON.stringify(decision));assert.deepEqual(e.snapshot(),before);
  assert.notEqual(e.aiNext()?.uid,s.uid);assert.equal(e.find(strong.uid).zone,'monsters');
  run(e,cast(s));assert.notEqual(e.find(strong.uid).zone,'monsters','the restraint is an AI policy, not a rule restriction');
});

test('a costly board replacement remains available when it improves the position',()=>{
  const e=fresh();e.state.phase='main2';put(e,0,'monsters','Dark Magician');
  put(e,0,'deck','Dark Magician of Chaos');const s=put(e,0,'hand','Dedication through Light and Darkness');
  const result=T.evaluate(e,cast(s));assert.equal(result.useful,true,JSON.stringify(result));run(e,cast(s));
  assert.ok(e.monsters(0).some(m=>m.id===D.cardByName('Dark Magician of Chaos').id));
});

test('removal and direct effect damage are retained when they win or recover a losing board',()=>{
  const e=fresh();put(e,1,'monsters','Blue-Eyes White Dragon');const hole=put(e,0,'hand','Dark Hole');
  assert.equal(T.evaluate(e,cast(hole)).useful,true);run(e,e.aiNext());assert.equal(e.monsters(1).length,0);
  put(e,0,'monsters','Blue-Eyes White Dragon');e.state.players[1].lp=100;const sparks=put(e,0,'hand','Sparks');
  const result=T.evaluate(e,cast(sparks));assert.equal(result.useful,true);assert.equal(result.reason,'winning-effect');
});

for(const owner of [0,1])test('bot '+owner+' sets a lower-DEF monster when Attack Position would be lethal',()=>{
  const e=fresh(owner),m=put(e,owner,'hand','Battle Ox');put(e,1-owner,'monsters','Blue-Eyes White Dragon');e.state.players[owner].lp=1200;
  const before=e.snapshot(),action=e.aiNext();assert.equal(action.type,'summon');assert.equal(action.uid,m.uid);assert.equal(action.mode,'defense');assert.deepEqual(e.snapshot(),before);
  run(e,action);assert.equal(e.find(m.uid).card.faceUp,false);assert.equal(e.find(m.uid).card.position,'defense');
});

test('a Flip monster is set instead of losing its future Flip effect',()=>{
  const e=fresh(),m=put(e,0,'hand','Man-Eater Bug');const action=e.aiNext();assert.equal(action.uid,m.uid);assert.equal(action.mode,'defense');
});

test('a useful summon trigger and a summon that wins immediately keep Attack Position',()=>{
  const e=fresh(),stratos=put(e,0,'hand','Elemental HERO Stratos');put(e,0,'deck','Elemental HERO Neos');
  const action=e.aiNext();assert.equal(action.uid,stratos.uid);assert.equal(action.mode,'attack');
  const lethal=fresh(),m=put(lethal,0,'hand','Battle Ox');lethal.state.players[1].lp=1000;
  assert.equal(lethal.aiNext().mode,'attack');run(lethal,lethal.aiNext());assert.deepEqual(lethal.aiNext(),{type:'phase',phase:'battle'});
});

test('a surviving old monster can switch to Defense under a stronger enemy',()=>{
  const e=fresh(),m=put(e,0,'monsters','Battle Ox');put(e,1,'monsters','Blue-Eyes White Dragon');e.state.players[0].lp=1200;
  assert.equal(e.aiNext().type,'stance');assert.equal(e.aiNext().uid,m.uid);
  run(e,e.aiNext());assert.equal(e.find(m.uid).card.position,'defense');
});

test('saved games make the same choice without consuming the live random sequence',()=>{
  const e=fresh();put(e,0,'monsters','Dark Magician');const wand=put(e,0,'spells','Wonder Wand',{equipTarget:e.monsters(0)[0].uid});e.state.phase='main2';
  const before=e.snapshot(),action=e.aiNext(),restored=DuelEngine.restore(before);
  assert.equal(T.evaluate(e,{type:'activate',uid:wand.uid,key:wand.id+'::draw'}).useful,false);
  assert.deepEqual(restored.aiNext(),action);assert.deepEqual(e.snapshot(),before);assert.equal(e.random(),restored.random());
});
