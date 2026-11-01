import { assetUrl } from '../lib/desktop';
import type { Branding } from '../lib/settings';

/** Only image-ish sources are rendered: uploaded file, same-origin path, http(s) or data:image. */
export function safeLogoSrc(logo: string): string | null {
  const v = logo.trim();
  if (!v) return null;
  if (v.startsWith('/') && !v.startsWith('//')) return assetUrl(v);
  if (/^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/i.test(v)) return v;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

/** Default emblem: play glyph inside a double hex — reads as "channel" without being a trademark. */
function Emblem() {
  return (
    <svg viewBox="0 0 100 100" className="brand__emblem" aria-hidden>
      <path className="brand__emblem-outer" d="M50 3 L91 26.5 L91 73.5 L50 97 L9 73.5 L9 26.5 Z" />
      <path className="brand__emblem-inner" d="M50 15 L80.5 32.5 L80.5 67.5 L50 85 L19.5 67.5 L19.5 32.5 Z" />
      <path className="brand__emblem-play" d="M41 34 L67 50 L41 66 Z" />
    </svg>
  );
}

/** Centre "streamer card": channel logo + name + tagline, configured in Settings → Branding. */
export function BrandPanel({ brand, machine }: { brand: Branding; machine: string }) {
  const src = safeLogoSrc(brand.logo);
  return (
    <section className="brand" aria-label="Channel">
      <span className="panel__bracket panel__bracket--tl" aria-hidden />
      <span className="panel__bracket panel__bracket--br" aria-hidden />
      <div className={`brand__logo brand__logo--${brand.logoShape}`}>
        {src ? <img src={src} alt="" referrerPolicy="no-referrer" draggable={false} /> : <Emblem />}
      </div>
      <div className="brand__text">
        {brand.title && (
          <h2 className="brand__title glitch" data-text={brand.title}>
            {brand.title}
          </h2>
        )}
        {brand.subtitle && <p className="brand__subtitle">{brand.subtitle}</p>}
        <p className="brand__rig">
          <span>RIG</span> {machine}
        </p>
      </div>
    </section>
  );
}
