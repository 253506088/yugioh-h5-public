const test=require('node:test');
const {assert,D,E,DuelEngine,fresh,put}=require('./gx-helpers.cjs');
const R=require('../src/rule-modes.js');
test('factored name matcher preserves longest literal matches for the complete three-language catalog',()=>{
 const compile=require('../src/literal-pattern.js'),locales=require('../src/card-locales.js');
 const words=[...new Set(Object.values(locales).flatMap(c=>Object.values(c.locales).map(t=>t.name)))];
 words.push('A+B','A+B (long)','[龙]','a.b','\\path','龍😀','龍😀王');
 const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const before=new RegExp([...words].sort((a,b)=>b.length-a.length).map(escape).join('|'),'g'),after=compile(words);
 const text=['不包含卡名的提示',...words.map(w=>'prefix '+w+' / '+w+' suffix')].join('\n');
 assert.deepEqual([...text.matchAll(after)].map(m=>[m[0],m.index]),[...text.matchAll(before)].map(m=>[m[0],m.index]));
 assert.equal(compile([]),null);
});
test('copy registration retains every original effect in the same order across all years',()=>{
 const copies=global.DuelChronicleCopies,hosts=new Set(copies.hosts);
 const original=Object.values(E.defs).filter(a=>!a.mode.startsWith('copied:'));
 assert.deepEqual([...E.originalDefinitions()],original);
 for(let year=1999;year<=2025;year++){
  const expected=original.filter(a=>!a.trigger&&!a.cardActivation&&!a.inherent&&!a.supersededByOriginal&&a.zones.includes('monsters')&&!hosts.has(a.id)&&D.CARDS[a.id]?.releaseYear===year);
  assert.deepEqual(copies.copyable(y=>y===year),expected,'copy sources for '+year);
 }
});
test('original effect index sees replacement and in-place changes without caching eligibility',()=>{
 const old=global.DuelChronicleCopies.copyable(()=>true)[0],keysBefore=[...E.originalDefinitions()].map(a=>a.key);
 const replacement=E.register(old.id,old.mode,{...old,supersededByOriginal:true});
 try{
  assert.notEqual(old,replacement);assert.ok([...E.originalDefinitions()].includes(replacement));
  assert.deepEqual([...E.originalDefinitions()].map(a=>a.key),keysBefore);
  assert.ok(!global.DuelChronicleCopies.copyable(()=>true).includes(replacement));
  delete replacement.supersededByOriginal;
  assert.ok(global.DuelChronicleCopies.copyable(()=>true).includes(replacement));
 }finally{
  E.register(old.id,old.mode,old);
  assert.deepEqual([...E.originalDefinitions()].map(a=>a.key),keysBefore);
 }
});
function drain(e,pick){let n=0;while(e.state.pending&&e.state.winner===null&&n++<200){const p=e.state.pending,a=pick?.(p)||(p.kind==='window'?{type:'pass'}:e.chooseAI(p)),r=e.act(a);assert.equal(r.ok,true,r.error);}assert.ok(n<200);}

for(const phase of ['main1','battle'])test('roulette2 compensates skipped main2 from '+phase+' before end effects/discard',()=>{
 const e=fresh();e.random=()=>.7;R.install(e,'roulette2');drain(e);e.state.phase=phase;
 const turn=e.state.turn,serial=e.state.ruleMode.lastRoll.serial;
 const before=e.snapshot(),clone=DuelEngine.restore(JSON.parse(JSON.stringify(before)));
 const result=e.act({type:'end'});assert.equal(result.ok,true,result.error);
 assert.equal(e.state.ruleMode.lastRoll.turn,turn);assert.equal(e.state.ruleMode.lastRoll.phase,'end');assert.equal(e.state.ruleMode.lastRoll.serial,serial+1);
 assert.equal(e.state.frame.kind,'end');assert.equal(e.state.frame.stage,0);assert.equal(e.state.pending.kind,'choice');
 const copied=clone.act({type:'end'});assert.equal(copied.ok,true,copied.error);assert.equal(clone.state.ruleMode.roulettePhase,turn+':main2');
});
test('roulette2 never adds another main2 roll after entering main2 normally',()=>{
 const e=fresh();e.random=()=>.7;R.install(e,'roulette2');drain(e);e.state.phase='battle';let r=e.act({type:'phase',phase:'main2'});assert.equal(r.ok,true,r.error);drain(e);
 const turn=e.state.turn,serial=e.state.ruleMode.lastRoll.serial;r=e.act({type:'end'});assert.equal(r.ok,true,r.error);
 assert.ok(e.state.ruleMode.lastRoll.turn>turn||e.state.ruleMode.lastRoll.serial===serial);assert.notEqual(e.state.ruleMode.lastRoll.phase,'end');
});
test('Qliphort Scout searches a Qli Trap as well as monsters and Saqlifice',()=>{
 const e=fresh(),scout=put(e,0,'spells','Qliphort Scout',{faceUp:true,slot:0}),trap=put(e,0,'deck','Qlimate Change'),lp=e.state.players[0].lp;
 const r=e.act({type:'activate',uid:scout.uid,key:scout.id+'::search'});assert.equal(r.ok,true,r.error);
 drain(e,p=>p.kind==='choice'&&p.candidates.some(c=>c.uid===trap.uid)?{type:'choose',uids:[trap.uid]}:null);
 assert.equal(e.find(trap.uid).zone,'hand');assert.equal(e.state.players[0].lp,lp-800);
});
test('expired live AI budget stops public-board search but still takes a legal lethal attack',()=>{
 const e=fresh(),blue=put(e,0,'monsters','Blue-Eyes White Dragon',{faceUp:true,position:'attack',summonTurn:0});
 e.state.phase='battle';e.state.players[1].lp=1000;e._aiTimeBudgetMs=0;
 const M=global.DuelAIMarginal,project=M.project;let projections=0;
 try{M.project=(...args)=>{projections++;return project(...args);};const action=e.aiNext();assert.equal(action.type,'attack');assert.equal(action.uid,blue.uid);assert.equal(projections,0);assert.equal(e.act(action).ok,true);assert.equal(e.state.winner,0);}
 finally{M.project=project;}
});
test('P2P frames reject markup in opaque identifiers, numbers and choice titles while preserving custom deck names',()=>{
 require('../src/pvp-public.js');require('../src/pvp-projection.js');require('../src/pvp-intent.js');require('../src/p2p.js');
 const P=global.DuelP2P,host=new P.Host([D.DECKS.blue,D.DECKS.dark],0),frame=host.frame(1);
 frame.state.players[0].deckSpec.name='自定义 <名字> & "引号"';assert.equal(P.validateFrame(frame),frame);
 for(const change of [f=>f.state.players[0].hand[0].uid='bad" data-test="x',f=>f.state.players[0].hand[0].publicStats.atk='<b>1</b>',f=>f.state.pending={kind:'choice',responder:0,title:'<b>标题</b>'},f=>Object.defineProperty(f,'__proto__',{value:{},enumerable:true})]){
  const forged=JSON.parse(JSON.stringify(frame));change(forged);assert.throws(()=>P.validateFrame(forged),/Invalid/);
 }
});
