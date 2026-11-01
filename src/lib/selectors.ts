import { allSensors, flattenHardware } from './parse';
import type { Hardware, HardwareKind, Sensor, SensorType, Snapshot } from './types';

type Matcher = RegExp | string;

function matches(name: string, m: Matcher): boolean {
  return typeof m === 'string' ? name === m : m.test(name);
}

/** First sensor of `type` whose name matches one of the matchers, in priority order. */
export function pick(sensors: Sensor[], type: SensorType, ...matchers: Matcher[]): Sensor | undefined {
  const ofType = sensors.filter((s) => s.type === type);
  for (const m of matchers) {
    const hit = ofType.find((s) => matches(s.name, m));
    if (hit) return hit;
  }
  return undefined;
}

export function byType(sensors: Sensor[], type: SensorType, filter?: RegExp): Sensor[] {
  return sensors.filter((s) => s.type === type && (!filter || filter.test(s.name)));
}

export function hardwareOfKind(snap: Snapshot, kind: HardwareKind): Hardware[] {
  return flattenHardware(snap.hardware).filter((h) => h.kind === kind);
}

/** Discrete GPUs first (NVIDIA / AMD with a real load sensor), iGPUs with no sensors skipped. */
export function gpus(snap: Snapshot): Hardware[] {
  return hardwareOfKind(snap, 'gpu')
    .filter((g) => g.sensors.length > 0)
    .sort((a, b) => b.sensors.length - a.sensors.length);
}

export interface CpuView {
  hw: Hardware;
  load?: Sensor;
  temp?: Sensor;
  power?: Sensor;
  clock?: Sensor;
  voltage?: Sensor;
  coreLoads: Sensor[];
  coreClocks: Sensor[];
}

export function cpuView(hw: Hardware): CpuView {
  const s = allSensors(hw);
  return {
    hw,
    load: pick(s, 'Load', 'CPU Total', /total/i),
    temp: pick(s, 'Temperature', 'Core (Tctl/Tdie)', 'CPU Package', /package/i, /tdie|tctl/i, /core/i),
    power: pick(s, 'Power', 'Package', 'CPU Package', /package/i),
    clock: pick(s, 'Clock', 'Cores (Average)', /average\)$/i, /core #1$/i),
    voltage: pick(s, 'Voltage', 'Core (SVI2 TFN)', 'CPU Core', /vid/i, /core/i),
    coreLoads: byType(s, 'Load', /^CPU Core #\d+$/),
    coreClocks: byType(s, 'Clock', /^Core #\d+$/),
  };
}

export interface GpuView {
  hw: Hardware;
  load?: Sensor;
  temp?: Sensor;
  hotspot?: Sensor;
  memTemp?: Sensor;
  power?: Sensor;
  coreClock?: Sensor;
  memClock?: Sensor;
  memUsed?: Sensor;
  memTotal?: Sensor;
  fans: Sensor[];
  pcieRx?: Sensor;
  pcieTx?: Sensor;
  engines: Sensor[];
}

export function gpuView(hw: Hardware): GpuView {
  const s = allSensors(hw);
  return {
    hw,
    load: pick(s, 'Load', 'GPU Core', /core/i, /3d/i),
    temp: pick(s, 'Temperature', 'GPU Core', /core/i, /edge/i),
    hotspot: pick(s, 'Temperature', 'GPU Hot Spot', /hot ?spot/i),
    memTemp: pick(s, 'Temperature', 'GPU Memory Junction', /memory/i),
    power: pick(s, 'Power', 'GPU Package', /package/i, /total/i, /core/i),
    coreClock: pick(s, 'Clock', 'GPU Core', /core/i),
    memClock: pick(s, 'Clock', 'GPU Memory', /memory/i),
    memUsed: pick(s, 'SmallData', 'GPU Memory Used', /memory used/i),
    memTotal: pick(s, 'SmallData', 'GPU Memory Total', /memory total/i),
    fans: byType(s, 'Fan'),
    pcieRx: pick(s, 'Throughput', /rx/i),
    pcieTx: pick(s, 'Throughput', /tx/i),
    engines: byType(s, 'Load', /^(GPU (Memory Controller|Video Engine|Bus)|D3D (3D|Copy|Video Decode|Video Encode))$/),
  };
}

export interface MemoryView {
  load?: Sensor;
  used?: Sensor;
  available?: Sensor;
  virtLoad?: Sensor;
  virtUsed?: Sensor;
  virtAvailable?: Sensor;
  dimmTemps: Sensor[];
}

export function memoryView(snap: Snapshot): MemoryView {
  const mem = hardwareOfKind(snap, 'memory');
  const phys = mem.find((h) => h.id === '/ram') ?? mem.find((h) => !/virtual/i.test(h.name));
  const virt = mem.find((h) => h.id === '/vram') ?? mem.find((h) => /virtual/i.test(h.name));
  const ps = phys ? allSensors(phys) : [];
  const vs = virt ? allSensors(virt) : [];
  const dimms = hardwareOfKind(snap, 'dimm');
  return {
    load: pick(ps, 'Load', 'Memory', /memory/i),
    used: pick(ps, 'Data', 'Memory Used', /used/i),
    available: pick(ps, 'Data', 'Memory Available', /available/i),
    virtLoad: pick(vs, 'Load', 'Memory', /memory/i),
    virtUsed: pick(vs, 'Data', 'Memory Used', /used/i),
    virtAvailable: pick(vs, 'Data', 'Memory Available', /available/i),
    // One headline temp per DIMM (the sensor named after the stick, e.g. "DIMM #1").
    dimmTemps: dimms
      .map((d) => pick(d.sensors, 'Temperature', /^DIMM #\d+$/, /dimm/i, /.*/))
      .filter((x): x is Sensor => !!x),
  };
}

export interface StorageView {
  hw: Hardware;
  temp?: Sensor;
  used?: Sensor;
  life?: Sensor;
  read?: Sensor;
  write?: Sensor;
  activity?: Sensor;
}

export function storageViews(snap: Snapshot): StorageView[] {
  return hardwareOfKind(snap, 'storage').map((hw) => {
    const s = allSensors(hw);
    return {
      hw,
      temp: pick(s, 'Temperature', 'Composite Temperature', 'Temperature', /.*/),
      used: pick(s, 'Load', 'Used Space', /used/i),
      life: pick(s, 'Level', 'Life', 'Remaining Life', /life/i),
      read: pick(s, 'Throughput', 'Read Rate', /read/i),
      write: pick(s, 'Throughput', 'Write Rate', /write/i),
      activity: pick(s, 'Load', 'Total Activity', /total activity/i),
    };
  });
}

export interface NetworkView {
  hw: Hardware;
  up?: Sensor;
  down?: Sensor;
  util?: Sensor;
  uploaded?: Sensor;
  downloaded?: Sensor;
}

/** NICs sorted by current traffic, busiest first; idle adapters (no traffic ever) dropped unless none remain. */
export function networkViews(snap: Snapshot): NetworkView[] {
  const all = hardwareOfKind(snap, 'network').map((hw) => {
    const s = allSensors(hw);
    return {
      hw,
      up: pick(s, 'Throughput', 'Upload Speed', /upload/i),
      down: pick(s, 'Throughput', 'Download Speed', /download/i),
      util: pick(s, 'Load', 'Network Utilization', /util/i),
      uploaded: pick(s, 'Data', 'Data Uploaded', /upload/i),
      downloaded: pick(s, 'Data', 'Data Downloaded', /download/i),
    };
  });
  const traffic = (n: NetworkView) => (n.up?.value ?? 0) + (n.down?.value ?? 0);
  const everUsed = (n: NetworkView) => (n.uploaded?.value ?? 0) + (n.downloaded?.value ?? 0) > 0 || traffic(n) > 0;
  const active = all.filter(everUsed);
  return (active.length ? active : all).sort((a, b) => traffic(b) - traffic(a));
}

export interface BoardView {
  hw?: Hardware;
  temps: Sensor[];
  fans: Sensor[];
  controls: Sensor[];
}

export function boardView(snap: Snapshot): BoardView {
  const hw = hardwareOfKind(snap, 'motherboard')[0];
  const s = hw ? allSensors(hw) : [];
  return {
    hw,
    temps: byType(s, 'Temperature'),
    fans: byType(s, 'Fan'),
    controls: byType(s, 'Control'),
  };
}
