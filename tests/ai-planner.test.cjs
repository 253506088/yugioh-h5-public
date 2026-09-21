const test=require('node:test'),assert=require('node:assert/strict');
const {DuelEngine}=require('../src/advanced-engine.js');
const P=require('../src/ai-planner.js'),T=require('../src/ai-tactics.js'),{D,put,act,settle,run}=require('./yearly-sweep-helpers.cjs');
function fresh(owner=0,phase='main1'){
  const e=new DuelEngine({deck:'blue',opponentDeck:'dark',first:owner,seed:91306});
  e.state.turn=4;e.state.phase=phase;e.state.active=owner;
  for(const p of e.state.players){p.deck.push(...p.hand);p.hand=[];}
  return e;
}
const cast=c=>({type:'activate',uid:c.uid,key:c.id+'::cast'});

test('the position value rewards a stronger board, more cards and lower opposing Life Points',()=>{
  const e=fresh();const base=P.positionValue(e,0);
  put(e,0,'monsters','Blue-Eyes White Dragon');const dragon=P.positionValue(e,0);assert.ok(dragon>base+800,'a 3000 ATK body is worth a lot');
  put(e,0,'hand','Pot of Greed');assert.ok(P.positionValue(e,0)>dragon);
  e.state.players[1].lp=4000;assert.ok(P.positionValue(e,0)>dragon+1000);
  put(e,1,'monsters','Blue-Eyes White Dragon');assert.ok(P.positionValue(e,0)<dragon,'an equal opposing body cancels the advantage');
  assert.equal(P.positionValue(e,0)>0,P.positionValue(e,1)<0||P.positionValue(e,1)<P.positionValue(e,0));
});

test('rollouts execute on a copy and never touch the live duel or its random sequence',()=>{
  const e=fresh(),ox=put(e,0,'hand','Battle Ox');put(e,1,'monsters','Kuriboh');
  const before=e.snapshot(),r=P.value(e,{type:'summon',uid:ox.uid,mode:'attack'},0);
  assert.ok(r&&Number.isFinite(r.value));assert.deepEqual(e.snapshot(),before);
  const restored=DuelEngine.restore(before);assert.deepEqual(restored.aiNext(),e.aiNext());assert.equal(restored.random(),e.random());
});

test('an effect that wins the duel outright is chosen before drawing cards',()=>{
  const e=fresh();e.state.players[1].lp=200;const pot=put(e,0,'hand','Pot of Greed'),sparks=put(e,0,'hand','Sparks');
  for(let i=0;i<4;i++)put(e,0,'deck','Battle Ox');
  assert.ok(e.actionScore(cast(pot))>e.actionScore(cast(sparks)),'the base score prefers the draw');
  const action=e.aiNext();assert.equal(action.uid,sparks.uid,JSON.stringify(action));
  run(e,action);assert.equal(e.state.winner,0);
});

test('battle: an attack that only bounces off a hidden wall is not declared',()=>{
  const e=fresh(0,'battle'),small=put(e,0,'monsters','Kuriboh');put(e,1,'monsters','Battle Ox',{faceUp:false,position:'defense'});
  assert.deepEqual(P.battle(e),{type:'phase',phase:'main2'});
  assert.deepEqual(e.aiNext(),{type:'phase',phase:'main2'});
  assert.equal(e.find(small.uid).zone,'monsters');
});

test('battle: a clear gain is still taken through Set backrow, and a winning line is ordered weakest-first',()=>{
  const e=fresh(0,'battle'),dragon=put(e,0,'monsters','Blue-Eyes White Dragon'),weak=put(e,1,'monsters','Kuriboh');
  for(let i=0;i<3;i++)put(e,1,'spells','Waboku',{faceUp:false});
  const attack=P.battle(e);assert.equal(attack.type,'attack');assert.equal(attack.uid,dragon.uid);assert.equal(attack.target,weak.uid);
  const lethal=fresh(0,'battle');lethal.state.players[1].lp=1500;const ox=put(lethal,0,'monsters','Battle Ox'),bee=put(lethal,0,'monsters','Kuriboh');for(let i=0;i<2;i++)put(lethal,1,'spells','Mirror Force',{faceUp:false});
  const first=lethal.aiNext();assert.equal(first.type,'attack');assert.equal(first.target,undefined,'a direct attack is declared');
  assert.equal(first.uid,bee.uid,'the weaker attacker goes first, so a single-target trap cannot stop the finishing attack');
  run(lethal,first);const second=lethal.aiNext();assert.equal(second.uid,ox.uid);assert.equal(second.target,undefined);run(lethal,second);assert.equal(lethal.state.winner,0);
});

test('battle: the weakest attacker that achieves the kill is used first so the strongest stays free',()=>{
  const e=fresh(0,'battle'),dragon=put(e,0,'monsters','Blue-Eyes White Dragon'),ox=put(e,0,'monsters','Battle Ox'),kuriboh=put(e,1,'monsters','Kuriboh',{position:'defense'});
  e.state.players[1].lp=3000;
  const first=e.aiNext();assert.equal(first.type,'attack');assert.equal(first.uid,ox.uid);assert.equal(first.target,kuriboh.uid);
  run(e,first);const second=e.aiNext();assert.equal(second.uid,dragon.uid);assert.equal(second.target,undefined);run(e,second);assert.equal(e.state.winner,0);
});

test('battle: a bare one-for-one trade into an equal monster is refused',()=>{
  const e=fresh(0,'battle'),mine=put(e,0,'monsters','Battle Ox');put(e,1,'monsters','Battle Ox');
  const action=P.battle(e);assert.deepEqual(action,{type:'phase',phase:'main2'});assert.equal(e.find(mine.uid).zone,'monsters');
});

test('response gate: a default-scored trap is saved for a window where it changes the outcome',()=>{
  const idle=fresh(1),stun=put(idle,0,'spells','Trap Stun',{faceUp:false});
  idle.state.frame={kind:'main-open',owner:1,windowOffered:false};idle.pump();
  assert.equal(idle.state.pending?.kind,'window');assert.equal(idle.state.pending.responder,0);
  assert.ok(idle.state.pending.options.some(o=>o.uid===stun.uid),'Trap Stun is legal at the opposing open window');
  assert.deepEqual(idle.chooseAI(idle.state.pending),{type:'pass'});
  const live=fresh(0,'battle'),stun2=put(live,0,'spells','Trap Stun',{faceUp:false}),dragon=put(live,0,'monsters','Blue-Eyes White Dragon'),mirror=put(live,1,'spells','Mirror Force',{faceUp:false});
  act(live,{type:'attack',uid:dragon.uid});act(live,{type:'respond',uid:mirror.uid,key:mirror.id+'::cast'});
  assert.equal(live.state.pending?.kind,'window');assert.equal(live.state.pending.responder,0);
  const chosen=live.chooseAI(live.state.pending);assert.equal(chosen.type,'respond');assert.equal(chosen.uid,stun2.uid);
  act(live,chosen);settle(live);assert.equal(live.find(dragon.uid).zone,'monsters','Mirror Force was negated');
});

test('response gate: authored timing is kept and paid negations keep the tactical verdict',()=>{
  const e=fresh(0,'battle'),dragon=put(e,0,'monsters','Blue-Eyes White Dragon'),armor=put(e,1,'spells','Sakuretsu Armor',{faceUp:false});
  act(e,{type:'attack',uid:dragon.uid});
  assert.equal(e.state.pending?.responder,1);const chosen=e.chooseAI(e.state.pending);assert.equal(chosen.uid,armor.uid);
  const storm=fresh(),solemn=put(storm,1,'spells','Solemn Judgment',{faceUp:false}),heavy=put(storm,0,'hand','Heavy Storm');
  act(storm,cast(heavy));assert.deepEqual(storm.chooseAI(storm.state.pending),{type:'pass'});
  assert.equal(T.negationWorth(storm,{type:'respond',uid:solemn.uid,key:solemn.id+'::cast'},1).worthwhile,false);
});

test('Wave-Motion Cannon is an Ignition effect and is never offered as a chain response',()=>{
  const e=fresh(1),cannon=put(e,0,'spells','Wave-Motion Cannon',{faceUp:true,waveCounters:3});
  e.state.frame={kind:'main-open',owner:1,windowOffered:false};e.pump();
  assert.ok(!e.state.pending||!e.state.pending.options?.some(o=>o.uid===cannon.uid));
  e.state.pending=null;e.state.frame=null;e.state.active=0;
  assert.ok(e.allActions(0).some(a=>a.uid===cannon.uid&&a.type==='activate'),'it stays usable in the controller\'s own Main Phase');
});

test('casual difficulty keeps the older greedy policy; standard uses the planner',()=>{
  const casual=new DuelEngine({deck:'blue',opponentDeck:'dark',first:0,seed:5,difficulty:'casual'});
  assert.equal(P.enabled(casual),false);assert.equal(P.battle(casual),null);
  const standard=new DuelEngine({deck:'blue',opponentDeck:'dark',first:0,seed:5});
  assert.equal(P.enabled(standard),true);
});

test('planner bots finish complete duels across mixed eras without illegal actions',()=>{
  for(const [deck,opp,seed] of [['hero','blackwing-2010',21],['dragon-ruler-2013','gladiator-2008',22],['junk-doppel-2011','wind-up-2012',23]]){
    const e=new DuelEngine({deck,opponentDeck:opp,first:seed%2,seed});let steps=0;
    while(e.state.winner===null&&steps++<1600){const a=e.aiNext();assert.ok(a,'no action');const r=e.act(a);assert.ok(r.ok,JSON.stringify(a)+' '+r.error);e.assertState();}
    assert.notEqual(e.state.winner,null,deck+' vs '+opp+' did not finish');
  }
});
