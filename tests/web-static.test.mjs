import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {gzipSync,brotliCompressSync} from 'node:zlib';
import {resolve} from 'node:path';
import {serveStatic,acceptedEncoding} from '../server/static.mjs';
import {splitPendulum,applyTextOverrides} from '../scripts/lib/card-text.mjs';

test('static server serves compressed hashed resources, revalidates HTML, rejects private paths',async()=>{
 const root=resolve('output/performance/static-fixture');await mkdir(resolve(root,'app'),{recursive:true});
 const name='app/test.0123456789abcdef.js',source='window.test=1;';
 await Promise.all([writeFile(resolve(root,name),source),writeFile(resolve(root,name+'.gz'),gzipSync(source)),writeFile(resolve(root,name+'.br'),brotliCompressSync(source)),writeFile(resolve(root,'index.html'),'<h1>test</h1>')]);
 const server=createServer((req,res)=>serveStatic(req,res,{root,headers:{}}).catch(()=>{res.writeHead(404);res.end();}));
 await new Promise(done=>server.listen(0,'127.0.0.1',done));const url='http://127.0.0.1:'+server.address().port;
 try{
  let r=await fetch(url+'/'+name,{headers:{'accept-encoding':'br, gzip'}});assert.equal(r.headers.get('content-encoding'),'br');assert.match(r.headers.get('cache-control'),/immutable/);assert.equal(await r.text(),source);
  r=await fetch(url+'/'+name,{headers:{'accept-encoding':'br;q=0, gzip;q=1'}});assert.equal(r.headers.get('content-encoding'),'gzip');assert.equal(await r.text(),source);
  r=await fetch(url+'/');assert.equal(r.headers.get('cache-control'),'no-cache');const tag=r.headers.get('etag');await r.text();
  r=await fetch(url+'/',{headers:{'if-none-match':tag}});assert.equal(r.status,304);
  assert.equal((await fetch(url+'/data/locales/source-manifest.json')).status,404);
  assert.equal((await fetch(url+'/app/test.js')).status,404);
  assert.deepEqual(acceptedEncoding('br;q=0,gzip;q=0'),[]);
 }finally{await new Promise(done=>server.close(done));}
});
test('pendulum split keeps Normal Monster flavor separate and overrides require provenance',()=>{
 const r=splitPendulum('[Pendulum Effect]\nPay 800 LP.\n[Monster Description]\nBooting in Replica Mode...');assert.equal(r.pendulumDescription,'Pay 800 LP.');assert.equal(r.description,'Booting in Replica Mode...');
 const records={a:{locales:{en:{description:'old'}}}};
 assert.throws(()=>applyTextOverrides(records,{schemaVersion:1,entries:[{cardId:'a',language:'en',text:{description:'new'}}]}),/source/);
 applyTextOverrides(records,{schemaVersion:1,entries:[{cardId:'a',language:'en',reason:'test',source:'fixture',verifiedAt:'2026-10-18',text:{description:'new'}}]});assert.equal(records.a.locales.en.description,'new');
});
