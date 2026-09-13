const test=require('node:test'),assert=require('node:assert/strict');
const {DuelEngine}=require('../src/advanced-engine.js');
const AI=require('../src/ai-marginal.js'),D=global.DuelData;
function fresh(){const e=new DuelEngine({deck:'blue',opponentDeck:'dark',first:0,seed:8901});e.state.turn=4;e.state.phase='battle';for(const p of e.state.players){p.deck.push(...p.hand);p.hand=[];}return e;}
function put(e,owner,zone,name,props={}){
  const id=D.CARDS[name]?name:D.cardByName(name)?.id;assert.ok(id,name);
  const c=e.makeCard(id,owner);Object.assign(c,{faceUp:true,setTurn:1,summonTurn:1,changedTurn:1},props);
  if(['monsters','spells'].includes(zone))e.state.players[owner][zone][e.state.players[owner][zone].indexOf(null)]=c;else e.state.players[owner][zone].push(c);
  e.state.originalCardCount=e.physicalCards().filter(c=>D.CARDS[c.id].type!=='token').length;return c;
}
function act(e,a){const r=e.act(a);assert.equal(r.ok,true,JSON.stringify(a)+' '+r.error);return r;}
function settle(e){let n=0;while(e.state.pending&&n++<160){const p=e.state.pending;act(e,p.kind==='window'||p.kind==='trigger'&&!p.trigger.mandatory?{type:'pass'}:e.chooseAI(p));}assert.ok(n<160);}
function attackCase(name,owner=1,target=false){
  const e=fresh(),attacker=put(e,0,'monsters','blue-eyes'),defender=target?put(e,1,'monsters','battle-ox',{faceUp:name!=='A Feint Plan',position:'defense'}):null;
  if(name==='Just Desserts')put(e,0,'monsters','alexandrite');
  const cards=Array.from({length:3},()=>put(e,owner,'spells',name,{faceUp:false}));
  act(e,{type:'attack',uid:attacker.uid,...(defender?{target:defender.uid}:{})});
  assert.equal(e.state.pending?.responder,owner,name);
  act(e,{type:'respond',uid:cards[0].uid,key:cards[0].id+'::cast'});
  return {e,cards,attacker,defender,owner};
}

test('same unresolved battle protection does not consume the other two copies',()=>{
  const {e,cards}=attackCase('waboku');
  const before=JSON.stringify(e.snapshot()),probe=AI.evaluate(e,{type:'respond',uid:cards[1].uid,key:'waboku::cast'},1);
  assert.equal(probe.useful,false,JSON.stringify(probe));
  assert.equal(JSON.stringify(e.snapshot()),before);
  assert.deepEqual(e.aiNext(),{type:'pass'});act(e,e.aiNext());settle(e);
  assert.equal(e.state.players[1].wabokuTurn,4);
  assert.equal(e.state.players[1].spells.filter(c=>c?.id==='waboku'&&!c.faceUp).length,2);
  assert.equal(e.state.players[1].lp,8000);
});
for(const [name,owner,target] of [['A Feint Plan',1,true],['Meteorain',0,true],['negate-attack',1,false]])test('generic engine projection avoids a second '+name,()=>{
  const {e,cards}=attackCase(name,owner,target),action={type:'respond',uid:cards[1].uid,key:cards[1].id+'::cast'};
  const result=AI.evaluate(e,action,owner);assert.equal(result.useful,false,JSON.stringify(result));
  assert.equal(e.fx.aiResponse(e,action,e.state.pending.context,owner)<=0,true);
});
for(const name of ['Jar of Greed','Just Desserts'])test('additional '+name+' retains its draw or damage benefit',()=>{
  const {e,cards}=attackCase(name),action={type:'respond',uid:cards[1].uid,key:cards[1].id+'::cast'};
  const result=AI.evaluate(e,action,1);assert.equal(result.useful,true,JSON.stringify(result));
  assert.ok(e.fx.aiResponse(e,action,e.state.pending.context,1)>0);
});
test('numerical attack buffs stack and remain available on the same target',()=>{
  const {e,cards,attacker}=attackCase('Reinforcements',0,true);
  while(e.state.pending?.kind==='input')act(e,{type:'choose',uids:[attacker.uid]});
  const result=AI.evaluate(e,{type:'respond',uid:cards[1].uid,key:cards[1].id+'::cast'},0);
  assert.equal(result.useful,true,JSON.stringify(result));
});
test('destroying a normal trap source does not imply its effect was negated',()=>{
  const e=fresh(),attacker=put(e,0,'monsters','blue-eyes'),mst=put(e,0,'spells','mst',{faceUp:false});
  const cards=[put(e,1,'spells','waboku',{faceUp:false}),put(e,1,'spells','waboku',{faceUp:false})];
  act(e,{type:'attack',uid:attacker.uid});act(e,{type:'respond',uid:cards[0].uid,key:'waboku::cast'});
  act(e,{type:'respond',uid:mst.uid,key:'mst::cast',choices:{target:[cards[0].uid]}});
  const result=AI.evaluate(e,{type:'respond',uid:cards[1].uid,key:'waboku::cast'},1);
  assert.equal(result.useful,false,JSON.stringify(result));
});
test('a negated first copy allows protection again at the next legal opportunity',()=>{
  const e=fresh(),attacker=put(e,0,'monsters','blue-eyes'),second=put(e,0,'monsters','alexandrite');
  const judgment=put(e,0,'spells','Solemn Judgment',{faceUp:false}),cards=Array.from({length:3},()=>put(e,1,'spells','waboku',{faceUp:false}));
  act(e,{type:'attack',uid:attacker.uid});act(e,{type:'respond',uid:cards[0].uid,key:'waboku::cast'});
  act(e,{type:'respond',uid:judgment.uid,key:judgment.id+'::cast'});
  assert.ok(!e.state.pending?.options?.some(x=>x.key==='waboku::cast'),'normal trap cannot chain directly to a counter trap');
  settle(e);assert.notEqual(e.state.players[1].wabokuTurn,4);
  act(e,{type:'attack',uid:second.uid});const action=e.aiNext();assert.equal(action.type,'respond');assert.equal(action.uid,cards[1].uid);
  act(e,action);settle(e);assert.equal(e.state.players[1].wabokuTurn,4);assert.equal(e.find(cards[2].uid).card.faceUp,false);
});
test('an already active per-turn flag is avoided in the main phase too',()=>{
  const e=fresh(),target=put(e,0,'monsters','battle-ox'),equip=put(e,0,'spells','Black Pendant',{equipTarget:target.uid});
  const cards=[put(e,0,'spells','Armored Glass',{faceUp:false}),put(e,0,'spells','Armored Glass',{faceUp:false})];
  e.state.phase='main1';act(e,{type:'activate',uid:cards[0].uid,key:cards[0].id+'::cast'});settle(e);
  const action={type:'activate',uid:cards[1].uid,key:cards[1].id+'::cast'};
  assert.ok(e.actionScore(action)<0,JSON.stringify(AI.evaluate(e,action,0)));
  e.state.turn++;assert.ok(e.actionScore(action)>0,'new turn needs a fresh effect');assert.ok(e.find(equip.uid));
});
test('a second all-monster effect is useful after another monster arrives',()=>{
  const e=fresh(),first=put(e,0,'monsters','battle-ox'),cards=[put(e,0,'spells','Meteorain',{faceUp:false}),put(e,0,'spells','Meteorain',{faceUp:false})];
  act(e,{type:'activate',uid:cards[0].uid,key:cards[0].id+'::cast'});settle(e);assert.equal(first.piercingUntil,4);
  const action={type:'activate',uid:cards[1].uid,key:cards[1].id+'::cast'};
  assert.ok(e.actionScore(action)<0,JSON.stringify(AI.evaluate(e,action,0)));
  put(e,0,'monsters','blue-eyes');assert.ok(e.actionScore(action)>0);
});
test('two revival cards can select different targets instead of wasting one',()=>{
  const e=fresh();e.state.phase='main1';const blue=put(e,0,'grave','blue-eyes'),dark=put(e,0,'grave','dark-magician');
  const cards=[put(e,0,'spells','Call of the Haunted',{faceUp:false}),put(e,0,'spells','Call of the Haunted',{faceUp:false})];
  act(e,{type:'activate',uid:cards[0].uid,key:cards[0].id+'::cast',choices:{target:[blue.uid]}});
  const action={type:'respond',uid:cards[1].uid,key:cards[1].id+'::cast'},result=AI.evaluate(e,action,0);
  assert.equal(result.useful,true,JSON.stringify(result));
  assert.deepEqual(result.choices?.target,[dark.uid],JSON.stringify(result));
});
test('random effects remain conservative and do not consume the live RNG',()=>{
  const {e,cards}=attackCase('Skull Dice'),before=JSON.stringify(e.snapshot());
  const result=AI.evaluate(e,{type:'respond',uid:cards[1].uid,key:cards[1].id+'::cast'},1);
  assert.equal(result.useful,true);assert.equal(result.reason,'uncertain-random');assert.equal(JSON.stringify(e.snapshot()),before);
});
test('several copies cannot accumulate the same next Draw Phase skip',()=>{
  const {e,cards}=attackCase('Time Seal'),action={type:'respond',uid:cards[1].uid,key:cards[1].id+'::cast'};
  assert.equal(AI.evaluate(e,action,1).useful,false);
  // The legal human action still works; its phase restriction does not stack.
  act(e,action);settle(e);assert.equal(e.state.players[0].skipDraws,1);
  assert.equal(e.find(cards[2].uid).card.faceUp,false);
});
test('simultaneous optional copies are filtered before chain construction',()=>{
  const e=fresh();e.state.phase='main1';const cards=Array.from({length:3},()=>put(e,1,'spells','Thunder of Ruler',{faceUp:false}));
  e.state.frame={kind:'standby',owner:0,stage:1};e.emit({type:'standby',owner:0});e.pump();
  assert.equal(e.state.pending.kind,'order');assert.equal(e.state.pending.candidates.length,3);
  const action=e.aiNext();assert.equal(action.uids.length,1,JSON.stringify(action));
  const snap=JSON.stringify(e.snapshot());e.aiNext();assert.equal(JSON.stringify(e.snapshot()),snap);
  act(e,action);settle(e);assert.equal(e.state.players[0].skipBattleTurn,4);
  assert.equal(cards.filter(m=>e.find(m.uid)?.card.faceUp===false).length,2);
  // Declining this turn's battle does not postpone Thunder of Ruler to a later turn.
  e.state.turn=6;e.state.phase='main1';act(e,{type:'phase',phase:'battle'});assert.equal(e.state.phase,'battle');
});
test('mandatory simultaneous effects are never dropped by the optimizer',()=>{
  const e=fresh(),bugs=[put(e,0,'monsters','Man-Eater Bug'),put(e,0,'monsters','Man-Eater Bug')];
  for(const card of bugs)e.emit({type:'flip',owner:0,uid:card.uid,id:card.id,previous:{wasNegated:false}});
  e.pump();assert.equal(e.state.pending.kind,'order');assert.equal(e.state.pending.min,2);
  assert.equal(e.aiNext().uids.length,2);
});
test('a live spell-speed-2 negation restores the marginal value of another copy',()=>{
  const e=fresh(),attacker=put(e,0,'monsters','blue-eyes'),infinity=put(e,0,'monsters','cyber-infinity');
  infinity.overlays=[e.makeCard('cyber-dragon',0)];e.state.originalCardCount=e.physicalCards().filter(c=>D.CARDS[c.id].type!=='token').length;
  const cards=[put(e,1,'spells','waboku',{faceUp:false}),put(e,1,'spells','waboku',{faceUp:false})];
  act(e,{type:'attack',uid:attacker.uid});act(e,{type:'respond',uid:cards[0].uid,key:'waboku::cast'});
  act(e,{type:'respond',uid:infinity.uid,key:'cyber-infinity::negate',choices:{cost:[infinity.overlays[0].uid]}});
  const decision=e.aiNext();assert.equal(decision.type,'respond');assert.equal(decision.uid,cards[1].uid);
  act(e,decision);settle(e);assert.equal(e.state.players[1].wabokuTurn,4);assert.equal(e.state.players[1].lp,8000);
});
test('two revivals with one target are redundant, while different targets are actually revived',()=>{
  const e=fresh(),blue=put(e,1,'grave','blue-eyes'),dark=put(e,1,'grave','dark-magician'),attacker=put(e,0,'monsters','battle-ox');
  const cards=[put(e,1,'spells','Call of the Haunted',{faceUp:false}),put(e,1,'spells','Call of the Haunted',{faceUp:false})];
  act(e,{type:'attack',uid:attacker.uid});act(e,{type:'respond',uid:cards[0].uid,key:cards[0].id+'::cast',choices:{target:[blue.uid]}});
  const chosen=e.aiNext();assert.equal(chosen.uid,cards[1].uid);assert.deepEqual(chosen.choices.target,[dark.uid]);
  act(e,chosen);settle(e);assert.equal(e.find(blue.uid).zone,'monsters');assert.equal(e.find(dark.uid).zone,'monsters');
  const other=fresh(),one=put(other,0,'grave','blue-eyes'),traps=[put(other,0,'spells','Call of the Haunted',{faceUp:false}),put(other,0,'spells','Call of the Haunted',{faceUp:false})];
  other.state.phase='main1';act(other,{type:'activate',uid:traps[0].uid,key:traps[0].id+'::cast',choices:{target:[one.uid]}});
  assert.equal(AI.evaluate(other,{type:'respond',uid:traps[1].uid,key:traps[1].id+'::cast'},0).useful,false);
});
test('extra spell-resolution counters are a real benefit even if the equipped effect is covered',()=>{
  const e=fresh();e.state.phase='main1';const monster=put(e,0,'monsters','battle-ox'),library=put(e,0,'monsters','royal-library');
  const first=put(e,0,'hand','Fairy Meteor Crush'),second=put(e,0,'hand','Fairy Meteor Crush');
  act(e,{type:'activate',uid:first.uid,key:first.id+'::cast',choices:{target:[monster.uid]}});settle(e);
  assert.equal(library.counters,1);
  const result=AI.evaluate(e,{type:'activate',uid:second.uid,key:second.id+'::cast'},0);
  assert.equal(result.useful,true,JSON.stringify(result));
});
test('AI preference does not forbid a legal manual duplicate activation',()=>{
  const e=fresh();e.state.phase='main1';const m=put(e,0,'monsters','battle-ox');put(e,0,'spells','Black Pendant',{equipTarget:m.uid});
  const cards=[put(e,0,'spells','Armored Glass',{faceUp:false}),put(e,0,'spells','Armored Glass',{faceUp:false})];
  act(e,{type:'activate',uid:cards[0].uid,key:cards[0].id+'::cast'});settle(e);
  const action={type:'activate',uid:cards[1].uid,key:cards[1].id+'::cast'};assert.ok(e.actionScore(action)<0);
  act(e,action);settle(e);assert.equal(e.state.armoredGlassTurn,4);
});
test('a duplicate draw that would deck out is not mistaken for an additional benefit',()=>{
  const {e,cards}=attackCase('Jar of Greed');
  const p=e.state.players[1];p.grave.push(...p.deck.splice(1));
  const result=AI.evaluate(e,{type:'respond',uid:cards[1].uid,key:cards[1].id+'::cast'},1);
  assert.equal(result.useful,false);assert.equal(result.reason,'additional-loss');
});

for(const name of ['Gravity Bind','Imperial Order','Messenger of Peace','Royal Oppression'])test('a second '+name+' does not add a useful persistent effect',()=>{
  const e=fresh();e.state.phase='main1';
  const cards=[put(e,0,'spells',name,{faceUp:false}),put(e,0,'spells',name,{faceUp:false})];
  act(e,{type:'activate',uid:cards[0].uid,key:cards[0].id+'::cast'});settle(e);
  const action={type:'activate',uid:cards[1].uid,key:cards[1].id+'::cast'},result=AI.evaluate(e,action,0);
  assert.equal(result.useful,false,JSON.stringify(result));assert.ok(e.actionScore(action)<0);
});

test('repeated numerical setters are redundant but a longer duration remains useful',()=>{
  const e=fresh();e.state.phase='main1';const target=put(e,0,'monsters','battle-ox');put(e,0,'monsters','blue-eyes');
  const cards=[put(e,0,'hand','Unity'),put(e,0,'hand','Unity')];
  const choices={target:[target.uid]};act(e,{type:'activate',uid:cards[0].uid,key:cards[0].id+'::cast',choices});settle(e);
  const action={type:'activate',uid:cards[1].uid,key:cards[1].id+'::cast',choices};
  assert.equal(AI.evaluate(e,action,0).useful,false);
  e.state.turn++;assert.equal(AI.evaluate(e,action,0).useful,true,'the old modifier has expired');
});

test('duplicate persistent source references do not make Mirror Wall stack',()=>{
  const {e,cards}=attackCase('Mirror Wall');
  const result=AI.evaluate(e,{type:'respond',uid:cards[1].uid,key:cards[1].id+'::cast'},1);
  assert.equal(result.useful,false,JSON.stringify(result));
});

test('identical piercing equipment is saved until a different friendly target exists',()=>{
  const e=fresh();e.state.phase='main1';const target=put(e,0,'monsters','battle-ox');
  put(e,1,'monsters','blue-eyes');
  const cards=[put(e,0,'hand','Fairy Meteor Crush'),put(e,0,'hand','Fairy Meteor Crush')];
  act(e,{type:'activate',uid:cards[0].uid,key:cards[0].id+'::cast',choices:{target:[target.uid]}});settle(e);
  const action={type:'activate',uid:cards[1].uid,key:cards[1].id+'::cast'};
  assert.equal(AI.evaluate(e,action,0).useful,false,'granting piercing to the enemy is not an additional benefit');
  const second=put(e,0,'monsters','blue-eyes'),result=AI.evaluate(e,action,0);
  assert.equal(result.useful,true);assert.deepEqual(result.choices.target,[second.uid]);
});

test('each copy of a later draw-triggered heal retains its actual future benefit',()=>{
  const e=fresh();e.state.phase='main1';const cards=[put(e,0,'spells','Solemn Wishes',{faceUp:false}),put(e,0,'spells','Solemn Wishes',{faceUp:false})];
  act(e,{type:'activate',uid:cards[0].uid,key:cards[0].id+'::cast'});settle(e);
  const action={type:'activate',uid:cards[1].uid,key:cards[1].id+'::cast'};
  assert.equal(AI.evaluate(e,action,0).useful,true);act(e,action);settle(e);
  e.draw(0,1);e.pump();let steps=0;while(e.state.pending&&steps++<50)act(e,e.aiNext());
  assert.ok(steps<50);assert.equal(e.state.players[0].lp,9000);
});

test('continuous fees stack on the next activation even without an immediate outcome',()=>{
  const e=fresh();e.state.phase='main1';const cards=[put(e,0,'spells','Chain Energy',{faceUp:false}),put(e,0,'spells','Chain Energy',{faceUp:false})];
  act(e,{type:'activate',uid:cards[0].uid,key:cards[0].id+'::cast'});settle(e);
  const action={type:'activate',uid:cards[1].uid,key:cards[1].id+'::cast'};
  assert.equal(AI.evaluate(e,action,0).useful,true);act(e,action);settle(e);
  const spell=put(e,0,'hand','Pot of Greed');act(e,{type:'activate',uid:spell.uid,key:spell.id+'::cast'});settle(e);
  assert.equal(e.state.players[0].lp,7000);
});

test('additive continuous stats retain value before qualifying monsters enter play',()=>{
  const e=fresh();e.state.phase='main1';const cards=[put(e,0,'spells','Aqua Chorus',{faceUp:false}),put(e,0,'spells','Aqua Chorus',{faceUp:false})];
  act(e,{type:'activate',uid:cards[0].uid,key:cards[0].id+'::cast'});settle(e);
  const action={type:'activate',uid:cards[1].uid,key:cards[1].id+'::cast'};
  assert.equal(AI.evaluate(e,action,0).useful,true);act(e,action);settle(e);
  const blue=put(e,0,'monsters','blue-eyes');put(e,0,'monsters','blue-eyes');
  assert.equal(e.attackValue(blue),4000);
});
