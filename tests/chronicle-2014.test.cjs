const test=require('node:test'),fs=require('node:fs');
const {assert,D,E,DuelEngine,put,fresh,fieldCard}=require('./gx-helpers.cjs');
const id=n=>D.cardByName(n).id;
function act(e,a){const r=e.act(a);assert.equal(r.ok,true,JSON.stringify(a)+' / '+r.error);}
function drain(e,pick){let n=0;while(e.state.pending&&e.state.winner===null&&n++<180){const p=e.state.pending;act(e,pick?.(p,e)||(p.kind==='window'?{type:'pass'}:e.chooseAI(p)));}assert.ok(n<180);e.assertState();}
function use(e,m,mode='cast',choices={},pick){act(e,{type:'activate',uid:m.uid,key:m.id+'::'+mode,choices});drain(e,pick);}
function source(e,n='Raigeki',owner=1){return {id:id(n),owner,effectType:'spell'};}
function trigger(e,fn,pick){fn();e.pump();drain(e,pick);}
test('2014 preserves 613 unique source identities, types, scales and stable reused IDs',()=>{
 const rows=require('../data/yearly/2014/cards.json').cards,cards=D.CARD_LIST.filter(c=>c.releaseYear===2014);
 assert.equal(cards.length,613);assert.equal(new Set(cards.map(c=>c.providerId)).size,613);
 for(const r of rows){const c=D.cardByName(r.name);assert.equal(c.providerId,r.providerId);assert.equal(c.firstOCGDate,r.firstOCGDate);assert.equal(c.originalDescription,r.description);if(/Pendulum/.test(r.providerType)){assert.equal(c.type,'pendulum');assert.equal(c.scale,r.pendulumScale);assert.equal(!!c.effect,!/Normal/.test(r.providerType));}}
 assert.equal(id('Qliphort Scout'),'qli-scout');assert.equal(id('Masked HERO Dark Law'),'masked-dark-law');
});
test('three sourced annual decks contain 40 legal main cards and no future or pending cards',()=>{
 const Decks=require('../src/deck-tools.js'),rows=require('../data/decks-2014.json');assert.equal(rows.decks.length,3);
 for(const d of Object.values(D.DECKS).filter(d=>d.year===2014)){assert.equal(Decks.analyze(d).valid,true);assert.equal(d.cards.length,40);assert.ok(d.extra.length<=15);for(const cid of [...d.cards,...d.extra]){assert.ok(D.CARDS[cid].releaseYear<=2014);assert.notEqual(D.CARDS[cid].implementationStatus,'pending');}assert.ok(d.sourceRefs.every(r=>rows.sources.some(s=>s.id===r)));}
});
test('Shaddoll effect sends trigger searches; discard costs and Synchro materials do not',()=>{
 for(const kind of ['effect-send','cost-discard','synchro-material']){const e=fresh(),m=put(e,0,'hand','Shaddoll Hedgehog'),q=put(e,0,'deck','Shaddoll Beast');trigger(e,()=>e.move(m.uid,'grave',{kind,source:source(e),byOwner:0}));assert.equal(e.find(q.uid).zone,kind==='effect-send'?'hand':'deck',kind);}
});
test('Shaddoll FLIP and sent effects share a name limit across copies',()=>{
 const e=fresh(),a=fieldCard(e,0,'Shaddoll Beast',{faceUp:false,position:'defense'}),b=put(e,0,'hand','Shaddoll Beast');
 trigger(e,()=>e.flipFaceUp(a.uid,{position:'attack'}));const before=e.state.players[0].hand.length;
 trigger(e,()=>e.move(b.uid,'grave',{kind:'effect-send',source:source(e)}));assert.equal(e.state.players[0].hand.length,before-1);
});
test('Shaddoll Fusion admits deck materials only against a monster summoned from Extra Deck',()=>{
 const e=fresh(),fusion=put(e,0,'extra','El Shaddoll Construct'),dark=put(e,0,'deck','Shaddoll Squamata'),light=put(e,0,'deck','Effect Veiler'),op=fieldCard(e,1,'Stardust Dragon',{summonFrom:'grave'});
 const profile={theme2014:'shaddoll',spellId:id('Shaddoll Fusion')};assert.equal(e.fusionValid(0,fusion,[dark,light],profile),false);op.summonFrom='extra';assert.equal(e.fusionValid(0,fusion,[dark,light],profile),true);op.summonFrom='grave';assert.equal(e.fusionValid(0,fusion,[dark,light],profile),false);
});
test('real Shaddoll Fusion selection summons and sends materials by effect',()=>{
 const e=fresh(),spell=put(e,0,'hand','Shaddoll Fusion'),a=put(e,0,'hand','Shaddoll Squamata'),b=put(e,0,'hand','Effect Veiler'),f=put(e,0,'extra','El Shaddoll Construct');
 use(e,spell,'cast',{},p=>p.kind==='trigger'?{type:'pass'}:p.purpose==='fusion'?{type:'choose',uids:[a.uid,b.uid]}:null);
 assert.ok(['monsters','extraMonster'].includes(e.find(f.uid).zone));assert.equal(e.find(a.uid).zone,'grave');assert.equal(f.summonKind,'fusion');assert.equal(f.summonFrom,'extra');
});
test('Winda prevents a second Special Summon and resists only opposing effect destruction',()=>{
 const e=fresh(),w=fieldCard(e,0,'El Shaddoll Winda'),m=put(e,0,'hand','Battle Ox');e.state.players[0].turnStats.special=1;assert.equal(e.canSpecial(0,m,{via:'effect'}),false);assert.equal(e.destroy(w.uid,source(e)),false);assert.equal(e.destroy(w.uid,source(e,'Raigeki',0)),true);
});
test('Mathematician sends a level 4 or lower monster and draws only after battle destruction',()=>{
 const e=fresh(),m=put(e,0,'hand','Mathematician'),q=put(e,0,'deck','Shaddoll Squamata');act(e,{type:'summon',uid:m.uid});drain(e,p=>p.kind==='choice'&&p.candidates?.some(c=>c.uid===q.uid)?{type:'choose',uids:[q.uid]}:p.kind==='trigger'&&p.trigger.uid!==m.uid?{type:'pass'}:null);assert.equal(e.find(q.uid).zone,'grave');const n=e.state.players[0].hand.length;trigger(e,()=>e.destroy(m.uid,{owner:1,effectType:'battle'},true));assert.equal(e.state.players[0].hand.length,n+1);
});
test('Nekroz Mirror can banish grave materials, and Shurit satisfies the entire level',()=>{
 const e=fresh(),m=put(e,0,'hand','Nekroz of Trishula'),q=put(e,0,'grave','Shurit, Strategist of the Nekroz');assert.equal(e.ritualValid(0,m,[q],id('Nekroz Mirror')),true);e.performRitual(0,m.uid,[q.uid],id('Nekroz Mirror'),source(e,'Nekroz Mirror',0));drain(e);assert.equal(e.find(q.uid).zone,'banished');assert.equal(m.summonKind,'ritual');
});
test('Nekroz material restrictions are checked before using Shurit substitution',()=>{
 const e=fresh(),m=put(e,0,'hand','Nekroz of Valkyrus'),q=put(e,0,'hand','Blue-Eyes White Dragon');assert.equal(e.ritualValid(0,m,[q],id('Nekroz Mirror')),false);const sh=put(e,0,'hand','Shurit, Strategist of the Nekroz');assert.equal(e.ritualValid(0,m,[sh],id('Nekroz Mirror')),true);
});
test('Cycle Ritual Summons from grave; generic revival still cannot summon Nekroz rituals',()=>{
 const e=fresh(),m=put(e,0,'grave','Nekroz of Unicore',{properlySummoned:true}),q=put(e,0,'hand','Battle Ox');assert.equal(e.canSpecial(0,m,{via:'revive'}),false);assert.equal(e.ritualValid(0,m,[q],id('Nekroz Cycle')),true);e.performRitual(0,m.uid,[q.uid],id('Nekroz Cycle'),source(e,'Nekroz Cycle',0));assert.equal(e.find(m.uid).zone,'monsters');
});
test('Kaleidoscope uses Herald from Extra Deck; the sent Herald searches a Ritual',()=>{
 const e=fresh(),s=put(e,0,'hand','Nekroz Kaleidoscope'),m=put(e,0,'hand','Nekroz of Unicore'),h=put(e,0,'extra','Herald of the Arc Light'),q=put(e,0,'deck','Nekroz Mirror');
 use(e,s,'cast',{},p=>p.kind==='choice'&&p.candidates?.some(c=>c.uid===q.uid)?{type:'choose',uids:[q.uid]}:null);assert.equal(e.find(h.uid).zone,'grave');assert.equal(e.find(m.uid).zone,'monsters');assert.equal(e.find(q.uid).zone,'hand');
});
test('Kaleidoscope can summon two rituals with one level 12 material, including after restore',()=>{
 let e=fresh();const s=put(e,0,'hand','Nekroz Kaleidoscope'),a=put(e,0,'hand','Nekroz of Unicore'),b=put(e,0,'hand','Nekroz of Valkyrus'),q=put(e,0,'extra','Shooting Quasar Dragon');
 act(e,{type:'activate',uid:s.uid,key:s.id+'::cast'});while(e.state.pending?.kind==='window')act(e,{type:'pass'});assert.equal(e.state.pending.kind,'choice');e=DuelEngine.restore(e.snapshot());const o=e.state.pending.candidates.find(o=>{const x=JSON.parse(o.uid);return x.material===q.uid&&x.targets.includes(a.uid)&&x.targets.includes(b.uid);});assert.ok(o);act(e,{type:'choose',uids:[o.uid]});drain(e);assert.equal(e.find(q.uid).zone,'grave');assert.equal(e.find(a.uid).zone,'monsters');assert.equal(e.find(b.uid).zone,'monsters');
});
test('Brionac hand search discards as a cost and is once per name',()=>{
 const e=fresh(),m=put(e,0,'hand','Nekroz of Brionac'),b=put(e,0,'hand','Nekroz of Brionac'),q=put(e,0,'deck','Nekroz of Unicore');use(e,m,'nekroz-search');assert.equal(e.find(m.uid).zone,'grave');assert.equal(e.find(q.uid).zone,'hand');assert.equal(E.available(e,0,{kind:'main'}).some(a=>a.uid===b.uid&&a.key.endsWith('nekroz-search')),false);
});
test('Unicore negates Extra Deck arrivals, but not a monster revived from grave',()=>{
 const e=fresh(),u=fieldCard(e,0,'Nekroz of Unicore'),a=fieldCard(e,1,'Stardust Dragon',{summonFrom:'extra'}),b=fieldCard(e,1,'Black Rose Dragon',{summonFrom:'grave'});assert.equal(e.negated(a),true);assert.equal(e.negated(b),false);u.effectNegated=true;assert.equal(e.negated(a),false);
});
test('Trishula banishes exactly one opposing hand, field and grave card, with hidden random hand choice',()=>{
 const e=fresh(),m=put(e,0,'hand','Nekroz of Trishula'),sh=put(e,0,'hand','Shurit, Strategist of the Nekroz'),h=put(e,1,'hand','Battle Ox'),f=fieldCard(e,1,'Blue-Eyes White Dragon'),g=put(e,1,'grave','Dark Magician');trigger(e,()=>e.performRitual(0,m.uid,[sh.uid],id('Nekroz Mirror'),source(e,'Nekroz Mirror',0)));for(const c of [h,f,g])assert.equal(e.find(c.uid).zone,'banished');
});
test('Trishula does not offer the removal effect with an empty opposing graveyard',()=>{
 const e=fresh(),m=fieldCard(e,0,'Nekroz of Trishula'),ctx=e.abilityContext(m.uid,m.id+'::nekroz-banish','trigger',{kind:'ritual'});put(e,1,'hand','Battle Ox');fieldCard(e,1,'Blue-Eyes White Dragon');assert.equal(E.canUse(e,ctx),false);
});
test('Herald replaces hand/deck monster sends only while active on the field',()=>{
 const e=fresh(),h=fieldCard(e,0,'Herald of the Arc Light'),m=put(e,1,'hand','Battle Ox');e.move(m.uid,'grave',{kind:'effect-send'});assert.equal(e.find(m.uid).zone,'banished');h.effectNegated=true;const n=put(e,1,'hand','Battle Ox');e.move(n.uid,'grave',{kind:'effect-send'});assert.equal(e.find(n.uid).zone,'grave');
});
test('Qli normal Pendulum cards preserve normal classification and resolved scale activation',()=>{
 const e=fresh(),s=put(e,0,'hand','Qliphort Scout');assert.equal(e.isNormalMonster(s),true);act(e,{type:'pendulum-scale',uid:s.uid,slot:0});drain(e);assert.equal(e.scales(0)[0].card.uid,s.uid);assert.equal(e.scales(0)[0].scale,9);
});
test('Qli scale restriction survives Spell negation; equipped Qli is not a scale',()=>{
 const e=fresh(),s=put(e,0,'spells','Qliphort Scout',{slot:0,spellNegated:true}),m=put(e,0,'hand','Battle Ox');assert.equal(e.canSpecial(0,m,{via:'effect'}),false);s.monsterEquip=true;s.equipTarget=fieldCard(e,0,'Blue-Eyes White Dragon').uid;assert.equal(e.isPendulumScale(s),false);assert.equal(e.canSpecial(0,m,{via:'effect'}),true);
});
test('Qli Shell and Cephalopod inherit reduced summon stats and scale auras',()=>{
 const e=fresh(),m=put(e,0,'hand','Qliphort Shell');act(e,{type:'summon',uid:m.uid,noTribute:true});drain(e);assert.equal(e.level(m),4);assert.equal(e.attackValue(m),1800);put(e,0,'spells','Qliphort Cephalopod',{slot:4});const f=fieldCard(e,1,'Blue-Eyes White Dragon');assert.equal(e.attackValue(f),2700);
});
test('Pendulum Shift public value survives snapshot and expires next turn',()=>{
 const e=fresh(),m=put(e,0,'spells','Qliphort Scout',{slot:0}),s=put(e,0,'hand','Pendulum Shift');use(e,s,'cast',{target:[m.uid],scale:['3']});assert.equal(e.pendulumScale(m),3);const r=DuelEngine.restore(e.snapshot());assert.equal(r.pendulumScale(r.find(m.uid).card),3);r.state.turn++;assert.equal(r.pendulumScale(r.find(m.uid).card),9);
});
test('Soul Charge loses LP, forbids battle, and does not use effect damage reduction',()=>{
 const e=fresh(),s=put(e,0,'hand','Soul Charge'),m=put(e,0,'grave','Battle Ox');e.state.players[0].preventDamageUntil=e.state.turn;use(e,s,'cast',{target:[m.uid]});assert.equal(e.state.players[0].lp,7000);assert.equal(e.attackBlocked(0),true);assert.equal(e.find(m.uid).zone,'monsters');
});
test('Castel spends exactly two materials and shuffles a face-up card',()=>{
 const e=fresh(),m=fieldCard(e,0,'Castel, the Skyblaster Musketeer'),a=fieldCard(e,0,'Battle Ox'),b=fieldCard(e,0,'Mystical Shine Ball'),f=fieldCard(e,1,'Blue-Eyes White Dragon');for(const q of [a,b]){e.remove(q.uid);m.overlays.push(q);}use(e,m,'year-shuffle',{cost:[a.uid,b.uid],target:[f.uid]});assert.equal(e.find(f.uid).zone,'deck');assert.equal(m.overlays.length,0);assert.equal(e.find(a.uid).zone,'grave');
});
module.exports={drain,act,use};
