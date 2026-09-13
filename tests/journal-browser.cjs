const {chromium}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/journal-browser'),report={checks:[],errors:[],geometry:[]};
async function check(name,fn){await fn();report.checks.push(name);console.log('OK',name);}
async function shot(page,name){await page.screenshot({path:path.join(out,name+'.png'),animations:'disabled'});}
async function openLog(page){await page.locator('[data-action="log"]:visible').first().click();await page.waitForSelector('#duel-journal');}
async function fixture(page,{mode='spectate',extra=0,legacy=false}={}){
 return page.evaluate(({mode,extra,legacy})=>{
  const e=new DuelEngine({deck:'blue',opponentDeck:'dark',first:0,seed:310913});e.state.turn=4;e.state.phase='main1';e.state.mode=mode;
  for(const p of e.state.players){p.deck.push(...p.hand);p.hand=[];}e.state.players[1].lp=14000;
  const put=(owner,zone,name,props={})=>{const id=DuelData.CARDS[name]?name:DuelData.cardByName(name).id,m=e.makeCard(id,owner);Object.assign(m,{faceUp:true,position:'attack',summonTurn:0,changedTurn:0,setTurn:0},props);const p=e.state.players[owner];if(['monsters','spells'].includes(zone))p[zone][p[zone].indexOf(null)]=m;else p[zone].push(m);e.state.originalCardCount=e.physicalCards().filter(m=>DuelData.CARDS[m.id].type!=='token').length;return m;};
  const act=a=>{const r=e.act(a);if(!r.ok)throw Error(r.error);};
  const settle=()=>{let n=0;while(e.state.pending&&n++<120){const p=e.state.pending;act(p.kind==='window'||p.kind==='trigger'&&!p.trigger.mandatory?{type:'pass'}:e.chooseAI(p));}if(n>=120)throw Error('fixture did not resolve');};
  const run=a=>{act(a);settle();};
  const cast=(s,choices)=>run({type:'activate',uid:s.uid,key:s.id+'::cast',choices});
  const blue=put(0,'grave','Blue-Eyes White Dragon'),reborn=put(0,'hand','Monster Reborn');cast(reborn,{target:[blue.uid]});
  const target=put(1,'monsters','Dark Magician'),cost=put(0,'hand','Battle Ox'),trap=put(0,'spells','Raigeki Break',{faceUp:false});cast(trap,{cost:[cost.uid],target:[target.uid]});
  run({type:'phase',phase:'battle'});run({type:'attack',uid:blue.uid});run({type:'end'});
  const sparks=put(1,'hand','Sparks');cast(sparks);run({type:'end'});const medicine=put(0,'hand','Red Medicine');cast(medicine);
  for(let n=0;n<extra;n++)e.log('phase','额外浏览记录 '+n,0);
  const saved=e.snapshot();if(legacy){delete saved.state.logVersion;for(const l of saved.state.log)delete l.trace;}
  duelApp.restore(saved);if(mode==='spectate'&&!duelApp.spectate.paused)duelApp.spectateToggle();
  return {count:e.state.log.length,reborn:reborn.id,trap:trap.id,blue:blue.id};
 },{mode,extra,legacy});
}
async function geometry(page,label){
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const g=await page.evaluate(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,height:r.height};};return{viewport:[innerWidth,innerHeight],scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],modal:box('#modal'),list:box('#journal-events'),footer:box('#modal .modal-footer'),turn:box('#journal-turn')};});
 report.geometry.push({label,...g});assert.ok(g.scroll[0]<=g.viewport[0]+1&&g.scroll[1]<=g.viewport[1]+1,JSON.stringify(g));assert.ok(g.list.height>=55&&g.list.bottom<=g.footer.y+1,JSON.stringify(g));
 for(const r of [g.modal,g.footer,g.turn])assert.ok(r.x>=-1&&r.right<=g.viewport[0]+1&&r.y>=-1&&r.bottom<=g.viewport[1]+1,JSON.stringify(g));
}
(async()=>{
 await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.DUEL_BROWSER||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',args:['--mute-audio','--no-first-run']});
 const context=await browser.newContext({viewport:{width:1440,height:960},acceptDownloads:true});await context.route(/https?:\/\//,r=>r.abort());
 await context.addInitScript(()=>{localStorage.setItem('duel-sanctuary-prefs-v1',JSON.stringify({sound:false,music:false,reducedMotion:true,speed:'fast',fontScale:150}));localStorage.setItem('duel-sanctuary-online-art-v2','false');});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.setDefaultTimeout(15000);let before,data;
 try{
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);await page.waitForFunction(()=>window.duelApp&&document.documentElement.dataset.ready==='true');
  data=await fixture(page);before=await page.evaluate(()=>JSON.stringify(duelApp.engine.snapshot()));await openLog(page);
  await check('the latest turn opens first, and earlier turns show actual causes and card destinations',async()=>{
   assert.equal(await page.locator('#journal-turn').inputValue(),'6');await page.selectOption('#journal-turn','4');
   assert.match(await page.locator('#journal-events').innerText(),/死者苏生/);assert.match(await page.locator('#journal-events').innerText(),/手牌 → 墓地/);assert.match(await page.locator('#journal-events').innerText(),/代价/);assert.match(await page.locator('#journal-events').innerText(),/墓地 → 怪兽区/);
   const ns=await page.locator('[data-log-number]').evaluateAll(es=>es.map(e=>Number(e.dataset.logNumber)));assert.deepEqual(ns,[...ns].sort((a,b)=>a-b));await geometry(page,'desktop');await shot(page,'01-turn-four');
  });
  await check('LP filtering exposes the battle source and LP before and after damage',async()=>{
   await page.click('[data-journal-action=filter][data-value=lp]');assert.equal(await page.locator('.journal-entry').count(),1);assert.match(await page.locator('.journal-cause').innerText(),/青眼白龙/);assert.match(await page.locator('.journal-change').innerText(),/14,000 → 11,000/);await shot(page,'02-battle-damage');
   await page.click('[data-journal-action=next]');assert.equal(await page.locator('#journal-turn').inputValue(),'5');assert.match(await page.locator('#journal-events').innerText(),/火/);await page.click('[data-journal-action=previous]');
  });
  await check('search accepts alternate card languages and card details return to the same turn and filters',async()=>{
   await page.click('[data-journal-action=filter][data-value=all]');await page.fill('#journal-search','Monster Reborn');assert.ok(await page.locator('.journal-entry').count()>0);assert.match(await page.locator('#journal-events').innerText(),/死者苏生/);
   await page.locator('[data-journal-action=card][data-card="monster-reborn"]').first().click();await page.waitForSelector('.card-detail-layout');await page.click('[data-action=detail-back]');assert.equal(await page.locator('#journal-turn').inputValue(),'4');assert.equal(await page.locator('#journal-search').inputValue(),'Monster Reborn');
   await page.fill('#journal-search','no-such-event-913');await page.waitForSelector('.journal-empty');await page.click('[data-journal-action=reset]');assert.equal(await page.locator('#journal-search').inputValue(),'');
  });
  await check('three language switches keep the selected turn and its source detail',async()=>{
   for(const [language,pattern] of [['en',/Monster Reborn/],['ja',/死者蘇生/],['zh-CN',/死者苏生/]]){await page.selectOption('#modal [data-locale-select]',language);assert.equal(await page.locator('#journal-turn').inputValue(),'4');assert.match(await page.locator('#journal-events').innerText(),pattern);await shot(page,'03-journal-'+language);}
  });
  await check('export includes every recorded turn and structured causes even when the view is filtered',async()=>{
   await page.click('[data-journal-action=filter][data-value=lp]');const promise=page.waitForEvent('download');await page.click('[data-action=export-log]');const download=await promise,file=path.join(out,'duel-history.json');await download.saveAs(file);const saved=JSON.parse(await fs.readFile(file,'utf8'));
   assert.equal(saved.format,'duel-sanctuary-log');assert.equal(saved.log.length,data.count);assert.deepEqual(saved.turns.map(g=>g.turn),[1,4,5,6]);assert.ok(saved.log.some(l=>l.kind==='special'&&l.trace.cause.cardId===data.reborn));assert.ok(saved.log.some(l=>l.trace?.cause?.kind==='cost'&&l.trace.cause.cardId===data.trap));
   assert.equal(await page.evaluate(()=>JSON.stringify(duelApp.engine.snapshot())),before);
  });
  await check('mobile, short landscape and large fonts keep turn controls and the timeline usable',async()=>{
   await page.click('[data-journal-action=filter][data-value=all]');
   for(const [width,height] of [[320,568],[390,844],[844,390],[640,360],[1024,768]])for(const lang of ['zh-CN','en','ja']){await page.setViewportSize({width,height});await page.selectOption('#modal [data-locale-select]',lang);await geometry(page,width+' '+lang);if(lang==='zh-CN')await shot(page,'04-journal-'+width);}
   await page.click('#modal [data-action=close-modal]');await page.setViewportSize({width:844,height:390});await page.click('.journal-open');await page.waitForSelector('#duel-journal');
   await page.setViewportSize({width:1440,height:960});await page.click('#modal [data-action=close-modal]');
  });
  await check('long histories load in batches without losing the earliest turns',async()=>{
   await fixture(page,{extra:210});await openLog(page);await page.selectOption('#journal-turn','all');assert.equal(await page.locator('.journal-entry').count(),100);await page.click('[data-journal-action=more]');assert.equal(await page.locator('.journal-entry').count(),200);await page.selectOption('#journal-turn','1');assert.ok(await page.locator('.journal-entry').count()>0);await page.click('#modal [data-action=close-modal]');
  });
  await check('old saves remain readable and identify unavailable source details honestly',async()=>{
   await fixture(page,{legacy:true});await openLog(page);await page.waitForSelector('.journal-legacy');assert.equal(await page.locator('.journal-cause').count(),0);await shot(page,'05-legacy-history');
  });
  assert.deepEqual(report.errors,[]);
 }catch(error){report.failure={message:error.message,stack:error.stack};console.error(error);await shot(page,'failure').catch(()=>{});process.exitCode=1;}
 finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
})();
