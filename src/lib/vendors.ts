import type { Hardware } from './types';

/**
 * Manufacturer detection from LHM hardware names / ids.
 *
 * LHM only reports what the OS / SMBIOS / drive firmware says, e.g. "NVIDIA GeForce RTX 5090",
 * "Gigabyte X870 AORUS ELITE WIFI7", "ST5000LM000-2AN170" (a Seagate model number), so each vendor
 * has a set of name / model-number patterns. Order matters: first match wins.
 */
export interface Vendor {
  id: string; // file-name safe; also the key for custom logos in config/vendors/<id>.svg
  name: string; // full name for tooltips / alt text
  mark: string; // wordmark as the brand writes it
  color: string; // primary brand colour
}

/** Product line shown as the watermark on hero cards (RYZEN, GEFORCE, AORUS, …). */
export interface VendorInfo {
  vendor: Vendor;
  line?: string;
  /** Hardware name with the vendor prefix removed ("NVIDIA GeForce RTX 5090" → "GeForce RTX 5090"). */
  model: string;
}

type Rule = Vendor & { match: RegExp; strip?: RegExp };

const V = (id: string, name: string, mark: string, color: string, match: RegExp, extra: Partial<Rule> = {}): Rule => ({
  id,
  name,
  mark,
  color,
  match,
  ...extra,
});

// Silicon vendors (CPU / GPU). Hardware ids like /amdcpu/0, /gpu-nvidia/0 are checked first.
const SILICON: Rule[] = [
  V('nvidia', 'NVIDIA', 'NVIDIA', '#76b900', /nvidia|geforce|quadro|\btitan\b|\b[gr]tx\s?\d/i, { strip: /^nvidia\s+/i }),
  V('amd', 'AMD', 'AMD', '#ed1c24', /\bamd\b|ryzen|radeon|epyc|threadripper|athlon/i, { strip: /^amd\s+/i }),
  V('intel', 'Intel', 'intel', '#0071c5', /intel|core\s?(ultra|i[3579])|xeon|pentium|celeron|\barc\s?[ab]\d/i, { strip: /^intel(\(r\))?\s+/i }),
  V('qualcomm', 'Qualcomm', 'Qualcomm', '#3253dc', /qualcomm|snapdragon|adreno/i, { strip: /^qualcomm\s+/i }),
  V('apple', 'Apple', 'Apple', '#a2aaad', /apple\s?m\d/i, { strip: /^apple\s+/i }),
];

const BOARD: Rule[] = [
  V('asus', 'ASUSTeK', 'ASUS', '#00539b', /asus|\brog\b|\btuf\b|\bprime\b|proart/i, { strip: /^asus(tek)?(\s+computer\s+inc\.?)?\s+/i }),
  V('msi', 'Micro-Star International', 'msi', '#ff0000', /\bmsi\b|micro-star|\bm[aep]g\s/i, { strip: /^(msi|micro-star international co\.?,?\s*ltd\.?)\s+/i }),
  V('gigabyte', 'Gigabyte', 'GIGABYTE', '#ff6a00', /gigabyte|aorus/i, { strip: /^gigabyte(\s+technology\s+co\.?,?\s*ltd\.?)?\s+/i }),
  V('asrock', 'ASRock', 'ASRock', '#00a0e9', /asrock|taichi|steel legend|phantom gaming/i, { strip: /^asrock\s+/i }),
  V('biostar', 'Biostar', 'BIOSTAR', '#e60012', /biostar/i, { strip: /^biostar\s+/i }),
  V('evga', 'EVGA', 'EVGA', '#e3001b', /\bevga\b/i, { strip: /^evga\s+/i }),
  V('nzxt', 'NZXT', 'NZXT', '#8f3cff', /\bnzxt\b/i, { strip: /^nzxt\s+/i }),
  V('supermicro', 'Supermicro', 'SUPERMICRO', '#2a8a3e', /supermicro/i, { strip: /^supermicro\s+/i }),
  V('dell', 'Dell', 'DELL', '#007db8', /\bdell\b|alienware/i, { strip: /^dell(\s+inc\.?)?\s+/i }),
  V('hp', 'HP', 'hp', '#0096d6', /\bhp\b|hewlett|omen\b/i, { strip: /^(hp|hewlett-packard)\s+/i }),
  V('lenovo', 'Lenovo', 'Lenovo', '#e2231a', /lenovo|legion|thinkpad/i, { strip: /^lenovo\s+/i }),
  V('acer', 'Acer', 'acer', '#83b81a', /\bacer\b|predator/i, { strip: /^acer\s+/i }),
];

// Drives and DIMMs: brand names plus well-known model-number prefixes.
const STORAGE: Rule[] = [
  V('samsung', 'Samsung', 'SAMSUNG', '#1428a0', /samsung|^mz-|^m[34]\d{2}[a-z]|\b9[789]0 (pro|evo)\b|\b8[67]0 (evo|qvo)\b/i, { strip: /^samsung\s+(ssd\s+)?/i }),
  V('wd', 'Western Digital', 'WD', '#005195', /western digital|^wdc|^wd[s_ ]|wd_?black|wd (blue|red|green|purple)/i, { strip: /^(wdc|western digital)\s+/i }),
  V('seagate', 'Seagate', 'SEAGATE', '#6ebe49', /seagate|^st\d{3,}|firecuda|barracuda|ironwolf/i, { strip: /^seagate\s+/i }),
  V('crucial', 'Crucial', 'Crucial', '#0079c1', /crucial|^ct\d{2,}/i, { strip: /^crucial\s+/i }),
  V('micron', 'Micron', 'Micron', '#0079c1', /micron|^mt[a-z]?\d/i, { strip: /^micron\s+/i }),
  V('kingston', 'Kingston', 'Kingston', '#e1251b', /kingston|hyperx|^s[ak]\d{3,}|^sa400|^skc|^snv|^sfyr|^kf\d|^khx|\bfury\b/i, { strip: /^kingston\s+/i }),
  V('corsair', 'Corsair', 'CORSAIR', '#f5d500', /corsair|^cm[a-z]\d|^cmh|^cmk|^cmt|^cmw/i, { strip: /^corsair(\s+-)?\s+/i }),
  V('gskill', 'G.Skill', 'G.SKILL', '#d2232a', /g\.?\s?skill|^f[45]-\d/i, { strip: /^g\.?\s?skill(\s+-)?\s+/i }),
  V('skhynix', 'SK hynix', 'SK hynix', '#f37321', /hynix|^hf[ms]|^hm[act]|platinum p41/i, { strip: /^sk\s?hynix(\s+-)?\s+/i }),
  V('toshiba', 'Toshiba', 'TOSHIBA', '#e60012', /toshiba|^dt01|^mg0\d|^mq0\d|^hdw[a-z]/i, { strip: /^toshiba\s+/i }),
  V('kioxia', 'Kioxia', 'KIOXIA', '#ff6400', /kioxia|^kxg|^kbg|exceria/i, { strip: /^kioxia\s+/i }),
  V('sandisk', 'SanDisk', 'SanDisk', '#e31837', /sandisk/i, { strip: /^sandisk\s+/i }),
  V('solidigm', 'Solidigm', 'solidigm', '#00b2a9', /solidigm|^ssdp[ef]/i, { strip: /^solidigm\s+/i }),
  V('sabrent', 'Sabrent', 'SABRENT', '#0f75bc', /sabrent|rocket/i, { strip: /^sabrent\s+/i }),
  V('adata', 'ADATA', 'ADATA', '#e60012', /adata|\bxpg\b/i, { strip: /^adata\s+/i }),
  V('teamgroup', 'TeamGroup', 'TEAMGROUP', '#e60012', /team\s?group|t-?force|^tm8f/i, { strip: /^team(group)?(\s+-)?\s+/i }),
  V('lexar', 'Lexar', 'Lexar', '#00a0e0', /lexar/i, { strip: /^lexar\s+/i }),
  V('pny', 'PNY', 'PNY', '#ffc20e', /\bpny\b/i, { strip: /^pny\s+/i }),
  V('patriot', 'Patriot', 'PATRIOT', '#c8102e', /patriot|viper/i, { strip: /^patriot(\s+-)?\s+/i }),
  V('hitachi', 'Hitachi', 'HITACHI', '#e60027', /hitachi|^hds\d/i, { strip: /^hitachi\s+/i }),
  V('hgst', 'HGST', 'HGST', '#5a6b7b', /hgst|^hus|^hua/i, { strip: /^hgst\s+/i }),
  V('gigabyte', 'Gigabyte', 'GIGABYTE', '#ff6a00', /gigabyte|aorus/i, { strip: /^gigabyte\s+/i }),
  V('intel', 'Intel', 'intel', '#0071c5', /^intel|optane/i, { strip: /^intel\s+/i }),
];

const BY_ID: Record<string, string> = { amdcpu: 'amd', intelcpu: 'intel', 'gpu-nvidia': 'nvidia', 'gpu-amd': 'amd', 'gpu-intel': 'intel' };

const LINES: [RegExp, string][] = [
  [/threadripper/i, 'THREADRIPPER'],
  [/ryzen/i, 'RYZEN'],
  [/epyc/i, 'EPYC'],
  [/radeon/i, 'RADEON'],
  [/core\s?ultra/i, 'CORE ULTRA'],
  [/\bcore\b/i, 'CORE'],
  [/xeon/i, 'XEON'],
  [/\barc\b/i, 'ARC'],
  [/geforce/i, 'GEFORCE'],
  [/quadro|rtx\s?a\d/i, 'RTX PRO'],
  [/\brog\b/i, 'ROG'],
  [/\btuf\b/i, 'TUF GAMING'],
  [/proart/i, 'PROART'],
  [/\bprime\b/i, 'PRIME'],
  [/\bmeg\b/i, 'MEG'],
  [/\bmpg\b/i, 'MPG'],
  [/\bmag\b/i, 'MAG'],
  [/aorus/i, 'AORUS'],
  [/taichi/i, 'TAICHI'],
  [/steel legend/i, 'STEEL LEGEND'],
  [/phantom gaming/i, 'PHANTOM GAMING'],
];

/** Every vendor the detector can return (deduplicated by id). */
export const ALL_VENDORS: Vendor[] = [...new Map([...SILICON, ...BOARD, ...STORAGE].map((r) => [r.id, toVendor(r)])).values()];

function toVendor({ match: _m, strip: _s, ...v }: Rule): Vendor {
  return v;
}

function firstRule(rules: Rule[], text: string) {
  return rules.find((r) => r.match.test(text));
}

/** Which rule table applies to a piece of hardware. */
function rulesFor(hw: Hardware): Rule[] {
  switch (hw.kind) {
    case 'cpu':
    case 'gpu':
      return SILICON;
    case 'motherboard':
      return BOARD;
    case 'storage':
    case 'dimm':
      return STORAGE;
    default:
      return [...SILICON, ...BOARD, ...STORAGE];
  }
}

export function detectVendor(hw: Hardware): VendorInfo | null {
  const rules = rulesFor(hw);
  const idKey = hw.id.split('/')[1] ?? '';
  const rule = (BY_ID[idKey] && rules.find((r) => r.id === BY_ID[idKey])) || firstRule(rules, hw.name);
  if (!rule) return null;
  const model = (rule.strip ? hw.name.replace(rule.strip, '') : hw.name).replace(/\(r\)|\(tm\)|®|™/gi, '').trim() || hw.name;
  const line = hw.kind === 'cpu' || hw.kind === 'gpu' || hw.kind === 'motherboard' ? LINES.find(([re]) => re.test(hw.name))?.[1] : undefined;
  return { vendor: toVendor(rule), line, model };
}

/** Most common vendor across several sticks / drives (e.g. the DIMMs for the memory card). */
export function dominantVendor(list: Hardware[]): Vendor | null {
  const counts = new Map<string, { v: Vendor; n: number }>();
  for (const hw of list) {
    const v = detectVendor(hw)?.vendor;
    if (!v) continue;
    const c = counts.get(v.id) ?? { v, n: 0 };
    c.n++;
    counts.set(v.id, c);
  }
  let best: { v: Vendor; n: number } | null = null;
  for (const c of counts.values()) if (!best || c.n > best.n) best = c;
  return best?.v ?? null;
}
