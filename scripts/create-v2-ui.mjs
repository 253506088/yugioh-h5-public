// Preserved migration intermediate. The maintained V2 UI is src/game-v2.js.
import {readFile,writeFile} from 'node:fs/promises';
let source=(await readFile(new URL('../src/game.js',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
function fn(name,body){const start=source.indexOf('  function '+name+'(');if(start<0)throw new Error(name);const matches=[...source.slice(start+3).matchAll(/^  (?:async )?function /gm)];const end=matches.length?start+3+matches[0].index:source.length;source=source.slice(0,start)+body.trimEnd()+'\n'+source.slice(end);}
source=source.replace('const { CARDS, CARD_LIST, DECKS, isMonster }','const { CARDS, CARD_LIST, DECKS, isMonster, isExtra, isFamily }');
source=source.replace("  const ART = window.DUEL_ART;","  const ART = window.DUEL_ART, Art = window.DuelArt, View = window.DuelView, DeckTools = window.DuelDecks;\n  DeckTools.load();");
source=source.replace("let setupOptions = { deck: 'blue', first: 1, difficulty: 'standard' }, selectionState = null, responseUid = null;","let setupOptions = { deck: 'hero', opponentDeck: 'blackwing', first: 0, difficulty: 'standard' }, selectionState = null, responseUid = null;\n  let libraryFamily = 'all', detailReturn = null, pileContext = null;\n  const workshop = window.DuelWorkshop.create({ open: (...args) => openModal(...args), toast: (...args) => showToast(...args), play: id => { setupOptions = { deck: id, opponentDeck: engine?.state.players[1].deckId || 'blackwing', first: 0, difficulty: 'standard' }; renderNewGame(); } });");
fn('cardHTML',`  function cardHTML(id, instance = null) { return View.card(id, instance); }`);
fn('detailsHTML',`  function detailsHTML(id, instance = null) { return View.details(id, instance, engine); }`);
fn('avatarBar',String.raw`  function avatarBar(owner) {
    const p=engine.state.players[owner],deck=engine.deckInfo(owner),s=engine.state;
    const end=owner===1?'<div class="enemy-hand" aria-label="对方有'+p.hand.length+'张手牌">'+Array.from({length:Math.min(p.hand.length,8)},(_,i)=>'<span class="enemy-card" style="--angle:'+((i-Math.min(p.hand.length,8)/2)*5)+'deg"></span>').join('')+'<small>'+p.hand.length+'</small></div>':'<div class="normal-counter'+(s.active!==0||s.normalUsed?' used':'')+'"><span class="counter-gem"></span>通常召唤 '+(s.active===0&&!s.normalUsed?'1 / 1':'0 / 1')+'</div>';
    return '<div class="avatar-frame">'+Art.html(deck.ace,'avatar-art')+'</div><div class="duelist-info"><div class="duelist-name">'+escape(deck.player)+'</div><div class="duelist-sub">'+(owner===0?'<span class="you-tag">YOU</span>':'<span>AI · '+difficultyNames[s.difficulty]+'</span>')+'<span>'+escape(deck.mechanic||'决斗者')+'</span></div></div><div class="lp-section'+(p.lp<=2000?' critical':'')+'" id="lp-'+owner+'"><div class="lp-heading"><span>LIFE POINTS</span><b>'+p.lp.toLocaleString('en-US')+'</b></div><div class="lp-track"><div class="lp-fill" style="width:'+Math.min(100,p.lp/80)+'%"></div></div></div>'+end;
  }`);
fn('fieldCard',String.raw`  function fieldCard(card,owner,zone,index) {
    const c=CARDS[card.id],monster=['monsters','extraMonster'].includes(zone),hidden=!card.faceUp&&owner===1,shown=!hidden;
    const attacking=monster&&owner===0&&engine.state.active===0&&engine.state.phase==='battle'&&!engine.state.pending&&engine.canAttack(card,0);
    const face=!card.faceUp?'<div class="card-back"></div>':cardHTML(card.id,card);
    const value=card.position==='defense'?engine.defenseValue(card):engine.attackValue(card);
    return '<button class="zone has-card'+(selectedUid===card.uid?' selected':'')+(attacking?' attack-ready':'')+(isTargetable(owner,zone,card)?' targetable':'')+(c.type==='pendulum'&&zone==='spells'?' pendulum-zone':'')+'" data-action="select-card" data-card-uid="'+card.uid+'" data-owner="'+owner+'" data-zone="'+zone+'" data-slot="'+index+'" aria-label="'+(owner===0?'你的':'对方的')+(hidden?'里侧卡牌':escape(c.name)+(monster?'，'+(card.position==='attack'?'攻击力':'守备力')+value:''))+'"><span class="field-card'+(monster&&card.position==='defense'?' defense':'')+'">'+face+(monster&&shown?'<span class="field-stats'+(card.position==='defense'?' defense':'')+'"><em>'+(card.position==='defense'?'DEF':'ATK')+'</em><span class="'+(value>(card.position==='defense'?c.def:c.atk)?'boost':'')+'">'+value+'</span></span>':'')+(monster&&shown&&card.overlays?.length?'<span class="overlay-badge" title="'+card.overlays.length+'张超量素材">✦ '+card.overlays.length+'</span>':'')+(card.faceUp&&c.type==='pendulum'&&zone==='spells'?'<span class="scale-badge '+(index===0?'blue':'red')+'">◈ '+c.scale+'</span>':'')+(monster&&shown&&card.counters>0?'<span class="field-status">✧'+card.counters+'</span>':monster&&card.attacksMade>0?'<span class="field-status attacked">✓</span>':'')+(card.faceUp&&engine.negated(card)?'<span class="negated-badge">无效</span>':'')+'</span></button>';
  }`);
fn('renderZone',String.raw`  function renderZone(owner,zone) {
    return engine.state.players[owner][zone].map((card,index)=>card?fieldCard(card,owner,zone,index):'<div class="zone'+(zone==='spells'&&[0,4].includes(index)?' empty-pendulum':'')+'" data-empty-owner="'+owner+'" data-empty-zone="'+zone+'" data-slot="'+index+'"><span class="zone-empty">'+icon(zone==='monsters'?'swords':'spark')+'<small>'+(zone==='monsters'?'MONSTER':[0,4].includes(index)?'SPELL / PENDULUM':'SPELL & TRAP')+'</small></span></div>').join('');
  }`);
fn('pileHTML',String.raw`  function pileHTML(owner,kind) {
    const p=engine.state.players[owner],label=owner===0?'你的':'对方的';
    if(kind==='extra')return '<button class="extra-pile" data-action="pile" data-owner="'+owner+'" data-pile="extra" aria-label="'+label+'额外卡组">◇ 额外 <b>'+p.extra.length+'</b></button>';
    if(kind==='banished')return '<button class="extra-pile banished-pile" data-action="pile" data-owner="'+owner+'" data-pile="banished" aria-label="'+label+'除外区">⊘ 除外 <b>'+p.banished.length+'</b></button>';
    if(kind==='fieldSpell')return '<div class="field-spell-dock">'+(p.fieldSpell?fieldCard(p.fieldSpell,owner,'fieldSpell',0):'<span class="field-spell-empty">FIELD</span>')+'</div>';
    if(kind==='grave'){const last=p.grave.at(-1);return '<button class="pile grave-pile" data-action="pile" data-owner="'+owner+'" data-pile="grave" aria-label="'+label+'墓地，'+p.grave.length+'张"><span class="pile-card">'+(last?Art.html(last.id,'grave-art'):icon('grave'))+'<span class="pile-count">'+p.grave.length+'</span></span><span>墓地</span></button>';}
    return '<button class="pile" data-action="pile" data-owner="'+owner+'" data-pile="deck" aria-label="'+label+'卡组，剩余'+p.deck.length+'张"><span class="pile-card"><span class="pile-count">'+p.deck.length+'</span></span><span>卡组</span></button>';
  }`);
fn('canUseSpell',`  function canUseSpell(card,owner=0) { return engine.actionsFor(card.uid,owner).some(a=>a.type==='activate'); }`);
fn('actionOptions',String.raw`  function actionOptions(found) {
    if(!found)return {actions:[],note:''};
    const {card,owner,zone}=found,s=engine.state;
    let actions=engine.actionsFor(card.uid,0);
    if(owner===0&&zone==='extra'&&s.active===0&&!s.pending&&s.winner===null&&['main1','main2'].includes(s.phase)&&engine.extraOptions(0).some(o=>o.card.uid===card.uid))actions.push({type:'extra-summon',uid:card.uid,label:(CARDS[card.id].type==='synchro'?'同调':'超量')+'召唤',icon:'spark'});
    if(actions.some(a=>a.type==='attack')&&engine.monsters(1).length&&engine.canAttack(card,0,null))actions.push({type:'attack',uid:card.uid,target:null,direct:true,label:'直接攻击对方',icon:'swords'});
    actions=actions.map((a,i)=>({...a,command:String(i),primary:a.type==='activate'||a.type==='extra-summon'||a.type==='attack'||i===0,icon:['pendulum','synchro','xyz'].includes(a.icon)?'spark':a.icon||'spark'}));
    const note=s.winner!==null?'本场决斗已结束。':owner!==0?'观察公开信息，规划你的下一步。':s.pending?'请先完成当前效果或连锁选择。':s.active!==0?'对方回合：满足时机会自动提示快速效果。':actions.length?'':zone==='extra'?'需要满足素材、等级与召唤限制；融合怪兽通过相应魔法或效果登场。':zone==='hand'&&s.normalUsed?'通常召唤已使用，可继续用特殊召唤或效果展开。':'当前没有可发动的效果或操作。';
    return {actions,note};
  }`);
fn('isTargetable',String.raw`  function isTargetable(owner,zone,card) {
    if(!intent)return false;
    if(intent.kind==='attack')return owner===1&&['monsters','extraMonster'].includes(zone)&&engine.canAttack(engine.find(intent.uid)?.card,0,card.uid);
    return false;
  }`);
fn('render',String.raw`  function render() {
    const s=engine.state,deck=engine.deckInfo(0),rival=engine.deckInfo(1);
    $('#opponent-bar').innerHTML=avatarBar(1);$('#player-bar').innerHTML=avatarBar(0);
    for(const [owner,prefix] of [[0,'player'],[1,'opponent']])for(const zone of ['monsters','spells'])$('#'+prefix+'-'+zone).innerHTML=renderZone(owner,zone);
    $('#left-rail').innerHTML='<div class="rail-pile-group">'+pileHTML(1,'deck')+pileHTML(1,'extra')+pileHTML(1,'fieldSpell')+'</div><div class="rail-divider">DUEL FIELD</div><div class="rail-pile-group">'+pileHTML(0,'grave')+pileHTML(0,'banished')+'</div>';
    $('#right-rail').innerHTML='<div class="rail-pile-group">'+pileHTML(1,'grave')+pileHTML(1,'banished')+'</div><div class="rail-divider">SANCTUARY</div><div class="rail-pile-group">'+pileHTML(0,'fieldSpell')+pileHTML(0,'deck')+pileHTML(0,'extra')+'</div>';
    $('#extra-lane').innerHTML='<div class="extra-dock own-extra"><small>你的额外怪兽区</small>'+(s.players[0].extraMonster?fieldCard(s.players[0].extraMonster,0,'extraMonster',0):'<div class="zone extra-empty"><span>◇</span></div>')+'</div><div class="extra-orbit">'+icon('eye')+'<span>BEYOND THE LIMIT</span></div><div class="extra-dock rival-extra"><small>对方额外怪兽区</small>'+(s.players[1].extraMonster?fieldCard(s.players[1].extraMonster,1,'extraMonster',0):'<div class="zone extra-empty"><span>◇</span></div>')+'</div>';
    renderPhases();renderHand();renderControls();renderInspector();renderTargetInstruction();renderModernControls();
    $('#duel-log').innerHTML=s.log.slice(0,24).map(item=>logHTML(item)).join('');
    $('#match-label').innerHTML=escape(deck.name)+' <b>VS</b> '+escape(rival.name);
    $('#deck-summary').innerHTML=Art.html(deck.ace,'deck-summary-art')+'<span><small>我的卡组 · '+escape(deck.mechanic)+'</small><strong>'+escape(deck.name)+'</strong><span class="deck-count">'+deck.cards.length+' 张主卡组 · '+deck.extra.length+' 张额外</span></span>'+icon('chevron');
    $('#character-quote').textContent=deck.subtitle||deck.description;$('#quote-author').textContent='— '+deck.player;
    $('#duel-tip').textContent=(deck.combo||['点击卡牌查看当前合法行动；墓地与除外区也可能存在可以使用的效果。'])[s.turn%Math.max(1,deck.combo?.length||1)];
    updateSoundButton();Art.refresh();
  }
  function renderModernControls() {
    const s=engine.state,main=s.active===0&&s.winner===null&&!s.pending&&['main1','main2'].includes(s.phase),extra=main?engine.extraOptions(0):[],pend=main?engine.pendulumCandidates(0):[],scales=engine.scales(0);
    $('#summon-toolbar').innerHTML='<button data-action="extra-menu"'+(!main?' disabled':'')+' class="summon-shortcut'+(extra.length?' available':'')+'">✧ 额外召唤 <b>'+extra.length+'</b></button><button data-action="pendulum-summon"'+(!pend.length?' disabled':'')+' class="summon-shortcut pendulum-shortcut'+(pend.length?' available':'')+'">◈ 灵摆召唤 <b>'+pend.length+'</b></button><span class="scales-readout"><i>'+(scales[0]?.scale??'—')+'</i><span>〈 刻度 〉</span><i>'+(scales[1]?.scale??'—')+'</i></span>';
    $('#chain-status').innerHTML=s.chain.length?'<span>CHAIN '+s.chain.length+'</span>'+s.chain.map((l,i)=>'<b title="'+escape(window.DuelEffects.get(l.key)?.label)+'">'+(i+1)+' · '+escape(CARDS[l.sourceId].name)+'</b>').join('<i>→</i>'):s.pending?'<span>决策时机</span><b>'+escape(s.pending.title||'效果处理中')+'</b>':'<span>V2 · ALL ERAS</span><b>融合 · 同调 · 超量 · 灵摆</b>';
    const pieces=['exodia-head','exodia-left-arm','exodia-right-arm','exodia-left-leg','exodia-right-leg'],hasExodia=engine.deckInfo(0).cards.some(id=>pieces.includes(id));
    $('#exodia-tracker').hidden=!hasExodia;
    if(hasExodia)$('#exodia-tracker').innerHTML='<span>封印的记忆</span>'+pieces.map((id,i)=>'<b class="'+(s.players[0].hand.some(c=>c.id===id)?'collected':'')+'" title="'+escape(CARDS[id].name)+'">'+['頭','左腕','右腕','左足','右足'][i]+'</b>').join('');
  }`);
// Popovers display current legal actions rather than reconstructing rule conditions.
source=source.replace("previewHidden = found.owner === 1 && !found.card.faceUp;", "previewHidden = found.owner === 1 && !found.card.faceUp && ['hand','monsters','extraMonster','spells','fieldSpell','extra'].includes(found.zone);");
source=source.replace("(liveElement || element).getBoundingClientRect()", "(liveElement || element || $('#card-preview')).getBoundingClientRect()");
source=source.replace("      '<button data-action=\"card-detail\" data-card-id=\"' + found.card.id", "      (found.card.overlays?.length ? '<button data-action=\"overlays\" data-uid=\"' + uid + '\">✦ 查看 ' + found.card.overlays.length + ' 张超量素材</button>' : '') +\n      '<button data-action=\"card-detail\" data-card-id=\"' + found.card.id");
fn('cardCommand',String.raw`  function cardCommand(command,uid) {
    const found=engine.find(uid),action=actionOptions(found).actions[Number(command)];if(!action)return;
    hidePopover();
    if(action.type==='attack'&&engine.monsters(1).length&&!action.direct){intent={kind:'attack',uid};render();return;}
    dispatch({...action});
  }`);
fn('saveGame',String.raw`  function saveGame() {
    savedAvailable=writeStorage('duel-sanctuary-save-v2',{...engine.snapshot(),savedAt:Date.now()});
    $('#save-status').innerHTML='<i></i>'+(savedAvailable?'对局已自动保存':'当前浏览器未开放本地存档');
  }`);
fn('scheduleAI',String.raw`  function scheduleAI() {
    clearTimeout(aiTimer);if(!engine||engine.state.winner!==null||intent)return;
    const s=engine.state;
    if(s.pending?.responder===0){if(!modal.open||modalKind==='pending')showPending();return;}
    if(modal.open||document.hidden)return;
    if(s.active!==1&&s.pending?.responder!==1)return;
    const token=aiEpoch;
    aiTimer=setTimeout(()=>{if(token!==aiEpoch||modal.open||engine.state.winner!==null)return;const action=engine.aiNext();if(!action)return;const ok=dispatch(action);if(!ok){showToast('对方行动遇到错误，请导出决斗记录。',true);clearTimeout(aiTimer);}},prefs.speed==='fast'?220:s.pending?650:720);
  }`);
source=source.replaceAll("previewId = DECKS[engine.state.players[0].deckId].ace", "previewId = engine.deckInfo(0).ace");
source=source.replace("event.kind === 'special' && event.cardId", "['special','synchro','xyz','pendulum','fusion'].includes(event.kind) && event.cardId");
fn('closeModal',String.raw`  function closeModal() {
    if(modalKind==='pending'&&engine.state.pending){
      const p=engine.state.pending;
      if(['window','trigger'].includes(p.kind)&&!p.trigger?.mandatory){dismissModal();dispatch({type:'pass'});return;}
      if(p.cancelable){dismissModal();dispatch({type:'choose',cancel:true});return;}
      showToast('这个效果已经开始结算，请完成当前选择。');return;
    }
    dismissModal();scheduleAI();if(engine.state.winner!==null&&!resultShown)showResult();
  }`);
fn('showLibrary',String.raw`  function showLibrary() {
    openModal('library','每一张卡，都有它的灵魂。','THE CARD ARCHIVE · '+CARD_LIST.filter(c=>!c.notCollectible).length+' CARDS','<div class="library-toolbar"><div class="library-filters">'+[['all','全部'],['monster','怪兽'],['spell','魔法'],['trap','陷阱'],['fusion','融合'],['synchro','同调'],['xyz','超量'],['pendulum','灵摆']].map(([id,label])=>'<button class="filter-button'+(libraryFilter===id?' active':'')+'" data-action="library-filter" data-filter="'+id+'">'+label+'</button>').join('')+'</div><label class="search-box">'+icon('search')+'<input id="library-search" type="search" value="'+escape(libraryQuery)+'" placeholder="卡名、英文名或效果" aria-label="搜索卡牌"></label><select id="library-family" aria-label="筛选系列">'+Object.entries(window.DuelData.families).map(([id,label])=>'<option value="'+id+'"'+(libraryFamily===id?' selected':'')+'>'+label+'</option>').join('')+'</select></div><div class="library-grid" id="library-grid"></div><p class="library-count" id="library-count"></p>','<button class="secondary-button" data-action="close-modal">返回决斗</button><button class="primary-button" data-action="workshop">前往组卡工坊 '+icon('arrow')+'</button>','library-modal');renderLibraryResults();
  }`);
fn('renderLibraryResults',String.raw`  function renderLibraryResults() {
    const query=libraryQuery.trim().toLowerCase(),cards=CARD_LIST.filter(c=>!c.notCollectible&&(libraryFilter==='all'||libraryFilter==='monster'&&isMonster(c)||c.type===libraryFilter)&&(libraryFamily==='all'||isFamily(c,libraryFamily))&&(!query||(c.name+c.officialName+c.description+(c.pendulumDescription||'')).toLowerCase().includes(query)));
    $('#library-grid').innerHTML=cards.length?cards.map(c=>'<button class="library-card" data-action="card-detail" data-card-id="'+c.id+'" aria-label="查看'+escape(c.name)+'">'+cardHTML(c.id)+'<h3>'+escape(c.name)+'</h3><small>'+View.subtype(c)+(isMonster(c)?' · ATK '+c.atk:'')+'</small></button>').join(''):'<div class="empty-state">没有找到这张卡，试试其他名称或系列。</div>';
    $('#library-count').textContent=cards.length+' / '+CARD_LIST.filter(c=>!c.notCollectible).length+' 张卡片 · 原版卡图联网显示';
    $$('.library-filters .filter-button').forEach(el=>el.classList.toggle('active',el.dataset.filter===libraryFilter));
  }`);
fn('showCardDetail',String.raw`  function showCardDetail(id) {
    if(!CARDS[id])return;
    if(modalKind==='library')detailReturn=()=>showLibrary();
    else if(modalKind==='pile'&&pileContext){const ctx={...pileContext};detailReturn=()=>showPile(ctx.owner,ctx.kind);}
    else if(modalKind==='deck')detailReturn=()=>showDeck(0);
    else if(modalKind!=='detail')detailReturn=null;
    const instance=selectedUid&&engine.find(selectedUid)?.card.id===id?engine.find(selectedUid).card:null;
    const full=Art.full(id);
    openModal('detail','卡牌详情','THE HEART OF A CARD','<div class="card-detail-layout">'+cardHTML(id,instance)+'<div>'+detailsHTML(id,instance)+'<p class="card-detail-note">'+(isExtra(CARDS[id])?'额外卡组怪兽需要满足对应召唤条件。点击「额外召唤」查看当前可用的同调与超量；融合由魔法或效果发动。':'卡片显示的中文效果是本作使用的规则文本。')+'</p><p class="art-credit">卡图：YGOPRODeck / Yu-Gi-Oh!'+(full?' · <a href="'+escape(full)+'" target="_blank" rel="noopener noreferrer">查看原始卡面 ↗</a>':' · 原图将在联网成功后显示')+'</p></div></div>','<button class="secondary-button" data-action="detail-back">'+(detailReturn?'返回上一页':'浏览图鉴')+'</button><button class="primary-button" data-action="close-modal">返回决斗</button>','card-detail-modal');
  }`);
fn('showDeck',String.raw`  function showDeck(owner=0) {
    const deck=engine.deckInfo(owner);
    const grid=list=>{const counts=new Map();list.forEach(id=>counts.set(id,(counts.get(id)||0)+1));return '<div class="library-grid">'+[...counts].map(([id,n])=>'<button class="library-card" data-action="card-detail" data-card-id="'+id+'"><span class="deck-card-count">×'+n+'</span>'+cardHTML(id)+'<h3>'+escape(CARDS[id].name)+'</h3></button>').join('')+'</div>';};
    openModal('deck',escape(deck.name),'DECK CONSTRUCTION','<p class="modal-lead">'+escape(deck.description)+'</p>'+(deck.combo?'<div class="deck-combo">'+deck.combo.map((c,i)=>'<p><b>0'+(i+1)+'</b>'+escape(c)+'</p>').join('')+'</div>':'')+'<p class="deck-list-heading">主卡组 / '+deck.cards.length+' 张</p>'+grid(deck.cards)+'<p class="deck-list-heading">额外卡组 / '+deck.extra.length+' 张</p>'+grid(deck.extra),'<button class="secondary-button" data-action="close-modal">返回决斗</button><button class="primary-button" data-action="edit-current-deck">以此卡组开始构筑</button>','library-modal');
  }`);
fn('showPile',String.raw`  function showPile(owner,kind) {
    if(kind==='deck'){showDeck(owner);return;}
    const p=engine.state.players[owner],cards=[...(p[kind]||[])].reverse();pileContext={owner,kind};
    const labels={grave:'墓地',extra:'额外卡组',banished:'除外区'};
    const body='<p class="modal-lead">'+(kind==='extra'?'同调与超量怪兽可在素材满足时直接召唤。融合怪兽需要相应魔法或效果；表侧灵摆卡通过灵摆召唤返回。':'点击卡片查看效果；可用的墓地或除外效果会显示在卡片下方。')+'</p><div class="pile-grid">'+(cards.length?cards.map(c=>{
      const hidden=owner===1&&kind==='extra'&&!c.faceUpExtra,actions=hidden?[]:actionOptions(engine.find(c.uid)).actions;
      return '<article class="pile-entry">'+(hidden?'<div class="pile-hidden-card"><img src="'+ART['card-back']+'" alt="对方未公开的额外卡组卡片"></div><h3>未公开的额外怪兽</h3>':'<button class="pile-view" data-action="card-detail" data-card-id="'+c.id+'">'+cardHTML(c.id)+'<h3>'+escape(CARDS[c.id].name)+'</h3></button>')+(c.faceUpExtra?'<small class="face-up-extra-label">表侧 · 灵摆回归</small>':'')+actions.map(a=>'<button class="pile-action" data-action="pile-command" data-uid="'+c.uid+'" data-command="'+a.command+'">'+escape(a.label)+'</button>').join('')+'</article>';
    }).join(''):'<div class="empty-state">这里暂时没有卡片。</div>')+'</div>';
    openModal('pile',(owner===0?'你的':'对方的')+labels[kind],'BEYOND THE FIELD',body,'<button class="primary-button" data-action="close-modal">返回决斗</button>','library-modal');
  }
  function showOverlays(uid) {
    const f=engine.find(uid);if(!f)return;
    openModal('overlays','超量素材 · '+escape(CARDS[f.card.id].name),'OVERLAY NETWORK','<p class="modal-lead">这些卡叠放在超量怪兽下方。移除素材是相应效果的代价，不会把素材当作场上的卡。</p><div class="library-grid">'+(f.card.overlays||[]).map(c=>'<button class="library-card" data-action="card-detail" data-card-id="'+c.id+'">'+cardHTML(c.id)+'<h3>'+escape(CARDS[c.id].name)+'</h3></button>').join('')+'</div>','<button class="primary-button" data-action="close-modal">返回决斗</button>','library-modal');
  }
  function showExtraMenu() {showPile(0,'extra');}`);
fn('showNewGame',String.raw`  function showNewGame() {
    const own=engine?.state.players[0].deckId,rival=engine?.state.players[1].deckId,list=DeckTools.list();
    setupOptions={deck:list.some(d=>d.id===own)?own:'hero',opponentDeck:list.some(d=>d.id===rival)?rival:'blackwing',first:0,difficulty:engine?.state.difficulty||'standard'};renderNewGame();
  }`);
fn('renderNewGame',String.raw`  function renderNewGame() {
    const list=DeckTools.list(),selected=DECKS[setupOptions.deck]||DECKS.hero;
    openModal('new-game','选择与你共鸣的力量。','TEN PATHS · ONE DESTINY','<div class="deck-select-intro"><p>跨越世代的决斗，从这里开始。<br><span>十套预设，或一副亲手构筑的卡组。</span></p><button class="outline-button" data-action="workshop">＋ 组卡工坊</button></div><div class="deck-select-layout"><div class="deck-roster">'+list.map((deck,i)=>'<button class="deck-roster-item'+(setupOptions.deck===deck.id?' active':'')+'" data-action="choose-deck" data-deck="'+deck.id+'">'+Art.html(deck.ace,'roster-art')+'<span class="roster-index">'+String(i+1).padStart(2,'0')+'</span><span class="roster-copy"><strong>'+escape(deck.name)+'</strong><small>'+escape(deck.en)+'</small></span><span class="mechanic-chip">'+escape(deck.mechanic)+'</span><span class="roster-check">'+(setupOptions.deck===deck.id?'✓':'↗')+'</span></button>').join('')+'</div><aside class="selected-deck-showcase"><div class="showcase-glow"></div><div class="showcase-card">'+cardHTML(selected.ace)+'</div><span class="showcase-kicker">'+escape(selected.mechanic)+' / '+selected.cards.length+' + '+selected.extra.length+'</span><h3>'+escape(selected.name)+'</h3><p>'+escape(selected.description)+'</p><div class="showcase-combo"><small>FIRST COMBO · 展开思路</small><p>'+escape(selected.combo?.[0]||'召唤海马侠，解放它呼唤青眼白龙；运用魔法与陷阱把握战机。')+'</p></div><button class="text-button" data-action="edit-setup-deck">编辑这副构筑 →</button></aside></div><div class="setup-options v2-setup"><div><label class="setting-label" for="opponent-deck">对手卡组</label><select id="opponent-deck">'+list.map(d=>'<option value="'+d.id+'"'+(setupOptions.opponentDeck===d.id?' selected':'')+'>'+escape(d.name)+'</option>').join('')+'</select></div><div><label class="setting-label">对手难度</label><div class="segmented-control">'+[['casual','休闲'],['standard','标准']].map(([id,label])=>'<button class="'+(setupOptions.difficulty===id?'active':'')+'" data-action="choose-difficulty" data-value="'+id+'">'+label+'</button>').join('')+'</div></div><div><label class="setting-label">出场顺序</label><div class="segmented-control">'+[[0,'我先攻'],[1,'我后攻']].map(([id,label])=>'<button class="'+(setupOptions.first===id?'active':'')+'" data-action="choose-first" data-value="'+id+'">'+label+'</button>').join('')+'</div></div></div><p class="new-game-note">8000 LP · 随机起手 5 张 · 先攻首回合不抽卡、不攻击<br>开始新决斗会替换当前对局存档；保存的卡组与工坊草稿会保留。</p>','<button class="secondary-button" data-action="close-modal">继续当前对局</button><button class="primary-button" data-action="begin-game">开始决斗 '+icon('arrow')+'</button>','new-game-modal v2-new-game');
  }`);
fn('showHelp',String.raw`  function showHelp() {
    const rows=[['通常召唤','每回合合计1次通常召唤或盖放。5—6星通常需1份祭品，7星以上2份；机壳等卡片有特别条件。'],['融合召唤','发动融合、奇迹融合、力量结合等效果。先选择融合怪兽，再按其名称、属性、种族要求选择素材。不同魔法使用的素材区域不同。'],['同调召唤','从「额外召唤」选择目标。表侧调整与非调整的等级合计必须精确等于同调怪兽等级，也须满足专用素材条件。白色卡面。'],['超量召唤','同等级怪兽叠放，阶级与所需等级对应。素材保存在超量怪兽下方；发动相应效果时选择移除。升阶可以继承叠放素材。黑色卡面。'],['灵摆召唤','把灵摆卡放入最左和最右魔陷区作为刻度。每回合1次，同时特殊召唤等级严格介于两刻度之间的怪兽。手牌使用主怪兽区；表侧额外的灵摆只能使用本方空余额外怪兽区。'],['灵摆卡的去向','场上的灵摆卡将送墓时改为表侧额外卡组；从手牌丢弃或从超量素材移除则送墓。超量素材不视为场上的卡。'],['连锁与诱发','响应窗口可发动满足条件的快速效果、陷阱、反击陷阱。连锁从最后一环开始逆序结算。破坏效果来源并不自动无效该效果。多个同时诱发效果可以选择发动顺序。'],['艾克佐迪亚','手牌集齐被封印的五个不同部件，立即获得特殊胜利。场上、墓地、除外区中的部件不计入。']];
    openModal('help','从第一次召唤，到无限可能。','THE DUELIST’S HANDBOOK','<p class="modal-lead">把对方生命值降到0，或让对方在需要抽卡时无卡可抽即可获胜。初始8000 LP，双方各5张手牌，抽卡与准备阶段自动处理。</p><div class="help-steps"><div class="help-step">'+icon('card')+'<h3>01 · 阅读行动</h3><p>点击卡片，菜单显示当前合法操作。墓地与除外区的卡也可能有可发动效果。</p></div><div class="help-step">'+icon('spark')+'<h3>02 · 组合素材</h3><p>额外召唤列出当前可用怪兽，素材选择会实时校验等级与条件。</p></div><div class="help-step">'+icon('bolt')+'<h3>03 · 把握时机</h3><p>每次效果与战斗都可能产生响应。检查连锁，再决定发动或保留。</p></div></div><table class="rules-table"><thead><tr><th>机制</th><th>实际操作与规则</th></tr></thead><tbody>'+rows.map(([a,b])=>'<tr><td>'+a+'</td><td>'+b+'</td></tr>').join('')+'</tbody></table><div class="help-section"><h3>战斗与表示</h3><p>攻击对攻击：较低攻击力怪兽破坏，其控制者受到差值伤害。攻击对守备：攻击力超过守备力则守备怪兽破坏，通常不造成伤害；攻击力不足则攻击方受到差值伤害。特殊贯穿、多次攻击、伤害减免按卡片效果处理。</p><p>新召唤的怪兽可以攻击，但先攻第1回合不能进入战斗阶段。怪兽召唤当回合、攻击后不能主动变更表示。盖放的陷阱与速攻魔法当回合不能发动。回合结束手牌上限6张。</p></div><div class="help-section"><h3>自己的卡组，自己的命运</h3><p>「组卡工坊」可从预设复制或空白新建。主卡组40—60张，额外最多15张，主卡组与额外合计同名最多3张。卡片已全部解锁，衍生物不能编入。工坊草稿自动保存；合法卡组保存后会出现在决斗选择中。支持撤销、复制与JSON导入导出。</p></div><div class="help-section"><h3>本作的规则范围</h3><p>这是致敬高桥和希的独立同人实现，围绕所收录的176张卡实现融合、同调、超量、灵摆与相应连锁。采用每方一个额外怪兽区的场地布局；融合、同调、超量也可使用主怪兽区。不采用赛事禁限卡表，没有连接、仪式以及未收录卡片的规则。本作文字与官方完整裁定仍可能有差异。</p><p>原版卡图通过 YGOPRODeck 在线取得，首次加载可能需要等待。卡图失效或断网不会影响决斗；设置里可关闭联网图片。游戏逻辑、音效和进度都在本地运行。</p></div><div class="help-section"><h3>快捷键</h3><p><kbd>Space</kbd> 下一阶段　<kbd>E</kbd> 结束回合　<kbd>1</kbd>—<kbd>9</kbd> 选择手牌<br><kbd>Esc</kbd> 关闭窗口 / 取消未提交选择　<kbd>M</kbd> 音效　<kbd>F</kbd> 全屏</p></div>','<button class="primary-button" data-action="close-modal">准备好了 '+icon('swords')+'</button>');
  }`);
// Remove V1's single-target and single-response workflows; all choices use engine pending data.
fn('openTargetSelection',`  function openTargetSelection() { showPending(); }`);
fn('renderSelection',`  function renderSelection() { showPending(true); }`);
fn('showPending',String.raw`  function showPending(force=false) {
    const p=engine.state.pending;if(!p||p.responder!==0||engine.state.winner!==null||modal.open&&modalKind!=='pending')return;
    const key=JSON.stringify(p);if(!force&&pendingKey===key&&modal.open)return;
    pendingKey=key;selectionState={selected:[],response:null};
    const candidates=p.candidates||p.group?.candidates||[],isResponse=['window','trigger'].includes(p.kind);
    const trigger=p.trigger,options=p.kind==='window'?p.options:p.kind==='trigger'?[{uid:trigger.uid,key:trigger.key,label:window.DuelEffects.get(trigger.key)?.label,cardId:trigger.sourceId}]:[];
    const chain=engine.state.chain,sourceId=p.ctx?.sourceId||trigger?.sourceId||engine.find(p.uid)?.card.id;
    const chainHTML=chain.length?'<div class="pending-chain"><small>CHAIN · 后发动先结算</small>'+chain.map((l,i)=>'<span><b>'+String(i+1).padStart(2,'0')+'</b>'+escape(CARDS[l.sourceId].name)+'<em>'+escape(window.DuelEffects.get(l.key)?.label||'')+'</em></span>').join('')+'</div>':'';
    const min=p.min??p.group?.min??1,max=p.max??p.group?.max??1;
    const notice=p.kind==='order'?'依次点选想发动的效果，序号就是连锁顺序；后选择的效果先结算。必须包含标注为「强制」的效果。':p.purpose==='pendulum'?'选择等级位于左右刻度之间的怪兽。手牌使用主怪兽区；表侧额外的灵摆使用额外怪兽区。':p.purpose==='extra'?'选择场上的素材。可以手动组合，也可以点选下方已校验的组合。':p.kind==='discard'?'手牌上限为6张。请选择需要送墓的卡片。':p.kind==='window'?'现在可以连锁发动效果，也可以保留卡片。':p.kind==='trigger'?'满足了诱发条件。可以发动这个效果，也可以保留。':p.cancelable?'先选择代价或目标，再确认发动。':'效果正在结算中，请完成这一步选择。';
    const back=CARDS[sourceId]?'<div class="pending-source">'+Art.html(sourceId,'pending-source-art')+'<div><small>'+escape(engine.state.phase==='battle'?'BATTLE PHASE':'EFFECT PROCESS')+'</small><h3>'+escape(CARDS[sourceId].name)+'</h3><p>'+escape(window.DuelEffects.get(p.ctx?.key||trigger?.key)?.label||'')+'</p></div></div>':'';
    const body=back+chainHTML+'<p class="modal-lead">'+notice+'</p>'+(isResponse?'<div class="response-options">'+options.map((o,i)=>{const id=o.cardId||engine.find(o.uid)?.card.id;return '<button class="response-option" data-action="pending-response" data-index="'+i+'">'+(id?Art.html(id,'response-art'):'')+'<span><strong>'+escape(o.label||window.DuelEffects.get(o.key)?.label||CARDS[id]?.name)+'</strong><small>'+escape(CARDS[id]?.description||'')+'</small></span><b>↗</b></button>';}).join('')+'</div>':'<div class="pending-selection-layout"><div><div class="selection-grid">'+candidates.map((c,i)=>'<button class="selection-card'+(!c.cardId&&!c.hidden?' text-selection':'')+'" data-action="pending-pick" data-uid="'+escape(c.uid)+'" aria-pressed="false">'+(c.hidden?'<img class="selection-back" src="'+ART['card-back']+'" alt="未公开的卡片">':c.cardId?cardHTML(c.cardId,engine.find(c.uid)?.card):'<span class="text-option-symbol">'+(c.uid==='cancel'?'↶':c.uid==='direct'?'⚔':'◇')+'</span>')+'<b class="pick-number"></b><small>'+escape(c.label||CARDS[c.cardId]?.name||c.uid)+'</small><span>'+escape(c.detail||'')+'</span>'+(c.mandatory?'<em class="mandatory-badge">强制</em>':'')+'</button>').join('')+'</div>'+(p.sets?.length?'<div class="material-presets"><small>合法组合 · 共 '+p.sets.length+' 种</small>'+p.sets.slice(0,16).map((set,i)=>'<button data-action="pending-combo" data-index="'+i+'">'+set.map(uid=>{const c=candidates.find(c=>c.uid===uid);return escape(c?.label||uid);}).join(' ＋ ')+'</button>').join('')+'</div>':'')+'</div><aside class="pick-inspector" id="pick-inspector"><span>点选卡牌，查看效果与选择顺序。</span></aside></div>')+'<p class="pick-feedback" id="pick-feedback" role="status">'+(isResponse?'请选择要发动的效果。':'需选 '+min+(min===max?'':'—'+max)+' 项 · 已选 0')+'</p>';
    const canPass=isResponse&&!trigger?.mandatory;
    openModal('pending',escape(p.title||'选择卡片'),isResponse?'YOUR RESPONSE · 把握这一刻':'YOUR CHOICE · 每次选择都算数',body,(canPass?'<button class="secondary-button" data-action="pending-pass">'+(p.kind==='window'?'不连锁':'不发动')+'</button>':p.cancelable?'<button class="secondary-button" data-action="pending-cancel">取消选择</button>':'')+'<button class="primary-button" id="pending-confirm" data-action="pending-confirm" disabled>'+(isResponse?'发动效果':p.kind==='order'?'确认连锁顺序':p.kind==='materials'?'确认素材并召唤':'确认选择')+' '+icon('spark')+'</button>','selection-modal modern-pending');
    if(p.kind==='trigger'){selectionState.response=options[0];$('.response-option')?.classList.add('chosen');$('#pending-confirm').disabled=false;}
    if(!isResponse)updatePicks();
  }
  function updatePicks() {
    const p=engine.state.pending;if(!p||!selectionState)return;
    const selected=selectionState.selected,valid=engine.validatePick(p,selected);
    $$('.selection-card[data-action="pending-pick"]').forEach(el=>{const i=selected.indexOf(el.dataset.uid);el.classList.toggle('chosen',i>=0);el.setAttribute('aria-pressed',String(i>=0));el.querySelector('.pick-number').textContent=i>=0?i+1:'';});
    $('#pending-confirm').disabled=!valid.valid;$('#pick-feedback').textContent='已选 '+selected.length+' 项 · '+(valid.valid?'选择合法，可以确认':valid.message);
    $('#pick-feedback').classList.toggle('valid',valid.valid);
    const candidates=p.candidates||p.group?.candidates||[],last=candidates.find(c=>c.uid===selected.at(-1));
    if(last?.cardId&&$('#pick-inspector'))$('#pick-inspector').innerHTML=detailsHTML(last.cardId,engine.find(last.uid)?.card)+(p.purpose==='extra'?'<p class="level-equation">等级合计 '+selected.reduce((n,uid)=>n+(engine.find(uid)?engine.level(engine.find(uid).card):0),0)+'</p>':'');
  }
  function choosePending(uid) {
    const p=engine.state.pending;if(!p||!selectionState)return;
    const candidates=p.candidates||p.group?.candidates||[];if(!candidates.some(c=>c.uid===uid))return;
    const max=p.max??p.group?.max??1,selected=selectionState.selected;
    if(selected.includes(uid))selectionState.selected=selected.filter(x=>x!==uid);else if(max===1)selectionState.selected=[uid];else if(selected.length<max)selected.push(uid);else{showToast('已选满，先取消一项即可更换。');return;}updatePicks();
  }`);
fn('announce',String.raw`  function announce(cardId,type) {
    if(prefs.reducedMotion||!CARDS[cardId])return;
    const c=CARDS[cardId],el=$('#cinematic'),titles={fusion:'FUSION SUMMON',synchro:'SYNCHRO SUMMON',xyz:'XYZ SUMMON',pendulum:'PENDULUM SUMMON',trap:'CHAIN · TRAP ACTIVATED',exodia:'EXODIA · THE FORBIDDEN ONE'};
    clearTimeout(cinematicTimer);el.className='cinematic cinematic-'+type;
    el.innerHTML='<div class="cinematic-orbit"></div><div class="cinematic-content">'+Art.html(cardId,'cinematic-art')+'<div><small>'+(titles[type]||titles[c.type]||'SPECIAL SUMMON')+'</small><h3>'+escape(c.name)+'</h3><p>'+(type==='exodia'?'五个部件已集齐 · 被封印的力量觉醒':isMonster(c)?'ATK '+c.atk+'　/　DEF '+c.def:'连锁，从这一刻逆转')+'</p></div></div>';void el.offsetWidth;el.classList.add('visible');cinematicTimer=setTimeout(()=>el.classList.remove('visible'),type==='exodia'?3200:1700);
  }`);
source=source.replace("if (event.kind === 'summon' || event.kind === 'special')", "if (['summon','special','synchro','xyz','pendulum','fusion'].includes(event.kind))");
source=source.replace("sound.play(event.kind === 'special' ? 'special' : 'summon');", "sound.play(event.kind === 'summon' ? 'summon' : 'special');");
source=source.replace("if (['special','synchro','xyz','pendulum','fusion'].includes(event.kind) && event.cardId) announce(event.cardId, 'special');", "if (event.cardId && event.kind !== 'summon') announce(event.cardId, event.kind);");
source=source.replace("if (event.kind === 'special' && event.cardId) announce(event.cardId, 'special');", "if (event.cardId && event.kind !== 'summon') announce(event.cardId, event.kind);");
source=source.replace("if (event.kind === 'victory') sound.play(event.owner === 0 ? 'victory' : 'defeat');", "if (event.kind === 'victory') { sound.play(event.owner === 0 ? 'victory' : 'defeat'); if (engine.state.winKind === 'exodia') announce('exodia-head', 'exodia'); }");
source=source.replace("const win = engine.state.winner === 0;", "const win = engine.state.winner === 0, draw = engine.state.winner === 'draw';");
source=source.replace("(win ? '决斗胜利' : '未完的决斗')", "(draw ? '决斗平局' : win ? '决斗胜利' : '未完的决斗')");
source=source.replace("(win ? '你与卡组的羁绊，回应了这场决斗。' : '命运不会止步于这一局。<br>下一次抽卡，也许就是转机。')", "(draw ? '双方在同一时刻迎来结局。' : win ? '你与卡组的羁绊，回应了这场决斗。' : '命运不会止步于这一局。<br>下一次抽卡，也许就是转机。')");
source=source.replace("prefs.reducedMotion ? 100 : 1400", "prefs.reducedMotion ? 100 : engine.state.winKind === 'exodia' ? 3400 : 1400");
source=source.replace("decks: engine.state.players.map(p => DECKS[p.deckId].name)", "decks: [engine.deckInfo(0).name, engine.deckInfo(1).name]");
// Add artwork controls to existing audio/accessibility settings.
source=source.replace("      toggle('sound', '决斗音效'", "      '<div class=\"setting-row\"><div><h3>在线原版卡图</h3><p>按英文原名匹配原图。关闭后，游戏仍可离线进行。</p></div><button class=\"toggle-button' + (Art.status().enabled ? ' on' : '') + '\" data-action=\"toggle-artwork\" role=\"switch\" aria-checked=\"' + Art.status().enabled + '\" aria-label=\"在线原版卡图\"></button></div><div class=\"setting-row\"><p>已缓存 ' + Art.status().cached + ' 张卡图地址 · ' + (Art.status().online ? '网络可用' : '当前离线') + '</p><button class=\"text-button\" data-action=\"retry-artwork\">重试卡图</button></div>' +\n      toggle('sound', '决斗音效'");
const eventStart=source.indexOf("  document.addEventListener('pointerdown'");
const eventEnd=source.indexOf("  document.addEventListener('pointerover'",eventStart);
source=source.slice(0,eventStart)+String.raw`  document.addEventListener('pointerdown',()=>sound.unlock(),{passive:true});
  document.addEventListener('click',event=>{
    const b=event.target.closest('[data-action]');if(!b){if(!event.target.closest('#card-popover'))hidePopover();return;}if(b.disabled)return;
    const action=b.dataset.action;if(!['select-card','none'].includes(action))sound.play('click');
    if(workshop.handle(action,b))return;
    switch(action){
      case 'duel':if(modal.open)closeModal();else{hidePopover();window.scrollTo({top:0,behavior:prefs.reducedMotion?'instant':'smooth'});}break;
      case 'library':showLibrary();break;
      case 'help':showHelp();break;
      case 'settings':showSettings();break;
      case 'new-game':showNewGame();break;
      case 'workshop':workshop.show();break;
      case 'edit-current-deck':workshop.show(engine.state.players[0].deckId);break;
      case 'edit-setup-deck':workshop.show(setupOptions.deck);break;
      case 'close-modal':closeModal();break;
      case 'inspect-full':if(!previewHidden)showCardDetail(previewId);break;
      case 'card-detail':showCardDetail(b.dataset.cardId);break;
      case 'detail-back':if(detailReturn)detailReturn();else showLibrary();break;
      case 'my-deck':showDeck(0);break;
      case 'pile':showPile(Number(b.dataset.owner),b.dataset.pile);break;
      case 'overlays':showOverlays(b.dataset.uid);break;
      case 'pile-command':{const uid=b.dataset.uid,command=b.dataset.command;dismissModal();cardCommand(command,uid);break;}
      case 'extra-menu':showExtraMenu();break;
      case 'pendulum-summon':dispatch({type:'pendulum-summon'});break;
      case 'log':showLog();break;
      case 'export-log':exportLog();break;
      case 'result':showResult();break;
      case 'sound':prefs.sound=!prefs.sound;updatePrefs();showToast(prefs.sound?'决斗音效已开启。':'决斗音效已关闭。');break;
      case 'fullscreen':fullscreen();break;
      case 'select-card':chooseCard(b.dataset.cardUid,b);break;
      case 'card-command':cardCommand(b.dataset.command,b.dataset.uid);break;
      case 'phase':takePhase(b.dataset.phase);break;
      case 'end':takePhase('end');break;
      case 'cancel-intent':clearIntent();break;
      case 'library-filter':libraryFilter=b.dataset.filter;renderLibraryResults();break;
      case 'choose-deck':setupOptions.deck=b.dataset.deck;{const scroll=$('.deck-roster').scrollTop;renderNewGame();$('.deck-roster').scrollTop=scroll;}break;
      case 'choose-first':setupOptions.first=Number(b.dataset.value);renderNewGame();break;
      case 'choose-difficulty':setupOptions.difficulty=b.dataset.value;renderNewGame();break;
      case 'begin-game':startGame({...setupOptions,seed:Date.now()});break;
      case 'rematch':startGame({deck:engine.state.players[0].deckId,opponentDeck:engine.state.players[1].deckId,difficulty:engine.state.difficulty,first:0,seed:Date.now()});break;
      case 'toggle-pref':if(['sound','music','reducedMotion'].includes(b.dataset.pref)){prefs[b.dataset.pref]=!prefs[b.dataset.pref];updatePrefs();showSettings();$('[data-pref="'+b.dataset.pref+'"]')?.focus({preventScroll:true});}break;
      case 'set-speed':prefs.speed=b.dataset.value==='fast'?'fast':'normal';updatePrefs();showSettings();break;
      case 'toggle-artwork':Art.setEnabled(!Art.status().enabled);showSettings();break;
      case 'retry-artwork':Art.retry();showToast('正在重新尝试加载原版卡图。');break;
      case 'pending-pick':choosePending(b.dataset.uid);break;
      case 'pending-combo':{const set=engine.state.pending?.sets?.[Number(b.dataset.index)];if(set&&selectionState){selectionState.selected=[...set];updatePicks();}break;}
      case 'pending-response':{const p=engine.state.pending;if(!p||!selectionState)return;selectionState.response=p.kind==='trigger'?{uid:p.trigger.uid,key:p.trigger.key}:p.options[Number(b.dataset.index)];$$('.response-option').forEach(el=>el.classList.toggle('chosen',el===b));$('#pending-confirm').disabled=!selectionState.response;$('#pick-feedback').textContent='已选择 · '+(window.DuelEffects.get(selectionState.response?.key)?.label||'发动效果');break;}
      case 'pending-confirm':{const p=engine.state.pending;if(!p||!selectionState)return;if(['trigger','window'].includes(p.kind)){const a=selectionState.response;if(!a)return;dismissModal();dispatch({type:'respond',uid:a.uid,key:a.key});}else{const uids=[...selectionState.selected];if(!engine.validatePick(p,uids).valid)return;dismissModal();dispatch({type:'choose',uids});}break;}
      case 'pending-pass':dismissModal();dispatch({type:'pass'});break;
      case 'pending-cancel':dismissModal();dispatch({type:'choose',cancel:true});break;
    }
  });
  document.addEventListener('input',event=>{
    if(workshop.input(event.target))return;
    if(event.target.id==='library-search'){libraryQuery=event.target.value;renderLibraryResults();}
    if(event.target.id==='volume-control'){prefs.volume=Number(event.target.value)/100;updatePrefs();$('#volume-label').textContent=Math.round(prefs.volume*100)+'%';}
  });
  document.addEventListener('change',event=>{
    workshop.change(event.target);
    if(event.target.id==='library-family'){libraryFamily=event.target.value;renderLibraryResults();}
    if(event.target.id==='opponent-deck')setupOptions.opponentDeck=event.target.value;
  });
`+source.slice(eventEnd);
source=source.replace("  const stored = readStorage('duel-sanctuary-save-v1', null);", "  const stored = readStorage('duel-sanctuary-save-v2', null) || readStorage('duel-sanctuary-save-v1', null);");
source=source.replace("if (!restored) startGame({ deck: 'blue', first: 1, difficulty: 'standard', seed: 48 }, true);", "if (!restored) startGame({ deck: 'hero', opponentDeck: 'blackwing', first: 0, difficulty: 'standard', seed: 48 });");
source=source.replace("  if (!readStorage('duel-sanctuary-welcomed-v1', false)) {\n    setTimeout(() => showToast('欢迎来到决斗之境。点击一张手牌，让命运开始转动。'), 800);\n    writeStorage('duel-sanctuary-welcomed-v1', true);\n  }", "  if (!readStorage('duel-sanctuary-welcomed-v2', false)) {\n    setTimeout(() => { if (!modal.open && !engine.state.pending) showNewGame(); }, 300);\n    writeStorage('duel-sanctuary-welcomed-v2', true);\n  }\n  const archiveCount = document.querySelector('[data-action=\"library\"] em'); if (archiveCount) archiveCount.textContent = CARD_LIST.filter(c=>!c.notCollectible).length;");
source=source.replace("    newGame: options => startGame(options, true),", "    newGame: options => startGame(options),\n    showWorkshop: id => workshop.show(id),\n    showNewGame,\n    showLibrary,\n    get workshopDraft() { return workshop.draft; },");
await writeFile(new URL('../src/game-v2.js',import.meta.url),source);
console.log('Created src/game-v2.js from the preserved V1 UI.');
