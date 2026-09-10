/* Embedded art first; optional online fallback. Neither source is required for rules. */
(function(root){
 'use strict';
 const D=root.DuelData,embedded=root.DUEL_ORIGINAL_ART||{},references=root.DuelCardLocales||{};
 const PREF='duel-local-art-enabled-v4',ONLINE='duel-sanctuary-online-art-v2',CACHE='duel-sanctuary-artwork-v2';
 const blobs=new Map(),embeddedFailed=new Set(),remoteFailed=new Set(),watched=new WeakSet(),queued=new Set(),inflight=new Map(),queue=[];
 const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let enabled=true,onlineEnabled=!!root.DUEL_BUILD_CONFIG?.onlineArtDefault,cache={},refreshTimer,generation=0;
 try{enabled=localStorage.getItem(PREF)!=='false';const old=localStorage.getItem(ONLINE);if(old!==null)onlineEnabled=old==='true';cache=JSON.parse(localStorage.getItem(CACHE)||'{}')||{};}catch{}
 function validateURL(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='images.ygoprodeck.com'&&!u.username&&!u.password&&!u.search&&!u.hash&&(!u.port||u.port==='443')&&/^\/images\/(cards|cards_cropped|cards_small)\/\d+\.jpg$/.test(u.pathname)?u.href:null;}catch{return null;}}
 function validatePage(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='ygoprodeck.com'&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/card\/[a-z0-9-]+\/?$/i.test(u.pathname)?u.href:null;}catch{return null;}}
 function local(id){
  if(!embedded[id]||embeddedFailed.has(id))return null;if(blobs.has(id))return blobs.get(id);
  try{const m=/^data:(image\/(?:jpeg|png|webp|svg\+xml));base64,([A-Za-z0-9+/=]+)$/.exec(embedded[id]);if(!m)throw new Error('Unsupported embedded art');const raw=atob(m[2]),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);const url=URL.createObjectURL(new Blob([bytes],{type:m[1]}));blobs.set(id,url);return url;}catch{embeddedFailed.add(id);return null;}
 }
 function metadata(id){
  const c=D.CARDS[id];if(!c)return null;const reference=references[id];
  const imageId=reference?.imageId||Number(c.imageKeys?.find(k=>k.startsWith('cropped:'))?.split(':')[1]||c.providerId);
  if(Number.isSafeInteger(imageId)&&imageId>0)return {name:c.officialName,id:reference?.providerId||c.providerId,cropped:'https://images.ygoprodeck.com/images/cards_cropped/'+imageId+'.jpg',full:'https://images.ygoprodeck.com/images/cards/'+imageId+'.jpg',page:validatePage(reference?.encyclopediaUrl)};
  const v=cache[id];return v&&norm(v.name)===norm(c.officialName)&&validateURL(v.cropped)?v:null;
 }
 const allowed=()=>enabled&&onlineEnabled&&root.navigator?.onLine!==false;
 function src(id,full=false){if(!enabled)return null;const own=local(id);if(own)return own;if(!allowed()||remoteFailed.has(id))return null;const m=metadata(id);return m?validateURL(full?m.full:m.cropped):null;}
 function kind(id){return enabled&&local(id)?'embedded':allowed()&&metadata(id)&&!remoteFailed.has(id)?'online':'none';}
 function page(id){return validatePage(references[id]?.encyclopediaUrl||metadata(id)?.page);}
 function html(id,cls='',label=''){
  const c=root.DuelI18n?.card(id)||D.CARDS[id];if(!c)return '';const url=src(id),symbol={ritual:'✧',fusion:'∞',synchro:'✧',xyz:'✦',pendulum:'◈',link:'⌘'}[c.type]||'◇';
  return '<span class="artwork '+esc(cls)+'" data-artwork="'+esc(id)+'"><span class="art-placeholder" aria-hidden="true"><b>'+symbol+'</b><span data-i18n-skip>'+esc(c.name)+'</span><small>'+(c.releaseYear?'OCG · '+c.releaseYear:'DUEL ARCHIVE')+'</small></span><img '+(url?'src="'+esc(url)+'" ':'')+'data-art-id="'+esc(id)+'" alt="'+esc(label||c.name)+'" loading="lazy" decoding="async" draggable="false" referrerpolicy="no-referrer"></span>';
 }
 function status(){return {enabled,onlineEnabled,online:root.navigator?.onLine!==false,mode:'hybrid',cached:Object.keys(embedded).length,embedded:Object.keys(embedded).length,onlineCached:Object.keys(cache).length,loading:inflight.size+queue.length,failed:embeddedFailed.size+remoteFailed.size};}
 function announce(){root.dispatchEvent(new CustomEvent('duel-art-status',{detail:status()}));}
 function persist(){try{localStorage.setItem(CACHE,JSON.stringify(cache));}catch{}}
 function assign(img,url){if(!url){img.removeAttribute('src');img.parentElement?.classList.remove('has-art');return;}if(img.getAttribute('src')!==url){img.parentElement?.classList.remove('has-art');img.src=url;}if(img.complete&&img.naturalWidth>0)img.parentElement?.classList.add('has-art');}
 function update(id){for(const img of document.querySelectorAll('img[data-art-id="'+id+'"]'))assign(img,src(id));}
 async function resolve(id){
  const controller=new AbortController(),epoch=generation;inflight.set(id,controller);announce();const timer=setTimeout(()=>controller.abort(),10000);
  try{const c=D.CARDS[id],response=await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php?name='+encodeURIComponent(c.officialName),{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw new Error('HTTP '+response.status);const payload=await response.json(),record=payload.data?.find(r=>norm(r.name)===norm(c.officialName)),picture=record?.card_images?.[0];if(!record||!validateURL(picture?.image_url_cropped)||!validateURL(picture?.image_url))throw new Error('Card identity mismatch');if(epoch!==generation||!allowed())return;cache[id]={name:record.name,id:record.id,cropped:picture.image_url_cropped,full:picture.image_url,page:validatePage(record.ygoprodeck_url)};persist();update(id);}
  catch{if(epoch===generation&&allowed())remoteFailed.add(id);}
  finally{clearTimeout(timer);if(inflight.get(id)===controller)inflight.delete(id);announce();setTimeout(pump,300);}
 }
 function pump(){if(!allowed())return;while(inflight.size<2&&queue.length){const id=queue.shift();queued.delete(id);if(metadata(id)){update(id);continue;}if(!remoteFailed.has(id))resolve(id);}}
 function request(id){if(!allowed()||!D.CARDS[id]||D.CARDS[id].notCollectible||local(id)||remoteFailed.has(id))return;if(metadata(id)){update(id);return;}if(!queued.has(id)&&!inflight.has(id)){queue.push(id);queued.add(id);pump();}}
 const visible=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){request(entry.target.dataset.artId);visible.unobserve(entry.target);}},{rootMargin:'100px'}):null;
 function failed(img){const id=img.dataset.artId,url=img.getAttribute('src');if(!url)return;if(url.startsWith('blob:'))embeddedFailed.add(id);else remoteFailed.add(id);assign(img,src(id));announce();}
 function refresh(container=document){for(const img of container.querySelectorAll('img[data-art-id]')){
  if(!watched.has(img)){watched.add(img);img.addEventListener('load',()=>{if(img.getAttribute('src')&&img.naturalWidth>0)img.parentElement?.classList.add('has-art');});img.addEventListener('error',()=>failed(img));if(visible)visible.observe(img);else request(img.dataset.artId);}
  assign(img,src(img.dataset.artId));
 }}
 function stop(){generation++;queue.length=0;queued.clear();for(const controller of inflight.values())controller.abort();inflight.clear();}
 function setEnabled(value){enabled=!!value;try{localStorage.setItem(PREF,String(enabled));}catch{}if(!enabled)stop();refresh();if(enabled)for(const img of document.querySelectorAll('img[data-art-id]'))if(img.getBoundingClientRect().width)request(img.dataset.artId);announce();}
 function setOnlineEnabled(value){onlineEnabled=!!value;try{localStorage.setItem(ONLINE,String(onlineEnabled));}catch{}if(!onlineEnabled)stop();else remoteFailed.clear();refresh();if(onlineEnabled)for(const img of document.querySelectorAll('img[data-art-id]'))if(img.getBoundingClientRect().width)request(img.dataset.artId);announce();}
 function retry(){embeddedFailed.clear();remoteFailed.clear();refresh();if(allowed())for(const img of document.querySelectorAll('img[data-art-id]'))if(img.getBoundingClientRect().width)request(img.dataset.artId);announce();}
 new MutationObserver(()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refresh(),30);}).observe(document.body,{childList:true,subtree:true});
 root.addEventListener('online',()=>{remoteFailed.clear();retry();});root.addEventListener('offline',()=>{stop();announce();});
 root.DuelArt={html,src,kind,page,refresh,status,request,retry,setEnabled,setOnlineEnabled,full:id=>src(id,true),validateURL,validatePage,normalize:norm};
})(globalThis);
