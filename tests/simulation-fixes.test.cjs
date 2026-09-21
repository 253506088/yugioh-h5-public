const test=require('node:test'),assert=require('node:assert/strict');
const {DuelEngine}=require('../src/advanced-engine.js');
require('../src/advanced-effects.js');
const {D,put,act,settle,run}=require('./yearly-sweep-helpers.cjs');
function fresh(owner=0){
  const e=new DuelEngine({deck:'blue',opponentDeck:'dark',first:owner,seed:91306});
  e.state.turn=4;e.state.phase='main1';e.state.active=owner;
  for(const p of e.state.players){p.deck.push(...p.hand);p.hand=[];}
  return e;
}
const cast=c=>({type:'activate',uid:c.uid,key:c.id+'::cast'});

test('Giant Trunade returns every other Spell and Trap but is itself sent to the Graveyard',()=>{
  const e=fresh(),trunade=put(e,0,'hand','Giant Trunade'),mine=put(e,0,'spells','Mass Driver',{faceUp:true}),theirs=put(e,1,'spells','Mirror Force',{faceUp:false});
  run(e,cast(trunade));
  assert.equal(e.find(trunade.uid).zone,'grave','Giant Trunade does not bounce itself');
  assert.equal(e.find(mine.uid).zone,'hand');assert.equal(e.find(theirs.uid).zone,'hand');
  const lonely=fresh(),only=put(lonely,0,'hand','Giant Trunade');
  assert.equal(lonely.allActions(0).some(a=>a.uid===only.uid&&a.type==='activate'),false,'nothing else to return means no activation');
});

test('a bot with Giant Trunade and Mass Driver finishes its turn instead of looping',()=>{
  const e=fresh();put(e,0,'hand','Giant Trunade');put(e,0,'spells','Mass Driver',{faceUp:true});put(e,0,'monsters','Battle Ox');put(e,0,'hand','Giant Trunade');
  let steps=0;while(e.state.winner===null&&e.state.active===0&&steps++<60)run(e,e.aiNext());
  assert.ok(steps<60,'the turn ended within '+steps+' actions');assert.equal(e.state.active,1);
});

test('Spellbook of the Master only offers books whose copied effect can be applied right now',()=>{
  const e=fresh(),master=put(e,0,'hand','Spellbook of the Master'),secrets=put(e,0,'hand','Spellbook of Secrets');
  put(e,0,'monsters','Summoner Monk',{faceUp:false,position:'defense'});
  const eternity=put(e,0,'grave','Spellbook of Eternity');
  assert.equal(e.allActions(0).some(a=>a.uid===master.uid&&a.type==='activate'),false,'Eternity has nothing to return and Monk is face-down, so the copy would fizzle');
  e.find(e.monsters(0)[0].uid).card.faceUp=true;
  assert.equal(e.allActions(0).some(a=>a.uid===master.uid&&a.type==='activate'),false,'a banished Spellbook is still required for Eternity');
  const banished=put(e,0,'banished','Spellbook of Secrets');
  assert.equal(e.allActions(0).some(a=>a.uid===master.uid&&a.type==='activate'),true);
  act(e,cast(master));
  const p=e.state.pending;assert.equal(p.kind,'input');assert.deepEqual(p.group.candidates.map(c=>c.uid),[eternity.uid]);
  act(e,{type:'choose',uids:[eternity.uid]});
  for(let i=0;e.state.pending&&i<10;i++)act(e,e.chooseAI(e.state.pending));
  assert.equal(e.find(banished.uid).zone,'hand','the copied Eternity returned the banished book');
  assert.equal(e.find(secrets.uid).zone,'hand','the revealed Spellbook stays in hand');
});

test('bots skip a window response whose cost cannot actually be paid',()=>{
  const e=fresh(),hyperion=put(e,0,'monsters','Master Hyperion'),honest=put(e,0,'hand','Honest');
  put(e,1,'monsters','Masked HERO Dark Law');const target=put(e,1,'monsters','Elemental HERO Stratos');
  e.state.phase='battle';act(e,{type:'attack',uid:hyperion.uid,target:target.uid});
  let seen=false,guard=0;
  while(e.state.pending&&guard++<30){
    const p=e.state.pending;
    if(p.kind==='window'&&p.options.some(o=>o.uid===honest.uid)){
      seen=true;assert.equal(e.aiCanCommit({type:'respond',uid:honest.uid,key:honest.id+'::damage'}),false,'Dark Law banishes Honest instead of sending it to the Graveyard');
      const chosen=e.chooseAI(p);assert.notEqual(chosen.uid,honest.uid,JSON.stringify(chosen));
    }
    const r=e.act(e.chooseAI(p));assert.ok(r.ok,r.error);
  }
  assert.ok(seen,'Honest was offered');assert.equal(e.state.pending,null);
  const plain=fresh(),h=put(plain,0,'hand','Honest'),m=put(plain,0,'monsters','Master Hyperion'),foe=put(plain,1,'monsters','Blue-Eyes White Dragon');
  plain.state.phase='battle';act(plain,{type:'attack',uid:m.uid,target:foe.uid});
  let offered=false;guard=0;
  while(plain.state.pending&&guard++<30){const p=plain.state.pending;if(p.kind==='window'&&p.options.some(o=>o.uid===h.uid)){offered=true;assert.equal(plain.aiCanCommit({type:'respond',uid:h.uid,key:h.id+'::damage'}),true);assert.equal(plain.chooseAI(p).uid,h.uid);}act(plain,plain.chooseAI(p));}
  assert.ok(offered);assert.equal(plain.find(foe.uid).zone,'grave','Honest still wins the battle when it can be paid');
});

test('checking whether a response can be committed does not touch the live duel or its random state',()=>{
  const e=fresh(),h=put(e,0,'hand','Honest'),m=put(e,0,'monsters','Master Hyperion'),foe=put(e,1,'monsters','Blue-Eyes White Dragon');
  e.state.phase='battle';act(e,{type:'attack',uid:m.uid,target:foe.uid});
  while(e.state.pending&&!(e.state.pending.kind==='window'&&e.state.pending.options.some(o=>o.uid===h.uid)))act(e,e.chooseAI(e.state.pending));
  const before=e.snapshot();e.aiCanCommit({type:'respond',uid:h.uid,key:h.id+'::damage'});e.aiCanCommit({type:'pass'});
  assert.deepEqual(e.snapshot(),before);
});
