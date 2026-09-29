const test=require('node:test');
const {assert,D,E,DuelEngine,put,fresh,fieldCard,act,drain,use,trigger,source}=require('./chronicle-2015-helpers.cjs');
const pick=m=>p=>p.kind==='choice'&&p.candidates.some(c=>c.uid===m.uid)?{type:'choose',uids:[m.uid]}:null;
test('2016 presets preserve actual main/extra/side quantities and contain no future or pending cards',()=>{
 const data=require('../data/decks-2016.json'),K=require('../src/deck-tools.js');assert.equal(data.decks.length,3);
 for(const [i,row] of data.decks.entries()){const d=D.DECKS[row.id];assert.ok(K.analyze(d).valid);assert.equal(d.cards.length,[42,41,41][i]);assert.equal(d.extra.length,15);assert.equal(row.side.reduce((n,x)=>n+x[1],0),15);for(const id of [...d.cards,...d.extra]){assert.ok(D.CARDS[id].releaseYear<=2016);assert.notEqual(D.CARDS[id].implementationStatus,'pending',D.CARDS[id].officialName);}}
});
test('a single Ratpier overlays into each different Zoodiac only once per turn',()=>{
 const e=fresh(),r=fieldCard(e,0,'Zoodiac Ratpier'),a=put(e,0,'extra','Zoodiac Broadbull'),b=put(e,0,'extra','Zoodiac Drident'),again=put(e,0,'extra','Zoodiac Broadbull');
 act(e,{type:'extra-summon',uid:a.uid,materials:[r.uid]});drain(e);assert.equal(a.overlays.length,1);assert.equal(e.attackValue(a),0);act(e,{type:'extra-summon',uid:b.uid,materials:[a.uid]});drain(e);assert.equal(b.overlays.length,2);assert.equal(e.xyzValid(0,again,[b],true),false);
});
test('Ratpier grants its summon to a real Beast-Warrior Xyz and detaches a real material',()=>{
 const e=fresh(),x=fieldCard(e,0,'Zoodiac Broadbull'),r=put(e,0,'grave','Zoodiac Ratpier'),n=put(e,0,'deck','Zoodiac Ratpier');e.attach(x.uid,r.uid,source(e));use(e,x,'y16-ratpier',{},pick(n));assert.equal(e.find(r.uid).zone,'grave');assert.equal(e.find(n.uid).zone,'monsters');assert.equal(x.overlays.length,0);assert.equal(E.available(e,0,{kind:'main'}).some(a=>a.uid===x.uid&&a.key.endsWith('y16-ratpier')),false);
});
test('Whiptail adds its printed stats to Drident then Drident pays the material to destroy',()=>{
 const e=fresh(),x=fieldCard(e,0,'Zoodiac Drident'),w=put(e,0,'hand','Zoodiac Whiptail'),b=fieldCard(e,1,'Blue-Eyes White Dragon');use(e,w,'y16-attach',{target:[x.uid]});assert.equal(e.attackValue(x),1200);assert.equal(e.defenseValue(x),400);use(e,x,'y16-destroy',{cost:[w.uid],target:[b.uid]});assert.equal(e.find(w.uid).zone,'grave');assert.equal(e.find(b.uid).zone,'grave');assert.equal(e.attackValue(x),0);
});
test('Barrage can destroy itself and recruit before becoming a material on another Zoodiac',()=>{
 const e=fresh(),s=put(e,0,'spells','Zoodiac Barrage'),x=fieldCard(e,0,'Zoodiac Drident'),r=put(e,0,'deck','Zoodiac Ratpier');use(e,s,'y16-recruit',{target:[s.uid]},pick(r));assert.equal(e.find(r.uid).zone,'monsters');assert.equal(e.find(s.uid).zone,'overlays');assert.ok(x.overlays.some(m=>m.uid===s.uid));
});
test('Combo attaches a card directly from the Deck without fabricating a graveyard event',()=>{
 const e=fresh(),s=put(e,0,'spells','Zoodiac Combo',{faceUp:false}),x=fieldCard(e,0,'Zoodiac Drident'),r=put(e,0,'deck','Zoodiac Whiptail');use(e,s,'cast',{target:[x.uid]},pick(r));assert.equal(e.find(r.uid).zone,'overlays');assert.equal(r.earlySent,undefined);assert.equal(e.attackValue(x),1200);e.assertState();
});
test('Cosmic Cyclone pays exactly 1000 LP and banishes rather than destroys',()=>{
 const e=fresh(),s=put(e,0,'hand','Cosmic Cyclone'),t=put(e,1,'spells','Mirror Force',{faceUp:false}),lp=e.state.players[0].lp;use(e,s,'cast',{target:[t.uid]});assert.equal(e.state.players[0].lp,lp-1000);assert.equal(e.find(t.uid).zone,'banished');
});
test('Desires banishes ten face-down as cost and draws two',()=>{
 const e=fresh(),s=put(e,0,'hand','Pot of Desires'),cards=e.state.players[0].deck.slice(0,10);use(e,s);assert.equal(e.state.players[0].hand.length,2);for(const m of cards){assert.equal(e.find(m.uid).zone,'banished');assert.equal(m.faceUp,false);}assert.equal(e.state.players[0].banished.length,10);
});
test('Dimensional Barrier survives restore, stops Xyz and negates the chosen type for both players',()=>{
 let e=fresh();const s=put(e,0,'spells','Dimensional Barrier',{faceUp:false}),x=fieldCard(e,1,'Zoodiac Drident'),y=put(e,0,'extra','Zoodiac Broadbull');use(e,s,'cast',{type:['xyz']});e=DuelEngine.restore(e.snapshot());assert.equal(e.negated(e.find(x.uid).card),true);assert.equal(e.canSpecial(0,e.find(y.uid).card,{via:'xyz'}),false);e.state.turn++;assert.equal(e.negated(e.find(x.uid).card),false);assert.equal(e.canSpecial(0,e.find(y.uid).card,{via:'xyz'}),true);
});
test('Foolish Burial Goods sends only a Spell/Trap and liberation replaces that effect',()=>{
 const e=fresh(),s=put(e,0,'hand','Foolish Burial Goods'),t=put(e,0,'deck','Zoodiac Combo');e.state.ruleMode={id:'liberation',version:1,players:[{},{}]};use(e,s,'cast',{},pick(t));assert.equal(e.find(t.uid).zone,'banished');
});
test('Snow pays seven cards then flips an opponent monster after revival',()=>{
 const e=fresh(),s=put(e,0,'grave','Fairy Tail - Snow'),t=fieldCard(e,1,'Blue-Eyes White Dragon'),cost=Array.from({length:7},()=>put(e,0,'grave','Battle Ox'));use(e,s,'y16-revive',{cost:cost.map(m=>m.uid)});assert.equal(e.find(s.uid).zone,'monsters');assert.equal(t.faceUp,false);assert.equal(e.state.players[0].banished.length,7);
});
test('Ultimate Providence discards the matching kind before negating',()=>{
 const e=fresh(),s=put(e,1,'spells','Ultimate Providence',{faceUp:false}),cost=put(e,1,'hand','Mystical Space Typhoon'),p=put(e,0,'hand','Pot of Greed');act(e,{type:'activate',uid:p.uid,key:p.id+'::cast'});act(e,{type:'respond',uid:s.uid,key:s.id+'::cast',choices:{cost:[cost.uid]}});drain(e);assert.equal(e.state.players[0].hand.length,0);assert.equal(e.find(cost.uid).zone,'grave');
});
test('Whiptail banishes a battle-losing victim before a field-to-grave trigger can fire',()=>{
 const e=fresh(),x=fieldCard(e,0,'Zoodiac Drident'),w=put(e,0,'grave','Zoodiac Whiptail'),s=fieldCard(e,1,'Sangan');e.attach(x.uid,w.uid,source(e));e.state.phase='battle';act(e,{type:'attack',uid:x.uid,target:s.uid});drain(e);assert.equal(e.find(s.uid).zone,'banished');assert.equal(e.state.players[1].hand.length,0);
});
test('Whiptail AI declines chaining the same unresolved attachment repeatedly',()=>{
 const e=fresh(),w=put(e,0,'hand','Zoodiac Whiptail'),key=w.id+'::y16-attach',c=e.abilityContext(w.uid,key,'window');assert.equal(E.get(key).aiResponse(e,c),600);e.state.chain.push({uid:w.uid,key});assert.equal(E.get(key).aiResponse(e,c),0);
});
test('Dark Matter cannot offer a three-different-name cost when the deck has only two names',()=>{
 const e=fresh(),x=fieldCard(e,0,'Number 95: Galaxy-Eyes Dark Matter Dragon');for(const m of [...e.state.players[0].deck])e.move(m.uid,'banished',{kind:'rule-fixture'});put(e,0,'deck','Blue-Eyes Alternative White Dragon');put(e,0,'deck','Blue-Eyes Alternative White Dragon');put(e,0,'deck','The White Stone of Ancients');const c=e.abilityContext(x.uid,x.id+'::y15-send','trigger');assert.equal(E.canUse(e,c),false);
});
test('AI selects distinct identities for a satisfiable different-name input',()=>{
 const e=fresh(),x=fieldCard(e,0,'Number 95: Galaxy-Eyes Dark Matter Dragon'),a=put(e,0,'deck','Blue-Eyes Alternative White Dragon'),b=put(e,0,'deck','Blue-Eyes Alternative White Dragon'),c=put(e,0,'deck','The White Stone of Ancients'),d=put(e,0,'deck','Dragon Spirit of White'),ctx=e.abilityContext(x.uid,x.id+'::y15-send','trigger');const p={kind:'input',owner:0,responder:0,uid:x.uid,ctx,cancelable:true,group:{key:'cost',min:3,max:3,role:'cost',validator:'early-y15-different',candidates:[a,b,c,d].map(m=>e.option(m))}};const action=e.chooseAI(p);assert.equal(new Set(action.uids.map(u=>e.find(u).card.id)).size,3);
});
test('Winda permits several monsters in one Pendulum Summon and then blocks the next summon',()=>{
 const e=fresh();fieldCard(e,1,'El Shaddoll Winda');put(e,0,'spells','Qliphort Scout',{slot:0});put(e,0,'spells','Qliphort Monolith',{slot:4});const a=put(e,0,'hand','Qliphort Helix'),b=put(e,0,'hand','Qliphort Disk');act(e,{type:'pendulum-summon',uids:[a.uid,b.uid]});drain(e);assert.equal(e.state.players[0].turnStats.special,1);assert.equal(e.find(a.uid).zone,'monsters');assert.equal(e.find(b.uid).zone,'monsters');const c=put(e,0,'hand','Qliphort Helix');assert.equal(e.canSpecial(0,c,{via:'effect'}),false);
});
