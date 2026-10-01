/* Diagnostic deck deliberately exercises the new effects; it is not a sixth
 * historical preset. Complete games are replayed from their initial snapshot. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {DuelEngine}=require('../src/advanced-engine.js'),D=global.DuelData;
const id=n=>D.cardByName(n).id;
const triples=['Draconnet','Backup Secretary','Cyberse Converter','RAM Clouder','ROM Cloudia','Flame Bufferlo','Dotscaper','Launcher Commander','Motivating Captain','Hack Worm'];
const doubles=['Back to the Front','Oops!','Gravity Lash','Hey, Trunade!','Flamvell Guard'];
const extra=['Code Talker','Underclock Taker','Link Spider','Decode Talker','Borreload Dragon'].flatMap(n=>Array(3).fill(id(n)));
const spec={id:'custom-expansion-2017-diagnostic',name:'2017 effect integration fixture',cards:[...triples.flatMap(n=>Array(3).fill(id(n))),...doubles.flatMap(n=>Array(2).fill(id(n)))],extra,side:[]};
assert.equal(global.DuelDecks.analyze(spec).valid,true);
const out=path.resolve('output/rollout-2017/expansion-integration');fs.mkdirSync(out,{recursive:true});
const report={matches:[],errors:[],effects:{}};
const modes=['off','liberation','vacuum','echo'];
for(const [i,ruleMode] of modes.entries()){
 const seed=20172000+i;let e=new DuelEngine({deck:spec.id,opponentDeck:'trickstar-2017',deckSpecs:[spec,D.DECKS['trickstar-2017']],seed,first:i%2,ruleMode});const start=e.snapshot(),actions=[];
 try{
  while(e.state.winner===null&&actions.length<3000){const a=e.aiNext();assert.ok(a);const r=e.act(a);assert.equal(r.ok,true,JSON.stringify(a)+' '+r.error);actions.push(a);if(a.key)report.effects[a.key]=(report.effects[a.key]||0)+1;e.assertState();if(actions.length===30){const restored=DuelEngine.restore(e.snapshot());assert.deepEqual(restored.snapshot(),e.snapshot());e=restored;}}
  assert.notEqual(e.state.winner,null,'game did not finish');const replay=DuelEngine.restore(start);for(const a of actions)assert.equal(replay.act(a).ok,true);assert.deepEqual(replay.snapshot(),e.snapshot());report.matches.push({seed,ruleMode,winner:e.state.winner,turns:e.state.turn,actions:actions.length,replay:true});console.log('OK',ruleMode,actions.length);
 }catch(error){report.errors.push({seed,ruleMode,error:error.stack});fs.writeFileSync(path.join(out,'failure-'+i+'.json'),JSON.stringify({start,actions,snapshot:e.snapshot()}));console.error(error);}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
}
if(report.errors.length)process.exitCode=1;
