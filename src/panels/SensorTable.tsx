import { useMemo, useState } from 'react';
import { Panel } from '../components/Panel';
import { flattenHardware } from '../lib/parse';
import { display, usePrefs } from '../lib/prefs';
import type { SensorType, Snapshot } from '../lib/types';

/** Every sensor LHM reports, filterable. Also the table-view twin for all charts on the page. */
export function SensorTable({ snap }: { snap: Snapshot }) {
  const prefs = usePrefs();
  const [q, setQ] = useState('');
  const [type, setType] = useState<SensorType | 'all'>('all');
  const [open, setOpen] = useState(false);

  const hardware = useMemo(() => flattenHardware(snap.hardware).filter((h) => h.sensors.length), [snap]);
  const types = useMemo(() => [...new Set(hardware.flatMap((h) => h.sensors.map((s) => s.type)))].sort(), [hardware]);
  const needle = q.trim().toLowerCase();

  const fmt = (v: number | null, unit: string) => {
    const f = display(v, unit, prefs);
    return f.unit ? `${f.value} ${f.unit}` : f.value;
  };

  return (
    <Panel
      title="Sensor Index"
      code="RAW.00"
      subtitle={`${snap.sensorsById.size} channels`}
      className="panel--wide"
      right={
        <button type="button" className="btn btn--ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Collapse' : 'Expand'}
        </button>
      }
    >
      {open && (
        <>
          <div className="filters">
            <input className="input" placeholder="Filter sensors…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter sensors" />
            <select className="input" value={type} onChange={(e) => setType(e.target.value as SensorType | 'all')} aria-label="Sensor type">
              <option value="all">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Sensor</th>
                  <th>Type</th>
                  <th className="num">Value</th>
                  <th className="num">Min</th>
                  <th className="num">Max</th>
                </tr>
              </thead>
              {hardware.map((h) => {
                const rows = h.sensors.filter(
                  (s) => (type === 'all' || s.type === type) && (!needle || `${h.name} ${s.name}`.toLowerCase().includes(needle)),
                );
                if (!rows.length) return null;
                return (
                  <tbody key={h.id}>
                    <tr className="table__group">
                      <th colSpan={5}>{h.name}</th>
                    </tr>
                    {rows.map((s) => (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td className="dim">{s.type}</td>
                        <td className="num">{fmt(s.value, s.unit)}</td>
                        <td className="num dim">{fmt(s.min, s.unit)}</td>
                        <td className="num dim">{fmt(s.max, s.unit)}</td>
                      </tr>
                    ))}
                  </tbody>
                );
              })}
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}
