import { readdir, readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import sea from 'node:sea';
import { createConfigHandler } from './configApi.ts';
import { resolveListen } from './listen.ts';

/**
 * Standalone server used by the release executables (Node single executable app).
 * Serves the built UI, the /api/* config API and the /lhm/* proxy, matching `npm run preview`.
 *
 * Inside the executable the UI comes from embedded SEA assets and config/ + .env sit next to
 * the executable. Run as a plain script (`node release/build/server.cjs`) it reads ./dist and ./.env.
 */

const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  webp: 'image/webp',
  ico: 'image/x-icon',
  json: 'application/json',
  woff2: 'font/woff2',
  txt: 'text/plain; charset=utf-8',
};

const PROXY_TIMEOUT_MS = 5000;

const packaged = sea.isSea();
const home = packaged ? path.dirname(process.execPath) : process.cwd();

const envFile = path.join(home, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile); // never overrides variables already set

/** URL path ('/assets/index-abc.js') → file bytes. */
async function loadAssets(): Promise<Map<string, Buffer>> {
  const out = new Map<string, Buffer>();
  if (packaged) {
    for (const key of sea.getAssetKeys()) {
      if (key.startsWith('dist/')) out.set(key.slice(4), Buffer.from(sea.getAsset(key)));
    }
    return out;
  }
  const root = path.resolve(process.env.PANEL_DIST_DIR || 'dist');
  for (const e of await readdir(root, { recursive: true, withFileTypes: true }).catch(() => [])) {
    if (!e.isFile()) continue;
    const file = path.join(e.parentPath, e.name);
    out.set('/' + path.relative(root, file).split(path.sep).join('/'), await readFile(file));
  }
  return out;
}

function serveStatic(assets: Map<string, Buffer>, req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    return res.end();
  }
  let pathname = new URL(req.url ?? '/', 'http://local').pathname;
  if (pathname === '/') pathname = '/index.html';
  let body = assets.get(pathname);
  // client-side routes without a file extension get the app shell
  if (!body && !path.posix.extname(pathname)) body = assets.get((pathname = '/index.html'));
  if (!body) {
    res.statusCode = 404;
    return res.end('Not found');
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', TYPES[path.posix.extname(pathname).slice(1)] ?? 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // hashed build output never changes; index.html must always be revalidated to pick up new builds
  res.setHeader('Cache-Control', pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
  res.end(req.method === 'HEAD' ? undefined : body);
}

/** /lhm/* → LHM_PROXY_TARGET/*, for LHM builds that don't send CORS headers (GET only). */
async function proxyLhm(target: string, req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end();
  }
  const upstream = new URL(req.url!.replace(/^\/lhm/, '') || '/', target);
  try {
    const r = await fetch(upstream, { signal: AbortSignal.timeout(PROXY_TIMEOUT_MS) });
    res.statusCode = r.status;
    res.setHeader('Content-Type', r.headers.get('content-type') ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: `LibreHardwareMonitor unreachable at ${target}` }));
  }
}

function lanUrls(port: number) {
  return Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => `http://${n!.address}:${port}/`);
}

async function main() {
  const { host, port } = resolveListen(process.env);
  const configDir = path.resolve(home, process.env.PANEL_CONFIG_DIR || 'config');
  const target = process.env.LHM_PROXY_TARGET || 'http://192.168.1.4:8085';
  const assets = await loadAssets();
  if (!assets.has('/index.html')) throw new Error('UI build not found: run `npm run build` first');

  const api = createConfigHandler(configDir);
  const server = createServer((req, res) => {
    if (req.url?.startsWith('/lhm/') || req.url === '/lhm') return void proxyLhm(target, req, res);
    api(req, res, () => serveStatic(assets, req, res));
  });

  server.on('error', (e: NodeJS.ErrnoException) =>
    fail(e.code === 'EADDRINUSE' ? `Port ${port} is already in use. Set PANEL_PORT in .env to use another port.` : e.message),
  );

  server.listen(port, host, () => {
    const wildcard = host === '0.0.0.0' || host === '::';
    console.log(`\n  REDLINE//HUD is running\n`);
    console.log(`  Local:    http://localhost:${port}/`);
    if (wildcard) for (const u of lanUrls(port)) console.log(`  Network:  ${u}`);
    else if (host !== 'localhost' && host !== '127.0.0.1') console.log(`  Bound:    http://${host}:${port}/`);
    console.log(`\n  Config:   ${configDir}`);
    console.log(`  Press Ctrl+C to stop.\n`);
  });

  const stop = () => server.close(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((e: Error) => fail(e.message));

function fail(message: string) {
  console.error(`\n  ${message}\n`);
  // a double-clicked executable's console window would vanish before the error can be read
  if (packaged && process.stdin.isTTY) {
    console.error('  Press Enter to exit.');
    process.stdin.once('data', () => process.exit(1));
    return;
  }
  process.exit(1);
}
