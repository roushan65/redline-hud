import type { Hardware, HardwareKind, LhmNode, Sensor, Snapshot } from './types';

/** "53.0 °C" -> { value: 53, unit: "°C" }. "-" or "" -> null. Handles "1,234.5" and "1.234,5". */
export function parseReading(raw: string | undefined): { value: number | null; unit: string } {
  if (!raw) return { value: null, unit: '' };
  const match = raw.trim().match(/^(-?[\d.,]+)\s*(.*)$/);
  if (!match) return { value: null, unit: '' };
  let num = match[1];
  // LHM formats with the host locale; normalise decimal comma.
  if (num.includes(',') && !num.includes('.')) num = num.replace(',', '.');
  else num = num.replace(/,/g, '');
  const value = Number.parseFloat(num);
  return { value: Number.isFinite(value) ? value : null, unit: match[2].trim() };
}

function kindFromHardwareId(id: string): HardwareKind {
  if (/^\/(amdcpu|intelcpu|cpu)/.test(id)) return 'cpu';
  if (/^\/gpu/.test(id)) return 'gpu';
  if (/^\/(motherboard|lpc|ec)/.test(id)) return 'motherboard';
  if (/^\/(ram|vram)/.test(id)) return 'memory';
  if (/^\/memory\/dimm/.test(id)) return 'dimm';
  if (/^\/(nvme|hdd|ssd|storage)/.test(id)) return 'storage';
  if (/^\/nic/.test(id)) return 'network';
  return 'other';
}

// LHM formats rates with binary prefixes (RawValue "102997000.0 B/s" is shown as "98.2 MB/s").
// Builds with Raw* fields give B/s directly; older ones only have the formatted string.
const RATE_SCALE: Record<string, number> = { 'B/s': 1, 'KB/s': 1024, 'MB/s': 1024 ** 2, 'GB/s': 1024 ** 3 };

/** Throughput arrives as a mix of KB/s and MB/s; normalise to B/s so history and maths are consistent. */
function normaliseRate(r: { value: number | null; unit: string }): number | null {
  if (r.value == null) return null;
  return r.value * (RATE_SCALE[r.unit] ?? 1);
}

function toSensor(node: LhmNode, hardwareId: string): Sensor {
  // Raw* fields are present on newer LHM builds; fall back to formatted ones.
  const v = parseReading(node.RawValue ?? node.Value);
  const min = parseReading(node.RawMin ?? node.Min);
  const max = parseReading(node.RawMax ?? node.Max);
  const isRate = node.Type === 'Throughput';
  return {
    id: node.SensorId ?? `${hardwareId}/${node.id}`,
    name: node.Text,
    type: node.Type!,
    value: isRate ? normaliseRate(v) : v.value,
    min: isRate ? normaliseRate(min) : min.value,
    max: isRate ? normaliseRate(max) : max.value,
    unit: isRate ? 'B/s' : v.unit || min.unit || max.unit,
    hardwareId,
  };
}

/** Walks a hardware node: sensor-group children hold sensors, HardwareId children are sub-hardware. */
function toHardware(node: LhmNode, index: Map<string, Sensor>): Hardware {
  const id = node.HardwareId!;
  const hw: Hardware = { id, name: node.Text, kind: kindFromHardwareId(id), sensors: [], children: [] };

  for (const child of node.Children) {
    if (child.HardwareId) {
      hw.children.push(toHardware(child, index));
      continue;
    }
    // Sensor group ("Temperatures", "Load", ...)
    for (const leaf of child.Children) {
      if (!leaf.Type) continue;
      const s = toSensor(leaf, id);
      hw.sensors.push(s);
      index.set(s.id, s);
    }
  }
  return hw;
}

export function parseLhm(root: LhmNode): Snapshot {
  const sensorsById = new Map<string, Sensor>();
  const machineNode = root.Children[0];
  const hardware: Hardware[] = [];

  for (const child of machineNode?.Children ?? []) {
    if (child.HardwareId) hardware.push(toHardware(child, sensorsById));
  }

  return {
    machine: machineNode?.Text ?? 'UNKNOWN',
    hardware,
    sensorsById,
    timestamp: Date.now(),
  };
}

/** Flatten hardware incl. sub-hardware (motherboard -> SuperIO chip). */
export function flattenHardware(list: Hardware[]): Hardware[] {
  return list.flatMap((h) => [h, ...flattenHardware(h.children)]);
}

/** All sensors of a hardware, including its sub-hardware. */
export function allSensors(hw: Hardware): Sensor[] {
  return [...hw.sensors, ...hw.children.flatMap(allSensors)];
}
