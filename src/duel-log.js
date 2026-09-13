(function(root){
  'use strict';
  const copy=value=>JSON.parse(JSON.stringify(value));
  const enabled=e=>e.state.logVersion===1&&!e._aiMarginalProbe;
  const publicZones=new Set(['grave','banished','extra-up']);
  function card(e,uid,visible){
    const f=e.find(uid);if(!f)return null;
    return {uid,cardId:f.card.id,owner:f.owner,zone:f.zone,public:visible??(publicZones.has(f.zone)||['monsters','extraMonster','spells','fieldSpell'].includes(f.zone)&&f.card.faceUp||f.zone==='extra'&&f.card.faceUpExtra)};
  }
  function source(value,kind='effect'){
    if(!value)return null;
    const s=value.source||value;
    const cardId=value.sourceId||s.cardId||s.id;
    if(!cardId)return null;
    return Object.fromEntries(Object.entries({kind,cardId,owner:value.owner??s.owner,uid:value.uid||s.uid,key:value.key||s.key,
      ...(value.chainId?{chainId:value.chainId}:{}),...(value.chainNumber?{chainNumber:value.chainNumber}:{}),
      ...(value.linkId||value.key&&value.id?.startsWith('l')?{linkId:value.linkId||value.id}:{})}).filter(([,v])=>v!==undefined));
  }
  function current(e){return e._duelLogContext?.cause||source(e.state.resolvingLink);}
  function scope(e,context,fn){
    if(!enabled(e))return fn();
    const before=e._duelLogContext;e._duelLogContext={...before,...context};
    try{return fn();}finally{e._duelLogContext=before;}
  }
  function causeFor(e,value,kind='effect'){
    const explicit=source(value,value?.kind||kind),prior=current(e);
    if(explicit&&prior?.cardId===explicit.cardId)return {...prior,...explicit};
    return explicit||prior||{kind};
  }
  function capture(e,item){
    if(!enabled(e))return item;
    const context=e._duelLogContext||{},details=context.details;
    const match=details&&(!details.kinds||details.kinds.includes(item.kind))&&(details.owner===undefined||details.owner===item.owner)&&(details.uid===undefined||details.uid===item.uid);
    const trace={version:1,phase:e.state.inDrawPhase?'draw':e.state.frame?.kind==='standby'?'standby':e.state.frame?.kind==='end'?'end':e.state.phase,turnPlayer:e.state.active};
    if(context.cause)trace.cause=copy(context.cause);
    else if(e.state.resolvingLink)trace.cause=source(e.state.resolvingLink);
    if(match){for(const [key,value] of Object.entries(details))if(!['kinds','owner','uid','handBefore'].includes(key)&&value!==undefined)trace[key]=copy(value);}
    if(trace.to==='@current'){
      const f=e.find(item.uid);trace.to=f?.zone==='extra'?(f.card.faceUpExtra?'extra-up':'extra-down'):f?.zone||'vanished';trace.toOwner=f?.owner??null;
    }
    if(match&&details.handBefore)trace.cards=e.state.players[item.owner].hand.filter(m=>!details.handBefore.includes(m.uid)).map(m=>card(e,m.uid,false));
    if(item.chain&&item.key&&trace.cause?.cardId===item.cardId)Object.assign(trace.cause,{chainNumber:item.chain,chainId:item.chainId,linkId:item.linkId});
    if(['damage','heal','cost','lp-change'].includes(item.kind)&&Number.isFinite(trace.lpBefore))trace.lpAfter=e.state.players[item.owner].lp;
    return {...item,trace};
  }
  function flushLP(e,frame){
    if(!enabled(e))return;
    const frames=frame?[frame]:[...(e._duelLogLP||[])].reverse();
    for(const f of frames){
      for(const owner of [0,1]){
        let known=0;for(const l of e.state.log){if(l.n<f.n)break;if(l.owner===owner&&Number.isFinite(l.trace?.lpBefore)&&Number.isFinite(l.trace?.lpAfter))known+=l.trace.lpAfter-l.trace.lpBefore;}
        const after=e.state.players[owner].lp,before=f.lp[owner]+known;
        if(after===before)continue;
        scope(e,{cause:f.cause,details:{kinds:['lp-change'],owner,lpBefore:before,lpAfter:after}},()=>e.log('lp-change',e.name(owner)+'的生命值由 '+before+' 变为 '+after,owner,{amount:Math.abs(after-before)}));
      }
    }
  }
  function trackLP(e,fn){
    if(!enabled(e))return fn();
    if(e._duelLogLP?.length)flushLP(e,e._duelLogLP.at(-1));
    const frame={lp:e.state.players.map(p=>p.lp),n:e.state.nextLog,cause:current(e)};
    (e._duelLogLP||=[]).push(frame);
    try{const result=fn();if(e.state.winner===null)flushLP(e,frame);return result;}
    finally{e._duelLogLP.pop();}
  }
  function upgrade(state){
    if(state.logVersion===1)return;
    state.logVersion=1;
    state.logStart=state.log.length?Math.min(...state.log.map(l=>l.n)):state.nextLog;
  }
  const words={
    hand:['手牌','hand','手札'],deck:['卡组','Deck','デッキ'],grave:['墓地','Graveyard','墓地'],banished:['除外区','banishment','除外'],
    monsters:['怪兽区','Monster Zone','モンスターゾーン'],extraMonster:['额外怪兽区','Extra Monster Zone','EXモンスターゾーン'],
    spells:['魔法／陷阱区','Spell/Trap Zone','魔法・罠ゾーン'],fieldSpell:['场地区','Field Zone','フィールドゾーン'],
    extra:['额外卡组','Extra Deck','EXデッキ'],'extra-up':['表侧额外卡组','face-up Extra Deck','表側のEXデッキ'],'extra-down':['额外卡组','Extra Deck','EXデッキ'],
    overlays:['超量素材','Xyz material','X素材'],vanished:['离场消失','removed from play','消滅'],
    normal:['通常召唤','Normal Summon','通常召喚'],tribute:['上级召唤','Tribute Summon','アドバンス召喚'],
    special:['特殊召唤','Special Summon','特殊召喚'],fusion:['融合召唤','Fusion Summon','融合召喚'],synchro:['同调召唤','Synchro Summon','シンクロ召喚'],
    xyz:['超量召唤','Xyz Summon','エクシーズ召喚'],link:['连接召唤','Link Summon','リンク召喚'],ritual:['仪式召唤','Ritual Summon','儀式召喚'],pendulum:['灵摆召唤','Pendulum Summon','ペンデュラム召喚'],
    main1:['主要阶段 1','Main Phase 1','メインフェイズ1'],main2:['主要阶段 2','Main Phase 2','メインフェイズ2'],battle:['战斗阶段','Battle Phase','バトルフェイズ'],end:['结束阶段','End Phase','エンドフェイズ'],draw:['抽卡阶段','Draw Phase','ドローフェイズ'],standby:['准备阶段','Standby Phase','スタンバイフェイズ']
  };
  const at=language=>language==='en'?1:language==='ja'?2:0;
  const word=(key,language)=>(words[key]||[key,key,key])[at(language)];
  function category(entry){
    if(['damage','heal','cost','lp-change'].includes(entry.kind)&&entry.amount!==undefined)return 'lp';
    if(['summon','special','fusion','synchro','xyz','link','ritual','pendulum'].includes(entry.kind))return 'summon';
    if(['move','destroy','discard','mill','search','draw','overlay','return','equip','control'].includes(entry.kind))return 'move';
    if(['spell','trap','effect','negate','chain-warning','attack','reveal'].includes(entry.kind))return 'effect';
    return 'other';
  }
  function describe(entry,options={}){
    const {language='zh-CN',names=['你','对方'],cardName=id=>root.DuelData?.CARDS[id]?.name||id,allVisible=false,fallback=entry.text}=options;
    const t=(zh,en,ja)=>[zh,en,ja][at(language)],tr=entry.trace;
    const result={text:fallback,cause:'',change:'',category:category(entry),phase:tr?.phase||'',cards:[]};
    if(!tr)return result;
    const actor=names[entry.owner]||'',c=tr.cause;
    const canSee=c=>!!c&&(c.public!==false||allVisible||c.owner===0);
    const name=c=>canSee(c)&&c.cardId?'「'+cardName(c.cardId)+'」':t('未公开卡片','an unrevealed card','非公開のカード');
    const affected=tr.card|| (entry.cardId?{cardId:entry.cardId,owner:entry.owner,public:true}:null);
    const cardText=affected?name(affected):t('卡片','a card','カード');
    const place=(zone,owner)=>zone?([0,1].includes(owner)&&owner!==entry.owner?(names[owner]+' · '):'')+word(zone,language):'';
    const from=place(tr.from,tr.fromOwner),to=place(tr.to,tr.toOwner);
    const number=n=>Number(n).toLocaleString('en-US');
    if(['damage','heal','cost','lp-change'].includes(entry.kind)&&Number.isFinite(tr.lpBefore)){
      if(entry.kind==='damage')result.text=t(`${actor}受到 ${number(entry.amount)} 点${tr.damageType==='battle'?'战斗':'效果'}伤害`,`${actor} takes ${number(entry.amount)} ${tr.damageType==='battle'?'battle':'effect'} damage`,`${actor}に${number(entry.amount)}の${tr.damageType==='battle'?'戦闘':'効果'}ダメージ`);
      else if(entry.kind==='heal')result.text=t(`${actor}回复 ${number(entry.amount)} LP`,`${actor} gains ${number(entry.amount)} LP`,`${actor}は${number(entry.amount)}LP回復`);
      else if(entry.kind==='cost')result.text=t(`${actor}支付 ${number(entry.amount)} LP`,`${actor} pays ${number(entry.amount)} LP`,`${actor}は${number(entry.amount)}LPを支払う`);
      else result.text=t(`${actor}的生命值发生变化`,`${actor}'s Life Points change`,`${actor}のLPが変化`);
      result.change=`LP ${number(tr.lpBefore)} → ${number(tr.lpAfter)}`;
    }else if(['move','destroy','discard'].includes(entry.kind)&&to){
      const kind=tr.moveKind||'';
      const verb=/discard/.test(kind)?t('丢弃','discards','捨てる'):/tribute/.test(kind)?t('解放','Tributes','リリース'):/battle|destroy/.test(kind)?t('破坏','destroys','破壊'):t('移动','moves','移動');
      result.text=t(`${actor}${verb}${cardText}`,`${actor} ${verb} ${cardText}`,`${actor}：${cardText}を${verb}`);
      if(/^(fusion|synchro|link)-material$/.test(kind)){
        const summon=word(kind.split('-')[0],language);result.text=t(`${actor}将${cardText}用作${summon}素材`,`${actor} uses ${cardText} as ${summon} material`,`${actor}は${cardText}を${summon}素材に使用`);
      }else if(!/discard|tribute|battle|destroy/.test(kind)){
        if(tr.to==='grave')result.text=t(`${actor}将${cardText}送入墓地`,`${actor} sends ${cardText} to the Graveyard`,`${actor}は${cardText}を墓地へ送る`);
        else if(tr.to==='banished')result.text=t(`${actor}将${cardText}除外`,`${actor} banishes ${cardText}`,`${actor}は${cardText}を除外`);
        else if(tr.to==='hand')result.text=t(`${actor}将${cardText}加入手牌`,`${actor} adds ${cardText} to the hand`,`${actor}は${cardText}を手札に加える`);
        else if(['deck','extra-up','extra-down'].includes(tr.to))result.text=t(`${actor}将${cardText}返回${word(tr.to,language)}`,`${actor} returns ${cardText} to the ${word(tr.to,language)}`,`${actor}は${cardText}を${word(tr.to,language)}に戻す`);
      }
      result.change=from+' → '+to;
    }else if(['summon','special','fusion','synchro','xyz','link','ritual','pendulum'].includes(entry.kind)){
      const via=tr.via==='normal'&&tr.materials?.length?'tribute':words[tr.via]?tr.via:entry.kind==='summon'?'normal':'special';
      const set=tr.faceUp===false;
      result.text=t(`${actor}${set?'里侧守备盖放':word(via,language)}${cardText}`,`${actor} ${set?'Sets in face-down Defense Position':word(via,language)+'s'} ${cardText}`,`${actor}は${cardText}を${set?'裏側守備表示でセット':word(via,language)}`);
      result.change=[from,to].filter(Boolean).join(' → ');
      if(tr.materials?.length)result.materials=t('使用素材：','Materials: ','素材：')+tr.materials.map(name).join('、');
    }else if(entry.kind==='search'){
      result.text=t(`${actor}将${cardText}加入手牌`,`${actor} adds ${cardText} to their hand`,`${actor}は${cardText}を手札に加える`);result.change=word('deck',language)+' → '+word('hand',language);
    }else if(entry.kind==='draw'){
      result.text=t(`${actor}抽了 ${entry.amount} 张卡`,`${actor} draws ${entry.amount} card(s)`,`${actor}は${entry.amount}枚ドロー`);
      const known=(tr.cards||[]).filter(canSee);if(known.length)result.change=known.map(name).join('、');
    }
    if(c?.kind==='battle'){
      if(c.attacker){const a=name(c.attacker),b=c.defender?name(c.defender):null;
        result.cause=b?t(`${a}攻击${b}`,`${a} attacks ${b}`,`${a}が${b}を攻撃`):t(`${a}直接攻击`,`${a} attacks directly`,`${a}の直接攻撃`);
        if(Number.isFinite(c.attackValue))result.cause+=' · ATK '+number(c.attackValue)+(Number.isFinite(c.targetValue)?' / '+(c.targetPosition==='defense'?'DEF ':'ATK ')+number(c.targetValue):'');
      }else result.cause=t('战斗结算','Battle resolution','戦闘処理');
    }else if(c?.cardId){
      const sourceName=name({...c,public:c.public??true});
      if(c.kind==='cost')result.cause=t(`发动${sourceName}的代价`,`Cost to activate ${sourceName}`,`${sourceName}の発動コスト`);
      else if(c.kind==='summon')result.cause=t(`用于${word(c.via||'special',language)}${sourceName}`,`Used to ${word(c.via||'special',language)} ${sourceName}`,`${sourceName}の${word(c.via||'special',language)}に使用`);
      else result.cause=t(`${sourceName}的效果`,`Effect of ${sourceName}`,`${sourceName}の効果`);
      if(entry.uid===c.uid&&['spell','trap','effect'].includes(entry.kind)&&entry.key)result.cause='';
      if(c.chainNumber)result.chain=t('连锁 ','Chain ','チェーン ')+(c.chainId?c.chainId+' · ':'')+'C'+c.chainNumber;
    }else if(c?.label)result.cause=c.label;
    const rule=tr.moveKind||c?.rule||'';
    const rules={
      'rule-discard':t('结束阶段手牌上限：保留 6 张，其余丢弃','End Phase hand limit: discard down to 6 cards','エンドフェイズの手札上限：6枚になるように捨てる'),
      'rule-resolved':t('连锁处理完毕后，已使用的魔法／陷阱送墓','Used Spell/Trap sent to the Graveyard after the Chain','チェーン処理後、使用した魔法・罠を墓地へ送る'),
      'rule-material':t('主体离场，其超量素材送墓','Xyz materials leave with their host','本体がフィールドを離れたためX素材を墓地へ送る'),
      'rule-field':t('新的场地魔法替换旧场地魔法','A new Field Spell replaces the previous one','新しいフィールド魔法への置き換え'),
      'normal-draw':t('回合开始的通常抽卡','Normal draw at the start of the turn','ターン開始時の通常ドロー')
    };
    if(rules[rule])result.cause=rules[rule];
    else if(tr.reason&&!result.cause)result.cause=language==='zh-CN'?tr.reason:t('规则或效果处理','Rule or effect resolution','ルール・効果処理');
    if(tr.requestedTo&&tr.requestedTo!==tr.to){
      const reason=tr.replacement?.cardId?name(tr.replacement):t('去向替代规则','a destination replacement','移動先の変更');
      result.cause+=(result.cause?'；':'')+t(`原本送往${word(tr.requestedTo,language)}，因${reason}改为${to}`,`Originally ${word(tr.requestedTo,language)}; changed to ${to} by ${reason}`,`本来は${word(tr.requestedTo,language)}へ移動。${reason}により${to}へ変更`);
    }
    result.cards=[affected,c?.cardId?c:null,...(tr.materials||[]),...(tr.cards||[])].filter(canSee).filter(c=>c.cardId);
    return result;
  }
  function turns(state){
    const groups=new Map();
    for(const entry of [...(state.log||[])].reverse()){
      let group=groups.get(entry.turn);if(!group){group={turn:entry.turn,owner:entry.trace?.turnPlayer??null,entries:[]};groups.set(entry.turn,group);}
      if(entry.kind==='turn'&&[0,1].includes(entry.owner))group.owner=entry.owner;
      group.entries.push(entry);
    }
    return [...groups.values()].sort((a,b)=>a.turn-b.turn);
  }
  function exportEntry(entry,{allVisible=false,view}={}){
    const clean=value=>{
      if(!value||typeof value!=='object')return value;
      if(Array.isArray(value))return value.map(clean);
      const result={};for(const [key,v] of Object.entries(value))result[key]=clean(v);
      if(value.public===false&&value.owner!==0&&!allVisible){delete result.cardId;delete result.key;result.hidden=true;}
      return result;
    };
    const result=clean(entry);
    if(entry.trace?.card?.public===false&&entry.trace.card.owner!==0&&!allVisible)delete result.cardId;
    if(view){result.text=[view.text,view.cause,view.change,view.materials].filter(Boolean).join(' · ');result.display={...view,cards:view.cards.map(c=>({cardId:c.cardId}))};}
    return result;
  }
  const API={enabled,card,source,current,scope,causeFor,capture,trackLP,flushLP,upgrade,word,category,describe,turns,exportEntry};
  root.DuelLog=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(globalThis);
