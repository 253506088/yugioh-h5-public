/* Systematic 2002 sweep: every snapshot card is placed, activated or flipped once,
   then a full event battery (both sides' summons, attacks on face-up and face-down
   monsters, spell chains, Standby and End Phases, mass effect destruction) runs
   against it. Resolution must terminate, the state machine must stay valid, and
   every card must actually appear in the duel log through its own action. */
const test=require('node:test'),assert=require('node:assert/strict');
const {DuelEngine}=require('../src/advanced-engine.js');
const D=globalThis.DuelData,E=globalThis.DuelEffects,{CARDS,CARD_LIST}=D;
const id=name=>D.cardByName(name)?.id||name;
const CARDS2002=CARD_LIST.filter(c=>c.early&&c.releaseYear===2002);
const gkCard=m=>!!m&&CARDS[m.id].officialName.startsWith("Gravekeeper's");
const amazonessCard=m=>!!m&&CARDS[m.id].officialName.startsWith('Amazoness');
function put(e,owner,zone,name,props={}){
  const cardId=id(name),f=e.refs(owner,['deck','extra']).find(f=>f.card.id===cardId),m=f?e.remove(f.card.uid).card:e.makeCard(cardId,owner);
  Object.assign(m,{faceUp:true,position:'attack',summonTurn:0,changedTurn:0,setTurn:0},props);
  const p=e.state.players[owner];
  if(['spells','monsters'].includes(zone)){const slot=props.slot??p[zone].indexOf(null);assert.ok(slot>=0,'no free '+zone+' zone for '+name);p[zone][slot]=m;}
  else if(zone==='fieldSpell')p.fieldSpell=m;
  else if(zone==='extraMonster'){m.extraSlot=owner;p.extraMonster=m;}
  else p[zone].push(m);
  e.state.originalCardCount=e.physicalCards().filter(c=>CARDS[c.id].type!=='token').length;
  return m;
}
function act(e,a){const r=e.act(a);assert.equal(r.ok,true,JSON.stringify(a)+' : '+r.error);return r;}
function step(e,a){const r=e.act(a);if(e.state.pending)settle(e);return r;}
function settle(e){let n=0;while(e.state.pending&&e.state.winner===null&&n++<200){const p=e.state.pending,a=e.chooseAI(p);act(e,a);if(!e.state.pending)e.pump();}assert.ok(n<200,'resolution terminates');e.assertState();}
function run(e,a){act(e,a);settle(e);}
const exercised=new Map(),note=c=>exercised.set(c.id,true);
function sawAction(e,c){return e.state.log.some(l=>(l.key&&l.key.startsWith(c.id+'::'))||(l.cardId===c.id&&['summon','special','reveal','spell','trap','ritual','flip'].includes(l.kind)));}
// A rich, symmetric board so activation conditions are broadly satisfiable.
function fixture(){
  const e=new DuelEngine({deck:'gravekeeper-2002',opponentDeck:'early-fusion',seed:2002,first:0});
  e.state.turn=6;e.state.phase='main1';e.state.active=0;
  for(const p of e.state.players){p.deck.push(...p.hand);p.hand=[];}
  put(e,0,'monsters','Battle Ox');
  put(e,0,'monsters','Dark Blade');
  put(e,0,'monsters','Gaia the Fierce Knight');
  put(e,0,'spells','Fusion Gate');
  put(e,0,'hand','Battle Ox');put(e,0,'hand','Battle Ox');put(e,0,'hand','Red Medicine');put(e,0,'hand','Dark Magician');put(e,0,'hand','Sangan');
  put(e,1,'monsters','Blue-Eyes White Dragon');put(e,1,'monsters','Summoned Skull');put(e,1,'monsters','Kuriboh');
  put(e,1,'monsters','Man-Eater Bug',{faceUp:false,position:'defense',setTurn:0});
  put(e,1,'monsters','Skelengel',{faceUp:false,position:'defense',setTurn:0});
  put(e,1,'spells','Yami');
  put(e,1,'spells','Mystical Space Typhoon',{faceUp:false,setTurn:0});
  for(let i=0;i<3;i++)put(e,1,'hand','Battle Ox');
  put(e,1,'hand','Sparks');put(e,1,'hand','Pot of Greed');put(e,1,'hand','Book of Moon');put(e,1,'hand','Book of Moon');put(e,1,'hand','Raigeki');put(e,1,'hand','Confiscation');
  put(e,0,'grave','Battle Ox');put(e,0,'grave','Red Medicine');put(e,0,'grave',"Gravekeeper's Vassal");put(e,0,'grave','Buster Blader');put(e,0,'grave','Sword of Dark Destruction');put(e,0,'grave','Skull Servant');
  put(e,1,'grave','Blue-Eyes White Dragon');put(e,1,'grave','Raigeki');
  put(e,0,'extra','Gaia the Dragon Champion');
  return e;
}
function castEquipAt(e,name,targetUid){const eq=put(e,0,'hand',name);if(targetUid&&e.find(targetUid)){const chaff=e.state.players[0].hand.find(x=>x.uid!==eq.uid&&x.uid!==targetUid&&CARDS[x.id].type!=='monster');run(e,{type:'activate',uid:eq.uid,key:eq.id+'::cast',choices:{target:[targetUid],...(chaff?{cost:[chaff.uid]}:{})}});}}
const guardianEquip={'Guardian Ceal':'Shooting Star Bow - Ceal','Guardian Tryce':'Twin Swords of Flashing Light - Tryce','Guardian Grarl':'Gravity Axe - Grarl','Guardian Baou':'Wicked-Breaking Flamberge - Baou','Guardian Elma':'Butterfly Dagger - Elma','Guardian Kay\'est':'Rod of Silence - Kay\'est'};
const OVERRIDES={
  'Exodia Necross':{place(e,m){for(const n of ['Exodia the Forbidden One','Right Arm of the Forbidden One','Left Arm of the Forbidden One','Right Leg of the Forbidden One','Left Leg of the Forbidden One'])put(e,0,'grave',n);e.special(0,m.uid,{via:'exodia-necross'});note(CARDS[m.id]);}},
  'Berserk Dragon':{place(e,m){e.state.dealWithDarkRuler={turn:e.state.turn,owner:0};e.special(0,m.uid,{via:'dark-ruler-deal'});note(CARDS[m.id]);}},
  'Mirage Knight':{place(e,m){e.special(0,m.uid,{via:'dark-flare'});note(CARDS[m.id]);}},
  'Fushioh Richie':{place(e,m){e.special(0,m.uid,{via:'dezard'});note(CARDS[m.id]);}},
  'Great Dezard':{after(e,m){m.dezardKills=2;put(e,0,'hand','Fushioh Richie');}},
  'Moisture Creature':{place(e,m){const tributes=e.monsters(0).filter(x=>e.canTribute(x,0)).map(x=>x.uid);if(tributes.length>=3){act(e,{type:'summon',uid:m.uid,tributes:[tributes[0],tributes[1],tributes[2]]});note(CARDS[m.id]);}}},
  'Guardian Grarl':{after(e,m){}},
  'Des Dendle':{setup(e){put(e,0,'monsters','Vampiric Orchis');}},
  'Second Goblin':{setup(e){put(e,0,'monsters','Giant Orc');}},
  'Zombie Tiger':{setup(e){put(e,0,'monsters','Decayed Commander');}},
  'Z-Metal Tank':{setup(e){put(e,0,'monsters','X-Head Cannon');}},
  'Y-Dragon Head':{setup(e){put(e,0,'monsters','X-Head Cannon');}},
  'Burning Beast':{setup(e){put(e,0,'monsters','Freezing Beast');}},
  'Freezing Beast':{setup(e){put(e,0,'monsters','Burning Beast');}},
  'Koitsu':{setup(e){put(e,0,'monsters','Aitsu');}},
  'Fear from the Dark':{place(e,m){e.state.active=1;e.move(m.uid,'grave',{kind:'effect-discard',byOwner:1,byEffect:true});note(CARDS[m.id]);}},
  'Despair from the Dark':{place(e,m){e.state.active=1;e.move(m.uid,'grave',{kind:'effect-discard',byOwner:1,byEffect:true});note(CARDS[m.id]);}},
  'Neko Mane King':{place(e,m){e.state.active=1;e.move(m.uid,'grave',{kind:'effect-discard',byOwner:1,byEffect:true});note(CARDS[m.id]);}},
  'Royal Tribute':{setup(e){put(e,0,'fieldSpell','Necrovalley');}},
  'Contract with Exodia':{setup(e){for(const n of ['Exodia the Forbidden One','Right Arm of the Forbidden One','Left Arm of the Forbidden One','Right Leg of the Forbidden One','Left Leg of the Forbidden One'])put(e,0,'grave',n);put(e,0,'hand','Exodia Necross');}},
  'Amazoness Spellcaster':{setup(e){put(e,0,'monsters','Amazoness Paladin');}},
  'Toon Defense':{setup(e){put(e,0,'monsters','Toon Gemini Elf');}},
  'Dramatic Rescue':{setup(e){put(e,0,'monsters','Amazoness Paladin');}},
  'Tutan Mask':{setup(e){put(e,0,'monsters','Skull Servant');}},
  'Amazoness Archers':{setup(e){put(e,0,'monsters','Amazoness Paladin');}},
  'Gravekeeper\'s Assailant':{setup(e){put(e,0,'fieldSpell','Necrovalley');}},
  'Charm of Shabti':{setup(e){put(e,0,'monsters',"Gravekeeper's Vassal");}},
  'Gravekeeper\'s Cannonholder':{setup(e){put(e,0,'monsters',"Gravekeeper's Vassal");}},
  'Anti-Spell':{setup(e){put(e,0,'monsters','Apprentice Magician').counters=2;}},
  'Miracle Restoring':{setup(e){put(e,0,'monsters','Apprentice Magician').counters=2;}},
  'Mega Ton Magical Cannon':{setup(e){put(e,0,'monsters','Apprentice Magician').counters=10;}},
  'Buster Rancher':{setup(e){put(e,0,'monsters','Kuriboh');}},
  'Huge Revolution':{setup(e){for(const m of [...e.monsters(0)])e.move(m.uid,'grave',{kind:'rule-test'});for(const n of ['People Running About','Oppressed People','United Resistance'])put(e,0,'monsters',n);}},
  'Combination Attack':{setup(e){const dragon=put(e,0,'monsters','Pitch-Dark Dragon');const host=e.monsters(0).find(m=>m.id===id('Dark Blade'));if(host)run(e,{type:'activate',uid:dragon.uid,key:dragon.id+'::union-equip',choices:{target:[host.uid]}});},after(e,m){const host=e.monsters(0).find(x=>x.id===id('Dark Blade'));const weak=e.monsters(1).find(x=>x.faceUp&&e.attackValue(x)<=1000);if(host&&weak&&e.canAttack(host,0,weak.uid)){e.state.active=0;e.state.phase='battle';act(e,{type:'attack',uid:host.uid,target:weak.uid});settle(e);e.state.active=0;e.state.phase='main1';}if(e.find(m.uid)&&host&&host.attacksMade>0&&e.activeEquip(host).some(eq=>CARDS[eq.id].earlyRules?.union))run(e,{type:'activate',uid:m.uid,key:m.id+'::cast',choices:{target:[host.uid]}});}},
  'Diffusion Wave-Motion':{setup(e){put(e,0,'monsters','Dark Magician');}},
  'Judgment of the Pharaoh':{setup(e){put(e,0,'grave','Unity');}},
  'Toon Table of Contents':{setup(e){put(e,0,'deck','Toon World');}},
  'Gather Your Mind':{setup(e){const p=e.state.players[0];p.deck.push(e.makeCard(id('Gather Your Mind'),0),e.makeCard(id('Gather Your Mind'),0));}},
  'Token Thanksgiving':{setup(e){if(e.freeMain(0))for(const t of e.createTokens(0,'2002-ojama-token',1))t.ojamaToken=true;}},
  'Ojama Trio':{setup(e){const foes=e.monsters(1).filter(m=>m.faceUp).slice(0,3);for(const foe of foes)e.move(foe.uid,'grave',{kind:'rule-test'});}},
  'Formation Union':{setup(e){put(e,0,'monsters','X-Head Cannon');put(e,0,'monsters','Z-Metal Tank');}},
  'Pharaoh\'s Treasure':{afterAll(e,m){const f=e.find(m.uid);if(f?.zone==='deck'){e.state.players[0].deck.unshift(e.remove(m.uid).card);e.draw(0,1);settle(e);}}},
  'Different Dimension Capsule':{afterAll(e,m){for(let i=0;i<3&&e.state.winner!==null;i++){e.state.frame={kind:'standby',owner:0,stage:0,windowOffered:true};e.pump();settle(e);e.state.frame={kind:'end',owner:0,stage:0,windowOffered:true};e.pump();settle(e);}}},
  'Secret Pass to the Treasures':{setup(e){put(e,0,'monsters','Kuriboh');}},
  'Disarmament':{setup(e){castEquipAt(e,'Sword of Deep-Seated',e.monsters(0)[0]?.uid);}},
  'Armored Glass':{setup(e){castEquipAt(e,'Sword of Deep-Seated',e.monsters(0)[0]?.uid);}},
  'Really Eternal Rest':{setup(e){castEquipAt(e,'Sword of Deep-Seated',e.monsters(0)[0]?.uid);}},
  'Exhausting Spell':{setup(e){put(e,0,'monsters','Apprentice Magician').counters=2;}},
  'Arsenal Robber':{setup(e){put(e,1,'deck','Sword of Dark Destruction');}},
  'Arsenal Summoner':{setup(e){put(e,0,'deck','Guardian Kay\'est');}},
  'A Deal with Dark Ruler':{setup(e){e.state.dealWithDarkRuler={turn:e.state.turn,owner:0};put(e,0,'hand','Berserk Dragon');}},
};
for(const card of CARDS2002){
  test('sweep · '+card.officialName,()=>{
    const e=fixture(),override=OVERRIDES[card.officialName]||{};
    override.setup?.(e);
    let m;
    if(card.type==='fusion'){m=put(e,0,'extra',card.officialName);if(e.canSpecial(0,m,{via:'effect'}))e.special(0,m.uid,{via:'effect'});note(card);}
    else if(card.type==='ritual'){
      m=put(e,0,'hand',card.officialName);
      const spell=CARD_LIST.find(x=>x.ritualTarget===card.id);
      if(spell){const s=put(e,0,'hand',spell.officialName);put(e,0,'hand','Blue-Eyes White Dragon');run(e,{type:'activate',uid:s.uid,key:s.id+'::cast'});note(card);}
    }
    else if(card.type==='spell'&&card.ritualTarget){m=put(e,0,'hand',card.officialName);put(e,0,'hand',CARDS[card.ritualTarget].officialName);put(e,0,'hand','Blue-Eyes White Dragon');}
    else if(card.type==='spell'&&card.spellKind==='quick')m=put(e,0,'spells',card.officialName,{faceUp:false,setTurn:e.state.turn-2});
    else if(card.type==='spell')m=put(e,0,'hand',card.officialName);
    else if(card.type==='trap')m=put(e,0,'spells',card.officialName,{faceUp:false,setTurn:e.state.turn-2});
    else if(card.flip)m=put(e,0,'monsters',card.officialName,{faceUp:false,position:'defense'});
    else m=put(e,0,'hand',card.officialName);
    const zone=()=>e.find(m.uid)?.zone;
    if(card.flip&&zone()==='monsters'){e.state.active=0;e.state.phase='main1';run(e,{type:'stance',uid:m.uid});note(card);}
    else if(zone()==='hand'){
      if(override.place)override.place(e,m);
      else if(card.type==='monster'&&card.specialOnly){e.special(0,m.uid,{via:card.specialOnly});note(card);}
      else if(card.type==='monster'&&guardianEquip[card.officialName]){castEquipAt(e,guardianEquip[card.officialName],e.monsters(0)[0]?.uid);if(e.canNormal(m,0)){run(e,{type:'summon',uid:m.uid});note(card);}}
      else if(card.type==='monster'&&card.noNormal)assert.fail(card.officialName+' needs a sweep override for its summon');
      else if(card.type==='monster'&&e.canNormal(m,0)){run(e,{type:'summon',uid:m.uid});note(card);}
    }
    override.after?.(e,m);
    if(guardianEquip[card.officialName]&&zone()&&['monsters','extraMonster'].includes(zone()))castEquipAt(e,guardianEquip[card.officialName],m.uid);
    e.state.active=0;e.state.phase='main1';
    let guard=0;
    while(guard++<8&&e.state.winner===null){
      const mine=E.available(e,0,{kind:'main',phase:'main1'}).filter(o=>o.uid===m.uid);
      if(!mine.length)break;
      run(e,{type:'activate',uid:m.uid,key:mine[0].key});
      note(card);
    }
    battery(e,m);
    override.afterAll?.(e,m);
    if(card.type==='trap'&&zone()==='spells'&&!e.find(m.uid).card.faceUp){e.destroy(m.uid,{id:id('Mystical Space Typhoon'),owner:1,effectType:'spell'});e.pump();settle(e);}
    if(process.env.SWEEP_DEBUG&&!sawAction(e,card))console.log('SWEEP DEBUG',card.officialName,'zone:',e.find(m.uid)?.zone,'log:',e.state.log.slice(0,40).map(l=>l.kind+':'+(CARDS[l.cardId]?.officialName||'')+(l.key?'/'+l.key.split('::').pop():'')).join(' | '));
    assert.ok(sawAction(e,card),card.officialName+' never actually acted');
    note(card);
    e.assertState();
  });
}
function battery(e,c){
  const me=e.find(c.uid);
  const isMonster=()=>me&&['monsters','extraMonster'].includes(e.find(c.uid)?.zone);
  const pick1=(pred)=>e.monsters(1).find(pred);
  const blue=pick1(m=>m.id===id('Blue-Eyes White Dragon')),setBug=pick1(m=>!m.faceUp),weak=pick1(m=>m.faceUp&&e.attackValue(m)<=1000);
  const onField=x=>x&&['monsters','extraMonster'].includes(e.find(x.uid)?.zone);
  // My spare Normal Summon (summon windows, Pineapple Blast).
  const spare=e.state.players[0].hand.find(x=>CARDS[x.id].type==='monster'&&CARDS[x.id].level<=4&&!CARDS[x.id].noNormal&&x.uid!==c.uid);
  if(spare){e.state.active=0;e.state.phase='main1';step(e,{type:'summon',uid:spare.uid});}
  // Opponent spell battery: burn, single-target on my Amazoness / Gravekeeper / Zombie, spell destruction, draw, discard cost.
  e.state.active=1;e.state.phase='main1';
  const uidOf=(name)=>{const f=[...e.refs(1,['hand','spells'])].find(f=>f.card.id===id(name));return f?.card.uid;};
  const sparks=uidOf('Sparks');if(sparks)step(e,{type:'activate',uid:sparks,key:id('Sparks')+'::cast'});
  const moon=uidOf('Book of Moon');if(moon){const target=e.monsters(0).find(amazonessCard)||e.monsters(0).find(x=>gkCard(x))||e.monsters(0).find(x=>CARDS[x.id].race==='不死族')||e.monsters(0).find(x=>x.faceUp);if(target)step(e,{type:'activate',uid:moon,key:id('Book of Moon')+'::cast',choices:{target:[target.uid]}});}
  const mst=uidOf('Mystical Space Typhoon');if(mst){const target=e.spells(0)[0];if(target)step(e,{type:'activate',uid:mst,key:id('Mystical Space Typhoon')+'::cast',choices:{target:[target.uid]}});}
  const pot=uidOf('Pot of Greed');if(pot)step(e,{type:'activate',uid:pot,key:id('Pot of Greed')+'::cast'});
  const conf=uidOf('Confiscation');if(conf&&e.state.players[1].lp>1000&&e.state.players[0].hand.length)step(e,{type:'activate',uid:conf,key:id('Confiscation')+'::cast'});
  // My side attacks the weak face-up monster, then the face-down monster.
  e.state.active=0;e.state.phase='battle';
  const attacker=isMonster()&&weak&&e.canAttack(c,0,weak.uid)?c:e.monsters(0).find(x=>weak&&e.canAttack(x,0,weak.uid));
  if(attacker&&weak)step(e,{type:'attack',uid:attacker.uid,target:weak.uid});
  const attacker2=isMonster()&&setBug&&e.canAttack(c,0,setBug.uid)?c:e.monsters(0).find(x=>setBug&&e.canAttack(x,0,setBug.uid));
  if(attacker2&&setBug)step(e,{type:'attack',uid:attacker2.uid,target:setBug.uid});
  // Opponent Flip Summons the set monster (Hidden Soldiers, Adhesion Trap Hole).
  const foeSet=e.monsters(1).find(x=>!x.faceUp&&x.summonTurn<e.state.turn);
  if(foeSet){e.state.active=1;e.state.phase='main1';step(e,{type:'stance',uid:foeSet.uid});}


  // Opponent's strongest attacks my Toon, Amazoness, Gravekeeper, Zombie, swept monster or any monster.
  e.state.active=1;e.state.phase='battle';
  const victim=blue&&[isMonster()?c:null,e.monsters(0).find(x=>CARDS[x.id].toon),e.monsters(0).find(amazonessCard),e.monsters(0).find(x=>gkCard(x)),e.monsters(0).find(x=>CARDS[x.id].race==='不死族'),e.monsters(0)[0]].find(x=>onField(x)&&e.canAttack(blue,1,x.uid));
  if(blue&&victim)step(e,{type:'attack',uid:blue.uid,target:victim.uid});

  // Both players' Standby Phases (upkeep, counters, delayed effects).
  for(const owner of [0,1]){if(e.state.winner!==null)break;e.state.frame={kind:'standby',owner,stage:0,windowOffered:true};e.pump();settle(e);}
  // Second activation pass on the same turn (Rope of Life, Pineapple Blast, Wave-Motion Cannon, counter spenders, ...).
  e.state.active=0;e.state.phase='main1';
  if(process.env.SWEEP_DEBUG){const mineDefs=Object.keys(E.defs).filter(k=>k.startsWith(CARDS[c.id].id+'::'));for(const key of mineDefs){try{const ctx2=e.abilityContext(c.uid,key,'main',{owner:0});console.log('PROBE',CARDS[c.id].officialName,key.split('::').pop(),'canUse:',E.canUse(e,ctx2));}catch(err){console.log('PROBE',key,'THREW:',err.message);}}}
  if(process.env.SWEEP_DEBUG)console.log('SECOND PASS options:',E.available(e,0,{kind:'main',phase:'main1'}).map(o=>CARDS[o.cardId]?.officialName+':'+o.key.split('::').pop()).join(',')||'(none)','| swept:',E.available(e,0,{kind:'main',phase:'main1'}).some(o=>o.uid===c.uid));
  let guard=0;
  while(guard++<8&&e.state.winner===null){
    const mine=E.available(e,0,{kind:'main',phase:'main1'}).filter(o=>o.uid===c.uid);
    if(!mine.length)break;
    run(e,{type:'activate',uid:c.uid,key:mine[0].key});
    note(CARDS[c.id]);
  }
  // My End Phase (spirit returns, delayed destructions), then mass effect destruction.
  if(e.state.winner===null){e.state.frame={kind:'end',owner:0,stage:0,windowOffered:true};e.pump();settle(e);}
  if(e.state.winner===null){const raigeki=e.state.players[1].hand.find(x=>x.id===id('Raigeki'));if(raigeki){e.state.active=1;e.state.phase='main1';step(e,{type:'activate',uid:raigeki.uid,key:raigeki.id+'::cast'});}}
}
test('every 2002 card has a registered implementation',()=>{
  for(const c of CARDS2002){
    if(c.type==='monster'&&!c.effect&&!c.earlyRules)continue;
    const keys=Object.keys(E.defs).filter(k=>k.startsWith(c.id+'::'));
    assert.ok(keys.length||E.passives[c.id]||c.earlyRules!==undefined,c.officialName+' has no effect key, passive or rule registration');
  }
});
test('the sweep exercised every 2002 snapshot card at least once',()=>{
  assert.ok(exercised.size>=CARDS2002.length,'exercised '+exercised.size+' of '+CARDS2002.length);
  for(const c of CARDS2002)assert.ok(exercised.has(c.id),c.officialName+' was never exercised');
});
