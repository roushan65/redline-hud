import { Meter } from '../components/Meter';
import { Panel } from '../components/Panel';
import { StatusTag } from '../components/StatusTag';
import { formatRate } from '../lib/format';
import { TEMP_LIMITS, severity, useDisplay, type Severity } from '../lib/prefs';
import type { StorageView } from '../lib/selectors';

const rate = (v: number | null | undefined) => {
  const f = formatRate(v ?? null);
  return `${f.value} ${f.unit}`;
};

export function StoragePanel({ drives }: { drives: StorageView[] }) {
  const d = useDisplay();
  const levels = drives.map((x) => severity(x.temp?.value, TEMP_LIMITS.storage));
  const worst: Severity = levels.includes('crit') ? 'crit' : levels.includes('warn') ? 'warn' : 'ok';

  return (
    <Panel title="Storage" code="SYS.04" subtitle={`${drives.length} drives`} right={<StatusTag level={worst} />} className="panel--minor">
      <div className="drives">
        {drives.map((x, i) => {
          const t = d(x.temp);
          const usedLvl: Severity = (x.used?.value ?? 0) >= 95 ? 'crit' : (x.used?.value ?? 0) >= 85 ? 'warn' : 'ok';
          return (
            <div key={x.hw.id} className="drive">
              <div className="drive__head">
                <span className="drive__idx">{String(i).padStart(2, '0')}</span>
                <span className="drive__name" title={x.hw.name}>{x.hw.name}</span>
                <span className="drive__kind">{x.hw.id.split('/')[1]?.toUpperCase()}</span>
                <span className={`drive__temp drive__temp--${levels[i]}`}>
                  {t.value}
                  <small>{t.unit}</small>
                </span>
              </div>
              {x.used?.value != null && <Meter label="Used" value={x.used.value} display={`${x.used.value.toFixed(1)}%`} level={usedLvl} />}
              <div className="drive__io">
                <span><i className="arrow arrow--r" aria-hidden />R {rate(x.read?.value)}</span>
                <span><i className="arrow arrow--w" aria-hidden />W {rate(x.write?.value)}</span>
                {x.life?.value != null && <span className="drive__life">LIFE {x.life.value.toFixed(0)}%</span>}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
