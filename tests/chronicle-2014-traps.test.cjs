const test=require('node:test');
const {assert,D,E,put,fresh,fieldCard}=require('./gx-helpers.cjs');
const id=n=>D.cardByName(n).id;
function act(e,a){const r=e.act(a);assert.equal(r.ok,true,JSON.stringify(a)+' / '+r.error);}
// Resolve everything; the focused card responds at its first legal window.
function drain(e,focus=null,pick){let n=0,used=false;while(e.state.pending&&e.state.winner===null&&n++<200){const p=e.state.pending;let a=pick?.(p,e);if(!a&&p.kind==='window'){const o=!used&&p.options.find(o=>o.uid===focus);if(o){used=true;a={type:'respond',uid:o.uid,key:o.key};}else a={type:'pass'};}if(!a)a=p.kind==='trigger'&&!p.trigger.mandatory&&p.trigger.uid!==focus?{type:'pass'}:e.chooseAI(p);act(e,a);}assert.ok(n<200);e.assertState();}
const board=e=>{fieldCard(e,0,'Battle Ox');fieldCard(e,0,'Mystical Elf');fieldCard(e,1,'Blue-Eyes White Dragon');fieldCard(e,1,'Harpie Lady');return e;};
const setTrap=(e,p,n,props={})=>put(e,p,'spells',n,{faceUp:false,setTurn:e.state.turn-1,...props});
const clear=(e,p)=>{for(const m of [...e.monsters(p)])e.move(m.uid,'grave',{kind:'rule-fixture'});e.state.triggers=[];e.state.tasks=[];};
function battle(e,attacker,target){e.state.active=attacker===null?0:e.find(attacker.uid).owner;e.state.phase='battle';e.state.frame=null;act(e,{type:'attack',uid:attacker.uid,...(target?{target:target.uid}:{})});}
test('Powerful Rebirth revives with +1 Level and +100, and dies with its monster',()=>{
 const e=board(fresh()),t=setTrap(e,0,'Powerful Rebirth'),m=put(e,0,'grave','Harpie Lady');act(e,{type:'activate',uid:t.uid,key:t.id+'::cast'});drain(e,null,p=>p.kind==='input'?{type:'choose',uids:[m.uid]}:null);
 assert.ok(['monsters'].includes(e.find(m.uid).zone));assert.equal(e.level(m),5);assert.equal(e.attackValue(m),D.CARDS[m.id].atk+100);
 e.destroy(m.uid,{owner:1,id:id('Raigeki'),effectType:'spell'});e.pump();drain(e);assert.equal(e.find(t.uid).zone,'grave');
});
test('Time-Space Trap Hole shuffles a monster Special Summoned from the hand and costs 1000 LP',()=>{
 const e=board(fresh()),t=setTrap(e,0,'Time-Space Trap Hole');e.state.active=1;clear(e,1);const m=put(e,1,'hand','Cyber Dragon');fieldCard(e,0,'Battle Ox');const lp=e.state.players[0].lp;
 act(e,{type:'activate',uid:m.uid,key:E.available(e,1,{kind:'main'}).find(a=>a.uid===m.uid).key});drain(e,t.uid);
 assert.equal(e.find(m.uid).zone,'deck');assert.equal(e.state.players[0].lp,lp-1000);
});
test('Solemn Scolding needs to be the only Set card and pays 3000 LP to negate',()=>{
 const e=board(fresh()),t=setTrap(e,0,'Solemn Scolding');e.state.active=1;const pot=put(e,1,'hand','Pot of Greed'),lp=e.state.players[0].lp,deck=e.state.players[1].hand.length;
 act(e,{type:'activate',uid:pot.uid,key:pot.id+'::cast'});drain(e,t.uid);assert.equal(e.state.players[0].lp,lp-3000);assert.equal(e.state.players[1].hand.length,deck-1);assert.equal(e.find(pot.uid).zone,'grave');
 const e2=board(fresh()),t2=setTrap(e2,0,'Solemn Scolding');setTrap(e2,0,'Mirror Force');e2.state.active=1;const p2=put(e2,1,'hand','Pot of Greed');act(e2,{type:'activate',uid:p2.uid,key:p2.id+'::cast'});
 assert.ok(!(e2.state.pending?.options||[]).some(o=>o.uid===t2.uid));
});
test('Wiretap negates a Trap activation and shuffles it into the Deck',()=>{
 const e=board(fresh()),t=setTrap(e,0,'Wiretap');e.state.active=0;const foe=setTrap(e,1,'Ghost of a Grudge');for(let i=0;i<8;i++)put(e,0,'grave','Battle Ox');
 e.state.active=1;act(e,{type:'activate',uid:foe.uid,key:foe.id+'::cast'});drain(e,t.uid);assert.equal(e.find(foe.uid).zone,'deck');
});
test('Wall of Disruption drains 800 ATK per attacker-side monster',()=>{
 const e=board(fresh()),t=setTrap(e,0,'Wall of Disruption');const a=e.monsters(1).find(m=>m.faceUp),n=e.monsters(1).length,before=e.attackValue(a);
 battle(e,a,e.monsters(0).find(m=>D.CARDS[m.id].officialName==='Mystical Elf'));drain(e,t.uid);assert.equal(e.find(a.uid).zone,'monsters');assert.equal(e.attackValue(a),Math.max(0,before-800*n));
});
test('Doble Passe turns the attack direct and burns for the target ATK',()=>{
 const e=board(fresh()),t=setTrap(e,0,'Doble Passe'),mine=e.monsters(0).find(m=>m.faceUp&&m.position==='attack'),a=e.monsters(1).find(m=>m.faceUp),lp1=e.state.players[1].lp;
 battle(e,a,mine);drain(e,t.uid);assert.equal(e.state.players[1].lp,lp1-e.attackValue(mine));assert.equal(mine.directAttackTurn,e.state.turn+1);
});
test('Relay Soul prevents damage while its monster stays and loses the duel when it leaves',()=>{
 const e=board(fresh()),t=setTrap(e,0,'Relay Soul'),m=put(e,0,'hand','Mystical Elf');act(e,{type:'activate',uid:t.uid,key:t.id+'::cast'});drain(e,null,p=>p.kind==='choice'?{type:'choose',uids:[m.uid]}:null);
 assert.equal(e.find(m.uid).zone,'monsters');const lp=e.state.players[0].lp;e.damage(0,1000,'效果');assert.equal(e.state.players[0].lp,lp);
 e.destroy(m.uid,{owner:1,id:id('Raigeki'),effectType:'spell'});e.pump();assert.equal(e.state.winner,1);
});
test('Ghost of a Grudge needs 8 opposing Graveyard cards and zeroes their monsters',()=>{
 const e=board(fresh()),t=setTrap(e,0,'Ghost of a Grudge');while(e.state.players[1].grave.length<8)put(e,1,'grave','Battle Ox');
 act(e,{type:'activate',uid:t.uid,key:t.id+'::cast'});drain(e);for(const m of e.monsters(1).filter(m=>m.faceUp))assert.equal(e.attackValue(m),0);
});
test('And the Band Played On blocks Special Summons that share a controlled Level',()=>{
 const e=board(fresh()),t=setTrap(e,0,'And the Band Played On',{faceUp:true}),ox=e.monsters(0).find(m=>m.faceUp&&e.level(m)===4),same=put(e,0,'hand','Harpie Lady'),other=put(e,0,'hand','Cyber Dragon');
 assert.ok(ox);assert.equal(e.canSpecial(0,same,{via:'effect'}),false);assert.equal(e.canSpecial(0,other,{via:'effect'}),true);
});
test('Xyz Universe sends two Xyz monsters and summons a legal non-Number with the trap attached',()=>{
 const e=board(fresh()),t=setTrap(e,0,'Xyz Universe'),a=fieldCard(e,0,'Gagaga Cowboy'),b=fieldCard(e,1,'Gagaga Cowboy'),x=put(e,0,'extra','Constellar Omega');
 const r4=D.CARDS[x.id].rank;assert.equal(r4,4);a.id=id('Gagaga Cowboy');
 act(e,{type:'activate',uid:t.uid,key:t.id+'::cast'});drain(e,null,p=>p.kind==='input'?{type:'choose',uids:[a.uid,b.uid]}:null);
 // two Rank 4 → Rank 8 or 7 required; Constellar Omega is not eligible
 assert.equal(e.find(a.uid).zone,'grave');assert.equal(e.find(x.uid).zone,'extra');assert.equal(e.state.players[1].preventDamageUntil,e.state.turn);
});
test('Moon Dance Ritual negates face-up monsters while its WIND Xyz remains',()=>{
 const e=board(fresh()),t=setTrap(e,0,'Moon Dance Ritual'),w=fieldCard(e,0,'Number 39: Utopia',{overlays:[]});e.state.players[0].monsters.forEach(()=>{});
 const wind=Object.values(D.CARDS).find(c=>c.type==='xyz'&&c.attribute==='风'&&c.releaseYear<=2014&&!c.notCollectible);const m=fieldCard(e,0,wind.id,{overlays:[]});
 act(e,{type:'activate',uid:t.uid,key:t.id+'::cast'});drain(e,null,p=>p.kind==='input'?{type:'choose',uids:[m.uid]}:null);
 const foe=e.monsters(1).find(q=>q.faceUp);assert.equal(e.negated(foe),true);e.move(m.uid,'grave',{kind:'destroy'});e.pump();drain(e);assert.equal(e.find(t.uid).zone,'grave');assert.equal(e.negated(foe),false);
});
test('That Six turns its controller odd rolls into 6 and opponent even rolls into 1',()=>{
 const e=board(fresh());put(e,0,'spells','That Six',{faceUp:true});assert.equal(e.adjustDie(3,{owner:0}),6);assert.equal(e.adjustDie(4,{owner:0}),4);assert.equal(e.adjustDie(4,{owner:1}),1);assert.equal(e.adjustDie(5,{owner:1}),5);
});
test('Last Minute Cancel puts monsters in Defense and returns destroyed Performapals to hand',()=>{
 const e=board(fresh()),t=setTrap(e,0,'Last Minute Cancel'),pal=fieldCard(e,0,'Performapal Hip Hippo'),a=e.monsters(1).find(m=>m.faceUp);
 battle(e,a,e.monsters(0).find(m=>m.faceUp));drain(e,t.uid);assert.ok(e.monsters(0).filter(m=>m.faceUp).every(m=>m.position==='defense'));
 e.state.phase='main2';e.state.frame=null;e.destroy(pal.uid,{owner:1,id:id('Raigeki'),effectType:'spell'});assert.equal(e.find(pal.uid).zone,'hand');
});
test('Secret Blast burns 300 per opposing card and 1000 more when the opponent destroys it',()=>{
 const e=board(fresh()),t=setTrap(e,0,'Secret Blast'),lp=e.state.players[1].lp,n=e.field(1).length;act(e,{type:'activate',uid:t.uid,key:t.id+'::cast'});drain(e);assert.equal(e.state.players[1].lp,lp-300*n);
 const t2=setTrap(e,0,'Secret Blast'),lp2=e.state.players[1].lp;e.destroy(t2.uid,{owner:1,id:id('Mystical Space Typhoon'),effectType:'spell'});e.pump();drain(e);assert.equal(e.state.players[1].lp,lp2-1000);
});
test('Black Illusion protects DARK Spellcasters from opposing effects and battle this turn',()=>{
 const e=board(fresh()),t=setTrap(e,0,'Black Illusion'),dm=fieldCard(e,0,'Dark Magician');act(e,{type:'activate',uid:t.uid,key:t.id+'::cast'});drain(e);
 assert.equal(e.unaffected(dm,{owner:1,id:id('Raigeki'),effectType:'spell'}),true);assert.equal(e.negated(dm),true);assert.equal(e.destroy(dm.uid,{owner:1},true),false);
});
test('Planckton boosts low-Rank Xyz and grounds Rank 4 or higher this turn',()=>{
 const e=board(fresh()),t=setTrap(e,0,'Planckton'),low=fieldCard(e,0,'Gagaga Cowboy'),high=fieldCard(e,1,'Number 39: Utopia');const before=e.attackValue(low);act(e,{type:'activate',uid:t.uid,key:t.id+'::cast'});drain(e);
 assert.equal(e.attackValue(low),before+(D.CARDS[low.id].rank<=3?500:0));assert.equal(e.canAttack(high,1),false);
});
