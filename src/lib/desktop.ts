/**
 * Bridge to the Tauri desktop shell (src-tauri/). In the desktop app the Rust side replaces the
 * Node config server: settings, the uploaded logo and vendors/ live in the app's config folder and
 * are reached through commands, and LibreHardwareMonitor is polled from Rust (no CORS / mixed
 * content in the webview). In a browser `desktop` is null and nothing here changes behaviour.
 */
import { useEffect, useState } from 'react';

interface TauriCore {
  invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}

declare global {
  interface Window {
    /** Injected by Tauri (app.withGlobalTauri in tauri.conf.json). */
    __TAURI__?: { core: TauriCore };
  }
}

const desktop: TauriCore | null = typeof window !== 'undefined' ? (window.__TAURI__?.core ?? null) : null;
export const isDesktop = desktop !== null;

export function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!desktop) return Promise.reject(new Error('Not running in the desktop app'));
  // commands reject with a plain string; make it an Error like everything else
  return desktop.invoke<T>(cmd, args).catch((e: unknown) => Promise.reject(e instanceof Error ? e : new Error(String(e))));
}

/**
 * Settings keep the same paths in both builds ('/api/logo?v=…', '/api/vendors/amd.svg'), so a
 * config.json can move between them. The desktop app serves those files on its hud: protocol.
 */
export function assetUrl(src: string): string {
  if (!desktop || !src.startsWith('/api/')) return src;
  // custom protocols are hud://localhost/… except in WebView2, which needs http://hud.localhost/…
  const base = navigator.userAgent.includes('Windows') ? 'http://hud.localhost/' : 'hud://localhost/';
  return base + src.slice('/api/'.length);
}

/** Where config.json lives, for the Settings drawer: the app's config folder on desktop. */
export function useConfigFolder(): string {
  const [folder, setFolder] = useState('config');
  useEffect(() => {
    if (isDesktop) invoke<string>('config_location').then(setFolder, () => undefined);
  }, []);
  return folder;
}
