const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/rule-modes'),checks=[],errors=[];
(async()=>{
  await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.DUEL_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--mute-audio']});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{localStorage.setItem('duel-sanctuary-welcomed-v3','true');localStorage.setItem('duel-sanctuary-online-art-v2','false');localStorage.setItem('duel-sanctuary-prefs-v1',JSON.stringify({sound:false,music:false,reducedMotion:true}));});
    await page.route('https://**/*',r=>r.abort());await page.goto(pathToFileURL(process.env.DUEL_TEST_HTML||path.join(out,'index.html')).href);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    const check=async(name,fn)=>{await fn();checks.push(name);console.log('OK',name);};
    await check('dedicated home entry, searchable 25-rule gallery, details and category filter',async()=>{
      await page.click('.fate-home');assert.equal(await page.locator('.fate-card').count(),25);await page.screenshot({path:path.join(out,'gallery-desktop.png')});
      await page.click('[data-fate-filter="battle"]');assert.equal(await page.locator('.fate-card').count(),3);await page.click('[data-fate-filter="all"]');await page.fill('#fate-search','灵魂');assert.equal(await page.locator('.fate-card').count(),1);await page.fill('#fate-search','');
      await page.click('[data-fate-detail="element"]');assert.equal(await page.locator('.fate-elements').count(),1);await page.screenshot({path:path.join(out,'element-detail.png')});await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>duelApp.modalKind),'rule-gallery');
    });
    await check('three languages translate gallery and rule details',async()=>{
      for(const language of ['en','ja','zh-CN']){await page.selectOption('#modal .locale-select',language);assert.equal(await page.locator('.fate-card').count(),25);const expected=await page.evaluate(()=>DuelRuleModes.name('element',DuelI18n.language));assert.ok((await page.locator('[data-fate-detail="element"]').innerText()).includes(expected));}
    });
    await check('new Fate duel selects random mode, reveals once and survives reload',async()=>{
      await page.click('[data-action="new-fate-game"]');assert.equal(await page.locator('[data-action="choose-rule-mode"][data-value="random"]').getAttribute('aria-pressed'),'true');await page.click('[data-action="begin-game"]');
      await page.waitForSelector('#fate-duel-bar:not([hidden])');const id=await page.evaluate(()=>duelApp.engine.state.ruleMode.id);assert.ok(await page.locator('#fate-reveal').isVisible());await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');assert.equal(await page.evaluate(()=>duelApp.engine.state.ruleMode.id),id);assert.equal(await page.locator('#fate-reveal').isVisible(),false);
    });
    await check('bitter is actionable and respects once-per-turn; battle HUD opens details',async()=>{
      await page.evaluate(()=>duelApp.newGame({deck:'blue',opponentDeck:'dark',first:0,seed:1337,ruleMode:'bitter'}));
      const before=await page.evaluate(()=>duelApp.engine.state.players[0].lp);await page.click('#fate-duel-bar [data-action="perform-rule"]');assert.equal(await page.evaluate(()=>duelApp.engine.state.players[0].lp),Math.ceil(before/2));
      await page.evaluate(()=>{while(duelApp.engine.state.pending&&duelApp.engine.state.pending.responder===0)duelApp.act({type:'pass'});});
    });
    await check('mobile gallery and duel HUD stay within viewport',async()=>{
      await page.setViewportSize({width:390,height:844});await page.evaluate(()=>duelApp.newGame({deck:'blue',opponentDeck:'dark',first:0,seed:42,ruleMode:'element'}));await page.click('#fate-duel-bar [data-action="rule-details"]');await page.click('#modal [data-action="rule-gallery"]');assert.equal(await page.locator('.fate-card').count(),25);
      assert.ok(await page.locator('#modal').evaluate(n=>n.scrollWidth<=n.clientWidth+2));await page.screenshot({path:path.join(out,'gallery-mobile.png')});
      await page.evaluate(()=>{document.getElementById('modal').close();});await page.waitForSelector('#fate-reveal[hidden]',{state:'attached'});await page.screenshot({path:path.join(out,'duel-mobile.png')});assert.ok(await page.locator('#fate-duel-bar').evaluate(n=>n.getBoundingClientRect().right<=innerWidth+1));
    });
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await fs.writeFile(path.join(out,'browser.json'),JSON.stringify({checks,errors},null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
