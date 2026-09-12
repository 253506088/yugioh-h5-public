const {chromium}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/experience-browser');
const browserPath=process.env.DUEL_BROWSER||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const report={checks:[],geometry:[],errors:[]};
async function check(name,run){await run();report.checks.push(name);console.log('OK',name);}
async function settle(page){await page.waitForTimeout(380);}
async function screenshot(page,name){await settle(page);await page.screenshot({path:path.join(out,name+'.png'),fullPage:false,animations:'disabled'});}
async function fixture(page){
  return page.evaluate(()=>{
    const e=new DuelEngine({deck:'early-fusion',opponentDeck:'blue',first:0,seed:48});e.state.turn=4;e.state.phase='main1';
    for(const p of e.state.players){p.deck.push(...p.hand);p.hand=[];}
    function put(owner,zone,id,extra={}){const found=e.refs(owner,['deck','extra']).find(f=>f.card.id===id);const c=found?e.remove(found.card.uid).card:e.makeCard(id,owner);Object.assign(c,{faceUp:true,position:'attack',summonTurn:1,changedTurn:1,setTurn:1},extra);if(['monsters','spells'].includes(zone))e.state.players[owner][zone][extra.slot??e.state.players[owner][zone].indexOf(null)]=c;else e.state.players[owner][zone].push(c);return c;}
    put(1,'monsters','blue-eyes',{slot:2});put(1,'monsters','battle-ox',{slot:3});put(1,'spells','mirror-force',{faceUp:false,slot:1});put(1,'spells','mst',{faceUp:false,slot:3});
    put(0,'monsters','dark-magician',{slot:2});put(0,'monsters','gaia',{slot:1});put(0,'spells','mirror-force',{faceUp:false,slot:2});
    for(const id of ['monster-reborn','polymerization','pot-of-greed','curse-dragon','mst'])put(0,'hand',id);
    for(const id of ['blue-eyes','battle-ox','kaibaman'])put(1,'hand',id);
    e.state.players[0].lp=6200;e.state.players[1].lp=7800;e.state.originalCardCount=e.physicalCards().filter(c=>DuelData.CARDS[c.id].type!=='token').length;
    duelApp.restore(e.snapshot());
  });
}
(async()=>{
  await fs.mkdir(out,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:browserPath,args:['--no-first-run','--disable-background-networking','--mute-audio']});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    await context.addInitScript(()=>{localStorage.setItem('duel-sanctuary-prefs-v1',JSON.stringify({sound:false,music:true,speed:'fast',reducedMotion:false}));localStorage.setItem('duel-sanctuary-online-art-v2','false');});
    await context.route(/https?:\/\//,r=>r.abort());
    const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.stack));
    await page.goto(pathToFileURL(path.join(root,'index.html')).href,{waitUntil:'load',timeout:60000});
    await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    await check('home replaces the tab navigation and continues the same duel',async()=>{
      assert.equal(await page.evaluate(()=>duelApp.screen),'home');await screenshot(page,'01-home-desktop');
      const state=await page.evaluate(()=>JSON.stringify(duelApp.engine.snapshot()));await page.click('#home-continue');
      assert.equal(await page.evaluate(()=>duelApp.screen),'duel');assert.equal(await page.evaluate(()=>JSON.stringify(duelApp.engine.snapshot())),state);
    });
    await fixture(page);
    await check('the full battlefield and hand stay inside one viewport',async()=>{
      for(const [width,height] of [[1440,900],[1366,768],[1920,1080],[2560,1440],[1024,768],[390,844],[390,670],[844,390]]){
        await page.setViewportSize({width,height});await settle(page);
        const geometry=await page.evaluate(()=>{
          const selectors=['#opponent-bar','#opponent-spells','#opponent-monsters','#extra-lane','#phase-track','#player-monsters','#player-spells','#player-bar','#hand-cards'];
          const boxes=selectors.map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {selector,x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};});
          return {viewport:[innerWidth,innerHeight],scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],boxes,zoneHeight:document.querySelector('.player-monsters .zone').getBoundingClientRect().height};
        });
        report.geometry.push(geometry);await screenshot(page,'duel-'+width+'x'+height);
        assert.ok(geometry.scroll[0]<=width+1&&geometry.scroll[1]<=height+1,JSON.stringify(geometry));
        for(const r of geometry.boxes)assert.ok(r.x>=-1&&r.y>=0&&r.bottom<=height+1&&r.right<=width+1&&r.height>0,JSON.stringify(r));
        assert.ok(geometry.zoneHeight>=18,'Zones remain usable at '+width+'x'+height);
      }
    });
    await page.setViewportSize({width:1440,height:900});
    await check('text size changes independently, persists, and keeps the board visible',async()=>{
      const before=await page.locator('#card-information .card-description').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
      await page.click('.header-tools [data-action=settings]');await page.locator('[data-action=font-preset][data-value="150"]').click();
      await screenshot(page,'02-settings-large-type');await page.click('#modal [data-action=close-modal]');
      const after=await page.locator('#card-information .card-description').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));assert.ok(after>before*1.25);
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('duel-sanctuary-prefs-v1')).fontScale),150);
      await screenshot(page,'03-duel-large-type');await page.click('.header-tools [data-action=settings]');await page.locator('[data-action=font-preset][data-value="115"]').click();await page.click('#modal [data-action=close-modal]');
    });
    await check('archive pagination stays pinned and supports page size, jump and empty results',async()=>{
      await page.evaluate(()=>duelApp.showLibrary());await page.selectOption('#library-page-size','48');
      assert.equal(await page.locator('#library-grid .library-card').count(),48);
      const before=await page.locator('#library-pagination').boundingBox();await page.locator('#modal .modal-body').evaluate(el=>el.scrollTop=el.scrollHeight);const after=await page.locator('#library-pagination').boundingBox();assert.ok(Math.abs(before.y-after.y)<1);
      await page.locator('#library-page-jump').fill('9999');await page.locator('#library-page-jump').press('Tab');assert.equal(await page.locator('[data-action=library-page][data-delta="1"]').isDisabled(),true);
      await page.selectOption('#library-page-size','24');await page.fill('#library-search','this-card-does-not-exist');assert.equal(await page.locator('#library-grid .library-card').count(),0);assert.equal(await page.locator('[data-action=library-page][data-delta="-1"]').isDisabled(),true);
      await page.fill('#library-search','');await screenshot(page,'04-archive');await page.click('#modal [data-action=close-modal]');
    });
    await check('workshop page size and pinned pagination work without losing the draft',async()=>{
      await page.evaluate(()=>duelApp.showWorkshop('early-fusion'));await page.locator('#modal').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{}))));const before=await page.evaluate(()=>JSON.stringify(duelApp.workshopDraft));await page.selectOption('#ws-page-size','48');assert.equal(await page.locator('#ws-card-grid .ws-card').count(),48);const rect=await page.locator('#ws-pagination').boundingBox();await page.locator('#ws-card-grid').evaluate(el=>el.scrollTop=el.scrollHeight);assert.equal(Math.round((await page.locator('#ws-pagination').boundingBox()).y),Math.round(rect.y));assert.equal(await page.evaluate(()=>JSON.stringify(duelApp.workshopDraft)),before);await screenshot(page,'05-workshop');await page.click('#modal [data-action=close-modal]');
    });
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>duelApp.showHome());await screenshot(page,'06-home-mobile');await page.evaluate(()=>duelApp.showLibrary());await screenshot(page,'07-archive-mobile');await page.click('#modal [data-action=close-modal]');await page.evaluate(()=>duelApp.showWorkshop());await screenshot(page,'08-workshop-mobile');
    assert.deepEqual(report.errors,[]);
    report.ok=true;
  }finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
