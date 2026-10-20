import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.ico': 'image/x-icon' };
const legacyAsset = /^\/assets\/(?:duel\/(?:card-back\.jpg|(?:art|frames)\/[a-zA-Z0-9_-]+\.webp)|audio\/[a-zA-Z0-9._-]+\.(?:mp3|m4a|ogg))$/;
const immutableAsset = /^\/(?:app\/[a-zA-Z0-9_-]+\.[a-f0-9]{16}\.(?:js|css|json)|assets\/[a-f0-9]{16}\.(?:webp|jpg|png|mp3|m4a|ogg))$/;
export function acceptedEncoding(header = '') {
  const q = new Map(header.split(',').map(part => { const [name, ...args] = part.trim().toLowerCase().split(';'); const quality = args.find(s => s.trim().startsWith('q=')); return [name, quality ? Number(quality.trim().slice(2)) : 1]; }));
  return ['br', 'gzip'].filter(name => (q.get(name) ?? q.get('*') ?? 0) > 0).sort((a, b) => (q.get(b) ?? q.get('*')) - (q.get(a) ?? q.get('*')));
}
export async function serveStatic(request, response, { root, headers }) {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const html = pathname === '/' || pathname === '/index.html', immutable = immutableAsset.test(pathname);
  if (!html && !immutable && !legacyAsset.test(pathname)) { response.writeHead(404, headers); response.end('Not found'); return; }
  const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(resolve(root) + sep)) { response.writeHead(404, headers); response.end(); return; }
  const info = await stat(file);
  let selected = file, encoding, selectedInfo = info;
  for (const name of acceptedEncoding(request.headers['accept-encoding'])) {
    try { selectedInfo = await stat(file + (name === 'br' ? '.br' : '.gz')); selected = file + (name === 'br' ? '.br' : '.gz'); encoding = name; break; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const streamGzip = !encoding && html && acceptedEncoding(request.headers['accept-encoding']).includes('gzip');
  if (streamGzip) encoding = 'gzip';
  const etag = `W/"${info.size}-${Math.floor(info.mtimeMs)}-${encoding || 'identity'}"`;
  const base = { ...headers, ETag: etag, 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': html ? 'no-cache' : immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=86400', Vary: 'Accept-Encoding' };
  if (request.headers['if-none-match'] === etag) { response.writeHead(304, base); response.end(); return; }
  response.writeHead(200, { ...base, ...(encoding ? { 'Content-Encoding': encoding } : {}), ...(!streamGzip ? { 'Content-Length': selectedInfo.size } : {}) });
  if (request.method === 'HEAD') { response.end(); return; }
  await pipeline(createReadStream(selected), ...(streamGzip ? [createGzip({ level: 3 })] : []), response);
}
