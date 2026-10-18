/* One complete game per historical annual build, including the newly filled
 * early years. The separate 2025 matrix covers all five new strategies. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {DuelEngine}=require('../src/advanced-engine.js'),D=global.DuelData;
const decks=Object.values(D.DECKS).filter(d=>d.year>=1999&&d.year<=2024).sort((a,b)=>a.year-b.year||a.id.localeCompare(b.id));assert.equal(decks.length,130);
const shard=process.env.DUEL_SHARD===undefined?null:Number(process.env.DUEL_SHARD);assert.ok(shard===null||Number.isInteger(shard)&&shard>=0&&shard<4);
const out=path.resolve(process.env.DUEL_RUN_DIR||path.resolve(__dirname,'../output/rollout-2025/final'),'historical'+(shard===null?'':'-'+shard));fs.mkdirSync(out,{recursive:true});const report={cases:130,shard,matches:[],errors:[]};
for(const [i,d]of decks.entries()){
 if(shard!==null&&i%4!==shard)continue;
 const peers=decks.filter(q=>q.year===d.year),opponent=peers[(peers.findIndex(q=>q.id===d.id)+1)%peers.length],seed=202510170+i;
 let e=new DuelEngine({deck:d.id,opponentDeck:opponent.id,first:i%2,seed,ruleMode:'off'}),start=e.snapshot(),actions=[],lastAction;
 try{
  while(e.state.winner===null&&actions.length<3000){lastAction=e.aiNext();assert.ok(lastAction);const r=e.act(lastAction);assert.equal(r.ok,true,JSON.stringify(lastAction)+' '+r.error);actions.push(lastAction);e.assertState();if(actions.length===24){e=DuelEngine.restore(JSON.parse(JSON.stringify(e.snapshot())));}if(actions.length%200===0)console.log('STEP',i,d.id,actions.length,e.state.turn);}
  assert.notEqual(e.state.winner,null,'Match did not complete');const replay=DuelEngine.restore(start);for(const a of actions)assert.equal(replay.act(a).ok,true);assert.deepEqual(replay.snapshot(),e.snapshot());
  report.matches.push({case:i,deck:d.id,opponent:opponent.id,year:d.year,seed,steps:actions.length,turns:e.state.turn,winner:e.state.winner,replay:true});console.log('OK',i,d.id,actions.length);
 }catch(error){report.errors.push({case:i,deck:d.id,error:error.stack});fs.writeFileSync(path.join(out,'failure-'+i+'.json'),JSON.stringify({start,actions,lastAction,snapshot:e.snapshot(),error:error.stack}));console.error('FAIL',i,d.id,error.message);}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
}
if(report.errors.length)process.exitCode=1;
