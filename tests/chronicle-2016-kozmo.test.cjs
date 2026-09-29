const test=require('node:test');
const {assert,D,E,DuelEngine,fresh,put,fieldCard,act,drain,use,trigger,source}=require('./chronicle-2015-helpers.cjs');
const fm=(e,m)=>['monsters','extraMonster'].includes(e.find(m.uid)?.zone);
test('Kozmo pilot banishes itself as cost then summons a higher-Level ship from hand',()=>{
 const e=fresh(),s=fieldCard(e,0,'Kozmo Tincan'),m=put(e,0,'hand','Kozmo Forerunner');use(e,s,'y16-tag');assert.equal(e.find(s.uid).zone,'banished');assert.ok(fm(e,m));assert.equal(e.canTarget(m,source(e)),false);
});
test('Kozmo ships recruit by banishing themselves after destruction, not after tribute',()=>{
 for(const destroyed of [false,true]){const e=fresh(),s=fieldCard(e,0,'Kozmo Forerunner'),m=put(e,0,'deck','Kozmo Farmgirl');trigger(e,()=>destroyed?e.destroy(s.uid,source(e)):e.move(s.uid,'grave',{kind:'cost-tribute'}));assert.equal(e.find(s.uid).zone,destroyed?'banished':'grave');assert.equal(fm(e,m),destroyed);}
});
test('Kozmo Dark Destroyer destroys its actual target and Cannot Be Targeted does not prevent global removal',()=>{
 const e=fresh(),s=put(e,0,'hand','Kozmo Dark Destroyer'),m=fieldCard(e,1,'Blue-Eyes White Dragon');trigger(e,()=>e.special(0,s.uid,{via:'effect'}));assert.equal(e.find(m.uid).zone,'grave');assert.equal(e.canTarget(s,source(e)),false);assert.equal(e.destroy(s.uid,source(e)),true);
});
test('Kozmo Strawman revives negated and its delayed destruction survives JSON',()=>{
 let e=fresh();const s=fieldCard(e,0,'Kozmo Strawman'),m=put(e,0,'banished','Kozmo Forerunner');use(e,s,'y16-revive',{target:[m.uid]});assert.ok(fm(e,m));assert.equal(e.negated(m),true);e=DuelEngine.restore(e.snapshot());trigger(e,()=>e.emit({type:'end-phase',owner:0}));assert.equal(fm(e,m),false);
});
test('Kozmotown loss of LP can be lethal and is neither damage nor payment',()=>{
 const e=fresh(),s=put(e,0,'fieldSpell','Kozmotown'),m=put(e,0,'banished','Kozmo Forerunner');e.state.players[0].lp=300;use(e,s,'y16-recover',{target:[m.uid]});assert.equal(e.find(m.uid).zone,'hand');assert.equal(e.state.players[0].lp,0);assert.equal(e.state.winner,1);
});
test('Kozmotown redraws exactly the number of physical Kozmo cards shuffled',()=>{
 const e=fresh(),s=put(e,0,'fieldSpell','Kozmotown'),a=put(e,0,'hand','Kozmo Tincan'),b=put(e,0,'hand','Kozmo Farmgirl'),other=put(e,0,'hand','Battle Ox');use(e,s,'y16-redraw',{cards:[a.uid,b.uid]});assert.equal(e.state.players[0].hand.length,3);assert.equal(e.find(other.uid).zone,'hand');
});
test('Dark Planet validates total material Levels, pays all real banishes and cannot be revived',()=>{
 const e=fresh(),s=put(e,0,'hand','Kozmo Dark Planet'),a=put(e,0,'hand','Kozmo Forerunner'),b=put(e,0,'hand','Kozmo Farmgirl');const before=e.snapshot();const bad=e.act({type:'activate',uid:s.uid,key:s.id+'::y16-special',choices:{cost:[a.uid]}});assert.equal(bad.ok,false);assert.deepEqual(e.snapshot(),before);use(e,s,'y16-special',{cost:[a.uid,b.uid]});assert.ok(fm(e,s));assert.equal(e.find(a.uid).zone,'banished');assert.equal(e.find(b.uid).zone,'banished');e.move(s.uid,'grave',{kind:'rule-send'});assert.equal(e.canSpecial(0,s,{via:'revive'}),false);
});
test('Dark Eclipser negates a Trap activation and actually banishes its grave cost',()=>{
 const e=fresh(),s=fieldCard(e,1,'Kozmo Dark Eclipser'),cost=put(e,1,'grave','Kozmo Farmgirl'),trap=put(e,0,'spells','Jar of Greed',{faceUp:false});act(e,{type:'activate',uid:trap.uid,key:trap.id+'::cast'});act(e,{type:'respond',uid:s.uid,key:s.id+'::y16-negate',choices:{cost:[cost.uid]}});drain(e);assert.equal(e.find(cost.uid).zone,'banished');assert.equal(e.find(trap.uid).zone,'grave');assert.equal(e.state.players[0].hand.length,0);
});
test('DOG Fighter creates a correctly identified non-Kozmo token in either Standby Phase',()=>{
 const e=fresh(),s=fieldCard(e,0,'Kozmo DOG Fighter');e.state.active=1;trigger(e,()=>e.emit({type:'standby',owner:1}));const m=e.monsters(0).find(m=>m.id==='y16-dog-token');assert.ok(m);assert.equal(e.level(m),6);assert.equal(e.attackValue(m),2000);assert.equal(e.defenseValue(m),2400);assert.deepEqual(D.CARDS[m.id].setcodes,[]);assert.equal(D.CARDS[m.id].setcodeSourceId,29491335);assert.equal(D.inArchetype(m,'Kozmo'),false);
});
test('Kozmo Tincan chooses among three distinct names with deterministic save-and-replay randomness',()=>{
 let e=fresh();const s=fieldCard(e,0,'Kozmo Tincan'),ms=['Kozmojo','Kozmo Forerunner','Kozmo Sliprider'].map(n=>put(e,0,'deck',n));e.state.active=1;e.emit({type:'end-phase',owner:1});e.pump();const copy=DuelEngine.restore(e.snapshot()),pick=p=>p.kind==='input'&&p.group.key==='cards'?{type:'choose',uids:ms.map(m=>m.uid)}:null;drain(e,pick);drain(copy,pick);assert.deepEqual(copy.snapshot(),e.snapshot());assert.equal(ms.filter(m=>e.find(m.uid).zone==='hand').length,1);assert.equal(ms.filter(m=>e.find(m.uid).zone==='grave').length,2);
});
test('Kozmojo uses destruction then non-targeting banishment and also triggers the destroyed ship',()=>{
 const e=fresh(),s=put(e,0,'spells','Kozmojo',{faceUp:false}),m=fieldCard(e,0,'Kozmo Forerunner'),t=fieldCard(e,1,'Kozmo Dark Destroyer');use(e,s,'cast',{target:[m.uid]},p=>p.kind==='choice'&&p.candidates.some(o=>o.uid===t.uid)?{type:'choose',uids:[t.uid]}:null);assert.equal(e.find(t.uid).zone,'banished');assert.equal(e.find(m.uid).zone,'banished');
});
test('Kozmourning shuffles the actual battle victim and changes only the first later battle damage into healing',()=>{
 const e=fresh(),s=put(e,0,'spells','Kozmourning'),a=fieldCard(e,0,'Kozmo Forerunner'),b=fieldCard(e,1,'Battle Ox');e.state.phase='battle';act(e,{type:'attack',uid:a.uid,target:b.uid});drain(e);assert.equal(e.find(b.uid).zone,'deck');e.move(s.uid,'grave',{kind:'effect-send'});e.state.phase='main1';use(e,s,'y16-heal');const lp=e.state.players[0].lp;e.state.frame={kind:'attack',attack:{uid:a.uid,owner:0,target:null,preventDamageFor:[]}};e.damage(0,700,'战斗');assert.equal(e.state.players[0].lp,lp+700);e.damage(0,700,'战斗');assert.equal(e.state.players[0].lp,lp);
});
test('Kozmo Lightsword has real equip stats and permits two monster attacks',()=>{
 const e=fresh(),s=put(e,0,'hand','Kozmo Lightsword'),m=fieldCard(e,0,'Kozmo Farmgirl');use(e,s,'cast',{target:[m.uid]});assert.equal(e.attackValue(m),2000);assert.equal(e.defenseValue(m),1500);assert.equal(e.attackAllowance(m),2);m.attacksMade=1;assert.equal(e.canAttack(m,0,null),false);
});
