import { createContext, useContext } from 'react';
import { formatValue } from './format';
import type { Sensor } from './types';

export type VendorLogoMode = 'brand' | 'theme' | 'off';

export interface Prefs {
  tempUnit: 'C' | 'F';
  vendorLogos: VendorLogoMode;
  /** vendor id → URL of a user-supplied logo in config/vendors/ */
  vendorFiles: Record<string, string>;
}

export const PrefsContext = createContext<Prefs>({ tempUnit: 'C', vendorLogos: 'brand', vendorFiles: {} });

export function usePrefs() {
  return useContext(PrefsContext);
}

/** Display conversion that respects the user's temperature unit. */
export function display(value: number | null, unit: string, prefs: Prefs) {
  if (unit === '°C' && prefs.tempUnit === 'F' && value != null) {
    return { value: (value * 9 / 5 + 32).toFixed(1), unit: '°F' };
  }
  return formatValue(value, unit);
}

export function useDisplay() {
  const prefs = usePrefs();
  return (s: Sensor | undefined, which: 'value' | 'min' | 'max' = 'value') =>
    s ? display(s[which], s.unit, prefs) : { value: '—', unit: '' };
}

export type Severity = 'ok' | 'warn' | 'crit';

export interface Thresholds {
  warn: number;
  crit: number;
}

// Celsius thresholds by component. Memory junction and NVMe controllers run hotter by design.
export const TEMP_LIMITS = {
  cpu: { warn: 80, crit: 90 },
  gpu: { warn: 78, crit: 87 },
  vram: { warn: 90, crit: 100 },
  board: { warn: 65, crit: 80 },
  dimm: { warn: 60, crit: 75 },
  storage: { warn: 60, crit: 70 },
} satisfies Record<string, Thresholds>;

export const LOAD_LIMITS: Thresholds = { warn: 80, crit: 95 };

export function severity(v: number | null | undefined, t: Thresholds): Severity {
  if (v == null) return 'ok';
  if (v >= t.crit) return 'crit';
  if (v >= t.warn) return 'warn';
  return 'ok';
}

export const SEVERITY_LABEL: Record<Severity, string> = { ok: 'NOMINAL', warn: 'ELEVATED', crit: 'CRITICAL' };
export const SEVERITY_ICON: Record<Severity, string> = { ok: '◆', warn: '▲', crit: '✖' };
