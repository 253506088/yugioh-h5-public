const test=require('node:test');
const {assert,D,E,DuelEngine,put,fresh,fieldCard,act,drain,use,trigger,source}=require('./chronicle-2015-helpers.cjs');
const scale=(e,n,slot)=>put(e,0,'spells',n,{slot});
test('Igknights destroy both scales and find a FIRE Warrior from the deck',()=>{
 const e=fresh(),a=scale(e,'Igknight Squire',0),b=scale(e,'Igknight Paladin',4),q=put(e,0,'deck','Igknight Templar');use(e,a,'y15-igknight');assert.equal(e.find(a.uid).zone,'extra');assert.equal(e.find(b.uid).zone,'extra');assert.equal(e.find(q.uid).zone,'hand');
});
test('Dinomist Charge searches, then recovers a Dinomist destroyed into face-up Extra',()=>{
 const e=fresh(),s=put(e,0,'hand','Dinomist Charge'),q=put(e,0,'deck','Dinomist Brachion');use(e,s);assert.equal(e.find(q.uid).zone,'hand');const m=fieldCard(e,0,'Dinomist Plesios');trigger(e,()=>e.destroy(m.uid,source(e)));assert.equal(e.find(m.uid).zone,'hand');
});
test('Deskbot 005 destruction as a scale revives a Deskbot and preserves the Pendulum source',()=>{
 const e=fresh(),m=scale(e,'Deskbot 005',0),q=put(e,0,'grave','Deskbot 002');trigger(e,()=>e.destroy(m.uid,source(e)));assert.equal(e.find(m.uid).zone,'extra');assert.equal(e.find(q.uid).zone,'monsters');
});
test('Zefra scale restrictions require all active scales to permit the Pendulum candidate',()=>{
 const e=fresh();scale(e,'Zefraxa, Flame Beast of the Nekroz',0);scale(e,'Shaddoll Zefracore',4);const z=put(e,0,'hand','Zefraxi, Treasure of the Yang Zing'),n=put(e,0,'hand','Shurit, Strategist of the Nekroz');assert.equal(e.canSpecial(0,z,{via:'pendulum'}),true);assert.equal(e.canSpecial(0,n,{via:'pendulum'}),false);assert.equal(e.canSpecial(0,n,{via:'effect'}),true);
});
test('Zefraniu search survives destruction into the face-up Extra Deck',()=>{
 const e=fresh(),m=fieldCard(e,0,'Zefraniu, Secret of the Yang Zing'),q=put(e,0,'deck','Zefra Divine Strike');trigger(e,()=>e.destroy(m.uid,source(e)));assert.equal(e.find(m.uid).zone,'extra');assert.equal(e.find(q.uid).zone,'hand');
});
test('Zefrasaber pays its own Tribute separately from exact Nekroz Ritual materials',()=>{
 const e=fresh(),s=put(e,0,'hand','Zefrasaber, Swordmaster of the Nekroz'),r=put(e,0,'hand','Nekroz of Unicore'),m=put(e,0,'hand','Battle Ox');use(e,s,'y15-ritual');assert.equal(e.find(s.uid).zone,'grave');assert.equal(e.find(m.uid).zone,'grave');assert.equal(e.find(r.uid).zone,'monsters');assert.equal(r.summonKind,'ritual');
});
test('Swirl Slime hand Fusion and Necro Slime grave Fusion consume the specified source card',()=>{
 const e=fresh(),s=put(e,0,'hand','D/D Swirl Slime'),n=put(e,0,'hand','D/D Necro Slime'),f=put(e,0,'extra',"D/D/D Oracle King d'Arc");use(e,s,'y15-fusion');assert.equal(e.find(s.uid).zone,'grave');assert.equal(e.find(n.uid).zone,'grave');assert.ok(['monsters','extraMonster'].includes(e.find(f.uid).zone));const f2=put(e,0,'extra','D/D/D Flame King Genghis');use(e,n,'y15-fusion');assert.equal(e.find(s.uid).zone,'banished');assert.equal(e.find(n.uid).zone,'banished');assert.ok(['monsters','extraMonster'].includes(e.find(f2.uid).zone));
});
test('D/D Lamia pays a real grave cost and is banished when leaving',()=>{
 const e=fresh(),m=put(e,0,'hand','D/D Lamia'),s=put(e,0,'hand','Dark Contract with the Gate');use(e,m,'y15-special',{cost:[s.uid]});assert.equal(e.find(s.uid).zone,'grave');assert.equal(e.find(m.uid).zone,'monsters');e.move(m.uid,'grave',{kind:'synchro-material'});assert.equal(e.find(m.uid).zone,'banished');
});
test('d’Arc converts effect damage to recovery while preserving battle damage',()=>{
 const e=fresh();fieldCard(e,0,"D/D/D Oracle King d'Arc");const lp=e.state.players[0].lp;e.damage(0,1000,'效果',source(e));assert.equal(e.state.players[0].lp,lp+1000);e.damage(0,500,'战斗',source(e));assert.equal(e.state.players[0].lp,lp+500);
});
test('Silent Boots grave search banishes itself and finds Phantom Knights traps',()=>{
 const e=fresh(),m=put(e,0,'grave','The Phantom Knights of Silent Boots'),s=put(e,0,'deck',"Phantom Knights' Fog Blade");use(e,m,'y15-search');assert.equal(e.find(m.uid).zone,'banished');assert.equal(e.find(s.uid).zone,'hand');
});
test('Fog Blade prevents attacks from and against its target and breaks when the target leaves',()=>{
 const e=fresh(),s=put(e,0,'spells',"Phantom Knights' Fog Blade",{faceUp:false}),a=fieldCard(e,0,'Neptabyss, the Atlantean Prince'),b=fieldCard(e,1,'Blue-Eyes White Dragon');use(e,s,'cast',{target:[a.uid]});assert.equal(e.negated(a),true);e.state.phase='battle';assert.equal(e.canAttack(a,0,b.uid),false);assert.equal(e.canAttack(b,1,a.uid),false);trigger(e,()=>e.move(a.uid,'hand',{kind:'effect-return',source:source(e)}));assert.equal(e.find(s.uid).zone,'grave');
});
test('Terrortop and Taketomborg make the Level selection and Synchro line available',()=>{
 const e=fresh(),t=put(e,0,'hand','Speedroid Terrortop'),b=put(e,0,'deck','Speedroid Taketomborg'),r=put(e,0,'deck','Speedroid Red-Eyed Dice');use(e,t,'gx-special',{},p=>p.kind==='choice'&&p.candidates.some(q=>q.uid===b.uid)?{type:'choose',uids:[b.uid]}:null);assert.equal(e.find(b.uid).zone,'hand');use(e,b,'gx-special');use(e,b,'y15-recruit');assert.equal(e.find(r.uid).zone,'monsters');assert.equal(e.find(b.uid).zone,'grave');assert.equal(e.state.players[0].usedTurn['y15-special:'+b.id],e.state.turn);assert.ok(t.levelOverride);
});
test('PSY Gamma summons its partner and negates a monster effect; both leave at end',()=>{
 const e=fresh(),g=put(e,1,'hand','PSY-Framegear Gamma'),d=put(e,1,'deck','PSY-Frame Driver'),m=fieldCard(e,0,'Neptabyss, the Atlantean Prince'),cost=put(e,0,'deck','Atlantean Marksman'),q=put(e,0,'deck','Atlantean Dragoons');act(e,{type:'activate',uid:m.uid,key:m.id+'::y15-search',choices:{cost:[cost.uid]}});assert.ok(e.state.pending.options.some(o=>o.uid===g.uid));act(e,{type:'respond',uid:g.uid,key:g.id+'::y15-response'});drain(e);assert.equal(e.find(m.uid).zone,'grave');assert.equal(e.find(q.uid).zone,'deck');assert.equal(e.find(g.uid).zone,'monsters');assert.equal(e.find(d.uid).zone,'monsters');trigger(e,()=>e.emit({type:'end-phase',owner:0}));assert.equal(e.find(g.uid).zone,'banished');assert.equal(e.find(d.uid).zone,'banished');
});
test('PSY Zeta returns both temporarily banished monsters without a Special Summon',()=>{
 const e=fresh(),z=fieldCard(e,0,'PSY-Framelord Zeta'),m=fieldCard(e,1,'Blue-Eyes White Dragon',{summonKind:'effect'});use(e,z,'y15-banish',{target:[m.uid]});assert.equal(e.find(z.uid).zone,'banished');assert.equal(e.find(m.uid).zone,'banished');e.state.turn+=2;const counts=e.state.players.map(p=>p.turnStats.special);trigger(e,()=>e.emit({type:'standby',owner:0}));assert.equal(e.find(z.uid).zone,'monsters');assert.equal(e.find(m.uid).zone,'monsters');assert.deepEqual(e.state.players.map(p=>p.turnStats.special),counts);
});
