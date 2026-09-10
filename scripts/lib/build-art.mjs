import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const hash=b=>createHash('sha256').update(b).digest('hex'),require=createRequire(import.meta.url);
export async function localArtwork(root,cards,{disabled=false,width=384}={}){
 const art={},warnings=[],stats={mode:disabled?'none':'local-optional',embedded:0,missing:0,bytes:0,optimized:0};if(disabled)return {art,warnings,stats};
 let index={entries:{}};try{index=JSON.parse(await readFile(join(root,'assets/official-archive/index.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')warnings.push('本地卡图索引不能读取，使用无图卡面：'+error.message);}
 let sharp=null;try{sharp=require('sharp');}catch{}
 const directory=join(root,'assets/official'),legacy=new Map();try{for(const file of await readdir(directory)){const m=file.match(/^(.+)\.(png|jpe?g|webp)$/i);if(m)legacy.set(m[1],file);}}catch{}
 const inside=path=>{const full=resolve(root,path),assetRoot=join(root,'assets');if(!full.startsWith(assetRoot+sep))throw new Error('卡图路径超出assets目录');return full;};
 for(const c of cards.filter(c=>!c.notCollectible)){
  try{
   let bytes,expected,mime,entry=index.entries?.[(c.imageKeys||[]).find(k=>k.startsWith('cropped:'))||'cropped:'+c.providerId]||Object.values(index.entries||{}).find(e=>e.kind==='cropped'&&(e.gameIds?.includes(c.id)||e.cardNames?.includes(c.officialName)));
   if(legacy.has(c.id)){bytes=await readFile(join(directory,legacy.get(c.id)));mime=/\.png$/i.test(legacy.get(c.id))?'png':/\.webp$/i.test(legacy.get(c.id))?'webp':'jpeg';}
   else if(entry){const selected=entry.derived||entry;bytes=await readFile(inside(selected.path));expected=selected.sha256;mime=entry.derived?'webp':entry.format==='jpg'?'jpeg':entry.format;if(expected&&hash(bytes)!==expected)throw new Error('卡图校验不通过');}
   if(!bytes){stats.missing++;continue;}
   if(sharp){
    const key=hash(bytes),cacheDir=join(root,'assets/build-art',width+'-q82'),cachePath=join(cacheDir,key+'.webp');
    try{bytes=await readFile(cachePath);}catch{bytes=await sharp(bytes,{limitInputPixels:30_000_000,failOn:'error'}).resize({width,height:width,fit:'inside',withoutEnlargement:true}).webp({quality:82,effort:4}).toBuffer();await mkdir(cacheDir,{recursive:true});await writeFile(cachePath,bytes);stats.optimized++;}mime='webp';
   }
   if(!['jpeg','png','webp'].includes(mime)||bytes.length<32)throw new Error('卡图格式或数据不合格');
   art[c.id]='data:image/'+mime+';base64,'+bytes.toString('base64');stats.embedded++;stats.bytes+=bytes.length;
  }catch(error){stats.missing++;warnings.push(c.id+'：'+error.message+'；本次使用无图卡面');}
 }
 return {art,warnings,stats};
}
