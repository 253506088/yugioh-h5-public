const {chromium}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/polish-browser');
const report={checks:[],errors:[],geometry:[]},repository='https://github.com/253506088/yugioh-h5-public';
async function check(name,run){await run();report.checks.push(name);console.log('OK',name);}
async function shot(page,name){await page.screenshot({path:path.join(out,name+'.png'),animations:'disabled'});}
async function stable(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function close(page){if(await page.locator('#modal').evaluate(el=>el.open))await page.locator('#modal [data-action="close-modal"]').first().click();}
async function fixture(page,kind,mode='spectate'){
  return page.evaluate(({kind,mode})=>{
    const e=new DuelEngine({deck:'blue',opponentDeck:'dark',seed:13906,first:0});e.state.turn=4;e.state.phase='main1';e.state.mode=mode;
    for(const p of e.state.players){p.deck.push(...p.hand);p.hand=[];}
    const put=(owner,zone,name,props={})=>{
      const id=DuelData.CARDS[name]?name:DuelData.cardByName(name).id,m=e.makeCard(id,owner);
      Object.assign(m,{faceUp:true,position:'attack',summonTurn:1,changedTurn:1,setTurn:1},props);
      const p=e.state.players[owner];if(['monsters','spells'].includes(zone))p[zone][p[zone].indexOf(null)]=m;else p[zone].push(m);
      e.state.originalCardCount=e.physicalCards().filter(m=>DuelData.CARDS[m.id].type!=='token').length;return m;
    };
    let uid=null;
    if(kind==='win'){put(0,'monsters','blue-eyes');put(1,'monsters','battle-ox');e.state.players[1].lp=500;uid=put(0,'hand','pot-of-greed').uid;}
    if(kind==='defense'){put(1,'monsters','blue-eyes');e.state.players[0].lp=1200;uid=put(0,'hand','battle-ox').uid;}
    if(kind==='deck-out'){e.state.phase='main2';e.state.players[1].grave.push(...e.state.players[1].deck.splice(0));}
    if(kind==='exodia'){for(const c of DuelData.CARD_LIST.filter(c=>c.exodiaPart))put(0,'hand',c.id);e.checkWin();}
    if(kind==='special'){const id=DuelData.cardByName('Final Countdown').id;e.finish(0,'终焉之倒计时：20回合已经经过。',{kind:'special',sourceId:id});}
    duelApp.restore(e.snapshot());if(mode==='spectate'&&!duelApp.spectate.paused)duelApp.spectateToggle();
    return uid;
  },{kind,mode});
}
async function step(page){await page.evaluate(()=>duelApp.skipChain());await page.click('#turn-panel [data-action="spectate-step"]');await page.evaluate(()=>duelApp.skipChain());}
async function geometry(page,label){
  await stable(page);
  // Locale changes and the result banner's ResizeObserver can schedule a
  // second layout after the viewport resize; inspect the settled board.
  await page.waitForFunction(()=>['#opponent-monsters','#player-monsters','#phase-track','#hand-cards'].every(s=>document.querySelector(s).getBoundingClientRect().height>0),null,{timeout:5000});
  const g=await page.evaluate(()=>{
    const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    return {viewport:[innerWidth,innerHeight],scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],bar:box('#tournament-viewer-bar'),notice:box('.t-result-notice'),board:box('#duel-board'),rows:['#opponent-monsters','#player-monsters','#phase-track','#hand-cards'].map(box)};
  });report.geometry.push({label,...g});
  assert.ok(g.scroll[0]<=g.viewport[0]+1&&g.scroll[1]<=g.viewport[1]+1,JSON.stringify(g));
  assert.ok(g.board.y>=g.bar.bottom-1&&g.notice.bottom<=g.bar.bottom+1,JSON.stringify(g));
  for(const r of g.rows)assert.ok(r.width>0&&r.height>0&&r.x>=-1&&r.right<=g.viewport[0]+1&&r.y>=0&&r.bottom<=g.viewport[1]+1,JSON.stringify({label,r}));
}

(async()=>{
  await fs.mkdir(out,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.DUEL_BROWSER||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',args:['--no-first-run','--disable-background-networking','--mute-audio']});
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.route(/https?:\/\//,r=>r.abort());
  await context.addInitScript(()=>{
    localStorage.setItem('duel-sanctuary-prefs-v1',JSON.stringify({sound:false,music:false,reducedMotion:true,speed:'fast',fontScale:150}));
    localStorage.setItem('duel-sanctuary-online-art-v2','false');
  });
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.setDefaultTimeout(15000);
  try{
    await page.goto(pathToFileURL(path.join(root,'index.html')).href);await page.waitForFunction(()=>window.duelApp&&document.documentElement.dataset.ready==='true');await page.evaluate(()=>duelApp.tournament.ready);
    await check('author and repository remain reachable in settings and the footer in all three languages',async()=>{
      for(const locale of ['zh-CN','en','ja']){
        await page.evaluate(l=>{duelApp.showHome();duelApp.setLanguage(l);},locale);
        const link=page.locator('#home-screen footer .project-signature');assert.equal(await link.getAttribute('href'),repository);assert.match(await link.innerText(),/不锈钢琴/);
        await link.scrollIntoViewIfNeeded();assert.equal(await link.isVisible(),true);
        await page.click('#home-screen [data-action="settings"]');const credit=page.locator('#modal .project-credit');await credit.scrollIntoViewIfNeeded();
        assert.match(await credit.innerText(),/不锈钢琴/);assert.equal(await credit.locator('a').getAttribute('href'),repository);assert.equal(await credit.locator('a').getAttribute('target'),'_blank');
        await shot(page,'settings-'+locale);await close(page);
      }
      await page.evaluate(()=>{duelApp.showHome();duelApp.setLanguage('zh-CN');});await shot(page,'home-desktop');
      for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
        await page.setViewportSize(viewport);const link=page.locator('#home-screen footer .project-signature');await link.scrollIntoViewIfNeeded();
        const b=await link.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=viewport.width&&b.y+b.height<=viewport.height);
        await shot(page,'home-'+viewport.width);
      }await page.setViewportSize({width:1440,height:900});
    });
    await check('spectator controls execute the winning battle before optional card play',async()=>{
      const uid=await fixture(page,'win');await step(page);assert.equal(await page.evaluate(()=>duelApp.engine.state.phase),'battle');
      assert.equal(await page.evaluate(uid=>duelApp.engine.find(uid).zone,uid),'hand');await step(page);
      await page.waitForSelector('#modal[open] .result-cause[data-outcome-kind="lp-zero"]');
      assert.equal(await page.evaluate(()=>duelApp.engine.state.winner),0);await shot(page,'spectator-winning-battle');await close(page);
    });
    await check('spectator controls show a real face-down Defense Set when it prevents lethal damage',async()=>{
      const uid=await fixture(page,'defense');await step(page);const m=await page.evaluate(uid=>duelApp.engine.find(uid).card,uid);
      assert.equal(m.faceUp,false);assert.equal(m.position,'defense');await shot(page,'spectator-defense-set');
    });
    await check('normal and spectator deck-out automatically show a readable cause and record it in all languages',async()=>{
      for(const mode of ['normal','spectate']){
        await fixture(page,'deck-out',mode);
        if(mode==='normal')assert.equal(await page.evaluate(()=>duelApp.act({type:'end'})),true);else await step(page);
        await page.waitForSelector('#modal[open] .result-cause[data-outcome-kind="deck-out"]');
        for(const [locale,pattern] of [['zh-CN',/无牌可抽/],['en',/could not draw a required card/],['ja',/必要なドロー/]]){
          await page.selectOption('#modal [data-locale-select]',locale);assert.match(await page.locator('.result-cause').innerText(),pattern);
          await shot(page,mode+'-deck-out-'+locale);
        }
        for(const viewport of [{width:320,height:568},{width:844,height:390}]){
          await page.setViewportSize(viewport);await page.locator('.result-cause').scrollIntoViewIfNeeded();
          assert.equal(await page.locator('.duel-result').evaluate(el=>el.scrollHeight<=el.clientHeight||['auto','scroll'].includes(getComputedStyle(el).overflowY)),true,'result contents must remain scrollable by the user');
          const b=await page.locator('.result-cause').boundingBox();assert.ok(b.x>=0&&b.x+b.width<=viewport.width&&b.y>=0&&b.y+b.height<=viewport.height,JSON.stringify(b));
          await shot(page,mode+'-deck-out-'+viewport.width);
          await page.locator('.result-close').scrollIntoViewIfNeeded();const button=await page.locator('.result-close').boundingBox();assert.ok(button.y>=0&&button.y+button.height<=viewport.height,JSON.stringify(button));
        }await page.setViewportSize({width:1440,height:900});
        await close(page);await page.locator('[data-action="log"]:visible').first().click();assert.match(await page.locator('.log-modal-list .victory').innerText(),/必要なドロー/);await close(page);
      }
    });
    await check('saved special victories preserve both their cause and the winning card',async()=>{
      for(const kind of ['exodia','special']){
        await fixture(page,kind,'normal');await page.locator('[data-action="result"]:visible').first().click();
        assert.equal(await page.locator('.result-cause').getAttribute('data-outcome-kind'),kind);
        await page.selectOption('#modal [data-locale-select]','en');assert.match(await page.locator('.result-cause').innerText(),kind==='exodia'?/all five different Exodia pieces/:/Final Countdown/);
        await shot(page,kind+'-result');await close(page);
      }
    });
    await check('a live arena deck-out exposes its cause, survives replay, and hides the banner when seeking backward',async()=>{
      await page.evaluate(()=>{duelApp.setLanguage('zh-CN');duelApp.showTournament();});await page.waitForSelector('#t-count');
      await page.fill('#t-count','2');await page.locator('#t-count').blur();await page.selectOption('#t-seat-0','blue');await page.selectOption('#t-seat-1','dark');await page.selectOption('#t-pace','normal');
      await page.evaluate(async()=>{
        await duelApp.tournament.start();const cup=duelApp.tournament.current,match=cup.matches[0],e=cup.openGame(match);
        e.state.turn=4;e.state.active=0;e.state.phase='main2';for(const p of e.state.players){p.deck.push(...p.hand);p.hand=[];}
        e.state.players[1].grave.push(...e.state.players[1].deck.splice(0));match.games[0].initial=e.snapshot();duelApp.tournament.watch(match.id);
      });
      assert.equal(await page.locator('.t-result-notice').isVisible(),false);
      await page.waitForSelector('.t-result-notice[data-outcome-kind="deck-out"]:visible');
      assert.equal(await page.evaluate(()=>duelApp.tournament.current.status),'completed');assert.match(await page.locator('.t-result-notice').innerText(),/无牌可抽/);
      await geometry(page,'desktop end');await shot(page,'arena-deck-out-desktop');
      const slider=await page.locator('#t-replay-slider').elementHandle();await page.evaluate(()=>duelApp.tournament.seek(0));
      assert.equal(await page.locator('.t-result-notice').isVisible(),false);assert.equal(await slider.evaluate(el=>el.isConnected),true);
      await page.evaluate(()=>duelApp.tournament.seek(duelApp.tournament.viewer.cursor.game.steps.length));assert.equal(await page.locator('.t-result-notice').isVisible(),true);
      assert.equal(await page.evaluate(()=>JSON.stringify(duelApp.engine.snapshot())===JSON.stringify(duelApp.tournament.viewer.cursor.game.final)),true);
    });
    await check('end-cause banners retain the whole battle board on small screens and at 150% text',async()=>{
      for(const [width,height] of [[320,568],[390,844],[844,390],[640,360],[1024,768]])for(const locale of ['zh-CN','en','ja']){
        await page.setViewportSize({width,height});await page.evaluate(l=>duelApp.setLanguage(l),locale);await geometry(page,width+'x'+height+' '+locale);
        if(locale==='en')await shot(page,'arena-end-'+width);
      }
      await page.click('.t-back-arena');assert.equal(await page.evaluate(()=>document.body.style.getPropertyValue('--t-viewer-height')),'');
    });
    assert.deepEqual(report.errors,[]);
  }catch(error){report.failure={message:error.message,stack:error.stack};console.error(error);await shot(page,'failure').catch(()=>{});process.exitCode=1;}
  finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
})();
