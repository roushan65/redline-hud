import { useEffect, useRef, useState } from 'react';
import { nextMockFrame } from '../mock/mockSource';
import { invoke, isDesktop } from '../lib/desktop';
import { parseLhm } from '../lib/parse';
import type { LhmNode, Snapshot } from '../lib/types';
import type { DataSource } from '../lib/settings';

export const HISTORY_LEN = 90;

export type LinkState = 'connecting' | 'live' | 'mock' | 'fallback' | 'error';

export interface SensorFeed {
  snapshot: Snapshot | null;
  /** Rolling per-sensor history, oldest first, keyed by SensorId. */
  history: Map<string, number[]>;
  link: LinkState;
  error: string | null;
  latencyMs: number | null;
  lastUpdate: number | null;
}

interface Options {
  source: DataSource;
  url: string;
  intervalMs: number;
  autoFallback: boolean;
}

async function fetchLhm(url: string, signal: AbortSignal): Promise<LhmNode> {
  if (isDesktop) {
    // polled from Rust; a command can't be cancelled, so stop waiting for it instead
    const aborted = new Promise<never>((_, reject) =>
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }),
    );
    return Promise.race([invoke<LhmNode>('lhm_fetch', { url: new URL(url, location.href).href }), aborted]);
  }
  const res = await fetch(url, { signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as LhmNode;
}

export function useSensorFeed({ source, url, intervalMs, autoFallback }: Options): SensorFeed {
  const [feed, setFeed] = useState<SensorFeed>({
    snapshot: null,
    history: new Map(),
    link: 'connecting',
    error: null,
    latencyMs: null,
    lastUpdate: null,
  });
  const history = useRef(new Map<string, number[]>());

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let ctrl: AbortController | null = null;
    let failures = 0;
    history.current = new Map();

    const ingest = (root: LhmNode, link: LinkState, latencyMs: number | null, error: string | null) => {
      const snap = parseLhm(root);
      const h = history.current;
      for (const [id, s] of snap.sensorsById) {
        if (s.value == null) continue;
        let arr = h.get(id);
        if (!arr) h.set(id, (arr = []));
        arr.push(s.value);
        if (arr.length > HISTORY_LEN) arr.shift();
      }
      setFeed({ snapshot: snap, history: h, link, error, latencyMs, lastUpdate: snap.timestamp });
    };

    const tick = async () => {
      if (source === 'mock') {
        ingest(nextMockFrame(), 'mock', null, null);
      } else {
        ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl?.abort(), Math.max(2500, intervalMs * 2));
        const t0 = performance.now();
        try {
          const root = await fetchLhm(url, ctrl.signal);
          if (cancelled) return;
          failures = 0;
          ingest(root, 'live', Math.round(performance.now() - t0), null);
        } catch (e) {
          if (cancelled) return;
          failures++;
          const msg = e instanceof DOMException && e.name === 'AbortError' ? 'Timed out' : String((e as Error).message ?? e);
          if (autoFallback && failures >= 2) {
            ingest(nextMockFrame(), 'fallback', null, msg);
          } else {
            setFeed((f) => ({ ...f, link: 'error', error: msg }));
          }
        } finally {
          clearTimeout(timeout);
        }
      }
      if (!cancelled) timer = setTimeout(tick, intervalMs);
    };

    setFeed((f) => ({ ...f, link: 'connecting', error: null }));
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      ctrl?.abort();
    };
  }, [source, url, intervalMs, autoFallback]);

  return feed;
}
