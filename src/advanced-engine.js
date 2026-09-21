(function (root) {
  'use strict';
  const D = root.DuelData?.earlyLoaded ? root.DuelData : require('./early-cards.js');
  if(typeof module!=='undefined'&&!D.earlyDecksLoaded)require('./early-decks.js');
  const LinkRules = root.DuelLinkRules || require('./link-rules.js');
  const DT = root.DuelDecks || require('./deck-tools.js');
  const Base = root.LegacyDuelEngine || root.DuelEngine || require('./engine.js').DuelEngine;
  const RuleError = root.DuelRuleError || require('./engine.js').RuleError;
  const {CARDS,DECKS,isMonster,isExtra,isFamily} = D;
  const cp = v => JSON.parse(JSON.stringify(v));
  const present = a => a.filter(Boolean);
  const fieldMonster = zone => zone === 'monsters' || zone === 'extraMonster';
  const referenceZones = ['hand','monsters','extraMonster','spells','fieldSpell','grave','extra','banished','deck'];
  const locationHints = new WeakMap();
  const rememberLocation = (engine,uid,found) => {
    let hints=locationHints.get(engine);if(!hints){hints=new Map();locationHints.set(engine,hints);}
    hints.set(uid,{owner:found.owner,zone:found.zone,index:found.index,storageKey:found.storageKey,parentUid:found.parentUid});return found;
  };
  const req = (ok,msg) => {if(!ok)throw new RuleError(msg);};
  const subsets = (cards,min=1,max=cards.length) => {
    const result=[];
    function walk(at,chosen) {if(chosen.length>=min)result.push([...chosen]);if(chosen.length>=max)return;for(let i=at;i<cards.length;i++){chosen.push(cards[i]);walk(i+1,chosen);chosen.pop();}}
    walk(0,[]);return result;
  };
  class ModernDuelEngine extends Base {
    constructor(options={}) {
      if(!root.DuelEffects&&typeof require==='function')require('./advanced-effects.js');
      for(const [index,id] of [options.deck||'blue',options.opponentDeck||((options.deck||'blue')==='blue'?'dark':'blue')].entries()) {
        const spec=options.deckSpecs?.[index]||DECKS[id];
        req(!!spec&&(!options.deckSpecs||spec.id===id),'找不到这套卡组。');const check=DT.analyze(spec);req(check.valid,check.errors.join(' '));
      }
      super({...options,openingGuarantee:options.openingGuarantee===true});
      this.initModern();
      this.state.originalCardCount=this.physicalCards().filter(c=>CARDS[c.id].type!=='token').length;
      this.state.version=3;
      this.checkWin();
      this.assertState();
    }
    get fx(){return root.DuelEffects || (typeof require==='function'?require('./advanced-effects.js'):null);}
    initModern() {
      const s=this.state;
      s.chain ||= [];s.chainCleanup ||= [];s.triggers ||= [];s.tasks ||= [];s.chainResolving ||= false;
      s.building ||= null;s.frame ||= null;s.resolvingLink ||= null;s.delayed ||= [];s.nextLink ||= 1;s.nextTrigger ||= 1;
      s.duelFlags ||= {};s.lastNegatedAttack ||= null;s.version=3;s.damage ||= [0,0];s.summons ||= [0,0];s.nextChain ||= 1;s.chainId ??= null;
      if(s.chain.length&&s.chainId===null)s.chainId=s.nextChain++;
      for(const [index,link] of s.chain.entries()){link.chainId??=s.chainId;link.chainNumber??=index+1;}
      s.chainHistory ||= [];
      for(let i=0;i<2;i++){
        const p=s.players[i];p.banished ||= [];p.extraMonster ||= null;p.extraMonster2 ||= null;p.fieldSpell ||= null;p.usedTurn ||= {};p.duelUsed ||= {};
        if(p.extraMonster)p.extraMonster.extraSlot ??= i;
        if(p.extraMonster2)p.extraMonster2.extraSlot ??= 1-i;
        p.locks ||= [];p.turnStats ||= {special:0,extraTypes:[],qliTributes:0,crySynchros:0};p.skipDraws ||= 0;p.extraNormalUsed ||= false;
        p.preventDamageUntil ??= -1;p.wabokuTurn ??= -1;
        p.deckSpec ||= cp(DECKS[p.deckId]);
        for(const c of this.playerPhysicalCards(i)){c.originalOwner??=i;c.overlays ||= [];c.mods ||= [];c.used ||= {};c.attacksMade ||= 0;}
      }
      this._advancedReady=true;
    }
    makeCard(id,owner=this.state.players.length) {return {...super.makeCard(id,owner),overlays:[],mods:[],used:{},attacksMade:0,faceUpExtra:false,properlySummoned:false,summonKind:null,generation:0};}
    deckInfo(owner){return this.state.players[owner].deckSpec || DECKS[this.state.players[owner].deckId];}
    name(owner){return owner===0?'你':this.deckInfo(owner).player;}
    extraMonsters(owner){const p=this.state.players[owner];return [p.extraMonster,p.extraMonster2].filter(Boolean);}
    monsters(owner){const p=this.state.players[owner];return [...present(p.monsters),...this.extraMonsters(owner)];}
    spells(owner){const p=this.state.players[owner];return [...present(p.spells),...(p.fieldSpell?[p.fieldSpell]:[])];}
    field(owner){return [...this.monsters(owner),...this.spells(owner)];}
    playerPhysicalCards(owner){
      const p=this.state.players[owner],all=['deck','hand','monsters','spells','grave','extra','banished'].flatMap(z=>present(p[z]||[]));
      all.push(...this.extraMonsters(owner));if(p.fieldSpell)all.push(p.fieldSpell);
      const result=[];for(const c of all){result.push(c);for(const m of c.overlays||[])result.push(m);}return result;
    }
    physicalCards(){return [0,1].flatMap(owner=>this.playerPhysicalCards(owner));}
    refs(owner,zones=referenceZones){
      const p=this.state.players[owner],out=[];
      for(const zone of zones){
        if(zone==='extraMonster'){for(const storageKey of ['extraMonster','extraMonster2'])if(p[storageKey])out.push({owner,zone,index:p[storageKey].extraSlot??owner,storageKey,card:p[storageKey]});}
        else if(zone==='fieldSpell'){if(p[zone])out.push({owner,zone,index:0,card:p[zone]});}
        else for(let index=0;index<(p[zone]||[]).length;index++){const card=p[zone][index];if(card)out.push({owner,zone,index,card});}
      }
      return out;
    }
    find(uid){
      if(!uid)return null;
      // Hints contain locations, never card objects. Validate the actual live
      // slot on every read; direct writes, rollback, shuffle and control changes
      // need no invalidation and projections never share another engine's hints.
      const hint=locationHints.get(this)?.get(uid);
      if(hint){
        if(hint.zone==='overlays'){
          const parent=this.find(hint.parentUid),card=parent?.card.overlays?.[hint.index];
          if(card?.uid===uid)return {owner:parent.owner,zone:'overlays',index:hint.index,card,parentUid:parent.card.uid,parent:parent.card};
        }else{
          const p=this.state.players[hint.owner],extra=hint.zone==='extraMonster',card=extra?p?.[hint.storageKey]:hint.zone==='fieldSpell'?p?.fieldSpell:p?.[hint.zone]?.[hint.index];
          if(card?.uid===uid)return extra?{owner:hint.owner,zone:hint.zone,index:card.extraSlot??hint.owner,storageKey:hint.storageKey,card}:{owner:hint.owner,zone:hint.zone,index:hint.index,card};
        }
      }
      // A full search allocates only the matching reference, not one object for
      // every card in both Decks during each stat or continuous-effect query.
      for(let owner=0;owner<2;owner++){
        const p=this.state.players[owner];
        for(const zone of referenceZones){
          const extra=zone==='extraMonster',single=zone==='fieldSpell',size=extra?2:single?1:p[zone]?.length||0;
          for(let at=0;at<size;at++){
            const storageKey=extra?(at?'extraMonster2':'extraMonster'):zone,card=extra||single?p[storageKey]:p[zone][at];
            if(!card)continue;
            if(card.uid===uid)return rememberLocation(this,uid,extra?{owner,zone,index:card.extraSlot??owner,storageKey,card}:{owner,zone,index:at,card});
            for(let index=0;index<(card.overlays?.length||0);index++)if(card.overlays[index].uid===uid)return rememberLocation(this,uid,{owner,zone:'overlays',index,card:card.overlays[index],parentUid:card.uid,parent:card});
          }
        }
      }return null;
    }
    ownCard(uid,zones,owner=this.state.active){
      const f=this.find(uid);
      req(f && f.owner===owner && (zones.includes(f.zone)||(fieldMonster(f.zone)&&zones.includes('monsters'))),'无法在这个位置使用此卡。');return f;
    }
    remove(uid){
      const f=this.find(uid);req(f,'这张卡已经离开原来的位置。');
      const p=this.state.players[f.owner];
      if(f.zone==='overlays')f.parent.overlays.splice(f.index,1);
      else if(['extraMonster','fieldSpell'].includes(f.zone))p[f.storageKey||f.zone]=null;
      else if(['monsters','spells'].includes(f.zone))p[f.zone][f.index]=null;
      else p[f.zone].splice(f.index,1);
      return f;
    }
    describe(card,found=this.find(card.uid)){
      const c=CARDS[card.id];return {id:card.id,uid:card.uid,generation:card.generation||0,owner:found?.owner??card.originalOwner,zone:found?.zone,originalOwner:card.originalOwner,faceUp:card.faceUp,position:card.position,summonKind:card.summonKind,properlySummoned:card.properlySummoned,level:this.level(card),rank:c.rank||0,atk:this.attackValue(card),def:this.defenseValue(card),materialCount:card.materialCount||0,normalSummoned:!!card.normalSummoned,wasNegated:this.negated(card),family:c.family,tuner:this.isTuner(card)};
    }
    emit(event){if(this._advancedReady && this.state.winner===null && this.fx)this.fx.onEvent(this,event);}
    addTrigger(uid,key,event={},extra={}){
      const f=this.find(uid),owner=extra.owner??f?.owner??event.owner;
      if(![0,1].includes(owner))return;
      const sourceId=extra.sourceId||f?.card.id||event.id;
      this.state.triggers.push({id:'t'+this.state.nextTrigger++,uid,key,owner,sourceId,event:cp(event),priority:extra.priority??(event.type==='summon'?10:20),mandatory:!!extra.mandatory,...extra});
    }
    move(uid,destination,options={}){
      const before=this.find(uid);req(before,'卡片已经离开原来的位置。');
      const card=before.card,c=CARDS[card.id],snapshot=this.describe(card,before),wasField=fieldMonster(before.zone)||['spells','fieldSpell'].includes(before.zone);
      let dest=destination,owner=options.owner??card.originalOwner;
      if(fieldMonster(before.zone)&&card.banishOnLeave&&dest!=='overlays'&&!options.ignoreLeaveReplacement)dest='banished';
      if(dest==='grave'&&!options.ignoreReplacement){
        if(this.monsters(1-card.originalOwner).some(m=>m.faceUp&&m.id==='masked-dark-law'&&!this.negated(m)))dest='banished';
        else if(c.type==='pendulum'&&wasField&&!options.negatedActivation)dest='extra-up';
      }
      if(dest==='hand'&&isExtra(c))dest='extra-down';
      if(dest==='deck'&&isExtra(c))dest='extra-down';
      const detached=[...(card.overlays||[])];
      if(fieldMonster(before.zone)&&dest!=='overlays'){
        for(const material of detached)this.move(material.uid,'grave',{reason:'超量素材随主体离场',kind:'rule-material',ignoreLeaveReplacement:true});
      }
      this.remove(uid);
      if(c.type==='token'){
        this.log('destroy',c.name+'离场并消失',before.owner,{cardId:c.id,uid});
        this.cleanupEquips(uid,{uid,id:c.id,owner:before.owner,from:before.zone,to:'vanished',kind:options.kind,atk:snapshot.atk,originalAtk:snapshot.originalAtk??c.atk??0,originalDef:snapshot.originalDef??c.def??0});this.emit({type:'move',uid,id:c.id,owner:before.owner,from:before.zone,to:'vanished',previous:snapshot,...options});
        return {card,from:before.zone,to:'vanished',owner:before.owner,destroyed:options.kind==='destroy'||options.kind==='battle'};
      }
      if(dest!=='overlays'){
        const generation=(card.generation||0)+1;
        for(const key of Object.keys(card))if(!['id','uid','originalOwner','properlySummoned'].includes(key))delete card[key];
        card.generation=generation;
        card.overlays=[];card.mods=[];card.used={};card.counters=0;card.turnsLeft=0;card.attacksMade=0;card.attacked=false;
        card.normalSummoned=false;card.effectNegated=false;card.cannotActivateUntil=-1;card.banishOnLeave=false;card.equipTarget=null;
        card.qliReduced=false;card.granted={};card.dynamicTuner=false;card.galeSet=null;card.extraAttacks=0;
        card.levelOverride=null;card.attributeOverride=null;card.attackOnlyMonsters=false;card.noDirect=false;card.doubleNextAttack=false;card.battleBoost=null;
        card.wedge=0;card.effectProtectedUntil=-1;card.battleProtectedUntil=-1;card.effectIndestructible=false;card.summonKind=null;
      }
      card.faceUp=true;card.faceUpExtra=dest==='extra-up';card.sentTurn=this.state.turn;
      if(dest==='extra-down'){card.faceUp=false;card.properlySummoned=false;}
      if(['hand','deck'].includes(dest))card.properlySummoned=false;
      if(dest==='extra-up'||dest==='extra-down')this.state.players[owner].extra.push(card);
      else {req(['hand','deck','grave','banished'].includes(dest),'无效的移动区域。');this.state.players[owner][dest].push(card);}
      if(wasField)this.cleanupEquips(uid,{uid,id:c.id,owner:before.owner,from:before.zone,to:dest,kind:options.kind,atk:snapshot.atk,originalAtk:snapshot.originalAtk??c.atk??0,originalDef:snapshot.originalDef??c.def??0});
      if(options.log!==false){
        const labels={grave:'送入墓地',banished:'被除外',hand:'返回手牌',deck:'洗回卡组','extra-up':'表侧加入额外卡组','extra-down':'返回额外卡组'};
        this.log(options.kind==='battle'||options.kind==='destroy'?'destroy':'move',c.name+' '+(labels[dest]||dest),before.owner,{cardId:c.id,uid,reason:options.reason||''});
      }
      this.emit({type:'move',uid,id:c.id,owner:before.owner,from:before.zone,to:dest,previous:snapshot,...options,byEffect:this.effectMove(options)});
      return {card,from:before.zone,to:dest,owner,destroyed:options.kind==='destroy'||options.kind==='battle'};
    }
    toGrave(uid,reason='',event=true){return this.move(uid,'grave',{reason,log:event,kind:reason.includes('祭品')?'tribute':'send'}).card;}
    effectMove(options={}){
      if(options.byEffect!==undefined)return !!options.byEffect;
      const kind=options.kind||'';
      if(/^(cost|rule|link-material|synchro-material|tribute|detach|battle)/.test(kind))return false;
      return kind==='destroy'||kind==='fusion-material'||kind.startsWith('effect-');
    }
    mill(owner,count,source){
      const cards=this.state.players[owner].deck.slice(0,count),sent=[];
      for(const card of cards){const moved=this.move(card.uid,'grave',{kind:'effect-mill',source,byOwner:source?.owner??owner});if(moved.to==='grave')sent.push(card.uid);}
      this.log('mill',this.name(owner)+'将卡组顶'+cards.length+'张卡送墓',owner,{count:cards.length,sourceId:source?.id});return sent;
    }
    cleanupEquips(targetUid,targetMove=null){
      if(!this._advancedReady)return;
      // The target may already be in its owner's GY. Preserve its last field
      // controller and original stats for linked cards instead of looking it up
      // after the move and accidentally charging its owner.
      for(let p=0;p<2;p++)for(const equip of [...this.spells(p)])if(equip.equipTarget===targetUid)this.move(equip.uid,'grave',{kind:'rule-equip',reason:'装备对象离场',...(targetMove?{equipTargetMove:targetMove,equipWasActive:this.activeSpell(equip)}:{})});
    }
    activeEquip(card,id=null){const f=this.find(card.uid);if(!f)return[];return [0,1].flatMap(p=>this.spells(p)).filter(s=>s.equipTarget===card.uid&&(!id||s.id===id)&&this.activeSpell(s));}
    negated(card){
      if(!this._advancedReady)return !!card.effectNegated;
      const f=this.find(card.uid);if(!f||!fieldMonster(f.zone)||!card.faceUp)return false;
      if((this.state.battleNegated||[]).includes(card.uid))return true;
      if(card.effectNegated||card.negatedUntil>=this.state.turn)return true;
      if(card.id==='qli-towers')return false;
      return [0,1].some(p=>this.spells(p).some(c=>c.id==='skill-drain'&&this.activeSpell(c)));
    }
    level(card){const c=CARDS[card.id];if(['xyz','link'].includes(c.type))return 0;if(card.qliReduced&&!this.negated(card))return 4;return card.levelOverride&&(!card.levelOverride.until||card.levelOverride.until>=this.state.turn)?card.levelOverride.value:c.level||0;}
    attribute(card){return card.attributeOverride&&(card.attributeOverride.until==null||card.attributeOverride.until>=this.state.turn)?card.attributeOverride.value:CARDS[card.id].attribute;}
    isTuner(card){return !!(CARDS[card.id].tuner||(card.dynamicTuner&&!this.negated(card)));}
    cardNameId(card,zone=null){
      const f=this.find(card.uid),where=zone||f?.zone,c=CARDS[card.id];
      return c.cyberName&&(fieldMonster(where)||where==='grave')&&!this.negated(card)?'cyber-dragon':card.id;
    }
    originalAttack(card){
      const c=CARDS[card.id];
      if(card.qliReduced&&!this.negated(card))return 1800;
      if(c.id==='chimeratech-overdragon'&&!this.negated(card))return (card.materialCount||0)*800;
      if(this._advancedReady&&!this.negated(card)&&this.fx.passives?.[c.id]?.originalAttack)return this.fx.passives[c.id].originalAttack(this,card);
      return c.atk||0;
    }
    originalDefense(card){return card.id==='chimeratech-overdragon'&&!this.negated(card)?(card.materialCount||0)*800:CARDS[card.id].def||0;}
    attackValue(card,battle=null){return this.stat(card,'atk',battle);}
    defenseValue(card,battle=null){return CARDS[card.id].type==='link'?0:this.stat(card,'def',battle);}
    stat(card,stat,battle=null){
      if(!card)return 0;const c=CARDS[card.id],f=this.find(card.uid),off=this.negated(card);
      let n=stat==='atk'?this.originalAttack(card):this.originalDefense(card);
      if(!off&&stat==='atk'){
        if(c.effect==='breaker')n+=(card.counters||0)*300;
        if(c.effect==='dark-girl')n+=this.state.players.reduce((a,p)=>a+p.grave.filter(m=>m.id==='dark-magician').length*300,0);
        if(c.id==='cyber-infinity')n+=(card.overlays||[]).length*200;
        if(c.id==='hero-the-shining'&&f)n+=(this.state.players[f.owner].banished||[]).filter(m=>CARDS[m.id].elemental).length*300;
        if(c.id==='hero-absolute-zero')n+=[0,1].reduce((a,p)=>a+this.monsters(p).filter(m=>m.uid!==card.uid&&m.faceUp&&this.attribute(m)==='水').length*500,0);
      }
      if(f&&fieldMonster(f.zone)&&card.faceUp&&this._advancedReady){
        const owner=f.owner;
        for(const source of this.monsters(owner))if(source.faceUp&&!this.negated(source)){
          if(source.id==='hero-sunrise'&&stat==='atk')n+=new Set(this.monsters(owner).filter(m=>m.faceUp).map(m=>this.attribute(m))).size*200;
          if(source.id==='cyber-vier'&&source.uid!==card.uid&&this.cardNameId(card)==='cyber-dragon')n+=500;
        }
        for(let p=0;p<2;p++){
          for(const source of this.monsters(p))if(source.faceUp&&source.id==='qli-towers'&&!this.negated(source)&&card.summonKind&&card.summonKind!=='normal'&&card.summonKind!=='set')n-=500;
          for(const source of this.spells(p))if(this.activeSpell(source)){
            if(stat==='atk'&&p===owner&&['qli-carrier','qli-disk','qli-stealth'].includes(source.id)&&c.family==='qliphort')n+=300;
            if(stat==='atk'&&p!==owner&&source.id==='qli-helix')n-=300;
            if(p===owner&&source.id==='crystolic-potential'&&c.family==='crystron')n+=300;
          }
        }
        if(stat==='atk')for(const equip of this.activeEquip(card))n+=equip.id==='saqlifice'?300:equip.id==='wonder-wand'?500:0;
      }
      if(f&&fieldMonster(f.zone)&&card.faceUp&&this._advancedReady)for(const source of this.passiveSources()){
        const handler=this.fx.passives?.[source.card.id]?.stat;if(handler)n+=handler(this,source,card,stat)||0;
      }
      for(const mod of card.mods||[])if((!mod.until||mod.until>=this.state.turn)&&(mod.stat===stat||mod.stat==='both')){
        if(mod.kind==='add')n+=mod.value;else if(mod.kind==='set')n=mod.value;else if(mod.kind==='half')n=Math.floor(n/2);else if((mod.kind==='multiply'||mod.kind==='mul'))n*=mod.value;
      }
      if(battle&&stat==='atk'){
        const mine=card.uid===battle.uid,enemy=this.find(mine?battle.target:battle.uid)?.card;
        if(!off&&c.id==='bw-armed-wing'&&mine&&enemy?.position==='defense')n+=500;
        if(card.battleBoost==='cowboy'&&mine&&enemy)n+=1000;
        if(enemy?.battleBoost==='cowboy'&&!mine)n-=500;
        if(card.lightningTurn===this.state.turn&&card.lightningAttack===battle.serial)n=5000;
        if(battle.double&&mine)n*=2;
      }
      return Math.max(0,Math.floor(n));
    }
    modify(uid,stat,kind,value,until=null,source=null){
      const f=this.find(uid);if(!f||!fieldMonster(f.zone)||!f.card.faceUp||this.unaffected(f.card,source))return false;
      if(stat==='def'&&CARDS[f.card.id].type==='link')return false;
      f.card.mods.push({stat,kind,value,until});return true;
    }
    passiveSources(){return [0,1].flatMap(owner=>this.refs(owner,['monsters','extraMonster','spells','fieldSpell'])).filter(f=>f.card.faceUp&&this.fx.passives?.[f.card.id]&&(fieldMonster(f.zone)?!this.negated(f.card):this.activeSpell(f.card)));}
    unaffected(card,source){
      if(!source||this.negated(card)||!card.faceUp)return false;
      const f=this.find(card.uid),c=CARDS[card.id];if(!f||!fieldMonster(f.zone))return false;
      const sourceDef=CARDS[source.id]||source,sourceType=source.effectType||source.type||sourceDef.type;
      if(c.id==='qli-towers'&&['spell','trap','pendulum-spell'].includes(sourceType))return true;
      const sourceLevel=source.originalLevel??sourceDef.rank??sourceDef.level;
      if((c.id==='qli-towers'||(c.family==='qliphort'&&card.normalSummoned))&&isMonster(sourceDef)&&!['spell','pendulum-spell'].includes(sourceType)&&sourceLevel>0&&sourceLevel<this.level(card))return true;
      return false;
    }
    destroy(uid,source=null,battle=false,extraOptions={}){
      const f=this.find(uid);if(!f)return false;const card=f.card;
      if(!battle&&this.unaffected(card,source))return false;
      if(fieldMonster(f.zone)){
        if(!battle&&card.linkProtection&&source?.owner!==f.owner)return false;
        if(this.passiveSources().some(s=>this.fx.passives[s.card.id]?.protect?.(this,s,card,battle,source)))return false;
        if(battle&&(this.state.players[f.owner].wabokuTurn===this.state.turn||card.battleProtectedUntil>=this.state.turn||this.activeEquip(card,'saqlifice').length||(!this.negated(card)&&card.id==='bw-armor-master')))return false;
        if(!battle&&(card.effectIndestructible||card.effectProtectedUntil>=this.state.turn))return false;
        const st=source?.effectType||CARDS[source?.id]?.type;
        if(!battle&&!this.negated(card)&&card.id==='bw-kris'&&['spell','trap'].includes(st)&&card.krisProtectedTurn!==this.state.turn){card.krisProtectedTurn=this.state.turn;this.log('effect',CARDS[card.id].name+'避免了本回合第1次魔法／陷阱破坏',f.owner);return false;}
      }
      this.move(uid,'grave',{kind:battle?'battle':'destroy',source:source?cp(source):null,byOwner:source?.owner,reason:battle?'战斗破坏':'效果破坏',...extraOptions});return true;
    }
    damage(owner,amount,source='战斗'){
      if(this.state.winner!==null)return;
      if(this._advancedReady&&(this.state.players[owner].preventDamageUntil>=this.state.turn||(source==='战斗'&&this.state.players[owner].wabokuTurn===this.state.turn))){if(amount>0)this.log('effect',this.name(owner)+'受到的伤害变为0',owner);return;}
      super.damage(owner,Math.max(0,Math.floor(amount)),source);
    }
    heal(owner,amount){this.state.players[owner].lp+=amount;this.log('heal',this.name(owner)+'回复 '+amount+' LP',owner,{amount});}
    payLP(owner,amount){req(Number.isFinite(amount)&&amount>=0&&this.state.players[owner].lp>amount,'生命值不足以支付代价。');this.state.players[owner].lp-=amount;this.log('cost',this.name(owner)+'支付 '+amount+' LP',owner,{amount});}
    draw(owner,amount=1,silent=false){
      if(this.state.winner!==null)return;
      if(this._advancedReady&&this.state.inDrawPhase&&amount===1)for(const source of this.passiveSources().filter(s=>s.owner===owner)){const fn=this.fx.passives[source.card.id]?.drawCount;if(fn)amount=Math.max(amount,fn(this,source)||1);}
      const p=this.state.players[owner],before=p.hand.length;super.draw(owner,amount,silent);
      for(const c of p.hand.slice(before))c.generation=(c.generation||0)+1;
      if(this._advancedReady&&p.hand.length>before)this.emit({type:'added',owner,from:'deck',uids:p.hand.slice(before).map(c=>c.uid),normalDraw:!!this.state.inDrawPhase,reason:'draw'});
    }
    search(owner,uids){
      if(!Array.isArray(uids))uids=[uids];
      for(const uid of uids){const f=this.find(uid);req(f&&f.owner===owner&&f.zone==='deck','检索目标不在卡组中。');const c=this.remove(uid).card;this.state.players[owner].hand.push(c);this.log('search',this.name(owner)+'将「'+CARDS[c.id].name+'」加入手牌',owner,{cardId:c.id,uid});}
      this.shuffle(this.state.players[owner].deck);this.emit({type:'added',owner,from:'deck',uids:[...uids],normalDraw:false,reason:'search'});
    }
    checkWin(){
      if(!this._advancedReady||this.state.winner!==null||this.state.resolvingLink)return;
      const winners=[];
      for(let owner=0;owner<2;owner++){
        const parts=new Set(this.state.players[owner].hand.map(c=>CARDS[c.id].exodiaPart).filter(Boolean));
        if(parts.size===5)winners.push(owner);
      }
      if(winners.length===2){this.state.winKind='draw';this.finish('draw','双方同时集齐了艾克佐迪亚。');}
      else if(winners.length){this.state.winKind='exodia';this.finish(winners[0],this.name(winners[0])+'集齐了艾克佐迪亚的五个不同部件。');}
    }
    finish(winner,reason,details={}){
      if(this.state.winner!==null)return;
      super.finish(winner,reason,details);
      if(this._advancedReady){this.state.tasks=[];this.state.triggers=[];this.state.chain=[];this.state.chainCleanup=[];this.state.building=null;this.state.frame=null;this.state.resolvingLink=null;this.state.chainResolving=false;this.state.chainId=null;}
    }
    useKey(owner,card,key,scope='name',duel=false){
      const token=scope==='card'?card.uid+'@'+(card.generation||0)+'::'+key:CARDS[card.id].id+'::'+key;
      if(duel)this.state.players[owner].duelUsed[token]=true;else this.state.players[owner].usedTurn[token]=this.state.turn;
    }
    wasUsed(owner,card,key,scope='name',duel=false){
      const token=scope==='card'?card.uid+'@'+(card.generation||0)+'::'+key:CARDS[card.id].id+'::'+key;
      return duel?!!this.state.players[owner].duelUsed[token]:this.state.players[owner].usedTurn[token]===this.state.turn;
    }
    addLock(owner,kind,value=null){this.state.players[owner].locks.push({kind,value,turn:this.state.turn});}
    canSpecial(owner,card,options={}){
      const c=CARDS[card.id],p=this.state.players[owner],where=this.find(card.uid)?.zone;
      if(!isMonster(c)&&!card.asMonster)return false;
      if(c.type==='link'&&options.position&&options.position!=='attack')return false;
      if(c.noSpecial)return false;
      if(c.masked&&options.via!=='mask')return false;
      if(c.fusionOnly&&options.via!=='fusion')return false;
      if(c.specialOnly&&!card.properlySummoned&&options.via!==c.specialOnly)return false;
      if(isExtra(c)&&['grave','banished'].includes(where)&&!card.properlySummoned)return false;
      if(this.spells(owner).some(s=>this.activeSpell(s)&&CARDS[s.id].type==='pendulum'&&CARDS[s.id].family==='qliphort')&&c.family!=='qliphort')return false;
      for(const lock of p.locks)if(lock.turn===this.state.turn){
        if(lock.kind==='no-special')return false;
        if(lock.kind==='machine'&&c.race!=='机械族')return false;
        if(lock.kind==='fusion-only'&&c.type!=='fusion')return false;
        if(lock.kind==='extra'&&where==='extra'&&c.type!==lock.value)return false;
        if(lock.kind==='machine-synchro'&&where==='extra'&&(c.type!=='synchro'||c.race!=='机械族'))return false;
      }
      return true;
    }
    freeMain(owner){return this.state.players[owner].monsters.filter(c=>!c).length;}
    extraAt(slot,excluded=[]){return [0,1].flatMap(owner=>this.refs(owner,['extraMonster'])).find(f=>(f.card.extraSlot??f.owner)===slot&&!excluded.includes(f.card.uid))||null;}
    extraSlot(owner,zone){return zone==='extra'?owner:1-owner;}
    linkedZones(owner,sourceUid=null,excluded=[]){return LinkRules.pointedMain(this,owner,sourceUid,excluded);}
    coLinked(uid){return LinkRules.coLinked(this,uid);}
    pointsTo(sourceUid,targetUid){const a=this.find(sourceUid),b=this.find(targetUid);return !!a&&!!b&&fieldMonster(a.zone)&&fieldMonster(b.zone)&&CARDS[a.card.id].type==='link'&&LinkRules.pointsTo(a,b);}
    canOccupyExtra(owner,slot,card,excluded=[]){
      if(this.extraAt(slot,excluded))return false;
      const own=this.refs(owner,['extraMonster']).filter(f=>!excluded.includes(f.card.uid));
      return own.length===0||(CARDS[card.id].type==='link'&&LinkRules.extraLink(this,owner,slot,card,excluded));
    }
    freeZones(owner,card,options={}){
      const p=this.state.players[owner],excluded=options.materials||options.excluded||[],fromExtra=this.find(card.uid)?.zone==='extra',c=CARDS[card.id];
      let zones=[0,1,2,3,4].filter(i=>!p.monsters[i]||excluded.includes(p.monsters[i].uid));
      if(fromExtra&&(c.type==='link'||card.faceUpExtra)){const linked=this.linkedZones(owner,null,excluded);zones=zones.filter(i=>linked.includes(i));}
      if(fromExtra&&(isExtra(c)||card.faceUpExtra))for(const zone of ['extra2','extra'])if(this.canOccupyExtra(owner,this.extraSlot(owner,zone),card,excluded))zones.unshift(zone);
      return zones;
    }
    special(owner,uid,options={}){
      const found=this.find(uid);
      if(this.state.resolvingLink&&(!found||!this.canSpecial(owner,found.card,options)||!this.freeZones(owner,found.card,options).length)){
        this.log('effect','特殊召唤未能进行：目标、区域或召唤限制已改变',owner);return null;
      }
      req(found,'特殊召唤的卡片不存在。');const card=found.card,c=CARDS[card.id];
      req(this.canSpecial(owner,card,options),'当前的召唤条件或特殊召唤限制不允许这张卡登场。');
      const zones=this.freeZones(owner,card,options);req(zones.length>0,'没有可用的怪兽区域。');
      const zone=options.zone??zones[0];req(zones.includes(zone),'指定的怪兽区域不可用。');
      req(!options.position||['attack','defense'].includes(options.position),'特殊召唤的表示无效。');
      const from=found.zone;this.remove(uid);
      card.generation=(card.generation||0)+1;
      card.faceUp=true;card.faceUpExtra=false;card.position=options.position||'attack';card.attacked=false;card.attacksMade=0;
      card.summonTurn=this.state.turn;card.changedTurn=this.state.turn;card.summonKind=options.via||'special';card.normalSummoned=false;
      card.mods ||= [];card.overlays ||= [];card.counters=0;card.effectNegated=!!options.negated;card.qliReduced=!!c.qliReduced;
      if(['synchro','xyz','link','fusion','ritual','mask','kagetokage-hand'].includes(options.via)||options.via===c.specialOnly)card.properlySummoned=true;
      if(options.cannotActivate)card.cannotActivateUntil=this.state.turn;
      if(options.banishOnLeave)card.banishOnLeave=true;
      if(['extra','extra2'].includes(zone)){card.extraSlot=this.extraSlot(owner,zone);this.state.players[owner][this.state.players[owner].extraMonster?'extraMonster2':'extraMonster']=card;}else{delete card.extraSlot;this.state.players[owner].monsters[zone]=card;}
      const p=this.state.players[owner];p.turnStats.special++;if(from==='extra')p.turnStats.extraTypes.push(c.type);
      if(options.via==='synchro'&&c.family==='crystron')p.turnStats.crySynchros++;
      this.state.summons[owner]++;
      card.faceUp=!options.faceDown;
      this.log(['synchro','xyz','link','pendulum','ritual'].includes(options.via)?options.via:'special',this.name(owner)+({synchro:'同调召唤',xyz:'超量召唤',link:'连接召唤',fusion:'融合召唤',ritual:'仪式召唤',pendulum:'灵摆召唤'}[options.via]||'特殊召唤')+(card.faceUp?'「'+c.name+'」':'里侧守备怪兽'),owner,{uid,cardId:card.faceUp?c.id:null,summonKind:card.summonKind});
      if(card.faceUp)this.emit({type:'summon',owner,uid,id:c.id,from,kind:card.summonKind,materials:options.materials||[],previous:options.previous||null});
      return card;
    }
    createTokens(owner,id,count){
      req(CARDS[id]?.type==='token','未知衍生物。');if(this.freeMain(owner)<count)return [];
      const tokens=[];
      for(let i=0;i<count;i++){
        const card=this.makeCard(id,owner);this.state.players[owner].hand.push(card);
        if(!this.canSpecial(owner,card,{via:'token'})){this.remove(card.uid);continue;}
        tokens.push(this.special(owner,card.uid,{via:'token',position:'attack'}));
      }return tokens;
    }

    canNormal(card,owner=this.state.active){
      const c=CARDS[card.id],p=this.state.players[owner];
      if(!['monster','pendulum'].includes(c.type)||c.noNormal)return false;
      if(c.uniqueFaceUp&&this.monsters(owner).some(m=>m.faceUp&&m.id===card.id))return false;
      if(!this.state.normalUsed)return true;
      return c.family==='blackwing'&&!p.extraNormalUsed&&this.monsters(owner).some(m=>m.faceUp&&m.id==='bw-nothung'&&!this.negated(m));
    }
    tributeCount(card){const n=this.level(card);return CARDS[card.id].tributeCount??(n>=7?2:n>=5?1:0);}
    tributeWeight(card,target){return CARDS[target.id].family==='qliphort'&&this.activeEquip(card,'saqlifice').length?2:1;}
    tributeSets(card,noTribute=false,owner=this.state.active){
      const cost=noTribute&&CARDS[card.id].qliReduced?0:this.tributeCount(card),p=this.state.players[owner],def=CARDS[card.id];
      if(!cost)return this.freeMain(owner)>0?[[]]:[];
      const pool=this.monsters(owner).filter(c=>!CARDS[c.id].cannotTribute&&(!def.tributeFamily||CARDS[c.id].family===def.tributeFamily));
      return subsets(pool,1,Math.min(cost,pool.length)).filter(set=>set.length<=cost&&set.reduce((n,c)=>n+this.tributeWeight(c,card),0)>=cost&&(this.freeMain(owner)>0||set.some(c=>this.find(c.uid)?.zone==='monsters'))).map(set=>set.map(c=>c.uid));
    }
    normalSummon(action){
      this.mainCheck();const {card,owner}=this.ownCard(action.uid,['hand']);const def=CARDS[card.id];
      req(this.canNormal(card,owner),'本回合不能再通常召唤这张卡。');
      const sets=this.tributeSets(card,!!action.noTribute,owner);req(sets.length,'祭品不足或没有可用的主怪兽区域。');
      const choices=action.tributes;
      if(!choices&&sets[0].length){
        this.state.pending={kind:'materials',purpose:'tribute',responder:owner,owner,uid:card.uid,action:{...action},title:'选择上级召唤的祭品',min:1,max:this.tributeCount(card),candidates:this.monsters(owner).filter(c=>!CARDS[c.id].cannotTribute).map(c=>this.option(c)),sets:sets.map(x=>[...x]),cancelable:true};return;
      }
      const chosen=choices||[];
      req(sets.some(set=>set.length===chosen.length&&set.every(uid=>chosen.includes(uid))),'请选择足够且合法的祭品。');
      const mode=action.mode||'attack';req(['attack','defense'].includes(mode),'召唤表示无效。');
      const materials=chosen.map(uid=>this.describe(this.find(uid).card));const p=this.state.players[owner];
      for(const uid of chosen)this.move(uid,'grave',{kind:'tribute',summoningId:card.id,byOwner:owner});
      p.turnStats.qliTributes+=materials.filter(m=>CARDS[m.id].family==='qliphort').length;
      this.remove(card.uid);const slot=p.monsters.indexOf(null);req(slot>=0,'通常召唤只能使用主怪兽区域。');
      card.generation=(card.generation||0)+1;
      if(this.state.normalUsed)p.extraNormalUsed=true;else this.state.normalUsed=true;
      card.faceUp=mode!=='defense';card.position=mode;card.normalSummoned=true;card.summonKind=mode==='defense'?'set':'normal';
      card.qliReduced=!!def.qliReduced&&chosen.length===0;card.summonTurn=this.state.turn;card.changedTurn=this.state.turn;card.attacksMade=0;card.attacked=false;
      card.tributeCount=materials.length;card.tributedQli=materials.some(m=>CARDS[m.id].family==='qliphort');card.granted ||= {};
      if(card.id==='breaker'&&card.faceUp)card.counters=1;
      p.monsters[slot]=card;this.state.summons[owner]++;
      this.log('summon',this.name(owner)+(card.faceUp?'通常召唤':'盖放')+(card.faceUp||owner===0?'「'+def.name+'」':'一只怪兽'),owner,{cardId:card.faceUp||owner===0?card.id:null,uid:card.uid,faceUp:card.faceUp});
      this.state.frame={kind:'summon',owner,uid:card.uid,summonKind:card.summonKind,windowOffered:false};
      if(card.faceUp)this.emit({type:'summon',owner,uid:card.uid,id:card.id,from:'hand',kind:'normal',materials});
      else this.emit({type:'normal-set',owner,uid:card.uid,id:card.id,from:'hand',kind:'set',materials});
    }
    setCard(action){
      this.mainCheck();const f=this.ownCard(action.uid,['hand']);req(['spell','trap'].includes(CARDS[f.card.id].type),'只有魔法和陷阱可以盖放在魔陷区。');
      const p=this.state.players[f.owner],slot=this.freeSpellZones?.(f.owner)[0]??p.spells.indexOf(null);req(slot>=0,'魔法／陷阱区域已满。');
      this.remove(f.card.uid);f.card.faceUp=false;f.card.setTurn=this.state.turn;f.card.pendingActivation=false;p.spells[slot]=f.card;
      this.log('set',this.name(f.owner)+'盖放了1张魔法／陷阱卡',f.owner,{uid:f.card.uid});this.state.frame={kind:'main-open',owner:f.owner,windowOffered:false};
    }
    changeStance(action){
      this.mainCheck();const {card,owner}=this.ownCard(action.uid,['monsters']);
      req(CARDS[card.id].type!=='link','Link怪兽没有守备表示，不能变更表示。');
      req(card.summonTurn<this.state.turn&&card.changedTurn<this.state.turn&&card.attacksMade===0,'召唤当回合、已变更表示或攻击后的怪兽不能主动变更表示。');
      const wasFaceUp=card.faceUp,oldPosition=card.position;
      if(!card.faceUp){card.faceUp=true;card.position='attack';this.emit({type:'summon',owner,uid:card.uid,id:card.id,from:'monsters',kind:'flip',materials:[]});this.emit({type:'flip',owner,uid:card.uid,id:card.id,previous:this.describe(card)});}
      else card.position=card.position==='attack'?'defense':'attack';
      card.changedTurn=this.state.turn;this.log('stance',CARDS[card.id].name+'变为'+(card.position==='attack'?'攻击':'守备')+'表示',owner,{uid:card.uid,cardId:card.id});
      this.emit({type:'position',owner,uid:card.uid,id:card.id,from:oldPosition,to:card.position});
      const nextFrame={kind:wasFaceUp?'main-open':'summon',owner,uid:card.uid,summonKind:'flip',windowOffered:false};
      if(this.state.frame?.kind==='summon-attempt')this.state.frame.resumeFrame=nextFrame;else this.state.frame=nextFrame;
    }
    materialMatches(card,spec,owner=null){
      const c=CARDS[card.id],f=this.find(card.uid);
      if(spec.id&&card.id!==spec.id)return false;
      if(spec.nameId&&this.cardNameId(card)!==spec.nameId)return false;
      if(spec.family&&!isFamily(c,spec.family))return false;
      if(spec.cyberDragon&&!c.cyberDragon)return false;
      if(spec.tearlaments&&!c.tearlaments)return false;
      if(spec.elemental&&!c.elemental)return false;
      if(spec.attribute&&this.attribute(card)!==spec.attribute)return false;
      if(spec.race&&c.race!==spec.race)return false;
      if(spec.type&&c.type!==spec.type)return false;
      if(spec.normal&&(this.isNormalMonster?!this.isNormalMonster(card):!!c.effect))return false;
      if(owner!==null&&f?.owner!==owner)return false;
      return true;
    }
    fusionPool(owner,spellId='polymerization'){
      let zones=['hand','monsters','extraMonster'];
      if(['miracle-fusion','overload-fusion'].includes(spellId))zones=['monsters','extraMonster','grave'];
      if(spellId==='cyberload-fusion')zones=['monsters','extraMonster','banished'];
      const profile=typeof spellId==='object'?spellId:null;if(profile?.zones)zones=profile.zones;
      return this.refs(owner,zones).filter(f=>isMonster(CARDS[f.card.id])&&!CARDS[f.card.id].cannotFusionMaterial&&(!fieldMonster(f.zone)||f.card.faceUp||f.owner===owner)&&(!(spellId==='cyberload-fusion'||profile?.noTokens)||CARDS[f.card.id].type!=='token')).map(f=>f.card).sort((a,b)=>Number(b.uid===profile?.requiredUid)-Number(a.uid===profile?.requiredUid));
    }
    fusionAllowed(card,spellId){
      const c=CARDS[card.id];if(c.type!=='fusion'||c.masked||(!c.fusion&&!c.materials))return false;
      if(spellId==='miracle-fusion'&&!c.elemental)return false;
      if(spellId==='power-bond'&&c.race!=='机械族')return false;
      if(spellId==='overload-fusion'&&(c.race!=='机械族'||c.attribute!=='暗'))return false;
      if(spellId==='cyberload-fusion'&&c.family!=='cyber')return false;
      return true;
    }
    fusionValid(owner,extra,materials,spellId='polymerization'){
      if(!this.fusionAllowed(extra,spellId)||!this.canSpecial(owner,extra,{via:spellId?.contact?CARDS[extra.id].specialOnly:'fusion'}))return false;
      const profile=typeof spellId==='object'?spellId:null;
      if(profile?.requiredUid){const required=this.find(profile.requiredUid);if(!required||required.owner!==owner||required.zone!==(profile.requiredZone||'grave')||(required.card.generation||0)!==profile.requiredGeneration||!materials.some(m=>m.uid===profile.requiredUid))return false;}
      const c=CARDS[extra.id],specs=c.fusion||c.materials.map(id=>({id})),pool=new Set(this.fusionPool(owner,spellId).map(m=>m.uid));
      if(new Set(materials.map(m=>m.uid)).size!==materials.length||materials.some(m=>!pool.has(m.uid)))return false;
      if(materials.length<specs.length||(!c.fusionMore&&materials.length!==specs.length))return false;
      if(c.differentAttributes&&new Set(materials.map(m=>this.attribute(m))).size!==materials.length)return false;
      const match=(i,used)=>{
        if(i===specs.length)return materials.every((m,j)=>used.has(j)||this.materialMatches(m,c.fusionMore||{}));
        for(let j=0;j<materials.length;j++)if(!used.has(j)&&this.materialMatches(materials[j],specs[i])){const next=new Set(used);next.add(j);if(match(i+1,next))return true;}return false;
      };
      if(!match(0,new Set())&&!(this.fusionSubstituteValid?.(extra,materials,specs)))return false;
      return this.freeZones(owner,extra,{materials:materials.map(m=>m.uid)}).length>0;
    }
    fusionCombos(owner,extra,spellId='polymerization'){
      if(!this.fusionAllowed(extra,spellId)||!this.canSpecial(owner,extra,{via:spellId?.contact?CARDS[extra.id].specialOnly:'fusion'}))return [];
      const c=CARDS[extra.id],specs=c.fusion||c.materials.map(id=>({id})),pool=this.fusionPool(owner,spellId),out=[],seen=new Set();
      const walk=(at,chosen)=>{
        if(out.length>=80)return;
        if(at===specs.length){
          const key=chosen.map(c=>c.uid).sort().join('|');
          if(!seen.has(key)&&this.fusionValid(owner,extra,chosen,spellId)){seen.add(key);out.push(chosen.map(c=>c.uid));}
          return;
        }
        for(const card of pool)if(!chosen.includes(card)&&(this.materialMatches(card,specs[at])||!c.fusionExact&&(specs[at].id||specs[at].officialName)&&CARDS[card.id].fusionSubstitute))walk(at+1,[...chosen,card]);
      };walk(0,[]);
      if(c.fusionMore&&out.length){
        const start=out[0].map(uid=>this.find(uid).card),rest=pool.filter(m=>!start.includes(m)&&this.materialMatches(m,c.fusionMore));
        for(const n of [1,2,4,rest.length]){const chosen=[...start,...rest.slice(0,n)];if(this.fusionValid(owner,extra,chosen,spellId))out.push(chosen.map(c=>c.uid));}
      }return out;
    }
    fusions(owner=this.state.active,spellId='polymerization'){
      return this.state.players[owner].extra.filter(c=>!c.faceUpExtra).flatMap(card=>{const combos=this.fusionCombos(owner,card,spellId);return combos.length?[{card,materials:combos[0],combos}]:[];});
    }
    performFusion(owner,extraUid,materialUids,spellId,source,zone=null,position='attack'){
      const extra=this.ownCard(extraUid,['extra'],owner).card,materials=materialUids.map(uid=>this.find(uid)?.card);
      req(materials.every(Boolean)&&this.fusionValid(owner,extra,materials,spellId),'融合素材或召唤条件不满足。');
      const profile=typeof spellId==='object'?spellId:null;
      const snapshots=materials.map(c=>this.describe(c)),destination=profile?.destination||(['miracle-fusion','overload-fusion'].includes(spellId)?'banished':spellId==='cyberload-fusion'?'deck':'grave');
      for(const card of materials)this.move(card.uid,destination,{kind:'fusion-material',summoningId:extra.id,source,byOwner:owner});
      if(destination==='deck'&&!profile?.bottom)this.shuffle(this.state.players[owner].deck);
      extra.materialCount=materials.length;
      const summoned=this.special(owner,extra.uid,{via:'fusion',position,materials:snapshots,...(zone!==null?{zone}:{})});
      if(!summoned)return null;
      if(spellId==='power-bond'){
        const amount=this.originalAttack(summoned);this.modify(summoned.uid,'atk','add',amount,null,source);
        this.state.delayed.push({kind:'power-bond',turn:this.state.turn,owner,amount,sourceUid:source.uid,sourceId:source.id});
      }
      if(spellId==='cyberload-fusion')this.state.players[owner].attackOnly={uid:summoned.uid,turn:this.state.turn};
      return summoned;
    }
    synchroValid(owner,extra,materials,options={}){
      const c=CARDS[extra.id],spec=c.synchro;
      if(c.type!=='synchro'||!spec||!this.canSpecial(owner,extra,{via:'synchro'}))return false;
      if(new Set(materials.map(m=>m.uid)).size!==materials.length||materials.length<2)return false;
      for(const m of materials){
        const f=this.find(m.uid);
        if(!options.virtual&&(!f||f.owner!==owner||!fieldMonster(f.zone)||!m.faceUp))return false;
        if(CARDS[m.id].cannotSynchro||this.level(m)<=0)return false;
      }
      const isTuner=m=>this.synchroMaterialTuner?this.synchroMaterialTuner(m,extra,materials):this.isTuner(m);
      const tuners=materials.filter(isTuner),non=materials.filter(m=>!isTuner(m));
      if(tuners.length<spec.minTuners||tuners.length>(spec.maxTuners??1)||non.length<spec.minNon||non.length>(spec.maxNon??5))return false;
      if(materials.reduce((n,m)=>n+(this.synchroMaterialLevel?this.synchroMaterialLevel(m,extra,materials):this.level(m)),0)!==c.level)return false;
      for(const m of tuners){
        const d=CARDS[m.id];
        if(d.synchronSubstitute&&!spec.namedSynchron&&spec.tunerFamily!=='synchron')return false;
        if(spec.tunerId&&m.id!==spec.tunerId&&!(d.synchronSubstitute&&spec.namedSynchron))return false;
        if(spec.tunerFamily&&!isFamily(d,spec.tunerFamily))return false;
        if(spec.tunerType&&d.type!==spec.tunerType)return false;
        if(spec.tunerRace&&this.race(m)!==spec.tunerRace)return false;
      }
      for(const m of non){if(spec.nonId&&m.id!==spec.nonId)return false;if(spec.nonType&&CARDS[m.id].type!==spec.nonType)return false;if(spec.nonLevel&&this.level(m)!==spec.nonLevel)return false;if(spec.nonGemini&&!CARDS[m.id].gemini)return false;if(spec.nonNormal&&!this.isNormalMonster(m))return false;}
      if(spec.requiredNonIds&&!spec.requiredNonIds.every(id=>non.some(m=>m.id===id)))return false;
      if(spec.additionalAttribute&&!tuners.some(t=>materials.every(m=>m===t||this.attribute(m)===spec.additionalAttribute)))return false;
      return options.virtual||this.freeZones(owner,extra,{materials:materials.map(m=>m.uid)}).length>0;
    }
    synchroCombos(owner,extra,requiredUid=null){
      const pool=this.monsters(owner).filter(c=>c.faceUp&&this.level(c)>0&&!CARDS[c.id].cannotSynchro);
      return subsets(pool,2,7).filter(set=>(!requiredUid||set.some(c=>c.uid===requiredUid))&&this.synchroValid(owner,extra,set)).map(set=>set.map(c=>c.uid));
    }
    xyzValid(owner,extra,materials,rankUp=false){
      const c=CARDS[extra.id];if(c.type!=='xyz'||!this.canSpecial(owner,extra,{via:'xyz'}))return false;
      if(new Set(materials.map(m=>m.uid)).size!==materials.length)return false;
      if(materials.some(m=>{const f=this.find(m.uid);return !f||f.owner!==owner||!fieldMonster(f.zone)||!m.faceUp||CARDS[m.id].cannotXyz||CARDS[m.id].type==='token';}))return false;
      if(!this.freeZones(owner,extra,{materials:materials.map(m=>m.uid)}).length)return false;
      if(rankUp){
        if(materials.length!==1||this.state.players[owner].usedTurn['rankup:'+extra.id]===this.state.turn)return false;
        const target=materials[0],d=CARDS[target.id];
        return !!(c.rankUpFrom?.includes(target.id)||(c.rankUpFamily&&d.family===c.rankUpFamily&&d.rank===c.rankUpRank));
      }
      return materials.length>=(c.xyzCount||2)&&materials.length<=(c.xyzMax||c.xyzCount||2)&&materials.every(m=>(this.xyzMaterialLevel?this.xyzMaterialLevel(m,extra):this.level(m))===c.rank&&(!c.xyzRace||this.race(m)===c.xyzRace)&&(!c.xyzAttribute||this.attribute(m)===c.xyzAttribute)&&(!c.xyzNormal||this.isNormalMonster(m))&&(!c.xyzNameIncludes||CARDS[m.id].officialName.includes(c.xyzNameIncludes)));
    }
    xyzCombos(owner,extra){
      const pool=this.monsters(owner).filter(c=>c.faceUp&&!CARDS[c.id].cannotXyz&&CARDS[c.id].type!=='token'),out=[];
      for(const set of subsets(pool,CARDS[extra.id].xyzCount||2,CARDS[extra.id].xyzMax||CARDS[extra.id].xyzCount||2))if(this.xyzValid(owner,extra,set))out.push({materials:set.map(c=>c.uid),rankUp:false});
      for(const card of pool)if(this.xyzValid(owner,extra,[card],true))out.push({materials:[card.uid],rankUp:true});
      return out;
    }
    extraOptions(owner=this.state.active,options={}){
      return this.state.players[owner].extra.filter(c=>!c.faceUpExtra).flatMap(card=>{
        const type=CARDS[card.id].type;
        if(type==='synchro'){
          const combos=this.synchroCombos(owner,card,options.requiredUid||null);
          return combos.length?[{card,type,combos:combos.map(materials=>({materials}))}]:[];
        }
        if(type==='xyz'&&!options.requiredUid){const combos=this.xyzCombos(owner,card);return combos.length?[{card,type,combos}]:[];}
        if(type==='link'&&!options.requiredUid){const combos=this.linkCombos(owner,card);return combos.length?[{card,type,combos:combos.map(materials=>({materials}))}]:[];}
        return [];
      });
    }
    takeMaterial(uid,transfer=false,byEffect=false){
      const f=this.find(uid);req(f&&(fieldMonster(f.zone)||byEffect&&['hand','grave','banished','spells','fieldSpell','overlays'].includes(f.zone)),'超量素材必须是场上的怪兽，或由效果指定的卡片。');
      const card=f.card,snapshot=this.describe(card,f),under=[...(card.overlays||[])];
      if(!transfer)for(const m of under)this.move(m.uid,'grave',{kind:'rule-material',reason:'超量怪兽变为素材'});
      this.remove(uid);this.cleanupEquips(uid);card.overlays=[];card.mods=[];card.used={};card.banishOnLeave=false;card.effectNegated=false;card.granted={};card.qliReduced=false;card.levelOverride=null;card.attributeOverride=null;card.normalSummoned=false;card.summonKind=null;card.attacked=false;card.attacksMade=0;
      return {cards:transfer?[card,...under]:[card],snapshot,zone:f.zone,index:f.index};
    }
    attach(targetUid,materialUid,source=null){
      const host=this.find(targetUid),material=this.find(materialUid);
      if(!host||!material||!fieldMonster(host.zone)||CARDS[host.card.id].type!=='xyz'||!['monsters','extraMonster','hand','grave','banished','spells','fieldSpell','overlays'].includes(material.zone)||CARDS[material.card.id].type==='token'||targetUid===materialUid||material.parentUid===targetUid||this.unaffected(material.card,source))return false;
      const taken=this.takeMaterial(materialUid,false,true);host.card.overlays.push(...taken.cards);
      this.log('overlay',CARDS[taken.cards[0].id].name+'成为「'+CARDS[host.card.id].name+'」的超量素材',host.owner,{cardId:host.card.id,uid:host.card.uid});return true;
    }
    detach(uid,materials){
      const host=this.find(uid);req(host&&fieldMonster(host.zone),'超量怪兽不在场上。');
      req(new Set(materials).size===materials.length&&materials.every(id=>host.card.overlays.some(c=>c.uid===id)),'请选择此怪兽持有的超量素材。');
      for(const material of materials)this.move(material,'grave',{kind:'detach',reason:'移除超量素材',log:true});
    }
    extraSummon(action){
      this.mainCheck();const owner=this.state.active,extra=this.ownCard(action.uid,['extra']).card,c=CARDS[extra.id];
      req(['synchro','xyz','link'].includes(c.type),'这个额外怪兽需要由相应卡牌效果召唤。');
      const option=this.extraOptions(owner).find(o=>o.card.uid===extra.uid);req(option,'场上没有满足条件的素材组合。');
      if(!action.materials){
        const candidates=[...new Set(option.combos.flatMap(x=>x.materials))].map(uid=>this.find(uid)?.card).filter(Boolean);
        this.state.pending={kind:'materials',purpose:'extra',responder:owner,owner,uid:extra.uid,title:({synchro:'同调',xyz:'超量',link:'连接'}[c.type])+'召唤 · 选择素材',min:1,max:7,candidates:candidates.map(m=>this.option(m,{viewer:owner})),sets:option.combos.map(x=>x.materials),combos:cp(option.combos),action:{...action},cancelable:true};return;
      }
      const combo=option.combos.find(x=>x.materials.length===action.materials.length&&x.materials.every(uid=>action.materials.includes(uid)));
      req(combo,'素材的等级、调整条件或数量不符合要求。');
      if(c.type==='synchro')this.performSynchro(owner,extra.uid,action.materials,{zone:action.zone,position:action.position});
      else if(c.type==='xyz')this.performXyz(owner,extra.uid,action.materials,{rankUp:combo.rankUp,zone:action.zone,position:action.position});
      else this.performLink(owner,extra.uid,action.materials,{zone:action.zone,position:action.position});
      const nextFrame={kind:'summon',owner,uid:extra.uid,summonKind:c.type,windowOffered:false};
      if(this.state.frame?.kind==='summon-attempt')this.state.frame.resumeFrame=nextFrame;else this.state.frame=nextFrame;
    }
    performSynchro(owner,extraUid,uids,options={}){
      const extra=this.ownCard(extraUid,['extra'],owner).card,materials=uids.map(uid=>this.find(uid)?.card);
      req(materials.every(Boolean)&&this.synchroValid(owner,extra,materials),'同调素材不符合要求。');
      const snapshots=materials.map(c=>this.describe(c));
      for(const c of materials)this.move(c.uid,options.materialDestination||'grave',{kind:'synchro-material',summoningId:extra.id,source:options.source||null,byOwner:owner});
      if(options.materialDestination==='deck')this.shuffle(this.state.players[owner].deck);
      extra.materialCount=materials.length;extra.nonTunerMaterialCount=snapshots.filter(m=>!m.tuner).length;
      extra.dynamicTuner=extra.id==='bw-raikiri'&&snapshots.some(m=>CARDS[m.id].family==='blackwing');
      return this.special(owner,extra.uid,{via:'synchro',position:options.position,materials:snapshots,...(options.zone!==undefined?{zone:options.zone}:{})});
    }
    performXyz(owner,extraUid,uids,options={}){
      const extra=this.ownCard(extraUid,['extra'],owner).card,materials=uids.map(uid=>this.find(uid)?.card);
      req(materials.every(Boolean),'超量素材已经离场。');
      if(!options.byEffect)req(this.xyzValid(owner,extra,materials,!!options.rankUp),'超量素材或升阶条件不符合要求。');
      req(this.canSpecial(owner,extra,{via:'xyz'}),'当前限制不允许超量召唤。');
      const snapshots=materials.map(c=>this.describe(c)),overlays=[];
      for(const card of materials)overlays.push(...this.takeMaterial(card.uid,!!options.rankUp||!!options.byEffect).cards);
      extra.overlays=overlays;extra.materialCount=materials.length;
      extra.granted={sage:CARDS[extra.id].family==='utopia'&&materials.some(c=>c.id==='zs-ascended-sage'),girl:materials.some(c=>c.id==='gagaga-girl')&&materials.some(c=>c.id!=='gagaga-girl'&&isFamily(CARDS[c.id],'gagaga'))};
      if(options.rankUp&&!options.byEffect)this.state.players[owner].usedTurn['rankup:'+extra.id]=this.state.turn;
      const result=this.special(owner,extra.uid,{via:'xyz',position:options.position,materials:snapshots,...(options.zone!==undefined?{zone:options.zone}:{})});
      return result;
    }
    linkValid(owner,extra,materials,requiredUid=null){
      if(!extra)return false;const c=CARDS[extra.id],spec=c.link;if(c.type!=='link'||!spec||!this.canSpecial(owner,extra,{via:'link'}))return false;
      if(materials.some(m=>!m)||materials.length<(spec.min||1)||materials.length>(spec.max||c.linkRating)||new Set(materials.map(m=>m.uid)).size!==materials.length)return false;
      if(requiredUid&&!materials.some(m=>m.uid===requiredUid))return false;
      if(materials.some(m=>{const f=this.find(m.uid),d=CARDS[m.id];return !f||f.owner!==owner||!fieldMonster(f.zone)||!m.faceUp||d.cannotLinkMaterial||(spec.noTokens&&d.type==='token')||(spec.nonLink&&d.type==='link')||(spec.effect&&(!d.effect||m.asMonster?.normal))||(spec.level&&this.level(m)!==spec.level);}))return false;
      if(spec.attribute&&!materials.some(m=>this.attribute(m)===spec.attribute))return false;
      if(spec.differentNames&&new Set(materials.map(m=>this.cardNameId(m))).size!==materials.length)return false;
      if(!LinkRules.ratingTotals(materials).has(c.linkRating))return false;
      return this.freeZones(owner,extra,{materials:materials.map(m=>m.uid)}).length>0;
    }
    linkCombos(owner,extra,requiredUid=null){const c=CARDS[extra.id];if(c.type!=='link')return [];return subsets(this.monsters(owner).filter(m=>m.faceUp),c.link.min||1,c.link.max||c.linkRating).filter(set=>this.linkValid(owner,extra,set,requiredUid)).map(set=>set.map(m=>m.uid));}
    linkOptions(owner,requiredUid=null){return this.state.players[owner].extra.filter(c=>CARDS[c.id].type==='link').flatMap(card=>{const sets=this.linkCombos(owner,card,requiredUid);return sets.length?[{card,sets}]:[];});}
    performLink(owner,extraUid,uids,options={}){
      const extra=this.ownCard(extraUid,['extra'],owner).card,materials=uids.map(uid=>this.find(uid)?.card);
      req(!options.position||options.position==='attack','Link怪兽只能以表侧攻击表示登场。');
      req(this.linkValid(owner,extra,materials,options.requiredUid),'Link素材数量、Link值、类别或召唤位置不合法。');
      const zones=this.freeZones(owner,extra,{materials:uids}),zone=options.zone??zones[0];req(zones.includes(zone),'素材离场后，这个区域不能进行连接召唤。');
      const snapshots=materials.map(c=>this.describe(c));
      for(const m of materials)this.move(m.uid,'grave',{kind:'link-material',summoningId:extra.id,byOwner:owner,byEffect:false});
      extra.materialCount=materials.length;extra.linkMaterialUids=[...uids];extra.linkProtection=materials.some(m=>m.id==='ip-masquerena');
      return this.special(owner,extraUid,{via:'link',position:'attack',zone,materials:snapshots});
    }
    scales(owner){const p=this.state.players[owner];return [p.spells[0],p.spells[4]].map(c=>c&&c.faceUp&&!c.pendingActivation&&CARDS[c.id].type==='pendulum'?{card:c,scale:CARDS[c.id].scale}:null);}
    pendulumCandidates(owner=this.state.active){
      const s=this.scales(owner);if(s.some(c=>!c)||s[0].scale===s[1].scale||this.state.players[owner].pendulumTurn===this.state.turn)return [];
      const low=Math.min(s[0].scale,s[1].scale),high=Math.max(s[0].scale,s[1].scale),p=this.state.players[owner];
      return [...p.hand,...p.extra.filter(c=>c.faceUpExtra)].filter(card=>isMonster(CARDS[card.id])&&!isExtra(CARDS[card.id])&&CARDS[card.id].level>low&&CARDS[card.id].level<high&&this.canSpecial(owner,card,{via:'pendulum'})&&this.freeZones(owner,card).length);
    }
    pendulumValid(owner,uids){
      const candidates=this.pendulumCandidates(owner),p=this.state.players[owner];
      if(!uids.length||new Set(uids).size!==uids.length||uids.some(uid=>!candidates.some(c=>c.uid===uid)))return false;
      return !!this.pendulumLayout(owner,uids);
    }
    pendulumLayout(owner,uids){
      const layout={},used=new Set();let extraTaken=false;
      const order=[...uids].sort((a,b)=>Number(this.find(b)?.zone==='extra')-Number(this.find(a)?.zone==='extra'));
      for(const uid of order){const f=this.find(uid);if(!f)return null;const zones=this.freeZones(owner,f.card).filter(z=>!used.has(z)&&!(typeof z==='string'&&extraTaken));if(!zones.length)return null;const zone=zones[0];layout[uid]=zone;used.add(zone);if(typeof zone==='string')extraTaken=true;}
      return layout;
    }
    pendulumSummon(action){
      this.mainCheck();const owner=this.state.active,candidates=this.pendulumCandidates(owner);
      req(candidates.length,'需要不同的左右刻度、满足等级与召唤限制的卡牌，以及可用区域。');
      if(!action.uids){this.state.pending={kind:'materials',purpose:'pendulum',owner,responder:owner,title:'选择要灵摆召唤的怪兽',min:1,max:this.freeMain(owner)+(this.extraMonsters(owner).length?0:1),candidates:candidates.map(c=>this.option(c)),action:{...action},cancelable:true};return;}
      req(this.pendulumValid(owner,action.uids),'灵摆怪兽数量、等级或额外怪兽区不符合条件。');
      this.state.players[owner].pendulumTurn=this.state.turn;
      const layout=this.pendulumLayout(owner,action.uids);
      const ordered=[...action.uids].sort((a,b)=>Number(this.find(b).zone==='extra')-Number(this.find(a).zone==='extra'));
      for(const uid of ordered)this.special(owner,uid,{via:'pendulum',position:action.position||'attack',zone:layout[uid]});
      const nextFrame={kind:'summon',owner,uid:ordered[0],uids:[...ordered],summonKind:'pendulum',windowOffered:false};
      if(this.state.frame?.kind==='summon-attempt')this.state.frame.resumeFrame=nextFrame;else this.state.frame=nextFrame;
    }
    option(card,extra={}){
      const f=this.find(card.uid),c=CARDS[card.id];
      const viewer=extra.viewer??this.state.active;
      if(f&&f.owner!==viewer&&!card.faceUp&&!extra.reveal&&(fieldMonster(f.zone)||['hand','spells','fieldSpell','extra'].includes(f.zone)))return {uid:card.uid,cardId:null,owner:f.owner,zone:f.zone,label:'对方的里侧卡牌',detail:'身份尚未公开',hidden:true,...extra};
      return {uid:card.uid,cardId:card.id,owner:f?.owner??card.originalOwner,zone:f?.zone,label:c.name,detail:c.type==='link'?'LINK-'+c.linkRating+' · 可计为1或'+c.linkRating:c.type==='xyz'?'阶级 '+c.rank+' · 素材 '+(card.overlays||[]).length:isMonster(c)?(this.isTuner(card)?'调整 · ':'')+'等级 '+this.level(card)+' · ATK '+this.attackValue(card):c.type==='trap'?'陷阱卡':'魔法卡',...extra};
    }

    activeSpell(card){return !!card?.faceUp&&!card.pendingActivation&&!card.spellNegated;}
    abilityContext(uid,key,origin='main',event={},provided={}){
      const found=this.find(uid),ability=this.fx.get(key);
      req(ability,'这个效果还没有定义。');
      const owner=event.controller??event.owner??found?.owner,sourceId=found?.card.id||event.sourceId;
      req([0,1].includes(owner)&&CARDS[sourceId],'效果来源不正确。');
      const card=found?.card||{id:sourceId,uid,originalOwner:owner,mods:[],used:{}};
      return {uid,key,owner,sourceId,origin,event:cp(event),args:{},provided:cp(provided),source:{uid,id:sourceId,generation:card.generation||0,owner,originalLevel:CARDS[sourceId].rank||CARDS[sourceId].level||0,effectType:ability.effectType||(found&&['spells','fieldSpell'].includes(found.zone)?'spell':isMonster(CARDS[sourceId])?'monster':CARDS[sourceId].type),zone:found?.zone,atk:this.attackValue(card)},window:null};
    }
    queue(task){if(this._collecting)this._collecting.push(cp(task));else this.state.tasks.push(cp(task));}
    queueChoice(owner,title,candidates,min,max,operation,context={},extra={}){
      this.queue({op:'effect-choice',owner,title,candidates:cp(candidates),min,max,operation,context:cp(context),...extra});
    }
    collectTasks(fn){
      const prior=this._collecting;this._collecting=[];
      try{fn();const tasks=this._collecting;this._collecting=prior;return tasks;}catch(e){this._collecting=prior;throw e;}
    }
    validatePick(pending,uids){
      if(!Array.isArray(uids)||new Set(uids).size!==uids.length)return {valid:false,message:'请选择不同的卡牌或选项。'};
      const candidates=pending.candidates||pending.group?.candidates||[],min=pending.min??pending.group?.min??1,max=pending.max??pending.group?.max??1;
      if(uids.length<min||uids.length>max)return {valid:false,message:'需要选择'+min+(max!==min?'—'+max:'')+'个选项。'};
      if(uids.some(uid=>!candidates.some(c=>c.uid===uid)))return {valid:false,message:'选择中有不可用的卡牌。'};
      if(pending.purpose==='pendulum'&&!this.pendulumValid(pending.owner,uids))return {valid:false,message:'手牌需要主怪兽区；表侧额外灵摆需要可用的共享额外区或Link箭头指向的主怪兽区。'};
      if(pending.purpose==='link-effect'&&!this.linkValid(pending.owner,this.find(pending.uid)?.card,uids.map(uid=>this.find(uid)?.card),pending.requiredUid))return {valid:false,message:'连接素材必须包含效果指定的怪兽，并满足Link值和区域条件。'};
      if(pending.purpose==='fusion'){
        const extra=this.find(pending.uid)?.card,materials=uids.map(uid=>this.find(uid)?.card);
        if(!extra||!materials.every(Boolean)||!this.fusionValid(pending.owner,extra,materials,pending.spellId))return {valid:false,message:'融合素材的名称、属性或数量不满足这只怪兽的条件。'};
      }
      if(pending.sets&&!pending.sets.some(set=>set.length===uids.length&&set.every(uid=>uids.includes(uid))))return {valid:false,message:'等级、素材类别或祭品数量不符合要求。'};
      if(pending.kind==='order'&&pending.candidates.some(c=>c.mandatory&&!uids.includes(c.uid)))return {valid:false,message:'必须包含强制发动的效果。'};
      const distinct=pending.group?.distinct||pending.context?.distinct;
      if(distinct){
        const seen=new Set();for(const uid of uids){const c=candidates.find(c=>c.uid===uid),value=c[distinct];if(seen.has(value))return {valid:false,message:'这些选项需要各不相同。'};seen.add(value);}
      }
      if(pending.group?.validator){
        const valid=this.fx.validateInput(this,pending.ctx,pending.group,uids);if(valid!==true)return {valid:false,message:valid||'这组选择不合法。'};
      }
      return {valid:true,message:''};
    }
    rememberInput(ctx,group,uids){
      ctx.inputRoles ||= {};ctx.inputRoles[group.key]=group.role||'target';
      if(group.key==='cost'||['cost','send-cost'].includes(group.role))return;
      ctx.targetMeta ||= {};ctx.targetMeta[group.key]={};
      for(const uid of uids){const f=this.find(uid);if(f)ctx.targetMeta[group.key][uid]={generation:f.card.generation||0,zone:f.zone,owner:f.owner,cardId:f.card.id,public:f.card.faceUp||f.zone==='grave'};}
    }
    prepare(ctx){
      req(this.fx.canUse(this,ctx),'现在不能发动这个效果，或没有合法的目标。');
      let guard=0;
      while(guard++<15){
        const group=this.fx.nextInput(this,ctx);
        if(!group){this.commitPrepared(ctx);return;}
        req((group.candidates||[]).length>=(group.min??1),'当前没有足够的合法选项。');
        if(Object.prototype.hasOwnProperty.call(ctx.provided||{},group.key)){
          const values=ctx.provided[group.key],uids=Array.isArray(values)?values:[values];
          const pending={kind:'input',group,ctx},check=this.validatePick(pending,uids);req(check.valid,check.message);
          ctx.args[group.key]=[...uids];this.rememberInput(ctx,group,uids);continue;
        }
        this.state.pending={kind:'input',responder:ctx.owner,owner:ctx.owner,uid:ctx.uid,title:group.title||'选择效果的目标',group:cp(group),ctx:cp(ctx),cancelable:ctx.origin!=='operation'&&!ctx.event.mandatory};return;
      }throw new Error('Effect input loop');
    }
    activate(action){
      const owner=this.state.active,key=action.key||(action.type==='cast'?this.find(action.uid)?.card.id+'::cast':null);
      const available=this.fx.available(this,owner,{kind:'main',phase:this.state.phase}).find(x=>x.uid===action.uid&&x.key===key);
      req(available,'这张卡现在没有这个可发动的效果。');
      const ctx=this.abilityContext(action.uid,key,'main',{owner},action.choices||{});
      if(action.target)ctx.provided.target=Array.isArray(action.target)?action.target:[typeof action.target==='string'?action.target:action.target.uid];
      this.state.frame={kind:'main-open',owner,windowOffered:false};this.prepare(ctx);
    }
    commitPrepared(ctx){
      req(this.fx.canUse(this,ctx),'效果的发动条件已经不满足。');
      const a=this.fx.get(ctx.key),f=this.find(ctx.uid),card=f?.card;
      this.beforePrepared?.(ctx,a,f);
      if(a.once&&card)this.useKey(ctx.owner,a.once.cardId?{...card,id:a.once.cardId}:card,a.once.key||ctx.key,a.once.scope||'name',!!a.once.duel);
      const inputTasks=this.collectTasks(()=>this.fx.payCost(this,ctx));
      if(a.targetAfterCost&&ctx.args.target)this.rememberInput(ctx,{key:'target',role:'target'},ctx.args.target);
      this.state.tasks.unshift(...inputTasks);
      if(a.inherent){
        const tasks=this.collectTasks(()=>this.fx.resolve(this,ctx));this.state.tasks.unshift(...tasks);
        if(!this.state.frame)this.state.frame={kind:'main-open',owner:ctx.owner,windowOffered:false};
        return;
      }
      let activation=false;
      if(a.cardActivation){
        const source=this.find(ctx.uid);req(source,'发动的卡片已经离场。');
        const d=CARDS[source.card.id],p=this.state.players[ctx.owner];
        if(source.zone==='hand'){
          if(d.spellKind==='field'){
            if(p.fieldSpell)this.move(p.fieldSpell.uid,'grave',{kind:'rule-field',reason:'场地魔法替换'});
            this.remove(ctx.uid);p.fieldSpell=source.card;
          }else{
            let slot=a.pendulum?Number(ctx.args.slot[0].split(':')[1]):(this.freeSpellZones?this.freeSpellZones(ctx.owner)[0]:p.spells.indexOf(null));
            req(Number.isInteger(slot)&&slot>=0&&slot<5&&!p.spells[slot],'没有可用的魔法／陷阱区域。');
            this.remove(ctx.uid);p.spells[slot]=source.card;
          }
        }else req(['spells','fieldSpell'].includes(source.zone)&&!source.card.faceUp,'只有手牌或盖放的卡可以进行卡片发动。');
        if(source.zone==='hand')source.card.generation=(source.card.generation||0)+1;
        ctx.source.generation=source.card.generation||0;
        source.card.faceUp=true;source.card.pendingActivation=true;activation=true;
        ctx.source.effectType=d.type==='trap'?'trap':'spell';
        if(!a.pendulum&&!a.keepField&&!['continuous','equip','field'].includes(d.spellKind)&&d.trapKind!=='continuous')this.state.chainCleanup.push(ctx.uid);
      }
      if(!this.state.chain.length&&!this.state.chainResolving)this.state.chainId=this.state.nextChain++;
      const link={...cp(ctx),id:'l'+this.state.nextLink++,chainId:this.state.chainId,chainNumber:this.state.chain.length+1,speed:a.speed||1,cardActivation:activation,negatedActivation:false,effectNegated:false,sourceZone:ctx.source.zone,requiresField:!!a.requiresField,unanswerableByOpponent:!!a.unanswerableByOpponent};
      this.state.chain.push(link);
      this.recordChain('add',link);
      const kind=ctx.source.effectType==='trap'?'trap':ctx.source.effectType==='spell'?'spell':'effect';
      this.log(kind,this.name(ctx.owner)+'发动「'+CARDS[ctx.sourceId].name+'」'+(a.label?' · '+a.label:''),ctx.owner,{uid:ctx.uid,cardId:ctx.sourceId,key:ctx.key,chain:link.chainNumber,chainId:link.chainId,linkId:link.id});
      if(!this.state.building){
        if(this.state.frame)this.state.frame.windowOffered=true;
        this.openWindow(1-ctx.owner,0);
      }
    }
    windowContext(){
      const f=this.state.frame||{kind:'main-open',owner:this.state.active},last=this.state.chain.at(-1);
      return {...cp(f),phase:this.state.phase,turnPlayer:this.state.active,chainLast:last?{id:last.id,uid:last.uid,chainId:last.chainId,owner:last.owner,key:last.key,sourceId:last.sourceId,source:cp(last.source),args:cp(last.args),speed:last.speed,responseTo:last.responseTo,unanswerableByOpponent:last.unanswerableByOpponent}:null,attack:f.attack?cp(f.attack):null};
    }
    responseOptions(owner,context=this.windowContext()){
      let choices=this.fx.available(this,owner,context);
      const last=context.chainLast;
      if(last)choices=choices.filter(a=>(this.fx.get(a.key).speed||1)>=(last.speed===3?3:2)&&(!last.unanswerableByOpponent||owner===last.owner));
      if(context.attack&&this.battleLocked(owner,context.attack))choices=[];
      return choices;
    }
    openWindow(owner,passes=0){
      const context=this.windowContext();
      let current=owner,n=passes;
      while(n<2){
        const options=this.responseOptions(current,context);
        if(options.length){this.state.pending={kind:'window',owner:current,responder:current,passes:n,context,options:cp(options),title:context.attack?'战斗中的响应时机':'连锁响应'};return;}
        current=1-current;n++;
      }
      if(this.state.chain.length)this.state.chainResolving=true;
    }
    respond(action){
      const p=this.state.pending;req(p&&['window','trigger'].includes(p.kind),'当前不是效果响应时机。');this.state.pending=null;
      if(p.kind==='trigger'){
        if(action.pass||action.uid===null){req(!p.trigger.mandatory,'这个效果必须处理。');return;}
        const t=p.trigger;const ctx=this.abilityContext(t.uid,t.key,'trigger',{...t.event,controller:t.owner,sourceId:t.sourceId,mandatory:t.mandatory},action.choices||{});
        this.prepare(ctx);return;
      }
      if(action.pass||action.uid===null){this.openWindow(1-p.responder,p.passes+1);return;}
      const candidate=p.options.find(o=>o.uid===action.uid&&(!action.key||o.key===action.key));req(candidate,'这张卡不能在当前时机响应。');
      const ctx=this.abilityContext(candidate.uid,candidate.key,'window',{owner:p.responder,window:p.context},action.choices||{});
      ctx.window=cp(p);ctx.responseTo=p.context.chainLast?.id||null;
      this.prepare(ctx);
    }
    choose(action){
      const p=this.state.pending;req(p,'当前没有需要完成的选择。');
      const uids=action.uids||[];
      if(action.cancel){
        req(p.cancelable,'效果正在处理中，需要完成当前选择。');this.state.pending=null;
        if(p.kind==='input'&&p.ctx.origin==='window')this.state.pending=p.ctx.window;
        else if(p.kind==='input'&&p.ctx.origin==='main')this.state.frame=null;
        return;
      }
      const check=this.validatePick(p,uids);req(check.valid,check.message);this.state.pending=null;
      if(p.kind==='input'){p.ctx.args[p.group.key]=[...uids];this.rememberInput(p.ctx,p.group,uids);this.prepare(p.ctx);return;}
      if(p.kind==='materials'){
        if(p.purpose==='tribute')this.normalSummon({...p.action,tributes:[...uids]});
        else if(p.purpose==='extra')this.extraSummon({...p.action,materials:[...uids],position:action.position||p.action.position,...(action.zone!==undefined?{zone:action.zone}:{})});
        else if(p.purpose==='pendulum')this.pendulumSummon({...p.action,uids:[...uids],position:action.position||p.action.position});
        else if(p.purpose==='link-effect')this.performLink(p.owner,p.uid,uids,{requiredUid:p.requiredUid,zone:action.zone});
        else if(p.purpose==='fusion'){
          this.performFusion(p.owner,p.uid,uids,p.spellId,p.source,action.zone??null,action.position||'attack');
        }return;
      }
      if(p.kind==='order'){
        const group=this.state.building.groups[0];group.events=uids.map(id=>group.events.find(e=>e.id===id));
        for(const event of group.events)if(action.choicesByEvent?.[event.id])event.provided=cp(action.choicesByEvent[event.id]);
        group.ordered=true;group.approved=true;return;
      }
      if(p.kind==='choice'){
        const tasks=this.collectTasks(()=>this.fx.operation(this,{op:p.operation,owner:p.owner,context:p.context,picks:[...uids]}));this.state.tasks.unshift(...tasks);return;
      }
      if(p.kind==='discard'){
        for(const uid of uids){this.ownCard(uid,['hand'],p.owner);this.move(uid,'grave',{kind:'rule-discard',reason:'结束阶段手牌上限'});}return;
      }
      if(p.kind==='replay'){this.replayAttack(uids[0]);return;}
      throw new RuleError('未知的选择类型。');
    }
    beginTriggerBatch(){
      const events=this.state.triggers.splice(0),owners=[this.state.active,1-this.state.active],groups=[];
      for(const owner of owners){
        const list=events.filter(t=>t.owner===owner).sort((a,b)=>a.priority-b.priority);
        if(list.length)groups.push({owner,events:list,ordered:false,approved:false});
      }
      this.state.building={groups};
    }
    processTriggerGroup(){
      const building=this.state.building;
      if(!building.groups.length){
        this.state.building=null;
        if(this.state.chain.length){if(this.state.frame)this.state.frame.windowOffered=true;this.openWindow(1-this.state.chain.at(-1).owner,0);}return;
      }
      const group=building.groups[0];
      group.events=group.events.filter(t=>{
        try{return this.fx.canUse(this,this.abilityContext(t.uid,t.key,'trigger',{...t.event,controller:t.owner,sourceId:t.sourceId,mandatory:t.mandatory}));}catch{return false;}
      });
      if(!group.events.length){building.groups.shift();return;}
      if(!group.ordered&&group.events.length>1){
        this.state.pending={kind:'order',owner:group.owner,responder:group.owner,title:'决定同一时点的连锁顺序',min:group.events.filter(t=>t.mandatory).length,max:group.events.length,candidates:group.events.map(t=>({uid:t.id,cardId:t.sourceId,label:CARDS[t.sourceId].name,detail:this.fx.get(t.key).label,mandatory:t.mandatory})),cancelable:false};return;
      }
      const t=group.events.shift();
      if(group.approved||t.mandatory){
        const ctx=this.abilityContext(t.uid,t.key,'trigger',{...t.event,controller:t.owner,sourceId:t.sourceId,mandatory:t.mandatory},t.provided||{});this.prepare(ctx);
      }else this.state.pending={kind:'trigger',owner:t.owner,responder:t.owner,trigger:cp(t),title:'可以发动诱发效果'};
    }
    chainPrevention(link){
      const origin=this.find(link.uid),same=origin&&(origin.card.generation||0)===link.source.generation;
      return {
        unavailable:!!(link.requiresField&&(!same||!['monsters','extraMonster','spells','fieldSpell'].includes(origin.zone)||!origin.card.faceUp)),
        negated:!!(link.negatedActivation||link.effectNegated||this.earlyNegatesLink?.(link,true)||same&&fieldMonster(link.source.zone)&&fieldMonster(origin.zone)&&this.negated(origin.card))
      };
    }
    traceChainImpact(link){
      // Compare with the previous public state. An already-active continuous effect
      // must never be attributed to an unrelated, higher-numbered chain link.
      for(const waiting of this.state.chain){
        const before=waiting.preventionState,after=this.chainPrevention(waiting);
        if(before){
          if(after.unavailable&&!before.unavailable)waiting.sourceUnavailableByNumber=link.chainNumber;
          if(after.negated&&!before.negated)waiting.effectNegatedByNumber=link.chainNumber;
          if(!after.unavailable)delete waiting.sourceUnavailableByNumber;
          if(!after.negated)delete waiting.effectNegatedByNumber;
        }
        waiting.preventionState=after;
        for(const group of Object.values(waiting.targetMeta||{}))for(const [uid,saved] of Object.entries(group)){
          const now=this.find(uid);
          if(!saved.lostByNumber&&(!now||now.zone!==saved.zone||now.owner!==saved.owner||(now.card.generation||0)!==saved.generation))saved.lostByNumber=link.chainNumber;
        }
      }
    }
    recordChain(stage,link,extra={}){
      const data={id:link.id,chainId:link.chainId,number:link.chainNumber,owner:link.owner,cardId:link.sourceId,key:link.key,uid:link.uid};
      let entry=this.state.chainHistory.find(item=>item.id===link.id);
      if(!entry){
        entry={...data,status:'waiting',targets:Object.values(link.targetMeta||{}).flatMap(group=>Object.entries(group).map(([uid,t])=>({uid,cardId:t.public||t.owner===0?t.cardId:null,owner:t.owner,zone:t.zone})))};
        this.state.chainHistory.push(entry);
        this.state.chainHistory=this.state.chainHistory.slice(-120);
      }
      if(stage==='resolve')entry.status='resolving';
      if(stage==='negated'||stage==='unavailable'){entry.status=stage;entry.reason=extra.reason;entry.byNumber=extra.byNumber||null;}
      if(stage==='target-lost'){entry.status='target-lost';entry.lostTargets=cp(extra.targets);}
      if(stage==='resolved'){entry.status=extra.status;entry.finished=true;}
      if(stage==='resolved'||stage==='add')this.traceChainImpact(link);
      this.events.push({kind:'chain-'+stage,...data,...cp(extra),entry:cp(entry)});
    }
    negateLink(id,source,activation=true,destroy=true){
      const link=this.state.chain.find(l=>l.id===id);if(!link||link.negatedActivation||link.effectNegated)return false;
      if(this.fx.get(link.key)?.cannotNegate)return false;
      const origin=this.find(link.uid);
      if(origin&&fieldMonster(origin.zone)&&this.unaffected(origin.card,source))return false;
      if(activation)link.negatedActivation=true;else link.effectNegated=true;
      link.negatedBy=source.owner;
      link.negatedByLink=this.state.resolvingLink?.id||null;
      link.negatedByNumber=this.state.resolvingLink?.chainNumber||null;
      this.recordChain('negated',link,{byLink:link.negatedByLink,byNumber:link.negatedByNumber,reason:activation?'activation-negated':'effect-negated'});
      this.log('negate','连锁 '+link.chainNumber+'「'+CARDS[link.sourceId].name+'」的'+(activation?'发动':'效果')+'被'+(link.negatedByNumber?'连锁 '+link.negatedByNumber:'效果')+'无效',source.owner,{uid:link.uid,cardId:link.sourceId,chain:link.chainNumber,chainId:link.chainId,byChain:link.negatedByNumber});
      if(destroy&&origin&&(fieldMonster(origin.zone)||['spells','fieldSpell','hand'].includes(origin.zone)))this.destroy(origin.card.uid,source,false,{negatedActivation:activation&&link.cardActivation});
      return true;
    }
    resolveLink(){
      const link=this.state.chain.pop();this.state.resolvingLink=link;
      this.recordChain('resolve',link);
      const f=this.find(link.uid),ability=this.fx.get(link.key);
      let negated=link.negatedActivation||link.effectNegated;
      if(!negated&&this.earlyNegatesLink)negated=this.earlyNegatesLink(link);
      if(!negated&&fieldMonster(link.source.zone)&&f&&fieldMonster(f.zone)&&(f.card.generation||0)===link.source.generation&&this.negated(f.card))negated=true;
      const unavailable=!negated&&link.requiresField&&(!f||!['monsters','extraMonster','spells','fieldSpell'].includes(f.zone)||!f.card.faceUp||(f.card.generation||0)!==link.source.generation);
      const lostTargets=[];
      for(const [key,targets] of Object.entries(link.targetMeta||{})){
        link.args[key]=(link.args[key]||[]).filter(uid=>{const saved=targets[uid];if(!saved)return true;const now=this.find(uid),valid=now&&(now.card.generation||0)===saved.generation&&now.zone===saved.zone&&now.owner===saved.owner;if(!valid)lostTargets.push({uid,cardId:saved.public||saved.owner===0?saved.cardId:null,owner:saved.owner,zone:saved.zone,byNumber:saved.lostByNumber||null});return valid;});
      }
      if(lostTargets.length&&!negated&&!unavailable){
        link.lostTargets=lostTargets;
        this.recordChain('target-lost',link,{targets:lostTargets});
        this.log('chain-warning','连锁 '+link.chainNumber+'「'+CARDS[link.sourceId].name+'」的 '+lostTargets.length+' 个目标已离开原位置，相关部分无法处理',link.owner,{cardId:link.sourceId,chain:link.chainNumber,chainId:link.chainId,targets:lostTargets});
      }
      link.resolutionStatus=negated?'negated':unavailable?'unavailable':lostTargets.length?'target-lost':'resolved';
      if(negated&&!link.negatedActivation&&!link.effectNegated)this.recordChain('negated',link,{reason:'effect-negated',byNumber:link.effectNegatedByNumber||null});
      if(unavailable){
        this.recordChain('unavailable',link,{reason:'source-unavailable',byNumber:link.sourceUnavailableByNumber||null});
        this.log('chain-warning','连锁 '+link.chainNumber+'「'+CARDS[link.sourceId].name+'」需要保持在场，来源离场后效果未能适用',link.owner,{cardId:link.sourceId,chain:link.chainNumber,chainId:link.chainId,byChain:link.sourceUnavailableByNumber||null});
      }
      const tasks=negated||unavailable?[]:this.collectTasks(()=>this.fx.resolve(this,link));
      if(this.state.winner!==null){this.recordChain('resolved',link,{status:link.resolutionStatus});return;}
      if(negated&&!link.negatedActivation)this.log('negate','「'+CARDS[link.sourceId].name+'」的效果未能适用',link.owner,{cardId:link.sourceId});
      this.state.tasks.unshift(...tasks,{op:'finish-link',link:cp(link),applied:!negated&&!unavailable});
    }
    runTask(task){
      if(task.op==='link-materials'){
        const extra=this.find(task.extraUid)?.card,required=this.find(task.requiredUid);if(!extra||!required||!fieldMonster(required.zone)||(required.card.generation||0)!==task.source.generation)return;
        const sets=this.linkCombos(task.owner,extra,task.requiredUid);if(!sets.length)return;
        this.state.pending={kind:'materials',purpose:'link-effect',owner:task.owner,responder:task.owner,uid:extra.uid,requiredUid:task.requiredUid,source:task.source,min:1,max:7,candidates:this.monsters(task.owner).filter(c=>c.faceUp).map(c=>this.option(c,{viewer:task.owner,mandatory:c.uid===task.requiredUid})),sets,cancelable:false,title:'效果连接召唤 · 必须包含I：P'};return;
      }
      if(task.op==='effect-choice'){
        const cards=task.candidates.filter(c=>!c.cardId||this.find(c.uid));
        if(cards.length<task.min)return;
        this.state.pending={kind:'choice',responder:task.owner,owner:task.owner,title:task.title,candidates:cards,min:task.min,max:Math.min(task.max,cards.length),operation:task.operation,context:task.context,cancelable:false,sets:task.sets};return;
      }
      if(task.op==='fusion-materials'){
        const extra=this.find(task.extraUid)?.card;if(!extra)return;
        const combos=this.fusionCombos(task.owner,extra,task.spellId);if(!combos.length)return;
        this.state.pending={kind:'materials',purpose:'fusion',responder:task.owner,owner:task.owner,uid:extra.uid,title:task.spellId?.requiredUid?'珠泪融合 · 选择放回卡组的素材':'选择融合素材',min:(CARDS[extra.id].fusion||CARDS[extra.id].materials).length,max:CARDS[extra.id].fusionMore?this.fusionPool(task.owner,task.spellId).length:(CARDS[extra.id].fusion||CARDS[extra.id].materials).length,candidates:this.fusionPool(task.owner,task.spellId).map(c=>this.option(c,{viewer:task.owner,mandatory:c.uid===task.spellId?.requiredUid})),spellId:task.spellId,source:task.source,cancelable:false,validation:'fusion'};return;
      }
      if(task.op==='finish-link'){
        const link=task.link,f=this.find(link.uid);
        if(link.cardActivation&&f&&['spells','fieldSpell'].includes(f.zone))f.card.pendingActivation=false;
        if(link.cardActivation&&!link.negatedActivation&&link.source.effectType==='spell'){
          for(let p=0;p<2;p++)for(const c of this.monsters(p))if(c.faceUp&&!this.negated(c)&&['skilled-magician','royal-library'].includes(c.id))c.counters=Math.min(3,(c.counters||0)+1);
          this.emit({type:'spell-resolved',owner:link.owner,uid:link.uid,id:link.sourceId});
        }
        if(link.cardActivation&&!link.negatedActivation&&link.source.effectType==='trap')this.emit({type:'trap-resolved',owner:link.owner,uid:link.uid,id:link.sourceId});
        if(link.negatedActivation)this.fx.onNegated(this,link);
        this.recordChain('resolved',link,{status:link.resolutionStatus||'resolved'});
        this.state.resolvingLink=null;this.checkWin();return;
      }
      const tasks=this.collectTasks(()=>this.fx.operation(this,task));this.state.tasks.unshift(...tasks);
    }
    pump(){
      let guard=0;
      while(!this.state.pending&&this.state.winner===null&&guard++<600){
        if(this.state.tasks.length){this.runTask(this.state.tasks.shift());continue;}
        if(this.state.chainResolving){
          if(this.state.chain.length){this.resolveLink();continue;}
          this.events.push({kind:'chain-complete',chainId:this.state.chainId});
          this.emit({type:'chain-complete',owner:this.state.active,chainId:this.state.chainId,links:this.state.chainHistory.filter(l=>l.chainId===this.state.chainId).map(l=>({...l}))});
          this.state.chainResolving=false;this.state.chainId=null;
          for(const uid of [...new Set(this.state.chainCleanup.splice(0))]){const f=this.find(uid);if(f&&['spells','fieldSpell'].includes(f.zone))this.move(uid,'grave',{kind:'rule-resolved',reason:'连锁处理结束'});}
          if(this.state.earlyNeedsWindow&&this.state.frame){this.state.frame.windowOffered=false;this.state.earlyNeedsWindow=false;}
          continue;
        }
        if(this.state.frame?.kind==='summon-attempt'){if(this.settleFrame())continue;break;}
        if(this.state.frame?.kind==='summon-attempt'){if(this.settleFrame())continue;break;}
        if(this.state.frame?.kind==='summon-attempt'){if(this.settleFrame())continue;break;}
        if(this.state.building){this.processTriggerGroup();continue;}
        if(this.state.triggers.length){this.beginTriggerBatch();continue;}
        if(this.state.chain.length){this.openWindow(1-this.state.chain.at(-1).owner,0);continue;}
        if(this.state.frame){if(this.settleFrame())continue;}
        break;
      }
      if(guard>=600)throw new Error('Duel resolution exceeded safety bound');
    }
    act(action){
      const before=this.snapshot();this.events=[];
      try{
        req(this.state.winner===null,'这场决斗已经结束。');req(action&&typeof action.type==='string','无效的操作。');
        if(this.state.pending)req(['choose','respond','pass','discard'].includes(action.type),'请先处理当前的选择或连锁。');
        else req(!['choose','respond','pass','discard'].includes(action.type),'当前没有待处理的响应。');
        if(action.owner!==undefined)req(action.owner===(this.state.pending?.responder??this.state.active),'现在不是这一方的行动时机。');
        switch(action.type){
          case 'summon':this.normalSummon(action);break;
          case 'set':this.setCard(action);break;
          case 'stance':this.changeStance(action);break;
          case 'activate':case 'cast':case 'effect':this.activate(action);break;
          case 'extra-summon':this.extraSummon(action);break;
          case 'pendulum-summon':this.pendulumSummon(action);break;
          case 'pendulum-scale':{
            const ctx=this.abilityContext(action.uid,'$pendulum::place','main',{owner:this.state.active},{slot:['slot:'+action.slot]});
            this.state.frame={kind:'main-open',owner:this.state.active,windowOffered:false};this.prepare(ctx);break;
          }
          case 'attack':this.declareAttack(action);break;
          case 'phase':this.changePhase(action.phase);break;
          case 'end':this.endTurn();break;
          case 'choose':this.choose(action);break;
          case 'respond':this.respond(action);break;
          case 'pass':this.respond({pass:true});break;
          case 'discard':this.choose({uids:action.uids});break;
          default:throw new RuleError('未知的操作。');
        }
        this.pump();this.checkWin();this.assertState();
        const events=cp(this.events);this.onChange(events);return {ok:true,events};
      }catch(error){
        this.state=before.state;this.randomState=before.randomState;this.events=[];this._collecting=null;
        if(!(error instanceof RuleError))throw error;return {ok:false,error:error.message};
      }
    }

    attackBlocked(owner){
      return this.spells(1-owner).some(c=>c.id==='swords'&&c.turnsLeft>0&&this.activeSpell(c))||this.state.players[owner].cannotAttackTurn===this.state.turn;
    }
    attackAllowance(card){
      const c=CARDS[card.id],off=this.negated(card);
      let n=!off&&c.id==='cyber-twin'?2:!off&&c.id==='chimeratech-overdragon'?Math.max(1,card.materialCount||0):1;
      if(card.shootingTurn===this.state.turn)n=card.shootingAttackCount;
      n+=(card.extraAttacks||0)+(card.doubleAllowance||0);return n;
    }
    canAttack(card,owner=this.state.active,target=null){
      const f=this.find(card.uid),p=this.state.players[owner];
      if(!f||f.owner!==owner||!fieldMonster(f.zone)||!card.faceUp||card.position!=='attack'||this.attackBlocked(owner))return false;
      if((card.attacksMade||0)>=this.attackAllowance(card))return false;
      if(p.attackOnly?.turn===this.state.turn&&p.attackOnly.uid!==card.uid)return false;
      if(target===null&&(card.noDirect||(!this.negated(card)&&card.id==='chimeratech-overdragon'&&card.attacksMade>0)))return false;
      return true;
    }
    battleLocked(owner,attack){
      if(!attack||attack.stage==='negated')return false;
      for(const uid of [attack.uid,attack.target]){
        const f=this.find(uid);if(f&&f.owner!==owner&&fieldMonster(f.zone)&&f.card.faceUp&&!this.negated(f.card)&&['utopia-lightning','samurai-destroyer'].includes(f.card.id))return true;
      }return false;
    }
    declareAttack(action){
      req(this.state.phase==='battle','请先进入战斗阶段。');
      const {card,owner}=this.ownCard(action.uid,['monsters']),target=typeof action.target==='string'?action.target:action.target?.uid||null;
      req(this.canAttack(card,owner,target),'这只怪兽现在不能宣言这次攻击。');
      const enemy=this.monsters(1-owner);
      req(target?enemy.some(m=>m.uid===target):enemy.length===0||card.directAttackTurn===this.state.turn,'必须先攻击对方的怪兽。');
      card.attacksMade=(card.attacksMade||0)+1;card.attacked=true;
      this.state.nextAttack ||= 1;
      const attack={uid:card.uid,owner,target,serial:this.state.nextAttack++,generation:card.generation||0,targetGeneration:target?this.find(target).card.generation||0:null,stage:'declare',negated:false,preventDamageFor:[],double:!!card.doubleNextAttack,defenders:this.monsters(1-owner).map(m=>m.uid+':'+(m.generation||0)).sort().join('|')};
      card.doubleNextAttack=false;
      this.state.frame={kind:'attack',owner,uid:card.uid,attack,windowOffered:false};
      const targetCard=target?this.find(target).card:null;
      this.log('attack',CARDS[card.id].name+(targetCard?'攻击'+(targetCard.faceUp?'「'+CARDS[targetCard.id].name+'」':'里侧怪兽'):'发动直接攻击'),owner,{uid:card.uid,target,cardId:card.id});
      this.emit({type:'attack',owner,uid:card.uid,id:card.id,target,attack:cp(attack)});
    }
    negateAttack(endBattle=false){
      const attack=this.state.frame?.attack;if(!attack)return false;
      attack.negated=true;attack.endBattle=!!endBattle;
      this.state.lastNegatedAttack={...cp(attack),turn:this.state.turn};
      this.log('negate',CARDS[this.find(attack.uid)?.card.id||'utopia'].name+'的攻击被无效',attack.owner);
      return true;
    }
    replayAttack(target){
      const f=this.state.frame,attack=f?.attack;req(attack,'攻击已经结束。');
      if(target==='cancel'){this.state.frame=null;this.state.battleNegated=[];return;}
      const chosen=target==='direct'?null:target,source=this.find(attack.uid);
      req(source&&fieldMonster(source.zone),'攻击怪兽已离场。');
      const enemy=this.monsters(1-attack.owner);
      req(chosen?enemy.some(c=>c.uid===chosen):(!enemy.length||source.card.directAttackTurn===this.state.turn)&&!source.card.noDirect,'重选的攻击目标不合法。');
      attack.target=chosen;attack.targetGeneration=chosen?(this.find(chosen).card.generation||0):null;attack.defenders=enemy.map(m=>m.uid+':'+(m.generation||0)).sort().join('|');attack.stage='replay';f.windowOffered=false;
      this.log('attack','战斗卷回：重新选择了攻击目标',attack.owner);
    }
    finishBattle(attack){
      const af=this.find(attack.uid);if(!af||!fieldMonster(af.zone))return;
      const attacker=af.card,df=attack.target?this.find(attack.target):null,defender=df?.card;
      attack.stage='resolving';
      this.events.push({kind:'battle',uid:attack.uid,target:attack.target,owner:attack.owner});
      const at=this.attackValue(attacker,attack),dt=defender?(defender.position==='defense'?this.defenseValue(defender,attack):this.attackValue(defender,attack)):0;
      const av=this.describe(attacker),dv=defender?this.describe(defender):null;
      const damage=(owner,amount,piercing=false)=>{
        const own=[attacker,defender].filter(Boolean).find(m=>this.find(m.uid)?.owner===owner&&m.id==='bw-armor-master'&&!this.negated(m));
        if(own||attack.preventDamageFor.includes(owner))return;
        this.damage(owner,amount,piercing?'战斗':'战斗');
      };
      let defeated=null,destroyedAttacker=false;
      if(!defender){damage(1-attack.owner,at);}
      else{
        const diff=at-dt;
        if(defender.position==='attack'){
          if(diff>0){if(this.destroy(defender.uid,{id:attacker.id,uid:attacker.uid,owner:attack.owner,effectType:'battle'},true))defeated=dv;damage(df.owner,diff);}
          else if(diff<0){destroyedAttacker=this.destroy(attacker.uid,{id:defender.id,uid:defender.uid,owner:1-attack.owner,effectType:'battle'},true);damage(attack.owner,-diff);}
          else if(at>0){if(this.destroy(defender.uid,{id:attacker.id,uid:attacker.uid,owner:attack.owner,effectType:'battle'},true))defeated=dv;destroyedAttacker=this.destroy(attacker.uid,{id:defender.id,uid:defender.uid,owner:1-attack.owner,effectType:'battle'},true);}
        }else{
          if(diff>0){
            if(this.destroy(defender.uid,{id:attacker.id,uid:attacker.uid,owner:attack.owner,effectType:'battle'},true))defeated=dv;
            if(!this.negated(attacker)&&['spear-dragon','bw-bora','bw-armed-wing','cyber-end'].includes(attacker.id))damage(1-attack.owner,diff,true);
          }else if(diff<0)damage(attack.owner,-diff);
        }
      }
      if(defeated&&this.state.winner===null)this.emit({type:'battle-win',owner:attack.owner,uid:attacker.uid,id:attacker.id,victim:defeated,victimDestination:this.find(defeated.uid)?.zone||'vanished',attack:cp(attack)});
      if(destroyedAttacker&&defender&&this.state.winner===null)this.emit({type:'battle-win',owner:1-attack.owner,uid:defender.uid,id:defender.id,victim:av,victimDestination:this.find(av.uid)?.zone||'vanished',attack:cp(attack)});
      const still=this.find(attacker.uid);
      if(still&&fieldMonster(still.zone)&&attacker.id==='spear-dragon'&&!this.negated(attacker)){attacker.position='defense';attacker.changedTurn=this.state.turn;this.log('stance','长枪龙在战斗后变为守备表示',attack.owner,{uid:attacker.uid});}
      if(still&&fieldMonster(still.zone)&&attacker.id==='bw-armor-master'&&!this.negated(attacker)&&defender){
        const target=this.find(defender.uid);if(target&&fieldMonster(target.zone)){target.card.wedge=(target.card.wedge||0)+1;this.log('effect','对方怪兽获得1个楔指示物',attack.owner,{uid:defender.uid});}
      }
    }
    changePhase(phase){
      if(phase==='end'){this.endTurn();return;}
      const current=this.state.phase;
      req((current==='main1'&&['battle','main2'].includes(phase))||(current==='battle'&&phase==='main2'),'不能回到之前的阶段。');
      req(!(phase==='battle'&&this.state.turn===1),'先攻首回合不能进入战斗阶段。');
      this.state.phase=phase;this.log('phase',phase==='battle'?'进入战斗阶段':'进入主要阶段 2',this.state.active);
      this.state.frame={kind:phase==='battle'?'battle-open':'main-open',owner:this.state.active,windowOffered:false};
      this.emit({type:'phase',owner:this.state.active,phase});
    }
    endTurn(){
      this.state.frame={kind:'end',owner:this.state.active,stage:0,windowOffered:true};
      this.log('phase',this.name(this.state.active)+'进入结束阶段',this.state.active);
    }
    beginNextTurn(){
      const ending=this.state.active;
      for(const card of [...this.spells(1-ending)])if(this.activeSpell(card)&&card.id==='swords'){card.turnsLeft--;if(card.turnsLeft<=0)this.move(card.uid,'grave',{kind:'rule-expire',reason:'光之护封剑持续时间结束'});}
      this.log('end',this.name(ending)+'结束了回合',ending);
      this.state.active=1-ending;this.state.turn++;this.state.phase='main1';this.state.normalUsed=false;this.state.lastNegatedAttack=null;this.state.battleNegated=[];
      for(const p of this.state.players){
        p.turnStats={special:0,extraTypes:[],qliTributes:0,crySynchros:0};p.extraNormalUsed=false;p.locks=p.locks.filter(l=>l.turn===this.state.turn);
        for(const c of [...present(p.monsters),p.extraMonster,p.extraMonster2].filter(Boolean)){c.attacksMade=0;c.attacked=false;c.extraAttacks=0;c.doubleAllowance=0;c.doubleNextAttack=false;c.battleBoost=null;c.mods=(c.mods||[]).filter(m=>!m.until||m.until>=this.state.turn);}
      }
      this.log('turn','第 '+this.state.turn+' 回合 · '+this.name(this.state.active)+'的回合',this.state.active);
      this.state.inDrawPhase=true;
      const p=this.state.players[this.state.active];
      if(p.skipTurn){p.skipTurn=false;this.state.inDrawPhase=false;this.log('phase','因卡片效果跳过这个回合',this.state.active);this.beginNextTurn();return;}
      if(p.skipDraws>0){p.skipDraws--;this.log('draw','因卡片效果跳过这次抽卡阶段',this.state.active);}
      else this.draw(this.state.active,1);
      this.state.inDrawPhase=false;this.checkWin();
      if(this.state.winner===null)this.state.frame={kind:'main-open',owner:this.state.active,windowOffered:false};
    }
    settleFrame(){
      const f=this.state.frame;if(!f)return false;
      if(f.kind==='end'){
        if(f.stage===0){
          f.stage=1;this.emit({type:'end-phase',owner:f.owner});
          this.fx.endPhase(this,f.owner);return true;
        }
        const p=this.state.players[f.owner];
        if(p.hand.length>(p.handSizeLimit||6)&&!this.hasEarly?.('Infinite Cards')){this.state.pending={kind:'discard',owner:f.owner,responder:f.owner,title:'结束阶段 · 选择弃牌',min:p.hand.length-(p.handSizeLimit||6),max:p.hand.length-(p.handSizeLimit||6),candidates:p.hand.map(c=>this.option(c)),cancelable:false};return false;}
        this.state.frame=null;this.beginNextTurn();return true;
      }
      if(!f.windowOffered){
        f.windowOffered=true;
        const first=f.kind==='attack-negated'?f.owner:f.attack?.stage==='calc'?f.owner:1-f.owner;
        this.openWindow(first,0);return true;
      }
      if(f.kind==='attack-negated'){this.state.frame=null;this.state.battleNegated=[];return false;}
      if(f.kind==='attack'){
        const a=f.attack,attacker=this.find(a.uid);
        if(a.endBattle){this.state.phase='main2';this.state.frame=null;this.state.battleNegated=[];this.log('phase','战斗阶段被结束',a.owner);return false;}
        if(a.negated){a.stage='negated';f.kind='attack-negated';f.windowOffered=false;return true;}
        if(!attacker||!fieldMonster(attacker.zone)||(attacker.card.generation||0)!==a.generation||!attacker.card.faceUp||attacker.card.position!=='attack'){
          this.state.frame=null;this.state.battleNegated=[];return false;
        }
        if(['declare','replay'].includes(a.stage)){
          const enemies=this.monsters(1-a.owner),signature=enemies.map(m=>m.uid+':'+(m.generation||0)).sort().join('|');
          if(signature!==a.defenders){
            const candidates=enemies.map(c=>this.option(c));
            if((!enemies.length||attacker.card.directAttackTurn===this.state.turn)&&!attacker.card.noDirect)candidates.push({uid:'direct',label:'直接攻击',detail:'向对方生命值发动攻击'});
            candidates.push({uid:'cancel',label:'放弃这次攻击',detail:'这次攻击次数仍然消耗'});
            this.state.pending={kind:'replay',owner:a.owner,responder:a.owner,title:'战斗卷回 · 重新选择目标',min:1,max:1,candidates,cancelable:false};return false;
          }
          const defender=a.target?this.find(a.target):null;
          if(defender&&!defender.card.faceUp){defender.card.faceUp=true;a.flippedTarget=this.describe(defender.card);this.log('reveal','里侧怪兽是「'+CARDS[defender.card.id].name+'」',defender.owner,{cardId:defender.card.id,uid:defender.card.uid});}
          a.stage='calc';f.windowOffered=false;this.state.battleNegated=[];
          const suppressed=[[attacker,defender],[defender,attacker]].filter(pair=>pair[0]&&pair[1]&&pair[0].card.id==='samurai-destroyer'&&!this.negated(pair[0].card)).map(pair=>pair[1].card.uid);
          this.state.battleNegated=suppressed;
          this.emit({type:'damage-start',owner:a.owner,attack:cp(a)});return true;
        }
        if(a.stage==='calc'){if(a.flippedTarget)a.flippedTarget.wasNegated=this.negated(this.find(a.flippedTarget.uid)?.card||{});this.finishBattle(a);if(this.state.winner!==null)return false;if(a.flippedTarget)this.emit({type:'flip',owner:a.flippedTarget.owner,uid:a.flippedTarget.uid,id:a.flippedTarget.id,previous:a.flippedTarget,attack:cp(a)});this.emit({type:'damage-end',owner:a.owner,attack:cp(a)});a.stage='finished';return true;}
        this.state.battleNegated=[];this.state.frame=null;return false;
      }
      this.state.frame=null;return false;
    }

    actionsFor(uid,owner=this.state.active){
      const f=this.find(uid);if(!f||f.owner!==owner||this.state.winner!==null||this.state.pending||owner!==this.state.active)return [];
      const c=CARDS[f.card.id],main=['main1','main2'].includes(this.state.phase),out=[];
      if(main&&f.zone==='hand'){
        if(this.canNormal(f.card,owner)){
          if(c.qliReduced&&this.tributeSets(f.card,true,owner).length){out.push({type:'summon',uid,mode:'attack',noTribute:true,label:'不解放通常召唤',icon:'swords'});out.push({type:'summon',uid,mode:'defense',noTribute:true,label:'不解放里侧盖放',icon:'shield'});}
          if(this.tributeSets(f.card,false,owner).length){out.push({type:'summon',uid,mode:'attack',label:this.tributeCount(f.card)?'上级召唤 · '+this.tributeCount(f.card)+'份祭品':'攻击表示召唤',icon:'swords'});out.push({type:'summon',uid,mode:'defense',label:'里侧守备盖放',icon:'shield'});}
        }
        if(['spell','trap'].includes(c.type)&&this.state.players[owner].spells.includes(null))out.push({type:'set',uid,label:'盖放到场上',icon:'card'});
        if(c.type==='pendulum')for(const slot of [0,4])if(!this.state.players[owner].spells[slot])out.push({type:'pendulum-scale',uid,slot,label:(slot===0?'左':'右')+'刻度 '+c.scale,icon:'pendulum'});
      }
      if(main&&fieldMonster(f.zone)&&c.type!=='link'&&f.card.summonTurn<this.state.turn&&f.card.changedTurn<this.state.turn&&(f.card.attacksMade||0)===0)out.push({type:'stance',uid,label:!f.card.faceUp?'反转召唤':f.card.position==='attack'?'变为守备表示':'变为攻击表示',icon:'shield'});
      if(this.state.phase==='battle'&&fieldMonster(f.zone)){
        const targets=this.monsters(1-owner);
        if(targets.some(t=>this.canAttack(f.card,owner,t.uid))||(!targets.length&&this.canAttack(f.card,owner,null))||(f.card.directAttackTurn===this.state.turn&&this.canAttack(f.card,owner,null)))out.push({type:'attack',uid,label:targets.length?'选择攻击目标':'直接攻击',icon:'swords'});
      }
      for(const a of this.fx.available(this,owner,{kind:'main',phase:this.state.phase,onlyUid:uid}))out.push({type:'activate',uid,key:a.key,label:a.label,icon:'spark'});
      return out;
    }
    allActions(owner=this.state.active){
      if(this.state.pending||this.state.winner!==null||owner!==this.state.active)return [];
      const out=this.refs(owner,['hand','monsters','extraMonster','spells','fieldSpell','grave','banished']).flatMap(f=>this.actionsFor(f.card.uid,owner));
      if(['main1','main2'].includes(this.state.phase)){
        for(const opt of this.extraOptions(owner))out.push({type:'extra-summon',uid:opt.card.uid,label:({synchro:'同调',xyz:'超量',link:'连接'}[opt.type])+'召唤',icon:opt.type});
        if(this.pendulumCandidates(owner).length)out.push({type:'pendulum-summon',label:'灵摆召唤',icon:'pendulum'});
      }
      return out;
    }
    cardUtility(card,owner=this.state.active){
      const c=CARDS[card.id];
      if(c.exodiaPart)return 25000;
      if(card.id==='royal-library')return 7500;
      if(['pot-of-greed','cyber-emergency','e-emergency-call','tuning','black-whirlwind','qli-scout'].includes(card.id))return 6000;
      if(c.type==='trap')return 2200;
      if(c.type==='spell')return 2500;
      return (c.atk||0)+(c.level<=4?1500:0)+(c.tuner?800:0)+(c.aiValue||0)+(['hero-stratos','cyber-core','junk-synchron','cry-sulfefnir'].includes(c.id)?2000:0);
    }
    enemyValue(card){return card.faceUp?(card.position==='defense'?this.defenseValue(card):this.attackValue(card)):1600;}
    actionScore(action){
      const owner=this.state.active,p=this.activePlayer,f=action.uid?this.find(action.uid):null,c=f?CARDS[f.card.id]:null;
      if(action.type==='activate'){
        const a=this.fx.get(action.key),ctx=this.abilityContext(action.uid,action.key,'main',{owner});
        const score=a.aiScore?(typeof a.aiScore==='function'?a.aiScore(this,ctx):a.aiScore):f&&fieldMonster(f.zone)&&this.negated(f.card)&&!a.leavesAsCost?-100:350;
        return root.DuelAIMarginal?root.DuelAIMarginal.score(this,action,owner,score):score;
      }
      if(action.type==='pendulum-scale'){
        const other=p.spells[action.slot===0?4:0],scale=c.scale;
        if(other&&CARDS[other.id].scale===scale)return -100;
        if(!other&&scale===9&&action.slot===0)return 620;
        return 750+(c.id==='qli-scout'?150:0)+((scale<=4&&action.slot===0)||(scale>4&&action.slot===4)?30:0);
      }
      if(action.type==='pendulum-summon')return 680;
      if(action.type==='extra-summon'){
        const opt=this.extraOptions(owner).find(o=>o.card.uid===action.uid);if(!opt)return -100;
        const archetype=this.deckInfo(owner).id;
        if(c.type==='link')return this.fx.linkScore?this.fx.linkScore(this,c,opt):-100;
        const bonus={'junk-speeder':1400,'shooting-star':1700,'cyber-infinity':1400,'cyber-nova':1050,'utopia-double':1100,'utopia-lightning':900,'cry-quariongandrax':1200,'cry-phoenix':1200,'bw-armor-master':750,'bw-raikiri':850,'bw-nothung':1000,'stardust-dragon':750,'formula-synchron':850}[c.id]||500;
        if(c.id==='utopia-lightning'&&this.monsters(owner).some(m=>m.id==='utopia-double')&&p.hand.some(h=>h.id==='double-or-nothing'))return 200;
        if(c.id==='formula-synchron'&&!this.monsters(owner).some(m=>m.id==='stardust-dragon')&&archetype!=='junk')return 400;
        return bonus+(c.atk||0)/30;
      }
      if(action.type==='summon'){
        if(c.exodiaPart)return -100;
        let score=380+(c.atk||0)/30+(c.tuner?50:0);
        const bonuses={'hero-stratos':520,'hero-solid-soldier':p.hand.some(m=>isFamily(CARDS[m.id],'hero')&&m.uid!==f.card.uid)?640:200,'hero-blazeman':460,'hero-liquid-soldier':p.grave.some(m=>isFamily(CARDS[m.id],'hero'))?590:160,'junk-synchron':p.grave.some(m=>isMonster(CARDS[m.id])&&CARDS[m.id].level<=2)?900:120,'cyber-core':800,'cyber-drei':this.monsters(owner).some(m=>this.cardNameId(m)==='cyber-dragon')?850:250,'royal-library':1000,'cardcar-d':this.monsters(owner).length?180:650,'scrap-recycler':820,'goblindbergh':p.hand.length>=2?680:200,'gagaga-magician':260,'utopic-onomatopoeia':400,'bw-shura':500,'bw-kris':500,'bw-blizzard':p.grave.some(m=>CARDS[m.id].family==='blackwing')?750:160,'kaibaman':p.hand.some(m=>m.id==='blue-eyes')?700:0};
        score+=(bonuses[c.id]||0)+(c.normalPriority||0);
        if(c.family==='qliphort'){
          if(!action.noTribute&&this.tributeCount(f.card)>0)score+=c.id==='qli-towers'?1200:['qli-disk','qli-stealth'].includes(c.id)?900:100;
          else score+=100;
        }
        if(action.mode==='defense'){
          const strongest=Math.max(0,...this.monsters(1-owner).map(m=>this.enemyValue(m)));
          score+=c.def>c.atk&&strongest>c.atk?50:-120;
          if(c.effect&&(['hero-stratos','cyber-core','junk-synchron','scrap-recycler','bw-blizzard','goblindbergh'].includes(c.id)||c.normalPriority))score-=450;
        }
        const cost=action.noTribute?0:this.tributeCount(f.card);
        if(cost)score-=Math.min(...this.tributeSets(f.card,!!action.noTribute,owner).map(set=>set.reduce((n,uid)=>n+this.attackValue(this.find(uid).card)/15,0)));
        return score+(!this._aiMarginalProbe&&root.DuelAITactics?root.DuelAITactics.defenseBias(this,action):0);
      }
      if(action.type==='set')return c.type==='trap'&&present(p.spells).length<(this.state.difficulty==='casual'?2:4)?180:-100;
      if(action.type==='stance'){
        if(!f.card.faceUp||f.card.position==='defense')return this.monsters(1-owner).some(m=>this.attackValue(f.card)>this.enemyValue(m))||!this.monsters(1-owner).length?260:-100;
        return -100+(!this._aiMarginalProbe&&root.DuelAITactics?root.DuelAITactics.defenseBias(this,action):0);
      }
      return 0;
    }
    chooseAI(p){
      if(!this._aiMarginalProbe)this._aiMarginalPlans=new Map();
      if(p.kind==='order')return root.DuelAIMarginal?root.DuelAIMarginal.order(this,p):{type:'choose',uids:p.candidates.map(c=>c.uid)};
      if(p.kind==='materials'){
        if(p.purpose==='pendulum'){
          const ranked=[...p.candidates].sort((a,b)=>{
            const score=o=>['qli-carrier','qli-helix'].includes(o.cardId)?4500:(CARDS[o.cardId].atk||0);
            return score(b)-score(a);
          });
          const uids=[];for(const c of ranked)if(this.pendulumValid(p.owner,[...uids,c.uid]))uids.push(c.uid);
          return {type:'choose',uids};
        }
        let sets=p.sets;
        if(p.purpose==='fusion'){const c=this.find(p.uid)?.card;sets=c?this.fusionCombos(p.owner,c,p.spellId):[];}
        req(sets?.length,'AI找不到可行的素材组合。');
        let chosen=[...sets].sort((a,b)=>{
          const val=set=>set.reduce((n,uid)=>{const f=this.find(uid);return n+(f?this.cardUtility(f.card,p.owner):0);},0);
          return val(a)-val(b);
        })[0];
        if(p.purpose==='fusion'&&['chimeratech-rampage','chimeratech-overdragon'].includes(this.find(p.uid)?.card.id)){
          const max=this.find(p.uid).card.id==='chimeratech-overdragon'?8:3;
          chosen=[...sets].sort((a,b)=>Math.min(max,b.length)-Math.min(max,a.length))[0];
        }
        return {type:'choose',uids:chosen};
      }
      if(p.kind==='input')return {type:'choose',uids:this.fx.aiPick(this,p.ctx,p.group)};
      if(p.kind==='choice')return {type:'choose',uids:p.sets?.length?p.sets[0]:this.fx.aiChoice(this,p)};
      if(p.kind==='discard')return {type:'choose',uids:[...p.candidates].sort((a,b)=>this.cardUtility(this.find(a.uid).card,p.owner)-this.cardUtility(this.find(b.uid).card,p.owner)).slice(0,p.min).map(c=>c.uid)};
      if(p.kind==='replay'){
        const attack=this.state.frame.attack,a=this.find(attack.uid)?.card;
        const target=p.candidates.find(c=>c.uid==='direct')||p.candidates.filter(c=>c.cardId||c.hidden).sort((x,y)=>this.enemyValue(this.find(x.uid).card)-this.enemyValue(this.find(y.uid).card)).find(c=>this.enemyValue(this.find(c.uid).card)<=this.attackValue(a));
        return {type:'choose',uids:[target?.uid||'cancel']};
      }
      if(p.kind==='trigger'){
        const t=p.trigger,ctx=this.abilityContext(t.uid,t.key,'trigger',{...t.event,controller:t.owner,sourceId:t.sourceId,mandatory:t.mandatory});
        const action=this.fx.aiTrigger(this,ctx)?{type:'respond',uid:t.uid,key:t.key}:{type:'pass'};
        return root.DuelAIMarginal?root.DuelAIMarginal.action(this,action):action;
      }
      if(p.kind==='window'){
        const ranked=p.options.map(a=>({...a,score:this.fx.aiResponse(this,a,p.context,p.responder)})).filter(a=>a.score>0).sort((a,b)=>b.score-a.score);
        const action=ranked.length?{type:'respond',uid:ranked[0].uid,key:ranked[0].key}:{type:'pass'};
        return root.DuelAIMarginal?root.DuelAIMarginal.action(this,action):action;
      }
      return {type:'pass'};
    }
    aiNext(){
      this._aiMarginalPlans=new Map();
      this._aiDefenseCache=new Map();
      const s=this.state;if(s.winner!==null)return null;if(s.pending)return this.chooseAI(s.pending);
      if(!this._aiMarginalProbe&&root.DuelAITactics){const win=root.DuelAITactics.battlePlan(this);if(win)return win.action;}
      if(s.phase==='battle'){
        for(const card of this.monsters(s.active).sort((a,b)=>this.attackValue(b)-this.attackValue(a))){
          const foes=this.monsters(1-s.active);
          if(!foes.length&&this.canAttack(card,s.active,null))return {type:'attack',uid:card.uid};
          const targets=foes.filter(t=>this.canAttack(card,s.active,t.uid)&&this.enemyValue(t)<this.attackValue(card)).sort((a,b)=>this.enemyValue(b)-this.enemyValue(a));
          if(targets.length)return {type:'attack',uid:card.uid,target:targets[0].uid};
          if(card.directAttackTurn===s.turn&&this.canAttack(card,s.active,null))return {type:'attack',uid:card.uid};
        }
        return {type:'phase',phase:'main2'};
      }
      const ranked=this.allActions(s.active).map(action=>({action,score:this.actionScore(action)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
      if(ranked.length){
        if(!this._aiMarginalProbe&&root.DuelAITactics){const action=root.DuelAITactics.select(this,ranked);if(action)return action;}
        else return root.DuelAIMarginal?root.DuelAIMarginal.action(this,ranked[0].action):ranked[0].action;
      }
      if(s.phase==='main1'&&s.turn>1&&!this.attackBlocked(s.active)&&this.monsters(s.active).some(c=>c.faceUp&&c.position==='attack'))return {type:'phase',phase:'battle'};
      return {type:'end'};
    }
    snapshot(){return {state:cp(this.state),randomState:this.randomState};}
    static restore(saved){
      req(saved?.state&&[1,2,3].includes(saved.state.version),'存档版本不兼容。');
      const game=Object.create(ModernDuelEngine.prototype);game.state=cp(saved.state);game.randomState=saved.randomState>>>0;game.events=[];game.onChange=()=>{};
      for(const p of game.state.players||[])if(p.deckSpec&&!DECKS[p.deckId])DT.registerSnapshot(p.deckSpec);
      const oldVersion=game.state.version;game.initModern();
      if(oldVersion===1){
        for(const card of game.physicalCards())if(card.attacked&&!card.attacksMade)card.attacksMade=1;
        const pending=game.state.pending;
        if(pending&&['attack','summon'].includes(pending.kind)){
          game.state.pending=null;
          if(pending.kind==='attack'){
            const card=game.find(pending.uid)?.card;
            const attack={uid:pending.uid,owner:pending.owner,target:pending.target,serial:1,generation:card?.generation||0,targetGeneration:game.find(pending.target)?.card.generation||0,stage:'declare',negated:false,preventDamageFor:[],double:false,defenders:game.monsters(1-pending.owner).map(m=>m.uid+':'+(m.generation||0)).sort().join('|')};
            game.state.frame={kind:'attack',owner:pending.owner,attack,windowOffered:true};
          }else game.state.frame={kind:'summon',owner:pending.owner,uid:pending.uid,summonKind:'normal',windowOffered:true};
          game.openWindow(pending.responder,0);
        }else if(pending?.kind==='discard')game.state.pending={kind:'discard',owner:pending.owner,responder:pending.owner,title:'结束阶段 · 选择弃牌',min:pending.count,max:pending.count,candidates:game.state.players[pending.owner].hand.map(c=>game.option(c)),cancelable:false};
      }
      game.state.originalCardCount??=game.physicalCards().filter(c=>CARDS[c.id].type!=='token').length;
      game.assertState();return game;
    }
    assertState(){
      if(!this._advancedReady){super.assertState();return;}
      const s=this.state;
      if(s.version!==3||!Array.isArray(s.players)||s.players.length!==2||![0,1].includes(s.active)||!['main1','battle','main2'].includes(s.phase)||![null,0,1,'draw'].includes(s.winner)||!Number.isInteger(s.turn)||s.turn<1)throw new Error('Invalid modern duel state');
      const seen=new Set(),extraOccupied=new Set();
      for(let owner=0;owner<2;owner++){
        const p=s.players[owner];
        if(!p.deckSpec||!Number.isFinite(p.lp)||p.lp<0||p.monsters.length!==5||p.spells.length!==5)throw new Error('Invalid player or zone dimensions');
        for(const f of this.refs(owner)){
          const card=f.card,c=CARDS[card.id];
          if(!c||typeof card.uid!=='string'||seen.has(card.uid)||![0,1].includes(card.originalOwner))throw new Error('Unknown, duplicate or unowned card');
          seen.add(card.uid);
          if(fieldMonster(f.zone)&&!isMonster(c)&&!card.asMonster)throw new Error('Non-monster in monster zone');
          if(fieldMonster(f.zone)&&c.type==='link'&&(!card.faceUp||card.position!=='attack'))throw new Error('Link monster must be face-up in attack position');
          if(f.zone==='extraMonster'){if(![0,1].includes(card.extraSlot)||extraOccupied.has(card.extraSlot))throw new Error('Invalid or shared extra monster zone collision');extraOccupied.add(card.extraSlot);}
          if(f.zone==='spells'&&!['spell','trap','pendulum'].includes(c.type)&&!card.monsterEquip&&!card.crystalSpell&&!card.gxSetSpell)throw new Error('Invalid back-row card');
          if(f.zone==='spells'&&c.type==='pendulum'&&![0,4].includes(f.index))throw new Error('Pendulum card outside pendulum zone');
          if(f.zone==='fieldSpell'&&(c.type!=='spell'||c.spellKind!=='field'))throw new Error('Invalid field spell');
          if(c.type==='token'&&!fieldMonster(f.zone))throw new Error('Token outside field');
          for(const material of card.overlays||[]){
            if(!CARDS[material.id]||CARDS[material.id].type==='token'||seen.has(material.uid)||(material.overlays||[]).length)throw new Error('Invalid overlay material');
            seen.add(material.uid);
          }
        }
      }
      if(s.originalCardCount!==undefined&&this.physicalCards().filter(c=>CARDS[c.id].type!=='token').length!==s.originalCardCount)throw new Error('Physical card conservation violated');
      if(s.pending&&(![0,1].includes(s.pending.responder)||!['input','materials','order','choice','trigger','window','discard','replay'].includes(s.pending.kind)))throw new Error('Invalid pending decision');
      if(!Array.isArray(s.chain)||!Array.isArray(s.tasks)||!Array.isArray(s.triggers)||s.chain.length>100||s.tasks.length>300)throw new Error('Invalid resolution queues');
    }
  }
  root.LegacyDuelEngine=Base;root.DuelEngine=ModernDuelEngine;root.ModernDuelEngine=ModernDuelEngine;
  root.DuelModernUtils={req,cp,subsets,fieldMonster};
  if(typeof module!=='undefined'&&module.exports)module.exports={DuelEngine:ModernDuelEngine,RuleError,req,cp,subsets,fieldMonster};
  if(typeof module!=='undefined'&&module.exports){require('./early-engine.js');require('./early-engine-extra.js');require('./advanced-effects.js');require('./log-engine.js');}
})(typeof globalThis!=='undefined'?globalThis:this);
