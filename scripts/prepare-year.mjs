import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),start=Number(process.argv[2]),end=Number(process.argv[3]||process.argv[2]);
if(!Number.isInteger(start)||!Number.isInteger(end)||start<1999||end>2026||start>end)throw new Error('用法：node scripts/prepare-year.mjs 2002 [2003]；范围1999—2026');
const scope=JSON.parse(await readFile(join(root,'data/yearly/scope-1999-2001.json'),'utf8'));
scope.title=`OCG ${start}—${end} 年增量切片`;scope.startYear=start;scope.endYear=end;scope.createdOn=new Date().toISOString().slice(0,10);
const url=new URL('https://db.ygoprodeck.com/api/v7/cardinfo.php');for(const [key,value] of Object.entries({misc:'yes',startdate:`01/01/${start}`,enddate:`12/31/${end}`,dateregion:'ocg'}))url.searchParams.set(key,value);scope.catalogUrl=url.href;
const dest=join(root,`data/yearly/scope-${start}-${end}.json`);await mkdir(dirname(dest),{recursive:true});
try{await writeFile(dest,JSON.stringify(scope,null,2)+'\n',{flag:'wx'});console.log('Created '+dest);}catch(error){if(error.code==='EEXIST')console.log('Scope already exists; retained without changes: '+dest);else throw error;}
