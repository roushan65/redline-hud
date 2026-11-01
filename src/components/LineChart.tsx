import { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface Series {
  key: string;
  label: string;
  data: number[];
  color: string; // CSS colour (var() allowed)
}

interface Props {
  series: Series[];
  height?: number;
  /** Fixed y-domain; otherwise auto from data (with headroom). */
  yMax?: number;
  yMin?: number;
  /** Formats a value for tooltip + axis. */
  format: (v: number) => string;
  /** Sample interval, for the "-Ns" readout. */
  intervalMs: number;
  /** Total history slots (so the line grows from the right as data arrives). */
  capacity: number;
  ariaLabel: string;
  showAxis?: boolean;
  /** Grow to the height the parent gives it (flex), with `height` as the minimum. */
  fill?: boolean;
}

/**
 * Time-series line chart: 2px lines, ~10% area wash for a single series,
 * hairline grid, crosshair + one tooltip listing every series.
 */
export function LineChart({ series, height = 90, yMax, yMin = 0, format, intervalMs, capacity, ariaLabel, showAxis = true, fill = false }: Props) {
  const id = useId();
  const ref = useRef<SVGSVGElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [fillH, setFillH] = useState(height);
  useEffect(() => {
    const el = box.current;
    if (!fill || !el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setFillH(Math.max(height, Math.round(e.contentRect.height))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill, height]);
  const W = 400;
  const padL = showAxis ? 0 : 0;
  const H = fill ? fillH : height;

  const top = useMemo(() => {
    if (yMax != null) return yMax;
    const m = Math.max(1e-9, ...series.flatMap((s) => s.data));
    return niceCeil(m * 1.15);
  }, [series, yMax]);

  const x = (i: number, len: number) => padL + ((capacity - len + i) / (capacity - 1)) * (W - padL);
  const y = (v: number) => H - 2 - ((v - yMin) / (top - yMin || 1)) * (H - 6);

  const paths = series.map((s) => {
    const pts = s.data.map((v, i) => `${x(i, s.data.length).toFixed(1)},${y(v).toFixed(1)}`);
    return { s, line: pts.length ? `M${pts.join('L')}` : '', area: pts.length ? `M${x(0, s.data.length)},${H}L${pts.join('L')}L${x(s.data.length - 1, s.data.length)},${H}Z` : '' };
  });

  const len = Math.max(0, ...series.map((s) => s.data.length));

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const slot = Math.round(((px - padL) / (W - padL)) * (capacity - 1));
    const idx = slot - (capacity - len);
    setHover(idx >= 0 && idx < len ? idx : null);
  };

  const hx = hover != null ? x(hover, len) : 0;
  const ago = hover != null ? ((len - 1 - hover) * intervalMs) / 1000 : 0;

  return (
    <div ref={box} className={`chart${fill ? ' chart--fill' : ''}`} style={fill ? { minHeight: height } : { height: H }}>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        width="100%"
        height={H}
        role="img"
        aria-label={ariaLabel}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          {paths.map(({ s }) => (
            <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={s.color} stopOpacity={series.length === 1 ? 0.22 : 0} />
              <stop offset="1" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} className="chart__grid" vectorEffect="non-scaling-stroke" />
        ))}
        <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} className="chart__base" vectorEffect="non-scaling-stroke" />
        {paths.map(({ s, area }) => series.length === 1 && <path key={`a-${s.key}`} d={area} fill={`url(#${id}-${s.key})`} />)}
        {paths.map(({ s, line }) => (
          <path key={s.key} d={line} stroke={s.color} className="chart__line" vectorEffect="non-scaling-stroke" />
        ))}
        {hover != null && <line x1={hx} x2={hx} y1={0} y2={H} className="chart__cross" vectorEffect="non-scaling-stroke" />}
      </svg>

      {/* end dots (HTML so they stay round under preserveAspectRatio=none) */}
      {series.map((s) =>
        s.data.length ? (
          <span
            key={s.key}
            className="chart__dot"
            style={{ left: `${(x(s.data.length - 1, s.data.length) / W) * 100}%`, top: y(s.data[s.data.length - 1]), background: s.color }}
          />
        ) : null,
      )}

      {hover != null && (
        // anchor slides from the tip's left edge to its right edge so it never leaves the panel
        <div className="chart__tip" style={{ left: `${(hx / W) * 100}%`, transform: `translate(${-(hx / W) * 100}%, calc(-100% - 6px))` }} role="tooltip">
          <div className="chart__tip-time">{ago === 0 ? 'NOW' : `-${ago.toFixed(0)}s`}</div>
          {series.map((s) => (
            <div key={s.key} className="chart__tip-row">
              <span className="chart__key" style={{ background: s.color }} />
              <strong>{s.data[hover - (len - s.data.length)] != null ? format(s.data[hover - (len - s.data.length)]) : '—'}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {showAxis && <span className="chart__ymax">{format(top)}</span>}
    </div>
  );
}

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * p;
}
