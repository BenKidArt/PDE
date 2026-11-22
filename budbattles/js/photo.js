// Photo preparation: runs on the phone, BEFORE anything is uploaded.
//
// How GPS removal works: we decode the photo and redraw only its pixels onto
// a blank canvas, then save a brand-new JPEG. The new file contains no EXIF
// block at all, so GPS position, camera serial number, date, etc. are all gone.
// Afterwards we double-check the new file and refuse to continue if any
// metadata block is still found.

export const MAX_INPUT_MB = 40;
export const MAX_EDGE_PX = 2000; // longest side after resizing
export const JPEG_QUALITY = 0.85;
const TARGET_MAX_KB = 1500;  // only very detailed photos get a slightly lower quality
const MIN_QUALITY = 0.7;

export class PhotoError extends Error {
  constructor(code, vars = {}) {
    super(code);
    this.code = code; // matches an "error.*" translation key
    this.vars = vars;
  }
}

/**
 * Turn the user's file into a clean, resized JPEG.
 * The photo is redrawn on a canvas (only the pixels survive) and saved as a new JPEG.
 * Some phone browsers add their own small info block to that new file – it never holds
 * GPS (the canvas has none), but we cut every such block out anyway, byte by byte.
 * Any failure → 'error.photoFallback' ("send your photo by DM").
 * @returns {Promise<{blob: Blob, width: number, height: number, hadGps: boolean, hadMetadata: boolean}>}
 */
export async function cleanPhoto(file) {
  if (!file) throw new PhotoError('error.photoRequired');
  if (file.size > MAX_INPUT_MB * 1024 * 1024) throw new PhotoError('error.photoTooBig', { max: MAX_INPUT_MB });
  try {
    return await cleanPhotoInner(file);
  } catch (e) {
    console.warn('photo cleaning failed', e);
    throw new PhotoError('error.photoFallback');
  }
}

async function cleanPhotoInner(file) {
  let hadMetadata = false, hadGps = false;
  try {
    const head = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
    hadMetadata = findMetadataSegments(head).some((seg) => seg !== 'icc');
    hadGps = jpegHasGps(head);
  } catch { /* only used for the info note */ }

  const source = await decode(file);
  const sw = source.width || source.naturalWidth, sh = source.height || source.naturalHeight;
  if (!sw || !sh) throw new Error('no size');
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000'; // transparent PNGs get a black background
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  if (source.close) source.close();

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
  return { blob: new Blob([bytes], { type: 'image/jpeg' }), width, height, hadGps, hadMetadata, quality };
}

/** Removes all APP1–APP15 (except the ICC colour profile) and comment blocks from a JPEG. */
export function stripJpegMetadata(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('not a jpeg');
  const parts = [bytes.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1];
    if (marker === 0xda) break; // image data starts: keep the rest as is
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    const isIcc = marker === 0xe2 && ascii(bytes, i + 4, 11) === 'ICC_PROFILE';
    const drop = (marker >= 0xe1 && marker <= 0xef && !isIcc) || marker === 0xfe;
    if (!drop) parts.push(bytes.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  parts.push(bytes.subarray(i));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function decode(file) {
  // 'from-image' applies the EXIF rotation so photos aren't sideways.
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch { /* fall back below (e.g. older Safari) */ }
  }
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
  try { src = await decode(file); } catch { throw new PhotoError('error.photoRead'); }
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

