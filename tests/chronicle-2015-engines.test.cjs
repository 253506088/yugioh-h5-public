const test=require('node:test');
const {assert,D,E,DuelEngine,put,fresh,fieldCard,act,drain,use,trigger,source}=require('./chronicle-2015-helpers.cjs');
const id=n=>D.cardByName(n).id;
test('2015 three decks preserve sourced quantities, distinct strategies and playable identities',()=>{
 const rows=require('../data/decks-2015.json'),Decks=require('../src/deck-tools.js');assert.equal(rows.decks.length,3);
 for(const row of rows.decks){const d=D.DECKS[row.id];assert.ok(Decks.analyze(d).valid);assert.equal(d.cards.length,row.sourceKind==='historical-decklist'?41:40);assert.equal(d.extra.length,15);assert.equal(row.side.reduce((s,x)=>s+x[1],0),row.sourceKind==='historical-decklist'?15:0);for(const c of [...d.cards,...d.extra]){assert.ok(D.CARDS[c].releaseYear<=2015);assert.notEqual(D.CARDS[c].implementationStatus,'pending',D.CARDS[c].officialName);}}
});
test('Ghost Ogre destroys an activated monster but does not negate its already activated effect',()=>{
 const e=fresh(),ogre=put(e,1,'hand','Ghost Ogre & Snow Rabbit'),m=fieldCard(e,0,'Neptabyss, the Atlantean Prince'),cost=put(e,0,'deck','Atlantean Heavy Infantry'),q=put(e,0,'deck','Atlantean Dragoons');
 act(e,{type:'activate',uid:m.uid,key:m.id+'::y15-search',choices:{cost:[cost.uid]}});assert.ok(e.state.pending.options.some(a=>a.uid===ogre.uid));act(e,{type:'respond',uid:ogre.uid,key:ogre.id+'::y15-destroy'});drain(e);assert.equal(e.find(ogre.uid).zone,'grave');assert.equal(e.find(m.uid).zone,'grave');assert.equal(e.find(q.uid).zone,'hand');
});
test('liberation forbids Ghost Ogre and Neptabyss costs that explicitly require the GY',()=>{
 const e=fresh(),m=fieldCard(e,0,'Neptabyss, the Atlantean Prince');put(e,0,'deck','Atlantean Dragoons');put(e,0,'deck','Atlantean Heavy Infantry');e.state.ruleMode={id:'liberation',version:1,players:[{},{}]};assert.equal(E.available(e,0,{kind:'main'}).some(a=>a.uid===m.uid),false);
});
test('Twin Twisters discards one card before destroying two backrow targets',()=>{
 const e=fresh(),s=put(e,0,'hand','Twin Twisters'),c=put(e,0,'hand','Battle Ox'),a=put(e,1,'spells','Mirror Force',{faceUp:false}),b=put(e,1,'spells','Jar of Greed',{faceUp:false});use(e,s,'cast',{discard:[c.uid],target:[a.uid,b.uid]});for(const m of [c,a,b])assert.equal(e.find(m.uid).zone,'grave');assert.equal(c.earlySent.kind,'cost-discard');
});
test('Majespecter immunity protects monster zones, while Kirin bounces both selected monsters',()=>{
 const e=fresh(),k=fieldCard(e,0,'Majespecter Unicorn - Kirin'),b=fieldCard(e,1,'Blue-Eyes White Dragon');assert.equal(e.canTarget(k,source(e)),false);assert.equal(e.destroy(k.uid,source(e)),false);use(e,k,'y15-bounce',{own:[k.uid],target:[b.uid]});assert.equal(e.find(k.uid).zone,'hand');assert.equal(e.find(b.uid).zone,'hand');
});
test('Ptolemaeus detaches three, transfers its body and remaining materials to a Rank 5',()=>{
 const e=fresh(),p=fieldCard(e,0,'Tellarknight Ptolemaeus'),n=put(e,0,'extra','Cyber Dragon Nova');for(let i=0;i<4;i++){const m=put(e,0,'grave','Battle Ox');e.attach(p.uid,m.uid,source(e));}use(e,p,'y15-rankup');assert.equal(e.find(n.uid).zone==='monsters'||e.find(n.uid).zone==='extraMonster',true);assert.equal(n.overlays.length,2);assert.equal(e.find(p.uid).zone,'overlays');assert.equal(n.summonKind,'xyz');
});
test('Card of Demise sends the hand in the End Phase and prohibits Special Summons',()=>{
 const e=fresh(),s=put(e,0,'hand','Card of Demise');use(e,s);assert.equal(e.state.players[0].hand.length,3);const m=e.state.players[0].hand.find(m=>D.isMonster(D.CARDS[m.id]));if(m)assert.equal(e.canSpecial(0,m,{via:'effect'}),false);trigger(e,()=>e.emit({type:'end-phase',owner:0}));assert.equal(e.state.players[0].hand.length,0);
});
test('Burning Abyss self-summon and sent effects share a name limit',()=>{
 const e=fresh(),g=put(e,0,'hand','Graff, Malebranche of the Burning Abyss'),q=put(e,0,'deck','Cir, Malebranche of the Burning Abyss');use(e,g,'y15-special');trigger(e,()=>e.move(g.uid,'grave',{kind:'effect-send',source:source(e)}));assert.equal(e.find(q.uid).zone,'deck');
});
test('Burning Abyss destroys itself beside outsiders; Rhino protects other Fiends',()=>{
 const e=fresh(),g=fieldCard(e,0,'Graff, Malebranche of the Burning Abyss');fieldCard(e,0,'Battle Ox');assert.equal(e.continuousMaintenance(),true);assert.equal(e.find(g.uid).zone,'grave');const f=fieldCard(e,0,'Farfa, Malebranche of the Burning Abyss'),r=fieldCard(e,0,'Fiendish Rhino Warrior');e.continuousMaintenance();assert.equal(e.find(f.uid).zone,'monsters');assert.equal(e.destroy(f.uid,source(e)),false);assert.ok(r);
});
test('Farfa temporarily banishes and returns without a new Special Summon even after restore',()=>{
 let e=fresh();const f=put(e,0,'hand','Farfa, Malebranche of the Burning Abyss'),b=fieldCard(e,1,'Blue-Eyes White Dragon');trigger(e,()=>e.move(f.uid,'grave',{kind:'effect-send',source:source(e)}));assert.equal(e.find(b.uid).zone,'banished');e=DuelEngine.restore(e.snapshot());const count=e.state.players[1].turnStats.special;trigger(e,()=>e.emit({type:'end-phase',owner:0}));assert.equal(e.find(b.uid).zone,'monsters');assert.equal(e.state.players[1].turnStats.special,count);
});
test('Cir can revive Dante, and Dante returns another Burning Abyss after detaching',()=>{
 const e=fresh(),c=put(e,0,'hand','Cir, Malebranche of the Burning Abyss'),d=put(e,0,'grave','Dante, Traveler of the Burning Abyss',{properlySummoned:true});trigger(e,()=>e.move(c.uid,'grave',{kind:'cost-discard',source:source(e)}));assert.ok(['monsters','extraMonster'].includes(e.find(d.uid).zone));trigger(e,()=>e.move(d.uid,'grave',{kind:'effect-send',source:source(e)}));assert.equal(e.find(c.uid).zone,'hand');
});
test('Edea recruits Eidos, which grants exactly one additional Tribute Summon',()=>{
 const e=fresh(),a=put(e,0,'hand','Edea the Heavenly Squire'),b=put(e,0,'deck','Eidos the Underworld Squire'),m=put(e,0,'hand','Caius the Shadow Monarch');act(e,{type:'summon',uid:a.uid});drain(e);assert.equal(e.find(b.uid).zone,'monsters');assert.equal(e.canNormal(m,0),true);act(e,{type:'summon',uid:m.uid,tributes:[b.uid]});drain(e,p=>p.kind==='trigger'?{type:'pass'}:null);assert.equal(e.state.players[0].y15ExtraTributeUsed,e.state.turn);const second=put(e,0,'hand','Raiza the Storm Monarch');assert.equal(e.canNormal(second,0),false);
});
test('Pantheism sends its hand cost before drawing and lets the opponent choose a revealed card',()=>{
 const e=fresh(),s=put(e,0,'hand','Pantheism of the Monarchs'),cost=put(e,0,'hand','The Prime Monarch');use(e,s,'cast',{cost:[cost.uid]});assert.equal(e.find(cost.uid).zone,'grave');assert.equal(e.state.players[0].hand.length,2);const a=put(e,0,'deck','Domain of the True Monarchs'),b=put(e,0,'deck','Tenacity of the Monarchs'),c=put(e,0,'deck','The Monarchs Stormforth');act(e,{type:'activate',uid:s.uid,key:s.id+'::y15-search',choices:{cards:[a.uid,b.uid,c.uid]}});while(e.state.pending?.kind==='window')act(e,{type:'pass'});assert.equal(e.state.pending.owner,1);act(e,{type:'choose',uids:[b.uid]});drain(e);assert.equal(e.find(b.uid).zone,'hand');assert.equal(e.find(a.uid).zone,'deck');assert.equal(e.find(s.uid).zone,'banished');
});
test('Domain Extra Deck lock requires an empty Extra Deck and an exclusive Tribute Summoned board',()=>{
 const e=fresh(),s=put(e,0,'fieldSpell','Domain of the True Monarchs'),m=fieldCard(e,0,'Caius the Shadow Monarch',{normalSummoned:true,tributeCount:1}),f=put(e,1,'extra','Stardust Dragon');for(const q of [...e.state.players[0].extra])e.move(q.uid,'banished',{kind:'rule-fixture'});assert.equal(e.canSpecial(1,f,{via:'synchro'}),false);fieldCard(e,1,'Raiza the Storm Monarch',{normalSummoned:true,tributeCount:1});assert.equal(e.canSpecial(1,f,{via:'synchro'}),true);assert.ok(s&&m);
});
test('Prime Monarch revives as a Normal Monster and can be used as Tribute material',()=>{
 const e=fresh(),m=put(e,0,'grave','The Prime Monarch'),s=put(e,0,'grave','Pantheism of the Monarchs');use(e,m,'y15-revive',{cost:[s.uid]});assert.equal(e.find(m.uid).zone,'monsters');assert.equal(e.isNormalMonster(m),true);assert.equal(e.level(m),5);assert.equal(e.race(m),'天使族');assert.equal(e.attackValue(m),1000);assert.equal(e.canTribute(m,0),true);
});
