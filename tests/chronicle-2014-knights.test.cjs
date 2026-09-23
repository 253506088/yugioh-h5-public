const test=require('node:test');
const {assert,D,E,put,fresh,fieldCard}=require('./gx-helpers.cjs');
const id=n=>D.cardByName(n).id;
function act(e,a){const r=e.act(a);assert.equal(r.ok,true,JSON.stringify(a)+' / '+r.error);}
function drain(e,pick){let n=0;while(e.state.pending&&e.state.winner===null&&n++<200){const p=e.state.pending;const a=pick?.(p,e)||(p.kind==='window'?{type:'pass'}:e.chooseAI(p));act(e,a);}assert.ok(n<200);e.assertState();}
const yes=p=>p.kind==='trigger'?{type:'respond',uid:p.trigger.uid,key:p.trigger.key}:null;
const opp={owner:1,id:id('Raigeki'),effectType:'spell'};
const onField=(e,m)=>['monsters','extraMonster'].includes(e.find(m.uid)?.zone);
const xyz=(e,p,n,matNames,props={})=>{const m=fieldCard(e,p,n,{summonKind:'xyz',properlySummoned:true,...props});for(const k of matNames)m.overlays.push(e.makeCard(id(k),p));e.state.originalCardCount=e.physicalCards().filter(c=>D.CARDS[c.id].type!=='token').length;return m;};
test('Ghostrick monsters need a Ghostrick to be Normal Summoned',()=>{
 const e=fresh(),w=put(e,0,'hand','Ghostrick Warwolf');assert.equal(e.canNormal(w,0),false);fieldCard(e,0,'Ghostrick Yeti');assert.equal(e.canNormal(w,0),true);
});
test('Ghostrick Warwolf burns 100 per Set card when flipped',()=>{
 const e=fresh(),w=fieldCard(e,0,'Ghostrick Warwolf',{faceUp:false,position:'defense'});put(e,1,'spells','Mirror Force',{faceUp:false});put(e,0,'spells','Mirror Force',{faceUp:false});const lp=e.state.players[1].lp;
 e.flipFaceUp(w.uid,{position:'attack'});e.pump();drain(e,yes);assert.equal(e.state.players[1].lp,lp-200);
});
test('Ghostrick Parade stops attacks on face-down monsters and shields its controller',()=>{
 const e=fresh();put(e,0,'fieldSpell','Ghostrick Parade');const d=fieldCard(e,0,'Ghostrick Yeti',{faceUp:false,position:'defense'}),a=fieldCard(e,1,'Blue-Eyes White Dragon');
 assert.equal(e.canAttack(a,1,d.uid),false);const lp=e.state.players[1].lp;e.damage(1,500,'效果');assert.equal(e.state.players[1].lp,lp);
});
test('Number 79: Nova Kaiser attaches a Boxer and gains 100 ATK per material',()=>{
 const e=fresh(),k=xyz(e,0,"Number 79: Battlin' Boxer Nova Kaiser",['Battle Ox','Battle Ox']),b=put(e,0,'grave',"Battlin' Boxer Veil");
 act(e,{type:'activate',uid:k.uid,key:k.id+'::era2014-attach',choices:{target:[b.uid]}});drain(e);assert.equal(k.overlays.length,3);assert.equal(e.attackValue(k),2300+300);
});
test('Battlin\' Boxer Veil answers battle damage from the hand and recovers it',()=>{
 const e=fresh(),v=put(e,0,'hand',"Battlin' Boxer Veil"),a=fieldCard(e,1,'Blue-Eyes White Dragon'),lp=e.state.players[0].lp;
 e.state.active=1;e.state.phase='battle';act(e,{type:'attack',uid:a.uid});drain(e,yes);assert.ok(onField(e,v));assert.equal(e.state.players[0].lp,lp);
});
test('Number C15 destroys an opposing monster and burns its original ATK',()=>{
 const e=fresh(),g=xyz(e,0,'Number C15: Gimmick Puppet Giant Hunter',['Battle Ox','Battle Ox','Battle Ox']),foe=fieldCard(e,1,'Blue-Eyes White Dragon'),lp=e.state.players[1].lp;
 act(e,{type:'activate',uid:g.uid,key:g.id+'::era2014-destroy',choices:{cost:[g.overlays[0].uid],target:[foe.uid]}});drain(e);assert.equal(e.find(foe.uid).zone,'grave');assert.equal(e.state.players[1].lp,lp-3000);
});
test('Number C88 wins at the End Phase with no materials against 2000 or less LP',()=>{
 const e=fresh();xyz(e,0,'Number C88: Gimmick Puppet Disaster Leo',[]);e.state.players[1].lp=1500;act(e,{type:'end'});drain(e);assert.equal(e.state.winner,0);
});
test('Number 86 gains protections as materials stack',()=>{
 const e=fresh(),m=xyz(e,0,'Number 86: Heroic Champion - Rhongomyniad',['Battle Ox','Battle Ox','Battle Ox','Battle Ox']);assert.equal(e.attackValue(m),3000);assert.equal(e.unaffected(m,opp),true);
 const x=put(e,1,'hand','Battle Ox');assert.equal(e.canNormal(x,1),false);
});
test('Frightfur Tiger destroys up to its material count and powers Frightfurs',()=>{
 const e=fresh(),t=fieldCard(e,0,'Frightfur Tiger',{summonKind:'fusion',properlySummoned:true,materialCount:2});fieldCard(e,0,'Fluffal Dog');assert.equal(e.attackValue(t),1900+600);
});
test('Frightfur Wolf attacks once per Fusion Material',()=>{
 const e=fresh(),w=fieldCard(e,0,'Frightfur Wolf',{summonKind:'fusion',properlySummoned:true,materialCount:3});assert.equal(e.attackAllowance(w),3);
});
test('Noble Knight Borz becomes DARK and Level 5 while equipped with Noble Arms',()=>{
 const e=fresh(),b=fieldCard(e,0,'Noble Knight Borz'),a=put(e,0,'spells','Noble Arms - Gallatin',{faceUp:true,equipTarget:null});a.equipTarget=b.uid;assert.equal(e.attribute(b),'暗');assert.equal(e.level(b),5);
});
test('Noble Knight Drystan protects weaker Noble Knights from attacks',()=>{
 const e=fresh();fieldCard(e,0,'Noble Knight Drystan');const w=fieldCard(e,0,'Noble Knight Borz'),a=fieldCard(e,1,'Blue-Eyes White Dragon');assert.equal(e.canAttack(a,1,w.uid),false);
});
test('Raidraptor - Force Strix gains 500 per other Winged Beast and searches',()=>{
 const e=fresh(),f=xyz(e,0,'Raidraptor - Force Strix',['Battle Ox','Battle Ox']);fieldCard(e,0,'Raidraptor - Vanishing Lanius');assert.equal(e.attackValue(f),600);
});
test('Raidraptor - Readiness stops battle destruction of Raidraptors this turn',()=>{
 const e=fresh(),t=put(e,0,'spells','Raidraptor - Readiness',{faceUp:false,setTurn:1}),r=fieldCard(e,0,'Raidraptor - Vanishing Lanius');act(e,{type:'activate',uid:t.uid,key:t.id+'::cast'});drain(e);assert.equal(e.destroy(r.uid,opp,true),false);
});
test('Madolche Anjelly returns to the Deck when destroyed by the opponent',()=>{
 const e=fresh(),m=fieldCard(e,0,'Madolche Anjelly');e.destroy(m.uid,opp);e.pump();drain(e);assert.equal(e.find(m.uid).zone,'deck');
});
