const {chromium}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/experience-response-browser');
const report={checks:[],audio:[],errors:[]};
async function check(name,fn){await fn();report.checks.push(name);console.log('OK',name);}
async function shot(page,name){await page.screenshot({path:path.join(out,name+'.png'),animations:'disabled'});}
async function stage(page,scenario){
  return page.evaluate(scenario=>{
    const e=new DuelEngine({deck:'blue',opponentDeck:'dark',first:0,seed:71});e.state.turn=4;
    for(const p of e.state.players){p.deck.push(...p.hand);p.hand=[];}
    const refs={};
    function put(owner,zone,name,props={}){
      const id=DuelData.CARDS[name]?name:DuelData.cardByName(name).id;
      const f=e.refs(owner,['deck','extra']).find(f=>f.card.id===id),c=f?e.remove(f.card.uid).card:e.makeCard(id,owner);
      Object.assign(c,{faceUp:true,setTurn:1,summonTurn:1,changedTurn:1},props);
      if(['monsters','spells'].includes(zone))e.state.players[owner][zone][e.state.players[owner][zone].indexOf(null)]=c;else e.state.players[owner][zone].push(c);
      e.state.originalCardCount=e.physicalCards().filter(c=>DuelData.CARDS[c.id].type!=='token').length;refs[name]=c.uid;return c;
    }
    function act(action){const r=e.act(action);if(!r.ok)throw Error(r.error);}
    if(scenario==='attack'){
      e.state.active=1;e.state.phase='battle';put(0,'spells','mirror-force',{faceUp:false});put(0,'spells','magic-cylinder',{faceUp:false});const dragon=put(1,'monsters','blue-eyes');act({type:'attack',uid:dragon.uid,target:null});
    }
    if(scenario==='quiet'){
      e.state.active=1;put(0,'spells','Raigeki Break',{faceUp:false});put(0,'hand','battle-ox');put(1,'monsters','blue-eyes');const cover=put(1,'hand','mirror-force');
      const set=e.actionsFor(cover.uid,1).find(a=>a.type.includes('set'));if(!set)throw Error('Missing set action');act(set);
    }
    if(scenario==='three-link'){
      const pot=put(0,'hand','pot-of-greed'),jammer=put(1,'spells','Magic Jammer',{faceUp:false}),cost=put(1,'hand','battle-ox');put(0,'spells','Seven Tools of the Bandit',{faceUp:false});
      act({type:'activate',uid:pot.uid,key:pot.id+'::cast'});act({type:'respond',uid:jammer.uid,key:jammer.id+'::cast',choices:{cost:[cost.uid]}});
    }
    if(scenario==='target-loss'){
      const reborn=put(0,'hand','monster-reborn'),dragon=put(0,'grave','blue-eyes'),disappear=put(1,'spells','Disappear',{faceUp:false});
      act({type:'activate',uid:reborn.uid,key:reborn.id+'::cast',choices:{target:[dragon.uid]}});act({type:'respond',uid:disappear.uid,key:disappear.id+'::cast',choices:{target:[dragon.uid]}});
      let guard=0;while(e.state.pending&&guard++<30)act(e.state.pending.kind==='window'?{type:'pass'}:e.chooseAI(e.state.pending));
    }
    duelApp.restore(e.snapshot());return refs;
  },scenario);
}
(async()=>{
  await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.DUEL_BROWSER||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',args:['--no-first-run','--disable-background-networking','--mute-audio']});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    await context.addInitScript(()=>{localStorage.setItem('duel-sanctuary-prefs-v1',JSON.stringify({sound:false,music:true,speed:'fast',reducedMotion:false,responseMode:'auto'}));localStorage.setItem('duel-sanctuary-online-art-v2','false');});
    await context.route(/https?:\/\//,r=>r.abort());
    const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.stack));
    await page.goto(pathToFileURL(path.join(root,'index.html')).href,{waitUntil:'load'});await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
    await check('viewing the field preserves the response and selected card, including across inspection and Escape',async()=>{
      const refs=await stage(page,'attack');await page.waitForSelector('.response-option');
      assert.ok((await page.locator('.response-context').textContent()).includes('直接攻击'));
      const index=await page.evaluate(uid=>duelApp.engine.state.pending.options.findIndex(o=>o.uid===uid),refs['magic-cylinder']);
      await page.click('[data-action=pending-response][data-index="'+index+'"]');
      const before=await page.evaluate(()=>JSON.stringify(duelApp.engine.snapshot()));await page.click('[data-action=pending-peek]');await page.waitForTimeout(500);
      assert.equal(await page.evaluate(()=>JSON.stringify(duelApp.engine.snapshot())),before);assert.equal(await page.locator('#response-peek-bar').isVisible(),true);
      await page.click('#duel-board [data-card-uid="'+refs['blue-eyes']+'"]');await page.click('#card-popover [data-action=card-detail]');await page.click('#modal [data-action=close-modal]');
      assert.equal(await page.evaluate(()=>JSON.stringify(duelApp.engine.snapshot())),before);await shot(page,'01-inspect-field');
      await page.click('[data-action=pending-resume]');assert.equal(await page.locator('.response-option.chosen').getAttribute('data-index'),String(index));
      await page.keyboard.press('Escape');await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>JSON.stringify(duelApp.engine.snapshot())),before);
      await page.click('[data-action=pending-resume]');await shot(page,'02-response-context');await page.click('#pending-confirm');await page.waitForFunction(()=>duelApp.engine.state.players[1].lp<=5000);
    });
    await check('AUTO suppresses a generic trap prompt on a set, while ON exposes that exact window',async()=>{
      await stage(page,'quiet');await page.waitForTimeout(160);assert.equal(await page.locator('#modal').evaluate(el=>el.open),false);assert.equal(await page.evaluate(()=>duelApp.engine.state.pending?.responder===0),false);
      await page.evaluate(()=>duelApp.showHome());await page.evaluate(()=>duelApp.enterDuel());await page.locator('#response-mode-switch [data-value=on]').click();
      await stage(page,'quiet');await page.waitForSelector('.response-option');assert.ok((await page.locator('.response-option').textContent()).includes('雷破'));
      await page.click('[data-action=pending-peek]');await page.evaluate(()=>duelApp.showHome());
    });
    await check('a real three-link exchange animates both players and labels Chain 2 negated by Chain 3',async()=>{
      const refs=await stage(page,'three-link');await page.waitForSelector('.response-option');
      const index=await page.evaluate(uid=>duelApp.engine.state.pending.options.findIndex(o=>o.uid===uid),refs['Seven Tools of the Bandit']);assert.ok(index>=0);
      await page.click('[data-action=pending-response][data-index="'+index+'"]');await page.click('#pending-confirm');
      await page.waitForSelector('#chain-theater:not([hidden])');assert.deepEqual(await page.locator('#chain-theater .chain-number').allTextContents(),['1','2','3']);assert.equal(await page.locator('#chain-theater .owner-1').count(),1);await shot(page,'03-chain-formation');
      await page.waitForSelector('#chain-theater .status-negated');await shot(page,'04-chain-negated');await page.evaluate(()=>duelApp.skipChain());
      const history=await page.evaluate(()=>duelApp.engine.state.chainHistory);assert.equal(history.find(l=>l.number===2).byNumber,3);assert.equal(history.find(l=>l.number===1).status,'resolved');
      await page.evaluate(()=>duelApp.showChainLog());assert.ok((await page.locator('.chain-history-modal').textContent()).includes('被连锁 3 无效'));await shot(page,'05-chain-history');await page.click('#modal [data-action=close-modal]');
    });
    await check('target-loss replay shows the exact higher link without claiming the spell was negated',async()=>{
      await stage(page,'target-loss');await page.evaluate(()=>duelApp.showChainLog());assert.ok((await page.locator('.chain-history-link.status-target-lost').textContent()).includes('连锁 2'));
      await page.click('[data-action=replay-chain]');await page.waitForSelector('#chain-theater .status-target-lost');await shot(page,'06-chain-target-lost');assert.ok((await page.locator('.chain-theater-detail').textContent()).includes('相关部分无法处理'));await page.evaluate(()=>duelApp.skipChain());
    });
    await check('all ten real soundtrack files decode in the browser',async()=>{
      report.audio=await page.evaluate(async()=>{
        const results=[];for(const track of DUEL_MUSIC){
          const duration=await new Promise((resolve,reject)=>{const a=new Audio(),timer=setTimeout(()=>reject(Error(track.title+' metadata timeout')),7000);a.preload='metadata';a.onloadedmetadata=()=>{clearTimeout(timer);const d=a.duration;a.removeAttribute('src');a.load();resolve(d);};a.onerror=()=>{clearTimeout(timer);reject(Error(track.title+' cannot decode'));};a.src=track.src;});
          results.push({id:track.id,title:track.title,seconds:duration});
        }return results;
      });assert.equal(report.audio.length,10);assert.ok(report.audio.every(a=>a.seconds>45&&a.seconds<600));
    });
    await check('scene music really plays, switches, resumes and shuffles without consecutive duplicates',async()=>{
      await page.evaluate(()=>duelApp.showHome());await page.click('.header-tools [data-action=sound]');await page.waitForFunction(()=>duelApp.music.state==='playing');assert.equal(await page.evaluate(()=>duelApp.music.title),'心理戦(D1)');
      await page.evaluate(()=>duelApp.showLibrary());await page.waitForFunction(()=>duelApp.music.state==='playing'&&duelApp.music.scene==='library');assert.equal(await page.evaluate(()=>duelApp.music.title),'城之内克也');await page.click('#modal [data-action=close-modal]');
      await page.evaluate(()=>duelApp.showWorkshop());await page.waitForFunction(()=>duelApp.music.state==='playing'&&duelApp.music.scene==='workshop');assert.equal(await page.evaluate(()=>duelApp.music.title),'遊星バトル');await page.click('#modal [data-action=close-modal]');
      await page.click('[data-action=help]');await page.waitForFunction(()=>duelApp.music.state==='playing'&&duelApp.music.scene==='help');assert.equal(await page.evaluate(()=>duelApp.music.title),'友情の絆');await page.click('#modal [data-action=close-modal]');
      await page.evaluate(()=>duelApp.enterDuel());await page.waitForFunction(()=>duelApp.music.state==='playing'&&duelApp.music.scene==='battle');
      const ids=[await page.evaluate(()=>duelApp.music.id)];for(let i=0;i<11;i++){await page.click('[data-action=music-next]');ids.push(await page.evaluate(()=>duelApp.music.id));}for(let i=1;i<ids.length;i++)assert.notEqual(ids[i],ids[i-1]);assert.equal(new Set(ids.slice(0,6)).size,6);assert.equal(new Set(ids.slice(6,12)).size,6);
    });
    await check('background music and duel sound effects can be muted independently',async()=>{
      if(await page.evaluate(()=>duelApp.preferences.sound))await page.click('.header-tools [data-action=sound]');
      await page.waitForFunction(()=>duelApp.music.state==='playing');
      assert.equal(await page.evaluate(()=>duelApp.preferences.sound),false);
      await page.click('#music-toggle');await page.waitForFunction(()=>duelApp.music.state==='paused');
      assert.equal(await page.evaluate(()=>duelApp.preferences.music),false);
      await page.click('#music-toggle');await page.waitForFunction(()=>duelApp.music.state==='playing');
      assert.equal(await page.evaluate(()=>duelApp.preferences.sound),false);
    });
    assert.deepEqual(report.errors,[]);report.ok=true;
  }finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
