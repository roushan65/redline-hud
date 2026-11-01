import { describe, expect, it } from 'vitest';
import { brandGlyph, hasGlyph, luminance } from '../brandIcons';
import { ALL_VENDORS } from '../vendors';

describe('brandGlyph', () => {
  it('returns Simple Icons paths for covered vendors', () => {
    for (const id of ['amd', 'nvidia', 'intel', 'corsair', 'seagate', 'samsung', 'msi', 'asus']) {
      const g = brandGlyph(id);
      expect(g, id).not.toBeNull();
      expect(g!.path.length).toBeGreaterThan(20);
      expect(g!.hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('upgrades to a sub-brand glyph from the hardware name', () => {
    expect(brandGlyph('asus', 'ASUS ROG STRIX Z790-E GAMING WIFI')).toMatchObject({ key: 'rog', label: 'ROG' });
    expect(brandGlyph('asus', 'ASUS PRIME B650-PLUS')?.key).toBe('asus');
    expect(brandGlyph('kingston', 'HyperX Fury DDR4')?.key).toBe('hyperx');
    expect(brandGlyph('dell', 'Alienware Aurora R16')?.key).toBe('alienware');
  });

  it('falls back (null) for vendors Simple Icons does not carry', () => {
    expect(brandGlyph('gigabyte')).toBeNull();
    expect(brandGlyph('kingston', 'KINGSTON SNV2S1000G')).toBeNull();
    expect(brandGlyph('wd')).toBeNull();
  });

  it('only maps ids that exist in the vendor table', () => {
    const ids = new Set(ALL_VENDORS.map((v) => v.id));
    for (const id of ['amd', 'nvidia', 'intel', 'asus', 'msi', 'corsair', 'seagate', 'samsung', 'toshiba', 'hitachi']) {
      expect(ids.has(id), id).toBe(true);
      expect(hasGlyph(id), id).toBe(true);
    }
  });
});

describe('luminance', () => {
  it('matches the WCAG endpoints', () => {
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#ffffff')).toBeCloseTo(1);
    expect(luminance('#76b900')).toBeGreaterThan(0.1); // NVIDIA green stays brand-coloured
    expect(luminance('#231f20')).toBeLessThan(0.1); // Corsair near-black switches to text ink
  });
});
