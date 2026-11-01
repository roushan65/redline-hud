import type { ReactNode } from 'react';

interface Props {
  label: string;
  value: string;
  unit?: string;
  sub?: ReactNode;
  trend?: number[];
  accent?: boolean;
}

/** Stat tile: label · value · optional sub-line · optional 12-pt sparkline. */
export function Stat({ label, value, unit, sub, trend, accent = false }: Props) {
  return (
    <div className={`stat${accent ? ' stat--accent' : ''}`}>
      <span className="stat__label">{label}</span>
      <span className="stat__value">
        {value}
        {unit && <small>{unit}</small>}
      </span>
      {sub && <span className="stat__sub">{sub}</span>}
      {trend && trend.length > 1 && <Spark data={trend.slice(-24)} />}
    </div>
  );
}

function Spark({ data }: { data: number[] }) {
  const W = 80;
  const H = 18;
  const lo = Math.min(...data);
  const hi = Math.max(...data);
  const span = hi - lo || 1;
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * W).toFixed(1)},${(H - 2 - ((v - lo) / span) * (H - 4)).toFixed(1)}`);
  const last = pts[pts.length - 1].split(',');
  return (
    <svg className="stat__spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden>
      <polyline points={pts.join(' ')} />
      <circle cx={last[0]} cy={last[1]} r="2.5" />
    </svg>
  );
}
