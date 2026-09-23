const test=require('node:test');
const {assert,D,E,put,fresh,fieldCard}=require('./gx-helpers.cjs');
const id=n=>D.cardByName(n).id;
function act(e,a){const r=e.act(a);assert.equal(r.ok,true,JSON.stringify(a)+' / '+r.error);}
function drain(e,pick){let n=0;while(e.state.pending&&e.state.winner===null&&n++<200){const p=e.state.pending;const a=pick?.(p,e)||(p.kind==='window'?{type:'pass'}:p.kind==='trigger'&&!p.trigger.mandatory?{type:'pass'}:e.chooseAI(p));act(e,a);}assert.ok(n<200);e.assertState();}
const xyz=(e,p,n,matNames=['Battle Ox','Battle Ox'],props={})=>{const m=fieldCard(e,p,n,{summonKind:'xyz',properlySummoned:true,...props});for(const k of matNames){const q=e.makeCard(id(k),p);m.overlays.push(q);}e.state.originalCardCount=e.physicalCards().filter(c=>D.CARDS[c.id].type!=='token').length;return m;};
const zone=(e,m)=>e.find(m.uid)?.zone;
const onField=(e,m)=>['monsters','extraMonster'].includes(zone(e,m));
test('Utopia Prime can be Xyz Summoned by stacking on Number 39: Utopia and keeps its materials',()=>{
 const e=fresh(),u=xyz(e,0,'Number 39: Utopia'),s=put(e,0,'extra','Number S39: Utopia Prime');
 act(e,{type:'extra-summon',uid:s.uid,materials:[u.uid]});drain(e);assert.ok(onField(e,s));assert.equal(s.overlays.length,3);
});
test('Ebon Illusion Magician ranks up from a Rank 6 Spellcaster and summons a Spellcaster Normal Monster',()=>{
 const e=fresh(),base=D.CARD_LIST.find(c=>c.type==='xyz'&&c.rank===6&&c.race==='魔法师族'&&!c.notCollectible),b=xyz(e,0,base.id),m=put(e,0,'extra','Ebon Illusion Magician'),dm=put(e,0,'deck','Dark Magician');
 act(e,{type:'extra-summon',uid:m.uid,materials:[b.uid]});drain(e);assert.ok(onField(e,m));
 act(e,{type:'activate',uid:m.uid,key:m.id+'::era2014-summon'});drain(e,p=>p.kind==='input'?{type:'choose',uids:[m.overlays[0].uid]}:p.kind==='choice'?{type:'choose',uids:[dm.uid]}:null);assert.ok(onField(e,dm));
});
test('Number 103: Ragnazero destroys a monster whose ATK changed and draws',()=>{
 const e=fresh(),r=xyz(e,0,'Number 103: Ragnazero'),foe=fieldCard(e,1,'Blue-Eyes White Dragon');e.modify(foe.uid,'atk','add',500);const h=e.state.players[0].hand.length;
 act(e,{type:'activate',uid:r.uid,key:r.id+'::era2014-destroy'});drain(e,p=>p.kind==='input'&&p.group.key==='cost'?{type:'choose',uids:[r.overlays[0].uid]}:null);assert.equal(zone(e,foe),'grave');assert.equal(e.state.players[0].hand.length,h+1);
});
test('Phantom Fortress Enterblathnir banishes the top card of the opponent Deck',()=>{
 const e=fresh(),m=xyz(e,0,'Phantom Fortress Enterblathnir',['Blue-Eyes White Dragon','Blue-Eyes White Dragon']),top=e.state.players[1].deck[0];
 act(e,{type:'activate',uid:m.uid,key:m.id+'::era2014-banish',choices:{cost:[m.overlays[0].uid],mode:['mode:deck']}});drain(e);assert.equal(zone(e,top),'banished');
});
test('Tri-Edge Levia banishes monsters it destroys by battle',()=>{
 const e=fresh(),t=xyz(e,0,'Tri-Edge Levia'),foe=fieldCard(e,1,'Battle Ox',{position:'defense'});e.modify(t.uid,'atk','add',1000);
 e.state.phase='battle';act(e,{type:'attack',uid:t.uid,target:foe.uid});drain(e);assert.equal(zone(e,foe),'banished');
});
test('Number F0: Utopic Future survives battle and prevents all battle damage',()=>{
 const e=fresh(),f=xyz(e,0,'Number F0: Utopic Future',['Number 39: Utopia','Number 39: Utopia']),foe=fieldCard(e,1,'Blue-Eyes White Dragon'),lp=e.state.players[0].lp;
 e.state.phase='battle';act(e,{type:'attack',uid:f.uid,target:foe.uid});drain(e);assert.ok(onField(e,f));assert.equal(e.state.players[0].lp,lp);
});
test('Number C9: Chaos Dyson Sphere absorbs the monster it battles and burns per material',()=>{
 const e=fresh(),c9=xyz(e,0,'Number C9: Chaos Dyson Sphere',['Battle Ox','Battle Ox','Battle Ox']),foe=fieldCard(e,1,'Blue-Eyes White Dragon');
 e.state.phase='battle';act(e,{type:'attack',uid:c9.uid,target:foe.uid});drain(e,p=>p.kind==='trigger'&&p.trigger.uid===c9.uid?{type:'respond',uid:c9.uid,key:p.trigger.key}:null);
 assert.ok(c9.overlays.some(o=>o.uid===foe.uid));const lp=e.state.players[1].lp;e.state.phase='main2';e.state.frame=null;act(e,{type:'activate',uid:c9.uid,key:c9.id+'::era2014-burn'});drain(e);assert.equal(e.state.players[1].lp,lp-300*c9.overlays.length);
});
test('Number 52: Diamond Crab King swaps to 3000 ATK and 0 DEF this turn',()=>{
 const e=fresh(),m=xyz(e,0,'Number 52: Diamond Crab King');act(e,{type:'activate',uid:m.uid,key:m.id+'::era2014-swap',choices:{cost:[m.overlays[0].uid]}});drain(e);assert.equal(e.attackValue(m),3000);assert.equal(e.defenseValue(m),0);
});
test('Number C102 detaches 2 materials instead of being destroyed, and burns when the last one leaves',()=>{
 const e=fresh(),m=xyz(e,0,'Number C102: Archfiend Seraph',['Battle Ox','Battle Ox']),lp=e.state.players[1].lp;
 assert.equal(e.destroy(m.uid,{owner:1,id:id('Raigeki'),effectType:'spell'}),false);assert.equal(m.overlays.length,0);assert.equal(e.state.players[1].lp,lp-1500);
});
test('Number 39: Utopia Beyond zeroes the opponent monsters when Xyz Summoned',()=>{
 const e=fresh(),foe=fieldCard(e,1,'Blue-Eyes White Dragon'),a=fieldCard(e,0,'Dark Magician'),b=fieldCard(e,0,'Dark Magician'),u=put(e,0,'extra','Number 39: Utopia Beyond');
 D.CARDS[a.id].level===6||[a,b].forEach(m=>m.levelOverride={value:6});act(e,{type:'extra-summon',uid:u.uid,materials:[a.uid,b.uid]});drain(e);assert.equal(e.attackValue(foe),0);
});
test('Number 81: Super Dora shields a monster from other card effects this turn',()=>{
 const e=fresh(),m=xyz(e,0,'Number 81: Superdreadnought Rail Cannon Super Dora');act(e,{type:'activate',uid:m.uid,key:m.id+'::era2014-shield',choices:{cost:[m.overlays[0].uid],target:[m.uid]}});drain(e);
 assert.equal(e.destroy(m.uid,{owner:1,id:id('Raigeki'),effectType:'spell'}),false);
});
test('Number 82: Heartlandraco cannot be attacked while its controller has a face-up Spell',()=>{
 const e=fresh(),h=xyz(e,0,'Number 82: Heartlandraco'),a=fieldCard(e,1,'Blue-Eyes White Dragon');put(e,0,'spells','Supply Squad',{faceUp:true});e.state.active=1;e.state.phase='battle';assert.equal(e.canAttack(a,1,h.uid),false);
});
test('Sky Cavalry Centaurea is not destroyed by battle while it has material',()=>{
 const e=fresh(),s=xyz(e,0,'Sky Cavalry Centaurea'),a=fieldCard(e,1,'Blue-Eyes White Dragon');e.state.active=1;e.state.phase='battle';act(e,{type:'attack',uid:a.uid,target:s.uid});drain(e);assert.ok(onField(e,s));
});
