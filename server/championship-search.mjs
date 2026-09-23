import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { safeFetch, extractText } from './ai-network.mjs';
import Provider from '../src/ai-provider.js';
const records = JSON.parse(await readFile(new URL('../data/deck-research/world-champions.json', import.meta.url), 'utf8'));
const fail = code => Object.assign(new Error(code), { code, status: 422 });
export async function championshipDeck(year, { fetcher = safeFetch, signal, catalog = records } = {}) {
  const record = catalog.find(r => r.year === year);
  if (!record) throw fail('championshipUnavailable');
  const deadline = AbortSignal.any([AbortSignal.timeout(30000), ...(signal ? [signal] : [])]);
  const response = await fetcher(record.url, { signal: deadline });
  if (!response.ok) throw fail('championshipUnavailable');
  const html = await Provider.limitedText(response), text = extractText(html).replace(/\s+/g, ' ');
  const winner = new RegExp('1st\\s*[,.:]?\\s*' + record.champion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (!text.includes('World Championship ' + year) || !winner.test(text) || !html.includes(record.imageUrl)) throw fail('championshipChanged');
  const image = await fetcher(record.imageUrl, { signal: deadline });
  if (!image.ok || Number(image.headers.get('content-length')) > 2 * 1024 * 1024) throw fail('championshipUnavailable');
  const bytes = Buffer.from(await image.arrayBuffer());
  if (bytes.length > 2 * 1024 * 1024 || createHash('sha256').update(bytes).digest('hex') !== record.imageSha256) throw fail('championshipChanged');
  const entries = zone => record[zone].map(c => ({ name: c.password, count: c.count, language: 'unknown', isPassword: true }));
  return { provider: 'Road of the King', searches: [{ query: 'World Championship ' + year, format: 'worlds', status: 'ok', count: 1 }], warnings: [], sources: [{
    id: 'world-' + year + '-1', title: record.title, provider: 'Road of the King', url: record.url, author: record.champion,
    format: 'World Championship ' + year, retrievedAt: new Date().toISOString(), description: record.archetype + '. Original first-place list, verified against the live event page and exact published deck image.',
    verification: 'image-sha256', imageSha256: record.imageSha256, evidenceUrl: record.imageUrl,
    deck: { name: year + ' World Champion · ' + record.archetype, main: entries('main'), extra: entries('extra'), side: entries('side'), uncertain: [] }
  }] };
}
