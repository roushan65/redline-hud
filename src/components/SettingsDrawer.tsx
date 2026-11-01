import { useEffect, useRef, useState } from 'react';
import { useConfigFolder } from '../lib/desktop';
import { deleteLogo, uploadLogo, type Branding, type LogoShape, type SaveStatus, type Settings } from '../lib/settings';
import { THEMES, resolveTheme, type Theme } from '../lib/themes';
import { safeLogoSrc } from './BrandPanel';

interface Props {
  open: boolean;
  settings: Settings;
  status: SaveStatus;
  onChange: (patch: Partial<Settings>) => void;
  onBrand: (patch: Partial<Branding>) => void;
  onReset: () => void;
  onClose: () => void;
}

const EDITABLE: { key: keyof Theme['colors']; label: string }[] = [
  { key: 'accent', label: 'Accent' },
  { key: 'accent2', label: 'Accent 2' },
  { key: 'series1', label: 'Series 1' },
  { key: 'series2', label: 'Series 2' },
  { key: 'bg', label: 'Background' },
  { key: 'surface', label: 'Panel' },
  { key: 'text', label: 'Text' },
];

const INTERVALS = [500, 1000, 2000, 5000];
const SHAPES: { id: LogoShape; label: string }[] = [
  { id: 'hex', label: 'Hex' },
  { id: 'circle', label: 'Circle' },
  { id: 'square', label: 'Square' },
];

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

function SaveBadge({ status }: { status: SaveStatus }) {
  const folder = useConfigFolder();
  const where =
    status.target === 'disk' ? `${folder}/config.json` : status.target === 'browser' ? 'browser storage (no config server)' : 'checking…';
  const what =
    status.state === 'saving' ? 'Saving…' : status.state === 'error' ? `Save failed: ${status.error}` : status.target === 'loading' ? '' : 'Saved';
  return (
    <p className={`save save--${status.state}`} role="status">
      <i aria-hidden /> {what} <span>→ {where}</span>
    </p>
  );
}

function BrandingSection({ brand, onBrand }: { brand: Branding; onBrand: (p: Partial<Branding>) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState(brand.logo.startsWith('data:') || brand.logo.startsWith('/api/') ? '' : brand.logo);
  const fileRef = useRef<HTMLInputElement>(null);
  const isUploaded = brand.logo.startsWith('/api/logo');
  const preview = safeLogoSrc(brand.logo);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setErr(null);
    setBusy(true);
    try {
      onBrand({ logo: await uploadLogo(f) });
      setLogoUrl('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const clearLogo = async () => {
    if (isUploaded) await deleteLogo();
    onBrand({ logo: '' });
    setLogoUrl('');
  };

  return (
    <section className="drawer__sec">
      <h3>Branding (centre card)</h3>
      <label className="check">
        <input type="checkbox" checked={brand.show} onChange={(e) => onBrand({ show: e.target.checked })} />
        Show channel card
      </label>
      <div className="field">
        <label htmlFor="brand-title">Channel name</label>
        <input id="brand-title" className="input" value={brand.title} maxLength={80} onChange={(e) => onBrand({ title: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="brand-sub">Tagline</label>
        <input id="brand-sub" className="input" value={brand.subtitle} maxLength={120} onChange={(e) => onBrand({ subtitle: e.target.value })} />
      </div>
      <div className="field">
        <label>Logo</label>
        <div className="logo-pick">
          <span className={`logo-pick__preview brand__logo--${brand.logoShape}`}>{preview ? <img src={preview} alt="Current logo" /> : <em>default</em>}</span>
          <div className="logo-pick__actions">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            <button type="button" className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? 'Uploading…' : 'Upload image'}
            </button>
            {brand.logo && (
              <button type="button" className="btn btn--ghost" onClick={clearLogo}>
                Remove
              </button>
            )}
          </div>
        </div>
        <form
          className="field__row"
          onSubmit={(e) => {
            e.preventDefault();
            const v = logoUrl.trim();
            if (v && !safeLogoSrc(v)) return setErr('Use an http(s) image URL');
            setErr(null);
            onBrand({ logo: v });
          }}
        >
          <input className="input" placeholder="…or paste an image URL" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} spellCheck={false} aria-label="Logo image URL" />
          <button type="submit" className="btn btn--ghost">Use</button>
        </form>
        {err && <p className="hint hint--err">{err}</p>}
        <p className="hint">PNG, JPG, WebP, GIF or SVG up to 5 MB. Uploads are saved next to <code>config.json</code>.</p>
      </div>
      <div className="field">
        <label>Logo frame</label>
        <div className="seg">
          {SHAPES.map((s) => (
            <button key={s.id} type="button" className={brand.logoShape === s.id ? 'seg__btn seg__btn--on' : 'seg__btn'} onClick={() => onBrand({ logoShape: s.id })}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SettingsDrawer({ open, settings, status, onChange, onBrand, onReset, onClose }: Props) {
  const [url, setUrl] = useState(settings.url);
  useEffect(() => setUrl(settings.url), [settings.url]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const theme = resolveTheme(settings.themeId, settings.overrides);
  const systemReduced = useReducedMotion();

  return (
    <>
      <div className={`scrim${open ? ' scrim--open' : ''}`} onClick={onClose} aria-hidden />
      <aside className={`drawer${open ? ' drawer--open' : ''}`} aria-hidden={!open} aria-label="Settings">
        <header className="drawer__head">
          <h2>// CONFIG</h2>
          <button type="button" className="btn btn--icon" onClick={onClose} aria-label="Close settings">✕</button>
        </header>
        <div className="drawer__status">
          <SaveBadge status={status} />
        </div>

        <BrandingSection key={open ? 'open' : 'closed'} brand={settings.brand} onBrand={onBrand} />

        <section className="drawer__sec">
          <h3>Data source</h3>
          <div className="seg">
            {(['live', 'mock'] as const).map((s) => (
              <button key={s} type="button" className={settings.source === s ? 'seg__btn seg__btn--on' : 'seg__btn'} onClick={() => onChange({ source: s })}>
                {s === 'live' ? 'LibreHardwareMonitor' : 'Simulator'}
              </button>
            ))}
          </div>
          <form
            className="field"
            onSubmit={(e) => {
              e.preventDefault();
              onChange({ url: url.trim() });
            }}
          >
            <label htmlFor="lhm-url">Endpoint (data.json)</label>
            <div className="field__row">
              <input id="lhm-url" className="input" value={url} onChange={(e) => setUrl(e.target.value)} spellCheck={false} />
              <button type="submit" className="btn">Apply</button>
            </div>
            <p className="hint">
              Direct: <code>http://&lt;host&gt;:8085/data.json</code> · via dev proxy: <code>/lhm/data.json</code>
            </p>
          </form>
          <label className="check">
            <input type="checkbox" checked={settings.autoFallback} onChange={(e) => onChange({ autoFallback: e.target.checked })} />
            Fall back to simulator when the link drops
          </label>
          <div className="field">
            <label>Refresh interval</label>
            <div className="seg">
              {INTERVALS.map((ms) => (
                <button key={ms} type="button" className={settings.intervalMs === ms ? 'seg__btn seg__btn--on' : 'seg__btn'} onClick={() => onChange({ intervalMs: ms })}>
                  {ms < 1000 ? `${ms}ms` : `${ms / 1000}s`}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="drawer__sec">
          <h3>Theme</h3>
          <div className="themes">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`theme-card${settings.themeId === t.id ? ' theme-card--on' : ''}`}
                onClick={() => onChange({ themeId: t.id, overrides: {} })}
                style={{ background: t.colors.surface, borderColor: settings.themeId === t.id ? t.colors.accent : t.colors.line }}
              >
                <span className="theme-card__sw">
                  {[t.colors.accent, t.colors.accent2, t.colors.series1, t.colors.series2].map((c) => (
                    <i key={c} style={{ background: c }} />
                  ))}
                </span>
                <span className="theme-card__name" style={{ color: t.colors.text }}>{t.name}</span>
              </button>
            ))}
          </div>

          <div className="colors">
            {EDITABLE.map(({ key, label }) => (
              <label key={key} className="color">
                <input
                  type="color"
                  value={theme.colors[key]}
                  onChange={(e) => onChange({ overrides: { ...settings.overrides, [key]: e.target.value } })}
                />
                <span>{label}</span>
                <code>{theme.colors[key]}</code>
              </label>
            ))}
          </div>
          {Object.keys(settings.overrides).length > 0 && (
            <button type="button" className="btn btn--ghost" onClick={() => onChange({ overrides: {} })}>
              Reset colour overrides
            </button>
          )}
        </section>

        <section className="drawer__sec">
          <h3>Display</h3>
          <div className="field">
            <label>Temperature</label>
            <div className="seg">
              {(['C', 'F'] as const).map((u) => (
                <button key={u} type="button" className={settings.tempUnit === u ? 'seg__btn seg__btn--on' : 'seg__btn'} onClick={() => onChange({ tempUnit: u })}>
                  °{u}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Manufacturer logos</label>
            <div className="seg">
              {(
                [
                  ['brand', 'Brand colour'],
                  ['theme', 'Theme tint'],
                  ['off', 'Off'],
                ] as const
              ).map(([m, label]) => (
                <button key={m} type="button" className={settings.vendorLogos === m ? 'seg__btn seg__btn--on' : 'seg__btn'} onClick={() => onChange({ vendorLogos: m })}>
                  {label}
                </button>
              ))}
            </div>
            <p className="hint">
              Detected from the hardware names. Official logos are built in where available; drop files into <code>config/vendors/</code> (e.g. <code>gigabyte.svg</code>, <code>wd.png</code>) to add or replace one.
            </p>
          </div>
          <label className="check">
            <input type="checkbox" checked={settings.scanlines} onChange={(e) => onChange({ scanlines: e.target.checked })} />
            CRT scanlines
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.glitch} onChange={(e) => onChange({ glitch: e.target.checked })} />
            Glitch effects
          </label>
          <div className="field">
            <label>Animations</label>
            <div className="seg">
              {(
                [
                  ['system', 'Follow system'],
                  ['on', 'On'],
                  ['off', 'Off'],
                ] as const
              ).map(([m, label]) => (
                <button key={m} type="button" className={settings.motion === m ? 'seg__btn seg__btn--on' : 'seg__btn'} onClick={() => onChange({ motion: m })}>
                  {label}
                </button>
              ))}
            </div>
            <p className="hint">
              Spinning fans, glitch, pulses and panel intros.
              {systemReduced &&
                (settings.motion === 'system'
                  ? ' Your system asks apps to reduce motion, so they are paused. Choose On to play them anyway.'
                  : ' Your system asks apps to reduce motion.')}{' '}
              On Windows that comes from <em>Settings → Accessibility → Visual effects → Animation effects</em>.
            </p>
          </div>
        </section>

        <footer className="drawer__foot">
          <button type="button" className="btn btn--ghost" onClick={onReset}>Factory reset</button>
        </footer>
      </aside>
    </>
  );
}
