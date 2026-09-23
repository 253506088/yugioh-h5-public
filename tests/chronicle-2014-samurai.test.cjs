const test=require('node:test');
const {assert,D,E,put,fresh,fieldCard}=require('./gx-helpers.cjs');
const id=n=>D.cardByName(n).id;
function act(e,a){const r=e.act(a);assert.equal(r.ok,true,JSON.stringify(a)+' / '+r.error);}
function drain(e,pick){let n=0;while(e.state.pending&&e.state.winner===null&&n++<200){const p=e.state.pending;const a=pick?.(p,e)||(p.kind==='window'?{type:'pass'}:e.chooseAI(p));act(e,a);}assert.ok(n<200);e.assertState();}
const yes=p=>p.kind==='trigger'?{type:'respond',uid:p.trigger.uid,key:p.trigger.key}:null;
const opp={owner:1,id:id('Raigeki'),effectType:'spell'};
const onField=(e,m)=>['monsters','extraMonster'].includes(e.find(m.uid)?.zone);
test('Superheavy Samurai attack from Defense Position using DEF while Big Benkei is present',()=>{
 const e=fresh();fieldCard(e,0,'Superheavy Samurai Big Benkei',{position:'defense'});const s=fieldCard(e,0,'Superheavy Samurai Blue Brawler',{position:'defense'}),foe=fieldCard(e,1,'Battle Ox');
 e.state.phase='battle';assert.equal(e.canAttack(s,0,foe.uid),true);act(e,{type:'attack',uid:s.uid,target:foe.uid});drain(e);assert.equal(e.find(foe.uid).zone,'grave');assert.equal(s.position,'defense');
});
test('Superheavy Samurai Blue Brawler cannot be destroyed by battle',()=>{
 const e=fresh(),s=fieldCard(e,0,'Superheavy Samurai Blue Brawler');assert.equal(e.destroy(s.uid,opp,true),false);
});
test('Soulbreaker Armor lowers DEF by 1000 and grants battle protection',()=>{
 const e=fresh(),s=fieldCard(e,0,'Superheavy Samurai Big Benkei'),a=put(e,0,'hand','Superheavy Samurai Soulbreaker Armor');act(e,{type:'activate',uid:a.uid,key:a.id+'::era2014-equip',choices:{target:[s.uid]}});drain(e);
 assert.equal(e.defenseValue(s),2500);assert.equal(e.destroy(s.uid,opp,true),false);
});
test('Superheavy Samurai Trumpeter needs an empty Spell/Trap Graveyard',()=>{
 const e=fresh(),t=put(e,0,'hand','Superheavy Samurai Trumpeter');const avail=()=>E.available(e,0,{kind:'main'}).some(a=>a.uid===t.uid);const ok=avail();put(e,0,'grave','Pot of Greed');assert.equal(ok,true);assert.equal(avail(),false);
});
test('Ritual Beast Ulti monsters are contact-fused by banishing a Tamer and a Spiritual Beast',()=>{
 const e=fresh(),a=fieldCard(e,0,'Ritual Beast Tamer Wen'),b=fieldCard(e,0,'Spiritual Beast Apelio'),x=put(e,0,'extra','Ritual Beast Ulti-Apelio');
 act(e,{type:'activate',uid:x.uid,key:x.id+'::gx-contact',choices:{materials:['0']}});drain(e);assert.ok(onField(e,x));assert.equal(e.find(a.uid).zone,'banished');assert.equal(e.find(b.uid).zone,'banished');
});
test('Spiritual Beasts can each be Special Summoned only once per turn',()=>{
 const e=fresh(),a=put(e,0,'hand','Spiritual Beast Apelio'),b=put(e,0,'hand','Spiritual Beast Apelio');e.special(0,a.uid,{via:'effect'});assert.equal(e.canSpecial(0,b,{via:'effect'}),false);
});
test('Ritual Beast Tamer Elder grants an extra Normal Summon of a Ritual Beast',()=>{
 const e=fresh(),el=put(e,0,'hand','Ritual Beast Tamer Elder'),w=put(e,0,'hand','Ritual Beast Tamer Wen'),ox=put(e,0,'hand','Battle Ox');act(e,{type:'summon',uid:el.uid,mode:'attack'});drain(e,yes);
 assert.equal(e.canNormal(w,0),true);assert.equal(e.canNormal(ox,0),false);act(e,{type:'summon',uid:w.uid,mode:'attack'});drain(e);assert.ok(onField(e,w));
});
test('Yosenju Kama 1 returns to the hand in the End Phase of its Normal Summon',()=>{
 const e=fresh(),k=put(e,0,'hand','Yosenju Kama 1');act(e,{type:'summon',uid:k.uid,mode:'attack'});drain(e);act(e,{type:'end'});drain(e);assert.equal(e.find(k.uid).zone,'hand');
});
test("Yosenjus' Secret Move negates when only Yosenju monsters are face-up",()=>{
 const e=fresh();fieldCard(e,0,'Yosenju Kama 2');const t=put(e,0,'spells',"Yosenjus' Secret Move",{faceUp:false,setTurn:1}),p=put(e,1,'hand','Pot of Greed');e.state.active=1;
 act(e,{type:'activate',uid:p.uid,key:p.id+'::cast'});drain(e,p2=>p2.kind==='window'&&p2.options.some(o=>o.uid===t.uid)?{type:'respond',uid:t.uid,key:t.id+'::cast'}:null);assert.equal(e.find(p.uid).zone,'grave');
});
test('Beelze of the Diabolic Dragons is indestructible and grows with the damage you take',()=>{
 const e=fresh(),b=fieldCard(e,0,'Beelze of the Diabolic Dragons',{summonKind:'synchro',properlySummoned:true});assert.equal(e.destroy(b.uid,opp),false);
});
test('Angel of Zera gains 100 ATK per opposing banished card',()=>{
 const e=fresh(),z=fieldCard(e,0,'Angel of Zera',{summonKind:'synchro',properlySummoned:true});put(e,1,'banished','Battle Ox');put(e,1,'banished','Battle Ox');assert.equal(e.attackValue(z),3000);
});
test('First of the Dragons ignores other monster effects',()=>{
 const e=fresh(),f=fieldCard(e,0,'First of the Dragons',{summonKind:'fusion',properlySummoned:true});assert.equal(e.unaffected(f,{owner:1,id:id('Cyber Dragon'),uid:'x',effectType:'monster'}),true);
});
test('Ultimaya Tzolkin is always Level 12',()=>{
 const e=fresh(),t=fieldCard(e,0,'Ultimaya Tzolkin',{summonKind:'tzolkin',properlySummoned:true});assert.equal(e.level(t),12);
});
