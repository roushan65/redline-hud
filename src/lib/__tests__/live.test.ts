import { describe, expect, it } from 'vitest';
import { parseLhm } from '../parse';
import { cpuView, gpus, gpuView, hardwareOfKind, memoryView } from '../selectors';
import type { LhmNode } from '../types';

// Opt-in: LHM_LIVE_URL=http://192.168.1.4:8085/data.json npm test
const url = process.env.LHM_LIVE_URL;

describe.skipIf(!url)('live LibreHardwareMonitor endpoint', () => {
  it('parses and exposes headline sensors', async () => {
    const res = await fetch(url!, { signal: AbortSignal.timeout(5000) });
    const snap = parseLhm((await res.json()) as LhmNode);
    const cpu = cpuView(hardwareOfKind(snap, 'cpu')[0]);
    const gpu = gpuView(gpus(snap)[0]);
    const mem = memoryView(snap);
    console.log(snap.machine, snap.sensorsById.size, 'sensors', {
      cpuLoad: cpu.load?.value,
      cpuTemp: cpu.temp?.value,
      gpuLoad: gpu.load?.value,
      gpuTemp: gpu.temp?.value,
      ram: mem.load?.value,
    });
    expect(cpu.load?.value).not.toBeNull();
    expect(cpu.temp?.value).not.toBeNull();
    expect(gpu.temp?.value).not.toBeNull();
    expect(mem.used?.value).not.toBeNull();
  });
});
