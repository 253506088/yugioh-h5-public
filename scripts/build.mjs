import {runtimeFingerprint} from './lib/runtime-fingerprint.mjs';
import { workerBundle } from './lib/worker-bundle.mjs';
import { styleFiles, scriptFiles } from './lib/script-files.mjs';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { createRequire } from 'node:module';
import { localArtwork } from './lib/build-art.mjs';
import { writeAtomic } from './lib/io.mjs';
import { embeddedScripts } from './lib/embedded-scripts.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = {};
assets['card-back'] = 'data:image/jpeg;base64,' + (await readFile(join(root, 'assets/duel/card-back.jpg'))).toString('base64');
const require = createRequire(import.meta.url);
require('../src/advanced-engine.js');require('../src/advanced-effects.js');
const { CARDS, CARD_LIST, DECKS } = globalThis.DuelData;
const localeData=require('../src/card-locales.js'),collectible=CARD_LIST.filter(c=>!c.notCollectible);
const localization={defaultLanguage:'zh-CN',byLanguage:Object.fromEntries(['zh-CN','en','ja'].map(language=>[language,collectible.filter(c=>localeData[c.id]?.locales[language]?.name&&localeData[c.id]?.locales[language]?.description&&(c.type!=='pendulum'||localeData[c.id]?.locales[language]?.pendulumDescription)).length])),encyclopediaLinks:collectible.filter(c=>localeData[c.id]?.encyclopediaUrl).length};
const argv=process.argv.slice(2),artwork=await localArtwork(root,CARD_LIST,{disabled:argv.includes('--no-art')}),originals=artwork.art;
if(!argv.includes('--no-art')){
  for(const file of await readdir(join(root,'assets/duel/art')).catch(()=>[]))if(file.endsWith('.webp')){
    const id=file.slice(0,-5);if(CARDS[id]&&!originals[id])originals[id]='data:image/webp;base64,'+(await readFile(join(root,'assets/duel/art',file))).toString('base64');
  }
}
const frames={};for(const file of await readdir(join(root,'assets/duel/frames')))if(file.endsWith('.webp'))frames[file.slice(0,-5)]='data:image/webp;base64,'+(await readFile(join(root,'assets/duel/frames',file))).toString('base64');
const musicManifest=JSON.parse(await readFile(join(root,'assets/audio/manifest.json'),'utf8'));
const music=await Promise.all(musicManifest.tracks.map(async track=>{
  const bytes=argv.includes('--no-audio')?null:await readFile(join(root,track.path)).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
  return {id:track.id,title:track.title,scene:track.scene,source:track.source,src:argv.includes('--no-audio')?'':bytes?'data:audio/'+(track.path.endsWith('.m4a')?'mp4':'mpeg')+';base64,'+bytes.toString('base64'):track.url};
}));
const outAt=argv.indexOf('--out'),outputPath=outAt>=0?resolve(root,argv[outAt+1]||''):join(root,'index.html');
if(!outputPath.startsWith(root+'\\')&&!outputPath.startsWith(root+'/'))throw new Error('构建输出必须位于项目目录内。');
const styles = (await Promise.all(styleFiles.map(file => readFile(join(root, 'src', file), 'utf8')))).join('\n\n');
const scripts = await Promise.all(scriptFiles.map(async file => (await readFile(join(root, 'src', file), 'utf8')).replace(/\r\n/g,'\n')));
scripts.unshift('globalThis.DuelCardAliases='+JSON.stringify(JSON.parse(await readFile(join(root,'data/card-aliases.json'),'utf8'))).replace(/</g,'\\u003c')+';');
new Script(scripts.join('\n\n'), { filename: 'duel-single-file.js' });
const bundle=embeddedScripts(scripts.join('\n\n'));
const workerSource=await workerBundle(root),rulesHash=await runtimeFingerprint(root);
let template = await readFile(join(root, 'src/index.template.html'), 'utf8');
template = template.replace('/*__STYLES__*/', () => styles)
  .replace('/*__ASSETS__*/', () => 'window.DUEL_WORKER_BUNDLE='+JSON.stringify(workerSource)+';window.DUEL_ART = ' + JSON.stringify(assets) + ';\nwindow.DUEL_ORIGINAL_ART = ' + JSON.stringify(originals) + ';\nwindow.DUEL_FRAMES='+JSON.stringify(frames)+';\nwindow.DUEL_MUSIC='+JSON.stringify(music)+';\nwindow.DUEL_BUILD_CONFIG='+JSON.stringify({rulesHash,onlineArtDefault:Object.keys(originals).length<collectible.length,languages:['zh-CN','en','ja']})+';')
  .replace('/*__SCRIPTS__*/', () => bundle.code);
if (template.includes('/*__')) throw new Error('Unreplaced build placeholder');
if(Buffer.byteLength(template)>=100*1024*1024)throw new Error('单文件发布包必须小于 GitHub 100 MiB 上限。');
await writeAtomic(outputPath, template);
await mkdir(join(root, 'output'), { recursive: true });
const archive = argv.includes('--archive') ? join(root, 'output/v4-builds', new Date().toISOString().replace(/[:.]/g, '-')) : null;
if(archive){await mkdir(archive, { recursive: true });await writeFile(join(archive, 'index.html'), template);}
const report = { title: '游戏王 · 决斗之境 V4.1 · 三语版', builtAt: new Date().toISOString(), collectibleCards: CARD_LIST.filter(c => !c.notCollectible).length, presetDecks: Object.values(DECKS).filter(d => d.preset).length, playableCards:CARD_LIST.filter(c=>!c.notCollectible&&c.implementationStatus!=='pending').length,pendingEffects:CARD_LIST.filter(c=>c.implementationStatus==='pending').map(c=>c.id),embeddedOriginalArt: Object.keys(originals).length,artwork:artwork.stats,artworkWarnings:artwork.warnings,embeddedCardBack: true, sourceFiles: ['src/index.template.html', ...styleFiles.map(f=>'src/'+f), ...scriptFiles.map(f=>'src/'+f)], output: outputPath, archive, bytes: Buffer.byteLength(template), externalLogicDependencies: 0, artworkPolicy:'embedded-first-optional-online',onlineArtDefault:argv.includes('--no-art'),languages:['zh-CN','en','ja'] };
report.localization=localization;report.rulesHash=rulesHash;report.workerBundle={format:'gzip-base64',compressedBytes:Buffer.from(workerSource,'base64').length};
report.scriptBundle={format:'gzip-base64',uncompressedBytes:Buffer.byteLength(scripts.join('\n\n')),compressedBytes:bundle.bytes,minimumBrowser:'Current Chrome/Edge/Firefox/Safari with DecompressionStream'};
report.experience={embeddedTracks:music.filter(t=>t.src.startsWith('data:')).length,streamedTracks:music.filter(t=>t.src.startsWith('https:')).length,frames:Object.keys(frames),viewportDuel:true,adjustableType:true,chainPlayback:true};
report.onlineArtDefault=Object.keys(originals).length<collectible.length;
if(archive)await writeFile(join(archive, 'build-report.json'), JSON.stringify(report, null, 2));
await writeAtomic(join(root, 'output/build-report.json'), JSON.stringify(report, null, 2));
console.log(`Built ${outputPath} · ${(Buffer.byteLength(template) / 1024).toFixed(1)} KB · ${report.collectibleCards} cards · ${report.presetDecks} decks · ${report.embeddedOriginalArt} local images · 中文 / English / 日本語 · optional online art`);
if(artwork.warnings.length)console.log(`${artwork.warnings.length} non-blocking artwork warnings recorded in output/build-report.json`);
