const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/optimization'),target=process.env.DUEL_OPTIMIZATION_HTML||path.join(out,'index.html');
const report={checks:[],errors:[],target};let browser;
const check=async(name,fn)=>{await fn();report.checks.push(name);console.log('OK',name);};
(async()=>{await fs.mkdir(out,{recursive:true});browser=await chromium.launch({headless:true,executablePath:process.env.DUEL_BROWSER||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',args:['--mute-audio']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},hasTouch:true});await context.addInitScript(()=>{localStorage.setItem('duel-sanctuary-online-art-v2','false');localStorage.setItem('duel-sanctuary-prefs-v1',JSON.stringify({sound:false,music:false,reducedMotion:true,speed:'fast'}));});
 const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.stack));await p.goto(pathToFileURL(target).href);await p.waitForFunction(()=>document.documentElement.dataset.ready==='true');
 await p.evaluate(()=>duelApp.showWorkshop('hero'));
 const chip=z=>p.locator('#ws-zone-nav [data-zone="'+z+'"]'),card=z=>p.locator('.ws-pile[data-zone="'+z+'"] .ws-deck-card').first();
 await check('pointer drag follows the mouse without replacing source DOM; main/extra boundary is enforced',async()=>{
  await p.evaluate(()=>{window.dragOriginal=document.querySelector('.ws-deck-row');});const a=await card('cards').boundingBox(),b=await chip('side').boundingBox();
  await p.mouse.move(a.x+20,a.y+30);await p.mouse.down();await p.mouse.move(a.x+50,a.y+50,{steps:5});assert.equal(await p.locator('.ws-drag-ghost').count(),1);assert.equal(await p.evaluate(()=>dragOriginal===document.querySelector('.ws-deck-row')),true);assert.equal(await p.locator('.ws-drag-source').count(),1);
  await p.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});await p.mouse.up();assert.equal(await p.evaluate(()=>duelApp.workshopDraft.cards.length),39);assert.equal(await p.evaluate(()=>duelApp.workshopDraft.side.length),1);
  await card('side').dragTo(chip('extra'));assert.equal(await p.evaluate(()=>duelApp.workshopDraft.extra.length),15);assert.equal(await p.evaluate(()=>duelApp.workshopDraft.side.length),1);
  await p.waitForTimeout(400);await card('side').dragTo(chip('cards'));assert.equal(await p.evaluate(()=>duelApp.workshopDraft.cards.length),40);
 });
 await check('source-deck search and exact card facets filter without losing input focus',async()=>{
  await p.fill('#ws-source-search','2017');assert.ok(await p.locator('#ws-source option').count()>1);await p.fill('#ws-source-search','no such deck 91872');assert.equal(await p.locator('#ws-source option').count(),1);await p.fill('#ws-source-search','');
  await p.locator('.ws-advanced summary').click();await p.fill('[data-ws-facet="atk"]','3000');assert.ok(await p.locator('.ws-card').count()>0);assert.equal(await p.evaluate(()=>[...document.querySelectorAll('.ws-card')].every(n=>DuelData.CARDS[n.dataset.id].atk===3000)),true);
  await p.fill('[data-ws-facet="atk"]','');await p.fill('[data-ws-facet="linkMarker"]','B');assert.ok(await p.locator('.ws-card').count()>0);assert.equal(await p.evaluate(()=>[...document.querySelectorAll('.ws-card')].every(n=>DuelData.CARDS[n.dataset.id].arrows?.includes('B'))),true);await p.fill('[data-ws-facet="linkMarker"]','');await p.screenshot({path:path.join(out,'workshop.png')});
 });
 await check('failed launch opens the specific invalid deck and keeps a back action',async()=>{
  await p.evaluate(()=>{const d=DuelDecks.saveDraft({name:'Repair target',cards:['blue-eyes'],extra:[],side:[]});duelApp.newGame({deck:d.id});});assert.equal(await p.locator('[data-action="edit-invalid-deck"]').count(),1);assert.equal(await p.locator('#modal [data-action="close-modal"]').count()>0,true);await p.click('[data-action="edit-invalid-deck"]');assert.equal(await p.inputValue('#ws-name'),'Repair target');
 });
 await check('all multi-action cards have distinct captions in all three languages; Chicken Game states costs and outcomes',async()=>{
  const result=await p.evaluate(()=>{const failures=[];for(const lang of ['zh-CN','en','ja']){DuelI18n.setLanguage(lang);for(const list of Object.values(DuelEffects.byCard)){const groups=new Map();for(const a of list.filter(a=>!a.trigger&&!a.mode.startsWith('copied:')&&!a.mode.startsWith('field-copy:'))){const arr=groups.get(a.label)||[];arr.push(a);groups.set(a.label,arr);}for(const group of groups.values())if(group.length>1){const labels=group.map(DuelI18n.effectLabel);if(new Set(labels).size!==labels.length)failures.push({id:group[0].id,lang,labels});}}}DuelI18n.setLanguage('zh-CN');const id=DuelData.cardByName('Chicken Game').id;return {failures,chicken:DuelEffects.byCard[id].filter(a=>a.mode!=='cast').map(DuelI18n.effectLabel)};});assert.deepEqual(result.failures,[]);assert.ok(result.chicken.every(s=>s.includes('1000')));assert.equal(new Set(result.chicken).size,3);
 });
 await check('chosen Fate rule survives setup and roulette waits for confirmation',async()=>{
  await p.evaluate(()=>duelApp.showNewGame());await p.selectOption('#fate-choice','roulette2');await p.click('[data-action="begin-game"]');assert.equal(await p.evaluate(()=>duelApp.engine.state.ruleMode.id),'roulette2');assert.equal(await p.evaluate(()=>duelApp.engine.state.ruleMode.source),'chosen');assert.equal(await p.locator('#fate-roll').isVisible(),true);assert.equal(await p.evaluate(()=>duelApp.engine.state.pending.operation),'rule-roulette-apply');await p.screenshot({path:path.join(out,'roulette.png')});
 });
 await check('BO3 terminal result recovers after a blocking modal and cannot be suppressed by an earlier overview',async()=>{
  await p.evaluate(()=>duelApp.newGame({deck:'blue',opponentDeck:'dark',first:0,matchFormat:'bo3'}));await p.evaluate(()=>duelApp.showMatch());await p.click('#modal [data-action="close-modal"]');await p.evaluate(()=>{duelApp.showSettings();const e=duelApp.engine;e.state.players[1].lp=0;e.checkWin();e.onChange([]);});await p.waitForTimeout(450);assert.equal(await p.evaluate(()=>duelApp.modalKind),'settings');await p.click('#modal [data-action="close-modal"]');await p.waitForFunction(()=>duelApp.modalKind==='match');assert.equal(await p.evaluate(()=>duelApp.match.score[0]),1);
  await p.click('[data-action="match-side"]');await p.click('#ws-save');await p.waitForFunction(()=>duelApp.match.gameIndex===2);await p.evaluate(()=>{const e=duelApp.engine;e.state.players[1].lp=0;e.checkWin();e.onChange([]);});await p.waitForFunction(()=>duelApp.modalKind==='match'&&duelApp.match.phase==='finished');assert.equal(await p.evaluate(()=>duelApp.match.score[0]),2);await p.screenshot({path:path.join(out,'bo3-result.png')});
 });
 await check('mobile build keeps drop destinations visible and layout within viewport',async()=>{
  await p.setViewportSize({width:390,height:844});await p.evaluate(()=>duelApp.showWorkshop('hero'));const b=await chip('side').boundingBox();assert.ok(b.y>=0&&b.y+b.height<844);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.screenshot({path:path.join(out,'mobile.png')});
 });
 await check('tournament advances through a real Worker while hidden and ordinary window timers are blocked',async()=>{
  await p.setViewportSize({width:1440,height:1000});await p.evaluate(()=>duelApp.showTournament());await p.evaluate(()=>duelApp.tournament.ready);await p.fill('#t-count','4');await p.locator('#t-count').blur();await p.selectOption('#t-pace','turbo');await p.selectOption('#t-rule-mode','roulette2');
  await p.click('[data-t-action="start"]');await p.waitForFunction(()=>duelApp.tournament.current?.status==='running');
  const before=await p.evaluate(()=>{window.optimizationTimer=window.setTimeout;Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});window.setTimeout=(fn,ms,...a)=>optimizationTimer(()=>{},ms);return duelApp.tournament.current.revision;});
  await p.waitForFunction(n=>duelApp.tournament.current.revision>n+5,before,{timeout:30000});
  await p.evaluate(()=>{window.setTimeout=optimizationTimer;delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await p.waitForFunction(()=>duelApp.tournament.current.status==='completed',null,{timeout:120000});assert.equal(await p.evaluate(()=>duelApp.tournament.current.progress().played),3);assert.equal(await p.evaluate(()=>duelApp.tournament.current.data.settings.ruleMode),'roulette2');
 });
 assert.deepEqual(report.errors,[]);await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));await browser.close();
})().catch(async e=>{console.error(e);report.error=e.stack;await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));await browser?.close();process.exitCode=1;});
