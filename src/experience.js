(function(root){
  'use strict';
  const PAGE_SIZES=[12,24,48,96],FONT_MIN=90,FONT_MAX=150;
  const clampFont=value=>Math.max(FONT_MIN,Math.min(FONT_MAX,Math.round((Number(value)||110)/5)*5));
  const pageSize=(value,fallback=24)=>PAGE_SIZES.includes(Number(value))?Number(value):fallback;
  function responseDecision(pending,mode='auto'){
    if(!pending||pending.responder!==0||pending.kind!=='window')return 'ask';
    if(mode==='on')return 'ask';
    if(mode==='off')return 'pass';
    const context=pending.context||{};
    if(context.chainLast)return context.chainLast.owner===1?'ask':'pass';
    if(context.attack)return 'ask';
    if(['summon','summon-attempt'].includes(context.kind)&&context.owner===1)return 'ask';
    return 'pass';
  }
  function responseSummary(engine,pending){
    const I=root.DuelI18n,C=I?.cards||root.DuelData.CARDS,t=s=>I?.term(s)||s;
    const w=pending?.context||{},last=w.chainLast,attack=w.attack;
    const publicName=uid=>{const f=engine.find(uid);return f&&(f.owner===0||f.card.faceUp||f.zone==='grave')?C[f.card.id]?.name:t('里侧卡牌');};
    if(last){
      const link=engine.state.chain.find(l=>l.id===last.id),number=link?.chainNumber||engine.state.chain.length;
      return {cardId:last.sourceId,uid:last.uid,owner:last.owner,label:t(last.owner===1?'对方发动效果':'我方发动效果'),text:C[last.sourceId]?.name,number,detail:I?.effectLabel(root.DuelEffects?.get(last.key))||'',targets:Object.values(link?.targetMeta||{}).flatMap(group=>Object.entries(group).map(([uid,saved])=>({uid,label:saved.public||saved.owner===0?C[saved.cardId||engine.find(uid)?.card.id]?.name:t('里侧卡牌')})))};
    }
    if(attack){const f=engine.find(attack.uid);return {cardId:f?.card.id,uid:attack.uid,owner:attack.owner,label:t(attack.stage==='declare'?'攻击宣言':'战斗中的响应时机'),text:publicName(attack.uid),detail:attack.target?t('攻击目标')+' · '+publicName(attack.target):t('直接攻击'),targets:attack.target?[{uid:attack.target,label:publicName(attack.target)}]:[]};}
    if(['summon','summon-attempt'].includes(w.kind)){const f=engine.find(w.uid);return {cardId:f?.card.faceUp?f.card.id:null,uid:w.uid,owner:w.owner,label:t(w.kind==='summon-attempt'?'即将召唤':'召唤成功'),text:publicName(w.uid),detail:t('可以在这个时点发动合法的快速效果。'),targets:[]};}
    const trigger=pending?.trigger;
    if(trigger)return {cardId:trigger.sourceId,uid:trigger.uid,owner:trigger.owner,label:t('诱发效果'),text:C[trigger.sourceId]?.name,detail:I?.effectLabel(root.DuelEffects?.get(trigger.key))||'',targets:[]};
    const recent=engine.state.log.find(e=>!e.kind.startsWith('chain-'));
    return {label:t('响应时机'),text:recent?(I?.log(recent,engine)||recent.text):t('可以发动快速效果。'),detail:t('战局已暂停，查看后再决定。'),targets:[]};
  }
  class ShuffleBag{
    constructor(items=[],random=Math.random){this.items=[...new Set(items)];this.random=random;this.bag=[];this.last=null;}
    next(){
      if(!this.items.length)return null;
      if(!this.bag.length){
        this.bag=[...this.items];
        for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}
        if(this.bag.length>1&&this.bag.at(-1)===this.last)[this.bag[0],this.bag[this.bag.length-1]]=[this.bag.at(-1),this.bag[0]];
      }
      return this.last=this.bag.pop();
    }
  }
  class ChainDirector{
    constructor({node,prefs,onIdle}){this.node=node;this.prefs=prefs;this.onIdle=onIdle;this.queue=[];this.cards=new Map();this.notices=new Map();this.timer=null;this.busy=false;this.currentChain=null;}
    reset(){clearTimeout(this.timer);this.queue=[];this.cards.clear();this.notices.clear();this.busy=false;this.currentChain=null;this.node.hidden=true;root.document?.body.classList.remove('chain-playing');}
    skip(){const was=this.busy;this.reset();if(was)this.onIdle?.();}
    receive(events,history=[]){
      const multi=new Set(history.filter(l=>l.number>1).map(l=>l.chainId));
      const relevant=events.filter(e=>e.kind.startsWith('chain-')&&(multi.has(e.chainId)||['chain-target-lost','chain-negated','chain-unavailable'].includes(e.kind)));
      if(!relevant.length)return;
      for(const e of relevant){
        if(e.kind==='chain-add'&&e.number===1)continue;
        if(e.kind==='chain-resolved')continue;
        this.queue.push({...e,links:history.filter(l=>l.chainId===e.chainId).map(l=>({...l}))});
      }
      if(!this.busy)this.advance();
    }
    replay(links){
      if(!links.length)return;
      this.reset();
      this.queue.push({kind:'chain-add',chainId:links[0].chainId,links,number:links.length});
      for(const link of [...links].sort((a,b)=>b.number-a.number)){
        this.queue.push({kind:'chain-resolve',chainId:link.chainId,id:link.id,number:link.number,cardId:link.cardId,links});
        if(link.status==='negated')this.queue.push({kind:'chain-negated',...link,byNumber:link.byNumber,links});
        if(link.status==='target-lost')this.queue.push({kind:'chain-target-lost',...link,targets:link.lostTargets||[],links});
        if(link.status==='unavailable')this.queue.push({kind:'chain-unavailable',...link,links});
      }
      this.queue.push({kind:'chain-complete',chainId:links[0].chainId,links});this.advance();
    }
    advance(){
      clearTimeout(this.timer);
      const event=this.queue.shift();
      if(!event){this.busy=false;this.node.hidden=true;root.document.body.classList.remove('chain-playing');this.onIdle?.();return;}
      this.busy=true;root.document.body.classList.add('chain-playing');
      if(this.currentChain!==event.chainId){this.cards.clear();this.notices.clear();this.currentChain=event.chainId;}
      for(const l of event.links)if(!this.cards.has(l.id))this.cards.set(l.id,{...l,status:'waiting',finished:false});
      const current=this.cards.get(event.id);
      if(event.kind==='chain-resolve'){
        for(const l of this.cards.values())if(l.status==='resolving')l.status='resolved';
        if(current&&!['negated','target-lost','unavailable'].includes(current.status))current.status='resolving';
      }
      const warning=['chain-negated','chain-target-lost','chain-unavailable'].includes(event.kind);
      if(current&&warning){current.status=event.kind.slice(6);this.notices.set(event.id,event);}
      if(event.kind==='chain-complete')for(const l of event.links)this.cards.set(l.id,l);
      this.draw(event);
      // Reduced motion changes movement, not the time available to read an important result.
      const duration=warning?2200:event.kind==='chain-complete'&&this.notices.size?1600:this.prefs.reducedMotion?300:this.prefs.speed==='fast'?450:event.kind==='chain-resolve'?1050:event.kind==='chain-add'?950:750;
      this.timer=setTimeout(()=>this.advance(),duration);
    }
    draw(event){
      const I=root.DuelI18n,V=root.DuelView,C=I.cards,t=s=>I.term(s),esc=V.escape,links=[...this.cards.values()].sort((a,b)=>a.number-b.number);
      const warning=['chain-negated','chain-target-lost','chain-unavailable'].includes(event.kind);
      let title=event.kind==='chain-add'?t('连锁构筑'):event.kind==='chain-complete'?t('连锁处理完毕'):t('连锁结算')+' · '+(event.number||'');
      let detail=links.map(l=>l.number).reverse().join(' → ')+' · '+t('后发动，先处理');
      if(event.kind==='chain-negated')detail=(event.byNumber?t('连锁')+' '+event.byNumber+' → ':'')+t('连锁')+' '+event.number+' · '+t(event.reason==='source-unavailable'?'来源已离场，效果未能适用':'发动或效果被无效');
      if(event.kind==='chain-target-lost')detail=t('连锁')+' '+event.number+' · '+t('目标已离场，相关部分无法处理')+(event.targets?.some(x=>x.byNumber)?' · '+t('来自连锁')+' '+[...new Set(event.targets.map(x=>x.byNumber).filter(Boolean))].join(' / '):'');
      if(event.kind==='chain-unavailable')detail=(event.byNumber?t('连锁')+' '+event.byNumber+' → ':'')+t('连锁')+' '+event.number+' · '+t('来源已离场，效果未能适用');
      if(warning)this.notices.set(event.id,{...event,detail});
      if(event.kind==='chain-complete'&&this.notices.size)detail=[...this.notices.values()].map(notice=>notice.detail).filter(Boolean).join('；');
      const statusLabels={waiting:'等待结算',resolving:'正在处理',resolved:'处理完成',negated:'无效','target-lost':'目标丢失',unavailable:'未能适用'};
      const connector='<svg class="chain-connector" viewBox="0 0 100 32" aria-hidden="true"><g fill="none" stroke-width="5"><rect x="2" y="7" width="38" height="17" rx="8.5" stroke="#c3d5de"/><rect x="29" y="10" width="38" height="12" rx="6" stroke="#718d9b"/><rect x="58" y="7" width="39" height="17" rx="8.5" stroke="#c3d5de"/></g><path d="M10 5h22m34 0h23" fill="none" stroke="#f5ffff" stroke-width="2"/></svg>';
      this.node.className='chain-theater'+(warning||event.kind==='chain-complete'&&this.notices.size?' warning':'');this.node.hidden=false;this.node.dataset.event=event.kind;
      this.node.innerHTML='<div class="chain-theater-top"><span>'+t('双方连锁')+'</span><button data-action="skip-chain">'+t('跳过演出')+' ↗</button></div><div class="chain-theater-title"><small>'+esc(event.kind==='chain-add'?'CHAIN':event.kind==='chain-complete'?'COMPLETE':'RESOLVE')+'</small><h2>'+esc(title)+'</h2></div><div class="chain-resolution-order" aria-label="'+esc(t('后发动，先处理'))+'">'+[...links].reverse().map(l=>'<span class="'+(l.id===event.id?'active':'')+'">'+l.number+'</span>').join('<i>→</i>')+'</div><div class="chain-cards" tabindex="0">'+links.map((l,i)=>'<article class="chain-card owner-'+l.owner+' status-'+l.status+(l.id===event.id?' current':'')+'" style="--chain-order:'+i+'">'+(i?connector:'')+'<div class="chain-owner">'+t(l.owner===0?'我方':'对方')+'</div><div class="chain-card-face">'+V.card(l.cardId)+'<strong class="chain-number">'+l.number+'</strong>'+(l.status==='negated'?'<span class="chain-cross">×</span>':'')+'</div><h3>'+esc(C[l.cardId]?.name||'')+'</h3><p>'+t(statusLabels[l.status]||'等待结算')+'</p></article>').join('')+'</div><p class="chain-theater-detail" role="status">'+esc(detail)+'</p>';
      root.DuelArt.refresh(this.node);I.apply(this.node);
      const strip=this.node.querySelector('.chain-cards'),active=this.node.querySelector('.chain-card.current');
      if(active)strip.scrollLeft=active.offsetLeft-strip.offsetLeft-(strip.clientWidth-active.clientWidth)/2;
    }
  }
  const api={PAGE_SIZES,FONT_MIN,FONT_MAX,clampFont,pageSize,responseDecision,responseSummary,ShuffleBag,ChainDirector};
  root.DuelExperience=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
