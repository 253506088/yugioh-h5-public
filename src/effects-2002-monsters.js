/* 2002 OCG monsters: effects, FLIPs, Unions, Toons, Spirits, Guardians, fusions, rituals. */
(function(root){
 'use strict';
 const X=root.Duel2002,{E,D,H,C,I,is,mark,A,Q,R,passive,allM,allS,allF,monster,face,ownM,foeM,exact,moved,destroy,choose,g,target,drawDiscard,randomDiscard,pay,once,declare,declared,onEntry,onFlip,onMove,onStandby,onDamage,onBattleWin,src,active,ctx,GYbattle,GYfield,discardCost,tributeInput,tribute,burn,races,attrs,first,args,self,hand,deck,grave,P,extend,rule,gk,amazoness,union,vwxyzNames}=X,{CARDS}=D;
 const rules=(name,values={},note)=>rule(name,values,note);
 const statSelf=(name,fn,note)=>passive(name,{stat:(e,s,m,k)=>s.card.uid===m.uid?fn(e,s,m,k):0},note);
 const battleBonus=(name,fn)=>passive(name,{battleStat:(e,s,m,k,a)=>s.card.uid===m.uid?fn(e,s,m,k,a):0});
 const flipDown=(name)=>A(name,'flip-down',{label:'变回里侧守备表示',once:{key:'flip-2002',scope:'card'},condition:(e,c)=>H.mainPhase(e)&&c.owner===e.state.active&&!!self(e,c),resolve:(e,c)=>{if(self(e,c))e.setPosition(c.uid,'defense',c.source,true);},aiScore:40});
 const wasFlipped=(v,uid)=>v.attack?.flippedTarget?.uid===uid;
 // ---- Simple battle and stat rules ---------------------------------------------------
 for(const name of ['Servant of Catabolism','Mucus Yolk'])rules(name,{direct:true});
 rules('Gyaku-Gire Panda',{piercing:true});
 statSelf('Gyaku-Gire Panda',(e,s)=>foeM(e,s).length*500);
 rules('Gravekeeper\'s Spear Soldier',{piercing:true});
 statSelf('Arsenal Bug',(e,s,m,k)=>e.monsters(s.owner).some(x=>x.faceUp&&x.uid!==m.uid&&e.race(x)==='昆虫族')?0:(k==='atk'?1000-(CARDS[m.id].atk||0):1000-(CARDS[m.id].def||0)),'场上没有其他昆虫族时攻守变为1000');
 onStandby('Legendary Fiend',{condition:(e,c)=>!!self(e,c),resolve:(e,c)=>{if(self(e,c))e.modify(c.uid,'atk','add',700,null,c.source);}},{optional:false});
 statSelf('Amazoness Tiger',(e,s,m,k)=>k==='atk'?e.monsters(s.owner).filter(x=>amazoness(x)).length*400:0);C('Amazoness Tiger').uniqueFaceUp=true;
 statSelf('Amazoness Paladin',(e,s,m,k)=>k==='atk'?e.monsters(s.owner).filter(x=>amazoness(x)).length*100:0);
 statSelf('Blade Knight',(e,s,m,k)=>k==='atk'&&hand(e,s.owner).length<=1?400:0);
 rules('Blade Knight',{negateBattleVictim:true},'自己没有其他怪兽时，被它战斗破坏的反转怪兽效果无效（本作不区分条件）');
 statSelf('Dragon Master Knight',(e,s,m,k)=>k==='atk'?e.monsters(s.owner).filter(x=>x.faceUp&&e.race(x)==='龙族'&&x.uid!==m.uid).length*500:0);
 passive('Dark Paladin',{stat:(e,s,m,k)=>k==='atk'&&s.card.uid===m.uid?[...allM(e).filter(x=>x.faceUp&&e.race(x)==='龙族'&&x.uid!==m.uid),...grave(e,0),...grave(e,1)].filter(x=>e.race(x)==='龙族').length*500:0});
 onStandby('Mucus Yolk',{condition:(e,c)=>self(e,c)?.mucusPending,resolve:(e,c)=>{const m=self(e,c);if(m){e.modify(c.uid,'atk','add',1000,null,c.source);delete m.mucusPending;}}},{optional:false});
 rules('Different Dimension Dragon',{nonTargetImmune:true},'不会不被指定的魔法陷阱效果破坏；不会被攻击力1900以下的怪兽战斗破坏');
 passive('Different Dimension Dragon',{protect:(e,s,m,battle,source)=>{if(battle&&s.card.uid===m.uid){const atk=e.attackValue(e.find(source?.uid)?.card||{});if(atk<=1900)return true;}return false;}});
 rules('Five-Headed Dragon',{battleAttributeImmune:['暗','地','水','炎','风']},'不会被暗地水炎风属性的怪兽战斗破坏');
 rules('Kaiser Glider',{sameAttackImmune:true},'不会和相同攻击力的怪兽相互战斗破坏');
 onMove('Kaiser Glider','bounce',{inputs:target('选择返回手牌的怪兽',e=>allM(e).filter(face),'bounce'),resolve:(e,c)=>moved(e,c,args(c),'hand','effect-return')},(e,v)=>GYfield(v));
 passive('Spirit Reaper',{protect:(e,s,m,battle)=>battle&&s.card.uid===m.uid});
 onDamage('Spirit Reaper',{condition:(e,c)=>!c.event.attack?.target,resolve:(e,c)=>randomDiscard(e,1-c.owner,1,c.source)});
 rules('Blindly Loyal Goblin',{controlLocked:true});
 passive('Maju Garzett',{originalAttack:(e,m)=>m.majuAttack||0});mark('Maju Garzett','上级召唤时攻击力变为解放怪兽原本攻击力的合计');
 // Targeting resolution destroys Spirit Reaper and its fusion counterpart.
 extend('runTask',function(prior,task){
  if(task.op==='finish-link'&&task.applied){
   const link=task.link,targets=Object.values(link.targetMeta||{}).flatMap(x=>Object.keys(x)).map(uid=>this.find(uid)).filter(f=>f&&H.fieldZone(f.zone));
   for(const f of targets){
    if((is(f.card,'Spirit Reaper')||is(f.card,'Reaper on the Nightmare'))&&f.card.faceUp&&!this.negated(f.card))this.destroy(f.card.uid,{id:f.card.id,uid:f.card.uid,owner:f.owner,effectType:'monster'});
   }
  }
  return prior.call(this,task);
 });
 // ---- Damage-step triggers ------------------------------------------------------------
 R('Sasuke Samurai','before-damage',{zones:['monsters','extraMonster','grave','banished'],damageStep:true,destroys:true,resolve:(e,c)=>{const a=e.state.frame?.attack;if(a){a.cancelDamage=true;delete a.flippedTarget;destroy(e,c,[a.target]);}}});
 E.on('damage-start',(e,v)=>{const a=v.attack,f=a&&e.find(a.target);if(f&&is(f.card,'Sasuke Samurai')&&a.uid!==a.target&&wasFlipped(v,a.target))e.addTrigger(f.card.uid,f.card.id+'::before-damage',v,{owner:f.owner});});
 R('Paladin of White Dragon','before-damage',{zones:['monsters','extraMonster','grave','banished'],damageStep:true,destroys:true,resolve:(e,c)=>{const a=e.state.frame?.attack;if(a){a.cancelDamage=true;delete a.flippedTarget;destroy(e,c,[a.target]);}}});
 E.on('damage-start',(e,v)=>{const a=v.attack,f=a&&e.find(a.target);if(f&&is(f.card,'Paladin of White Dragon')&&a.uid!==a.target&&wasFlipped(v,a.target))e.addTrigger(f.card.uid,f.card.id+'::before-damage',v,{owner:f.owner});});
 R('Reflect Bounder','before-damage',{zones:['monsters','extraMonster','grave','banished'],damageStep:true,resolve:(e,c)=>{const a=e.state.frame?.attack,att=a&&e.find(a.uid)?.card;if(att&&a){burn(e,c,e.attackValue(att,a));a.cancelDamage=true;if(e.find(c.uid))e.destroy(c.uid,c.source);}}});
 E.on('damage-start',(e,v)=>{const a=v.attack,f=a&&e.find(a.target);if(f&&is(f.card,'Reflect Bounder')&&f.card.position==='attack'&&!wasFlipped(v,f.card.uid))e.addTrigger(f.card.uid,f.card.id+'::before-damage',v,{owner:f.owner});});
 battleBonus('8-Claws Scorpion',(e,s,m,k,a)=>k==='atk'&&a?.uid===m.uid&&wasFlipped({attack:a},a.target)?2400-(CARDS[m.id].atk||0):0);
 E.on('damage-end',(e,v)=>{
  const a=v.attack;if(!a||e.state.winner!==null)return;
  const af=e.find(a.uid),df=a.target?e.find(a.target):null;
  if(af&&df){
   const atk=e.attackValue(af.card,a),def=e.defenseValue(df.card,a);
   if(is(df.card,'Thousand Needles')&&df.card.position==='defense'&&def>atk)e.destroy(a.uid,{id:df.card.id,uid:df.card.uid,owner:df.owner,effectType:'monster'},true);
   if(is(df.card,'Giant Axe Mummy')&&wasFlipped(v,a.target)&&def>atk)e.destroy(a.uid,{id:df.card.id,uid:df.card.uid,owner:df.owner,effectType:'monster'},true);
   if(is(df.card,'D.D. Warrior Lady')||is(af.card,'D.D. Warrior Lady')){for(const f of [af,df])if(is(f.card,'D.D. Warrior Lady'))e.addTrigger(f.card.uid,f.card.id+'::banish',v,{owner:f.owner});}
  }
 });
 R('D.D. Warrior Lady','banish',{zones:['monsters','extraMonster','grave','banished'],resolve:(e,c)=>{const a=c.event.attack,other=a.uid===c.uid?a.target:a.uid;for(const uid of [other,c.uid])if(e.find(uid))e.move(uid,'banished',{kind:'effect-banish',source:c.source,byOwner:c.owner});}});
 passive('Cat\'s Ear Tribe',{battleStat:(e,s,m,k,a)=>{if(k!=='atk'||!a||a.uid!==m.uid)return 0;const cat=e.find(a.target)?.card;return cat&&is(cat,'Cat\'s Ear Tribe')&&e.state.active!==s.owner?200-e.originalAttack(m):0;}});
 // ---- Battle-win and battle-damage effects -------------------------------------------
 E.on('battle-win',(e,v)=>{
  const winner=e.find(v.uid)?.card;
  if(!winner||v.victimDestination!=='grave')return;
  const owner=e.find(v.uid).owner;
  if(is(winner,'Timeater'))e.state.players[1-owner].skipMain1Turn=e.state.turn+1;
  if(is(winner,'Winged Sage Falcos')&&v.attack){const f=e.find(v.victim.uid);if(f&&f.card.position==='attack'&&f.owner!==owner)e.putOnDeck(v.victim.uid,'top',src(e,winner));}
  if(is(winner,'Mystical Knight of Jackal'))e.putOnDeck(v.victim.uid,'top',src(e,winner));
  if(is(winner,'D.D. Crazy Beast')&&e.find(v.victim.uid)?.zone==='grave')e.move(v.victim.uid,'banished',{kind:'effect-banish',source:src(e,winner)});
  if(is(winner,'Guardian Baou'))e.modify(v.uid,'atk','add',1000,null,src(e,winner));
  if(is(winner,'Helping Robo for Combat')){e.draw(owner,1);const list=hand(e,owner);if(list.length)e.queueChoice(owner,'选择放回卡组底的手牌',H.options(e,ctx(e,winner),list),1,1,'early-move',{source:src(e,winner),to:'deck',kind:'effect-return',role:'cost'});}
  if(is(winner,'Great Dezard'))winner.dezardKills=(winner.dezardKills||0)+1;
  if(is(winner,'Vampiric Orchis'))for(const eq of e.activeEquip(winner))if(is(eq,'Des Dendle')&&e.freeMain(owner)>0)e.createTokens(owner,'2002-wicked-plant-token',1);
  if(is(winner,'Decayed Commander'))for(const eq of e.activeEquip(winner))if(is(eq,'Zombie Tiger'))randomDiscard(e,1-owner,1,src(e,winner));
  if(is(winner,'Mystical Beast of Serket')){const f=e.find(v.victim.uid);if(f?.zone==='grave')e.move(v.victim.uid,'banished',{kind:'effect-banish',source:src(e,winner)});e.modify(v.uid,'atk','add',500,null,src(e,winner));}
 });
 E.on('damage',(e,v)=>{
  if(!v.battle||!v.attack||e.state.winner!==null)return;
  const attacker=e.find(v.attack.uid)?.card;
  const dealer=v.owner===v.attack.owner?attacker:e.find(v.attack.target)?.card;
  if(!dealer)return;
  const owner=e.find(dealer.uid).owner;
  if(is(dealer,'Mucus Yolk'))dealer.mucusPending=true;
  if(is(dealer,'Toon Masked Sorcerer'))e.draw(owner,1);
  if(is(dealer,'Toon Gemini Elf'))randomDiscard(e,1-owner,1,src(e,dealer));
 });
 E.on('damage-end',(e,v)=>{const a=v.attack;if(!a)return;const df=a.target&&e.find(a.target),af=e.find(a.uid);if(af&&df&&is(af.card,'Shinato, King of a Higher Plane')&&df.card.position==='defense'){const victim=e.find(a.target);if(victim?.zone==='grave')e.damage(df.owner,e.originalAttack(victim.card),'效果');}});
 // ---- Destroyed-by-battle and hand/deck displacement triggers --------------------------
 onMove('Newdoria','destroy',{destroys:true,inputs:target('选择破坏的怪兽',e=>allM(e)),resolve:(e,c)=>destroy(e,c,args(c))},(e,v)=>GYbattle(v));
 onMove('Yomi Ship','destroy',{destroys:true,resolve:(e,c)=>{const uid=c.event.source?.uid;if(uid&&e.find(uid))destroy(e,c,[uid]);}},(e,v)=>GYbattle(v));
 onMove('Kryuel','coin',{destroys:true,resolve:(e,c)=>{const win=e.random()<.5;e.log('effect','抛硬币：'+(win?'正面':'反面'),c.owner);if(win){const list=foeM(e,c);if(list.length)choose(e,c,'选择破坏的对方怪兽',list,1,1,'destroy-selected',{role:'destroy'});}}},(e,v)=>GYbattle(v));
 onMove('Birdface','search',{inputs:target('选择加入手牌的鹰身女妖',(e,c)=>deck(e,c.owner,m=>is(m,'Harpie Lady')||CARDS[m.id].nameAlias==='Harpie Lady'),'search'),resolve:(e,c)=>{if(e.find(first(c))?.zone==='deck')e.search(c.owner,args(c));}},(e,v)=>GYbattle(v));
 onMove('Pyramid Turtle','recruit',{summons:true,resolve:(e,c)=>choose(e,c,'选择守备力2000以下的不死族',H.specialable(e,c.owner,deck(e,c.owner,m=>monster(m)&&e.race(m)==='不死族'&&CARDS[m.id].def<=2000)),1,1,'early-special',{shuffle:true,role:'special'})},(e,v)=>GYbattle(v));
 for(const name of ['Fear from the Dark','Despair from the Dark'])onMove(name,'revive',{summons:true,condition:(e,c)=>e.freeMain(c.owner)>0&&e.canSpecial(c.owner,H.source(e,c).card,{via:'revive'}),resolve:(e,c)=>{const f=e.find(c.uid);if(f?.zone==='grave'&&e.canSpecial(c.owner,f.card,{via:'revive'}))e.special(c.owner,c.uid,{via:'revive'});}},(e,v)=>['hand','deck'].includes(v.from)&&v.to==='grave'&&v.byEffect&&v.byOwner!==v.owner);
 onMove('Pixie Knight','return-top',{condition:(e,c)=>grave(e,c.owner,m=>CARDS[m.id].type==='spell').length>0,resolve:(e,c)=>{const list=grave(e,c.owner,m=>CARDS[m.id].type==='spell');if(list.length)e.queueChoice(1-c.owner,'选择放回对方卡组顶的魔法',H.options(e,{...c,owner:1-c.owner},list),1,1,'early-move',{source:c.source,to:'deck',kind:'effect-return',role:'search'});}},(e,v)=>GYbattle(v));
 onMove('Neko Mane King','end-turn',{resolve:(e,c)=>{e.log('phase','猫王效果：直接进入结束阶段',c.owner);e.endTurn();}},(e,v)=>v.to==='grave'&&v.byEffect&&v.byOwner!==v.owner&&e.state.active!==v.owner);
 onMove('Apprentice Magician','recruit',{summons:true,resolve:(e,c)=>choose(e,c,'里侧守备特殊召唤2星以下魔法师族',H.specialable(e,c.owner,deck(e,c.owner,m=>monster(m)&&e.race(m)==='魔法师族'&&e.level(m)<=2)),1,1,'early-special',{faceDown:true,position:'defense',shuffle:true,role:'special'})},(e,v)=>GYbattle(v));
 onMove('Dark Flare Knight','summon-mirage',{summons:true,resolve:(e,c)=>choose(e,c,'特殊召唤幻影骑士',H.specialable(e,c.owner,H.cards(e,c.owner,['hand','deck'],m=>is(m,'Mirage Knight')),'dark-flare'),1,1,'early-special',{via:'dark-flare',shuffle:true,role:'special'})},(e,v)=>GYbattle(v));
 onMove('Guardian Tryce','revive',{summons:true,resolve:(e,c)=>{const ids=(c.event.previous?.materials||[]).map(m=>m.id);const pool=grave(e,c.owner,m=>ids.includes(m.id));if(pool.length)choose(e,c,'选择复活的解放素材',H.specialable(e,c.owner,pool,'revive'),1,1,'early-special',{via:'revive',role:'special'});}},(e,v)=>['destroy','battle'].includes(v.kind)&&v.previous?.materials?.length);
 E.on('battle-end',(e,v)=>{for(const owner of [0,1])for(const m of grave(e,owner))if(is(m,'Helpoemer')&&m.earlySent?.kind==='battle'&&v.owner!==owner&&hand(e,v.owner).length)randomDiscard(e,v.owner,1,src(e,m));});
 rules('Helpoemer',{noGraveSpecial:true});
 extend('changePhase',function(prior,phase){const p=this.state.players[this.state.active];if(phase==='main1'&&p.skipMain1Turn===this.state.turn){p.skipMain1Turn=null;this.log('phase','跳过主要阶段1',this.state.active);return prior.call(this,this.state.turn===1?'main2':'battle');}return prior.call(this,phase);});
 // ---- On-summon effects -----------------------------------------------------------------
 E.on('summon',(e,v)=>{
  if(e.state.winner!==null)return;
  const f=e.find(v.uid);
  if(!f||!H.fieldZone(f.zone))return;
  const m=f.card;
  if(e.hasEarly('King Tiger Wanghu')&&CARDS[m.id].type!=='token'&&e.attackValue(m)<=1400&&v.kind!=='flip'&&v.kind!=='set')e.queue({op:'2002-wanghu',owner:f.owner,context:{uid:m.uid}});
  if(is(m,'Armor Exe')){m.cannotAttackUntil=e.state.turn;}
  if(is(m,'Viser Des')&&v.kind==='normal')e.addTrigger(m.uid,m.id+'::delay-destroy',v,{owner:f.owner});
 });
 E.op('2002-wanghu',(e,t)=>{const srcCard=[...e.monsters(0),...e.monsters(1)].find(x=>is(x,'King Tiger Wanghu')&&x.faceUp);const f=e.find(t.context.uid);if(f&&H.fieldZone(f.zone)&&e.attackValue(f.card)<=1400&&srcCard&&!e.negated(srcCard))e.destroy(f.card.uid,{id:srcCard.id,uid:srcCard.uid,owner:e.find(srcCard.uid).owner,effectType:'monster'});});
 R('Viser Des','delay-destroy',{zones:['monsters','extraMonster','grave','banished'],inputs:target('选择延迟破坏的对方怪兽',foeM),resolve:(e,c)=>{const m=self(e,c)||e.find(c.uid)?.card;if(m){m.viserTarget=first(c);m.viserCount=0;}}});
 passive('Viser Des',{protect:(e,s,m,battle)=>{const t=e.find(s.card.viserTarget);return battle&&s.card.uid===m.uid&&!!t&&H.fieldZone(t.zone);}});
 E.on('standby',(e,v)=>{for(const owner of [0,1])for(const f of e.refs(owner,['monsters','extraMonster'])){const m=f.card;if(is(m,'Viser Des')&&m.viserTarget&&v.owner===owner){m.viserCount=(m.viserCount||0)+1;if(m.viserCount>=3){const t=e.find(m.viserTarget);delete m.viserTarget;if(t&&H.fieldZone(t.zone))e.destroy(t.card.uid,src(e,m));}}}});
 onEntry('Gravekeeper\'s Curse','burn',{resolve:(e,c)=>burn(e,c,500)});
 onEntry('Dark Jeroid','weaken',{inputs:target('选择攻击力下降的表侧怪兽',e=>allM(e).filter(face),'destroy'),resolve:(e,c)=>{const m=e.find(first(c))?.card;if(m)e.modify(m.uid,'atk','add',-800,null,c.source);}},['*']);
 onEntry('Byser Shock','bounce',{condition:(e,c)=>allF(e).some(m=>!m.faceUp),resolve:(e,c)=>moved(e,c,allF(e).filter(m=>!m.faceUp).map(m=>m.uid),'hand','effect-return')},['*']);
 onEntry('King\'s Knight','special',{summons:true,condition:(e,c)=>ownM(e,c).some(m=>is(m,'Queen\'s Knight')),resolve:(e,c)=>choose(e,c,'特殊召唤杰克骑士',H.specialable(e,c.owner,deck(e,c.owner,m=>is(m,'Jack\'s Knight'))),1,1,'early-special',{shuffle:true,role:'special'})},['normal']);
 onEntry('Vampiric Orchis','special',{summons:true,resolve:(e,c)=>choose(e,c,'可以特殊召唤兰花魔棘',H.specialable(e,c.owner,hand(e,c.owner,m=>is(m,'Des Dendle'))),0,1,'early-special',{role:'special'})},['normal']);
 onEntry('Decayed Commander','special',{summons:true,resolve:(e,c)=>choose(e,c,'可以特殊召唤僵尸虎',H.specialable(e,c.owner,hand(e,c.owner,m=>is(m,'Zombie Tiger'))),0,1,'early-special',{role:'special'})},['normal']);
 onDamage('Decayed Commander',{condition:(e,c)=>!c.event.attack?.target,resolve:(e,c)=>randomDiscard(e,1-c.owner,1,c.source)});
 onEntry('Apprentice Magician','counter',{inputs:target('选择放置魔力指示物的表侧卡',e=>[...allM(e),...allS(e)].filter(m=>m.faceUp&&CARDS[m.id].counterable),'search'),resolve:(e,c)=>{const m=e.find(first(c))?.card;if(m)m.counters=(m.counters||0)+1;}},['*']);
 onEntry('Moisture Creature','wipe',{destroys:true,condition:(e,c)=>c.event.materials?.length===3,resolve:(e,c)=>destroy(e,c,e.spells(1-c.owner).map(m=>m.uid))},['normal']);C('Moisture Creature').optionalThreeTributes=true;
 onEntry('Puppet Master','revive',{summons:true,condition:(e,c)=>e.state.players[c.owner].lp>2000,inputs:(e,c)=>[g(e,c,'target','选择复活的2只恶魔族',H.specialable(e,c.owner,grave(e,c.owner,m=>monster(m)&&e.race(m)==='恶魔族'),'revive'),2,2,'special')],cost:(e,c)=>pay(e,c,2000),resolve:(e,c)=>{for(const uid of args(c)){const f=e.find(uid);if(f?.zone==='grave'&&e.canSpecial(c.owner,f.card,{via:'revive'})){const m=e.special(c.owner,uid,{via:'revive'});if(m)m.cannotAttackUntil=e.state.turn;}}}},['normal']);
 onEntry('Dark Dust Spirit','wipe',{destroys:true,resolve:(e,c)=>destroy(e,c,allM(e).filter(m=>m.uid!==c.uid).map(m=>m.uid))},['normal']);
 onFlip('Dark Dust Spirit',{destroys:true,resolve:(e,c)=>destroy(e,c,allM(e).filter(m=>m.uid!==c.uid).map(m=>m.uid))});
 mark('Dark Dust Spirit','通常召唤或翻开时破坏其他全部表侧怪兽；结束阶段回到手牌');
 // ---- Flip-down monsters ------------------------------------------------------------------
 flipDown('Des Lacooda');onEntry('Des Lacooda','draw',{resolve:(e,c)=>e.draw(c.owner,1)},['flip']);
 flipDown('Swarm of Scarabs');onEntry('Swarm of Scarabs','destroy',{destroys:true,inputs:target('选择破坏的对方怪兽',foeM),resolve:(e,c)=>destroy(e,c,args(c))},['flip']);
 flipDown('Swarm of Locusts');onEntry('Swarm of Locusts','destroy',{destroys:true,inputs:target('选择破坏的对方魔陷',(e,c)=>e.spells(1-c.owner)),resolve:(e,c)=>destroy(e,c,args(c))},['flip']);
 flipDown('Guardian Sphinx');onEntry('Guardian Sphinx','bounce',{condition:(e,c)=>foeM(e,c).length>0,resolve:(e,c)=>moved(e,c,foeM(e,c).map(m=>m.uid),'hand','effect-return')},['flip']);
 flipDown('Royal Keeper');onFlip('Royal Keeper',{resolve:(e,c)=>{if(self(e,c))e.modify(c.uid,'both','add',300,e.state.turn,c.source);}});
 flipDown('Wandering Mummy');mark('Wandering Mummy','每回合可变回里侧守备；重排自己里侧怪兽位置在本作以变回里侧代替');
 flipDown('Cobraman Sakuzy');onFlip('Cobraman Sakuzy',{condition:(e,c)=>e.field(1-c.owner).some(m=>!m.faceUp),resolve:(e,c)=>e.revealCards(c.owner,e.field(1-c.owner).filter(m=>!m.faceUp),'确认对方盖放卡片')});
 flipDown('8-Claws Scorpion');
 flipDown('Fushioh Richie');
 // ---- FLIP monsters -----------------------------------------------------------------------
 onFlip('Dice Jar',{resolve:(e,c)=>{
  const roll=(owner)=>{const n=1+Math.floor(e.random()*6);e.log('effect','骰子壶 · '+e.name(owner)+' 掷出 '+n,c.owner);return n;};
  let mine=roll(c.owner),theirs=roll(1-c.owner);
  while(mine===theirs){e.log('effect','骰子壶：平局，重新掷骰',c.owner);mine=roll(c.owner);theirs=roll(1-c.owner);}
  if(mine===6)e.damage(1-c.owner,6000,'效果');
  else if(theirs===6)e.damage(c.owner,6000,'效果');
  else if(mine>theirs)e.damage(1-c.owner,mine*500,'效果');
  else e.damage(c.owner,theirs*500,'效果');
 }});
 onFlip('Jowls of Dark Demise',{inputs:target('选择获得控制权的对方怪兽',foeM),resolve:(e,c)=>{const f=e.find(first(c));if(f&&e.takeControl(f.card.uid,c.owner,{until:e.state.turn,source:c.source})){const m=e.find(f.card.uid).card;m.directAttackTurn=e.state.turn;}}});
 onFlip('Poison Mummy',{resolve:(e,c)=>burn(e,c,500)});
 onFlip('An Owl of Luck',{condition:(e,c)=>deck(e,c.owner,m=>CARDS[m.id].type==='spell'&&CARDS[m.id].spellKind==='field').length>0,inputs:(e,c)=>[g(e,c,'target','选择置顶或加入手牌的场地魔法',deck(e,c.owner,m=>CARDS[m.id].type==='spell'&&CARDS[m.id].spellKind==='field'),1,1,'search')],resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='deck'){if(e.hasEarly('Necrovalley'))e.search(c.owner,[f.card.uid]);else e.putOnDeck(f.card.uid,'top',c.source);}}});
 onFlip('A Cat of Ill Omen',{condition:(e,c)=>deck(e,c.owner,m=>CARDS[m.id].type==='trap').length>0,inputs:(e,c)=>[g(e,c,'target','选择置顶或加入手牌的陷阱',deck(e,c.owner,m=>CARDS[m.id].type==='trap'),1,1,'search')],resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='deck'){if(e.hasEarly('Necrovalley'))e.search(c.owner,[f.card.uid]);else e.putOnDeck(f.card.uid,'top',c.source);}}});
 onFlip('Gravekeeper\'s Spy',{summons:true,resolve:(e,c)=>choose(e,c,'选择攻击力1500以下的守墓',H.specialable(e,c.owner,deck(e,c.owner,m=>gk(m)&&CARDS[m.id].atk<=1500)),1,1,'early-special',{shuffle:true,role:'special'})});
 onFlip('Gravekeeper\'s Guard',{inputs:target('选择返回手牌的对方怪兽',foeM,'bounce'),resolve:(e,c)=>moved(e,c,args(c),'hand','effect-return')});
 onFlip('Cobra Jar',{summons:true,resolve:(e,c)=>{for(const m of e.createTokens(c.owner,'2002-snake-token',1))m.snakeToken=true;}});
 E.on('move',(e,v)=>{if(v.to==='vanished'&&['battle','destroy'].includes(v.kind||'')){if(v.previous.snakeToken)e.damage(1-v.owner,500,'效果');if(v.previous.ojamaToken)e.damage(v.owner,300,'效果');}});
 onFlip('Dimension Jar',{resolve:(e,c)=>{for(const owner of [c.owner,1-c.owner]){const pool=grave(e,1-owner,monster);if(pool.length)e.queueChoice(owner,'可以除外对方墓地最多3只怪兽',H.options(e,{...c,owner},pool),0,Math.min(3,pool.length),'early-move',{source:c.source,to:'banished',kind:'effect-banish',role:'banish'});}}});
 onFlip('Magical Plant Mandragola',{resolve:(e,c)=>{for(const m of [...allM(e),...allS(e)])if(m.faceUp&&CARDS[m.id].counterable)m.counters=(m.counters||0)+1;}});
 onFlip('Dark Cat with White Tail',{inputs:(e,c)=>[g(e,c,'foe','选择返回手牌的2只对方怪兽',foeM(e,c),2,2,'bounce'),g(e,c,'own','选择返回手牌的自己怪兽',ownM(e,c),1,1,'cost')],resolve:(e,c)=>moved(e,c,[...args(c,'foe'),...args(c)],'hand','effect-return')});
 onFlip('Magical Merchant',{resolve:(e,c)=>{const list=[];for(const m of deck(e,c.owner)){list.push(m);if(CARDS[m.id].type==='spell'||CARDS[m.id].type==='trap')break;}if(!list.length)return;e.revealCards(c.owner,list,'翻到魔法陷阱为止');const found=list.at(-1);if(['spell','trap'].includes(CARDS[found.id].type)&&e.find(found.uid)?.zone==='deck')e.search(c.owner,[found.uid]);moved(e,c,list.filter(m=>m!==found).map(m=>m.uid),'grave','effect-send');}});
 onFlip('Old Vindictive Magician',{destroys:true,inputs:target('选择破坏的对方怪兽',foeM),resolve:(e,c)=>destroy(e,c,args(c))});
 onFlip('Des Koala',{resolve:(e,c)=>burn(e,c,hand(e,1-c.owner).length*400)});
 onFlip('Des Feral Imp',{inputs:target('选择洗回卡组的墓地卡',(e,c)=>grave(e,c.owner),'search'),resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='grave'){e.move(f.card.uid,'deck',{kind:'effect-return',source:c.source});e.shuffle(e.state.players[c.owner].deck);}}});
 onFlip('Arsenal Summoner',{inputs:target('选择加入手牌的守护者卡',(e,c)=>deck(e,c.owner,m=>(CARDS[m.id].families||[]).includes('guardian')),'search'),resolve:(e,c)=>{if(e.find(first(c))?.zone==='deck')e.search(c.owner,args(c));}});
 // ---- Dark Scorpion and battle-damage discarders --------------------------------------------
 const damageOption=(extra)=>H.customGroup('mode','选择效果',extra,1,1);
 onDamage('Don Zaloog',{inputs:()=>[damageOption([{uid:'discard',label:'随机丢弃1张手牌',value:10},{uid:'mill',label:'卡组顶2张送墓',value:5}])],resolve:(e,c)=>first(c,'mode')==='discard'?randomDiscard(e,1-c.owner,1,c.source):e.mill(1-c.owner,2,c.source)});
 onDamage('Dark Scorpion Burglars',{resolve:(e,c)=>{const pool=deck(e,1-c.owner,m=>CARDS[m.id].type==='spell');if(pool.length)e.queueChoice(1-c.owner,'选择从卡组送墓的魔法',H.options(e,{...c,owner:1-c.owner},pool),1,1,'early-move',{source:c.source,to:'grave',kind:'effect-send',role:'cost',shuffle:true});}});
 onDamage('Dark Scorpion - Cliff the Trap Remover',{inputs:()=>[damageOption([{uid:'destroy',label:'破坏1张魔陷',value:10},{uid:'mill',label:'卡组顶2张送墓',value:5}])],resolve:(e,c)=>{if(first(c,'mode')==='destroy'){const pool=allS(e);if(pool.length)choose(e,c,'选择破坏的魔陷',pool,1,1,'destroy-selected',{role:'destroy'});}else e.mill(1-c.owner,2,c.source);}});
 onDamage('Dark Scorpion - Chick the Yellow',{inputs:()=>[damageOption([{uid:'bounce',label:'返回1张卡到手牌',value:10},{uid:'peek',label:'确认对方卡组顶',value:5}])],resolve:(e,c)=>{if(first(c,'mode')==='bounce'){const pool=allF(e);if(pool.length)choose(e,c,'选择返回手牌的卡',pool,1,1,'banish-selected',{role:'bounce'});}else{const top=e.state.players[1-c.owner].deck[0];if(top)e.revealCards(c.owner,[top],'确认对方卡组顶');}}});
 onDamage('Great Phantom Thief',{inputs:()=>[H.customGroup('name','宣言卡名',D.CARD_LIST.filter(m=>!m.notCollectible).map(m=>({uid:m.id,cardId:m.id,label:m.name})))],resolve:(e,c)=>{const id=first(c,'name');e.revealCards(c.owner,hand(e,1-c.owner),'查看对方手牌');moved(e,c,hand(e,1-c.owner).filter(m=>m.id===id).map(m=>m.uid),'grave','effect-discard');}});
 onDamage('Vampire Lord',{inputs:()=>[H.customGroup('kind','宣言卡的种类',[{uid:'monster',label:'怪兽'},{uid:'spell',label:'魔法'},{uid:'trap',label:'陷阱'}])],resolve:(e,c)=>{const kind=first(c,'kind'),pool=deck(e,1-c.owner,m=>kind==='monster'?monster(m):CARDS[m.id].type===kind);if(pool.length)e.queueChoice(1-c.owner,'选择从卡组送墓的卡',H.options(e,{...c,owner:1-c.owner},pool),1,1,'early-move',{source:c.source,to:'grave',kind:'effect-send',role:'cost',shuffle:true});}});
 E.on('standby',(e,v)=>{for(const owner of [0,1])for(const m of grave(e,owner))if(is(m,'Vampire Lord')&&!m.vampireRevived&&m.earlySent?.kind==='destroy'&&m.earlySent.byOwner!==owner&&v.owner===owner){m.vampireRevived=true;if(e.canSpecial(owner,m,{via:'revive'})&&e.freeMain(owner))e.addTrigger(m.uid,m.id+'::revive',{type:'standby',owner},{owner});}});
 onMove('Vampire Lord','revive',{summons:true,resolve:(e,c)=>{const f=e.find(c.uid);if(f?.zone==='grave'&&e.canSpecial(c.owner,f.card,{via:'revive'}))e.special(c.owner,c.uid,{via:'revive'});}},(e,v)=>false);
 // ---- Gravekeeper's ------------------------------------------------------------------------------
 rules('Gravekeeper\'s Vassal',{},'给予对方的战斗伤害当作效果伤害');
 C('Gravekeeper\'s Chief').uniqueFaceUp=true;
 onEntry('Gravekeeper\'s Chief','revive',{summons:true,condition:(e,c)=>H.specialable(e,c.owner,grave(e,c.owner,gk),'revive').length>0,inputs:target('选择复活的守墓',(e,c)=>H.specialable(e,c.owner,grave(e,c.owner,gk),'revive'),'special'),resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='grave'&&e.canSpecial(c.owner,f.card,{via:'revive'}))e.special(c.owner,f.card.uid,{via:'revive'});}},['normal']);
 Q('Gravekeeper\'s Assailant','position',{main:false,once:{key:'assailant-position',scope:'card'},condition:(e,c)=>{const a=c.event.window?.attack;return e.hasEarly('Necrovalley',c.owner)&&a?.uid===c.uid&&a?.stage==='declare';},inputs:target('选择变更表示的对方表侧怪兽',(e,c)=>foeM(e,c).filter(m=>m.faceUp&&CARDS[m.id].type!=='link'),'destroy'),resolve:(e,c)=>{const m=e.find(first(c))?.card;if(m)e.setPosition(m.uid,m.position==='attack'?'defense':'attack',c.source);},aiResponse:()=>900});
 Q('Gravekeeper\'s Watcher','negate',{zones:['hand'],main:false,condition:(e,c)=>{const l=c.event.window?.chainLast;if(!l||l.owner===c.owner)return false;const d=CARDS[l.sourceId];if(!d||!['spell','trap','monster','pendulum'].includes(d.type))return false;return ['Confiscation','Delinquent Duo','Card Destruction','Drop Off','Trap of Board Eraser','Spirit Reaper','Don Zaloog','Toon Gemini Elf','Zombie Tiger','White Magical Hat'].includes(d.officialName);},cost:(e,c)=>moved(e,c,[c.uid],'grave','cost-discard'),resolve:(e,c)=>e.negateLink(c.responseTo,c.source,true,true),aiResponse:()=>1500});
 mark('Gravekeeper\'s Watcher','对方发动会使你弃牌的卡时，从手牌丢弃此卡无效其发动；适用范围见实现说明');
 onStandby('Amazoness Blowpiper',{condition:(e,c)=>foeM(e,c).some(m=>m.faceUp),inputs:target('选择攻击力下降的对方怪兽',(e,c)=>foeM(e,c).filter(m=>m.faceUp),'destroy'),resolve:(e,c)=>e.modify(first(c),'atk','add',-500,e.state.turn,c.source)},{optional:false});
 // ---- Counter monsters ---------------------------------------------------------------------------
 for(const c of D.CARD_LIST)if(['Magical Marionette','Skilled White Magician','Apprentice Magician'].includes(c.officialName))c.counterable=true;
 E.on('spell-resolved',(e,v)=>{for(const p of [0,1])for(const m of e.monsters(p))if(m.faceUp&&!e.negated(m)&&['Magical Marionette','Skilled White Magician'].some(n=>is(m,n))){const cap=is(m,'Skilled White Magician')?3:99;m.counters=Math.min(cap,(m.counters||0)+1);}});
 statSelf('Magical Marionette',(e,s,m,k)=>k==='atk'?(m.counters||0)*200:0);
 A('Magical Marionette','counter-destroy',{destroys:true,once:once(),condition:(e,c)=>(self(e,c)?.counters||0)>=2,inputs:target('选择破坏的怪兽',e=>allM(e)),resolve:(e,c)=>{const m=self(e,c);if(m&&m.counters>=2){m.counters-=2;destroy(e,c,args(c));}},aiScore:700});
 mark('Armor Exe','召唤当回合不能攻击；每次双方准备阶段须除去自己场上1个魔力指示物，否则破坏');
 onStandby('Armor Exe',{condition:(e,c)=>!!self(e,c),resolve:(e,c)=>{const holders=[...allM(e),...allS(e)].filter(m=>m.faceUp&&(m.counters||0)>0&&e.find(m.uid)?.owner===c.owner);const list=[...holders.map(m=>({uid:m.uid,label:CARDS[m.id].name+'（除去1个魔力指示物）',value:50})),{uid:'destroy',label:'不除去，破坏此卡',value:0}];e.queueChoice(c.owner,'铠甲执行官：除去1个魔力指示物',list,1,1,'2002-armor-exe',{source:c.source});}},{both:true,optional:false});
 E.op('2002-armor-exe',(e,t)=>{if(t.picks[0]==='destroy'){const f=e.find(t.context.source.uid);if(f&&H.fieldZone(f.zone))e.destroy(f.card.uid,t.context.source);return;}const f=e.find(t.picks[0]);if(f&&(f.card.counters||0)>0)f.card.counters--;});
 A('Skilled White Magician','summon-buster',{summons:true,condition:(e,c)=>(self(e,c)?.counters||0)>=3&&H.cards(e,c.owner,['hand','deck','grave'],m=>is(m,'Buster Blader')).length>0&&e.freeMain(c.owner)>0,inputs:target('选择登场的破坏剑士',(e,c)=>H.cards(e,c.owner,['hand','deck','grave'],m=>is(m,'Buster Blader')),'special'),resolve:(e,c)=>{const f=e.find(first(c));if(!f||!tribute(e,c,[c.uid]))return;if(e.canSpecial(c.owner,f.card,{via:f.zone==='grave'?'revive':'effect'}))e.special(c.owner,f.card.uid,{via:f.zone==='grave'?'revive':'effect'});if(f.zone==='deck')e.shuffle(e.state.players[c.owner].deck);},aiScore:1000});
 mark('Skilled White Magician','每次魔法发动放置1个魔力指示物（最多3个）；解放3个指示物的此卡，从手牌·卡组·墓地特殊召唤破坏剑士');
 A('Roulette Barrel','roll',{destroys:true,once:once(),condition:(e,c)=>allM(e).some(m=>m.faceUp&&e.level(m)>0),resolve:(e,c)=>{const a=1+Math.floor(e.random()*6),b=1+Math.floor(e.random()*6);e.log('effect','骰子结果：'+a+' / '+b,c.owner);const options=[...new Set([a,b])].filter(n=>allM(e).some(m=>m.faceUp&&e.level(m)===n)).map(n=>({uid:String(n),label:'选择结果 '+n,value:n}));if(options.length)e.queueChoice(c.owner,'选择采用的骰子结果',options,1,1,'2002-roulette',{source:c.source});else e.log('effect','没有匹配等级的怪兽',c.owner);},aiScore:250});
 E.op('2002-roulette',(e,t)=>{const n=Number(t.picks[0]);const pool=allM(e).filter(m=>m.faceUp&&e.level(m)===n);if(pool.length)e.queueChoice(t.owner,'选择破坏的怪兽',H.options(e,{owner:t.owner,source:t.context.source},pool),1,1,'destroy-selected',{role:'destroy'});});
 A('Tribe-Infecting Virus','wipe',{destroys:true,once:once(),inputs:(e,c)=>[discardCost()(e,c),declare('race','宣言怪兽种族',races)],cost:(e,c)=>H.discard(e,c,args(c,'cost')),resolve:(e,c)=>destroy(e,c,allM(e).filter(m=>m.faceUp&&e.race(m)===declared(c,'race')).map(m=>m.uid)),aiScore:(e,c)=>foeM(e,c).length>=2?900:200});
 A('Gravekeeper\'s Cannonholder','burn',{condition:(e,c)=>ownM(e,c).some(m=>gk(m)&&m.uid!==c.uid&&e.canTribute(m,c.owner)),inputs:(e,c)=>[g(e,c,'cost','选择解放的守墓',ownM(e,c).filter(m=>gk(m)&&m.uid!==c.uid&&e.canTribute(m,c.owner)),1,1,'cost')],cost:(e,c)=>tribute(e,c),resolve:(e,c)=>burn(e,c,700),aiScore:(e,c)=>e.state.players[1-c.owner].lp<=700?4000:200});
 Q('Charm of Shabti','protect',{zones:['hand'],main:false,damageStep:true,condition:(e,c)=>ownM(e,c).some(m=>gk(m)&&m.uid!==c.uid),cost:(e,c)=>moved(e,c,[c.uid],'grave','cost-discard'),resolve:(e,c)=>{for(const m of ownM(e,c).filter(m=>gk(m)))m.battleProtectedUntil=e.state.turn;},aiResponse:()=>1100});
 // ---- Position, control and attack rules -----------------------------------------------------------
 R('Little-Winguard','end-position',{zones:['monsters','extraMonster'],resolve:(e,c)=>{const m=self(e,c);if(m)e.setPosition(c.uid,m.position==='attack'?'defense':'attack',c.source);}});
 E.on('end-phase',(e,v)=>{for(const f of e.refs(v.owner,['monsters','extraMonster']))if(is(f.card,'Little-Winguard')&&f.card.faceUp&&!e.negated(f.card))e.addTrigger(f.card.uid,f.card.id+'::end-position',v,{owner:v.owner});});
 rules('Giant Orc',{goblinPosition:true});
 rules('Toon Goblin Attack Force',{goblinPosition:true});
 rules('Ultimate Obedient Fiend',{onlyFieldCard:true,negateBattleVictim:true},'场上只有此卡且手牌为0才能攻击；被它破坏的效果怪兽效果无效');
 extend('canAttack',function(prior,card,owner=this.state.active,target=null){
  if(!prior.call(this,card,owner,target))return false;
  if(is(card,'Ultimate Obedient Fiend')&&!this.negated(card)&&!(this.field(owner).length===1&&hand(owner).length===0))return false;
  const t=target?this.find(target)?.card:null;
  if(t&&is(t,'Guardian Kay\'est')&&!this.negated(t))return false;
  return true;
 });
 rules('Chaos Command Magician',{},'指定它的怪兽效果无效');
 rules('Guardian Kay\'est',{requiresEquip:'Rod of Silence - Kay\'est'},'没有睿智之杖时不能召唤；不受魔法效果影响，不能被攻击（不阻止直接攻击）');
 rules('Guardian Ceal',{requiresEquip:'Shooting Star Bow - Ceal'});
 rules('Guardian Tryce',{requiresEquip:'Twin Swords of Flashing Light - Tryce'},'被破坏时复活上次解放召唤用的素材');
 rules('Guardian Grarl',{requiresEquip:'Gravity Axe - Grarl'});
 rules('Guardian Baou',{requiresEquip:'Wicked-Breaking Flamberge - Baou',negateBattleVictim:true},'战斗破坏怪兽后攻击力+1000，被破坏的怪兽效果无效');
 rules('Guardian Elma',{requiresEquip:'Butterfly Dagger - Elma'});
 extend('unaffected',function(prior,card,source){
  if(prior.call(this,card,source))return true;
  if(is(card,'Guardian Kay\'est')&&card.faceUp&&!this.negated(card)&&['spell','pendulum-spell'].includes(source?.effectType||CARDS[source?.id]?.type))return true;
  return false;
 });
 extend('canTarget',function(prior,card,source){
  if(!prior.call(this,card,source))return false;
  for(const f of this.rawEarly('Metalsilver Armor')){
   if(!this.activeSpell(f.card))continue;
   const host=this.find(f.card.equipTarget)?.card;
   if(host&&source&&source.owner!==f.owner&&this.find(card.uid)?.owner===f.owner&&card.uid!==host.uid&&D.isMonster(CARDS[card.id]))return false;
  }
  return true;
 });
 A('Guardian Ceal','burn-equip',{destroys:true,condition:(e,c)=>{const m=self(e,c);return !!m&&e.activeEquip(m).length>0;},inputs:(e,c)=>[g(e,c,'equip','选择送墓的装备卡',e.activeEquip(self(e,c)).filter(m=>H.canSendGY(e,m)),1,1,'send-cost'),g(e,c,'target','选择破坏的对方怪兽',foeM(e,c),1,1,'destroy')],resolve:(e,c)=>{H.sendCost(e,c,[first(c,'equip')]);destroy(e,c,args(c));},aiScore:600});
 A('Guardian Grarl','special',{zones:['hand'],inherent:true,summons:true,condition:(e,c)=>hand(e,c.owner).length===1&&e.freeMain(c.owner)>0&&e.canSpecial(c.owner,H.source(e,c).card,{via:'guardian'}),resolve:(e,c)=>{if(e.find(c.uid)?.zone==='hand')e.special(c.owner,c.uid,{via:'guardian'});},aiScore:1000});
 onEntry('Guardian Elma','re-equip',{condition:(e,c)=>grave(e,c.owner,m=>CARDS[m.id].type==='spell'&&CARDS[m.id].spellKind==='equip').length>0&&e.state.players[c.owner].spells.includes(null),inputs:target('选择装备到自己身上的墓地装备魔法',(e,c)=>grave(e,c.owner,m=>CARDS[m.id].type==='spell'&&CARDS[m.id].spellKind==='equip'),'search'),resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='grave'&&self(e,c)){const eq=e.remove(f.card.uid).card;eq.faceUp=true;eq.equipTarget=c.uid;const slot=e.state.players[c.owner].spells.indexOf(null);if(slot>=0)e.state.players[c.owner].spells[slot]=eq;e.emit({type:'equip',owner:c.owner,uid:eq.uid,id:eq.id,target:c.uid});}}},['normal','special','flip']);
 mark('Guardian Elma','召唤时可把墓地的1张装备魔法装备到自己身上（本作不校验装备对象限制）');
 // ---- Unions -----------------------------------------------------------------------------------------
 union('Des Dendle',['Vampiric Orchis'],{});
 union('Second Goblin',['Giant Orc'],{});
 A('Second Goblin','position',{zones:['spells'],once:{key:'union-position',scope:'card'},condition:(e,c)=>{const f=H.source(e,c);const t=f&&e.find(f.card.equipTarget);return !!t&&H.fieldZone(t.zone)&&t.owner===c.owner;},resolve:(e,c)=>{const f=H.source(e,c),t=f&&e.find(f.card.equipTarget);if(t)e.setPosition(t.card.uid,t.card.position==='attack'?'defense':'attack',c.source);},aiScore:100});
 union('Pitch-Dark Dragon',['Dark Blade'],{stat:{atk:400,def:400}});C('Pitch-Dark Dragon').equipRules={piercing:true};
 union('Z-Metal Tank',['X-Head Cannon','Y-Dragon Head'],{stat:{atk:600,def:600},effectProtect:true});
 union('Y-Dragon Head',['X-Head Cannon'],{stat:{atk:400,def:400},effectProtect:true});
 union('Kiryu',['Dark Blade'],{stat:{atk:900,def:900}});
 A('Kiryu','direct',{zones:['spells'],leavesAsCost:true,once:{key:'union-2002',scope:'card'},condition:(e,c)=>{const f=H.source(e,c);const t=f&&e.find(f.card.equipTarget);return !!t&&H.fieldZone(t.zone)&&t.owner===c.owner&&t.card.faceUp;},cost:(e,c)=>{const f=H.source(e,c);if(f){c.kiryuTarget=f.card.equipTarget;e.move(c.uid,'grave',{kind:'cost-send',source:c.source,byOwner:c.owner});}},resolve:(e,c)=>{const t=c.kiryuTarget&&e.find(c.kiryuTarget);if(t&&H.fieldZone(t.zone))t.card.directAttackTurn=e.state.turn;},aiScore:900});
 union('Zombie Tiger',['Decayed Commander'],{stat:{atk:500,def:500}});
 union('Burning Beast',['Freezing Beast'],{});
 union('Freezing Beast',['Burning Beast'],{});
 E.on('damage',(e,v)=>{
  if(!v.battle||!v.attack||e.state.winner!==null)return;
  const dealerCard=v.owner===v.attack.owner?e.find(v.attack.uid)?.card:e.find(v.attack.target)?.card;
  if(!dealerCard)return;
  for(const eq of e.activeEquip(dealerCard)){
   const eqOwner=e.find(eq.uid)?.owner;if(eqOwner===undefined)continue;
   if(is(eq,'Burning Beast')){const pool=allS(e).filter(m=>m.faceUp);if(pool.length)choose(e,{owner:eqOwner,source:src(e,eq)},'破坏野兽：选择破坏的表侧魔陷',pool,1,1,'destroy-selected',{role:'destroy'});}
   if(is(eq,'Freezing Beast')){const pool=allS(e).filter(m=>!m.faceUp);if(pool.length)choose(e,{owner:eqOwner,source:src(e,eq)},'冰冻野兽：选择破坏的盖放魔陷',pool,1,1,'destroy-selected',{role:'destroy'});}
  }
 });
 union('Koitsu',['Aitsu'],{stat:{atk:3000,def:0}});C('Koitsu').equipRules={piercing:true};
 A('Union Rider','take-union',{condition:(e,c)=>foeM(e,c).some(m=>m.faceUp&&CARDS[m.id].earlyRules?.union&&!m.monsterEquip)&&e.state.players[c.owner].spells.includes(null),inputs:target('选择夺为装备的对方同盟怪兽',(e,c)=>foeM(e,c).filter(m=>m.faceUp&&CARDS[m.id].earlyRules?.union),'destroy'),resolve:(e,c)=>{const f=e.find(first(c));if(f&&self(e,c)&&e.equipMonster(f.card.uid,c.uid,c.owner,c.source)){const eq=e.find(c.uid)?.card;if(eq)eq.unionRiderLocked=true;}},aiScore:600});
 // ---- Toons --------------------------------------------------------------------------------------------
 for(const name of ['Toon Goblin Attack Force','Toon Masked Sorcerer','Toon Gemini Elf','Toon Cannon Soldier'])rules(name,{toon:true,summonSickness:true},'卡通：对方没有卡通时可透过卡通世界直接攻击；卡通世界被破坏时一同破坏');
 extend('canDirect',function(prior,card,owner=this.state.active){
  const r=CARDS[card.id].earlyRules||{};
  if(r.toon&&!this.hasEarly('Toon World',owner))return false;
  if(this.activeEquip(card).some(eq=>is(eq,'Shooting Star Bow - Ceal')))return true;
  return prior.call(this,card,owner);
 });
 A('Toon Cannon Soldier','burn',{condition:(e,c)=>ownM(e,c).some(m=>e.canTribute(m,c.owner)),inputs:(e,c)=>[g(e,c,'cost','选择解放的怪兽',ownM(e,c).filter(m=>e.canTribute(m,c.owner)),1,1,'cost')],cost:(e,c)=>tribute(e,c),resolve:(e,c)=>burn(e,c,500),aiScore:(e,c)=>e.state.players[1-c.owner].lp<=500?4000:150});
 // ---- Fusions -------------------------------------------------------------------------------------------
 rules('Reaper on the Nightmare',{direct:true},'不受战斗破坏；被指定时破坏；可直接攻击并随机弃牌');
 passive('Reaper on the Nightmare',{protect:(e,s,m,battle)=>battle&&s.card.uid===m.uid});
 onDamage('Reaper on the Nightmare',{condition:(e,c)=>!c.event.attack?.target,resolve:(e,c)=>randomDiscard(e,1-c.owner,1,c.source)});
 rules('Dark Flare Knight',{},'战斗伤害为0；被战斗破坏时从手牌或卡组特殊召唤幻影骑士');
 C('Mirage Knight').specialOnly='dark-flare';mark('Mirage Knight','只能由暗黑焰骑士特殊召唤；伤害计算时攻击力上升对方怪兽的原本攻击力，战斗过的回合结束阶段除外');
 passive('Mirage Knight',{battleStat:(e,s,m,k,a)=>s.card.uid===m.uid&&k==='atk'&&a&&(a.uid===m.uid||a.target===m.uid)?e.originalAttack(e.find(a.uid===m.uid?a.target:a.uid)?.card||{}):0});
 E.on('end-phase',(e,v)=>{for(const f of e.refs(v.owner,['monsters','extraMonster']))if(is(f.card,'Mirage Knight')&&f.card.battledTurn===e.state.turn)e.move(f.card.uid,'banished',{kind:'effect-banish',source:{id:I('Mirage Knight'),owner:v.owner},byOwner:v.owner});});
 Q('Dark Paladin','negate',{main:false,condition:(e,c)=>{const l=c.event.window?.chainLast;return !!self(e,c)&&hand(e,c.owner).length>0&&l?.source.effectType==='spell';},inputs:(e,c)=>[discardCost()(e,c)],cost:(e,c)=>H.discard(e,c,args(c,'cost')),resolve:(e,c)=>e.negateLink(c.responseTo,c.source,true,true),aiResponse:()=>1600});
 // ---- Ritual monsters -------------------------------------------------------------------------------------
 E.on('damage-start',(e,v)=>{const a=v.attack,f=a&&e.find(a.target);if(f&&is(f.card,'Paladin of White Dragon')&&a.uid!==a.target&&wasFlipped(v,a.target))e.addTrigger(f.card.uid,f.card.id+'::before-damage',v,{owner:f.owner});});
 A('Paladin of White Dragon','summon-dragon',{summons:true,condition:(e,c)=>H.cards(e,c.owner,['hand','deck'],m=>is(m,'Blue-Eyes White Dragon')).length>0&&e.freeMain(c.owner)>0,resolve:(e,c)=>{if(!tribute(e,c,[c.uid]))return;const m=H.cards(e,c.owner,['hand','deck'],m=>is(m,'Blue-Eyes White Dragon'))[0];if(m){e.special(c.owner,m.uid,{via:'effect'});const b=e.find(m.uid)?.card;if(b)b.cannotAttackUntil=e.state.turn;e.shuffle(e.state.players[c.owner].deck);}},aiScore:1000});
 rules('Shinato, King of a Higher Plane',{},'战斗破坏守备表示怪兽时，给予被破坏怪兽原本攻击力的伤害');
 // ---- Special Summon monsters -------------------------------------------------------------------------------
 C('Lava Golem').specialOnly='lava-golem';mark('Lava Golem','解放对方2只怪兽在其场上特殊召唤；召唤回合自己不能通常召唤，自己准备阶段受1000伤害');
 A('Lava Golem','special',{zones:['hand'],inherent:true,summons:true,condition:(e,c)=>{const pool=foeM(e,c).filter(m=>e.canTribute(m,1-c.owner));return pool.length>=2&&e.freeMain(1-c.owner)>=2&&!e.state.normalUsed;},inputs:(e,c)=>[g(e,c,'target','选择解放的2只对方怪兽',foeM(e,c).filter(m=>e.canTribute(m,1-c.owner)),2,2,'cost')],cost:(e,c)=>{for(const uid of args(c)){const f=e.find(uid);if(!f||!e.canTribute(f.card,1-c.owner))throw new root.DuelRuleError('不能解放选择的卡片。');}for(const uid of args(c))e.move(uid,'grave',{kind:'cost-tribute',source:c.source,byOwner:1-c.owner});},resolve:(e,c)=>{const f=e.find(c.uid);if(f?.zone==='hand'&&e.freeMain(1-c.owner)>0){const m=e.special(1-c.owner,c.uid,{via:'lava-golem'});if(m){m.golemOwner=c.owner;e.state.players[c.owner].normalSummonLockedTurn=e.state.turn;}}},aiScore:(e,c)=>e.state.players[c.owner].lp>3000&&foeM(e,c).length>=2?800:-100});
 E.on('standby',(e,v)=>{for(const owner of [0,1])for(const f of e.refs(owner,['monsters','extraMonster']))if(is(f.card,'Lava Golem')&&f.card.golemOwner===v.owner)e.damage(v.owner,1000,'效果');});
 C('Exodia Necross').specialOnly='exodia-necross';mark('Exodia Necross','以与艾克佐迪亚的契约特殊召唤；不会被战斗和魔法陷阱效果破坏，准备阶段+500，墓地缺少部件时破坏');
 passive('Exodia Necross',{protect:(e,s,m,battle,source)=>{if(s.card.uid!==m.uid)return false;if(battle)return true;return ['spell','trap','pendulum-spell'].includes(source?.effectType||CARDS[source?.id]?.type);}});
 onStandby('Exodia Necross',{condition:(e,c)=>!!self(e,c),resolve:(e,c)=>{const m=self(e,c);if(m)e.modify(c.uid,'atk','add',500,null,c.source);const p=e.state.players[c.owner];const ok=['Exodia the Forbidden One','Right Arm of the Forbidden One','Left Arm of the Forbidden One','Right Leg of the Forbidden One','Left Leg of the Forbidden One'].every(n=>p.grave.some(x=>is(x,n)));if(!ok&&e.find(c.uid))e.destroy(c.uid,{id:c.sourceId,uid:c.uid,owner:c.owner,effectType:'monster'});}},{optional:false});
 C('Berserk Dragon').specialOnly='dark-ruler-deal';rules('Berserk Dragon',{attackAll:true},'与暗黑之支配者的契约特殊召唤；攻击对方全部怪兽，每次自己结束阶段攻击力-500');
 E.on('end-phase',(e,v)=>{for(const f of e.refs(v.owner,['monsters','extraMonster']))if(is(f.card,'Berserk Dragon')&&f.card.faceUp)e.modify(f.card.uid,'atk','add',-500,null,{id:I('Berserk Dragon'),owner:v.owner,effectType:'monster'});});
 C('Fushioh Richie').specialOnly='dezard';rules('Fushioh Richie',{},'解放达成条件的大德法师特殊召唤；可每回合变回里侧；指定它的魔法陷阱无效并破坏');
 onFlip('Fushioh Richie',{summons:true,resolve:(e,c)=>choose(e,c,'可以特殊召唤墓地的不死族',H.specialable(e,c.owner,grave(e,c.owner,m=>monster(m)&&e.race(m)==='不死族'),'revive'),0,1,'early-special',{via:'revive',role:'special'})});
 extend('earlyNegatesLink',function(prior,link){
  if(prior.call(this,link))return true;
  const targets=Object.values(link.targetMeta||{}).flatMap(x=>Object.keys(x)).map(uid=>this.find(uid)).filter(f=>f&&H.fieldZone(f.zone)&&f.card.faceUp&&!this.negated(f.card));
  for(const t of targets){
   if(is(t.card,'Great Dezard')&&(t.card.dezardKills||0)>=1&&['spell','trap'].includes(link.source.effectType)){
    if(this.find(link.uid))this.destroy(link.uid,{id:t.card.id,uid:t.card.uid,owner:t.owner,effectType:'monster'});
    return true;
   }
   if(is(t.card,'Fushioh Richie')&&['spell','trap'].includes(link.source.effectType)){
    if(this.find(link.uid))this.destroy(link.uid,{id:t.card.id,uid:t.card.uid,owner:t.owner,effectType:'monster'});
    return true;
   }
   if(is(t.card,'Chaos Command Magician')&&CARDS[link.sourceId]?.type==='monster')return true;
  }
  return false;
 });
 A('Great Dezard','summon-richie',{summons:true,condition:(e,c)=>(self(e,c)?.dezardKills||0)>=2&&H.cards(e,c.owner,['hand','deck'],m=>is(m,'Fushioh Richie')).length>0,resolve:(e,c)=>{const richie=H.cards(e,c.owner,['hand','deck'],m=>is(m,'Fushioh Richie'))[0];if(richie&&tribute(e,c,[c.uid])){e.special(c.owner,richie.uid,{via:'dezard'});e.shuffle(e.state.players[c.owner].deck);}},aiScore:1200});
 mark('Great Dezard','战斗破坏1只怪兽后指定它的魔法陷阱无效；破坏2只后可解放自身特殊召唤不死的舞王');
 rules('Mystical Beast of Serket',{},'没有王家长眠之谷的神殿时破坏；战斗破坏的怪兽除外；战斗破坏怪兽后+500');
 extend('continuousMaintenance',function(prior){
  let changed=prior.call(this);
  for(const owner of [0,1])for(const m of [...this.monsters(owner)])if(m.faceUp&&!this.negated(m)&&is(m,'Mystical Beast of Serket')&&!this.hasEarly('Temple of the Kings'))changed=this.destroy(m.uid,{id:I('Mystical Beast of Serket'),owner,effectType:'monster'})||changed;
  return changed;
 });
 rules('Maiden of the Aqua',{},'场上没有场地魔法时，视为海');
 extend('hasEarly',function(prior,name,owner=null){
  const wasUmi=prior.call(this,name,owner);
  if(name!=='Umi'||wasUmi)return wasUmi;
  if(this.state.players[0].fieldSpell||this.state.players[1].fieldSpell)return false;
  const maidens=[0,1].flatMap(p=>this.monsters(p)).filter(m=>m.faceUp&&is(m,'Maiden of the Aqua')&&!this.negated(m));
  if(!maidens.length)return false;
  return owner===null||maidens.some(m=>this.find(m.uid).owner===owner);
 });
 // ---- Amazoness and Gravekeeper's battle damage handling ------------------------------------------------
 extend('damage',function(prior,owner,amount,source){
  const a=this.state.frame?.attack;
  if(this._advancedReady&&source==='战斗'&&amount>0&&a&&this.state.winner===null){
   const participants=[a.uid,a.target].filter(Boolean).map(uid=>this.find(uid)).filter(Boolean);
   const sw=participants.find(f=>is(f.card,'Amazoness Swords Woman')&&f.owner===owner&&!this.negated(f.card));
   const fighter=participants.find(f=>is(f.card,'Amazoness Fighter')&&f.owner===owner&&!this.negated(f.card));
   const knight=participants.find(f=>is(f.card,'Dark Flare Knight')&&f.owner===owner&&!this.negated(f.card));
   const vassal=participants.find(f=>is(f.card,'Gravekeeper\'s Vassal')&&f.owner!==owner&&!this.negated(f.card));
   const metal=participants.find(f=>CARDS[f.card.id].type==='token'&&f.card.id==='2002-metal-fiend-token'&&f.owner===owner);
   if(vassal)return prior.call(this,owner,amount,'效果');
   if(sw)return prior.call(this,1-owner,amount,source);
   if(metal)return prior.call(this,1-owner,amount,source);
   if(fighter||knight)return prior.call(this,owner,0,source);
  }
  return prior.call(this,owner,amount,source);
 });
 // ---- VWXYZ machine fusions: discard-and-destroy ignitions ---------------------------------------------
 A('XY-Dragon Cannon','destroy-spell',{destroys:true,once:once(),condition:(e,c)=>hand(e,c.owner).length>0&&e.spells(1-c.owner).some(m=>m.faceUp),inputs:(e,c)=>[discardCost()(e,c),g(e,c,'target','选择破坏的表侧魔陷',e.spells(1-c.owner).filter(m=>m.faceUp),1,1,'destroy')],cost:(e,c)=>H.discard(e,c,args(c,'cost')),resolve:(e,c)=>destroy(e,c,args(c)),aiScore:650});
 A('YZ-Tank Dragon','destroy-set-monster',{destroys:true,once:once(),condition:(e,c)=>hand(e,c.owner).length>0&&foeM(e,c).some(m=>!m.faceUp),inputs:(e,c)=>[discardCost()(e,c),g(e,c,'target','选择破坏的里侧怪兽',foeM(e,c).filter(m=>!m.faceUp),1,1,'destroy')],cost:(e,c)=>H.discard(e,c,args(c,'cost')),resolve:(e,c)=>destroy(e,c,args(c)),aiScore:650});
 A('XZ-Tank Cannon','destroy-set-spell',{destroys:true,once:once(),condition:(e,c)=>hand(e,c.owner).length>0&&e.spells(1-c.owner).some(m=>!m.faceUp),inputs:(e,c)=>[discardCost()(e,c),g(e,c,'target','选择破坏的盖放魔陷',e.spells(1-c.owner).filter(m=>!m.faceUp),1,1,'destroy')],cost:(e,c)=>H.discard(e,c,args(c,'cost')),resolve:(e,c)=>destroy(e,c,args(c)),aiScore:650});
 A('XYZ-Dragon Cannon','destroy-card',{destroys:true,once:once(),condition:(e,c)=>hand(e,c.owner).length>0&&e.field(1-c.owner).length>0,inputs:(e,c)=>[discardCost()(e,c),g(e,c,'target','选择破坏的对方卡',e.field(1-c.owner),1,1,'destroy')],cost:(e,c)=>H.discard(e,c,args(c,'cost')),resolve:(e,c)=>destroy(e,c,args(c)),aiScore:800});
  // ---- Wrap-only cards need explicit registration marks -------------------------------------
 rules('Kaiser Sea Horse',{},'光属性怪兽的上级召唤可当作2份解放');
 rules('Timeater',{},'战斗破坏对方怪兽时，对方跳过下个主要阶段1');
 rules('Giant Axe Mummy',{},'每回合可变回里侧守备；里侧被攻击且守备力高于对方攻击力时，攻击怪兽被破坏');
 rules('Gora Turtle',{},'此卡表侧存在时，攻击力1900以上的怪兽不能攻击宣言');
 rules('King Tiger Wanghu',{},'攻击力1400以下的怪兽被召唤时破坏');
 rules('Winged Sage Falcos',{},'战斗破坏对方表侧攻击表示怪兽时，可将其放到对方卡组顶');
 rules('Mystical Knight of Jackal',{},'战斗破坏对方怪兽时，将其放回对方卡组顶');
 rules('Helping Robo for Combat',{},'战斗破坏对方怪兽时抽1张卡，再把手牌1张放回卡组底');
 rules('D.D. Crazy Beast',{},'被此卡战斗破坏的怪兽除外');
 rules('Thousand Needles',{},'守备表示被攻击且守备力较高时，攻击怪兽在伤害步骤结束时破坏');
 onEntry('A Man with Wdjat','peek',{condition:(e,c)=>e.field(1-c.owner).some(m=>!m.faceUp),inputs:target('选择确认的对方盖卡',(e,c)=>e.field(1-c.owner).filter(m=>!m.faceUp),'search'),resolve:(e,c)=>e.revealCards(c.owner,args(c).map(uid=>e.find(uid)?.card).filter(Boolean),'确认对方盖放卡片')},['normal']);
 onStandby('A Man with Wdjat',{condition:(e,c)=>e.field(1-c.owner).some(m=>!m.faceUp),inputs:target('选择确认的对方盖卡',(e,c)=>e.field(1-c.owner).filter(m=>!m.faceUp),'search'),resolve:(e,c)=>e.revealCards(c.owner,args(c).map(uid=>e.find(uid)?.card).filter(Boolean),'确认对方盖放卡片')});
 mark('A Man with Wdjat','召唤时和每次自己准备阶段，确认对方1张盖放的卡');
 onEntry('Cyber Raider','strip',{condition:(e,c)=>allS(e).some(m=>m.equipTarget),inputs:(e,c)=>[H.customGroup('mode','选择效果',[{uid:'destroy',label:'破坏场上1张装备卡',value:8},{uid:'take',label:'夺取装备卡装备到自己',value:10}]),g(e,c,'target','选择装备卡',allS(e).filter(m=>m.equipTarget),1,1,'destroy')],resolve:(e,c)=>{const f=e.find(first(c));if(!f||f.zone!=='spells')return;if(first(c,'mode')==='destroy')destroy(e,c,[f.card.uid]);else{const host=e.find(f.card.equipTarget);const m=self(e,c);if(m&&host&&H.fieldZone(host.zone)){f.card.equipTarget=c.uid;e.emit({type:'equip',owner:c.owner,uid:f.card.uid,id:f.card.id,target:c.uid});}}}},['*']);
 A('Magical Scientist','fusion',{summons:true,condition:(e,c)=>e.state.players[c.owner].lp>1000&&H.specialable(e,c.owner,e.state.players[c.owner].extra.filter(m=>CARDS[m.id].type==='fusion'&&e.level(m)<=6),'effect').length>0,inputs:(e,c)=>[g(e,c,'target','选择特殊召唤的6星以下融合怪兽',H.specialable(e,c.owner,e.state.players[c.owner].extra.filter(m=>CARDS[m.id].type==='fusion'&&e.level(m)<=6),'effect'),1,1,'special')],cost:(e,c)=>pay(e,c,1000),resolve:(e,c)=>{const f=e.find(first(c));if(f?.zone==='extra'){const m=e.special(c.owner,f.card.uid,{via:'effect'});if(m){m.noDirect=true;m.scientistReturn=e.state.turn;}}},aiScore:(e,c)=>e.state.players[c.owner].lp>4000?700:-100});
 mark('Magical Scientist','支付1000LP特殊召唤6星以下融合怪兽，不能直接攻击，回合结束回到额外卡组');
 E.on('end-phase',(e,v)=>{for(const m of [...allM(e)])if(m.scientistReturn===e.state.turn){const f=e.find(m.uid);if(f)e.move(m.uid,'extra-down',{kind:'effect-return',source:{id:I('Magical Scientist'),owner:f.owner},byOwner:f.owner});}});
 rules('Amazoness Fighter',{},'与此卡战斗时自己受到的战斗伤害为0');
 rules('Amazoness Swords Woman',{},'与此卡战斗时，应受的战斗伤害由对方承受');
 })(globalThis);
