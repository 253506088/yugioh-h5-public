const test=require('node:test'),assert=require('node:assert/strict');
const {D,E,id,put,act,settle}=require('./yearly-sweep-helpers.cjs');
const {DuelEngine}=require('../src/advanced-engine.js');
function fresh(){const e=new DuelEngine({deck:'blue',opponentDeck:'dark',first:0,seed:2003});e.state.turn=6;e.state.phase='main1';for(const p of e.state.players){p.deck.push(...p.hand);p.hand=[];}return e;}
function cast(e,m,choices={}){act(e,{type:'activate',uid:m.uid,key:m.id+'::cast',choices});settle(e,m.uid);}
function use(e,m,mode,choices={}){act(e,{type:'activate',uid:m.uid,key:m.id+'::'+mode,choices});settle(e,m.uid);}
function drain(e){let guard=0;while(e.state.pending&&guard++<100){act(e,e.state.pending.kind==='window'?{type:'pass'}:e.chooseAI(e.state.pending));}assert.ok(guard<100);}
test('chaos summons spend one LIGHT and one DARK, reject mismatched costs, and mark proper summons',()=>{
 const e=fresh(),m=put(e,0,'hand','Chaos Sorcerer'),light=put(e,0,'grave','Blue-Eyes White Dragon'),dark=put(e,0,'grave','Dark Magician');
 assert.equal(e.canSpecial(0,m,{via:'revive'}),false);
 const snap=e.snapshot();assert.equal(e.act({type:'activate',uid:m.uid,key:m.id+'::year-special',choices:{light:[dark.uid],dark:[light.uid]}}).ok,false);assert.deepEqual(e.snapshot(),snap);
 use(e,m,'year-special',{light:[light.uid],dark:[dark.uid]});assert.equal(e.find(m.uid).zone,'monsters');assert.equal(e.find(light.uid).zone,'banished');assert.equal(e.find(dark.uid).zone,'banished');assert.equal(e.find(m.uid).card.properlySummoned,true);
 e.move(m.uid,'grave',{kind:'destroy',byOwner:1});assert.equal(e.canSpecial(0,e.find(m.uid).card,{via:'revive'}),true);
});
test('Chaos Sorcerer banishes a target and forfeits its attacks for the turn',()=>{
 const e=fresh(),m=put(e,0,'monsters','Chaos Sorcerer'),foe=put(e,1,'monsters','Blue-Eyes White Dragon');use(e,m,'banish',{target:[foe.uid]});assert.equal(e.find(foe.uid).zone,'banished');e.state.phase='battle';assert.equal(e.canAttack(m,0),false);e.state.turn++;assert.equal(e.canAttack(m,0),true);
});
test('Chaos Emperor Dragon pays LP and enforces the complete-turn other-effect restriction',()=>{
 const e=fresh(),m=put(e,0,'monsters','Chaos Emperor Dragon - Envoy of the End'),spell=put(e,0,'hand','Pot of Greed');cast(e,spell);assert.equal(E.available(e,0,{kind:'main',phase:'main1'}).some(a=>a.key===m.id+'::wipe'),false);
 e.state.turn++;put(e,1,'monsters','Battle Ox');put(e,1,'hand','Dark Magician');const before=e.state.players[0].lp;use(e,m,'wipe');assert.equal(e.state.players[0].lp,before-1000);assert.equal(e.monsters(0).length,0);assert.equal(e.monsters(1).length,0);assert.equal(e.state.players[1].lp,7400);
 const second=put(e,0,'hand','Pot of Greed');assert.equal(E.available(e,0,{kind:'main',phase:'main1'}).some(a=>a.uid===second.uid),false);
});
test('attribute ritual contracts require an exact level sum and survive saved material selection',()=>{
 const e=fresh(),m=put(e,0,'hand','Relinquished'),one=put(e,0,'hand','Kuriboh'),two=put(e,0,'hand','Mystical Shine Ball'),spell=put(e,0,'hand','Contract with the Abyss');
 assert.equal(e.ritualValid(0,m,[one],spell.id),true);assert.equal(e.ritualValid(0,m,[two],spell.id),false);assert.equal(e.ritualValid(0,m,[one,two],spell.id),false);assert.equal(e.ritualAccepts(id('Earth Chant'),m),false);
 act(e,{type:'activate',uid:spell.uid,key:spell.id+'::cast'});while(e.state.pending?.kind==='window')act(e,{type:'pass'});while(e.state.pending&&e.state.pending.kind!=='materials')act(e,e.chooseAI(e.state.pending));assert.equal(e.state.pending?.purpose,'ritual');const r=DuelEngine.restore(e.snapshot());act(r,{type:'choose',uids:[one.uid],position:'defense'});drain(r);assert.equal(r.find(m.uid).zone,'monsters');assert.equal(r.find(one.uid).zone,'grave');assert.equal(r.find(two.uid).zone,'hand');
});
test('Shrink halves the original ATK once and preserves additive modifiers',()=>{
 const e=fresh(),m=put(e,1,'monsters','Blue-Eyes White Dragon');e.modify(m.uid,'atk','add',500,e.state.turn);const a=put(e,0,'hand','Shrink'),b=put(e,0,'hand','Shrink');cast(e,a,{target:[m.uid]});assert.equal(e.attackValue(m),2000);cast(e,b,{target:[m.uid]});assert.equal(e.attackValue(m),2000);e.state.turn++;assert.equal(e.attackValue(m),3000);
});
test('Archfiend upkeep is mandatory and Pandemonium suppresses only that upkeep',()=>{
 const e=fresh(),m=put(e,0,'monsters','Shadowknight Archfiend');e.emit({type:'standby',owner:0});e.pump();drain(e);assert.equal(e.state.players[0].lp,7100);put(e,0,'fieldSpell','Pandemonium');e.state.turn+=2;e.emit({type:'standby',owner:0});e.pump();drain(e);assert.equal(e.state.players[0].lp,7100);assert.equal(e.find(m.uid).zone,'monsters');
});
test('an Archfiend dice shield negates a targeting effect only when actually resolving',()=>{
 const e=fresh(),m=put(e,0,'monsters','Infernalqueen Archfiend'),spell=put(e,1,'hand','Book of Moon');e.state.active=1;e.random=()=>.2;act(e,{type:'activate',uid:spell.uid,key:spell.id+'::cast',choices:{target:[m.uid]}});drain(e);assert.equal(e.find(m.uid).card.faceUp,true);assert.equal(e.find(spell.uid).zone,'grave');assert.ok(e.state.chainHistory.some(l=>l.cardId===spell.id&&l.status==='negated'));
});
test('Goblin of Greed blocks discard costs without blocking discard by effects',()=>{
 const e=fresh();put(e,0,'monsters','Goblin of Greed');const jammer=put(e,0,'spells','Magic Jammer',{faceUp:false});put(e,0,'hand','Sparks');const spell=put(e,1,'hand','Pot of Greed');e.state.active=1;act(e,{type:'activate',uid:spell.uid,key:spell.id+'::cast'});assert.ok(!e.state.pending?.options?.some(a=>a.uid===jammer.uid));drain(e);assert.equal(e.state.players[1].hand.length,2);
});
test('Archfiends Roar pays, revives, prevents tribute and destroys at End Phase',()=>{
 const e=fresh(),m=put(e,0,'grave','Archfiend Soldier'),trap=put(e,0,'spells',"Archfiend's Roar",{faceUp:false});cast(e,trap,{target:[m.uid]});assert.equal(e.state.players[0].lp,7500);assert.equal(e.find(m.uid).zone,'monsters');assert.equal(e.canTribute(m,0),false);e.endTurn();e.pump();drain(e);assert.equal(e.find(m.uid).zone,'grave');
});
test('Cursed Seal really discards its Spell cost and locks that spell name for the duel',()=>{
 const e=fresh(),trap=put(e,0,'spells','Cursed Seal of the Forbidden Spell',{faceUp:false}),cost=put(e,0,'hand','Sparks'),spell=put(e,1,'hand','Pot of Greed');e.state.active=1;act(e,{type:'activate',uid:spell.uid,key:spell.id+'::cast'});act(e,{type:'respond',uid:trap.uid,key:trap.id+'::cast',choices:{cost:[cost.uid]}});drain(e);assert.equal(e.find(cost.uid).zone,'grave');assert.ok(e.state.players[1].forbiddenSpellNames.includes(spell.id));e.state.turn+=2;const again=put(e,1,'hand','Pot of Greed');assert.ok(!E.available(e,1,{kind:'main',phase:'main1'}).some(a=>a.uid===again.uid));
});
test('Final Countdown includes its activation turn and does not win one turn early',()=>{
 const e=fresh(),s=put(e,0,'hand','Final Countdown');cast(e,s);assert.equal(e.state.players[0].lp,6000);assert.equal(e.state.players[0].finalCountdownTurn,25);e.state.turn=24;e.emit({type:'end-phase',owner:0});assert.equal(e.state.winner,null);e.state.turn=25;e.emit({type:'end-phase',owner:1});assert.equal(e.state.winner,0);
});
test('two Soul Absorptions retain independent healing when a card is later banished',()=>{
 const e=fresh(),a=put(e,0,'spells','Soul Absorption'),b=put(e,0,'spells','Soul Absorption'),m=put(e,1,'grave','Battle Ox');e.move(m.uid,'banished',{kind:'effect-banish',byOwner:0});e.pump();drain(e);assert.equal(e.state.players[0].lp,9000);assert.ok(e.find(a.uid)&&e.find(b.uid));
});
test('Enemy Controller pays a monster and returns the borrowed monster at End Phase',()=>{
 const e=fresh(),cost=put(e,0,'monsters','Battle Ox'),foe=put(e,1,'monsters','Blue-Eyes White Dragon'),s=put(e,0,'hand','Enemy Controller');cast(e,s,{mode:['control'],cost:[cost.uid],target:[foe.uid]});assert.equal(e.find(cost.uid).zone,'grave');assert.equal(e.find(foe.uid).owner,0);e.endTurn();e.pump();drain(e);assert.equal(e.find(foe.uid).owner,1);
});
test('Sakuretsu Armor destroys the attacking monster through an actual response window',()=>{
 const e=fresh(),m=put(e,1,'monsters','Blue-Eyes White Dragon'),t=put(e,0,'spells','Sakuretsu Armor',{faceUp:false});e.state.active=1;e.state.phase='battle';act(e,{type:'attack',uid:m.uid});act(e,{type:'respond',uid:t.uid,key:t.id+'::cast',choices:{target:[m.uid]}});drain(e);assert.equal(e.find(m.uid).zone,'grave');assert.equal(e.state.players[0].lp,8000);
});
test('Silent Doom revives in Defense and keeps its attack restriction after a position change',()=>{
 const e=fresh(),m=put(e,0,'grave','Blue-Eyes White Dragon'),s=put(e,0,'hand','Silent Doom');cast(e,s,{target:[m.uid]});assert.equal(m.position,'defense');e.state.turn++;m.position='attack';e.state.phase='battle';assert.equal(e.canAttack(m,0),false);
});
test('a draw result is explicit when Self-Destruct Button sets both players to zero',()=>{
 const e=fresh();e.state.players[0].lp=1000;const t=put(e,0,'spells','Self-Destruct Button',{faceUp:false});cast(e,t);assert.equal(e.state.winner,'draw');assert.deepEqual(e.state.players.map(p=>p.lp),[0,0]);
});
test('new triggered effects have no invalid state after a whole controlled chain replay',()=>{
 const e=fresh(),m=put(e,0,'monsters','Legendary Flame Lord'),p=put(e,0,'hand','Pot of Greed');act(e,{type:'activate',uid:p.uid,key:p.id+'::cast'});const restored=DuelEngine.restore(e.snapshot());drain(e);drain(restored);assert.deepEqual(e.snapshot(),restored.snapshot());assert.equal(e.find(m.uid).card.counters,1);
});
test('Amplifier permits its Jinzo controllers traps while still suppressing the opponent',()=>{
 const e=fresh(),jinzo=put(e,0,'monsters','Jinzo'),amp=put(e,0,'hand','Amplifier'),own=put(e,0,'spells','Jar of Greed',{faceUp:false}),foe=put(e,1,'spells','Jar of Greed',{faceUp:false});cast(e,amp,{target:[jinzo.uid]});cast(e,own);assert.equal(e.state.players[0].hand.length,1);e.state.active=1;assert.ok(!E.available(e,1,{kind:'main',phase:'main1'}).some(a=>a.uid===foe.uid));e.destroy(amp.uid,{id:id('Mystical Space Typhoon'),owner:1,effectType:'spell'});e.pump();drain(e);assert.equal(e.find(jinzo.uid).zone,'grave');
});
