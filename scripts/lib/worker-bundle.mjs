import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { Script } from 'node:vm';
import { createRequire } from 'node:module';
import { scriptFiles } from './script-files.mjs';

export async function workerBundle(root) {
  const require = createRequire(import.meta.url), locales = require(join(root, 'src/card-locales.js'));
  const files = scriptFiles.slice(0, scriptFiles.indexOf('rule-modes.js') + 1).filter(f => f !== 'card-catalog.js');
  const source = ['globalThis.window=globalThis;', ...await Promise.all(files.map(async file => file === 'card-locales.js'
    ? 'globalThis.DuelCardLocales=' + JSON.stringify(Object.fromEntries(Object.entries(locales).map(([id, r]) => [id, { setcodes: r.setcodes, setcodeSourceId: r.setcodeSourceId }]))) + ';'
    : readFile(join(root, 'src', file), 'utf8'))), await readFile(join(root, 'src/match-ai.js'), 'utf8'), await readFile(join(root, 'src/tournament.js'), 'utf8'), await readFile(join(root, 'src/engine-worker.js'), 'utf8')].join('\n');
  new Script(source, { filename: 'engine-worker.js' });
  return gzipSync(source.replace(/\r\n/g,'\n'), { level: 9 }).toString('base64');
}
