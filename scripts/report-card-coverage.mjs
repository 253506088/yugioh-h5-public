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
