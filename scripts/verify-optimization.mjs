import {spawn} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,dirname,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {runtimeFingerprint} from './lib/runtime-fingerprint.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const directory=join(root,'output/performance','release-'+new Date().toISOString().replace(/[:.]/g,'-'));
await mkdir(directory,{recursive:true});
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',');
const report={at:new Date().toISOString(),node:process.version,directory,scope:only||'full',steps:[],sourceFingerprint:await runtimeFingerprint(root),ok:false};
const save=()=>writeFile(join(directory,'report.json'),JSON.stringify(report,null,2));
const hash=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
async function run(name,args,env={}){
  const log=join(directory,name+'.log'),stream=createWriteStream(log),start=Date.now();
  report.running=name;await save();console.log('RUN',name);
  const code=await new Promise((done,reject)=>{
    const child=spawn(process.execPath,args,{cwd:root,windowsHide:true,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
    child.stdout.pipe(stream,{end:false});child.stderr.pipe(stream,{end:false});
    child.once('error',reject);child.once('close',done);
  }).finally(()=>new Promise(done=>stream.end(done)));
  report.steps.push({name,code,ms:Date.now()-start,log});delete report.running;await save();
  console.log(code===0?'PASS':'FAIL',name);
  if(code!==0)throw Error(name+' failed: '+log);
}
let app;
try{
  const tests=[
    ['all-checks',['scripts/run-checks.mjs'],{DUEL_TEST_CONCURRENCY:'4'}],
    ['runtime-parity',['--test','tests/web-runtime-parity.test.mjs']],
    ['tournament-compat',['tests/tournament-browser.cjs']],
    ['ai-compat',['tests/ai-marginal-browser.cjs']],
    ['pvp-compat',['tests/pvp-browser.cjs']],
    ['rule-modes',['tests/rule-modes-browser.cjs']],
    ['v4',['tests/v4-browser.cjs']],
    ['v41',['tests/v4.1-browser.cjs']],
    ['requested-ui',['tests/requested-ui-browser.cjs']],
    ['web',['tests/optimization-browser.cjs']],
    ['p2p',['tests/p2p-browser.cjs']],
    ['tournament',['tests/worker-tournament-browser.cjs']],
    ['simulation',['tests/v2-simulation.cjs']],
    ['roulette2',['tests/rule-modes-simulation.cjs'],{DUEL_RULE:'roulette2',DUEL_RULE_RUN_DIR:join(directory,'roulette2')}],
    ['card-texts',['scripts/audit-card-texts.mjs'],{DUEL_TEXT_AUDIT_OUTPUT:join(directory,'card-texts')}]
  ];
  if(only?.some(name=>!tests.some(t=>t[0]===name)))throw Error('Unknown --only test name');
  await run('build-no-art',['scripts/build.mjs','--no-art','--out','output/no-art/index.html']);
  await run('build-web',['scripts/build-web.mjs']);
  await run('build-single',['scripts/build.mjs']);
  await copyFile(join(root,'output/build-report.json'),join(directory,'build-single.json'));
  await copyFile(join(root,'output/build-web-report.json'),join(directory,'build-web.json'));
  const {createPvpServer}=await import('../server/index.mjs');
  app=await createPvpServer({database:join(directory,'server.sqlite'),staticRoot:join(root,'dist/web')});
  const address=await app.listen(0),baseEnv={DUEL_WEB_URL:'http://127.0.0.1:'+address.port,DUEL_TEST_HTML:join(root,'index.html')};
  for(const [name,args,env]of tests){
    if(only&&!only.includes(name))continue;
    const out=join(directory,name);
    await run(name,args,{...baseEnv,DUEL_BROWSER_OUTPUT:out,DUEL_WEB_OUTPUT:out,DUEL_P2P_OUTPUT:out,DUEL_TOURNAMENT_OUTPUT:out,...env});
  }
  if(!only){
    await run('web-performance',['scripts/measure-performance.cjs',baseEnv.DUEL_WEB_URL,relative(join(root,'output/performance'),join(directory,'performance'))]);
    report.singleSha256=await hash(join(root,'index.html'));
    await run('independent-build',['scripts/build.mjs','--out',relative(root,join(directory,'independent.html'))]);
    report.independentSha256=await hash(join(directory,'independent.html'));
    await copyFile(join(directory,'build-single.json'),join(root,'output/build-report.json'));
    if(report.singleSha256!==report.independentSha256)throw Error('Independent rebuild differs');
  }
  if(report.sourceFingerprint!==await runtimeFingerprint(root))throw Error('Runtime source changed during verification');
  report.ok=true;await save();
  if(!only)await writeFile(join(root,'output/performance/release-verified.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:true,scope:report.scope,directory,sha256:report.singleSha256}));
}catch(error){report.error=error.stack;await save();console.error(error);process.exitCode=1;}
finally{await app?.close();}
