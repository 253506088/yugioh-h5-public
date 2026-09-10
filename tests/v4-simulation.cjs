const fs=require('node:fs'),path=require('node:path');
const {DuelEngine}=require('../src/advanced-engine.js'),D=global.DuelData;
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/v4-simulation',new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(out,{recursive:true});
const presets=Object.values(D.DECKS).filter(d=>d.preset).map(d=>d.id),matches=[];
for(const [i,deck] of presets.entries()){matches.push({deck:'early-ritual',opponentDeck:deck,seed:4001+i*113,first:i%2});matches.push({deck,opponentDeck:'early-fusion',seed:9017+i*157,first:(i+1)%2});}
let randomState=19992001;const random=()=>{randomState^=randomState<<13;randomState^=randomState>>>17;randomState^=randomState<<5;return (randomState>>>0)/4294967296;};
function shuffled(list){const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
for(const year of [1999,2000,2001,2002])for(let variation=0;variation<4;variation++){
 const pool=D.CARD_LIST.filter(c=>c.early&&c.releaseYear<=year&&!c.notCollectible),names=new Set(),cards=[];
 const pick=(filter,n)=>{for(const c of shuffled(pool.filter(filter))){const key=(c.nameAlias||c.officialName).toLowerCase();if(names.has(key))continue;names.add(key);cards.push(c.id);if(--n===0)break;}if(n)throw new Error('Insufficient simulation fixture cards');};
 pick(c=>c.type==='monster'&&!c.effect&&c.level<=4,10);pick(c=>c.type==='monster'&&c.effect&&!c.noNormal&&c.level<=4,10);pick(c=>c.type==='spell',12);pick(c=>c.type==='trap',8);
 const id='custom-simulation-'+year+'-'+variation;D.DECKS[id]={id,name:'年度混合测试 '+year+' / '+variation,en:'SYNTHETIC DECK COMPOSITION',player:'年度测试',cards,extra:shuffled(pool.filter(c=>c.type==='fusion')).slice(0,15).map(c=>c.id)};
 matches.push({deck:id,opponentDeck:variation%2?'early-fusion':'early-ritual',seed:year*13+variation,first:variation%2});
}
const report={at:new Date().toISOString(),matches:matches.length,completed:0,failures:[],totalActions:0,maxTurn:0,summons:{ritual:0,fusion:0,synchro:0,xyz:0,link:0,pendulum:0},archive:out};
for(const [i,options] of matches.entries()){
 const e=new DuelEngine(options),trace=[];
 try{let steps=0;while(e.state.winner===null&&steps++<1800){const action=e.aiNext();trace.push({turn:e.state.turn,active:e.state.active,phase:e.state.phase,pending:e.state.pending?.kind,action});if(trace.length>50)trace.shift();if(!action)throw new Error('AI returned no action');const result=e.act(action);if(!result.ok)throw new Error(result.error);for(const event of result.events){const via=event.summonKind||event.kind;if(Object.hasOwn(report.summons,via))report.summons[via]++;}if(steps%23===0){const restored=DuelEngine.restore(e.snapshot());if(JSON.stringify(restored.snapshot())!==JSON.stringify(e.snapshot()))throw new Error('State changed during save/restore');}}
  if(e.state.winner===null)throw new Error('Match did not terminate within 1800 actions');report.completed++;report.totalActions+=steps;report.maxTurn=Math.max(report.maxTurn,e.state.turn);console.log('OK',i+1,options.deck,'vs',options.opponentDeck,'turn',e.state.turn);
 }catch(error){const item={match:i+1,...options,error:error.message};report.failures.push(item);fs.writeFileSync(path.join(out,'failure-'+(i+1)+'.json'),JSON.stringify({...item,stack:error.stack,trace,snapshot:e.snapshot()},null,2));console.error('FAIL',i+1,error.message);}
}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(root,'output/v4-simulation-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.failures.length)process.exitCode=1;
