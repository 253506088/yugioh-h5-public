import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
require('../src/advanced-engine.js');
const D=globalThis.DuelData,locales=require('../src/card-locales.js');
const source=JSON.parse(await readFile(new URL('../data/locales/source-manifest.json',import.meta.url),'utf8'));
const findings=[],textIds=new Map(),samples=[];
const marker=/[\[【]\s*(?:Pendulum Effect|Monster Effect|Monster Description|灵摆效果|怪兽效果|怪兽描述|ペンデュラム効果|モンスター効果)\s*[\]】]/i;
for(const card of D.CARD_LIST.filter(c=>!c.notCollectible)){
 const r=locales[card.id];
 for(const language of ['zh-CN','en','ja']){
  const text=r?.locales[language];
  if(!text?.name||!text.description)findings.push({cardId:card.id,language,kind:'missing-text'});
  if((card.type==='pendulum'||card.pendulum)&&(!text?.pendulumDescription||marker.test((text?.description||'')+'\n'+(text?.pendulumDescription||''))))findings.push({cardId:card.id,language,kind:'pendulum-boundary'});
  if(language!=='en'&&text?.description===r?.locales.en?.description&&!/^[\s\d\p{P}]+$/u.test(text.description))findings.push({cardId:card.id,language,kind:'possible-language-fallback'});
 }
 if(r){
  const old=textIds.get(r.textId);if(old&&JSON.stringify(old.locales)!==JSON.stringify(r.locales))findings.push({cardId:card.id,other:old.cardId,textId:r.textId,kind:'shared-id-different-text'});
  else textIds.set(r.textId,{cardId:card.id,locales:r.locales});
  const original=(card.originalDescription||'').replace(marker,'').replace(/\s/g,''),english=((r.locales.en.pendulumDescription||'')+r.locales.en.description).replace(/\s/g,'');
  if(original.length>100&&(english.length<original.length*.45||english.length>original.length*2.2))findings.push({cardId:card.id,kind:'english-length-review',original:original.length,display:english.length});
 }
}
for(const year of Array.from({length:27},(_,i)=>1999+i)){
 const card=D.CARD_LIST.find(c=>c.releaseYear===year&&!c.notCollectible&&c.implementationStatus!=='pending'&&['pendulum','link','ritual','xyz','synchro','fusion'].includes(c.type))||D.CARD_LIST.find(c=>c.releaseYear===year&&!c.notCollectible);
 if(card)samples.push({cardId:card.id,year,type:card.type,providerId:card.providerId,textId:locales[card.id]?.textId,locales:locales[card.id]?.locales});
}
samples.push({cardId:'qli-scout',type:'pendulum',locales:locales['qli-scout'].locales,note:'The system boot text is the Normal Monster flavor text. The 800 LP search is in the separate Pendulum Effect section.'});
const report={at:new Date().toISOString(),sourceCommit:source.commit,cards:D.CARD_LIST.filter(c=>!c.notCollectible).length,findings,samples,scope:'Read-only heuristic audit against retained text snapshots. Not a semantic rules certification or new official-text verification.'};
const out=resolve(process.env.DUEL_TEXT_AUDIT_OUTPUT||'output/performance/card-texts');await mkdir(out,{recursive:true});await writeFile(resolve(out,'audit.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({cards:report.cards,findings:findings.length,byKind:Object.fromEntries([...new Set(findings.map(f=>f.kind))].map(k=>[k,findings.filter(f=>f.kind===k).length])),samples:samples.length}));
