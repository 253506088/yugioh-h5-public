const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {DuelEngine}=require('../src/advanced-engine.js'),T=require('../src/tournament.js');
const out=path.resolve(__dirname,'../output/gx-simulation');fs.mkdirSync(out,{recursive:true});
const decks=Object.values(global.DuelData.DECKS).filter(d=>d.year).map(d=>d.id),report={at:new Date().toISOString(),matches:[],errors:[],effects:{}};let index=0;
for(const deck of decks)for(const opponent of ['blue','dark','hero','gravekeeper-2002'])for(const first of [0,1]){
 const seed=20060800+index++,e=new DuelEngine({deck,opponentDeck:opponent,first,seed});let steps=0;
 try{while(e.state.winner===null&&steps++<1800){const action=e.aiNext();assert.ok(action,'AI returned no action');const result=e.act(action);assert.ok(result.ok,JSON.stringify(action)+' '+result.error);if(action.key)report.effects[action.key]=(report.effects[action.key]||0)+1;e.assertState();}assert.notEqual(e.state.winner,null,'did not finish');report.matches.push({deck,opponent,first,seed,steps,turns:e.state.turn,winner:e.state.winner});console.log('OK',deck,opponent,first,steps,'steps');}
 catch(error){report.errors.push({deck,opponent,first,seed,steps,error:error.stack});fs.writeFileSync(path.join(out,'failure-'+seed+'.json'),JSON.stringify(e.snapshot()));console.error('FAIL',deck,error.message);}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
}
if(!report.errors.length){const roster=[...decks,'blue','dark','hero','gravekeeper-2002','chaos-2003','level-2004','darkworld-2005'];const cup=T.create({deckIds:roster,seed:6082006,concurrency:4,pace:'turbo'});cup.resume();let guard=0;while(cup.status==='running'&&guard++<40000)cup.advance(1);assert.equal(cup.status,'completed',JSON.stringify(cup.matches.filter(m=>m.status==='error')));const game=cup.matches.at(-1).games.at(-1),cursor=new T.ReplayCursor(game);while(cursor.next()){}assert.deepEqual(cursor.engine.snapshot(),game.final);report.tournament={participants:roster.length,played:cup.progress().played,status:cup.status,finalReplayMatches:true};}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));if(report.errors.length)process.exitCode=1;
