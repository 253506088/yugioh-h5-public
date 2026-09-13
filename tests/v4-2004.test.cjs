const test=require('node:test'),assert=require('node:assert/strict');
const {D,E,id,put,act}=require('./yearly-sweep-helpers.cjs'),{DuelEngine}=require('../src/advanced-engine.js');
function fresh(){const e=new DuelEngine({deck:'blue',opponentDeck:'dark',first:0,seed:2004});e.state.turn=6;e.state.phase='main1';for(const p of e.state.players){p.deck.push(...p.hand);p.hand=[];}return e;}
function drain(e){let n=0;while(e.state.pending&&n++<100)act(e,e.state.pending.kind==='window'?{type:'pass'}:e.chooseAI(e.state.pending));assert.ok(n<100);e.assertState();}
function cast(e,m,choices={}){act(e,{type:'activate',uid:m.uid,key:m.id+'::cast',choices});drain(e);}
test('LV evolution sends its source to the GY and records the actual evolution source',()=>{
 const e=fresh(),a=put(e,0,'monsters','Armed Dragon LV3'),b=put(e,0,'hand','Armed Dragon LV5');e.emit({type:'standby',owner:0});e.pump();drain(e);assert.equal(e.find(a.uid).zone,'grave');assert.equal(e.find(b.uid).zone,'monsters');assert.equal(e.find(b.uid).card.yearly.lvFrom,a.id);
});
test('Level Up ignores the summon condition but does not grant the monster-effect-only bonus',()=>{
 const e=fresh(),a=put(e,0,'monsters','Ultimate Insect LV1'),b=put(e,0,'hand','Ultimate Insect LV3'),foe=put(e,1,'monsters','Blue-Eyes White Dragon'),spell=put(e,0,'hand','Level Up!');cast(e,spell,{cost:[a.uid]});assert.equal(e.find(a.uid).zone,'grave');assert.equal(e.find(b.uid).zone,'monsters');assert.equal(e.attackValue(foe),3000);assert.equal(b.yearly.lvFrom,null);
 const r=fresh(),first=put(r,0,'monsters','Ultimate Insect LV1'),second=put(r,0,'hand','Ultimate Insect LV3'),enemy=put(r,1,'monsters','Blue-Eyes White Dragon');r.emit({type:'standby',owner:0});r.pump();drain(r);assert.equal(r.find(first.uid).zone,'grave');assert.equal(second.yearly.lvFrom,first.id);assert.equal(r.attackValue(enemy),2700);
});
test('a Horus LV8 summoned by Level Up cannot subsequently be revived as a proper summon',()=>{
 const e=fresh(),m=put(e,0,'monsters','Horus the Black Flame Dragon LV6'),to=put(e,0,'hand','Horus the Black Flame Dragon LV8'),s=put(e,0,'hand','Level Up!');cast(e,s,{cost:[m.uid]});assert.equal(e.find(to.uid).zone,'monsters');assert.equal(to.properlySummoned,false);e.move(to.uid,'grave',{kind:'destroy',byOwner:1});assert.equal(e.canSpecial(0,to,{via:'revive'}),false);
});
test('Mystic Swordsman LV4 can be Set but cannot be face-up Normal Summoned',()=>{
 const e=fresh(),m=put(e,0,'hand','Mystic Swordsman LV4');assert.equal(e.act({type:'summon',uid:m.uid}).ok,false);act(e,{type:'summon',uid:m.uid,mode:'defense'});drain(e);assert.equal(e.find(m.uid).card.faceUp,false);
});
test('Fusilier Dragon can use no tributes while retaining Level 7 and halving both original stats',()=>{
 const e=fresh(),m=put(e,0,'hand','Fusilier Dragon, the Dual-Mode Beast');act(e,{type:'summon',uid:m.uid,noTribute:true});drain(e);assert.equal(e.level(m),7);assert.equal(e.originalAttack(m),1400);assert.equal(e.originalDefense(m),1000);assert.equal(e.state.players[0].grave.length,0);
});
test('the three Harpie Lady variants share a deck name limit',()=>{
 const base=JSON.parse(JSON.stringify(D.DECKS.blue));base.cards.splice(0,4,id('Harpie Lady'),id('Harpie Lady 1'),id('Harpie Lady 2'),id('Harpie Lady 3'));assert.equal(global.DuelDecks.analyze(base).valid,false);assert.ok(global.DuelDecks.analyze(base).errors.some(e=>e.includes('同名')));
});
test('The End of Anubis negates a spell that targets the GY without removing the target',()=>{
 const e=fresh();put(e,1,'monsters','The End of Anubis');const m=put(e,0,'grave','Blue-Eyes White Dragon'),s=put(e,0,'hand','Monster Reborn');cast(e,s,{target:[m.uid]});assert.equal(e.find(m.uid).zone,'grave');assert.ok(e.state.chainHistory.some(l=>l.cardId===s.id&&l.status==='negated'));
});
test('Grave Protector replaces a battle trip to the GY with a return to the Deck',()=>{
 const e=fresh();put(e,0,'monsters','Grave Protector');const a=put(e,0,'monsters','Blue-Eyes White Dragon'),b=put(e,1,'monsters','Mystic Tomato');e.state.phase='battle';act(e,{type:'attack',uid:a.uid,target:b.uid});drain(e);assert.equal(e.find(b.uid).zone,'deck');assert.ok(!e.state.chainHistory.some(l=>l.cardId===b.id));
});
test('Horus LV6 ignores an opposing Book of Moon effect',()=>{
 const e=fresh(),m=put(e,1,'monsters','Horus the Black Flame Dragon LV6'),s=put(e,0,'hand','Book of Moon');cast(e,s,{target:[m.uid]});assert.equal(e.find(m.uid).card.faceUp,true);
});
test('the three Sarcophagi are placed in order and sent away to summon the Pharaoh',()=>{
 const e=fresh(),a=put(e,0,'spells','The First Sarcophagus',{faceUp:false}),b=put(e,0,'deck','The Second Sarcophagus'),c=put(e,0,'deck','The Third Sarcophagus'),m=put(e,0,'hand','Spirit of the Pharaoh');cast(e,a);
 e.emit({type:'end-phase',owner:1});e.pump();drain(e);assert.equal(e.find(b.uid).zone,'spells');assert.equal(e.find(c.uid).zone,'deck');
 e.state.turn+=2;e.emit({type:'end-phase',owner:1});e.pump();drain(e);for(const card of [a,b,c])assert.equal(e.find(card.uid).zone,'grave');assert.equal(e.find(m.uid).zone,'monsters');
});
test('Chain Burst receives trap-resolution events and causes actual LP loss',()=>{
 const e=fresh();put(e,0,'spells','Chain Burst');const t=put(e,1,'spells','Jar of Greed',{faceUp:false});e.state.active=1;cast(e,t);assert.equal(e.state.players[1].lp,7000);assert.equal(e.state.players[1].hand.length,1);
});
test('Soul Resurrection retains its relationship and destroys the revived monster if removed',()=>{
 const e=fresh(),m=put(e,0,'grave','Blue-Eyes White Dragon'),t=put(e,0,'spells','Soul Resurrection',{faceUp:false});cast(e,t,{target:[m.uid]});assert.equal(m.position,'defense');e.destroy(t.uid,{id:id('Mystical Space Typhoon'),owner:1,effectType:'spell'});e.pump();drain(e);assert.equal(e.find(m.uid).zone,'grave');
});
test('Rescue Cat sends itself, negates both recruited beasts and destroys them at End Phase',()=>{
 const e=fresh(),cat=put(e,0,'monsters','Rescue Cat'),a=put(e,0,'deck','Nimble Momonga'),b=put(e,0,'deck','Milus Radiant');act(e,{type:'activate',uid:cat.uid,key:cat.id+'::rescue'});drain(e);assert.equal(e.find(cat.uid).zone,'grave');for(const m of [a,b]){assert.equal(e.find(m.uid).zone,'monsters');assert.equal(e.negated(m),true);}e.endTurn();e.pump();drain(e);for(const m of [a,b])assert.equal(e.find(m.uid).zone,'grave');
});
test('Return from the Different Dimension pays half LP and banishes its summoned cards at End Phase',()=>{
 const e=fresh(),m=put(e,0,'banished','Blue-Eyes White Dragon'),t=put(e,0,'spells','Return from the Different Dimension',{faceUp:false});cast(e,t);assert.equal(e.state.players[0].lp,4000);assert.equal(e.find(m.uid).zone,'monsters');e.endTurn();e.pump();drain(e);assert.equal(e.find(m.uid).zone,'banished');
});
test('Threatening Roar prevents later declarations without negating an attack already declared',()=>{
 const e=fresh(),a=put(e,1,'monsters','Blue-Eyes White Dragon'),b=put(e,1,'monsters','Battle Ox'),t=put(e,0,'spells','Threatening Roar',{faceUp:false});e.state.active=1;e.state.phase='battle';act(e,{type:'attack',uid:a.uid});act(e,{type:'respond',uid:t.uid,key:t.id+'::cast'});drain(e);assert.equal(e.state.players[0].lp,5000);assert.equal(e.canAttack(b,1),false);
});
test('Mind Control forbids tribute for only the turn and returns the monster to its owner',()=>{
 const e=fresh(),m=put(e,1,'monsters','Blue-Eyes White Dragon'),s=put(e,0,'hand','Mind Control');cast(e,s,{target:[m.uid]});assert.equal(e.find(m.uid).owner,0);assert.equal(e.canTribute(m,0),false);e.endTurn();e.pump();drain(e);assert.equal(e.find(m.uid).owner,1);assert.equal(e.canTribute(m,1),true);
});
test('Spell Economics waives an activation LP cost but does not waive monster effects',()=>{
 const e=fresh();put(e,0,'spells','Spell Economics');const s=put(e,0,'hand','Enchanting Fitting Room');cast(e,s);assert.equal(e.state.players[0].lp,8000);const venus=put(e,0,'monsters','The Agent of Creation - Venus'),ball=put(e,0,'hand','Mystical Shine Ball');act(e,{type:'activate',uid:venus.uid,key:venus.id+'::recruit',choices:{target:[ball.uid]}});drain(e);assert.equal(e.state.players[0].lp,7500);
});
test('a live Horus counter chain remains exactly reproducible after saving and restoring',()=>{
 const e=fresh(),m=put(e,0,'monsters','Horus the Black Flame Dragon LV8'),s=put(e,1,'hand','Pot of Greed');e.state.active=1;act(e,{type:'activate',uid:s.uid,key:s.id+'::cast'});act(e,{type:'respond',uid:m.uid,key:m.id+'::negate'});const r=DuelEngine.restore(e.snapshot());drain(e);drain(r);assert.deepEqual(e.snapshot(),r.snapshot());assert.equal(e.state.players[1].hand.length,0);
});
