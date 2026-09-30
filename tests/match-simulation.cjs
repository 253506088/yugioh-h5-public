const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {DuelEngine}=require('../src/advanced-engine.js'),D=globalThis.DuelData,M=require('../src/match-core.js'),E=require('../src/deck-editor.js'),AI=require('../src/match-ai.js');
const out=path.resolve(__dirname,'../output/side-matches/simulation');fs.mkdirSync(out,{recursive:true});
const report={matches:[],games:0,errors:[]};
try{
 for(const [index,[a,b,ruleMode]] of [['blue-eyes-2016','majespecter-2016','off'],['zoodiac-2016','hero','off'],['blue-eyes-2016','zoodiac-2016','random'],['majespecter-2016','blackwing','random']].entries()){
  const m=M.create({decks:[D.DECKS[a],D.DECKS[b]],format:'bo3',first:index%2,id:'simulation-'+index,ruleMode});let transfers=0;
  while(m.phase!=='finished'){
   let engine=new DuelEngine({deck:a,opponentDeck:b,deckSpecs:m.decks,first:m.first,seed:712900+index*100+m.gameIndex,ruleMode,difficulty:'casual'}),steps=0;
   while(engine.state.winner===null&&steps<5000){
    const action=engine.aiNext();assert.ok(action,'AI must have an action');const result=engine.act(action);assert.equal(result.ok,true,result.error);engine.assertState();steps++;
    if(steps===75){const snapshot=engine.snapshot();engine=DuelEngine.restore(snapshot);assert.deepEqual(engine.snapshot(),snapshot);}
   }
   assert.ok(steps<5000,'No guard termination');report.games++;M.record(m,{winner:engine.state.winner,kind:engine.state.outcome?.kind||'special',turn:engine.state.turn});assert.deepEqual(M.restore(m),m);
   fs.writeFileSync(path.join(out,m.id+'-'+m.gameIndex+'.json'),JSON.stringify({snapshot:engine.snapshot(),match:m,steps}));
   console.log(m.id,m.gameIndex,'winner',engine.state.winner,'steps',steps);
   if(m.phase==='finished')break;
   if(m.phase==='choosing-first')M.choose(m,m.round.chooser,m.round.chooser);
   for(const seat of [0,1]){const deck=AI.plan(m.decks[seat],engine.state.matchPublicSeen?.[seat]||[]);assert.equal(E.check(deck,m.registered[seat]).valid,true);transfers+=E.diff(m.decks[seat],deck).length;M.submit(m,seat,deck);}
   M.next(m);
  }
  report.matches.push({id:m.id,decks:[a,b],ruleMode,score:m.score,games:m.games.length,transfers,result:m.result});
 }
 report.ok=true;
}catch(e){report.errors.push(e.stack);process.exitCode=1;console.error(e.stack);}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
