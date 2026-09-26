(function(root){
  'use strict';
  const D=root.DuelData?.earlyLoaded?root.DuelData:require('./early-cards.js');
  const {CARDS,isMonster,isExtra,isFamily}=D;
  const defs={},byCard={},events={},ops={},endHandlers=[],passives={};
  const summonKeys=new Set(['monster-reborn::cast','ancient-rules::cast','polymerization::cast','miracle-fusion::cast','power-bond::cast','overload-fusion::cast','cyberload-fusion::cast','one-for-one::cast','kaibaman::transform','skilled-magician::transform','hero-solid-soldier::normal-special','hero-solid-soldier::grave-revive','hero-liquid-soldier::revive','hero-bubbleman::special','a-hero-lives::cast','mask-change::cast','bw-blizzard::revive','bw-shura::recruit','bw-zephyros::return','junk-synchron::revive','junk-converter::revive','doppelwarrior::special','doppelwarrior::tokens','quillbolt::revive','jet-synchron::revive','fleur-synchron::special','junk-speeder::recruit','formula-synchron::quick-synchro','cry-quandax::quick-synchro','goblindbergh::special','kagetokage::special','utopic-onomatopoeia::special','zubaba-gagagacoat::special','zubaba-gagagacoat::revive','dododo-gogogoglove::special','dododo-gogogoglove::revive','utopia-double::upgrade','limited-barians-force::cast','qli-disk::recruit','pendulum-reborn::cast','battle-fader::special','cyber-core::recruit','cyber-nachster::special','cyber-nachster::revive','cyber-vier::special','galaxy-soldier::special','cyber-revsystem::cast','machine-duplication::cast','cyber-nova::revive','cyber-nova::fusion','cry-sulfefnir::special','cry-sulfefnir::recruit','cry-thystvern::tuner','cry-smiger::tuner','cry-rosenix::tuner','cry-prasiortle::tuner','cry-rosenix::token','cry-prasiortle::special','cry-citree::quick-synchro','cry-quan::quick-synchro','cry-rion::quick-synchro','cry-impact::cast','cry-entry::cast','cry-ametrix::revive','cry-quandax::revive','cry-phoenix::revive','cry-quariongandrax::revive','samurai-destroyer::revive']);
  const destructionKeys=new Set(['raigeki::cast','dark-hole::cast','fissure::cast','mst::cast','mirror-force::cast','trap-hole::cast','icarus-attack::cast','hero-stratos::entry','hero-sunrise::battle-destroy','hero-absolute-zero::leave-wipe','masked-acid::wipe','junk-destroyer::destroy','qli-helix::destroy','bw-raikiri::destroy','utopia-ray-v::destroy','chimeratech-rampage::backrow','cry-sulfefnir::special','cry-thystvern::tuner','cry-smiger::tuner','cry-rosenix::tuner','cry-prasiortle::tuner','wavering-eyes::cast','cyber-infinity::negate','stardust-dragon::negate-destruction','shooting-star::negate-destruction']);
  const mainPhase=e=>['main1','main2'].includes(e.state.phase);
  const fieldZone=z=>['monsters','extraMonster'].includes(z);
  function register(id,mode,definition){
    const key=id+'::'+mode,d={id,mode,key,label:mode,zones:['monsters','extraMonster'],speed:1,main:true,destroys:destructionKeys.has(key),summons:summonKeys.has(key),...definition};
    defs[key]=d;const list=byCard[id]||=([]),prior=list.findIndex(a=>a.key===key);if(prior>=0)list[prior]=d;else list.push(d);return d;
  }
  for(const key of ['stardust-dragon::return','dododo-gogogoglove::expand','battle-fader::stop'])summonKeys.add(key);
  function get(key){return defs[key]||null;}
  function passive(id,handlers){passives[id]={...(passives[id]||{}),...(handlers.stat||handlers.battleStat?{stacking:true}:{}),...handlers};}
  function willSummon(e,link){const flag=get(link?.key)?.summons;return typeof flag==='function'?flag(e,link):!!flag;}
  function willDestroy(e,link){
    const d=get(link.key);if(!d?.destroys)return false;
    if(link.key==='hero-stratos::entry')return link.args.mode?.[0]==='mode:destroy';
    if(['cyber-infinity::negate','stardust-dragon::negate-destruction','shooting-star::negate-destruction'].includes(link.key)){
      const target=e.state.chain.find(l=>l.id===link.responseTo),f=target?e.find(target.uid):null;
      return !!f&&['monsters','extraMonster','spells','fieldSpell'].includes(f.zone);
    }
    return true;
  }
  function source(e,ctx){return e.find(ctx.uid);}
  function self(e,ctx){const f=source(e,ctx);return f&&fieldZone(f.zone)&&(f.card.generation||0)===ctx.source.generation?f.card:null;}
  function args(ctx,key='target'){return ctx.args[key]||[];}
  function first(ctx,key='target'){return args(ctx,key)[0]||null;}
  function frame(ctx){return ctx.event.window||ctx.event.attack&&{kind:'attack',attack:ctx.event.attack}||{};}
  function cards(e,owner,zones,filter=()=>true){return e.refs(owner,zones).filter(f=>filter(f.card,f)).map(f=>f.card);}
  function monsterCards(e,owner,zones,filter=()=>true){return cards(e,owner,zones,(c,f)=>isMonster(CARDS[c.id])&&filter(c,f));}
  // Candidate lists may carry either live card objects or bare uids; both are
  // accepted so a shared builder can pass whichever its caller already has.
  function options(e,ctx,list,extra={}){return list.map(item=>{const card=typeof item==="string"?e.find(item)?.card:item;return card?e.option(card,{viewer:ctx.owner,...extra}):null;}).filter(Boolean);}
  function group(e,ctx,key,title,list,min=1,max=1,extra={}){return {key,title,candidates:options(e,ctx,list),min,max,...extra};}
  function customGroup(key,title,choices,min=1,max=1,extra={}){return {key,title,candidates:choices,min,max,...extra};}
  function deck(e,owner,filter=()=>true){return cards(e,owner,['deck'],filter);}
  function grave(e,owner,filter=()=>true){return cards(e,owner,['grave'],filter);}
  function hand(e,owner,filter=()=>true){return cards(e,owner,['hand'],filter);}
  function field(e,owner,filter=()=>true){return e.field(owner).filter(c=>filter(c,e.find(c.uid)));}
  function monsters(e,owner,filter=()=>true){return e.monsters(owner).filter(c=>filter(c,e.find(c.uid)));}
  function specialable(e,owner,list,via='special'){return list.filter(c=>e.canSpecial(owner,c,{via})&&e.freeZones(owner,c).length);}
  function normal(c){return ['monster','pendulum'].includes(CARDS[c.id].type)&&!CARDS[c.id].effect;}
  function cyber(c){return !!CARDS[c.id].cyberDragon;}
  function cry(c){return !!CARDS[c.id].crystron;}
  function noBanishReplacement(e,owner){return !e.monsters(1-owner).some(c=>c.faceUp&&c.id==='masked-dark-law'&&!e.negated(c));}
  function canSendGY(e,card){
    if(e.graveCostAllowed?.(card)===false)return false;
    const f=e.find(card.uid);if(e._advancedReady&&(e.hasEarly('Macro Cosmos')||e.hasEarly('Banisher of the Radiance')||isMonster(CARDS[card.id])&&e.hasEarly('Dimensional Fissure')||f?.zone==='deck'&&e.hasEarly('Dimension Fortress Weapon')))return false;return !!f&&noBanishReplacement(e,card.originalOwner)&&CARDS[card.id].type!=='token'&&!(fieldZone(f.zone)&&card.banishOnLeave)&&!((CARDS[card.id].type==='pendulum'||CARDS[card.id].pendulum)&&(fieldZone(f.zone)||['spells','fieldSpell'].includes(f.zone)));
  }
  function discard(e,ctx,uids){for(const uid of uids){e.ownCard(uid,['hand'],ctx.owner);e.move(uid,'grave',{kind:'cost-discard',source:ctx.source,byOwner:ctx.owner});}}
  function sendCost(e,ctx,uids){for(const uid of uids){const f=e.find(uid);if(!f||!canSendGY(e,f.card))throw new root.DuelRuleError('这张卡不能实际送去墓地，因此不能支付这个代价。');}for(const uid of uids)e.move(uid,'grave',{kind:'cost-send',source:ctx.source,byOwner:ctx.owner});}
  function tributeCost(e,ctx,uids){for(const uid of uids){e.ownCard(uid,['monsters'],ctx.owner);if(CARDS[e.find(uid).card.id].cannotTribute)throw new root.DuelRuleError('这个衍生物不能被解放。');}for(const uid of uids)e.move(uid,'grave',{kind:'cost-tribute',source:ctx.source,byOwner:ctx.owner});}
  function detachInput(e,ctx,count=1){const card=source(e,ctx)?.card;return group(e,ctx,'cost','选择要移除的超量素材',card?.overlays||[],count,count,{role:'cost'});}
  function targetField(e,ctx,filter=()=>true,owner=1-ctx.owner){return field(e,owner,(c,f)=>filter(c,f));}
  function legalTarget(e,ctx,uid,predicate=()=>true){
    const f=e.find(uid);return f&&(fieldZone(f.zone)||['spells','fieldSpell'].includes(f.zone))&&predicate(f.card,f)&&!e.unaffected(f.card,ctx.source)?f:null;
  }
  function destroyTargets(e,ctx,key='target'){for(const uid of args(ctx,key))if(legalTarget(e,ctx,uid))e.destroy(uid,ctx.source);}
  function banishTargets(e,ctx,key='target'){for(const uid of args(ctx,key)){const f=e.find(uid);if(f&&(!fieldZone(f.zone)||!e.unaffected(f.card,ctx.source)))e.move(uid,'banished',{kind:'effect-banish',source:ctx.source,byOwner:ctx.owner});}}
  function bounceTargets(e,ctx,key='target'){for(const uid of args(ctx,key))if(legalTarget(e,ctx,uid))e.move(uid,'hand',{kind:'effect-return',source:ctx.source,byOwner:ctx.owner});}
  function trigger(id,mode,definition){return register(id,mode,{trigger:true,main:false,...definition});}
  function quick(id,mode,definition){return register(id,mode,{speed:2,...definition});}
  function spell(id,definition={}){
    const c=CARDS[id],quickPlay=c.spellKind==='quick';
    return register(id,'cast',{zones:['hand','spells'],cardActivation:true,effectType:'spell',speed:quickPlay?2:1,quickPlay,requiresField:['continuous','equip','field'].includes(c.spellKind),...definition});
  }
  function trap(id,definition={}){
    return register(id,'cast',{zones:['spells'],cardActivation:true,effectType:'trap',speed:CARDS[id].trapKind==='counter'?3:2,requiresField:CARDS[id].trapKind==='continuous',...definition});
  }
  function once(key='used',scope='name'){return {key,scope};}
  function isDamageWindow(w){return w?.attack&&['calc','resolving'].includes(w.attack.stage);}
  function canUse(e,ctx){
    const a=get(ctx.key);if(!a)return false;const f=e.find(ctx.uid),c=f?.card,d=CARDS[ctx.sourceId];
    if(!d)return false;
    if(e.earlyCanUse&&!e.earlyCanUse(ctx,a))return false;
    if(!a.virtual&&(!f||f.owner!==ctx.owner||(!a.generic&&a.id!==c.id)))return false;
    if(a.generic&&(!f||!a.generic(d)))return false;
    const handTrap=a.cardActivation&&d.type==='trap'&&f?.zone==='hand'&&(e.state.players[ctx.owner].handTrapTurn===e.state.turn&&!e.state.players[ctx.owner].handTrapUsed||!!a.handActivation?.(e,ctx));
    if(!a.virtual&&!a.zones.includes(f.zone)&&!(fieldZone(f.zone)&&a.zones.includes('monsters'))&&!handTrap)return false;
    if(f?.zone==='grave'&&e.state.players[ctx.owner].graveLockTurn===e.state.turn)return false;
    if(a.trigger&&ctx.origin!=='trigger')return false;
    if(!a.trigger&&ctx.origin==='trigger'&&!a.virtual)return false;
    if(!a.cardActivation&&!a.virtual&&f&&['spells','fieldSpell'].includes(f.zone)&&(!c.faceUp||c.pendingActivation))return false;
    if(f&&fieldZone(f.zone)&&(!c.faceUp&&!a.allowFaceDown||c.summonPending||c.cannotActivateUntil>=e.state.turn))return false;
    if(f&&fieldZone(f.zone)&&ctx.origin==='trigger'&&e.state.frame?.attack&&e.battleLocked(ctx.owner,e.state.frame.attack))return false;
    if((e.state.players[ctx.owner].nameLocks||[]).some(l=>l.id===ctx.sourceId&&l.turn===e.state.turn))return false;
    if(a.once&&c){
      const useCard=a.once.cardId?{...c,id:a.once.cardId}:c;
      if(e.wasUsed(ctx.owner,useCard,a.once.key||ctx.key,a.once.scope||'name',!!a.once.duel))return false;
    }
    if(ctx.origin==='main'){
      if(!a.main||ctx.owner!==e.state.active)return false;
      if(a.speed===1&&!mainPhase(e))return false;
      if(a.speed>=2&&!['main1','battle','main2'].includes(e.state.phase))return false;
    }
    const w=ctx.event.window||ctx.window?.context||{};
    if(ctx.origin==='window'){
      if(a.trigger||a.speed<2||a.inherent)return false;
      // A Summon attempt only accepts effects that negate the Summon. Other
      // fast effects get their opportunity after it succeeds, or on a chain.
      if(w.kind==='summon-attempt'&&!w.chainLast&&!a.summonNegation)return false;
      if(isDamageWindow(w)&&!a.damageStep)return false;
      if(a.cardActivation&&d.type==='spell'&&f.zone==='hand'&&ctx.owner!==e.state.active&&!e.handSpellAllowed?.(ctx,a))return false;
      if(!w.chainLast&&['main-open','battle-open'].includes(w.kind)&&ctx.owner===e.state.active)return false;
    }
    if(a.cardActivation){
      if(d.type==='trap'){
        const temple=e.hasEarly?.('Temple of the Kings',ctx.owner)&&!e.wasUsed(ctx.owner,{id:D.cardByName('Temple of the Kings').id},'same-turn-trap','name');
        if(!f||(!handTrap&&(f.zone!=='spells'||c.faceUp||c.setTurn>=e.state.turn&&c.effectSetActivationTurn!==e.state.turn&&!e.ruleAllowsSetActivation?.(c)&&!temple&&!(e.hasEarly?.('Night Wing Sorceress',ctx.owner)&&c.id===D.cardByName('Assault Mode Activate')?.id)&&!ctx.event.forcedTrap)))return false;
      }else if(f?.zone==='spells'){
        if(c.faceUp)return false;
        if((a.quickPlay||a.speed===2)&&c.setTurn>=e.state.turn&&!e.ruleAllowsSetActivation?.(c))return false;
      }
      if(f?.zone==='hand'&&d.spellKind!=='field'&&!a.pendulum&&!e.state.players[ctx.owner].spells.includes(null))return false;
    }
    if(a.wholeTurnExtra&&e.state.players[ctx.owner].turnStats.extraTypes.some(t=>t!==a.wholeTurnExtra))return false;
    if(a.wholeTurnNoSpecial&&e.state.players[ctx.owner].turnStats.special>0)return false;
    try{
      if(a.condition&&!a.condition(e,ctx))return false;
      // All currently known groups must be satisfiable before offering an
      // activation. Dependent groups are returned once their earlier choice is
      // present, so a cost prompt cannot strand a player with no legal target.
      if(inputGroups(e,ctx).some(g=>(g.max??1)<(g.min??1)||!Object.prototype.hasOwnProperty.call(ctx.args,g.key)&&(g.candidates||[]).length<(g.min??1)))return false;
    }catch{return false;}
    return true;
  }
  function inputGroups(e,ctx){
    const a=get(ctx.key),groups=a.inputs?a.inputs(e,ctx):[];
    for(const group of groups)if(e.canTarget&&!['cost','discard','send-cost','search','special','send-deck'].includes(group.role)&&group.key!=='cost')group.candidates=group.candidates.filter(o=>{const f=e.find(o.uid);return !f||!fieldZone(f.zone)||e.canTarget(f.card,ctx.source);});
    return groups;
  }
  function nextInput(e,ctx){return inputGroups(e,ctx).find(g=>!Object.prototype.hasOwnProperty.call(ctx.args,g.key))||null;}
  function available(e,owner,context={}){
    const out=[];
    for(const f of e.refs(owner,['hand','monsters','extraMonster','spells','fieldSpell','grave','banished','extra'])){
      if(context.onlyUid&&context.onlyUid!==f.card.uid)continue;
      for(const a of byCard[f.card.id]||[]){
        if(a.trigger||a.supersededByOriginal)continue;
        const origin=context.kind==='main'?'main':'window';
        // Match the cheap, unconditional gates in canUse before calculating
        // source ATK and continuous effects. This matters for large Graveyards
        // and copied effects whose source card is still in the Extra Deck.
        if(origin==='main'&&(!a.main||owner!==e.state.active))continue;
        if(origin==='window'&&(a.speed<2||a.inherent))continue;
        const handTrap=a.cardActivation&&CARDS[f.card.id].type==='trap'&&f.zone==='hand'&&(e.state.players[owner].handTrapTurn===e.state.turn&&!e.state.players[owner].handTrapUsed||!!a.handActivation);
        if(!a.virtual&&!a.zones.includes(f.zone)&&!(fieldZone(f.zone)&&a.zones.includes('monsters'))&&!handTrap)continue;
        if(a.copyTargetId&&f.card.gxCopy?.id!==a.copyTargetId)continue;
        const ctx=e.abilityContext(f.card.uid,a.key,origin,{owner,...(origin==='window'?{window:context}:{})});
        if(canUse(e,ctx))out.push({uid:f.card.uid,key:a.key,label:a.label,cardId:f.card.id,speed:a.speed});
      }
    }return out;
  }
  function payCost(e,ctx){const a=get(ctx.key),before=e._aiMarginalCost?.before(ctx);try{if(a.cost)a.cost(e,ctx);}finally{e._aiMarginalCost?.after(ctx,before);}}
  function resolve(e,ctx){const a=get(ctx.key);if(a.resolve)a.resolve(e,ctx);}
  function on(type,fn){(events[type]||=[]).push(fn);}
  function onEvent(e,event){for(const fn of events[event.type]||[])fn(e,event);}
  function op(name,fn){ops[name]=fn;}
  function operation(e,task){const fn=ops[task.op];if(!fn)throw new Error('Unimplemented effect continuation: '+task.op);fn(e,task);}
  function endPhase(e,owner){for(const fn of endHandlers)fn(e,owner);}
  function onNegated(e,link){
    const a=get(link.key);
    if(a.onlyActivate&&a.once){
      const token=link.sourceId+'::'+a.once.key;e.state.players[link.owner].usedTurn[token]=-1;
    }
    onEvent(e,{type:'activation-negated',owner:link.owner,uid:link.uid,id:link.sourceId,byOwner:link.negatedBy,link});
  }
  function validateInput(e,ctx,g,uids){
    if(g.validator?.startsWith('early-')&&e.earlyValidateInput)return e.earlyValidateInput(ctx,g,uids);
    if(g.validator==='onomat'){
      const groups=uids.map(uid=>{const c=CARDS[e.find(uid).card.id];return ['gagaga','gogogo','dododo','zubaba'].filter(f=>isFamily(c,f));});
      const walk=(i,used)=>i===groups.length||groups[i].some(x=>!used.includes(x)&&walk(i+1,[...used,x]));
      return walk(0,[])||'每个拟声系列最多选择1只；有多个系列名的怪兽可任选其中1个系列。';
    }
    return true;
  }
  function candidateScore(e,ctx,option,role='target'){
    if(!option.cardId){if(option.hidden)return 1700;return option.value||0;}
    const f=e.find(option.uid),c=CARDS[option.cardId],owner=ctx.owner,p=e.state.players[owner];
    if(!f)return 0;
    if(API.extraCandidateScore){const score=API.extraCandidateScore(e,ctx,option,role);if(Number.isFinite(score))return score;}
    if(['cost','discard','send-cost'].includes(role)){
      let n=-e.cardUtility(f.card,owner);
      if(['cyber-herz','jet-synchron','quillbolt','bw-zephyros','cry-sulfefnir','cry-thystvern','cry-smiger','cry-rosenix','junk-converter','dododo-gogogoglove'].includes(c.id))n+=6000;
      return n;
    }
    if(role==='destroy'||role==='banish'||role==='bounce'){
      if(f.owner===owner)return -5000+(f.card.id===ctx.sourceId?200:0);
      if((fieldZone(f.zone)||f.zone==='spells')&&!f.card.faceUp)return 1700;
      return isMonster(c)?e.attackValue(f.card)+1200:(c.type==='pendulum'?3200:c.spellKind==='continuous'||c.trapKind==='continuous'?2900:1700);
    }
    if(role==='self-destroy')return f.card.uid===ctx.uid?12000:CARDS[f.card.id].crystron?9000:CARDS[f.card.id].type==='token'?5000:-e.cardUtility(f.card,owner);
    if(role==='own-boost'){
      const a=ctx.event.window?.attack;return f.owner!==owner?-20000:(a&&(a.uid===f.card.uid||a.target===f.card.uid)?20000:10000)+(c.atk||0);
    }
    if(role==='mask-target')return c.id==='hero-absolute-zero'?25000:c.id==='hero-shadow-mist'?20000:c.masked?1000:5000+(c.atk||0);
    if(role==='fusion-choice'){
      if(c.id==='hero-sunrise')return e.monsters(owner).some(m=>m.id===c.id)?3500:12000;
      if(c.id==='hero-absolute-zero')return hand(e,owner,m=>m.id==='mask-change').length?14000:9500;
      if(c.id==='chimeratech-rampage')return 16000;
      return c.atk||0;
    }
    if(role==='send-deck'){
      const scores={'cyber-herz':9000,'cyber-dragon':6000,'hero-shadow-mist':8500,'hero-liquid-soldier':ctx.sourceId==='hero-blazeman'?10000:1000,'jet-synchron':8500,'quillbolt':7500,'doppelwarrior':hand(e,owner,m=>m.id==='junk-synchron').length?9500:4000,'junk-converter':6000,'cry-sulfefnir':10000,'cry-thystvern':8500,'cry-smiger':7000,'cry-rosenix':6500,'dododo-gogogoglove':8500};
      return scores[c.id]||500;
    }
    if(role==='search'){
      if(c.exodiaPart)return p.hand.some(h=>CARDS[h.id].exodiaPart===c.exodiaPart)?100:30000;
      const h=ids=>p.hand.some(c=>ids.includes(c.id)),m=ids=>e.monsters(owner).some(c=>ids.includes(c.id));
      if(c.id==='royal-library')return h([c.id])||m([c.id])?500:17000;
      if(c.id==='qli-scout')return e.scales(owner).some(s=>s?.card.id===c.id)?6000:18000;
      if(c.id==='qli-monolith')return e.scales(owner).some(s=>s?.scale===1)?4000:16000;
      if(c.id==='bw-gale')return h([c.id])||m([c.id])?5000:14000;
      if(c.id==='hero-stratos')return h([c.id])||e.state.normalUsed?7000:15000;
      if(c.id==='hero-shadow-mist')return h([c.id])?5000:13000;
      if(c.id==='hero-liquid-soldier')return h([c.id])?4000:10500;
      if(c.id==='cyber-core')return h([c.id])||e.state.normalUsed?6500:16000;
      if(c.id==='cyber-nachster')return p.grave.some(x=>CARDS[x.id].atk===2100)?14000:7000;
      if(c.id==='cyber-herz')return h([c.id])?3000:11000;
      if(c.id==='junk-synchron')return h([c.id])?6000:16000;
      if(c.id==='cry-sulfefnir')return h([c.id])||grave(e,owner,m=>m.id===c.id).length?6000:14000;
      if(c.id==='golden-bamboo')return 15000;
      if(c.id==='cursed-bamboo')return 13000;
      return e.cardUtility(f.card,owner);
    }
    if(role==='synchrons')return {'junk-synchron':9000,'jet-synchron':8500,'fleur-synchron':7000,'quickdraw-synchron':6000}[c.id]||1000;
    if(role==='special'){
      if(c.id==='hero-stratos')return 15000;
      if(c.id==='hero-shadow-mist')return 14000;
      if(c.id==='cry-citree')return 14000;
      if(c.id==='cry-quan')return 11000;
      if(c.id==='cyber-dragon')return 10000;
      return (c.atk||0)+e.cardUtility(f.card,owner)/3;
    }
    if(role==='xyz-upgrade'){
      if(ctx.sourceId==='utopia-double')return c.id==='utopia'?14000:c.id==='utopia-lightning'?12000:(c.atk||0);
      return (c.atk||0)+(c.id==='cyber-infinity'?10000:0);
    }
    return f.owner===owner?e.cardUtility(f.card,owner):c.atk||1500;
  }
  function aiPick(e,ctx,g){
    if(g.aiValues)return g.aiValues(e,ctx);
    const ranked=[...g.candidates].sort((a,b)=>candidateScore(e,ctx,b,g.role)-candidateScore(e,ctx,a,g.role));
    const target=Math.min(g.max??1,ranked.length),chosen=[];
    for(const c of ranked){
      if(chosen.length>=target)break;
      if(chosen.length>=(g.min??1)&&['destroy','banish','bounce'].includes(g.role)&&candidateScore(e,ctx,c,g.role)<=0)continue;
      const trial=[...chosen,c.uid];
      if(g.distinct&&chosen.some(uid=>g.candidates.find(x=>x.uid===uid)[g.distinct]===c[g.distinct]))continue;
      if(g.validator&&validateInput(e,ctx,g,trial)!==true)continue;
      chosen.push(c.uid);
    }
    return chosen.length>=(g.min??1)?chosen:ranked.slice(0,g.min??1).map(c=>c.uid);
  }
  function aiChoice(e,p){
    const ctx={owner:p.owner,sourceId:p.context?.source?.id||p.context?.sourceId||'',args:{},event:p.context||{},uid:p.context?.source?.uid||''};
    const g={candidates:p.candidates,min:p.min,max:p.max,role:p.context?.role||'special',validator:p.context?.validator,distinct:p.context?.distinct};
    if(p.context?.preferIds){g.candidates=[...p.candidates].sort((a,b)=>p.context.preferIds.indexOf(a.cardId)-p.context.preferIds.indexOf(b.cardId));return g.candidates.slice(0,p.max).map(c=>c.uid);}
    return aiPick(e,ctx,g);
  }
  function aiTrigger(e,ctx){
    if(ctx.event.mandatory)return true;
    const a=get(ctx.key),f=e.find(ctx.uid),wanted=a.aiTrigger?a.aiTrigger(e,ctx):!(f&&fieldZone(f.zone)&&e.negated(f.card)&&!a.leavesAsCost);
    if(!wanted)return false;
    const action={type:'respond',uid:ctx.uid,key:ctx.key},score=root.DuelAIMarginal?root.DuelAIMarginal.score(e,action,ctx.owner,1):1;
    return (root.DuelAITactics?root.DuelAITactics.response(e,action,ctx.owner,score):score)>0;
  }
  function aiResponse(e,item,w,owner){
    const a=get(item.key),ctx=e.abilityContext(item.uid,item.key,'window',{owner,window:w});
    const score=a.aiResponse?a.aiResponse(e,ctx,w):a.aiScore?(typeof a.aiScore==='function'?a.aiScore(e,ctx):a.aiScore):w.chainLast&&w.chainLast.owner!==owner?200:0;
    const action={type:'respond',uid:item.uid,key:item.key},value=root.DuelAIMarginal?root.DuelAIMarginal.score(e,action,owner,score):score;
    const gated=root.DuelAITactics?root.DuelAITactics.response(e,action,owner,value):value;
    return root.DuelAIPlanner?root.DuelAIPlanner.responseGate(e,action,owner,gated):gated;
  }
  const H={mainPhase,fieldZone,source,self,args,first,frame,cards,monsterCards,options,group,customGroup,deck,grave,hand,field,monsters,specialable,normal,cyber,cry,noBanishReplacement,canSendGY,discard,sendCost,tributeCost,detachInput,targetField,legalTarget,destroyTargets,banishTargets,bounceTargets,once,isDamageWindow};
  const API={register,get,byCard,willDestroy,willSummon,passive,passives,trigger,quick,spell,trap,on,op,ops,endHandlers,canUse,nextInput,available,payCost,resolve,onEvent,operation,endPhase,onNegated,validateInput,candidateScore,aiPick,aiChoice,aiTrigger,aiResponse,H,defs};
  root.DuelEffects=API;
  if(typeof module!=='undefined'&&module.exports){
    module.exports=API;
    require('./ai-marginal.js');
    require('./ai-tactics.js');
    require('./ai-planner.js');
    for(const file of ['effects-classic','effects-hero','effects-blackwing','effects-synchron','effects-utopia','effects-qliphort','effects-exodia','effects-cyber','effects-crystron','effects-tearlaments','effects-link','effects-early','effects-early-complex','effects-early-advanced','effects-2002','effects-2003','effects-2004','effects-2005','effects-2006','effects-2007','effects-2008','effects-year-final','effects-chronicle','effects-2009','effects-2010','effects-2011','effects-2012','effects-2013','effects-chronicle-contracts','chronicle-rules','effects-2014','effects-2015'])require('./'+file+'.js');
  }
})(typeof globalThis!=='undefined'?globalThis:this);
