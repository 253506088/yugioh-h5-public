const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {DuelEngine}=require('../src/advanced-engine.js');
const D=globalThis.DuelData,E=globalThis.DuelEffects,I=require('../src/i18n.js'),root=path.resolve(__dirname,'..');
const all=D.CARD_LIST.filter(c=>!c.notCollectible),languages=['zh-CN','en','ja'];
test('every collectible card has three local names and complete descriptions',()=>{
 assert.equal(all.length,2456);
 for(const c of all)for(const language of languages){
  const text=I.references[c.id]?.locales[language];
  assert.ok(text?.name?.trim(),c.id+' '+language+' name');
  assert.ok(text?.description?.trim(),c.id+' '+language+' description');
  if(c.type==='pendulum')assert.ok(text.pendulumDescription?.trim(),c.id+' '+language+' Pendulum effect');
 }
 const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/locales/cards.json'),'utf8'));
 assert.deepEqual(catalog.cards,I.references);
 assert.ok(!fs.readFileSync(path.join(root,'src/card-locales.js'),'utf8').includes('</script'));
});
test('Chinese is the default and stable presentation proxies follow all three languages',()=>{
 assert.equal(I.language,'zh-CN');
 const skull=D.cardByName('Skull Servant'),display=I.card(skull.id);
 for(const [language,expected] of [['zh-CN','白骨'],['en','Skull Servant'],['ja','ワイト']]){
  assert.equal(I.setLanguage(language),true);assert.equal(display.name,expected);assert.equal(I.card(skull.id),display);
  assert.equal(display.description,I.references[skull.id].locales[language].description);
 }
 assert.equal(I.setLanguage('fr'),false);assert.equal(I.language,'ja');I.setLanguage('zh-CN');
});
test('switching language preserves canonical rule data, engine actions and saved state',()=>{
 const e=new DuelEngine({deck:'hero',opponentDeck:'tearlaments',first:0,seed:4242}),before=e.snapshot();
 const canonical=JSON.stringify(D.CARDS),effects=Object.keys(E.defs),actions=e.state.players[0].hand.map(c=>e.actionsFor(c.uid,0));
 for(const language of languages){
  I.setLanguage(language);for(const c of all){I.card(c.id).name;I.card(c.id).description;I.card(c.id).race;}
  assert.equal(JSON.stringify(D.CARDS),canonical);assert.deepEqual(Object.keys(E.defs),effects);
  assert.deepEqual(e.snapshot(),before);assert.deepEqual(e.state.players[0].hand.map(c=>e.actionsFor(c.uid,0)),actions);
 }
 I.setLanguage('zh-CN');
});
test('card searches include every language and the numeric provider identity',()=>{
 const skull=D.cardByName('Skull Servant');
 for(const language of languages){I.setLanguage(language);const text=I.searchText(skull.id);for(const q of ['白骨','skull servant','ワイト','32274490'])assert.ok(text.includes(q),language+' '+q);}
 I.setLanguage('zh-CN');
});
test('localized log templates retain card names, quantities and the correct units',()=>{
 const e=new DuelEngine({deck:'early-ritual',opponentDeck:'early-fusion',seed:2});
 for(const language of ['en','ja']){
  I.setLanguage(language);
  const draw=I.log({kind:'draw',owner:0,text:'你抽了2张卡',amount:2},e);assert.ok(draw.includes('2'));assert.ok(!draw.includes('LP'));assert.ok(!draw.includes('抽了'));
  const damage=I.log({kind:'damage',owner:0,text:'未知伤害记录',amount:800},e);assert.match(damage,/800 LP/);
  const search=I.log({kind:'search',owner:0,text:'你将「青眼白龙」加入手牌',cardId:'blue-eyes'},e);assert.ok(search.includes(I.name('blue-eyes')));assert.ok(!search.includes('加入手牌'));
 }
 I.setLanguage('zh-CN');
});
test('all registered effect captions are translated without generic fallback',()=>{
 for(const language of ['en','ja']){
  I.setLanguage(language);
  for(const effect of Object.values(E.defs)){
   const translated=I.translated(effect.label);
   assert.equal(translated.untranslated,false,effect.key+' '+language+' '+effect.label);
   assert.equal(I.effectLabel(effect),translated.text);
  }
 }
 I.setLanguage('zh-CN');
});
test('every encyclopedia URL is a specific validated card page, independent of pictures',()=>{
 for(const c of all){const url=new URL(I.references[c.id].encyclopediaUrl);assert.equal(url.origin,'https://ygoprodeck.com');assert.match(url.pathname,/^\/card\/[a-z0-9-]+\/?$/i);assert.equal(url.search,'');}
 assert.equal(I.references['tear-rulkallos'].encyclopediaUrl,'https://ygoprodeck.com/card/tearlaments-rulkallos-13300');
 const barrel=I.references[D.cardByName('Barrel Dragon').id];assert.equal(barrel.providerId,81480461);assert.equal(barrel.textId,81480460);assert.equal(barrel.imageId,81480461);
});
test('source snapshots remain reproducible and verify against recorded hashes',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'data/locales/source-manifest.json'),'utf8'));
 assert.match(manifest.commit,/^[a-f0-9]{40}$/);
 for(const language of languages){const source=manifest.files[language],bytes=fs.readFileSync(path.join(root,source.path));assert.equal(bytes.length,source.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256);assert.equal(bytes.subarray(0,16).toString(),'SQLite format 3\0');}
});
