// ENTRY CARD: a 1080 × 1350 picture of an approved entry, for Telegram / Instagram.
// Drawn in the browser (no external service): logo, battle name, photo in a
// green + pink neon frame, pink rank pill, profile picture + name (+ Instagram) in a
// neon pill, strain in pink. Same design as the on-screen card (entrycard.js).
import { avatarUrl } from './ui.js';

export const CARD_W = 1080;
export const CARD_H = 1350;

const C = {
  bg: '#06080a',
  green: '#39ff88',
  pink: '#ff3fa4',
  text: '#e9fff2',
  muted: '#8fa699',
  dark: '#0b120e',
};
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Photos come from Supabase storage: ask for CORS so the canvas can be saved as a file.
    if (/^https?:/.test(src) && !src.startsWith(location.origin)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image failed: ${src}`));
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Neon line: a soft glow pass, then a crisp line on top. */
function neonStroke(ctx, color, width, glow) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.stroke();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.stroke();
  ctx.restore();
}

/** Shortens text with "…" until it fits. */
function fit(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
  return `${s}…`;
}

function setSpacing(ctx, px) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`;
}

/**
 * Draws the card. data: { photoUrl, displayName, strain, eyebrow, pill }
 * Returns the canvas (1080 × 1350).
 */
export async function drawEntryCard(data) {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  const [photo, logo, avatar] = await Promise.all([
    loadImage(data.photoUrl),
    loadImage('assets/logo-full.webp').catch(() => null),
    loadImage(avatarUrl(data.avatar)).catch(() => null),
  ]);

  // ---- background: near black with soft green and pink light
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  for (const [x, y, r, color] of [[80, 120, 760, 'rgba(57,255,136,.16)'], [1000, 1250, 820, 'rgba(255,63,164,.18)']]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
  }

  // ---- logo
  if (logo) {
    const lw = 470;
    const lh = lw * (logo.naturalHeight / logo.naturalWidth);
    ctx.drawImage(logo, (CARD_W - lw) / 2, 44, lw, lh);
  }

  // ---- "BATTLE #1 · FROSTIEST BUD"
  ctx.save();
  ctx.font = `800 34px ${FONT}`;
  setSpacing(ctx, 5);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.pink;
  ctx.shadowColor = C.pink;
  ctx.shadowBlur = 18;
  ctx.fillText(fit(ctx, data.eyebrow.toUpperCase(), 940), CARD_W / 2, 232);
  ctx.restore();

  // ---- photo in a double neon frame (green inside, pink outside)
  const fx = 104, fy = 282, fw = CARD_W - 2 * fx, fh = 730, fr = 40;
  ctx.save();
  roundRect(ctx, fx, fy, fw, fh, fr);
  ctx.clip();
  ctx.fillStyle = '#000';
  ctx.fillRect(fx, fy, fw, fh);
  const scale = Math.max(fw / photo.naturalWidth, fh / photo.naturalHeight); // cover
  const pw = photo.naturalWidth * scale, ph = photo.naturalHeight * scale;
  ctx.drawImage(photo, fx + (fw - pw) / 2, fy + (fh - ph) / 2, pw, ph);
  ctx.restore();
  roundRect(ctx, fx, fy, fw, fh, fr);
  neonStroke(ctx, C.green, 7, 30);
  roundRect(ctx, fx - 16, fy - 16, fw + 32, fh + 32, fr + 16);
  neonStroke(ctx, C.pink, 6, 34);

  // ---- pink rank pill (#1 …) on the photo
  if (data.pill) {
    ctx.save();
    ctx.font = `900 42px ${FONT}`;
    const tw = ctx.measureText(data.pill).width;
    const px = fx + 30, py = fy + 30, ph2 = 74, pw2 = tw + 52;
    roundRect(ctx, px, py, pw2, ph2, ph2 / 2);
    ctx.fillStyle = C.pink;
    ctx.shadowColor = C.pink;
    ctx.shadowBlur = 28;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1a0410';
    ctx.textBaseline = 'middle';
    ctx.fillText(data.pill, px + 26, py + ph2 / 2 + 2);
    ctx.restore();
  }

  // ---- profile picture + name (+ Instagram) in a neon pill button
  ctx.save();
  const insta = data.instagram ? `@${data.instagram}` : '';
  const nameSize = insta ? 44 : 50;
  ctx.font = `800 ${nameSize}px ${FONT}`;
  const name = fit(ctx, data.displayName, 620);
  const nameW = ctx.measureText(name).width;
  ctx.font = `600 30px ${FONT}`;
  const insW = insta ? ctx.measureText(fit(ctx, insta, 620)).width : 0;
  const bh = 112, iconD = 76, bw = Math.min(900, Math.max(nameW, insW) + iconD + 110);
  const bx = (CARD_W - bw) / 2, by = 1062;
  roundRect(ctx, bx, by, bw, bh, bh / 2);
  const fill = ctx.createLinearGradient(0, by, 0, by + bh);
  fill.addColorStop(0, 'rgba(57,255,136,.20)');
  fill.addColorStop(1, 'rgba(57,255,136,.06)');
  ctx.fillStyle = C.dark;
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.fill();
  neonStroke(ctx, C.green, 5, 24);
  roundRect(ctx, bx - 16, by - 16, bw + 32, bh + 32, (bh + 32) / 2);
  neonStroke(ctx, C.pink, 4, 22);
  // round profile picture (default: BB avatar)
  const cx = bx + 18 + iconD / 2, cy = by + bh / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, iconD / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.clip();
  if (avatar) ctx.drawImage(avatar, cx - iconD / 2, cy - iconD / 2, iconD, iconD);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, iconD / 2, 0, Math.PI * 2);
  neonStroke(ctx, C.green, 4, 14);
  // divider + name (+ Instagram under it)
  ctx.fillStyle = 'rgba(57,255,136,.55)';
  ctx.fillRect(bx + 18 + iconD + 20, by + 26, 3, bh - 52);
  const tx = bx + 18 + iconD + 44;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.text;
  ctx.font = `800 ${nameSize}px ${FONT}`;
  ctx.fillText(name, tx, insta ? cy - 15 : cy + 2);
  if (insta) {
    ctx.font = `600 30px ${FONT}`;
    ctx.fillStyle = C.muted;
    ctx.fillText(fit(ctx, insta, 620), tx, cy + 26);
  }
  ctx.restore();

  // ---- strain in pink
  if (data.strain) {
    ctx.save();
    ctx.font = `800 52px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.pink;
    ctx.shadowColor = C.pink;
    ctx.shadowBlur = 16;
    ctx.fillText(fit(ctx, data.strain, 900), CARD_W / 2, 1238);
    ctx.restore();
  }

  // ---- footer
  ctx.save();
  ctx.font = `600 28px ${FONT}`;
  setSpacing(ctx, 2);
  ctx.textAlign = 'center';
  ctx.fillStyle = C.muted;
  ctx.fillText(data.footer || 'budbattles.netlify.app', CARD_W / 2, 1312);
  ctx.restore();

  return canvas;
}

/** The card as a JPEG file (good quality, small enough for Telegram/Instagram). */
export async function entryCardFile(data, fileName) {
  const canvas = await drawEntryCard(data);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
  if (!blob) throw new Error('card export failed');
  return new File([blob], fileName, { type: 'image/jpeg' });
}
