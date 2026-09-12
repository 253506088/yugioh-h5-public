(function(root){
  'use strict';
  const D=root.DuelData,T=root.DuelDecks,V=root.DuelView,A=root.DuelArt,I=root.DuelI18n;
  const {isMonster,isExtra,isFamily}=D,CARDS=I.cards,CARD_LIST=D.CARD_LIST.map(c=>I.card(c.id)),esc=V.escape;
  const cards=CARD_LIST.filter(c=>!c.notCollectible),DRAFT='duel-sanctuary-workshop-draft-v2';
  const clone=v=>JSON.parse(JSON.stringify(v));
  const typeFilters=[['all','全部'],['monster','怪兽'],['spell','魔法'],['trap','陷阱'],['ritual','仪式'],['fusion','融合'],['synchro','同调'],['xyz','超量'],['link','连接'],['pendulum','灵摆'],['tuner','调整']];
  function create(host){
    let draft={name:I.term('我的新卡组'),cards:[],extra:[]},query='',family='all',year='all',type='all',page=0,focus='hero-sunrise',onlyIncluded=false,onlyPlayable=true,undo=[],redo=[],savedNote='',deleteArmed=false,mobileView='collection';
    try{const d=JSON.parse(localStorage.getItem(DRAFT));if(d&&Array.isArray(d.cards)&&Array.isArray(d.extra)){draft={name:String(d.name||I.term('我的新卡组')).slice(0,40),cards:d.cards.filter(id=>CARDS[id]&&!CARDS[id].notCollectible&&!isExtra(CARDS[id])).slice(0,60),extra:d.extra.filter(id=>CARDS[id]&&isExtra(CARDS[id])).slice(0,15),...(T.getSaved().some(s=>s.id===d.id)?{id:d.id}:{})};}}catch{}
    const $=s=>document.querySelector(s);
    const sameName=id=>(CARDS[id]?.nameAlias||CARDS[id]?.officialName||id).toLowerCase();
    const count=id=>[...draft.cards,...draft.extra].filter(x=>sameName(x)===sameName(id)).length;
    function persist(){try{localStorage.setItem(DRAFT,JSON.stringify(draft));savedNote='草稿已自动保留';}catch{savedNote='草稿暂未保存，请导出备份';}}
    function remember(){undo.push(clone(draft));if(undo.length>80)undo.shift();redo=[];}
    function changes(){persist();renderBuild();renderCollection();renderToolbar();}
    function show(id=null){
      if(id&&D.DECKS[id]){remember();const d=D.DECKS[id];draft=d.custom?{id:d.id,name:d.name,cards:[...d.cards],extra:[...d.extra]}:T.copy(id);if(!d.custom)draft.name=(I.deck(d).name+(I.language==='zh-CN'?' · 我的构筑':I.language==='en'?' · My Deck':' · マイデッキ')).slice(0,40);focus=d.ace;persist();}
      const body='<div class="ws-toolbar" id="ws-toolbar"></div><div class="workshop-layout"><aside class="ws-inspector" id="ws-inspector"></aside><section class="ws-collection"><button class="ws-filter-toggle" id="ws-filter-toggle" data-action="ws-toggle-filters" aria-expanded="false" aria-controls="ws-filter-content"><span>筛选与搜索</span><b id="ws-filter-result"></b><i>⌄</i></button><div class="ws-filter-content" id="ws-filter-content"><div class="ws-search"><label class="search-box"><svg class="icon"><use href="#i-search"/></svg><input id="ws-search" type="search" placeholder="搜索卡名、效果或英文名…" value="'+esc(query)+'" aria-label="搜索组卡牌库"></label><select id="ws-family" aria-label="筛选卡片系列">'+Object.entries(D.families).map(([id,label])=>'<option value="'+id+'"'+(family===id?' selected':'')+'>'+label+'</option>').join('')+'</select></div><div class="ws-filters" id="ws-filters"></div><div class="ws-collection-meta"><span id="ws-result-count"></span><label><input id="ws-included" type="checkbox"'+(onlyIncluded?' checked':'')+'> 仅已编入</label></div><button class="ws-filter-done" data-action="ws-toggle-filters">显示筛选结果</button></div><div class="ws-card-grid" id="ws-card-grid"></div><div class="ws-pagination" id="ws-pagination"></div></section><aside class="ws-build"><div class="ws-build-title"><small>YOUR DECK</small><span id="ws-draft-status"></span></div><label class="ws-name-label">卡组名称<input id="ws-name" maxlength="40" value="'+esc(draft.name)+'" aria-label="卡组名称"></label><div id="ws-build-content"></div></aside></div><input id="ws-import-file" type="file" accept=".json,application/json" hidden>';
      host.open('workshop','构筑你的下一场胜利。','THE DECK ATELIER · 组卡工坊',body,'<span class="ws-footer-note">本作不采用赛事禁限卡表 · 默认仅显示可用卡片</span><button class="secondary-button" data-action="close-modal">返回决斗</button><button class="secondary-button" data-action="ws-save" id="ws-save">保存卡组</button><button class="primary-button" data-action="ws-play" id="ws-play">保存并出战 <svg class="icon"><use href="#i-arrow"/></svg></button>','workshop-modal');
      $('.ws-search').insertAdjacentHTML('beforeend','<select class="ws-year" id="ws-year" aria-label="组卡按发行年份筛选">'+V.yearOptions(year)+'</select>');
      $('.ws-collection-meta').insertAdjacentHTML('beforeend','<label><input type="checkbox" id="ws-playable"'+(onlyPlayable?' checked':'')+'> 仅可用于决斗</label>');
      renderToolbar();renderBuild();renderCollection();renderInspector();
    }
    function renderToolbar(){
      const node=$('#ws-toolbar');if(!node)return;
      node.innerHTML='<div class="ws-source"><label for="ws-source">从构筑开始</label><select id="ws-source"><option value="">选择预设 / 已保存卡组</option><optgroup label="预设卡组 · 自动建立副本">'+T.list().filter(d=>d.preset).map(d=>I.deck(d)).map(d=>'<option value="'+d.id+'">'+esc(d.name)+'</option>').join('')+'</optgroup><optgroup label="你的卡组">'+T.getSaved().map(d=>'<option data-user-content value="'+d.id+'">'+esc(d.name)+'</option>').join('')+'</optgroup></select></div><div class="ws-tools"><button data-action="ws-new">＋ 空白卡组</button><button data-action="ws-clone">复制当前</button><button data-action="ws-undo" title="撤销上次编辑"'+(!undo.length?' disabled':'')+'>↶ 撤销</button><button data-action="ws-redo" title="重做"'+(!redo.length?' disabled':'')+'>↷</button><button data-action="ws-import">导入</button><button data-action="ws-export">导出</button>'+(draft.id?'<button class="ws-delete" data-action="ws-delete">'+(deleteArmed?'确认删除？':'删除')+'</button>':'')+'</div>';
      node.insertAdjacentHTML('beforeend','<div class="ws-mobile-tabs"><button data-action="ws-view" data-view="collection" class="'+(mobileView==='collection'?'active':'')+'">牌库 · 添加卡片</button><button data-action="ws-view" data-view="build" class="'+(mobileView==='build'?'active':'')+'">当前构筑 '+draft.cards.length+' ＋ '+draft.extra.length+'</button></div>');
      $('.workshop-layout').dataset.mobileView=mobileView;
    }
    function renderInspector(){
      const el=$('#ws-inspector');if(!el)return;
      const c=CARDS[focus]||cards[0];focus=c.id;
      el.innerHTML='<button class="ws-mobile-close" data-action="ws-close-preview">关闭预览 ×</button><span class="ws-panel-kicker">CARD SPOTLIGHT</span><div class="ws-preview">'+V.card(c.id)+'</div><div class="ws-card-details">'+V.details(c.id)+'</div><div class="ws-preview-actions"><button data-action="ws-add" data-id="'+c.id+'"'+(count(c.id)>=3?' disabled':'')+'>＋ 加入'+(isExtra(c)?'额外':'主卡组')+'</button><span>'+count(c.id)+' / 3</span></div><p class="ws-art-note">卡图优先使用本地内嵌图片。<br>可在设置中启用在线原版卡图。</p>';
    }
    function filtered(){const q=query.trim().normalize('NFKC').toLowerCase();return cards.filter(c=>V.yearMatch(c,year)&&(!onlyPlayable||c.implementationStatus!=='pending')&&(family==='all'||isFamily(c,family))&&(type==='all'||type==='monster'&&isMonster(c)||type==='tuner'&&c.tuner||c.type===type)&&(!onlyIncluded||count(c.id))&&(!q||I.searchText(c.id).includes(q)));}
    function renderCollection(){
      if(!$('#ws-card-grid'))return;
      const size=host.getPageSize?.()||24,list=filtered(),pages=Math.max(1,Math.ceil(list.length/size));page=Math.max(0,Math.min(page,pages-1));
      $('#ws-filters').innerHTML=typeFilters.map(([id,label])=>'<button data-action="ws-filter" data-filter="'+id+'" class="'+(type===id?'active':'')+'">'+label+'</button>').join('');
      $('#ws-result-count').textContent=list.length+' 张卡片 / '+cards.length+' 张已解锁';
      $('#ws-filter-result').textContent=list.length+' 张卡片';
      $('#ws-card-grid').innerHTML=list.length?list.slice(page*size,page*size+size).map(c=>{const n=count(c.id);return '<article class="ws-card'+(focus===c.id?' focused':'')+'"><button class="ws-card-face" data-action="ws-inspect" data-id="'+c.id+'" aria-label="查看'+esc(c.name)+'">'+V.card(c.id)+'<span class="ws-card-category type-'+c.type+'">'+(c.tuner?'调整':V.kind(c))+'</span></button><button class="ws-card-name" data-action="ws-inspect" data-id="'+c.id+'">'+esc(c.name)+'</button><div class="ws-count-controls"><button data-action="ws-remove" data-id="'+c.id+'" aria-label="移除'+esc(c.name)+'"'+(!n?' disabled':'')+'>−</button><span class="'+(n?'has-copies':'')+'">'+n+' / 3</span><button data-action="ws-add" data-id="'+c.id+'" aria-label="加入'+esc(c.name)+'"'+(n>=3?' disabled':'')+'>＋</button></div></article>';}).join(''):'<div class="empty-state">没有符合条件的卡片。<br><button data-action="ws-reset-filters">清空筛选</button></div>';
      $('#ws-pagination').innerHTML='<label class="page-size-control">每页 <select id="ws-page-size" aria-label="工坊每页张数">'+root.DuelExperience.PAGE_SIZES.map(n=>'<option value="'+n+'"'+(size===n?' selected':'')+'>'+n+' 张</option>').join('')+'</select></label><div class="page-navigation"><button data-action="ws-page" data-delta="-1"'+(!page?' disabled':'')+' aria-label="上一页">←</button><label><input id="ws-page-jump" type="number" min="1" max="'+pages+'" value="'+(page+1)+'" aria-label="跳转工坊页码"> / '+pages+'</label><button data-action="ws-page" data-delta="1"'+(page>=pages-1?' disabled':'')+' aria-label="下一页">→</button></div>';
      for(const b of document.querySelectorAll('#ws-card-grid [data-action="ws-add"]'))if(CARDS[b.dataset.id].implementationStatus==='pending'){b.disabled=true;b.closest('.ws-card')?.classList.add('pending');}
    }
    function pile(zone,title,limit){
      const list=draft[zone],counts=new Map();list.forEach(id=>counts.set(id,(counts.get(id)||0)+1));
      return '<div class="ws-pile-heading"><h3>'+title+'</h3><b>'+list.length+' <small>/ '+limit+'</small></b></div><div class="ws-deck-rows">'+(list.length?[...counts].map(([id,n])=>'<div class="ws-deck-row"><button data-action="ws-inspect" data-id="'+id+'" class="ws-deck-card">'+A.html(id,'ws-mini-art')+'<span><strong>'+esc(CARDS[id].name)+'</strong><small>'+V.kind(CARDS[id])+(isMonster(CARDS[id])?' · '+(CARDS[id].type==='link'?'LINK '+CARDS[id].linkRating:CARDS[id].rank?'RANK '+CARDS[id].rank:'LV '+CARDS[id].level):'')+'</small></span></button><div class="ws-row-controls"><button data-action="ws-remove" data-id="'+id+'" aria-label="从卡组移除'+esc(CARDS[id].name)+'">−</button><b>'+n+'</b><button data-action="ws-add" data-id="'+id+'" aria-label="再加入'+esc(CARDS[id].name)+'"'+(n>=3?' disabled':'')+'>＋</button></div></div>').join(''):'<div class="ws-empty-pile">'+(zone==='cards'?'点击牌库卡片下方的 ＋<br>从第一张卡开始，写下你的战术。':'融合、同调、超量与连接怪兽<br>会自动加入这里。仪式在主卡组。')+'</div>')+'</div>';
    }
    function renderBuild(){
      if(!$('#ws-build-content'))return;
      const check=T.analyze(draft),s=check.stats||{},total=draft.cards.length||1;
      $('#ws-build-content').innerHTML='<div class="ws-distribution"><i style="width:'+((s.monsters||0)/total*100)+'%" class="monsters"></i><i style="width:'+((s.spells||0)/total*100)+'%" class="spells"></i><i style="width:'+((s.traps||0)/total*100)+'%" class="traps"></i></div><div class="ws-type-counts"><span>● 怪兽 '+(s.monsters||0)+'</span><span>● 魔法 '+(s.spells||0)+'</span><span>● 陷阱 '+(s.traps||0)+'</span></div><div class="ws-validity '+(check.valid?'valid':'')+'" role="status"><b>'+(check.valid?'✓ 构筑合法，可以出战':'◇ 继续完善你的卡组')+'</b><p>'+(check.valid?'主卡组 40—60 · 额外 0—15 · 同名最多 3':check.errors.map(esc).join('<br>'))+'</p></div>'+pile('cards','主卡组','40—60')+pile('extra','额外卡组','15');
      $('#ws-draft-status').textContent=savedNote||'可继续编辑';
      for(const id of ['ws-save','ws-play'])if($('#'+id))$('#'+id).disabled=!check.valid;
    }
    function add(id){
      const c=CARDS[id];if(!c||c.notCollectible)return;
      if(c.implementationStatus==='pending'){host.toast('这张卡的效果尚待实现，可先在图鉴中查阅。');return;}
      if(count(id)>=3){host.toast('同名卡最多可以编入3张。');return;}
      const zone=isExtra(c)?'extra':'cards',max=zone==='extra'?15:60;if(draft[zone].length>=max){host.toast((zone==='extra'?'额外卡组':'主卡组')+'已达到'+max+'张上限。',true);return;}
      remember();draft[zone].push(id);focus=id;changes();renderInspector();
    }
    function remove(id){const zone=isExtra(CARDS[id])?'extra':'cards',at=draft[zone].lastIndexOf(id);if(at<0)return;remember();draft[zone].splice(at,1);changes();renderInspector();}
    function save(play=false){
      try{const saved=T.save(draft);draft=clone(saved);persist();savedNote='已保存为可用卡组';renderToolbar();renderBuild();host.toast(I.term('卡组已保存。'));if(play)host.play(saved.id);}catch(error){host.toast(error.message,true);}
    }
    function download(){
      try{const text=T.exportJSON(draft),url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=draft.name.replace(/[<>:"/\\|?*]/g,'_')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);host.toast('卡组已导出为 JSON。');}catch(error){host.toast(error.message,true);}
    }
    function handle(action,b){
      if(!action.startsWith('ws-'))return false;
      switch(action){
        case 'ws-toggle-filters':{const open=$('.ws-collection').classList.toggle('filters-open');$('#ws-filter-toggle').setAttribute('aria-expanded',String(open));if(!open)$('#ws-filter-toggle').focus({preventScroll:true});break;}
        case 'ws-view':mobileView=b.dataset.view;renderToolbar();$('.workshop-layout')?.scrollTo({top:0,behavior:'instant'});break;
        case 'ws-add':add(b.dataset.id);break;
        case 'ws-remove':remove(b.dataset.id);break;
        case 'ws-inspect':focus=b.dataset.id;renderInspector();$('#ws-inspector')?.classList.add('mobile-open');document.querySelectorAll('.ws-card').forEach(el=>el.classList.toggle('focused',el.querySelector('[data-id]')?.dataset.id===focus));break;
        case 'ws-close-preview':$('#ws-inspector')?.classList.remove('mobile-open');break;
        case 'ws-filter':type=b.dataset.filter;page=0;renderCollection();break;
        case 'ws-reset-filters':query='';family='all';year='all';type='all';onlyIncluded=false;onlyPlayable=true;page=0;show();break;
        case 'ws-page':page+=Number(b.dataset.delta);renderCollection();$('#ws-card-grid')?.scrollTo({top:0});break;
        case 'ws-new':remember();draft={name:I.term('我的新卡组'),cards:[],extra:[]};persist();show();break;
        case 'ws-clone':remember();draft={name:(draft.name+' · '+I.term('副本')).slice(0,40),cards:[...draft.cards],extra:[...draft.extra]};persist();show();break;
        case 'ws-undo':if(undo.length){redo.push(clone(draft));draft=undo.pop();persist();show();}break;
        case 'ws-redo':if(redo.length){undo.push(clone(draft));draft=redo.pop();persist();show();}break;
        case 'ws-save':save();break;
        case 'ws-play':save(true);break;
        case 'ws-export':download();break;
        case 'ws-import':$('#ws-import-file')?.click();break;
        case 'ws-delete':if(draft.id){if(!deleteArmed){deleteArmed=true;renderToolbar();setTimeout(()=>{deleteArmed=false;renderToolbar();},4500);}else{try{T.remove(draft.id);delete draft.id;deleteArmed=false;persist();renderToolbar();host.toast('已删除保存的卡组，当前草稿仍保留。');}catch(e){host.toast(e.message,true);}}}break;
      }return true;
    }
    function input(el){
      if(el.id==='ws-search'){query=el.value;page=0;renderCollection();return true;}
      if(el.id==='ws-name'){draft.name=el.value;persist();renderBuild();return true;}return false;
    }
    async function change(el){
      if(el.id==='ws-page-size'){const old=host.getPageSize?.()||24;host.setPageSize?.(el.value);page=Math.floor(page*old/(host.getPageSize?.()||24));renderCollection();$('#ws-card-grid')?.scrollTo({top:0});}
      if(el.id==='ws-page-jump'){page=Math.max(0,Math.floor(Number(el.value)||1)-1);renderCollection();$('#ws-card-grid')?.scrollTo({top:0});}
      if(el.id==='ws-year'){year=el.value;page=0;renderCollection();}
      if(el.id==='ws-playable'){onlyPlayable=el.checked;page=0;renderCollection();}
      if(el.id==='ws-family'){family=el.value;page=0;renderCollection();}
      if(el.id==='ws-included'){onlyIncluded=el.checked;page=0;renderCollection();}
      if(el.id==='ws-source'&&el.value)show(el.value);
      if(el.id==='ws-import-file'&&el.files?.[0]){
        const file=el.files[0];try{if(file.size>100000)throw new Error('卡组文件过大，请选择导出的 JSON 卡组。');const imported=T.parseJSON(await file.text());remember();draft=imported;persist();show();host.toast('已导入草稿，保存后即可出战。');}catch(error){host.toast(error.message,true);}finally{el.value='';}
      }
    }
    return {show,handle,input,change,get draft(){return clone(draft);}};
  }
  root.DuelWorkshop={create};
})(globalThis);
