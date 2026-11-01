export interface Theme {
  id: string;
  name: string;
  tagline: string;
  colors: {
    bg: string; // page background
    surface: string; // panel fill (charts are validated against this)
    surfaceAlt: string; // inset / track fill
    line: string; // hairline borders, gridlines
    text: string; // primary ink
    textDim: string; // secondary ink
    textMute: string; // tertiary ink, axis ticks
    accent: string; // brand colour: frames, headings, single-series marks
    accent2: string; // secondary brand colour: highlights
    glow: string; // glow colour for neon effects
    // Chart series for two-series plots (up/down, read/write). Validated with the
    // dataviz palette checker against `surface` (dark band, CVD-separated).
    series1: string;
    series2: string;
    good: string;
    warn: string;
    crit: string;
  };
}

export const THEMES: Theme[] = [
  {
    id: 'cyberpunk',
    name: 'Cyberpunk 2077',
    tagline: 'Night City // Wake up, Samurai',
    colors: {
      bg: '#07070c',
      surface: '#0e0f17',
      surfaceAlt: '#171927',
      line: '#2a2c3d',
      text: '#f2f0e6',
      textDim: '#a9a7b8',
      textMute: '#6f6d82',
      accent: '#fcee0a',
      accent2: '#00e5f2',
      glow: '#fcee0a',
      series1: '#1ba5ae',
      series2: '#b265f9',
      good: '#2ee59d',
      warn: '#ff9f1c',
      crit: '#ff2a55',
    },
  },
  {
    id: 'arasaka',
    name: 'Arasaka',
    tagline: 'Corporate security // Red protocol',
    colors: {
      bg: '#080506',
      surface: '#120a0c',
      surfaceAlt: '#1d1114',
      line: '#3a2228',
      text: '#f5e9ea',
      textDim: '#b8a2a6',
      textMute: '#7c6468',
      accent: '#ff3b4e',
      accent2: '#d8d8d8',
      glow: '#ff3b4e',
      series1: '#518efc',
      series2: '#af8e2a',
      good: '#45d483',
      warn: '#ffb020',
      crit: '#ff5c8a',
    },
  },
  {
    id: 'netrunner',
    name: 'Netrunner',
    tagline: 'Jacked in // Blackwall proximity',
    colors: {
      bg: '#05060f',
      surface: '#0b0d1f',
      surfaceAlt: '#141833',
      line: '#262b52',
      text: '#e9ecff',
      textDim: '#a2a8d6',
      textMute: '#666d9e',
      accent: '#ff2bd6',
      accent2: '#2bd9ff',
      glow: '#ff2bd6',
      series1: '#16a3c0',
      series2: '#f415cc',
      good: '#35e8a0',
      warn: '#ffb627',
      crit: '#ff4d4d',
    },
  },
  {
    id: 'militech',
    name: 'Militech',
    tagline: 'Field ops // Tactical overlay',
    colors: {
      bg: '#060805',
      surface: '#0c100a',
      surfaceAlt: '#151c12',
      line: '#28331f',
      text: '#e6f0dc',
      textDim: '#a3b394',
      textMute: '#68785a',
      accent: '#9dff3b',
      accent2: '#ffb000',
      glow: '#9dff3b',
      series1: '#61a902',
      series2: '#c0850e',
      good: '#3be8b0',
      warn: '#ffd23b',
      crit: '#ff4a3b',
    },
  },
  {
    id: 'tyger',
    name: 'Tyger Claws',
    tagline: 'Kabuki neon // Japantown',
    colors: {
      bg: '#0a0610',
      surface: '#120b1c',
      surfaceAlt: '#1d1230',
      line: '#35234f',
      text: '#f6ecff',
      textDim: '#bba6d4',
      textMute: '#7e6a98',
      accent: '#ff7a1a',
      accent2: '#b86bff',
      glow: '#ff7a1a',
      series1: '#01a0d1',
      series2: '#b265f9',
      good: '#38e8a8',
      warn: '#ffd93b',
      crit: '#ff3d6e',
    },
  },
];

export const DEFAULT_THEME_ID = 'cyberpunk';

export type ColorOverrides = Partial<Theme['colors']>;

export function resolveTheme(id: string, overrides: ColorOverrides = {}): Theme {
  const base = THEMES.find((t) => t.id === id) ?? THEMES[0];
  return { ...base, colors: { ...base.colors, ...overrides } };
}

function kebab(k: string): string {
  return k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/** Writes theme tokens to :root as --c-* custom properties (plus an -rgb triplet for alpha mixing). */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.colors)) {
    root.style.setProperty(`--c-${kebab(k)}`, v);
    const n = Number.parseInt(v.slice(1), 16);
    root.style.setProperty(`--c-${kebab(k)}-rgb`, `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`);
  }
  root.dataset.theme = theme.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.colors.bg);
}
