/* Idempotent release optimization. Tracked WebP files remain offline inputs;
 * source JPEGs and prior Git objects retain the higher-resolution originals. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {duelArtEncoding as encoding} from './lib/duel-art-profile.mjs';
import {writeAtomic} from './lib/io.mjs';
const file='assets/duel/art/manifest.json',manifest=JSON.parse(await readFile(file,'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
let before=0,after=0,changed=0;
for(const card of manifest.cards){
 if(!/^assets\/duel\/art\/[a-z0-9-]+\.webp$/.test(card.path))throw Error('Unexpected artwork path');
 const bytes=await readFile(card.path),sha=hash(bytes);if(sha!==card.sha256)throw Error('Artwork checksum mismatch: '+card.id);before+=bytes.length;
 if(JSON.stringify(card.encoding)===JSON.stringify(encoding)){after+=bytes.length;continue;}
 const data=await sharp(bytes).resize({width:encoding.width,height:encoding.width,fit:'inside',withoutEnlargement:true}).webp({quality:encoding.quality,effort:encoding.effort}).toBuffer();
 // Keep an already smaller valid image instead of increasing its size.
 const result=data.length<bytes.length?data:bytes;
 card.encoding=encoding;card.optimizationInputSHA256=sha;card.sha256=hash(result);card.bytes=result.length;
 if(result!==bytes){await writeFile(card.path,result);changed++;}after+=result.length;
}
await writeAtomic(file,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({cards:manifest.cards.length,changed,before,after,saved:before-after,encoding}));
