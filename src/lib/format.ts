import type { Sensor } from './types';

const RATE_UNITS = ['B/s', 'KB/s', 'MB/s', 'GB/s'];

export function formatRate(bytesPerSec: number | null): { value: string; unit: string } {
  if (bytesPerSec == null) return { value: '—', unit: '' };
  let v = bytesPerSec;
  let i = 0;
  while (v >= 1000 && i < RATE_UNITS.length - 1) {
    v /= 1024;
    i++;
  }
  return { value: v.toFixed(v >= 100 || i === 0 ? 0 : 1), unit: RATE_UNITS[i] };
}

/** Splits a value into number + unit, with precision chosen per unit. */
export function formatValue(value: number | null, unit: string): { value: string; unit: string } {
  if (value == null) return { value: '—', unit };
  if (unit === 'B/s') return formatRate(value);
  if (unit === 'MB' && value >= 1024) return { value: (value / 1024).toFixed(1), unit: 'GB' };
  if (unit === 'MHz' && value >= 10000) return { value: (value / 1000).toFixed(2), unit: 'GHz' };
  const digits: Record<string, number> = { RPM: 0, V: 3, ns: 3, MHz: 0, '°C': 1, '%': 1, W: 1, GB: 1, MB: 0 };
  const d = digits[unit] ?? (Math.abs(value) >= 100 ? 0 : 1);
  return { value: value.toFixed(d), unit };
}

export function fmt(s: Sensor | undefined, which: 'value' | 'min' | 'max' = 'value'): string {
  if (!s) return '—';
  const f = formatValue(s[which], s.unit);
  return f.unit ? `${f.value} ${f.unit}` : f.value;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
