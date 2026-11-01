import { FanDial } from '../components/FanDial';
import { Panel } from '../components/Panel';
import { StatusTag } from '../components/StatusTag';
import { TEMP_LIMITS, severity, useDisplay, type Severity } from '../lib/prefs';
import type { BoardView } from '../lib/selectors';

export function BoardPanel({ board }: { board: BoardView }) {
  const d = useDisplay();
  if (!board.hw) return null;
  const levels = board.temps.map((t) => severity(t.value, TEMP_LIMITS.board));
  const worst: Severity = levels.includes('crit') ? 'crit' : levels.includes('warn') ? 'warn' : 'ok';
  // Pair each fan with its PWM control of the same name.
  const dutyFor = (name: string) => board.controls.find((c) => c.name === name);

  return (
    <Panel title="Mainboard" code="SYS.05" subtitle={board.hw.name} right={<StatusTag level={worst} />} className="panel--minor">
      <div className="thermals">
        {board.temps.map((t, i) => {
          const v = d(t);
          const pct = Math.min(100, Math.max(0, (((t.value ?? 0) - 20) / 70) * 100));
          return (
            <div key={t.id} className={`thermo thermo--${levels[i]}`} title={`${t.name}: min ${d(t, 'min').value} / max ${d(t, 'max').value}`}>
              <div className="thermo__tube" role="meter" aria-label={t.name} aria-valuenow={t.value ?? undefined} aria-valuetext={`${v.value} ${v.unit}`}>
                <div className="thermo__fill" style={{ height: `${pct}%` }} />
              </div>
              <span className="thermo__val">{v.value}<small>{v.unit}</small></span>
              <span className="thermo__name">{t.name}</span>
            </div>
          );
        })}
      </div>
      <div className="fans">
        {board.fans.map((f) => (
          <FanDial key={f.id} fan={f} duty={dutyFor(f.name)} maxRpm={2500} />
        ))}
      </div>
    </Panel>
  );
}
