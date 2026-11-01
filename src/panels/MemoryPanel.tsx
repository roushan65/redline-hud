import { Meter } from '../components/Meter';
import { Panel } from '../components/Panel';
import { RadialGauge } from '../components/RadialGauge';
import { StatusTag } from '../components/StatusTag';
import { VendorBadge } from '../components/VendorBadge';
import { LOAD_LIMITS, TEMP_LIMITS, severity, useDisplay } from '../lib/prefs';
import type { MemoryView } from '../lib/selectors';
import type { Vendor } from '../lib/vendors';

export function MemoryPanel({ mem, vendor }: { mem: MemoryView; vendor?: Vendor | null }) {
  const d = useDisplay();
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
    </Panel>
  );
}
