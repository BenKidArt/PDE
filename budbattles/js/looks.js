// PROFILE LOOK: background picture + underbanner (a preset or your own upload),
// profile colours taken from the picture (no AI: the picture's own pixels are
// measured), and the Christmas Eve background on 24.12.
//
// Stored values: ''  = none,  'p:<name>' = preset,  'u:<path>' = own upload
// (the store turns 'u:' paths into picture addresses).

export const BG_PRESETS = [
  'pink_moon', 'green_moon', 'neon_rain_window', 'glowing_jungle', 'friends_pink_room', 'reallife_candy',
  'nerdy_clerk_420', 'blurry_downtown', 'headlights_driver_pov', 'granny_purple_dino', 'beach_ruby_agent',
  'hippie_circle_1970s', 'golden_grandpa', 'santa_christmas_eve',
];
export const BANNER_PRESETS = [
  'pink_swirl_leaf_a', 'pink_swirl_leaf_b', 'candy_pink_slime', 'plant_shadow', 'attic_lightning',
  'skeleton_still_waiting', 'tired_woman_kitchen',
  'acid_01_gold_green_liquid',
  'acid_02_gold_emerald_mandala',
  'acid_03_lime_gold_opart',
  'acid_04_green_gold_drips',
  'acid_05_lime_yellow_smoke',
  'acid_06_yellow_green_spiral',
  'acid_07_mustard_retro',
  'acid_08_yellow_marble',
  'acid_09_gold_orange_drip',
  'acid_10_yellow_coral_mandala',
  'acid_11_peach_lava',
  'acid_12_yellow_salmon_opart',
  'acid_13_yellow_pink_smoke',
  'acid_14_pastel_yellow_pink_marble',
  'acid_15_yellow_hotpink_spiral',
  'acid_16_retro_yellow_rose',
  'acid_17_gold_magenta_drip',
  'acid_18_yellow_pink_mandala',
  'acid_19_paleyellow_fuchsia_lava',
  'acid_20_gold_pink_glitter',
];
export const XMAS_BG = 'p:santa_christmas_eve';
const DIR = { bg: 'assets/profile/bg', banner: 'assets/profile/banner' };

/** Picture address for a stored value ('' if none). thumb = the small preview. */
export function lookUrl(kind, value, uploadUrl, { thumb = false } = {}) {
  if (!value) return '';
  if (value.startsWith('p:')) return `${DIR[kind]}/${value.slice(2)}${thumb ? '-s' : ''}.webp`;
  if (value.startsWith('u:')) return uploadUrl ? uploadUrl(value.slice(2)) : '';
  return '';
}

/** Is it 24 December in Germany right now? */
export function isChristmasEve(at = new Date()) {
  const md = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', month: '2-digit', day: '2-digit' }).format(at);
  return md === '12-24';
}

/** The background actually shown today: on 24.12 the Santa picture (unless switched off). */
export function effectiveBg(look, at = new Date()) {
  if (isChristmasEve(at) && look?.xmas !== false) return XMAS_BG;
  return look?.bg || '';
}

// ---------- colours from the picture ----------

const paletteCache = new Map();

/** Measures the picture: a bright "neon" colour for borders/glow, a second one, and a dark tone for the sheet. */
export function paletteFrom(url) {
  if (!url) return Promise.resolve(null);
  if (paletteCache.has(url)) return paletteCache.get(url);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      try { resolve(measure(img)); } catch { resolve(null); } // e.g. a picture from a server without CORS
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
  paletteCache.set(url, p);
  return p;
}

function measure(img) {
  const w = 48, h = 27;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const bins = Array.from({ length: 12 }, () => ({ wt: 0, r: 0, g: 0, b: 0 }));
  let ar = 0, ag = 0, ab = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    ar += r; ag += g; ab += b; n++;
    const [hue, s, v] = rgbToHsv(r, g, b);
    if (s < 0.3 || v < 0.3) continue; // only colourful, not too dark pixels count for the neon colour
    const wt = s * v * v;
    const bin = bins[Math.floor(hue * 12) % 12];
    bin.wt += wt; bin.r += r * wt; bin.g += g * wt; bin.b += b * wt;
  }
  const avg = [ar / n, ag / n, ab / n];
  const ranked = bins.filter((x) => x.wt > 0).sort((a, b) => b.wt - a.wt);
  const mean = (x) => [x.r / x.wt, x.g / x.wt, x.b / x.wt];
  const neon = (rgb, l) => { const [hh, ss] = rgbToHsl(...rgb); return hslToRgb(hh, Math.max(ss, 0.7), l); };
  let accent, accent2;
  if (ranked.length) {
    accent = neon(mean(ranked[0]), 0.62);
    accent2 = ranked[1] && ranked[1].wt > ranked[0].wt * 0.2 ? neon(mean(ranked[1]), 0.7) : neon(mean(ranked[0]), 0.8);
  } else { // black-and-white picture: calm silver
    accent = [205, 214, 222]; accent2 = [240, 244, 248];
  }
  const [dh, ds] = rgbToHsl(...avg);
  const dark = hslToRgb(dh, Math.min(ds, 0.45), 0.07);
  return { accent, accent2, dark };
}

/** Puts the picture's colours on the profile (theme colours, sheet, borders, glow). */
export function applyPalette(el, pal) {
  if (!el) return;
  const props = ['--pf-accent', '--pf-accent-2', '--pf-glow', '--pf-rgb', '--pf-dark', '--pf-sheet', '--pf-line'];
  if (!pal) { props.forEach((p) => el.style.removeProperty(p)); el.classList.remove('pf-tinted'); return; }
  const rgb = (c) => c.map((x) => Math.round(x)).join(', ');
  el.style.setProperty('--pf-accent', `rgb(${rgb(pal.accent)})`);
  el.style.setProperty('--pf-accent-2', `rgb(${rgb(pal.accent2)})`);
  el.style.setProperty('--pf-glow', `rgba(${rgb(pal.accent)}, .45)`);
  el.style.setProperty('--pf-rgb', rgb(pal.accent));
  el.style.setProperty('--pf-dark', `rgb(${rgb(pal.dark)})`);
  el.style.setProperty('--pf-sheet', `rgba(${rgb(pal.dark.map((x) => x * 1.6 + 6))}, .9)`);
  el.style.setProperty('--pf-line', `rgba(${rgb(pal.accent)}, .3)`);
  el.classList.add('pf-tinted');
}

// ---------- own uploads ----------

/** Resizes the chosen file and turns it into WebP (JPEG where the browser can't make WebP), max ~600 KB. */
export async function prepareUpload(file, kind) {
  if (!file || !/^image\//.test(file.type || 'image/')) throw Object.assign(new Error('photo'), { code: 'error.photoType' });
  let src;
  try {
    src = await (window.createImageBitmap ? createImageBitmap(file) : loadImg(URL.createObjectURL(file)));
  } catch { throw Object.assign(new Error('photo'), { code: 'error.photoRead' }); }
  const sw = src.width, sh = src.height;
  const maxW = kind === 'banner' ? 1500 : 1280, maxH = kind === 'banner' ? 600 : 1280;
  const scale = Math.min(1, maxW / sw, maxH / sh);
  const c = document.createElement('canvas');
  c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, 0, c.width, c.height); // drawing again drops all hidden data (GPS etc.)
  if (src.close) src.close();
  const enc = (type, q) => new Promise((res) => c.toBlob(res, type, q));
  let q = 0.82;
  let blob = await enc('image/webp', q);
  let type = blob?.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
  if (type === 'image/jpeg') blob = await enc(type, q);
  while (blob && blob.size > 600 * 1024 && q > 0.5) { q -= 0.08; blob = await enc(type, q); }
  if (!blob) throw Object.assign(new Error('photo'), { code: 'error.photoRead' });
  return { blob, ext: type === 'image/webp' ? 'webp' : 'jpg' };
}

function loadImg(url) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
}

// ---------- tiny colour helpers ----------
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), dd = max - min;
  let hh = 0;
  if (dd) hh = max === r ? ((g - b) / dd) % 6 : max === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
  return [((hh * 60 + 360) % 360) / 360, max ? dd / max : 0, max];
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, dd = max - min;
  if (!dd) return [0, 0, l];
  const s = dd / (1 - Math.abs(2 * l - 1));
  let hh = max === r ? ((g - b) / dd) % 6 : max === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
  return [((hh * 60 + 360) % 360) / 360, s, l];
}
function hslToRgb(hh, s, l) {
  const k = (n) => (n + hh * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
