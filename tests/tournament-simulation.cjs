const fs = require('node:fs'), path = require('node:path');
const T = require('../src/tournament.js');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'output/tournament-simulation');
fs.mkdirSync(out, {recursive:true});
const report = {at:new Date().toISOString(), events:[]};
for (const seed of [6400912, 880064]) {
  const started = Date.now(), cup = T.create({count:64,seed,concurrency:8,pace:'turbo'});
  cup.resume();
  let batches = 0;
  while (cup.status === 'running' && batches++ < 60000) cup.advance(1);
  const result = {seed,elapsedMs:Date.now()-started,status:cup.status,progress:cup.progress(),champion:cup.participant(cup.data.championId)?.name,
    totalActions:cup.matches.reduce((n,m) => n + m.games.reduce((n,g) => n + g.steps.length,0),0),
    maxTurn:Math.max(...cup.matches.flatMap(m=>m.games.map(g=>g.final?.state.turn||0))),
    rulings:cup.matches.flatMap(m=>m.games.filter(g=>g.verdict&&g.verdict.kind!=='normal').map(g=>({match:m.id,verdict:g.verdict}))),
    errors:cup.matches.filter(m=>m.status==='error').map(m=>({id:m.id,decks:m.entrants.map(id=>cup.participant(id).deckId),error:m.reason})),
    savedBytes:Buffer.byteLength(JSON.stringify(cup.snapshot()))};
  if (cup.status !== 'completed') {
    fs.writeFileSync(path.join(out,'failure-'+seed+'.json'),JSON.stringify(cup.snapshot())); process.exitCode=1;
  } else {
    const restored=T.Tournament.restore(cup.snapshot());
    if(restored.data.championId!==cup.data.championId)throw new Error('Champion changed on restore');
    // Verify the entire final recording by replaying every recorded action.
    const game=cup.matches.at(-1).games.at(-1),cursor=new T.ReplayCursor(game);
    while(cursor.next()){}
    if(JSON.stringify(cursor.engine.snapshot())!==JSON.stringify(game.final))throw new Error('Final replay diverged');
  }
  report.events.push(result);console.log(JSON.stringify(result,null,2));
}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
