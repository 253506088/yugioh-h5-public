const test=require('node:test');
const {assert,D,E,DuelEngine,put,fresh,fieldCard}=require('./gx-helpers.cjs');
const id=n=>D.cardByName(n).id;
function act(e,a){const r=e.act(a);assert.equal(r.ok,true,JSON.stringify(a)+' / '+r.error);}
function drain(e,pick){let n=0;while(e.state.pending&&e.state.winner===null&&n++<180){const p=e.state.pending;act(e,pick?.(p,e)||(p.kind==='window'?{type:'pass'}:e.chooseAI(p)));}assert.ok(n<180);e.assertState();}
function use(e,m,mode,choices={},pick){act(e,{type:'activate',uid:m.uid,key:m.id+'::'+mode,choices});drain(e,pick);}
const scale=(e,n,slot)=>put(e,0,'spells',n,{slot});
test('Skullcrobat searches only on Normal Summon and restricts only Pendulum Summons',()=>{
 const e=fresh(),m=put(e,0,'hand','Performapal Skullcrobat Joker'),q=put(e,0,'deck','Performapal Monkeyboard');act(e,{type:'summon',uid:m.uid});drain(e);assert.equal(e.find(q.uid).zone,'hand');
 e.move(m.uid,'grave',{kind:'rule-fixture'});const s=scale(e,'Performapal Skullcrobat Joker',0),ox=put(e,0,'hand','Battle Ox');assert.equal(e.canSpecial(0,ox,{via:'pendulum'}),false);assert.equal(e.canSpecial(0,ox,{via:'effect'}),true);assert.ok(s);
});
test('Monkeyboard can search on its activation turn, keeps name-wide usage after restoring',()=>{
 let e=fresh();const m=put(e,0,'hand','Performapal Monkeyboard'),q=put(e,0,'deck','Performapal Skullcrobat Joker');act(e,{type:'pendulum-scale',uid:m.uid,slot:0});drain(e);assert.equal(e.pendulumScale(m),4);e=DuelEngine.restore(e.snapshot());use(e,m,'y15-scale-search');assert.equal(e.find(q.uid).zone,'hand');assert.equal(E.available(e,0,{kind:'main'}).some(a=>a.uid===m.uid&&a.key.endsWith('y15-scale-search')),false);
});
test('Guitartle draws after another scale resolves; Lizardraw destroys itself to draw',()=>{
 const e=fresh(),g=scale(e,'Performapal Guitartle',0),l=put(e,0,'hand','Performapal Lizardraw');const before=e.state.players[0].hand.length;act(e,{type:'pendulum-scale',uid:l.uid,slot:4});drain(e);assert.equal(e.state.players[0].hand.length,before);use(e,l,'y15-scale-draw');assert.equal(e.find(l.uid).zone,'extra');assert.equal(e.state.players[0].hand.length,before+1);assert.equal(e.find(g.uid).zone,'spells');
});
test('Luster destroys Plushfire, searches a same-name copy, and recruits from the destruction trigger',()=>{
 const e=fresh(),l=scale(e,'Luster Pendulum, the Dracoslayer',0),p=scale(e,'Performage Plushfire',4),copy=put(e,0,'deck','Performage Plushfire'),clown=put(e,0,'deck','Performage Trick Clown');use(e,l,'y15-scale-search');assert.equal(e.find(p.uid).zone,'extra');assert.equal(e.find(copy.uid).zone,'hand');assert.equal(e.find(clown.uid).zone,'monsters');
});
test('Trick Clown revives with zero stats, takes 1000 damage and uses its name once',()=>{
 const e=fresh(),m=put(e,0,'hand','Performage Trick Clown'),lp=e.state.players[0].lp;e.move(m.uid,'grave',{kind:'effect-send',source:{owner:0,effectType:'spell'}});e.pump();drain(e);assert.equal(e.find(m.uid).zone,'monsters');assert.equal(e.attackValue(m),0);assert.equal(e.defenseValue(m),0);assert.equal(e.state.players[0].lp,lp-1000);e.move(m.uid,'grave',{kind:'effect-send'});e.pump();drain(e);assert.equal(e.find(m.uid).zone,'grave');
});
test('Damage Juggler banishes as cost and searches another Performage',()=>{
 const e=fresh(),m=put(e,0,'grave','Performage Damage Juggler'),q=put(e,0,'deck','Performage Hat Tricker');use(e,m,'y15-search');assert.equal(e.find(m.uid).zone,'banished');assert.equal(e.find(q.uid).zone,'hand');
});
test('Wisdom-Eye replaces its own scale without consuming the other scale',()=>{
 const e=fresh(),w=scale(e,'Wisdom-Eye Magician',0),d=scale(e,'Dragonpit Magician',4),q=put(e,0,'deck','Dragonpulse Magician');use(e,w,'y15-scale-replace');assert.equal(e.find(w.uid).zone,'extra');assert.equal(e.find(q.uid).zone,'spells');assert.equal(e.find(q.uid).index,0);assert.equal(e.find(d.uid).index,4);
});
test('Pendulum Call protects scales through the opponent turn and stops Wisdom-Eye replacement',()=>{
 const e=fresh(),s=put(e,0,'hand','Pendulum Call'),cost=put(e,0,'hand','Battle Ox'),a=put(e,0,'deck','Dragonpit Magician'),b=put(e,0,'deck','Dragonpulse Magician');use(e,s,'cast',{discard:[cost.uid],target:[a.uid,b.uid]});const w=scale(e,'Wisdom-Eye Magician',0);scale(e,'Oafdragon Magician',4);const q=put(e,0,'deck','Dragonpit Magician');use(e,w,'y15-scale-replace');assert.equal(e.find(w.uid).zone,'spells');assert.equal(e.find(q.uid).zone,'deck');e.state.turn++;assert.equal(e.destroy(w.uid,{owner:1,effectType:'spell'}),false);e.state.turn++;assert.equal(e.destroy(w.uid,{owner:1,effectType:'spell'}),true);
});
test('Luster material restriction rejects non-Dracoslayers and accepts Ignister',()=>{
 const e=fresh(),l=fieldCard(e,0,'Luster Pendulum, the Dracoslayer'),p=fieldCard(e,0,'Performage Plushfire'),i=put(e,0,'extra','Ignister Prominence, the Blasting Dracoslayer'),s=put(e,0,'extra','Stardust Dragon');assert.equal(e.synchroValid(0,i,[l,p]),true);assert.equal(e.synchroValid(0,s,[l,p]),false);
});
test('Ignister sends its target to face-up Extra before choosing a non-targeting shuffle',()=>{
 const e=fresh(),i=fieldCard(e,0,'Ignister Prominence, the Blasting Dracoslayer'),p=scale(e,'Performage Plushfire',0),f=fieldCard(e,1,'Blue-Eyes White Dragon');use(e,i,'y15-destroy',{target:[p.uid]},p=>p.kind==='choice'&&p.candidates.some(q=>q.uid===f.uid)?{type:'choose',uids:[f.uid]}:p.kind==='trigger'?{type:'pass'}:null);assert.equal(e.find(p.uid).zone,'extra');assert.equal(e.find(f.uid).zone,'deck');
});
test('Odd-Eyes Rebellion is an Extra Deck Xyz, retains Rank and Pendulum text, and moves face-up',()=>{
 const e=fresh(),d=D.cardByName('Odd-Eyes Rebellion Dragon');assert.equal(d.type,'xyz');assert.equal(d.rank,7);assert.equal(d.pendulum,true);assert.equal(D.isExtra(d),true);const m=fieldCard(e,0,d.id,{properlySummoned:true});e.destroy(m.uid,{owner:1,effectType:'spell'});assert.equal(e.find(m.uid).zone,'extra');assert.equal(m.faceUpExtra,true);scale(e,'Dragonpulse Magician',0);scale(e,'Dragonpit Magician',4);assert.ok(e.pendulumCandidates(0).some(q=>q.uid===m.uid));
});
test('Majester requires Pendulum materials and Cyber Infinity retains both LIGHT and Machine restrictions',()=>{
 const e=fresh(),a=fieldCard(e,0,'Performage Plushfire'),b=fieldCard(e,0,'Battle Ox'),m=put(e,0,'extra','Majester Paladin, the Ascending Dracoslayer');assert.equal(e.xyzValid(0,m,[a,b]),false);const d=D.cardByName('Cyber Dragon Infinity');assert.equal(d.xyzAttribute,'光');assert.equal(d.xyzRace,'机械族');
});
module.exports={act,drain,use};
