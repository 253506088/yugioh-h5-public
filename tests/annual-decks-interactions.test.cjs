/* Historical strategies newly exposed by the five-build annual roster. */
const test=require('node:test');
const {assert,DuelEngine,put,fresh,fieldCard,act,drain,use}=require('./chronicle-2015-helpers.cjs');
const key=m=>m.id+'::era-effect';
test('Fortress offers no procedure when the only Machine is its own Level 7 card',()=>{
 const e=fresh(),m=put(e,0,'hand','Machina Fortress');put(e,0,'hand','Blue-Eyes White Dragon');
 assert.ok(!e.actionsFor(m.uid).some(a=>a.key===key(m)));
 assert.equal(e.act({type:'activate',uid:m.uid,key:key(m)}).ok,false);
 assert.equal(e.find(m.uid).zone,'hand');
});
test('Fortress AI selects a legal physical discard set and the procedure creates no Chain Link',()=>{
 const e=fresh(),m=put(e,0,'hand','Machina Fortress'),a=put(e,0,'hand','Green Gadget');
 act(e,{type:'activate',uid:m.uid,key:key(m)});const pick=e.chooseAI(e.state.pending);
 assert.deepEqual(new Set(pick.uids),new Set([m.uid,a.uid]));
 assert.equal(e.validatePick(e.state.pending,[m.uid]).valid,false);
 const restored=DuelEngine.restore(JSON.parse(JSON.stringify(e.snapshot())));
 for(const q of [e,restored]){act(q,pick);drain(q);}
 assert.deepEqual(restored.snapshot(),e.snapshot());assert.equal(e.find(m.uid).zone,'monsters');assert.equal(e.find(a.uid).zone,'grave');
 assert.equal(e.state.chainHistory.length,0);
});
test('Fortress can discard a single Level 8 Machine to return from the GY',()=>{
 const e=fresh(),m=put(e,0,'grave','Machina Fortress'),a=put(e,0,'hand','Machina Cannon');
 use(e,m,'era-effect',{cost:[a.uid]});assert.equal(e.find(m.uid).zone,'monsters');assert.equal(e.find(a.uid).zone,'grave');
});
function ehther(){const e=fresh(),m=put(e,0,'hand','Ehther the Heavenly Monarch'),tribute=fieldCard(e,0,'Caius the Mega Monarch',{normalSummoned:true,tributeCount:2}),a=put(e,0,'grave','The Monarchs Stormforth'),b=put(e,0,'grave','Domain of the True Monarchs');e.state.active=1;const spell=put(e,1,'hand','Pot of Greed');act(e,{type:'activate',uid:spell.uid,key:spell.id+'::cast'});assert.equal(e.state.pending.kind,'window');return {e,m,tribute,a,b};}
test('Ehther repeated legal activations consume two costs but summon the same physical card only once',()=>{
 const {e,m,tribute,a,b}=ehther(),response=cost=>({type:'respond',uid:m.uid,key:m.id+'::y15-opponent',choices:{cost:[cost.uid]}});
 act(e,response(a));act(e,response(b));
 assert.equal(e.state.chainHistory.filter(l=>l.key===m.id+'::y15-opponent').length,2);assert.equal(e.find(a.uid).zone,'banished');assert.equal(e.find(b.uid).zone,'banished');
 while(e.state.pending?.kind==='window')act(e,{type:'pass'});
 assert.equal(e.state.pending.operation,'y15-ehther-tribute');const restored=DuelEngine.restore(JSON.parse(JSON.stringify(e.snapshot())));
 for(const q of [e,restored])drain(q);
 assert.deepEqual(restored.snapshot(),e.snapshot());assert.equal(e.find(m.uid).zone,'monsters');assert.equal(e.find(tribute.uid).zone,'grave');
 assert.equal(e.state.active,1);assert.equal(e.state.summons[0],1);
});
test('Ehther does not try to summon after its available Tribute leaves during the Chain',()=>{
 const {e,m,tribute,a}=ehther();act(e,{type:'respond',uid:m.uid,key:m.id+'::y15-opponent',choices:{cost:[a.uid]}});
 e.move(tribute.uid,'grave',{kind:'effect-send'});drain(e);assert.equal(e.find(m.uid).zone,'hand');assert.equal(e.state.summons[0],0);
});
test('Ehther does not summon a hand entity that left and returned before resolution',()=>{
 const {e,m,a}=ehther();act(e,{type:'respond',uid:m.uid,key:m.id+'::y15-opponent',choices:{cost:[a.uid]}});
 e.move(m.uid,'grave',{kind:'effect-send'});e.move(m.uid,'hand',{kind:'effect-return'});drain(e);assert.equal(e.find(m.uid).zone,'hand');assert.equal(e.state.summons[0],0);
});
