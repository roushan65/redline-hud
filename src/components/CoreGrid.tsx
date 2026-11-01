import { useState } from 'react';
import type { Sensor } from '../lib/types';

interface Props {
  loads: Sensor[];
  clocks: Sensor[];
}

/** Per-thread load grid. One hue, light→bright = more load (sequential). Hover/focus shows thread, load, clock. */
export function CoreGrid({ loads, clocks }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  if (!loads.length) return null;

  // LHM lists SMT threads as "CPU Core #1..#2N"; physical core clocks as "Core #1..#N".
  const threadsPerCore = clocks.length ? Math.max(1, Math.round(loads.length / clocks.length)) : 1;
  const clockFor = (i: number) => clocks[Math.floor(i / threadsPerCore)];
  const h = hover != null ? loads[hover] : null;
  const hc = hover != null ? clockFor(hover) : null;

  return (
    <div className="cores">
      <div className="cores__grid" style={{ gridTemplateColumns: `repeat(${Math.min(loads.length, 8)}, minmax(0, 1fr))` }}>
        {loads.map((s, i) => {
          const v = s.value ?? 0;
          return (
            <button
              key={s.id}
              type="button"
              className={v >= 50 ? 'cores__cell cores__cell--hot' : 'cores__cell'}
              style={{ '--lvl': (v / 100).toFixed(3) } as React.CSSProperties}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`Thread ${i + 1}: ${v.toFixed(0)}% load`}
            >
              <span className="cores__num">{String(i + 1).padStart(2, '0')}</span>
              <span className="cores__pct">{v.toFixed(0)}</span>
            </button>
          );
        })}
      </div>
      <div className="cores__foot">
        <span className="cores__scale" aria-hidden>
          <span>0%</span>
          <i />
          <span>100%</span>
        </span>
        <span className="cores__readout" aria-live="polite">
          {h ? (
            <>
              <strong>{(h.value ?? 0).toFixed(1)}%</strong> T{String((hover ?? 0) + 1).padStart(2, '0')}
              {hc?.value != null && <> · {(hc.value / 1000).toFixed(2)} GHz</>}
            </>
          ) : (
            <>{loads.length} THREADS · {clocks.length || '?'} CORES</>
          )}
        </span>
      </div>
    </div>
  );
}
