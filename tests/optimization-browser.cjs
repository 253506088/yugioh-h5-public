const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('playwright');
(async()=>{
 const out=process.env.DUEL_WEB_OUTPUT||'output/performance/acceptance-'+new Date().toISOString().replace(/[:.]/g,'-');await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.DUEL_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const report={checks:[],errors:[]};
 try{
  const context=await browser.newContext({viewport:{width:1920,height:1080}});
  await context.addInitScript(()=>{localStorage.setItem('duel-sanctuary-online-art-v2','false');localStorage.setItem('duel-sanctuary-prefs-v1',JSON.stringify({sound:false,music:false,reducedMotion:true}));});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  const check=async(name,fn)=>{await fn();report.checks.push(name);console.log('OK',name);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));};
  await page.goto(process.env.DUEL_WEB_URL||'http://127.0.0.1:4173');
  await check('home is interactive before duel code loads',async()=>{await page.waitForFunction(()=>document.documentElement.dataset.bootReady==='true');assert.equal(await page.evaluate(()=>!!window.DuelEngine),false);});
  await page.click('#home-screen [data-action="new-game"]');
  await page.waitForSelector('[data-action="begin-game"]',{timeout:120000});
  await check('local opening uses player rock-paper-scissors',async()=>{
   assert.equal(await page.locator('[data-action="choose-first"]').count(),0);
   await page.click('[data-action="begin-game"]');
   for(let i=0;i<16;i++){await page.waitForSelector('[data-action="rps-pick"]');await page.click('[data-action="rps-pick"][data-value="0"]');await page.waitForTimeout(850);if(await page.evaluate(()=>duelApp.modalKind!=='rps'))break;}
   assert.notEqual(await page.evaluate(()=>duelApp.lastRps.first),null);
   assert.equal(await page.evaluate(()=>duelApp.match.first===duelApp.lastRps.first),true);
  });
  await page.evaluate(()=>duelApp.newGame({deck:'early-ritual',opponentDeck:'early-fusion',first:0,seed:48}));
  await check('incremental log preserves unchanged nodes and replaces reused numbers after switching duels',async()=>{
   const result=await page.evaluate(()=>{
    const expected=()=>duelApp.engine.state.log.slice(0,24).map(item=>String(item.n));
    const actual=()=>[...document.querySelector('#duel-log').children].map(child=>child.dataset.logN);
    const first=document.querySelector('#duel-log').firstElementChild;
    duelApp.render();const preserved=first===document.querySelector('#duel-log').firstElementChild;
    duelApp.engine.state.log[0].text='本局独有的日志回归标记';duelApp.render();
    const updated=document.querySelector('#duel-log').textContent.includes('本局独有的日志回归标记');
    duelApp.newGame({deck:'early-ritual',opponentDeck:'early-fusion',first:0,seed:49});
    const stale=document.querySelector('#duel-log').textContent.includes('本局独有的日志回归标记');
    return {preserved,updated,stale,actual:actual(),expected:expected()};
   });assert.equal(result.preserved,true);assert.equal(result.updated,true);assert.equal(result.stale,false);assert.deepEqual(result.actual,result.expected);
  });
  await check('100px main and Extra Monster Zones and drawer keep the hand visible',async()=>{
   const rect=await page.locator('#player-monsters .zone').first().boundingBox();assert.ok(rect.width>=100,JSON.stringify(rect));
   const extra=await page.locator('#extra-lane .zone').first().boundingBox();assert.ok(extra.width>=100,JSON.stringify(extra));
   const hand=await page.locator('.hand-slot').first().boundingBox();assert.ok(hand.width>=100);assert.ok(hand.y+hand.height<=1080,JSON.stringify(hand));
   await page.click('[data-panel="turn"]');assert.equal(await page.locator('.right-column').evaluate(e=>e.inert),false);
   await page.click('#response-mode-switch [data-value="on"]');assert.equal(await page.evaluate(()=>duelApp.preferences.responseMode),'on');
   await page.click('#response-mode-switch [data-value="auto"]');
   await page.keyboard.press('Escape');assert.equal(await page.locator('.right-column').evaluate(e=>e.inert),true);
   for(const [width,height]of [[1366,768],[1440,900],[2560,1440]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(60);
    const h=await page.locator('.hand-slot').first().boundingBox();assert.ok(h.y+h.height<=height+1,JSON.stringify({width,height,hand:h}));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   }
   await page.setViewportSize({width:1920,height:1080});
  });
  await check('external card images load and selection immediately shows full text',async()=>{
   await page.waitForFunction(()=>[...document.querySelectorAll('#hand-cards img[data-art-id]')].some(e=>e.naturalWidth>0));
   await page.locator('.hand-slot').first().click();assert.ok((await page.locator('.popover-details').innerText()).length>20);
   await page.screenshot({path:out+'/desktop-card.png'});
  });
  await check('worker decisions preserve AI action and RNG',async()=>{
   const result=await page.evaluate(async()=>{
    const e=new DuelEngine({deck:'early-ritual',opponentDeck:'early-fusion',seed:532,first:0,difficulty:'casual'}),s=e.snapshot(),worker=new DuelWorkers.Client();
    const answer=await worker.request('ai',{snapshot:s}),direct=e.aiNext();worker.close();return {answer,direct,rng:e.randomState};
   });assert.deepEqual(result.answer.action,result.direct);assert.equal(result.answer.randomState,result.rng);
  });
  await check('precomputed full duel replays to the same final state',async()=>{
   const result=await page.evaluate(async()=>{
    const e=new DuelEngine({deck:'blue',opponentDeck:'dark',seed:45,first:0,difficulty:'casual'}),worker=new DuelWorkers.Client();
    const replay=await worker.request('precompute',{snapshot:e.snapshot()});worker.close();
    for(const step of replay.steps){e.randomState=step.randomState;const r=e.act(step.action);if(!r.ok)throw Error(r.error);}
    return {steps:replay.steps.length,actual:e.snapshot(),expected:replay.final,winner:e.state.winner};
   });assert.ok(result.steps>10);await fs.writeFile(out+'/replay-comparison.json',JSON.stringify(result));assert.deepEqual(result.actual,result.expected);assert.notEqual(result.winner,null);
  });
  await page.evaluate(()=>duelApp.showHome());await page.click('[data-action="workshop"]');
  await check('workshop feature loads on demand',async()=>{await page.waitForSelector('.workshop-layout');});
  await check('rematch requires another player RPS round',async()=>{
   await page.evaluate(()=>duelApp.newGame({deck:'blue',opponentDeck:'dark',first:0,seed:12}));
   await page.click('[data-action="match-surrender"]');await page.click('[data-action="match-confirm-surrender"]');await page.click('[data-action="rematch"]');
   assert.equal(await page.locator('[data-action="rps-pick"]').count(),3);
   await page.click('#modal [data-action="close-modal"]');
  });
  await check('conceding while AI is thinking discards its late response',async()=>{
   await page.evaluate(()=>{
    window.savedAIRequest=DuelWorkers.Client.prototype.request;
    DuelWorkers.Client.prototype.request=function(type,payload,...args){if(type!=='ai')return savedAIRequest.call(this,type,payload,...args);return new Promise(resolve=>{window.finishLateAI=()=>resolve({action:{type:'end'},randomState:payload.snapshot.randomState});});};
    duelApp.newGame({deck:'blue',opponentDeck:'dark',first:1,seed:12});
   });
   await page.waitForFunction(()=>!!window.finishLateAI);
   await page.click('[data-action="match-surrender"]');await page.click('[data-action="match-confirm-surrender"]');
   await page.click('#modal [data-action="close-modal"]');
   const before=await page.evaluate(()=>JSON.stringify(duelApp.engine.snapshot()));
   await page.evaluate(()=>{finishLateAI();DuelWorkers.Client.prototype.request=savedAIRequest;});await page.waitForTimeout(80);
   assert.equal(await page.evaluate(()=>JSON.stringify(duelApp.engine.snapshot())),before);
   assert.equal(await page.locator('#toast-stack .toast.error').count(),0);
   assert.equal(await page.evaluate(()=>duelApp.aiPerformance.busy),false);
  });
  await check('failed language fetch preserves the duel, preference and visible selection',async()=>{
   const before=await page.evaluate(()=>({state:JSON.stringify(duelApp.engine.snapshot()),saved:localStorage.getItem('duel-sanctuary-language-v1')}));
   await page.route('**/app/locale-ja-*.json',route=>route.abort());
   assert.equal(await page.evaluate(()=>duelApp.setLanguage('ja')),false);
   assert.equal(await page.evaluate(()=>duelApp.language),'zh-CN');
   assert.equal(await page.locator('.header-tools [data-locale-select]').inputValue(),'zh-CN');
   assert.deepEqual(await page.evaluate(()=>({state:JSON.stringify(duelApp.engine.snapshot()),saved:localStorage.getItem('duel-sanctuary-language-v1')})),before);
   await page.unroute('**/app/locale-ja-*.json');
  });
  await check('web language chunks preserve Qliphort flavor and pendulum effects',async()=>{
   await page.evaluate(async()=>{await duelApp.setLanguage('en');});
   assert.match(await page.evaluate(()=>DuelI18n.card('qli-scout').pendulumDescription),/800 LP/);
   assert.match(await page.evaluate(()=>DuelI18n.card('qli-scout').description),/Booting/);
   await page.evaluate(async()=>{await duelApp.setLanguage('ja');});
   assert.match(await page.evaluate(()=>DuelI18n.card('qli-scout').pendulumDescription),/８００/);
   await page.evaluate(async()=>{await duelApp.setLanguage('zh-CN');});
  });
  await check('360px card selection has immediate text and visible actions',async()=>{
   await page.setViewportSize({width:360,height:800});await page.evaluate(()=>duelApp.newGame({deck:'blue',opponentDeck:'dark',first:0,seed:12}));
   await page.locator('.hand-slot').first().click();
   assert.ok(await page.locator('.popover-details').isVisible());
   const box=await page.locator('#card-popover').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=360&&box.y>=0&&box.y+box.height<=800);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:out+'/mobile-card.png'});
  });
  assert.deepEqual(report.errors,[]);
 }finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
