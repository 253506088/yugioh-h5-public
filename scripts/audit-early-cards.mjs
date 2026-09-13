import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=join(root,'output/early-card-audit');await mkdir(out,{recursive:true});
const years=[1999,2000,2001,2002,2003,2004,2005,2006,2007,2008];
const cards=(await Promise.all(years.map(async y=>JSON.parse(await readFile(join(root,'data/yearly',String(y),'cards.json'),'utf8')).cards))).flat();
for(const type of [...new Set(cards.map(c=>c.providerType))]){
  const list=cards.filter(c=>c.providerType===type);await writeFile(join(out,type.toLowerCase().replace(/ /g,'-')+'.txt'),list.map(c=>c.providerId+' | '+c.year+' | '+c.name+' | '+c.race+'\n'+c.description.replace(/\r/g,'')+'\n').join('\n'));
}
const summary={total:cards.length,byYear:Object.fromEntries(years.map(y=>[y,cards.filter(c=>c.year===y).length])),byType:Object.fromEntries([...new Set(cards.map(c=>c.providerType))].map(t=>[t,cards.filter(c=>c.providerType===t).length]))};
await writeFile(join(out,'summary.json'),JSON.stringify(summary,null,2));console.log(summary);
