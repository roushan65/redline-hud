import { describe, expect, it } from 'vitest';
import sample from '../../mock/sample.json';
import { parseLhm } from '../parse';
import { hardwareOfKind } from '../selectors';
import type { Hardware, HardwareKind, LhmNode } from '../types';
import { detectVendor, dominantVendor } from '../vendors';

const hw = (kind: HardwareKind, name: string, id = `/${kind}/0`): Hardware => ({ id, name, kind, sensors: [], children: [] });
const vid = (h: Hardware) => detectVendor(h)?.vendor.id ?? null;

describe('detectVendor', () => {
  it('recognises the captured sample rig', () => {
    const snap = parseLhm(sample as LhmNode);
    const byName = Object.fromEntries(
      (['cpu', 'gpu', 'motherboard', 'storage'] as const).flatMap((k) => hardwareOfKind(snap, k).map((h) => [h.name, vid(h)])),
    );
    expect(byName).toMatchObject({
      'AMD Ryzen 7 9800X3D': 'amd',
      'NVIDIA GeForce RTX 5090': 'nvidia',
      'Gigabyte X870 AORUS ELITE WIFI7': 'gigabyte',
      'Corsair MP600 PRO NH': 'corsair',
      'ST5000LM000-2AN170': 'seagate',
    });
    expect(dominantVendor(hardwareOfKind(snap, 'dimm'))?.id).toBe('corsair');
  });

  it('extracts product line and model', () => {
    expect(detectVendor(hw('cpu', 'AMD Ryzen 7 9800X3D', '/amdcpu/0'))).toMatchObject({ line: 'RYZEN', model: 'Ryzen 7 9800X3D' });
    expect(detectVendor(hw('gpu', 'NVIDIA GeForce RTX 5090', '/gpu-nvidia/0'))).toMatchObject({ line: 'GEFORCE', model: 'GeForce RTX 5090' });
    expect(detectVendor(hw('cpu', 'Intel Core Ultra 9 285K', '/intelcpu/0'))).toMatchObject({ line: 'CORE ULTRA', model: 'Core Ultra 9 285K' });
    expect(detectVendor(hw('motherboard', 'ASUS ROG STRIX Z790-E GAMING WIFI'))).toMatchObject({ line: 'ROG', model: 'ROG STRIX Z790-E GAMING WIFI' });
  });

  it('maps common names and model numbers', () => {
    expect(vid(hw('gpu', 'AMD Radeon RX 7900 XTX', '/gpu-amd/0'))).toBe('amd');
    expect(vid(hw('gpu', 'Intel Arc B580', '/gpu-intel/0'))).toBe('intel');
    expect(vid(hw('motherboard', 'MSI MAG B650 TOMAHAWK WIFI (MS-7D75)'))).toBe('msi');
    expect(vid(hw('motherboard', 'ASRock X670E Taichi'))).toBe('asrock');
    expect(vid(hw('storage', 'Samsung SSD 990 PRO 2TB'))).toBe('samsung');
    expect(vid(hw('storage', 'WD_BLACK SN850X 2000GB'))).toBe('wd');
    expect(vid(hw('storage', 'CT1000P3PSSD8'))).toBe('crucial');
    expect(vid(hw('storage', 'KINGSTON SNV2S1000G'))).toBe('kingston');
    expect(vid(hw('dimm', 'G Skill Intl - F5-6000J3038F16G (#0)'))).toBe('gskill');
  });

  it('returns null for unknown hardware', () => {
    expect(detectVendor(hw('storage', 'Generic USB Flash Disk'))).toBeNull();
    expect(detectVendor(hw('motherboard', 'To Be Filled By O.E.M.'))).toBeNull();
  });
});
