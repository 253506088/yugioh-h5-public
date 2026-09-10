const fs=require('node:fs'),path=require('node:path');
const {DuelEngine}=require('../src/advanced-engine.js');
const D=global.DuelData,list=Object.values(D.DECKS).filter(d=>d.preset).map(d=>d.id);
const out=path.join(__dirname,'../output/v3-tests','run-'+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(out,{recursive:true});
const count=Number(process.env.DUEL_MATCHES||44),report={matches:count,completed:0,failures:[],wins:{},summons:{link:0,synchro:0,xyz:0,pendulum:0,special:0},actions:0,maxTurn:0,source:'Tearlaments and Link integration'};
for(let i=0;i<count;i++){
  const opponent=list[Math.floor(i/2)%list.length],deck=i<22?'tearlaments':opponent,rival=i<22?opponent:'tearlaments',g=new DuelEngine({deck,opponentDeck:rival,first:i%2,seed:1871+i*191});const trace=[];
  try{let n=0;while(g.state.winner===null&&n++<2000){const a=g.aiNext();trace.push({turn:g.state.turn,active:g.state.active,phase:g.state.phase,pending:g.state.pending?.kind,action:a});if(trace.length>40)trace.shift();if(!a)throw new Error('No AI action');const r=g.act(a);if(!r.ok)throw new Error(r.error);for(const ev of r.events)if(Object.hasOwn(report.summons,ev.kind))report.summons[ev.kind]++;}if(g.state.winner===null)throw new Error('No result after 2000 actions');report.completed++;report.actions+=n;report.maxTurn=Math.max(report.maxTurn,g.state.turn);const winner=g.state.winner==='draw'?'draw':g.state.players[g.state.winner].deckId;report.wins[winner]=(report.wins[winner]||0)+1;console.log('OK',i+1,deck,'vs',rival,'win',winner,'turn',g.state.turn,'steps',n);
  }catch(error){report.failures.push({match:i+1,deck,rival,error:error.message});fs.writeFileSync(path.join(out,'failure-'+(i+1)+'.json'),JSON.stringify({error:error.stack,trace,snapshot:g.snapshot()},null,2));console.error('FAIL',i+1,error.message);}
}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(__dirname,'../output/v3-simulation-report.json'),JSON.stringify({...report,archive:out},null,2));console.log(JSON.stringify({...report,out},null,2));if(report.failures.length)process.exitCode=1;
