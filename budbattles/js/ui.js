// Small helpers shared by the screens.

/** Escape user/content text before putting it into HTML (prevents injection). */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Split milliseconds into days/hours/minutes/seconds. */
export function splitDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/**
 * Small badge icons for next to a name. Tapping one shows its name (see app.js).
 * ids: badge ids the person has; catalog: getBadgeCatalog(); name: (badge) => text
 */
export function badgeIcons(ids, catalog, name, size = 'small') {
  const list = (ids || []).map((id) => catalog.find((b) => b.id === id)).filter(Boolean).sort((a, b) => a.sort - b.sort);
  if (!list.length) return '';
  return `<span class="badges badges-${size}">${list.map((b) => `
    <button type="button" class="badge-btn" data-badge-name="${esc(name(b))}" aria-label="${esc(name(b))}">
      <img src="${esc(b.image)}" alt="" width="48" height="48" loading="lazy" decoding="async">
    </button>`).join('')}</span>`;
}
