import { afterEach, describe, expect, it, vi } from 'vitest';

// desktop.ts reads window.__TAURI__ once at import, so each case stubs globals then re-imports it
async function load(tauri: unknown, userAgent = 'Mozilla/5.0 (Macintosh)') {
  vi.resetModules();
  vi.stubGlobal('window', { __TAURI__: tauri });
  vi.stubGlobal('navigator', { userAgent });
  return import('../desktop');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('desktop bridge', () => {
  it('is inert in a browser', async () => {
    const d = await load(undefined);
    expect(d.isDesktop).toBe(false);
    expect(d.assetUrl('/api/logo?v=1')).toBe('/api/logo?v=1');
    await expect(d.invoke('config_get')).rejects.toThrow('Not running in the desktop app');
  });

  it('maps /api/ files onto the hud: protocol', async () => {
    const d = await load({ core: { invoke: vi.fn() } });
    expect(d.isDesktop).toBe(true);
    expect(d.assetUrl('/api/logo?v=1')).toBe('hud://localhost/logo?v=1');
    expect(d.assetUrl('/api/vendors/amd.svg')).toBe('hud://localhost/vendors/amd.svg');
    expect(d.assetUrl('https://example.com/a.png')).toBe('https://example.com/a.png');
  });

  it('uses the http://hud.localhost form in WebView2', async () => {
    const d = await load({ core: { invoke: vi.fn() } }, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/140');
    expect(d.assetUrl('/api/vendors/amd.svg')).toBe('http://hud.localhost/vendors/amd.svg');
  });

  it('turns string rejections from commands into Errors', async () => {
    const invoke = vi.fn().mockRejectedValue('Config is larger than 256 KB');
    const d = await load({ core: { invoke } });
    await expect(d.invoke('config_put', { config: {} })).rejects.toThrow('Config is larger than 256 KB');
    expect(invoke).toHaveBeenCalledWith('config_put', { config: {} });
  });
});
