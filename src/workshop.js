(function(root){
'use strict';
const D=root.DuelData,T=root.DuelDecks,E=root.DuelDeckEditor,V=root.DuelView,I=root.DuelI18n,esc=V.escape,CARDS=I.cards;
const cards=D.CARD_LIST.filter(c=>!c.notCollectible),DRAFT='duel-sanctuary-workshop-draft-v3',clone=v=>JSON.parse(JSON.stringify(v));
const tr=(zh,en,ja)=>I.language==='en'?en:I.language==='ja'?ja:zh,zn=z=>I.term(z==='cards'?'主卡组':z==='extra'?'额外卡组':'副卡组');
const types=[['all','全部'],['monster','怪兽'],['spell','魔法'],['trap','陷阱'],['ritual','仪式'],['fusion','融合'],['synchro','同调'],['xyz','超量'],['link','连接'],['pendulum','灵摆'],['tuner','调整']];
function create(host){
let draft={name:I.term('我的新卡组'),cards:[],extra:[],side:[]},normalDraft=null,siding=null,draftRecovery=null,query='',family='all',year='all',type='all',page=0,focus='hero-sunrise',onlyIncluded=false,onlyPlayable=true,undo=[],redo=[],savedNote='',mobileView='build',deleteArmed=false,focusSource=null,dragState=null,dragFrame=null,touchHold=null,touchStart=null,menuSource=null,suppressClickUntil=0;
try{const d=JSON.parse(localStorage.getItem(DRAFT)??localStorage.getItem('duel-sanctuary-workshop-draft-v2')??'null');if(d)draft=E.normalize(d);}catch{draftRecovery=localStorage.getItem(DRAFT);savedNote=tr('草稿读取失败，原数据已保留','Draft unreadable; original retained','下書きを読み込めません。元データは保存済み');}
const $=s=>document.querySelector(s),count=id=>E.zones.flatMap(z=>draft[z]).filter(x=>T.identity(x)===T.identity(id)).length;
function persist(){if(siding){siding.change?.(clone(draft));return;}try{if(draftRecovery!==null)localStorage.setItem(DRAFT+'-recovery',draftRecovery);localStorage.setItem(DRAFT,JSON.stringify(draft));draftRecovery=null;savedNote=I.term('草稿已自动保留');}catch{savedNote=I.term('草稿暂未保存，请导出备份');}}
function remember(){undo.push(clone(draft));if(undo.length>80)undo.shift();redo=[];}
function changes(){persist();renderBuild();renderCollection();renderToolbar();renderInspector();}
function show(id=null){
 stopDrag();closeMenu();
 if(id&&siding)exitSiding();
 if(id&&D.DECKS[id]){remember();const d=D.DECKS[id];draft=d.custom?E.normalize(d):T.copy(id);focus=d.ace;persist();}
 const recovery=T.getDiagnostics().length?'<button class="ws-recovery" data-action="ws-recovery">'+tr('导出恢复备份','Export recovery backup','復旧バックアップを出力')+'</button>':'';
 const body=recovery+'<div class="ws-toolbar" id="ws-toolbar"></div><nav class="ws-zone-nav" id="ws-zone-nav"></nav><div class="workshop-layout'+(siding?' ws-siding':'')+'"><aside class="ws-inspector" id="ws-inspector"></aside><section class="ws-build"><div id="ws-build-content"></div>'+(!siding?'<details class="ws-notes"><summary>'+I.term('导入备注')+'</summary><textarea id="ws-notes" maxlength="16000" data-user-content>'+esc(draft.notes||'')+'</textarea></details>':'')+'</section>'+
 (!siding?'<section class="ws-collection" data-ws-drop="library"><button class="ws-filter-toggle" id="ws-filter-toggle" data-action="ws-toggle-filters" aria-expanded="false"><span>'+I.term('筛选与搜索')+'</span><b id="ws-filter-result"></b></button><div class="ws-filter-content"><div class="ws-search"><label class="search-box"><input id="ws-search" type="search" placeholder="'+I.term('搜索卡名、效果或英文名…')+'" value="'+esc(query)+'" aria-label="'+I.term('搜索组卡牌库')+'"></label><select id="ws-family" aria-label="'+I.term('筛选卡片系列')+'">'+Object.entries(D.families).map(([id,label])=>'<option value="'+id+'"'+(family===id?' selected':'')+'>'+I.term(label)+'</option>').join('')+'</select><select id="ws-year" aria-label="'+I.term('组卡按发行年份筛选')+'">'+V.yearOptions(year)+'</select></div><div class="ws-filters" id="ws-filters"></div><div class="ws-collection-meta"><span id="ws-result-count"></span><label><input id="ws-included" type="checkbox"'+(onlyIncluded?' checked':'')+'>'+I.term('仅已编入')+'</label><label><input id="ws-playable" type="checkbox"'+(onlyPlayable?' checked':'')+'>'+I.term('仅可用于决斗')+'</label></div><button class="ws-filter-done" data-action="ws-toggle-filters">'+I.term('显示筛选结果')+'</button></div><div class="ws-card-grid" id="ws-card-grid"></div><div class="ws-pagination" id="ws-pagination"></div></section>':'')+'</div><input id="ws-import-file" type="file" accept=".json,.ydk,.txt,.ydke" hidden>';
 host.open('workshop',siding?tr('局间换备','Side decking','サイドチェンジ'):tr('卡组工坊','Deck workshop','デッキ工房'),'THE DECK ATELIER',body,
 '<span id="ws-draft-status" class="ws-footer-status"></span><button class="secondary-button" data-action="close-modal">'+I.term('返回决斗')+'</button><button class="secondary-button" data-action="ws-save" id="ws-save">'+(siding?tr('确认换备并准备','Confirm & ready','確定して準備'):I.term('保存卡组'))+'</button>'+(!siding?'<button class="primary-button" data-action="ws-play" id="ws-play">'+I.term('保存并出战')+'</button>':''),'workshop-modal');
 renderToolbar();renderBuild();renderCollection();renderInspector();wireDrag();
}
function renderToolbar(){
 const el=$('#ws-toolbar');if(!el)return;
 el.classList.toggle('ws-side-toolbar',!!siding);
 el.innerHTML=(!siding?'<div class="ws-source"><select id="ws-source" aria-label="'+I.term('选择预设 / 已保存卡组')+'"><option value="">'+I.term('选择预设 / 已保存卡组')+'</option>'+T.list().map(d=>'<option '+(d.custom?'data-user-content ':'')+'value="'+d.id+'">'+esc(I.deck(d).name)+'</option>').join('')+'</select></div>':'')+
 '<label class="ws-name-label"><span>'+I.term('卡组名称')+'</span><input id="ws-name" maxlength="40" aria-label="'+I.term('卡组名称')+'" data-user-content value="'+esc(draft.name)+'"'+(siding?' readonly':'')+'></label>'+
 '<button class="ws-sort" data-action="ws-sort"'+(siding?.locked?' disabled':'')+'>'+tr('排序','Sort','並べ替え')+'</button><div class="ws-tools">'+(!siding?'<button data-action="ws-new">'+I.term('＋ 空白卡组')+'</button><button data-action="ws-clone">'+I.term('复制当前')+'</button>':'')+
 '<button data-action="ws-undo"'+(!undo.length||siding?.locked?' disabled':'')+'>↶ '+I.term('撤销')+'</button><button data-action="ws-redo"'+(!redo.length||siding?.locked?' disabled':'')+'>↷ '+I.term('重做')+'</button>'+
 (!siding?'<button data-action="ws-import">'+I.term('导入')+'</button><button data-action="ws-ai-import">✧ '+I.term('AI 导入')+'</button><button data-action="ws-export">'+I.term('导出')+'</button>'+(draft.id?'<button data-action="ws-delete">'+I.term(deleteArmed?'确认删除？':'删除')+'</button>':''):'<button data-action="ws-reset-siding"'+(siding.locked?' disabled':'')+'>'+tr('恢复本轮开始','Reset this round','このラウンドをリセット')+'</button>')+'</div>';
 renderNav();
}
function renderNav(){
 $('#ws-zone-nav').innerHTML=E.zones.map(z=>'<button data-action="ws-zone" data-zone="'+z+'" data-ws-drop="'+z+'">'+zn(z)+' <b>'+draft[z].length+'</b></button>').join('')+(!siding?'<button data-action="ws-view" data-view="collection" data-ws-drop="library" class="ws-library-tab">'+tr('牌库','Library','ライブラリ')+'</button>':'');
 $('.workshop-layout').dataset.mobileView=siding?'build':mobileView;
}
function renderInspector(){
 const el=$('#ws-inspector');if(!el)return;const c=CARDS[focus]||CARDS[cards[0].id];focus=c.id;
 const source=focusSource&&focusSource.id===focus?focusSource:{zone:'library',id:focus},canDrag=!siding?.locked&&(!siding||source.zone!=='library');
 el.innerHTML='<button class="ws-mobile-close" data-action="ws-close-preview">'+I.term('关闭预览')+' ×</button><div class="ws-preview" draggable="'+canDrag+'" data-drag-zone="'+source.zone+'" data-id="'+c.id+'"'+(source.index!==undefined?' data-index="'+source.index+'"':'')+'>'+V.card(c.id)+'</div><div class="ws-card-details">'+V.details(c.id)+'</div>';
 el.querySelectorAll('img').forEach(img=>img.draggable=false);
}
function filtered(){const q=query.trim().normalize('NFKC').toLowerCase();return cards.filter(c=>V.yearMatch(c,year)&&(!onlyPlayable||c.implementationStatus!=='pending')&&(family==='all'||D.isFamily(c,family))&&(type==='all'||type==='monster'&&D.isMonster(c)||type==='tuner'&&c.tuner||c.type===type)&&(!onlyIncluded||count(c.id))&&(!q||I.searchText(c.id).includes(q)));}
function renderCollection(){
 if(!$('#ws-card-grid'))return;const size=host.getPageSize?.()||24,list=filtered(),pages=Math.max(1,Math.ceil(list.length/size));page=Math.max(0,Math.min(page,pages-1));
 $('#ws-filters').innerHTML=types.map(([id,label])=>'<button data-action="ws-filter" data-filter="'+id+'" class="'+(type===id?'active':'')+'">'+I.term(label)+'</button>').join('');
 $('#ws-result-count').textContent=list.length+' / '+cards.length;$('#ws-filter-result').textContent=String(list.length);
 $('#ws-card-grid').innerHTML=list.slice(page*size,page*size+size).map(raw=>{const c=CARDS[raw.id],n=count(c.id);return '<article class="ws-card'+(focus===c.id?' focused':'')+'" draggable="true" data-drag-zone="library" data-id="'+c.id+'"><button class="ws-card-face" data-action="ws-inspect" data-id="'+c.id+'" aria-label="'+esc(c.name)+'">'+V.card(c.id)+'</button><button class="ws-card-name" data-action="ws-inspect" data-id="'+c.id+'"><strong>'+esc(c.name)+'</strong><small>'+V.kind(c)+'</small><span>'+E.zones.map(z=>draft[z].filter(id=>id===c.id).length).join(' / ')+'</span></button><div class="ws-count-controls"><span>'+n+'</span></div></article>';}).join('')||'<div class="empty-state">'+I.term('没有符合条件的卡片。')+'<button data-action="ws-reset-filters">'+I.term('清空筛选')+'</button></div>';
 $('#ws-card-grid').querySelectorAll('img').forEach(img=>img.draggable=false);
 $('#ws-pagination').innerHTML='<label class="page-size-control">'+I.term('每页')+' <select id="ws-page-size">'+root.DuelExperience.PAGE_SIZES.map(n=>'<option value="'+n+'"'+(size===n?' selected':'')+'>'+n+'</option>').join('')+'</select></label><div class="page-navigation"><button data-action="ws-page" data-delta="-1"'+(!page?' disabled':'')+'>←</button><label><input id="ws-page-jump" type="number" min="1" max="'+pages+'" value="'+(page+1)+'"> / '+pages+'</label><button data-action="ws-page" data-delta="1"'+(page>=pages-1?' disabled':'')+'>→</button></div>';
}
function pile(zone){
 const list=draft[zone];return '<section class="ws-pile" data-zone="'+zone+'" data-ws-drop="'+zone+'"><div class="ws-pile-heading"><h3>'+zn(zone)+'</h3><b>'+list.length+'</b></div><div class="ws-deck-rows">'+(list.map((id,index)=>{const c=CARDS[id],name=c?.name||id;return '<article class="ws-deck-row" draggable="'+!siding?.locked+'" data-drag-zone="'+zone+'" data-zone="'+zone+'" data-index="'+index+'" data-id="'+esc(id)+'"><button data-action="ws-inspect" data-zone="'+zone+'" data-index="'+index+'" data-id="'+esc(id)+'" class="ws-deck-card" aria-label="'+esc(name)+'">'+(c?V.card(id):esc(id))+'</button>'+(!siding?'<button class="ws-delete-card" data-action="ws-remove" data-zone="'+zone+'" data-index="'+index+'" data-id="'+esc(id)+'" aria-label="'+I.term('删除')+' '+esc(name)+'" title="'+I.term('删除')+'" draggable="false">×</button>':'')+'</article>';}).join('')||'<div class="ws-empty-pile">'+tr('拖入卡片','Drop cards here','カードをドロップ')+'</div>')+'</div></section>';
}
function renderBuild(){
 if(!$('#ws-build-content'))return;
 $('#ws-build-content').innerHTML=E.zones.map(pile).join('');
 $('#ws-build-content').querySelectorAll('img').forEach(img=>img.draggable=false);
 $('#ws-draft-status').textContent=siding?.locked?tr('已确认，等待对手','Confirmed; waiting for opponent','確定済み・相手を待機'):savedNote;
 for(const id of ['ws-save','ws-play'])if($('#'+id))$('#'+id).disabled=!!siding?.locked;
 renderNav();
}
function transfer(source,target){
 if(siding?.locked)return;
 try{const next=E.transfer(draft,source,target,{registered:siding?.registered});if(JSON.stringify(next)===JSON.stringify(draft))return;remember();draft=next;focusSource=null;if(source.zone==='library')mobileView='build';changes();}
 catch(e){host.toast(I.text(e.message),true);}
}
function remove(id,zone,index){if(siding)return;transfer({id,zone,index:Number(index)},{zone:'library'});}
async function save(play=false){
 try{
  if(siding){if(siding.locked)return;const check=E.check(draft,siding.registered);if(!check.valid)throw Error(check.errors.join('\n'));await siding.submit(clone(draft));return;}
  draft=T.saveDraft(draft);persist();renderToolbar();renderBuild();host.toast(I.term('卡组已保存。'));if(play)host.play(draft.id);
 }catch(e){host.toast(I.text(e.message),true);}
}
function download(){try{const text=T.exportJSON(draft,{allowDraft:true}),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=draft.name.replace(/[<>:"/\\|?*]/g,'_')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}catch(e){host.toast(I.text(e.message),true);}}
function handle(action,b){
 if(!action.startsWith('ws-'))return false;
 if(Date.now()<suppressClickUntil)return true;
 if(siding&&['ws-new','ws-clone','ws-import','ws-ai-import','ws-delete','ws-play','ws-remove'].includes(action))return true;
 if(siding?.locked&&['ws-sort','ws-undo','ws-redo','ws-reset-siding','ws-drop'].includes(action))return true;
 switch(action){
 case 'ws-toggle-filters':{const el=$('.ws-collection');mobileView='collection';renderNav();const open=el.classList.toggle('filters-open');$('#ws-filter-toggle').setAttribute('aria-expanded',String(open));break;}
 case 'ws-view':mobileView=b.dataset.view;renderNav();break;
 case 'ws-zone':mobileView='build';renderNav();$('.ws-pile[data-zone="'+b.dataset.zone+'"]').scrollIntoView({block:'start',behavior:'smooth'});break;
 case 'ws-remove':remove(b.dataset.id,b.dataset.zone,b.dataset.index);break;
 case 'ws-drop':if(menuSource){const source=menuSource;closeMenu();transfer(source,{zone:b.dataset.zone});}break;
 case 'ws-inspect':focus=b.dataset.id;focusSource={id:focus,zone:b.dataset.zone||'library',...(b.dataset.index!==undefined?{index:Number(b.dataset.index)}:{})};renderInspector();$('#ws-inspector').classList.add('mobile-open');break;
 case 'ws-close-preview':$('#ws-inspector').classList.remove('mobile-open');break;
 case 'ws-sort':remember();for(const z of E.zones)draft[z].sort((a,b)=>(CARDS[a]?.type||'').localeCompare(CARDS[b]?.type||'')||a.localeCompare(b));changes();break;
 case 'ws-reset-siding':if(siding){remember();draft=clone(siding.baseline);changes();}break;
 case 'ws-filter':type=b.dataset.filter;page=0;renderCollection();break;
 case 'ws-reset-filters':query='';family='all';year='all';type='all';onlyIncluded=false;onlyPlayable=true;page=0;show();break;
 case 'ws-page':page+=Number(b.dataset.delta);renderCollection();$('#ws-card-grid').scrollTop=0;break;
 case 'ws-new':remember();draft={name:I.term('我的新卡组'),cards:[],extra:[],side:[]};persist();show();break;
 case 'ws-clone':remember();draft={...clone(draft),name:(draft.name+' · '+I.term('副本')).slice(0,40)};delete draft.id;persist();show();break;
 case 'ws-undo':if(undo.length){redo.push(clone(draft));draft=undo.pop();persist();show();}break;
 case 'ws-redo':if(redo.length){undo.push(clone(draft));draft=redo.pop();persist();show();}break;
 case 'ws-recovery':{const values={};for(const key of [T.STORAGE,T.STORAGE+'-recovery','duel-sanctuary-custom-decks-v2',DRAFT,DRAFT+'-recovery'])values[key]=localStorage.getItem(key);const url=URL.createObjectURL(new Blob([JSON.stringify(values,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='deck-recovery.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);break;}
 case 'ws-save':save();break;case 'ws-play':save(true);break;case 'ws-export':download();break;case 'ws-import':$('#ws-import-file').click();break;case 'ws-ai-import':host.aiImport();break;
 case 'ws-delete':if(draft.id){if(!deleteArmed){deleteArmed=true;renderToolbar();setTimeout(()=>{deleteArmed=false;renderToolbar();},4500);}else try{T.remove(draft.id);delete draft.id;deleteArmed=false;persist();renderToolbar();}catch(e){host.toast(e.message,true);}}break;
 }return true;
}
function input(el){if(el.id==='ws-search'){query=el.value;page=0;renderCollection();return true;}if(!siding&&el.id==='ws-name'){draft.name=el.value;persist();renderBuild();return true;}if(!siding&&el.id==='ws-notes'){draft.notes=el.value;persist();return true;}return false;}
async function change(el){
 if(el.id==='ws-page-size'){host.setPageSize?.(el.value);page=0;}if(el.id==='ws-page-jump')page=Math.max(0,Math.floor(Number(el.value)||1)-1);
 if(el.id==='ws-year'){year=el.value;page=0;}if(el.id==='ws-family'){family=el.value;page=0;}if(el.id==='ws-playable'){onlyPlayable=el.checked;page=0;}if(el.id==='ws-included'){onlyIncluded=el.checked;page=0;}
 if(el.id==='ws-source'&&el.value){show(el.value);return;}
 if(el.id==='ws-import-file'&&el.files?.[0]&&!siding){try{const file=el.files[0];if(file.size>100000)throw Error(I.term('卡组文件过大，请选择导出的 JSON 卡组。'));const text=await file.text();let imported;if(text.trim().startsWith('{')){const obj=JSON.parse(text);if(Array.isArray((obj.deck||obj).cards))imported=E.normalize(obj.deck||obj);}if(!imported){const parsed=root.DuelDeckParse.parse(text),resolver=root.DuelCardResolver.create();imported=resolver.draft(resolver.resolveDeck(parsed.decks[0])).deck;}importDraft(imported);}catch(e){host.toast(e.message,true);}finally{el.value='';}return;}renderCollection();
}
function importDraft(value){if(siding)exitSiding();remember();draft=E.normalize(value);persist();show();}
function showSiding(config){if(!siding){normalDraft=clone(draft);undo=[];redo=[];}if(siding?.roundId!==config.roundId){draft=E.normalize(config.draft||config.baseline);undo=[];redo=[];}siding=config;show();}
function exitSiding(){stopDrag();closeMenu();if(!siding)return;siding=null;draft=normalDraft;normalDraft=null;undo=[];redo=[];}
function sourceOf(el){const n=el?.closest('[data-drag-zone]');if(!n||n.draggable===false)return null;return {zone:n.dataset.dragZone,id:n.dataset.id,...(n.dataset.index!==undefined?{index:Number(n.dataset.index)}:{})};}
function dropAt(x,y){
 const hit=document.elementFromPoint(x,y),target=hit?.closest('[data-ws-drop]');
 if(!target)return null;const zone=target.dataset.wsDrop,row=hit.closest('.ws-deck-row');
 return {zone,...(row&&row.dataset.zone===zone?{index:Number(row.dataset.index)}:{})};
}
function highlight(target){document.querySelectorAll('.ws-drag-over').forEach(n=>n.classList.remove('ws-drag-over'));if(target)document.querySelectorAll('[data-ws-drop="'+target.zone+'"]').forEach(n=>n.classList.add('ws-drag-over'));}
function stopDrag(){clearTimeout(touchHold);cancelAnimationFrame(dragFrame);dragState?.ghost?.remove();dragState=null;touchStart=null;highlight(null);$('#modal')?.classList.remove('ws-dragging');}
function tickDrag(){
 if(!dragState||!$('#modal')?.open||!$('.workshop-layout')){stopDrag();return;}
 const {x,y}=dragState,hit=document.elementFromPoint(x,y),scroller=hit?.closest('.ws-build,.ws-card-grid,.workshop-layout');
 if(scroller&&scroller.scrollHeight>scroller.clientHeight){const r=scroller.getBoundingClientRect(),edge=Math.min(50,r.height/4);if(y<r.top+edge)scroller.scrollTop-=10;else if(y>r.bottom-edge)scroller.scrollTop+=10;}
 dragFrame=requestAnimationFrame(tickDrag);
}
function beginDrag(source,node,x,y,touch=false){
 closeMenu();stopDrag();dragState={source,x,y};$('#modal').classList.add('ws-dragging');
 if(touch){const ghost=document.createElement('div');ghost.className='ws-drag-ghost';ghost.innerHTML=node.querySelector('.playing-card')?.outerHTML||esc(CARDS[source.id]?.name||source.id);$('#modal').append(ghost);dragState.ghost=ghost;}
 if(touch)$('#ws-inspector')?.classList.remove('mobile-open');
 pointDrag(x,y);tickDrag();
}
function pointDrag(x,y){if(!dragState)return;dragState.x=x;dragState.y=y;if(dragState.ghost)dragState.ghost.style.transform='translate('+(x+14)+'px,'+(y-35)+'px)';highlight(dropAt(x,y));}
function finishDrag(x,y){const source=dragState?.source,target=dropAt(x,y),touch=!!dragState?.ghost&&!dragState?.customMouse;stopDrag();if(touch)suppressClickUntil=Date.now()+350;if(source&&target){$('#ws-inspector')?.classList.remove('mobile-open');transfer(source,target);}}
function closeMenu(){$('#ws-card-menu')?.remove();menuSource=null;}
function menu(source,x,y){
 closeMenu();if(siding?.locked)return;menuSource=source;const n=document.createElement('div');n.id='ws-card-menu';n.className='ws-card-menu';n.setAttribute('role','menu');
 n.innerHTML=E.zones.map(z=>'<button role="menuitem" data-action="ws-drop" data-zone="'+z+'">'+zn(z)+'</button>').join('')+(!siding&&source.zone!=='library'?'<button role="menuitem" data-action="ws-drop" data-zone="library">'+I.term('删除')+'</button>':'');
 $('#modal').append(n);n.style.left=Math.min(x,innerWidth-n.offsetWidth-8)+'px';n.style.top=Math.min(y,innerHeight-n.offsetHeight-8)+'px';n.querySelector('button').focus();
}
function wireDrag(){
 const surface=$('#modal .modal-body');
 // Detail previews can cover the drop destination. Use a captured pointer and
 // the same transfer command, so closing that overlay cannot cancel an HTML drag.
 let previewPointer=null;
 surface.onpointerdown=e=>{
  const node=e.target.closest('.ws-preview'),source=node&&sourceOf(node);
  if(e.pointerType!=='mouse'||e.button!==0||!source||siding?.locked)return;
  e.preventDefault();surface.setPointerCapture(e.pointerId);previewPointer={source,node,x:e.clientX,y:e.clientY,id:e.pointerId};
 };
 surface.onpointermove=e=>{
  const p=previewPointer;if(!p||e.pointerId!==p.id)return;
  if(!dragState&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>6){beginDrag(p.source,p.node,e.clientX,e.clientY,true);dragState.customMouse=true;}
  if(dragState){e.preventDefault();pointDrag(e.clientX,e.clientY);}
 };
 surface.onpointerup=e=>{
  if(!previewPointer||e.pointerId!==previewPointer.id)return;previewPointer=null;
  if(surface.hasPointerCapture(e.pointerId))surface.releasePointerCapture(e.pointerId);
  if(dragState)finishDrag(e.clientX,e.clientY);
 };
 surface.onpointercancel=e=>{if(previewPointer?.id===e.pointerId){previewPointer=null;stopDrag();}};
 surface.ondragstart=e=>{if(e.target.closest('.ws-delete-card,.ws-preview')||siding?.locked){e.preventDefault();return;}const source=sourceOf(e.target);if(!source){e.preventDefault();return;}const node=e.target.closest('[data-drag-zone]');e.dataTransfer.effectAllowed=source.zone==='library'?'copy':'move';e.dataTransfer.setData('application/x-duel-card',JSON.stringify(source));e.dataTransfer.setDragImage(node,Math.min(60,node.clientWidth/2),40);beginDrag(source,node,e.clientX,e.clientY);};
 surface.ondragover=e=>{if(!dragState)return;pointDrag(e.clientX,e.clientY);const target=dropAt(e.clientX,e.clientY);if(target){e.preventDefault();e.dataTransfer.dropEffect=dragState.source.zone==='library'?'copy':'move';}};
 surface.ondrop=e=>{if(dragState){e.preventDefault();finishDrag(e.clientX,e.clientY);}};
 surface.ondragend=stopDrag;
 surface.oncontextmenu=e=>{const source=sourceOf(e.target);if(source){e.preventDefault();menu(source,e.clientX,e.clientY);}};
 surface.onkeydown=e=>{const source=sourceOf(e.target);if(e.key==='Escape'){closeMenu();stopDrag();}else if(source&&(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10')){e.preventDefault();const r=e.target.getBoundingClientRect();menu(source,r.left,r.bottom);}else if(source&&e.key==='Delete'&&!siding&&source.zone!=='library'){e.preventDefault();transfer(source,{zone:'library'});}};
 surface.addEventListener('touchstart',e=>{
  if(e.touches.length!==1||e.target.closest('.ws-delete-card')||siding?.locked)return;const source=sourceOf(e.target);if(!source)return;
  const t=e.touches[0],node=e.target.closest('[data-drag-zone]');touchStart={x:t.clientX,y:t.clientY};
  touchHold=setTimeout(()=>beginDrag(source,node,t.clientX,t.clientY,true),220);
 },{passive:true});
 surface.addEventListener('touchmove',e=>{const t=e.touches[0];if(!t)return;if(dragState?.ghost){e.preventDefault();pointDrag(t.clientX,t.clientY);}else if(touchStart&&Math.hypot(t.clientX-touchStart.x,t.clientY-touchStart.y)>10){clearTimeout(touchHold);touchStart=null;}},{passive:false});
 surface.addEventListener('touchend',e=>{clearTimeout(touchHold);touchStart=null;if(dragState?.ghost){e.preventDefault();const t=e.changedTouches[0];finishDrag(t.clientX,t.clientY);}},{passive:false});
 surface.addEventListener('touchcancel',stopDrag);
}
return {show,showSiding,exitSiding,handle,input,change,importDraft,get draft(){return clone(draft);}};
}
root.DuelWorkshop={create};
})(globalThis);
