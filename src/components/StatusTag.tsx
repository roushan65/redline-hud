import { SEVERITY_ICON, SEVERITY_LABEL, type Severity } from '../lib/prefs';

/** Status is never colour-alone: icon + label + colour. */
export function StatusTag({ level, compact = false }: { level: Severity; compact?: boolean }) {
  return (
    <span className={`status status--${level}`} role="status">
      <span aria-hidden>{SEVERITY_ICON[level]}</span>
      {!compact && <span>{SEVERITY_LABEL[level]}</span>}
      {compact && <span className="sr-only">{SEVERITY_LABEL[level]}</span>}
    </span>
  );
}
