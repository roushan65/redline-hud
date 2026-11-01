import { describe, expect, it } from 'vitest';
import { safeLogoSrc } from '../../components/BrandPanel';
import { DEFAULT_BRANDING, DEFAULT_SETTINGS, normaliseSettings } from '../settings';

describe('normaliseSettings', () => {
  it('returns defaults for garbage', () => {
    expect(normaliseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normaliseSettings([1, 2])).toEqual(DEFAULT_SETTINGS);
    expect(normaliseSettings('x')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values and drops invalid ones field by field', () => {
    const s = normaliseSettings({
      source: 'mock',
      intervalMs: 5,
      tempUnit: 'K',
      overrides: { accent: '#ff00aa', bg: 'red', text: '#fff' },
      glitch: 'yes',
      brand: { title: 'NEON RIGS', logoShape: 'star', show: false },
    });
    expect(s.source).toBe('mock');
    expect(s.intervalMs).toBe(250); // clamped
    expect(s.tempUnit).toBe('C');
    expect(s.overrides).toEqual({ accent: '#ff00aa' });
    expect(s.glitch).toBe(DEFAULT_SETTINGS.glitch);
    expect(s.brand).toEqual({ ...DEFAULT_BRANDING, title: 'NEON RIGS', show: false });
  });

  it('defaults animations to follow the system and accepts on/off', () => {
    expect(normaliseSettings({}).motion).toBe('system');
    expect(normaliseSettings({ motion: 'on' }).motion).toBe('on');
    expect(normaliseSettings({ motion: 'off' }).motion).toBe('off');
    expect(normaliseSettings({ motion: true }).motion).toBe('system');
  });

  it('caps branding text length', () => {
    const s = normaliseSettings({ brand: { title: 'x'.repeat(500), subtitle: 'y'.repeat(500) } });
    expect(s.brand.title).toHaveLength(80);
    expect(s.brand.subtitle).toHaveLength(120);
  });
});

describe('safeLogoSrc', () => {
  it('accepts uploaded, http(s) and data:image sources', () => {
    expect(safeLogoSrc('/api/logo?v=1')).toBe('/api/logo?v=1');
    expect(safeLogoSrc('https://yt3.example.com/a.png')).toBe('https://yt3.example.com/a.png');
    expect(safeLogoSrc('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
  });

  it('rejects script and protocol-relative sources', () => {
    expect(safeLogoSrc('javascript:alert(1)')).toBeNull();
    expect(safeLogoSrc('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
    expect(safeLogoSrc('//evil.example.com/x.png')).toBeNull();
    expect(safeLogoSrc('')).toBeNull();
  });
});
