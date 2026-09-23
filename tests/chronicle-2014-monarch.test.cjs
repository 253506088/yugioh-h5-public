const test=require('node:test');
const {assert,D,E,put,fresh,fieldCard}=require('./gx-helpers.cjs');
const id=n=>D.cardByName(n).id;
function act(e,a){const r=e.act(a);assert.equal(r.ok,true,JSON.stringify(a)+' / '+r.error);}
function drain(e,pick){let n=0;while(e.state.pending&&e.state.winner===null&&n++<200){const p=e.state.pending;const a=pick?.(p,e)||(p.kind==='window'?{type:'pass'}:e.chooseAI(p));act(e,a);}assert.ok(n<200);e.assertState();}
const yes=p=>p.kind==='trigger'?{type:'respond',uid:p.trigger.uid,key:p.trigger.key}:null;
const opp={owner:1,id:id('Raigeki'),effectType:'spell'};
const onField=(e,m)=>['monsters','extraMonster'].includes(e.find(m.uid)?.zone);
test('Artifacts can be Set as Spells and rise when destroyed on the opponent turn',()=>{
 const e=fresh(),a=put(e,0,'hand','Artifact Moralltach');act(e,{type:'activate',uid:a.uid,key:a.id+'::era2014-set-spell'});drain(e);const f=e.find(a.uid);assert.equal(f.zone,'spells');assert.equal(a.faceUp,false);
 const foe=fieldCard(e,1,'Blue-Eyes White Dragon');e.state.active=1;e.destroy(a.uid,{owner:1,id:id('Mystical Space Typhoon'),effectType:'spell'});e.pump();drain(e,p=>yes(p)||(p.kind==='input'?{type:'choose',uids:[foe.uid]}:null));
 assert.ok(onField(e,a));assert.equal(e.find(foe.uid).zone,'grave');
});
test('A Mega Monarch can be Tribute Summoned with one Tribute Summoned monster',()=>{
 const e=fresh(),base=fieldCard(e,0,'Battle Ox',{normalSummoned:true,summonKind:'normal',tributeCount:1}),m=put(e,0,'hand','Caius the Mega Monarch');assert.ok(e.tributeSets(m,false,0).some(s=>s.length===1&&s[0]===base.uid));
});
test('Caius banishes a card and burns 1000 on Tribute Summon',()=>{
 const e=fresh(),a=fieldCard(e,0,'Battle Ox'),b=fieldCard(e,0,'Battle Ox'),m=put(e,0,'hand','Caius the Mega Monarch'),foe=fieldCard(e,1,'Blue-Eyes White Dragon'),lp=e.state.players[1].lp;
 act(e,{type:'summon',uid:m.uid,mode:'attack',tributes:[a.uid,b.uid]});drain(e,p=>yes(p)||(p.kind==='input'?{type:'choose',uids:[foe.uid]}:null));assert.equal(e.find(foe.uid).zone,'banished');assert.equal(e.state.players[1].lp,lp-1000);
});
test('Infernoid procedure banishes Infernoids and respects the Level-8 ceiling',()=>{
 const e=fresh(),h=put(e,0,'hand','Infernoid Harmadik'),g=put(e,0,'grave','Infernoid Antra');act(e,{type:'activate',uid:h.uid,key:h.id+'::era2014-proc',choices:{cost:[g.uid]}});drain(e);
 assert.ok(onField(e,h));assert.equal(e.find(g.uid).zone,'banished');const x=put(e,0,'hand','Infernoid Patrulea');put(e,0,'grave','Infernoid Antra');fieldCard(e,0,'Cyber Dragon');fieldCard(e,0,'Cyber Dragon');assert.ok(!E.available(e,0,{kind:'main'}).some(a=>a.uid===x.uid&&a.key.endsWith('era2014-proc')));
});
test('Majesty\'s Fiend stops all monster effect activations',()=>{
 const e=fresh();fieldCard(e,1,"Majesty's Fiend");const g=fieldCard(e,0,'Golden Dragon Summoner');fieldCard(e,0,'Battle Ox');assert.ok(!E.available(e,0,{kind:'main'}).some(a=>a.uid===g.uid));
});
test('The Monarchs Erupt negates non-Tribute-Summoned face-up monsters',()=>{
 const e=fresh();put(e,0,'spells','The Monarchs Erupt',{faceUp:true});const t=fieldCard(e,0,'Caius the Mega Monarch',{normalSummoned:true,tributeCount:2}),o=fieldCard(e,1,'Cyber Dragon');assert.equal(e.negated(o),true);assert.equal(e.negated(t),false);
});
test('Sylvan Lotuswain excavates and mills Plant monsters',()=>{
 const e=fresh(),s=fieldCard(e,0,'Sylvan Lotuswain');fieldCard(e,1,'Battle Ox');const p=put(e,0,'deck','Sylvan Mikorange');const d=e.state.players[0].deck;d.splice(d.indexOf(p),1);d.unshift(p);
 act(e,{type:'activate',uid:s.uid,key:s.id+'::era2014-excavate'});drain(e);assert.equal(e.find(p.uid).zone,'grave');
});
test('Terratiger summons a Level 4 or lower Normal Monster in Defense Position',()=>{
 const e=fresh(),t=put(e,0,'hand','Terratiger, the Empowered Warrior'),n=put(e,0,'hand','Battle Ox');act(e,{type:'summon',uid:t.uid,mode:'attack'});drain(e,p=>yes(p)||(p.kind==='choice'?{type:'choose',uids:[n.uid]}:null));assert.ok(onField(e,n));assert.equal(n.position,'defense');
});
test('Ventdra attacks directly while monsters guard the opponent',()=>{
 const e=fresh(),v=fieldCard(e,0,'Ventdra, the Empowered Warrior');fieldCard(e,1,'Blue-Eyes White Dragon');e.state.phase='main1';act(e,{type:'phase',phase:'battle'});drain(e);const lp=e.state.players[1].lp;act(e,{type:'attack',uid:v.uid});drain(e);assert.equal(e.state.players[1].lp,lp-2000);
});
test('Void Expansion makes an Infernoid Token in the Standby Phase',()=>{
 const e=fresh();put(e,0,'fieldSpell','Void Expansion');act(e,{type:'end'});drain(e);e.state.frame=null;act(e,{type:'end'});drain(e,yes);assert.ok(e.monsters(0).some(m=>m.id==='era2014-infernoid-token'));
});
test('Artifact Sanctum summons an Artifact and skips the Battle Phase',()=>{
 const e=fresh(),t=put(e,0,'spells','Artifact Sanctum',{faceUp:false,setTurn:1}),a=put(e,0,'deck','Artifact Moralltach');act(e,{type:'activate',uid:t.uid,key:t.id+'::cast'});drain(e,p=>p.kind==='choice'?{type:'choose',uids:[a.uid]}:null);assert.ok(onField(e,a));assert.equal(e.state.players[0].skipBattleTurn,e.state.turn);
});
