/* Integration tests run without network. Artwork fixtures test the resource layer separately. */
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright')));}
const root=path.resolve(__dirname,'..');
const out=path.join(root,'output/v3-browser','run-'+new Date().toISOString().replace(/[:.]/g,'-'));
const report={ok:false,checks:[],errors:[],screenshots:[],networkMode:'offline logic and mocked art only'};
let browser;
async function check(name,fn){await fn();report.checks.push(name);console.log('OK',name);}
(async()=>{
  await fs.mkdir(out,{recursive:true});
  report.buildSha256=createHash('sha256').update(await fs.readFile(path.join(root,'index.html'))).digest('hex');
  browser=await chromium.launch({headless:true,executablePath:process.env.DUEL_BROWSER||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',args:['--no-first-run','--disable-background-networking']});
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  await context.route('https://**/*',route=>route.abort());
  await context.addInitScript(()=>{
    localStorage.setItem('duel-sanctuary-welcomed-v3','true');localStorage.setItem('duel-sanctuary-online-art-v2','false');
    localStorage.setItem('duel-sanctuary-prefs-v1',JSON.stringify({sound:false,reducedMotion:true,speed:'fast'}));
  });
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.stack));
  async function screenshot(name){const target=path.join(out,name+'.png');await page.screenshot({path:target,fullPage:true});report.screenshots.push(target);}
  await check('single HTML opens offline with all expansion modules',async()=>{
    await page.goto(pathToFileURL(path.join(root,'index.html')).href);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true',{timeout:12000});
    const info=await page.evaluate(()=>({version:duelApp.engine.state.version,cards:DuelData.CARD_LIST.filter(c=>!c.notCollectible).length,decks:DuelDecks.list().length,overflow:document.documentElement.scrollWidth>innerWidth}));
    assert.deepEqual(info,{version:3,cards:204,decks:11,overflow:false});await screenshot('01-desktop-field');assert.deepEqual(report.errors,[]);
  });
  await check('eleven presets are selectable with an independently selected opponent',async()=>{
    await page.click('[data-action="new-game"]');assert.equal(await page.locator('.deck-roster-item').count(),11);
    await page.click('[data-action="choose-deck"][data-deck="crystron"]');await page.selectOption('#opponent-deck','cyber');await screenshot('02-eleven-deck-selector');
    await page.click('[data-action="begin-game"]');assert.deepEqual(await page.evaluate(()=>duelApp.engine.state.players.map(p=>p.deckId)),['crystron','cyber']);
    for(const deck of ['blue','dark','hero','blackwing','junk','utopia','qliphort','exodia','cyber','crystron','tearlaments']){
      await page.evaluate(deck=>duelApp.newGame({deck,opponentDeck:'blue',first:0,seed:77}),deck);
      assert.equal(await page.locator('.hand-slot').count(),5);assert.equal(await page.locator('img[src="undefined"]').count(),0);
    }
  });
  await check('archive filters, pendulum descriptions, search and navigation',async()=>{
    await page.click('[data-action="library"]');assert.equal(await page.locator('#library-grid .library-card').count(),204);
    await page.click('[data-action="library-filter"][data-filter="xyz"]');const xyz=await page.locator('#library-grid .library-card').count();assert.ok(xyz>5);
    await page.click('[data-action="library-filter"][data-filter="all"]');await page.fill('#library-search','侦察');assert.equal(await page.locator('#library-grid .library-card').count(),1);
    await page.click('#library-grid .library-card');assert.equal(await page.locator('.card-detail-layout .pendulum-description').count(),1);await screenshot('03-pendulum-details');
    await page.click('[data-action="detail-back"]');assert.equal(await page.locator('#library-search').inputValue(),'侦察');await page.click('#modal [data-action="close-modal"]');
  });
  await check('deck workshop copies, edits, validates, saves, exports, imports, and starts a custom deck',async()=>{
    await page.click('[data-action="workshop"]');await page.selectOption('#ws-source','blackwing');await page.fill('#ws-name','黑羽 · 我的同调构筑');
    assert.equal(await page.locator('#ws-save').isEnabled(),true);
    await page.locator('.ws-build [data-action="ws-remove"][data-id="bw-gale"]').click();assert.equal(await page.locator('#ws-save').isEnabled(),false);
    await page.fill('#ws-search','黑羽－疾风');await page.locator('#ws-card-grid [data-action="ws-add"]').click();assert.equal(await page.locator('#ws-save').isEnabled(),true);
    await page.click('#ws-save');const saved=await page.evaluate(()=>DuelDecks.getSaved());assert.equal(saved.length,1);assert.equal(saved[0].cards.length,40);
    await screenshot('04-deck-workshop');
    const downloaded=page.waitForEvent('download');await page.click('[data-action="ws-export"]');const download=await downloaded;const file=await download.path();const exported=JSON.parse(await fs.readFile(file,'utf8'));assert.equal(exported.format,'duel-sanctuary-deck');
    await page.click('[data-action="ws-new"]');assert.equal(await page.locator('#ws-save').isEnabled(),false);
    await page.setInputFiles('#ws-import-file',{name:'deck.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await page.waitForFunction(()=>duelApp.workshopDraft.cards.length===40);
    await page.fill('#ws-name','导入的黑羽');await page.click('#ws-play');await page.click('[data-action="begin-game"]');assert.equal(await page.evaluate(()=>duelApp.engine.deckInfo(0).name),'导入的黑羽');
    await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');assert.equal(await page.evaluate(()=>duelApp.engine.deckInfo(0).name),'导入的黑羽');
  });
  async function stage(deck,entries,options={}){
    return page.evaluate(({deck,entries,options})=>{
      const e=new DuelEngine({deck,opponentDeck:'blue',first:0,seed:83});e.state.turn=options.turn||2;e.state.phase=options.phase||'main1';
      for(const p of e.state.players){p.deck.push(...p.hand);p.hand=[];}
      const ids={};
      for(const [owner,zone,id,props={}] of entries){
        let f=e.refs(owner,['deck','extra']).find(f=>f.card.id===id),card=f?e.remove(f.card.uid).card:e.makeCard(id,owner);
        Object.assign(card,{faceUp:true,position:'attack',summonTurn:1,changedTurn:-1},props);
        if(['monsters','spells'].includes(zone)){const at=props.slot??e.state.players[owner][zone].indexOf(null);e.state.players[owner][zone][at]=card;}
        else if(['extraMonster','fieldSpell'].includes(zone)){if(zone==='extraMonster')card.extraSlot=props.extraSlot??owner;e.state.players[owner][zone]=card;}else e.state.players[owner][zone].push(card);
        (ids[id]||=[]).push(card.uid);
      }
      e.state.originalCardCount=e.physicalCards().filter(c=>DuelData.CARDS[c.id].type!=='token').length;
      e.assertState();duelApp.restore(e.snapshot());return ids;
    },{deck,entries,options});
  }
  async function command(uid,label){
    await page.locator('[data-action="select-card"][data-card-uid="'+uid+'"]').first().click();
    await page.evaluate(()=>{window.scrollBy(0,window.scrollY>0?-1:1);return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
    assert.equal(await page.locator('#card-popover').isVisible(),true,'the card menu survives viewport scrolling');
    await page.locator('#card-popover button').filter({hasText:label}).first().click();
  }
  async function choose(uid){await page.locator('[data-action="pending-pick"][data-uid="'+uid+'"]').click();}
  async function confirm(){await page.click('#pending-confirm');}
  async function settle(max=70){
    for(let i=0;i<max;i++){
      const info=await page.evaluate(()=>{const p=duelApp.engine.state.pending;return {p,a:p&&p.responder===0?duelApp.engine.aiNext():null,winner:duelApp.engine.state.winner};});
      if(info.winner!==null||!info.p)return;
      if(info.p.responder!==0){await page.waitForTimeout(260);continue;}
      await page.locator('#pending-confirm').waitFor();
      if(info.a.type==='pass'){await page.click('[data-action="pending-pass"]');continue;}
      if(info.a.type==='respond'){
        if(info.p.kind==='window'){const at=info.p.options.findIndex(o=>o.uid===info.a.uid&&o.key===info.a.key);await page.click('[data-action="pending-response"][data-index="'+at+'"]');}
        await confirm();continue;
      }
      assert.equal(info.a.type,'choose');
      for(const uid of info.a.uids||[])await choose(uid);await confirm();
    }throw new Error('UI choice loop did not settle');
  }
  await check('Synchro material selection, same-time triggers and Doppel Tokens',async()=>{
    const ids=await stage('junk',[[0,'monsters','junk-synchron'],[0,'monsters','doppelwarrior']]);
    await page.click('[data-action="extra-menu"]');const uid=await page.evaluate(()=>duelApp.engine.state.players[0].extra.find(c=>c.id==='junk-warrior').uid);
    await page.locator('[data-action="pile-command"][data-uid="'+uid+'"]').click();await choose(ids['junk-synchron'][0]);await choose(ids.doppelwarrior[0]);assert.equal(await page.locator('#pending-confirm').isEnabled(),true);await screenshot('05-synchro-materials');await confirm();await settle();
    assert.equal(await page.evaluate(uid=>duelApp.engine.find(uid).zone,uid),'extraMonster');assert.equal(await page.evaluate(()=>duelApp.engine.monsters(0).filter(c=>c.id==='doppel-token').length),2);
  });
  await check('Xyz summon and rank-up inherit three physical materials',async()=>{
    const ids=await stage('utopia',[[0,'monsters','gagaga-magician'],[0,'monsters','goblindbergh']]);
    const extra=await page.evaluate(()=>Object.fromEntries(duelApp.engine.state.players[0].extra.map(c=>[c.id,c.uid])));
    await page.click('[data-action="extra-menu"]');await page.locator('[data-action="pile-command"][data-uid="'+extra.utopia+'"]').click();await choose(ids['gagaga-magician'][0]);await choose(ids.goblindbergh[0]);await confirm();await settle();
    await page.click('[data-action="extra-menu"]');await page.locator('[data-action="pile-command"][data-uid="'+extra['utopia-lightning']+'"]').click();await choose(extra.utopia);await confirm();await settle();
    assert.equal(await page.evaluate(uid=>duelApp.engine.find(uid).card.overlays.length,extra['utopia-lightning']),3);await screenshot('06-xyz-field');
    await page.locator('[data-action="select-card"][data-card-uid="'+extra['utopia-lightning']+'"]').click();await page.click('[data-action="overlays"]');assert.equal(await page.locator('#modal .library-card').count(),3);await page.click('#modal [data-action="close-modal"]');
  });
  await check('Pendulum scales, strict level interval and once per turn summon',async()=>{
    const ids=await stage('qliphort',[[0,'hand','qli-scout'],[0,'hand','qli-monolith'],[0,'hand','qli-carrier'],[0,'hand','qli-towers']]);
    await command(ids['qli-scout'][0],'右刻度 9');await settle();await command(ids['qli-monolith'][0],'左刻度 1');await settle();
    await page.click('[data-action="pendulum-summon"]');assert.equal(await page.locator('[data-action="pending-pick"][data-uid="'+ids['qli-towers'][0]+'"]').count(),0);await choose(ids['qli-carrier'][0]);await confirm();await settle();
    assert.equal(await page.evaluate(uid=>duelApp.engine.level(duelApp.engine.find(uid).card),ids['qli-carrier'][0]),4);assert.equal(await page.locator('[data-action="pendulum-summon"]').isDisabled(),true);await screenshot('07-pendulum-field');
  });
  await check('summon position controls allow an immediate defense-position Cowboy effect',async()=>{
    const ids=await stage('utopia',[[0,'monsters','gagaga-magician'],[0,'monsters','goblindbergh']]);
    const cowboy=await page.evaluate(()=>duelApp.engine.state.players[0].extra.find(c=>c.id==='gagaga-cowboy').uid);
    await page.click('[data-action="extra-menu"]');await page.locator('[data-action="pile-command"][data-uid="'+cowboy+'"]').click();
    await choose(ids['gagaga-magician'][0]);await choose(ids.goblindbergh[0]);await page.click('[data-action="summon-position"][data-position="defense"]');await confirm();await settle();
    assert.equal(await page.evaluate(uid=>duelApp.engine.find(uid).card.position,cowboy),'defense');
    await command(cowboy,'800伤害');await settle();assert.equal(await page.evaluate(()=>duelApp.engine.state.players[1].lp),7200);
  });
  await check('HERO fusion resolves multiple material, trigger and search decisions',async()=>{
    const ids=await stage('hero',[[0,'hand','hero-stratos'],[0,'hand','hero-liquid-soldier'],[0,'hand','polymerization']]);
    await command(ids.polymerization[0],'融合');await settle();
    assert.ok(await page.evaluate(()=>duelApp.engine.monsters(0).some(c=>DuelData.CARDS[c.id].type==='fusion')));assert.equal(await page.evaluate(()=>duelApp.engine.state.pending),null);await screenshot('08-hero-fusion');
  });
  await check('attack menus respect opposing monsters and include Extra Monster Zone targets',async()=>{
    const ids=await stage('blue',[[0,'monsters','blue-eyes'],[1,'extraMonster','twin-thunder',{properlySummoned:true}]],{phase:'battle'});
    await page.locator('[data-card-uid="'+ids['blue-eyes'][0]+'"][data-action="select-card"]').click();
    assert.equal(await page.locator('#card-popover button').filter({hasText:'直接攻击'}).count(),0);
    await page.locator('#card-popover button').filter({hasText:'选择攻击目标'}).click();
    await page.locator('[data-card-uid="'+ids['twin-thunder'][0]+'"][data-action="select-card"]').click();await settle();
    assert.equal(await page.evaluate(()=>duelApp.engine.state.players[1].lp),7800);
  });
  await check('Exodia victory through an actual card draw is shown correctly',async()=>{
    const ids=await stage('exodia',[[0,'hand','exodia-head'],[0,'hand','exodia-left-arm'],[0,'hand','exodia-right-arm'],[0,'hand','exodia-left-leg'],[0,'hand','pot-of-greed']]);
    await page.evaluate(()=>{const e=duelApp.engine,p=e.state.players[0],at=p.deck.findIndex(c=>c.id==='exodia-right-leg');const c=p.deck.splice(at,1)[0];p.deck.unshift(c);});
    await command(ids['pot-of-greed'][0],'抽');await page.waitForFunction(()=>duelApp.engine.state.winner===0);assert.equal(await page.evaluate(()=>duelApp.engine.state.winKind),'exodia');await page.waitForTimeout(180);await screenshot('09-exodia-victory');
  });
  await check('Link catalog and card detail show arrows and Link rating without DEF',async()=>{
    await page.evaluate(()=>duelApp.newGame({deck:'tearlaments',opponentDeck:'blue',first:0,seed:17}));await page.click('[data-action="library"]');await page.fill('#library-search','');await page.click('[data-action="library-filter"][data-filter="link"]');
    assert.equal(await page.locator('#library-grid .library-card').count(),9);await page.click('#library-grid [data-card-id="ip-masquerena"]');
    assert.equal(await page.locator('#modal .pc-link-arrows .on').count(),2);assert.equal(await page.locator('#modal .preview-stats small').filter({hasText:'DEF'}).count(),0);assert.equal(await page.locator('#modal .preview-stats small').filter({hasText:'LINK'}).count(),1);
    await screenshot('14-link-card');await page.click('#modal [data-action="close-modal"]');
  });
  await check('Link material selection offers shared zones and highlights the chosen Link arrows',async()=>{
    const ids=await stage('tearlaments',[[0,'monsters','battle-ox'],[0,'monsters','tear-merrli']]);const ip=await page.evaluate(()=>duelApp.engine.state.players[0].extra.find(c=>c.id==='ip-masquerena').uid);
    await page.click('[data-action="link-menu"]');assert.equal(await page.locator('#modal .playing-card.type-link').count(),8);await page.locator('[data-action="pile-command"][data-uid="'+ip+'"]').click();
    await choose(ids['battle-ox'][0]);await choose(ids['tear-merrli'][0]);assert.equal(await page.locator('[data-action="summon-position"][data-position="defense"]').count(),0);
    await page.click('[data-action="summon-zone"][data-zone="extra2"]');await screenshot('15-link-materials');await confirm();await settle();
    assert.equal(await page.evaluate(uid=>duelApp.engine.extraAt(1).card.uid,ip),ip);
    await page.locator('[data-action="select-card"][data-card-uid="'+ip+'"]').click();assert.equal(await page.locator('#duel-board .link-pointed').count(),2);assert.equal(await page.locator('#link-network-lines path').count(),2);await screenshot('16-link-arrows');
    await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');assert.equal(await page.evaluate(()=>duelApp.engine.extraAt(1).card.id),'ip-masquerena');
  });
  await check('Link summons can use pointed main zones while the shared extra zone stays occupied',async()=>{
    const ids=await stage('tearlaments',[[0,'extraMonster','cross-sheep',{extraSlot:0}],[0,'monsters','tear-merrli',{slot:1}],[0,'monsters','tear-scheiren',{slot:3}]]);const ip=await page.evaluate(()=>duelApp.engine.state.players[0].extra.find(c=>c.id==='ip-masquerena').uid);
    await page.click('[data-action="link-menu"]');await page.locator('[data-action="pile-command"][data-uid="'+ip+'"]').click();await choose(ids['tear-merrli'][0]);await choose(ids['tear-scheiren'][0]);
    const zones=await page.locator('[data-action="summon-zone"]').evaluateAll(els=>els.map(el=>el.dataset.zone));assert.deepEqual(zones,['0','2']);await page.click('[data-action="summon-zone"][data-zone="2"]');await confirm();await settle();
    assert.equal(await page.evaluate(uid=>duelApp.engine.find(uid).index,ip),2);assert.equal(await page.evaluate(()=>duelApp.engine.extraAt(0).card.id),'cross-sheep');
  });
  await check('Tear fusion UI requires the GY source and returns the chosen materials to the bottom',async()=>{
    const ids=await stage('tearlaments',[[0,'monsters','supreme-sea-mare'],[0,'deck','tear-merrli'],[0,'hand','foolish-burial']]);const kit=await page.evaluate(()=>duelApp.engine.state.players[0].extra.find(c=>c.id==='tear-kitkallos').uid);
    await command(ids['foolish-burial'][0],'将1只怪兽送墓');await choose(ids['tear-merrli'][0]);await confirm();await confirm();await choose(kit);await confirm();
    assert.ok((await page.locator('.tear-material-note').textContent()).includes('梅洛'));assert.equal(await page.locator('[data-action="pending-pick"][data-uid="'+ids['tear-merrli'][0]+'"] .mandatory-badge').count(),1);
    await choose(ids['tear-merrli'][0]);await choose(ids['supreme-sea-mare'][0]);await page.click('[data-action="summon-zone"][data-zone="2"]');await screenshot('17-tear-fusion');await confirm();
    await page.click('[data-action="pending-pass"]');assert.deepEqual(await page.evaluate(()=>duelApp.engine.state.players[0].deck.slice(-2).map(c=>c.uid)),[ids['tear-merrli'][0],ids['supreme-sea-mare'][0]]);
  });
  await check('I:P opponent-turn Link summon presents its mandatory material and keeps protection',async()=>{
    const ids=await stage('tearlaments',[[0,'extraMonster','ip-masquerena',{extraSlot:0}],[0,'monsters','tear-merrli'],[0,'hand','tear-scheiren'],[1,'monsters','blue-eyes']]);const unicorn=await page.evaluate(()=>duelApp.engine.state.players[0].extra.find(c=>c.id==='knightmare-unicorn').uid);
    await page.evaluate(()=>{const e=duelApp.engine;e.state.active=1;e.state.frame={kind:'main-open',owner:1,windowOffered:false};e.pump();duelApp.restore(e.snapshot());});
    await page.locator('[data-action="pending-response"]').first().click();await confirm();await choose(unicorn);await confirm();
    assert.equal(await page.locator('[data-action="pending-pick"][data-uid="'+ids['ip-masquerena'][0]+'"] .mandatory-badge').count(),1);await choose(ids['ip-masquerena'][0]);await choose(ids['tear-merrli'][0]);await confirm();await settle();
    assert.equal(await page.evaluate(uid=>duelApp.engine.find(uid)?.card.linkProtection,unicorn),true);
  });
  await check('Link arrows allow multiple face-up Extra Deck Pendulum monsters to return',async()=>{
    const ids=await stage('qliphort',[[0,'extraMonster','cross-sheep',{extraSlot:0}],[0,'spells','qli-monolith',{slot:0}],[0,'spells','qli-scout',{slot:4}],[0,'extra','qli-carrier',{faceUpExtra:true}],[0,'extra','qli-disk',{faceUpExtra:true}],[0,'hand','qli-helix']]);
    await page.click('[data-action="pendulum-summon"]');await choose(ids['qli-carrier'][0]);await choose(ids['qli-disk'][0]);await choose(ids['qli-helix'][0]);await confirm();await settle();
    assert.deepEqual(await page.evaluate(()=>duelApp.engine.state.players[0].monsters.slice(0,3).map(c=>c.id)),['qli-carrier','qli-helix','qli-disk']);await screenshot('18-linked-pendulum');
  });
  await check('desktop, tablet and phone layouts keep controls within the viewport',async()=>{
    for(const [width,height] of [[1920,1080],[1440,900],[1280,720],[1024,768],[768,1024],[390,844],[360,740]]){
      await page.setViewportSize({width,height});await page.evaluate(()=>duelApp.newGame({deck:'hero',opponentDeck:'blackwing',first:0,seed:47}));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,width+' field overflow');
      await page.evaluate(()=>duelApp.showNewGame());assert.equal(await page.evaluate(()=>document.querySelector('#modal').scrollWidth>document.querySelector('#modal').clientWidth+1),false,width+' selector overflow');
      const footer=await page.locator('.modal-footer [data-action="begin-game"]').boundingBox();assert.ok(footer&&footer.y+footer.height<=height+1,width+' visible start button');
      if(width===390)await screenshot('10-mobile-deck-selector');await page.click('#modal [data-action="close-modal"]');
      await page.evaluate(()=>duelApp.showWorkshop('hero'));assert.equal(await page.evaluate(()=>document.querySelector('#modal').scrollWidth>document.querySelector('#modal').clientWidth+1),false,width+' workshop overflow');
      if(width===1440)await screenshot('11-workshop-desktop');
      if(width===390){
        await page.click('[data-action="ws-view"][data-view="collection"]');assert.equal(await page.locator('#ws-card-grid').isVisible(),true);await screenshot('12-workshop-mobile');
        await page.click('[data-action="ws-view"][data-view="build"]');assert.equal(await page.locator('#ws-name').isVisible(),true);await screenshot('13-workshop-mobile-build');
        await page.click('[data-action="ws-view"][data-view="collection"]');
      }
      await page.click('#modal [data-action="close-modal"]');
    }
  });
  await check('online artwork validates names and image hosts, recovers failures, and uses offline fallback',async()=>{
    await page.setViewportSize({width:1440,height:900});
    await context.unroute('https://**/*');
    let mismatch=true,brokenImage=true,fixtureCount=81000000;const fixtures=new Map(),requests=[];
    const svg=await fs.readFile(path.join(root,'assets/art/card-back.svg'),'utf8');
    await context.route('https://**/*',async route=>{
      const u=new URL(route.request().url());
      if(u.hostname==='db.ygoprodeck.com'){
        const name=u.searchParams.get('name');requests.push(name);if(!fixtures.has(name))fixtures.set(name,++fixtureCount);const id=fixtures.get(name);
        const returnedName=mismatch&&name==='Elemental HERO Sunrise'?'Mismatched test card':name;
        return route.fulfill({json:{data:[{id,name:returnedName,card_images:[{id,image_url:'https://images.ygoprodeck.com/images/cards/'+id+'.jpg',image_url_cropped:'https://images.ygoprodeck.com/images/cards_cropped/'+id+'.jpg'}]}]}});
      }
      if(u.hostname==='images.ygoprodeck.com'){
        const id=Number(u.pathname.match(/(\d+)\.jpg$/)?.[1]);
        if(brokenImage&&id===fixtures.get('BLUE-EYES WHITE DRAGON'))return route.fulfill({status:503,body:'test image failure'});
        return route.fulfill({status:200,contentType:'image/svg+xml',body:svg});
      }
      return route.abort();
    });
    await page.evaluate(()=>{duelApp.newGame({deck:'hero',opponentDeck:'blue',first:0,seed:91});DuelArt.setEnabled(true);});
    await page.waitForFunction(()=>DuelArt.status().failed>0&&DuelArt.status().cached>0);
    assert.equal(await page.evaluate(()=>DuelArt.src('hero-sunrise')),null,'reject a mismatched card name');
    assert.equal(await page.evaluate(()=>DuelArt.validateURL('https://attacker.invalid/images/cards/123.jpg')),null);
    await page.waitForFunction(()=>document.querySelector('[data-artwork="blue-eyes"]')?.classList.contains('art-unavailable'));
    assert.equal(await page.evaluate(()=>DuelArt.src('blue-eyes')),null,'failed images use a stable fallback');
    mismatch=false;brokenImage=false;await page.evaluate(()=>DuelArt.retry());
    await page.waitForFunction(()=>DuelArt.src('hero-sunrise')&&DuelArt.src('blue-eyes'));
    await page.waitForFunction(()=>[...document.querySelectorAll('img[data-art-id="blue-eyes"]')].some(i=>i.complete&&i.naturalWidth>0));
    assert.ok(requests.includes('Elemental HERO Sunrise'));await page.evaluate(()=>DuelArt.setEnabled(false));
    assert.equal(await page.evaluate(()=>DuelArt.src('blue-eyes')),null);assert.equal(await page.locator('img[data-art-id][src]').count(),0);
    report.artwork='Original service not contacted. Controlled fixtures validated exact names, domain checks, retries, broken-image fallback, and offline mode.';
  });
  assert.deepEqual(report.errors,[]);report.ok=true;
})().catch(e=>{report.errors.push(e.stack);console.error(e.stack);process.exitCode=1;}).finally(async()=>{
  await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await fs.writeFile(path.join(root,'output/v3-browser-report.json'),JSON.stringify(report,null,2));
  if(browser)await browser.close();console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,errors:report.errors,output:out},null,2));
});
