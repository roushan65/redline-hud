import { useEffect, useState } from 'react';
import type { LinkState } from '../hooks/useSensorFeed';
import { useFullscreen } from '../hooks/useFullscreen';

interface Props {
  machine: string;
  link: LinkState;
  latencyMs: number | null;
  error: string | null;
  themeTagline: string;
  onOpenSettings: () => void;
}

const LINK_TEXT: Record<LinkState, string> = {
  connecting: 'HANDSHAKE',
  live: 'LINK ESTABLISHED',
  mock: 'SIMULATION',
  fallback: 'LINK LOST // SIM',
  error: 'NO SIGNAL',
};

export function Header({ machine, link, latencyMs, error, themeTagline, onOpenSettings }: Props) {
  const fullscreen = useFullscreen();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="hud">
      <div className="hud__brand">
        <span className="hud__logo" aria-hidden>
          {/* tachometer: sweep, redline zone, needle pinned at the limit */}
          <svg viewBox="0 0 32 32">
            <path d="M6.1 25.9 A13 13 0 0 1 20.5 4.8" />
            <path className="hud__logo-red" d="M23.5 6.4 A13 13 0 0 1 25.9 25.9" />
            <path className="hud__logo-needle" d="M16 19 L24 11" />
            <circle cx="16" cy="19" r="2" />
          </svg>
        </span>
        <div>
          <h1 className="hud__title glitch" data-text="REDLINE//HUD">
            REDLINE<span>//</span>HUD
          </h1>
          <p className="hud__tagline">{themeTagline}</p>
        </div>
      </div>

      <div className="hud__center">
        <span className="hud__machine">{machine}</span>
        <span className="hud__clock">
          {now.toLocaleTimeString([], { hour12: false })}
          <small>{now.toLocaleDateString([], { year: 'numeric', month: 'short', day: '2-digit' }).toUpperCase()}</small>
        </span>
      </div>

      <div className="hud__right">
        <span className={`link link--${link}`} title={error ?? undefined}>
          <span className="link__dot" aria-hidden />
          <span>{LINK_TEXT[link]}</span>
          {latencyMs != null && link === 'live' && <small>{latencyMs}ms</small>}
        </span>
        {fullscreen.supported && (
          <button
            type="button"
            className="btn btn--icon"
            onClick={fullscreen.toggle}
            aria-label={fullscreen.active ? 'Exit fullscreen' : 'Enter fullscreen'}
            aria-pressed={fullscreen.active}
            title={fullscreen.active ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              {fullscreen.active ? (
                // corners pointing in
                <path d="M8 3h2v7H3V8h5V3Zm6 0h2v5h5v2h-7V3ZM3 14h7v7H8v-5H3v-2Zm11 0h7v2h-5v5h-2v-7Z" />
              ) : (
                // corners pointing out
                <path d="M3 3h7v2H5v5H3V3Zm11 0h7v7h-2V5h-5V3ZM3 14h2v5h5v2H3v-7Zm16 0h2v7h-7v-2h5v-5Z" />
              )}
            </svg>
          </button>
        )}
        <button type="button" className="btn btn--icon" onClick={onOpenSettings} aria-label="Open settings">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9 4-.1-1.3 2-1.6-2-3.4-2.4 1a8 8 0 0 0-2.2-1.3L15.9 3h-3.9l-.4 2.5a8 8 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6L7 12l.1 1.3-2 1.6 2 3.4 2.4-1a8 8 0 0 0 2.2 1.3l.4 2.5h3.9l.4-2.5a8 8 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6Z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
