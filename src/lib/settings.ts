import { useCallback, useEffect, useRef, useState } from 'react';
import type { VendorLogoMode } from './prefs';
import { DEFAULT_THEME_ID, type ColorOverrides } from './themes';

export type DataSource = 'live' | 'mock';
export type LogoShape = 'hex' | 'circle' | 'square';

/** Centre "streamer" block: channel name, tagline and logo. */
export interface Branding {
  show: boolean;
  title: string;
  subtitle: string;
  /** '' = built-in emblem; '/api/logo?v=…' = uploaded file on disk; any https URL or data: URL. */
  logo: string;
  logoShape: LogoShape;
}

export interface Settings {
  source: DataSource;
  url: string;
  intervalMs: number;
  themeId: string;
  overrides: ColorOverrides;
  scanlines: boolean;
  glitch: boolean;
  tempUnit: 'C' | 'F';
  /** Fall back to the simulator when the live endpoint is unreachable. */
  autoFallback: boolean;
  /** Manufacturer badges on CPU / GPU / board / drive cards. */
  vendorLogos: VendorLogoMode;
  brand: Branding;
}

/** Where the settings currently persist. 'disk' = config/config.json via the dev/preview server. */
export type SaveTarget = 'loading' | 'disk' | 'browser';
export type SaveStatus = { target: SaveTarget; state: 'idle' | 'saving' | 'saved' | 'error'; error?: string };

const KEY = 'cyber-sensor-panel:settings';
export const CONFIG_API = '/api/config';
export const LOGO_API = '/api/logo';
const SAVE_DEBOUNCE_MS = 400;

export const DEFAULT_BRANDING: Branding = {
  show: true,
  title: 'YOUR CHANNEL',
  subtitle: 'youtube.com/@yourchannel',
  logo: '',
  logoShape: 'hex',
};

export const DEFAULT_SETTINGS: Settings = {
  source: (import.meta.env.VITE_DATA_SOURCE as DataSource) || 'live',
  url: import.meta.env.VITE_LHM_URL || 'http://192.168.1.4:8085/data.json',
  intervalMs: 1000,
  themeId: DEFAULT_THEME_ID,
  overrides: {},
  scanlines: true,
  glitch: true,
  tempUnit: 'C',
  autoFallback: true,
  vendorLogos: 'brand',
  brand: DEFAULT_BRANDING,
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, d: string, max = 2048) => (typeof v === 'string' ? v.slice(0, max) : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const oneOf = <T extends string>(v: unknown, opts: readonly T[], d: T): T => (opts.includes(v as T) ? (v as T) : d);

/** Accepts a hand-edited / older config.json and returns a complete, well-typed Settings. */
export function normaliseSettings(raw: unknown): Settings {
  const r = isObj(raw) ? raw : {};
  const b = isObj(r.brand) ? r.brand : {};
  const d = DEFAULT_SETTINGS;
  const overrides = isObj(r.overrides)
    ? Object.fromEntries(Object.entries(r.overrides).filter(([, v]) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)))
    : {};
  const interval = typeof r.intervalMs === 'number' && Number.isFinite(r.intervalMs) ? Math.min(60000, Math.max(250, r.intervalMs)) : d.intervalMs;
  return {
    source: oneOf(r.source, ['live', 'mock'] as const, d.source),
    url: str(r.url, d.url),
    intervalMs: interval,
    themeId: str(r.themeId, d.themeId, 64),
    overrides,
    scanlines: bool(r.scanlines, d.scanlines),
    glitch: bool(r.glitch, d.glitch),
    tempUnit: oneOf(r.tempUnit, ['C', 'F'] as const, d.tempUnit),
    autoFallback: bool(r.autoFallback, d.autoFallback),
    vendorLogos: oneOf(r.vendorLogos, ['brand', 'theme', 'off'] as const, d.vendorLogos),
    brand: {
      show: bool(b.show, DEFAULT_BRANDING.show),
      title: str(b.title, DEFAULT_BRANDING.title, 80),
      subtitle: str(b.subtitle, DEFAULT_BRANDING.subtitle, 120),
      // data: URLs only survive in browser storage; the server caps config.json at 256 KB
      logo: str(b.logo, DEFAULT_BRANDING.logo, 400_000),
      logoShape: oneOf(b.logoShape, ['hex', 'circle', 'square'] as const, DEFAULT_BRANDING.logoShape),
    },
  };
}

function loadLocal(): Settings | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normaliseSettings(JSON.parse(raw)) : null;
  } catch {
    return null; // corrupted storage
  }
}

/** ?source=mock&url=…&theme=… — applied for this session only, never written to config.json. */
function urlOverrides(): Partial<Settings> {
  const q = new URLSearchParams(location.search);
  const o: Partial<Settings> = {};
  const src = q.get('source');
  if (src === 'live' || src === 'mock') o.source = src;
  if (q.get('url')) o.url = q.get('url')!;
  if (q.get('theme')) o.themeId = q.get('theme')!;
  return o;
}

async function fetchDisk(): Promise<{ found: true; settings: Settings } | { found: false; api: boolean }> {
  const res = await fetch(CONFIG_API, { cache: 'no-store' });
  if (res.status === 404 && res.headers.get('content-type')?.includes('json')) return { found: false, api: true };
  if (!res.ok || !res.headers.get('content-type')?.includes('json')) return { found: false, api: false };
  return { found: true, settings: normaliseSettings(await res.json()) };
}

async function saveDisk(s: Settings) {
  const res = await fetch(CONFIG_API, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
  if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? `HTTP ${res.status}`);
}

/**
 * Settings source of truth is config/config.json (served by the Vite dev/preview server).
 * localStorage is a fast first-paint cache and the fallback when the app is hosted statically.
 */
export function useSettings() {
  const [stored, setStored] = useState<Settings>(() => loadLocal() ?? DEFAULT_SETTINGS);
  const [session, setSession] = useState<Partial<Settings>>(urlOverrides);
  const [status, setStatus] = useState<SaveStatus>({ target: 'loading', state: 'idle' });
  const target = useRef<SaveTarget>('loading');
  const dirty = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetchDisk()
      .then(async (r) => {
        if (cancelled) return;
        if (r.found) {
          target.current = 'disk';
          if (!dirty.current) setStored(r.settings);
          setStatus({ target: 'disk', state: 'saved' });
        } else if (r.api) {
          // first run: seed config.json from whatever we have (browser cache or defaults)
          target.current = 'disk';
          dirty.current = true;
          setStored((s) => ({ ...s }));
        } else {
          target.current = 'browser';
          setStatus({ target: 'browser', state: 'saved' });
        }
      })
      .catch(() => {
        if (cancelled) return;
        target.current = 'browser';
        setStatus({ target: 'browser', state: 'saved' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(stored));
    } catch {
      /* quota (e.g. large data: logo) — disk copy is still authoritative */
    }
    if (!dirty.current || target.current !== 'disk') return;
    setStatus({ target: 'disk', state: 'saving' });
    const t = setTimeout(() => {
      dirty.current = false;
      saveDisk(stored)
        .then(() => setStatus({ target: 'disk', state: 'saved' }))
        .catch((e: Error) => setStatus({ target: 'disk', state: 'error', error: e.message }));
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [stored]);

  const update = useCallback((patch: Partial<Settings>) => {
    dirty.current = true;
    // a key the user changes explicitly is no longer governed by the URL
    setSession((s) => {
      const next = { ...s };
      for (const k of Object.keys(patch) as (keyof Settings)[]) delete next[k];
      return next;
    });
    setStored((s) => ({ ...s, ...patch }));
  }, []);

  const updateBrand = useCallback((patch: Partial<Branding>) => {
    dirty.current = true;
    setStored((s) => ({ ...s, brand: { ...s.brand, ...patch } }));
  }, []);

  const reset = useCallback(() => {
    dirty.current = true;
    setSession({});
    setStored(DEFAULT_SETTINGS);
  }, []);

  const settings: Settings = { ...stored, ...session };
  return { settings, update, updateBrand, reset, status };
}

/** Upload a logo to config/logo.* on disk. Falls back to an inline data: URL when there is no server. */
export async function uploadLogo(file: File): Promise<string> {
  try {
    const res = await fetch(LOGO_API, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    const ct = res.headers.get('content-type') ?? '';
    if (res.ok && ct.includes('json')) return ((await res.json()) as { url: string }).url;
    if (ct.includes('json')) throw new Error(((await res.json()) as { error?: string }).error ?? `HTTP ${res.status}`);
  } catch (e) {
    if (e instanceof Error && !(e instanceof TypeError)) throw e; // real server error, not "no server"
  }
  if (file.size > 256 * 1024) throw new Error('No config server running — logos over 256 KB need `npm run dev` / `npm run preview`.');
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });
}

export async function deleteLogo() {
  await fetch(LOGO_API, { method: 'DELETE' }).catch(() => undefined);
}

/** Manufacturer logos the user dropped into config/vendors/ (empty when there is no config server). */
export function useVendorFiles(): Record<string, string> {
  const [files, setFiles] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    fetch('/api/vendors', { cache: 'no-store' })
      .then((r) => (r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : {}))
      .then((m: unknown) => {
        if (!alive || !m || typeof m !== 'object') return;
        // only same-origin /api/vendors/ paths are accepted
        setFiles(Object.fromEntries(Object.entries(m).filter(([, v]) => typeof v === 'string' && v.startsWith('/api/vendors/'))));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return files;
}
