const fs=require('node:fs');
const path=require('node:path');
const {DuelEngine}=require('../src/advanced-engine.js');
const T=global.DuelDecks,{CARD_LIST,isMonster,isExtra}=global.DuelData;
const out=path.join(__dirname,'../output/v2-tests','mixed-'+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(out,{recursive:true});
const report={matches:30,completed:0,failures:[],actions:0,maxTurn:0};
let seed=88129;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const shuffle=list=>[...list].sort(()=>random()-.5);
function makeDeck(index){
  const pool=CARD_LIST.filter(c=>!c.notCollectible),monsters=pool.filter(c=>isMonster(c)&&!isExtra(c)&&!c.noNormal),spells=pool.filter(c=>c.type==='spell'),traps=pool.filter(c=>c.type==='trap');
  const cards=[...shuffle(monsters).slice(0,10).flatMap(c=>[c.id,c.id]),...shuffle(spells).slice(0,6).flatMap(c=>[c.id,c.id]),...shuffle(traps).slice(0,4).flatMap(c=>[c.id,c.id])];
  return T.save({name:'Mixed regression '+index,cards,extra:shuffle(pool.filter(isExtra)).slice(0,15).map(c=>c.id)}).id;
}
for(let i=0;i<report.matches;i++){
  const id=makeDeck(i),g=new DuelEngine({deck:id,opponentDeck:['hero','blackwing','junk','utopia','qliphort','exodia','cyber','crystron','blue','dark'][i%10],first:i%2,seed:3171+i*137});
  const trace=[];
  try{
    let n=0;while(g.state.winner===null&&n++<1600){const a=g.aiNext();trace.push({turn:g.state.turn,pending:g.state.pending?.kind,action:a});if(trace.length>25)trace.shift();if(!a)throw new Error('no action');const r=g.act(a);if(!r.ok)throw new Error(r.error);}
    if(g.state.winner===null)throw new Error('unfinished');report.completed++;report.actions+=n;report.maxTurn=Math.max(report.maxTurn,g.state.turn);console.log('OK mixed',i+1,'turn',g.state.turn,'actions',n);
  }catch(e){report.failures.push({match:i+1,error:e.message});fs.writeFileSync(path.join(out,'failure-'+i+'.json'),JSON.stringify({error:e.stack,trace,snapshot:g.snapshot()},null,2));console.error('FAIL mixed',i+1,e.message);}
}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,out},null,2));if(report.failures.length)process.exitCode=1;
