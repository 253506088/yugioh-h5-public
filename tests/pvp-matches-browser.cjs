const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const out=path.resolve(__dirname,'../output/side-matches/pvp-browser'),report={checks:[],errors:[]};let browser,app;
async function check(name,fn){await fn();report.checks.push(name);console.log('OK',name);}
(async()=>{
 await fs.mkdir(out,{recursive:true});const {createPvpServer}=await import('../server/index.mjs');
 app=await createPvpServer({database:':memory:',serviceOptions:{onError:e=>report.errors.push(e.stack)}});const address=await app.listen(0),url='http://127.0.0.1:'+address.port;
 browser=await chromium.launch({headless:true,executablePath:process.env.DUEL_BROWSER||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',args:['--mute-audio']});
 const pages=[];for(let i=0;i<2;i++){const context=await browser.newContext({viewport:{width:1440,height:900}});await context.addInitScript(()=>{localStorage.setItem('duel-sanctuary-online-art-v2','false');localStorage.setItem('duel-sanctuary-prefs-v1',JSON.stringify({sound:false,music:false,reducedMotion:true}));});const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.stack));pages.push(p);await p.goto(url+'/#pvp');await p.waitForFunction(()=>duelApp?.pvp?.connected);}
 const [a,b]=pages,room=()=>[...app.service.rooms.values()][0];
 await check('create BO3 room through actual UI and both clients ready',async()=>{
   await a.selectOption('#pvp-format','bo3');await a.selectOption('#pvp-deck','blue-eyes-2016');await a.click('[data-pvp-action="create"]');await a.waitForFunction(()=>!!duelApp.pvp.room);
   await b.fill('#pvp-code',room().code);await b.locator('#pvp-join-form button').click();await b.waitForFunction(()=>!!duelApp.pvp.room);
   await a.click('[data-pvp-action="ready"]');await b.click('[data-pvp-action="ready"]');await Promise.all(pages.map(p=>p.waitForFunction(()=>duelApp.pvp.room?.status==='playing')));
   assert.equal(room().match.format,'bo3');assert.equal(room().match.decks[0].side.length,15);
 });
 async function concede(p){await p.evaluate(()=>duelApp.enterDuel());await p.click('[data-pvp-action="surrender"]');await p.click('[data-pvp-action="confirm-surrender"]');await p.waitForFunction(()=>duelApp.pvp.room.status!=='playing');}
 await check('loser selects order and both get intermission with private editor',async()=>{
   await concede(b);await b.click('[data-action="pvp-match-first"][data-value="0"]');await Promise.all(pages.map(p=>p.waitForFunction(()=>duelApp.pvp.room.match.phase==='siding')));
   await a.click('[data-action="pvp-match-side"]');assert.equal(await a.locator('.ws-pile[data-zone="side"] .ws-deck-row').count(),15);assert.equal(await a.locator('.ws-collection').count(),0);
   await a.locator('.ws-pile[data-zone="cards"] [data-action="ws-plan"]').first().click();await a.locator('.ws-pile[data-zone="side"] [data-action="ws-plan"]').first().click();await a.click('[data-action="ws-apply-plan"]');await a.click('#ws-save');
   await a.waitForFunction(()=>duelApp.pvp.room.match.round.ready[0]);await a.screenshot({path:path.join(out,'locked.png')});
   assert.equal(await b.evaluate(()=>duelApp.pvp.room.game.state.players[1].deckSpec.side),undefined);
 });
 await check('refresh preserves confirmed deck, second submission starts exactly one new game',async()=>{
   const adopted=structuredClone(room().match.round.submitted[0]),id=room().gameId;
   await a.reload();await a.waitForFunction(()=>duelApp.pvp.room?.match?.round?.ready[0]);await b.click('[data-action="pvp-match-side"]');await b.click('#ws-save');
   await Promise.all(pages.map(p=>p.waitForFunction(()=>duelApp.pvp.room.match.gameIndex===2&&duelApp.pvp.room.status==='playing')));
   assert.notEqual(room().gameId,id);assert.deepEqual(room().match.decks[0],adopted);assert.equal(room().engine.state.active,1);assert.deepEqual(room().engine.state.players.map(p=>p.lp),[8000,8000]);
 });
 await check('BO3 second victory ends whole match in both seat orientations',async()=>{
   await concede(b);await a.waitForFunction(()=>duelApp.pvp.room.status==='finished');assert.deepEqual(await a.evaluate(()=>duelApp.pvp.room.match.score),[2,0]);assert.deepEqual(await b.evaluate(()=>duelApp.pvp.room.match.score),[0,2]);assert.equal(room().match.games.length,2);
   await a.locator('[data-action="pvp-match-journal"]').first().click();await a.waitForSelector('.match-journal p');
   await b.evaluate(()=>duelApp.setLanguage('ja'));await b.setViewportSize({width:390,height:844});await b.evaluate(()=>duelApp.pvp.showMatch());assert.equal(await b.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await b.screenshot({path:path.join(out,'mobile-result.png')});
 });
 assert.deepEqual(report.errors,[]);report.ok=true;
})().catch(e=>{report.errors.push(e.stack);console.error(e.stack);process.exitCode=1;}).finally(async()=>{await browser?.close();await app?.close();await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));});
