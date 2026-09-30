const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/side-matches/browser'),report={checks:[],errors:[]};let browser;
async function check(name,fn){await fn();report.checks.push(name);console.log('OK',name);}
(async()=>{
 await fs.mkdir(out,{recursive:true});browser=await chromium.launch({headless:true,executablePath:process.env.DUEL_BROWSER||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',args:['--mute-audio']});
 const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});await context.route(/https?:\/\//,r=>r.abort());
 await context.addInitScript(()=>{localStorage.setItem('duel-sanctuary-online-art-v2','false');localStorage.setItem('duel-sanctuary-welcomed-v3','true');localStorage.setItem('duel-sanctuary-prefs-v1',JSON.stringify({sound:false,music:false,reducedMotion:true,speed:'fast'}));});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.stack));
 await page.goto(pathToFileURL(path.join(root,'index.html')).href);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
 await check('desktop deck is central and library is right; official side flows into copy',async()=>{
   await page.evaluate(()=>duelApp.showWorkshop('blue-eyes-2016'));assert.equal(await page.locator('.ws-pile[data-zone="side"] .ws-deck-row').count(),15);
   const boxes=await page.evaluate(()=>['.ws-inspector','.ws-build','.ws-collection'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,w:r.width};}));assert.ok(boxes[0].x<boxes[1].x&&boxes[1].x<boxes[2].x);assert.ok(boxes[1].w>boxes[2].w);await page.screenshot({path:path.join(out,'desktop.png')});
 });
 await check('drag main-side exchange, undo and redo preserve all copies',async()=>{
   const before=await page.evaluate(()=>duelApp.workshopDraft);
   await page.locator('.ws-pile[data-zone="cards"] .ws-deck-card').first().dragTo(page.locator('#ws-zone-nav [data-ws-drop="side"]'));await page.locator('.ws-pile[data-zone="side"] .ws-deck-card').first().dragTo(page.locator('#ws-zone-nav [data-ws-drop="cards"]'));
   const after=await page.evaluate(()=>duelApp.workshopDraft);assert.equal(after.cards.length,before.cards.length);assert.equal(after.side.length,before.side.length);assert.notDeepEqual(after.cards,before.cards);
   await page.click('[data-action="ws-undo"]');await page.click('[data-action="ws-undo"]');assert.deepEqual((await page.evaluate(()=>duelApp.workshopDraft)).side,before.side);
   await page.click('[data-action="ws-redo"]');await page.click('[data-action="ws-redo"]');assert.deepEqual((await page.evaluate(()=>duelApp.workshopDraft)).side,after.side);
 });
 await check('JSON export/import and reload retain side and custom name',async()=>{
   await page.fill('#ws-name','BO3 Browser Deck');await page.click('#ws-save');const promise=page.waitForEvent('download');await page.click('[data-action="ws-export"]');const download=await promise,raw=await fs.readFile(await download.path()),obj=JSON.parse(raw);assert.equal(obj.version,3);assert.equal(obj.deck.side.length,15);
   await page.click('[data-action="ws-new"]');await page.setInputFiles('#ws-import-file',{name:'side.json',mimeType:'application/json',buffer:raw});await page.waitForFunction(()=>duelApp.workshopDraft.side.length===15);
   await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');await page.evaluate(()=>duelApp.showWorkshop());assert.equal(await page.locator('#ws-name').inputValue(),'BO3 Browser Deck');
 });
 await check('warm search and edit performance is measured on the full card pool',async()=>{report.performance=await page.evaluate(()=>{const input=document.querySelector('#ws-search'),times=[];input.value='dragon';input.dispatchEvent(new Event('input',{bubbles:true}));for(let i=0;i<30;i++){const t=performance.now();input.value=i%2?'dragon':'spell';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#ws-card-grid').getBoundingClientRect();times.push(performance.now()-t);}input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));times.sort((a,b)=>a-b);return {searchP95Ms:times[Math.floor(times.length*.95)],samples:times.length,userAgent:navigator.userAgent};});});
 for(const width of [1024,390,320])for(const language of ['zh-CN','en','ja'])await check('layout '+width+' '+language,async()=>{
   await page.setViewportSize({width,height:width===1024?768:844});await page.evaluate(l=>duelApp.setLanguage(l),language);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await page.locator('#ws-save').isVisible(),true);
   const invalid=await page.evaluate(()=>{const modal=document.querySelector('#modal');return modal.scrollWidth>modal.clientWidth+2;});assert.equal(invalid,false);
   await page.evaluate(()=>document.documentElement.style.setProperty('--ui-scale','1.5'));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.ok(await page.locator('#ws-save').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight));await page.evaluate(()=>document.documentElement.style.setProperty('--ui-scale','1.1'));
   if(width===390&&language==='en')await page.screenshot({path:path.join(out,'mobile.png')});
 });
 await check('PVE BO3 concede, choose, side, reload and two wins finish correctly',async()=>{
   await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>{duelApp.setLanguage('en');duelApp.newGame({deck:'blue-eyes-2016',opponentDeck:'dark',matchFormat:'bo3',first:0,seed:221});});
   for(const [width,height] of [[1440,900],[390,844],[844,390],[320,568]]){
     await page.setViewportSize({width,height});await page.evaluate(()=>document.documentElement.style.setProperty('--ui-scale','1.5'));
     await page.waitForFunction(()=>['#duel-board','#hand-cards','#local-match-bar'].every(s=>{const r=document.querySelector(s).getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1&&r.left>=0&&r.right<=innerWidth+1;}));
   }
   await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>document.documentElement.style.setProperty('--ui-scale','1.1'));
   await page.click('[data-action="match-surrender"]');await page.click('[data-action="match-confirm-surrender"]');
   assert.deepEqual(await page.evaluate(()=>duelApp.match.score),[0,1]);assert.equal(await page.evaluate(()=>duelApp.match.phase),'choosing-first');
   await page.click('[data-action="match-first"][data-value="0"]');await page.click('[data-action="match-side"]');assert.equal(await page.locator('.ws-collection').count(),0);assert.equal(await page.locator('[data-action="ws-new"]').count(),0);
   await page.locator('.ws-pile[data-zone="cards"] .ws-deck-card').first().dragTo(page.locator('#ws-zone-nav [data-ws-drop="side"]'));await page.click('#ws-save');assert.equal(await page.evaluate(()=>duelApp.match.phase),'siding');
   await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');await page.evaluate(()=>duelApp.enterDuel());await page.click('[data-action="match-side"]');assert.equal(await page.evaluate(()=>duelApp.workshopDraft.side.length),16);await page.locator('.ws-pile[data-zone="side"] .ws-deck-card').first().dragTo(page.locator('#ws-zone-nav [data-ws-drop="cards"]'));await page.click('#ws-save');
   assert.equal(await page.evaluate(()=>duelApp.match.gameIndex),2);assert.equal(await page.evaluate(()=>duelApp.engine.state.players[0].lp),8000);
   await page.click('[data-action="match-surrender"]');await page.click('[data-action="match-confirm-surrender"]');assert.equal(await page.evaluate(()=>duelApp.match.phase),'finished');assert.deepEqual(await page.evaluate(()=>duelApp.match.score),[0,2]);
   await page.screenshot({path:path.join(out,'match-result.png')});await page.locator('[data-action="match-journal"]').first().click();assert.ok(await page.locator('.match-journal p').count()>0);await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');assert.deepEqual(await page.evaluate(()=>duelApp.match.score),[0,2]);
 });
 assert.deepEqual(report.errors,[]);report.ok=true;
})().catch(e=>{report.errors.push(e.stack);console.error(e.stack);process.exitCode=1;}).finally(async()=>{await browser?.close();await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));});
