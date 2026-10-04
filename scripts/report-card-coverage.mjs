import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url);
require('../src/advanced-engine.js');require('../src/advanced-effects.js');
const D=globalThis.DuelData,E=globalThis.DuelEffects;
const effectKeys=new Map();for(const key of Object.keys(E.defs)){const id=key.split('::')[0];if(!effectKeys.has(id))effectKeys.set(id,[]);effectKeys.get(id).push(key);}
const rows=D.CARD_LIST.filter(c=>c.early).map(c=>({id:c.id,providerId:c.providerId,year:c.releaseYear,name:c.name,officialName:c.officialName,type:c.type,status:c.implementationStatus,note:c.implementationNote,effectKeys:effectKeys.get(c.id)||[],passive:!!E.passives[c.id],missingMaterials:(c.fusion||[]).filter(s=>s.officialName).map(s=>s.officialName)}));
const count=list=>({total:list.length,implemented:list.filter(c=>c.status==='implemented').length,existing:list.filter(c=>c.status==='existing').length,pending:list.filter(c=>c.status==='pending').length});
const yearRange=D.earlyYears.length?D.earlyYears[0]+'–'+D.earlyYears[D.earlyYears.length-1]:'1999–2001';
const report={generatedAt:new Date().toISOString(),source:'preserved local first-OCG-date snapshots',officialYearCoverage:'not_crosschecked',scope:yearRange,totalGameCards:D.CARD_LIST.filter(c=>!c.notCollectible).length,...count(rows),years:Object.fromEntries(D.earlyYears.map(y=>[y,count(rows.filter(c=>c.year===y))])),cards:rows};
await mkdir(join(root,'output/early-import'),{recursive:true});
await writeFile(join(root,'output/early-import/effect-coverage.json'),JSON.stringify(report,null,2));
await writeFile(join(root,'output/early-import/pending-effects.txt'),rows.filter(c=>c.status==='pending').map(c=>`${c.providerId} | ${c.year} | ${c.officialName} | ${c.type}\n${D.CARDS[c.id].description}\n`).join('\n'));
console.log(JSON.stringify({totalGameCards:report.totalGameCards,...count(rows),years:report.years},null,2));
const yearArgument=process.argv.indexOf('--write-year');
if(yearArgument!==-1){
 const year=Number(process.argv[yearArgument+1]);if(!D.earlyYears.includes(year))throw new Error('Unknown imported year: '+process.argv[yearArgument+1]);
 const locales=require('../src/card-locales.js'),list=rows.filter(c=>c.year===year).sort((a,b)=>a.providerId-b.providerId),pending=list.filter(c=>c.status==='pending'),available=list.filter(c=>c.status!=='pending'),reused=list.filter(c=>D.CARDS[c.id].existing).length;
 const basic=c=>!D.CARDS[c.id].existing&&!D.CARDS[c.id].effect&&!c.effectKeys.length&&!c.passive,basicCount=available.filter(basic).length;
 const escape=s=>String(s).replaceAll('|','\\|').replace(/[\r\n]+/g,' '),row=c=>`| ${c.providerId} | ${escape(locales[c.id]?.locales?.['zh-CN']?.name||c.name)} | ${escape(c.officialName)} | ${escape(c.status==='pending'?'pending':D.CARDS[c.id].existing?'复用既有实现':basic(c)?'基础规则（无卡片效果）':c.note?.startsWith('本作适配')?c.note:'已登记本作效果实现')} |`;
 const section=(title,cards)=>['## '+title,'','| 密码 | 中文名 | 英文名 | 状态 / 适配说明 |','| --- | --- | --- | --- |',...cards.map(row),''];
 await writeFile(join(root,`docs/coverage-${year}.md`),[`# ${year} 逐卡状态`,'','本表按实际运行时登记生成。implemented 表示存在本作实现，不等于官方裁定认证；待实现卡保持 pending 并禁止保存为有效对战构筑。','',`当前 ${list.length} 个身份：${available.length} 个可用（${available.length-reused-basicCount} 个效果实现、${basicCount} 个基础规则、${reused} 个复用），${pending.length} 个待实现。效果实现数量为该年度累计，不等于当前批次新增。来源和具体范围见 [批次交接](../交接/${year}批次交接.md)。`,'',`重建：\`node scripts/report-card-coverage.mjs --write-year ${year}\`。`,'',...section('可用身份',available),...section('待实现身份',pending)].join('\n'));
}
