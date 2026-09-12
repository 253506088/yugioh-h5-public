const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{createHash}=require('node:crypto');
const {chromium}=require('playwright'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/v4.1-browser',new Date().toISOString().replace(/[:.]/g,'-'));
const report={ok:false,at:new Date().toISOString(),checks:[],screenshots:[],errors:[],network:'All HTTP requests intercepted; online artwork uses synthetic fixture pixels.',archive:out};
let browser,fixture;
async function menu(page,action){if(await page.locator('#modal').evaluate(el=>el.open))await page.locator('#modal [data-action="close-modal"]').first().click();await page.locator('.site-header .brand').click();await page.locator('#home-screen [data-action="'+action+'"]').first().click();}
async function check(name,fn){await fn();report.checks.push(name);console.log('OK',name);}
async function shot(page,name){const file=path.join(out,name+'.png');await page.screenshot({path:file,fullPage:true,animations:'disabled'});report.screenshots.push(file);}
async function open({file='output/no-art/index.html',online=false,route=null}={}){
 const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1}),requests=[];
 await context.addInitScript(options=>{
  if(!localStorage.getItem('qa-v41-initialized')){
   localStorage.setItem('qa-v41-initialized','true');localStorage.setItem('duel-sanctuary-welcomed-v3','true');
   localStorage.setItem('duel-sanctuary-prefs-v1',JSON.stringify({sound:false,reducedMotion:true,speed:'fast',responseMode:'on'}));
   if(options.online!==null)localStorage.setItem('duel-sanctuary-online-art-v2',String(options.online));
  }
 },{online});
 await context.route(/https?:\/\//,async r=>{
  requests.push(r.request().url());
  if(route)return route(r);
  if(/^https:\/\/images\.ygoprodeck\.com\//.test(r.request().url()))return r.fulfill({status:200,contentType:'image/png',body:fixture});
  return r.abort();
 });
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.stack));
 await page.goto(pathToFileURL(path.join(root,file)).href);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');await page.click('#home-continue');
 return {context,page,requests};
}
async function locale(page,language){await page.locator((await page.locator('#modal').evaluate(el=>el.open)?'#modal ':'.header-tools ')+'[data-locale-select]').first().selectOption(language);await page.waitForFunction(language=>document.documentElement.lang===language,language);}
async function close(page){if(await page.locator('#modal').evaluate(el=>el.open))await page.locator('#modal [data-action="close-modal"]').first().click();}
async function stage(page,entries,options={}){
 return page.evaluate(({entries,options})=>{
  const e=new DuelEngine({deck:options.deck||'early-ritual',opponentDeck:options.opponentDeck||'early-fusion',first:0,seed:44});
  e.state.turn=2;e.state.phase=options.phase||'main1';e.state.active=options.active||0;
  for(const p of e.state.players){p.deck.push(...p.hand);p.hand=[];}
  const ids={};
  for(const [owner,zone,name,props={}] of entries){
   const id=DuelData.cardByName(name)?.id||name,f=e.refs(owner,['deck','extra']).find(f=>f.card.id===id),m=f?e.remove(f.card.uid).card:e.makeCard(id,owner);
   Object.assign(m,{faceUp:true,position:'attack',summonTurn:0,changedTurn:0,setTurn:0},props);
   const p=e.state.players[owner];if(['monsters','spells'].includes(zone))p[zone][props.slot??p[zone].indexOf(null)]=m;else if(zone==='extraMonster'){m.extraSlot=owner;p.extraMonster=m;}else p[zone].push(m);
   ids[name]=m.uid;
  }
  if(options.overlays){const host=e.find(ids[options.overlays]).card;host.overlays=['Battle Ox','Kuriboh'].map(name=>e.makeCard(DuelData.cardByName(name).id,0));}
  e.state.originalCardCount=e.physicalCards().filter(c=>DuelData.CARDS[c.id].type!=='token').length;
  if(options.attack){const r=e.act({type:'attack',uid:ids[options.attack],target:null});if(!r.ok)throw new Error(r.error);}
  if(options.win){e.state.winner=0;e.state.resultReason='对方的生命值归零';}
  duelApp.restore(e.snapshot());return ids;
 },{entries,options});
}
async function activate(page,uid){const index=await page.evaluate(uid=>duelApp.engine.actionsFor(uid,0).findIndex(a=>a.type==='activate'),uid);assert.ok(index>=0,'card has an activation');await page.locator('[data-action="select-card"][data-card-uid="'+uid+'"]').first().click();await page.locator('#card-popover [data-action="card-command"][data-command="'+index+'"]').click();}
async function pick(page,uid){await page.locator('[data-action="pending-pick"][data-uid="'+uid+'"]').click();}
async function savedState(page){return page.evaluate(()=>JSON.stringify(duelApp.engine.snapshot()));}
async function detail(page,id){await page.evaluate(()=>duelApp.showLibrary());await page.fill('#library-search',id);await page.locator('#library-grid [data-card-id="'+id+'"]').click();}
(async()=>{
 await fs.mkdir(out,{recursive:true});fixture=await sharp({create:{width:96,height:96,channels:3,background:'#597d70'}}).png().toBuffer();await fs.writeFile(path.join(out,'synthetic-online-fixture.png'),fixture);
 let executablePath=process.env.DUEL_BROWSER;const edge='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';if(!executablePath)try{await fs.access(edge);executablePath=edge;}catch{}
 browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{}),args:['--no-first-run','--disable-background-networking','--mute-audio']});
 await check('three languages switch immediately, persist after reload, and preserve the current duel',async()=>{
  const {context,page,requests}=await open();try{
   const before=await savedState(page);
   for(const language of ['en','ja','zh-CN']){await locale(page,language);assert.equal(await savedState(page),before);assert.equal(await page.evaluate(()=>duelApp.language),language);}
   await locale(page,'ja');await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');assert.equal(await page.evaluate(()=>duelApp.language),'ja');assert.equal(await savedState(page),before);
   await menu(page,'library');await page.fill('#library-search','Skull Servant');assert.equal(await page.locator('#library-grid [data-card-id="early-32274490"]').count(),1);
   for(const [language,name] of [['en','Skull Servant'],['ja','ワイト'],['zh-CN','白骨']]){await locale(page,language);assert.equal(await page.locator('#library-grid [data-card-id="early-32274490"] h3').textContent(),name);assert.equal(await page.locator('#library-search').inputValue(),'Skull Servant');}
   assert.deepEqual(requests,[]);await shot(page,'01-chinese-card-search');
  }finally{await context.close();}
 });
 await check('Ritual materials, Defense Position and the chosen zone survive switching languages',async()=>{
  const {context,page}=await open();try{
   const ids=await stage(page,[[0,'hand','Black Luster Soldier'],[0,'hand','Black Luster Ritual'],[0,'hand','Blue-Eyes White Dragon'],[0,'hand','Kuriboh']]);
   await activate(page,ids['Black Luster Ritual']);await pick(page,ids['Black Luster Soldier']);await page.click('#pending-confirm');await pick(page,ids['Blue-Eyes White Dragon']);
   await page.click('[data-action="summon-position"][data-position="defense"]');await page.click('[data-action="summon-zone"][data-zone="3"]');const before=await savedState(page);
   for(const language of ['en','ja','zh-CN']){
    await locale(page,language);assert.equal(await savedState(page),before);assert.equal(await page.locator('[data-uid="'+ids['Blue-Eyes White Dragon']+'"][aria-pressed="true"]').count(),1);
    assert.equal(await page.locator('[data-action="summon-position"][data-position="defense"]').evaluate(el=>el.classList.contains('active')),true);
    assert.equal(await page.locator('[data-action="summon-zone"][data-zone="3"]').evaluate(el=>el.classList.contains('active')),true);assert.equal(await page.locator('#pending-confirm').isEnabled(),true);
   }
   await locale(page,'en');await shot(page,'02-ritual-selection-english');await page.click('#pending-confirm');
   await page.waitForFunction(uid=>duelApp.engine.find(uid)?.zone==='monsters',ids['Black Luster Soldier']);
   assert.deepEqual(await page.evaluate(uid=>{const f=duelApp.engine.find(uid);return {index:f.index,position:f.card.position};},ids['Black Luster Soldier']),{index:3,position:'defense'});
  }finally{await context.close();}
 });
 await check('a selected chain response stays selected and can still resolve after a language switch',async()=>{
  const {context,page}=await open();try{
   const ids=await stage(page,[[0,'spells','Mirror Force',{faceUp:false}],[0,'spells','Magic Cylinder',{faceUp:false}],[1,'monsters','Blue-Eyes White Dragon']],{phase:'battle',active:1,attack:'Blue-Eyes White Dragon'});
   await page.waitForSelector('.response-option');const index=await page.evaluate(uid=>duelApp.engine.state.pending.options.findIndex(o=>o.uid===uid),ids['Magic Cylinder']);assert.ok(index>=0);
   await page.click('[data-action="pending-response"][data-index="'+index+'"]');const before=await savedState(page);
   for(const language of ['en','ja']){await locale(page,language);assert.equal(await savedState(page),before);assert.equal(await page.locator('.response-option.chosen').getAttribute('data-index'),String(index));assert.equal(await page.locator('#pending-confirm').isEnabled(),true);}
   await shot(page,'03-chain-response-japanese');await page.click('#pending-confirm');
   await page.waitForFunction(()=>duelApp.engine.state.players[1].lp<=5000||duelApp.engine.state.pending?.responder===0);
   if(await page.evaluate(()=>duelApp.engine.state.pending?.kind==='window'&&duelApp.engine.state.pending?.responder===0))await page.click('[data-action="pending-pass"]');
   await page.waitForFunction(()=>duelApp.engine.state.players[1].lp<=5000);
  }finally{await context.close();}
 });
 await check('custom deck names, drafts and saved deck exports are independent of display language',async()=>{
  const {context,page}=await open();try{
   await menu(page,'workshop');await page.selectOption('#ws-source','hero');await page.fill('#ws-name','卡组名称');await page.fill('#ws-search','白骨');
   const before=await page.evaluate(()=>duelApp.workshopDraft);await locale(page,'en');assert.deepEqual(await page.evaluate(()=>duelApp.workshopDraft),before);assert.equal(await page.locator('#ws-name').inputValue(),'卡组名称');assert.equal(await page.locator('#ws-search').inputValue(),'白骨');
   await page.click('#ws-save');const id=await page.evaluate(()=>duelApp.workshopDraft.id);await locale(page,'ja');assert.equal(await page.locator('#ws-source option[value="'+id+'"]').textContent(),'卡组名称');
   const event=page.waitForEvent('download');await page.click('[data-action="ws-export"]');const download=await event,payload=JSON.parse(await fs.readFile(await download.path(),'utf8'));assert.equal(payload.deck.name,'卡组名称');assert.deepEqual(payload.deck.cards,before.cards);
   await page.click('#ws-play');assert.equal(await page.locator('.deck-roster-item.active strong').textContent(),'卡组名称');await locale(page,'en');assert.equal(await page.locator('.deck-roster-item.active strong').textContent(),'卡组名称');
   await page.click('[data-action="begin-game"]');assert.equal(await page.locator('#deck-summary strong').textContent(),'卡组名称');await locale(page,'zh-CN');assert.equal(await page.locator('#deck-summary strong').textContent(),'卡组名称');
   await shot(page,'04-custom-name-preserved');
  }finally{await context.close();}
 });
 await check('large name declarations keep their search and selection across languages',async()=>{
  const {context,page}=await open();try{
   const ids=await stage(page,[[0,'hand','Prohibition']]);await activate(page,ids.Prohibition);await page.fill('#pending-search','青眼白龙');assert.equal(await page.locator('.selection-card:visible').count(),1);await page.locator('.selection-card:visible').click();
   for(const language of ['en','ja']){await locale(page,language);assert.equal(await page.locator('#pending-search').inputValue(),'青眼白龙');assert.equal(await page.locator('.selection-card:visible').count(),1);assert.equal(await page.locator('.selection-card.chosen:visible').count(),1);assert.equal(await page.locator('#pending-confirm').isEnabled(),true);}
   assert.equal(await page.locator('.selection-grid .playing-card').count(),0);await page.click('#pending-confirm');
  }finally{await context.close();}
 });
 await check('deck, pile, overlay and result dialogs redraw without changing their context or stats',async()=>{
  const {context,page}=await open();try{
   await page.locator('[data-action="pile"][data-owner="1"][data-pile="deck"]').click();await locale(page,'en');assert.equal(await page.locator('#modal-title').textContent(),'Fusion · The First Bonds');
   await page.locator('#modal .library-card').first().click();await locale(page,'ja');await page.click('[data-action="detail-back"]');assert.equal(await page.locator('#modal-title').textContent(),'融合・始まりの絆');await close(page);
   await stage(page,[],{deck:'tearlaments'});await page.click('[data-action="link-menu"]');const count=await page.locator('.pile-entry').count();assert.ok(count>0);await locale(page,'en');assert.equal(await page.locator('.pile-entry').count(),count);assert.equal(await page.locator('.pile-entry .type-fusion').count(),0);await close(page);
   const ids=await stage(page,[[0,'monsters','utopia']],{deck:'utopia',overlays:'utopia'});await page.locator('[data-action="select-card"][data-card-uid="'+ids.utopia+'"]').click();await page.locator('#card-popover [data-action="overlays"]').click();assert.equal(await page.locator('#modal .library-card').count(),2);await locale(page,'ja');assert.equal(await page.locator('#modal .library-card').count(),2);await close(page);
   await stage(page,[],{win:true});await page.locator('[data-action="result"]').first().click();const stats=await page.evaluate(()=>localStorage.getItem('duel-sanctuary-stats-v1'));await locale(page,'en');assert.equal(await page.evaluate(()=>duelApp.modalKind),'result');assert.equal(await page.evaluate(()=>localStorage.getItem('duel-sanctuary-stats-v1')),stats);
  }finally{await context.close();}
 });
 await check('encyclopedia links are specific, beside artwork, and available with artwork disabled',async()=>{
  const {context,page,requests}=await open();try{
   await detail(page,'tear-rulkallos');const link=page.locator('.card-encyclopedia-link');assert.equal(await link.getAttribute('href'),'https://ygoprodeck.com/card/tearlaments-rulkallos-13300');assert.equal(await link.getAttribute('target'),'_blank');assert.match(await link.getAttribute('rel'),/noopener/);
   for(const language of ['zh-CN','en','ja']){await locale(page,language);assert.equal(await link.getAttribute('href'),'https://ygoprodeck.com/card/tearlaments-rulkallos-13300');assert.equal(await page.locator('.card-detail-layout .card-description').textContent(),await page.evaluate(()=>DuelI18n.card('tear-rulkallos').description.replace(/\r\n/g,'\n')));}
   assert.deepEqual(requests,[]);await shot(page,'05-encyclopedia-without-images');
  }finally{await context.close();}
 });
 await check('an art-free build enables optional online images by default with no metadata request',async()=>{
  const {context,page,requests}=await open({online:null});try{
   assert.equal(await page.evaluate(()=>DuelArt.status().onlineEnabled),true);
   await page.waitForFunction(()=>[...document.querySelectorAll('img[data-art-id]')].some(img=>img.naturalWidth>0));assert.ok(requests.length>0);assert.ok(requests.every(url=>url.startsWith('https://images.ygoprodeck.com/')));
   await detail(page,'tear-rulkallos');assert.equal(await page.locator('.card-art-link').getAttribute('href'),'https://images.ygoprodeck.com/images/cards/84330567.jpg');assert.equal(await page.locator('.card-art-link + .card-encyclopedia-link').count(),1);
   await close(page);await page.click('[data-action="settings"]');await page.click('[data-action="toggle-online-artwork"]');assert.equal(await page.locator('[data-action="toggle-online-artwork"]').getAttribute('aria-checked'),'false');await close(page);
   const count=requests.length;await menu(page,'library');await page.fill('#library-search','白骨');await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');assert.equal(await page.evaluate(()=>DuelArt.status().onlineEnabled),false);assert.equal(requests.length,count);
   await context.setOffline(true);const before=await savedState(page);await locale(page,'ja');assert.equal(await savedState(page),before);
  }finally{await context.close();}
 });
 await check('embedded pictures win over online fallback, and display off keeps a usable placeholder',async()=>{
  const {context,page,requests}=await open({file:'index.html',online:true});try{
   const initial=await page.evaluate(()=>({status:DuelArt.status(),source:DuelArt.src('blue-eyes')}));assert.equal(initial.status.mode,'hybrid');assert.ok(initial.status.embedded>0);assert.match(initial.source,/^blob:/);
   await detail(page,'blue-eyes');await page.waitForFunction(()=>document.querySelector('#modal img[data-art-id="blue-eyes"]').naturalWidth>0);assert.match(await page.locator('.card-art-link').getAttribute('href'),/^blob:/);
   assert.equal(requests.filter(url=>url.includes('/89631139.jpg')).length,0);
   await page.evaluate(()=>DuelArt.setEnabled(false));assert.equal(await page.locator('#modal img[data-art-id="blue-eyes"]').getAttribute('src'),null);
   await page.evaluate(()=>document.querySelector('#modal img[data-art-id="blue-eyes"]').dispatchEvent(new Event('load')));assert.equal(await page.locator('#modal [data-artwork="blue-eyes"]').evaluate(el=>el.classList.contains('has-art')),false);
   await page.evaluate(()=>DuelArt.setEnabled(true));await page.waitForFunction(()=>document.querySelector('#modal img[data-art-id="blue-eyes"]').naturalWidth>0);await shot(page,'06-embedded-original-art');
  }finally{await context.close();}
 });
 await check('failed online images preserve card text and can be retried successfully',async()=>{
  let fail=true;const {context,page}=await open({online:true,route:r=>fail?r.abort():r.fulfill({status:200,contentType:'image/png',body:fixture})});try{
   await detail(page,'blue-eyes');await page.waitForFunction(()=>DuelArt.kind('blue-eyes')==='none');assert.equal(await page.locator('#modal .card-name').textContent(),'青眼白龙');assert.ok((await page.locator('#modal .card-description').textContent()).length>10);assert.equal(await page.locator('#modal [data-artwork="blue-eyes"]').evaluate(el=>el.classList.contains('has-art')),false);
   fail=false;await page.evaluate(()=>DuelArt.retry());await page.waitForFunction(()=>document.querySelector('#modal img[data-art-id="blue-eyes"]').naturalWidth>0);assert.equal(await page.evaluate(()=>DuelArt.kind('blue-eyes')),'online');
  }finally{await context.close();}
 });
 await check('turning online artwork off ignores late identity responses for future unknown cards',async()=>{
  let pendingRoute,received;const ready=new Promise(r=>received=r);
  const {context,page}=await open({online:true,route:r=>{if(r.request().url().startsWith('https://db.ygoprodeck.com/')){pendingRoute=r;received();return;}return r.fulfill({status:200,contentType:'image/png',body:fixture});}});try{
   await page.evaluate(()=>{DuelData.CARDS['synthetic-late-art']={id:'synthetic-late-art',name:'Synthetic Late Art',officialName:'Synthetic Late Art',type:'monster'};document.body.insertAdjacentHTML('beforeend',DuelArt.html('synthetic-late-art'));DuelArt.request('synthetic-late-art');});await ready;
   await page.evaluate(()=>DuelArt.setOnlineEnabled(false));await pendingRoute.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:[{id:92999999,name:'Synthetic Late Art',card_images:[{image_url_cropped:'https://images.ygoprodeck.com/images/cards_cropped/92999999.jpg',image_url:'https://images.ygoprodeck.com/images/cards/92999999.jpg'}]}]})}).catch(()=>{});
   await page.waitForFunction(()=>DuelArt.status().loading===0);assert.equal(await page.locator('img[data-art-id="synthetic-late-art"]').getAttribute('src'),null);assert.equal(await page.evaluate(()=>DuelArt.status().onlineCached),0);
  }finally{await context.close();}
 });
 await check('all three languages remain usable at a 390px mobile viewport',async()=>{
  const {context,page}=await open();try{
   await page.setViewportSize({width:390,height:844});
   for(const language of ['zh-CN','en','ja']){
    await locale(page,language);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await menu(page,'workshop');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await shot(page,'07-mobile-'+language);await close(page);
   }
  }finally{await context.close();}
 });
 report.buildSha256=createHash('sha256').update(await fs.readFile(path.join(root,'index.html'))).digest('hex');report.noArtSha256=createHash('sha256').update(await fs.readFile(path.join(root,'output/no-art/index.html'))).digest('hex');
 assert.deepEqual(report.errors,[]);report.ok=true;
})().catch(e=>{report.errors.push(e.stack);console.error(e.stack);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await fs.writeFile(path.join(root,'output/v4.1-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));});
