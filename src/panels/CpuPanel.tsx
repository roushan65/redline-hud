import { CoreGrid } from '../components/CoreGrid';
import { LineChart } from '../components/LineChart';
import { Panel } from '../components/Panel';
import { RadialGauge } from '../components/RadialGauge';
import { Stat } from '../components/Stat';
import { StatusTag } from '../components/StatusTag';
import { HISTORY_LEN } from '../hooks/useSensorFeed';
import { LOAD_LIMITS, TEMP_LIMITS, severity, useDisplay, type Severity } from '../lib/prefs';
import type { CpuView } from '../lib/selectors';

const worst = (...l: Severity[]): Severity => (l.includes('crit') ? 'crit' : l.includes('warn') ? 'warn' : 'ok');

export function CpuPanel({ cpu, history, intervalMs }: { cpu: CpuView; history: Map<string, number[]>; intervalMs: number }) {
  const d = useDisplay();
  const tempLvl = severity(cpu.temp?.value, TEMP_LIMITS.cpu);
  const loadLvl = severity(cpu.load?.value, LOAD_LIMITS);
  const loadHist = cpu.load ? history.get(cpu.load.id) ?? [] : [];

  return (
    <Panel title="CPU" code="SYS.01" subtitle={cpu.hw.name} right={<StatusTag level={worst(tempLvl, loadLvl)} />} className="panel--cpu panel--hero">
      <div className="duo">
        <RadialGauge label="Load" value={cpu.load?.value ?? null} peak={cpu.load?.max} display={d(cpu.load)} level={loadLvl} sub={`peak ${d(cpu.load, 'max').value}%`} />
        <RadialGauge
          label="Temp"
          value={cpu.temp?.value ?? null}
          min={20}
          max={100}
          peak={cpu.temp?.max}
          display={d(cpu.temp)}
          level={tempLvl}
          sub={`max ${d(cpu.temp, 'max').value}`}
        />
      </div>

      <div className="stats">
        <Stat label="Package" {...d(cpu.power)} trend={cpu.power && history.get(cpu.power.id)} />
        <Stat label="Clock avg" {...d(cpu.clock)} trend={cpu.clock && history.get(cpu.clock.id)} />
        <Stat label="Core V" {...d(cpu.voltage)} />
      </div>

      <div className="block">
        <div className="block__head">
          <span>Total load</span>
          <span className="block__meta">{((HISTORY_LEN * intervalMs) / 1000).toFixed(0)}s window</span>
        </div>
        <LineChart
          series={[{ key: 'load', label: 'CPU load', data: loadHist, color: 'var(--c-accent)' }]}
          yMax={100}
          format={(v) => `${v.toFixed(0)}%`}
          intervalMs={intervalMs}
          capacity={HISTORY_LEN}
          ariaLabel="CPU total load over time"
        />
      </div>

      <div className="block">
        <div className="block__head">
          <span>Thread matrix</span>
        </div>
        <CoreGrid loads={cpu.coreLoads} clocks={cpu.coreClocks} />
      </div>
    </Panel>
  );
}

