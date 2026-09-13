const {chromium}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/ai-marginal-browser'),report={checks:[],errors:[]};
async function check(name,fn){await fn();report.checks.push(name);console.log('OK',name);}
async function fixture(page,kind){return page.evaluate(kind=>{
  const e=new DuelEngine({deck:'blue',opponentDeck:'dark',first:0,seed:98451});e.state.turn=4;e.state.phase='battle';e.state.mode='spectate';
  for(const p of e.state.players){p.deck.push(...p.hand);p.hand=[];}
  const put=(owner,zone,name,props={})=>{
    const id=DuelData.CARDS[name]?name:DuelData.cardByName(name).id,c=e.makeCard(id,owner);
    Object.assign(c,{faceUp:true,setTurn:1,summonTurn:1,changedTurn:1},props);
    if(['monsters','spells'].includes(zone))e.state.players[owner][zone][e.state.players[owner][zone].indexOf(null)]=c;else e.state.players[owner][zone].push(c);
    e.state.originalCardCount=e.physicalCards().filter(c=>DuelData.CARDS[c.id].type!=='token').length;return c;
  };
  const name=kind==='buff'?'Reinforcements':kind==='skip'?'Time Seal':'waboku';
  const attacker=put(0,'monsters','blue-eyes'),defender=kind==='buff'?put(1,'monsters','battle-ox'):null;
  const cards=Array.from({length:3},()=>put(1,'spells',name,{faceUp:false}));
  const step=a=>{const r=e.act(a);if(!r.ok)throw new Error(r.error);};
  step({type:'attack',uid:attacker.uid,...(defender?{target:defender.uid}:{})});
  step({type:'respond',uid:cards[0].uid,key:cards[0].id+'::cast',...(defender?{choices:{target:[defender.uid]}}:{})});
  duelApp.restore(e.snapshot());if(!duelApp.spectate.paused)duelApp.spectateToggle();
  return{cardId:cards[0].id,uids:cards.map(c=>c.uid)};
},kind);}
async function clickStep(page){await page.evaluate(()=>duelApp.skipChain());await page.click('#turn-panel [data-action="spectate-step"]');await page.evaluate(()=>duelApp.skipChain());}
(async()=>{
  await fs.mkdir(out,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.DUEL_BROWSER||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',args:['--mute-audio']});
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.route(/https?:\/\//,r=>r.abort());
  await context.addInitScript(()=>{localStorage.setItem('duel-sanctuary-prefs-v1',JSON.stringify({sound:false,music:false,reducedMotion:true,speed:'fast'}));localStorage.setItem('duel-sanctuary-online-art-v2','false');});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  try{
    await page.goto(pathToFileURL(path.join(root,'index.html')).href);await page.waitForFunction(()=>window.duelApp&&window.DuelAIMarginal);
    await check('spectator step preserves two redundant protection cards',async()=>{
      const data=await fixture(page,'protect');await clickStep(page);
      assert.equal(await page.evaluate(()=>duelApp.engine.state.players[1].wabokuTurn),4);
      assert.equal(await page.evaluate(()=>duelApp.engine.state.players[1].spells.filter(c=>c?.id==='waboku'&&!c.faceUp).length),2);
      assert.equal(await page.evaluate(id=>duelApp.engine.state.chainHistory.filter(l=>l.cardId===id).length,data.cardId),1);
      await page.screenshot({path:path.join(out,'01-preserved-copies.png'),animations:'disabled'});
    });
    await check('additional attack buffs remain usable rather than imposing a card-name limit',async()=>{
      const data=await fixture(page,'buff');await clickStep(page);
      assert.equal(await page.evaluate(id=>duelApp.engine.state.chainHistory.filter(l=>l.cardId===id).length,data.cardId),2);
      await clickStep(page);
      assert.equal(await page.evaluate(id=>duelApp.engine.state.chainHistory.filter(l=>l.cardId===id).length,data.cardId),3);
      await page.screenshot({path:path.join(out,'02-useful-stacking.png'),animations:'disabled'});
    });
    await check('the same generic policy preserves duplicate phase-skipping traps',async()=>{
      const data=await fixture(page,'skip');await clickStep(page);
      assert.equal(await page.evaluate(()=>duelApp.engine.state.players[0].skipDraws),1);
      assert.equal(await page.evaluate(id=>duelApp.engine.state.players[1].spells.filter(c=>c?.id===id&&!c.faceUp).length,data.cardId),2);
    });
    await check('AI reasoning and actual choices survive saved-state restoration',async()=>{
      const data=await fixture(page,'protect');
      const result=await page.evaluate(data=>{
        const before=duelApp.engine.snapshot(),restored=DuelEngine.restore(before);
        const first=duelApp.engine.aiNext(),second=restored.aiNext();
        return {first,second,unchanged:JSON.stringify(before)===JSON.stringify(duelApp.engine.snapshot()),decision:DuelAIMarginal.evaluate(restored,{type:'respond',uid:data.uids[1],key:data.cardId+'::cast'},1)};
      },data);
      assert.deepEqual(result.first,{type:'pass'});assert.deepEqual(result.first,result.second);assert.equal(result.unchanged,true);assert.equal(result.decision.useful,false);
    });
    assert.deepEqual(report.errors,[]);
  }catch(error){report.failure=error.stack;console.error(error);await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});process.exitCode=1;}
  finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
})();
