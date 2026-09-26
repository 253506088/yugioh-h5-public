import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname,join,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {writeAtomic} from './lib/io.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url);
const args=process.argv.slice(2),offline=args.includes('--offline'),refresh=args.includes('--refresh');
const directory=join(root,'data/locales'),hash=data=>createHash('sha256').update(data).digest('hex');
const readJSON=async(file,fallback)=>{try{return JSON.parse(await readFile(file,'utf8'));}catch{return fallback;}};
const {CARD_LIST}=require('../src/early-cards.js'),cards=CARD_LIST.filter(c=>!c.notCollectible);
const identities=await readJSON(join(root,'data/providers/game-art-identities.json'),{cards:{}});
const normalize=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
const validPage=value=>{try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='ygoprodeck.com'&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/card\/[a-z0-9-]+\/?$/i.test(u.pathname)?u.href:null;}catch{return null;}};
async function get(url){const response=await fetch(url,{signal:AbortSignal.timeout(45000),headers:{'User-Agent':'Duel-Sanctuary-localization'},redirect:'error'});if(!response.ok)throw new Error('HTTP '+response.status+' '+url);return Buffer.from(await response.arrayBuffer());}
await mkdir(directory,{recursive:true});
let manifest=await readJSON(join(directory,'source-manifest.json'),null);
if(!manifest||refresh){
 if(offline)throw new Error('离线同步需要已经保存的 data/locales/source-manifest.json');
 const commit=JSON.parse((await get('https://api.github.com/repos/mycard/ygopro-database/commits/master')).toString('utf8')).sha;
 if(!/^[a-f0-9]{40}$/.test(commit))throw new Error('Invalid database source commit');
 manifest={repository:'https://github.com/mycard/ygopro-database',commit,obtainedAt:new Date().toISOString(),files:{}};
}
let DatabaseSync;try{({DatabaseSync}=await import('node:sqlite'));}catch{throw new Error('语言资料提取需要 Node.js 22.13 或以上；建议 Node.js 24 LTS。');}
const databases={};
for(const [language,folder] of [['zh-CN','zh-CN'],['en','en-US'],['ja','ja-JP']]){
 const file=join(directory,'sources',manifest.commit,folder+'.cdb');let bytes;
 try{bytes=await readFile(file);if(manifest.files[language]?.sha256&&hash(bytes)!==manifest.files[language].sha256)throw new Error('Checksum mismatch');}catch(error){
  if(offline)throw new Error('本地语言快照缺失或损坏：'+file);
  console.log('下载卡片文本数据库：'+folder+'（不下载卡图）');
  bytes=await get(`https://raw.githubusercontent.com/mycard/ygopro-database/${manifest.commit}/locales/${folder}/cards.cdb`);await mkdir(dirname(file),{recursive:true});await writeFile(file,bytes);
 }
 if(bytes.subarray(0,16).toString()!=='SQLite format 3\u0000')throw new Error('Source is not a SQLite card database: '+folder);
 manifest.files[language]={path:relative(root,file).replaceAll(sep,'/'),sha256:hash(bytes),bytes:bytes.length};
 const db=new DatabaseSync(file,{readOnly:true});databases[language]={db,query:db.prepare('SELECT id, name, desc FROM texts WHERE id = ?')};
 console.log('读取 '+folder+'：'+bytes.length+' 字节，已核验 SHA-256');
}
await writeAtomic(join(directory,'source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const rawRecords=new Map();
function ingest(payload){for(const r of payload?.data||[])if(Number.isSafeInteger(r.id)&&r.name)rawRecords.set(r.id,r);}
// Retained links make an offline rebuild independent of ignored collection logs.
ingest(await readJSON(join(root,'data/providers/encyclopedia-references.json'),{}));
for(const file of (await readdir(join(root,'data/yearly'))).filter(f=>/^manifest-.*\.json$/.test(f)).sort()){
 const yearManifest=await readJSON(join(root,'data/yearly',file),{});
 if(yearManifest.catalogSnapshot)ingest(await readJSON(join(root,yearManifest.catalogSnapshot),{}));
}
ingest(await readJSON(join(directory,'sources',manifest.commit,'references.json'),{}));
try{for(const run of await readdir(join(root,'output/game-art'),{withFileTypes:true})){if(!run.isDirectory()||!run.name.startsWith('run-'))continue;const folder=join(root,'output/game-art',run.name,'raw');try{for(const file of await readdir(folder))if(file.endsWith('.json'))ingest(await readJSON(join(folder,file),{}));}catch{}}}catch{}

function splitPendulum(text){
 const separator=/[\[【]\s*(?:Monster Effect|Monster Description|怪兽效果|怪兽描述|モンスター効果)\s*[\]】]/i,match=separator.exec(text);
 if(!match)return {description:text};
 return {pendulumDescription:text.slice(0,match.index).replace(/^[\s\S]*?[\[【]\s*(?:Pendulum Effect|灵摆效果|ペンデュラム効果)\s*[\]】]\s*/i,'').replace(/^←[^\r\n]+[\r\n]+/,'').replace(/^【[PＰ]スケール[^】]+】\s*/,'').replace(/[-－─]{3,}/g,'').trim(),description:text.slice(match.index+match[0].length).trim()};
}
const output={},missing=[],urlsMissing=[],identityAliases=[],totals={'zh-CN':0,en:0,ja:0};
const matchingName=databases.en.db.prepare('SELECT t.id,t.name,d.atk,d.def,d.level,d.alias FROM texts t JOIN datas d ON t.id=d.id WHERE t.name=?');
for(const card of cards){
 const identity=identities.cards[card.id],providerId=card.providerId||(normalize(identity?.name)===normalize(card.officialName)?identity.providerId:null);
 if(!providerId){missing.push({id:card.id,reason:'missing_provider_identity'});continue;}
 let textId=providerId;
 if(!databases['zh-CN'].query.get(providerId)||!databases.ja.query.get(providerId)){
  const matches=matchingName.all(card.officialName).filter(m=>!m.alias&&m.atk===card.atk&&m.def===card.def&&(m.level&255)===(card.rank||card.level||0));
  if(matches.length===1){textId=matches[0].id;identityAliases.push({id:card.id,providerId,textId,verifiedBy:'unique exact English name and matching ATK, DEF and level'});}
 }
 const raw=rawRecords.get(providerId),record={providerId,textId,imageId:Number(card.imageKeys?.find(k=>k.startsWith('cropped:'))?.split(':')[1]||identity?.imageId||providerId),encyclopediaUrl:validPage(raw?.ygoprodeck_url||identity?.encyclopediaUrl),locales:{}};
 if(!record.encyclopediaUrl)urlsMissing.push({id:card.id,providerId,name:card.officialName});
 for(const language of ['zh-CN','en','ja']){
  const row=databases[language].query.get(textId);let name=row?.name,description=row?.desc;
  if(language==='en'){name=card.officialName;if(raw?.desc||card.originalDescription)description=raw?.desc||card.originalDescription;}
  if(!name||!description){missing.push({id:card.id,providerId,language,reason:'missing_localized_text'});continue;}
  const texts=card.type==='pendulum'||card.pendulum?splitPendulum(description):{description};
  if((card.type==='pendulum'||card.pendulum)&&!card.pendulumDescription)texts.pendulumDescription={'zh-CN':'无灵摆效果。',en:'No Pendulum effect.',ja:'ペンデュラム効果なし。'}[language];
  record.locales[language]={name,...texts};totals[language]++;
 }
 output[card.id]=record;
}
for(const {db} of Object.values(databases))db.close();
if(urlsMissing.length&&!offline){
 const path=join(directory,'sources',manifest.commit,'references.json'),cached=await readJSON(path,{data:[]});ingest(cached);
 const needed=urlsMissing.filter(r=>!validPage(rawRecords.get(r.providerId)?.ygoprodeck_url));
 for(let at=0;at<needed.length;at+=50){const batch=needed.slice(at,at+50);console.log('补充卡片百科地址：'+(at+1)+'—'+(at+batch.length)+' / '+needed.length);const raw=JSON.parse((await get('https://db.ygoprodeck.com/api/v7/cardinfo.php?id='+batch.map(c=>c.providerId).join(','))).toString('utf8'));ingest(raw);cached.data.push(...(raw.data||[]));await writeAtomic(path,JSON.stringify(cached,null,2));}
 for(const r of urlsMissing)output[r.id].encyclopediaUrl=validPage(rawRecords.get(r.providerId)?.ygoprodeck_url);
}
await writeAtomic(join(directory,'cards.json'),JSON.stringify({schemaVersion:1,source:manifest,totals,cards:output},null,2)+'\n');
const safeJSON=value=>JSON.stringify(value).replace(/</g,'\\u003c');
await writeAtomic(join(root,'src/card-locales.js'),'/* Generated by scripts/sync-locales.mjs; original source databases are preserved. */\n(function(root){\nconst data='+safeJSON(output)+';\nroot.DuelCardLocales=data;\nif(typeof module!==\'undefined\')module.exports=data;\n})(globalThis);\n');
const missingPendulum=cards.filter(c=>c.type==='pendulum'||c.pendulum).flatMap(c=>['zh-CN','en','ja'].filter(l=>!output[c.id]?.locales[l]?.pendulumDescription).map(language=>({id:c.id,language})));
const report={at:new Date().toISOString(),sourceCommit:manifest.commit,cardCount:cards.length,translated:totals,identityAliases,missing,missingPendulum,missingEncyclopedia:cards.filter(c=>!output[c.id]?.encyclopediaUrl).map(c=>c.id)};
await mkdir(join(root,'output/localization'),{recursive:true});await writeAtomic(join(root,'output/localization/card-coverage.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));if(missing.length||missingPendulum.length||report.missingEncyclopedia.length)process.exitCode=2;
