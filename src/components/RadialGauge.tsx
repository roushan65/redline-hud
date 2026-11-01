import { useId } from 'react';
import { clamp } from '../lib/format';
import type { Severity } from '../lib/prefs';

interface Props {
  value: number | null;
  min?: number;
  max?: number;
  /** Peak marker (e.g. session max). */
  peak?: number | null;
  label: string;
  display: { value: string; unit: string };
  sub?: string;
  level?: Severity;
  size?: number;
}

const SWEEP = 270;
const SEGMENTS = 36;

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

/** Segmented 270° HUD gauge. Fill colour = severity; unfilled track = same ramp, dimmed. */
export function RadialGauge({ value, min = 0, max = 100, peak, label, display, sub, level = 'ok', size }: Props) {
  const id = useId();
  // geometry is drawn in a fixed 168-unit box; on-screen size comes from --g-size (CSS) unless `size` is given
  const box = 168;
  const c = box / 2;
  const r = c - 14;
  const start = -SWEEP / 2;
  const frac = value == null ? 0 : clamp((value - min) / (max - min), 0, 1);
  const lit = Math.round(frac * SEGMENTS);
  const segSpan = SWEEP / SEGMENTS;
  const gap = 1.6; // degrees of surface between segments

  const peakFrac = peak == null ? null : clamp((peak - min) / (max - min), 0, 1);
  const peakDeg = peakFrac == null ? null : start + peakFrac * SWEEP;

  return (
    <figure
      className={`gauge gauge--${level}`}
      style={size ? ({ '--g-size': `${size}px` } as React.CSSProperties) : undefined}
      role="meter"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value ?? undefined}
      aria-valuetext={`${display.value} ${display.unit}`}
    >
      <svg viewBox={`0 0 ${box} ${box}`}>
        <defs>
          <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* outer tick ring */}
        <path d={arc(c, c, r + 8, start, start + SWEEP)} className="gauge__ring" />
        {Array.from({ length: 11 }, (_, i) => {
          const deg = start + (i / 10) * SWEEP;
          const [x1, y1] = polar(c, c, r + 5, deg);
          const [x2, y2] = polar(c, c, r + 10, deg);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="gauge__tick" />;
        })}

        {/* segmented track + fill */}
        <g filter={`url(#${id}-glow)`}>
          {Array.from({ length: SEGMENTS }, (_, i) => {
            const a0 = start + i * segSpan + gap / 2;
            const a1 = start + (i + 1) * segSpan - gap / 2;
            return <path key={i} d={arc(c, c, r, a0, a1)} className={i < lit ? 'gauge__seg gauge__seg--on' : 'gauge__seg'} />;
          })}
        </g>

        {/* inner thin arc */}
        <path d={arc(c, c, r - 12, start, start + SWEEP)} className="gauge__inner" />
        {value != null && <path d={arc(c, c, r - 12, start, start + Math.max(0.5, frac * SWEEP))} className="gauge__inner gauge__inner--on" />}

        {peakDeg != null && (() => {
          const [x1, y1] = polar(c, c, r - 9, peakDeg);
          const [x2, y2] = polar(c, c, r + 9, peakDeg);
          return <line x1={x1} y1={y1} x2={x2} y2={y2} className="gauge__peak" />;
        })()}
      </svg>

      <div className="gauge__center">
        <span className="gauge__value">
          {display.value}
          <small>{display.unit}</small>
        </span>
        <span className="gauge__label">{label}</span>
        {sub && <span className="gauge__sub">{sub}</span>}
      </div>
    </figure>
  );
}
