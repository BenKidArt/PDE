// NEON ENTRY CARD on screen – compact: the photo itself is the card (shown in full),
// with the grower and strain on a dark strip at its bottom. The downloadable image
// (card.js) has the full poster layout with logo, battle name and web address.
import { t, tc } from './i18n.js';
import { esc, avatarUrl } from './ui.js';
import { battleLabel } from './views/battle.js';
import { LINK_ICONS, linkUrl, normalizeLink } from './links.js';

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

/**
 * The card on screen: the photo in full (never cropped, the card takes the photo's own
 * shape) in one thin neon frame, rank pill in the top corner, and the grower + strain on
 * a see-through dark strip at the bottom of the photo. The downloadable image (card.js)
 * keeps logo, battle name, @handle and web address. `below` = extra markup under the card.
 * `eyebrow` is kept for the call sites but not shown on screen any more.
 */
export function neonCardHtml(e, { pill = '', top = false, below = '', compact = false } = {}) {
  const href = e.profileKey ? `#/u/${encodeURIComponent(e.profileKey)}` : null;
  const nameTag = href ? 'a' : 'span';
  const w = Number(e.width) > 0 ? Number(e.width) : 0;
  const h = Number(e.height) > 0 ? Number(e.height) : 0;
  const ratio = w && h ? ` style="aspect-ratio: ${w} / ${h}"` : '';
  const insta = e.instagram ? normalizeLink('instagram', e.instagram) : null;
  return `
    <article class="ncard ${top ? 'ncard-top' : ''} ${compact ? 'ncard-compact' : ''}" data-entry="${esc(e.id)}">
      <div class="ncard-in">
        <img class="ncard-photo" src="${esc(e.photoUrl)}" alt="${esc(e.strain || e.displayName || '')}" loading="lazy" decoding="async"
          ${w && h ? `width="${w}" height="${h}"` : ''}${ratio}>
        ${pill ? `<span class="ncard-pill">${esc(pill)}</span>` : ''}
        <div class="ncard-strip">
          <div class="ncard-who">
            <${nameTag} class="ncard-name" ${href ? `href="${href}" aria-label="${esc(t('profile.open', { name: e.displayName }))}"` : ''}>
              <img class="ncard-avatar" src="${esc(avatarUrl(e.avatar))}" alt="" width="28" height="28" loading="lazy">
              <b class="ncard-name-txt">${esc(e.displayName)}</b>
            </${nameTag}>
            ${insta ? `<a class="ncard-insta" href="${esc(linkUrl('instagram', insta))}" target="_blank" rel="noopener noreferrer nofollow"
              aria-label="${esc(`${t('links.instagram')}: @${insta}`)}" title="@${esc(insta)}">${LINK_ICONS.instagram}</a>` : ''}
          </div>
          ${e.strain ? `<p class="ncard-strain">${esc(e.strain)}</p>` : ''}
        </div>
      </div>
      ${below}
    </article>`;
}
