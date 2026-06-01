/**
 * Hermetic test rig for the resumable-upload E2E.
 *
 * Boots:
 *   - A real TUS server (@tus/server) at /files using a temp FileStore.
 *   - A static page at / that loads tus-js-client and exposes window.startUpload.
 *   - GET  /log    → JSON array of every request that reached /files (for assertions).
 *   - POST /reset  → clears the request log between tests.
 *
 * No external network, no Supabase. Tests use Playwright's route() to simulate
 * a dropped connection on a specific PATCH and then inspect /log to prove the
 * resumed PATCH started at the correct byte offset.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { Server } from '@tus/server';
import { FileStore } from '@tus/file-store';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.TUS_PORT ?? 4321);

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tus-e2e-'));
const tusJsClientPath = path.resolve(
  process.cwd(),
  'node_modules/tus-js-client/dist/tus.min.js',
);

/** @type {Array<{method:string,url:string,uploadOffset:string|null,uploadLength:string|null,responseStatus:number,responseUploadOffset:string|null,ts:number}>} */
const events = [];

const tusServer = new Server({
  path: '/files',
  datastore: new FileStore({ directory: dataDir }),
  respectForwardedHeaders: false,
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,HEAD,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers':
    'Upload-Offset, Upload-Length, Location, Tus-Resumable, Tus-Version, Tus-Extension, Tus-Max-Size',
};

const server = http.createServer((req, res) => {
  // Log on response finish so we don't consume the request body before tus does.
  if (req.url?.startsWith('/files')) {
    res.on('finish', () => {
      events.push({
        method: req.method ?? '',
        url: req.url ?? '',
        uploadOffset: /** @type {string|null} */ (req.headers['upload-offset'] ?? null),
        uploadLength: /** @type {string|null} */ (req.headers['upload-length'] ?? null),
        responseStatus: res.statusCode,
        responseUploadOffset: /** @type {string|null} */ (
          (res.getHeader('Upload-Offset') ?? null)
        ),
        ts: Date.now(),
      });
    });
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);

  if (req.url === '/log') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(events));
  }
  if (req.url === '/reset' && req.method === 'POST') {
    events.length = 0;
    res.writeHead(204);
    return res.end();
  }
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
  }
  if (req.url === '/tus.min.js') {
    res.writeHead(200, { 'content-type': 'application/javascript' });
    return res.end(fs.readFileSync(tusJsClientPath));
  }
  if (req.url?.startsWith('/files')) {
    return tusServer.handle(req, res);
  }
  res.writeHead(404).end();
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[tus-e2e] listening on http://localhost:${PORT} (data=${dataDir})`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
