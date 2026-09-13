const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {DuelEngine}=require('../src/advanced-engine.js'),T=require('../src/tournament.js');
const out=path.resolve(__dirname,'../output/years-simulation');fs.mkdirSync(out,{recursive:true});
const report={at:new Date().toISOString(),matches:[],errors:[]};let runIndex=0;
for(const deck of ['chaos-2003','level-2004','darkworld-2005'])for(const opponent of ['blue','dark','hero','gravekeeper-2002'])for(const first of [0,1]){
 const seed=2003000+runIndex++,e=new DuelEngine({deck,opponentDeck:opponent,first,seed});let steps=0;
 try{while(e.state.winner===null&&steps++<1600){const action=e.aiNext();assert.ok(action,'AI chose no action');const r=e.act(action);assert.ok(r.ok,JSON.stringify(action)+' '+r.error);e.assertState();}assert.notEqual(e.state.winner,null,'duel did not finish');report.matches.push({deck,opponent,first,seed,steps,turns:e.state.turn,winner:e.state.winner});console.log('OK',deck,opponent,first,'turn',e.state.turn,'steps',steps);}
 catch(error){report.errors.push({deck,opponent,first,seed,steps,error:error.stack});fs.writeFileSync(path.join(out,'failure-'+seed+'.json'),JSON.stringify(e.snapshot(),null,2));console.error(error.message);break;}
}
if(!report.errors.length){const ids=['chaos-2003','level-2004','darkworld-2005','blue','dark','hero','gravekeeper-2002','early-ritual'];const cup=T.create({deckIds:ids,seed:2050913,concurrency:4});cup.resume();let guard=0;while(cup.status==='running'&&guard++<25000)cup.advance(1);assert.equal(cup.status,'completed',JSON.stringify(cup.matches.filter(m=>m.status==='error')));const game=cup.matches.at(-1).games.at(-1),cursor=new T.ReplayCursor(game);while(cursor.next()){}assert.deepEqual(cursor.engine.snapshot(),game.final);report.tournament={played:cup.progress().played,status:cup.status,finalReplayMatches:true};}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));if(report.errors.length)process.exitCode=1;
