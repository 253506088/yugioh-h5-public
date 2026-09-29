const test=require('node:test');
const {assert,D,E,DuelEngine,put,fresh,fieldCard,act,drain,use,trigger,source}=require('./chronicle-2015-helpers.cjs');
test('a Kaiju tributes the actual opponent monster and does not consume a Normal Summon',()=>{
 const e=fresh(),s=put(e,0,'hand','Gameciel, the Sea Turtle Kaiju'),t=fieldCard(e,1,'Blue-Eyes White Dragon');use(e,s,'y16-kaiju-opponent',{cost:[t.uid]});assert.equal(e.find(t.uid).zone,'grave');assert.equal(t.earlySent.kind,'cost-tribute');assert.equal(e.find(s.uid).owner,1);assert.equal(s.originalOwner,0);assert.equal(e.state.normalUsed,false);
});
test('an opponent Kaiju allows our Kaiju but never a second face-up Kaiju on that side',()=>{
 const e=fresh(),a=fieldCard(e,1,'Gameciel, the Sea Turtle Kaiju'),s=put(e,0,'hand','Dogoran, the Mad Flame Kaiju');use(e,s,'gx-special');const b=put(e,0,'hand','Radian, the Multidimensional Kaiju');assert.equal(e.canSpecial(0,b,{via:'effect'}),false);assert.ok(a);
 const p=fresh();put(p,0,'spells','Dragonpulse Magician',{slot:0});put(p,0,'spells','Dragonpit Magician',{slot:4,pendulumScaleOverride:{value:10,until:null}});const x=put(p,0,'hand','Gameciel, the Sea Turtle Kaiju'),y=put(p,0,'hand','Dogoran, the Mad Flame Kaiju');assert.equal(p.pendulumValid(0,[x.uid]),true);assert.equal(p.pendulumValid(0,[x.uid,y.uid]),false);
});
test('Kaiju counters can be paid from both players and Gameciel banishes the negated spell',()=>{
 const e=fresh(),g=fieldCard(e,1,'Gameciel, the Sea Turtle Kaiju'),a=put(e,0,'fieldSpell','Kyoutou Waterfront',{y16KaijuCounters:1}),b=put(e,1,'spells','The Kaiju Files',{y16KaijuCounters:1}),s=put(e,0,'hand','Pot of Greed');act(e,{type:'activate',uid:s.uid,key:s.id+'::cast'});act(e,{type:'respond',uid:g.uid,key:g.id+'::y16-negate',choices:{counters:[a.uid+'#0',b.uid+'#0']}});drain(e);assert.equal(e.find(s.uid).zone,'banished');assert.equal(a.y16KaijuCounters,0);assert.equal(b.y16KaijuCounters,0);assert.equal(e.state.players[0].hand.length,0);
});
test('Waterfront increments only for field-to-grave moves and spends a counter to protect itself',()=>{
 const e=fresh(),s=put(e,0,'fieldSpell','Kyoutou Waterfront'),m=fieldCard(e,0,'Battle Ox'),h=put(e,0,'hand','Battle Ox');trigger(e,()=>e.move(m.uid,'grave',{kind:'effect-send',source:source(e)}));assert.equal(s.y16KaijuCounters,1);trigger(e,()=>e.move(h.uid,'grave',{kind:'effect-send',source:source(e)}));assert.equal(s.y16KaijuCounters,1);assert.equal(e.destroy(s.uid,source(e)),false);assert.equal(s.y16KaijuCounters,0);
});
test('Slumber destroys first and summons two different physical Kaiju to opposite sides',()=>{
 const e=fresh(),s=put(e,0,'hand','Interrupted Kaiju Slumber'),a=put(e,0,'deck','Gameciel, the Sea Turtle Kaiju'),b=put(e,0,'deck','Dogoran, the Mad Flame Kaiju'),t=fieldCard(e,1,'Blue-Eyes White Dragon');use(e,s,'cast',{},p=>p.kind==='choice'&&p.operation==='y16-kaiju-slumber'?{type:'choose',uids:[a.uid,b.uid]}:null);assert.equal(e.find(t.uid).zone,'grave');assert.equal(e.find(a.uid).owner,1);assert.equal(e.find(b.uid).owner,0);assert.equal(e.positionLocked(a),true);e.assertState();
});
test('Chaos Form banishes a named graveyard monster as exact-level ritual material',()=>{
 const e=fresh(),s=put(e,0,'hand','Chaos Form'),b=put(e,0,'hand','Blue-Eyes Chaos MAX Dragon'),m=put(e,0,'grave','Blue-Eyes White Dragon');assert.equal(e.ritualValid(0,b,[m],s.id),true);use(e,s,'cast',{},p=>p.kind==='materials'?{type:'choose',uids:[m.uid]}:null);assert.equal(e.find(m.uid).zone,'banished');assert.equal(e.find(b.uid).zone,'monsters');assert.equal(b.summonKind,'ritual');assert.equal(b.properlySummoned,true);
});
test('Machine Angel Absolute Ritual shuffles a Fairy from the graveyard and tributes a hand monster',()=>{
 const e=fresh(),s=put(e,0,'hand','Machine Angel Absolute Ritual'),b=put(e,0,'hand','Cyber Angel Benten'),a=put(e,0,'grave','Mystical Shine Ball'),c=put(e,0,'hand','Battle Ox');assert.equal(e.ritualValid(0,b,[a,c],s.id),true);trigger(e,()=>e.performRitual(0,b.uid,[a.uid,c.uid],s.id,source(e,'Machine Angel Absolute Ritual',0)));assert.equal(e.find(a.uid).zone,'deck');assert.equal(e.find(c.uid).zone,'grave');assert.equal(e.find(b.uid).zone,'monsters');
});
test('Super Soldier Synthesis requires one LIGHT and one DARK, from different hand/deck zones',()=>{
 const e=fresh(),s=put(e,0,'hand','Super Soldier Synthesis'),b=put(e,0,'grave','Black Luster Soldier'),a=put(e,0,'hand','Alexandrite Dragon'),c=put(e,0,'deck','Dark Grepher'),bad=put(e,0,'hand','Dark Grepher');assert.equal(e.ritualValid(0,b,[a,c],s.id),true);assert.equal(e.ritualValid(0,b,[a,bad],s.id),false);trigger(e,()=>e.performRitual(0,b.uid,[a.uid,c.uid],s.id,source(e,'Super Soldier Synthesis',0)));assert.equal(e.find(b.uid).zone,'monsters');assert.equal(a.earlySent.kind,'effect-ritual-material');assert.equal(c.earlySent.kind,'effect-ritual-material');
});
test('generic shared procedures never mark unauthored 2016 Spirit, Gemini or Pendulum effects complete',()=>{
 for(const name of ['Amaterasu','Chemicritter Oxy Ox','Shinobird Crow','Astrograph Sorcerer'])assert.equal(D.cardByName(name).implementationStatus,'pending',name);
});
test('Graceful Tear transfers the physical hand card through the move API and heals its player',()=>{const e=fresh(),s=put(e,0,'spells','Graceful Tear',{faceUp:false}),m=put(e,0,'hand','Battle Ox'),lp=e.state.players[0].lp;use(e,s,'cast',{target:[m.uid]});assert.equal(e.find(m.uid).owner,1);assert.equal(m.originalOwner,0);assert.equal(e.state.players[0].lp,lp+2000);e.assertState();});
test('Lost Wind halves original ATK while retaining an external equip bonus, and resets face-down',()=>{const e=fresh(),s=put(e,0,'spells','Lost Wind',{faceUp:false}),m=fieldCard(e,1,'Blue-Eyes White Dragon',{summonKind:'effect'});put(e,1,'spells','Axe of Despair',{equipTarget:m.uid});assert.equal(e.attackValue(m),4000);use(e,s,'cast',{target:[m.uid]});assert.equal(e.originalAttack(m),1500);assert.equal(e.attackValue(m),2500);e.setPosition(m.uid,'defense',source(e),true);assert.equal(e.originalAttack(m),3000);});
