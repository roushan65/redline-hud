import { describe, expect, it } from 'vitest';
import sample from '../../mock/sample.json';
import { nextMockFrame, resetMock } from '../../mock/mockSource';
import { parseLhm, parseReading } from '../parse';
import { boardView, cpuView, gpus, gpuView, hardwareOfKind, memoryView, networkViews, storageViews } from '../selectors';
import type { LhmNode } from '../types';

describe('parseReading', () => {
  it('splits value and unit', () => {
    expect(parseReading('53.0 °C')).toEqual({ value: 53, unit: '°C' });
    expect(parseReading('1500 RPM')).toEqual({ value: 1500, unit: 'RPM' });
    expect(parseReading('52.349')).toEqual({ value: 52.349, unit: '' });
  });
  it('handles locale decimal comma and empty values', () => {
    expect(parseReading('0,940 V')).toEqual({ value: 0.94, unit: 'V' });
    expect(parseReading('-')).toEqual({ value: null, unit: '' });
    expect(parseReading('')).toEqual({ value: null, unit: '' });
  });
});

describe('parseLhm on a real response', () => {
  const snap = parseLhm(sample as LhmNode);

  it('reads machine and hardware tree', () => {
    expect(snap.machine).toBe('ROUSHAN-PC');
    expect(snap.sensorsById.size).toBeGreaterThan(200);
  });

  it('reads throughput in B/s (RawValue)', () => {
    const rx = snap.sensorsById.get('/gpu-nvidia/0/throughput/0')!;
    expect(rx.unit).toBe('B/s');
    expect(rx.value).toBe(102997000);
  });

  it('normalises formatted-only throughput (older LHM without Raw*) to B/s', () => {
    const node = { id: 1, Text: 'x', Children: [{ id: 2, Text: 'Throughput', Children: [
      { id: 3, Text: 'Upload Speed', Value: '383.1 KB/s', Min: '', Max: '', SensorId: '/nic/x/throughput/0', Type: 'Throughput', ImageURL: '', Children: [] },
    ], Value: '', Min: '', Max: '', ImageURL: '' }], HardwareId: '/nic/x', Value: '', Min: '', Max: '', ImageURL: '' };
    const s = parseLhm({ id: 0, Text: 'Sensor', Value: '', Min: '', Max: '', ImageURL: '', Children: [{ id: 0, Text: 'PC', Value: '', Min: '', Max: '', ImageURL: '', Children: [node as LhmNode] }] });
    expect(s.sensorsById.get('/nic/x/throughput/0')!.value).toBeCloseTo(383.1 * 1024);
  });

  it('selects CPU headline sensors', () => {
    const cpu = cpuView(hardwareOfKind(snap, 'cpu')[0]);
    expect(cpu.load?.name).toBe('CPU Total');
    expect(cpu.temp?.name).toBe('Core (Tctl/Tdie)');
    expect(cpu.power?.name).toBe('Package');
    expect(cpu.clock?.name).toBe('Cores (Average)');
    expect(cpu.coreLoads).toHaveLength(16);
    expect(cpu.coreClocks).toHaveLength(8);
  });

  it('picks the discrete GPU and skips the sensorless iGPU', () => {
    const list = gpus(snap);
    expect(list).toHaveLength(1);
    const gpu = gpuView(list[0]);
    expect(gpu.hw.name).toContain('RTX 5090');
    expect(gpu.temp?.name).toBe('GPU Core');
    expect(gpu.memTotal?.value).toBe(32607);
    expect(gpu.fans).toHaveLength(3);
  });

  it('selects memory, storage, network and board', () => {
    const mem = memoryView(snap);
    expect(mem.used?.name).toBe('Memory Used');
    expect(mem.dimmTemps.map((s) => s.name)).toEqual(['DIMM #1', 'DIMM #3']);
    expect(storageViews(snap)).toHaveLength(4);
    expect(networkViews(snap)[0].hw.name).toBe('Wi-Fi');
    const board = boardView(snap);
    expect(board.temps).toHaveLength(5);
    expect(board.fans).toHaveLength(5);
  });
});

describe('mock source', () => {
  it('produces LHM-shaped frames that drift but stay parseable', () => {
    resetMock();
    const a = parseLhm(nextMockFrame());
    for (let i = 0; i < 20; i++) nextMockFrame();
    const b = parseLhm(nextMockFrame());
    expect(b.sensorsById.size).toBe(a.sensorsById.size);
    const id = '/amdcpu/0/load/0';
    expect(b.sensorsById.get(id)!.value).not.toBe(a.sensorsById.get(id)!.value);
    for (const s of b.sensorsById.values()) {
      if (s.type === 'Load' && s.value != null) expect(s.value).toBeLessThanOrEqual(100);
    }
  });
});
