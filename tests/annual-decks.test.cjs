const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
require('../src/advanced-engine.js');const D=global.DuelData,Decks=require('../src/deck-tools.js');
const files=fs.readdirSync('data').filter(f=>['decks-1999-2008.json','decks-2009-2012.json'].includes(f)||/^decks-\d{4}\.json$/.test(f)&&Number(f.slice(6,10))>=2013);
const inputs=files.map(f=>JSON.parse(fs.readFileSync('data/'+f)));
for(const year of D.earlyYears)test(year+' has five distinct complete playable annual builds',()=>{
 const ds=Object.values(D.DECKS).filter(d=>d.year===year);assert.equal(ds.length,5);
 const lists=ds.map(d=>d.cards.slice().sort().join(','));assert.equal(new Set(lists).size,5);
 for(const d of ds){assert.ok(Decks.analyze(d).valid,d.id);assert.equal(d.side.length,15,d.id);assert.ok(d.extra.length<=15);for(const id of [...d.cards,...d.extra,...d.side]){const c=D.CARDS[id];assert.ok(c&&!c.notCollectible&&c.releaseYear<=year,id);assert.notEqual(c.implementationStatus,'pending',d.id+'/'+id);}}
 // Compare Main Deck multisets: a second copy with only a few slots changed is
 // not an independent strategy. At least eight of forty slots must differ.
 for(const [i,a] of ds.entries())for(const b of ds.slice(i+1)){const counts=new Map();for(const id of a.cards)counts.set(id,(counts.get(id)||0)+1);let common=0;for(const id of b.cards)if(counts.get(id)){common++;counts.set(id,counts.get(id)-1);}assert.ok(common/Math.min(a.cards.length,b.cards.length)<=0.8,a.id+' resembles '+b.id);}
});
test('retained annual source lists match runtime Main, Extra and Side without dropped cards',()=>{
 for(const input of inputs)for(const row of input.decks){const d=D.DECKS[row.id];for(const [source,output]of [['main','cards'],['extra','extra'],['side','side']])assert.deepEqual(row[source].flatMap(([n,q])=>Array(q).fill(D.cardByName(n).id)),d[output],row.id+'/'+source);}
});
test('2025 original player recipes retain all sections separately from adaptations',()=>{
 const j=require('../data/deck-sources/worlds-2025.json');assert.equal(j.recipes.length,4);
 for(const r of j.recipes){assert.match(r.source.sha256,/^[a-f0-9]{64}$/);assert.match(r.format,/World Championship/);const size=p=>r[p].reduce((n,[,q])=>n+q,0);assert.ok(size('main')>=40&&size('main')<=60,r.id);assert.equal(size('extra'),15,r.id);assert.equal(size('side'),15,r.id);}
 const rows=require('../data/decks-2025.json').decks;for(const r of rows){assert.match(r.sourceKind,/adaptation/);assert.ok(r.adaptation.length>80);assert.ok(r.sourceRefs.length);}
});
