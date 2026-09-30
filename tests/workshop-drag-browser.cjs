const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/workshop-drag'),report={checks:[],errors:[]};let browser;
async function check(name,fn){await fn();report.checks.push(name);console.log('OK',name);}
(async()=>{
 await fs.mkdir(out,{recursive:true});browser=await chromium.launch({headless:true,executablePath:process.env.DUEL_BROWSER||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',args:['--mute-audio']});
 const context=await browser.newContext({viewport:{width:2560,height:1270},hasTouch:true});
 await context.addInitScript(()=>{localStorage.setItem('duel-sanctuary-online-art-v2','false');localStorage.setItem('duel-sanctuary-prefs-v1',JSON.stringify({sound:false,music:false,reducedMotion:true}));});
 const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.stack));
 await p.goto(pathToFileURL(path.join(root,'index.html')).href);await p.waitForFunction(()=>document.documentElement.dataset.ready==='true');await p.evaluate(()=>duelApp.showWorkshop('hero'));
 const chip=z=>p.locator('#ws-zone-nav [data-ws-drop="'+z+'"]'),card=z=>p.locator('.ws-pile[data-zone="'+z+'"] .ws-deck-card').first();
 await check('wide layout uses the full viewport, enlarged cards and top name/sort without instructional panels',async()=>{
  assert.equal(await p.locator('.ws-validity,.ws-edit-bar,.ws-row-controls,.ws-plan').count(),0);
  const g=await p.evaluate(()=>{const r=s=>{const b=document.querySelector(s).getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,right:b.right}};return {modal:r('#modal'),name:r('#ws-name'),sort:r('[data-action="ws-sort"]'),deck:r('.ws-build'),card:r('.ws-deck-card')};});
  assert.ok(g.modal.width>=2540);assert.ok(g.card.width>=150);assert.ok(g.name.y<g.deck.y);assert.ok(g.sort.y<g.deck.y);report.wide=g;
  await p.waitForFunction(()=>{const el=document.querySelector('.ws-preview .artwork.has-art');return el&&getComputedStyle(el.querySelector('img')).opacity==='1'&&getComputedStyle(el.querySelector('.art-placeholder')).opacity==='0';});await p.screenshot({path:path.join(out,'wide.png')});
 });
 await check('native mouse drag moves between sections and permits a 39-card editing state',async()=>{
  const id=await p.evaluate(()=>duelApp.workshopDraft.cards[0]);await card('cards').dragTo(chip('side'));assert.equal(await p.evaluate(()=>duelApp.workshopDraft.cards.length),39);assert.equal(await p.evaluate(()=>duelApp.workshopDraft.side[0]),id);
  await card('side').dragTo(chip('cards'));assert.equal(await p.evaluate(()=>duelApp.workshopDraft.cards.length),40);assert.equal(await p.evaluate(()=>duelApp.workshopDraft.side.length),0);
 });
 await check('library image copies into all sections; dragging back and corner X remove only that copy',async()=>{
  await p.fill('#ws-search','Pot of Greed');const library=p.locator('.ws-card .ws-card-face').first();
  await library.dragTo(chip('side'));assert.equal(await p.evaluate(()=>duelApp.workshopDraft.side.length),1);
  await card('side').dragTo(p.locator('.ws-collection'));assert.equal(await p.evaluate(()=>duelApp.workshopDraft.side.length),0);
  await library.dragTo(chip('cards'));assert.equal(await p.evaluate(()=>duelApp.workshopDraft.cards.length),41);
  await p.locator('.ws-pile[data-zone="cards"] .ws-delete-card').last().click();assert.equal(await p.evaluate(()=>duelApp.workshopDraft.cards.length),40);
  await card('extra').dragTo(chip('side'));assert.equal(await p.evaluate(()=>duelApp.workshopDraft.extra.length),14);
  await card('side').dragTo(chip('extra'));assert.equal(await p.evaluate(()=>duelApp.workshopDraft.extra.length),15);
 });
 await check('undo/redo restores a drag, and same-section drop changes order without changing inventory',async()=>{
  const before=await p.evaluate(()=>duelApp.workshopDraft);await card('cards').dragTo(chip('side'));await p.click('[data-action="ws-undo"]');assert.deepEqual((await p.evaluate(()=>duelApp.workshopDraft)).cards,before.cards);await p.click('[data-action="ws-redo"]');assert.equal(await p.evaluate(()=>duelApp.workshopDraft.cards.length),39);await p.click('[data-action="ws-undo"]');
  await card('cards').dragTo(p.locator('.ws-pile[data-zone="cards"] .ws-deck-row').nth(4));assert.notDeepEqual((await p.evaluate(()=>duelApp.workshopDraft)).cards,before.cards);
 });
 await check('dropping outside a destination cancels without losing a card',async()=>{
  const before=await p.evaluate(()=>duelApp.workshopDraft);await card('cards').dragTo(p.locator('#modal-title'));assert.deepEqual(await p.evaluate(()=>duelApp.workshopDraft),before);
 });
 await check('keyboard context menu and Delete offer the same operations without permanent card buttons',async()=>{
  const before=await p.evaluate(()=>duelApp.workshopDraft);await card('cards').press('Shift+F10');await p.click('#ws-card-menu [data-zone="side"]');assert.equal(await p.evaluate(()=>duelApp.workshopDraft.side.length),1);
  await card('side').press('Delete');assert.equal(await p.evaluate(()=>duelApp.workshopDraft.side.length),0);await p.click('[data-action="ws-undo"]');await p.click('[data-action="ws-undo"]');assert.deepEqual((await p.evaluate(()=>duelApp.workshopDraft)).cards,before.cards);
 });
 await check('incomplete save reloads and failed start reports both decks without replacing the current duel',async()=>{
  await p.locator('.ws-pile[data-zone="cards"] .ws-delete-card').first().click();await p.fill('#ws-name','Drag draft');await p.click('#ws-save');assert.equal(await p.locator('#ws-save').isEnabled(),true);
  await p.reload();await p.waitForFunction(()=>document.documentElement.dataset.ready==='true');await p.evaluate(()=>duelApp.showWorkshop());assert.equal(await p.evaluate(()=>duelApp.workshopDraft.cards.length),39);
  const before=await p.evaluate(()=>JSON.stringify(duelApp.engine.snapshot()));await p.click('#ws-play');await p.click('[data-action="begin-game"]');assert.equal(await p.evaluate(()=>duelApp.modalKind),'deck-check');assert.equal(await p.evaluate(()=>JSON.stringify(duelApp.engine.snapshot())),before);
  await p.evaluate(()=>{const own=DuelDecks.getSaved().find(d=>d.name==='Drag draft');duelApp.newGame({deck:own.id,opponentDeck:own.id});});assert.equal(await p.locator('.deck-start-errors').count(),2);
 });
 await check('a mouse can drag from the tablet detail overlay to a deck section',async()=>{
  await p.setViewportSize({width:1024,height:768});await p.evaluate(()=>duelApp.showWorkshop('hero'));await card('cards').click();
  // The destination is covered before the drag starts. Native drag handlers make
  // the preview transparent to hit-testing; skip only the pre-drag hit check.
  await p.locator('.ws-preview').dragTo(chip('side'),{force:true});
  assert.equal(await p.evaluate(()=>duelApp.workshopDraft.side.length),1);assert.equal(await p.locator('.ws-inspector.mobile-open').count(),0);
 });
 await check('mobile long-press touch drag works and all primary controls stay in view in three languages',async()=>{
  await p.setViewportSize({width:390,height:844});await p.evaluate(()=>duelApp.showWorkshop('hero'));await p.click('[data-action="ws-view"][data-view="collection"]');
  const cdp=await context.newCDPSession(p),box=await p.locator('.ws-card-face').first().boundingBox(),dest=await chip('side').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2,tx=dest.x+dest.width/2,ty=dest.y+dest.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await p.waitForTimeout(280);assert.equal(await p.locator('.ws-drag-ghost').count(),1);
  for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(tx-x)*i/8,y:y+(ty-y)*i/8}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForFunction(()=>duelApp.workshopDraft.side.length===1);await p.waitForTimeout(400);
  await card('cards').click();const preview=await p.locator('.ws-preview').boundingBox();
  report.preview=await p.evaluate(r=>{const e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),s=e?.closest('[data-drag-zone]');return {rect:r,hit:e?.tagName,cls:e?.className,source:s?.dataset.dragZone,draggable:s?.draggable};},preview);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:preview.x+preview.width/2,y:preview.y+preview.height/2}]});await p.waitForTimeout(280);
  assert.equal(await p.locator('.ws-inspector.mobile-open').count(),0,JSON.stringify(report.preview));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tx,y:ty}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await p.waitForFunction(()=>duelApp.workshopDraft.side.length===2);await p.waitForTimeout(400);await p.click('[data-action="ws-undo"]');
  for(const lang of ['zh-CN','en','ja']){await p.evaluate(l=>duelApp.setLanguage(l),lang);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.ok(await p.locator('#ws-save').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight+1));}
  await p.screenshot({path:path.join(out,'mobile.png')});
 });
 assert.deepEqual(report.errors,[]);report.ok=true;
})().catch(e=>{report.errors.push(e.stack);console.error(e.stack);process.exitCode=1;}).finally(async()=>{await browser?.close();await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));});
