const test=require('node:test');
const {assert,D,E,put,fresh,fieldCard}=require('./gx-helpers.cjs');
const id=n=>D.cardByName(n).id;
function act(e,a){const r=e.act(a);assert.equal(r.ok,true,JSON.stringify(a)+' / '+r.error);}
function drain(e,pick){let n=0;while(e.state.pending&&e.state.winner===null&&n++<200){const p=e.state.pending;const a=pick?.(p,e)||(p.kind==='window'?{type:'pass'}:p.kind==='trigger'&&!p.trigger.mandatory?{type:'pass'}:e.chooseAI(p));act(e,a);}assert.ok(n<200);e.assertState();}
function cast(e,m,pick,choices={}){act(e,{type:'activate',uid:m.uid,key:m.id+'::cast',choices});drain(e,pick);}
const board=e=>{fieldCard(e,1,'Blue-Eyes White Dragon');return e;};
const opp={owner:1,id:id('Raigeki'),effectType:'spell'};
test('The Melody of Awakening Dragon discards 1 and adds two big Dragons',()=>{
 const e=board(fresh()),m=put(e,0,'hand','The Melody of Awakening Dragon'),x=put(e,0,'hand','Battle Ox'),a=put(e,0,'deck','Blue-Eyes White Dragon'),b=put(e,0,'deck','Blue-Eyes White Dragon');
 cast(e,m,p=>p.kind==='choice'?{type:'choose',uids:[a.uid,b.uid]}:null,{cost:[x.uid]});assert.equal(e.find(x.uid).zone,'grave');assert.equal(e.find(a.uid).zone,'hand');assert.equal(e.find(b.uid).zone,'hand');
});
test('Galactic Charity needs a Galaxy Xyz, draws 2 and halves the opponent damage this turn',()=>{
 const e=board(fresh()),m=put(e,0,'hand','Galactic Charity'),x=put(e,0,'hand','Battle Ox');assert.ok(!E.available(e,0,{kind:'main'}).some(a=>a.uid===m.uid));
 fieldCard(e,0,'Number 62: Galaxy-Eyes Prime Photon Dragon');const h=e.state.players[0].hand.length;cast(e,m,null,{cost:[x.uid]});assert.equal(e.state.players[0].hand.length,h-2+2);
 const lp=e.state.players[1].lp;e.damage(1,1000,'效果');assert.equal(e.state.players[1].lp,lp-500);
});
test('Pot of Riches returns 3 Pendulum Monsters, draws 2 and forbids non-Pendulum Special Summons',()=>{
 const e=board(fresh()),m=put(e,0,'hand','Pot of Riches'),ps=['Odd-Eyes Pendulum Dragon','Performapal Partnaga','Performapal Trampolynx'].map(n=>put(e,0,'grave',n));const h=e.state.players[0].hand.length;
 cast(e,m,p=>p.kind==='input'?{type:'choose',uids:ps.map(p=>p.uid)}:null);assert.ok(ps.every(p=>e.find(p.uid).zone==='deck'));assert.equal(e.state.players[0].hand.length,h-1+2);
 const ox=put(e,0,'hand','Battle Ox');assert.equal(e.canSpecial(0,ox,{via:'effect'}),false);assert.equal(e.canSpecial(0,ox,{via:'pendulum'}),true);
});
test('Magical Spring draws for opposing face-up Spells/Traps and protects them from destruction',()=>{
 const e=board(fresh()),m=put(e,0,'hand','Magical Spring');const t=put(e,1,'spells','Swords of Revealing Light',{faceUp:true});put(e,1,'spells','Supply Squad',{faceUp:true});const h=e.state.players[0].hand.length;
 cast(e,m);assert.ok(e.state.players[0].hand.length>=h-1+2-1);assert.equal(e.destroy(t.uid,{owner:0,effectType:'spell'}),false);
});
test('Guarded Treasure discards 5 to draw 2 and doubles the normal draw',()=>{
 const e=board(fresh()),m=put(e,0,'hand','Guarded Treasure');const cost=[1,2,3,4,5].map(()=>put(e,0,'hand','Battle Ox'));cast(e,m,null,{cost:cost.map(c=>c.uid)});
 assert.equal(e.state.players[0].hand.length,2);assert.equal(e.find(m.uid).zone,'spells');e.state.inDrawPhase=true;const h=e.state.players[0].hand.length;e.draw(0,1);e.state.inDrawPhase=false;assert.equal(e.state.players[0].hand.length,h+2);
});
test('Supply Squad draws once per turn when your monster is destroyed',()=>{
 const e=board(fresh());put(e,0,'spells','Supply Squad',{faceUp:true});const a=fieldCard(e,0,'Battle Ox'),b=fieldCard(e,0,'Battle Ox'),h=e.state.players[0].hand.length;
 e.destroy(a.uid,opp);e.pump();drain(e);e.destroy(b.uid,opp);e.pump();drain(e);assert.equal(e.state.players[0].hand.length,h+1);
});
test('Sorcerous Spell Wall gives ATK on your turn and DEF on the opponent turn',()=>{
 const e=board(fresh());put(e,0,'fieldSpell','Sorcerous Spell Wall');const ox=fieldCard(e,0,'Battle Ox');e.state.active=0;assert.equal(e.attackValue(ox),2000);assert.equal(e.defenseValue(ox),1000);e.state.active=1;assert.equal(e.attackValue(ox),1700);assert.equal(e.defenseValue(ox),1300);
});
test('Mound of the Bound Creator shields Level 10 monsters from effect destruction and targeting',()=>{
 const e=board(fresh());put(e,0,'fieldSpell','Mound of the Bound Creator');const lv10=D.CARD_LIST.find(c=>c.type==='monster'&&c.level===10&&!c.notCollectible);const big=fieldCard(e,0,lv10.id);assert.equal(e.level(big),10);assert.equal(e.destroy(big.uid,opp),false);assert.equal(e.canTarget(big,opp),false);
});
test('Flash Fusion uses only field monsters and destroys the Fusion Monster in the End Phase',()=>{
 const e=board(fresh()),m=put(e,0,'spells','Flash Fusion',{faceUp:false,setTurn:1}),a=fieldCard(e,0,'Elemental HERO Avian'),b=fieldCard(e,0,'Elemental HERO Burstinatrix'),f=put(e,0,'extra','Elemental HERO Flame Wingman');put(e,0,'hand','Elemental HERO Avian');
 cast(e,m,p=>p.kind==='choice'?{type:'choose',uids:[f.uid]}:p.purpose==='fusion'?{type:'choose',uids:[a.uid,b.uid]}:null);assert.ok(['monsters','extraMonster'].includes(e.find(f.uid).zone));
 act(e,{type:'end'});drain(e);assert.equal(e.find(f.uid).zone,'grave');
});
test('Hippo Carnival makes 3 untributable Hippo Tokens that draw attacks and lock the Extra Deck',()=>{
 const e=board(fresh()),m=put(e,0,'hand','Hippo Carnival');cast(e,m);const tokens=e.monsters(0).filter(t=>t.id==='era2014-hippo-token');assert.equal(tokens.length,3);assert.equal(e.canTribute(tokens[0],0),false);
 const x=put(e,0,'extra','Number 39: Utopia');assert.equal(e.canSpecial(0,x,{via:'xyz'}),false);const foe=e.monsters(1)[0];assert.equal(e.canAttack(foe,1,tokens[0].uid),true);
});
test('A Wild Monster Appears! summons an unsummonable monster ignoring conditions and locks the turn',()=>{
 const e=board(fresh()),m=put(e,0,'hand','A Wild Monster Appears!'),g=put(e,0,'hand','Dark Armed Dragon');cast(e,m,p=>p.kind==='choice'?{type:'choose',uids:[g.uid]}:null);
 assert.equal(e.find(g.uid).zone,'monsters');assert.equal(e.state.players[1].preventDamageUntil,e.state.turn);assert.equal(e.canNormal(put(e,0,'hand','Battle Ox'),0),false);
});
test('Limit Overdrive returns a Tuner and non-Tuner Synchro and summons the combined Level',()=>{
 const e=board(fresh()),m=put(e,0,'hand','Limit Overdrive'),t=fieldCard(e,0,'Formula Synchron',{summonKind:'synchro',properlySummoned:true}),n=fieldCard(e,0,'Stardust Dragon',{summonKind:'synchro',properlySummoned:true});
 const lv=D.CARDS[t.id].level+D.CARDS[n.id].level,target=D.CARD_LIST.find(c=>c.type==='synchro'&&c.level===lv&&!c.notCollectible&&c.implementationStatus!=='pending');const x=put(e,0,'extra',target.id);
 cast(e,m,p=>p.kind==='choice'?{type:'choose',uids:[x.uid]}:null,{tuner:[t.uid],non:[n.uid]});assert.ok(['monsters','extraMonster'].includes(e.find(x.uid).zone));assert.equal(e.find(t.uid).zone,'extra');
});
test('Rank-Up-Magic Argent Chaos Force ranks a Rank 5+ Xyz into a Number C one Rank higher',()=>{
 const e=board(fresh()),m=put(e,0,'hand','Rank-Up-Magic Argent Chaos Force'),base=D.CARD_LIST.find(c=>c.type==='xyz'&&c.rank===5&&!c.notCollectible),up=D.CARD_LIST.find(c=>c.type==='xyz'&&c.rank===6&&/^Number C\d+:/.test(c.officialName));
 const b=fieldCard(e,0,base.id,{summonKind:'xyz',properlySummoned:true}),u=put(e,0,'extra',up.id);cast(e,m,p=>p.kind==='input'?{type:'choose',uids:[b.uid]}:p.kind==='choice'?{type:'choose',uids:[u.uid]}:null);
 assert.ok(['monsters','extraMonster'].includes(e.find(u.uid).zone));assert.ok(e.find(u.uid).card.overlays.some(o=>o.uid===b.uid));
});
test('Forbidden Scripture uses original values in its battle and ends at the Damage Step',()=>{
 const e=board(fresh()),s=put(e,0,'spells','Forbidden Scripture',{faceUp:false,setTurn:1}),ox=fieldCard(e,0,'Battle Ox');e.modify(ox.uid,'atk','add',2000);const foe=e.monsters(1)[0];
 e.state.active=0;e.state.phase='battle';act(e,{type:'attack',uid:ox.uid,target:foe.uid});
 drain(e,p=>p.kind==='window'&&p.context.attack?.stage==='calc'&&p.options.some(o=>o.uid===s.uid)?{type:'respond',uid:s.uid,key:s.id+'::cast'}:null);
 assert.equal(e.find(ox.uid).zone,'grave');assert.equal(e.find(foe.uid).zone,'monsters');
});
test('Wonder Balloons turns sent hand cards into counters that shrink opposing monsters',()=>{
 const e=board(fresh()),w=put(e,0,'spells','Wonder Balloons',{faceUp:true}),a=put(e,0,'hand','Battle Ox'),b=put(e,0,'hand','Battle Ox'),foe=e.monsters(1)[0];
 act(e,{type:'activate',uid:w.uid,key:w.id+'::era2014-counter',choices:{cost:[a.uid,b.uid]}});drain(e);assert.equal(e.attackValue(foe),3000-600);
});
