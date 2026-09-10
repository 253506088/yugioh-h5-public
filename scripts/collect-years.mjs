/* Manual yearly collection; the game also offers an independent optional online-art fallback. */
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {appendFileSync} from 'node:fs';
import {resolve,dirname,join,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {validateScope,normalizeCatalog,inspectImage,sha256} from './lib/yearly-catalog.mjs';
import {writeAtomic} from './lib/io.mjs';
import {createProgressLogger} from './lib/collection-progress.mjs';

const projectRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url);
function argument(argv,name,fallback=null){const at=argv.indexOf(name);if(at<0)return fallback;if(!argv[at+1]||argv[at+1].startsWith('--'))throw new Error('Missing value for '+name);return argv[at+1];}
async function exists(path){try{await access(path);return true;}catch{return false;}}
async function readJSON(path,fallback=null){try{return JSON.parse(await readFile(path,'utf8'));}catch{return fallback;}}
async function saveJSON(path,value){await writeAtomic(path,JSON.stringify(value,null,2)+'\n');}
function taskPath(root,value){const path=resolve(root,value);if(path!==root&&!path.startsWith(root+sep))throw new Error('输出位置必须位于指定工作目录。');return path;}
function loadSharp(){try{return require('sharp');}catch{try{return require(resolve(dirname(process.execPath),'../node_modules/sharp'));}catch{throw new Error('图像验证需要sharp。元数据可用--no-images单独整理，正式图片验收不能跳过解码。');}}}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function collect({root=projectRoot,scopePath='data/yearly/scope-1999-2001.json',catalogPath=null,offline=false,skipImages=false,resume=false,localImageDir=null,fetcher=globalThis.fetch,sharp=null,delayMs=550,onProgress=()=>{}}={}){
  const scope=validateScope(JSON.parse(await readFile(resolve(root,scopePath),'utf8'))),scopeId=scope.startYear+'-'+scope.endYear;
  const at=new Date().toISOString(),run=taskPath(root,'output/yearly-collection/run-'+at.replace(/[:.]/g,'-')),latest=taskPath(root,'output/yearly-collection/latest-report.json');
  await mkdir(join(run,'raw'),{recursive:true});
  const report={schemaVersion:1,startedAt:at,scope:scopeId,status:'starting',catalogRetrieved:false,catalogSnapshot:null,cardCount:null,years:Object.fromEntries(Array.from({length:scope.endYear-scope.startYear+1},(_,i)=>[scope.startYear+i,{cardCount:null,downloadedImages:0,status:'not_started'}])),imageJobs:0,downloadedImages:0,reusedImages:0,importedImages:0,pendingImages:0,failedImages:0,downloadComplete:false,yearCoverageComplete:false,effectsImplementedByThisRun:0,archive:relative(root,run).replaceAll(sep,'/'),failures:[]};
  let operation='读取年度目录';
  const progress=(type,extra={})=>{const reused=report.reusedImages+report.importedImages,processed=report.downloadedImages+reused+report.pendingImages+report.failedImages;onProgress({type,...extra,archive:report.archive,counts:{processed,total:report.imageJobs,downloaded:report.downloadedImages,reused,pending:report.pendingImages,failed:report.failedImages,remaining:Math.max(0,report.imageJobs-processed),missing:Math.max(0,report.imageJobs-report.downloadedImages-reused)}});};
  progress('catalog',{scope:scopeId});
  const heartbeat=setInterval(()=>progress('heartbeat',{operation}),5000);heartbeat.unref?.();
  const finish=async()=>{report.finishedAt=new Date().toISOString();await saveJSON(join(run,'report.json'),report);await saveJSON(latest,report);progress('finish',{complete:report.downloadComplete||report.status==='metadata_indexed_images_not_requested',completionLabel:report.cardCount===null?'目录读取未完成，卡片和图片总量尚未确定':report.status==='metadata_indexed_images_not_requested'?'卡片资料已保存，本次未请求图片':null,report:report.archive+'/report.json'});return report;};
  async function fetchBytes(url,kind){
    for(let attempt=0;attempt<3;attempt++){
      const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),30000);
      try{
        const response=await fetcher(url,{signal:abort.signal,headers:{accept:kind==='catalog'?'application/json':'image/jpeg,image/png,image/webp'},credentials:'omit',redirect:'error'});
        if(!response.ok){if([429,500,502,503,504].includes(response.status)&&attempt<2){progress('retry',{attempt:attempt+2,reason:'HTTP '+response.status});const retry=Math.max(1000,Math.min(30000,Number(response.headers.get('retry-after')||0)*1000||1500*2**attempt));await pause(retry);continue;}throw new Error('HTTP '+response.status+' '+url);}
        const type=response.headers.get('content-type')||'';if(kind==='catalog'&&!/json/i.test(type))throw new Error('目录响应不是JSON。');if(kind!=='catalog'&&!/^image\/(jpeg|png|webp)/i.test(type))throw new Error('图片响应的Content-Type不正确。');
        const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>(kind==='catalog'?45_000_000:15_000_000))throw new Error('响应超过本批次允许的单文件大小。');return {bytes,contentType:type};
      }finally{clearTimeout(timer);}
    }throw new Error('重试次数耗尽。');
  }
  try{
    let raw;
    if(!catalogPath&&resume){
      const prior=await readJSON(latest),manifest=await readJSON(taskPath(root,'data/yearly/manifest-'+scopeId+'.json'));
      for(const candidate of [prior,manifest])if(candidate?.scope===scopeId&&candidate.catalogSnapshot&&await exists(taskPath(root,candidate.catalogSnapshot))){catalogPath=taskPath(root,candidate.catalogSnapshot);break;}
    }
    if(catalogPath){raw=await readFile(resolve(root,catalogPath));report.catalogSource={kind:'local_snapshot',path:resolve(root,catalogPath)};}
    else{if(offline)throw new Error('离线模式下没有可用的本地目录快照。');const received=await fetchBytes(scope.catalogUrl,'catalog');raw=received.bytes;report.catalogRetrieved=true;report.catalogSource={kind:'public_api',url:scope.catalogUrl};}
    const rawPath=join(run,'raw/catalog.json');await writeFile(rawPath,raw);report.catalogSnapshot=relative(root,rawPath).replaceAll(sep,'/');report.catalogSHA256=sha256(raw);
    let payload;try{payload=JSON.parse(raw.toString('utf8'));}catch{throw new Error('原始目录不是可解析的JSON，已保留原文件。');}
    const D=require('../src/early-cards.js'),normalized=normalizeCatalog(payload,scope,{existingCards:D.CARD_LIST});
    if(!normalized.cardCount)throw new Error('没有找到带明确首次OCG日期的目标年度卡片，不能生成空的已完成清单。');
    report.cardCount=normalized.cardCount;report.imageJobs=normalized.imageJobs.length;report.dateOrIdentityIssues=normalized.quarantine.length;report.outOfRangeRecords=normalized.outOfRange.length;
    progress(skipImages?'catalog-ready':'start',{cards:normalized.cardCount,total:normalized.imageJobs.length,mode:offline?'离线检查':'年度增量下载'});
    await saveJSON(join(run,'normalized-catalog.json'),normalized);await saveJSON(join(run,'image-jobs.json'),normalized.imageJobs);await saveJSON(join(run,'quarantine.json'),normalized.quarantine);
    for(const [year,cards] of Object.entries(normalized.byYear)){
      report.years[year]={cardCount:cards.length,downloadedImages:0,status:cards.length?'provider_catalog_indexed':'no_records_requires_review'};
      await saveJSON(taskPath(root,'data/yearly/'+year+'/cards.json'),{schemaVersion:1,year:Number(year),cardCount:cards.length,authority:'provider_candidate',sourceSnapshot:report.catalogSnapshot,productCoverage:'not_crosschecked',cards});
    }
    await saveJSON(taskPath(root,'data/yearly/manifest-'+scopeId+'.json'),{scope:scopeId,catalogSnapshot:report.catalogSnapshot,catalogSHA256:report.catalogSHA256,cardCount:normalized.cardCount,imageKeys:normalized.imageJobs.map(j=>j.key),annualProductCatalogComplete:false});
    if(skipImages){report.status='metadata_indexed_images_not_requested';report.pendingImages=normalized.imageJobs.length;return await finish();}
    sharp ||= loadSharp();
    const assetRoot=taskPath(root,'assets/official-archive'),indexPath=join(assetRoot,'index.json'),index=await readJSON(indexPath,{schemaVersion:1,entries:{}});await mkdir(join(assetRoot,'objects'),{recursive:true});await mkdir(join(assetRoot,'derived'),{recursive:true});
    let networkStopped=false;
    for(const job of normalized.imageJobs){
      const name=normalized.cards.find(c=>job.cardUids.includes(c.cardUid))?.name||job.key;operation='检查 '+name+' ('+job.kind+')';
      try{
        const cached=index.entries[job.key];let bytes,sourceKind='network';
        if(cached?.path){const file=taskPath(root,cached.path);if(await exists(file)){const candidate=await readFile(file);if(sha256(candidate)===cached.sha256){await inspectImage(candidate,sharp);bytes=candidate;sourceKind='cache';}else report.failures.push({key:job.key,reason:'cached_hash_mismatch',path:cached.path});}}
        if(!bytes&&localImageDir){for(const ext of ['jpg','png','webp']){const file=join(resolve(root,localImageDir),job.kind,job.imageId+'.'+ext);if(await exists(file)){bytes=await readFile(file);sourceKind='local_import';break;}}}
        if(!bytes){if(offline||networkStopped){report.pendingImages++;continue;}operation='下载 '+name+' ('+job.kind+')';progress('download',{name,kind:job.kind});await pause(delayMs);const received=await fetchBytes(job.url,'image');bytes=received.bytes;}
        const inspected=await inspectImage(bytes,sharp),file=join(assetRoot,'objects',inspected.sha256+'.'+inspected.extension);
        if(!(await exists(file)))await writeFile(file,bytes);
        let derived=null;if(job.kind==='cropped'){const webp=await sharp(bytes).resize({width:512,height:512,fit:'inside',withoutEnlargement:true}).webp({quality:90,effort:4}).toBuffer(),hash=sha256(webp),dest=join(assetRoot,'derived',hash+'.webp');if(!(await exists(dest)))await writeFile(dest,webp);derived={path:relative(root,dest).replaceAll(sep,'/'),sha256:hash,bytes:webp.length};}
        index.entries[job.key]={...inspected,key:job.key,imageId:job.imageId,kind:job.kind,sourceURL:job.url,cardUids:job.cardUids,selectedYears:job.years,path:relative(root,file).replaceAll(sep,'/'),derived,obtainedAt:cached?.obtainedAt||at,checkedAt:new Date().toISOString(),obtainedBy:sourceKind};
        if(sourceKind==='cache')report.reusedImages++;else if(sourceKind==='local_import')report.importedImages++;else report.downloadedImages++;
        for(const y of job.years)report.years[y].downloadedImages++;
        await saveJSON(indexPath,index);
        progress(sourceKind==='cache'?'reused':sourceKind==='local_import'?'imported':'saved',{name,kind:job.kind});
      }catch(error){
        report.failedImages++;const reason=String(error.message||error);report.failures.push({key:job.key,url:job.url,reason});
        progress('failure',{name,reason});
        if(/EACCES|EPERM|socket|fetch failed|Access.*denied|权限|审批|approval/i.test(reason))networkStopped=true;
      }
    }
    report.downloadComplete=report.imageJobs>0&&report.imageJobs===report.downloadedImages+report.reusedImages+report.importedImages&&normalized.quarantine.length===0&&Object.values(report.years).every(y=>y.cardCount>0);
    report.status=report.downloadComplete?'provider_download_complete_product_and_visual_review_pending':networkStopped?'partial_network_blocked':'partial_collection';
    for(const y of Object.values(report.years))if(y.cardCount)y.status=report.downloadComplete?'images_saved_review_pending':'assets_incomplete';
    await saveJSON(join(run,'asset-index-snapshot.json'),index);return await finish();
  }catch(error){report.status=report.cardCount===null?'blocked_before_catalog':'collection_error';report.failures.push({stage:report.cardCount===null?'catalog':'processing',reason:String(error.message||error)});progress('failure',{name:operation,reason:String(error.message||error)});for(const y of Object.values(report.years))if(y.cardCount===null)y.status='blocked_before_catalog';return await finish();}finally{clearInterval(heartbeat);}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const argv=process.argv.slice(2);
  if(argv.includes('--help')){console.log('node scripts/collect-years.mjs [--scope data/yearly/scope-1999-2001.json] [--resume] [--catalog local.json] [--offline] [--image-dir folder] [--no-images] [--quiet]\n--offline never makes a network request. Image folders use cropped/ID.jpg and full/ID.jpg.\n默认实时显示采集进度，等待时每5秒更新。--quiet 仅输出最终 JSON；本次归档仍保留 progress.log。');}
  else{try{let logPath;const logger=createProgressLogger({write:line=>{if(!argv.includes('--quiet'))console.log(line);if(logPath)appendFileSync(logPath,line+'\n','utf8');}});const result=await collect({scopePath:argument(argv,'--scope','data/yearly/scope-1999-2001.json'),catalogPath:argument(argv,'--catalog'),localImageDir:argument(argv,'--image-dir'),offline:argv.includes('--offline'),skipImages:argv.includes('--no-images'),resume:argv.includes('--resume'),onProgress:event=>{logPath||=join(projectRoot,event.archive,'progress.log');logger.handle(event);}});console.log(JSON.stringify(result,null,2));if(!result.downloadComplete&&result.status!=='metadata_indexed_images_not_requested')process.exitCode=2;}catch(error){console.error(error.message);process.exitCode=1;}}
}
