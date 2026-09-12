import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { createRequire } from 'node:module';
import { localArtwork } from './lib/build-art.mjs';
import { writeAtomic } from './lib/io.mjs';

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
const styleFiles = ['style.css', 'expansion.css', 'link.css', 'early.css','experience.css','tournament.css'];
const scriptFiles = ['cards.js', 'expansion-cards.js', 'link-cards.js', 'early-cards.js', 'early-decks.js', 'link-rules.js', 'deck-tools.js', 'engine.js', 'advanced-engine.js', 'early-engine.js', 'advanced-effects.js', 'effects-classic.js', 'effects-hero.js', 'effects-blackwing.js', 'effects-synchron.js', 'effects-utopia.js', 'effects-qliphort.js', 'effects-exodia.js', 'effects-cyber.js', 'effects-crystron.js', 'effects-tearlaments.js', 'effects-link.js', 'effects-early.js', 'effects-early-spells.js', 'effects-early-monsters.js', 'effects-early-traps.js', 'audio.js', 'artwork-hybrid.js', 'card-view.js', 'workshop.js', 'game-v2.js'];
scriptFiles.splice(scriptFiles.indexOf('audio.js'),0,'effects-early-complex.js','effects-early-advanced.js');
scriptFiles.splice(scriptFiles.indexOf('audio.js'),0,'effects-2002.js','effects-2002-monsters.js','effects-2002-spells.js','effects-2002-traps.js');
scriptFiles.splice(scriptFiles.indexOf('advanced-effects.js'),0,'early-engine-extra.js');
scriptFiles.splice(scriptFiles.indexOf('audio.js'),0,'card-locales.js','i18n-data.js','i18n-effects.js','i18n-help.js','i18n-experience.js','i18n-tournament.js','i18n.js','experience.js');
scriptFiles.splice(scriptFiles.indexOf('game-v2.js'),0,'tournament.js','tournament-storage.js','tournament-ui.js');
const styles = (await Promise.all(styleFiles.map(file => readFile(join(root, 'src', file), 'utf8')))).join('\n\n');
const scripts = await Promise.all(scriptFiles.map(file => readFile(join(root, 'src', file), 'utf8')));
new Script(scripts.join('\n\n'), { filename: 'duel-single-file.js' });
let template = await readFile(join(root, 'src/index.template.html'), 'utf8');
template = template.replace('/*__STYLES__*/', () => styles)
  .replace('/*__ASSETS__*/', () => 'window.DUEL_ART = ' + JSON.stringify(assets) + ';\nwindow.DUEL_ORIGINAL_ART = ' + JSON.stringify(originals) + ';\nwindow.DUEL_FRAMES='+JSON.stringify(frames)+';\nwindow.DUEL_MUSIC='+JSON.stringify(music)+';\nwindow.DUEL_BUILD_CONFIG='+JSON.stringify({onlineArtDefault:Object.keys(originals).length<collectible.length,languages:['zh-CN','en','ja']})+';')
  .replace('/*__SCRIPTS__*/', () => scripts.join('\n\n'));
if (template.includes('/*__')) throw new Error('Unreplaced build placeholder');
await writeAtomic(outputPath, template);
await mkdir(join(root, 'output'), { recursive: true });
const archive = join(root, 'output/v4-builds', new Date().toISOString().replace(/[:.]/g, '-'));
await mkdir(archive, { recursive: true });
await writeFile(join(archive, 'index.html'), template);
const report = { title: '游戏王 · 决斗之境 V4.1 · 三语版', builtAt: new Date().toISOString(), collectibleCards: CARD_LIST.filter(c => !c.notCollectible).length, presetDecks: Object.values(DECKS).filter(d => d.preset).length, playableCards:CARD_LIST.filter(c=>!c.notCollectible&&c.implementationStatus!=='pending').length,pendingEffects:CARD_LIST.filter(c=>c.implementationStatus==='pending').map(c=>c.id),embeddedOriginalArt: Object.keys(originals).length,artwork:artwork.stats,artworkWarnings:artwork.warnings,embeddedCardBack: true, sourceFiles: ['src/index.template.html', ...styleFiles.map(f=>'src/'+f), ...scriptFiles.map(f=>'src/'+f)], output: outputPath, archive, bytes: Buffer.byteLength(template), externalLogicDependencies: 0, artworkPolicy:'embedded-first-optional-online',onlineArtDefault:argv.includes('--no-art'),languages:['zh-CN','en','ja'] };
report.localization=localization;
report.experience={embeddedTracks:music.filter(t=>t.src.startsWith('data:')).length,streamedTracks:music.filter(t=>t.src.startsWith('https:')).length,frames:Object.keys(frames),viewportDuel:true,adjustableType:true,chainPlayback:true};
report.onlineArtDefault=Object.keys(originals).length<collectible.length;
await writeFile(join(archive, 'build-report.json'), JSON.stringify(report, null, 2));
await writeAtomic(join(root, 'output/build-report.json'), JSON.stringify(report, null, 2));
console.log(`Built ${outputPath} · ${(Buffer.byteLength(template) / 1024).toFixed(1)} KB · ${report.collectibleCards} cards · ${report.presetDecks} decks · ${report.embeddedOriginalArt} local images · 中文 / English / 日本語 · optional online art`);
if(artwork.warnings.length)console.log(`${artwork.warnings.length} non-blocking artwork warnings recorded in output/build-report.json`);
