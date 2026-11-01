import { FanDial } from '../components/FanDial';
import { LineChart } from '../components/LineChart';
import { Meter } from '../components/Meter';
import { Panel } from '../components/Panel';
import { RadialGauge } from '../components/RadialGauge';
import { Stat } from '../components/Stat';
import { StatusTag } from '../components/StatusTag';
import { HISTORY_LEN } from '../hooks/useSensorFeed';
import { formatRate } from '../lib/format';
import { LOAD_LIMITS, TEMP_LIMITS, severity, useDisplay, type Severity } from '../lib/prefs';
import type { GpuView } from '../lib/selectors';

const worst = (...l: Severity[]): Severity => (l.includes('crit') ? 'crit' : l.includes('warn') ? 'warn' : 'ok');

export function GpuPanel({ gpu, history, intervalMs }: { gpu: GpuView; history: Map<string, number[]>; intervalMs: number }) {
  const d = useDisplay();
  const tempLvl = severity(gpu.temp?.value, TEMP_LIMITS.gpu);
  const memTLvl = severity(gpu.memTemp?.value, TEMP_LIMITS.vram);
  const loadLvl = severity(gpu.load?.value, LOAD_LIMITS);

  const used = gpu.memUsed?.value ?? null;
  const total = gpu.memTotal?.value ?? null;
  const vramPct = used != null && total ? (used / total) * 100 : null;

  const powerHist = gpu.power ? history.get(gpu.power.id) ?? [] : [];
  const rx = gpu.pcieRx ? history.get(gpu.pcieRx.id) ?? [] : [];
  const tx = gpu.pcieTx ? history.get(gpu.pcieTx.id) ?? [] : [];
  const rate = (v: number) => {
    const f = formatRate(v);
    return `${f.value} ${f.unit}`;
  };

  return (
    <Panel title="GPU" code="SYS.02" subtitle={gpu.hw.name} right={<StatusTag level={worst(tempLvl, memTLvl, loadLvl)} />} className="panel--gpu panel--hero">
      <div className="duo">
        <RadialGauge label="Core load" value={gpu.load?.value ?? null} peak={gpu.load?.max} display={d(gpu.load)} level={loadLvl} sub={`peak ${d(gpu.load, 'max').value}%`} />
        <RadialGauge
          label="Core temp"
          value={gpu.temp?.value ?? null}
          min={20}
          max={100}
          peak={gpu.temp?.max}
          display={d(gpu.temp)}
          level={tempLvl}
          sub={gpu.memTemp ? `VRAM ${d(gpu.memTemp).value}${d(gpu.memTemp).unit}` : undefined}
        />
      </div>

      <div className="stats">
        <Stat label="Board power" {...d(gpu.power)} trend={powerHist} />
        <Stat label="Core clock" {...d(gpu.coreClock)} trend={gpu.coreClock && history.get(gpu.coreClock.id)} />
        <Stat label="Mem clock" {...d(gpu.memClock)} />
      </div>

      <Meter
        label="VRAM"
        value={vramPct}
        display={used != null && total ? `${(used / 1024).toFixed(1)} / ${(total / 1024).toFixed(1)} GB` : '—'}
        level={severity(vramPct, LOAD_LIMITS)}
        segmented
      />

      {(gpu.pcieRx || gpu.pcieTx) && (
        <div className="block">
          <div className="block__head">
            <span>PCIe bus</span>
            <span className="legend">
              <span className="legend__item"><i style={{ background: 'var(--c-series1)' }} />Rx {gpu.pcieRx && rate(gpu.pcieRx.value ?? 0)}</span>
              <span className="legend__item"><i style={{ background: 'var(--c-series2)' }} />Tx {gpu.pcieTx && rate(gpu.pcieTx.value ?? 0)}</span>
            </span>
          </div>
          <LineChart
            series={[
              { key: 'rx', label: 'Rx', data: rx, color: 'var(--c-series1)' },
              { key: 'tx', label: 'Tx', data: tx, color: 'var(--c-series2)' },
            ]}
            format={rate}
            intervalMs={intervalMs}
            capacity={HISTORY_LEN}
            ariaLabel="GPU PCIe receive and transmit throughput"
            height={70}
          />
        </div>
      )}

      {gpu.engines.length > 0 && (
        <div className="engines">
          {dedupe(gpu.engines).map((e) => (
            <Meter key={e.id} label={e.name.replace(/^(GPU|D3D) /, '')} value={e.value} display={`${(e.value ?? 0).toFixed(0)}%`} />
          ))}
        </div>
      )}

      {gpu.fans.length > 0 && (
        <div className="fans fans--row">
          {gpu.fans.map((f) => (
            <FanDial key={f.id} fan={f} maxRpm={3200} />
          ))}
        </div>
      )}
    </Panel>
  );
}

/** LHM reports several identically-named D3D engines (one per node); keep the busiest of each name. */
function dedupe<T extends { name: string; value: number | null }>(list: T[]): T[] {
  const m = new Map<string, T>();
  for (const s of list) {
    const prev = m.get(s.name);
    if (!prev || (s.value ?? 0) > (prev.value ?? 0)) m.set(s.name, s);
  }
  return [...m.values()];
}
