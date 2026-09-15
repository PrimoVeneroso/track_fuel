// Server statico minimale (zero dipendenze) per la build esportata in out/.
// Uso: bun run start   →   http://localhost:3000
import { createServer } from 'node:http';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

const ROOT = resolve('out');
const PORT = Number(process.env.PORT ?? 3000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    // SPA/PWA: le rotte non-asset risolvono a index.html
    let file = normalize(join(ROOT, pathname));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    let served = file;
    try {
      const st = await stat(file);
      if (st.isDirectory()) served = join(file, 'index.html');
    } catch {
      served = join(ROOT, 'index.html');
    }
    const body = await readFile(served);
    const type = MIME[extname(served).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(500);
    res.end('Errore interno.');
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`FuelLog (export statico) su http://localhost:${PORT}`);
});
