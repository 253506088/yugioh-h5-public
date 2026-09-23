const test=require('node:test');
const {assert,D,E,put,fresh,fieldCard}=require('./gx-helpers.cjs');
const id=n=>D.cardByName(n).id;
function act(e,a){const r=e.act(a);assert.equal(r.ok,true,JSON.stringify(a)+' / '+r.error);}
function drain(e,pick){let n=0;while(e.state.pending&&e.state.winner===null&&n++<200){const p=e.state.pending;const a=pick?.(p,e)||(p.kind==='window'?{type:'pass'}:e.chooseAI(p));act(e,a);}assert.ok(n<200);e.assertState();}
const yes=p=>p.kind==='trigger'?{type:'respond',uid:p.trigger.uid,key:p.trigger.key}:null;
const opp={owner:1,id:id('Raigeki'),effectType:'spell'};
const onField=(e,m)=>['monsters','extraMonster'].includes(e.find(m.uid)?.zone);
const scale=(e,p,n,slot)=>put(e,p,'spells',n,{faceUp:true,slot});
test('Pendulum Effects apply only from a Pendulum Zone',()=>{
 const e=fresh(),ox=fieldCard(e,0,'Performapal Silver Claw');assert.equal(e.attackValue(ox),1800);scale(e,0,'Performapal Silver Claw',0);assert.equal(e.attackValue(ox),2100);
});
test('Performapal Kaleidoscorp scale powers LIGHT monsters you control',()=>{
 const e=fresh(),m=fieldCard(e,0,'Mystical Elf');scale(e,0,'Performapal Kaleidoscorp',4);assert.equal(e.attackValue(m),800+300);
});
test('D/D Savant Kepler locks Pendulum Summons to D/D monsters',()=>{
 const e=fresh();scale(e,0,'D/D Savant Kepler',0);const x=put(e,0,'hand','Battle Ox'),d=put(e,0,'hand','D/D Lilith');assert.equal(e.canSpecial(0,x,{via:'pendulum'}),false);assert.equal(e.canSpecial(0,d,{via:'pendulum'}),true);
});
test('D/D Proud Ogre falls to Scale 5 without another D/D Scale',()=>{
 const e=fresh(),o=scale(e,0,'D/D Proud Ogre',0);assert.equal(e.pendulumScale(o),5);scale(e,0,'D/D Savant Galilei',4);assert.equal(e.pendulumScale(o),8);
});
test('Dark Contract with the Gate searches a D/D monster and burns its owner in the Standby Phase',()=>{
 const e=fresh(),g=put(e,0,'spells','Dark Contract with the Gate',{faceUp:true}),q=put(e,0,'deck','D/D Lilith');act(e,{type:'activate',uid:g.uid,key:g.id+'::era2014-search'});drain(e,p=>p.kind==='choice'?{type:'choose',uids:[q.uid]}:null);assert.equal(e.find(q.uid).zone,'hand');
 const lp=e.state.players[0].lp;act(e,{type:'end'});drain(e);e.state.frame=null;act(e,{type:'end'});drain(e,yes);assert.equal(e.state.players[0].lp,lp-1000);
});
test('Odd-Eyes Pendulum Dragon doubles its battle damage',()=>{
 const e=fresh(),o=fieldCard(e,0,'Odd-Eyes Pendulum Dragon'),foe=fieldCard(e,1,'Battle Ox'),lp=e.state.players[1].lp;e.state.phase='battle';act(e,{type:'attack',uid:o.uid,target:foe.uid});drain(e);assert.equal(e.state.players[1].lp,lp-1600);
});
test('D/D/D Rebel King Leonidas on the field prevents effect damage',()=>{
 const e=fresh();fieldCard(e,0,'D/D/D Rebel King Leonidas');const lp=e.state.players[0].lp;e.damage(0,1000,'效果');assert.equal(e.state.players[0].lp,lp);
});
test('Yosenju Shinchu R stops attacks on other face-up Yosenju',()=>{
 const e=fresh();fieldCard(e,0,'Yosenju Shinchu R',{position:'defense'});const k=fieldCard(e,0,'Yosenju Kama 1'),a=fieldCard(e,1,'Blue-Eyes White Dragon');assert.equal(e.canAttack(a,1,k.uid),false);
});
test('Yosenju Shinchu L scale is destroyed instead of a Yosenju monster',()=>{
 const e=fresh(),l=scale(e,0,'Yosenju Shinchu L',0),k=fieldCard(e,0,'Yosenju Kama 1');assert.equal(e.destroy(k.uid,opp),false);assert.ok(onField(e,k));assert.notEqual(e.find(l.uid).zone,'spells');
});
test('Aria keeps Melodious monsters from battle destruction while Special Summoned',()=>{
 const e=fresh();fieldCard(e,0,'Aria the Melodious Diva',{summonKind:'special'});const s=fieldCard(e,0,'Sonata the Melodious Diva');assert.equal(e.destroy(s.uid,opp,true),false);assert.equal(e.canTarget(s,opp),false);
});
test('Performapal Sword Fish shrinks opposing monsters when Summoned',()=>{
 const e=fresh(),foe=fieldCard(e,1,'Blue-Eyes White Dragon'),s=put(e,0,'hand','Performapal Sword Fish');act(e,{type:'summon',uid:s.uid,mode:'attack'});drain(e);assert.equal(e.attackValue(foe),2400);
});
test('Performapal Partnaga grounds Level 5 or lower monsters',()=>{
 const e=fresh();fieldCard(e,0,'Performapal Partnaga',{position:'defense'});const a=fieldCard(e,1,'Battle Ox');assert.equal(e.canAttack(a,1,null),false);
});
test('Crystal Master stops the opponent targeting Crystal Beasts',()=>{
 const e=fresh();scale(e,0,'Crystal Master',0);const c=fieldCard(e,0,'Crystal Beast Sapphire Pegasus');assert.equal(e.canTarget(c,opp),false);
});
test('A Pendulum Monster activated from the hand becomes a Pendulum Scale',()=>{
 const e=fresh(),p=put(e,0,'hand','Performapal Silver Claw');act(e,{type:'pendulum-scale',uid:p.uid,slot:0});drain(e);assert.equal(e.isPendulumScale(p),true);assert.equal(e.pendulumScale(p),5);
});
