import { useSyncExternalStore } from 'react';

export type Lang = 'bn' | 'en';
type Dict = Record<string, string>;

// One JSON file per feature per language: locales/<lang>/<feature>.json (flat "feature.key" ids)
const files = import.meta.glob('../locales/*/*.json', { eager: true, import: 'default' }) as Record<string, Dict>;
const dict: Record<Lang, Dict> = { bn: {}, en: {} };
for (const [path, d] of Object.entries(files)) {
  const lang = path.split('/').slice(-2, -1)[0] as Lang;
  Object.assign(dict[lang], d);
}

const KEY = 'lang';   // same key the 3D map uses, so the switch never disagrees between pages
const listeners = new Set<() => void>();
let current: Lang = read();

function read(): Lang {
  try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'bn'; } catch { return 'bn'; }
}
function apply() { if (typeof document !== 'undefined') document.documentElement.lang = current; }
apply();

export function setLang(l: Lang) {
  current = l;
  try { localStorage.setItem(KEY, l); } catch { /* private mode */ }
  apply();
  listeners.forEach((f) => f());
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { current = read(); apply(); listeners.forEach((f) => f()); } });
}
const subscribe = (f: () => void) => { listeners.add(f); return () => listeners.delete(f); };

export function t(key: string, vars?: Record<string, string | number>, lang: Lang = current): string {
  let s = dict[lang][key] ?? dict.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function useLang() {
  const lang = useSyncExternalStore(subscribe, () => current, () => 'bn' as Lang);
  return { lang, setLang, t: (k: string, v?: Record<string, string | number>) => t(k, v, lang) };
}

export const allKeys = dict;

// Number/unit helpers shared with the 3D map's Mapping tool
export { num, digits, breakdown, chipsFor, REGIONS, BASE, sqmToUnit } from '../../mapping/units.js';
