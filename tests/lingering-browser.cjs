const {chromium}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/lingering-browser');
const report={checks:[],errors:[],geometry:[]};
async function check(name,run){await run();report.checks.push(name);console.log('OK',name);}
async function shot(page,name){await page.screenshot({path:path.join(out,name+'.png'),animations:'disabled'});}
async function stable(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function closeModal(page){if(await page.locator('#modal').evaluate(el=>el.open))await page.locator('#modal [data-action="close-modal"]').first().click();}
// Spectator duel with One Day of Peace in Robot A's hand, Effect Veiler in Robot B's hand
// and an effect monster on A's side. Robot A is the turn player.
async function fixture(page,mode='spectate'){
  return page.evaluate(mode=>{
    const e=new DuelEngine({deck:'blue',opponentDeck:'dark',seed:13906,first:0});e.state.turn=4;e.state.phase='main1';e.state.active=0;e.state.mode=mode;
    for(const p of e.state.players){p.deck.push(...p.hand);p.hand=[];}
    const put=(owner,zone,name,props={})=>{
      const id=DuelData.CARDS[name]?name:DuelData.cardByName(name).id,m=e.makeCard(id,owner);
      Object.assign(m,{faceUp:true,position:'attack',summonTurn:1,changedTurn:1,setTurn:1},props);
      const p=e.state.players[owner];if(['monsters','spells'].includes(zone))p[zone][p[zone].indexOf(null)]=m;else p[zone].push(m);
      e.state.originalCardCount=e.physicalCards().filter(m=>DuelData.CARDS[m.id].type!=='token').length;return m;
    };
    for(const owner of [0,1])for(let i=0;i<4;i++)put(owner,'deck','Battle Ox');
    const peace=put(0,'hand','One Day of Peace'),sangan=put(0,'monsters','Sangan'),veiler=put(1,'hand','Effect Veiler');put(1,'monsters','Battle Ox');
    duelApp.restore(e.snapshot());if(mode==='spectate'&&!duelApp.spectate.paused)duelApp.spectateToggle();
    return {peace:peace.uid,sangan:sangan.uid,veiler:veiler.uid,peaceId:peace.id,veilerId:veiler.id};
  },mode);
}
async function settle(page,focus=null){
  await page.evaluate(({focus})=>{
    const e=duelApp.engine;let guard=0;
    while(e.state.pending&&e.state.winner===null&&guard++<60){
      const p=e.state.pending;let a;
      if(p.kind==='window'){const option=p.options.find(o=>o.uid===focus);a=option?{type:'respond',uid:option.uid,key:option.key,choices:focus&&window.__veilerTarget?{target:[window.__veilerTarget]}:undefined}:{type:'pass'};}
      else a=e.chooseAI(p);
      const r=e.act(a);if(!r.ok)throw new Error(r.error);
    }
    duelApp.skipChain();duelApp.render();
  },{focus});
}
function chips(page,bar){return page.locator('#'+bar+' .status-effects .status-chip:not(.more)');}
async function geometry(page,label){
  await stable(page);
  const g=await page.evaluate(()=>{
    const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    return {viewport:[innerWidth,innerHeight],scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],bars:['#opponent-bar','#player-bar'].map(box),chips:[...document.querySelectorAll('.status-effects')].map(el=>{const r=el.getBoundingClientRect();return {x:r.x,right:r.right,y:r.y,bottom:r.bottom};})};
  });
  report.geometry.push({label,...g});
  assert.ok(g.scroll[0]<=g.viewport[0]+1,'no horizontal overflow: '+JSON.stringify(g.scroll));
  for(const [index,bar] of g.bars.entries()){assert.ok(bar.height>0&&bar.right<=g.viewport[0]+1,JSON.stringify(bar));for(const chip of g.chips.filter(c=>c.y>=bar.y-1&&c.bottom<=bar.bottom+1))assert.ok(chip.right<=bar.right+1&&chip.x>=bar.x-1,'chips stay inside bar '+index+': '+JSON.stringify({chip,bar}));}
  return g;
}

(async()=>{
  await fs.mkdir(out,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.DUEL_BROWSER||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',args:['--no-first-run','--disable-background-networking','--mute-audio']});
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.route(/https?:\/\//,r=>r.abort());
  await context.addInitScript(()=>{
    localStorage.setItem('duel-sanctuary-welcomed-v3','true');
    localStorage.setItem('duel-sanctuary-prefs-v1',JSON.stringify({sound:false,music:false,reducedMotion:true,speed:'fast'}));
    localStorage.setItem('duel-sanctuary-online-art-v2','false');
  });
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.setDefaultTimeout(15000);
  try{
    await page.goto(pathToFileURL(path.join(root,'index.html')).href);await page.waitForFunction(()=>window.duelApp&&document.documentElement.dataset.ready==='true');
    let ids;
    await check('a fresh spectator duel shows no chips and an idle tool button',async()=>{
      ids=await fixture(page);await stable(page);
      assert.equal(await chips(page,'player-bar').count(),0);assert.equal(await chips(page,'opponent-bar').count(),0);
      assert.equal(await page.locator('#lingering-tool.active').count(),0);
      const before=await geometry(page,'before');report.barHeightBefore=before.bars.map(b=>b.height);
    });
    await check('One Day of Peace puts a chip on both robots\u2019 bars with the source card and duration',async()=>{
      await page.evaluate(({peace,peaceId})=>{const r=duelApp.engine.act({type:'activate',uid:peace,key:peaceId+'::cast'});if(!r.ok)throw new Error(r.error);},ids);
      await settle(page);await stable(page);
      assert.equal(await chips(page,'player-bar').count(),1);assert.equal(await chips(page,'opponent-bar').count(),1);
      for(const bar of ['player-bar','opponent-bar']){
        const text=await chips(page,bar).first().innerText();
        assert.ok(text.includes('不会受到任何伤害'),bar+': '+text);assert.ok(text.includes('一时休战'),bar+': '+text);assert.ok(text.includes('至第 5 回合'),bar+': '+text);
      }
      assert.equal(await page.locator('#lingering-tool.active').count(),1);assert.equal((await page.locator('#lingering-tool').innerText()).replace(/\s/g,''),'◎2');
      const after=await geometry(page,'peace');
      assert.deepEqual(after.bars.map(b=>b.height),report.barHeightBefore,'the one-screen bars keep their height');
      await shot(page,'01-peace-chips');
    });
    await check('Effect Veiler marks the negated monster and adds a card-scoped chip on its owner\u2019s bar',async()=>{
      await page.evaluate(({veiler,veilerId,sangan})=>{
        const e=duelApp.engine;window.__veilerTarget=sangan;
        e.state.frame={kind:'main-open',owner:0,windowOffered:false};e.pump();
        const p=e.state.pending;if(p?.kind!=='window'||!p.options.some(o=>o.uid===veiler))throw new Error('no Effect Veiler window: '+JSON.stringify(p&&{kind:p.kind,options:p.options}));
        const r=e.act({type:'respond',uid:veiler,key:veilerId+'::era-negate',choices:{target:[sangan]}});if(!r.ok)throw new Error(r.error);
      },ids);
      await settle(page);await stable(page);
      assert.equal(await page.locator('#player-monsters .negated-badge').count(),1,'the negated monster carries a badge');
      assert.equal(await chips(page,'player-bar').count(),2);
      const texts=await chips(page,'player-bar').allInnerTexts();
      assert.ok(texts.some(t=>t.includes('三眼怪')&&t.includes('效果无效')&&t.includes('效果遮蒙者')),JSON.stringify(texts));
      assert.equal(await chips(page,'opponent-bar').count(),1,'the card effect belongs to the negated monster\u2019s controller only');
      assert.equal((await page.locator('#lingering-tool').innerText()).replace(/\s/g,''),'◎3');
      await shot(page,'02-veiler-negated');
    });
    await check('the chip opens a modal that lists both sides and links back to the source card',async()=>{
      await chips(page,'player-bar').first().click();
      await page.waitForFunction(()=>duelApp.modalKind==='lingering');
      assert.equal(await page.locator('#modal .lingering-group').count(),2);
      assert.equal(await page.locator('#modal .lingering-item').count(),3);
      const groups=await page.locator('#modal .lingering-group h3').allInnerTexts();
      assert.ok(groups[0].includes('机器人 B')&&groups[1].includes('机器人 A'),JSON.stringify(groups));
      const body=await page.locator('#modal .modal-body').innerText();
      assert.ok(body.includes('一时休战')&&body.includes('效果遮蒙者')&&body.includes('「三眼怪」'),body.slice(0,300));
      await shot(page,'03-modal');
      await page.locator('#modal .lingering-card').first().click();await page.waitForFunction(()=>duelApp.modalKind==='detail');
      await page.click('#modal [data-action="detail-back"]');await page.waitForFunction(()=>duelApp.modalKind==='lingering');
      await closeModal(page);
    });
    await check('the arena tool button opens the same modal and the modal translates',async()=>{
      await page.click('#lingering-tool');await page.waitForFunction(()=>duelApp.modalKind==='lingering');
      await page.evaluate(()=>duelApp.setLanguage('en'));await stable(page);
      const body=await page.locator('#modal .modal-body').innerText();
      assert.ok(body.includes('Takes no damage')&&body.includes('Effects negated')&&body.includes('until turn 5'),body.slice(0,400));
      assert.ok(body.includes('One Day of Peace'),'card names follow the language');
      await closeModal(page);await stable(page);
      const chipText=await chips(page,'player-bar').allInnerTexts();assert.ok(chipText.some(t=>t.includes('Takes no damage')&&t.includes('until turn 5')),JSON.stringify(chipText));
      assert.equal(await page.locator('#player-monsters .negated-badge').innerText(),'Negated');
      await page.evaluate(()=>duelApp.setLanguage('ja'));await stable(page);
      const ja=await chips(page,'opponent-bar').allInnerTexts();assert.ok(ja.some(t=>t.includes('ダメージを受けない')&&t.includes('5ターン目まで')),JSON.stringify(ja));
      assert.deepEqual(await page.evaluate(()=>duelApp.language),'ja');
      const missing=await page.evaluate(()=>DuelI18n.missingUI.filter(t=>/^(不会受到任何伤害|效果无效|生效中的效果|双方|里侧卡牌|无效|本回合|持续中|至第 d+ 回合)$/.test(t)));assert.deepEqual(missing,[],'localized chips are not reported as untranslated');
      await page.evaluate(()=>duelApp.setLanguage('zh-CN'));await stable(page);
      await shot(page,'04-back-to-chinese');
    });
    await check('chips disappear once the effect has lapsed and a saved game restores them',async()=>{
      const saved=await page.evaluate(()=>duelApp.engine.snapshot());
      await page.evaluate(()=>{duelApp.engine.state.turn+=2;duelApp.render();});await stable(page);
      assert.equal(await chips(page,'player-bar').count(),0);assert.equal(await chips(page,'opponent-bar').count(),0);assert.equal(await page.locator('#lingering-tool.active').count(),0);
      await page.evaluate(saved=>{duelApp.restore(saved);if(!duelApp.spectate.paused)duelApp.spectateToggle();},saved);await stable(page);
      assert.equal(await chips(page,'player-bar').count(),2);assert.equal(await chips(page,'opponent-bar').count(),1);
    });
    await check('phone and landscape layouts keep the chips inside the bars without overflow',async()=>{
      for(const [width,height] of [[390,844],[844,390],[1024,768]]){
        await page.setViewportSize({width,height});await page.evaluate(()=>duelApp.render());await stable(page);
        const g=await geometry(page,width+'x'+height);
        assert.ok(g.chips.length>=1,'chips rendered at '+width+'x'+height);
        await shot(page,'05-'+width+'x'+height);
      }
      await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>duelApp.render());
    });
    await check('a normal duel shows the same information on the human player\u2019s own bar',async()=>{
      ids=await fixture(page,'duel');
      await page.evaluate(({peace,peaceId})=>{const r=duelApp.engine.act({type:'activate',uid:peace,key:peaceId+'::cast'});if(!r.ok)throw new Error(r.error);},ids);
      await settle(page);await stable(page);
      assert.equal(await chips(page,'player-bar').count(),1);assert.equal(await chips(page,'opponent-bar').count(),1);
      await page.click('#lingering-tool');await page.waitForFunction(()=>duelApp.modalKind==='lingering');
      const groups=await page.locator('#modal .lingering-group h3').allInnerTexts();assert.ok(groups[1].includes('你'),JSON.stringify(groups));
      await closeModal(page);
    });
    assert.deepEqual(report.errors,[],'no page errors');
    report.ok=true;
  }catch(error){report.ok=false;report.failure=error.stack||String(error);console.error(error);process.exitCode=1;try{await shot(page,'failure');}catch{}}
  finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
  console.log(report.ok?'lingering browser checks passed: '+report.checks.length:'lingering browser checks failed');
})();
