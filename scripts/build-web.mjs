import {runtimeFingerprint} from './lib/runtime-fingerprint.mjs';
import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { resolve, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { createRequire } from 'node:module';
import { Script } from 'node:vm';
import { transform } from 'esbuild';
import { scriptFiles, styleFiles } from './lib/script-files.mjs';
import { splitWebData } from './lib/web-data.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist/web');
await mkdir(join(out, 'app'), { recursive: true });
await mkdir(join(out, 'assets'), { recursive: true });
const hash = data => createHash('sha256').update(data).digest('hex').slice(0, 16);
const report = { format: 'web', at: new Date().toISOString(), files: [], sourceFiles: scriptFiles, output: out };
async function emit(name, data, extension = 'js') {
  const bytes = Buffer.from(data), file = `app/${name}.${hash(bytes)}.${extension}`;
  if (extension === 'js' && bytes.length > 2 * 1024 * 1024) throw Error('Oversized script: ' + name);
  const gz = gzipSync(bytes, { level: 9 }), br = brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 6 } });
  await Promise.all([writeFile(join(out, file), bytes), writeFile(join(out, file + '.gz'), gz), writeFile(join(out, file + '.br'), br)]);
  report.files.push({ file, bytes: bytes.length, gzip: gz.length, brotli: br.length });
  return './' + file;
}
async function js(name, source) {
  new Script(source, { filename: name });
  // Some legacy rule registrations inspect authored function bodies. Preserve
  // identifiers and syntax so the web build derives exactly the same rules.
  const code=(await transform(source, { minifyWhitespace: true, minifyIdentifiers: false, minifySyntax: false, target: 'es2022', legalComments: 'none' })).code;
  new Script(code,{filename:name});
  return emit(name,code);
}
async function media(path) {
  const data = await readFile(join(root, path));
  const url = 'assets/' + hash(data) + extname(path);
  await copyFile(join(root, path), join(out, url));
  return './' + url;
}
const require = createRequire(import.meta.url);
const rawEarly = await readFile(join(root, 'src/early-cards.js'), 'utf8');
const data = await splitWebData({ root, rawEarly, emit });
const originalArt = {}, frames = {};
for (const f of await readdir(join(root, 'assets/duel/art'))) if (f.endsWith('.webp')) originalArt[f.slice(0, -5)] = await media('assets/duel/art/' + f);
for (const f of await readdir(join(root, 'assets/duel/frames'))) if (f.endsWith('.webp')) frames[f.slice(0, -5)] = await media('assets/duel/frames/' + f);
const musicManifest = JSON.parse(await readFile(join(root, 'assets/audio/manifest.json'), 'utf8'));
const music = [];
for (const track of musicManifest.tracks) {
  let src;
  try { src = await media(track.path); } catch (e) { if (e.code !== 'ENOENT') throw e; src = track.url; }
  music.push({ id: track.id, title: track.title, scene: track.scene, source: track.source, src });
}
const assets = { 'card-back': 'data:image/jpeg;base64,' + (await readFile(join(root, 'assets/duel/card-back.jpg'))).toString('base64') };
const rulesHash=await runtimeFingerprint(root);
const mediaURL = await js('media', `globalThis.DUEL_ART=${JSON.stringify(assets)};globalThis.DUEL_ORIGINAL_ART=${JSON.stringify(originalArt)};globalThis.DUEL_FRAMES=${JSON.stringify(frames)};globalThis.DUEL_MUSIC=${JSON.stringify(music)};globalThis.DUEL_BUILD_CONFIG={rulesHash:'${rulesHash}',onlineArtDefault:false,languages:['zh-CN','en','ja'],format:'web'};`);
const featureFiles = {
  deck: ['card-catalog.js', 'deck-parse.js', 'card-resolver.js', 'deck-research.js', 'ai-provider.js', 'ai-import-ui.js', 'workshop.js'],
  tournament: ['tournament.js', 'tournament-storage.js', 'tournament-ui.js'],
  pvp: ['pvp-client.js', 'pvp-ui.js'],
  p2p: ['pvp-client.js','pvp-public.js','pvp-projection.js','pvp-intent.js','p2p.js','p2p-ui.js']
};
const sources = Object.fromEntries(await Promise.all(scriptFiles.map(async f => [f, (await readFile(join(root, 'src', f), 'utf8')).replace(/\r\n/g, '\n')])));
const features = {};
for (const [name, files] of Object.entries(featureFiles)) {
  features[name]=[];let part='';
  for(const file of files){
    if(part&&Buffer.byteLength(part)+Buffer.byteLength(sources[file])>550000){features[name].push(await js(name+'-'+features[name].length,part));part='';}
    part+=sources[file]+'\n';
  }
  if(part)features[name].push(await js(name+'-'+features[name].length,part));
}
const deferred = new Set(Object.values(featureFiles).flat());
const core = [], worker = [];
let buffer = '', n = 0;
async function flush() { if (buffer) { const url = await js('duel-' + n++, buffer); core.push({ script: url }); buffer = ''; } }
for (const file of scriptFiles) {
  if (deferred.has(file)) continue;
  if (file === 'early-cards.js') {
    await flush();
    core.push({ rows: data.rows });
    buffer += data.registration + '\n';
  } else if (file === 'card-locales.js') {
    await flush(); core.push({ locales: data.index });
  } else {
    if (Buffer.byteLength(buffer) + Buffer.byteLength(sources[file]) > 550000) await flush();
    buffer += sources[file] + '\n';
  }
  // Everything through rule modes is DOM-independent and is shared by workers.
  if (file === 'rule-modes.js') { await flush(); worker.push(...core); }
}
await flush();
const aliases = await emit('aliases', await readFile(join(root, 'data/card-aliases.json')), 'json');
const workerURL=await js('engine-worker',await readFile(join(root,'src/engine-worker.js'),'utf8'));
const workerTournament=await js('tournament-core',sources['match-ai.js']+'\n'+sources['tournament.js']);
const manifest = { core, worker, workerURL,workerTournament,features, aliases, media: mediaURL, languages: data.languages };
const manifestURL = await emit('manifest', JSON.stringify(manifest), 'json');
const css = (await transform((await Promise.all(styleFiles.map(f => readFile(join(root, 'src', f), 'utf8')))).join('\n'), { loader: 'css', minify: true })).code;
const cssURL = await emit('style', css, 'css');
const loaderURL = await js('loader', await readFile(join(root, 'src/web-loader.js'), 'utf8'));
require('../src/advanced-engine.js');
for(const file of scriptFiles.filter(f=>f.startsWith('i18n-')))require(join(root,'src',file));
const templateSource=await readFile(join(root,'src/index.template.html'),'utf8');
const homeTranslations=Object.fromEntries(Object.entries(globalThis.DuelUITranslations.messages).filter(([key])=>templateSource.includes(key)));
const bootURL = await js('boot', (await readFile(join(root, 'src/web-boot.js'), 'utf8')).replace('__MANIFEST_URL__', manifestURL).replace('__LOADER_URL__', loaderURL).replace('__HOME_TRANSLATIONS__',JSON.stringify(homeTranslations)));
let html = (await readFile(join(root, 'src/index.template.html'), 'utf8'))
  .replace('<style>/*__STYLES__*/</style>', `<link rel="stylesheet" href="${cssURL}"><link rel="modulepreload" href="${core[0].script}">`)
  .replace('<script>/*__ASSETS__*/</script>', '')
  .replace('<script>/*__SCRIPTS__*/</script>', `<script type="module" src="${bootURL}"></script>`);
// Give the real home screen a useful first paint before loading the duel engine.
require('../src/advanced-engine.js');
const cards = globalThis.DuelData.CARD_LIST.filter(c => !c.notCollectible).length, decks = Object.values(globalThis.DuelData.DECKS).filter(d => d.preset).length;
html = html.replace('<div class="home-stats" id="home-stats"></div>', `<div class="home-stats" id="home-stats"><span><b>${cards.toLocaleString('en-US')}</b> 张卡片</span><span><b>${decks}</b> 套预设</span><span><b>6</b> 种召唤方式</span></div>`)
  .replace(/(<b id="home-card-count">)[^<]+/, '$1' + cards.toLocaleString('en-US') + ' 张卡片')
  .replace('<div class="home-art" id="home-art" aria-hidden="true"></div>', '<div class="home-art" id="home-art" aria-hidden="true">' + ['dark-magician', 'blue-eyes', 'stardust-dragon'].map((id, i) => `<div class="hero-card hero-card-${['left','right','center'][i]}"><img width="240" height="350" src="${originalArt[id]}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:9px"></div>`).join('') + '</div>')
  .replace('<body>', '<body data-screen="home" class="web-booting">')
  .replace('<main class="app-main">', '<main class="app-main" hidden>');
await writeFile(join(out, 'index.html'), html);
report.htmlBytes = Buffer.byteLength(html);report.rulesHash=rulesHash;
report.images = Object.keys(originalArt).length;
report.tracks = music.length;
report.initial = [bootURL, cssURL];
await writeFile(join(out, 'build-report.json'), JSON.stringify(report, null, 2));
await mkdir(join(root, 'output'), { recursive: true });
await writeFile(join(root, 'output/build-web-report.json'), JSON.stringify(report, null, 2));
console.log(`Web: ${report.htmlBytes} byte HTML, ${report.files.length} static files, ${report.images} images; ${out}`);
