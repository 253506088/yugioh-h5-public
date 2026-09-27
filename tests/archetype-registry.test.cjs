const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
require('../src/advanced-engine.js');
const D=global.DuelData,X=global.DuelChronicle,root=path.resolve(__dirname,'..'),registry=require('../data/archetypes.json'),manifest=require('../data/locales/source-manifest.json');
const ja=new DatabaseSync(path.join(root,manifest.files.ja.path),{readOnly:true}),en=new DatabaseSync(path.join(root,manifest.files.en.path),{readOnly:true});
const query=ja.prepare('SELECT id,setcode,alias FROM datas WHERE id=?');query.setReadBigInts(true);
const byName=en.prepare('SELECT t.id FROM texts t JOIN datas d ON d.id=t.id WHERE t.name=? ORDER BY d.alias,t.id');
function truth(id){const seen=new Set();while(id&&!seen.has(id)){seen.add(id);const r=query.get(id);if(!r)return null;const codes=Array.from({length:4},(_,i)=>Number((r.setcode>>BigInt(16*i))&65535n)).filter(Boolean);if(codes.length||!r.alias)return [...new Set(codes)];id=Number(r.alias);}return [];}
const tokenIdentities=require('../data/archetype-token-identities.json').tokens;
for(const [id,identity]of Object.entries(tokenIdentities)){
 const c=D.CARDS[id],row=en.prepare('SELECT t.name,d.atk,d.def,d.level FROM texts t JOIN datas d ON t.id=d.id WHERE t.id=?').get(identity.providerId);
 assert.equal(row.name,identity.name);assert.deepEqual([c.level,c.atk,c.def],[row.level&255,row.atk,row.def],id);
}
const rows=D.CARD_LIST.map(c=>{const textId=require('../data/locales/cards.json').cards[c.id]?.textId,id=textId||c.providerId||tokenIdentities[c.id]?.providerId||byName.get(c.officialName||'')?.id;return {c,id,codes:id?truth(id):null};});ja.close();en.close();
test('every collectible and every known token carries exact frozen OCG setcodes',()=>{
 for(const {c,id,codes}of rows){assert.ok(id&&codes,c.id+' missing authority');assert.deepEqual(c.setcodes,codes,c.id+' '+c.officialName);}
});
for(const entry of registry.entries.filter(e=>e.kind==='setcode'))test('OCG registry '+entry.name+' '+entry.code,()=>{
 const code=Number(entry.code),errors=[];
 for(const {c,codes}of rows)if(codes!==null){const expected=codes.some(s=>(s&0xfff)===(code&0xfff)&&(s&code)===code);if(D.inArchetype(c,entry.name)!==expected||X.series(c,entry.name)!==expected)errors.push(c.officialName);}
 assert.deepEqual(errors,[]);
});
test('all source and material references are registered, with no legacy family rule checks',async()=>{
 const {scanArchetypeReferences,materialArchetypeReferences}=await import('../scripts/lib/archetype-references.mjs');
 const files=fs.readdirSync(path.join(root,'src')).filter(f=>f.endsWith('.js')&&!['early-cards.js','card-locales.js','card-catalog.js','archetype-data.js'].includes(f)&&!f.startsWith('i18n'));
 const scans=files.map(file=>scanArchetypeReferences(fs.readFileSync(path.join(root,'src',file),'utf8'),file)),refs=[...scans.flatMap(s=>s.references),...materialArchetypeReferences(D.CARD_LIST)];
 assert.deepEqual(refs.filter(r=>!D.archetypeEntry(r.name)),[]);
 assert.deepEqual(scans.flatMap(s=>s.directFamilies).filter(r=>/^(effects-|advanced-|early-engine|chronicle-)/.test(r.file)),[]);
 assert.ok(new Set(refs.map(r=>r.name)).size>240);
});
test('reference scanner understands escapes and static templates without reading comments or regexes',async()=>{
 const {scanArchetypeReferences}=await import('../scripts/lib/archetype-references.mjs');
 const source="// series(c,'fake')\nconst re=/arch('false')/; const s=\"series(c,'wrong')\"; series(c,`HERO`);arch('Gravekeeper\\'s');const groups={a:['label','Blackwing']};const m={series:'Worm',tunerFamily:'synchron'};";
 assert.deepEqual(scanArchetypeReferences(source).references.map(r=>r.name),['HERO',"Gravekeeper's",'Blackwing','Worm','synchron']);
});
test('setcodes preserve four slots, signed values, aliases and authoritative empty membership',async()=>{
 const {splitSetcodes,setcodeReader}=await import('../scripts/lib/setcodes.mjs');
 assert.deepEqual(splitSetcodes(BigInt.asIntN(64,0xc008300810170033n)),[0x33,0x1017,0x3008,0xc008]);
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE datas(id INTEGER PRIMARY KEY,setcode INTEGER,alias INTEGER);INSERT INTO datas VALUES(1,51,0),(2,0,1),(3,8,1),(4,0,0)');const read=setcodeReader(db);
 assert.deepEqual(read(2),{setcodes:[51],setcodeSourceId:1});assert.deepEqual(read(3).setcodes,[8]);assert.deepEqual(read(4).setcodes,[]);assert.equal(read(99),null);db.close();
 assert.equal(D.inArchetype({officialName:'Blackwing Test',setcodes:[]},'Blackwing'),false);
 assert.equal(D.inArchetype({officialName:'Blackwing Test'},'Blackwing'),true);
 assert.equal(D.inArchetype({officialName:'Black-Winged Dragon',setcodes:[]},'Blackwing'),false);
 assert.throws(()=>D.inArchetype({officialName:'Test'},'Unregistered Future Series'),/Unregistered/);
});
test('UI theme unions do not make Junk, Onomat or Bamboo into other rules archetypes',()=>{
 for(const [id,theme,series]of [['junk-synchron','junk','Junk'],['gagaga-girl','utopia','Utopia'],['cursed-bamboo','exodia','Exodia']]){assert.ok(D.isFamily(D.CARDS[id],theme));if(id!=='junk-synchron')assert.equal(D.inArchetype(D.CARDS[id],series),false);}
 assert.equal(D.inArchetype(D.cardByName('Nitro Synchron'),'Junk'),false);
});
