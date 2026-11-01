import { describe, expect, it } from 'vitest';
import { resolveListen } from '../listen';

describe('resolveListen', () => {
  it('defaults to 0.0.0.0:2077', () => {
    expect(resolveListen({})).toEqual({ host: '0.0.0.0', port: 2077 });
    expect(resolveListen({ PANEL_HOST: ' ', PANEL_PORT: '' })).toEqual({ host: '0.0.0.0', port: 2077 });
  });

  it('uses PANEL_HOST and PANEL_PORT', () => {
    expect(resolveListen({ PANEL_HOST: '127.0.0.1', PANEL_PORT: '8080' })).toEqual({ host: '127.0.0.1', port: 8080 });
    expect(resolveListen({ PANEL_HOST: '::' })).toEqual({ host: '::', port: 2077 });
  });

  it('rejects ports that are not 1–65535', () => {
    for (const p of ['0', '65536', '20.77', 'abc', '-1', '2077x']) {
      expect(() => resolveListen({ PANEL_PORT: p }), p).toThrow(/PANEL_PORT/);
    }
  });
});
