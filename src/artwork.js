/* Original card art is optional network content. No game rule depends on it. */
(function(root){
  'use strict';
  const {CARDS}=root.DuelData;
  const CACHE='duel-sanctuary-artwork-v2';
  const PREF='duel-sanctuary-online-art-v2';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
  const embedded=root.DUEL_ORIGINAL_ART||{};
  let cache={},enabled=true,active=0,saveTimer=0,refreshTimer=0,started=0,failed=0;
  const queue=[],queued=new Set(),inflight=new Set(),failures=new Map(),imageFailures=new Map();
  try{cache=JSON.parse(localStorage.getItem(CACHE)||'{}')||{};enabled=localStorage.getItem(PREF)!=='false';}catch{}
  const validURL=value=>{try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='images.ygoprodeck.com'&&/^\/images\/(cards|cards_cropped|cards_small)\/\d+\.jpg$/.test(u.pathname)?u.href:null;}catch{return null;}};
  function entry(id){const v=cache[id];return v&&norm(v.name)===norm(CARDS[id]?.officialName)&&validURL(v.cropped)?v:null;}
  function src(id,full=false){if(embedded[id])return embedded[id];if(!full&&imageFailures.has(id))return null;const v=entry(id);return enabled&&v?validURL(full?v.full:v.cropped):null;}
  function html(id,cls='',label=''){
    const c=CARDS[id];if(!c)return '';
    const url=src(id),letter=c.type==='xyz'?'✦':c.type==='synchro'?'✧':c.type==='pendulum'?'◈':c.type==='fusion'?'∞':'◇';
    return '<span class="artwork '+esc(cls)+(url?' has-art':'')+'" data-artwork="'+esc(id)+'"><span class="art-placeholder" aria-hidden="true"><b>'+letter+'</b><span>'+esc(c.name)+'</span><small>'+(enabled?'ORIGINAL CARD ART':'OFFLINE ARCHIVE')+'</small></span><img '+(url?'src="'+esc(url)+'" ':'')+'data-art-id="'+esc(id)+'" alt="'+esc(label||c.name)+'" loading="lazy" decoding="async" draggable="false" referrerpolicy="no-referrer"></span>';
  }
  function status(){return {enabled,online:typeof navigator==='undefined'||navigator.onLine!==false,cached:Object.keys(cache).filter(id=>entry(id)).length,loading:active+queue.length,failed:failed+imageFailures.size};}
  function announce(){root.dispatchEvent(new CustomEvent('duel-art-status',{detail:status()}));}
  function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(CACHE,JSON.stringify(cache));}catch{}},300);}
  function assign(img,url){if(img.getAttribute('src')===url)return;img.src=url;img.parentElement?.classList.add('has-art');}
  function update(id){const url=src(id);if(url)document.querySelectorAll('img[data-art-id="'+id+'"]').forEach(img=>assign(img,url));}
  async function resolve(id){
    active++;inflight.add(id);started++;announce();
    const control=new AbortController(),timer=setTimeout(()=>control.abort(),9500);
    try{
      const name=CARDS[id].officialName;
      const response=await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php?name='+encodeURIComponent(name),{signal:control.signal,credentials:'omit',referrerPolicy:'no-referrer'});
      if(!response.ok)throw new Error('art '+response.status);
      const data=await response.json(),card=data?.data?.find(c=>norm(c.name)===norm(name));
      const picture=card?.card_images?.[0],cropped=validURL(picture?.image_url_cropped),full=validURL(picture?.image_url);
      if(!card||!cropped||!full)throw new Error('Unverified artwork');
      cache[id]={name:card.name,id:card.id,cropped,full,at:Date.now()};failures.delete(id);persist();update(id);
    }catch{failures.set(id,Date.now());failed++;}
    finally{clearTimeout(timer);active--;inflight.delete(id);announce();setTimeout(pump,270);}
  }
  function pump(){
    if(!enabled||navigator.onLine===false)return;
    while(active<2&&queue.length){const id=queue.shift();queued.delete(id);if(entry(id)){update(id);continue;}if(Date.now()-(failures.get(id)||0)<60000)continue;resolve(id);}
  }
  function request(id){
    if(!enabled||!CARDS[id]||CARDS[id].notCollectible||embedded[id])return;
    if(entry(id)){update(id);return;}
    if(!queued.has(id)&&!inflight.has(id)&&Date.now()-(failures.get(id)||0)>=60000){queue.push(id);queued.add(id);pump();}
  }
  const watched=new WeakSet();
  const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>entries.forEach(item=>{if(item.isIntersecting){request(item.target.dataset.artId);observer.unobserve(item.target);}}),{rootMargin:'80px'}):null;
  function refresh(container=document){
    container.querySelectorAll('img[data-art-id]').forEach(img=>{
      const url=src(img.dataset.artId);if(url)assign(img,url);
      if(watched.has(img))return;watched.add(img);
      img.addEventListener('error',()=>{if(!img.hasAttribute('src'))return;imageFailures.set(img.dataset.artId,Date.now());img.parentElement?.classList.remove('has-art');img.removeAttribute('src');img.parentElement?.classList.add('art-unavailable');announce();});
      img.addEventListener('load',()=>img.parentElement?.classList.add('has-art'));
      if(observer)observer.observe(img);else request(img.dataset.artId);
    });
  }
  function setEnabled(value){
    enabled=!!value;try{localStorage.setItem(PREF,String(enabled));}catch{}
    if(enabled){failures.clear();imageFailures.clear();document.querySelectorAll('img[data-art-id]').forEach(img=>{if(img.getBoundingClientRect().width)request(img.dataset.artId);});pump();}
    else{queue.length=0;queued.clear();document.querySelectorAll('img[data-art-id]').forEach(img=>{if(!embedded[img.dataset.artId]){img.removeAttribute('src');img.parentElement?.classList.remove('has-art');}});}
    announce();
  }
  const mutation=new MutationObserver(()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refresh(),30);});
  mutation.observe(document.body,{childList:true,subtree:true});
  root.addEventListener('online',()=>{failures.clear();imageFailures.clear();refresh();document.querySelectorAll('img[data-art-id]').forEach(img=>request(img.dataset.artId));announce();});
  root.addEventListener('offline',announce);
  root.DuelArt={html,src,refresh,request,status,setEnabled,retry:()=>{failures.clear();imageFailures.clear();failed=0;document.querySelectorAll('img[data-art-id]').forEach(img=>request(img.dataset.artId));},full:id=>src(id,true),validateURL:validURL,normalize:norm};
})(globalThis);
