const test=require('node:test');
const {assert,D,E,put,fresh,fieldCard}=require('./gx-helpers.cjs');
const id=n=>D.cardByName(n).id;
function act(e,a){const r=e.act(a);assert.equal(r.ok,true,JSON.stringify(a)+' / '+r.error);}
function drain(e,pick){let n=0;while(e.state.pending&&e.state.winner===null&&n++<200){const p=e.state.pending;const a=pick?.(p,e)||(p.kind==='window'?{type:'pass'}:e.chooseAI(p));act(e,a);}assert.ok(n<200);e.assertState();}
const yes=p=>p.kind==='trigger'?{type:'respond',uid:p.trigger.uid,key:p.trigger.key}:null;
const opp={owner:1,id:id('Raigeki'),effectType:'spell'};
const onField=(e,m)=>['monsters','extraMonster'].includes(e.find(m.uid)?.zone);
test('Gogogo Goram changes its own position when Summoned',()=>{
 const e=fresh(),m=put(e,0,'hand','Gogogo Goram');act(e,{type:'summon',uid:m.uid,mode:'attack'});drain(e);assert.equal(m.position,'defense');
});
test('Dodododraw sends a Dododo monster to draw 2 once per turn',()=>{
 const e=fresh(),s=put(e,0,'hand','Dodododraw'),d=put(e,0,'hand','Dododo Driver'),h=e.state.players[0].hand.length;act(e,{type:'activate',uid:s.uid,key:s.id+'::cast',choices:{cost:[d.uid]}});drain(e);assert.equal(e.find(d.uid).zone,'grave');assert.equal(e.state.players[0].hand.length,h-2+2);
});
test('Scrap Factory powers Scrap monsters and replaces one destroyed by an effect',()=>{
 const e=fresh();put(e,0,'fieldSpell','Scrap Factory');const s=fieldCard(e,0,'Scrap Beast'),q=put(e,0,'deck','Scrap Golem');assert.equal(e.attackValue(s),D.CARDS[s.id].atk+200);
 e.destroy(s.uid,opp);e.pump();drain(e,p=>yes(p)||(p.kind==='choice'?{type:'choose',uids:[q.uid]}:null));assert.ok(onField(e,q));
});
test('Harpie Lady Phoenix Formation destroys and burns for the highest original ATK',()=>{
 const e=fresh();for(let i=0;i<3;i++)fieldCard(e,0,'Harpie Lady');const a=fieldCard(e,1,'Blue-Eyes White Dragon'),b=fieldCard(e,1,'Battle Ox'),s=put(e,0,'hand','Harpie Lady Phoenix Formation'),lp=e.state.players[1].lp;
 act(e,{type:'activate',uid:s.uid,key:s.id+'::cast',choices:{target:[a.uid,b.uid]}});drain(e);assert.equal(e.find(a.uid).zone,'grave');assert.equal(e.state.players[1].lp,lp-3000);assert.equal(e.state.players[0].skipBattleTurn,e.state.turn);
});
test('Batteryman 9-Volt searches, doubles itself and self-destructs in its End Phase',()=>{
 const e=fresh(),m=put(e,0,'hand','Batteryman 9-Volt'),q=put(e,0,'deck','Batteryman AA');act(e,{type:'summon',uid:m.uid,mode:'attack'});drain(e,p=>yes(p)||(p.kind==='choice'?{type:'choose',uids:[q.uid]}:null));
 assert.equal(e.find(q.uid).zone,'hand');assert.equal(e.attackValue(m),2000);act(e,{type:'end'});drain(e);assert.equal(e.find(m.uid).zone,'grave');
});
test('Masked HERO Koga gains 500 ATK per opposing monster',()=>{
 const e=fresh(),k=fieldCard(e,0,'Masked HERO Koga',{summonKind:'mask',properlySummoned:true});fieldCard(e,1,'Battle Ox');fieldCard(e,1,'Battle Ox');assert.equal(e.attackValue(k),2500+1000);
});
test('Contrast HERO Chaos also counts as LIGHT on the field',()=>{
 const e=fresh(),c=fieldCard(e,0,'Contrast HERO Chaos',{summonKind:'fusion',properlySummoned:true});assert.equal(e.hasAttribute(c,'光'),true);assert.equal(e.hasAttribute(c,'暗'),true);
});
test('Mask Change II sends a monster and summons a higher-Level Masked HERO of its Attribute',()=>{
 const e=fresh(),m=fieldCard(e,0,'Elemental HERO Avian'),x=put(e,0,'extra','Masked HERO Divine Wind'),s=put(e,0,'hand','Mask Change II'),d=put(e,0,'hand','Battle Ox');
 act(e,{type:'activate',uid:s.uid,key:s.id+'::cast',choices:{cost:[d.uid],target:[m.uid]}});drain(e,p=>p.kind==='choice'?{type:'choose',uids:[x.uid]}:null);assert.ok(onField(e,x));assert.equal(x.summonKind,'mask');
});
test('Stellarknight Constellar Diamond stops Deck-to-GY and banishes cards returning to hand while it has material',()=>{
 const e=fresh(),d=fieldCard(e,0,'Stellarknight Constellar Diamond',{summonKind:'xyz'});d.overlays.push(e.makeCard(id('Battle Ox'),0));e.state.originalCardCount=e.physicalCards().filter(c=>D.CARDS[c.id].type!=='token').length;
 const top=e.state.players[1].deck[0];e.move(top.uid,'grave',{kind:'effect-mill'});assert.equal(e.find(top.uid).zone,'deck');const g=put(e,1,'grave','Battle Ox');e.move(g.uid,'hand',{kind:'effect-return'});assert.equal(e.find(g.uid).zone,'banished');
});
test('Traptrix Dionaea ignores Hole Normal Traps',()=>{
 const e=fresh(),t=fieldCard(e,0,'Traptrix Dionaea');assert.equal(e.unaffected(t,{owner:1,id:id('Bottomless Trap Hole'),effectType:'trap'}),true);assert.ok(!e.unaffected(t,opp));
});
test('Deskbot 002 lends 500 ATK to your other Machines',()=>{
 const e=fresh();fieldCard(e,0,'Deskbot 002');const m=fieldCard(e,0,'Cyber Dragon');assert.equal(e.attackValue(m),2600);
});
test('Battleguard Rage returns monsters destroyed by its Warrior to the hand',()=>{
 const e=fresh(),w=fieldCard(e,0,'Celtic Guardian'),t=put(e,0,'spells','Battleguard Rage',{faceUp:false,setTurn:1}),foe=fieldCard(e,1,'Battle Ox',{position:'defense'});
 act(e,{type:'activate',uid:t.uid,key:t.id+'::cast',choices:{target:[w.uid]}});drain(e);assert.equal(e.attackValue(w),D.CARDS[w.id].atk+1000);e.state.phase='battle';act(e,{type:'attack',uid:w.uid,target:foe.uid});drain(e);assert.equal(e.find(foe.uid).zone,'hand');
});
test('Train Connection needs two Level 10 Machines to banish, doubles ATK and grounds other attackers',()=>{
 const e=fresh(),m=fieldCard(e,0,'Heavy Freight Train Derricrane'),o=fieldCard(e,0,'Battle Ox'),s=put(e,0,'hand','Train Connection');assert.ok(!E.available(e,0,{kind:'main'}).some(a=>a.uid===s.uid));
 const a=put(e,0,'grave','Heavy Freight Train Derricrane'),b=put(e,0,'grave','Heavy Freight Train Derricrane');act(e,{type:'activate',uid:s.uid,key:s.id+'::cast',choices:{target:[m.uid]}});drain(e);
 assert.equal(e.find(a.uid).zone,'banished');assert.equal(e.attackValue(m),5600);e.state.phase='battle';assert.equal(e.canAttack(o,0,null),false);
});
