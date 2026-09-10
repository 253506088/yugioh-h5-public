const fs=require('node:fs');
const path=require('node:path');
const {DuelEngine}=require('../src/advanced-engine.js');
const {DECKS}=global.DuelData;
const list=Object.keys(DECKS).filter(k=>DECKS[k].preset);
const matches=Number(process.env.DUEL_MATCHES||20);
const runDir=path.join(__dirname,'../output/v2-tests','run-'+new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(runDir,{recursive:true});
const report={matches,completed:0,failures:[],wins:{},maxTurn:0,maxActions:0,actions:0,summons:{synchro:0,xyz:0,pendulum:0,special:0},decks:list};
for(let i=0;i<matches;i++){
  const round=Math.floor(i/list.length),deck=list[i%list.length],opponent=list[(i+round+1)%list.length],g=new DuelEngine({deck,opponentDeck:opponent,first:(i+round)%2,seed:1733+i*191,difficulty:'standard'});
  const trace=[];
  try{
    let steps=0;
    while(g.state.winner===null&&steps++<1500){
      const action=g.aiNext();if(!action)throw new Error('AI returned no action');
      trace.push({turn:g.state.turn,active:g.state.active,phase:g.state.phase,pending:g.state.pending?.kind,action});if(trace.length>24)trace.shift();
      const result=g.act(action);if(!result.ok)throw new Error(result.error);
      for(const ev of result.events)if(Object.hasOwn(report.summons,ev.kind))report.summons[ev.kind]++;
    }
    if(g.state.winner===null)throw new Error('Unfinished after 1500 actions');
    report.completed++;report.actions+=steps;report.maxTurn=Math.max(report.maxTurn,g.state.turn);report.maxActions=Math.max(report.maxActions,steps);
    const winner=g.state.winner==='draw'?'draw':g.state.players[g.state.winner].deckId;report.wins[winner]=(report.wins[winner]||0)+1;
    console.log('OK',i+1,deck,'vs',opponent,'winner',winner,'turn',g.state.turn,'actions',steps);
  }catch(error){
    const failure={match:i+1,deck,opponent,error:error.stack,trace,snapshot:g.snapshot()};report.failures.push({match:i+1,deck,opponent,error:error.message});
    fs.writeFileSync(path.join(runDir,'failure-'+(i+1)+'-'+deck+'.json'),JSON.stringify(failure,null,2));
    console.error('FAIL',i+1,deck,opponent,error.message);
  }
}
fs.mkdirSync(path.join(__dirname,'../output/v2-tests'),{recursive:true});
fs.writeFileSync(path.join(runDir,'simulation-report.json'),JSON.stringify(report,null,2));
fs.writeFileSync(path.join(__dirname,'../output/v2-tests/simulation-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.failures.length)process.exitCode=1;
