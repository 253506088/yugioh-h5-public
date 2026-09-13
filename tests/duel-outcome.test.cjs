const test=require('node:test'),assert=require('node:assert/strict');
const {DuelEngine}=require('../src/advanced-engine.js'),O=require('../src/duel-outcome.js'),I=require('../src/i18n.js');
const {D,put,run}=require('./yearly-sweep-helpers.cjs');
function fresh(){const e=new DuelEngine({deck:'blue',opponentDeck:'dark',first:0,seed:9913});e.state.turn=4;e.state.phase='main1';for(const p of e.state.players){p.deck.push(...p.hand);p.hand=[];}return e;}
function retain(e,owner,count){const p=e.state.players[owner];p.grave.push(...p.deck.splice(count));}
const victories=e=>e.state.log.filter(l=>l.kind==='victory');

test('an empty deck is allowed until a required draw fails',()=>{
  const e=fresh();retain(e,0,1);e.draw(0);e.checkWin();assert.equal(e.state.players[0].deck.length,0);assert.equal(e.state.winner,null);
  e.draw(0,0);assert.equal(e.state.winner,null);e.draw(0);assert.equal(e.state.winner,1);assert.equal(e.state.outcome.kind,'deck-out');assert.equal(e.state.outcome.loser,0);
  assert.match(victories(e)[0].text,/无牌可抽/);assert.equal(victories(e).length,1);
});

test('a partial effect draw records the draw before the final deck-out cause',()=>{
  const e=fresh();retain(e,0,1);e.draw(0,2);
  assert.equal(e.state.players[0].hand.length,1);assert.equal(e.state.log[1].kind,'draw');assert.equal(e.state.log[0].kind,'victory');
  assert.equal(e.state.outcome.kind,'deck-out');e.assertState();
});

test('a real turn draw failure preserves its cause after restoring the game',()=>{
  const e=fresh();retain(e,1,0);run(e,{type:'end'});
  assert.equal(e.state.winner,0);assert.equal(e.state.outcome.kind,'deck-out');assert.equal(e.state.outcome.loser,1);
  const copy=DuelEngine.restore(e.snapshot());assert.deepEqual(copy.state.outcome,e.state.outcome);assert.deepEqual(victories(copy),victories(e));
});

test('LP reaching zero is stored separately from special victories',()=>{
  const e=fresh();e.damage(1,8000);assert.equal(e.state.outcome.kind,'lp-zero');assert.equal(e.state.outcome.winner,0);
  assert.match(victories(e)[0].text,/生命值归零/);assert.equal(e.state.log[0].kind,'victory');
});

test('all five Exodia pieces produce an explicit special-victory record',()=>{
  const e=fresh();for(const c of D.CARD_LIST.filter(c=>c.exodiaPart))put(e,0,'hand',c.id);
  e.checkWin();assert.equal(e.state.winner,0);assert.equal(e.state.outcome.kind,'exodia');assert.equal(e.state.winKind,'exodia');assert.match(victories(e)[0].text,/五个不同部件/);
});

test('Final Countdown records the card responsible for a special victory',()=>{
  const e=fresh(),s=put(e,0,'hand','Final Countdown');run(e,{type:'activate',uid:s.uid,key:s.id+'::cast'});
  e.state.turn=e.state.players[0].finalCountdownTurn;e.emit({type:'end-phase',owner:1});
  assert.equal(e.state.outcome.kind,'special');assert.equal(e.state.outcome.sourceId,s.id);assert.match(O.describe(e.state.outcome,{language:'en',cardName:I.name}),/special victory/);
});

for(const kind of ['deck-out','lp-zero'])test('simultaneous '+kind+' records a draw and its actual cause',()=>{
  const e=fresh();let s;
  if(kind==='deck-out'){retain(e,0,0);retain(e,1,0);s=put(e,0,'hand','One Day of Peace');}
  else{e.state.players[0].lp=1000;s=put(e,0,'spells','Self-Destruct Button',{faceUp:false});}
  run(e,{type:'activate',uid:s.uid,key:s.id+'::cast'});assert.equal(e.state.winner,'draw');assert.equal(e.state.outcome.kind,kind);assert.equal(e.state.outcome.loser,null);
  assert.match(O.describe(e.state.outcome),/平局/);assert.equal(victories(e).length,1);
});

test('one final record survives duplicate finish calls and postgame draw or damage',()=>{
  const e=fresh();e.damage(1,8000);const before=e.snapshot();
  e.finish(1,'other cause');e.draw(0,2);e.damage(0,1000);assert.deepEqual(e.snapshot(),before);assert.equal(victories(e).length,1);
});

test('old finished saves get a readable cause without rewriting the saved state',()=>{
  const e=fresh();retain(e,0,0);e.draw(0);const legacy=e.snapshot();delete legacy.state.outcome;for(const l of legacy.state.log)delete l.outcome;
  const copy=DuelEngine.restore(legacy),before=copy.snapshot();assert.equal(O.read(copy.state).kind,'deck-out');assert.deepEqual(copy.snapshot(),before);
});

for(const [locale,pattern] of [['zh-CN',/无牌可抽/],['en',/could not draw a required card/],['ja',/必要なドロー/]])test('duel log retains the end cause in '+locale,()=>{
  const e=fresh();retain(e,1,0);e.draw(1);I.setLanguage(locale);assert.match(I.log(victories(e)[0],e),pattern);I.setLanguage('zh-CN');
});
