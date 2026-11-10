// NEON ENTRY CARD on screen – the same design as the downloadable card (card.js):
// logo, "Battle #1 · Frostiest Bud", photo in a green + pink neon frame, pink rank
// pill, profile picture + name (+ Instagram) in a neon pill, strain in pink.
// All sizes are in "card pixels" of the 1080 × 1350 design, scaled to the screen.
import { t, tc } from './i18n.js';
import { esc, avatarUrl } from './ui.js';
import { battleLabel } from './views/battle.js';

/** Pill text: before voting the entry number (approval order), from voting on the live rank. */
export function pillFor(entry, approvedEntries, status) {
  if (status === 'voting' || status === 'ended') return entry.rank ? `#${entry.rank}` : '';
  const ordered = [...approvedEntries].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const n = ordered.findIndex((x) => x.id === entry.id) + 1;
  return n ? `${t('card.entry')} #${n}` : '';
}

export function cardEyebrow(battle) {
  return `${battleLabel(battle)} · ${tc(battle.theme)}`;
}

/** The card itself. `below` = extra markup under the card (badges, Vote button …). */
export function neonCardHtml(e, { eyebrow, pill = '', top = false, below = '', compact = false } = {}) {
  const href = e.profileKey ? `#/u/${encodeURIComponent(e.profileKey)}` : null;
  const nameTag = href ? 'a' : 'span';
  return `
    <article class="ncard ${top ? 'ncard-top' : ''} ${compact ? 'ncard-compact' : ''}" data-entry="${esc(e.id)}">
      <div class="ncard-in">
        <img class="ncard-logo" src="assets/logo-full.webp" alt="" width="640" height="189" loading="lazy">
        <p class="ncard-eyebrow">${esc(eyebrow)}</p>
        <div class="ncard-frame">
          <img class="ncard-photo" src="${esc(e.photoUrl)}" alt="${esc(e.strain || e.displayName || '')}" loading="lazy" decoding="async">
          ${pill ? `<span class="ncard-pill">${esc(pill)}</span>` : ''}
        </div>
        <${nameTag} class="ncard-name" ${href ? `href="${href}" aria-label="${esc(t('profile.open', { name: e.displayName }))}"` : ''}>
          <img class="ncard-avatar" src="${esc(avatarUrl(e.avatar))}" alt="" width="76" height="76" loading="lazy">
          <span class="ncard-name-txt"><b>${esc(e.displayName)}</b>${e.instagram ? `<small>@${esc(e.instagram)}</small>` : ''}</span>
        </${nameTag}>
        ${e.strain ? `<p class="ncard-strain">${esc(e.strain)}</p>` : ''}
        <p class="ncard-url">budbattles.netlify.app</p>
      </div>
      ${below}
    </article>`;
}
