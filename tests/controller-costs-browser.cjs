const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/controller-costs-browser');
const report={ok:false,checks:[],errors:[]};
let browser;

(async()=>{
  await fs.mkdir(out,{recursive:true});
  let executablePath=process.env.DUEL_BROWSER;
  if(!executablePath){const edge='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';try{await fs.access(edge);executablePath=edge;}catch{}}
  browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{}),args:['--disable-background-networking','--mute-audio']});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route(/https?:\/\//,route=>route.abort());
  await context.addInitScript(()=>{
    localStorage.setItem('duel-sanctuary-welcomed-v3','true');
    localStorage.setItem('duel-sanctuary-online-art-v2','false');
    localStorage.setItem('duel-sanctuary-prefs-v1',JSON.stringify({sound:false,music:false,reducedMotion:true,responseMode:'off',speed:'fast'}));
  });
  const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  await page.waitForFunction(()=>window.duelApp&&document.documentElement.dataset.ready==='true');
  const actual=await page.evaluate(()=>{
    function fresh(active=0){const e=new DuelEngine({deck:'blue',opponentDeck:'dark',first:active,seed:91403});e.state.turn=6;e.state.phase='main1';for(const p of e.state.players){p.deck.push(...p.hand);p.hand=[];}return e;}
    function put(e,owner,zone,name){const m=e.makeCard(DuelData.cardByName(name)?.id||name,owner);Object.assign(m,{faceUp:true,position:'attack',summonTurn:0,setTurn:0,changedTurn:0});const p=e.state.players[owner];if(['monsters','spells'].includes(zone))p[zone][p[zone].indexOf(null)]=m;else p[zone].push(m);e.state.originalCardCount=e.physicalCards().filter(m=>DuelData.CARDS[m.id].type!=='token').length;return m;}
    function run(e,action){let r=e.act(action);if(!r.ok)throw Error(r.error);let n=0;while(e.state.pending&&e.state.winner===null){if(n++>180)throw Error('Resolution did not terminate');const p=e.state.pending;r=e.act(p.kind==='window'?{type:'pass'}:p.kind==='trigger'?{type:'respond',uid:p.trigger.uid,key:p.trigger.key}:e.chooseAI(p));if(!r.ok)throw Error(r.error);}e.assertState();}
    function cast(e,m,choices={}){run(e,{type:'activate',uid:m.uid,key:m.id+'::cast',choices});}
    const life=e=>e.state.players.map(p=>p.lp),result={};

    let lava=fresh(1);const golem=put(lava,1,'hand','Lava Golem'),victims=[put(lava,0,'monsters','Battle Ox'),put(lava,0,'monsters','Battle Ox')];
    run(lava,{type:'activate',uid:golem.uid,key:golem.id+'::special',choices:{target:victims.map(m=>m.uid)}});
    lava.find(golem.uid).card.golemOwner=1;
    lava=DuelEngine.restore(JSON.parse(JSON.stringify(lava.snapshot())));run(lava,{type:'end'});
    result.lava={lp:life(lava),controller:lava.find(golem.uid).owner,originalOwner:lava.find(golem.uid).card.originalOwner};

    const fee=fresh(1);put(fee,0,'spells','Chain Energy');fee.state.players[0].lp=400;
    const queen=put(fee,1,'hand','Volcanic Queen'),victim=put(fee,0,'monsters','Battle Ox');
    run(fee,{type:'activate',uid:queen.uid,key:queen.id+'::gift',choices:{cost:[victim.uid]}});result.fee=life(fee);

    const tokens=fresh();put(tokens,1,'spells','Chain Energy');cast(tokens,put(tokens,0,'hand','Scapegoat'));
    result.tokens={lp:life(tokens),count:tokens.monsters(0).length};

    const bill=fresh(1),host=put(bill,1,'monsters','Blue-Eyes White Dragon'),equip=put(bill,1,'hand','Cursed Bill');
    bill.takeControl(host.uid,0);cast(bill,equip,{target:[host.uid]});cast(bill,put(bill,1,'hand','Raigeki'));
    result.bill={lp:life(bill),graveOwner:bill.find(host.uid).owner};

    duelApp.restore(lava.snapshot());return result;
  });
  assert.deepEqual(actual,{
    lava:{lp:[7000,8000],controller:0,originalOwner:1},
    fee:[400,7500],tokens:{lp:[7500,8000],count:4},bill:{lp:[5500,8000],graveOwner:1}
  });
  report.checks.push('Production HTML: Lava Golem old save, receiving controller, hand summoner fee, Token exemption and Cursed Bill');
  assert.equal(await page.locator('#lp-0 .lp-heading b').textContent(),'7,000');
  assert.equal(await page.locator('#lp-1 .lp-heading b').textContent(),'8,000');
  await page.screenshot({path:path.join(out,'01-controller-damage.png'),animations:'disabled'});

  await page.reload();await page.waitForFunction(()=>window.duelApp&&document.documentElement.dataset.ready==='true');
  await page.click('#home-continue');
  assert.deepEqual(await page.evaluate(()=>duelApp.engine.state.players.map(p=>p.lp)),[7000,8000]);
  const next=await page.evaluate(()=>{
    const e=duelApp.engine,history=[];
    for(let turn=0;turn<2;turn++){
      const started=e.act({type:'end'});if(!started.ok)throw Error(started.error);
      let n=0;while(e.state.pending&&e.state.winner===null){if(n++>180)throw Error('Resolution did not terminate');const p=e.state.pending,r=e.act(p.kind==='window'?{type:'pass'}:p.kind==='trigger'?{type:'respond',uid:p.trigger.uid,key:p.trigger.key}:e.chooseAI(p));if(!r.ok)throw Error(r.error);}
      history.push(e.state.players.map(p=>p.lp));
    }
    e.assertState();duelApp.restore(e.snapshot());return history;
  });
  assert.deepEqual(next,[[7000,8000],[6000,8000]]);
  assert.equal(await page.locator('#lp-0 .lp-heading b').textContent(),'6,000');
  assert.equal(await page.locator('#lp-1 .lp-heading b').textContent(),'8,000');
  await page.screenshot({path:path.join(out,'02-restored-next-standby.png'),animations:'disabled'});
  report.checks.push('Visible LP and browser reload: mandatory damage occurs once per controller Standby Phase with optional responses off');
  assert.deepEqual(report.errors,[]);report.ok=true;
})().catch(error=>{report.errors.push(error.stack);process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();await fs.mkdir(out,{recursive:true});
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
});
