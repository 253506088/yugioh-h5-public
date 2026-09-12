// Downloads only the ten requested soundtrack recordings, into this project's assets/audio.
// Remote bytes are treated as media data; no downloaded code is executed.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const audioRoot=resolve(root,'assets/audio');
const location=name=>{
  if(!/^[a-z0-9-]+\.(mp3|m4a|json)$/.test(name))throw new Error('Invalid media filename');
  const file=resolve(audioRoot,name);
  if(!file.startsWith(root+sep)||!file.startsWith(audioRoot+sep))throw new Error('Path outside project');
  return file;
};
const table=[
  ['passionate-duelists','熱き決闘者たち','battle','tvtunes_18145','Yu-Gi-Oh - Sound Duel 1 - Passionate Duelist.mp3'],
  ['nameless-pharaoh','名もなきファラオ','battle','tvtunes_18171','Yu-Gi-Oh - Sound Duel 4 - The Nameless Pharaoh.mp3'],
  ['orichalcos','オレイカルコスの結界','battle','tvtunes_18161','Yu-Gi-Oh - Sound Duel 3 - Seal of Orichalcos.mp3'],
  ['yugi','遊戯','battle','tvtunes_18173','Yu-Gi-Oh - Sound Duel 4 - Yugi.mp3'],
  ['fang-of-critias','クリティウスの牙','battle','tvtunes_18157','Yu-Gi-Oh - Sound Duel 3 - Fang of Critias.mp3'],
  ['bond-of-friendship','友情の絆','help','tvtunes_18147','Yu-Gi-Oh - Sound Duel 2 - Bond of Friendship.mp3'],
  ['yusei-battle','遊星バトル','workshop','ygo5ds-sound-duel1',"Yu-gi-oh! 5D's Sound Duel 01 [FLAC]/19 Yūsei Batoru .mp3"],
  ['psychological-battle','心理戦(D1)','lobby','yu-gi-oh-ost-japanese-version','34 Mind Games.m4a'],
  ['jounouchi','城之内克也','library','yu-gi-oh-ost-japanese-version','75 Katsuya Jonouchi.m4a'],
  ['counterattack','反撃開始','battle','yu-gi-oh-ost-japanese-version','121 Start the Counterattack.m4a']
];
await mkdir(audioRoot,{recursive:true});
let old={tracks:[]};try{old=JSON.parse(await readFile(location('manifest.json'),'utf8'));}catch{}
const tracks=table.map(([id,title,scene,item,file])=>{
  const extension=file.endsWith('.m4a')?'m4a':'mp3';
  const path='assets/audio/'+id+'.'+extension;
  const member=extension==='m4a'?'Yu Gi Oh OST (Japanese Version).zip/'+encodeURIComponent('Yu Gi Oh OST (Japanese Version)/'+file):file.split('/').map(encodeURIComponent).join('/');
  const url='https://archive.org/download/'+item+'/'+(extension==='m4a'?encodeURI(member):member);
  return {...old.tracks.find(t=>t.id===id),id,title,scene,path,url:extension==='m4a'?'https://archive.org/download/'+item+'/'+encodeURIComponent('Yu Gi Oh OST (Japanese Version).zip')+'/'+encodeURIComponent('Yu Gi Oh OST (Japanese Version)/'+file):url,source:'https://archive.org/details/'+item,sourceTitle:file};
});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
let failed=0;
for(const track of tracks){
  const filename=track.path.split('/').at(-1),target=location(filename);
  try{
    const cached=await readFile(target).catch(()=>null);
    if(cached&&track.sha256===hash(cached)){console.log('Cached:',track.title);continue;}
    const url=new URL(track.url);
    if(url.protocol!=='https:'||url.hostname!=='archive.org'||!url.pathname.startsWith('/download/'))throw new Error('Unexpected source');
    const response=await fetch(url,{signal:AbortSignal.timeout(45000),redirect:'follow'});
    if(!response.ok)throw new Error('HTTP '+response.status);
    const bytes=Buffer.from(await response.arrayBuffer());
    const valid=filename.endsWith('.m4a')?bytes.subarray(4,8).toString()==='ftyp':bytes.subarray(0,3).toString()==='ID3'||(bytes[0]===255&&(bytes[1]&224)===224);
    if(!valid||bytes.length<100000||bytes.length>20000000)throw new Error('Invalid audio payload');
    await writeFile(target,bytes);
    Object.assign(track,{bytes:bytes.length,sha256:hash(bytes),downloadedAt:new Date().toISOString()});delete track.error;
    console.log('Downloaded:',track.title,bytes.length,'bytes');
  }catch(error){track.error=error.message;failed++;console.log('Failed:',track.title,error.message);}
  await writeFile(location('manifest.json'),JSON.stringify({version:1,tracks},null,2)+'\n');
}
await writeFile(location('manifest.json'),JSON.stringify({version:1,tracks},null,2)+'\n');
process.exitCode=failed?1:0;
