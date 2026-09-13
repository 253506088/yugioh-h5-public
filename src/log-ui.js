(function(root){
  'use strict';
  const L=root.DuelLog,I=root.DuelI18n;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tr=(zh,en,ja)=>I.language==='en'?en:I.language==='ja'?ja:zh;
  const labels=()=>({all:tr('全部事件','All events','すべて'),lp:tr('生命值','Life Points','LP'),summon:tr('召唤','Summons','召喚'),move:tr('卡片去向','Card movement','カードの移動'),effect:tr('发动与战斗','Effects & battle','効果・戦闘'),other:tr('阶段与结局','Phases & result','フェイズ・結果')});
  function create(host){
    let gameKey=null,turn=null,filter='all',query='',limit=100,returnScroll=null;
    const nodes=()=>({root:document.getElementById('duel-journal'),list:document.getElementById('journal-events')});
    function show(){
      const e=host.engine(),s=e.state,key=s.startedAt+':'+s.players.map(p=>p.deckId).join(':');
      const groups=L.turns(s);
      if(gameKey!==key){gameKey=key;turn=groups.at(-1)?.turn??s.turn;filter='all';query='';limit=100;}
      if(turn!=='all'&&!groups.some(g=>g.turn===turn))turn=groups.at(-1)?.turn??s.turn;
      const options='<option value="all"'+(turn==='all'?' selected':'')+'>'+tr('全部回合','All turns','全ターン')+'</option>'+[...groups].reverse().map(g=>'<option value="'+g.turn+'"'+(turn===g.turn?' selected':'')+'>'+tr('第 '+g.turn+' 回合','Turn '+g.turn,'ターン '+g.turn)+' · '+g.entries.length+tr(' 条',' events','件')+'</option>').join('');
      const body='<section id="duel-journal" class="duel-journal" data-i18n-skip><div class="journal-toolbar"><div class="journal-turn-controls"><button type="button" data-journal-action="previous" aria-label="'+tr('上一回合','Previous turn','前のターン')+'">‹</button><label class="journal-sr" for="journal-turn">'+tr('选择回合','Choose a turn','ターンを選択')+'</label><select id="journal-turn">'+options+'</select><button type="button" data-journal-action="next" aria-label="'+tr('下一回合','Next turn','次のターン')+'">›</button><button class="journal-latest" type="button" data-journal-action="latest">'+tr('最新','Latest','最新')+'</button></div><label class="journal-search"><span>⌕</span><input id="journal-search" type="search" value="'+esc(query)+'" placeholder="'+tr('搜索卡名或事件原因','Search a card or cause','カード名・理由を検索')+'" aria-label="'+tr('搜索决斗记录','Search duel history','デュエル履歴を検索')+'"></label></div><div class="journal-filters" role="group" aria-label="'+tr('筛选事件类型','Filter event type','イベントを絞り込む')+'">'+Object.entries(labels()).map(([key,label])=>'<button type="button" data-journal-action="filter" data-value="'+key+'" aria-pressed="'+(filter===key)+'">'+label+'</button>').join('')+'</div><div class="journal-layout"><nav id="journal-turns" class="journal-turns" aria-label="'+tr('回合目录','Turn index','ターン一覧')+'"></nav><section class="journal-main"><header id="journal-summary" class="journal-summary"></header><div id="journal-events" class="log-modal-list journal-events" tabindex="0" aria-label="'+tr('按时间顺序的决斗记录','Chronological duel history','時系列のデュエル履歴')+'"></div></section></div></section>';
      const footer='<span id="journal-count" class="journal-count" data-i18n-skip></span><button class="secondary-button" data-action="export-log" data-i18n-skip>'+tr('导出全部记录','Export all records','全履歴を書き出す')+'</button><button class="primary-button" data-action="close-modal">'+tr('返回决斗','Return to duel','デュエルに戻る')+'</button>';
      host.open('log',tr('决斗轨迹','Duel journal','決闘履歴'),'DUEL JOURNAL',body,footer,'journal-modal');render();
      if(returnScroll!==null){nodes().list.scrollTop=returnScroll;returnScroll=null;}
    }
    function render(reset=true){
      const {root:node,list}=nodes();if(!node)return;
      const e=host.engine(),groups=L.turns(e.state),names=host.names(),selected=turn==='all'?groups:groups.filter(g=>g.turn===turn);
      const label=turn==='all'?tr('全部回合','All turns','全ターン'):tr('第 '+turn+' 回合','Turn '+turn,'ターン '+turn);
      document.getElementById('journal-turn').value=String(turn);
      const index=groups.findIndex(g=>g.turn===turn);
      node.querySelector('[data-journal-action=previous]').disabled=index<=0;
      node.querySelector('[data-journal-action=next]').disabled=index<0||index>=groups.length-1;
      node.querySelectorAll('[data-journal-action=filter]').forEach(el=>el.setAttribute('aria-pressed',String(filter===el.dataset.value)));
      document.getElementById('journal-turns').innerHTML=[...groups].reverse().map(g=>'<button type="button" data-journal-action="turn" data-value="'+g.turn+'"'+(turn===g.turn?' aria-current="true"':'')+'><span>TURN <b>'+String(g.turn).padStart(2,'0')+'</b></span><strong>'+esc(names[g.owner]||tr('双方','Both players','両者'))+'</strong><small>'+g.entries.length+tr(' 条记录',' events','件の記録')+'</small></button>').join('');
      const entries=selected.flatMap(g=>g.entries),presented=entries.map(entry=>({entry,view:I.logEntry(entry,e,names)}));
      const q=query.trim().normalize('NFKC').toLowerCase();
      const matching=presented.filter(({view})=>(filter==='all'||filter===view.category)&&(!q||[view.text,view.cause,view.change,view.materials,...view.cards.map(c=>I.searchName(c.cardId))].join(' ').normalize('NFKC').toLowerCase().includes(q)));
      const loss=entries.filter(l=>['damage','cost','lp-change'].includes(l.kind)&&l.trace?.lpBefore>l.trace?.lpAfter).reduce((n,l)=>n+l.trace.lpBefore-l.trace.lpAfter,0);
      const summons=entries.filter(l=>L.category(l)==='summon').length;
      const actor=turn==='all'?tr('从开局到当前进度','From the opening to this point','開始から現在まで'):names[selected[0]?.owner]||tr('双方行动','Both players','両者の行動');
      const partial=entries.some(l=>!l.trace)||e.state.logStart>1;
      document.getElementById('journal-summary').innerHTML='<div><span class="journal-eyebrow">'+tr('按发生顺序阅读','IN CHRONOLOGICAL ORDER','発生順に表示')+'</span><h3>'+label+'</h3><p>'+esc(actor)+'</p></div><div class="journal-totals"><span><b>'+summons+'</b>'+tr('次召唤','summons','回召喚')+'</span><span><b>'+loss.toLocaleString('en-US')+'</b>'+tr('LP 扣除','LP lost / paid','LP減少・支払')+'</span></div>'+(partial?'<p class="journal-legacy">'+tr('较早的记录可能已截断，或没有保存来源详情。','Older records may be incomplete or lack source details.','古い記録には欠落や理由の未保存があります。')+'</p>':'');
      let previous='',html='';
      for(const {entry,view} of matching.slice(0,limit)){
        const group=entry.turn+'|'+view.phase;
        if(group!==previous){previous=group;html+='<h4 class="journal-phase">'+(turn==='all'?'TURN '+entry.turn+' · ':'')+esc(view.phase?L.word(view.phase,I.language):tr('决斗事件','Duel events','デュエルイベント'))+'</h4>';}
        const cards=[...new Map(view.cards.map(c=>[c.cardId,c])).values()];
        html+='<article class="log-entry journal-entry '+esc(entry.kind)+'" data-log-number="'+entry.n+'"><span class="journal-event-number">'+String(entry.n).padStart(3,'0')+'</span><div class="journal-event-content"><div class="journal-event-meta"><span class="journal-event-kind category-'+view.category+'">'+labels()[view.category]+'</span>'+(view.chain?'<span>'+esc(view.chain)+'</span>':'')+'</div><p class="journal-event-title">'+esc(view.text)+'</p>'+(view.cause?'<p class="journal-cause"><span>'+tr('原因','Cause','理由')+'</span>'+esc(view.cause)+'</p>':'')+(view.change?'<p class="journal-change">'+esc(view.change)+'</p>':'')+(view.materials?'<p class="journal-materials">'+esc(view.materials)+'</p>':'')+(cards.length?'<div class="journal-cards">'+cards.map(c=>'<button type="button" data-journal-action="card" data-card="'+esc(c.cardId)+'" title="'+esc(I.name(c.cardId))+'">'+esc(I.name(c.cardId))+' ↗</button>').join('')+'</div>':'')+'</div></article>';
      }
      if(!matching.length)html='<div class="journal-empty"><span>⌕</span><h4>'+tr('没有符合条件的记录','No matching records','一致する記録がありません')+'</h4><p>'+tr('切换回合、事件类型，或调整搜索内容。','Try another turn, event type, or search.','ターン・種類・検索語を変更してください。')+'</p><button type="button" data-journal-action="reset">'+tr('清除筛选','Clear filters','絞り込みを解除')+'</button></div>';
      else if(matching.length>limit)html+='<button type="button" class="journal-more" data-journal-action="more">'+tr('继续显示 '+Math.min(100,matching.length-limit)+' 条','Show '+Math.min(100,matching.length-limit)+' more','さらに'+Math.min(100,matching.length-limit)+'件表示')+'</button>';
      const scroll=list.scrollTop;list.innerHTML=html;list.scrollTop=reset?0:scroll;
      document.getElementById('journal-count').textContent=tr('显示 '+Math.min(limit,matching.length)+' / '+matching.length+' 条','Showing '+Math.min(limit,matching.length)+' / '+matching.length,Math.min(limit,matching.length)+' / '+matching.length+'件');
    }
    document.addEventListener('click',event=>{
      const button=event.target.closest('[data-journal-action]');if(!button||button.disabled)return;
      const action=button.dataset.journalAction,groups=L.turns(host.engine().state),index=groups.findIndex(g=>g.turn===turn);
      if(action==='open'){show();return;}
      if(action==='card'){returnScroll=nodes().list.scrollTop;host.card(button.dataset.card);return;}
      if(action==='turn')turn=Number(button.dataset.value);
      if(action==='previous')turn=groups[index-1]?.turn??turn;
      if(action==='next')turn=groups[index+1]?.turn??turn;
      if(action==='latest')turn=groups.at(-1)?.turn;
      if(action==='filter')filter=button.dataset.value;
      if(action==='reset'){filter='all';query='';document.getElementById('journal-search').value='';}
      if(action==='more'){limit+=100;render(false);return;}
      limit=100;render();
    });
    document.addEventListener('change',event=>{if(event.target.id==='journal-turn'){turn=event.target.value==='all'?'all':Number(event.target.value);limit=100;render();}});
    document.addEventListener('input',event=>{if(event.target.id==='journal-search'){query=event.target.value;limit=100;render();}});
    return {show,render};
  }
  root.DuelLogUI={create};
})(globalThis);
