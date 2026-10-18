/* Rebuild a retained annual input without network access or output/ caches. */
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {normalizeCatalog,sha256} from './lib/yearly-catalog.mjs';
const year=Number(process.argv[2]);
if(!Number.isInteger(year)||year<1999||year>2025)throw Error('Usage: node scripts/rebuild-year-snapshot.mjs YEAR (1999–2025)');
const scope=JSON.parse(await readFile(`data/yearly/scope-${year}-${year}.json`,'utf8'));
if(!/^data\/providers\/ocg-\d{4}\.json$/.test(scope.catalogSnapshot||''))throw Error('Scope must name a retained provider snapshot');
const raw=await readFile(scope.catalogSnapshot);
if(sha256(raw)!==scope.catalogSHA256)throw Error('Retained provider checksum mismatch');
// Stable hand-authored identities only: never let a previous import alter output.
const D=createRequire(import.meta.url)('../src/link-cards.js');
const result=normalizeCatalog(JSON.parse(raw),scope,{existingCards:D.CARD_LIST});
if(result.quarantine.length||result.outOfRange.length||!result.cardCount)throw Error('Unresolved source records: '+JSON.stringify(result.quarantine));
const exclusions=scope.excludedIdentities||[];
if(result.excluded.length!==exclusions.length)throw Error('Review new exclusions before rebuilding');
const snapshot={schemaVersion:1,year,cardCount:result.cardCount,authority:'provider_candidate',sourceSnapshot:scope.catalogSnapshot,productCoverage:'not_crosschecked',cards:result.cards,excludedRecords:exclusions};
const manifest={scope:`${year}-${year}`,catalogSnapshot:scope.catalogSnapshot,catalogSHA256:sha256(raw),sourceRecordCount:result.sourceRecordCount,cardCount:result.cardCount,excludedRecords:exclusions,imageKeys:result.imageJobs.map(j=>j.key),annualProductCatalogComplete:false};
for(const [path,value]of [[`data/yearly/${year}/cards.json`,snapshot],[`data/yearly/manifest-${year}-${year}.json`,manifest]])await writeFile(path,JSON.stringify(value,null,2)+'\n');
console.log(`${year}: ${result.sourceRecordCount} source records, ${result.cardCount} identities, ${result.excluded.length} documented exclusions.`);
