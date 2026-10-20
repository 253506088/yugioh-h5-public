import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createContext, Script} from 'node:vm';

const require=createRequire(import.meta.url);
const root=resolve('dist/web');
const read=path=>readFile(resolve(root,path),'utf8');

test('web and Worker register the same cards and effect metadata as the canonical engine',async()=>{
  require('../src/advanced-engine.js');
  const report=JSON.parse(await read('build-report.json'));
  const manifest=JSON.parse(await read(report.files.find(f=>/^app\/manifest\./.test(f.file)).file));
  const context=createContext({console,performance,setTimeout,clearTimeout});
  context.window=context;
  for(const item of manifest.worker){
    if(item.script)new Script(await read(item.script),{filename:item.script}).runInContext(context);
    if(item.rows)context.DuelWebRows=(await Promise.all(item.rows.map(async file=>JSON.parse(await read(file))))).flat();
    if(item.locales)context.DuelCardLocales=Object.fromEntries((await Promise.all(item.locales.map(async file=>JSON.parse(await read(file))))).flat());
  }
  // Serializing omits functions, but retains their derived registration flags.
  // Name minification previously changed source-inspected rule metadata.
  const plain=value=>JSON.parse(JSON.stringify(value));
  assert.deepEqual(plain(context.DuelData.CARDS),plain(globalThis.DuelData.CARDS));
  const actual=context.DuelEffects.defs,expected=globalThis.DuelEffects.defs;
  assert.deepEqual(Object.keys(actual),Object.keys(expected));
  const mismatches=Object.keys(expected).filter(key=>JSON.stringify(actual[key])!==JSON.stringify(expected[key]));
  assert.deepEqual(mismatches.slice(0,20),[],mismatches.length+' effects differ between web and canonical source');
});
