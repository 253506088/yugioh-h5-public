/* Local embedded art only. Missing or corrupt art never blocks gameplay. */
(function(root){
 'use strict';
 const {CARDS}=root.DuelData,embedded=root.DUEL_ORIGINAL_ART||{},urls=new Map(),failed=new Set(),watched=new WeakSet();
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let enabled=true,refreshTimer;
 try{enabled=localStorage.getItem('duel-local-art-enabled-v4')!=='false';}catch{}
 function src(id){
  if(!enabled||failed.has(id)||!embedded[id])return null;
  if(urls.has(id))return urls.get(id);
  try{const raw=embedded[id],match=/^data:(image\/(?:jpeg|png|webp|svg\+xml));base64,([A-Za-z0-9+/=]+)$/.exec(raw);if(!match)return null;const decoded=atob(match[2]),bytes=new Uint8Array(decoded.length);for(let i=0;i<bytes.length;i++)bytes[i]=decoded.charCodeAt(i);const url=URL.createObjectURL(new Blob([bytes],{type:match[1]}));urls.set(id,url);return url;}catch{failed.add(id);return null;}
 }
 function html(id,cls='',label=''){
  const c=CARDS[id];if(!c)return '';const url=src(id),symbol={ritual:'✧',fusion:'∞',synchro:'✧',xyz:'✦',pendulum:'◈',link:'⌘'}[c.type]||'◇';
  return '<span class="artwork '+esc(cls)+(url?' has-art':'')+'" data-artwork="'+esc(id)+'"><span class="art-placeholder" aria-hidden="true"><b>'+symbol+'</b><span>'+esc(c.name)+'</span><small>'+(c.releaseYear?'OCG · '+c.releaseYear:'DUEL ARCHIVE')+'</small></span><img '+(url?'src="'+esc(url)+'" ':'')+'data-art-id="'+esc(id)+'" alt="'+esc(label||c.name)+'" loading="lazy" decoding="async" draggable="false"></span>';
 }
 function status(){return {enabled,online:false,mode:'embedded',cached:Object.keys(embedded).length,loading:0,failed:failed.size};}
 function announce(){root.dispatchEvent(new CustomEvent('duel-art-status',{detail:status()}));}
 function refresh(container=document){for(const img of container.querySelectorAll('img[data-art-id]')){
  const url=src(img.dataset.artId);if(url&&img.getAttribute('src')!==url)img.src=url;if(!url){img.removeAttribute('src');img.parentElement?.classList.remove('has-art');}
  if(watched.has(img))continue;watched.add(img);img.addEventListener('load',()=>img.parentElement?.classList.add('has-art'));img.addEventListener('error',()=>{failed.add(img.dataset.artId);img.removeAttribute('src');img.parentElement?.classList.remove('has-art');announce();});
 }}
 function setEnabled(value){enabled=!!value;try{localStorage.setItem('duel-local-art-enabled-v4',String(enabled));}catch{}refresh();announce();}
 const observer=new MutationObserver(()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,35);});observer.observe(document.body,{childList:true,subtree:true});
 root.DuelArt={html,src,refresh,status,setEnabled,request:()=>{},retry:()=>{failed.clear();refresh();announce();},full:src,validateURL:()=>null,normalize:s=>String(s).toLowerCase().trim()};
})(globalThis);
