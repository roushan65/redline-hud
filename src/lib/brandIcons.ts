import {
  siAcer,
  siAlienware,
  siAmd,
  siApple,
  siAsus,
  siCorsair,
  siDell,
  siHitachi,
  siHp,
  siHyperx,
  siIntel,
  siLenovo,
  siMsi,
  siNvidia,
  siNzxt,
  siQualcomm,
  siRepublicofgamers,
  siSamsung,
  siSeagate,
  siSupermicro,
  siToshiba,
  type SimpleIcon,
} from 'simple-icons';

/**
 * Official brand glyphs from Simple Icons (CC0 data; the marks remain their owners' trademarks —
 * shown here only to identify the user's own hardware). Named imports keep the bundle to these few.
 *
 * Keys are vendor ids from vendors.ts, plus sub-brands picked by hardware name (rog, alienware, hyperx).
 * Vendors missing from Simple Icons (Gigabyte, ASRock, WD, Crucial, Kingston, …) fall back to a wordmark.
 */
const ICONS: Record<string, SimpleIcon> = {
  nvidia: siNvidia,
  amd: siAmd,
  intel: siIntel,
  qualcomm: siQualcomm,
  apple: siApple,
  asus: siAsus,
  rog: siRepublicofgamers,
  msi: siMsi,
  nzxt: siNzxt,
  supermicro: siSupermicro,
  dell: siDell,
  alienware: siAlienware,
  hp: siHp,
  lenovo: siLenovo,
  acer: siAcer,
  samsung: siSamsung,
  seagate: siSeagate,
  corsair: siCorsair,
  hyperx: siHyperx,
  toshiba: siToshiba,
  hitachi: siHitachi,
};

const SUB_BRANDS: [vendor: string, match: RegExp, icon: string, label: string][] = [
  ['asus', /\brog\b|republic of gamers/i, 'rog', 'ROG'],
  ['dell', /alienware/i, 'alienware', 'ALIENWARE'],
  ['kingston', /hyperx/i, 'hyperx', 'HyperX'],
];

// Symbol-shaped glyphs that already contain the brand name, so no text label is needed beside them.
const SELF_LABELLED = new Set(['dell', 'hp']);

export interface BrandGlyph {
  key: string;
  title: string;
  path: string;
  hex: string; // '#rrggbb'
  /** text to set beside a symbol-only glyph; undefined = use the vendor's wordmark, null = none */
  label?: string | null;
}

/** Icon for a vendor, upgraded to a sub-brand glyph when the hardware name says so (ASUS ROG → ROG eye). */
export function brandGlyph(vendorId: string, hwName = ''): BrandGlyph | null {
  const sub = SUB_BRANDS.find(([v, re]) => v === vendorId && re.test(hwName));
  const key = sub ? sub[2] : vendorId;
  const icon = ICONS[key];
  if (!icon) return null;
  return { key, title: icon.title, path: icon.path, hex: `#${icon.hex}`, label: SELF_LABELLED.has(key) ? null : sub?.[3] };
}

export function hasGlyph(vendorId: string) {
  return vendorId in ICONS;
}

// Simple Icons are all drawn in a 24×24 box but wordmarks only fill a thin strip of it,
// so each glyph is cropped to its real bounds once (measured off-screen, then cached).
const boxes = new Map<string, { viewBox: string; aspect: number }>();
let probe: SVGPathElement | null = null;

export function glyphBox(g: BrandGlyph): { viewBox: string; aspect: number } {
  const hit = boxes.get(g.key);
  if (hit) return hit;
  let out = { viewBox: '0 0 24 24', aspect: 1 };
  try {
    if (!probe) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('aria-hidden', 'true');
      svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
      probe = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      svg.appendChild(probe);
      document.body.appendChild(svg);
    }
    probe.setAttribute('d', g.path);
    const b = probe.getBBox();
    if (b.width > 0 && b.height > 0) {
      const pad = 0.2;
      out = {
        viewBox: `${(b.x - pad).toFixed(2)} ${(b.y - pad).toFixed(2)} ${(b.width + 2 * pad).toFixed(2)} ${(b.height + 2 * pad).toFixed(2)}`,
        aspect: (b.width + 2 * pad) / (b.height + 2 * pad),
      };
    }
  } catch {
    /* no layout engine (tests / SSR): use the full 24×24 box */
  }
  boxes.set(g.key, out);
  return out;
}

/** WCAG relative luminance of '#rrggbb'. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
