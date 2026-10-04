import {gzipSync} from 'node:zlib';

// One self-contained payload, with deterministic compression and no URL fetch.
export function embeddedScripts(source){
 const bytes=gzipSync(Buffer.from(source),{level:9});
 return {bytes:bytes.length,code:`/* Offline gzip script bundle; requires a browser with DecompressionStream. */
(async function(){
 try{
  const bytes=Uint8Array.from(atob('${bytes.toString('base64')}'),c=>c.charCodeAt(0));
  const source=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  const script=document.createElement('script');script.textContent=source;document.body.appendChild(script);script.remove();
 }catch(error){
  document.documentElement.dataset.bootError=String(error.message||error);
  const message=document.createElement('p');message.setAttribute('role','alert');message.textContent='无法载入离线游戏。请使用新版 Chrome、Edge、Firefox 或 Safari。 / Unable to load the offline game. Please use a current browser. / オフラインゲームを読み込めません。最新のブラウザーを使用してください。';document.body.prepend(message);console.error(error);
 }
})();`};
}
