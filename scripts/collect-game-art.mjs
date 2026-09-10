/* Run manually. Incremental artwork collection never changes card effects. */
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {appendFileSync} from 'node:fs';
import {resolve,dirname,join,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {inspectImage,sha256,validImageURL,normalizedName} from './lib/yearly-catalog.mjs';
import {writeAtomic} from './lib/io.mjs';
import {createProgressLogger} from './lib/collection-progress.mjs';
const projectRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const safe=(root,path)=>{const dest=resolve(root,path);if(!dest.startsWith(root+sep))throw new Error('输出必须位于项目目录内');return dest;};
async function json(file,fallback){try{return JSON.parse(await readFile(file,'utf8'));}catch{return fallback;}}
async function save(file,value){await writeAtomic(file,JSON.stringify(value,null,2)+'\n');}
export async function collectGameArt({root=projectRoot,cards=null,years=null,ids=null,variant='cropped',offline=false,plan=false,force=false,delayMs=550,fetcher=globalThis.fetch,sharp=null,onProgress=()=>{}}={}){
 if(!['cropped','full','both'].includes(variant))throw new Error('--variant 只能是 cropped、full 或 both');
 cards||=require('../src/early-cards.js').CARD_LIST;
 const selected=cards.filter(c=>!c.notCollectible&&(!years||years.includes(c.releaseYear))&&(!ids||ids.includes(c.id)));
 if(!selected.length)throw new Error('筛选范围中没有卡片');
 const startedAt=new Date().toISOString(),run=safe(root,'output/game-art/run-'+startedAt.replace(/[:.]/g,'-')),indexPath=safe(root,'assets/official-archive/index.json'),identityPath=safe(root,'data/providers/game-art-identities.json');
 const index=await json(indexPath,{schemaVersion:1,entries:{}}),identities=await json(identityPath,{schemaVersion:1,cards:{}});
 const report={schemaVersion:1,startedAt,mode:plan?'plan':offline?'offline':'incremental',selectedCards:selected.length,variant,reused:0,downloaded:0,pending:0,metadataNeeded:0,failures:[],cards:[],archive:relative(root,run).replaceAll(sep,'/')};
 await mkdir(join(run,'raw'),{recursive:true});
 const kinds=variant==='both'?['cropped','full']:[variant],totalImages=selected.length*kinds.length;
 let failedImages=0,currentOperation='检查缓存';
 const progress=(type,extra={})=>{const processed=report.reused+report.downloaded+report.pending+failedImages;onProgress({type,...extra,counts:{processed,total:totalImages,reused:report.reused,downloaded:report.downloaded,pending:report.pending,failed:failedImages,remaining:Math.max(0,totalImages-processed),missing:Math.max(0,totalImages-report.reused-report.downloaded)}});};
 const localized=await json(join(root,'data/locales/cards.json'),{cards:{}});
 const displayName=card=>localized.cards?.[card.id]?.locales?.['zh-CN']?.name||card.name||card.officialName;
 const identityFor=card=>{const known=card.providerId?{providerId:card.providerId,imageId:Number(card.imageKeys?.find(k=>k.startsWith('cropped:'))?.split(':')[1]||card.providerId),name:card.officialName}:identities.cards[card.id];return known&&normalizedName(known.name)===normalizedName(card.officialName)?known:null;};
 progress('start',{cards:selected.length,total:totalImages,archive:report.archive,mode:plan?'仅预检，不联网':offline?'离线检查':'增量下载'});
 let cachedEstimate=0,unresolved=0;
 for(const card of selected){const identity=identityFor(card);if(!identity){unresolved++;continue;}if(force)continue;for(const kind of kinds){const cached=index.entries[kind+':'+identity.imageId];if(cached?.path)try{await access(safe(root,cached.path));cachedEstimate++;}catch{}}}
 progress('plan',{cached:cachedEstimate,missing:totalImages-cachedEstimate,unresolved});
 const heartbeat=setInterval(()=>progress('heartbeat',{operation:currentOperation}),5000);heartbeat.unref?.();
 try{
 async function fetchBytes(url,kind){
  for(let attempt=0;attempt<3;attempt++){
   await pause(delayMs);const control=new AbortController(),timer=setTimeout(()=>control.abort(),30000);
   try{const r=await fetcher(url,{signal:control.signal,credentials:'omit',redirect:'error',headers:{accept:kind==='json'?'application/json':'image/jpeg,image/png,image/webp'}});if([429,500,502,503,504].includes(r.status)&&attempt<2){progress('retry',{attempt:attempt+2,reason:'HTTP '+r.status});await pause(Math.min(15000,1500*2**attempt));continue;}if(!r.ok)throw new Error('HTTP '+r.status);const content=r.headers.get('content-type')||'';if(kind==='json'?!/json/i.test(content):!/^image\/(jpeg|png|webp)/.test(content))throw new Error('响应类型不正确');const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length>(kind==='json'?5_000_000:15_000_000))throw new Error('单次响应过大');return bytes;}finally{clearTimeout(timer);}
  }throw new Error('重试耗尽');
 }
 let stopped=false;
 for(const card of selected){
  const item={id:card.id,name:card.officialName,year:card.releaseYear||null,images:[]};report.cards.push(item);
  try{
   let identity=identityFor(card);currentOperation='处理 '+displayName(card);
   if(!identity){
    report.metadataNeeded++;
    if(plan||offline||stopped){item.status='metadata_pending';report.pending+=variant==='both'?2:1;continue;}
    progress('metadata',{name:displayName(card)});const url='https://db.ygoprodeck.com/api/v7/cardinfo.php?name='+encodeURIComponent(card.officialName),raw=await fetchBytes(url,'json');await writeFile(join(run,'raw',card.id+'.json'),raw);
    const data=JSON.parse(raw),entry=data.data?.find(c=>normalizedName(c.name)===normalizedName(card.officialName)),picture=entry?.card_images?.[0];
    if(!entry||!picture||!validImageURL(picture.image_url_cropped,picture.id,'cropped')||!validImageURL(picture.image_url,picture.id,'full'))throw new Error('没有找到名称准确匹配的卡图身份');
    identity={providerId:entry.id,imageId:picture.id,name:entry.name,encyclopediaUrl:entry.ygoprodeck_url||null};identities.cards[card.id]=identity;await save(identityPath,identities);
   }
   for(const kind of variant==='both'?['cropped','full']:[variant]){
    const key=kind+':'+identity.imageId,url='https://images.ygoprodeck.com/images/'+(kind==='cropped'?'cards_cropped':'cards')+'/'+identity.imageId+'.jpg',cached=index.entries[key];let bytes;
    if(cached?.path&&!force){try{bytes=await readFile(safe(root,cached.path));if(sha256(bytes)!==cached.sha256)bytes=null;}catch{bytes=null;}}
    if(bytes){report.reused++;item.images.push({key,status:'reused'});if(!plan){cached.gameIds=[...new Set([...(cached.gameIds||[]),card.id])];cached.cardNames=[...new Set([...(cached.cardNames||[]),card.officialName])];}progress('reused',{name:displayName(card),kind});continue;}
    if(plan||offline||stopped){report.pending++;item.images.push({key,status:'missing'});continue;}
    currentOperation='下载 '+displayName(card)+' ('+kind+')';progress('download',{name:displayName(card),kind});sharp||=require('sharp');bytes=await fetchBytes(url,'image');const inspected=await inspectImage(bytes,sharp),file=safe(root,'assets/official-archive/objects/'+inspected.sha256+'.'+inspected.extension);await mkdir(dirname(file),{recursive:true});await writeFile(file,bytes);
    let derived=null;if(kind==='cropped'){const data=await sharp(bytes).resize({width:512,height:512,fit:'inside',withoutEnlargement:true}).webp({quality:90}).toBuffer(),hash=sha256(data),path=safe(root,'assets/official-archive/derived/'+hash+'.webp');await mkdir(dirname(path),{recursive:true});await writeFile(path,data);derived={path:relative(root,path).replaceAll(sep,'/'),sha256:hash,bytes:data.length};}
    index.entries[key]={...inspected,key,imageId:identity.imageId,kind,sourceURL:url,cardUids:[...new Set([...(cached?.cardUids||[]),'ygoprodeck:'+identity.providerId])],gameIds:[...new Set([...(cached?.gameIds||[]),card.id])],cardNames:[...new Set([...(cached?.cardNames||[]),card.officialName])],selectedYears:[...new Set([...(cached?.selectedYears||[]),...(card.releaseYear?[card.releaseYear]:[])])],path:relative(root,file).replaceAll(sep,'/'),derived,obtainedAt:startedAt,checkedAt:new Date().toISOString(),obtainedBy:'manual_game_art_collector'};
    report.downloaded++;item.images.push({key,status:'downloaded'});await save(indexPath,index);progress('saved',{name:displayName(card),kind});
   }
  }catch(error){report.failures.push({id:card.id,reason:error.message});item.status='failed';failedImages+=kinds.length-item.images.length;progress('failure',{name:displayName(card),reason:error.message});if(/EACCES|EPERM|fetch failed|approval|审批|denied/i.test(error.message))stopped=true;}
 }
 if(!plan)await save(indexPath,index);
 report.finishedAt=new Date().toISOString();report.failedImages=failedImages;report.missingImages=report.pending+failedImages;report.complete=report.pending===0&&report.failures.length===0;
 await save(join(run,'report.json'),report);await save(join(run,'asset-index-snapshot.json'),index);await save(safe(root,'output/game-art/latest-report.json'),report);
 progress('finish',{complete:report.complete,report:report.archive+'/report.json'});return report;
 }finally{clearInterval(heartbeat);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const argv=process.argv.slice(2),arg=(name,fallback=null)=>{const at=argv.indexOf(name);if(at<0)return fallback;if(!argv[at+1]||argv[at+1].startsWith('--'))throw new Error(name+' 缺少参数');return argv[at+1];};
 if(argv.includes('--help'))console.log('node scripts/collect-game-art.mjs [--years 1999,2000,2001] [--ids blue-eyes,early-64631466] [--variant cropped|full|both] [--plan] [--offline] [--force] [--quiet]\n默认增量：校验并复用已有文件，只请求缺失图片；无需 --resume。--plan 不联网，也不修改卡图索引。\n默认显示总量、下载、复用、失败和剩余进度；等待请求时每5秒显示状态。--quiet 仅向标准输出打印最终 JSON，完整日志仍写入本次归档的 progress.log。');
 else try{
  let progressPath;
  const logger=createProgressLogger({write:message=>{if(!argv.includes('--quiet'))console.log(message);if(progressPath)appendFileSync(progressPath,message+'\n','utf8');}});
  const report=await collectGameArt({years:arg('--years')?.split(',').map(Number),ids:arg('--ids')?.split(','),variant:arg('--variant','cropped'),plan:argv.includes('--plan'),offline:argv.includes('--offline'),force:argv.includes('--force'),onProgress:event=>{if(event.type==='start')progressPath=join(projectRoot,event.archive,'progress.log');logger.handle(event);}});
  console.log(JSON.stringify({selected:report.selectedCards,reused:report.reused,downloaded:report.downloaded,pending:report.pending,failedImages:report.failedImages,missingImages:report.missingImages,failures:report.failures,report:report.archive+'/report.json'},null,2));
  if(!report.complete&&!argv.includes('--plan'))process.exitCode=2;
 }catch(e){console.error(e.message);process.exitCode=1;}
}
