const test=require('node:test');
const {assert,D,E,DuelEngine,fresh,put,fieldCard,run,act,settle}=require('./gx-helpers.cjs');
const R=require('../src/rule-modes.js');
const mode=id=>{const e=fresh();R.install(e,id);return e;};
const source=(owner=1,name='Raigeki')=>({id:D.cardByName(name).id,owner,effectType:D.isMonster(D.cardByName(name))?'monster':'spell'});
const cast=(e,name='Sparks',owner=e.state.active)=>{const m=put(e,owner,'hand',name);run(e,{type:'activate',uid:m.uid,key:m.id+'::cast'});return m;};
const flush=e=>{e.pump();settle(e);};

test('25 unique, fully localized rules; seeded draw is stable and classic saves stay classic',()=>{
  assert.equal(R.RULES.length,25);assert.equal(new Set(R.RULES.map(r=>r.id)).size,25);
  for(const r of R.RULES)for(const lang of ['zh-CN','en','ja'])for(const field of ['name','summary','detail'])assert.ok(r[field][lang]);
  const a=new DuelEngine({seed:271,ruleMode:'random'}),b=new DuelEngine({seed:271,ruleMode:'random'});
  assert.equal(R.active(a),R.active(b));assert.ok(R.get(R.active(a)));
  const saved=JSON.parse(JSON.stringify(a.snapshot())),restored=DuelEngine.restore(saved);
  assert.deepEqual(restored.state.ruleMode,a.state.ruleMode);assert.equal(restored.randomState,a.randomState);
  assert.equal(R.install(a,'unity'),R.active(b));
  assert.equal(R.active(new DuelEngine({seed:271})),null);
  assert.throws(()=>new DuelEngine({ruleMode:'unknown'}),/未知/);
});
test('every rule can be selected deterministically and JSON restored',()=>{
  for(const r of R.RULES){const e=new DuelEngine({seed:41,ruleMode:r.id});assert.equal(R.active(e),r.id);assert.equal(R.active(DuelEngine.restore(JSON.parse(JSON.stringify(e.snapshot())))),r.id);e.assertState();}
});
test('element: full table, light/dark symmetry, no relation, divine and missing attribute',()=>{
  for(const [a,b] of [['炎','风'],['风','地'],['地','水'],['水','炎']]){assert.equal(R.affinity(a,b),1);assert.equal(R.affinity(b,a),-1);}
  for(const a of ['光','暗','炎','风','地','水']){assert.equal(R.affinity('神',a),1);assert.equal(R.affinity(a,'神'),-1);assert.equal(R.affinity(a,a),0);}
  assert.equal(R.affinity('光','暗'),1);assert.equal(R.affinity('暗','光'),1);assert.equal(R.affinity('光','水'),0);assert.equal(R.affinity(null,'炎'),0);
  const e=mode('element'),a=fieldCard(e,0,'Flame Swordsman'),b=fieldCard(e,1,'Harpie Lady');
  const battle={uid:a.uid,target:b.uid};assert.equal(e.attackValue(a),1800);assert.equal(e.attackValue(a,battle),3600);assert.equal(e.attackValue(b,battle),650);
  e.modify(b.uid,'atk','set',1301);assert.equal(e.attackValue(b,battle),651);
  const before=e.state.players[1].lp;e.state.phase='battle';run(e,{type:'attack',uid:a.uid,target:b.uid});assert.equal(e.state.players[1].lp,before-2949);assert.equal(e.find(b.uid).zone,'grave');
});
test('equivalence: live negation changes an Effect Monster to the bonus branch',()=>{
  const e=mode('equivalence'),a=fieldCard(e,0,'Dark Magician'),b=fieldCard(e,1,'Sangan');
  assert.equal(e.attackValue(a),3200);assert.equal(e.attackValue(b),700);b.effectNegated=true;assert.equal(e.attackValue(b),1300);assert.equal(e.defenseValue(b),900);
});
test('planned: 10 own-turn activations, failed activations are free, normal summons are free',()=>{
  const e=mode('planned');for(let i=0;i<10;i++)cast(e,'Red Medicine');
  assert.deepEqual(e.plannedQuota(0),{used:10,limit:10});const m=put(e,0,'hand','Sparks');
  assert.equal(e.act({type:'activate',uid:m.uid,key:m.id+'::cast'}).ok,false);assert.equal(e.plannedQuota(0).used,10);
  const a=put(e,0,'hand','Battle Ox');run(e,{type:'summon',uid:a.uid});assert.equal(e.find(a.uid).zone,'monsters');
  e.state.turn++;assert.equal(e.plannedQuota(0).used,0);
});
test('planned: opponent-turn quota blocks the fourth quick activation',()=>{
  const e=mode('planned');for(let i=0;i<3;i++){
    const m=put(e,1,'spells','Jar of Greed',{faceUp:false});castWindow(e,m);
  }
  assert.deepEqual(e.plannedQuota(1),{used:3,limit:3});
  const m=put(e,1,'spells','Jar of Greed',{faceUp:false}),ctx=e.abilityContext(m.uid,m.id+'::cast','window',{window:{kind:'main-open'}});
  assert.equal(E.canUse(e,ctx),false);
});
function castWindow(e,m){e.state.frame={kind:'main-open',owner:0,windowOffered:false};e.pump();assert.equal(e.state.pending.responder,1);act(e,{type:'respond',uid:m.uid,key:m.id+'::cast'});settle(e);}
test('escalation: turn minus one replaces the normal draw, effect draws remain one',()=>{
  const e=mode('escalation');e.state.turn=2;e.beginNextTurn();flush(e);assert.equal(e.state.players[1].hand.length,2);
  e.draw(1,1);assert.equal(e.state.players[1].hand.length,3);
});
test('bitter: one paid rule action, no chain, repeat rejected, quota restores with snapshot',()=>{
  const e=mode('bitter');e.state.players[0].lp=8001;run(e,{type:'rule-action',key:'bitter'});
  assert.equal(e.state.players[0].lp,4001);assert.equal(e.state.players[0].hand.length,1);assert.equal(e.state.chain.length,0);
  assert.equal(e.act({type:'rule-action',key:'bitter'}).ok,false);
  const copy=DuelEngine.restore(JSON.parse(JSON.stringify(e.snapshot())));assert.equal(copy.ruleActions(0).length,0);
});
test('bitter is also available to the responding player during the opponent turn',()=>{
  const e=mode('bitter');e.state.frame={kind:'main-open',owner:0,windowOffered:false};e.pump();assert.equal(e.state.pending.responder,1);
  act(e,{type:'rule-action',key:'bitter'});assert.equal(e.state.players[1].lp,4000);assert.equal(e.state.players[1].hand.length,1);settle(e);
});
test('echo does not re-Set a spell whose activation was negated without destruction',()=>{
  const e=mode('echo'),m=put(e,0,'hand','Sparks');
  const t=put(e,1,'spells','Jar of Greed',{faceUp:false});act(e,{type:'activate',uid:m.uid,key:m.id+'::cast'});
  e.negateLink(e.state.chain[0].id,{uid:t.uid,id:t.id,owner:1,effectType:'trap'},true,false);settle(e);assert.equal(e.find(m.uid).zone,'grave');
});
test('abyss: live grave count, both sides, clamps to zero',()=>{
  const e=mode('abyss'),a=fieldCard(e,0,'Dark Magician'),b=fieldCard(e,1,'Mystical Shine Ball');
  const m=put(e,0,'grave','Sparks');assert.equal(e.attackValue(a),2450);assert.equal(e.attackValue(b),500);
  e.move(m.uid,'banished');assert.equal(e.attackValue(a),2500);
});
test('primal: non-effect, negated monsters and tokens get stats and opponent-only immunity',()=>{
  const e=mode('primal'),a=fieldCard(e,0,'Dark Magician'),b=fieldCard(e,0,'Sangan',{effectNegated:true});
  assert.equal(e.attackValue(a),4000);assert.equal(e.attackValue(b),2500);assert.equal(e.destroy(a.uid,source()),false);
  assert.equal(e.move(a.uid,'banished',{kind:'effect-banish',source:source()}).prevented,true);assert.equal(e.find(a.uid).zone,'monsters');
  assert.equal(e.destroy(a.uid,source(0)),true);
});
test('overclock: draws two, extra summon includes Set, third summon rejected',()=>{
  const e=mode('overclock');const a=put(e,0,'hand','Battle Ox'),b=put(e,0,'hand','Mystical Elf'),c=put(e,0,'hand','Harpie Lady');
  run(e,{type:'summon',uid:a.uid});run(e,{type:'summon',uid:b.uid,mode:'defense'});
  assert.equal(e.act({type:'summon',uid:c.uid}).ok,false);e.beginNextTurn();flush(e);assert.equal(e.state.players[1].hand.length,2);
});
test('hierarchy: lower monster effects fail while equal/higher stars and spells apply',()=>{
  const e=mode('hierarchy'),a=fieldCard(e,0,'Blue-Eyes White Dragon'),b=fieldCard(e,1,'Man-Eater Bug');
  const s={...source(1,'Man-Eater Bug'),uid:b.uid,originalLevel:2};assert.equal(e.destroy(a.uid,s),false);
  assert.equal(e.unaffected(a,{...s,uid:null,originalLevel:8}),false);assert.equal(e.unaffected(a,source()),false);
});
test('hierarchy: actual Xyz materials set persistent stars, detach does not lower them',()=>{
  const e=mode('hierarchy'),a=fieldCard(e,0,'Battle Ox'),b=fieldCard(e,0,'Harpie Lady'),x=put(e,0,'extra','Gem-Knight Pearl');
  e.performXyz(0,x.uid,[a.uid,b.uid]);flush(e);assert.equal(e.find(x.uid).card.ruleStars,8);
  e.detach(x.uid,[a.uid]);assert.equal(e.find(x.uid).card.ruleStars,8);
  const ctx=e.abilityContext(x.uid,'$pendulum::place','main');assert.equal(ctx.source.ruleStars,8);
});
test('roulette: draw and reroll, direct rule damage ignores card damage shields',()=>{
  const e=mode('roulette');let rolls=[0,1/6+.01];e.random=()=>rolls.shift()??.2;e.state.players[0].preventDamageUntil=99;
  e.state.turn=2;e.runTask({op:'rule-roulette',owner:0});flush(e);assert.equal(e.state.players[0].hand.length,1);assert.equal(e.state.players[0].lp,6000);
});
test('roulette lethal damage ends immediately even with a card damage shield',()=>{
  const e=mode('roulette');e.state.turn=10;e.state.players[0].preventDamageUntil=99;e.random=()=>.2;e.runTask({op:'rule-roulette',owner:0});assert.equal(e.state.players[0].lp,0);assert.equal(e.state.winner,1);
});
test('vacuum ignores temporary hand staging of generated tokens',()=>{
  const e=mode('vacuum'),token=D.CARD_LIST.find(c=>c.type==='token');e.createTokens(0,token.id,1);flush(e);assert.equal(e.state.players[0].hand.length,0);
});
test('roulette: choose destruction/banish/return, including indestructible and Extra Deck cards',()=>{
  for(const [roll,zone,expected] of [[3,'monsters','grave'],[4,'monsters','banished'],[6,'grave','extra']]){
    const e=mode('roulette'),m=put(e,1,zone,roll===6?'Flame Swordsman':'Dark Magician',{effectIndestructible:true});e.random=()=>((roll-1)+.1)/6;
    e.runTask({op:'rule-roulette',owner:0});e.pump();assert.equal(e.state.pending.kind,'choice');run(e,{type:'choose',uids:[m.uid]});assert.equal(e.find(m.uid).zone,expected);
  }
  const e=mode('roulette');e.random=()=>.8;e.runTask({op:'rule-roulette',owner:0});assert.equal(e.state.players[0].lp,14000);
});
test('carnival: real three-link chain heals each resolved controller and draws after the chain',()=>{
  const e=mode('carnival'),a=put(e,0,'spells','Jar of Greed',{faceUp:false}),b=put(e,1,'spells','Jar of Greed',{faceUp:false}),c=put(e,0,'spells','Jar of Greed',{faceUp:false});
  act(e,{type:'activate',uid:a.uid,key:a.id+'::cast'});act(e,{type:'respond',uid:b.uid,key:b.id+'::cast'});act(e,{type:'respond',uid:c.uid,key:c.id+'::cast'});settle(e);
  assert.equal(e.state.players[0].lp,9000);assert.equal(e.state.players[1].lp,8500);assert.equal(e.state.players[0].hand.length,4);assert.equal(e.state.players[1].hand.length,2);
});
test('vacuum: consuming the last card draws two even when that effect also draws',()=>{
  const e=mode('vacuum');cast(e,'Pot of Greed');assert.equal(e.state.players[0].hand.length,4);
  for(const m of [...e.state.players[0].hand])e.move(m.uid,'grave',{kind:'cost-discard'});flush(e);assert.equal(e.state.players[0].hand.length,0);
});
test('echo: normal spell resets and second activation banishes; Quick-Play waits a turn',()=>{
  const e=mode('echo'),m=cast(e);assert.equal(e.find(m.uid).zone,'spells');assert.equal(m.faceUp,false);assert.equal(m.ruleEchoed,true);
  run(e,{type:'activate',uid:m.uid,key:m.id+'::cast'});assert.equal(e.find(m.uid).zone,'banished');
  const a=put(e,0,'hand','Mystical Space Typhoon'),t=put(e,1,'spells','Jar of Greed',{faceUp:false});
  run(e,{type:'activate',uid:a.uid,key:a.id+'::cast',choices:{target:[t.uid]}});assert.equal(e.find(a.uid).zone,'spells');assert.equal(e.actionsFor(a.uid,0).some(x=>x.type==='activate'),false);
});
test('cannon: normal and special centre summons double ATK, other zones do not',()=>{
  const e=mode('cannon'),m=put(e,0,'hand','Battle Ox');run(e,{type:'summon',uid:m.uid});assert.equal(e.find(m.uid).index,2);assert.equal(e.attackValue(m),3400);
  const n=put(e,0,'hand','Mystical Elf');e.special(0,n.uid,{zone:0});assert.equal(e.attackValue(n),800);
  e.state.turn++;assert.equal(e.attackValue(m),1700);
});
test('stargaze: both search APIs reveal exactly once, effect draws do not trigger or recurse',()=>{
  for(const api of ['search','move']){
    const e=mode('stargaze'),target=put(e,0,'deck','Dark Magician');const top=put(e,1,'deck','Sangan');e.remove(top.uid);e.state.players[1].deck.unshift(top);
    if(api==='search')e.search(0,[target.uid]);else e.move(target.uid,'hand',{kind:'effect-search'});flush(e);
    assert.equal(e.state.players[1].hand.length,1);assert.equal(e.state.players[1].hand[0].uid,top.uid);
    e.draw(0,1);flush(e);assert.equal(e.state.players[1].hand.length,1);
  }
});
test('liberation: sends, costs, destroyed Pendulum cards and detached materials all banish',()=>{
  const e=mode('liberation');for(const [name,zone] of [['Sangan','hand'],['Qliphort Scout','monsters'],['Dark Magician','deck']]){const m=put(e,0,zone,name);e.move(m.uid,'grave',{kind:'cost-discard',ignoreReplacement:true});assert.equal(e.find(m.uid).zone,'banished');}
});
test('legacy: only opponent destruction of face-up monsters rewards, grave activation is disabled',()=>{
  const e=mode('legacy'),m=fieldCard(e,0,'Sangan');e.destroy(m.uid,source());flush(e);assert.equal(e.state.players[0].hand.length,1);assert.equal(e.negated(m),true);assert.equal(e.actionsFor(m.uid,0).length,0);
  const n=fieldCard(e,0,'Dark Magician',{faceUp:false,position:'defense'});e.destroy(n.uid,source());flush(e);assert.equal(e.state.players[0].hand.length,1);
});
test('Soul Charge LP loss can end a duel without producing negative LP in classic or Fate mode',()=>{
  for(const rule of ['off','legacy']){const e=mode(rule),m=put(e,0,'hand','Soul Charge'),a=put(e,0,'grave','Dark Magician'),b=put(e,0,'grave','Battle Ox');e.state.players[0].lp=1500;
    run(e,{type:'activate',uid:m.uid,key:m.id+'::cast',choices:{target:[a.uid,b.uid]}});assert.equal(e.state.players[0].lp,0);assert.equal(e.state.winner,1);e.assertState();}
});
test('unity: each controller counts their own face-up monsters including tokens',()=>{
  const e=mode('unity'),m=fieldCard(e,0,'Dark Magician');fieldCard(e,0,'Mystical Elf');fieldCard(e,0,'Sangan',{faceUp:false});const n=fieldCard(e,1,'Battle Ox');
  assert.equal(e.attackValue(m),3300);assert.equal(e.defenseValue(m),2900);assert.equal(e.attackValue(n),2100);
});
test('quickdraw: same-turn normal trap works; Counter Trap still cannot activate',()=>{
  const e=mode('quickdraw'),m=put(e,0,'spells','Jar of Greed',{faceUp:false,setTurn:e.state.turn});run(e,{type:'activate',uid:m.uid,key:m.id+'::cast'});assert.equal(e.state.players[0].hand.length,1);
  const c=put(e,0,'spells','Magic Jammer',{faceUp:false,setTurn:e.state.turn});assert.equal(e.ruleAllowsSetActivation(c),false);
});
test('dulling: actual battle victory subtracts half original ATK, departure resets loss',()=>{
  const e=mode('dulling'),a=fieldCard(e,0,'Blue-Eyes White Dragon'),b=fieldCard(e,1,'Battle Ox');e.state.phase='battle';run(e,{type:'attack',uid:a.uid,target:b.uid});assert.equal(e.attackValue(a),2150);
  e.move(a.uid,'hand');assert.equal(a.ruleAtkLoss,undefined);
});
test('bounty: one random marker, credited destroyer gets LP and a card once',()=>{
  const e=mode('bounty'),m=fieldCard(e,1,'Dark Magician');e.emit({type:'standby',owner:0});assert.equal(m.ruleWanted,true);e.emit({type:'standby',owner:0});e.destroy(m.uid,source(0));flush(e);assert.equal(e.state.players[0].lp,10000);assert.equal(e.state.players[0].hand.length,1);
});
test('angel: actual draw phase opens top-three choice, puts one to hand and two to GY',()=>{
  const e=mode('angel');e.beginNextTurn();e.pump();const p=e.state.pending;assert.equal(p.operation,'rule-angel');assert.equal(p.candidates.length,3);
  const uid=p.candidates[1].uid;run(e,{type:'choose',uids:[uid]});assert.equal(e.state.players[1].hand.length,1);assert.equal(e.state.players[1].hand[0].uid,uid);assert.equal(e.state.players[1].grave.length,2);
});
test('bloodpact: level-based LP cost, no tributes, failed action rolls back and exact LP cannot pay',()=>{
  const e=mode('bloodpact'),m=put(e,0,'hand','Blue-Eyes White Dragon');assert.ok(e.actionsFor(m.uid).some(a=>a.bloodPact));
  const saved=e.snapshot();assert.equal(e.act({type:'summon',uid:m.uid,bloodPact:true,mode:'invalid'}).ok,false);assert.deepEqual(e.snapshot().state,saved.state);
  run(e,{type:'summon',uid:m.uid,bloodPact:true});assert.equal(e.state.players[0].lp,5600);assert.equal(e.find(m.uid).zone,'monsters');assert.equal(e.state.normalUsed,true);
  const c=mode('bloodpact'),n=put(c,0,'hand','Blue-Eyes White Dragon');c.state.players[0].lp=2400;assert.equal(c.canBloodPact(n),false);
});
test('hardline: attack battle immunity, face-down defense effect immunity, battle damage still applies',()=>{
  const e=mode('hardline'),a=fieldCard(e,0,'Blue-Eyes White Dragon'),b=fieldCard(e,1,'Battle Ox'),d=fieldCard(e,1,'Mystical Elf',{faceUp:false,position:'defense'});
  assert.equal(e.destroy(d.uid,source(0)),false);e.state.phase='battle';run(e,{type:'attack',uid:a.uid,target:b.uid});assert.equal(e.find(b.uid).zone,'monsters');assert.equal(e.state.players[1].lp,6700);
});
test('dormant: third subsequent turn end returns to original owner; re-entry restarts clock',()=>{
  const e=mode('dormant'),m=put(e,0,'hand','Dark Magician'),x=put(e,1,'grave','Flame Swordsman');e.move(m.uid,'grave');x.sentTurn=e.state.turn;
  e.state.turn+=2;e.emit({type:'end-phase',owner:0});flush(e);assert.equal(e.find(m.uid).zone,'grave');
  e.state.turn++;e.emit({type:'end-phase',owner:1});flush(e);assert.equal(e.find(m.uid).zone,'deck');assert.equal(e.find(x.uid).zone,'extra');
  e.move(m.uid,'grave');e.emit({type:'end-phase',owner:1});flush(e);assert.equal(e.find(m.uid).zone,'grave');e.assertState();
});
