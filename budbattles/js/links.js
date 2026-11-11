// PROFILE LINKS: GrowDiaries, YouTube, TikTok, Threads (+ Instagram).
// Only real links or handles for these sites are accepted. We store a short,
// clean form (a handle or a path) and build the full https link when showing it.
// The database checks the same patterns (update 013).

export const LINK_KINDS = ['instagram', 'growdiaries', 'youtube', 'tiktok', 'threads'];

// stored form → what the database accepts
export const LINK_PATTERNS = {
  instagram: /^[A-Za-z0-9._]{1,30}$/,
  growdiaries: /^[A-Za-z0-9][A-Za-z0-9/_.%-]{0,150}$/,
  youtube: /^(@[A-Za-z0-9._-]{3,30}|(channel|c|user)\/[A-Za-z0-9._-]{1,60})$/,
  tiktok: /^[A-Za-z0-9._]{2,24}$/,
  threads: /^[A-Za-z0-9._]{1,30}$/,
};

/** Take what someone typed, return the clean stored form, '' for empty, or null when it is not valid. */
export function normalizeLink(kind, input) {
  let v = String(input || '').trim();
  if (!v) return '';
  const url = parseUrl(v);
  if (kind === 'instagram') {
    if (url) { if (!/^(www\.)?instagram\.com$/.test(url.host)) return null; v = url.path.split('/')[0]; }
    v = v.replace(/^@/, '');
  } else if (kind === 'growdiaries') {
    if (!url || !/^(www\.)?growdiaries\.com$/.test(url.host)) return null; // a link is needed here
    v = url.path.replace(/\/+$/, '');
    if (!v) return null;
  } else if (kind === 'youtube') {
    if (url) {
      if (!/^((www|m)\.)?youtube\.com$/.test(url.host)) return null;
      const [a, b] = url.path.split('/');
      v = a.startsWith('@') ? a : b ? `${a}/${b}` : '';
    } else if (!v.startsWith('@')) v = `@${v}`;
  } else if (kind === 'tiktok') {
    if (url) { if (!/^((www|m)\.)?tiktok\.com$/.test(url.host)) return null; v = url.path.split('/')[0]; }
    v = v.replace(/^@/, '');
  } else if (kind === 'threads') {
    if (url) { if (!/^(www\.)?threads\.(net|com)$/.test(url.host)) return null; v = url.path.split('/')[0]; }
    v = v.replace(/^@/, '');
  }
  return LINK_PATTERNS[kind].test(v) ? v : null;
}

/** Full https link for a stored value. */
export function linkUrl(kind, v) {
  const e = (s) => s.split('/').map(encodeURIComponent).join('/');
  return {
    instagram: `https://instagram.com/${e(v)}`,
    growdiaries: `https://growdiaries.com/${e(v)}`,
    youtube: `https://www.youtube.com/${v.startsWith('@') ? `@${e(v.slice(1))}` : e(v)}`,
    tiktok: `https://www.tiktok.com/@${e(v)}`,
    threads: `https://www.threads.net/@${e(v)}`,
  }[kind];
}

/** What to show in the edit field: a handle with @ or the full link. */
export function linkInputValue(kind, v) {
  if (!v) return '';
  if (kind === 'growdiaries') return `growdiaries.com/${v}`;
  if (kind === 'youtube') return v.startsWith('@') ? v : `youtube.com/${v}`;
  return `@${v}`;
}

function parseUrl(v) {
  if (!/^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/|$)/i.test(v)) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return { host: u.hostname.toLowerCase(), path: decodeURIComponent(u.pathname).replace(/^\/+/, '') };
  } catch { return null; }
}

// small monochrome icons (currentColor)
export const LINK_ICONS = {
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.3" cy="6.7" r="1.2" fill="currentColor"/></svg>',
  growdiaries: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h10.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 16c0-3 .5-5.5 3-7.5-3 .3-4.5 2-5 4-1-1.4-2.3-2-4-2 1.6 1.4 2.6 3 3 5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 3.5v11.2a3.3 3.3 0 1 1-3.3-3.3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M13.5 3.5c.4 2.6 2.2 4.4 5 4.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  threads: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.8 11.2c-.3-2.6-2-3.8-4.4-3.8-2.3 0-3.7 1.3-4 3M12.3 20.5c-4.6 0-7.3-3-7.3-8.5S7.7 3.5 12.3 3.5c3.7 0 6 1.8 6.9 5.2M16.8 11.2c-3.8-.6-6.3.3-6.3 2.3 0 1.4 1.3 2.1 2.7 2 2.1-.1 3.4-1.5 3.6-4.3zm0 0c2.3.9 3.3 2.4 2.9 4.4-.6 3-3.4 4.9-7.4 4.9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
