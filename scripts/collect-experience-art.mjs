import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url);
require('../src/advanced-engine.js');
const {CARDS,DECKS}=globalThis.DuelData,locales=require('../src/card-locales.js');
const showcase=['Magic Jammer','Seven Tools of the Bandit','Raigeki Break','Disappear','Call of the Haunted','Imperial Order','Emergency Provisions','Axe of Despair','Freed the Matchless General','Linkuriboh'].map(name=>globalThis.DuelData.cardByName(name)?.id);
const acesOnly=process.argv.includes('--aces');
const ids=[...new Set([...Object.values(DECKS).filter(d=>d.preset).flatMap(d=>acesOnly?[d.ace]:[d.ace,...d.cards,...d.extra]),...(acesOnly?[]:showcase)])].filter(id=>CARDS[id]);
const out=resolve(root,'assets/duel/art');
if(!out.startsWith(root+sep))throw Error('Outside project');
await mkdir(resolve(out,'source'),{recursive:true});
const previous=JSON.parse(await readFile(resolve(out,'manifest.json'),'utf8').catch(()=>'{}'));
const manifest={provider:'YGOPRODeck',cards:[]};let cursor=0,failed=0;
const workers=await Promise.allSettled(Array.from({length:2},async()=>{
  while(cursor<ids.length){
    const id=ids[cursor++];if(!/^[a-z0-9-]+$/.test(id))continue;
    const imageId=locales[id]?.imageId||CARDS[id].providerId;
    if(!Number.isSafeInteger(Number(imageId))||Number(imageId)<=0)continue;
    const url='https://images.ygoprodeck.com/images/cards_cropped/'+imageId+'.jpg',target=resolve(out,id+'.webp');
    try{
      const cached=await readFile(target).catch(()=>null);
      if(cached){manifest.cards.push({id,imageId,url,path:'assets/duel/art/'+id+'.webp',sha256:createHash('sha256').update(cached).digest('hex')});continue;}
      const response=await fetch(url,{signal:AbortSignal.timeout(18000)});if(!response.ok)throw Error('HTTP '+response.status);
      const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>5000000)throw Error('Image too large');
      const image=sharp(bytes,{limitInputPixels:8000000}),metadata=await image.metadata();if(!['jpeg','png','webp'].includes(metadata.format))throw Error('Not an image');
      const webp=await image.resize({width:384,height:384,fit:'inside',withoutEnlargement:true}).webp({quality:83}).toBuffer();
      await writeFile(resolve(out,'source',id+'.jpg'),bytes);await writeFile(target,webp);
      manifest.cards.push({id,imageId,url,path:'assets/duel/art/'+id+'.webp',sha256:createHash('sha256').update(webp).digest('hex')});
      console.log('Artwork:',id);
      await new Promise(resolve=>setTimeout(resolve,160));
    }catch(error){failed++;console.log('Missing:',id,error.message);}
  }
}));
for(const worker of workers)if(worker.status==='rejected'){failed++;console.error('Artwork worker:',worker.reason);}
const merged=new Map((previous.cards||[]).map(c=>[c.id,c]));for(const card of manifest.cards)merged.set(card.id,card);manifest.cards=[...merged.values()].sort((a,b)=>a.id.localeCompare(b.id));
await writeFile(resolve(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log('Embedded artwork ready:',manifest.cards.length,'Missing:',failed);
process.exitCode=failed?1:0;
