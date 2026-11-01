import { clamp } from '../lib/format';
import type { Severity } from '../lib/prefs';

interface Props {
  label: string;
  value: number | null;
  max?: number;
  display: string;
  level?: Severity;
  /** Segmented "LED" look instead of a solid bar. */
  segmented?: boolean;
  hint?: string;
}

/** Horizontal meter: fill carries severity, track is a dim step of the same hue. */
export function Meter({ label, value, max = 100, display, level = 'ok', segmented = false, hint }: Props) {
  const pct = value == null ? 0 : clamp((value / max) * 100, 0, 100);
  return (
    <div className={`meter meter--${level}`} title={hint}>
      <div className="meter__row">
        <span className="meter__label">{label}</span>
        <span className="meter__value">{display}</span>
      </div>
      <div
        className={`meter__track${segmented ? ' meter__track--seg' : ''}`}
        role="meter"
        aria-label={label}
        aria-valuenow={value ?? undefined}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuetext={display}
      >
        <div className="meter__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
