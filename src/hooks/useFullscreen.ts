import { useCallback, useEffect, useState } from 'react';
import { invoke, isDesktop } from '../lib/desktop';

/**
 * Fullscreen for the whole panel. In a browser this is the Fullscreen API on <html> (Esc exits);
 * in the desktop app it's the native window (macOS gets its own Space).
 * `supported` is false where pages can't go fullscreen, e.g. Safari on iPhone.
 */
export function useFullscreen() {
  const supported = isDesktop || (typeof document !== 'undefined' && document.fullscreenEnabled);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!supported) return;
    // also catches leaving fullscreen with Esc, the window's own button or the OS shortcut
    const sync = isDesktop
      ? () => invoke<boolean>('is_fullscreen').then(setActive, () => undefined)
      : () => setActive(document.fullscreenElement != null);
    sync();
    const target = isDesktop ? window : document;
    const event = isDesktop ? 'resize' : 'fullscreenchange';
    target.addEventListener(event, sync);
    return () => target.removeEventListener(event, sync);
  }, [supported]);

  const toggle = useCallback(() => {
    if (isDesktop) {
      invoke('set_fullscreen', { on: !active }).then(() => setActive(!active), () => undefined);
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    } else {
      document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
    }
  }, [active]);

  // "F" toggles too, handy on a kiosk or a TV with a keyboard; ignored while typing in a field.
  // Esc already leaves browser fullscreen; native windows need it wired up.
  useEffect(() => {
    if (!supported) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDesktop && active) return toggle();
      if (e.key !== 'f' && e.key !== 'F') return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [supported, active, toggle]);

  return { supported, active, toggle };
}
