const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {DuelEngine}=require('../src/advanced-engine.js'),R=global.DuelRuleModes;
const out=path.resolve(__dirname,'../output/rule-modes');fs.mkdirSync(out,{recursive:true});
const reportName=process.env.DUEL_RULE?'simulation-'+process.env.DUEL_RULE:'simulation';
const results=[];
for(const [index,r] of R.RULES.entries()){
  if(process.env.DUEL_RULE&&process.env.DUEL_RULE!==r.id)continue;
  for(const mirror of [0,1,2]){
    if(process.env.DUEL_MIRROR&&Number(process.env.DUEL_MIRROR)!==mirror)continue;
    const e=new DuelEngine({deck:mirror===2?'performapal-performage-2015':mirror?'shaddoll-2014':'blue',opponentDeck:mirror===2?'tellarknight-2015':mirror?'nekroz-2014':'dark',first:mirror%2,seed:9000+index*13+mirror,ruleMode:r.id});
    let steps=0,restored=false,lastAction=null;const assertState=e.assertState;
    e.assertState=function(){try{return assertState.call(this);}catch(error){fs.writeFileSync(path.join(out,'invalid-'+r.id+'-'+mirror+'.json'),JSON.stringify({lastAction,steps,snapshot:this.snapshot()},null,2));throw error;}};
    try{
      while(e.state.winner===null&&steps<650&&e.state.turn<=45){
        const action=e.aiNext();lastAction=action;assert.ok(action,'AI returned no action');const result=e.act(action);assert.ok(result.ok,result.error+' '+JSON.stringify(action));steps++;
        if(steps===16){const copy=DuelEngine.restore(JSON.parse(JSON.stringify(e.snapshot())));assert.deepEqual(copy.state.ruleMode,e.state.ruleMode);assert.deepEqual(copy.snapshot().state,e.snapshot().state);restored=true;}
      }
      e.assertState();assert.notEqual(e.state.winner,null,'Duel failed to finish within 650 actions / 45 turns');
      results.push({rule:r.id,mirror,steps,turn:e.state.turn,winner:e.state.winner,restored});fs.writeFileSync(path.join(out,reportName+'-progress.json'),JSON.stringify(results,null,2));console.log('OK',r.id,mirror,steps,e.state.turn);
    }catch(error){fs.writeFileSync(path.join(out,'failed-'+r.id+'-'+mirror+'.json'),JSON.stringify({error:error.stack,snapshot:e.snapshot()},null,2));throw error;}
  }
}
fs.writeFileSync(path.join(out,reportName+'.json'),JSON.stringify({games:results.length,results},null,2));
