(function () {
  'use strict';
  const I=window.DuelI18n,{ isMonster, isExtra, isFamily } = window.DuelData;
  const CARDS=I.cards,CARD_LIST=window.DuelData.CARD_LIST.map(c=>I.card(c.id)),DECKS=I.decks;
  const ART = window.DUEL_ART, Art = window.DuelArt, View = window.DuelView, DeckTools = window.DuelDecks;
  const Experience=window.DuelExperience;
  DeckTools.load();
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const icon = name => '<svg class="icon" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  const readStorage = (key, fallback) => { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
  const writeStorage = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const prefs = Object.assign({ sound:true,music:true,volume:.35,musicVolume:.28,fontScale:110,libraryPageSize:24,workshopPageSize:24,responseMode:'auto',cardStyle:'classic',reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,speed:'normal' }, readStorage('duel-sanctuary-prefs-v1', {}));
  prefs.volume = Number.isFinite(Number(prefs.volume)) ? Math.max(0, Math.min(1, Number(prefs.volume))) : .35;
  prefs.fontScale=Experience.clampFont(prefs.fontScale);prefs.libraryPageSize=Experience.pageSize(prefs.libraryPageSize);prefs.workshopPageSize=Experience.pageSize(prefs.workshopPageSize);
  if(!['auto','on','off'].includes(prefs.responseMode))prefs.responseMode='auto';
  prefs.musicVolume=Number.isFinite(Number(prefs.musicVolume))?Math.max(0,Math.min(1,Number(prefs.musicVolume))):.28;
  const stats = Object.assign({ games: 0, wins: 0, bestDamage: 0, lastGame: '' }, readStorage('duel-sanctuary-stats-v1', {}));
  const sound = new window.DuelAudio(prefs);
  const modal = $('#modal');
  let engine, selectedUid = null, previewId = 'blue-eyes', previewHidden = false, intent = null;
  let tournament = null, tournamentView = null, parkedDuel = null;
  let pvp = null, parkedOffline = null;
  const onlineLocked = () => !!engine?.remote && (!pvp?.connected || engine.busy || pvp.room?.clock.paused);
  let aiTimer = null, aiEpoch = 0, modalKind = '', pendingKey = '', libraryQuery = '', libraryFilter = 'all';
  let modalHistory = [], restoringModal = false;
  let setupOptions = { deck: 'early-ritual', opponentDeck: 'early-fusion', first: 0, difficulty: 'standard', mode: 'duel' }, selectionState = null, responseUid = null;
  let libraryFamily = 'all',libraryYear='all',libraryPage=0,libraryStatus='all',detailReturn = null,detailCardId=null,pileContext = null,deckOwner=0,overlayHostUid=null;
  const journal=window.DuelLogUI.create({engine:()=>engine,names:()=>tournamentView?.names||[I.player(0,engine),I.player(1,engine)],open:openModal,card:showCardDetail});
  const spectate = { paused: false };
  const spectating = () => engine?.state.mode === 'spectate';
  const fate=window.DuelRuleUI.create({engine:()=>engine,open:openModal,spectating,reducedMotion:()=>prefs.reducedMotion,attacking:()=>intent?.kind==='attack'?intent.uid:null});
  const robotName = owner => tournamentView?.names[owner] || (owner === 0 ? '机器人 A' : '机器人 B');
  const workshop = window.DuelWorkshop.create({ aiImport:()=>aiImport.show(),open:(...args)=>openModal(...args),toast:(...args)=>showToast(...args),getPageSize:()=>prefs.workshopPageSize,setPageSize:value=>{prefs.workshopPageSize=Experience.pageSize(value);updatePrefs();},play:id=>{setupOptions={deck:id,opponentDeck:engine?.state.players[1].deckId||'blackwing',first:0,difficulty:'standard',mode:'duel'};renderNewGame();} });
  const aiImport = window.DuelAIImport.create({open:openModal,back:backModal,workshop:()=>workshop.show(),load:deck=>workshop.importDraft(deck),settings:showSettings});
  let positionCache = new Map(), animationTimers = [], resultShown = false, cinematicTimer = null;
  let hoverId = null, savedAvailable = true;
  let currentScreen='home',peekState=null,audioScene='lobby';
  const chainDirector=new Experience.ChainDirector({node:$('#chain-theater'),prefs,onIdle:()=>{if(!engine)return;renderChainTimeline();if(engine.state.winner!==null)finishGame();else scheduleAI();}});
  const phaseNames = { main1: '主要阶段 1', battle: '战斗阶段', main2: '主要阶段 2' };
  const difficultyNames = { casual: '休闲', standard: '标准' };
  document.documentElement.style.setProperty('--back-image', 'url("' + ART['card-back'] + '")');
  document.body.classList.toggle('reduce-motion', !!prefs.reducedMotion);
  applyDisplayPreferences();

  function applyDisplayPreferences(){
    document.documentElement.style.setProperty('--ui-scale',prefs.fontScale/100);
    document.documentElement.dataset.fontScale=String(prefs.fontScale);
    document.body.classList.toggle('full-art-cards',prefs.cardStyle==='full-art');
    for(const [name,url] of Object.entries(window.DUEL_FRAMES||{}))document.documentElement.style.setProperty('--frame-'+name,'url("'+url+'")');
    window.dispatchEvent(new Event('duel-display-change'));
  }
  function setScreen(screen,freshDuel=false){
    currentScreen=screen;document.body.dataset.screen=screen;
    $('#home-screen').hidden=screen!=='home';$('.app-main').hidden=screen!=='duel';
    $('#tournament-screen').hidden=screen!=='tournament';
    $('#pvp-screen').hidden=screen!=='pvp';
    if(screen!=='pvp')pvp?.hide();
    if(screen!=='tournament')tournament?.hide();
    $('#duel-turn-hud').hidden=screen!=='duel';
    audioScene=screen==='duel'?'battle':'lobby';if(freshDuel&&screen==='duel')sound.beginDuel();else sound.setScene(audioScene);
    if(screen!=='duel')clearTimeout(aiTimer);
    renderChrome();
  }
  function showHome(){
    leaveTournamentView();
    if(modalKind==='pending'&&engine.state.pending)peekPending();else dismissModal();
    chainDirector.skip();hidePopover();setScreen('home');renderHome();
  }
  function enterDuel(){
    leaveTournamentView();
    if(modal.open&&modalKind==='pending'){peekPending();return;}
    dismissModal();setScreen('duel');render();scheduleAI();
  }
  function leaveTournamentView(){
    tournament?.closeViewer();
    if(!parkedDuel)return;
    aiEpoch++;clearTimeout(aiTimer);chainDirector.reset();
    engine=parkedDuel.engine;selectedUid=parkedDuel.selectedUid;previewId=parkedDuel.previewId;
    previewHidden=parkedDuel.previewHidden;intent=parkedDuel.intent;peekState=parkedDuel.peekState;
    resultShown=parkedDuel.resultShown;spectate.paused=parkedDuel.paused;
    parkedDuel=null;tournamentView=null;document.body.classList.remove('tournament-viewing');
    $('#turn-panel').removeAttribute('data-i18n-skip');$('#mobile-turn-control').removeAttribute('data-i18n-skip');
  }
  function showTournament(){
    if(engine?.remote){showPvp();showToast('请先离开联机房间，再开始其他对局。');return;}
    if(modalKind==='pending'&&engine.state.pending)peekPending();else dismissModal();
    leaveTournamentView();chainDirector.reset();hidePopover();setScreen('tournament');
    tournament?.show().catch(error=>showToast(error.message,true));
  }
  function showPvp(){
    leaveTournamentView();
    if(modalKind==='pending'&&engine.state.pending)peekPending();else dismissModal();
    hidePopover();setScreen('pvp');pvp?.show();
  }
  function attachRemote(remote){
    leaveTournamentView();
    if(!parkedOffline)parkedOffline={engine,previewId,resultShown};
    aiEpoch++;clearTimeout(aiTimer);clearTimeout(cinematicTimer);chainDirector.reset();dismissModal();hidePopover();
    for(const timer of animationTimers)clearTimeout(timer);animationTimers=[];
    $('#cinematic').classList.remove('visible');$('#fx-layer').innerHTML='';
    engine=remote;selectedUid=null;intent=null;peekState=null;previewHidden=false;pendingKey='';resultShown=false;
    previewId=engine.deckInfo(0).ace;document.body.classList.add('pvp-dueling');
    remote.onPickUpdate=()=>{if(modalKind==='pending'&&selectionState)updatePicks();};
    remote.onBusyUpdate=()=>{if(engine!==remote)return;render();pvp?.updateClocks();scheduleAI();};
    bindEngine();setScreen('duel',true);render();saveGame();scheduleAI();
    if(engine.state.winner!==null)finishGame();
  }
  function detachRemote(){
    if(!parkedOffline)return;
    aiEpoch++;clearTimeout(aiTimer);clearTimeout(cinematicTimer);chainDirector.reset();dismissModal();hidePopover();
    engine=parkedOffline.engine;previewId=parkedOffline.previewId;resultShown=parkedOffline.resultShown;parkedOffline=null;
    selectedUid=null;intent=null;peekState=null;previewHidden=false;pendingKey='';
    document.body.classList.remove('pvp-dueling','pvp-input-locked');$('#pvp-duel-bar').hidden=true;
    bindEngine();render();saveGame();
  }
  function showTournamentFrame(watched,meta){
    const first=!parkedDuel;
    const freshMusic=!tournamentView||tournamentView.matchId!==meta.matchId||tournamentView.gameIndex!==meta.gameIndex;
    if(first){
      parkedDuel={engine,selectedUid,previewId,previewHidden,intent,peekState,resultShown,paused:spectate.paused};
      aiEpoch++;clearTimeout(aiTimer);clearTimeout(cinematicTimer);chainDirector.reset();dismissModal();hidePopover();
      for(const timer of animationTimers)clearTimeout(timer);animationTimers=[];
      $('#cinematic').classList.remove('visible');$('#fx-layer').innerHTML='';
      intent=null;peekState=null;selectedUid=null;previewHidden=false;resultShown=true;
    }
    engine=watched;tournamentView=meta;engine.state.mode='spectate';
    if(first)previewId=engine.deckInfo(0).ace;
    if(selectedUid&&!engine.find(selectedUid))selectedUid=null;
    document.body.classList.add('tournament-viewing');
    $('#turn-panel').setAttribute('data-i18n-skip','');$('#mobile-turn-control').setAttribute('data-i18n-skip','');
    setScreen('duel',freshMusic);render();
  }
  function renderHome(){
    const count=CARD_LIST.filter(c=>!c.notCollectible).length,decks=Object.values(DECKS).filter(d=>d.preset).length;
    $('#home-stats').innerHTML='<span><b>'+count.toLocaleString('en-US')+'</b> 张卡片</span><span><b>'+decks+'</b> 套预设</span><span><b>6</b> 种召唤方式</span>';
    $('#home-card-count').textContent=count.toLocaleString('en-US')+' 张卡片';
    $('#home-continue').textContent=engine?.state.winner===null?'继续决斗 · 第 '+engine.state.turn+' 回合 →':'返回战场 →';
    if(!$('#home-art').children.length)$('#home-art').innerHTML='<div class="hero-card hero-card-left">'+cardHTML('dark-magician')+'</div><div class="hero-card hero-card-right">'+cardHTML('blue-eyes')+'</div><div class="hero-card hero-card-center">'+cardHTML('stardust-dragon')+'</div><span class="hero-art-caption">三千年的羁绊 · 此刻回应</span>';
    Art.refresh($('#home-screen'));
  }
  function renderChrome(){
    if(!engine)return;
    const s=engine.state;
    $('#screen-breadcrumb').textContent=currentScreen==='pvp'?'ONLINE / BEST OF ONE':engine.remote?'PVP / LIVE':currentScreen==='tournament'?'BOT ARENA':currentScreen==='home'?'DUEL SANCTUARY':tournamentView?(tournamentView.live?'TOURNAMENT / LIVE':'TOURNAMENT / REPLAY'):spectating()?'SPECTATOR':'DUEL FIELD';
    $('#duel-turn-hud').innerHTML='<span class="turn-hud-number"><small>TURN</small><b>'+String(s.turn).padStart(2,'0')+'</b></span><span><strong>第 '+s.turn+' 回合</strong><small>'+(s.winner!==null?'决斗已结束':(spectating()?escape(robotName(s.active)):s.active===0?'我方':'对方')+' · '+(phaseNames[s.phase]||s.phase))+'</small></span>';
    $('#duel-turn-hud').classList.toggle('opponent-turn',s.active===1);
    $('#response-mode-switch').innerHTML=[['auto','AUTO','自动'],['on','ON','全部'],['off','OFF','关闭']].map(([id,name,label])=>'<button data-action="response-mode" data-value="'+id+'" class="'+(prefs.responseMode===id?'active':'')+'" aria-pressed="'+(prefs.responseMode===id)+'"><b>'+name+'</b><span>'+label+'</span></button>').join('');
    $('#response-mode-note').textContent=prefs.responseMode==='auto'?'关注对方发动、召唤和攻击。':prefs.responseMode==='on'?'每个合法响应时机都询问。':'自动放弃可选响应，强制处理保留。';
    renderPeekBar();renderChainTimeline();updateMusicStatus();renderLingeringTool();
  }
  function chainLabel(link){
    if(link.status==='unavailable')return (link.byNumber?'连锁 '+link.byNumber+' → ':'')+'来源离场，未能适用';
    if(link.status==='negated')return link.byNumber?'被连锁 '+link.byNumber+' 无效':link.reason==='source-unavailable'?'来源失效':'效果无效';
    if(link.status==='target-lost')return '目标丢失';
    return {waiting:'等待结算',resolving:'正在处理',resolved:'处理完成'}[link.status]||'等待结算';
  }
  function renderChainTimeline(){
    const history=engine?.state.chainHistory||[],id=history.at(-1)?.chainId,links=history.filter(l=>l.chainId===id).sort((a,b)=>b.number-a.number);
    $('#chain-timeline').innerHTML=links.length?'<div class="chain-order-hint">'+links.map(l=>l.number).join(' → ')+' · 后发动先处理</div>'+links.slice(0,5).map(l=>'<button class="chain-timeline-link status-'+l.status+'" data-action="chain-log"><b>'+l.number+'</b><span><strong>'+escape(CARDS[l.cardId]?.name)+'</strong><small>'+(l.owner===0?'我方':'对方')+' · '+chainLabel(l)+'</small></span></button>').join(''):'<div class="chain-empty"><span>∞</span><p>连锁将在这里展开</p><small>双方编号 · 逆序结算</small></div>';
    $$('.field-chain-number').forEach(el=>el.remove());
    for(const link of engine?.state.chain||[]){const el=$('#duel-board [data-card-uid="'+link.uid+'"]');if(el)el.insertAdjacentHTML('beforeend','<span class="field-chain-number" aria-label="连锁 '+link.chainNumber+'">'+link.chainNumber+'</span>');}
  }
  function showChainLog(){
    const history=engine.state.chainHistory||[],ids=[...new Set(history.map(l=>l.chainId))].reverse();
    const body=ids.length?ids.map(id=>{const links=history.filter(l=>l.chainId===id).sort((a,b)=>b.number-a.number);return '<section class="chain-history-group"><header><h3>CHAIN '+id+' <small>'+links.map(l=>l.number).join(' → ')+'</small></h3><button data-action="replay-chain" data-chain-id="'+id+'">回放演出 ↗</button></header>'+links.map(l=>'<div class="chain-history-link status-'+l.status+'"><b>'+l.number+'</b>'+Art.html(l.cardId,'chain-history-art')+'<div><h4>'+escape(CARDS[l.cardId]?.name)+'</h4><p>'+(l.owner===0?'我方':'对方')+' · '+escape(I.effectLabel(window.DuelEffects.get(l.key)))+'</p><strong>'+chainLabel(l)+'</strong>'+(l.lostTargets?.length?'<small>'+l.lostTargets.map(target=>(target.byNumber?'连锁 '+target.byNumber+' → ':'')+(target.cardId?CARDS[target.cardId]?.name:'所选目标')+'离开原位置').map(escape).join('；')+'</small>':'')+'</div></div>').join('')+'</section>';}).join(''):'<div class="empty-state">还没有连锁记录。发动效果后，双方的连锁与处理结果会保存在这里。</div>';
    openModal('chain-log','每一环，都清晰可见。','CHAIN HISTORY · 大号先处理，1 最后处理',body,'<button class="primary-button" data-action="close-modal">返回战场</button>','chain-history-modal');
  }
  function peekPending(){
    const p=engine.state.pending;if(!p)return;
    peekState={key:JSON.stringify(p),selection:selectionState?JSON.parse(JSON.stringify(selectionState)):null};
    modalKind='';pendingKey='';hidePopover();if(modal.open)modal.close();renderPeekBar();
  }
  function renderPeekBar(){
    const p=engine.state.pending,bar=$('#response-peek-bar');
    if(peekState&&peekState.key!==JSON.stringify(p))peekState=null;
    bar.hidden=!peekState||currentScreen!=='duel';
    $$('.response-source-highlight,.response-target-highlight').forEach(el=>el.classList.remove('response-source-highlight','response-target-highlight'));
    if(bar.hidden)return;
    const summary=Experience.responseSummary(engine,p),canPass=['window','trigger'].includes(p.kind)&&!p.trigger?.mandatory;
    bar.innerHTML='<div><small>决策已保留 · 战局暂停</small><strong>'+escape(summary.label)+' · '+escape(summary.text||'')+'</strong></div><button class="primary-button" data-action="pending-resume">返回选择 '+icon('arrow')+'</button>'+(canPass?'<button class="text-button" data-action="pending-pass">本次不连锁</button>':'');
    if(summary.uid)$('[data-card-uid="'+summary.uid+'"]')?.classList.add('response-source-highlight');
    for(const target of summary.targets||[])$('[data-card-uid="'+target.uid+'"]')?.classList.add('response-target-highlight');
  }
  function resumePending(){
    const saved=peekState;peekState=null;dismissModal();setScreen('duel');showPending(true);
    if(saved?.key===JSON.stringify(engine.state.pending)&&saved.selection){
      selectionState=saved.selection;
      if(!['window','trigger'].includes(engine.state.pending.kind))updatePicks();
      else if(selectionState.response){
        const options=engine.state.pending.options||[{uid:engine.state.pending.trigger?.uid,key:engine.state.pending.trigger?.key}];
        $$('.response-option').forEach((el,i)=>el.classList.toggle('chosen',options[i]?.uid===selectionState.response.uid&&options[i]?.key===selectionState.response.key));
        $('#pending-confirm').disabled=false;
        $('#pick-feedback').textContent='已选择 · '+I.effectLabel(window.DuelEffects.get(selectionState.response.key));
      }
      $$('.summon-position-choice button').forEach(el=>el.classList.toggle('active',el.dataset.position===selectionState.position));
    }
    renderPeekBar();
  }
  function updateMusicStatus(){
    const s=sound.status(),active=prefs.music;
    $('#music-title').textContent=s.title||'配乐已就绪';
    $('#music-scene').textContent=!active?'BGM · 已关闭':({lobby:'LOBBY',battle:'DUEL · SHUFFLE',library:'CARD ARCHIVE',workshop:'DECK ATELIER',help:'HANDBOOK'}[s.scene]||'SOUNDTRACK')+(s.state==='playing'?' · PLAYING':s.state==='error'?' · 音源不可用':' · 点击播放');
    $('#music-toggle').setAttribute('aria-pressed',String(active));$('#music-dock').classList.toggle('is-playing',s.state==='playing');
    $('#music-next').hidden=s.scene!=='battle';
  }

  function cardHTML(id, instance = null) { return View.card(id, instance); }
  function deckNameHTML(deck) { return '<span'+(deck.custom?' data-user-content':'')+'>'+escape(deck.name)+'</span>'; }
  function detailsHTML(id, instance = null) { return View.details(id, instance, engine); }
  function renderInspector() {
    if (previewHidden) {
      $('#card-preview').innerHTML = '<img src="' + ART['card-back'] + '" alt="对方的里侧卡牌" style="width:100%;border-radius:6px;transform:rotate(-2deg)">';
      $('#card-information').innerHTML = '<h2 class="card-name">未知的卡牌</h2><div class="card-en">FACE-DOWN CARD</div><div class="card-tags"><span class="card-tag">里侧表示</span></div><p class="card-description" style="margin-top:15px">对方盖放的卡牌。发动或翻开后，才能查看这张卡的身份。仔细观察，谨慎出击。</p>';
      $('#context-actions').innerHTML = '<span class="context-status">相信直觉，也相信你的卡组。</span>';
      return;
    }
    const selected = selectedUid ? engine.find(selectedUid) : null;
    const instance = selected?.card.id === previewId ? selected.card : null;
    $('#card-preview').innerHTML = cardHTML(previewId, instance);
    $('#card-information').innerHTML = detailsHTML(previewId, instance);
    $('#context-actions').innerHTML = '<button class="mini-action" data-action="inspect-full">' + icon('search') + '查看完整卡面</button>';
  }
  function avatarBar(owner) {
    const p=engine.state.players[owner],deck=I.deck(engine.deckInfo(owner)),s=engine.state,spec=spectating();
    const publicHand=owner===1&&(spec||engine.handRevealed?.(1,0)),top=engine.publicDeckTop?.(owner);
    const end=(owner===1?'<div class="enemy-hand'+(spec?' spectate-hand':'')+'" aria-label="对方有'+p.hand.length+'张手牌">'+(publicHand?p.hand.map(m=>'<button class="public-hand-card" data-action="card-detail" data-card-id="'+m.id+'" title="'+(spec?'机器人 B 的手牌：':'公开手牌：')+escape(CARDS[m.id].name)+'">'+Art.html(m.id)+'</button>').join(''):Array.from({length:Math.min(p.hand.length,8)},(_,i)=>'<span class="enemy-card" style="--angle:'+((i-Math.min(p.hand.length,8)/2)*5)+'deg"></span>').join(''))+'<small>'+p.hand.length+'</small></div>':'<div class="normal-counter'+(s.active!==0||s.normalUsed?' used':'')+'"><span class="counter-gem"></span>通常召唤 '+(s.active===0&&!s.normalUsed?'1 / 1':'0 / 1')+'</div>')+(top?'<small class="revealed-deck-top" title="天变地异：公开卡组顶">卡组顶 · '+escape(CARDS[top.id].name)+'</small>':'');
    const tag=engine.remote?'<span class="you-tag">'+(owner===0?'YOU':'PVP')+'</span>':spec?'<span class="you-tag robot-tag">'+(tournamentView?'BOT '+(owner===0?'A':'B'):escape(robotName(owner)))+'</span><span>AI · '+difficultyNames[s.difficulty]+'</span>':owner===0?'<span class="you-tag">YOU</span>':'<span>AI · '+difficultyNames[s.difficulty]+'</span>';
    return '<div class="avatar-frame">'+Art.html(deck.ace,'avatar-art')+'</div><div class="duelist-info"><div class="duelist-name"'+(tournamentView||engine.remote?' data-user-content':'')+'>'+escape(tournamentView?robotName(owner):deck.player)+'</div><div class="duelist-sub">'+tag+'<span>'+escape(deck.mechanic||'决斗者')+'</span></div></div><div class="lp-section'+(p.lp<=2000?' critical':'')+'" id="lp-'+owner+'"><div class="lp-heading"><span>LIFE POINTS</span><b>'+p.lp.toLocaleString('en-US')+'</b></div><div class="lp-track"><div class="lp-fill" style="width:'+Math.min(100,p.lp/80)+'%"></div></div></div>'+statusChips(owner)+end;
  }
  function fieldCard(card,owner,zone,index) {
    const c=CARDS[card.id]||{name:'未公开卡牌'},monster=['monsters','extraMonster'].includes(zone),spec=spectating(),hidden=!!card.hidden||!card.faceUp&&owner===1&&!spec,shown=!hidden;
    const attacking=monster&&owner===0&&!spec&&engine.state.active===0&&engine.state.phase==='battle'&&!engine.state.pending&&engine.actionsFor(card.uid,0).some(a=>a.type==='attack');
    const face=!card.faceUp?(spec?'<span class="set-reveal">'+cardHTML(card.id,card)+'<span class="set-badge">盖放</span></span>':'<div class="card-back"></div>'):cardHTML(card.id,card);
    const value=card.position==='defense'?engine.defenseValue(card):engine.attackValue(card);
    return '<button class="zone has-card'+(selectedUid===card.uid?' selected':'')+(attacking?' attack-ready':'')+(isTargetable(owner,zone,card)?' targetable':'')+(c.type==='pendulum'&&zone==='spells'?' pendulum-zone':'')+'" data-action="select-card" data-card-uid="'+card.uid+'" data-owner="'+owner+'" data-zone="'+zone+'" data-slot="'+index+'" aria-label="'+(spec?escape(robotName(owner))+' 的':owner===0?'你的':'对方的')+(hidden?'里侧卡牌':escape(c.name)+(monster?'，'+(card.position==='attack'?'攻击力':'守备力')+value:''))+'"><span class="field-card'+(monster&&card.position==='defense'?' defense':'')+'">'+face+(monster&&shown?'<span class="field-stats'+(card.position==='defense'?' defense':'')+'"><em>'+(card.position==='defense'?'DEF':'ATK')+'</em><span class="'+(value>(card.position==='defense'?c.def:c.atk)?'boost':'')+'">'+value+'</span></span>':'')+(monster&&shown&&card.overlays?.length?'<span class="overlay-badge" title="'+card.overlays.length+'张超量素材">✦ '+card.overlays.length+'</span>':'')+(card.faceUp&&engine.scales(owner).some(s=>s?.card.uid===card.uid)?'<span class="scale-badge '+(index===0?'blue':'red')+'">◈ '+engine.pendulumScale(card)+'</span>':'')+(monster&&shown&&card.counters>0?'<span class="field-status">✧'+card.counters+'</span>':monster&&card.attacksMade>0?'<span class="field-status attacked">✓</span>':'')+(card.faceUp&&engine.negated(card)?'<span class="negated-badge">无效</span>':'')+'</span></button>';
  }
  function renderZone(owner,zone) {
    const entries=engine.state.players[owner][zone].map((card,index)=>({card,index}));if(owner===1)entries.reverse();
    return entries.map(({card,index})=>card?fieldCard(card,owner,zone,index):'<div class="zone'+(zone==='spells'&&[0,4].includes(index)?' empty-pendulum':'')+'" data-empty-owner="'+owner+'" data-empty-zone="'+zone+'" data-slot="'+index+'"><span class="zone-empty">'+icon(zone==='monsters'?'swords':'spark')+'<small>'+(zone==='monsters'?'MONSTER':[0,4].includes(index)?'SPELL / PENDULUM':'SPELL & TRAP')+'</small></span></div>').join('');
  }
  function pileHTML(owner,kind) {
    const p=engine.state.players[owner],label=owner===0?'你的':'对方的';
    if(kind==='extra')return '<button class="extra-pile" data-action="pile" data-owner="'+owner+'" data-pile="extra" aria-label="'+label+'额外卡组">◇ 额外 <b>'+p.extra.length+'</b></button>';
    if(kind==='banished')return '<button class="extra-pile banished-pile" data-action="pile" data-owner="'+owner+'" data-pile="banished" aria-label="'+label+'除外区">⊘ 除外 <b>'+p.banished.length+'</b></button>';
    if(kind==='fieldSpell')return '<div class="field-spell-dock">'+(p.fieldSpell?fieldCard(p.fieldSpell,owner,'fieldSpell',0):'<span class="field-spell-empty">FIELD</span>')+'</div>';
    if(kind==='grave'){const last=p.grave.at(-1);return '<button class="pile grave-pile" data-action="pile" data-owner="'+owner+'" data-pile="grave" aria-label="'+label+'墓地，'+p.grave.length+'张"><span class="pile-card">'+(last?Art.html(last.id,'grave-art'):icon('grave'))+'<span class="pile-count">'+p.grave.length+'</span></span><span>墓地</span></button>';}
    return '<button class="pile" data-action="pile" data-owner="'+owner+'" data-pile="deck" aria-label="'+label+'卡组，剩余'+p.deck.length+'张"><span class="pile-card"><span class="pile-count">'+p.deck.length+'</span></span><span>卡组</span></button>';
  }
  function renderPhases() {
    const s = engine.state, phases = [['draw', '抽卡', '抽卡阶段'], ['standby', '准备', '准备阶段'], ['main1', '主要 1', '主要阶段 1'], ['battle', '战斗', '战斗阶段'], ['main2', '主要 2', '主要阶段 2'], ['end', '结束', '结束回合']];
    const at = phases.findIndex(p => p[0] === s.phase);
    $('#phase-track').innerHTML = phases.map(([key, label, title], i) => {
      const available = !spectating() && !onlineLocked() && s.active === 0 && s.winner === null && !s.pending && !intent && ((s.phase === 'main1' && ['battle', 'main2', 'end'].includes(key) && (key !== 'battle' || s.turn > 1)) || (s.phase === 'battle' && ['main2', 'end'].includes(key)) || (s.phase === 'main2' && key === 'end'));
      return (i ? '<span class="phase-dot">·</span>' : '') + '<button class="phase-step' + (key === s.phase ? ' active' : i < at ? ' done' : '') + '" data-action="phase" data-phase="' + key + '" title="' + title + '" aria-label="' + title + '"' + (!available ? ' disabled' : '') + '><span class="phase-label-long" data-i18n-skip>' + I.term(label) + '</span><span class="phase-label-short" aria-hidden="true" data-i18n-skip>'+(I.language==='en'?['DP','SP','M1','BP','M2','EP'][i]:I.term(label))+'</span></button>';
    }).join('');
  }
  function canUseSpell(card,owner=0) { return engine.actionsFor(card.uid,owner).some(a=>a.type==='activate'); }
  function actionOptions(found) {
    if(!found)return {actions:[],note:''};
    const {card,owner,zone}=found,s=engine.state;
    if(spectating())return {actions:[],note:s.winner!==null?'本场决斗已结束。':'观战模式：机器人自动行动'};
    let actions=engine.actionsFor(card.uid,0);
    if(owner===0&&zone==='extra'&&s.active===0&&!s.pending&&s.winner===null&&['main1','main2'].includes(s.phase)&&engine.extraOptions(0).some(o=>o.card.uid===card.uid))actions.push({type:'extra-summon',uid:card.uid,label:({synchro:'同调',xyz:'超量',link:'连接'}[CARDS[card.id].type])+'召唤',icon:'spark'});
    if(actions.some(a=>a.type==='attack')&&engine.monsters(1).length&&(card.directAttackTurn===s.turn||engine.canDirect?.(card,0))&&engine.canAttack(card,0,null))actions.push({type:'attack',uid:card.uid,target:null,direct:true,label:'直接攻击对方',icon:'swords'});
    actions=actions.map((a,i)=>({...a,label:I.actionLabel(a),command:String(i),primary:a.type==='activate'||a.type==='extra-summon'||a.type==='attack'||i===0,icon:['pendulum','synchro','xyz','link'].includes(a.icon)?'spark':a.icon||'spark'}));
    const note=s.winner!==null?'本场决斗已结束。':owner!==0?'观察公开信息，规划你的下一步。':s.pending?'请先完成当前效果或连锁选择。':s.active!==0?'对方回合：满足时机会自动提示快速效果。':actions.length?'':zone==='extra'?'需要满足素材、等级或Link值与区域限制；融合怪兽通过相应魔法或效果登场。':zone==='hand'&&s.normalUsed?'通常召唤已使用，可继续用特殊召唤或效果展开。':'当前没有可发动的效果或操作。';
    return {actions,note};
  }
  function renderHand() {
    const hand = engine.state.players[0].hand, s = engine.state, spec = spectating();
    const crowded=hand.length>7||(matchMedia('(max-height:600px) and (orientation:landscape)').matches&&hand.length>5);
    $('#hand-cards').classList.toggle('is-scrollable',crowded);
    $('#hand-count').textContent = hand.length;
    $('#hand-title').textContent = spec ? '机器人 A 的手牌' : '你的手牌';
    $('#hand-hint').textContent = crowded?'左右滑动查看手牌':s.winner !== null ? '决斗结束 · 每一张卡都有它的故事' : spec ? '观战模式 · 点击可查看卡牌' : intent ? '按提示完成选择 · Esc 取消' : s.active === 0 ? '点击卡牌，开启你的战术' : '对方正在行动 · 你可以查看卡牌';
    $('#hand-cards').innerHTML = hand.map((card, index) => {
      const mid = (hand.length - 1) / 2, angle = (index - mid) * Math.min(3.1, 16 / Math.max(1, mid * 2)), lift = Math.abs(index - mid) ** 1.55 * (hand.length > 7 ? .65 : 1.9);
      const options = actionOptions(engine.find(card.uid)), playable = options.actions.length > 0;
      return '<button class="hand-slot' + (selectedUid === card.uid ? ' selected' : '') + (!playable && s.active === 0 && !spec ? ' not-playable' : '') + '" style="--angle:' + angle.toFixed(2) + 'deg;--lift:' + lift.toFixed(2) + 'px;--order:' + (index + 1) + '" data-action="select-card" data-card-uid="' + card.uid + '" data-owner="0" data-zone="hand" aria-label="' + escape(CARDS[card.id].name) + '，' + (playable ? options.actions[0].label : '查看卡牌') + '">' + cardHTML(card.id, card) + (playable ? '<span class="playable-dot"></span><span class="hand-card-hint">' + options.actions[0].label + '</span>' : '') + '</button>';
    }).join('');
  }
  function nextPhaseInfo() {
    const s = engine.state;
    if(engine.remote&&s.winner!==null)return {label:'返回联机房间',action:'pvp'};
    if(onlineLocked())return {label:'等待连接与确认…',disabled:true};
    if (s.winner !== null) return { label: '再来一场决斗', action: 'new-game', phase: null };
    if (spectating()) return { label: '观战中', disabled: true };
    if (s.active !== 0) return { label: s.pending?.responder === 0 ? '等待你的响应' : '对方思考中…', disabled: true };
    if (s.phase === 'main1') {
      if (s.turn === 1) return { label: '结束先攻回合', action: 'end', phase: null };
      return engine.attackBlocked(0) ? { label: '进入主要阶段 2', action: 'phase', phase: 'main2' } : { label: '进入战斗阶段', action: 'phase', phase: 'battle' };
    }
    if (s.phase === 'battle') return { label: '进入主要阶段 2', action: 'phase', phase: 'main2' };
    return { label: '结束我的回合', action: 'end', phase: null };
  }
  function renderSpectateControls() {
    if(tournamentView){tournament?.renderBoardTools();return;}
    const s = engine.state, over = s.winner !== null, paused = spectate.paused, who = robotName(s.active);
    const description = over ? '决斗已经结束，可以查看记录或开始新的对战。' : paused ? '已暂停。可以逐步观察每一次结算，或继续自动播放。' : s.pending ? robotName(s.pending.responder) + ' 正在决定是否响应。' : who + ' 正在行动，双方手牌与盖牌全部可见。';
    const status = over ? 'DUEL COMPLETE' : paused ? 'PAUSED · ' + (s.active === 0 ? 'ROBOT A' : 'ROBOT B') : s.active === 0 ? 'ROBOT A TURN' : 'ROBOT B TURN';
    const buttons = over ? '<button class="primary-button" data-action="new-game">再来一场决斗' + icon('refresh') + '</button><button class="secondary-button" data-action="result">查看决斗结果</button>'
      : '<div class="spectate-controls"><button class="primary-button" data-action="spectate-toggle">' + (paused ? '继续' : '暂停') + icon(paused ? 'arrow' : 'clock') + '</button><button class="secondary-button" data-action="spectate-step"' + (paused ? '' : ' disabled') + '>单步</button></div><div class="segmented-control spectate-speed">' + [['normal', '沉浸'], ['fast', '快速']].map(([id, label]) => '<button class="' + (prefs.speed === id ? 'active' : '') + '" data-action="spectate-speed" data-value="' + id + '">' + label + '</button>').join('') + '</div><button class="secondary-button" data-action="new-game">更换机器人</button>';
    $('#turn-panel').innerHTML = '<div class="turn-label' + (s.active === 1 ? ' ai' : '') + '"><i></i>' + status + '</div><div class="turn-number">' + String(s.turn).padStart(2, '0') + '</div><h2 class="turn-phase">' + (over ? '决斗结束' : phaseNames[s.phase]) + '</h2><p class="turn-description">' + description + '</p><div class="summon-allowance">' + icon('eye') + '观战模式 <b>' + (over ? '已完成' : who + ' 的回合') + '</b></div>' + buttons + '<div class="keyboard-hint"><kbd>Space</kbd>暂停 / 继续 <span>·</span> <kbd>N</kbd>单步</div>';
    $('#mobile-turn-control').innerHTML = '<div class="mobile-turn-copy"><small>' + status + '</small><b>' + (over ? '决斗已结束' : phaseNames[s.phase]) + '</b></div>' + (over ? '<button class="primary-button" data-action="new-game">再来一场' + icon('arrow') + '</button>' : '<button class="primary-button" data-action="spectate-toggle">' + (paused ? '继续' : '暂停') + '</button><button class="mobile-end-button" data-action="spectate-step"' + (paused ? '' : ' disabled') + '>单步</button>');
    $('#duel-tip').textContent = '观战模式下双方的手牌与盖牌都是公开的；暂停后可以逐步查看每一次结算。';
  }
  function renderControls() {
    if (spectating()) { renderSpectateControls(); return; }
    const s = engine.state, mine = s.active === 0, next = nextPhaseInfo();
    const description = s.winner !== null ? '整理你的卡组，准备迎接下一次挑战。' : s.pending ? s.pending.responder === 0 ? '一个新的时机出现了。选择你的响应。' : '对方正在决定是否响应你的行动。' : mine ? s.phase === 'battle' ? engine.attackBlocked(0) ? '光之护封剑正在生效，先寻找破解方法。' : '选择攻击表示的怪兽，然后点击攻击目标。' : s.phase === 'main2' ? '调整表示，布置后场，为下一回合做好准备。' : s.turn === 1 ? '先攻回合不能攻击。召唤怪兽，布置你的战术。' : '召唤怪兽，发动魔法，<br>让你的战术从这里展开。' : '对方正在展开战术，<br>留意每一次召唤与盖放。';
    $('#turn-panel').innerHTML = '<div class="turn-label' + (!mine ? ' ai' : '') + '"><i></i>' + (s.winner !== null ? 'DUEL COMPLETE' : mine ? 'YOUR TURN' : 'OPPONENT TURN') + '</div><div class="turn-number">' + String(s.turn).padStart(2, '0') + '</div><h2 class="turn-phase">' + (s.winner !== null ? s.winner === 0 ? '决斗胜利' : '决斗结束' : phaseNames[s.phase]) + '</h2><p class="turn-description">' + description + '</p>' +
      '<div class="summon-allowance">' + icon('clock') + '第 ' + String(s.turn).padStart(2, '0') + ' 回合 <b>' + (s.winner !== null ? '已完成' : mine ? '我的回合' : '对手回合') + '</b></div>' +
      '<button class="primary-button" data-action="' + (next.action || 'none') + '"' + (next.phase ? ' data-phase="' + next.phase + '"' : '') + (next.disabled || (s.pending && s.winner === null) || intent ? ' disabled' : '') + '>' + next.label + icon(s.winner !== null ? 'refresh' : 'arrow') + '</button>' +
      '<button class="secondary-button" data-action="' + (s.winner !== null ? 'result' : mine && s.phase !== 'main2' && s.turn > 1 ? 'end' : 'help') + '"' + ((s.pending || intent) && mine ? ' disabled' : '') + '>' + (s.winner !== null ? '查看决斗结果' : mine && s.phase !== 'main2' && s.turn > 1 ? '结束回合' : '查看玩法指南') + '</button>' +
      '<div class="keyboard-hint"><kbd>Space</kbd>切换阶段 <span>·</span> <kbd>E</kbd>结束回合</div>';
    $('#mobile-turn-control').innerHTML = '<div class="mobile-turn-copy"><small>' + (s.winner !== null ? 'DUEL COMPLETE' : mine ? 'YOUR TURN · ' + String(s.turn).padStart(2, '0') : 'OPPONENT TURN') + '</small><b>' + (s.winner !== null ? '决斗已结束' : phaseNames[s.phase]) + '</b></div><button class="primary-button" data-action="' + (next.action || 'none') + '"' + (next.phase ? ' data-phase="' + next.phase + '"' : '') + (next.disabled || (s.pending && s.winner === null) || intent ? ' disabled' : '') + '>' + next.label + icon('arrow') + '</button><button class="mobile-end-button" data-action="' + (mine && s.winner === null && s.turn > 1 ? 'end' : 'help') + '"' + ((s.pending || intent) && mine ? ' disabled' : '') + '>' + (mine && s.winner === null && s.turn > 1 ? '结束' : icon('help')) + '</button>';
    $('#duel-tip').textContent = s.phase === 'battle' ? '攻击守备怪兽时，通常不会造成生命值伤害。小心对手盖放的陷阱。' : s.normalUsed ? '通常召唤已用完？特殊召唤不受这个限制，试试海马侠、死者苏生或融合。' : '5—6星怪兽需要1只祭品，7星以上需要2只。特殊召唤不需要祭品。';
  }
  function logHTML(item, full = false) {
    const spec = spectating();
    const tag = item.owner !== null && !['turn', 'system', 'victory'].includes(item.kind) ? '<span class="event-owner' + (item.owner === 1 ? ' opponent' : '') + '">' + (spec ? (item.owner === 0 ? 'A' : 'B') : item.owner === 0 ? '你' : '对手') + '</span>' : '';
    let text = I.log(item, engine);
    if (spec) { const rival = engine.deckInfo(1); for (const [owner, prefix] of [[0, I.term('你')], [0, '你'], [1, I.deck(rival).player], [1, rival.player]]) if (prefix && text.startsWith(prefix)) { text = I.term(robotName(owner)) + text.slice(prefix.length); break; } }
    return '<div class="log-entry ' + escape(item.kind) + '">' + tag + escape(text) + (full || item.kind !== 'turn' ? '<small class="log-time">TURN ' + String(item.turn).padStart(2, '0') + ' · ' + String(item.n).padStart(3, '0') + '</small>' : '') + '</div>';
  }
  function renderTargetInstruction() {
    const el = $('#target-instruction');
    el.hidden = !intent;
    if (!intent) return;
    let text = '', confirm = '';
    if (intent.kind === 'tribute') { text = '选择 ' + intent.count + ' 只己方怪兽作为祭品（' + intent.selected.length + ' / ' + intent.count + '）'; confirm = '<button data-action="confirm-tribute"' + (intent.selected.length !== intent.count ? ' disabled' : '') + '>确认召唤</button>'; }
    if (intent.kind === 'attack') text = '选择一只对方怪兽，宣言攻击';
    if (intent.kind === 'target') text = '选择场上的一张魔法或陷阱卡，将其破坏';
    el.innerHTML = icon(intent.kind === 'attack' ? 'swords' : 'spark') + '<span>' + text + '</span>' + confirm + '<button data-action="cancel-intent">取消</button>';
  }
  function isTargetable(owner,zone,card) {
    if(!intent)return false;
    if(intent.kind==='attack')return owner===1&&['monsters','extraMonster'].includes(zone)&&engine.canAttack(engine.find(intent.uid)?.card,0,card.uid);
    return false;
  }
  const Lingering=()=>window.DuelLingering;
  function lingeringName(owner){return tournamentView?robotName(owner):I.player(owner,engine);}
  function lingeringTone(entry){
    const zh=Lingering().describe(entry,{language:'zh-CN',turn:engine.state.turn}).text;
    if(entry.scope==='card'&&/无效/.test(zh))return 'negated';
    if(/不会受到|不会被|不受|回复|可以|重掷|贯通|第二次/.test(zh))return 'boon';
    if(/不能|只能|跳过|限制|减半|互换|改为|破坏/.test(zh))return 'restriction';
    return 'neutral';
  }
  function lingeringTarget(entry){
    if(entry.scope!=='card')return '';
    const known=entry.cardId&&(entry.faceUp||spectating()||entry.owner===0||engine.remote&&entry.owner===0);
    return known?'「'+escape(I.name(entry.cardId))+'」':escape(I.term('里侧卡牌'));
  }
  // Effects that already resolved but still bind a player: shown on that
  // player's bar. Duel-wide effects appear on both bars. Everything here is
  // public information, so spectators see both sides.
  function statusChips(owner){
    const L=Lingering();if(!L)return '';
    const list=L.forOwner(L.collect(engine),owner);if(!list.length)return '';
    const shown=list.slice(0,3),language=I.language,turn=engine.state.turn,cardName=id=>I.name(id);
    return '<div class="status-effects" data-owner="'+owner+'" data-i18n-skip aria-label="'+escape(I.term('生效中的效果'))+'">'+shown.map(entry=>{
      const d=L.describe(entry,{language,turn,cardName}),target=lingeringTarget(entry),both=d.scope==='both';
      const title=(target?target+' ':'')+d.text+' · '+d.duration+(d.source?' · '+d.source:'')+(both?' · '+I.term('双方'):'');
      return '<button class="status-chip tone-'+lingeringTone(entry)+'" data-action="lingering" title="'+escape(title)+'"><i></i><span class="chip-text">'+(target?'<em>'+target+'</em>':'')+escape(d.text)+'</span><small>'+escape(d.source||'')+(d.source?' · ':'')+escape(d.duration)+'</small></button>';
    }).join('')+(list.length>shown.length?'<button class="status-chip more" data-action="lingering" title="'+escape(I.term('生效中的效果'))+'">+'+(list.length-shown.length)+'</button>':'')+'</div>';
  }
  function showLingering(){
    const L=Lingering(),list=L?L.collect(engine):[],language=I.language,turn=engine.state.turn,cardName=id=>I.name(id);
    const section=owner=>{
      const items=L?L.forOwner(list,owner):[];
      return '<section class="lingering-group" data-owner="'+owner+'"><h3><span'+(tournamentView||engine.remote?' data-user-content':'')+'>'+escape(lingeringName(owner))+'</span><small>'+items.length+'</small></h3>'+(items.length?'<ul class="lingering-list" data-i18n-skip>'+items.map(entry=>{
        const d=L.describe(entry,{language,turn,cardName}),src=entry.sourceId&&CARDS[entry.sourceId]?entry.sourceId:null,target=lingeringTarget(entry);
        return '<li class="lingering-item tone-'+lingeringTone(entry)+'">'+(src?'<button class="lingering-card" data-action="card-detail" data-card-id="'+src+'" title="'+escape(I.name(src))+'">'+Art.html(src,'lingering-art')+'</button>':'<span class="lingering-card empty"></span>')+'<div class="lingering-body"><strong>'+(target?'<em>'+target+'</em> ':'')+escape(d.text)+'</strong><span class="lingering-meta">'+(src?'<b>'+escape(I.name(src))+'</b> · ':'')+escape(d.duration)+(d.scope==='both'?' · '+escape(I.term('双方')):'')+'</span>'+(src?'<p class="lingering-desc">'+escape(I.card(src).description||'')+'</p>':'')+'</div></li>';
      }).join('')+'</ul>':'<p class="lingering-empty">当前没有生效中的持续效果。</p>')+'</section>';
    };
    openModal('lingering','生效中的效果','ACTIVE EFFECTS · 已结算、仍在生效','<div class="lingering-layout">'+section(1)+section(0)+'</div><p class="lingering-note">这里列出已经结算、仍在生效的效果：伤害保护、召唤限制、效果无效等。持续魔法·陷阱卡本身请直接查看场上的卡片。</p>','<button class="primary-button" data-action="close-modal">返回决斗</button>','lingering-modal');
  }
  function renderLingeringTool(){
    const tool=$('#lingering-tool');if(!tool||!engine)return;
    const n=Lingering()?Lingering().collect(engine).length:0;
    tool.innerHTML='◎'+(n?'<b>'+n+'</b>':'');tool.classList.toggle('active',n>0);
  }
  function render() {
    const s=engine.state,deck=I.deck(engine.deckInfo(0)),rival=I.deck(engine.deckInfo(1));
    $('#opponent-bar').innerHTML=avatarBar(1);$('#player-bar').innerHTML=avatarBar(0);
    for(const [owner,prefix] of [[0,'player'],[1,'opponent']])for(const zone of ['monsters','spells'])$('#'+prefix+'-'+zone).innerHTML=renderZone(owner,zone);
    $('#left-rail').innerHTML='<div class="rail-pile-group">'+pileHTML(1,'deck')+pileHTML(1,'extra')+pileHTML(1,'fieldSpell')+'</div><div class="rail-divider">DUEL FIELD</div><div class="rail-pile-group">'+pileHTML(0,'grave')+pileHTML(0,'banished')+'</div>';
    $('#right-rail').innerHTML='<div class="rail-pile-group">'+pileHTML(1,'grave')+pileHTML(1,'banished')+'</div><div class="rail-divider">SANCTUARY</div><div class="rail-pile-group">'+pileHTML(0,'fieldSpell')+pileHTML(0,'deck')+pileHTML(0,'extra')+'</div>';
    renderExtraLane();
    renderPhases();renderHand();renderControls();renderInspector();renderTargetInstruction();renderModernControls();
    $('#duel-log').innerHTML=s.log.slice(0,24).map(item=>logHTML(item)).join('');
    $('#match-label').innerHTML=deckNameHTML(deck)+' <b>VS</b> '+deckNameHTML(rival);
    $('#deck-summary').innerHTML=Art.html(deck.ace,'deck-summary-art')+'<span><small>'+(spectating()?'机器人 A 的卡组':'我的卡组')+' · '+escape(deck.mechanic)+'</small><strong>'+deckNameHTML(deck)+'</strong><span class="deck-count">'+deck.cards.length+' 张主卡组 · '+deck.extra.length+' 张额外</span></span>'+icon('chevron');
    $('#character-quote').textContent=deck.subtitle||deck.description;$('#quote-author').textContent='— '+deck.player;
    if(!spectating())$('#duel-tip').textContent=(deck.combo||['点击卡牌查看当前合法行动；墓地与除外区也可能存在可以使用的效果。'])[s.turn%Math.max(1,deck.combo?.length||1)];
    document.body.classList.toggle('spectate-mode',spectating());
    updateSoundButton();Art.refresh();highlightLinkZones();
    renderChrome();
    fate.render();
  }
  function renderModernControls() {
    const s=engine.state,main=!spectating()&&s.active===0&&s.winner===null&&!s.pending&&['main1','main2'].includes(s.phase),extra=main?engine.extraOptions(0):[],links=extra.filter(o=>o.type==='link'),pend=main?engine.pendulumCandidates(0):[],scales=engine.scales(0);
    $('#summon-toolbar').innerHTML='<button data-action="extra-menu"'+(!main?' disabled':'')+' class="summon-shortcut'+(extra.length?' available':'')+'">✧ 额外召唤 <b>'+extra.length+'</b></button><button data-action="link-menu"'+(!main?' disabled':'')+' class="summon-shortcut link-shortcut'+(links.length?' available':'')+'">⬡ 连接召唤 <b>'+links.length+'</b></button><button data-action="pendulum-summon"'+(!pend.length?' disabled':'')+' class="summon-shortcut pendulum-shortcut'+(pend.length?' available':'')+'">◈ 灵摆召唤 <b>'+pend.length+'</b></button><span class="scales-readout"><i>'+(scales[0]?.scale??'—')+'</i><span>〈 刻度 〉</span><i>'+(scales[1]?.scale??'—')+'</i></span>';
    $('#summon-toolbar').insertAdjacentHTML('beforeend','<button class="response-mobile" data-action="cycle-response">响应 '+prefs.responseMode.toUpperCase()+'</button>');
    $('#chain-status').innerHTML=s.chain.length?'<span>CHAIN '+s.chain.length+'</span>'+s.chain.map(l=>'<b title="'+escape(I.effectLabel(window.DuelEffects.get(l.key)))+'">'+l.chainNumber+' · '+(l.owner===0?'我方':'对方')+' · '+escape(CARDS[l.sourceId].name)+'</b>').join('<i>→</i>'):s.pending?'<span>决策时机</span><b>'+escape(I.pendingTitle(s.pending,engine))+'</b>':'<span>TURN '+String(s.turn).padStart(2,'0')+'</span><b>'+(s.active===0?'我方回合':'对方回合')+' · '+(phaseNames[s.phase]||s.phase)+'</b>';
    const pieces=['exodia-head','exodia-left-arm','exodia-right-arm','exodia-left-leg','exodia-right-leg'],hasExodia=engine.deckInfo(0).cards.some(id=>pieces.includes(id));$('#exodia-tracker').hidden=!hasExodia;
    if(hasExodia)$('#exodia-tracker').innerHTML='<span>封印的记忆</span>'+pieces.map((id,i)=>'<b class="'+(s.players[0].hand.some(c=>c.id===id)?'collected':'')+'" title="'+escape(CARDS[id].name)+'">'+['頭','左腕','右腕','左足','右足'][i]+'</b>').join('');
  }
  function renderExtraLane() {
    $('#extra-lane').innerHTML=[0,1].map(slot=>{const f=engine.extraAt(slot);return '<div class="extra-dock shared-extra slot-'+slot+'" data-extra-slot="'+slot+'"><small>'+(f?(f.owner===0?'你':'对方')+' · ':'共享 · ')+'额外区 '+(slot===0?'Ⅰ':'Ⅱ')+'</small>'+(f?fieldCard(f.card,f.owner,'extraMonster',slot):'<div class="zone extra-empty"><span>◇</span></div>')+'</div>';}).join('')+'<div class="extra-orbit">'+icon('eye')+'<span>LINK NETWORK</span></div>';
  }
  function highlightLinkZones() {
    const layer=$('#link-network-lines');if(!layer)return;layer.innerHTML='';$$('#duel-board .link-pointed,#duel-board .co-linked').forEach(el=>el.classList.remove('link-pointed','co-linked'));
    const f=selectedUid?engine.find(selectedUid):null;if(!f||!['monsters','extraMonster'].includes(f.zone)||CARDS[f.card.id].type!=='link'||!f.card.faceUp)return;
    const source=$('#duel-board [data-card-uid="'+f.card.uid+'"]');if(!source)return;
    const base=$('#duel-board').getBoundingClientRect(),origin=source.getBoundingClientRect(),start={x:origin.left+origin.width/2-base.left,y:origin.top+origin.height/2-base.top},co=engine.coLinked(f.card.uid);
    for(const p of window.DuelLinkRules.arrowPoints(f)){
      let target=null;
      if([0,2].includes(p.y)&&p.x>=0&&p.x<=4){const owner=p.y===0?0:1,index=owner===0?p.x:4-p.x;target=$('#duel-board [data-owner="'+owner+'"][data-zone="monsters"][data-slot="'+index+'"],#duel-board [data-empty-owner="'+owner+'"][data-empty-zone="monsters"][data-slot="'+index+'"]');}
      else if(p.y===1&&[1,3].includes(p.x))target=$('.extra-dock[data-extra-slot="'+(p.x===1?0:1)+'"] .zone');
      if(!target)continue;target.classList.add('link-pointed');const mutual=co.includes(target.dataset.cardUid);if(mutual)target.classList.add('co-linked');const r=target.getBoundingClientRect(),x=r.left+r.width/2-base.left,y=r.top+r.height/2-base.top;
      layer.innerHTML+='<path class="'+(mutual?'mutual':'')+'" d="M '+start.x+' '+start.y+' L '+x+' '+y+'"/><circle cx="'+x+'" cy="'+y+'" r="4"/>';
    }
    layer.setAttribute('viewBox','0 0 '+base.width+' '+base.height);
  }
  function capturePositions() {
    positionCache = new Map();
    $$('[data-card-uid]').forEach(el => { const r = el.getBoundingClientRect(); positionCache.set(el.dataset.cardUid, { x: r.left + r.width / 2, y: r.top + r.height / 2 }); });
    for (const owner of [0, 1]) { const r = $('#lp-' + owner)?.getBoundingClientRect(); if (r) positionCache.set('lp-' + owner, { x: r.left + r.width / 2, y: r.top + r.height / 2 }); }
  }
  function showToast(message, error = false) {
    message=error?I.error(message):I.text(message);
    const el = document.createElement('div'); el.className = 'toast' + (error ? ' error' : '');
    el.innerHTML = icon(error ? 'help' : 'spark') + '<span>' + escape(message) + '</span>';
    $('#toast-stack').append(el);
    while ($('#toast-stack').children.length > 3) $('#toast-stack').firstElementChild.remove();
    setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 300); }, error ? 4000 : 3400);
  }
  function hidePopover() { $('#card-popover').hidden = true; }
  function clearIntent() { intent = null; hidePopover(); render(); }
  function dispatch(action) {
    if(chainDirector.busy||tournamentView)return false;
    if(onlineLocked()){showToast('等待服务器连接与确认…');return false;}
    capturePositions(); hidePopover();
    const result = engine.act(action);
    if (!result.ok) { showToast(result.error, true); render(); scheduleAI(); return false; }
    return true;
  }
  function chooseCard(uid, element) {
    sound.play('card');
    const found = engine.find(uid);
    if (!found) return;
    if (intent) {
      if (!isTargetable(found.owner, found.zone, found.card)) { showToast('请点击场上高亮的目标。'); return; }
      if (intent.kind === 'tribute') {
        if (intent.selected.includes(uid)) intent.selected = intent.selected.filter(id => id !== uid);
        else if (intent.selected.length < intent.count) intent.selected.push(uid);
        else { showToast('已选够祭品，点击「确认召唤」即可。'); return; }
        render(); return;
      }
      if (intent.kind === 'attack') { const action = { type: 'attack', uid: intent.uid, target: uid }; intent = null; dispatch(action); return; }
      if (intent.kind === 'target') { const action = { type: intent.action, uid: intent.uid, target: uid }; intent = null; dispatch(action); return; }
    }
    selectedUid = uid; previewHidden = !!found.card.hidden || !spectating() && found.owner === 1 && !found.card.faceUp && ['hand','monsters','extraMonster','spells','fieldSpell','extra'].includes(found.zone); previewId = previewHidden ? previewId : found.card.id;
    renderInspector(); $$('.hand-slot.selected,.zone.selected').forEach(el => el.classList.remove('selected'));
    const liveElement = $('[data-card-uid="' + uid + '"]');
    if (liveElement) liveElement.classList.add('selected');
    if (previewHidden) { hidePopover(); showToast('对方的里侧卡牌尚未公开。'); return; }
    const { actions, note } = actionOptions(found), popover = $('#card-popover');
    popover.innerHTML = '<div class="popover-title">' + escape(CARDS[found.card.id].name) + '</div>' +
      actions.map(a => '<button class="' + (a.primary ? 'primary-choice' : '') + '" data-action="card-command" data-command="' + a.command + '" data-uid="' + uid + '">' + icon(a.icon) + a.label + '</button>').join('') +
      (note ? '<div class="popover-note">' + escape(note) + '</div>' : '') +
      (found.card.overlays?.length ? '<button data-action="overlays" data-uid="' + uid + '">✦ 查看 ' + found.card.overlays.length + ' 张超量素材</button>' : '') +
      '<button data-action="card-detail" data-card-id="' + found.card.id + '">' + icon('search') + '查看卡牌详情<span class="shortcut">↗</span></button>';
    popover.hidden = false;
    positionPopover(liveElement || element || $('#card-preview'));highlightLinkZones();
  }
  function positionPopover(element=null) {
    const popover=$('#card-popover');if(popover.hidden)return;
    const anchorElement=element||(selectedUid?$('[data-card-uid="'+selectedUid+'"]'):null);
    if(!anchorElement){hidePopover();return;}
    const anchor=anchorElement.getBoundingClientRect(),bounds=popover.getBoundingClientRect();
    if(!element&&(anchor.bottom<0||anchor.top>innerHeight)){hidePopover();return;}
    const left = Math.max(12, Math.min(innerWidth - bounds.width - 12, anchor.left + anchor.width / 2 - bounds.width / 2));
    let top = anchor.top - bounds.height - 14;
    if (top < 78) top = Math.min(innerHeight - bounds.height - 16, anchor.bottom + 12);
    popover.style.left = left + 'px'; popover.style.top = Math.max(12, Math.min(innerHeight-bounds.height-12,top)) + 'px';
  }
  function cardCommand(command,uid) {
    if(spectating())return;
    const found=engine.find(uid),action=actionOptions(found).actions[Number(command)];if(!action)return;
    hidePopover();
    if(action.type==='attack'&&engine.monsters(1).length&&!action.direct){intent={kind:'attack',uid};render();return;}
    dispatch({...action});
  }
  function saveGame() {
    if(tournamentView)return;
    if(engine.remote){$('#save-status').innerHTML='<i></i>'+I.term('联机进度由服务器保存');return;}
    savedAvailable=writeStorage('duel-sanctuary-save-v2',{...engine.snapshot(),savedAt:Date.now()});
    $('#save-status').innerHTML='<i></i>'+(savedAvailable?'对局已自动保存':'当前浏览器未开放本地存档');
  }
  function runAIStep() {
    const action=engine.aiNext();
    if(!action){if(spectating()){spectate.paused=true;render();showToast('机器人没有可执行的行动，已暂停。',true);}return false;}
    const ok=dispatch(action);
    if(!ok){showToast(spectating()?'机器人行动遇到错误，已暂停观战。':'对方行动遇到错误，请导出决斗记录。',true);clearTimeout(aiTimer);if(spectating()){spectate.paused=true;render();}}
    return ok;
  }
  function scheduleAI() {
    clearTimeout(aiTimer);if(!engine||tournamentView||engine.state.winner!==null||intent||currentScreen!=='duel'||chainDirector.busy)return;
    if(onlineLocked())return;
    const s=engine.state;
    if(spectating()){
      if(modal.open||document.hidden||spectate.paused)return;
      const token=aiEpoch;
      aiTimer=setTimeout(()=>{if(token!==aiEpoch||modal.open||spectate.paused||engine.state.winner!==null)return;runAIStep();},prefs.speed==='fast'?160:s.pending?600:680);
      return;
    }
    if(s.pending?.responder===0){
      if(peekState){renderPeekBar();return;}
      if(modal.open&&modalKind!=='pending')return;
      if(!engine.ruleActions?.(0).length&&Experience.responseDecision(s.pending,prefs.responseMode)==='pass'){
        const pending=s.pending,token=aiEpoch;
        aiTimer=setTimeout(()=>{if(token===aiEpoch&&engine.state.pending===pending&&!modal.open&&!peekState&&currentScreen==='duel'&&!chainDirector.busy)dispatch({type:'pass'});},110);return;
      }
      showPending();return;
    }
    if(engine.remote||modal.open||document.hidden)return;
    if(s.active!==1&&s.pending?.responder!==1)return;
    const token=aiEpoch;
    aiTimer=setTimeout(()=>{if(token!==aiEpoch||modal.open||engine.state.winner!==null)return;runAIStep();},prefs.speed==='fast'?220:s.pending?650:720);
  }
  function spectateStep() {
    if(tournamentView){tournament.seek(tournament.viewer.cursor.index+1);return;}
    if(!spectating()||engine.state.winner!==null||modal.open||chainDirector.busy)return;
    clearTimeout(aiTimer);spectate.paused=true;runAIStep();render();
  }
  function spectateToggle() {
    if(tournamentView){tournament.viewerToggle();return;}
    if(!spectating())return;
    spectate.paused=!spectate.paused;render();
    if(spectate.paused){clearTimeout(aiTimer);showToast('已暂停观战。');}else{showToast('继续观战。');scheduleAI();}
  }
  function bindEngine() {
    window.DuelLog.upgrade(engine.state);
    engine.onChange = events => {
      if(engine.remote&&modalKind==='pending'&&pendingKey!==JSON.stringify(engine.state.pending))dismissModal();
      if (selectedUid && !engine.find(selectedUid)) selectedUid = null;
      for (const event of events) if (event.owner === 0 && ['special','synchro','xyz','link','pendulum','fusion'].includes(event.kind) && event.cardId) { selectedUid = event.uid; previewId = event.cardId; previewHidden = false; }
      if(peekState&&peekState.key!==JSON.stringify(engine.state.pending))peekState=null;
      chainDirector.receive(events,engine.state.chainHistory);
      render(); saveGame(); playEvents(events);
      if (engine.state.winner !== null) { finishGame(); return; }
      if (!engine.state.pending) pendingKey = '';
      scheduleAI();
    };
  }
  function startGame(options = {}, instantOpening = false) {
    if(engine?.remote){showPvp();showToast('请先离开联机房间，再开始其他对局。');return;}
    leaveTournamentView();
    chainDirector.reset();peekState=null;setScreen('duel',true);
    aiEpoch++; clearTimeout(aiTimer); clearTimeout(cinematicTimer);
    for (const timer of animationTimers) clearTimeout(timer); animationTimers = [];
    $('#cinematic').classList.remove('visible'); $('#fx-layer').innerHTML = '';
    $('#toast-stack').innerHTML = '';
    modalHistory=[];modalKind = ''; if (modal.open) modal.close(); hidePopover();
    intent = null; selectedUid = null; previewHidden = false; pendingKey = ''; resultShown = false; spectate.paused = false;
    const { mode, ...engineOptions } = options;
    engine = new window.DuelEngine(engineOptions); previewId = engine.deckInfo(0).ace;
    if (mode === 'spectate') engine.state.mode = 'spectate';
    if (instantOpening && !spectating() && engine.state.active === 1) {
      let steps = 0;
      while (engine.state.active === 1 && engine.state.winner === null && steps++ < 35 && !(engine.state.pending && engine.state.pending.responder === 0)) {
        const action = engine.aiNext(); if (!action || !engine.act(action).ok) break;
      }
    }
    bindEngine(); render(); saveGame(); scheduleAI();fate.reveal();
    if (!instantOpening) { sound.play('phase'); showToast(spectating() ? robotName(engine.state.active) + ' 先攻，观战开始。' : engine.state.active === 0 ? '决斗开始。你的先攻回合不能攻击。' : '决斗开始，对方先攻。'); }
  }
  const rpsHands = [['石头', '✊'], ['剪刀', '✌️'], ['布', '🖐️']];
  function playRps(callback) {
    let a, b, rounds = [];
    do { a = Math.floor(Math.random() * 3); b = Math.floor(Math.random() * 3); rounds.push([a, b]); } while (a === b && rounds.length < 12);
    const winner = a === b ? 0 : (a - b + 3) % 3 === 2 ? 0 : 1;
    const el = $('#cinematic'); clearTimeout(cinematicTimer); el.className = 'cinematic cinematic-rps';
    el.innerHTML = '<div class="cinematic-orbit"></div><div class="cinematic-content rps-stage"><div class="rps-side"><small>ROBOT A</small><b>' + rpsHands[a][1] + '</b><span>' + rpsHands[a][0] + '</span></div><div class="rps-vs"><small>' + (rounds.length > 1 ? '平局后重猜' : '猜拳') + '</small><h3>VS</h3><p>' + robotName(winner) + ' 先攻</p></div><div class="rps-side"><small>ROBOT B</small><b>' + rpsHands[b][1] + '</b><span>' + rpsHands[b][0] + '</span></div></div>';
    void el.offsetWidth; el.classList.add('visible'); sound.play('phase');
    cinematicTimer = setTimeout(() => { el.classList.remove('visible'); callback(winner); }, prefs.reducedMotion ? 700 : 1900);
  }
  function beginSpectate(options) { leaveTournamentView();if (modal.open) modal.close(); playRps(first => startGame({ ...options, mode: 'spectate', first, seed: Date.now() })); }

  function captureModal(){
    const events=['onclick','oninput','onchange','ondragover','ondragleave','ondrop','ondragstart','onkeydown'];
    return {kind:modalKind,nodes:[...modal.childNodes],className:modal.className,events:Object.fromEntries(events.map(key=>[key,modal[key]])),
      scrolls:[modal,...modal.querySelectorAll('*')].filter(el=>el.scrollTop||el.scrollLeft).map(el=>({el,top:el.scrollTop,left:el.scrollLeft})),
      focus:document.activeElement,selectionState,pendingKey,engine,pending:JSON.stringify(engine?.state.pending),audioScene,language:I.language,bodyTop:modal.querySelector('.modal-body')?.scrollTop||0,aiView:modalKind.startsWith('ai-')?aiImport.snapshot():null};
  }
  function backModal(){
    if(!modalHistory.length)return false;
    if(modalKind.startsWith('ai-'))aiImport.cancel();
    const saved=modalHistory.pop();
    if(saved.kind==='pending'&&(saved.engine!==engine||saved.pending!==JSON.stringify(engine?.state.pending))){dismissModal();scheduleAI();return true;}
    restoringModal=true;
    try{
      modalKind=saved.kind;selectionState=saved.selectionState;pendingKey=saved.pendingKey;audioScene=saved.audioScene;sound.setScene(audioScene);
      modal.className=saved.className;modal.replaceChildren(...saved.nodes);Object.assign(modal,saved.events);
      if(saved.kind.startsWith('ai-'))aiImport.resume(saved.kind,saved.aiView);
      else if(saved.language!==I.language){const refresh={library:showLibrary,workshop:()=>workshop.show(),settings:showSettings,help:showHelp,'new-game':renderNewGame,log:showLog,'chain-log':showChainLog};refresh[saved.kind]?.();}
      I.apply(modal);
      for(const s of saved.scrolls){s.el.scrollTop=s.top;s.el.scrollLeft=s.left;}
      if(modal.querySelector('.modal-body'))modal.querySelector('.modal-body').scrollTop=saved.bodyTop;
      if(saved.focus?.isConnected)saved.focus.focus({preventScroll:true});
      requestAnimationFrame(()=>{if(modal.open&&modalKind===saved.kind){for(const s of saved.scrolls){s.el.scrollTop=s.top;s.el.scrollLeft=s.left;}if(modal.querySelector('.modal-body'))modal.querySelector('.modal-body').scrollTop=saved.bodyTop;}});
    }finally{restoringModal=false;}
    return true;
  }
  function openModal(kind, title, kicker, body, footer = '', className = '') {
    if(kind==='pending')for(const a of engine.ruleActions?.(0)||[])footer='<button class="fate-rule-action" data-action="perform-rule" data-rule-key="'+a.key+'">'+escape(a.label)+'</button>'+footer;
    clearTimeout(aiTimer); hidePopover();
    if(!restoringModal){
      if(!modal.open||kind==='pending'||kind==='result')modalHistory=[];
      else if(modalKind!==kind){
        const ancestor=modalHistory.map(s=>s.kind).lastIndexOf(kind);
        if(ancestor>=0)modalHistory.length=ancestor;
        else if(modalKind&&modalKind!=='result'){modalHistory.push(captureModal());if(modalHistory.length>10)modalHistory.shift();}
      }
    }
    if(modalKind.startsWith('ai-')&&modalKind!==kind)aiImport.cancel();
    modalKind = kind;
    const scene={library:'library',workshop:'workshop',help:'help','new-game':'lobby'}[kind];if(scene){audioScene=scene;sound.setScene(scene);}
    if(currentScreen==='home')footer=footer.replace(/返回决斗/g,'返回主界面');
    if(modalHistory.length)footer=footer.replace(/返回决斗|返回主界面|返回战场/g,'返回上一页');
    modal.className = 'modal ' + className;
    modal.innerHTML = '<header class="modal-header"><div><div class="eyebrow">' + kicker + '</div><h2 id="modal-title">' + title + '</h2></div><div class="modal-tools">'+I.picker()+'<button class="modal-close" data-action="close-modal" aria-label="关闭窗口">' + icon('close') + '</button></div></header><div class="modal-body">' + body + '</div>' + (footer ? '<footer class="modal-footer">' + footer + '</footer>' : '');
    if (!modal.open) modal.showModal();
    if(modalHistory.length&&!modal.querySelector('[data-action="modal-back"]'))modal.querySelector('.modal-tools')?.insertAdjacentHTML('afterbegin','<button class="modal-back-button" data-action="modal-back" aria-label="'+escape(I.term('返回上一页'))+'">←</button>');
  }
  function dismissModal() {
    if(modalKind.startsWith('ai-'))aiImport.cancel();
    modalHistory=[];
    modalKind = ''; selectionState = null; responseUid = null; pendingKey = '';
    if (modal.open) modal.close();
  }
  function closeModal() {
    if(backModal())return;
    if(modalKind==='pending'&&engine.state.pending){
      peekPending();return;
    }
    dismissModal();sound.setScene(currentScreen==='duel'?'battle':'lobby');scheduleAI();if(engine.state.winner!==null&&!resultShown&&currentScreen==='duel')showResult();
  }
  function showLibrary() {
    const count=CARD_LIST.filter(c=>!c.notCollectible).length;
    openModal('library','每一张卡，都有它的灵魂。','THE CARD ARCHIVE · '+count+' CARDS','<div class="early-overview"><span><b>'+window.DuelData.earlyYears[0]+'—'+window.DuelData.earlyYears[window.DuelData.earlyYears.length-1]+'</b>卡片编年</span><span><b>'+CARD_LIST.filter(c=>c.early).length.toLocaleString('en-US')+'</b>年度快照卡片</span><span><b>'+count+'</b>总收录</span></div><div class="library-toolbar"><div class="library-filters">'+[['all','全部'],['monster','怪兽'],['spell','魔法'],['trap','陷阱'],['ritual','仪式'],['fusion','融合'],['synchro','同调'],['xyz','超量'],['link','连接'],['pendulum','灵摆']].map(([id,label])=>'<button class="filter-button'+(libraryFilter===id?' active':'')+'" data-action="library-filter" data-filter="'+id+'">'+label+'</button>').join('')+'</div><label class="search-box">'+icon('search')+'<input id="library-search" type="search" value="'+escape(libraryQuery)+'" placeholder="卡名、英文名、卡片编号或效果" aria-label="搜索卡牌"></label><select id="library-family" aria-label="筛选系列">'+Object.entries(window.DuelData.families).map(([id,label])=>'<option value="'+id+'"'+(libraryFamily===id?' selected':'')+'>'+label+'</option>').join('')+'</select></div><div class="archive-years"><label for="library-year">按首次发行年</label><select id="library-year" aria-label="筛选发行年份">'+View.yearOptions(libraryYear)+'</select><select id="library-status" aria-label="筛选实现状态">'+[['all','全部收录'],['ready','可用于决斗'],['pending','效果待落实']].map(([id,label])=>'<option value="'+id+'"'+(libraryStatus===id?' selected':'')+'>'+label+'</option>').join('')+'</select></div><div class="library-grid" id="library-grid"></div><div class="archive-pagination" id="library-pagination"></div><p class="library-count" id="library-count"></p>','<button class="secondary-button" data-action="close-modal">返回决斗</button><button class="primary-button" data-action="workshop">前往组卡工坊 '+icon('arrow')+'</button>','library-modal');renderLibraryResults();
  }
  function renderLibraryResults() {
    const size=prefs.libraryPageSize,query=libraryQuery.trim().normalize('NFKC').toLowerCase(),cards=CARD_LIST.filter(c=>!c.notCollectible&&View.yearMatch(c,libraryYear)&&(libraryStatus==='all'||(libraryStatus==='pending')===(c.implementationStatus==='pending'))&&(libraryFilter==='all'||libraryFilter==='monster'&&isMonster(c)||c.type===libraryFilter)&&(libraryFamily==='all'||isFamily(c,libraryFamily))&&(!query||I.searchText(c.id).includes(query))),pages=Math.max(1,Math.ceil(cards.length/size));libraryPage=Math.max(0,Math.min(libraryPage,pages-1));
    $('#library-grid').innerHTML=cards.length?cards.slice(libraryPage*size,libraryPage*size+size).map(c=>'<button class="library-card" data-action="card-detail" data-card-id="'+c.id+'" aria-label="查看'+escape(c.name)+'">'+cardHTML(c.id)+'<h3>'+escape(c.name)+'</h3><small>'+(c.releaseYear?c.releaseYear+' · ':'')+View.subtype(c)+(c.implementationStatus==='pending'?' · 效果待落实':'')+'</small></button>').join(''):'<div class="empty-state">没有找到这张卡，试试其他名称或年份。</div>';
    const pagination=$('#library-pagination');pagination.innerHTML='<label class="page-size-control">每页 <select id="library-page-size" aria-label="图鉴每页张数">'+Experience.PAGE_SIZES.map(n=>'<option value="'+n+'"'+(n===size?' selected':'')+'>'+n+' 张</option>').join('')+'</select></label><span class="page-range">'+(cards.length?libraryPage*size+1:0)+'—'+Math.min(cards.length,(libraryPage+1)*size)+' / '+cards.length+'</span><div class="page-navigation"><button data-action="library-page" data-delta="-1"'+(!libraryPage?' disabled':'')+' aria-label="上一页">←</button><label><input id="library-page-jump" type="number" min="1" max="'+pages+'" value="'+(libraryPage+1)+'" aria-label="跳转图鉴页码"> / '+pages+'</label><button data-action="library-page" data-delta="1"'+(libraryPage>=pages-1?' disabled':'')+' aria-label="下一页">→</button></div>';
    if(pagination.parentElement!==$('#modal .modal-footer'))$('#modal .modal-footer').prepend(pagination);
    $('#library-count').textContent=cards.length+' / '+CARD_LIST.filter(c=>!c.notCollectible).length+' 张卡片 · 卡图使用本地构建缓存，缺图仍可游玩';
    $$('.library-filters .filter-button').forEach(el=>el.classList.toggle('active',el.dataset.filter===libraryFilter));
  }
  function showCardDetail(id) {
    if(!CARDS[id])return;
    detailCardId=id;
    if(modalKind==='library')detailReturn=()=>showLibrary();
    else if(modalKind==='log')detailReturn=()=>showLog();
    else if(modalKind==='pile'&&pileContext){const ctx={...pileContext};detailReturn=()=>showPile(ctx.owner,ctx.kind,ctx.onlyType);}
    else if(modalKind==='deck'){const owner=deckOwner;detailReturn=()=>showDeck(owner);}
    else if(modalKind==='overlays'){const uid=overlayHostUid;detailReturn=()=>showOverlays(uid);}
    else if(modalKind==='lingering')detailReturn=()=>showLingering();
    else if(modalKind!=='detail')detailReturn=null;
    const instance=selectedUid&&engine.find(selectedUid)?.card.id===id?engine.find(selectedUid).card:null;
    openModal('detail','卡牌详情','THE HEART OF A CARD','<div class="card-detail-layout">'+cardHTML(id,instance)+'<div>'+detailsHTML(id,instance)+'<p class="card-detail-note">'+(isExtra(CARDS[id])?'额外怪兽需要满足相应召唤条件。':'卡片说明随显示语言切换，百科链接可查看来源资料。')+'</p>'+artCredit(id)+'</div></div>','<button class="secondary-button" data-action="detail-back">'+(detailReturn?'返回上一页':'浏览图鉴')+'</button><button class="primary-button" data-action="close-modal">返回决斗</button>','card-detail-modal');
  }
  function artCredit(id){const url=Art.full(id),page=Art.page(id),label=Art.kind(id)==='embedded'?'查看内嵌卡图':'查看在线卡图';return '<p class="art-credit" id="card-art-links">卡图：YGOPRODeck / Yu-Gi-Oh!'+(url?' · <a class="card-art-link" href="'+escape(url)+'" target="_blank" rel="noopener noreferrer">'+label+' ↗</a>':' · <span>原版图片尚未加载，备用卡面可正常使用。</span>')+(page?' · <a class="card-encyclopedia-link" href="'+escape(page)+'" target="_blank" rel="noopener noreferrer">查看卡片百科 ↗</a>':'')+'</p>';}
  function showDeck(owner=0) {
    if(engine.remote&&owner===1){openModal('deck','对手的卡组','PRIVATE DECK','<p class="modal-lead">对手的构筑在本局中保密。</p>','<button class="primary-button" data-action="close-modal">返回决斗</button>');return;}
    deckOwner=owner;
    const deck=I.deck(engine.deckInfo(owner));
    const grid=list=>{const counts=new Map();list.forEach(id=>counts.set(id,(counts.get(id)||0)+1));return '<div class="library-grid">'+[...counts].map(([id,n])=>'<button class="library-card" data-action="card-detail" data-card-id="'+id+'"><span class="deck-card-count">×'+n+'</span>'+cardHTML(id)+'<h3>'+escape(CARDS[id].name)+'</h3></button>').join('')+'</div>';};
    openModal('deck',deckNameHTML(deck),'DECK CONSTRUCTION','<p class="modal-lead">'+escape(deck.description)+'</p>'+(deck.combo?'<div class="deck-combo">'+deck.combo.map((c,i)=>'<p><b>0'+(i+1)+'</b>'+escape(c)+'</p>').join('')+'</div>':'')+'<p class="deck-list-heading">主卡组 / '+deck.cards.length+' 张</p>'+grid(deck.cards)+'<p class="deck-list-heading">额外卡组 / '+deck.extra.length+' 张</p>'+grid(deck.extra),'<button class="secondary-button" data-action="close-modal">返回决斗</button><button class="primary-button" data-action="edit-current-deck"'+(engine.remote?' hidden':'')+' data-owner="'+owner+'">以此卡组开始构筑</button>','library-modal');
  }
  function showPile(owner,kind,onlyType=null) {
    if(kind==='deck'){showDeck(owner);return;}
    const p=engine.state.players[owner],cards=[...(p[kind]||[])].filter(c=>!onlyType||CARDS[c.id]?.type===onlyType).reverse();pileContext={owner,kind,onlyType};
    const labels={grave:'墓地',extra:'额外卡组',banished:'除外区'};
    const body='<p class="modal-lead">'+(kind==='extra'?'同调、超量与Link在素材满足时可以召唤。Link需要共享额外区或箭头指向的主区；融合由相应效果发动，表侧灵摆通过灵摆召唤返回。':'点击卡片查看效果；可用的墓地或除外效果会显示在卡片下方。')+'</p><div class="pile-grid">'+(cards.length?cards.map(c=>{
      const hidden=!!c.hidden||owner===1&&kind==='extra'&&!c.faceUpExtra&&!spectating(),actions=hidden?[]:actionOptions(engine.find(c.uid)).actions;
      return '<article class="pile-entry">'+(hidden?'<div class="pile-hidden-card"><img src="'+ART['card-back']+'" alt="对方未公开的额外卡组卡片"></div><h3>未公开的卡片</h3>':'<button class="pile-view" data-action="card-detail" data-card-id="'+c.id+'">'+cardHTML(c.id)+'<h3>'+escape(CARDS[c.id].name)+'</h3></button>')+(c.faceUpExtra?'<small class="face-up-extra-label">表侧 · 灵摆回归</small>':'')+actions.map(a=>'<button class="pile-action" data-action="pile-command" data-uid="'+c.uid+'" data-command="'+a.command+'">'+escape(a.label)+'</button>').join('')+'</article>';
    }).join(''):'<div class="empty-state">这里暂时没有卡片。</div>')+'</div>';
    openModal('pile',(spectating()?escape(robotName(owner))+' 的':owner===0?'你的':'对方的')+labels[kind],'BEYOND THE FIELD',body,'<button class="primary-button" data-action="close-modal">返回决斗</button>','library-modal');
  }
  function showOverlays(uid) {
    const f=engine.find(uid);if(!f)return;
    overlayHostUid=uid;
    openModal('overlays','超量素材 · '+escape(CARDS[f.card.id].name),'OVERLAY NETWORK','<p class="modal-lead">这些卡叠放在超量怪兽下方。移除素材是相应效果的代价，不会把素材当作场上的卡。</p><div class="library-grid">'+(f.card.overlays||[]).map(c=>'<button class="library-card" data-action="card-detail" data-card-id="'+c.id+'">'+cardHTML(c.id)+'<h3>'+escape(CARDS[c.id].name)+'</h3></button>').join('')+'</div>','<button class="primary-button" data-action="close-modal">返回决斗</button>','library-modal');
  }
  function showExtraMenu() {showPile(0,'extra');}
  function showNewGame() {
    if(engine?.remote){showPvp();return;}
    const own=engine?.state.players[0].deckId,rival=engine?.state.players[1].deckId,list=DeckTools.list();
    setupOptions={deck:list.some(d=>d.id===own)?own:'hero',opponentDeck:list.some(d=>d.id===rival)?rival:'blackwing',first:0,difficulty:engine?.state.difficulty||'standard',mode:spectating()?'spectate':'duel',ruleMode:engine?.state.ruleMode?'random':'off'};renderNewGame();
  }
  let setupDeckIndex = new Map();
  const normalizeDeckQuery = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[·・—–_-]/g, ' ');
  function setupDeckMatches(deck, query) {
    const text = setupDeckIndex.get(deck.id) || '';
    return normalizeDeckQuery(query).trim().split(/\s+/).every(word => text.includes(word));
  }
  function setupSearchHTML(id, value, label) {
    return '<div class="setup-deck-search">'+icon('search')+'<input type="search" id="'+id+'" value="'+escape(value||'')+'" placeholder="名称、年份或卡名…" aria-label="'+label+'" autocomplete="off" spellcheck="false"><button type="button" data-action="clear-deck-search" data-input="'+id+'" aria-label="清空搜索"'+(value?'':' hidden')+'>'+icon('close')+'</button></div>';
  }
  function updateSetupSearchClear(id, visible) {
    const input=document.getElementById(id),button=input?.parentElement?.querySelector('[data-action="clear-deck-search"]');
    if(button)button.hidden=!visible;
  }
  function renderSetupRoster(resetScroll = false) {
    const node = $('#setup-deck-roster');if(!node)return;
    const list = DeckTools.list().map(d=>I.deck(d));
    const roster = list.filter(d=>(!setupOptions.year||setupOptions.year==='all'||d.year===Number(setupOptions.year))&&setupDeckMatches(d,setupOptions.query));
    const scroll = resetScroll ? 0 : node.scrollTop;
    node.innerHTML = roster.map((deck,i)=>'<button type="button" class="deck-roster-item'+(setupOptions.deck===deck.id?' active':'')+'" data-action="choose-deck" data-deck="'+escape(deck.id)+'" aria-pressed="'+(setupOptions.deck===deck.id)+'">'+Art.html(deck.ace,'roster-art')+'<span class="roster-index">'+String(i+1).padStart(2,'0')+'</span><span class="roster-copy"><strong>'+deckNameHTML(deck)+'</strong><small>'+escape(deck.en)+'</small></span><span class="mechanic-chip">'+escape(deck.mechanic)+'</span><span class="roster-check" aria-hidden="true">'+(setupOptions.deck===deck.id?'✓':'↗')+'</span></button>').join('') || '<div class="deck-search-empty">'+icon('search')+'<strong>没有匹配的卡组</strong><p>试试其他关键词，或清除筛选。</p><button type="button" class="text-button" data-action="reset-deck-filters">清除筛选</button></div>';
    node.scrollTop=scroll;
    $('#setup-year-count').textContent=roster.length+' / '+list.length;
    updateSetupSearchClear('setup-deck-search',!!setupOptions.query);
  }
  function updateSetupDeck() {
    $$('#setup-deck-roster [data-action="choose-deck"]').forEach(button=>{
      const active=button.dataset.deck===setupOptions.deck;
      button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
      button.querySelector('.roster-check').textContent=active?'✓':'↗';
    });
    const selected=DECKS[setupOptions.deck]||DECKS.hero,spec=setupOptions.mode==='spectate';
    $('#setup-deck-showcase').innerHTML='<div class="showcase-glow"></div><div class="showcase-card">'+cardHTML(selected.ace)+'</div><span class="showcase-kicker">'+(spec?'机器人 A · ':'')+escape(selected.mechanic)+' / '+selected.cards.length+' + '+selected.extra.length+'</span><h3>'+deckNameHTML(selected)+'</h3><p>'+escape(selected.description)+'</p><div class="showcase-combo"><small>FIRST COMBO · 展开思路</small><p>'+escape(selected.combo?.[0]||'')+'</p></div><button type="button" class="text-button" data-action="edit-setup-deck">编辑这副构筑 →</button>';
  }
  function renderSetupOpponent() {
    const select=$('#opponent-deck');if(!select)return;
    const list=DeckTools.list().map(d=>I.deck(d)),matches=list.filter(d=>setupDeckMatches(d,setupOptions.opponentQuery));
    const selected=list.find(d=>d.id===setupOptions.opponentDeck)||list[0];
    const option=d=>'<option'+(d.custom?' data-user-content':'')+' value="'+escape(d.id)+'">'+escape(d.name)+'</option>';
    const keepSelected=selected&&!matches.some(d=>d.id===selected.id);
    select.innerHTML=(keepSelected?'<optgroup label="当前选择">'+option(selected)+'</optgroup>':'')+(keepSelected&&matches.length?'<optgroup label="搜索结果">':'')+matches.map(option).join('')+(keepSelected&&matches.length?'</optgroup>':'');
    select.value=selected.id;
    $('#opponent-search-count').textContent=matches.length+' / '+list.length;
    $('#opponent-search-empty').hidden=matches.length>0;
    updateSetupSearchClear('opponent-deck-search',!!setupOptions.opponentQuery);
  }
  function updateSetupSegment(button, key, value) {
    setupOptions[key]=value;
    for(const sibling of button.parentElement.querySelectorAll('button')){
      const active=sibling===button;sibling.classList.toggle('active',active);sibling.setAttribute('aria-pressed',String(active));
    }
  }
  function renderNewGame() {
    const scrolls=modalKind==='new-game'?['#modal .modal-body','.deck-roster'].map(selector=>({selector,top:$(selector)?.scrollTop||0})):[];
    const list=DeckTools.list().map(d=>I.deck(d)),years=[...new Set(list.map(d=>d.year).filter(Boolean))].sort((a,b)=>a-b),spec=setupOptions.mode==='spectate';
    setupDeckIndex=new Map(list.map(deck=>[deck.id,normalizeDeckQuery([
      deck.name,deck.en,deck.mechanic,deck.year,window.DuelData.DECKS[deck.id]?.name,
      ...(window.DuelUITranslations.deckNames[deck.id]||[]),
      ...[...new Set([deck.ace,...deck.cards,...deck.extra])].map(id=>I.searchName(id))
    ].join(' '))]));
    const segment=(action,current,choices)=>'<div class="segmented-control">'+choices.map(([id,label])=>'<button type="button" class="'+(current===id?'active':'')+'" data-action="'+action+'" data-value="'+id+'" aria-pressed="'+(current===id)+'">'+label+'</button>').join('')+'</div>';
    const modeControl='<div class="setup-mode"><label class="setting-label">对战模式</label>'+segment('choose-mode',setupOptions.mode,[['duel','我 vs 机器人'],['spectate','机器人 vs 机器人'],['tournament','机器人淘汰赛'],['pvp','联机对战']])+(spec?'<p class="setup-mode-note">为机器人 A 和机器人 B 各选一副卡组。观战时双方手牌与盖牌全部公开，先后手由猜拳决定。</p>':'')+'</div>';
    const filters='<div class="setup-deck-heading"><label class="setting-label" for="setup-deck-search">'+(spec?'机器人 A 的卡组':'我的卡组')+'</label><span id="setup-year-count" class="setup-result-count" role="status" aria-live="polite"></span></div><div class="setup-deck-filters">'+setupSearchHTML('setup-deck-search',setupOptions.query,'搜索我的卡组')+'<select id="setup-year" aria-label="按年度选择预设"><option value="all">全部年代</option>'+years.map(y=>'<option value="'+y+'"'+(String(y)===String(setupOptions.year)?' selected':'')+'>'+y+'</option>').join('')+'</select></div>';
    const opponent='<div class="setup-opponent"><div class="setup-deck-heading"><label class="setting-label" for="opponent-deck">'+(spec?'机器人 B 的卡组':'对手卡组')+'</label><span id="opponent-search-count" class="setup-result-count" role="status" aria-live="polite"></span></div>'+setupSearchHTML('opponent-deck-search',setupOptions.opponentQuery,'搜索对手卡组')+'<select id="opponent-deck" aria-describedby="opponent-search-empty"></select><p id="opponent-search-empty" class="setup-search-note" hidden>没有匹配的卡组，当前选择已保留。</p></div>';
    openModal('new-game',spec?'让两位机器人一决高下。':'选择与你共鸣的力量。','ALL GENERATIONS · ONE DESTINY',
      '<div class="deck-select-intro"><p>跨越世代的决斗，从这里开始。<br><span>'+Object.values(DECKS).filter(d=>d.preset).length+'套预设，或一副亲手构筑的卡组。</span></p><button class="outline-button" data-action="workshop">＋ 组卡工坊</button></div>'+modeControl+fate.setup(setupOptions.ruleMode||'off')+
      '<div class="deck-select-layout"><section class="setup-deck-browser">'+filters+'<div class="deck-roster" id="setup-deck-roster"></div></section><aside class="selected-deck-showcase" id="setup-deck-showcase"></aside></div>'+
      '<div class="setup-options v2-setup">'+opponent+'<div><label class="setting-label">'+(spec?'机器人难度':'对手难度')+'</label>'+segment('choose-difficulty',setupOptions.difficulty,[['casual','休闲'],['standard','标准']])+'</div><div><label class="setting-label">出场顺序</label>'+(spec?'<p class="setup-order-note">✊ ✌️ 🖐️ 先后手由猜拳决定</p>':segment('choose-first',setupOptions.first,[[0,'我先攻'],[1,'我后攻']]))+'</div></div><p class="new-game-note">8000 LP · 随机起手 5 张 · 先攻首回合不抽卡、不攻击<br>开始新决斗会替换当前对局存档；保存的卡组与工坊草稿会保留。</p>',
      '<button class="secondary-button" data-action="close-modal">继续当前对局</button><button class="primary-button" data-action="begin-game">'+(spec?'开始观战 ':'开始决斗 ')+icon('arrow')+'</button>','new-game-modal v2-new-game');
    renderSetupRoster();updateSetupDeck();renderSetupOpponent();
    for(const saved of scrolls)if($(saved.selector))$(saved.selector).scrollTop=saved.top;
  }
  function showHelp() {
    if(I.language!=='zh-CN'){const guide=window.DuelUITranslations.help[I.language];openModal('help',guide.title,'THE DUELIST’S HANDBOOK',guide.body,'<button class="primary-button" data-action="close-modal">'+I.term('准备好了')+'</button>');return;}
    const rows=[['仪式召唤','仪式怪兽编入主卡组。发动对应仪式魔法，结算时选择手牌或场上的怪兽解放，等级合计达到要求且不能多解放无须使用的素材；仪式怪兽登场于主怪兽区。'],['通常召唤','每回合合计1次通常召唤或盖放。5—6星通常需1份祭品，7星以上2份；机壳等卡片有特别条件。'],['融合召唤','发动融合、奇迹融合、力量结合等效果。先选择融合怪兽，再按其名称、属性、种族要求选择素材。不同魔法使用的素材区域不同。'],['同调召唤','从「额外召唤」选择目标。表侧调整与非调整的等级合计必须精确等于同调怪兽等级，也须满足专用素材条件。白色卡面。'],['连接召唤','素材Link值必须精确满足目标。普通怪兽计1，Link怪兽计1或自身Link值，并满足最少素材数、属性与名称条件。只能表侧攻击，无等级、阶级与守备力。'],['箭头与区域','从额外连接召唤，须使用可用共享额外区或箭头指向的主区。计算的是素材离场后的箭头。两张Link互相指向才是互相连接；连通两个额外区的互相连接路径允许Extra Link。'],['珠泪送墓','珠泪人鱼被效果送墓才可发动融合。丢弃代价、连接／同调素材、移除素材与回合弃牌不算效果送墓。珠泪融合必须包含墓地触发卡；若该卡先被除外，融合不再进行。'],['超量召唤','同等级怪兽叠放，阶级与所需等级对应。素材保存在超量怪兽下方；发动相应效果时选择移除。升阶可以继承叠放素材。黑色卡面。'],['灵摆召唤','把灵摆卡放入最左和最右魔陷区作为刻度。每回合1次，同时特殊召唤等级严格介于两刻度之间的怪兽。手牌使用主怪兽区；表侧额外的灵摆只能使用可用的共享额外区或Link箭头指向的主区。'],['灵摆卡的去向','场上的灵摆卡将送墓时改为表侧额外卡组；从手牌丢弃或从超量素材移除则送墓。超量素材不视为场上的卡。'],['连锁与诱发','响应窗口可发动满足条件的快速效果、陷阱、反击陷阱。连锁从最后一环开始逆序结算。破坏效果来源并不自动无效该效果。多个同时诱发效果可以选择发动顺序。'],['艾克佐迪亚','手牌集齐被封印的五个不同部件，立即获得特殊胜利。场上、墓地、除外区中的部件不计入。']];
    openModal('help','从第一次召唤，到无限可能。','THE DUELIST’S HANDBOOK','<p class="modal-lead">把对方生命值降到0，或让对方在需要抽卡时无卡可抽即可获胜。初始8000 LP，双方各5张手牌，抽卡与准备阶段自动处理。</p><div class="help-steps"><div class="help-step">'+icon('card')+'<h3>01 · 阅读行动</h3><p>点击卡片，菜单显示当前合法操作。墓地与除外区的卡也可能有可发动效果。</p></div><div class="help-step">'+icon('spark')+'<h3>02 · 组合素材</h3><p>额外召唤列出当前可用怪兽，素材选择会实时校验等级与条件。</p></div><div class="help-step">'+icon('bolt')+'<h3>03 · 把握时机</h3><p>每次效果与战斗都可能产生响应。检查连锁，再决定发动或保留。</p></div></div><table class="rules-table"><thead><tr><th>机制</th><th>实际操作与规则</th></tr></thead><tbody>'+rows.map(([a,b])=>'<tr><td>'+a+'</td><td>'+b+'</td></tr>').join('')+'</tbody></table><div class="help-section"><h3>战斗与表示</h3><p>攻击对攻击：较低攻击力怪兽破坏，其控制者受到差值伤害。攻击对守备：攻击力超过守备力则守备怪兽破坏，通常不造成伤害；攻击力不足则攻击方受到差值伤害。特殊贯穿、多次攻击、伤害减免按卡片效果处理。</p><p>新召唤的怪兽可以攻击，但先攻第1回合不能进入战斗阶段。怪兽召唤当回合、攻击后不能主动变更表示。盖放的陷阱与速攻魔法当回合不能发动。回合结束手牌上限6张。</p></div><div class="help-section"><h3>自己的卡组，自己的命运</h3><p>「组卡工坊」可从预设复制或空白新建。主卡组40—60张，额外最多15张，主卡组与额外合计同名最多3张。卡片已全部解锁，衍生物不能编入。工坊草稿自动保存；合法卡组保存后会出现在决斗选择中。支持撤销、复制与JSON导入导出。</p></div><div class="help-section"><h3>本作的规则范围</h3><p>这是致敬高桥和希的独立同人实现，围绕所收录的'+CARD_LIST.filter(c=>!c.notCollectible).length+'张卡实现仪式、融合、同调、超量、灵摆、连接与相应连锁。场地具有两个共享额外怪兽区，可经互相连接构成Extra Link。不采用赛事禁限卡表。1999—2008按本地首次OCG日期快照收录；逐卡实现状态在图鉴中标注，待实现卡不会作为无效果卡混入决斗。本作文字与官方完整裁定仍可能有差异。</p><p>卡图优先使用构建时内嵌的本地图片。也可在设置中开启「在线原版卡图」，为无图版本或缺失图片联网补图；关闭在线卡图、图片失败或断网都不影响决斗。界面、卡名与说明可在中文、English、日本語之间切换，偏好会自动保存。</p></div><div class="help-section"><h3>快捷键</h3><p><kbd>Space</kbd> 下一阶段　<kbd>E</kbd> 结束回合　<kbd>1</kbd>—<kbd>9</kbd> 选择手牌<br><kbd>Esc</kbd> 关闭窗口 / 取消未提交选择　<kbd>M</kbd> 音效　<kbd>F</kbd> 全屏</p></div>','<button class="primary-button" data-action="close-modal">准备好了 '+icon('swords')+'</button>');
  }
  function showSettings() {
    const toggle = (key, title, description) => '<div class="setting-row"><div><h3>' + title + '</h3><p>' + description + '</p></div><button class="toggle-button' + (prefs[key] ? ' on' : '') + '" data-action="toggle-pref" data-pref="' + key + '" role="switch" aria-checked="' + !!prefs[key] + '" aria-label="' + title + '"></button></div>';
    openModal('settings', '你的决斗，随你设定。', 'PERSONAL SANCTUARY',
      '<div class="setting-row"><div><h3>AI 助手</h3></div><button class="outline-button" data-action="ai-settings">AI 助手 →</button></div><section class="reading-settings"><div><h3>阅读与显示</h3><p>字体独立缩放，战场保持一屏。</p></div><div class="font-setting"><label for="font-size-control">字体大小 <b id="font-size-label">'+prefs.fontScale+'%</b></label><input id="font-size-control" type="range" min="90" max="150" step="5" value="'+prefs.fontScale+'" aria-label="字体大小"><div class="font-presets">'+[[100,'标准'],[115,'舒适'],[130,'大字'],[150,'超大']].map(([n,label])=>'<button data-action="font-preset" data-value="'+n+'">'+label+'</button>').join('')+'</div></div><p class="font-preview">相信卡组，也相信每一次抉择。<small>调整后会自动保存，卡片效果与操作文字同步放大。</small></p></section><div class="setting-row"><div><h3>卡面样式</h3><p>经典卡框与全图展示，随时切换。</p></div><select id="card-style" aria-label="卡面样式"><option value="classic"'+(prefs.cardStyle!=='full-art'?' selected':'')+'>经典卡框</option><option value="full-art"'+(prefs.cardStyle==='full-art'?' selected':'')+'>全图卡面</option></select></div><div class="frame-samples">'+[['blue-eyes','通常'],['hero-stratos','效果'],['hero-sunrise','融合'],['stardust-dragon','同调'],['utopia','超量'],['qli-scout','灵摆'],['early-5405694','仪式'],['linkuriboh','Link'],['monster-reborn','魔法'],['mirror-force','陷阱']].filter(([id])=>CARDS[id]).map(([id,label])=>'<span>'+cardHTML(id)+'<small>'+label+'</small></span>').join('')+'</div>'+
      '<div class="setting-row"><div><h3>显示语言</h3><p>选择界面、卡名和卡片说明的语言。</p></div>'+I.picker()+'</div><div class="setting-row"><div><h3>显示卡图</h3><p>优先显示内嵌卡图，缺图时使用备用卡面。</p></div><button class="toggle-button' + (Art.status().enabled ? ' on' : '') + '" data-action="toggle-artwork" role="switch" aria-checked="' + Art.status().enabled + '" aria-label="显示卡图"></button></div><div class="setting-row"><div><h3>在线原版卡图</h3><p>缺少内嵌图片时联网加载原版卡图。关闭后仍可离线决斗。</p></div><button class="toggle-button'+(Art.status().onlineEnabled?' on':'')+'" data-action="toggle-online-artwork" role="switch" aria-checked="'+Art.status().onlineEnabled+'" aria-label="在线原版卡图"></button></div><div class="setting-row"><p>'+I.term('本地原版卡图')+' · '+Art.status().embedded+'</p><button class="text-button" data-action="retry-artwork">刷新卡图</button></div>' +
      toggle('sound', '决斗音效', '抽卡、召唤与战斗的声音。') +
      '<div class="setting-row"><div><h3>音量 <span id="volume-label" style="color:#839a76;font-size:10px">' + Math.round(prefs.volume * 100) + '%</span></h3><p>一点声音，让决斗更有温度。</p></div><input class="volume-control" id="volume-control" type="range" min="0" max="100" value="' + Math.round(prefs.volume * 100) + '" aria-label="音量"></div>' +
      toggle('music', '动画原声配乐', '随场景切换；战斗曲目轮流随机，不连续重复。') +
      '<div class="setting-row"><div><h3>配乐音量 <span id="music-volume-label">'+Math.round(prefs.musicVolume*100)+'%</span></h3><p>与召唤、攻击等音效分别调整。</p></div><input class="volume-control" id="music-volume-control" type="range" min="0" max="100" value="'+Math.round(prefs.musicVolume*100)+'" aria-label="配乐音量"></div><details class="music-library" id="music-library"><summary>原声曲目 · '+sound.tracks.length+' 首</summary><div>'+sound.tracks.map(track=>'<div><span><small>'+({lobby:'战斗前',battle:'决斗中',library:'卡牌图鉴',workshop:'卡组工坊',help:'玩法指南'}[track.scene])+'</small><b data-i18n-skip>'+escape(track.title)+'</b></span><em>'+(track.src?'已就绪':'音源缺失')+'</em></div>').join('')+'</div></details>'+
      toggle('reducedMotion', '减少动态效果', '关闭粒子、震动和过渡动画。') +
      '<div class="setting-row"><div><h3>对手行动速度</h3><p>选择适合自己的决斗节奏。</p></div><div class="segmented-control">' + [['normal', '沉浸'], ['fast', '快速']].map(([id, label]) => '<button class="' + (prefs.speed === id ? 'active' : '') + '" data-action="set-speed" data-value="' + id + '">' + label + '</button>').join('') + '</div></div>' +
      '<div class="settings-record"><div><b>' + stats.games + '</b><small>完成对局</small></div><div><b>' + stats.wins + '</b><small>取得胜利</small></div><div><b>' + (stats.games ? Math.round(stats.wins / stats.games * 100) : 0) + '%</b><small>决斗胜率</small></div></div>'+
      '<section class="project-credit"><h3>项目与署名</h3><p><strong data-i18n-skip>不锈钢琴</strong></p><a href="https://github.com/253506088/yugioh-h5-public" target="_blank" rel="noopener noreferrer" data-i18n-skip>https://github.com/253506088/yugioh-h5-public</a></section>',
      '<button class="primary-button" data-action="close-modal">保存并返回</button>');
  }
  function openTargetSelection() { showPending(); }
  function renderSelection() { showPending(true); }
  function selectionOwner(candidate, pending=engine.state.pending) {
    const owner=engine.find(candidate.uid)?.owner??candidate.owner??(pending?.kind==='order'?pending.owner:null);
    return owner===0||owner===1?owner:null;
  }
  function selectionZone(candidate) {
    const zone=engine.find(candidate.uid)?.zone||candidate.zone;
    return I.term(({hand:'手牌',deck:'卡组',grave:'墓地',extra:'额外卡组',monsters:'场上',extraMonster:'额外怪兽区',overlays:'超量素材',banished:'除外区',spells:'魔陷区',fieldSpell:'场地区'})[zone]||zone||'');
  }
  function selectionOwnerHTML(owner) {
    return owner===null?'':'<span class="selection-owner" data-selection-owner="'+owner+'">'+I.term(owner===0?'我方':'对方')+'</span>';
  }
  function selectionGridHTML(candidates, pending) {
    return [1,0,null].map(owner=>{
      const group=candidates.filter(c=>selectionOwner(c,pending)===owner);if(!group.length)return '';
      const heading=owner===null?'':'<div class="selection-side-heading" data-selection-side="'+owner+'" role="heading" aria-level="3"><strong>'+I.term(owner===0?'我方卡片':'对方卡片')+'</strong><span class="selection-side-count">'+group.length+'</span></div>';
      return heading+group.map(c=>{
        const label=c.label||CARDS[c.cardId]?.name||c.uid,zone=selectionZone(c);
        const description=[owner===null?'':I.term(owner===0?'我方':'对方'),zone,label].filter(Boolean).join(' · ');
        return '<button type="button" class="selection-card'+(!c.cardId&&!c.hidden?' text-selection':'')+'" data-action="pending-pick" data-uid="'+escape(c.uid)+'"'+(owner===null?'':' data-selection-owner="'+owner+'"')+' aria-label="'+escape(description)+'" aria-pressed="false">'+selectionOwnerHTML(owner)+(c.hidden?'<img class="selection-back" src="'+ART['card-back']+'" alt="未公开的卡片">':c.cardId?cardHTML(c.cardId,engine.find(c.uid)?.card):'<span class="text-option-symbol">'+(c.uid==='cancel'?'↶':c.uid==='direct'?'⚔':'◇')+'</span>')+'<b class="pick-number"></b><small>'+escape(label)+'</small><span>'+escape([zone,c.detail].filter(Boolean).join(' · '))+'</span>'+(c.mandatory?'<em class="mandatory-badge">'+(pending.kind==='order'?'强制':'必选')+'</em>':'')+'</button>';
      }).join('');
    }).join('');
  }
  function renderPickInspector(candidate, materialNote='') {
    const inspector=$('#pick-inspector');if(!inspector)return;
    let html='<span>点选卡牌，查看效果与选择顺序。</span>';
    if(candidate){
      const c=I.option(candidate,engine.state.pending,engine),owner=selectionOwner(c),zone=selectionZone(c);
      html='<div class="pick-inspector-context">'+selectionOwnerHTML(owner)+'<small>'+escape(zone)+'</small></div>';
      html+=!c.hidden&&c.cardId?detailsHTML(c.cardId,engine.find(c.uid)?.card):'<strong class="pick-hidden-name">'+escape(c.label)+'</strong><p>'+escape(c.detail||'')+'</p>';
    }
    inspector.innerHTML=html+(materialNote?'<p class="level-equation">'+escape(materialNote)+'</p>':'');
  }
  function showPending(force=false) {
    const p=engine.state.pending;if(!p||p.responder!==0||engine.state.winner!==null||modal.open&&modalKind!=='pending'||chainDirector.busy)return;
    if(peekState&&!force){renderPeekBar();return;}
    const key=JSON.stringify(p);if(!force&&pendingKey===key&&modal.open)return;
    pendingKey=key;selectionState={selected:[],response:null,position:p.action?.position||'attack',zone:null};
    const candidates=(p.candidates||p.group?.candidates||[]).map(c=>I.option(c,p,engine)),isResponse=['window','trigger'].includes(p.kind);
    if(candidates.length>80)for(const c of candidates){c.cardId=null;c.hidden=false;}
    const trigger=p.trigger,options=p.kind==='window'?p.options:p.kind==='trigger'?[{uid:trigger.uid,key:trigger.key,label:I.effectLabel(window.DuelEffects.get(trigger.key)),cardId:trigger.sourceId}]:[];
    const situation=Experience.responseSummary(engine,p),chain=engine.state.chain,sourceId=p.ctx?.sourceId||trigger?.sourceId||engine.find(p.uid)?.card.id||situation.cardId;
    const chainHTML=chain.length?'<div class="pending-chain"><small>CHAIN · '+chain.map(l=>l.chainNumber).reverse().join(' → ')+' · 后发动先结算</small>'+chain.map(l=>'<span class="chain-owner-'+l.owner+'"><b>'+String(l.chainNumber).padStart(2,'0')+'</b><strong>'+(l.owner===0?'我方':'对方')+'</strong>'+escape(CARDS[l.sourceId].name)+'<em>'+escape(I.effectLabel(window.DuelEffects.get(l.key))||'')+'</em></span>').join('')+'</div>':'';
    const min=p.min??p.group?.min??1,max=p.max??p.group?.max??1;
    const notice=p.kind==='order'?'依次点选想发动的效果，序号就是连锁顺序；后选择的效果先结算。必须包含标注为「强制」的效果。':p.purpose==='pendulum'?'手牌使用主怪兽区；表侧额外的灵摆需要共享额外区或Link箭头指向的主区，且等级位于两刻度之间。':['extra','link-effect'].includes(p.purpose)?'选择素材，再选择合法召唤区域。Link怪兽作为素材可计为1或自身Link值，合计须精确等于目标Link值。' :p.kind==='discard'?'手牌上限为6张。请选择需要送墓的卡片。':p.kind==='window'?'选择效果连锁，或跳过本次响应。':p.kind==='trigger'?'满足了诱发条件。可以发动这个效果，也可以保留。':p.cancelable?'先选择代价或目标，再确认发动。':'效果正在结算中，请完成这一步选择。';
    const back=(CARDS[sourceId]?'<div class="pending-source">'+Art.html(sourceId,'pending-source-art')+'<div><small>'+escape(isResponse?situation.label:'EFFECT PROCESS')+(situation.number?' · CHAIN '+situation.number:'')+'</small><h3>'+escape(CARDS[sourceId].name)+'</h3>'+(!isResponse?'<p>'+escape(I.effectLabel(window.DuelEffects.get(p.ctx?.key||trigger?.key)))+'</p>':'')+'</div></div>':'')+(isResponse?'<div class="response-context"><p>'+escape(situation.label)+' · '+escape(situation.text||'')+'</p>'+(situation.detail?'<p class="response-action-detail">'+escape(situation.detail)+'</p>':'')+(situation.targets.length?'<p class="response-target-list">目标：'+situation.targets.map(x=>escape(x.label)).join('、')+'</p>':'')+(sourceId?'<details><summary>查看发动卡片的效果</summary><p>'+escape(CARDS[sourceId]?.description||'')+'</p></details>':'')+'<small>战局已暂停，查看后再决定。</small></div>':'');
    const body=back+chainHTML+'<p class="modal-lead">'+notice+'</p>'+(isResponse?'<div class="response-options">'+options.map((o,i)=>{const id=o.cardId||engine.find(o.uid)?.card.id;return '<button class="response-option" data-action="pending-response" data-index="'+i+'">'+(id?Art.html(id,'response-art'):'')+'<span><strong>'+escape(I.effectLabel(window.DuelEffects.get(o.key))||o.label||I.effectLabel(window.DuelEffects.get(o.key))||CARDS[id]?.name)+'</strong><small>'+escape(CARDS[id]?.description||'')+'</small></span><b>↗</b></button>';}).join('')+'</div>':'<div class="pending-selection-layout"><div><div class="selection-grid">'+selectionGridHTML(candidates,p)+'</div>'+(p.sets?.length?'<div class="material-presets"><small>合法组合 · 共 '+p.sets.length+' 种</small>'+p.sets.slice(0,16).map((set,i)=>'<button data-action="pending-combo" data-index="'+i+'">'+set.map(uid=>{const c=candidates.find(c=>c.uid===uid);return escape(c?.label||uid);}).join(' ＋ ')+'</button>').join('')+'</div>':'')+'</div><aside class="pick-inspector" id="pick-inspector"><span>点选卡牌，查看效果与选择顺序。</span></aside></div>')+'<p class="pick-feedback" id="pick-feedback" role="status">'+(isResponse?'请选择要发动的效果。':'需选 '+min+(min===max?'':'—'+max)+' 项 · 已选 0')+'</p>';
    const canPass=isResponse&&!trigger?.mandatory;
    openModal('pending',escape(I.pendingTitle(p,engine)),isResponse?'YOUR RESPONSE · 把握这一刻':'YOUR CHOICE · 每次选择都算数',body,'<button class="peek-field-button" data-action="pending-peek">'+icon('eye')+'查看战局</button>'+(canPass?'<button class="secondary-button" data-action="pending-pass">'+(p.kind==='window'?'本次不连锁':'不发动')+'</button>':p.cancelable?'<button class="secondary-button" data-action="pending-cancel">取消选择</button>':'')+'<button class="primary-button" id="pending-confirm" data-action="pending-confirm" disabled>'+(isResponse?'发动效果':p.kind==='order'?'确认连锁顺序':p.kind==='materials'?'确认素材并召唤':'确认选择')+' '+icon('spark')+'</button>','selection-modal modern-pending');
    if(candidates.length>30)$('#modal .selection-grid')?.insertAdjacentHTML('beforebegin','<input type="search" id="pending-search" class="selection-search" placeholder="搜索候选卡名…" aria-label="搜索当前候选卡片">');
    if(p.kind==='materials'&&['extra','fusion','ritual','pendulum','link-effect'].includes(p.purpose)){
      const isLink=CARDS[engine.find(p.uid)?.card.id]?.type==='link';
      $('#pick-feedback').insertAdjacentHTML('beforebegin','<div class="summon-position-choice"><span>出场表示</span>'+(isLink?'<b class="link-only-position">LINK · 仅表侧攻击</b>':'<div class="segmented-control"><button class="active" data-action="summon-position" data-position="attack">表侧攻击</button><button data-action="summon-position" data-position="defense">表侧守备</button></div>')+'</div>'+(['extra','fusion','ritual','link-effect'].includes(p.purpose)?'<div class="summon-zone-picker" id="summon-zone-picker"></div>':''));
      if(p.purpose==='ritual')$('#pick-feedback').insertAdjacentHTML('beforebegin','<p class="tear-material-note">选择手牌或场上的怪兽作为解放素材。等级合计须达到目标等级，不能额外解放已不需要的素材。仪式怪兽登场于主怪兽区。</p>');
      if(p.spellId?.requiredUid){const card=engine.find(p.spellId.requiredUid)?.card;$('#pick-feedback').insertAdjacentHTML('beforebegin','<p class="tear-material-note">必须包含墓地的「'+escape(CARDS[card?.id]?.name||'触发卡片')+'」。素材按点选顺序放回卡组底部。</p>');}
    }
    if(p.kind==='trigger'){selectionState.response=options[0];$('.response-option')?.classList.add('chosen');$('#pending-confirm').disabled=false;}
    if(!isResponse)updatePicks();
  }
  function updatePicks() {
    const p=engine.state.pending;if(!p||!selectionState)return;
    const selected=selectionState.selected,valid=engine.validatePick(p,selected);
    $$('.selection-card[data-action="pending-pick"]').forEach(el=>{const i=selected.indexOf(el.dataset.uid);el.classList.toggle('chosen',i>=0);el.setAttribute('aria-pressed',String(i>=0));el.querySelector('.pick-number').textContent=i>=0?i+1:'';});
    $('#pending-confirm').disabled=!valid.valid;$('#pick-feedback').textContent='已选 '+selected.length+' 项 · '+(valid.valid?'选择合法，可以确认':valid.message);$('#pick-feedback').classList.toggle('valid',valid.valid);
    const candidates=p.candidates||p.group?.candidates||[],last=candidates.find(c=>c.uid===selected.at(-1)),extra=engine.find(p.uid)?.card,target=CARDS[extra?.id],materials=selected.map(uid=>engine.find(uid)?.card).filter(Boolean);let materialNote='';
    if(['extra','link-effect'].includes(p.purpose)){
      if(target?.type==='link')materialNote='素材可计值：'+materials.map(c=>CARDS[c.id].type==='link'?'(1 / '+CARDS[c.id].linkRating+')':'1').join(' ＋ ')+' → LINK-'+target.linkRating;
      else materialNote=target?.type==='synchro'?'等级合计 '+materials.reduce((n,c)=>n+engine.level(c),0)+' → 目标 '+target.level+' 星':materials.length===1&&CARDS[materials[0].id].type==='xyz'?'叠放升阶 · 继承已有素材':materials.map(c=>'LV '+engine.level(c)).join(' ＋ ')+' → RANK '+(target?.rank||'');
    }
    if(p.purpose==='ritual')materialNote='解放等级合计 '+materials.reduce((n,c)=>n+engine.level(c),0)+' / 仪式魔法要求 '+engine.ritualRequirement(p.spellId,extra)+' 星';
    renderPickInspector(last,materialNote);
    const picker=$('#summon-zone-picker');if(picker){const zones=valid.valid&&extra?engine.freeZones(p.owner,extra,{materials:selected}):[];if(!zones.includes(selectionState.zone))selectionState.zone=zones[0]??null;picker.innerHTML='<span>召唤区域</span><div>'+ (zones.length?zones.map(z=>'<button data-action="summon-zone" data-zone="'+z+'" class="'+(selectionState.zone===z?'active':'')+'">'+zoneName(p.owner,z)+'</button>').join(''):'<small>选择合法素材后显示可用区域</small>')+'</div>';}
  }
  function zoneName(owner,zone) {return typeof zone==='number'?'主怪兽区 '+(zone+1):'共享额外区 '+(engine.extraSlot(owner,zone)===0?'Ⅰ':'Ⅱ');}
  function choosePending(uid) {
    const p=engine.state.pending;if(!p||!selectionState)return;
    const candidates=p.candidates||p.group?.candidates||[];if(!candidates.some(c=>c.uid===uid))return;
    const max=p.max??p.group?.max??1,selected=selectionState.selected;
    if(max===0){renderPickInspector(candidates.find(c=>c.uid===uid));return;}
    if(selected.includes(uid))selectionState.selected=selected.filter(x=>x!==uid);else if(max===1)selectionState.selected=[uid];else if(selected.length<max)selected.push(uid);else{showToast('已选满，先取消一项即可更换。');return;}updatePicks();
  }
  function filterPending(query) {
    const q=query.trim().normalize('NFKC').toLowerCase(),p=engine.state.pending;
    const candidates=p?.candidates||p?.group?.candidates||[];
    for(const el of $$('#modal .selection-card')){
      const option=candidates.find(c=>c.uid===el.dataset.uid);
      const searchable=option?.cardId&&!option.hidden?I.searchName(option.cardId):el.textContent.normalize('NFKC').toLowerCase();
      el.hidden=!searchable.includes(q);
    }
    for(const heading of $$('#modal .selection-side-heading')){
      const count=$$('#modal .selection-card[data-selection-owner="'+heading.dataset.selectionSide+'"]').filter(el=>!el.hidden).length;
      heading.hidden=count===0;heading.querySelector('.selection-side-count').textContent=count;
    }
  }
  function showLog() {
    journal.show();
  }
  function finishGame() {
    if(tournamentView)return;
    const id = String(engine.state.startedAt) + '-' + engine.state.players[0].deckId;
    if (!engine.remote && !spectating() && stats.lastGame !== id) {
      stats.games++; stats.wins += engine.state.winner === 0 ? 1 : 0; stats.bestDamage = Math.max(stats.bestDamage, engine.state.damage[0]); stats.lastGame = id;
      writeStorage('duel-sanctuary-stats-v1', stats);
    }
    const token = aiEpoch;
    animationTimers.push(setTimeout(() => { if (token === aiEpoch && !modal.open && !resultShown&&!chainDirector.busy&&currentScreen==='duel') showResult(); }, prefs.reducedMotion ? 100 : engine.state.winKind === 'exodia' ? 3400 : 1400));
  }
  function showSpectateResult() {
    const s = engine.state, draw = s.winner === 'draw', winner = draw ? null : s.winner;
    modal.className = 'modal';
    modal.innerHTML = '<div class="duel-result result-spectate"><div class="result-emblem">' + icon('eye') + '</div><div class="result-en">' + (draw ? 'DRAW' : winner === 0 ? 'ROBOT A WINS' : 'ROBOT B WINS') + '</div><h2 id="modal-title">' + (draw ? '决斗平局' : robotName(winner) + ' 获胜') + '</h2><p class="result-sub">' + (draw ? '双方在同一时刻迎来结局。' : escape(I.deck(engine.deckInfo(winner)).name) + ' 赢下了这场机器人对决。') + '</p>' + outcomePanel(s) + '<div class="result-stats"><div><b>' + s.turn + '</b><small>决斗回合</small></div><div><b>' + s.damage[0].toLocaleString('en-US') + '</b><small>A 造成伤害</small></div><div><b>' + s.damage[1].toLocaleString('en-US') + '</b><small>B 造成伤害</small></div></div><div class="result-actions"><button class="primary-button" data-action="rematch">' + icon('refresh') + '再来一场</button><button class="secondary-button" data-action="new-game">更换机器人</button></div><button class="result-close" data-action="close-modal">回到战场，查看记录</button></div>';
    modal.insertAdjacentHTML('afterbegin','<div class="result-tools">'+I.picker()+'</div>');
    if (!modal.open) modal.showModal();
  }
  function outcomePanel(state){
    const outcome=window.DuelOutcome.read(state);if(!outcome)return '';
    const options={language:I.language,names:[I.player(0,engine),I.player(1,engine)],cardName:I.name};
    return '<div class="result-cause" role="status" data-outcome-kind="'+escape(outcome.kind)+'"><strong>'+escape(window.DuelOutcome.label(outcome,I.language))+'</strong><p>'+escape(window.DuelOutcome.describe(outcome,options))+'</p></div>';
  }
  function showResult() {
    if(tournamentView)return;
    if (engine.state.winner === null) return;
    clearTimeout(aiTimer); hidePopover(); resultShown = true; modalHistory=[];modalKind = 'result';
    if(engine.remote){pvp?.showResult();return;}
    if (spectating()) { showSpectateResult(); return; }
    const win = engine.state.winner === 0, draw = engine.state.winner === 'draw';
    modal.className = 'modal';
    modal.innerHTML = '<div class="duel-result' + (win ? '' : ' result-defeat') + '"><div class="result-emblem">' + icon(win ? 'eye' : 'shield') + '</div><div class="result-en">' + (win ? 'VICTORY IS YOURS' : 'THE DUEL GOES ON') + '</div><h2 id="modal-title">' + (draw ? '决斗平局' : win ? '决斗胜利' : '未完的决斗') + '</h2><p class="result-sub">' + (draw ? '双方在同一时刻迎来结局。' : win ? '你与卡组的羁绊，回应了这场决斗。' : '命运不会止步于这一局。<br>下一次抽卡，也许就是转机。') + '</p>' + outcomePanel(engine.state) + '<div class="result-stats"><div><b>' + engine.state.turn + '</b><small>决斗回合</small></div><div><b>' + engine.state.damage[0].toLocaleString('en-US') + '</b><small>造成伤害</small></div><div><b>' + engine.state.summons[0] + '</b><small>召唤次数</small></div></div><div class="result-actions"><button class="primary-button" data-action="rematch">' + icon('refresh') + '再来一场</button><button class="secondary-button" data-action="new-game">更换卡组</button></div><button class="result-close" data-action="close-modal">回到战场，查看记录</button></div>';
    modal.insertAdjacentHTML('afterbegin','<div class="result-tools">'+I.picker()+'</div>');
    if (!modal.open) modal.showModal();
  }

  function floatingNumber(owner, amount, heal = false) {
    if (prefs.reducedMotion) return;
    const el = document.createElement('div'), point = positionCache.get('lp-' + owner);
    if (!point) return;
    el.className = 'damage-float' + (heal ? ' heal' : ''); el.textContent = (heal ? '+' : '−') + amount.toLocaleString('en-US');
    el.style.left = point.x + 'px'; el.style.top = point.y + 'px'; $('#fx-layer').append(el);
    setTimeout(() => el.remove(), 1600);
  }
  function burstAt(point) {
    if (!point || prefs.reducedMotion) return;
    const ring = document.createElement('span'); ring.className = 'impact-ring'; ring.style.left = point.x + 'px'; ring.style.top = point.y + 'px'; $('#fx-layer').append(ring); setTimeout(() => ring.remove(), 650);
    for (let i = 0; i < 15; i++) {
      const particle = document.createElement('span'), angle = Math.PI * 2 * i / 15, distance = 25 + Math.random() * 50;
      particle.className = 'particle'; particle.style.left = point.x + 'px'; particle.style.top = point.y + 'px';
      particle.style.setProperty('--dx', Math.cos(angle) * distance + 'px'); particle.style.setProperty('--dy', Math.sin(angle) * distance + 'px');
      $('#fx-layer').append(particle); setTimeout(() => particle.remove(), 1100);
    }
  }
  function attackAnimation(event) {
    if (prefs.reducedMotion) return;
    const from = positionCache.get(event.uid), to = positionCache.get(event.target || 'lp-' + (1 - event.owner));
    if (!from || !to) return;
    const ray = document.createElement('div'), distance = Math.hypot(to.x - from.x, to.y - from.y), angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
    ray.className = 'battle-ray'; ray.style.left = from.x + 'px'; ray.style.top = from.y + 'px'; ray.style.width = distance + 'px'; ray.style.transform = 'rotate(' + angle + 'deg)';
    $('#fx-layer').append(ray); setTimeout(() => { burstAt(to); }, 210); setTimeout(() => ray.remove(), 650);
  }
  function announce(cardId,type) {
    if(prefs.reducedMotion||!CARDS[cardId])return;
    const c=CARDS[cardId],el=$('#cinematic'),titles={link:'LINK SUMMON',fusion:'FUSION SUMMON',synchro:'SYNCHRO SUMMON',xyz:'XYZ SUMMON',pendulum:'PENDULUM SUMMON',trap:'CHAIN · TRAP ACTIVATED',exodia:'EXODIA · THE FORBIDDEN ONE'};
    clearTimeout(cinematicTimer);el.className='cinematic cinematic-'+type;
    el.innerHTML='<div class="cinematic-orbit"></div><div class="cinematic-content">'+Art.html(cardId,'cinematic-art')+'<div><small>'+(titles[type]||titles[c.type]||'SPECIAL SUMMON')+'</small><h3>'+escape(c.name)+'</h3><p>'+(type==='exodia'?'五个部件已集齐 · 被封印的力量觉醒':isMonster(c)?'ATK '+c.atk+'　/　DEF '+c.def:'连锁，从这一刻逆转')+'</p></div></div>';void el.offsetWidth;el.classList.add('visible');cinematicTimer=setTimeout(()=>el.classList.remove('visible'),type==='exodia'?3200:1700);
  }
  function playEvents(events) {
    let playedDamage = false;
    for (const event of events) {
      if (event.kind === 'attack' && engine.state.pending?.kind === 'attack') sound.play('phase');
      if (event.kind === 'battle') { sound.play('attack'); attackAnimation(event); }
      if (event.kind === 'damage') {
        floatingNumber(event.owner, event.amount);
        if (!playedDamage) { sound.play('damage'); playedDamage = true; }
        if (!prefs.reducedMotion) { $('#arena').classList.remove('shaking'); void $('#arena').offsetWidth; $('#arena').classList.add('shaking'); setTimeout(() => $('#arena').classList.remove('shaking'), 420); }
      }
      if (event.kind === 'heal') { floatingNumber(event.owner, event.amount, true); sound.play('spell'); }
      if (['summon','special','synchro','xyz','link','pendulum','fusion'].includes(event.kind)) {
        sound.play(event.kind === 'summon' ? 'summon' : 'special');
        const el = $('[data-card-uid="' + event.uid + '"]'); if (el) el.classList.add('just-summoned');
        if (event.cardId && event.kind !== 'summon') announce(event.cardId, event.kind);
      }
      if (event.kind === 'set') sound.play('card');
      if (event.kind === 'spell') sound.play('spell');
      if (event.kind === 'trap') { sound.play('trap'); if(!chainDirector.busy)announce(event.cardId, 'trap'); }
      if (event.kind === 'draw') sound.play('draw');
      if (event.kind === 'phase') sound.play('phase');
      if (event.kind === 'turn' && event.owner === 0) {
        sound.play('phase');
        if (!prefs.reducedMotion && !spectating()) { const banner = $('#turn-sweep'); banner.classList.remove('playing'); void banner.offsetWidth; banner.classList.add('playing'); setTimeout(() => banner.classList.remove('playing'), 1900); }
      }
      if (event.kind === 'victory') { sound.play(event.owner === 0 || spectating() ? 'victory' : 'defeat'); if (engine.state.winKind === 'exodia') announce('exodia-head', 'exodia'); }
    }
  }
  function setupAmbient() {
    const canvas = $('#ambient'), context = canvas.getContext('2d');
    if (!context) return;
    const stars = Array.from({ length: 46 }, () => ({ x: Math.random(), y: Math.random(), radius: Math.random() * 1.1 + .2, speed: Math.random() * .000015 + .000004, phase: Math.random() * Math.PI * 2 }));
    let width = innerWidth, height = innerHeight, last = 0, lastDraw = 0;
    const resize = () => { width = innerWidth; height = innerHeight; const ratio = Math.min(devicePixelRatio || 1, 1.5); canvas.width = width * ratio; canvas.height = height * ratio; context.setTransform(ratio, 0, 0, ratio, 0, 0); };
    resize(); window.addEventListener('resize', resize, { passive: true });
    function frame(time) {
      requestAnimationFrame(frame);
      if (prefs.reducedMotion || document.hidden || time - lastDraw < 40) { last = time; return; }
      const dt = Math.min(64, time - (last || time)); last = time; lastDraw = time;
      context.clearRect(0, 0, width, height);
      for (const star of stars) {
        star.y -= star.speed * dt;
        if (star.y < -.02) { star.y = 1.02; star.x = Math.random(); }
        const alpha = .15 + (Math.sin(time / 2100 + star.phase) + 1) * .16;
        context.fillStyle = 'rgba(198,188,130,' + alpha.toFixed(3) + ')'; context.beginPath(); context.arc(star.x * width + Math.sin(time / 5000 + star.phase) * 12, star.y * height, star.radius, 0, Math.PI * 2); context.fill();
      }
    }
    requestAnimationFrame(frame);
  }
  function updateSoundButton() {
    const button = $('#sound-button'); button.innerHTML = icon(prefs.sound ? 'volume' : 'mute');
    button.title = (prefs.sound ? '关闭音效' : '开启音效') + '（M）'; button.setAttribute('aria-label', button.title); button.setAttribute('aria-pressed', String(!!prefs.sound));
  }
  function updatePrefs() {
    document.body.classList.toggle('reduce-motion', !!prefs.reducedMotion);
    applyDisplayPreferences();
    writeStorage('duel-sanctuary-prefs-v1', prefs); sound.update(); updateSoundButton();
  }

  function takePhase(phase) {
    if (spectating() || engine.state.active !== 0 || engine.state.winner !== null || engine.state.pending) return;
    if (intent) { showToast('请先完成或取消当前的目标选择。'); return; }
    dispatch(phase === 'end' ? { type: 'end' } : { type: 'phase', phase });
  }
  function takeNextPhase() {
    const next = nextPhaseInfo();
    if (next.disabled) return;
    if (next.action === 'new-game') { showNewGame(); return; }
    takePhase(next.action === 'end' ? 'end' : next.phase);
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else showToast('这个浏览器不支持全屏，可使用横屏获得更宽的视野。');
    } catch { showToast('浏览器未允许全屏。游戏可以继续正常运行。'); }
  }
  function exportLog() {
    const names=tournamentView?.names||[I.player(0,engine),I.player(1,engine)];
    const content = { format:'duel-sanctuary-log',version:2,game: '游戏王 · 决斗之境',date: new Date().toISOString(),language:I.language,decks:[engine.deckInfo(0).name,engine.deckInfo(1).name],turn:engine.state.turn,winner:engine.state.winner,outcome:window.DuelOutcome.read(engine.state),log:[...engine.state.log].reverse().map(entry=>window.DuelLog.exportEntry(entry,{allVisible:spectating(),view:I.logEntry(entry,engine,names)})),turns:window.DuelLog.turns(engine.state).map(group=>({turn:group.turn,owner:group.owner,events:group.entries.map(e=>e.n)}))};
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json;charset=utf-8' }), url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = '决斗记录-' + new Date().toISOString().slice(0, 10) + '.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('决斗记录已导出。');
  }
  document.addEventListener('pointerdown',()=>sound.unlock(),{passive:true});
  document.addEventListener('click',event=>{
    const b=event.target.closest('[data-action]');if(!b){if(!event.target.closest('#card-popover'))hidePopover();return;}if(b.disabled)return;
    const action=b.dataset.action;if(!['select-card','none'].includes(action))sound.play('click');
    if(workshop.handle(action,b))return;
    switch(action){
      case 'home':showHome();break;
      case 'tournament':showTournament();break;
      case 'pvp':showPvp();break;
      case 'duel':enterDuel();break;
      case 'library':showLibrary();break;
      case 'help':showHelp();break;
      case 'settings':showSettings();break;
      case 'ai-settings':aiImport.showSettings();break;
      case 'music-settings':showSettings();$('#music-library').open=true;$('#music-library').scrollIntoView({block:'center'});break;
      case 'music-toggle':prefs.music=!prefs.music;updatePrefs();break;
      case 'music-next':sound.nextTrack();break;
      case 'font-smaller':case 'font-larger':case 'font-preset':{
        prefs.fontScale=Experience.clampFont(action==='font-preset'?Number(b.dataset.value):prefs.fontScale+(action==='font-larger'?5:-5));updatePrefs();
        if($('#font-size-control')){$('#font-size-control').value=prefs.fontScale;$('#font-size-label').textContent=prefs.fontScale+'%';}else showToast('字体大小 · '+prefs.fontScale+'%');break;
      }
      case 'response-mode':case 'cycle-response':{
        prefs.responseMode=action==='cycle-response'?['auto','on','off'][(['auto','on','off'].indexOf(prefs.responseMode)+1)%3]:b.dataset.value;
        updatePrefs();render();if(prefs.responseMode==='on'&&peekState)resumePending();else scheduleAI();break;
      }
      case 'response-help':openModal('response-help','在合适的时机，作出回应。','RESPONSE CONTROL','<div class="response-mode-guide"><h3>AUTO · 自动</h3><p>在对方发动效果、召唤怪兽和攻击时询问。普通盖放、开放时点和自己的连锁会自动略过，减少雷破等泛用陷阱的重复打断。</p><h3>ON · 全部</h3><p>每个合法时机都询问。需要精确控制准备阶段、自己的连锁或特殊战术时使用。</p><h3>OFF · 关闭</h3><p>自动放弃可选的快速响应。已经发动的效果、素材选择与强制处理仍然需要完成。</p><h3>查看战局</h3><p>收起选择面板，查看场上卡牌、墓地和记录。对局保持暂停，返回后保留原来的选择；关闭窗口或按 Esc 不会自动放弃机会。</p></div>','<button class="primary-button" data-action="close-modal">了解了</button>');break;
      case 'chain-log':showChainLog();break;
      case 'lingering':showLingering();break;
      case 'skip-chain':chainDirector.skip();break;
      case 'replay-chain':{const links=engine.state.chainHistory.filter(l=>l.chainId===Number(b.dataset.chainId));dismissModal();setScreen('duel');clearTimeout(aiTimer);chainDirector.replay(links);break;}
      case 'new-game':showNewGame();break;
      case 'rule-gallery':fate.show();break;
      case 'rule-details':fate.showDetail();break;
      case 'new-fate-game':if(engine?.remote){showPvp();break;}showNewGame();setupOptions.ruleMode='random';renderNewGame();break;
      case 'choose-rule-mode':setupOptions.ruleMode=b.dataset.value==='random'?'random':'off';renderNewGame();break;
      case 'perform-rule':if(!spectating()){if(modalKind==='pending')dismissModal();dispatch({type:'rule-action',key:b.dataset.ruleKey});}break;
      case 'workshop':workshop.show();break;
      case 'edit-current-deck':workshop.show(engine.state.players[Number(b.dataset.owner)||0].deckId);break;
      case 'edit-setup-deck':workshop.show(setupOptions.deck);break;
      case 'close-modal':closeModal();break;
      case 'modal-back':backModal();break;
      case 'inspect-full':if(!previewHidden)showCardDetail(previewId);break;
      case 'card-detail':showCardDetail(b.dataset.cardId);break;
      case 'detail-back':if(!backModal()){if(detailReturn)detailReturn();else showLibrary();}break;
      case 'my-deck':showDeck(0);break;
      case 'pile':showPile(Number(b.dataset.owner),b.dataset.pile);break;
      case 'overlays':showOverlays(b.dataset.uid);break;
      case 'pile-command':{const uid=b.dataset.uid,command=b.dataset.command;dismissModal();cardCommand(command,uid);break;}
      case 'extra-menu':showExtraMenu();break;
      case 'link-menu':showPile(0,'extra','link');break;
      case 'pendulum-summon':if(!spectating())dispatch({type:'pendulum-summon'});break;
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
      case 'library-filter':libraryFilter=b.dataset.filter;libraryPage=0;renderLibraryResults();break;
      case 'library-page':libraryPage+=Number(b.dataset.delta);renderLibraryResults();$('#modal .modal-body')?.scrollTo({top:0});break;
      case 'choose-deck':setupOptions.deck=b.dataset.deck;updateSetupDeck();break;
      case 'choose-first':updateSetupSegment(b,'first',Number(b.dataset.value));break;
      case 'choose-mode':if(b.dataset.value==='pvp'){showPvp();break;}if(b.dataset.value==='tournament'){showTournament();break;}setupOptions.mode=b.dataset.value==='spectate'?'spectate':'duel';renderNewGame();break;
      case 'choose-difficulty':updateSetupSegment(b,'difficulty',b.dataset.value);break;
      case 'clear-deck-search':{const input=document.getElementById(b.dataset.input);input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));input.focus({preventScroll:true});break;}
      case 'reset-deck-filters':setupOptions.query='';setupOptions.year='all';$('#setup-deck-search').value='';$('#setup-year').value='all';renderSetupRoster(true);$('#setup-deck-search').focus({preventScroll:true});break;
      case 'begin-game':if(setupOptions.mode==='spectate')beginSpectate(setupOptions);else startGame({...setupOptions,seed:Date.now()});break;
      case 'rematch':{const base={deck:engine.state.players[0].deckId,opponentDeck:engine.state.players[1].deckId,difficulty:engine.state.difficulty,ruleMode:engine.state.ruleMode?'random':'off'};if(spectating())beginSpectate(base);else startGame({...base,first:0,seed:Date.now()});break;}
      case 'spectate-toggle':spectateToggle();break;
      case 'spectate-step':spectateStep();break;
      case 'spectate-speed':prefs.speed=b.dataset.value==='fast'?'fast':'normal';updatePrefs();render();scheduleAI();break;
      case 'toggle-pref':if(['sound','music','reducedMotion'].includes(b.dataset.pref)){prefs[b.dataset.pref]=!prefs[b.dataset.pref];updatePrefs();showSettings();$('[data-pref="'+b.dataset.pref+'"]')?.focus({preventScroll:true});}break;
      case 'set-speed':prefs.speed=b.dataset.value==='fast'?'fast':'normal';updatePrefs();showSettings();break;
      case 'toggle-artwork':Art.setEnabled(!Art.status().enabled);showSettings();break;
      case 'toggle-online-artwork':Art.setOnlineEnabled(!Art.status().onlineEnabled);showSettings();break;
      case 'retry-artwork':Art.retry();showToast('已刷新本地卡图，缺失图片继续使用备用卡面。');break;
      case 'pending-pick':choosePending(b.dataset.uid);break;
      case 'pending-peek':peekPending();break;
      case 'pending-resume':resumePending();break;
      case 'pending-combo':{const set=engine.state.pending?.sets?.[Number(b.dataset.index)];if(set&&selectionState){selectionState.selected=[...set];updatePicks();}break;}
      case 'pending-response':{const p=engine.state.pending;if(!p||!selectionState)return;selectionState.response=p.kind==='trigger'?{uid:p.trigger.uid,key:p.trigger.key}:p.options[Number(b.dataset.index)];$$('.response-option').forEach(el=>el.classList.toggle('chosen',el===b));$('#pending-confirm').disabled=!selectionState.response;$('#pick-feedback').textContent='已选择 · '+(I.effectLabel(window.DuelEffects.get(selectionState.response?.key)));break;}
      case 'summon-zone':if(selectionState){selectionState.zone=/^[0-4]$/.test(b.dataset.zone)?Number(b.dataset.zone):b.dataset.zone;updatePicks();}break;
      case 'summon-position':if(selectionState){selectionState.position=b.dataset.position;$$('.summon-position-choice button').forEach(el=>el.classList.toggle('active',el===b));}break;
      case 'pending-confirm':{const p=engine.state.pending;if(!p||!selectionState)return;if(['trigger','window'].includes(p.kind)){const a=selectionState.response;if(!a)return;dismissModal();dispatch({type:'respond',uid:a.uid,key:a.key});}else{const uids=[...selectionState.selected],position=selectionState.position,zone=selectionState.zone;if(!engine.validatePick(p,uids).valid)return;dismissModal();dispatch({type:'choose',uids,position,...(zone!==null?{zone}:{})});}break;}
      case 'pending-pass':peekState=null;dismissModal();dispatch({type:'pass'});break;
      case 'pending-cancel':peekState=null;dismissModal();dispatch({type:'choose',cancel:true});break;
    }
  });
  document.addEventListener('input',event=>{
    if(workshop.input(event.target))return;
    if(event.target.id==='setup-deck-search'){setupOptions.query=event.target.value;renderSetupRoster(true);}
    if(event.target.id==='opponent-deck-search'){setupOptions.opponentQuery=event.target.value;renderSetupOpponent();}
    if(event.target.id==='pending-search')filterPending(event.target.value);
    if(event.target.id==='library-search'){libraryQuery=event.target.value;libraryPage=0;renderLibraryResults();}
    if(event.target.id==='volume-control'){prefs.volume=Number(event.target.value)/100;updatePrefs();$('#volume-label').textContent=Math.round(prefs.volume*100)+'%';}
    if(event.target.id==='music-volume-control'){prefs.musicVolume=Number(event.target.value)/100;updatePrefs();$('#music-volume-label').textContent=Math.round(prefs.musicVolume*100)+'%';}
    if(event.target.id==='font-size-control'){prefs.fontScale=Experience.clampFont(event.target.value);updatePrefs();$('#font-size-label').textContent=prefs.fontScale+'%';}
  });
  document.addEventListener('change',event=>{
    workshop.change(event.target);
    if(event.target.id==='library-family'){libraryFamily=event.target.value;libraryPage=0;renderLibraryResults();}
    if(event.target.id==='library-year'){libraryYear=event.target.value;libraryPage=0;renderLibraryResults();}
    if(event.target.id==='library-status'){libraryStatus=event.target.value;libraryPage=0;renderLibraryResults();}
    if(event.target.id==='library-page-size'){const old=prefs.libraryPageSize;prefs.libraryPageSize=Experience.pageSize(event.target.value);libraryPage=Math.floor(libraryPage*old/prefs.libraryPageSize);updatePrefs();renderLibraryResults();$('#modal .modal-body')?.scrollTo({top:0});}
    if(event.target.id==='library-page-jump'){libraryPage=Math.max(0,Math.floor(Number(event.target.value)||1)-1);renderLibraryResults();$('#modal .modal-body')?.scrollTo({top:0});}
    if(event.target.id==='card-style'){prefs.cardStyle=event.target.value==='full-art'?'full-art':'classic';updatePrefs();}
    if(event.target.id==='opponent-deck')setupOptions.opponentDeck=event.target.value;
    if(event.target.id==='setup-year'){setupOptions.year=event.target.value;renderSetupRoster(true);}
  });
  document.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch' || modal.open || intent) return;
    const element = event.target.closest('[data-card-uid]');
    if (!element || event.relatedTarget?.closest?.('[data-card-uid]') === element) return;
    const found = engine.find(element.dataset.cardUid);
    if (!found || (found.owner === 1 && !found.card.faceUp && !spectating())) return;
    if (hoverId === found.card.uid) return;
    hoverId = found.card.uid; previewId = found.card.id; previewHidden = false; renderInspector();
  }, { passive: true });
  document.addEventListener('keydown', event => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || event.target.isContentEditable) return;
    if (event.key === 'Escape') {
      if (modal.open) return;
      if (intent) { event.preventDefault(); clearIntent(); } else hidePopover();
      return;
    }
    if (modal.open || event.ctrlKey || event.altKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (key === 'm') { prefs.sound = !prefs.sound; sound.unlock(); updatePrefs(); showToast(prefs.sound ? '决斗音效已开启。' : '决斗音效已关闭。'); return; }
    if (key === 'f') { fullscreen(); return; }
    if(currentScreen!=='duel'||chainDirector.busy)return;
    if(tournamentView){tournament.handleKey(event);return;}
    if (spectating()) {
      if (key === ' ' && event.target.tagName !== 'BUTTON') { event.preventDefault(); spectateToggle(); }
      else if (key === 'n') { event.preventDefault(); spectateStep(); }
      return;
    }
    if (key === ' ' && event.target.tagName !== 'BUTTON') { event.preventDefault(); sound.unlock(); takeNextPhase(); return; }
    if (key === 'e') { event.preventDefault(); takePhase('end'); return; }
    if (/^[1-9]$/.test(key)) {
      const card = engine.state.players[0].hand[Number(key) - 1];
      if (card) { const el = $('.hand-slot[data-card-uid="' + card.uid + '"]'); chooseCard(card.uid, el); }
    }
  });
  modal.addEventListener('cancel', event => { event.preventDefault(); closeModal(); });
  modal.addEventListener('close', () => { if (!modal.open) scheduleAI(); });
  modal.addEventListener('click', event => {
    if (event.target !== modal) return;
    const r = modal.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) {event.preventDefault();event.stopPropagation();}
  });
  window.addEventListener('resize', () => {hidePopover();requestAnimationFrame(()=>{renderHand();highlightLinkZones();});}, { passive: true });
  window.addEventListener('scroll', event => { if (!event.target.closest?.('#modal')) positionPopover(); }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearTimeout(aiTimer); if (sound.context?.state === 'running') sound.context.suspend().catch(() => {}); }
    else { if (sound.context && prefs.sound) sound.context.resume().catch(() => {}); scheduleAI(); }
    sound.update();
  });

  const stored = readStorage('duel-sanctuary-save-v2', null) || readStorage('duel-sanctuary-save-v1', null);
  let restored = false;
  if (stored) {
    try {
      engine = window.DuelEngine.restore(stored); previewId = engine.deckInfo(0).ace;
      bindEngine(); render(); scheduleAI(); restored = true;
      if (engine.state.winner !== null) finishGame();
    } catch { restored = false; }
  }
  if (!restored) startGame({ deck: 'early-ritual', opponentDeck: 'early-fusion', first: 0, difficulty: 'standard', seed: 48 },true);
  setupAmbient();
  showHome();
  writeStorage('duel-sanctuary-welcomed-v3', true);
  window.addEventListener('duel-music-status',updateMusicStatus);updateMusicStatus();
  const archiveCount = document.querySelector('[data-action="library"] em'); if (archiveCount) archiveCount.textContent = CARD_LIST.filter(c=>!c.notCollectible).length;
  function updateArtStatus() {
    const s=Art.status(),node=$('#art-status');if(!node)return;
    node.textContent=!s.enabled?'离线卡面':s.embedded?'本地原图 · '+s.embedded:s.onlineEnabled?(s.loading?'卡图加载中':'在线补图'):'离线卡面';
    node.parentElement.title=I.term('本地原版卡图')+' '+s.embedded+' · '+I.term('在线原版卡图')+' '+I.term(s.onlineEnabled?'开启':'关闭');
    if(modalKind==='detail'&&detailCardId&&$('#card-art-links'))$('#card-art-links').outerHTML=artCredit(detailCardId);
  }
  window.addEventListener('duel-art-status',updateArtStatus);updateArtStatus();
  $('.header-tools').insertAdjacentHTML('afterbegin',I.picker());
  window.addEventListener('duel-language-change',()=>{
    const current=modalKind,picks=selectionState?JSON.parse(JSON.stringify(selectionState)):null;
    const search=$('#pending-search')?.value||'',mobilePreview=$('#ws-inspector')?.classList.contains('mobile-open');
    const scrolls=['#modal .modal-body','.ws-collection','.ws-build','.selection-grid','.deck-roster'].map(selector=>({selector,top:$(selector)?.scrollTop||0}));
    const focused=document.activeElement,focusId=focused?.id,wasLocale=focused?.matches('[data-locale-select]');
    hidePopover();render();
    if(currentScreen==='home'){$('#home-art').innerHTML='';renderHome();}
    if(current==='library')showLibrary();
    else if(current==='workshop'){workshop.show();if(mobilePreview)$('#ws-inspector')?.classList.add('mobile-open');}
    else if(current==='detail'&&detailCardId)showCardDetail(detailCardId);
    else if(current==='deck')showDeck(deckOwner);
    else if(current==='pile'&&pileContext)showPile(pileContext.owner,pileContext.kind,pileContext.onlyType);
    else if(current==='overlays')showOverlays(overlayHostUid);
    else if(current==='lingering')showLingering();
    else if(current==='new-game')renderNewGame();
    else if(current==='rule-gallery')fate.show();
    else if(current==='rule-detail')fate.showDetail(document.querySelector('[data-rule-id]')?.dataset.ruleId);
    else if(current==='help')showHelp();
    else if(current==='settings')showSettings();
    else if(current==='ai-import'||current==='ai-settings')aiImport.refresh();
    else if(current==='pending'){
      showPending(true);
      if(picks){
        selectionState=picks;
        if(!['trigger','window'].includes(engine.state.pending?.kind))updatePicks();
        else{
          const p=engine.state.pending,options=p.kind==='window'?p.options:[p.trigger];
          $$('.response-option').forEach((el,i)=>el.classList.toggle('chosen',!!picks.response&&options[i]?.uid===picks.response.uid&&options[i]?.key===picks.response.key));
          $('#pending-confirm').disabled=!picks.response;
          if(picks.response)$('#pick-feedback').textContent='已选择 · '+I.effectLabel(window.DuelEffects.get(picks.response.key));
        }
        $$('.summon-position-choice button').forEach(el=>el.classList.toggle('active',el.dataset.position===picks.position));
      }
      if($('#pending-search')){$('#pending-search').value=search;filterPending(search);}
    }
    else if(current==='log')showLog();
    else if(current==='chain-log')showChainLog();
    else if(current==='result')showResult();
    I.apply();
    for(const {selector,top} of scrolls)if($(selector))$(selector).scrollTop=top;
    if(wasLocale)$(modal.open?'#modal [data-locale-select]':'.header-tools [data-locale-select]')?.focus({preventScroll:true});
    else if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});
    updateArtStatus();
  });
  // Small deterministic test interface. The shipped game uses the same actions.
  window.duelApp = Object.freeze({
    get engine() { return engine; },
    get preferences() { return { ...prefs }; },
    get intent() { return intent ? { ...intent } : null; },
    get modalKind() { return modalKind; },
    get modalDepth(){return modalHistory.length;},
    get screen(){return currentScreen;},get music(){return sound.status();},get chainPlaying(){return chainDirector.busy;},
    showHome,enterDuel,showSettings,showChainLog,showLingering,skipChain:()=>chainDirector.skip(),
    get language(){return I.language;},setLanguage:value=>I.setLanguage(value),
    newGame: options => startGame(options),
    beginSpectate: options => beginSpectate(options),
    get spectate() { return { active: spectating(), paused: spectate.paused }; },
    get tournament(){return tournament;},showTournament,
    get pvp(){return pvp;},showPvp,
    spectateToggle, spectateStep,
    showWorkshop: id => workshop.show(id),
    showNewGame,
    showLibrary,
    get workshopDraft() { return workshop.draft; },
    act: dispatch,
    render,
    restore: snapshot => {
      if(engine?.remote){showToast('联机局面由服务器确认。');return;}
      leaveTournamentView();
      chainDirector.reset();peekState=null;setScreen('duel');
      aiEpoch++; clearTimeout(aiTimer); dismissModal(); intent = null; selectedUid = null; previewHidden = false; resultShown = false;
      clearTimeout(cinematicTimer); $('#cinematic').classList.remove('visible'); $('#fx-layer').innerHTML = ''; $('#toast-stack').innerHTML = '';
      engine = window.DuelEngine.restore(snapshot); previewId = engine.deckInfo(0).ace; bindEngine(); render(); saveGame(); scheduleAI();
    }
  });
  tournament=window.DuelTournamentUI.create({frame:showTournamentFrame,returnToArena:showTournament,toast:showToast,modalOpen:()=>modal.open||chainDirector.busy});
  pvp=window.DuelPVP.create({show:showPvp,board:enterDuel,attach:attachRemote,detach:detachRemote,toast:showToast,modal:openModal,dismiss:dismissModal,refresh:()=>{if(engine?.remote){render();scheduleAI();}}});
  I.mount();document.documentElement.dataset.ready = 'true';
  if(location.hash==='#arena')showTournament();
  if(location.hash.startsWith('#pvp'))showPvp();
})();
