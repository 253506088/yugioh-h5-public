const test=require('node:test');
const {assert,D,E,put,fresh,fieldCard}=require('./gx-helpers.cjs');
const id=n=>D.cardByName(n).id;
function act(e,a){const r=e.act(a);assert.equal(r.ok,true,JSON.stringify(a)+' / '+r.error);}
function drain(e,pick){let n=0;while(e.state.pending&&e.state.winner===null&&n++<200){const p=e.state.pending;const a=pick?.(p,e)||(p.kind==='window'?{type:'pass'}:e.chooseAI(p));act(e,a);}assert.ok(n<200);e.assertState();}
const yes=p=>p.kind==='trigger'?{type:'respond',uid:p.trigger.uid,key:p.trigger.key}:null;
const opp={owner:1,id:id('Raigeki'),effectType:'spell'};
function summon(e,m,pick=yes){act(e,{type:'summon',uid:m.uid,mode:'attack'});drain(e,pick);}
test('Mermaid Shark searches a Level 3-5 Fish on Normal Summon',()=>{
 const e=fresh(),m=put(e,0,'hand','Mermaid Shark'),q=put(e,0,'deck','Gazer Shark');summon(e,m,p=>yes(p)||(p.kind==='choice'?{type:'choose',uids:[q.uid]}:null));assert.equal(e.find(q.uid).zone,'hand');
});
test('Beautunaful Princess banishes itself to recruit a Level 4 or lower Fish',()=>{
 const e=fresh(),m=put(e,0,'hand','Beautunaful Princess'),q=put(e,0,'deck','Mermaid Shark');summon(e,m,p=>yes(p)||(p.kind==='choice'?{type:'choose',uids:[q.uid]}:null));assert.equal(e.find(m.uid).zone,'banished');assert.equal(e.find(q.uid).zone,'monsters');
});
test('White Tiger Summoner summons a Normal Monster and powers the whole field',()=>{
 const e=fresh(),m=put(e,0,'hand','White Tiger Summoner'),n=put(e,0,'hand','Battle Ox');summon(e,m,p=>yes(p)||(p.kind==='choice'?{type:'choose',uids:[n.uid]}:null));assert.equal(e.find(n.uid).zone,'monsters');assert.equal(e.attackValue(n),1800);
});
test('Numeral Hunter returns Number Xyz and blocks their Special Summons',()=>{
 const e=fresh(),n=fieldCard(e,1,'Number 39: Utopia',{summonKind:'xyz'}),m=put(e,0,'hand','Numeral Hunter');summon(e,m);assert.equal(e.find(n.uid).zone,'extra');assert.equal(e.canSpecial(1,n,{via:'xyz'}),false);
});
test('Golden Dragon Summoner tributes a monster to bounce a card once per turn',()=>{
 const e=fresh(),g=fieldCard(e,0,'Golden Dragon Summoner'),t=fieldCard(e,0,'Battle Ox'),foe=fieldCard(e,1,'Blue-Eyes White Dragon');
 act(e,{type:'activate',uid:g.uid,key:g.id+'::era2014-bounce',choices:{tribute:[t.uid],target:[foe.uid]}});drain(e);assert.equal(e.find(t.uid).zone,'grave');assert.equal(e.find(foe.uid).zone,'hand');
 assert.ok(!E.available(e,0,{kind:'main'}).some(a=>a.uid===g.uid));
});
test('Heliosphere Dragon alone stops attacks while the opponent holds 4 or fewer cards',()=>{
 const e=fresh();fieldCard(e,0,'Heliosphere Dragon');const a=fieldCard(e,1,'Blue-Eyes White Dragon');e.state.active=1;e.state.phase='battle';assert.equal(e.canAttack(a,1,e.monsters(0)[0].uid),false);
 for(let i=0;i<5;i++)put(e,1,'hand','Battle Ox');assert.equal(e.canAttack(a,1,e.monsters(0)[0].uid),true);
});
test('Lightning Rod Lord forbids Spell activations in Main Phase 1 only',()=>{
 const e=fresh();fieldCard(e,1,'Lightning Rod Lord');const p=put(e,0,'hand','Pot of Greed');e.state.phase='main1';assert.ok(!E.available(e,0,{kind:'main'}).some(a=>a.uid===p.uid));e.state.phase='main2';assert.ok(E.available(e,0,{kind:'main'}).some(a=>a.uid===p.uid));
});
test('Gate Blocker protects your other monsters from opposing targets and negates their Field Spell',()=>{
 const e=fresh();fieldCard(e,0,'Gate Blocker');const ox=fieldCard(e,0,'Battle Ox'),f=put(e,1,'fieldSpell','Sorcerous Spell Wall');assert.equal(e.canTarget(ox,{owner:1,effectType:'spell'}),false);assert.equal(e.activeSpell(f),false);
});
test('Fire Hand destroyed by the opponent destroys a monster and can call Ice Hand',()=>{
 const e=fresh(),f=fieldCard(e,0,'Fire Hand'),foe=fieldCard(e,1,'Blue-Eyes White Dragon'),ice=put(e,0,'deck','Ice Hand');e.destroy(f.uid,opp);e.pump();
 drain(e,p=>yes(p)||(p.kind==='input'?{type:'choose',uids:[foe.uid]}:p.kind==='choice'?{type:'choose',uids:[ice.uid]}:null));assert.equal(e.find(foe.uid).zone,'grave');assert.equal(e.find(ice.uid).zone,'monsters');
});
test('Dawn Knight sent from the field mills a LIGHT monster; from the Deck it tops one',()=>{
 const e=fresh(),d=fieldCard(e,0,'Dawn Knight'),q=put(e,0,'deck','Mystical Elf');e.move(d.uid,'grave',{kind:'effect-send',source:opp});e.pump();drain(e,p=>yes(p)||(p.kind==='choice'?{type:'choose',uids:[q.uid]}:null));assert.equal(e.find(q.uid).zone,'grave');
});
test('Guerilla Kite burns 500 when it leaves the field for the Graveyard',()=>{
 const e=fresh(),k=fieldCard(e,0,'Guerilla Kite'),lp=e.state.players[1].lp;e.destroy(k.uid,opp);e.pump();drain(e);assert.equal(e.state.players[1].lp,lp-500);
});
test('Frontline Observer searches an EARTH Pendulum in the End Phase of its Normal Summon',()=>{
 const e=fresh(),m=put(e,0,'hand','Frontline Observer'),q=put(e,0,'deck','Performapal Partnaga');D.CARDS[q.id].attribute==='地'||assert.fail('fixture');summon(e,m);act(e,{type:'end'});drain(e,p=>yes(p)||(p.kind==='choice'&&p.candidates.some(c=>c.uid===q.uid)?{type:'choose',uids:[q.uid]}:null));assert.equal(e.find(q.uid).zone,'hand');
});
test('Night Dragolich strips DEF from monsters Special Summoned from the Deck',()=>{
 const e=fresh();fieldCard(e,0,'Night Dragolich');const m=fieldCard(e,1,'Battle Ox',{summonKind:'special',summonFrom:'deck',position:'defense'});assert.equal(e.defenseValue(m),0);
});
test('Silent Wobby joins the opponent field, draws 1 and gives them 2000 LP',()=>{
 const e=fresh(),w=put(e,0,'hand','Silent Wobby'),h=e.state.players[0].hand.length,lp=e.state.players[1].lp;act(e,{type:'activate',uid:w.uid,key:w.id+'::era2014-hand'});drain(e);
 assert.equal(e.find(w.uid).owner,1);assert.equal(e.state.players[0].hand.length,h);assert.equal(e.state.players[1].lp,lp+2000);
});
test('Condemned Maiden allows one Quick-Play Spell from the hand on the opponent turn',()=>{
 const e=fresh();fieldCard(e,0,'Condemned Maiden');const q=put(e,0,'hand','Mystical Space Typhoon'),q2=put(e,0,'hand','Mystical Space Typhoon');put(e,1,'spells','Supply Squad',{faceUp:true});e.state.active=1;
 const ctx={owner:0,sourceId:q.id,uid:q.uid};assert.equal(e.handSpellAllowed(ctx),true);e.state.players[0].duelUsed['2014-condemned-maiden']=true;assert.equal(e.handSpellAllowed(ctx),false);
});
