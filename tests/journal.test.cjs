const test=require('node:test'),assert=require('node:assert/strict');
const {DuelEngine}=require('../src/advanced-engine.js'),L=require('../src/duel-log.js'),I=require('../src/i18n.js');
const {D,put,act,run,settle}=require('./yearly-sweep-helpers.cjs');
function fresh(){const e=new DuelEngine({deck:'blue',opponentDeck:'dark',first:0,seed:91309});e.state.turn=4;e.state.phase='main1';for(const p of e.state.players){p.deck.push(...p.hand);p.hand=[];}return e;}
const cast=(e,c,choices)=>run(e,{type:'activate',uid:c.uid,key:c.id+'::cast',...(choices?{choices}:{})});
const record=(e,kind,uid)=>e.state.log.find(l=>l.kind===kind&&(!uid||l.uid===uid));

test('battle damage explains both combatants, their values and the LP change',()=>{
  const e=fresh(),a=put(e,0,'monsters','Blue-Eyes White Dragon'),b=put(e,1,'monsters','Battle Ox');e.state.phase='battle';run(e,{type:'attack',uid:a.uid,target:b.uid});
  const entry=record(e,'damage');assert.equal(entry.trace.cause.kind,'battle');assert.equal(entry.trace.cause.attacker.cardId,a.id);assert.equal(entry.trace.cause.defender.cardId,b.id);
  assert.equal(entry.trace.cause.attackValue,3000);assert.equal(entry.trace.cause.targetValue,1700);assert.equal(entry.trace.lpBefore,8000);assert.equal(entry.trace.lpAfter,6700);
  assert.match(I.log(entry,e),/青眼白龙.*牛头人/);assert.match(I.log(entry,e),/8,000 → 6,700/);
});

test('effect damage has the card and chain responsible instead of a bare effect label',()=>{
  const e=fresh(),s=put(e,0,'hand','Sparks');cast(e,s);const entry=record(e,'damage');
  assert.equal(entry.trace.cause.cardId,s.id);assert.equal(entry.trace.cause.chainNumber,1);assert.equal(entry.trace.damageType,'effect');assert.equal(entry.trace.lpAfter,7800);
});

test('a queued continuous burn uses its own source rather than inheriting the triggering spell',()=>{
  const e=fresh(),seller=put(e,0,'spells','Coffin Seller'),s=put(e,0,'hand','Raigeki');put(e,1,'monsters','Battle Ox');cast(e,s);
  const damage=record(e,'damage');assert.equal(damage.amount,300);assert.equal(damage.trace.cause.cardId,seller.id);assert.notEqual(damage.trace.cause.cardId,s.id);
});

test('a continuous spell-activation penalty identifies Curse of Darkness rather than the spell it punishes',()=>{
  const e=fresh(),curse=put(e,1,'spells','Curse of Darkness'),s=put(e,0,'hand','Pot of Greed');cast(e,s);
  assert.equal(record(e,'damage').trace.cause.cardId,curse.id);
});

test('an equipment-triggered LP gain identifies the equipment rather than the attacking monster',()=>{
  const e=fresh(),m=put(e,0,'monsters','Mystical Shine Ball'),equip=put(e,0,'spells','Cestus of Dagla',{equipTarget:m.uid});e.state.phase='battle';run(e,{type:'attack',uid:m.uid});
  assert.equal(record(e,'heal').trace.cause.cardId,equip.id);
});

test('counter-trap payment and negation are attributed to C2, not the negated C1',()=>{
  const e=fresh(),s=put(e,0,'hand','Pot of Greed'),counter=put(e,1,'spells','Solemn Judgment',{faceUp:false});
  act(e,{type:'activate',uid:s.uid,key:s.id+'::cast'});act(e,{type:'respond',uid:counter.uid,key:counter.id+'::cast'});settle(e);
  const payment=record(e,'cost'),negation=record(e,'negate');assert.equal(payment.trace.cause.cardId,counter.id);assert.equal(payment.trace.cause.kind,'cost');assert.equal(payment.trace.lpBefore,8000);assert.equal(payment.trace.lpAfter,4000);
  assert.equal(negation.trace.cause.cardId,counter.id);assert.equal(negation.trace.cause.chainNumber,2);assert.equal(negation.chain,1);
});

test('Chain Energy payments identify the continuous effect rather than the card being played',()=>{
  const e=fresh(),energy=put(e,1,'spells','Chain Energy'),s=put(e,0,'hand','Sparks');cast(e,s);
  const entry=record(e,'cost');assert.equal(entry.trace.cause.cardId,energy.id);assert.equal(entry.trace.cause.kind,'effect');assert.equal(entry.trace.lpAfter,7500);
});

test('a healing replacement identifies Bad Reaction to Simochi as the damage source',()=>{
  const e=fresh(),trap=put(e,1,'spells','Bad Reaction to Simochi'),s=put(e,0,'hand','Red Medicine');cast(e,s);
  const entry=record(e,'damage');assert.equal(entry.trace.cause.cardId,trap.id);assert.equal(entry.trace.lpBefore,8000);assert.equal(entry.trace.lpAfter,7500);
});

test('discarded activation cost retains the exact card, source effect and destination',()=>{
  const e=fresh(),s=put(e,0,'spells','Raigeki Break',{faceUp:false}),cost=put(e,0,'hand','Battle Ox'),target=put(e,1,'monsters','Blue-Eyes White Dragon');
  cast(e,s,{cost:[cost.uid],target:[target.uid]});const entry=record(e,'move',cost.uid);
  assert.equal(entry.trace.cause.kind,'cost');assert.equal(entry.trace.cause.cardId,s.id);assert.match(entry.trace.moveKind,/discard/);assert.equal(entry.trace.from,'hand');assert.equal(entry.trace.to,'grave');
  assert.match(I.log(entry,e),/代价/);assert.match(I.log(entry,e),/手牌 → 墓地/);
});

test('discard by an effect is distinct from paying a discard cost',()=>{
  const e=fresh(),s=put(e,0,'hand','Card Destruction'),c=put(e,0,'hand','Battle Ox');put(e,1,'hand','Dark Magician');cast(e,s);
  const entry=record(e,'move',c.uid);assert.equal(entry.trace.cause.kind,'effect');assert.equal(entry.trace.cause.cardId,s.id);assert.equal(entry.trace.moveKind,'effect-discard');assert.doesNotMatch(I.log(entry,e),/代价/);
});

test('end-phase hand-limit discard names the rule instead of the previous effect',()=>{
  const e=fresh();for(let n=0;n<7;n++)put(e,0,'hand','Battle Ox');run(e,{type:'end'});
  const entry=e.state.log.find(l=>l.trace?.moveKind==='rule-discard');assert.ok(entry);assert.equal(entry.trace.cause.kind,'rule');assert.equal(entry.trace.phase,'end');assert.match(I.log(entry,e),/手牌上限/);
});

test('revival records Monster Reborn and the graveyard-to-field transition',()=>{
  const e=fresh(),m=put(e,0,'grave','Blue-Eyes White Dragon'),s=put(e,0,'hand','Monster Reborn');cast(e,s,{target:[m.uid]});
  const entry=record(e,'special',m.uid);assert.equal(entry.trace.cause.cardId,s.id);assert.equal(entry.trace.from,'grave');assert.equal(entry.trace.to,'monsters');assert.match(I.log(entry,e),/死者苏生/);
});

test('fusion choices keep their originating effect through save and restore',()=>{
  const e=fresh();for(let n=0;n<3;n++)put(e,0,'hand','Blue-Eyes White Dragon');const s=put(e,0,'hand','Polymerization');
  act(e,{type:'activate',uid:s.uid,key:s.id+'::cast'});assert.ok(e.state.pending);const saved=e.snapshot(),restored=DuelEngine.restore(saved);
  settle(e);settle(restored);assert.deepEqual(restored.snapshot(),e.snapshot());
  const entry=e.state.log.find(l=>l.trace?.via==='fusion');assert.ok(entry);assert.equal(entry.trace.cause.cardId,s.id);assert.equal(entry.trace.materials.length,3);assert.equal(entry.trace.cause.chainNumber,1);
  assert.equal(entry.trace.to,'extraMonster');assert.ok(e.state.log.filter(l=>l.trace?.moveKind==='fusion-material').every(l=>l.trace.cause.cardId===s.id));
});

test('delayed damage still identifies Power Bond after the spell left the field',()=>{
  const e=fresh();put(e,0,'extra','Cyber Twin Dragon');put(e,0,'hand','Cyber Dragon');put(e,0,'hand','Cyber Dragon');const s=put(e,0,'hand','Power Bond');cast(e,s);run(e,{type:'end'});
  const entry=record(e,'damage');assert.ok(entry);assert.equal(entry.trace.cause.cardId,s.id);assert.equal(entry.amount,2800);assert.equal(e.find(s.uid).zone,'grave');
});

test('replacing a graveyard destination with banishment keeps both the effect and replacement cause',()=>{
  const e=fresh(),law=put(e,1,'monsters','Masked HERO Dark Law'),s=put(e,0,'hand','Foolish Burial');const m=e.state.players[0].deck.find(m=>D.isMonster(D.CARDS[m.id]));
  cast(e,s,{target:[m.uid]});const entry=record(e,'move',m.uid);assert.equal(entry.trace.cause.cardId,s.id);assert.equal(entry.trace.requestedTo,'grave');assert.equal(entry.trace.to,'banished');assert.equal(entry.trace.replacement.cardId,law.id);
  assert.match(I.log(entry,e),/改为/);
});

test('normal Tribute Summons show which monster used the tributed material',()=>{
  const e=fresh(),material=put(e,0,'monsters','Battle Ox'),m=put(e,0,'hand','Summoned Skull');run(e,{type:'summon',uid:m.uid,tributes:[material.uid],mode:'attack'});
  const moved=record(e,'move',material.uid),summoned=record(e,'summon',m.uid);assert.equal(moved.trace.cause.cardId,m.id);assert.equal(moved.trace.cause.kind,'summon');assert.equal(summoned.trace.materials[0].cardId,material.id);assert.match(I.log(summoned,e),/上级召唤/);
});

test('direct simultaneous LP assignments are recorded before the final result, once each',()=>{
  const e=fresh();e.state.players[0].lp=1000;const s=put(e,0,'spells','Self-Destruct Button',{faceUp:false});cast(e,s);
  const changed=e.state.log.filter(l=>l.kind==='lp-change');assert.equal(changed.length,2);assert.ok(changed.every(l=>l.trace.cause.cardId===s.id&&l.trace.lpAfter===0));assert.equal(e.state.log[0].kind,'victory');
});

test('all recorded turns survive more than a hundred entries and saved-state restoration',()=>{
  const e=fresh();for(let i=0;i<150;i++){e.state.turn=1+Math.floor(i/5);e.log('phase','测试阶段记录',e.state.active);}
  assert.equal(e.state.log.length,152);assert.equal(e.state.log.at(-1).n,1);const groups=L.turns(e.state);assert.equal(groups.length,30);assert.equal(groups[0].entries[0].n,1);
  assert.deepEqual(L.turns(DuelEngine.restore(e.snapshot()).state),groups);
});

test('legacy recordings retain their old output shape and can be upgraded for further live play',()=>{
  const e=fresh(),saved=e.snapshot();delete saved.state.logVersion;for(const l of saved.state.log)delete l.trace;
  const old=DuelEngine.restore(saved);assert.deepEqual(old.snapshot(),saved);run(old,{type:'end'});assert.ok(old.state.log.every(l=>!l.trace));
  const before=[...old.state.log];L.upgrade(old.state);old.log('phase','新的记录',0);assert.ok(old.state.log[0].trace);assert.deepEqual(old.state.log.slice(1),before);
});

test('a failed action does not append a causal event or alter the journal',()=>{
  const e=fresh(),s=put(e,0,'hand','Monster Reborn'),before=e.snapshot();const r=e.act({type:'activate',uid:s.uid,key:s.id+'::cast'});assert.equal(r.ok,false);assert.deepEqual(e.snapshot(),before);
});

test('drawn enemy cards stay hidden in the live journal and export, but are visible while spectating',()=>{
  const e=fresh(),m=put(e,1,'deck','Dark Magician');e.state.players[1].deck.unshift(e.state.players[1].deck.pop());e.draw(1);
  const entry=record(e,'draw');assert.equal(entry.trace.cards[0].cardId,m.id);assert.doesNotMatch(I.log(entry,e),/黑魔术师/);
  const exported=L.exportEntry(entry,{view:I.logEntry(entry,e)});assert.ok(!JSON.stringify(exported).includes('dark-magician'));
  e.state.mode='spectate';assert.match(I.log(entry,e),/黑魔术师/);
});

test('an unrevealed enemy Set card returning to hand does not leak its identity through search or export',()=>{
  const e=fresh(),m=put(e,1,'spells','Mirror Force',{faceUp:false}),s=put(e,0,'hand','Giant Trunade');cast(e,s);
  const entry=record(e,'move',m.uid),view=I.logEntry(entry,e);assert.doesNotMatch(view.text,/神圣防护罩/);assert.ok(!view.cards.some(c=>c.cardId===m.id));assert.ok(!JSON.stringify(L.exportEntry(entry,{view})).includes(m.id));
});

for(const [locale,pattern] of [['zh-CN',/死者苏生/],['en',/Monster Reborn/],['ja',/死者蘇生/]])test('causal details are readable in '+locale,()=>{
  const e=fresh(),m=put(e,0,'grave','Blue-Eyes White Dragon'),s=put(e,0,'hand','Monster Reborn');cast(e,s,{target:[m.uid]});I.setLanguage(locale);
  assert.match(I.log(record(e,'special',m.uid),e),pattern);I.setLanguage('zh-CN');
});
