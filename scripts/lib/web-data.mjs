import { createRequire } from 'node:module';
import { join } from 'node:path';

// Additive web outputs: the canonical offline generators and CommonJS exports stay intact.
export async function splitWebData({ root, rawEarly, emit }) {
  rawEarly=rawEarly.replace(/\r\n/g,'\n');
  const start = rawEarly.indexOf('const rows=') + 'const rows='.length;
  const end = rawEarly.indexOf(';\nfor(const row of rows)', start);
  if (start < 11 || end < 0) throw Error('Unknown early-cards generator format');
  const rows = JSON.parse(rawEarly.slice(start, end));
  const groups = new Map();
  for (const row of rows) { const year = row.releaseYear || 0; if (!groups.has(year)) groups.set(year, []); groups.get(year).push(row); }
  async function chunks(name, entries) {
    const files = []; let part = [], size = 0;
    for (const row of entries) {
      const bytes = Buffer.byteLength(JSON.stringify(row));
      if (size + bytes > 450000 && part.length) { files.push(await emit(name + '-' + files.length, JSON.stringify(part), 'json')); part = []; size = 0; }
      part.push(row); size += bytes;
    }
    if (part.length) files.push(await emit(name + '-' + files.length, JSON.stringify(part), 'json'));
    return files;
  }
  const rowFiles = [];
  for (const [year, entries] of groups) rowFiles.push(...await chunks('cards-' + year, entries));
  const require = createRequire(import.meta.url), locales = require(join(root, 'src/card-locales.js'));
  const index = [], languages = {};
  for (const [id, record] of Object.entries(locales)) {
    const { locales: texts, ...metadata } = record;
    index.push([id, { ...metadata, locales: Object.fromEntries(Object.entries(texts).map(([lang, text]) => [lang, { name: text.name }])) }]);
  }
  for (const language of ['zh-CN', 'en', 'ja']) languages[language] = await chunks('locale-' + language, Object.entries(locales).map(([id, record]) => [id, record.locales[language]]));
  return { rows: rowFiles, index: await chunks('card-index', index), languages, registration: rawEarly.slice(0, start) + 'globalThis.DuelWebRows' + rawEarly.slice(end) + '\ndelete globalThis.DuelWebRows;' };
}
