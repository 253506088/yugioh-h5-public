const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {DuelEngine}=require('../src/advanced-engine.js'),T=require('../src/tournament.js');
const quick=process.argv.includes('--quick'),out=path.resolve(__dirname,'../output/chronicle-simulation');fs.mkdirSync(out,{recursive:true});
const decks=Object.values(global.DuelData.DECKS).filter(d=>d.year>=2009&&d.year<=2015).map(d=>d.id);
const report={at:new Date().toISOString(),quick,matches:[],errors:[],effects:{},summons:{}};let index=0;
const fixtures=decks.flatMap(deck=>(quick?['blue']:['blue','dark','hero','gladiator-2008']).flatMap(opponent=>(quick?[0]:[0,1]).map(first=>({deck,opponent,first}))));
if(!quick)for(let i=0;i<decks.length;i++)for(const first of [0,1])fixtures.push({deck:decks[i],opponent:decks[(i+1)%decks.length],first});
for(const fixture of fixtures){const {deck,opponent,first}=fixture,seed=200912000+index++,e=new DuelEngine({deck,opponentDeck:opponent,first,seed});let steps=0,lastAction;
 try{while(e.state.winner===null&&steps++<3000){lastAction=e.aiNext();assert.ok(lastAction,'AI returned no action');const result=e.act(lastAction);assert.ok(result.ok,JSON.stringify(lastAction)+' '+result.error);if(lastAction.key)report.effects[lastAction.key]=(report.effects[lastAction.key]||0)+1;e.assertState();}assert.notEqual(e.state.winner,null,'match did not finish within 3000 actions');for(const item of e.state.log.filter(l=>['synchro','xyz','ritual','special'].includes(l.kind)))report.summons[item.kind]=(report.summons[item.kind]||0)+1;report.matches.push({...fixture,seed,steps,turns:e.state.turn,winner:e.state.winner});console.log('OK',deck,opponent,first,steps,'actions');}
 catch(error){report.errors.push({...fixture,seed,steps,lastAction,error:error.stack});fs.writeFileSync(path.join(out,'failure-'+seed+'.json'),JSON.stringify({fixture,seed,lastAction,error:error.stack,snapshot:e.snapshot()}));console.error('FAIL',deck,opponent,first,error.message);}
 fs.writeFileSync(path.join(out,quick?'quick-report.json':'report.json'),JSON.stringify(report,null,2));
}
if(!quick&&!report.errors.length){
 const presets=Object.values(global.DuelData.DECKS).filter(d=>d.preset).map(d=>d.id),roster=Array.from({length:64},(_,i)=>i<12?decks[i]:presets[(i-12)%presets.length]),cup=T.create({deckIds:roster,seed:20122009,concurrency:8,pace:'turbo'});cup.resume();let guard=0;
 while(cup.status==='running'&&guard++<160000)cup.advance(1);
 assert.equal(cup.status,'completed',JSON.stringify(cup.matches.filter(m=>m.status==='error')));const games=cup.matches.flatMap(m=>m.games||[]),final=cup.matches.at(-1).games.at(-1),cursor=new T.ReplayCursor(final);while(cursor.next()){}assert.deepEqual(cursor.engine.snapshot(),final.final);
 report.tournament={participants:64,played:cup.progress().played,status:cup.status,finalReplayMatches:true,protectionDecisions:games.filter(g=>['limit','draw-limit'].includes(g.verdict?.kind)).length};fs.writeFileSync(path.join(out,'tournament.json'),JSON.stringify(cup.snapshot()));
}
fs.writeFileSync(path.join(out,quick?'quick-report.json':'report.json'),JSON.stringify(report,null,2));if(report.errors.length)process.exitCode=1;
