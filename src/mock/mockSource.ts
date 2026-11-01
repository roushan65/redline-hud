import type { LhmNode, SensorType } from '../lib/types';
import sample from './sample.json';

// Simulated live data: starts from a real LHM response and drifts each sensor
// with a smooth random walk, tracking Min/Max like LHM does.

interface Band {
  lo: number;
  hi: number;
  step: number; // max change per tick as a fraction of the band
}

const BANDS: Partial<Record<SensorType, Band>> = {
  Temperature: { lo: 25, hi: 95, step: 0.02 },
  Load: { lo: 0, hi: 100, step: 0.08 },
  Clock: { lo: 0, hi: 6000, step: 0.03 },
  Power: { lo: 0, hi: 600, step: 0.04 },
  Fan: { lo: 0, hi: 3500, step: 0.02 },
  Control: { lo: 0, hi: 100, step: 0.02 },
  Voltage: { lo: 0, hi: 1.6, step: 0.02 },
  Throughput: { lo: 0, hi: 0, step: 0 }, // handled specially (bursty)
};

const DIGITS: Partial<Record<string, number>> = { RPM: 0, V: 3, ns: 3 };

// Sensors that must not drift (static facts about the hardware). Anchored so "CPU Total" still moves.
const FROZEN = /^(Bus Speed|Capacity|GPU Memory Total|Life|Available Spare.*|Power On.*|Used Space|Free Space|Data (Read|Written)|t[A-Z].*)$/;

interface State {
  base: number;
  value: number;
  min: number;
  max: number;
  unit: string;
  phase: number;
}

const state = new Map<string, State>();
let tree: LhmNode = structuredClone(sample as LhmNode);
let tick = 0;

function parse(raw: string): { v: number; unit: string } | null {
  const m = raw.match(/^(-?[\d.]+)\s*(.*)$/);
  return m ? { v: Number.parseFloat(m[1]), unit: m[2] } : null;
}

function format(v: number, unit: string): string {
  const d = DIGITS[unit] ?? (unit === '' ? 3 : 1);
  return unit ? `${v.toFixed(d)} ${unit}` : v.toFixed(d);
}

function drift(node: LhmNode, st: State) {
  const type = node.Type!;
  const band = BANDS[type];
  if (!band || FROZEN.test(node.Text)) return;
  // Sensors reading zero (unplugged fans, idle adapters) stay at zero.
  if (st.base === 0 && type !== 'Load' && type !== 'Throughput') return;

  if (type === 'Throughput') {
    // Bursty traffic around the observed baseline.
    const burst = Math.random() < 0.12 ? 4 + Math.random() * 10 : 1;
    const baseline = st.base > 0 ? st.base : Math.random() < 0.05 ? 50 : 0;
    st.value = Math.max(0, baseline * (0.4 + Math.random() * 1.2) * burst);
    return;
  }

  const span = band.hi - band.lo;
  // Mean-reverting walk plus a slow sine so charts have visible shape.
  const wave = Math.sin(tick / 9 + st.phase) * span * 0.04;
  const target = st.base + wave;
  const noise = (Math.random() - 0.5) * span * band.step;
  st.value += (target - st.value) * 0.25 + noise;

  const ceiling = type === 'Load' || type === 'Control' ? 100 : band.hi;
  st.value = Math.min(ceiling, Math.max(band.lo, st.value));
}

function walk(node: LhmNode) {
  if (node.Type && node.SensorId) {
    let st = state.get(node.SensorId);
    if (!st) {
      const p = parse(node.Value);
      if (!p) return;
      st = { base: p.v, value: p.v, min: p.v, max: p.v, unit: p.unit, phase: Math.random() * Math.PI * 2 };
      state.set(node.SensorId, st);
    }
    drift(node, st);
    st.min = Math.min(st.min, st.value);
    st.max = Math.max(st.max, st.value);

    // Values stay in the sensor's original unit (KB/s vs MB/s) so the parser's normalisation is exercised.
    node.Value = node.RawValue = format(st.value, st.unit);
    node.Min = node.RawMin = format(st.min, st.unit);
    node.Max = node.RawMax = format(st.max, st.unit);
  }
  node.Children.forEach(walk);
}

/** Returns a fresh LHM-shaped tree with values advanced by one tick. */
export function nextMockFrame(): LhmNode {
  tick++;
  walk(tree);
  tree = structuredClone(tree);
  return tree;
}

export function resetMock() {
  state.clear();
  tick = 0;
  tree = structuredClone(sample as LhmNode);
}
