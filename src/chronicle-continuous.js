(function(root){
 'use strict';const X=root.DuelChronicle,{D,E,H,C,I,is,allM,allS,allF,monster,hand,deck,grave,first,args,src,active,field,has,extend,g,target,moved,choose,revive,search,card,def,series,lock,locked,raw,rawHas,fmonster}=X,{CARDS}=D,P=root.ModernDuelEngine.prototype;
 const effects=m=>!!def(m)?.effect,fieldMonsters=(e,p=null)=>p===null?allM(e):e.monsters(p),live=(e,n,p=null)=>raw(e,n,p).some(f=>fmonster(f.zone)?!rawHas(e,'Skill Drain')&&!(f.card.eraNegatedUntil>=e.state.turn):!f.card.spellNegated),eq=(e,m,n)=>e.activeEquip(m).some(q=>is(q,n));
 for(const c of D.CARD_LIST.filter(c=>c.releaseYear>=2009&&c.releaseYear<=2013)){
  if(/(?:This card c|C)annot be Special Summoned\./.test(c.originalDescription||''))c.noSpecial=true;
  if(/cannot be Special Summoned by other ways/i.test(c.originalDescription||''))c.eraStrictSummon=true;
  if(c.masked)c.specialOnly='mask';
 }
 extend('canSpecial',function(prior,p,m,o={}){
  if(!m||!prior.call(this,p,m,o))return false;const d=def(m),zone=this.find(m.uid)?.zone,lv=this.level(m),extra=zone==='extra';
  if(!o.ignoreConditions&&d.eraStrictSummon&&d.specialOnly&&o.via!==d.specialOnly)return false;
  if(live(this,'Aurora Paragon')||rawHas(this,"Vanity's Emptiness")||live(this,'Cactus Bouncer')&&allM(this).filter(m=>this.race(m)==='植物族').length>=2)return false;
  if(zone==='grave'&&rawHas(this,'Royal Prison')||rawHas(this,'Poisonous Winds')&&this.attribute(m)==='风')return false;
  if(extra&&(rawHas(this,'The Seal of Orichalcos',p)||rawHas(this,'March of the Monarchs',p)))return false;
  if(live(this,'Number 30: Acid Golem of Destruction',p)||live(this,'Numen erat Testudo')&&this.originalAttack(m)<=1800)return false;
  if(lv>=5&&raw(this,'Evilswarm Ophion').some(f=>f.card.overlays.length&&!f.card.effectNegated&&!rawHas(this,'Skill Drain')))return false;
  if(o.via==='synchro'&&live(this,'Dark Highlander'))return false;
  if(rawHas(this,"Tyrant's Tummyache")&&lv>=6||rawHas(this,"Tyrant's Throes")&&effects(m)||locked(this,p,'noEffectsSummon')&&effects(m))return false;
  if(locked(this,p,'maxSpecialLevel')&&lv>locked(this,p,'maxSpecialLevel')||locked(this,p,'maxSummonLevel')&&lv>locked(this,p,'maxSummonLevel')||locked(this,p,'cannotSummonId')===m.id)return false;
  if(allM(this).some(q=>q.faceUp&&q.eraProhibitedRace===this.race(m)))return false;
  if(series(m,'Malefic')&&allM(this).some(q=>q.uid!==m.uid&&q.faceUp&&series(q,'Malefic')))return false;
  return true;
 });
 extend('canNormal',function(prior,m,p=this.state.active){if(!prior.call(this,m,p))return false;const lv=this.level(m);return !(rawHas(this,"Tyrant's Throes")&&effects(m)||locked(this,p,'noEffectsSummon')&&effects(m)||locked(this,p,'maxNormalLevel')&&lv>locked(this,p,'maxNormalLevel')||locked(this,p,'maxSummonLevel')&&lv>locked(this,p,'maxSummonLevel')||locked(this,p,'cannotSummonId')===m.id||locked(this,p,'normalAttribute')&&this.attribute(m)!==locked(this,p,'normalAttribute'));});
 extend('earlyCanUse',function(prior,c,a){if(!prior.call(this,c,a))return false;const d=CARDS[c.sourceId],f=this.find(c.uid),p=c.owner,zone=f?.zone,mon=c.source.effectType==='monster';
  if(this.state.eraForbiddenNames?.some(r=>r.id===c.sourceId&&r.turn>=this.state.turn))return false;
  if(mon&&(rawHas(this,'Soul Drain')&&['grave','banished'].includes(zone)||rawHas(this,"Tyrant's Tirade")&&['hand','monsters','extraMonster'].includes(zone)))return false;
  if(mon&&fmonster(zone)&&(f.card.activationLockedUntil>=this.state.turn||f.card.cannotActivate||raw(this,'Powersink Stone').some(s=>s.card.eraCounters>=2)))return false;
  if(mon&&rawHas(this,'Grave of the Super Ancient Organism')&&fmonster(zone)&&this.level(f.card)>=6&&!f.card.normalSummoned)return false;
  if(mon&&fmonster(zone)&&rawHas(this,'Corridor of Agony')&&f.card.summonFrom==='deck')return false;
  if(mon&&locked(this,p,'noHandGraveMonsters')&&['hand','grave'].includes(zone)&&this.state.phase==='battle')return false;
  if(live(this,'Rocket Arrow Express',p)&&c.sourceId!==I('Rocket Arrow Express'))return false;
  if(a.cardActivation){if(d.type==='spell'&&rawHas(this,'Abyss-sphere',p))return false;if(d.trapKind==='counter'&&locked(this,p,'noCounterTraps'))return false;
   if(d.spellKind==='field'&&(rawHas(this,'Closed Forest')||this.state.eraClosedForest===this.state.turn))return false;
   if(['spell','trap'].includes(d.type)&&allM(this).some(q=>q.faceUp&&(q.eraBamboo&&this.find(q.uid)?.owner!==p||q.eraPhotonSeal===this.state.turn)))return false;
   if(allF(this).some(q=>q.faceUp&&q.eraSealed?.includes(c.uid)))return false;
  }
  const battle=this.state.frame?.attack,attacker=card(this,battle?.uid);if(attacker&&battle.owner!==p){if(attacker.eraAttackSeal===this.state.turn||locked(this,1-p,'gustoAttackSeal')&&series(attacker,'Gusto'))return false;if(d.type==='trap'&&attacker.eraTorapart)return false;}
  return true;
 });
 extend('activeSpell',function(prior,m){return prior.call(this,m)&&!(m.eraNegatedUntil>=this.state.turn)&&!(this.state.eraMagicDeflector===this.state.turn&&['equip','field','continuous','quick'].includes(def(m)?.spellKind));});
 extend('negated',function(prior,m){if(!m)return prior.call(this,m);const f=this.find(m.uid);if(f&&fmonster(f.zone)&&m.faceUp){if(rawHas(this,'Corridor of Agony')&&m.summonFrom==='deck')return true;if(raw(this,'Powersink Stone').some(s=>s.card.eraCounters>=2))return true;if(rawHas(this,'The Resolute Meklord Army')&&series(m,'Meklord Army')&&m.position==='attack')return true;if(eq(this,m,'Axe of Fools')||eq(this,m,'Wattjustment'))return true;}return prior.call(this,m);});
 extend('earlyNegatesLink',function(prior,l,probe=false){if(l.sourceZone==='grave'&&this.state.eraGraveNegation===this.state.turn)return true;
  const scales=[['Abyss-scale of the Kraken','monster'],['Abyss-scale of Cetus','trap']];for(const [name,type] of scales){const s=raw(this,name,1-l.owner).find(f=>f.card.equipTarget);if(s&&l.source.effectType===type){if(!probe)this.move(s.card.uid,'grave',{kind:'effect-send',source:src(this,s.card)});return true;}}
  return prior.call(this,l,probe);
 });
 extend('negateLink',function(prior,id,s,activation=true,destroy=true){const l=this.state.chain.find(l=>l.id===id);if(activation&&l?.source.effectType==='monster'&&CARDS[l.sourceId]?.attribute==='光'&&rawHas(this,'Constellar Belt'))return false;return prior.call(this,id,s,activation,destroy);});
 extend('unaffected',function(prior,m,s){if(prior.call(this,m,s))return true;if(!s||!m?.faceUp||!fmonster(this.find(m.uid)?.zone))return false;const type=s.effectType||CARDS[s.id]?.type;if(m.eraAllImmune===this.state.turn&&s.uid!==m.uid)return true;if(m.eraSpellTrapImmune===this.state.turn&&['spell','trap'].includes(type))return true;if(m.eraMonsterImmune===this.state.turn&&type==='monster'&&s.uid!==m.uid)return true;if(m.eraImmunity?.turn===this.state.turn&&m.eraImmunity.type===type)return true;if(m.eraOdin===this.state.turn&&['spell','trap'].includes(type))return true;
  const p=this.find(m.uid)?.owner;if(rawHas(this,"Tyrant's Temper",p)&&type==='trap'&&s.id!==I("Tyrant's Temper"))return true;if(type==='trap'&&m.eraDjinnMaterials?.includes(I('Djinn Disserere of Rituals')))return true;return false;});
 extend('canTarget',function(prior,m,s){if(!prior.call(this,m,s))return false;const f=this.find(m.uid);if(!f||!s)return true;const p=f.owner,opponent=s.owner!==p;
  if(def(m).type==='xyz'&&m.overlays?.length&&rawHas(this,'Xyz Veil'))return false;
  if(opponent&&fmonster(f.zone)&&m.faceUp){if(raw(this,'Safe Zone').some(q=>q.card.eraSafeZone===m.uid&&q.owner!==s.owner)||raw(this,'Solemn Authority').some(q=>q.card.eraSolemnTarget===m.uid))return false;
   if(rawHas(this,'March of the Monarchs',p)&&m.tributeCount>0||eq(this,m,'ZW - Tornado Bringer'))return false;
   if(series(m,'Watt')&&this.monsters(p).some(q=>q.faceUp&&is(q,'Watthopper')&&q.uid!==m.uid))return false;
   if(this.race(m)==='兽战士族'&&live(this,'Brotherhood of the Fire Fist - Swallow',p))return false;
   if(live(this,'D.D. Esper Star Sparrow',p)&&!is(m,'D.D. Esper Star Sparrow'))return false;
   if(eq(this,m,'Vylon Segment')&&['monster','trap'].includes(s.effectType)||eq(this,m,'Metallizing Parasite - Soltite')&&s.effectType==='monster')return false;
  }
  if(f.zone==='spells'&&m.equipTarget&&is(card(this,m.equipTarget),'Vylon Epsilon'))return false;return true;
 });
 extend('destroy',function(prior,uid,s,b=false,...a){const f=this.find(uid),m=f?.card;if(m){if(!b&&(m.eraEffectProtectedUntil>=this.state.turn||m.eraPermanentEffectProtect))return false;if(b&&m.eraBattleProtectedUntil>=this.state.turn)return false;
  if(fmonster(f.zone)&&m.faceUp){if(b&&m.eraTrustGuardian&&m.eraTrustTurn!==this.state.turn){m.eraTrustTurn=this.state.turn;for(const k of ['atk','def'])this.modify(uid,k,'add',-400,null,s);return false;}if(b&&m.eraStardustProtect&&m.eraTrustTurn!==this.state.turn){m.eraTrustTurn=this.state.turn;for(const k of ['atk','def'])this.modify(uid,k,'add',-800,null,s);return false;}
   if(m.eraGuard>0&&!is(m,'Card Guard')){m.eraGuard--;return false;}
   const replacement=this.activeEquip(m).find(q=>!b&&is(q,'ZW - Lightning Blade')||b&&is(q,'ZW - Tornado Bringer'));if(replacement&&prior.call(this,replacement.uid,src(this,replacement),false))return false;
  }}return prior.call(this,uid,s,b,...a);});
 extend('canTribute',function(prior,m,p=this.state.active,kind='effect'){return prior.call(this,m,p,kind)&&!m.eraNoTribute&&!(series(m,'Duston')&&m.faceUp)&&!(kind!=='normal'&&['era-soul-token','era-ceremonial-token'].includes(m.id));});
 extend('canAttack',function(prior,m,p=this.state.active,t=null){if(!prior.call(this,m,p,t))return false;const lv=this.level(m),target=card(this,t);if(def(m).cannotAttack||m.eraNoAttackUntil>=this.state.turn||locked(this,p,'attackRace')&&this.race(m)!==locked(this,p,'attackRace'))return false;
  if(lv>=5&&raw(this,'Mermail Abyssgaios').some(f=>f.card.overlays.length&&!f.card.effectNegated))return false;
  if(rawHas(this,'Red Screen',1-p)||rawHas(this,'Attraffic Control',1-p)&&this.monsters(p).length>=3)return false;
  if(rawHas(this,'Corridor of Agony')&&m.summonFrom==='deck')return false;
  if(!t&&(m.eraCannotDirect>=this.state.turn||eq(this,m,'Darkworld Shackles')||rawHas(this,'Bubble Bringer')&&lv>=4||raw(this,'Safe Zone').some(f=>f.card.eraSafeZone===m.uid)))return false;
  if(this.monsters(p).some(q=>q.uid!==m.uid&&q.faceUp&&(series(q,'Malefic')&&!is(q,'Malefic Paradox Dragon')||['Meklord Emperor Wisel','Meklord Emperor Skiel'].some(n=>is(q,n)))))return false;
  if(m.iceCounters>0&&!is(m,'Snowdust Dragon')&&live(this,'Snowdust Dragon'))return false;
  if(this.activeEquip(m).some(q=>q.eraAdapter||is(q,'Darkworld Shackles')))return false;
  if(target){const owner=this.find(target.uid).owner;if(live(this,'Lady of D.',owner)&&this.race(target)==='龙族')return false;if(live(this,'D.D. Esper Star Sparrow',owner)&&!is(target,'D.D. Esper Star Sparrow'))return false;
   const blockers=[['Madolche Chouxvalier','Madolche'],['Watthopper','Watt'],['Tyr of the Nordic Champions','Nordic']];for(const [n,family] of blockers)if(series(target,family)&&this.monsters(owner).some(q=>q.uid!==target.uid&&q.faceUp&&is(q,n)))return false;
   if(this.race(target)==='战士族'&&this.monsters(owner).some(q=>q.uid!==target.uid&&q.faceUp&&['Scarred Warrior','Valkyrian Knight'].some(n=>is(q,n))))return false;
   if(this.attribute(target)==='水'&&!is(target,'Mermail Abysslung')&&live(this,'Mermail Abysslung',owner))return false;
   if(is(target,'Naturia Mosquito')&&this.monsters(owner).some(q=>q.uid!==target.uid&&q.faceUp&&series(q,'Naturia')))return false;
   if(is(target,'Majioshaleon')&&this.spells(p).length)return false;
   if(rawHas(this,'Zerozerock')&&target.faceUp&&target.position==='attack'&&this.attackValue(target)===0)return false;
   const lowest=(rawHas(this,'Pixie Ring',owner)||rawHas(this,'The Seal of Orichalcos',owner))&&this.monsters(owner).filter(q=>q.faceUp&&q.position==='attack');if(lowest&&lowest.length>=2&&this.attackValue(target)===Math.min(...lowest.map(q=>this.attackValue(q))))return false;
  }return true;
 });
 extend('canDirect',function(prior,m,p=this.state.active){if(m.eraCannotDirect>=this.state.turn)return false;return m.eraPermanentDirect||this.race(m)==='海龙族'&&this.level(m)<=3&&live(this,'Atlantean Dragoons',p)||eq(this,m,'Dragunity Pilum')||prior.call(this,m,p);});
 extend('positionLocked',function(prior,m){return prior.call(this,m)||is(m,'Ironhammer the Giant')||eq(this,m,'Shocktopus')||m.iceCounters>0&&!is(m,'Snowdust Dragon')&&live(this,'Snowdust Dragon')||rawHas(this,'Armor Ninjitsu Art of Freezing',1-this.find(m.uid)?.owner)&&this.monsters(1-this.find(m.uid)?.owner).some(q=>series(q,'Ninja'));});
 extend('race',function(prior,m){const f=this.find(m?.uid);if(f&&fmonster(f.zone)&&m.faceUp&&live(this,'Naturia Pineapple',f.owner))return '植物族';return prior.call(this,m);});
 extend('attribute',function(prior,m){const f=this.find(m?.uid);if(f&&['monsters','extraMonster','grave'].includes(f.zone)&&series(m,'Crystal Beast')&&rawHas(this,'Advanced Dark'))return '暗';return prior.call(this,m);});
 extend('isTuner',function(prior,m){return prior.call(this,m)||!!m&&eq(this,m,'Dragunity Partisan');});
 extend('level',function(prior,m){let n=prior.call(this,m);if(n<=0)return n;if(is(m,'Shine Knight')&&m.faceUp&&m.position==='defense')return 4;for(const q of this.activeEquip(m)){if(is(q,'Inzektor Ladybug'))n+=2;if(is(q,'Inzektor Firefly'))n++;if(is(q,'Inzektor Hopper'))n+=4;}return n;});
 // Extra piercing is evaluated once, without duplicating the legacy piercing
 // branches already used by cards such as Bora or Cyber End Dragon.
 extend('finishBattle',function(prior,a){const af=this.find(a.uid),df=this.find(a.target),m=af?.card;let damage=0,owner;
  if(m&&df?.card.position==='defense'&&!this.negated(m)){const legacy=def(m).earlyRules?.piercing||['spear-dragon','bw-bora','bw-armed-wing','cyber-end'].includes(m.id)||this.activeEquip(m).some(q=>def(q).equipRules?.piercing)||m.piercingUntil===this.state.turn||rawHas(this,"Dragon's Rage",af.owner)&&this.race(m)==='龙族';const passive=this.passiveSources().some(s=>typeof E.passives[s.card.id]?.piercing==='function'&&E.passives[s.card.id].piercing(this,s,m));if(!legacy&&(passive||m.eraPiercing||m.eraPiercingTurn===this.state.turn||m.eraPiercingUntil>=this.state.turn)){damage=Math.max(0,this.attackValue(m,a)-this.defenseValue(df.card,a));owner=df.owner;}}
  const result=prior.call(this,a);if(damage>0&&this.state.winner===null)this.damage(owner,damage,'战斗');return result;
 });
 extend('damage',function(prior,p,n,kind,...a){if(kind!=='战斗'){if(locked(this,p,'noEffectDamage')||live(this,'Life Stream Dragon',p))return;if(locked(this,p,'effectHeal'))return this.heal(p,n);const dragon=raw(this,'Black-Winged Dragon',p).find(f=>f.card.faceUp&&!f.card.effectNegated);if(dragon&&!rawHas(this,'Skill Drain')){dragon.card.eraFeathers=(dragon.card.eraFeathers||0)+1;return;}if(this.monsters(p).some(m=>m.faceUp&&m.position==='attack'&&['Dragon Knight Draco-Equiste','Morphtronic Lantron'].some(x=>is(m,x))))return prior.call(this,1-p,n,kind,...a);
  }else{if(locked(this,p,'halfBattle'))n=Math.floor(n/2);const battle=this.state.frame?.attack,combat=[this.find(battle?.uid),this.find(battle?.target)].filter(Boolean),mine=combat.find(f=>f.owner===p),attacker=combat.find(f=>f.card.uid===battle?.uid);
   if(combat.some(f=>f.card.id==='era-waltz-token'||is(f.card,'Elemental HERO Neos Knight')||is(f.card,'Metaion, the Timelord')&&f.card.position==='attack'||is(f.card,'Rescue Warrior')&&f.owner===p||f.card.eraNoBattleDamage>=this.state.turn&&f.owner!==p))return;
   if(mine&&(is(mine.card,'Number 92: Heart-eartH Dragon')||mine.card.eraReflectBattle===this.state.turn||series(mine.card,'Gusto')&&live(this,'Daigusto Sphreez',p)||series(mine.card,'Naturia')&&!is(mine.card,'Naturia Mosquito')&&live(this,'Naturia Mosquito',p)))return prior.call(this,1-p,n,kind,...a);
   if(mine&&is(mine.card,'Photon Circle')||attacker&&!battle?.target&&eq(this,attacker.card,'Dragunity Pilum'))n=Math.floor(n/2);
  }return prior.call(this,p,n,kind,...a);
 });
 extend('draw',function(prior,p,n=1,...a){if(this._advancedReady&&locked(this,p,'noAddFromDeck'))return [];return prior.call(this,p,n,...a);});extend('search',function(prior,p,uids,...a){if(locked(this,p,'noAddFromDeck')&&uids.some(uid=>this.find(uid)?.zone==='deck'))return;return prior.call(this,p,uids,...a);});
 extend('move',function(prior,uid,to,o={}){const f=this.find(uid);if(f&&to==='banished'&&o.byOwner!==undefined&&live(this,'Chaos Hunter',1-o.byOwner))return null;if(f&&to==='deck'&&f.zone==='grave'&&monster(f.card)&&o.byEffect!==false&&series({id:o.source?.id},'Madolche')&&rawHas(this,'Madolche Chateau',f.owner))to='hand';if(f&&to==='grave'&&o.kind==='battle'&&is(card(this,o.source?.uid),'Amazoness Trainee'))to='deck';const r=prior.call(this,uid,to,o);if(r&&f&&is(f.card,'Closed Forest')&&o.kind==='destroy')this.state.eraClosedForest=this.state.turn;return r;});
 extend('continuousMaintenance',function(prior,...a){const r=prior.call(this,...a);for(const m of [...allM(this)]){if(!m.faceUp)continue;if(series(m,'Malefic')&&!is(m,'Malefic Parallel Gear')&&![0,1].some(p=>this.state.players[p].fieldSpell?.faceUp))this.destroy(m.uid,src(this,m));if(is(m,'Malefic Paradox Dragon')&&!rawHas(this,'Malefic World'))this.destroy(m.uid,src(this,m));if(is(m,'Tyr of the Nordic Champions')&&!allM(this).some(q=>q.uid!==m.uid&&series(q,'Nordic')))this.destroy(m.uid,src(this,m));}for(const s of [...allS(this)]){if(!s.faceUp)continue;const p=this.find(s.uid).owner;if(is(s,'Electromagnetic Shield')&&this.monsters(p).some(m=>m.faceUp&&m.position==='attack')||is(s,"Tyrant's Tummyache")&&hand(this,p).length>=3||is(s,'Secret Sanctuary of the Spellcasters')&&!this.monsters(p).some(m=>this.race(m)==='魔法师族'))this.destroy(s.uid,src(this,s));}return r;});
 extend('setCard',function(prior,a){const p=this.state.active;if(locked(this,p,'noSet')||live(this,'Rocket Arrow Express',p))throw new root.DuelRuleError('本回合不能盖放卡片。');const r=prior.call(this,a);this.emit({type:'set',owner:p,uid:a.uid,id:card(this,a.uid)?.id});return r;});
 extend('actionsFor',function(prior,uid,p){let list=prior.call(this,uid,p);const owner=p??this.state.active;if(locked(this,owner,'noSet')||live(this,'Rocket Arrow Express',owner))list=list.filter(a=>a.type!=='set');return list;});
 extend('changePhase',function(prior,phase){if(phase==='main2'&&rawHas(this,'Terminal World'))return this.endTurn();return prior.call(this,phase);});
 extend('heal',function(prior,p,n,...a){const before=this.state.players[p].lp,r=prior.call(this,p,n,...a);if(this._advancedReady&&this.state.players[p].lp>before)this.emit({type:'heal',owner:p,amount:this.state.players[p].lp-before});return r;});extend('negateAttack',function(prior,...a){const attack=this.state.frame?.attack,r=prior.call(this,...a);if(r&&attack)this.emit({type:'attack-negated',owner:attack.owner,attack:JSON.parse(JSON.stringify(attack))});return r;});
 E.on('damage-end',(e,v)=>{for(const uid of [v.attack.uid,v.attack.target]){const m=card(e,uid);if(!m)continue;m.yearBattledTurn=e.state.turn;const opponent=card(e,v.attack.uid===uid?v.attack.target:v.attack.uid);if(opponent&&m.eraBoreas===e.state.turn)e.destroy(opponent.uid,src(e,m));if(opponent&&m.eraReactor===e.state.turn)moved(e,{owner:e.find(uid).owner,source:src(e,m)},[uid,opponent.uid],'banished','effect-banish');if(opponent&&series(m,'Constellar')&&locked(e,e.find(uid).owner,'constellarMeteor')){moved(e,{owner:e.find(uid).owner,source:src(e,m)},[opponent.uid],'deck','effect-return');e.shuffle(e.state.players[opponent.originalOwner].deck);}}});
 E.on('move',(e,v)=>{if(!field(v.from))return;for(const s of [...allS(e)])if(s.eraSafeZone===v.uid)e.destroy(s.uid,v.source);if(v.previous?.eraSafeZone)e.destroy(v.previous.eraSafeZone,v.source);if(v.previous?.eraGiantHand){const m=card(e,v.previous.eraGiantHand);if(m){delete m.eraNegatedUntil;delete m.judgmentPositionLock;}}});
 E.on('era-equipped',(e,v)=>{if(is(card(e,v.uid),'Inzektor Firefly')&&series({id:v.equipId},'Inzektor'))e.revealCards(e.find(v.uid).owner,e.field(1-e.find(v.uid).owner).filter(m=>!m.faceUp),'甲虫装机 · 查看盖卡');});
 // Tribute reductions still validate the actual material, not just availability.
 const reduced=[['Darklord Desire',m=>def(m).race==='天使族'],["Gravekeeper's Visionary",m=>series(m,"Gravekeeper's")],['Super-Ancient Dinobeast',m=>def(m).race==='恐龙族'],['Blizzard Princess',m=>def(m).race==='魔法师族'],['Queen Angel of Roses',m=>def(m).race==='植物族'],['Fabled Dianaira',m=>series(m,'Fabled')],["Koa'ki Meiru Rooklord",m=>series(m,"Koa'ki Meiru")],['Steelswarm Girastag',m=>series(m,'Steelswarm')]];
 extend('tributeCount',function(prior,m){const p=this.state.active,rule=reduced.find(([n])=>is(m,n));if(rule&&this.monsters(p).some(rule[1]))return 1;if(is(m,'Metaion, the Timelord')&&!this.monsters(p).length||is(m,'Hammer Bounzer')&&!this.field(p).length&&this.field(1-p).length||is(m,'Mecha Sea Dragon Plesion')&&this.monsters(p).some(q=>this.race(q)==='海龙族')||is(m,'Galaxy Knight')&&this.monsters(p).some(q=>series(q,'Photon')||series(q,'Galaxy')))return 0;let n=prior.call(this,m);if(series(m,'Hazy Flame')&&(rawHas(this,'Hazy Pillar',p)||rawHas(this,'Hazy Glory',p)))n--;if(locked(this,p,'tributeReduction'))n--;return Math.max(0,n);});
 extend('tributeSets',function(prior,m,free=false,p=this.state.active){const list=prior.call(this,m,free,p),r=reduced.find(([n])=>is(m,n));return list.filter(uids=>{const cards=uids.map(uid=>card(this,uid));if(r&&cards.length===1&&!r[1](cards[0]))return false;if(is(m,'Troposphere')&&!cards.every(m=>this.race(m)==='鸟兽族'))return false;if(is(m,'Jawsman')&&!cards.every(m=>this.hasAttribute(m,'水')))return false;if(is(m,'Steelswarm Hercules')&&!cards.every(m=>series(m,'Steelswarm')))return false;return true;});});
 extend('normalSummon',function(prior,a){const r=prior.call(this,a);if(!this.state.pending&&locked(this,this.state.active,'tributeReduction'))delete this.state.players[this.state.active].eraLocks.tributeReduction;return r;});
 // Costs that replace one overlay still consume exactly one physical card.
 Object.assign(X,{live});
})(globalThis);
