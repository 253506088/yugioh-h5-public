const test=require('node:test'),assert=require('node:assert/strict');
const {DuelEngine}=require('../src/advanced-engine.js'),D=globalThis.DuelData,T=globalThis.DuelDecks,E=require('../src/deck-editor.js'),M=require('../src/match-core.js');
const deck=()=>E.normalize(D.DECKS.hero);
test('dragging out of a forty-card main creates an editable 39-card draft, not an adopted deck',()=>{
 const d=deck(),n=E.transfer(d,{zone:'cards',index:0,id:d.cards[0]},{zone:'side'});
 assert.equal(n.cards.length,39);assert.equal(n.side.length,1);assert.equal(d.cards.length,40);assert.equal(T.analyze(n).valid,false);
 assert.throws(()=>new DuelEngine({deck:d.id,opponentDeck:'dark',deckSpecs:[n,D.DECKS.dark]}));
 const back=E.transfer(n,{zone:'side',index:0,id:n.side[0]},{zone:'cards'});assert.equal(T.analyze(back).valid,true);
});
test('copy, deletion, named copy identity, wrong-type drafts and in-zone ordering',()=>{
 let d=deck();const id=d.extra[0],before=d.extra.length;
 d=E.transfer(d,{zone:'library',id},{zone:'side'});assert.equal(d.extra.length,before);assert.equal(d.side[0],id);
 d=E.transfer(d,{zone:'side',index:0,id},{zone:'cards'});assert.equal(d.side.length,0);assert.equal(T.analyze(d).valid,false);
 d=E.transfer(d,{zone:'cards',index:d.cards.length-1,id},{zone:'library'});assert.equal(T.analyze(d).valid,true);
 const first=d.cards[0],old=d.cards[1];d=E.transfer(d,{zone:'cards',index:0,id:first},{zone:'cards',index:3});assert.equal(d.cards[0],old);assert.equal(d.cards[2],first);
 assert.throws(()=>E.transfer(d,{zone:'cards',index:0,id:'stale-id'},{zone:'side'}));assert.throws(()=>E.transfer(d,{zone:'library',id:'unknown'},{zone:'cards'}));
});
test('copy and section limits are deferred but structural bounds still apply',()=>{
 let d=deck();const id=d.cards[0];for(let i=0;i<17;i++)d=E.transfer(d,{zone:'library',id},{zone:'side'});assert.equal(d.side.length,17);assert.equal(T.analyze(d).valid,false);
 assert.throws(()=>E.transfer(d,{zone:'side',index:0,id},{zone:'extra',index:999}));
});
test('incomplete custom drafts persist and export without weakening strict APIs',()=>{
 const vm=require('node:vm'),fs=require('node:fs'),values=new Map(),data={...D,DECKS:{...D.DECKS}};
 const context=vm.createContext({DuelData:data,localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}});
 vm.runInContext(fs.readFileSync(require.resolve('../src/deck-tools.js'),'utf8'),context);const t=context.DuelDecks,d=deck();d.cards.pop();
 assert.throws(()=>t.save(d));const saved=t.saveDraft(d);assert.equal(saved.draft,true);assert.equal(t.load()[0].cards.length,39);assert.equal(t.getDiagnostics().length,0);
 assert.equal(JSON.parse(t.exportJSON(saved,{allowDraft:true})).deck.cards.length,39);assert.throws(()=>t.exportJSON(saved));
 assert.throws(()=>t.saveDraft({...d,side:null}));assert.throws(()=>t.saveDraft({...d,cards:[{}]}));
});
test('both players must have a legal deck before engine creation',()=>{
 const d=deck(),bad={...deck(),cards:d.cards.slice(1)};
 for(const decks of [[bad,d],[d,bad]])assert.throws(()=>new DuelEngine({deck:d.id,opponentDeck:d.id,deckSpecs:decks}));
});
test('siding supports temporary size violations but always preserves registration and validates ready',()=>{
 const d=deck();d.side=[D.cardByName('Twin Twisters').id];const m=M.create({decks:[d,D.DECKS.dark],format:'bo3'});M.record(m,{winner:1});M.choose(m,0,0);
 const n=E.transfer(d,{zone:'cards',index:0,id:d.cards[0]},{zone:'side'},{registered:d});assert.deepEqual(E.draft(n,d),n);
 assert.throws(()=>M.submit(m,0,n));assert.equal(m.round.ready[0],false);assert.deepEqual(m.decks[0],d);
 assert.throws(()=>E.transfer(n,{zone:'side',index:0,id:n.side[0]},{zone:'library'},{registered:d}));
 assert.throws(()=>E.transfer(n,{zone:'library',id:d.cards[0]},{zone:'cards'},{registered:d}));
 const valid=E.transfer(n,{zone:'side',index:0,id:n.side[0]},{zone:'cards'},{registered:d});M.submit(m,0,valid);assert.equal(m.round.ready[0],true);
});
