(function(root){
  'use strict';
  // Lingering effects: restrictions and protections that keep applying after a
  // card has finished resolving (One Day of Peace, Pot of Duality, Waboku …).
  // The engine records them by comparing player, duel and field-card flags
  // before and after each chain link resolves, so every entry knows the card
  // that created it. Nothing here changes rules; this module only observes.
  const D=root.DuelData?.earlyLoaded?root.DuelData:(typeof require==='function'?require('./early-cards.js'):root.DuelData);
  const LANGS=['zh-CN','en','ja'];
  const TURNLIKE=/(Turn|Until)$/;
  const PLAYER_PATTERN=/(Turn|Until|Lock|Locked|Seal|Sealed)$/;
  const PLAYER_EXTRA=new Set(['skipTurn','skipDraws','skipBattle']);
  // Bookkeeping that happens to end in "Turn": these remember what a player did,
  // they do not restrict or protect anybody.
  const PLAYER_IGNORE=new Set(['usedTurn','lpPaidByTurn','handTrapUsed','extraNormalUsed','extraBattleUsed','eraSpecialTurn','monsterToGraveTurn','heroBattleDestroyedTurn','gxSpellUsedTurn','eraXyzTurn','pendulumTurn','eraCyberNetTurn','eraAmuletTurn','darkWorldGateTurn','summonedThisTurn','actionsThisTurn','eraSummonsThisTurn','chaosEmperorKey','lastWill']);
  const STATE_PATTERN=/(Turn|Until|Lock|Locked|Seal|Sealed)$/;
  const STATE_IGNORE=new Set(['turn','nextTurn','lastNegatedAttack','resolvingLink','nextLink','earlyLastSummon']);
  const ZONES=new Set(['hand','deck','grave','extra','banished','monsters','spells','fieldSpell','extraMonster','extraMonster2','overlays']);

  const L=(zh,en,ja)=>({'zh-CN':zh,en,ja});
  const GENERIC=L('「{card}」的效果生效中','"{card}" is in effect','「{card}」の効果が適用中');
  const PLAYER_KEYS={
    preventDamageUntil:L('不会受到任何伤害','Takes no damage','ダメージを受けない'),
    wabokuTurn:L('战斗伤害为 0，怪兽不会被战斗破坏','No battle damage; monsters are not destroyed by battle','戦闘ダメージ0・戦闘破壊されない'),
    skipBattleTurn:L('跳过战斗阶段','Battle Phase is skipped','バトルフェイズをスキップ'),
    skipBattle:L('跳过接下来 {n} 次战斗阶段','Skips the next {n} Battle Phase(s)','次の{n}回のバトルフェイズをスキップ'),
    cannotAttackTurn:L('怪兽不能攻击','Monsters cannot attack','モンスターは攻撃できない'),
    handTrapTurn:L('可以从手牌发动陷阱卡','Trap Cards can be activated from the hand','手札から罠カードを発動できる'),
    normalSummonLockedTurn:L('不能通常召唤','Cannot Normal Summon','通常召喚できない'),
    noSummonsTurn:L('怪兽只能里侧守备表示盖放','Monsters can only be Set','モンスターはセットしかできない'),
    spellTrapLockedTurn:L('不能发动魔法·陷阱卡','Cannot activate Spell/Trap Cards','魔法・罠カードを発動できない'),
    trapLockedTurn:L('不能发动陷阱卡','Cannot activate Trap Cards','罠カードを発動できない'),
    graveLockTurn:L('不能发动墓地的效果','Cannot activate effects in the Graveyard','墓地の効果を発動できない'),
    threateningRoarTurn:L('不能宣言攻击','Cannot declare an attack','攻撃宣言できない'),
    positionLockedTurn:L('不能改变表示形式','Cannot change battle positions','表示形式を変更できない'),
    gxNoSetTurn:L('不能盖放卡片','Cannot Set cards','カードをセットできない'),
    gxNoSpecialTurn:L('不能特殊召唤','Cannot Special Summon','特殊召喚できない'),
    gxDreadTurn:L('「命运英雄」怪兽不会被破坏','Destiny HERO monsters cannot be destroyed','「D-HERO」モンスターは破壊されない'),
    pikeruCircleTurn:L('不会受到效果伤害','Takes no effect damage','効果ダメージを受けない'),
    hallowedLifeTurn:L('不会受到战斗伤害','Takes no battle damage','戦闘ダメージを受けない'),
    wingedProtectionTurn:L('不会受到战斗伤害','Takes no battle damage','戦闘ダメージを受けない'),
    excitonTurn:L('不会受到任何伤害','Takes no damage','ダメージを受けない'),
    extraBattleTurn:L('可以进行第二次战斗阶段','Can conduct a second Battle Phase','2回目のバトルフェイズを行える'),
    absoluteDirectTurn:L('怪兽可以直接攻击','Monsters can attack directly','モンスターは直接攻撃できる'),
    costDownTurn:L('手牌怪兽的等级下降 2','Monsters in hand are 2 Levels lower','手札のモンスターのレベルが2下がる'),
    chaosEmperorTurn:L('本回合不能发动其他效果','No other effects can be activated this turn','このターン他の効果を発動できない'),
    kaminoteTurn:L('与武神战斗的怪兽将被破坏','Monsters battling the monks are destroyed','戦闘したモンスターを破壊する'),
    redEyesNoAttackTurn:L('真红眼黑龙不能攻击','Red-Eyes Black Dragon cannot attack','真紅眼の黒竜は攻撃できない'),
    blueEyesCannotAttackTurn:L('青眼白龙不能攻击','Blue-Eyes White Dragon cannot attack','青眼の白龍は攻撃できない'),
    diceRerollTurn:L('可以重掷一次骰子','One die roll may be rerolled','サイコロを1回振り直せる'),
    finalCountdownTurn:L('终焉之倒计时：第 {n} 回合取得胜利','Final Countdown: victory on turn {n}','終焉のカウントダウン：{n}ターン目に勝利'),
    skipTurn:L('下一个回合被跳过','The next turn is skipped','次のターンをスキップ'),
    skipDraws:L('跳过接下来 {n} 次抽卡阶段','Skips the next {n} Draw Phase(s)','次の{n}回のドローフェイズをスキップ')
  };
  const STATE_KEYS={
    noSummonUntil:L('不能召唤怪兽','Cannot Summon monsters','モンスターを召喚できない'),
    coldWaveUntil:L('不能发动或盖放魔法·陷阱卡','Cannot activate or Set Spell/Trap Cards','魔法・罠カードを発動・セットできない'),
    timidityUntil:L('盖放的魔法·陷阱卡不能发动','Set Spell/Trap Cards cannot be activated','セットされた魔法・罠カードは発動できない'),
    reverseStatsTurn:L('所有怪兽的攻击力与守备力互换','All monsters swap ATK and DEF','全モンスターの攻守を入れ替え'),
    noTrapsTurn:L('不能发动陷阱卡','Cannot activate Trap Cards','罠カードを発動できない'),
    noSpellTrapTurn:L('不能发动魔法·陷阱卡','Cannot activate Spell/Trap Cards','魔法・罠カードを発動できない'),
    gearCannonTurn:L('战斗阶段不能发动陷阱卡','Trap Cards cannot be activated during the Battle Phase','バトルフェイズに罠カードを発動できない'),
    feintPlanTurn:L('里侧表示的怪兽不能成为攻击对象','Face-down monsters cannot be attacked','裏側表示モンスターは攻撃対象にならない'),
    dimensionalRiftTurn:L('送去墓地的怪兽改为除外','Monsters sent to the Graveyard are banished instead','墓地へ送られるモンスターは除外される'),
    armoredGlassTurn:L('装备魔法卡的效果无效','Equip Spell effects are negated','装備魔法カードの効果は無効'),
    afterStruggleTurn:L('进行过战斗的怪兽在战斗后破坏','Monsters that battled are destroyed afterwards','戦闘を行ったモンスターは破壊される')
  };
  const ERA_LOCKS={
    noSpecial:L('不能特殊召唤','Cannot Special Summon','特殊召喚できない'),
    noNormal:L('不能通常召唤','Cannot Normal Summon','通常召喚できない'),
    normalSeries:L('只能通常召唤「{v}」怪兽','Can only Normal Summon "{v}" monsters','「{v}」モンスターしか通常召喚できない'),
    normalRace:L('只能通常召唤{v}怪兽','Can only Normal Summon {v} monsters','{v}しか通常召喚できない'),
    normalAttribute:L('只能通常召唤{v}属性怪兽','Can only Normal Summon {v} monsters','{v}属性しか通常召喚できない'),
    special:L('特殊召唤受到限制','Special Summons are restricted','特殊召喚に制限'),
    battleZero:L('战斗伤害为 0','Battle damage becomes 0','戦闘ダメージは0'),
    nextBattleZero:L('下一次战斗伤害为 0','The next battle damage becomes 0','次の戦闘ダメージは0'),
    skipBattle:L('跳过战斗阶段','Battle Phase is skipped','バトルフェイズをスキップ'),
    halfBattleDamage:L('战斗伤害减半','Battle damage is halved','戦闘ダメージ半減'),
    halfBattle:L('战斗伤害减半','Battle damage is halved','戦闘ダメージ半減'),
    halfEffect:L('效果伤害减半','Effect damage is halved','効果ダメージ半減'),
    halfDamage:L('受到的伤害减半','Damage is halved','受けるダメージ半減'),
    attacksOnly:L('攻击受到限制','Attacks are restricted','攻撃に制限'),
    attackRace:L('攻击受到限制','Attacks are restricted','攻撃に制限'),
    noAttacks:L('怪兽不能攻击','Monsters cannot attack','モンスターは攻撃できない'),
    reflectEffect:L('效果伤害改为由对方承受','Effect damage is dealt to the opponent instead','効果ダメージを相手に反射'),
    noSynchro:L('不能同调召唤','Cannot Synchro Summon','シンクロ召喚できない'),
    noSynchroXyz:L('不能同调·超量召唤','Cannot Synchro or Xyz Summon','S・X召喚できない'),
    noEffectDamage:L('不会受到效果伤害','Takes no effect damage','効果ダメージを受けない'),
    noBattleDamage:L('不会受到战斗伤害','Takes no battle damage','戦闘ダメージを受けない'),
    noDamage:L('不会受到任何伤害','Takes no damage','ダメージを受けない'),
    allDamageZero:L('不会受到任何伤害','Takes no damage','ダメージを受けない'),
    maxSpecialLevel:L('不能特殊召唤 {v} 星以上的怪兽','Cannot Special Summon monsters above Level {v}','レベル{v}を超えるモンスターは特殊召喚できない'),
    maxNormalLevel:L('不能通常召唤 {v} 星以上的怪兽','Cannot Normal Summon monsters above Level {v}','レベル{v}を超えるモンスターは通常召喚できない'),
    maxSummonLevel:L('不能召唤 {v} 星以上的怪兽','Cannot Summon monsters above Level {v}','レベル{v}を超えるモンスターは召喚できない'),
    waterOnly:L('只能特殊召唤水属性怪兽','Can only Special Summon WATER monsters','水属性しか特殊召喚できない'),
    windsOnly:L('只能特殊召唤风属性怪兽','Can only Special Summon WIND monsters','風属性しか特殊召喚できない'),
    windNormal:L('只能通常召唤风属性怪兽','Can only Normal Summon WIND monsters','風属性しか通常召喚できない'),
    machineOnly:L('只能特殊召唤机械族怪兽','Can only Special Summon Machine monsters','機械族しか特殊召喚できない'),
    beastOnly:L('只能特殊召唤兽族怪兽','Can only Special Summon Beast monsters','獣族しか特殊召喚できない'),
    boxerOnly:L('只能特殊召唤「燃烧拳击手」怪兽','Can only Special Summon "Battlin’ Boxer" monsters','「BK」モンスターしか特殊召喚できない'),
    puppetOnly:L('只能特殊召唤「机关傀儡」怪兽','Can only Special Summon "Gimmick Puppet" monsters','「ギミック・パペット」しか特殊召喚できない'),
    geargiaOnly:L('只能特殊召唤「齿轮齿轮」怪兽','Can only Special Summon "Geargia" monsters','「ギアギア」しか特殊召喚できない'),
    chronomalyOnly:L('只能特殊召唤「先史遗产」怪兽','Can only Special Summon "Chronomaly" monsters','「先史遺産」しか特殊召喚できない'),
    spellbookOnly:L('「魔导书」相关的限制生效中','A "Spellbook" restriction applies','「魔導書」の制限が適用中'),
    typeOnly:L('只能特殊召唤{v}怪兽','Can only Special Summon {v} monsters','{v}しか特殊召喚できない'),
    namedOnly:L('只能特殊召唤「{v}」怪兽','Can only Special Summon "{v}" monsters','「{v}」しか特殊召喚できない'),
    noTraps:L('不能发动陷阱卡','Cannot activate Trap Cards','罠カードを発動できない'),
    noSpells:L('不能发动魔法卡','Cannot activate Spell Cards','魔法カードを発動できない'),
    noSpellTraps:L('不能发动魔法·陷阱卡','Cannot activate Spell/Trap Cards','魔法・罠カードを発動できない'),
    noCounterTraps:L('不能发动反击陷阱','Cannot activate Counter Traps','カウンター罠を発動できない'),
    noHandMonsterEffects:L('不能发动手牌怪兽的效果','Monster effects cannot be activated from the hand','手札のモンスター効果を発動できない'),
    noMonsterEffects:L('不能发动怪兽效果','Cannot activate monster effects','モンスター効果を発動できない'),
    noHandSpecial:L('不能从手牌特殊召唤','Cannot Special Summon from the hand','手札から特殊召喚できない'),
    noHandGraveMonsters:L('不能从手牌·墓地特殊召唤怪兽','Cannot Special Summon from the hand or Graveyard','手札・墓地から特殊召喚できない'),
    noEffectsSummon:L('不能召唤效果怪兽','Cannot Summon Effect Monsters','効果モンスターを召喚できない'),
    noDragonEffects:L('龙族怪兽的效果不能发动','Dragon monster effects cannot be activated','ドラゴン族の効果を発動できない'),
    noSet:L('不能盖放卡片','Cannot Set cards','カードをセットできない'),
    noAddFromDeck:L('不能从卡组把卡加入手牌','Cannot add cards from the Deck to the hand','デッキからカードを手札に加えられない'),
    noSummonName:L('不能召唤「{v}」','Cannot Summon "{v}"','「{v}」を召喚できない'),
    cannotSummonId:L('不能召唤「{card:v}」','Cannot Summon "{card:v}"','「{card:v}」を召喚できない'),
    battleProtect:L('怪兽不会被战斗破坏','Monsters are not destroyed by battle','モンスターは戦闘では破壊されない'),
    waterProtected:L('水属性怪兽不会被破坏','WATER monsters cannot be destroyed','水属性モンスターは破壊されない'),
    effectHeal:L('受到的效果伤害改为回复','Effect damage becomes LP recovery','効果ダメージを回復に変える'),
    tributeReduction:L('上级召唤所需的祭品减少','Tribute Summons need fewer Tributes','アドバンス召喚のリリースが減る'),
    maxxC:L('对方每次特殊召唤时抽 1 张卡','Draw 1 card each time the opponent Special Summons','相手が特殊召喚する度に1枚ドロー')
  };
  const LEGACY_LOCKS={
    'no-special':L('不能特殊召唤','Cannot Special Summon','特殊召喚できない'),
    machine:L('只能特殊召唤机械族怪兽','Can only Special Summon Machine monsters','機械族しか特殊召喚できない'),
    'fusion-only':L('只能特殊召唤融合怪兽','Can only Special Summon Fusion Monsters','融合モンスターしか特殊召喚できない'),
    extra:L('额外卡组只能特殊召唤{v}怪兽','Only {v} monsters can be Special Summoned from the Extra Deck','EXデッキからは{v}モンスターしか特殊召喚できない'),
    'machine-synchro':L('额外卡组只能特殊召唤机械族同调怪兽','Only Machine Synchro Monsters can be Special Summoned from the Extra Deck','EXデッキからは機械族Sモンスターしか特殊召喚できない')
  };
  const CARD_KEYS={
    eraNegatedUntil:L('效果无效','Effects negated','効果無効'),
    effectNegated:L('效果无效','Effects negated','効果無効'),
    spellNegated:L('效果无效','Effects negated','効果無効'),
    spellNegatedUntil:L('效果无效','Effects negated','効果無効'),
    eraNoAttackUntil:L('不能攻击','Cannot attack','攻撃できない'),
    cannotAttackUntil:L('不能攻击','Cannot attack','攻撃できない'),
    attackLockedUntil:L('不能攻击','Cannot attack','攻撃できない'),
    yearAttackLocked:L('不能攻击','Cannot attack','攻撃できない'),
    cannotAttack:L('不能攻击','Cannot attack','攻撃できない'),
    positionLockedUntil:L('不能改变表示形式','Cannot change battle position','表示形式を変更できない'),
    piercingUntil:L('贯通伤害','Inflicts piercing damage','貫通ダメージ'),
    directUntil:L('可以直接攻击','Can attack directly','直接攻撃できる'),
    directAttackTurn:L('可以直接攻击','Can attack directly','直接攻撃できる'),
    doubleAttackTurn:L('可以攻击两次','Can attack twice','2回攻撃できる'),
    eraProtectTurn:L('不会被破坏','Cannot be destroyed','破壊されない'),
    eraProtectedUntil:L('不会被破坏','Cannot be destroyed','破壊されない'),
    eraProtected:L('不会被破坏','Cannot be destroyed','破壊されない'),
    eraIndestructibleTurn:L('不会被破坏','Cannot be destroyed','破壊されない'),
    battleProtectedUntil:L('不会被战斗破坏','Not destroyed by battle','戦闘では破壊されない'),
    battleProtectedTurn:L('不会被战斗破坏','Not destroyed by battle','戦闘では破壊されない'),
    effectProtectedUntil:L('不会被效果破坏','Not destroyed by card effects','効果では破壊されない'),
    eraEffectProtectedUntil:L('不会被效果破坏','Not destroyed by card effects','効果では破壊されない'),
    eraUntargetableUntil:L('不会成为效果的对象','Cannot be targeted by effects','効果の対象にならない'),
    eraSpellTrapImmune:L('不受魔法·陷阱卡的效果影响','Unaffected by Spell/Trap effects','魔法・罠の効果を受けない'),
    activationLockedUntil:L('效果不能发动','Effects cannot be activated','効果を発動できない'),
    cannotActivateUntil:L('效果不能发动','Effects cannot be activated','効果を発動できない'),
    swappedOriginalUntil:L('攻击力与守备力互换','ATK and DEF are swapped','攻守を入れ替え'),
    spiritReturnTurn:L('结束阶段回到手牌','Returns to the hand in the End Phase','エンドフェイズに手札に戻る'),
    expireTurn:L('第 {n} 回合离场','Leaves the field on turn {n}','{n}ターン目にフィールドを離れる'),
    hourglassUntil:L('受到「{card}」的效果影响','Affected by "{card}"','「{card}」の効果を受けている'),
    unionRiderLocked:L('受到「{card}」的效果影响','Affected by "{card}"','「{card}」の効果を受けている')
  };
  const COUNT_KEYS=new Set(['skipDraws','skipBattle']);
  const primitive=v=>v===null||['number','boolean','string'].includes(typeof v);
  const json=v=>JSON.stringify(v);
  const fieldCards=p=>[...(p.monsters||[]),p.extraMonster,p.extraMonster2,...(p.spells||[]),p.fieldSpell].filter(Boolean);

  function fingerprint(state){
    const players=(state.players||[]).map(p=>{
      const out={};
      for(const [key,value] of Object.entries(p)){
        if(ZONES.has(key)||PLAYER_IGNORE.has(key)||/ThisTurn$/.test(key))continue;
        if(key==='eraLocks'&&value)out.eraLocks=Object.fromEntries(Object.entries(value).map(([k,v])=>[k,json(v)]));
        else if(key==='locks'&&Array.isArray(value))out.locks=value.map(json);
        else if((PLAYER_PATTERN.test(key)||PLAYER_EXTRA.has(key))&&primitive(value))out[key]=value;
      }
      return out;
    });
    const duel={};
    for(const [key,value] of Object.entries(state)){
      if(STATE_IGNORE.has(key)||!STATE_PATTERN.test(key)||/ThisTurn$/.test(key))continue;
      if(primitive(value))duel[key]=value;else if(value&&typeof value==='object'&&!Array.isArray(value))duel[key]=json(value);
    }
    const cards={};
    for(const p of state.players||[])for(const c of fieldCards(p)){
      const out={};for(const key of Object.keys(CARD_KEYS))if(primitive(c[key])&&c[key]!==undefined)out[key]=c[key];
      cards[c.uid]=out;
    }
    return {players,duel,cards};
  }

  // A value is "live" when it still restricts or protects somebody right now.
  function live(key,value,turn){
    if(value===undefined||value===null||value===false||value===-1)return false;
    if(COUNT_KEYS.has(key))return typeof value==='number'&&value>0;
    if(typeof value==='number')return TURNLIKE.test(key)||/Lock/.test(key)?value>=turn:value!==0;
    if(typeof value==='string'){try{return live(key,JSON.parse(value),turn);}catch{return !!value;}}
    if(typeof value==='object'){
      if(typeof value.turn==='number')return value.turn>=turn;
      const numbers=Object.values(value).filter(v=>typeof v==='number');
      return numbers.length?Math.max(...numbers)>=turn:Object.values(value).some(Boolean);
    }
    return !!value;
  }
  function turnOf(value){
    if(typeof value==='number')return value;
    if(typeof value==='string'){try{return turnOf(JSON.parse(value));}catch{return null;}}
    if(value&&typeof value==='object'){
      if(typeof value.turn==='number')return value.turn;
      const numbers=Object.values(value).filter(v=>typeof v==='number');return numbers.length?Math.max(...numbers):null;
    }
    return null;
  }

  function record(engine,before,source={}){
    const state=engine.state;if(!before||!state)return [];
    const after=fingerprint(state),turn=state.turn,added=[];
    state.lingering||=[];state.nextLingering||=1;
    const push=entry=>{const item={n:state.nextLingering++,turn,sourceId:source.sourceId||null,by:[0,1].includes(source.by)?source.by:null,sourceUid:source.uid||null,chain:source.chain||null,...entry};state.lingering.push(item);added.push(item);};
    for(let owner=0;owner<2;owner++){
      const a=before.players[owner]||{},b=after.players[owner]||{};
      for(const [key,value] of Object.entries(b)){
        if(key==='eraLocks'){for(const [lock,v] of Object.entries(value||{}))if(a.eraLocks?.[lock]!==v&&live(lock,v,turn))push({scope:'player',owner,key:'eraLocks.'+lock,value:v});continue;}
        if(key==='locks'){for(const v of (value||[]).filter(v=>!(a.locks||[]).includes(v)))if(live('locks',v,turn))push({scope:'player',owner,key:'locks',value:v});continue;}
        if(a[key]!==value&&live(key,value,turn)&&!(COUNT_KEYS.has(key)&&typeof a[key]==='number'&&a[key]>=value))push({scope:'player',owner,key,value});
      }
    }
    for(const [key,value] of Object.entries(after.duel)){
      if(before.duel[key]===value||!live(key,value,turn))continue;
      // Per-player maps such as {0:turn} are attributed to the player they name.
      let owners=[null];
      try{const parsed=typeof value==='string'?JSON.parse(value):value;if(parsed&&typeof parsed==='object'&&Object.keys(parsed).every(k=>['0','1'].includes(k))){const prior=typeof before.duel[key]==='string'?JSON.parse(before.duel[key]):before.duel[key]||{};owners=Object.keys(parsed).filter(k=>prior?.[k]!==parsed[k]&&live(key,parsed[k],turn)).map(Number);}}catch{}
      for(const owner of owners)push({scope:'state',owner,key,value});
    }
    for(const [uid,flags] of Object.entries(after.cards)){
      const prior=before.cards[uid]||{},ref=engine.find?.(uid);
      for(const [key,value] of Object.entries(flags))if(prior[key]!==value&&live(key,value,turn))push({scope:'card',owner:ref?.owner??null,uid,key,value});
    }
    return added;
  }

  function current(entry,engine){
    const state=engine.state;
    if(entry.scope==='player'){
      const p=state.players?.[entry.owner];if(!p)return undefined;
      if(entry.key.startsWith('eraLocks.')){const lock=p.eraLocks?.[entry.key.slice(9)];return lock===undefined?undefined:json(lock);}
      if(entry.key==='locks')return (p.locks||[]).some(l=>json(l)===entry.value)?entry.value:undefined;
      return p[entry.key];
    }
    if(entry.scope==='state'){
      const value=state[entry.key];
      if(value&&typeof value==='object'&&!Array.isArray(value)){
        if(Object.keys(value).every(k=>['0','1'].includes(k))&&[0,1].includes(entry.owner))return value[entry.owner]===undefined?undefined:json({[entry.owner]:value[entry.owner]});
        return json(value);
      }
      return value;
    }
    if(entry.scope==='card'){const ref=engine.find?.(entry.uid);if(!ref||!['monsters','extraMonster','spells','fieldSpell'].includes(ref.zone))return undefined;return ref.card[entry.key];}
    return undefined;
  }
  function isActive(entry,engine){
    const value=current(entry,engine);if(value===undefined)return false;
    if(entry.scope==='state'&&[0,1].includes(entry.owner)&&typeof value==='string'&&typeof entry.value==='string'){
      try{const now=JSON.parse(value),then=JSON.parse(entry.value);if(now[entry.owner]!==then[entry.owner])return false;}catch{}
    }else if(COUNT_KEYS.has(entry.key)){if(!(typeof value==='number'&&value>0))return false;}
    else if(value!==entry.value)return false;
    return live(entry.key.startsWith('eraLocks.')?entry.key.slice(9):entry.key,value,engine.state.turn);
  }
  function prune(engine){engine.state.lingering=(engine.state.lingering||[]).filter(e=>isActive(e,engine));return engine.state.lingering;}

  function template(entry){
    if(entry.scope==='player'){
      if(entry.key.startsWith('eraLocks.'))return ERA_LOCKS[entry.key.slice(9)]||GENERIC;
      if(entry.key==='locks'){try{return LEGACY_LOCKS[JSON.parse(entry.value).kind]||GENERIC;}catch{return GENERIC;}}
      return PLAYER_KEYS[entry.key]||GENERIC;
    }
    if(entry.scope==='state')return STATE_KEYS[entry.key]||GENERIC;
    return CARD_KEYS[entry.key]||GENERIC;
  }
  function parsedValue(entry){
    if(entry.key.startsWith('eraLocks.')){try{return JSON.parse(entry.value).value;}catch{return null;}}
    if(entry.key==='locks'){try{return JSON.parse(entry.value).value;}catch{return null;}}
    return entry.value;
  }
  function untilTurn(entry){
    if(entry.scope==='card'&&!TURNLIKE.test(entry.key))return null;
    if(entry.key.startsWith('eraLocks.')||entry.key==='locks'){try{return JSON.parse(entry.value).turn??null;}catch{return null;}}
    if(COUNT_KEYS.has(entry.key)||typeof entry.value==='boolean')return null;
    return turnOf(entry.value);
  }
  const DURATION={
    thisTurn:L('本回合','this turn','このターン'),
    untilTurn:L('至第 {n} 回合','until turn {n}','{n}ターン目まで'),
    ongoing:L('持续中','ongoing','継続中')
  };
  function describe(entry,options={}){
    const language=LANGS.includes(options.language)?options.language:'zh-CN',turn=options.turn??entry.turn,cardName=options.cardName||(id=>D.CARDS[id]?.name||id);
    const value=parsedValue(entry),count=typeof value==='number'?value:null,until=untilTurn(entry);
    let text=template(entry)[language]||template(entry)['zh-CN'];
    text=text.replace('{card:v}',typeof value==='string'&&D.CARDS[value]?cardName(value):String(value??'')).replace('{card}',entry.sourceId?cardName(entry.sourceId):'?').replace('{v}',value===null||value===undefined||value===true?'':String(value)).replace('{n}',String(until??count??''));
    const scope=entry.scope==='state'&&![0,1].includes(entry.owner)?'both':entry.scope;
    const duration=until===null?DURATION.ongoing[language]:until<=turn?DURATION.thisTurn[language]:DURATION.untilTurn[language].replace('{n}',String(until));
    return {text,duration,until,scope,source:entry.sourceId?cardName(entry.sourceId):''};
  }

  // Everything still in force, with the card each entry belongs to. Remote PVP
  // states carry a server-computed list instead of raw flags.
  function collect(engine){
    const state=engine?.state;if(!state)return [];
    if(engine.remote)return Array.isArray(state.activeEffects)?state.activeEffects:[];
    const out=[];
    for(const entry of state.lingering||[]){
      if(!isActive(entry,engine))continue;
      const view={...entry,until:untilTurn(entry)};
      if(entry.scope==='card'){const ref=engine.find(entry.uid);view.cardId=ref?.card.id||null;view.faceUp=!!ref?.card.faceUp;view.owner=ref?.owner??entry.owner;}
      out.push(view);
    }
    return out;
  }
  function forOwner(list,owner){return list.filter(e=>e.scope==='state'&&![0,1].includes(e.owner)||e.owner===owner);}

  const API={fingerprint,record,isActive,prune,collect,describe,forOwner,labels:{PLAYER_KEYS,STATE_KEYS,ERA_LOCKS,LEGACY_LOCKS,CARD_KEYS}};
  root.DuelLingering=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(globalThis);
