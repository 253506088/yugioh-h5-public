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
