const test=require('node:test');
const {assert,D,E,DuelEngine,put,fresh,fieldCard,act,drain,use,trigger,source}=require('./chronicle-2015-helpers.cjs');
const fm=(e,m)=>['monsters','extraMonster'].includes(e.find(m.uid)?.zone);
test('2016 data preserves 651 identities and Synchro Pendulum metadata',async()=>{
 const rows=D.CARD_LIST.filter(c=>c.releaseYear===2016);assert.equal(rows.length,651);assert.equal(rows.filter(c=>c.existing).length,16);assert.equal(D.cardByName('Performapal Momoncarpet').flip,true);
 for(const n of ['Nirvana High Paladin','Clear Wing Fast Dragon']){const c=D.cardByName(n);assert.equal(c.type,'synchro');assert.equal(c.pendulum,true);assert.ok(c.synchro);assert.ok(c.pendulumDescription);}
 const {materialArchetypeReferences}=await import('../scripts/lib/archetype-references.mjs');assert.deepEqual(materialArchetypeReferences([D.cardByName('Chaos Form')]).filter(r=>r.kind==='ritualSeriesAny').map(r=>r.name),['Chaos','Black Luster Soldier']);
 const fs=require('node:fs'),path=require('node:path'),acorn=require('acorn'),I=require('../src/i18n.js'),values=new Set();function walk(n){if(!n||typeof n!=='object')return;if(n.type==='Literal'&&typeof n.value==='string'&&/[\u3400-\u9fff]/.test(n.value))values.add(n.value);for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}for(const f of fs.readdirSync(path.join(__dirname,'../src')).filter(f=>/^effects-2016.*\.js$/.test(f)))walk(acorn.parse(fs.readFileSync(path.join(__dirname,'../src',f),'utf8'),{ecmaVersion:'latest'}));for(const language of ['en','ja']){I.setLanguage(language);for(const value of values)assert.equal(I.translated(value).untranslated,false,language+' '+value);}I.setLanguage('zh-CN');
});
test('Sage searches only a different Level 1 LIGHT Tuner',()=>{
 const e=fresh(),s=put(e,0,'hand','Sage with Eyes of Blue'),ok=put(e,0,'deck','The White Stone of Ancients'),bad=put(e,0,'deck','Blue-Eyes White Dragon');act(e,{type:'summon',uid:s.uid});drain(e);assert.equal(e.find(ok.uid).zone,'hand');assert.equal(e.find(bad.uid).zone,'deck');
});
test('Sage discards itself and sends its target before recruiting a Blue-Eyes',()=>{
 const e=fresh(),s=put(e,0,'hand','Sage with Eyes of Blue'),m=fieldCard(e,0,'Master with Eyes of Blue'),b=put(e,0,'deck','Blue-Eyes White Dragon');use(e,s,'y16-recruit',{target:[m.uid]},p=>p.kind==='choice'&&p.candidates?.some(o=>o.uid===b.uid)?{type:'choose',uids:[b.uid]}:null);assert.equal(e.find(s.uid).zone,'grave');assert.equal(e.find(m.uid).zone,'grave');assert.ok(fm(e,b));assert.equal(s.earlySent.kind,'cost-discard');
});
test('Sage does not recruit if liberation replaces the target send',()=>{
 const e=fresh(),s=put(e,0,'hand','Sage with Eyes of Blue'),m=fieldCard(e,0,'Master with Eyes of Blue'),b=put(e,0,'deck','Blue-Eyes White Dragon');e.state.ruleMode={id:'liberation',version:1,players:[{},{}]};use(e,s,'y16-recruit',{target:[m.uid]});assert.equal(e.find(m.uid).zone,'banished');assert.equal(e.find(b.uid).zone,'deck');
});
test('Master returns itself as cost, sends its target, then revives another Blue-Eyes',()=>{
 const e=fresh(),s=put(e,0,'grave','Master with Eyes of Blue'),m=fieldCard(e,0,'Sage with Eyes of Blue'),b=put(e,0,'grave','Blue-Eyes White Dragon');use(e,s,'y16-recruit',{target:[m.uid]});assert.equal(e.find(s.uid).zone,'deck');assert.equal(e.find(m.uid).zone,'grave');assert.ok(fm(e,b));
});
test('Ancients recruits in either End Phase and survives JSON restore',()=>{
 let e=fresh();const s=put(e,0,'hand','The White Stone of Ancients'),b=put(e,0,'deck','Blue-Eyes White Dragon');e.move(s.uid,'grave',{kind:'effect-send',source:source(e)});e=DuelEngine.restore(e.snapshot());e.state.active=1;trigger(e,()=>e.emit({type:'end-phase',owner:1}),p=>p.kind==='choice'&&p.candidates?.some(o=>o.uid===b.uid)?{type:'choose',uids:[b.uid]}:null);assert.ok(fm(e,b));
});
test('Dragon Spirit is Normal only in hand or grave and banishes the actual backrow',()=>{
 const e=fresh(),s=put(e,0,'hand','Dragon Spirit of White'),t=put(e,1,'spells','Mirror Force',{faceUp:false});assert.equal(e.isNormalMonster(s),true);trigger(e,()=>e.special(0,s.uid,{via:'effect'}));assert.equal(e.find(t.uid).zone,'banished');assert.equal(e.isNormalMonster(s),false);
});
test('Return of the Dragon Lords revives then protects a Dragon exactly once',()=>{
 const e=fresh(),s=put(e,0,'hand','Return of the Dragon Lords'),b=put(e,0,'grave','Blue-Eyes White Dragon');use(e,s,'cast',{target:[b.uid]});assert.ok(fm(e,b));assert.equal(e.destroy(b.uid,source(e)),false);assert.equal(e.find(s.uid).zone,'banished');assert.equal(e.destroy(b.uid,source(e)),true);
});
test('Spirit Dragon sends itself as tribute and the delayed destruction survives restore',()=>{
 let e=fresh();const s=fieldCard(e,0,'Blue-Eyes Spirit Dragon',{summonKind:'synchro',properlySummoned:true}),b=put(e,0,'extra','Azure-Eyes Silver Dragon');use(e,s,'y16-tag');assert.equal(e.find(s.uid).zone,'grave');assert.ok(fm(e,b));e=DuelEngine.restore(e.snapshot());trigger(e,()=>e.emit({type:'end-phase',owner:0}));assert.ok(fm(e,b),'Azure-Eyes protects itself from delayed destruction');
});
test('Crystal Wing negates a monster effect, destroys its source and gains printed ATK',()=>{
 const e=fresh(),s=fieldCard(e,1,'Crystal Wing Synchro Dragon'),m=fieldCard(e,0,'Blue-Eyes Alternative White Dragon',{properlySummoned:true});act(e,{type:'activate',uid:m.uid,key:m.id+'::y15-destroy',choices:{target:[s.uid]}});act(e,{type:'respond',uid:s.uid,key:s.id+'::y16-negate'});drain(e);assert.ok(fm(e,s));assert.equal(e.find(m.uid).zone,'grave');assert.equal(e.attackValue(s),6000);
});
test('Hope Harbinger negates a field spell effect and attaches the physical card',()=>{
 const e=fresh(),s=fieldCard(e,1,'Number 38: Hope Harbinger Dragon Titanic Galaxy'),m=put(e,0,'hand','Dark Hole');act(e,{type:'activate',uid:m.uid,key:m.id+'::cast'});act(e,{type:'respond',uid:s.uid,key:s.id+'::y16-negate'});drain(e);assert.ok(fm(e,s));assert.equal(e.find(m.uid).zone,'overlays');assert.equal(s.overlays[0].uid,m.uid);
});
test('2016 material rules reject false Elysium, Starving Venom, Metalfoes and Gemini materials',()=>{
 const e=fresh(),m=fieldCard(e,0,'Blue-Eyes White Dragon'),t=put(e,0,'hand','Dark Magician');assert.equal(e.materialMatches(m,{maxAtk:2500}),false);assert.equal(e.materialMatches(m,{summonedFromExtra:true}),false);assert.equal(e.materialMatches(t,{fieldOnly:true}),false);assert.equal(e.materialMatches(m,{originalMinLevel:9}),false);assert.equal(e.materialMatches(m,{effect:true}),false);
 const x=put(e,0,'extra','Vola-Chemicritter Methydraco'),b=fieldCard(e,0,'Blue-Eyes White Dragon');assert.equal(e.xyzValid(0,x,[m,b]),false);
});
test('Numeron Dragon requires two Number Xyz with identical names and ranks',()=>{
 const e=fresh(),x=put(e,0,'extra','Number 100: Numeron Dragon'),a=fieldCard(e,0,'Number 39: Utopia'),b=fieldCard(e,0,'Number 39: Utopia'),c=fieldCard(e,0,'Number 101: Silent Honor ARK');assert.equal(e.xyzValid(0,x,[a,b]),true);assert.equal(e.xyzValid(0,x,[a,c]),false);
});
test('Azure-Eyes protects only the dragons present at resolution until the following turn ends',()=>{
 const e=fresh(),a=put(e,0,'extra','Azure-Eyes Silver Dragon');trigger(e,()=>e.special(0,a.uid,{via:'effect'}));const b=fieldCard(e,0,'Blue-Eyes White Dragon');assert.equal(e.destroy(b.uid,source(e)),true);assert.equal(e.destroy(a.uid,source(e)),false);e.state.turn+=2;assert.equal(e.destroy(a.uid,source(e)),true);
});
