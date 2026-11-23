/**
 * Production server: serves the built site from dist/ and the API under /api.
 * Build with `npm run build`, start with `npm start`.
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { handleApi } from './app.js';
import { closeDb, getDb } from './db.js';

// optional settings (real email, port, database path); see .env.example. `neon env pull` writes
// .env.local, which is read first so it wins: a variable already set is never overwritten.
for (const file of ['.env.local', '.env']) if (existsSync(file)) process.loadEnvFile(file);

const PORT = Number(process.env.PORT ?? 8787);
const ROOT = resolve('dist');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // posters are blob: images painted in the page; the 3D view needs no remote origins
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data: blob: https://image.tmdb.org https://upload.wikimedia.org; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

const server = createServer((req, res) => {
  const url = req.url ?? '/';
  if (url === '/api' || url.startsWith('/api/')) {
    const started = performance.now();
    // one access line per API call; query strings are left out because they can carry tokens
    res.on('finish', () => {
      if (process.env.LOG_REQUESTS === '0') return;
      const ms = (performance.now() - started).toFixed(0);
      console.log(`${new Date().toISOString()} ${req.method} ${url.split('?')[0]} ${res.statusCode} ${ms}ms`);
    });
    void handleApi(req, res, url.slice(4));
    return;
  }

  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.end();
    return;
  }

  // resolve inside dist/ only; anything else falls back to the app shell
  const requested = normalize(decodeURIComponent(url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let file = join(ROOT, requested);
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, 'index.html');
  if (!existsSync(file)) {
    res.statusCode = 503;
    res.end('The site has not been built yet. Run `npm run build` first.');
    return;
  }

  const type = TYPES[extname(file)] ?? 'application/octet-stream';
  res.setHeader('Content-Type', type);
  // hashed build assets never change; the shell must always be fresh
  res.setHeader('Cache-Control', file.includes(`${join(ROOT, 'assets')}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
});

// open and migrate the database before taking traffic, so a bad DATABASE_URL fails at once
getDb()
  .then((db) => {
    server.listen(PORT, () => {
      console.log(`SightLine running at http://localhost:${PORT} (database: ${db.kind})`);
    });
  })
  .catch((err) => {
    console.error('Could not open the database:', err instanceof Error ? err.message : err);
    process.exit(1);
  });

// finish in-flight requests, then close the database pool, so a deploy never cuts a booking in half
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    server.close(() => {
      closeDb().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
