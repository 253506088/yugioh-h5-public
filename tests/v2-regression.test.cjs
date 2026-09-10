const test=require('node:test');
const assert=require('node:assert/strict');
const {DuelEngine}=require('../src/advanced-engine.js');
const Decks=require('../src/deck-tools.js');
const {CARDS,DECKS}=global.DuelData;
function fresh(deck='hero'){
  const g=new DuelEngine({deck,opponentDeck:'blue',first:0,seed:17});g.state.turn=2;
  for(const p of g.state.players){p.deck.push(...p.hand);p.hand=[];}
  return g;
}
function put(g,owner,zone,id,props={}){
  const prior=g.refs(owner,['deck','extra']).find(f=>f.card.id===id),card=prior?g.remove(prior.card.uid).card:g.makeCard(id,owner);
  Object.assign(card,{faceUp:true,position:'attack',summonTurn:1,changedTurn:0},props);
  const p=g.state.players[owner];if(['monsters','spells'].includes(zone))p[zone][props.slot??p[zone].indexOf(null)]=card;
  else if(['extraMonster','fieldSpell'].includes(zone))p[zone]=card;else p[zone].push(card);
  g.state.originalCardCount=g.physicalCards().filter(c=>CARDS[c.id].type!=='token').length;return card;
}
function action(g,a){const r=g.act(a);assert.equal(r.ok,true,JSON.stringify(a)+' '+r.error);return r;}
function settle(g,prefer=null){
  let n=0;while(g.state.pending&&g.state.winner===null&&n++<150){
    const p=g.state.pending;let a=prefer?.(p,g);
    if(!a){
      if(p.kind==='window')a={type:'pass'};
      else if(p.kind==='trigger')a={type:'respond',uid:p.trigger.uid,key:p.trigger.key};
      else if(p.kind==='order')a={type:'choose',uids:p.candidates.map(c=>c.uid)};
      else a=g.chooseAI(p);
    }action(g,a);
  }assert.ok(n<150,'resolution terminated');g.assertState();return g;
}
function cast(g,c,choices={}){action(g,{type:'activate',uid:c.uid,key:c.id+'::cast',choices});return g;}

test('Infinity cannot target or attach a Token, while non-token attachment is tracked',()=>{
  const g=fresh('cyber'),infinity=put(g,0,'monsters','cyber-infinity'),token=put(g,1,'monsters','doppel-token');
  assert.ok(!g.actionsFor(infinity.uid,0).some(a=>a.key==='cyber-infinity::absorb'));
  assert.equal(g.attach(infinity.uid,token.uid),false);assert.equal(g.find(token.uid).zone,'monsters');
  const victim=put(g,1,'monsters','battle-ox');assert.equal(g.attach(infinity.uid,victim.uid),true);assert.equal(g.find(victim.uid).zone,'overlays');
  g.move(infinity.uid,'grave',{kind:'effect-send'});assert.equal(g.find(victim.uid).zone,'grave');g.assertState();
});
test('destroying an activated Normal Spell does not negate its resolving effect',()=>{
  const g=fresh(),pot=put(g,0,'hand','pot-of-greed'),mst=put(g,1,'spells','mst',{faceUp:false,setTurn:1}),before=g.state.players[0].deck.length;
  cast(g,pot);assert.equal(g.state.pending.kind,'window');
  action(g,{type:'respond',uid:mst.uid,key:'mst::cast',choices:{target:[pot.uid]}});settle(g);
  assert.equal(g.state.players[0].deck.length,before-2);assert.equal(g.find(pot.uid).zone,'grave');assert.equal(g.find(mst.uid).zone,'grave');
});
test('Infinity detaches a chosen material to negate a Spell activation and prevent its draw',()=>{
  const g=fresh('cyber'),pot=put(g,0,'hand','pot-of-greed'),infinity=put(g,1,'monsters','cyber-infinity'),material=put(g,1,'monsters','cyber-dragon'),before=g.state.players[0].deck.length;
  g.attach(infinity.uid,material.uid);cast(g,pot);action(g,{type:'respond',uid:infinity.uid,key:'cyber-infinity::negate',choices:{cost:[material.uid]}});settle(g);
  assert.equal(g.state.players[0].deck.length,before);assert.equal(g.find(material.uid).zone,'grave');assert.equal(g.find(pot.uid).zone,'grave');assert.equal(infinity.overlays.length,0);
});
test('Black Whirlwind searches Gale below Shura ATK, enabling Armor Master with exact materials',()=>{
  const g=fresh('blackwing'),whirl=put(g,0,'hand','black-whirlwind'),shura=put(g,0,'hand','bw-shura');settle(cast(g,whirl));action(g,{type:'summon',uid:shura.uid});
  settle(g,p=>p.kind==='choice'?{type:'choose',uids:[p.candidates.find(c=>c.cardId==='bw-gale').uid]}:null);
  const gale=g.state.players[0].hand.find(c=>c.id==='bw-gale');assert.ok(gale);
  action(g,{type:'activate',uid:gale.uid,key:'bw-gale::special'});settle(g);
  const armor=g.state.players[0].extra.find(c=>c.id==='bw-armor-master');action(g,{type:'extra-summon',uid:armor.uid,materials:[shura.uid,gale.uid]});settle(g);
  assert.equal(g.find(armor.uid).zone,'extraMonster');assert.equal(g.state.normalUsed,true);
});
test('Junk Synchron revives Doppelwarrior, whose graveyard token trigger survives field negation',()=>{
  const g=fresh('junk'),junk=put(g,0,'hand','junk-synchron'),doppel=put(g,0,'grave','doppelwarrior');
  action(g,{type:'summon',uid:junk.uid});settle(g);assert.equal(g.find(doppel.uid).zone,'monsters');assert.equal(doppel.effectNegated,true);
  const warrior=g.state.players[0].extra.find(c=>c.id==='junk-warrior');action(g,{type:'extra-summon',uid:warrior.uid,materials:[junk.uid,doppel.uid]});settle(g);
  assert.equal(g.monsters(0).filter(c=>c.id==='doppel-token').length,2);assert.equal(g.attackValue(warrior),3100);
});
test('Shadow Mist shares its once-per-turn limit across copies and both trigger modes',()=>{
  const g=fresh(),mist=put(g,0,'grave','hero-shadow-mist');g.special(0,mist.uid,{via:'revive'});g.pump();settle(g);
  assert.equal(g.state.players[0].hand.filter(c=>c.id==='mask-change').length,1);
  g.move(mist.uid,'grave',{kind:'effect-send',source:{id:'polymerization',owner:0,effectType:'spell'}});g.pump();settle(g);
  const second=put(g,0,'grave','hero-shadow-mist');g.special(0,second.uid,{via:'revive'});g.pump();settle(g);
  assert.equal(g.state.players[0].hand.length,1);assert.ok(g.wasUsed(0,second,'one-effect','name'));
});
test('Mask Change from Absolute Zero to Acid resolves both front and back row wipes',()=>{
  const g=fresh(),zero=put(g,0,'monsters','hero-absolute-zero',{properlySummoned:true}),mask=put(g,0,'hand','mask-change'),victim=put(g,1,'monsters','blue-eyes'),trap=put(g,1,'spells','mirror-force',{faceUp:false,setTurn:2});
  cast(g,mask,{target:[zero.uid]});settle(g);
  assert.ok(g.monsters(0).some(c=>c.id==='masked-acid'));assert.equal(g.find(zero.uid).zone,'grave');assert.equal(g.find(victim.uid).zone,'grave');assert.equal(g.find(trap.uid).zone,'grave');
});
test('Machine Duplication uses Cyber Core current name and Nova-to-Infinity carries all materials',()=>{
  const g=fresh('cyber'),core=put(g,0,'monsters','cyber-core'),dup=put(g,0,'hand','machine-duplication');settle(cast(g,dup,{target:[core.uid]}));
  const dragons=g.monsters(0).filter(c=>c.id==='cyber-dragon');assert.equal(dragons.length,2);
  const nova=g.state.players[0].extra.find(c=>c.id==='cyber-nova'),infinity=g.state.players[0].extra.find(c=>c.id==='cyber-infinity');
  action(g,{type:'extra-summon',uid:nova.uid,materials:dragons.map(c=>c.uid)});settle(g);action(g,{type:'extra-summon',uid:infinity.uid,materials:[nova.uid]});settle(g);
  assert.equal(infinity.overlays.length,3);assert.equal(g.attackValue(infinity),2700);assert.equal(g.level(infinity),0);
});
test('Utopia Double upgrades to 5000 ATK Utopia and Double or Nothing makes a 10000 ATK battle',()=>{
  const g=fresh('utopia'),a=put(g,0,'monsters','gagaga-magician'),b=put(g,0,'monsters','goblindbergh'),enemy=put(g,1,'monsters','blue-eyes');
  const double=g.state.players[0].extra.find(c=>c.id==='utopia-double');action(g,{type:'extra-summon',uid:double.uid,materials:[a.uid,b.uid]});settle(g);
  action(g,{type:'activate',uid:double.uid,key:'utopia-double::upgrade',choices:{cost:[a.uid]}});
  settle(g,p=>p.kind==='choice'?{type:'choose',uids:[p.candidates.find(c=>c.cardId==='utopia').uid]}:null);
  const utopia=g.monsters(0).find(c=>c.id==='utopia'),chance=g.state.players[0].hand.find(c=>c.id==='double-or-nothing');assert.ok(chance);assert.equal(g.attackValue(utopia),5000);assert.equal(utopia.noDirect,true);
  action(g,{type:'phase',phase:'battle'});settle(g);assert.equal(g.act({type:'attack',uid:utopia.uid}).ok,false);
  action(g,{type:'attack',uid:utopia.uid,target:enemy.uid});
  settle(g,p=>p.kind==='window'&&p.context.kind==='attack-negated'?{type:'respond',uid:chance.uid,key:'double-or-nothing::cast'}:null);
  assert.equal(g.state.players[1].lp,8000);assert.equal(g.canAttack(utopia,0,enemy.uid),true);
  action(g,{type:'attack',uid:utopia.uid,target:enemy.uid});settle(g,p=>p.kind==='trigger'&&p.trigger.key==='utopia::negate-attack'?{type:'pass'}:null);
  assert.equal(g.state.players[1].lp,1000);assert.equal(g.find(enemy.uid).zone,'grave');assert.equal(g.attackValue(utopia),5000);
});
test('Utopia Lightning consumes two materials and blocks opposing battle responses',()=>{
  const g=fresh('utopia'),utopia=put(g,0,'monsters','utopia'),a=put(g,0,'monsters','gagaga-magician'),b=put(g,0,'monsters','goblindbergh'),enemy=put(g,1,'monsters','blue-eyes'),kuriboh=put(g,1,'hand','kuriboh');
  g.attach(utopia.uid,a.uid);g.attach(utopia.uid,b.uid);const lightning=g.state.players[0].extra.find(c=>c.id==='utopia-lightning');
  action(g,{type:'extra-summon',uid:lightning.uid,materials:[utopia.uid]});settle(g);action(g,{type:'phase',phase:'battle'});settle(g);action(g,{type:'attack',uid:lightning.uid,target:enemy.uid});
  settle(g,p=>p.kind==='window'&&p.options.some(o=>o.key==='utopia-lightning::five-thousand')?{type:'respond',uid:lightning.uid,key:'utopia-lightning::five-thousand',choices:{cost:[a.uid,b.uid]}}:null);
  assert.equal(g.state.players[1].lp,6000);assert.equal(g.find(kuriboh.uid).zone,'hand');assert.equal(lightning.overlays.length,1);assert.equal(g.attackValue(lightning),2500);
});
test('Saqlifice supplies two tributes and Qliphort Disk recruits two with End Phase destruction',()=>{
  const g=fresh('qliphort'),carrier=put(g,0,'monsters','qli-carrier',{qliReduced:true}),equip=put(g,0,'spells','saqlifice',{equipTarget:carrier.uid}),disk=put(g,0,'hand','qli-disk'),enemy=put(g,1,'monsters','blue-eyes');
  assert.ok(g.tributeSets(disk,false,0).some(set=>set.length===1&&set[0]===carrier.uid));
  action(g,{type:'summon',uid:disk.uid,tributes:[carrier.uid]});settle(g);
  assert.equal(g.find(carrier.uid).zone,'extra');assert.equal(g.find(carrier.uid).card.faceUpExtra,true);assert.equal(g.find(equip.uid).zone,'grave');assert.equal(g.attackValue(disk),2800);
  assert.equal(g.state.delayed.filter(t=>t.kind==='destroy').length,2);assert.equal(g.find(enemy.uid).zone,'hand');
  const delayed=g.state.delayed.filter(t=>t.kind==='destroy').map(t=>t.uid);action(g,{type:'end'});settle(g);for(const uid of delayed){assert.equal(g.find(uid).zone,'extra');assert.equal(g.find(uid).card.faceUpExtra,true);}
});
test('Crystron Citree synchronizes on the opponent turn and banishes its two materials',()=>{
  const g=fresh('crystron'),citree=put(g,0,'monsters','cry-citree'),non=put(g,0,'grave','cry-thystvern'),enemy=put(g,1,'monsters','blue-eyes',{summonKind:'special'});
  g.state.active=1;g.state.frame={kind:'main-open',owner:1,windowOffered:true};g.openWindow(0,0);assert.equal(g.state.pending.responder,0);
  action(g,{type:'respond',uid:citree.uid,key:'cry-citree::quick-synchro',choices:{target:[non.uid]}});settle(g);
  assert.equal(g.find(citree.uid).zone,'banished');assert.equal(g.find(non.uid).zone,'banished');assert.ok(g.monsters(0).some(c=>c.id==='cry-ametrix'));assert.equal(enemy.position,'defense');assert.equal(g.state.active,1);
});
test('Xyz Tokens and Quickdraw in a generic Synchro are rejected without consuming cards',()=>{
  const g=fresh('junk'),token=put(g,0,'monsters','doppel-token'),quick=put(g,0,'monsters','quickdraw-synchron'),non=put(g,0,'monsters','bw-gale',{dynamicTuner:false});
  const generic=g.state.players[0].extra.find(c=>c.id==='stardust-dragon');assert.equal(g.synchroValid(0,generic,[quick,non]),false);
  const xyz=put(g,0,'extra','gagaga-cowboy');assert.equal(g.xyzValid(0,xyz,[token,non]),false);
  const before=g.snapshot();assert.equal(g.act({type:'extra-summon',uid:generic.uid,materials:[quick.uid,non.uid]}).ok,false);assert.deepEqual(g.snapshot(),before);
});
test('a target which leaves and re-enters the field is a new instance for a resolving effect',()=>{
  const g=fresh('blackwing'),gale=put(g,0,'monsters','bw-gale'),victim=put(g,1,'monsters','blue-eyes'),mst=put(g,1,'spells','mst',{faceUp:false,setTurn:1}),spell=put(g,0,'spells','black-whirlwind');
  action(g,{type:'activate',uid:gale.uid,key:'bw-gale::halve',choices:{target:[victim.uid]}});assert.equal(g.state.pending.kind,'window');
  const before=victim.generation;g.move(victim.uid,'hand',{kind:'effect-return'});g.special(1,victim.uid,{via:'effect'});assert.ok(victim.generation>before);settle(g);
  assert.equal(g.attackValue(victim),3000);assert.equal(g.defenseValue(victim),2500);
});
test('saving while paying costs retains chain context and target selection',()=>{
  const g=fresh('cyber'),infinity=put(g,0,'monsters','cyber-infinity'),material=put(g,0,'monsters','cyber-dragon');g.attach(infinity.uid,material.uid);
  const monster=put(g,1,'monsters','battle-ox');action(g,{type:'activate',uid:infinity.uid,key:'cyber-infinity::absorb'});assert.equal(g.state.pending.kind,'input');
  const restored=DuelEngine.restore(g.snapshot());assert.deepEqual(restored.snapshot(),g.snapshot());action(restored,{type:'choose',uids:[monster.uid]});settle(restored);assert.equal(restored.find(monster.uid).zone,'overlays');
});
test('Extra Deck monsters can be summoned in defense and Cowboy can burn on its summon turn',()=>{
  const g=fresh('utopia'),a=put(g,0,'monsters','gagaga-magician'),b=put(g,0,'monsters','goblindbergh'),cowboy=g.state.players[0].extra.find(c=>c.id==='gagaga-cowboy');
  action(g,{type:'extra-summon',uid:cowboy.uid});action(g,{type:'choose',uids:[a.uid,b.uid],position:'defense'});settle(g);
  assert.equal(cowboy.position,'defense');action(g,{type:'activate',uid:cowboy.uid,key:'gagaga-cowboy::effect',choices:{cost:[a.uid]}});settle(g);assert.equal(g.state.players[1].lp,7200);
});
test('V1 saves migrate to V2 without losing the hand, life points or construction',()=>{
  const {DuelEngine:Legacy}=require('../src/engine.js');const original=new Legacy({deck:'blue',first:0,seed:48});
  const snapshot=original.snapshot(),modern=DuelEngine.restore(snapshot);assert.equal(snapshot.state.version,1);assert.equal(modern.state.version,global.DuelData.rulesVersion);
  assert.deepEqual(modern.state.players[0].hand.map(c=>c.id),snapshot.state.players[0].hand.map(c=>c.id));assert.equal(modern.state.players[0].lp,snapshot.state.players[0].lp);assert.equal(modern.deckInfo(0).cards.length,40);modern.assertState();
});
test('Exodia requires five distinct hand parts and supports simultaneous victories',()=>{
  const g=fresh('exodia');for(let i=0;i<5;i++)put(g,0,'hand','exodia-head');g.checkWin();assert.equal(g.state.winner,null);
  const other=fresh('exodia');for(const owner of [0,1])for(const id of ['exodia-head','exodia-left-arm','exodia-right-arm','exodia-left-leg','exodia-right-leg'])put(other,owner,'hand',id);other.checkWin();assert.equal(other.state.winner,'draw');
});
test('custom deck JSON rejects illegal cards and copy limits, and saved decks survive storage reload',()=>{
  const values=new Map();global.localStorage={getItem:key=>values.get(key)||null,setItem:(k,v)=>values.set(k,v)};
  try{
    const draft=Decks.copy('hero');draft.name='我的 HERO';const raw=Decks.save(draft),json=Decks.exportJSON(raw),parsed=Decks.parseJSON(json);assert.equal(parsed.cards.length,40);assert.equal(parsed.extra.length,15);
    const invalid={...parsed,cards:[...parsed.cards,'doppel-token']};assert.equal(Decks.analyze(invalid).valid,false);assert.throws(()=>Decks.parseJSON(JSON.stringify(invalid)));
    assert.throws(()=>Decks.parseJSON('{"name":"x","cards":["unknown"],"extra":[]}'));
    const broken={...parsed,cards:[...parsed.cards,'hero-stratos']};assert.ok(Decks.analyze(broken).errors.some(e=>e.includes('同名')));
    Decks.load();assert.ok(Decks.getSaved().some(d=>d.id===raw.id));const game=new DuelEngine({deck:raw.id,first:0});Decks.remove(raw.id);assert.equal(game.deckInfo(0).name,'我的 HERO');assert.ok(DuelEngine.restore(game.snapshot()).deckInfo(0).cards.length===40);
  }finally{delete global.localStorage;}
});
