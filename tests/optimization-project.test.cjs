const test=require('node:test');
const {assert,D,E,DuelEngine,fresh,put,act,run,settle}=require('./gx-helpers.cjs');
const R=globalThis.DuelRuleModes,T=globalThis.DuelDecks,Editor=require('../src/deck-editor.js');
const flush=e=>{e.pump();settle(e);};

test('draft saves waive sizes only; wrong zones, unknown identities, tokens and fourth copies fail',()=>{
 const d={name:'empty',cards:[],extra:[],side:[]};assert.equal(T.cleanDraft(d).cards.length,0);
 const extra=D.DECKS.hero.extra[0],main=D.DECKS.hero.cards[0];
 for(const bad of [{...d,cards:[extra]},{...d,extra:[main]},{...d,side:['unknown']},{...d,cards:[main,main],side:[main,main]}])assert.throws(()=>T.cleanDraft(bad));
 assert.throws(()=>Editor.transfer({...d,side:[main]},{zone:'side',index:0,id:main},{zone:'extra'}));
 const e={...d,side:[extra]};assert.throws(()=>Editor.transfer(e,{zone:'side',index:0,id:extra},{zone:'cards'}));assert.deepEqual(e.side,[extra]);
});

test('face-down target captions distinguish public zones without revealing identities',()=>{
 const e=fresh(),m=put(e,1,'monsters','Dark Magician',{faceUp:false}),s=put(e,1,'spells','Mirror Force',{faceUp:false});
 const a=e.option(m,{viewer:0}),b=e.option(s,{viewer:0});assert.match(a.label,/怪兽/);assert.match(b.label,/魔法／陷阱/);
 for(const o of [a,b]){assert.equal(o.cardId,null);assert.equal(o.hidden,true);assert.equal(o.detail,'身份尚未公开');}
});

test('roulette result is saved before resolving and does not reroll on restoration',()=>{
 const e=fresh();R.install(e,'roulette');e.random=()=>.2;e.runTask({op:'rule-roulette',owner:0});e.pump();
 assert.equal(e.state.players[0].lp,8000);assert.equal(e.state.ruleMode.lastRoll.roll,2);assert.equal(e.state.pending.operation,'rule-roulette-apply');
 const restored=DuelEngine.restore(JSON.parse(JSON.stringify(e.snapshot())));act(restored,{type:'choose',uids:[]});
 assert.equal(restored.state.players[0].lp,2000);assert.equal(restored.state.ruleMode.lastRoll.serial,1);assert.ok(restored.state.log.some(l=>l.rule==='roulette'&&l.lpBefore===8000&&l.lpAfter===2000));
});

test('roulette II rolls once in each entered main phase, including the opening turn',()=>{
 const e=new DuelEngine({seed:57,first:0,ruleMode:'roulette2'});assert.equal(e.state.ruleMode.lastRoll.turn,1);assert.equal(e.state.pending.operation,'rule-roulette-apply');
 e.random=()=>.8;flush(e);const before=e.state.ruleMode.lastRoll.serial;
 act(e,{type:'phase',phase:'main2'});assert.equal(e.state.pending.operation,'rule-roulette-apply');assert.equal(e.state.ruleMode.lastRoll.serial,before+1);
 flush(e);e.pump();assert.equal(e.state.ruleMode.lastRoll.serial,before+1);
 run(e,{type:'end'});assert.equal(e.state.ruleMode.lastRoll.turn,2);assert.equal(e.state.ruleMode.lastRoll.phase,'main1');
});

test('Pseudo Space copies Chicken Game actions, damage protection, cost and expiry without changing physical identity',()=>{
 const e=fresh(),m=put(e,0,'fieldSpell','Pseudo Space'),chicken=put(e,0,'grave','Chicken Game');
 run(e,{type:'activate',uid:m.uid,key:m.id+'::era-effect',choices:{cost:[chicken.uid]}});
 assert.equal(e.find(chicken.uid).zone,'banished');assert.equal(e.cardNameId(m),chicken.id);assert.equal(m.id,D.cardByName('Pseudo Space').id);
 const key=m.id+'::field-copy:'+chicken.id+'::y15-draw';assert.ok(e.actionsFor(m.uid,0).some(a=>a.key===key));
 const n=e.state.players[0].hand.length;run(e,{type:'activate',uid:m.uid,key});assert.equal(e.state.players[0].lp,7000);assert.equal(e.state.players[0].hand.length,n+1);
 assert.ok(!e.actionsFor(m.uid,0).some(a=>a.key===key));e.damage(0,1500,'effect',{id:'sparks',owner:1,effectType:'spell'});assert.equal(e.state.players[0].lp,7000);
 const restored=DuelEngine.restore(JSON.parse(JSON.stringify(e.snapshot())));assert.equal(restored.cardNameId(restored.find(m.uid).card),chicken.id);
 run(restored,{type:'end'});assert.equal(restored.find(m.uid).card.pseudoSpace,undefined);assert.equal(restored.cardNameId(restored.find(m.uid).card),m.id);
});

test('Pseudo Space copies a registered field aura and leaving the field clears the copy',()=>{
 const e=fresh(),m=put(e,0,'fieldSpell','Pseudo Space'),forest=put(e,0,'grave','Forest'),monster=put(e,0,'monsters','Silver Fang');
 const before=e.attackValue(monster);run(e,{type:'activate',uid:m.uid,key:m.id+'::era-effect',choices:{cost:[forest.uid]}});
 assert.equal(e.attackValue(monster),before+200);e.move(m.uid,'hand');assert.equal(e.find(m.uid).card.pseudoSpace,undefined);assert.equal(e.attackValue(monster),before);
});
