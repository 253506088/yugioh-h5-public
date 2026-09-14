const test=require('node:test'),assert=require('node:assert/strict');
const {DuelEngine}=require('../src/advanced-engine.js');
const {D,E,put}=require('./yearly-sweep-helpers.cjs');
const id=name=>D.cardByName(name).id;
function fresh(active=0){const e=new DuelEngine({deck:'blue',opponentDeck:'dark',first:active,seed:91403});e.state.turn=6;e.state.phase='main1';e.state.active=active;for(const p of e.state.players){p.deck.push(...p.hand);p.hand=[];}return e;}
function act(e,a){const r=e.act(a);assert.equal(r.ok,true,JSON.stringify(a)+' / '+r.error);return r;}
function settle(e,pick){let steps=0;while(e.state.pending&&e.state.winner===null&&steps++<180){const p=e.state.pending;const a=pick?.(p,e)||(p.kind==='window'?{type:'pass'}:p.kind==='trigger'?{type:'respond',uid:p.trigger.uid,key:p.trigger.key}:e.chooseAI(p));act(e,a);}assert.ok(steps<180);e.assertState();}
function run(e,a,pick){act(e,a);settle(e,pick);}
function cast(e,m,choices={},pick){run(e,{type:'activate',uid:m.uid,key:m.id+'::cast',choices},pick);}
function end(e,pick){run(e,{type:'end'},pick);}
function donate(e,owner,name='Lava Golem',count=2){const m=put(e,owner,'hand',name),victims=Array.from({length:count},()=>put(e,1-owner,'monsters','Battle Ox'));
  run(e,{type:'activate',uid:m.uid,key:m.id+'::'+(name==='Lava Golem'?'special':'gift'),choices:name==='Lava Golem'?{target:victims.map(m=>m.uid)}:name==='Volcanic Queen'?{cost:victims.map(m=>m.uid)}:{}});return {m,victims};}

for(const summoner of [0,1]){
  test('Lava Golem burns the receiving controller, not summoner '+summoner,()=>{
    const e=fresh(summoner),receiver=1-summoner,{m}=donate(e,summoner);assert.equal(e.find(m.uid).owner,receiver);assert.equal(m.originalOwner,summoner);
    end(e);assert.equal(e.state.active,receiver);assert.equal(e.state.players[receiver].lp,7000);assert.equal(e.state.players[summoner].lp,8000);
    end(e);assert.equal(e.state.players[receiver].lp,7000);assert.equal(e.state.players[summoner].lp,8000);
    end(e);assert.equal(e.state.players[receiver].lp,6000);assert.equal(e.state.players[summoner].lp,8000);
  });
  test('an old Lava Golem save with golemOwner '+summoner+' resumes using current control',()=>{
    const e=fresh(summoner),receiver=1-summoner,{m}=donate(e,summoner);m.golemOwner=summoner;
    const restored=DuelEngine.restore(JSON.parse(JSON.stringify(e.snapshot())));end(restored);assert.equal(restored.state.players[receiver].lp,7000);assert.equal(restored.state.players[summoner].lp,8000);
    assert.ok(restored.takeControl(m.uid,summoner));end(restored);assert.equal(restored.state.players[summoner].lp,7000);assert.equal(restored.state.players[receiver].lp,7000);
  });
  for(const mode of ['face-down','negated','prevented'])test('Lava Golem damage respects '+mode+' for controller '+(1-summoner),()=>{
    const e=fresh(summoner),receiver=1-summoner,{m}=donate(e,summoner);
    if(mode==='face-down')e.setPosition(m.uid,'defense',null,true);else if(mode==='negated')put(e,summoner,'spells','Skill Drain');else put(e,receiver,'monsters','Des Wombat');
    end(e);end(e);assert.deepEqual(e.state.players.map(p=>p.lp),[8000,8000]);
  });
  test('Chain Energy charges the hand summoner '+summoner+' for Lava Golem',()=>{
    const e=fresh(summoner),receiver=1-summoner;put(e,receiver,'spells','Chain Energy');donate(e,summoner);
    assert.equal(e.state.players[summoner].lp,7500);assert.equal(e.state.players[receiver].lp,8000);end(e);assert.equal(e.state.players[receiver].lp,7000);assert.equal(e.state.players[summoner].lp,7500);
  });
  for(const [name,count] of [['Volcanic Queen',1],['Grinder Golem',0]])test('Chain Energy charges '+summoner+' once for '+name+' and no Token creation fees',()=>{
    const e=fresh(summoner);put(e,1-summoner,'spells','Chain Energy');donate(e,summoner,name,count);assert.equal(e.state.players[summoner].lp,7500);assert.equal(e.state.players[1-summoner].lp,8000);
  });
  test('Chain Energy does not require the receiving player to fund an opposing summon '+summoner,()=>{
    const e=fresh(summoner),receiver=1-summoner;put(e,receiver,'spells','Chain Energy');e.state.players[receiver].lp=400;const {m}=donate(e,summoner);assert.equal(e.find(m.uid).owner,receiver);assert.equal(e.state.players[summoner].lp,7500);assert.equal(e.state.players[receiver].lp,400);
  });
  test('unaffordable Lava Golem procedure cannot consume enemy tributes for player '+summoner,()=>{
    const e=fresh(summoner),receiver=1-summoner;put(e,receiver,'spells','Chain Energy');e.state.players[summoner].lp=400;const m=put(e,summoner,'hand','Lava Golem'),victims=[put(e,receiver,'monsters','Battle Ox'),put(e,receiver,'monsters','Battle Ox')],before=e.snapshot();
    const result=e.act({type:'activate',uid:m.uid,key:m.id+'::special',choices:{target:victims.map(m=>m.uid)}});assert.equal(result.ok,false);assert.deepEqual(e.snapshot(),before);
  });
  test('Lava Golem tributes are attributed to the summoning player '+summoner+' on a full enemy field',()=>{
    const e=fresh(summoner),receiver=1-summoner,m=put(e,summoner,'hand','Lava Golem'),victims=Array.from({length:5},()=>put(e,receiver,'monsters','Battle Ox')),events=[];
    const emit=e.emit;e.emit=function(v){if(v.type==='move'&&v.kind==='cost-tribute')events.push(v);return emit.call(this,v);};
    run(e,{type:'activate',uid:m.uid,key:m.id+'::special',choices:{target:victims.slice(0,2).map(m=>m.uid)}});assert.equal(e.find(m.uid).owner,receiver);assert.equal(e.monsters(receiver).length,4);assert.equal(events.length,2);assert.ok(events.every(v=>v.owner===receiver&&v.byOwner===summoner&&v.source.owner===summoner));
  });
}

test('Scapegoat under Chain Energy pays only for the Spell, not four synthetic hand Tokens',()=>{
  const e=fresh();put(e,1,'spells','Chain Energy');const s=put(e,0,'hand','Scapegoat');cast(e,s);assert.equal(e.monsters(0).length,4);assert.equal(e.state.players[0].lp,7500);assert.equal(e.state.players[1].lp,8000);
});

for(const controller of [0,1])for(const destination of ['grave','banished','not-destroyed'])test('Cursed Bill uses last controller '+controller+' and destruction reason ('+destination+')',()=>{
  const caster=1-controller,e=fresh(caster),m=put(e,caster,'monsters','Blue-Eyes White Dragon'),bill=put(e,caster,'hand','Cursed Bill');assert.ok(e.takeControl(m.uid,controller));cast(e,bill,{target:[m.uid]});e.modify(m.uid,'def','add',900,e.state.turn);
  if(destination==='banished')put(e,caster,'spells','Dimensional Fissure');
  if(destination==='not-destroyed'){e.move(m.uid,'grave',{kind:'effect-send',source:{owner:caster,id:id('Foolish Burial'),effectType:'spell'}});e.pump();settle(e);}
  else cast(e,put(e,caster,'hand','Raigeki'));
  assert.equal(e.find(m.uid).zone,destination==='banished'?'banished':'grave');assert.equal(e.find(bill.uid).zone,'grave');assert.equal(e.state.players[controller].lp,destination==='not-destroyed'?8000:5500);assert.equal(e.state.players[caster].lp,8000);
});

for(const summoner of [0,1]){
  for(const [name,count] of [['Lava Golem',2],['Volcanic Queen',1],['Grinder Golem',0]]){
    test(name+' locks Normal Summons and Sets for summoner '+summoner,()=>{
      const e=fresh(summoner);donate(e,summoner,name,count);
      const m=put(e,summoner,'hand','Battle Ox'),before=e.snapshot();
      for(const mode of ['attack','defense']){
        assert.equal(e.act({type:'summon',uid:m.uid,mode}).ok,false);
        assert.deepEqual(e.snapshot(),before);
      }
      assert.equal(e.state.players[summoner].normalSummonLockedTurn,e.state.turn);
      assert.notEqual(e.state.players[1-summoner].normalSummonLockedTurn,e.state.turn);
    });
    test(name+' charges stacked Chain Energy once to summoner '+summoner,()=>{
      const e=fresh(summoner);put(e,0,'spells','Chain Energy');put(e,1,'spells','Chain Energy');
      e.state.players[summoner].lp=1001;e.state.players[1-summoner].lp=400;
      donate(e,summoner,name,count);
      assert.equal(e.state.players[summoner].lp,1);assert.equal(e.state.players[1-summoner].lp,400);
    });
    test(name+' cannot start at exactly the Chain Energy fee for summoner '+summoner,()=>{
      const e=fresh(summoner);put(e,1-summoner,'spells','Chain Energy');e.state.players[summoner].lp=500;
      const m=put(e,summoner,'hand',name),victims=Array.from({length:count},()=>put(e,1-summoner,'monsters','Battle Ox')),before=e.snapshot();
      const choices=name==='Lava Golem'?{target:victims.map(m=>m.uid)}:{cost:victims.map(m=>m.uid)};
      assert.equal(e.act({type:'activate',uid:m.uid,key:m.id+'::'+(name==='Lava Golem'?'special':'gift'),choices}).ok,false);
      assert.deepEqual(e.snapshot(),before);
    });
  }
  test('ordinary Tribute costs cannot use an opponent monster for player '+summoner,()=>{
    const e=fresh(summoner),m=put(e,1-summoner,'monsters','Battle Ox');
    assert.throws(()=>e.move(m.uid,'grave',{kind:'cost-tribute',byOwner:summoner}),/不能作为解放代价/);
    assert.equal(e.find(m.uid).zone,'monsters');
  });
  for(const name of ['Lava Golem','Volcanic Queen'])test(name+' respects Mask of Restrict for player '+summoner,()=>{
    const e=fresh(summoner);put(e,1-summoner,'spells','Mask of Restrict');
    const m=put(e,summoner,'hand',name),victims=[put(e,1-summoner,'monsters','Battle Ox'),put(e,1-summoner,'monsters','Battle Ox')],before=e.snapshot();
    assert.equal(e.act({type:'activate',uid:m.uid,key:m.id+'::'+(name==='Lava Golem'?'special':'gift'),choices:name==='Lava Golem'?{target:victims.map(m=>m.uid)}:{cost:[victims[0].uid]}}).ok,false);
    assert.deepEqual(e.snapshot(),before);
  });
  test('Volcanic Queen end-phase damage follows controller '+(1-summoner),()=>{
    const e=fresh(summoner);donate(e,summoner,'Volcanic Queen',1);end(e);end(e);
    assert.equal(e.state.players[1-summoner].lp,7000);assert.equal(e.state.players[summoner].lp,8000);
  });
}

test('Cursed Bill captures original DEF before the monster loses its field effects',()=>{
  const e=fresh(),m=put(e,0,'monsters','Chimeratech Overdragon',{materialCount:3}),bill=put(e,0,'hand','Cursed Bill');
  assert.ok(e.takeControl(m.uid,1));cast(e,bill,{target:[m.uid]});assert.equal(e.originalDefense(m),2400);
  cast(e,put(e,0,'hand','Raigeki'));assert.equal(e.state.players[1].lp,5600);assert.equal(e.state.players[0].lp,8000);
});

test('Cursed Bill still damages a destroyed Token controller when the Token vanishes',()=>{
  const e=fresh(),m=e.createTokens(0,'early-slime-token',1)[0],bill=put(e,0,'hand','Cursed Bill');
  assert.ok(e.takeControl(m.uid,1));cast(e,bill,{target:[m.uid]});cast(e,put(e,0,'hand','Raigeki'));
  assert.equal(e.find(m.uid),null);assert.equal(e.state.players[1].lp,7500);assert.equal(e.state.players[0].lp,8000);
});

test('Cursed Bill must itself reach the Graveyard to inflict damage',()=>{
  const e=fresh(),m=put(e,1,'monsters','Blue-Eyes White Dragon'),bill=put(e,0,'hand','Cursed Bill');
  cast(e,bill,{target:[m.uid]});put(e,0,'spells','Macro Cosmos');cast(e,put(e,0,'hand','Raigeki'));
  assert.equal(e.find(bill.uid).zone,'banished');assert.deepEqual(e.state.players.map(p=>p.lp),[8000,8000]);
});

test('Cursed Bill does not damage after its Equip Card is destroyed first',()=>{
  const e=fresh(),m=put(e,1,'monsters','Blue-Eyes White Dragon'),bill=put(e,0,'hand','Cursed Bill');
  cast(e,bill,{target:[m.uid]});e.destroy(bill.uid);e.pump();settle(e);cast(e,put(e,0,'hand','Raigeki'));
  assert.deepEqual(e.state.players.map(p=>p.lp),[8000,8000]);
});

// These cards explicitly name the last field controller as the damage recipient.
// Graveyard effects that instead say "you" retain their own activation controller.
const leaveDamage=[
  ['Destructive Draw','spells',3000,{}],
  ['Brain Research Lab','fieldSpell',2000,{eraCounters:2}],
  ['Zombie Mammoth','monsters',1900,{}],
  ['Storm Caller','monsters',2300,{}],
  ['Red Duston','monsters',500,{}],
  ['Giant Kozaky','monsters',2500,{}]
];
for(const controller of [0,1]){
  for(const [name,zone,amount,props] of leaveDamage)for(const banish of [false,true]){
    test(name+' damages last controller '+controller+' after '+(banish?'banishment':'going to its owner’s Graveyard'),()=>{
      const owner=1-controller,e=fresh(owner);
      if(banish)put(e,controller,'spells','Macro Cosmos');
      const m=put(e,zone==='monsters'?owner:controller,zone,name,{...props,originalOwner:owner});
      if(zone==='monsters')assert.ok(e.takeControl(m.uid,controller));
      assert.ok(e.destroy(m.uid,{id:id('Raigeki'),owner,effectType:'spell'}));e.pump();settle(e);
      assert.equal(e.find(m.uid).owner,owner);assert.equal(e.find(m.uid).zone,banish?'banished':'grave');
      assert.equal(e.state.players[controller].lp,8000-amount);assert.equal(e.state.players[owner].lp,8000);
    });
  }
  test('Vice Berserker damages the Synchro Summoning player '+controller+' after changing control',()=>{
    const owner=1-controller,e=fresh(controller),m=put(e,owner,'monsters','Vice Berserker');assert.ok(e.takeControl(m.uid,controller));
    const tuner=put(e,controller,'monsters','Krebons'),synchro=put(e,controller,'extra','Gaia Knight, the Force of Earth');
    run(e,{type:'extra-summon',uid:synchro.uid,materials:[m.uid,tuner.uid]});
    assert.equal(e.find(m.uid).owner,owner);assert.equal(e.state.players[controller].lp,6000);assert.equal(e.state.players[owner].lp,8000);
    assert.equal(e.attackValue(synchro),4600);
  });
  test('Granadora Graveyard damage still belongs to the Graveyard effect controller '+controller,()=>{
    const e=fresh(),m=put(e,controller,'monsters','Granadora');assert.ok(e.takeControl(m.uid,1-controller));
    e.destroy(m.uid);e.pump();settle(e);assert.equal(e.state.players[controller].lp,6000);assert.equal(e.state.players[1-controller].lp,8000);
  });
  test('Mushroom Man #2 standby damage follows controller '+controller,()=>{
    const e=fresh(),m=put(e,1-controller,'monsters','Mushroom Man #2');assert.ok(e.takeControl(m.uid,controller));
    e.emit({type:'standby',owner:controller});e.pump();settle(e);
    assert.equal(e.state.players[controller].lp,7700);assert.equal(e.state.players[1-controller].lp,8000);
  });
  test('X-Saber Pashuul damages controller '+controller+' only in the opponent’s Standby Phase',()=>{
    const e=fresh(),m=put(e,1-controller,'monsters','X-Saber Pashuul',{position:'defense'});assert.ok(e.takeControl(m.uid,controller));
    e.emit({type:'standby',owner:controller});e.pump();settle(e);assert.deepEqual(e.state.players.map(p=>p.lp),[8000,8000]);
    e.emit({type:'standby',owner:1-controller});e.pump();settle(e);
    assert.equal(e.state.players[controller].lp,7000);assert.equal(e.state.players[1-controller].lp,8000);
  });
  test('Archfiend upkeep charges controller '+controller+' and remains a cost under Des Wombat',()=>{
    const e=fresh(),m=put(e,1-controller,'monsters','Terrorking Archfiend');assert.ok(e.takeControl(m.uid,controller));put(e,controller,'monsters','Des Wombat');
    e.emit({type:'standby',owner:controller});e.pump();settle(e);
    assert.equal(e.state.players[controller].lp,7200);assert.equal(e.state.players[1-controller].lp,8000);
  });
  test('Toll charges attacking controller '+controller+' after a control change',()=>{
    const e=fresh(controller),m=put(e,1-controller,'monsters','Battle Ox');assert.ok(e.takeControl(m.uid,controller));put(e,1-controller,'spells','Toll');
    e.state.phase='battle';run(e,{type:'attack',uid:m.uid});
    assert.equal(e.state.players[controller].lp,7500);assert.equal(e.state.players[1-controller].lp,6300);
  });
}

test('Red Duston destroyed in the hand does not cause field-controller damage',()=>{
  const e=fresh(),m=put(e,0,'hand','Red Duston');e.destroy(m.uid);e.pump();settle(e);
  assert.deepEqual(e.state.players.map(p=>p.lp),[8000,8000]);
});

test('Vice Berserker banished as Synchro Material does not activate its Graveyard effect',()=>{
  const e=fresh(),m=put(e,0,'monsters','Vice Berserker'),tuner=put(e,0,'monsters','Krebons'),synchro=put(e,0,'extra','Gaia Knight, the Force of Earth');put(e,1,'spells','Macro Cosmos');
  run(e,{type:'extra-summon',uid:synchro.uid,materials:[m.uid,tuner.uid]});
  assert.equal(e.find(m.uid).zone,'banished');assert.deepEqual(e.state.players.map(p=>p.lp),[8000,8000]);assert.equal(e.attackValue(synchro),2600);
});

for(const controller of [0,1]){
  for(const [token,amount] of [['gx-ivy-token',300],['gx-nightmare-token',800]])for(const reason of ['destroy','battle','cost-tribute']){
    test(token+' damage follows last controller '+controller+' for '+reason,()=>{
      const e=fresh(),m=e.createTokens(1-controller,token,1)[0];assert.ok(e.takeControl(m.uid,controller));
      if(reason==='cost-tribute')e.move(m.uid,'grave',{kind:reason,byOwner:controller});
      else e.destroy(m.uid,{id:id('Raigeki'),owner:1-controller,effectType:reason==='battle'?'battle':'spell'},reason==='battle');
      e.pump();settle(e);assert.equal(e.find(m.uid),null);
      assert.equal(e.state.players[controller].lp,8000-(reason==='cost-tribute'?0:amount));assert.equal(e.state.players[1-controller].lp,8000);
    });
  }
  test('Core Reinforcement damages Trap controller '+controller+' during its own End Phase',()=>{
    const e=fresh(controller),m=put(e,controller,'grave',"Koa'ki Meiru Guardian"),trap=put(e,controller,'spells','Core Reinforcement',{faceUp:false,originalOwner:1-controller});
    cast(e,trap,{target:[m.uid]});e.modify(m.uid,'atk','add',500,e.state.turn);end(e);
    assert.equal(e.find(m.uid).zone,'grave');assert.equal(e.find(trap.uid).zone,'grave');assert.equal(e.find(trap.uid).owner,1-controller);
    assert.equal(e.state.players[controller].lp,5600);assert.equal(e.state.players[1-controller].lp,8000);
  });
  for(const mode of ['target-controlled-by-opponent','opponent-end','negated'])test('Core Reinforcement handles '+mode+' for Trap controller '+controller,()=>{
    const e=fresh(controller),m=put(e,controller,'grave',"Koa'ki Meiru Guardian"),trap=put(e,controller,'spells','Core Reinforcement',{faceUp:false,originalOwner:1-controller});
    cast(e,trap,{target:[m.uid]});
    if(mode==='target-controlled-by-opponent')assert.ok(e.takeControl(m.uid,1-controller));
    if(mode==='negated')put(e,1-controller,'spells','Royal Decree');
    e.state.active=mode==='opponent-end'?1-controller:controller;e.state.frame={kind:'end',owner:e.state.active,stage:1,windowOffered:true};e.destroy(m.uid);e.pump();settle(e);
    assert.equal(e.state.players[controller].lp,mode==='target-controlled-by-opponent'?6100:8000);assert.equal(e.state.players[1-controller].lp,8000);
  });
}
