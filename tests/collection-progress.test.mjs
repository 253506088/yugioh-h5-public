import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {collectGameArt} from '../scripts/collect-game-art.mjs';
import {createProgressLogger} from '../scripts/lib/collection-progress.mjs';
const require=createRequire(import.meta.url),sharp=require('sharp'),root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const base=join(root,'output/progress-tests',new Date().toISOString().replace(/[:.]/g,'-'));
await mkdir(base,{recursive:true});await writeFile(join(base,'README.txt'),'Generated synthetic image fixtures. All download responses in these tests are mocked. CLI checks only run --plan.\n');
const card={id:'fixture-progress',providerId:92990001,officialName:'SYNTHETIC PROGRESS',name:'进度测试卡',releaseYear:1999};
const bytes=await sharp({create:{width:64,height:64,channels:3,background:'#6496c8'}}).png().toBuffer();
const response=()=>new Response(bytes,{headers:{'content-type':'image/png'}});
test('two image variants report exact live totals, downloads and cache reuse',async()=>{
 const dir=join(base,'both'),events=[];
 const result=await collectGameArt({root:dir,cards:[card],variant:'both',delayMs:0,sharp,fetcher:async()=>response(),onProgress:e=>events.push(e)});
 assert.equal(result.downloaded,2);assert.equal(events[0].type,'start');assert.equal(events[0].total,2);
 assert.deepEqual(events.filter(e=>e.type==='saved').map(e=>e.counts.downloaded),[1,2]);
 assert.deepEqual(events.at(-1).counts,{processed:2,total:2,reused:0,downloaded:2,pending:0,failed:0,remaining:0,missing:0});
 const second=[];await collectGameArt({root:dir,cards:[card],variant:'both',delayMs:0,sharp,fetcher:()=>{throw new Error('cache must avoid network');},onProgress:e=>second.push(e)});
 assert.equal(second.find(e=>e.type==='plan').cached,2);assert.equal(second.at(-1).counts.reused,2);assert.equal(second.at(-1).counts.downloaded,0);
});
test('failures and offline missing images remain visible as work still needing completion',async()=>{
 const events=[];
 const result=await collectGameArt({root:join(base,'failed'),cards:[card],variant:'both',delayMs:0,sharp,fetcher:async()=>new Response('missing',{status:404}),onProgress:e=>events.push(e)});
 assert.equal(result.complete,false);assert.equal(result.failedImages,2);assert.equal(result.missingImages,2);
 assert.equal(events.find(e=>e.type==='failure').counts.failed,2);assert.equal(events.at(-1).counts.missing,2);assert.equal(events.at(-1).counts.remaining,0);
 const planned=[];await collectGameArt({root:join(base,'planned'),cards:[card,{id:'unresolved-fixture',officialName:'UNRESOLVED FIXTURE'}],plan:true,onProgress:e=>planned.push(e),fetcher:()=>{throw new Error('plan cannot request');}});
 assert.equal(planned.at(-1).counts.pending,2);assert.equal(planned.at(-1).counts.missing,2);assert.equal(planned.find(e=>e.type==='plan').unresolved,1);
});
test('slow downloads emit a heartbeat before the response has completed',async()=>{
 const events=[];let resolved=false;
 await collectGameArt({root:join(base,'heartbeat'),cards:[card],delayMs:0,sharp,onProgress:e=>events.push({...e,responseComplete:resolved}),fetcher:async()=>{await new Promise(r=>setTimeout(r,5200));resolved=true;return response();}});
 const heartbeat=events.find(e=>e.type==='heartbeat');assert.ok(heartbeat);assert.equal(heartbeat.responseComplete,false);assert.match(heartbeat.operation,/下载 进度测试卡/);assert.equal(heartbeat.counts.remaining,1);
});
test('the logger reports retries, elapsed time and final missing counts',()=>{
 const lines=[];let now=1000;const logger=createProgressLogger({write:line=>lines.push(line),now:()=>now});
 const counts={processed:0,total:2,downloaded:0,reused:0,pending:0,failed:0,remaining:2,missing:2};
 logger.handle({type:'start',cards:1,total:2,mode:'增量下载',counts});now=6000;
 logger.handle({type:'retry',attempt:2,reason:'HTTP 429',counts});logger.handle({type:'heartbeat',operation:'等待服务器响应',counts});
 logger.handle({type:'finish',complete:false,report:'fixture/report.json',counts:{...counts,processed:2,failed:2,remaining:0}});
 assert.match(lines[0],/1 张卡，2 张图片/);assert.match(lines[1],/2\/3：HTTP 429/);assert.match(lines[2],/剩余待处理 2 · 5s.*等待服务器响应/);assert.match(lines[3],/仍需补全 2 张/);assert.deepEqual(lines,logger.lines);
});
test('CLI progress is visible by default and --quiet keeps JSON stdout with a saved log',async()=>{
 for(const quiet of [false,true]){
  const result=spawnSync(process.execPath,['scripts/collect-game-art.mjs','--plan','--ids','blue-eyes',...(quiet?['--quiet']:[])],{cwd:root,encoding:'utf8',timeout:30000});
  assert.equal(result.status,0,result.stderr);
  let data;
  if(quiet)data=JSON.parse(result.stdout);
  else{assert.match(result.stdout,/开始卡图采集/);assert.match(result.stdout,/缓存检查完成/);data=JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));}
  assert.equal(data.selected,1);const log=await readFile(join(root,dirname(data.report),'progress.log'),'utf8');assert.match(log,/开始卡图采集/);assert.match(log,/剩余待处理 0/);
  await writeFile(join(base,quiet?'quiet-stdout.json':'default-stdout.txt'),result.stdout);
 }
});
