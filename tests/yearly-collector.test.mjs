/* Synthetic fixtures only. These do not stand in for real downloaded cards. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {normalizeCatalog,strictDate,validImageURL,inspectImage} from '../scripts/lib/yearly-catalog.mjs';
import {collect} from '../scripts/collect-years.mjs';
const project=resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url);
let sharp;try{sharp=require('sharp');}catch{sharp=require(resolve(dirname(process.execPath),'../node_modules/sharp'));}
const scope=JSON.parse(await readFile(join(project,'data/yearly/scope-1999-2001.json'),'utf8'));
const fixture=(id,date,extra={})=>({id,name:'TEST FIXTURE '+id,type:'Normal Monster',frameType:'normal',desc:'Synthetic test data, not a real card.',atk:100,def:100,level:1,race:'Aqua',attribute:'WATER',misc_info:[{ocg_date:date,tcg_date:'2002-03-08',formats:['OCG','TCG']}],card_images:[{id,image_url:'https://images.ygoprodeck.com/images/cards/'+id+'.jpg',image_url_cropped:'https://images.ygoprodeck.com/images/cards_cropped/'+id+'.jpg'}],...extra});
const records=[fixture(91000001,'1999-02-04'),fixture(91000002,'2000-06-01'),fixture(91000003,'2001-12-31')];
const base=join(project,'output/yearly-collector-tests/run-'+new Date().toISOString().replace(/[:.]/g,'-'));await mkdir(base,{recursive:true});
await writeFile(join(base,'README.txt'),'All card records and images in this directory are synthetic test fixtures. No real service was contacted.\n');
async function setup(name,payload={data:records}){const root=join(base,name);await mkdir(join(root,'data/yearly'),{recursive:true});await writeFile(join(root,'data/yearly/scope-1999-2001.json'),JSON.stringify(scope));await writeFile(join(root,'fixture-catalog.json'),JSON.stringify(payload));return root;}
const pixels=Buffer.alloc(96*96*3);for(let i=0;i<pixels.length;i++)pixels[i]=(i*13+Math.floor(i/31))%256;
const png=await sharp(pixels,{raw:{width:96,height:96,channels:3}}).png().toBuffer();

test('first OCG dates select exactly the three target years; TCG dates never substitute',()=>{
  const missing=fixture(91000004,null),late=fixture(91000005,'2002-01-01');missing.misc_info=[{tcg_date:'1999-01-01'}];
  const result=normalizeCatalog({data:[...records,missing,late,records[0]]},scope);
  assert.equal(result.cardCount,3);assert.deepEqual(Object.values(result.byYear).map(x=>x.length),[1,1,1]);assert.equal(result.duplicates.length,1);assert.equal(result.outOfRange.length,1);assert.equal(result.quarantine[0].reason,'missing_or_invalid_first_ocg_date');
});
test('invalid dates and conflicting duplicates are quarantined',()=>{
  assert.equal(strictDate('2001-02-29'),null);assert.equal(strictDate('2000-02-29'),'2000-02-29');
  const result=normalizeCatalog({data:[records[0],{...records[0],atk:500}]},scope);assert.equal(result.cardCount,1);assert.equal(result.quarantine[0].reason,'conflicting_duplicate_identity');
});
test('image host, image id, path, and image kind are validated',()=>{
  assert.ok(validImageURL(records[0].card_images[0].image_url,91000001,'full'));
  assert.equal(validImageURL('https://attacker.invalid/images/cards/91000001.jpg',91000001,'full'),null);
  assert.equal(validImageURL('https://images.ygoprodeck.com/images/cards/91000002.jpg',91000001,'full'),null);
  assert.equal(validImageURL(records[0].card_images[0].image_url,91000001,'cropped'),null);
});
test('image validation actually decodes bytes and rejects empty or tiny placeholders',async()=>{
  const result=await inspectImage(png,sharp);assert.equal(result.width,96);assert.equal(result.validation,'decoded_and_hashed');assert.equal(result.identityReview,'pending_visual_review');
  await assert.rejects(inspectImage(Buffer.from('<html>not an image</html>'),sharp));
  const tiny=await sharp({create:{width:1,height:1,channels:3,background:'#fff'}}).png().toBuffer();await assert.rejects(inspectImage(tiny,sharp));
});
test('offline mode makes zero network requests and does not call missing images complete',async()=>{
  const root=await setup('offline');let calls=0;const report=await collect({root,catalogPath:'fixture-catalog.json',offline:true,sharp,fetcher:()=>{calls++;throw new Error('must not reach network');}});
  assert.equal(calls,0);assert.equal(report.cardCount,3);assert.equal(report.pendingImages,6);assert.equal(report.downloadComplete,false);assert.equal(report.yearCoverageComplete,false);
});
test('mock image collection saves originals and derivatives, deduplicates bytes and resumes offline',async()=>{
  const root=await setup('mock-collection');let calls=0;
  const report=await collect({root,catalogPath:'fixture-catalog.json',sharp,delayMs:0,fetcher:async()=>{calls++;return new Response(png,{status:200,headers:{'content-type':'image/png'}});}});
  assert.equal(calls,6);assert.equal(report.downloadedImages,6);assert.equal(report.downloadComplete,true);assert.equal(report.yearCoverageComplete,false);
  const index=JSON.parse(await readFile(join(root,'assets/official-archive/index.json'),'utf8'));
  assert.equal(new Set(Object.values(index.entries).map(x=>x.path)).size,1);assert.ok(index.entries['cropped:91000001'].derived);
  const again=await collect({root,resume:true,offline:true,sharp,fetcher:()=>{throw new Error('no network on resume');}});assert.equal(again.reusedImages,6);assert.equal(again.downloadComplete,true);
});
test('a blocked catalog keeps annual counts unknown instead of creating empty successful years',async()=>{
  const root=await setup('blocked');const report=await collect({root,sharp,fetcher:async()=>{const e=new Error('socket EACCES');throw e;}});
  assert.equal(report.status,'blocked_before_catalog');assert.equal(report.catalogRetrieved,false);assert.equal(report.cardCount,null);assert.equal(report.years['1999'].cardCount,null);assert.equal(report.downloadComplete,false);
});
test('provided local image folders can be imported without network access',async()=>{
  const root=await setup('local-images');for(const kind of ['cropped','full']){await mkdir(join(root,'supplied',kind),{recursive:true});for(const record of records)await writeFile(join(root,'supplied',kind,record.id+'.png'),png);}
  const report=await collect({root,catalogPath:'fixture-catalog.json',localImageDir:'supplied',offline:true,sharp,fetcher:()=>{throw new Error('no network');}});assert.equal(report.importedImages,6);assert.equal(report.downloadComplete,true);assert.equal(report.effectsImplementedByThisRun,0);
});
test('resume can recover its catalog from the scope manifest after an interrupted run',async()=>{
  const root=await setup('interrupted');await collect({root,catalogPath:'fixture-catalog.json',skipImages:true,offline:true});
  await writeFile(join(root,'output/yearly-collection/latest-report.json'),JSON.stringify({scope:'1999-2001',status:'interrupted',catalogSnapshot:null}));
  const report=await collect({root,resume:true,offline:true,sharp,fetcher:()=>{throw new Error('no network');}});assert.equal(report.cardCount,3);assert.equal(report.pendingImages,6);assert.equal(report.downloadComplete,false);
});
test('yearly progress distinguishes completed metadata from pictures that were not requested',async()=>{
  const root=await setup('progress-metadata'),events=[];
  const report=await collect({root,catalogPath:'fixture-catalog.json',skipImages:true,offline:true,onProgress:event=>events.push(event),fetcher:()=>{throw new Error('metadata snapshot requires no network');}});
  assert.equal(events[0].type,'catalog');assert.equal(events.find(event=>event.type==='catalog-ready').cards,3);
  assert.equal(events.at(-1).counts.total,6);assert.equal(events.at(-1).counts.downloaded,0);assert.equal(events.at(-1).counts.pending,6);
  assert.match(events.at(-1).completionLabel,/本次未请求图片/);assert.equal(report.effectsImplementedByThisRun,0);
});
