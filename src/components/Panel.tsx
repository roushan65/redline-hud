import type { ReactNode } from 'react';

interface Props {
  title: string;
  code?: string; // small glyph/code shown in the header, e.g. "SYS.01"
  subtitle?: string;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Angular HUD frame: clipped corners, header bar with code tag, corner brackets. */
export function Panel({ title, code, subtitle, right, className = '', children }: Props) {
  return (
    <section className={`panel ${className}`}>
      <span className="panel__bracket panel__bracket--tl" aria-hidden />
      <span className="panel__bracket panel__bracket--br" aria-hidden />
      <header className="panel__head">
        <div className="panel__titles">
          {code && <span className="panel__code">{code}</span>}
          <h2 className="panel__title" data-text={title}>
            {title}
          </h2>
          {subtitle && <span className="panel__subtitle" title={subtitle}>{subtitle}</span>}
        </div>
        {right && <div className="panel__right">{right}</div>}
      </header>
      <div className="panel__body">{children}</div>
    </section>
  );
}
