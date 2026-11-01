import type { Sensor } from '../lib/types';

interface Props {
  fan: Sensor;
  duty?: Sensor;
  maxRpm?: number;
}

/** Spinning fan glyph whose speed tracks RPM, with duty % beneath. */
export function FanDial({ fan, duty, maxRpm = 3000 }: Props) {
  const rpm = fan.value ?? 0;
  const stopped = rpm < 1;
  // 0.4s/rev at max, ~4s at idle; purely visual.
  const period = stopped ? 0 : Math.max(0.35, 4 - (rpm / maxRpm) * 3.6);
  return (
    <div className={`fan${stopped ? ' fan--off' : ''}`}>
      <svg viewBox="0 0 40 40" className="fan__rotor" style={{ animationDuration: `${period}s` }} aria-hidden>
        <circle cx="20" cy="20" r="18" className="fan__housing" />
        {[0, 72, 144, 216, 288].map((a) => (
          <path key={a} d="M20 20 C 22 12, 30 9, 32 13 C 30 17, 25 19, 20 20 Z" transform={`rotate(${a} 20 20)`} className="fan__blade" />
        ))}
        <circle cx="20" cy="20" r="3.5" className="fan__hub" />
      </svg>
      <div className="fan__text">
        <span className="fan__name" title={fan.name}>{fan.name}</span>
        <span className="fan__rpm">
          {stopped ? 'OFF' : rpm.toFixed(0)}
          {!stopped && <small>RPM</small>}
        </span>
        {duty?.value != null && <span className="fan__duty">PWM {duty.value.toFixed(0)}%</span>}
      </div>
    </div>
  );
}
