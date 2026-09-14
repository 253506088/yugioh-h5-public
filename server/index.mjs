import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, dirname, sep, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { WebSocketServer, WebSocket } from 'ws';
import { Store } from './store.mjs';
import { PvpService, PROTOCOL } from './service.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mime = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.ico': 'image/x-icon' };
const publicAsset = /^\/assets\/(?:duel\/(?:card-back\.jpg|(?:art|frames)\/[a-zA-Z0-9_-]+\.webp)|audio\/[a-zA-Z0-9._-]+\.(?:mp3|m4a|ogg))$/;

function bounded(value, fallback, min, max, name) {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error(`${name} must be an integer between ${min} and ${max}`);
  return n;
}

export async function createPvpServer(options = {}) {
  const store = options.store || new Store(options.database || resolve(process.env.DUEL_DATA_DIR || resolve(root, '.pvp-data'), 'pvp.sqlite'));
  const service = new PvpService({ store, ...options.serviceOptions, maxRooms: options.maxRooms ?? 100 });
  const origins = new Set((options.origins || []).map(value => new URL(value).origin));
  const peers = new Map(), creationRates = new Map();
  const peerOf = request => options.trustProxy && request.headers['x-forwarded-for'] ? String(request.headers['x-forwarded-for']).split(',').at(-1).trim() : request.socket.remoteAddress;
  const originAllowed = request => {
    if (!request.headers.origin) return true; // Native clients still authenticate with a session capability.
    try {
      const origin = new URL(request.headers.origin);
      return origins.has(origin.origin) || ['http:', 'https:'].includes(origin.protocol) && origin.host === request.headers.host;
    } catch { return false; }
  };
  const headers = {
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https:; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
  };
  const server = createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { ...headers, Allow: 'GET, HEAD' }); response.end(); return; }
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname === '/api/health' || pathname === '/api/pvp/info') {
        const body = JSON.stringify({ ok: service.healthy, service: 'duel-sanctuary-pvp', protocol: PROTOCOL, mode: 'best-of-one',
          online: service.connections.size, rooms: service.rooms.size, disconnectSeconds: service.disconnectMs / 1000, clockSeconds: [180, 300, 600], incrementSeconds: 20 });
        response.writeHead(service.healthy ? 200 : 503, { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(request.method === 'HEAD' ? undefined : body); return;
      }
      if (pathname !== '/' && pathname !== '/index.html' && !publicAsset.test(pathname)) { response.writeHead(404, headers); response.end('Not found'); return; }
      const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(root + sep)) { response.writeHead(404, headers); response.end(); return; }
      const info = await stat(file), etag = `W/"${info.size}-${Math.floor(info.mtimeMs)}"`;
      if (request.headers['if-none-match'] === etag) { response.writeHead(304, { ...headers, ETag: etag }); response.end(); return; }
      const html = extname(file) === '.html', gzip = html && /\bgzip\b/.test(request.headers['accept-encoding'] || '');
      response.writeHead(200, { ...headers, ETag: etag, 'Content-Type': mime[extname(file)] || 'application/octet-stream',
        'Cache-Control': html ? 'no-cache' : 'public, max-age=86400', Vary: 'Accept-Encoding',
        ...(gzip ? { 'Content-Encoding': 'gzip' } : { 'Content-Length': info.size }) });
      if (request.method === 'HEAD') { response.end(); return; }
      await pipeline(createReadStream(file), ...(gzip ? [createGzip({ level: 3 })] : []), response);
    } catch (error) {
      if (!response.headersSent) { response.writeHead(error.code === 'ENOENT' ? 404 : 400, headers); response.end('Not found'); }
      else response.destroy();
    }
  });
  server.requestTimeout = 30_000; server.headersTimeout = 15_000; server.keepAliveTimeout = 5000;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024, perMessageDeflate: false });
  server.on('upgrade', (request, socket, head) => {
    const peer = peerOf(request);
    if (request.url !== '/pvp/ws' || !originAllowed(request) || wss.clients.size >= 256 || (peers.get(peer) || 0) >= 12 || !service.healthy) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
    }
    wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request));
  });

  wss.on('connection', (ws, request) => {
    const peer = peerOf(request); peers.set(peer, (peers.get(peer) || 0) + 1);
    let alive = true, allowance = 80, measuredAt = Date.now();
    const connection = {
      send(data) {
        if (ws.readyState !== WebSocket.OPEN) return;
        if (ws.bufferedAmount > 4 * 1024 * 1024) { ws.close(1013, 'Please reconnect'); return; }
        ws.send(JSON.stringify(data));
      },
      close(code, reason) { ws.close(code, reason); }, sessionId: null
    };
    const authTimeout = setTimeout(() => { if (!connection.sessionId) ws.close(4003, 'Authentication timeout'); }, 10_000);
    ws.on('pong', () => { alive = true; });
    ws.on('message', (bytes, binary) => {
      if (binary) { ws.close(1003, 'JSON messages required'); return; }
      const at = Date.now(); allowance = Math.min(80, allowance + (at - measuredAt) * .02); measuredAt = at;
      if (--allowance < 0) { ws.close(4008, 'Message rate exceeded'); return; }
      let message;
      try { message = JSON.parse(bytes.toString()); } catch { connection.send({ type: 'error', code: 'JSON', message: '消息不是有效 JSON。' }); return; }
      if (message?.type === 'hello' && !message.token) {
        let rate = creationRates.get(peer);
        if (!rate || at - rate.start > 60_000) { rate = { start: at, count: 0 }; creationRates.set(peer, rate); }
        if (++rate.count > 30 || service.sessions.size >= 20_000) { ws.close(4008, 'Too many sessions'); return; }
      }
      service.handle(connection, message);
      if (connection.sessionId) clearTimeout(authTimeout);
    });
    ws.on('error', () => {});
    ws.on('close', () => {
      clearTimeout(authTimeout);
      const count = (peers.get(peer) || 1) - 1; if (count) peers.set(peer, count); else peers.delete(peer);
      try { service.disconnect(connection); } catch (error) { service.onError(error); }
    });
    ws.checkHeartbeat = () => { if (!alive) ws.terminate(); else { alive = false; ws.ping(); } };
  });
  const tick = setInterval(() => { try { service.tick(); } catch (error) { service.onError(error); } }, 1000);
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) ws.checkHeartbeat();
    for (const [peer, rate] of creationRates) if (Date.now() - rate.start > 60_000) creationRates.delete(peer);
  }, 15_000);
  tick.unref(); heartbeat.unref();
  let closing = false;
  return {
    server, service, store, wss,
    listen(port = 4173, host = '127.0.0.1') {
      return new Promise((resolveListen, reject) => {
        const error = e => reject(e); server.once('error', error);
        server.listen(port, host, () => { server.off('error', error); resolveListen(server.address()); });
      });
    },
    async close() {
      if (closing) return; closing = true;
      clearInterval(tick); clearInterval(heartbeat);
      service.shutdown();
      service.connections.clear();
      for (const ws of wss.clients) ws.terminate();
      await new Promise(resolveClose => wss.close(resolveClose));
      if (server.listening) await new Promise(resolveClose => { server.close(resolveClose); server.closeAllConnections(); });
      store.close();
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = bounded(process.env.DUEL_PORT, 4173, 1, 65535, 'DUEL_PORT');
  const app = await createPvpServer({ maxRooms: bounded(process.env.DUEL_MAX_ROOMS, 100, 1, 1000, 'DUEL_MAX_ROOMS'),
    origins: (process.env.DUEL_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean), trustProxy: process.env.DUEL_TRUST_PROXY === '1' });
  const host = process.env.DUEL_HOST || '0.0.0.0';
  await app.listen(port, host);
  console.log(`Duel Sanctuary PVP · http://127.0.0.1:${port}/#pvp · listening on ${host}:${port}`);
  console.log('BO1 · authoritative rules · SQLite recovery · /api/health');
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); process.exitCode = 0; });
}
