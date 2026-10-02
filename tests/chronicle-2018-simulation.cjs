/* Real 2018 preset integration: complete replay and JSON restoration. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {DuelEngine}=require('../src/advanced-engine.js'),D=global.DuelData;
const decks=Object.values(D.DECKS).filter(d=>d.year===2018);
const shard=process.env.DUEL_SHARD===undefined?null:Number(process.env.DUEL_SHARD),shards=4;assert.ok(shard===null||Number.isInteger(shard)&&shard>=0&&shard<shards);
const cases=decks.flatMap(d=>['blue-eyes-2016','zoodiac-2016'].flatMap(opponent=>[0,1].map(first=>({d,opponent,first,ruleMode:'off'}))));
for(const [i,r] of global.DuelRuleModes.RULES.entries())cases.push({d:decks[i%decks.length],opponent:i%2?'blue-eyes-2016':'zoodiac-2016',first:i%2,ruleMode:r.id});
const out=path.resolve(__dirname,'../output/rollout-2018/integration'+(process.env.DUEL_CASE?'-case-'+process.env.DUEL_CASE:shard===null?'':'-'+shard));fs.mkdirSync(out,{recursive:true});
const report={cases:cases.length,shard,matches:[],errors:[],effects:{}};
for(const [i,c] of cases.entries()){
 if(shard!==null&&i%shards!==shard||process.env.DUEL_CASE&&i!==Number(process.env.DUEL_CASE))continue;
 const seed=201810020+i;let e=new DuelEngine({deck:c.d.id,opponentDeck:c.opponent,deckSpecs:[c.d,D.DECKS[c.opponent]],first:c.first,seed,ruleMode:c.ruleMode}),start=e.snapshot(),actions=[],lastAction,lastTurn=-1;const repetitions=new Map();
 try{
  while(e.state.winner===null&&actions.length<3000){if(process.env.DUEL_DEBUG)console.log('STEP',i,actions.length,e.state.turn,e.state.phase,e.state.pending?.kind);lastAction=e.aiNext();assert.ok(lastAction);if(lastTurn!==e.state.turn){repetitions.clear();lastTurn=e.state.turn;}if(lastAction.type!=='pass'){const key=JSON.stringify(lastAction),n=(repetitions.get(key)||0)+1;repetitions.set(key,n);assert.ok(n<=40,'Repeated action without turn progress: '+key);}const result=e.act(lastAction);assert.equal(result.ok,true,JSON.stringify(lastAction)+' '+result.error);actions.push(lastAction);if(lastAction.key)report.effects[lastAction.key]=(report.effects[lastAction.key]||0)+1;e.assertState();if(actions.length===24){const copy=DuelEngine.restore(e.snapshot());assert.deepEqual(copy.snapshot(),e.snapshot());e=copy;}}
  assert.notEqual(e.state.winner,null,'Match did not finish');const replay=DuelEngine.restore(start);for(const action of actions)assert.equal(replay.act(action).ok,true);assert.deepEqual(replay.snapshot(),e.snapshot());
  report.matches.push({case:i,seed,deck:c.d.id,opponent:c.opponent,first:c.first,ruleMode:c.ruleMode,steps:actions.length,turns:e.state.turn,winner:e.state.winner,replay:true});console.log('OK',i,c.d.id,c.ruleMode,actions.length);
 }catch(error){report.errors.push({case:i,seed,deck:c.d.id,ruleMode:c.ruleMode,error:error.stack});fs.writeFileSync(path.join(out,'failure-'+i+'.json'),JSON.stringify({lastAction,actions,start,snapshot:e.snapshot(),error:error.stack}));console.error('FAIL',i,c.d.id,error.message);}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
}
if(report.errors.length)process.exitCode=1;
