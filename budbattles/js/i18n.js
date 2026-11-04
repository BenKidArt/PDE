// Translations. Every visible text comes from locales/<lang>.json.
// To add a new text: add the same key to BOTH de.json and en.json.

export const LANGS = ['de', 'en'];
const STORAGE_KEY = 'bb.lang';
let current = 'de';
let strings = {};

function detectLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGS.includes(saved)) return saved;
  } catch { /* storage blocked: fall through */ }
  const nav = (navigator.language || 'de').slice(0, 2).toLowerCase();
  return LANGS.includes(nav) ? nav : 'de';
}

export async function initI18n() {
  await setLang(detectLang(), { persist: false });
}

export async function setLang(lang, { persist = true } = {}) {
  if (!LANGS.includes(lang)) lang = 'de';
  const res = await fetch(`locales/${lang}.json`);
  strings = await res.json();
  current = lang;
  document.documentElement.lang = lang;
  if (persist) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
  }
}

export function getLang() {
  return current;
}

/** Translate a key. Placeholders like {count} are filled from `vars`. */
export function t(key, vars = {}) {
  const s = strings[key];
  if (s === undefined) {
    console.warn(`[i18n] missing key "${key}" for "${current}"`);
    return key;
  }
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** Pick the right language from a content object like { de: "...", en: "..." }. */
export function tc(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[current] ?? obj.de ?? obj.en ?? '';
}

export function formatDate(iso) {
  return new Intl.DateTimeFormat(current === 'de' ? 'de-DE' : 'en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin',
  }).format(new Date(iso));
}
