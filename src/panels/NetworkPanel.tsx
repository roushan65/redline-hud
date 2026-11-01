import { LineChart } from '../components/LineChart';
import { Panel } from '../components/Panel';
import { HISTORY_LEN } from '../hooks/useSensorFeed';
import { formatRate } from '../lib/format';
import type { NetworkView } from '../lib/selectors';

const rate = (v: number) => {
  const f = formatRate(v);
  return `${f.value} ${f.unit}`;
};

export function NetworkPanel({ nics, history, intervalMs }: { nics: NetworkView[]; history: Map<string, number[]>; intervalMs: number }) {
  const primary = nics[0];
  if (!primary) return null;
  const down = primary.down ? history.get(primary.down.id) ?? [] : [];
  const up = primary.up ? history.get(primary.up.id) ?? [] : [];
  const dn = formatRate(primary.down?.value ?? null);
  const upf = formatRate(primary.up?.value ?? null);

  return (
    <Panel title="Network" code="NET.01" subtitle={primary.hw.name} className="panel--minor">
      <div className="net__hero">
        <div className="net__big">
          <span className="net__label"><i style={{ background: 'var(--c-series1)' }} />Down</span>
          <span className="net__value">{dn.value}<small>{dn.unit}</small></span>
        </div>
        <div className="net__big">
          <span className="net__label"><i style={{ background: 'var(--c-series2)' }} />Up</span>
          <span className="net__value">{upf.value}<small>{upf.unit}</small></span>
        </div>
      </div>
      <LineChart
        series={[
          { key: 'down', label: 'Download', data: down, color: 'var(--c-series1)' },
          { key: 'up', label: 'Upload', data: up, color: 'var(--c-series2)' },
        ]}
        format={rate}
        intervalMs={intervalMs}
        capacity={HISTORY_LEN}
        ariaLabel={`${primary.hw.name} download and upload throughput`}
        height={80}
      />
      <div className="net__totals">
        <span>Σ ↓ {primary.downloaded?.value?.toFixed(1) ?? '—'} GB</span>
        <span>Σ ↑ {primary.uploaded?.value?.toFixed(1) ?? '—'} GB</span>
        {primary.util?.value != null && <span>UTIL {primary.util.value.toFixed(1)}%</span>}
      </div>
      {nics.length > 1 && (
        <ul className="nics">
          {nics.slice(1).map((n) => (
            <li key={n.hw.id}>
              <span className="nics__name">{n.hw.name}</span>
              <span>↓ {rate(n.down?.value ?? 0)}</span>
              <span>↑ {rate(n.up?.value ?? 0)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
