const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium}=require('playwright');
(async()=>{
 const output=process.env.DUEL_TOURNAMENT_OUTPUT||'output/performance/tournament-'+new Date().toISOString().replace(/[:.]/g,'-');await fs.mkdir(output,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.DUEL_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage();await page.addInitScript(()=>{localStorage.setItem('duel-sanctuary-prefs-v1',JSON.stringify({sound:false,music:false,reducedMotion:true}));localStorage.setItem('duel-sanctuary-online-art-v2','false');});
  await page.goto(process.env.DUEL_WEB_URL||'http://127.0.0.1:4173');await page.click('[data-action="tournament"]');await page.waitForSelector('[data-t-action="start"]',{timeout:120000});
  await page.locator('.t-advanced summary').click();await page.selectOption('#t-difficulty','casual');await page.selectOption('#t-pace','turbo');await page.click('[data-t-action="count"][data-value="8"]');
  for(let i=0;i<8;i++)await page.locator('[data-t-field="seat"]').nth(i).selectOption(i%2?'dark':'blue');
  await page.evaluate(()=>{window.uiLongTasks=[];window.uiObserver=new PerformanceObserver(list=>uiLongTasks.push(...list.getEntries().map(e=>e.duration)));uiObserver.observe({type:'longtask'});});
  await page.click('[data-t-action="start"]');await page.waitForFunction(()=>duelApp.tournament.current?.matches?.some(m=>m.games.length),null,{timeout:120000});
  await page.click('[data-t-action="toggle"]');assert.equal(await page.evaluate(()=>duelApp.tournament.current.status),'paused');
  const before=await page.evaluate(()=>duelApp.tournament.current.revision);await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>duelApp.tournament.current.revision),before);
  await page.click('[data-t-action="toggle"]');
  await page.waitForFunction(()=>duelApp.tournament.current.status==='completed',null,{timeout:240000});
  const timings=await page.evaluate(()=>{uiObserver.disconnect();return {longTasks:uiLongTasks.length,maxLongTaskMs:Math.max(0,...uiLongTasks),blockedMs:uiLongTasks.reduce((n,d)=>n+Math.max(0,d-50),0)};});
  const data=await page.evaluate(()=>duelApp.tournament.current.snapshot());
  const errors=data.matches.filter(m=>m.status==='error');assert.equal(errors.length,0);assert.equal(data.matches.filter(m=>m.status==='complete').length,7);
  await fs.writeFile(output+'/event.json',JSON.stringify(data));
  const replay=await page.evaluate(data=>{
   let games=0,actions=0;
   for(const match of data.matches)for(const game of match.games){const engine=DuelEngine.restore(game.initial);for(const step of game.steps){engine.randomState=step.randomState;const r=engine.act(step.action);if(!r.ok)throw Error(r.error);actions++;}if(JSON.stringify(engine.snapshot())!==JSON.stringify(game.final))throw Error('Replay mismatch '+match.id);games++;}
   return {games,actions,concurrency:data.settings.concurrency};
  },data);
  await fs.writeFile(output+'/report.json',JSON.stringify({pauseResponsive:true,...replay,...timings},null,2));console.log(JSON.stringify(replay));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
