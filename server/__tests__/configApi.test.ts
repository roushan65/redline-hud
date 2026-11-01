import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createConfigHandler } from '../configApi';

let dir: string;
let server: Server;
let base: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'csp-config-'));
  const handler = createConfigHandler(dir);
  server = createServer((req, res) =>
    handler(req, res, () => {
      res.statusCode = 404;
      res.end('not api');
    }),
  );
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((r) => server.close(r));
  await rm(dir, { recursive: true, force: true });
});

describe('config API', () => {
  it('reports a JSON 404 before anything is saved', async () => {
    const res = await fetch(`${base}/api/config`);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('json');
  });

  it('passes non-API routes through', async () => {
    expect(await (await fetch(`${base}/index.html`)).text()).toBe('not api');
  });

  it('round-trips config.json to disk', async () => {
    const cfg = { themeId: 'cyberpunk', brand: { title: 'NEON RIGS' } };
    const put = await fetch(`${base}/api/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
    expect(put.status).toBe(204);
    expect(JSON.parse(await readFile(path.join(dir, 'config.json'), 'utf8'))).toEqual(cfg);
    expect(await (await fetch(`${base}/api/config`)).json()).toEqual(cfg);
  });

  it('rejects non-objects, bad JSON and wrong content type', async () => {
    const put = (body: string, type = 'application/json') => fetch(`${base}/api/config`, { method: 'PUT', headers: { 'Content-Type': type }, body });
    expect((await put('[1]')).status).toBe(400);
    expect((await put('{oops')).status).toBe(400);
    expect((await put('{}', 'text/plain')).status).toBe(415);
  });

  it('refuses cross-origin writes', async () => {
    const res = await fetch(`${base}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example.com' },
      body: '{}',
    });
    expect(res.status).toBe(403);
  });

  it('stores, serves and deletes a single logo', async () => {
    const png = Buffer.from('89504e470d0a1a0a', 'hex');
    const up = await fetch(`${base}/api/logo`, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: png });
    expect(up.status).toBe(200);
    expect((await up.json()).url).toMatch(/^\/api\/logo\?v=\d+$/);

    // replacing with another format leaves exactly one logo file
    await fetch(`${base}/api/logo`, { method: 'PUT', headers: { 'Content-Type': 'image/webp' }, body: png });
    expect((await readdir(dir)).filter((f) => f.startsWith('logo.'))).toEqual(['logo.webp']);

    const get = await fetch(`${base}/api/logo`);
    expect(get.headers.get('content-type')).toBe('image/webp');
    expect(get.headers.get('content-security-policy')).toContain('sandbox');
    expect(Buffer.from(await get.arrayBuffer())).toEqual(png);

    expect((await fetch(`${base}/api/logo`, { method: 'DELETE' })).status).toBe(204);
    expect((await fetch(`${base}/api/logo`)).status).toBe(404);
  });

  it('lists and serves manufacturer logos from vendors/, read-only', async () => {
    expect(await (await fetch(`${base}/api/vendors`)).json()).toEqual({});
    await mkdir(path.join(dir, 'vendors'));
    await writeFile(path.join(dir, 'vendors', 'amd.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    await writeFile(path.join(dir, 'vendors', 'notes.txt'), 'ignored');
    await writeFile(path.join(dir, 'secret.svg'), '<svg/>');

    expect(await (await fetch(`${base}/api/vendors`)).json()).toEqual({ amd: '/api/vendors/amd.svg' });
    const get = await fetch(`${base}/api/vendors/amd.svg`);
    expect(get.headers.get('content-type')).toBe('image/svg+xml');
    expect(get.headers.get('content-security-policy')).toContain('sandbox');

    expect((await fetch(`${base}/api/vendors/notes.txt`)).status).toBe(404);
    expect((await fetch(`${base}/api/vendors/..%2Fsecret.svg`)).status).toBe(404);
    expect((await fetch(`${base}/api/vendors/%E0%A4%A`)).status).toBe(404);
    expect((await fetch(`${base}/api/vendors/amd.svg`, { method: 'PUT', body: 'x' })).status).toBe(405);
  });

  it('rejects non-image uploads', async () => {
    const res = await fetch(`${base}/api/logo`, { method: 'PUT', headers: { 'Content-Type': 'text/html' }, body: '<script>' });
    expect(res.status).toBe(415);
  });
});
