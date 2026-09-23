const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/optimization-2'),checks=[],errors=[];
(async()=>{
  await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.DUEL_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--mute-audio']});
  const check=async(name,fn)=>{await fn();checks.push(name);console.log('OK',name);};
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{localStorage.setItem('duel-sanctuary-welcomed-v3','true');localStorage.setItem('duel-sanctuary-online-art-v2','false');localStorage.setItem('duel-sanctuary-prefs-v1',JSON.stringify({sound:false,music:false,reducedMotion:true}));});
    await page.route('https://**/*',route=>route.abort());await page.goto(pathToFileURL(path.join(root,'index.html')).href);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    await check('library detail closes one level and preserves search, scroll and language',async()=>{
      await page.click('#home-screen [data-action="library"]');await page.fill('#library-search','dragon');
      await page.locator('#modal .modal-body').evaluate(el=>{el.scrollTop=180;});const before=await page.locator('#modal .modal-body').evaluate(el=>el.scrollTop);
      await page.locator('.library-card[data-action="card-detail"]').first().evaluate(el=>el.click());assert.equal(await page.evaluate(()=>duelApp.modalKind),'detail');
      await page.click('#modal .modal-close');assert.equal(await page.evaluate(()=>duelApp.modalKind),'library');assert.equal(await page.locator('#library-search').inputValue(),'dragon');
      await page.waitForFunction(top=>document.querySelector('#modal .modal-body').scrollTop===top,before);
      await page.locator('.library-card[data-action="card-detail"]').first().evaluate(el=>el.click());await page.selectOption('#modal .locale-select','en');await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(()=>duelApp.modalKind),'library');assert.equal(await page.locator('#library-search').inputValue(),'dragon');await page.selectOption('#modal .locale-select','zh-CN');
      await page.mouse.click(2,2);assert.equal(await page.locator('#modal').evaluate(el=>el.open),true);
      await page.click('#modal .modal-close');assert.equal(await page.locator('#modal').evaluate(el=>el.open),false);
    });
    await check('workshop → AI import → assistant returns one level at a time without losing input',async()=>{
      await page.evaluate(()=>duelApp.showWorkshop());await page.fill('#ws-name','保留我的草稿');await page.click('[data-action="ws-ai-import"]');await page.fill('#ai-source-text','保留这段输入');await page.click('[data-ai-action="settings"]');
      assert.equal(await page.evaluate(()=>duelApp.modalDepth),2);await page.click('#modal .modal-close');assert.equal(await page.locator('#ai-source-text').inputValue(),'保留这段输入');
      await page.keyboard.press('Escape');assert.equal(await page.locator('#ws-name').inputValue(),'保留我的草稿');assert.equal(await page.evaluate(()=>duelApp.modalDepth),0);
      await page.click('#modal .modal-close');assert.equal(await page.locator('#modal').evaluate(el=>el.open),false);
    });
    await check('the exact reported bilingual Frog list imports offline, saves and survives reopening',async()=>{
      await page.evaluate(()=>duelApp.showWorkshop());await page.click('[data-action="ws-ai-import"]');await page.fill('#ai-source-text',await fs.readFile(path.join(__dirname,'fixtures/frog-bilingual.txt'),'utf8'));await page.click('[data-ai-action="run"]');
      await page.waitForSelector('.ai-card-grid');assert.equal(await page.locator('[data-status="unknown"],[data-status="ambiguous"]').count(),0);assert.equal(await page.locator('.ai-validation.valid').count(),1);
      await page.screenshot({path:path.join(out,'frog-import.png')});await page.click('[data-ai-action="load"]');let draft=await page.evaluate(()=>duelApp.workshopDraft);assert.equal(draft.cards.length,40);assert.equal(draft.extra.length,15);
      await page.click('[data-action="ws-save"]');assert.equal(await page.evaluate(()=>DuelDecks.analyze(duelApp.workshopDraft).valid),true);
    });
    await check('new duels reset music, avoid consecutive tracks and clear old modal history',async()=>{
      const tracks=[];
      for(let i=0;i<6;i++){await page.evaluate(seed=>duelApp.newGame({deck:'blue',opponentDeck:'dark',first:0,seed}),100+i);const music=await page.evaluate(()=>duelApp.music);assert.equal(music.position,0);assert.equal(music.scene,'battle');if(tracks.length)assert.notEqual(music.id,tracks.at(-1));tracks.push(music.id);}
      assert.equal(await page.evaluate(()=>duelApp.modalDepth),0);
    });
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify({checks,errors},null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
