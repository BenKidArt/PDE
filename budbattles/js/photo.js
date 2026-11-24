// Photo preparation: runs on the phone, BEFORE anything is uploaded.
//
// How GPS removal works: we decode the photo and redraw only its pixels onto
// a blank canvas, then save a brand-new JPEG. The new file contains no EXIF
// block at all, so GPS position, camera serial number, date, etc. are all gone.
// Some browsers add their own small info block to that new file: we cut every
// such block out, byte by byte, and check again before anything is uploaded.
//
// Phones are not all alike, so there are several ways in (tried in this order):
//   1. the browser decodes the photo, already shrunk while reading (huge 50–200 MP
//      photos would otherwise need hundreds of MB of memory and fail on phones)
//   2. the browser decodes it at full size / via an <img>
//   3. HEIC/HEIF (iPhone, many Samsungs) that Chrome/Android can't open:
//      our own HEIC decoder (js/vendor/heic-to-*.js, only downloaded when needed)
//   4. JPEG that no decoder could open: the metadata blocks are cut out of the
//      original file byte by byte (no decoding needed; rotation is kept)
//   5. nothing worked: the original goes to a PRIVATE folder that only admins can
//      open ({ raw: true }). The Admin page cleans it with the same steps before it
//      can be approved, so it is never public with metadata.

export const MAX_INPUT_MB = 40;
export const MAX_EDGE_PX = 2000; // longest side after resizing
export const JPEG_QUALITY = 0.85;
const TARGET_MAX_KB = 1500;  // only very detailed photos get a slightly lower quality
const MIN_QUALITY = 0.7;
const MAX_PUBLIC_BYTES = 5 * 1024 * 1024; // limit of the public photo folder
const HEIC_LIB = './vendor/heic-to-1.6.7.js';

export class PhotoError extends Error {
  constructor(code, vars = {}) {
    super(code);
    this.code = code; // matches an "error.*" translation key
    this.vars = vars;
  }
}

/**
 * Turn the user's file into a clean, resized JPEG.
 * @returns {Promise<{blob: Blob, width: number, height: number, hadGps: boolean, hadMetadata: boolean,
 *   via: 'canvas'|'heic'|'bytes'|'raw', raw?: boolean, kind: string, steps: string[]}>}
 *   raw: true → `blob` is the ORIGINAL file; upload it only to the private folder.
 */
export async function cleanPhoto(file) {
  if (!file) throw new PhotoError('error.photoRequired');
  if (file.size > MAX_INPUT_MB * 1024 * 1024) throw new PhotoError('error.photoTooBig', { max: MAX_INPUT_MB });
  const steps = [];
  let head;
  try {
    head = new Uint8Array(await file.slice(0, 512 * 1024).arrayBuffer());
  } catch (e) {
    // the phone doesn't hand over the file at all (e.g. a cloud photo that isn't downloaded)
    console.warn('photo: file not readable', e);
    throw Object.assign(new PhotoError('error.photoFallback'), { steps: [`read:${e?.name || e}`], kind: '?' });
  }
  const info = sniff(head);
  const hadMetadata = findMetadataSegments(head).some((seg) => seg !== 'icc') || info.kind === 'heic';
  const hadGps = jpegHasGps(head);
  const base = { hadGps, hadMetadata, kind: info.kind, steps };

  // 1–3: decode → canvas → new JPEG
  const source = await decodeAny(file, info, steps);
  if (source) {
    try {
      const out = await toCleanJpeg(source.img);
      return { ...base, ...out, via: source.via };
    } catch (e) {
      steps.push(`canvas:${short(e)}`);
    } finally {
      try { source.img.close?.(); } catch { /* ignore */ }
    }
  }

  // 4: JPEG without decoding: cut the metadata out of the original bytes
  if (info.kind === 'jpeg') {
    try {
      const all = new Uint8Array(await file.arrayBuffer());
      const bytes = stripJpegMetadata(all, { keepOrientation: true });
      if (jpegHasGps(bytes) || findMetadataSegments(bytes).some((s) => s !== 'icc' && s !== 'exif') || !onlyOurExif(bytes)) {
        throw new Error('metadata left');
      }
      if (bytes.length <= MAX_PUBLIC_BYTES && info.width && info.height) {
        const turned = info.orientation >= 5;
        return { ...base, blob: new Blob([bytes], { type: 'image/jpeg' }), via: 'bytes',
          width: turned ? info.height : info.width, height: turned ? info.width : info.height };
      }
      steps.push(info.width ? `bytes:too-big-${Math.round(bytes.length / 1024)}k` : 'bytes:no-size');
    } catch (e) {
      steps.push(`bytes:${short(e)}`);
    }
  }

  // 5: unknown / undecodable: upload the original privately, the Admin page cleans it
  if (info.kind === 'unknown' && !/^image\//.test(file.type || '')) {
    throw Object.assign(new PhotoError('error.photoType'), { steps, kind: info.kind });
  }
  console.warn('photo: sending the original to the private folder', steps);
  const turned = info.orientation >= 5;
  return { ...base, raw: true, via: 'raw', blob: file,
    width: (turned ? info.height : info.width) || 1, height: (turned ? info.width : info.height) || 1 };
}

/** Tries every decoder; returns { img, via } or null. Records what failed in `steps`. */
async function decodeAny(file, info, steps) {
  const scale = info.width && info.height ? Math.min(1, MAX_EDGE_PX / Math.max(info.width, info.height)) : 1;
  const hint = scale < 1 ? { resizeWidth: Math.max(1, Math.round(info.width * scale)), resizeQuality: 'high' } : null;
  const tries = [];
  if ('createImageBitmap' in window) {
    // only resizeWidth: the height follows the photo's own shape, also when it is rotated
    if (hint) tries.push(['bitmap-small', () => createImageBitmap(file, { imageOrientation: 'from-image', ...hint })]);
    tries.push(['bitmap', () => createImageBitmap(file, { imageOrientation: 'from-image' })]);
  }
  tries.push(['img', () => decodeImg(file)]);
  if (info.kind === 'heic' || info.kind === 'unknown') {
    tries.push(['heic', async () => {
      const { heicTo } = await import(HEIC_LIB);
      return heicTo({ blob: file, type: 'bitmap', options: { resizeWidth: MAX_EDGE_PX * 1.5 | 0, resizeQuality: 'high' } });
    }]);
  }
  for (const [name, run] of tries) {
    try {
      const img = await withTimeout(run(), name === 'heic' ? 90000 : 30000);
      const w = img.width || img.naturalWidth, h = img.height || img.naturalHeight;
      if (!w || !h) throw new Error('no size');
      return { img, via: name === 'heic' ? 'heic' : 'canvas' };
    } catch (e) {
      steps.push(`${name}:${short(e)}`);
    }
  }
  return null;
}

async function decodeImg(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Draws the picture on a canvas and returns a clean JPEG; smaller sizes if the phone runs out of memory. */
async function toCleanJpeg(source) {
  const sw = source.width || source.naturalWidth, sh = source.height || source.naturalHeight;
  let lastErr;
  for (const edge of [MAX_EDGE_PX, 1400, 1000]) {
    try {
      const scale = Math.min(1, edge / Math.max(sw, sh));
      const width = Math.max(1, Math.round(sw * scale));
      const height = Math.max(1, Math.round(sh * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no canvas');
      ctx.fillStyle = '#000'; // transparent PNGs get a black background
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(source, 0, 0, width, height);
      const encode = (q) => new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', q));
      let quality = JPEG_QUALITY;
      let blob = await encode(quality);
      while (blob.size > TARGET_MAX_KB * 1024 && quality > MIN_QUALITY) {
        quality = Math.max(MIN_QUALITY, quality - 0.05);
        blob = await encode(quality);
      }
      // cut out every metadata block the browser may have written (colour profile stays)
      const bytes = stripJpegMetadata(new Uint8Array(await blob.arrayBuffer()));
      if (findMetadataSegments(bytes).some((seg) => seg !== 'icc') || jpegHasGps(bytes)) throw new Error('metadata left');
      canvas.width = 1; canvas.height = 1; // free the memory right away (Safari)
      return { blob: new Blob([bytes], { type: 'image/jpeg' }), width, height, quality };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/**
 * Removes all APP1–APP15 blocks (except the ICC colour profile) and comments from a JPEG,
 * and everything after the end of the picture (Samsung/Google "motion photos" hide a
 * video with its own location data there). keepOrientation: adds back a tiny EXIF block
 * that holds ONLY the rotation, so an undecoded photo still shows the right way up.
 */
export function stripJpegMetadata(bytes, { keepOrientation = false } = {}) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('not a jpeg');
  const orientation = keepOrientation ? jpegOrientation(bytes) : 1;
  const parts = [bytes.subarray(0, 2)];
  let i = 2, placed = false;
  const addOrientation = () => {
    if (!placed && orientation > 1) parts.push(orientationExif(orientation));
    placed = true;
  };
  while (i + 4 <= bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1];
    if (marker === 0xda) break; // image data starts
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker !== 0xe0) addOrientation(); // right after the JFIF block (if any)
    const isIcc = marker === 0xe2 && ascii(bytes, i + 4, 11) === 'ICC_PROFILE';
    const drop = (marker >= 0xe1 && marker <= 0xef && !isIcc) || marker === 0xfe;
    if (!drop) parts.push(bytes.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  addOrientation();
  // image data up to and including the end marker FF D9 (inside the data, FF is always followed by 00 or D0–D7)
  let end = bytes.length;
  for (let k = i; k + 1 < bytes.length; k++) {
    if (bytes[k] === 0xff && bytes[k + 1] === 0xd9) { end = k + 2; break; }
  }
  parts.push(bytes.subarray(i, end));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** A minimal EXIF block with only the Orientation tag. */
function orientationExif(o) {
  return new Uint8Array([0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // APP1 "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // TIFF header, big-endian, IFD0 at 8
    0x00, 0x01, // one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, o & 0xff, 0x00, 0x00, // Orientation (SHORT) = o
    0x00, 0x00, 0x00, 0x00]); // no next IFD
}

/** True when the only EXIF block in the JPEG is our orientation-only block (or there is none). */
function onlyOurExif(bytes) {
  let i = 2;
  while (i + 4 <= bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker === 0xe1) {
      const ref = orientationExif(bytes[i + 29] || 1);
      if (len !== 0x22) return false;
      for (let k = 0; k < ref.length; k++) if (bytes[i + k] !== ref[k]) return false;
    }
    i += 2 + len;
  }
  return true;
}

/** Format, size and EXIF rotation from the first bytes of a file (no decoding). */
export function sniff(b) {
  const out = { kind: 'unknown', width: 0, height: 0, orientation: 1 };
  if (b[0] === 0xff && b[1] === 0xd8) {
    out.kind = 'jpeg';
    out.orientation = jpegOrientation(b);
    let i = 2;
    while (i + 9 < b.length && b[i] === 0xff) {
      const m = b[i + 1];
      const len = (b[i + 2] << 8) | b[i + 3];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        out.height = (b[i + 5] << 8) | b[i + 6];
        out.width = (b[i + 7] << 8) | b[i + 8];
        break;
      }
      if (m === 0xda) break;
      i += 2 + len;
    }
  } else if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    out.kind = 'png';
    const u32 = (o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
    out.width = u32(16); out.height = u32(20);
  } else if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    out.kind = 'webp';
  } else if (ascii(b, 0, 3) === 'GIF') {
    out.kind = 'gif';
  } else if (ascii(b, 4, 4) === 'ftyp') {
    const brands = ascii(b, 8, 4) + ascii(b, 16, 24);
    out.kind = /avif|avis/.test(ascii(b, 8, 4)) ? 'avif' : /hei|hev|mif1|msf1/.test(brands) ? 'heic' : 'unknown';
  }
  return out;
}

function jpegOrientation(bytes) {
  const v = exifIfd0(bytes, 0x0112);
  return v >= 1 && v <= 8 ? v : 1;
}

/** Reads one SHORT tag from the first EXIF block's IFD0 (null if missing). */
function exifIfd0(bytes, wanted) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 4 <= bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker === 0xe1 && ascii(bytes, i + 4, 4) === 'Exif') {
      const tiff = i + 10;
      const little = bytes[tiff] === 0x49;
      const u16 = (o) => (little ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1]);
      const u32 = (o) => (little
        ? (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0
        : ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0);
      const ifd0 = tiff + u32(tiff + 4);
      if (ifd0 + 2 > bytes.length) return null;
      const count = u16(ifd0);
      for (let e = 0; e < count; e++) {
        const entry = ifd0 + 2 + e * 12;
        if (entry + 10 > bytes.length) break;
        if (u16(entry) === wanted) return u16(entry + 8);
      }
      return null;
    }
    i += 2 + len;
  }
  return null;
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
const short = (e) => String(e?.name && e.name !== 'Error' ? `${e.name} ${e.message || ''}` : e?.message || e).slice(0, 60);

/**
 * List JPEG metadata segments: 'exif', 'xmp', 'app1', 'icc' (colour profile),
 * other 'appN' blocks, and 'comment'.
 * Returns [] for non-JPEG data.
 */
export function findMetadataSegments(bytes) {
  const found = [];
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return found;
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1];
    if (marker === 0xda || marker === 0xd9) break; // start of image data / end
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker === 0xe1) {
      const id = ascii(bytes, i + 4, 6);
      if (id.startsWith('Exif')) found.push('exif');
      else if (id.startsWith('http')) found.push('xmp');
      else found.push('app1');
    } else if (marker === 0xe2 && ascii(bytes, i + 4, 11) === 'ICC_PROFILE') {
      found.push('icc');
    } else if (marker >= 0xe2 && marker <= 0xef) {
      found.push(`app${marker - 0xe0}`);
    } else if (marker === 0xfe) {
      found.push('comment');
    }
    i += 2 + len;
  }
  return found;
}

/** True if a JPEG's EXIF block contains a GPS section. */
export function jpegHasGps(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
  let i = 2;
  while (i + 4 <= bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker === 0xe1 && ascii(bytes, i + 4, 4) === 'Exif') {
      const tiff = i + 10;
      const little = bytes[tiff] === 0x49; // "II" = little-endian
      const u16 = (o) => (little ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1]);
      const u32 = (o) => (little
        ? (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0
        : ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0);
      const ifd0 = tiff + u32(tiff + 4);
      if (ifd0 + 2 > bytes.length) return false;
      const count = u16(ifd0);
      for (let e = 0; e < count; e++) {
        const entry = ifd0 + 2 + e * 12;
        if (entry + 2 > bytes.length) break;
        if (u16(entry) === 0x8825) return true; // GPSInfo tag
      }
    }
    i += 2 + len;
  }
  return false;
}

function ascii(bytes, start, n) {
  let s = '';
  for (let k = 0; k < n && start + k < bytes.length; k++) s += String.fromCharCode(bytes[start + k]);
  return s;
}

/**
 * Turns any picture into a small badge icon: trims the empty transparent
 * border, centres it on a square and shrinks it to 128 × 128.
 * Returns { blob, ext } – WebP where the browser can, otherwise PNG.
 */
export async function makeBadgeIcon(file) {
  if (!file || !/^image\//.test(file.type)) throw new PhotoError('error.photoType');
  if (file.size > MAX_INPUT_MB * 1024 * 1024) throw new PhotoError('error.photoTooBig', { max: MAX_INPUT_MB });
  let src;
  try { src = 'createImageBitmap' in window ? await createImageBitmap(file).catch(() => decodeImg(file)) : await decodeImg(file); } catch { throw new PhotoError('error.photoRead'); }
  const w = src.width, h = src.height;
  const work = document.createElement('canvas');
  work.width = w; work.height = h;
  const wctx = work.getContext('2d', { willReadFrequently: true });
  wctx.drawImage(src, 0, 0);
  if (src.close) src.close();
  // find the visible area (alpha > 8)
  const px = wctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  if (x1 < 0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, side = Math.max(bw, bh);
  const SIZE = 128;
  const out = document.createElement('canvas');
  out.width = SIZE; out.height = SIZE;
  const octx = out.getContext('2d');
  octx.imageSmoothingQuality = 'high';
  const scale = SIZE / side;
  octx.drawImage(work, x0, y0, bw, bh, (SIZE - bw * scale) / 2, (SIZE - bh * scale) / 2, bw * scale, bh * scale);
  let blob = await new Promise((r) => out.toBlob(r, 'image/webp', 0.86));
  if (!blob || blob.type !== 'image/webp') blob = await new Promise((r) => out.toBlob(r, 'image/png'));
  if (!blob) throw new PhotoError('error.photoRead');
  return { blob, ext: blob.type === 'image/webp' ? 'webp' : 'png' };
}

