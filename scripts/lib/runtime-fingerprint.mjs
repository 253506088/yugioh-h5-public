import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { scriptFiles } from './script-files.mjs';
export async function runtimeFingerprint(root) {
  const hash=createHash('sha256');
  for(const file of [...scriptFiles,'engine-worker.js','web-loader.js','web-boot.js'])hash.update(file).update((await readFile(join(root,'src',file),'utf8')).replace(/\r\n/g,'\n'));
  hash.update('card-aliases').update((await readFile(join(root,'data/card-aliases.json'),'utf8')).replace(/\r\n/g,'\n'));
  return hash.digest('hex');
}
