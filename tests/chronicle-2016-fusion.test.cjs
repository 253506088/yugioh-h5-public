const test=require('node:test');
const {assert,D,E,DuelEngine,fresh,put,fieldCard,act,drain,use,trigger,source}=require('./chronicle-2015-helpers.cjs');
const fm=(e,m)=>['monsters','extraMonster'].includes(e.find(m.uid)?.zone);
const materials=us=>p=>p.purpose==='fusion'?{type:'choose',uids:us}:null;
test('Metalfoes scale destroys a real face-up card then sets a Metalfoes Spell from deck',()=>{
 const e=fresh(),s=put(e,0,'spells','Metalfoes Silverd'),m=fieldCard(e,0,'Metalfoes Goldriver'),f=put(e,0,'deck','Metalfoes Fusion');use(e,s,'y16-set',{target:[m.uid]});assert.equal(e.find(m.uid).zone,'extra');assert.equal(e.find(f.uid).zone,'spells');assert.equal(f.faceUp,false);assert.equal(f.setTurn,e.state.turn);
});
test('Metalfoes does not set a card if destruction is prevented',()=>{
 const e=fresh(),s=put(e,0,'spells','Metalfoes Silverd'),m=fieldCard(e,0,'Marshmallon'),f=put(e,0,'deck','Metalfoes Fusion');m.era2014Immune=e.state.turn;use(e,s,'y16-set',{target:[m.uid]});assert.ok(fm(e,m));assert.equal(e.find(f.uid).zone,'deck');
});
test('Metalfoes Fusion uses hand and field material, and grave recycling happens on resolution',()=>{
 const e=fresh(),s=put(e,0,'hand','Metalfoes Fusion'),a=put(e,0,'hand','Metalfoes Goldriver'),b=fieldCard(e,0,'Metalfoes Silverd'),f=put(e,0,'extra','Metalfoes Mithrilium');use(e,s,'cast',{},materials([a.uid,b.uid]));assert.ok(fm(e,f));assert.equal(e.find(a.uid).zone,'grave');assert.equal(e.find(b.uid).zone,'extra');const h=e.state.players[0].hand.length;use(e,s,'y16-recycle');assert.equal(e.state.players[0].hand.length,h+1);assert.ok(['deck','hand'].includes(e.find(s.uid).zone));
});
test('Mithrilium must return both grave targets before bouncing the field target',()=>{
 const e=fresh(),s=fieldCard(e,0,'Metalfoes Mithrilium'),a=put(e,0,'grave','Metalfoes Goldriver'),b=put(e,0,'grave','Metalfoes Silverd'),t=fieldCard(e,1,'Blue-Eyes White Dragon');use(e,s,'y16-return',{recover:[a.uid,b.uid],target:[t.uid]});assert.equal(e.find(a.uid).zone,'deck');assert.equal(e.find(b.uid).zone,'deck');assert.equal(e.find(t.uid).zone,'hand');
});
test('Bismugear schedules its search in either End Phase and preserves it through restore',()=>{
 let e=fresh();const s=fieldCard(e,0,'Raremetalfoes Bismugear'),m=put(e,0,'deck','Metalfoes Volflame');trigger(e,()=>e.destroy(s.uid,source(e)));assert.equal(e.find(m.uid).zone,'deck');e=DuelEngine.restore(e.snapshot());e.state.active=1;trigger(e,()=>e.emit({type:'end-phase',owner:1}));assert.equal(e.find(m.uid).zone,'hand');
});
test('Metamorformation protects Normal Metalfoes only while a Metalfoes scale is active',()=>{
 const e=fresh(),f=put(e,0,'fieldSpell','Metamorformation'),s=put(e,0,'spells','Metalfoes Silverd'),m=fieldCard(e,0,'Metalfoes Goldriver'),n=fieldCard(e,0,'Raremetalfoes Bismugear');assert.equal(e.attackValue(m),2200);assert.equal(e.unaffected(m,source(e)),true);assert.equal(e.unaffected(n,source(e)),false);e.move(s.uid,'grave',{kind:'rule-send'});assert.equal(e.unaffected(m,source(e)),false);
});
test('Alkahest equipment grants original ATK as DEF and is material only for Metalfoes',()=>{
 const e=fresh(),s=fieldCard(e,0,'Fullmetalfoes Alkahest'),m=fieldCard(e,1,'Aleister the Invoker'),a=put(e,0,'hand','Metalfoes Goldriver'),f=put(e,0,'extra','Metalfoes Mithrilium'),c=put(e,0,'extra','Invoked Caliga');e.state.active=1;const p=put(e,1,'hand','Pot of Greed');act(e,{type:'activate',uid:p.uid,key:p.id+'::cast'});act(e,{type:'respond',uid:s.uid,key:s.id+'::y16-equip',choices:{target:[m.uid]}});drain(e);assert.equal(e.find(m.uid).zone,'spells');assert.equal(e.defenseValue(s),1000);assert.equal(e.fusionPool(0).some(q=>q.uid===m.uid),true);assert.equal(e.fusionValid(0,c,[m,s],'polymerization'),false);assert.equal(e.fusionValid(0,f,[a,s],'polymerization'),true);
});
test('Invocation sends hand material but banishes opponent grave material and restores its recycling',()=>{
 let e=fresh();const s=put(e,0,'hand','Invocation'),a=put(e,0,'hand','Aleister the Invoker'),b=put(e,1,'grave','Blue-Eyes White Dragon'),f=put(e,0,'extra','Invoked Mechaba');use(e,s,'cast',{},materials([a.uid,b.uid]));assert.ok(fm(e,f));assert.equal(e.find(a.uid).zone,'grave');assert.equal(e.find(b.uid).zone,'banished');assert.equal(e.find(b.uid).owner,1);e.move(a.uid,'banished',{kind:'effect-banish',source:source(e)});e=DuelEngine.restore(e.snapshot());use(e,e.find(s.uid).card,'y16-recycle',{target:[a.uid]});assert.equal(e.find(s.uid).zone,'deck');assert.equal(e.find(a.uid).zone,'hand');
});
test('Invocation banishes field materials and cannot use grave materials for non-Invoked fusions',()=>{
 const e=fresh(),a=fieldCard(e,0,'Aleister the Invoker'),b=put(e,0,'grave','Blue-Eyes White Dragon'),f=put(e,0,'extra','Invoked Mechaba'),s=put(e,0,'hand','Invocation');use(e,s,'cast',{},materials([a.uid,b.uid]));assert.equal(e.find(a.uid).zone,'banished');assert.equal(e.find(b.uid).zone,'banished');const twin=put(e,0,'extra','Blue-Eyes Twin Burst Dragon'),b1=put(e,0,'hand','Blue-Eyes White Dragon'),b2=put(e,0,'grave','Blue-Eyes White Dragon');assert.equal(e.fusionValid(0,twin,[b1,b2],{year2016:'invocation',zones:['hand','grave']}),false);
});
test('Invocation material validation refuses Iron Wall before consuming any material',()=>{
 const e=fresh(),a=put(e,0,'hand','Aleister the Invoker'),b=put(e,1,'grave','Blue-Eyes White Dragon'),f=put(e,0,'extra','Invoked Mechaba'),s=put(e,0,'hand','Invocation');put(e,1,'spells','Imperial Iron Wall');assert.equal(E.available(e,0,{kind:'main'}).some(x=>x.uid===s.uid),false);assert.equal(e.find(a.uid).zone,'hand');assert.equal(e.find(b.uid).zone,'grave');
});
test('Mechaba sends the matching card type as cost then negates and banishes',()=>{
 const e=fresh(),m=fieldCard(e,1,'Invoked Mechaba'),cost=put(e,1,'hand','Pot of Greed'),s=put(e,0,'hand','Raigeki');act(e,{type:'activate',uid:s.uid,key:s.id+'::cast'});act(e,{type:'respond',uid:m.uid,key:m.id+'::y16-negate',choices:{cost:[cost.uid]}});drain(e);assert.equal(e.find(s.uid).zone,'banished');assert.equal(e.find(cost.uid).zone,'grave');assert.equal(cost.earlySent.kind,'cost-send');assert.ok(fm(e,m));
});
test('Mechaba cannot pay a send-to-grave cost under liberation',()=>{
 const e=fresh(),m=fieldCard(e,1,'Invoked Mechaba'),cost=put(e,1,'hand','Pot of Greed'),s=put(e,0,'hand','Pot of Greed');e.state.ruleMode={id:'liberation',version:1,players:[{},{}]};act(e,{type:'activate',uid:s.uid,key:s.id+'::cast'});assert.equal(e.state.pending?.options?.some(x=>x.uid===m.uid)||false,false);assert.equal(e.find(cost.uid).zone,'hand');
});
test('Aleister search and hand boost change both stats and expire next turn',()=>{
 const e=fresh(),a=put(e,0,'hand','Aleister the Invoker'),s=put(e,0,'deck','Invocation');act(e,{type:'summon',uid:a.uid});drain(e);assert.equal(e.find(s.uid).zone,'hand');e.move(a.uid,'hand',{kind:'effect-return',source:source(e)});const f=fieldCard(e,0,'Invoked Mechaba');use(e,a,'y16-boost',{target:[f.uid]});assert.equal(e.attackValue(f),3500);assert.equal(e.defenseValue(f),3100);e.state.turn++;assert.equal(e.attackValue(f),2500);
});
test('Elysium snapshots all six attributes before banishing itself',()=>{
 const e=fresh(),s=fieldCard(e,0,'Invoked Elysium'),a=fieldCard(e,1,'Dark Magician'),b=fieldCard(e,1,'Blue-Eyes White Dragon');use(e,s,'y16-banish',{target:[s.uid]});for(const m of [s,a,b])assert.equal(e.find(m.uid).zone,'banished');assert.equal(e.hasAttribute(s,'暗'),false);
});
test('Caliga counts earlier monster effects and retains the count through save restore',()=>{
 let e=fresh();const a=fieldCard(e,0,'Invoked Raidjin'),t=fieldCard(e,1,'Blue-Eyes White Dragon');use(e,a,'y16-set',{target:[t.uid]});fieldCard(e,0,'Invoked Caliga');const b=fieldCard(e,0,'Invoked Elysium');e=DuelEngine.restore(e.snapshot());assert.equal(E.available(e,0,{kind:'main'}).some(x=>x.uid===b.uid),false);e.state.turn++;assert.equal(E.available(e,0,{kind:'main'}).some(x=>x.uid===b.uid),true);
});
test('Caliga allows one monster effect before locking the next activation',()=>{
 const e=fresh(),s=fieldCard(e,0,'Invoked Caliga'),a=fieldCard(e,0,'Invoked Raidjin'),t=fieldCard(e,1,'Blue-Eyes White Dragon');use(e,a,'y16-set',{target:[t.uid]});assert.equal(t.faceUp,false);const b=fieldCard(e,0,'Invoked Elysium');assert.equal(E.available(e,0,{kind:'main'}).some(x=>x.uid===b.uid),false);
});
test('Book of the Law tributes and performs a proper Fusion Summon of another original Attribute',()=>{
 const e=fresh(),s=put(e,0,'hand','The Book of the Law'),a=fieldCard(e,0,'Invoked Caliga'),b=put(e,0,'extra','Invoked Mechaba');use(e,s,'cast',{cost:[a.uid]});assert.equal(e.find(a.uid).zone,'grave');assert.ok(fm(e,b));assert.equal(b.summonKind,'fusion');assert.equal(b.properlySummoned,true);
});
test('Magical Meltdown prevents activation negation of Invocation while preserving its material choice',()=>{
 const e=fresh();put(e,0,'fieldSpell','Magical Meltdown');const s=put(e,0,'hand','Invocation'),a=put(e,0,'hand','Aleister the Invoker'),b=put(e,0,'hand','Blue-Eyes White Dragon'),f=put(e,0,'extra','Invoked Mechaba'),t=put(e,1,'spells','Solemn Judgment',{faceUp:false,setTurn:0});act(e,{type:'activate',uid:s.uid,key:s.id+'::cast'});const l=e.state.chain.find(l=>l.uid===s.uid);assert.ok(l);assert.equal(e.negateLink(l.id,{id:t.id,uid:t.uid,owner:1,effectType:'trap'},true,false),false);drain(e,materials([a.uid,b.uid]));assert.ok(fm(e,f));
});
