const test=require('node:test');
const {assert,D,E,fresh,put,fieldCard,use,trigger,source,act,drain}=require('./chronicle-2015-helpers.cjs');
const X=global.DuelChronicle;
const select=uid=>p=>p.kind==='choice'&&p.candidates.some(c=>c.uid===uid)?{type:'choose',uids:[uid]}:null;
for(const [name,series,expected]of [
 ['Heroic Challenger - Double Lance','HERO',false],['Hero Kid','HERO',false],['Skyscraper','Scrap',false],['XYZ-Dragon Cannon','Xyz',false],['Synchronized Realm','Synchron',false],['Cocoon of Evolution','Evol',false],
 ['Summoned Skull','Archfiend',true],['Lesser Fiend','Archfiend',true],['Celestial Sword - Eatos','Noble Arms',true],['Contrast HERO Chaos','Elemental HERO',true],['Invasion of Flames','Infestation',true],['Electric Virus','Worm',true],['Number 23: Lancelot, Dark Knight of the Underworld','Laundsallyn',true],['Steelswarm Cell','Evilswarm',true],['The Eye of Timaeus','Legendary Dragon',true],['The Fang of Critias','Legendary Dragon',true],['The Claw of Hermos','Legendary Dragon',true]
])test(name+' OCG membership: '+series,()=>{const c=D.cardByName(name);assert.ok(c,name);assert.equal(D.inArchetype(c,series),expected);assert.equal(X.series(c,series),expected);});
test('Stratos cannot search a Heroic Challenger masquerading as HERO',()=>{const e=fresh(),s=put(e,0,'hand','Elemental HERO Stratos'),bad=put(e,0,'deck','Heroic Challenger - Double Lance'),good=put(e,0,'deck','Destiny HERO - Malicious');act(e,{type:'summon',uid:s.uid});drain(e,p=>p.kind==='input'&&p.group.key==='mode'?{type:'choose',uids:['mode:search']}:select(good.uid)(p));assert.equal(e.find(good.uid).zone,'hand');assert.equal(e.find(bad.uid).zone,'deck');});
test('Generation Force searches Xyz spells but cannot search Xyz Agent',()=>{const e=fresh(),s=put(e,0,'hand','Generation Force');fieldCard(e,0,'Number 39: Utopia');const good=put(e,0,'deck','Xyz Unit'),bad=put(e,0,'deck','Xyz Agent');use(e,s,'cast',{},p=>{if(p.kind==='choice')assert.ok(!p.candidates.some(c=>c.uid===bad.uid));return select(good.uid)(p);});assert.equal(e.find(good.uid).zone,'hand');assert.equal(e.find(bad.uid).zone,'deck');});
test('Ophion uses Infestation membership and still excludes its monster member',()=>{const e=fresh(),x=fieldCard(e,0,'Evilswarm Ophion'),mat=put(e,0,'grave','Battle Ox'),q=put(e,0,'deck','Infestation Infection'),bad=put(e,0,'deck','Invasion of Flames');e.attach(x.uid,mat.uid,source(e));use(e,x,'era-effect',{},p=>{if(p.kind==='choice')assert.ok(!p.candidates.some(c=>c.uid===bad.uid));return select(q.uid)(p);});assert.equal(e.find(q.uid).zone,'hand');assert.equal(e.find(bad.uid).zone,'deck');});
test('Archfiend Heiress really searches a rule-treated member after being sent',()=>{const e=fresh(),h=fieldCard(e,0,'Archfiend Heiress'),q=put(e,0,'deck','Lesser Fiend');trigger(e,()=>e.move(h.uid,'grave',{kind:'effect-send',source:source(e)}),select(q.uid));assert.equal(e.find(q.uid).zone,'hand');});
test('Cyberload checks the printed Cyber Dragon material, not the Cyber deck theme',()=>{const e=fresh();for(const n of ['Cyber Twin Dragon','Cyber End Dragon','Chimeratech Rampage Dragon','Chimeratech Overdragon'])assert.equal(e.fusionAllowed(D.cardByName(n),'cyberload-fusion'),true,n);assert.equal(e.fusionAllowed(D.cardByName('Cyber Blader'),'cyberload-fusion'),false);});
test('Arsenal Summoner respects the five printed exceptions despite Guardian membership',()=>{const e=fresh(),s=fieldCard(e,0,'Arsenal Summoner'),good=put(e,0,'deck','Guardian Elma'),bad=put(e,0,'deck','Celtic Guardian');s.faceUp=false;trigger(e,()=>e.flipFaceUp(s.uid,{position:'attack'}),p=>{if(p.kind==='input')assert.ok(!p.group.candidates.some(c=>c.uid===bad.uid));return select(good.uid)(p);});assert.equal(e.find(good.uid).zone,'hand');assert.equal(e.find(bad.uid).zone,'deck');});

for(const rank of [4,5])test('Noble Knight Xyz materials accept both Laundsallyns at Level '+rank,()=>{
 const e=fresh(),a=fieldCard(e,0,'Ignoble Knight of Black Laundsallyn'),b=fieldCard(e,0,'Ignoble Knight of High Laundsallyn');
 if(rank===4)put(e,1,'spells','Stygian Dirge');
 const x=put(e,0,'extra',rank===4?'Artorigus, King of the Noble Knights':'Sacred Noble Knight of King Artorigus');
 assert.equal(e.level(a),rank);assert.equal(e.level(b),rank);
 assert.ok(e.xyzCombos(0,x).some(s=>s.materials.includes(a.uid)&&s.materials.includes(b.uid)));
 e.performXyz(0,x.uid,[a.uid,b.uid]);e.pump();drain(e);
 assert.equal(x.summonKind,'xyz');assert.deepEqual(new Set(x.overlays.map(m=>m.uid)),new Set([a.uid,b.uid]));
});
test('Galaxion accepts Kuriphoton after real level changes, but rejects wrong levels and non-Photon monsters',()=>{
 const e=fresh(),k=fieldCard(e,0,'Kuriphoton'),p=fieldCard(e,0,'Photon Thrasher'),bad=fieldCard(e,0,'Battle Ox'),x=put(e,0,'extra','Starliege Lord Galaxion');
 assert.equal(e.xyzValid(0,x,[k,p]),false);
 for(let i=0;i<3;i++)use(e,put(e,0,'hand','Star Changer'),'cast',{target:[k.uid],delta:['1']});
 assert.equal(e.level(k),4);assert.equal(e.xyzValid(0,x,[k,bad]),false);
 e.performXyz(0,x.uid,[k.uid,p.uid]);e.pump();drain(e);
 assert.equal(x.summonKind,'xyz');assert.deepEqual(new Set(x.overlays.map(m=>m.uid)),new Set([k.uid,p.uid]));
});
for(const goodPresent of [false,true])for(const kind of ['Galaxy','Junk','Onomat'])test(kind+' monster search excludes every same-series Spell/Trap; monster present: '+goodPresent,()=>{
 const e=fresh(),member=c=>kind==='Onomat'?['Gagaga','Gogogo','Dododo','Zubaba'].some(n=>D.inArchetype(c,n)):D.inArchetype(c,kind);
 const bad=D.CARD_LIST.filter(c=>!D.isMonster(c)&&member(c)).map(c=>put(e,0,'deck',c.id));assert.ok(bad.length);
 const good=goodPresent?put(e,0,'deck',({Galaxy:'Galaxy Knight',Junk:'Junk Forward',Onomat:'Gogogo Golem'})[kind]):null;
 const pick=p=>{const candidates=p.kind==='choice'?p.candidates:p.kind==='input'?p.group.candidates:[];assert.ok(!candidates.some(c=>bad.some(b=>b.uid===c.uid)));return good?select(good.uid)(p):null;};
 if(kind==='Galaxy'){
  const s=put(e,0,'hand','Galaxy Soldier');trigger(e,()=>e.special(0,s.uid,{via:'effect'}),pick);
 }else if(kind==='Junk'){
  const s=fieldCard(e,0,'Jet Synchron'),m=fieldCard(e,0,'Battle Ox'),x=put(e,0,'extra','Ally of Justice Catastor');
  trigger(e,()=>e.performSynchro(0,x.uid,[s.uid,m.uid]),pick);assert.equal(x.summonKind,'synchro');
 }else{
  const s=put(e,0,'hand','Onomatopaira');put(e,0,'hand','Battle Ox');
  if(good)use(e,s,'cast',{},pick);else assert.ok(!e.actionsFor(s.uid).some(a=>a.key===s.id+'::cast'));
 }
 if(good)assert.equal(e.find(good.uid).zone,'hand');
 for(const m of bad)assert.equal(e.find(m.uid).zone,'deck');
});
