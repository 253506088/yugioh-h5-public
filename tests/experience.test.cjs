const test=require('node:test'),assert=require('node:assert/strict');
const {DuelEngine}=require('../src/advanced-engine.js');
const X=require('../src/experience.js');
const {CARDS,cardByName}=globalThis.DuelData;
function fresh(){const e=new DuelEngine({deck:'blue',opponentDeck:'dark',first:0,seed:371});e.state.turn=4;for(const p of e.state.players){p.deck.push(...p.hand);p.hand=[];}return e;}
function put(e,owner,zone,name,props={}){
  const id=CARDS[name]?name:cardByName(name)?.id;assert.ok(id,name);
  const f=e.refs(owner,['deck','extra']).find(f=>f.card.id===id),c=f?e.remove(f.card.uid).card:e.makeCard(id,owner);
  Object.assign(c,{faceUp:true,setTurn:1,summonTurn:1,changedTurn:1},props);
  if(['monsters','spells'].includes(zone))e.state.players[owner][zone][e.state.players[owner][zone].indexOf(null)]=c;else e.state.players[owner][zone].push(c);
  e.state.originalCardCount=e.physicalCards().filter(c=>CARDS[c.id].type!=='token').length;return c;
}
function act(e,action,events=[]){const result=e.act(action);assert.equal(result.ok,true,JSON.stringify(action)+' '+result.error);events.push(...result.events);return result;}
function settle(e,events=[]){let count=0;while(e.state.pending&&count++<60){const p=e.state.pending;act(e,p.kind==='window'||p.kind==='trigger'&&!p.trigger.mandatory?{type:'pass'}:e.chooseAI(p),events);}assert.ok(count<60);e.assertState();}

test('both players receive stable chain numbers and resolve 3 → 2 → 1',()=>{
  const e=fresh(),events=[],pot=put(e,0,'hand','pot-of-greed'),jammer=put(e,1,'spells','Magic Jammer',{faceUp:false}),cost=put(e,1,'hand','battle-ox'),tools=put(e,0,'spells','Seven Tools of the Bandit',{faceUp:false});
  const deckSize=e.state.players[0].deck.length;
  act(e,{type:'activate',uid:pot.uid,key:pot.id+'::cast'},events);
  act(e,{type:'respond',uid:jammer.uid,key:jammer.id+'::cast',choices:{cost:[cost.uid]}},events);
  act(e,{type:'respond',uid:tools.uid,key:tools.id+'::cast'},events);settle(e,events);
  assert.deepEqual(events.filter(e=>e.kind==='chain-add').map(e=>[e.number,e.owner]),[[1,0],[2,1],[3,0]]);
  assert.deepEqual(events.filter(e=>e.kind==='chain-resolve').map(e=>e.number),[3,2,1]);
  assert.deepEqual(e.state.chainHistory.map(l=>l.status),['resolved','negated','resolved']);
  const negation=events.find(e=>e.kind==='chain-negated');assert.equal(negation.number,2);assert.equal(negation.byNumber,3);
  assert.equal(e.state.players[0].deck.length,deckSize-2);assert.equal(e.state.players[0].lp,7000);
  assert.deepEqual(DuelEngine.restore(e.snapshot()).snapshot(),e.snapshot());
});
test('a higher chain removing a revival target reports target loss without calling it negation',()=>{
  const e=fresh(),events=[],reborn=put(e,0,'hand','monster-reborn'),dragon=put(e,0,'grave','blue-eyes'),disappear=put(e,1,'spells','Disappear',{faceUp:false});
  act(e,{type:'activate',uid:reborn.uid,key:reborn.id+'::cast',choices:{target:[dragon.uid]}},events);
  act(e,{type:'respond',uid:disappear.uid,key:disappear.id+'::cast',choices:{target:[dragon.uid]}},events);settle(e,events);
  assert.equal(e.find(dragon.uid).zone,'banished');
  const warning=events.find(e=>e.kind==='chain-target-lost');assert.ok(warning);assert.equal(warning.number,1);assert.equal(warning.targets[0].byNumber,2);assert.equal(warning.targets[0].cardId,'blue-eyes');
  assert.equal(e.state.chainHistory.find(l=>l.number===1).status,'target-lost');assert.ok(!events.some(e=>e.kind==='chain-negated'));
});
test('destroying a normal spell source does not produce a false negation or target-loss warning',()=>{
  const e=fresh(),events=[],pot=put(e,0,'hand','pot-of-greed'),mst=put(e,1,'spells','mst',{faceUp:false}),before=e.state.players[0].deck.length;
  act(e,{type:'activate',uid:pot.uid,key:pot.id+'::cast'},events);act(e,{type:'respond',uid:mst.uid,key:mst.id+'::cast',choices:{target:[pot.uid]}},events);settle(e,events);
  assert.equal(e.state.players[0].deck.length,before-2);assert.ok(e.state.chainHistory.every(l=>l.status==='resolved'));
  assert.ok(!events.some(e=>['chain-negated','chain-target-lost'].includes(e.kind)));
});
test('restoring a chain mid-response preserves its number, targets and later attribution',()=>{
  const e=fresh(),reborn=put(e,0,'hand','monster-reborn'),dragon=put(e,0,'grave','blue-eyes'),trap=put(e,1,'spells','Disappear',{faceUp:false});
  act(e,{type:'activate',uid:reborn.uid,key:reborn.id+'::cast',choices:{target:[dragon.uid]}});
  const restored=DuelEngine.restore(e.snapshot());assert.deepEqual(restored.state.chain,e.state.chain);
  act(restored,{type:'respond',uid:trap.uid,key:trap.id+'::cast',choices:{target:[dragon.uid]}});settle(restored);
  assert.equal(restored.state.chainHistory[0].lostTargets[0].byNumber,2);
});

test('a continuous trap removed by Chain 2 is not applied, rather than falsely negated',()=>{
  const e=fresh(),events=[],call=put(e,0,'spells','Call of the Haunted',{faceUp:false}),dragon=put(e,0,'grave','blue-eyes'),mst=put(e,1,'spells','mst',{faceUp:false});
  act(e,{type:'activate',uid:call.uid,key:call.id+'::cast',choices:{target:[dragon.uid]}},events);
  act(e,{type:'respond',uid:mst.uid,key:mst.id+'::cast',choices:{target:[call.uid]}},events);settle(e,events);
  assert.equal(e.find(dragon.uid).zone,'grave');
  assert.equal(e.state.chainHistory[0].status,'unavailable');assert.equal(e.state.chainHistory[0].byNumber,2);
  assert.ok(events.some(event=>event.kind==='chain-unavailable'&&event.number===1));
  assert.ok(!events.some(event=>event.kind==='chain-negated'));
});

test('a newly resolved continuous negation is attributed to its higher chain number',()=>{
  const e=fresh(),events=[],pot=put(e,0,'hand','pot-of-greed'),order=put(e,1,'spells','Imperial Order',{faceUp:false}),before=e.state.players[0].deck.length;
  act(e,{type:'activate',uid:pot.uid,key:pot.id+'::cast'},events);
  act(e,{type:'respond',uid:order.uid,key:order.id+'::cast'},events);settle(e,events);
  assert.equal(e.state.players[0].deck.length,before);
  const warning=events.find(event=>event.kind==='chain-negated');
  assert.equal(warning.number,1);assert.equal(warning.byNumber,2);
});

test('pre-existing continuous negation is not attributed to an unrelated higher chain',()=>{
  const e=fresh(),events=[];put(e,1,'spells','Imperial Order');
  const pot=put(e,0,'hand','pot-of-greed'),trap=put(e,1,'spells','Raigeki Break',{faceUp:false}),cost=put(e,1,'hand','battle-ox'),dragon=put(e,0,'monsters','blue-eyes');
  act(e,{type:'activate',uid:pot.uid,key:pot.id+'::cast'},events);
  act(e,{type:'respond',uid:trap.uid,key:trap.id+'::cast',choices:{cost:[cost.uid],target:[dragon.uid]}},events);settle(e,events);
  assert.equal(e.find(dragon.uid).zone,'grave');
  assert.equal(e.state.chainHistory[0].status,'negated');assert.equal(e.state.chainHistory[0].byNumber,null);
});

test('target removal paid as a higher link cost retains the responsible chain number',()=>{
  const e=fresh(),events=[],mst=put(e,0,'hand','mst'),call=put(e,1,'spells','Call of the Haunted'),provisions=put(e,1,'spells','Emergency Provisions',{faceUp:false});
  act(e,{type:'activate',uid:mst.uid,key:mst.id+'::cast',choices:{target:[call.uid]}},events);
  act(e,{type:'respond',uid:provisions.uid,key:provisions.id+'::cast',choices:{cost:[call.uid]}},events);settle(e,events);
  assert.equal(e.state.chainHistory[0].status,'target-lost');
  assert.equal(e.state.chainHistory[0].lostTargets[0].byNumber,2);
});

test('previewing passive negation never destroys an activated card before it resolves',()=>{
  const e=fresh(),events=[],equip=put(e,0,'hand','Axe of Despair'),freed=put(e,1,'monsters','Freed the Matchless General');
  put(e,1,'spells','mst',{faceUp:false});
  act(e,{type:'activate',uid:equip.uid,key:equip.id+'::cast',choices:{target:[freed.uid]}},events);
  assert.equal(e.find(equip.uid).zone,'spells');assert.ok(e.state.pending);
  settle(e,events);assert.equal(e.find(equip.uid).zone,'grave');
  assert.equal(e.state.chainHistory[0].status,'negated');
});
test('auto response skips generic set windows but retains opponent effects, summons and attacks',()=>{
  const pending=context=>({kind:'window',responder:0,context,options:[{uid:'trap'}]});
  for(const kind of ['main-open','set','standby'])assert.equal(X.responseDecision(pending({kind,owner:1}),'auto'),'pass');
  for(const context of [{chainLast:{owner:1}},{kind:'summon',owner:1},{kind:'summon-attempt',owner:1},{attack:{owner:1,stage:'declare'}},{attack:{owner:0,stage:'calc'}}])assert.equal(X.responseDecision(pending(context),'auto'),'ask');
  assert.equal(X.responseDecision(pending({chainLast:{owner:0}}),'auto'),'pass');
  assert.equal(X.responseDecision(pending({kind:'main-open'}),'on'),'ask');
  assert.equal(X.responseDecision(pending({attack:{}}),'off'),'pass');
  for(const kind of ['trigger','order','materials','choice','input'])assert.equal(X.responseDecision({kind,responder:0,trigger:{mandatory:true}},'off'),'ask');
});

test('multiple set fast effects share one post-Summon response and one pass declines all of them',()=>{
  const e=fresh();e.state.active=1;
  const moons=[put(e,0,'spells','Book of Moon',{faceUp:false}),put(e,0,'spells','Book of Moon',{faceUp:false})];
  const mst=put(e,0,'spells','mst',{faceUp:false});put(e,0,'monsters','blue-eyes');
  const monster=put(e,1,'hand','battle-ox');
  act(e,{type:'summon',uid:monster.uid,mode:'attack'});
  assert.equal(e.state.pending.context.kind,'summon');
  assert.deepEqual(new Set(e.state.pending.options.map(o=>o.uid)),new Set([...moons,mst].map(c=>c.uid)));
  act(e,{type:'pass'});assert.equal(e.state.pending,null);assert.equal(e.state.frame,null);
  assert.ok(moons.every(c=>!e.find(c.uid).card.faceUp));

  const pot=put(e,1,'hand','pot-of-greed');act(e,{type:'activate',uid:pot.uid,key:pot.id+'::cast'});
  assert.equal(e.state.pending.responder,0);assert.equal(e.state.pending.options.length,3);
  act(e,{type:'pass'});assert.equal(e.state.pending,null);e.assertState();
});

test('Icarus Attack with two set Books of Moon asks once after activation',()=>{
  const e=fresh();e.state.active=1;
  const moons=[put(e,0,'spells','Book of Moon',{faceUp:false,setTurn:1}),put(e,0,'spells','Book of Moon',{faceUp:false,setTurn:1})];
  const targetA=put(e,0,'monsters','battle-ox'),targetB=put(e,0,'monsters','celtic-guardian');
  const bird=put(e,1,'monsters','Blackwing - Shura the Blue Flame');
  const icarus=put(e,1,'spells','Icarus Attack',{faceUp:false,setTurn:1});
  act(e,{type:'activate',uid:icarus.uid,key:icarus.id+'::cast',choices:{cost:[bird.uid],target:[targetA.uid,targetB.uid]}});
  assert.equal(e.state.pending.kind,'window');assert.equal(e.state.pending.responder,0);
  assert.deepEqual(e.state.pending.options.map(o=>o.uid),moons.map(c=>c.uid));
  act(e,{type:'pass'});assert.equal(e.state.pending,null);e.assertState();
  assert.ok(moons.every(c=>e.find(c.uid)?.card.faceUp===false));
  assert.equal(e.find(targetA.uid)?.zone,'grave');assert.equal(e.find(targetB.uid)?.zone,'grave');
});

test('passing two Books of Moon at attack declaration proceeds to damage without a duplicate prompt',()=>{
  const e=fresh();e.state.active=1;e.state.phase='battle';
  put(e,0,'spells','Book of Moon',{faceUp:false});put(e,0,'spells','Book of Moon',{faceUp:false});
  const defender=put(e,0,'monsters','battle-ox'),attacker=put(e,1,'monsters','blue-eyes');
  act(e,{type:'attack',uid:attacker.uid,target:defender.uid});
  assert.equal(e.state.pending.context.attack.stage,'declare');assert.equal(e.state.pending.options.length,2);
  act(e,{type:'pass'});
  assert.equal(e.state.pending,null);assert.equal(e.state.players[0].lp,6700);assert.equal(e.find(defender.uid).zone,'grave');e.assertState();
});

test('Summon negation and responses to it remain available before the successful-Summon window',()=>{
  const e=fresh();e.state.active=1;
  const judgment=put(e,0,'spells','Solemn Judgment',{faceUp:false}),moon=put(e,0,'spells','Book of Moon',{faceUp:false});
  const tools=put(e,1,'spells','Seven Tools of the Bandit',{faceUp:false}),monster=put(e,1,'hand','battle-ox');
  act(e,{type:'summon',uid:monster.uid,mode:'attack'});
  assert.equal(e.state.pending.context.kind,'summon-attempt');assert.deepEqual(e.state.pending.options.map(o=>o.uid),[judgment.uid]);
  act(e,{type:'respond',uid:judgment.uid,key:judgment.id+'::cast'});
  assert.deepEqual(e.state.pending.options.map(o=>o.uid),[tools.uid]);
  act(e,{type:'respond',uid:tools.uid,key:tools.id+'::cast'});
  assert.equal(e.state.pending.context.kind,'summon');assert.deepEqual(e.state.pending.options.map(o=>o.uid),[moon.uid]);
  act(e,{type:'pass'});assert.equal(e.state.pending,null);assert.equal(e.find(monster.uid).zone,'monsters');e.assertState();
});

test('a legal damage-step effect is still offered while Book of Moon is excluded',()=>{
  const e=fresh();e.state.active=1;e.state.phase='battle';
  put(e,0,'spells','Book of Moon',{faceUp:false});const shrink=put(e,0,'spells','Shrink',{faceUp:false});
  const defender=put(e,0,'monsters','battle-ox'),attacker=put(e,1,'monsters','blue-eyes');
  act(e,{type:'attack',uid:attacker.uid,target:defender.uid});act(e,{type:'pass'});
  assert.equal(e.state.pending.context.attack.stage,'calc');assert.deepEqual(e.state.pending.options.map(o=>o.uid),[shrink.uid]);
  act(e,{type:'respond',uid:shrink.uid,key:shrink.id+'::cast',choices:{target:[attacker.uid]}});settle(e);
  assert.equal(e.find(attacker.uid).zone,'grave');assert.equal(e.state.players[0].lp,8000);
});

test('passing a response never suppresses the opportunity to respond to a new chain link',()=>{
  const e=fresh();e.state.active=1;
  const moons=[put(e,0,'spells','Book of Moon',{faceUp:false}),put(e,0,'spells','Book of Moon',{faceUp:false})];
  put(e,0,'monsters','battle-ox');const mst=put(e,1,'spells','mst',{faceUp:false}),pot=put(e,1,'hand','pot-of-greed');
  act(e,{type:'activate',uid:pot.uid,key:pot.id+'::cast'});const first=e.state.pending.context.chainLast.id;
  act(e,{type:'pass'});assert.equal(e.state.pending.responder,1);
  act(e,{type:'respond',uid:mst.uid,key:mst.id+'::cast',choices:{target:[moons[0].uid]}});
  assert.equal(e.state.pending.responder,0);assert.notEqual(e.state.pending.context.chainLast.id,first);assert.equal(e.state.pending.options.length,2);settle(e);
});
test('battle shuffle plays every track once per round and never repeats at round boundaries',()=>{
  const bag=new X.ShuffleBag(['a','b','c','d','e','f'],()=>.37),result=Array.from({length:120},()=>bag.next());
  for(let i=0;i<result.length;i+=6)assert.equal(new Set(result.slice(i,i+6)).size,6);
  for(let i=1;i<result.length;i++)assert.notEqual(result[i],result[i-1]);
  assert.equal(new X.ShuffleBag([]).next(),null);const single=new X.ShuffleBag(['a']);assert.equal(single.next(),'a');assert.equal(single.next(),'a');
});
test('reading size and pagination preferences recover safely from invalid saved values',()=>{
  assert.equal(X.clampFont(300),150);assert.equal(X.clampFont(-3),90);assert.equal(X.clampFont('bad'),110);
  assert.equal(X.pageSize(48),48);assert.equal(X.pageSize(0),24);assert.equal(X.pageSize('96'),96);assert.equal(X.pageSize(1000000),24);
});
