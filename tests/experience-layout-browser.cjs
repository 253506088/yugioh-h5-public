const {chromium}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/experience-layout-browser');
const report={checks:[],geometry:[],errors:[]};
const sizes=[[320,568],[390,670],[768,1024],[1024,768],[1280,720],[844,390],[640,360]];
async function check(name,run){await run();report.checks.push(name);console.log('OK',name);}
async function stable(page){await page.waitForFunction(()=>Math.abs(parseFloat(getComputedStyle(document.body).height)-innerHeight)<2);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.locator('#modal').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{}))));await page.waitForTimeout(100);}
async function shot(page,name){await page.screenshot({path:path.join(out,name+'.png'),animations:'disabled'});}
async function fieldGeometry(page){
  return page.evaluate(()=>{
    const box=selector=>{const el=document.querySelector(selector),r=el.getBoundingClientRect();return {selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    return {viewport:[innerWidth,innerHeight],scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],arena:box('.arena'),column:box('.arena-column'),sidebar:box('.right-column'),header:['.brand','#duel-turn-hud','.header-tools'].map(box),field:['#opponent-bar','#opponent-spells','#opponent-monsters','#extra-lane','#phase-track','#player-monsters','#player-spells','#player-bar'].map(box),phases:[...document.querySelectorAll('.phase-step')].map(el=>{const r=el.getBoundingClientRect();return {x:r.x,right:r.right};}),hand:box('#hand-cards'),music:box('#music-dock')};
  });
}
function assertField(g){
  const [width,height]=g.viewport;
  assert.ok(g.scroll[0]<=width+1&&g.scroll[1]<=height+1,JSON.stringify(g));
  for(const r of [...g.field,g.hand])assert.ok(r.width>0&&r.height>0&&r.x>=-1&&r.right<=width+1&&r.y>=0&&r.bottom<=height+1,JSON.stringify(r));
  for(const r of g.field)assert.ok(r.x>=g.arena.x-1&&r.right<=g.arena.right+1,'Field row escaped arena: '+JSON.stringify(r));
  if(g.sidebar.width)assert.ok(g.column.right<=g.sidebar.x+1,'Sidebar overlaps field');
  if(g.music.width)assert.ok(g.music.x>=g.column.right-1||g.music.right<=g.column.x+1,'Music controls overlap the field or hand');
  for(let i=1;i<g.header.length;i++)assert.ok(g.header[i-1].right<=g.header[i].x+1,'Header controls overlap');
  const track=g.field.find(r=>r.selector==='#phase-track');
  for(const r of g.phases)assert.ok(r.x>=track.x-1&&r.right<=track.right+1,'A phase is clipped');
}
(async()=>{
  await fs.mkdir(out,{recursive:true});
  let executablePath=process.env.DUEL_BROWSER;
  const edge='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if(!executablePath)try{await fs.access(edge);executablePath=edge;}catch{}
  const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{}),args:['--no-first-run','--mute-audio']});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    await context.addInitScript(()=>{
      if(!localStorage.getItem('duel-sanctuary-prefs-v1'))localStorage.setItem('duel-sanctuary-prefs-v1',JSON.stringify({sound:false,music:true,fontScale:150,speed:'fast',reducedMotion:true}));
      localStorage.setItem('duel-sanctuary-online-art-v2','false');
    });
    await context.route(/https?:\/\//,r=>r.abort());
    const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.stack));
    await page.goto(pathToFileURL(path.join(root,'index.html')).href);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    await page.click('#home-continue');
    await check('150% text preserves the entire field, phases and header in three languages at seven screen sizes',async()=>{
      for(const [width,height] of sizes)for(const language of ['zh-CN','en','ja']){
        await page.setViewportSize({width,height});await page.evaluate(l=>duelApp.setLanguage(l),language);await stable(page);
        const geometry=await fieldGeometry(page);report.geometry.push({language,...geometry});assertField(geometry);
        if(language==='en'&&[320,768,844].includes(width))await shot(page,'field-'+width+'x'+height+'-large-en');
      }
    });
    await check('twenty cards remain individually reachable without widening or scrolling the battlefield',async()=>{
      await page.setViewportSize({width:390,height:844});
      await page.evaluate(()=>{const e=new DuelEngine({deck:'blue',opponentDeck:'dark',first:0,seed:70});e.state.players[0].hand.push(...e.state.players[0].deck.splice(0,15));duelApp.restore(e.snapshot());});
      await stable(page);assertField(await fieldGeometry(page));
      assert.equal(await page.locator('#hand-cards .hand-slot').count(),20);
      assert.equal(await page.locator('#hand-cards').evaluate(el=>el.scrollWidth>el.clientWidth),true);
      const before=await page.evaluate(()=>JSON.stringify(duelApp.engine.snapshot()));
      await page.locator('#hand-cards').evaluate(el=>el.scrollLeft=el.scrollWidth);
      await page.locator('#hand-cards .hand-slot').last().click();
      assert.equal(await page.locator('#card-popover').isVisible(),true);
      assert.equal(await page.evaluate(()=>JSON.stringify(duelApp.engine.snapshot())),before);
      await shot(page,'twenty-card-hand');await page.keyboard.press('Escape');
    });
    await check('short-screen workshop filters unfold without hiding cards or moving pagination off screen',async()=>{
      await page.evaluate(()=>duelApp.setLanguage('zh-CN'));
      for(const [width,height] of [[320,568],[390,670],[844,390],[640,360]]){
        await page.setViewportSize({width,height});await page.evaluate(()=>duelApp.showWorkshop('early-fusion'));await stable(page);
        const bounds=await page.evaluate(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,right:r.right,y:r.y,bottom:r.bottom,height:r.height};};return {grid:box('#ws-card-grid'),pager:box('#ws-pagination'),footer:box('#modal .modal-footer')};});
        assert.ok(bounds.grid.height>=65,JSON.stringify(bounds));
        for(const r of Object.values(bounds))assert.ok(r.x>=0&&r.right<=width&&r.y>=0&&r.bottom<=height,JSON.stringify(bounds));
        await page.click('#ws-filter-toggle');await page.selectOption('#ws-year','2001');await page.click('.ws-filter-done');
        assert.equal(await page.locator('#ws-filter-toggle').getAttribute('aria-expanded'),'false');
        assert.match(await page.locator('#ws-result-count').textContent(),/^242 /);
        await page.selectOption('#ws-page-size','48');
        const before=await page.locator('#ws-pagination').boundingBox();
        await page.locator('#ws-card-grid').evaluate(el=>el.scrollTop=el.scrollHeight);
        const after=await page.locator('#ws-pagination').boundingBox();assert.ok(Math.abs(before.y-after.y)<1);
        await shot(page,'workshop-'+width+'x'+height);await page.click('#modal [data-action=close-modal]');
      }
    });
    await check('all requested card frames are previewed and full-art cards keep their reading layout',async()=>{
      await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>duelApp.showSettings());
      const frames=await page.locator('.frame-samples .playing-card').evaluateAll(els=>els.map(el=>el.dataset.frame));
      assert.deepEqual(new Set(frames),new Set(['normal','effect','fusion','synchro','xyz','pendulum','ritual','link','spell','trap']));
      await page.selectOption('#card-style','full-art');
      await page.waitForFunction(()=>{const el=document.querySelector('.frame-samples .playing-card');return el.querySelector('.pc-art').getBoundingClientRect().height>=el.getBoundingClientRect().height-5;});
      const full=await page.locator('.frame-samples .playing-card').first().evaluate(el=>({card:el.getBoundingClientRect().height,art:el.querySelector('.pc-art').getBoundingClientRect().height}));
      assert.ok(full.art>=full.card-5,JSON.stringify(full));
      await page.selectOption('#card-style','classic');await page.click('[data-action=font-preset][data-value="130"]');await page.click('#modal [data-action=close-modal]');
    });
    await check('font and page-size preferences survive refresh while the saved duel remains intact',async()=>{
      await page.evaluate(()=>duelApp.showLibrary());await page.selectOption('#library-page-size','96');await page.click('#modal [data-action=close-modal]');
      const before=await page.evaluate(()=>JSON.stringify(duelApp.engine.snapshot()));
      await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
      assert.equal(await page.evaluate(()=>duelApp.screen),'home');
      const prefs=await page.evaluate(()=>duelApp.preferences);assert.equal(prefs.fontScale,130);assert.equal(prefs.libraryPageSize,96);assert.equal(prefs.workshopPageSize,48);
      await page.click('#home-continue');assert.equal(await page.evaluate(()=>JSON.stringify(duelApp.engine.snapshot())),before);
    });
    assert.deepEqual(report.errors,[]);report.ok=true;
  }finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
