import { useMemo } from 'react';
import { brandGlyph, glyphBox, luminance } from '../lib/brandIcons';
import { usePrefs } from '../lib/prefs';
import type { Vendor } from '../lib/vendors';

// Logos are drawn straight on the (always dark) panel surface; brand colours darker than this
// (black ASUS / Corsair / Apple, navy Samsung) would vanish, so they switch to the theme's text ink.
const MIN_LUMINANCE = 0.1;

// A glyph wider than this is a full wordmark (AMD, intel, SAMSUNG); narrower ones are symbols
// (NVIDIA eye, MSI dragon, Seagate swirl) and get the brand name set beside them.
const WORDMARK_ASPECT = 1.9;

const SIZES = {
  md: { h: 20, maxW: 76 },
  sm: { h: 14, maxW: 58 },
};

/**
 * Manufacturer logo. Priority: the user's file in config/vendors/<id>.* → Simple Icons glyph →
 * wordmark text. "Theme tint" mode paints any of them in the theme accent instead of brand colours.
 */
export function VendorBadge({ vendor, hwName, size = 'md' }: { vendor: Vendor | null | undefined; hwName?: string; size?: 'sm' | 'md' }) {
  const { vendorLogos, vendorFiles } = usePrefs();
  const glyph = useMemo(() => (vendor ? brandGlyph(vendor.id, hwName) : null), [vendor, hwName]);
  if (!vendor || vendorLogos === 'off') return null;

  const tint = vendorLogos === 'theme';
  const file = vendorFiles[vendor.id];
  const hex = glyph?.hex ?? vendor.color;
  const color = tint ? 'var(--c-accent)' : luminance(hex) >= MIN_LUMINANCE ? hex : 'var(--c-text)';
  const style = { '--v': color } as React.CSSProperties;
  const cls = `vbadge vbadge--${size}${tint ? ' vbadge--tint' : ''}`;
  const title = glyph?.title ?? vendor.name;

  if (file) {
    return (
      <span className={`${cls} vbadge--img`} style={style} title={vendor.name}>
        <img src={file} alt={vendor.name} draggable={false} />
      </span>
    );
  }

  if (glyph) {
    const { viewBox, aspect } = glyphBox(glyph);
    const { h, maxW } = SIZES[size];
    const height = Math.min(h, maxW / aspect);
    const label = aspect >= WORDMARK_ASPECT || glyph.label === null ? null : glyph.label ?? vendor.mark;
    return (
      <span className={`${cls} vbadge--glyph`} style={style} title={title} role="img" aria-label={title}>
        <svg viewBox={viewBox} style={{ height, width: height * aspect }} aria-hidden>
          <path d={glyph.path} />
        </svg>
        {label && <span className="vbadge__name">{label}</span>}
      </span>
    );
  }

  return (
    <span className={`${cls} vbadge--text`} style={style} title={vendor.name}>
      <span className="vbadge__mark">{vendor.mark}</span>
    </span>
  );
}

/** Oversized product-line watermark behind a hero card (RYZEN, GEFORCE, AORUS, …). */
export function VendorWatermark({ vendor, text }: { vendor: Vendor | null | undefined; text?: string }) {
  const { vendorLogos } = usePrefs();
  const label = text ?? vendor?.mark;
  if (!vendor || !label || vendorLogos === 'off') return null;
  // --n (character count) lets CSS size the word to fit the card width exactly
  const style = { '--n': label.length, ...(vendorLogos === 'theme' ? {} : { '--v': vendor.color }) } as React.CSSProperties;
  return (
    <span className="vmark" style={style} aria-hidden>
      {label}
    </span>
  );
}
