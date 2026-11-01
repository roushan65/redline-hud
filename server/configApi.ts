import type { IncomingMessage, ServerResponse } from 'node:http';
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'vite';

/**
 * Tiny persistence API mounted into the Vite dev + preview servers.
 *
 *   GET  /api/config   → config.json (404 until first save)
 *   PUT  /api/config   ← JSON object, written atomically
 *   GET  /api/logo     → uploaded logo image
 *   PUT  /api/logo     ← raw image bytes (Content-Type: image/*)
 *   DELETE /api/logo
 *
 * Files live in PANEL_CONFIG_DIR (default ./config).
 */

const MAX_CONFIG_BYTES = 256 * 1024;
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

const LOGO_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};
const EXT_TYPES = Object.fromEntries(Object.entries(LOGO_TYPES).map(([t, e]) => [e, t]));

type Next = (err?: unknown) => void;

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, `Body exceeds ${limit} bytes`));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Writes are only accepted from the panel's own origin (blocks cross-site requests from other tabs). */
function assertSameOrigin(req: IncomingMessage) {
  const origin = req.headers.origin;
  if (!origin) return;
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    throw new HttpError(403, 'Bad origin');
  }
  if (host !== req.headers.host) throw new HttpError(403, 'Cross-origin write refused');
}

function send(res: ServerResponse, status: number, body?: unknown) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  if (body === undefined) return res.end();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function findLogo(dir: string): Promise<string | null> {
  try {
    const f = (await readdir(dir)).find((n) => /^logo\.[a-z]+$/.test(n) && n.split('.')[1] in EXT_TYPES);
    return f ? path.join(dir, f) : null;
  } catch {
    return null;
  }
}

async function removeLogos(dir: string) {
  for (;;) {
    const f = await findLogo(dir);
    if (!f) return;
    await unlink(f);
  }
}

async function atomicWrite(file: string, data: string | Buffer) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, data);
  await rename(tmp, file);
}

export function createConfigHandler(dir: string) {
  const configFile = path.join(dir, 'config.json');

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const { pathname } = new URL(req.url ?? '/', 'http://local');

    if (pathname === '/api/config') {
      if (req.method === 'GET') {
        try {
          const text = await readFile(configFile, 'utf8');
          res.statusCode = 200;
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          return res.end(text);
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code === 'ENOENT') return send(res, 404, { error: 'No config saved yet' });
          throw e;
        }
      }
      if (req.method === 'PUT') {
        assertSameOrigin(req);
        if (!String(req.headers['content-type']).startsWith('application/json')) throw new HttpError(415, 'Expected application/json');
        let parsed: unknown;
        try {
          parsed = JSON.parse((await readBody(req, MAX_CONFIG_BYTES)).toString('utf8'));
        } catch (e) {
          if (e instanceof HttpError) throw e;
          throw new HttpError(400, 'Invalid JSON');
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new HttpError(400, 'Config must be a JSON object');
        await atomicWrite(configFile, `${JSON.stringify(parsed, null, 2)}\n`);
        return send(res, 204);
      }
      throw new HttpError(405, 'Method not allowed');
    }

    if (pathname === '/api/logo') {
      if (req.method === 'GET') {
        const f = await findLogo(dir);
        if (!f) return send(res, 404, { error: 'No logo uploaded' });
        res.statusCode = 200;
        res.setHeader('Content-Type', EXT_TYPES[path.extname(f).slice(1)]);
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        // An uploaded SVG opened directly must not be able to run script on this origin.
        res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
        return res.end(await readFile(f));
      }
      if (req.method === 'PUT') {
        assertSameOrigin(req);
        const type = String(req.headers['content-type'] ?? '').split(';')[0].trim();
        const ext = LOGO_TYPES[type];
        if (!ext) throw new HttpError(415, `Unsupported image type "${type}" (png, jpeg, webp, gif, svg)`);
        const body = await readBody(req, MAX_LOGO_BYTES);
        if (!body.length) throw new HttpError(400, 'Empty image');
        await removeLogos(dir);
        await atomicWrite(path.join(dir, `logo.${ext}`), body);
        return send(res, 200, { url: `/api/logo?v=${Date.now()}` });
      }
      if (req.method === 'DELETE') {
        assertSameOrigin(req);
        await removeLogos(dir);
        return send(res, 204);
      }
      throw new HttpError(405, 'Method not allowed');
    }

    throw new HttpError(404, 'Unknown API route');
  }

  return (req: IncomingMessage, res: ServerResponse, next: Next) => {
    if (!req.url?.startsWith('/api/')) return next();
    handle(req, res).catch((e) => {
      if (res.headersSent) return res.end();
      if (e instanceof HttpError) send(res, e.status, { error: e.message });
      else send(res, 500, { error: 'Could not access config storage' });
    });
  };
}

/** Vite plugin: mounts the config API on `vite` (dev) and `vite preview`. */
export function configApi(dir: string): Plugin {
  const handler = createConfigHandler(dir);
  return {
    name: 'cyber-sensor-config-api',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
