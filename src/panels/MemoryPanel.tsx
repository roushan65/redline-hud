import { LineChart } from '../components/LineChart';
import { Meter } from '../components/Meter';
import { Panel } from '../components/Panel';
import { RadialGauge } from '../components/RadialGauge';
import { StatusTag } from '../components/StatusTag';
import { VendorBadge } from '../components/VendorBadge';
import { HISTORY_LEN } from '../hooks/useSensorFeed';
import { LOAD_LIMITS, TEMP_LIMITS, severity, useDisplay } from '../lib/prefs';
import type { MemoryView } from '../lib/selectors';
import type { Vendor } from '../lib/vendors';

interface Props {
  mem: MemoryView;
  vendor?: Vendor | null;
  history: Map<string, number[]>;
  intervalMs: number;
}

export function MemoryPanel({ mem, vendor, history, intervalMs }: Props) {
  const d = useDisplay();
  const physHist = mem.load ? history.get(mem.load.id) ?? [] : [];
  const virtHist = mem.virtLoad ? history.get(mem.virtLoad.id) ?? [] : [];
  const used = mem.used?.value ?? null;
  const avail = mem.available?.value ?? null;
  const total = used != null && avail != null ? used + avail : null;
  const vUsed = mem.virtUsed?.value ?? null;
  const vAvail = mem.virtAvailable?.value ?? null;
  const lvl = severity(mem.load?.value, LOAD_LIMITS);

  return (
    <Panel
      title="Memory"
      code="SYS.03"
      subtitle={total ? `${total.toFixed(0)} GB installed` : undefined}
      badge={<VendorBadge vendor={vendor} size="sm" />}
      right={<StatusTag level={lvl} />}
      className="panel--mem"
    >
      <div className="mem">
        <RadialGauge label="RAM" value={mem.load?.value ?? null} display={d(mem.load)} level={lvl} sub={used != null ? `${used.toFixed(1)} GB` : undefined} />
        <div className="mem__side">
          <Meter label="Physical" value={mem.load?.value ?? null} display={used != null && total ? `${used.toFixed(1)} / ${total.toFixed(1)} GB` : '—'} level={lvl} segmented />
          <Meter
            label="Virtual (commit)"
            value={mem.virtLoad?.value ?? null}
            display={vUsed != null && vAvail != null ? `${vUsed.toFixed(1)} / ${(vUsed + vAvail).toFixed(1)} GB` : '—'}
            level={severity(mem.virtLoad?.value, LOAD_LIMITS)}
            segmented
          />
          {mem.dimmTemps.length > 0 && (
            <div className="dimms">
              {mem.dimmTemps.map((t) => {
                const lv = severity(t.value, TEMP_LIMITS.dimm);
                const v = d(t);
                return (
                  <div key={t.id} className={`dimm dimm--${lv}`}>
                    <span className="dimm__chip" aria-hidden>
                      {Array.from({ length: 8 }, (_, i) => <i key={i} />)}
                    </span>
                    <span className="dimm__name">{t.name}</span>
                    <span className="dimm__val">{v.value}<small>{v.unit}</small></span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* grows into the spare height the centre column has next to the taller CPU / GPU cards */}
      <div className="mem__trend">
        <div className="block">
          <div className="block__head">
            <span>Usage</span>
            <span className="legend">
              <span className="legend__item"><i style={{ background: 'var(--c-series1)' }} />Physical</span>
              {virtHist.length > 0 && <span className="legend__item"><i style={{ background: 'var(--c-series2)' }} />Virtual</span>}
            </span>
          </div>
          <LineChart
            series={[
              { key: 'phys', label: 'Physical', data: physHist, color: 'var(--c-series1)' },
              ...(virtHist.length ? [{ key: 'virt', label: 'Virtual', data: virtHist, color: 'var(--c-series2)' }] : []),
            ]}
            yMax={100}
            format={(v) => `${v.toFixed(0)}%`}
            intervalMs={intervalMs}
            capacity={HISTORY_LEN}
            ariaLabel="Physical and virtual memory usage over time"
            height={20}
            fill
          />
        </div>
      </div>
    </Panel>
  );
}
