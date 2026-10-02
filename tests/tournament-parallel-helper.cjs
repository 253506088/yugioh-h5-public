/* Test harness: independent matches use the production Tournament.stepMatch.
 * Round barriers, seeds, entrants, limits and propagation remain authoritative.
 * Every game is replayed inside its worker before the result is accepted. */
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const assert=require('node:assert/strict');
const T=require('../src/tournament.js');
if(!isMainThread){
 try{
  const cup=T.Tournament.restore(workerData.snapshot),match=cup.match(workerData.matchId);
  let steps=0;
  while(['ready','running'].includes(match.status)&&steps++<10000)cup.stepMatch(match);
  assert.equal(match.status,'complete',match.reason||'Match failed to finish');
  for(const game of match.games){
   assert.ok(!game.error,game.error);
   assert.ok(!['limit','draw-limit'].includes(game.verdict?.kind),'Protection verdict');
   const replay=new T.ReplayCursor(game);while(replay.next()){}
   assert.deepEqual(replay.engine.snapshot(),game.final);
  }
  parentPort.postMessage({match,replays:match.games.length});
 }catch(error){parentPort.postMessage({error:error.stack});}
}else{
 module.exports=async function runBracket(cup,onProgress=()=>{}){
  let replayed=0;
  while(cup.status==='running'){
   const matches=cup.eligible();assert.ok(matches.length,'Bracket stalled');
   const snapshot=cup.snapshot(),workers=[];
   try{
    const results=await Promise.all(matches.map(match=>new Promise((resolve,reject)=>{
     const worker=new Worker(__filename,{workerData:{snapshot,matchId:match.id}});workers.push(worker);
     worker.once('message',result=>result.error?reject(new Error(result.error)):resolve(result));
     worker.once('error',reject);worker.once('exit',code=>{if(code)reject(new Error('Match worker exit '+code));});
    })));
    for(const result of results){const index=cup.matches.findIndex(m=>m.id===result.match.id);assert.ok(index>=0);cup.matches[index]=result.match;replayed+=result.replays;}
    cup.propagate();cup.touch();onProgress(cup,replayed);
   }finally{await Promise.all(workers.map(w=>w.terminate()));}
  }
  assert.equal(cup.status,'completed');return replayed;
 };
}
