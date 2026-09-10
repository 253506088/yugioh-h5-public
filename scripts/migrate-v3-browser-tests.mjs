import {readFile,writeFile} from 'node:fs/promises';
let s=await readFile(new URL('../tests/v2-browser.cjs',import.meta.url),'utf8');
s=s.replaceAll('output/v2-browser','output/v3-browser').replaceAll('v2-browser-report.json','v3-browser-report.json').replaceAll('duel-sanctuary-welcomed-v2','duel-sanctuary-welcomed-v3');
s=s.replace('{version:2,cards:176,decks:10,overflow:false}','{version:3,cards:204,decks:11,overflow:false}').replace("('.deck-roster-item').count(),10)","('.deck-roster-item').count(),11)").replace("('#library-grid .library-card').count(),176)","('#library-grid .library-card').count(),204)");
s=s.replaceAll('ten presets','eleven presets').replaceAll('02-ten-deck-selector','02-eleven-deck-selector');
s=s.replace("'qliphort','exodia','cyber','crystron'])", "'qliphort','exodia','cyber','crystron','tearlaments'])");
s=s.replace("else if(['extraMonster','fieldSpell'].includes(zone))e.state.players[owner][zone]=card;", "else if(['extraMonster','fieldSpell'].includes(zone)){if(zone==='extraMonster')card.extraSlot=props.extraSlot??owner;e.state.players[owner][zone]=card;}");
const marker="  await check('desktop, tablet and phone layouts keep controls within the viewport'";
const index=s.indexOf(marker);if(index<0)throw new Error('Missing insertion marker');
s=s.slice(0,index)+String.raw`  await check('Link catalog and card detail show arrows and Link rating without DEF',async()=>{
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
`+s.slice(index);
await writeFile(new URL('../tests/v3-browser.cjs',import.meta.url),s);console.log('Created V3 browser regression suite.');
