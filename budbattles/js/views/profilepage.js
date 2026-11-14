// BIG PROFILE PAGE – your own (#/profile) and everyone else's (#/u/<name>).
// The look follows the chosen grow setup; the artwork sits in its own strip at
// the top, so it never overlaps text. Email is never shown to others.
import { t, tc, getLang } from '../i18n.js';
import {
  getPublicProfile, getBadgeCatalog, getCurrentUser, signOut, setProfileName, updateProfileDetails,
  getProfileLook, saveProfileLook, uploadProfileImage, profileImageUrl, submitProfileImage, getMyImageReviews, ackImageReview,
} from '../store.js';
import { FLAVOURS, FLAVOUR_GROUPS } from '../flavours.js';
import { BG_PRESETS, BANNER_PRESETS, BG_FOCUS, lookUrl, effectiveBg, paletteFrom, applyPalette, prepareUpload } from '../looks.js';
import { esc, chipHtml, avatarUrl } from '../ui.js';
import { neonCardHtml } from '../entrycard.js';
import { reportButtonHtml, bindReportButtons } from '../report.js';
import { battleLabel } from './battle.js';
import { showWelcome } from '../welcome.js';
import { LINK_KINDS, LINK_ICONS, normalizeLink, linkUrl, linkInputValue } from '../links.js';
import { MAX_SETUPS, setupsOf, mainSetup, setupName, legacyFields } from '../setups.js';

export const SETUPS = [
  { id: 'zelt', icon: '⛺' },
  { id: 'raum', icon: '💡' },
  { id: 'outdoor', icon: '☀️' },
  { id: 'gewaechshaus', icon: '🌿' },
  { id: 'balkon', icon: '🌆' },
  { id: 'growbox', icon: '🗄️' },
];
// The profile options (all optional). multi = several can be chosen.
export const OPTIONS = {
  experience: { values: ['beginner', 'grows_1_3', 'veteran'] },
  growStyle: { values: ['organic', 'mineral', 'living_soil', 'hybrid'], multi: true },
  seedType: { values: ['auto', 'photo', 'both'] },
  training: { values: ['lst', 'scrog', 'topping', 'defoliation', 'none'], multi: true },
  spaceSize: { values: ['60', '80', '100', '120', 'custom'] },
  growStage: { values: ['seedling', 'veg', 'flower', 'drying', 'curing', 'pause'] },
  flavours: { values: FLAVOURS, multi: true, groups: FLAVOUR_GROUPS },
};
export const ACCENTS = ['green', 'pink', 'gold', 'cyan', 'purple', 'orange'];
const MEDIA = ['erde', 'coco', 'hydro', 'andere'];
const BIO_MAX = 150;
const NAME_CHANGE_DAYS = 30;

const optLabel = (group, value) => t(`opt.${group}.${value}`);

/** "240×120 cm, 150–180 cm hoch" for a custom space; preset label otherwise. */
export function spaceLabel(p) {
  if (p.spaceSize !== 'custom') return p.spaceSize ? optLabel('spaceSize', p.spaceSize) : '';
  if (!p.spaceW || !p.spaceD) return optLabel('spaceSize', 'custom');
  const lo = p.spaceHMin || p.spaceHMax;
  const hi = p.spaceHMax && p.spaceHMax !== lo ? p.spaceHMax : null;
  const h = lo ? (hi ? `${lo}–${hi}` : `${lo}`) : '';
  return h ? t('space.showH', { w: p.spaceW, d: p.spaceD, h }) : t('space.show', { w: p.spaceW, d: p.spaceD });
}

export async function renderProfilePage(root, key, { onLogout } = {}) {
  const [p, catalog, me, look] = await Promise.all([
    getPublicProfile(key), getBadgeCatalog(), getCurrentUser(), getProfileLook(key).catch(() => ({ bg: '', banner: '', xmas: true })),
  ]);
  if (!p) {
    root.innerHTML = `<section class="card"><p>${esc(t('profile.notFound'))}</p><a class="btn btn-ghost" href="#/">${esc(t('app.backHome'))}</a></section>`;
    return;
  }
  const isMe = p.isMe || (me && me.id === p.id);
  const reviews = isMe ? await getMyImageReviews().catch(() => []) : []; // own uploaded pictures waiting / rejected
  const setupList = setupsOf(p);
  const main = mainSetup(setupList);
  const setup = SETUPS.find((s) => s.id === main?.type);
  const badges = p.badges.map((id) => catalog.find((b) => b.id === id)).filter(Boolean).sort((a, b) => a.sort - b.sort);
  const loc = getLang() === 'de' ? 'de-DE' : 'en-GB';
  const since = p.memberSince ? new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(new Date(p.memberSince)) : null;
  // short form for narrow screens: "Seit Nov 2026" / "Since Nov 2026"
  const sinceShort = p.memberSince ? new Intl.DateTimeFormat(loc, { month: 'short', year: 'numeric' }).format(new Date(p.memberSince)).replace('.', '') : null;
  const best = p.stats.best_place ? `#${p.stats.best_place}` : '–';

  // filled options as chips (empty ones are hidden)
  const chipRows = [
    ['experience', p.experience], ['growStyle', p.growStyle], ['flavours', p.flavours],
  ].filter(([, v]) => (Array.isArray(v) ? v.length : v));

  root.innerHTML = `
    <div class="${pfClass(setup?.id)}">
      <div class="pf-cover" data-cover aria-hidden="true"></div>
      <section class="pf-head">
        <div class="pf-art" aria-hidden="true"></div>
        <div class="pf-avatar pf-accent-${esc(p.accent || 'theme')}">
          <img src="${esc(avatarUrl(p.avatar))}" alt="" width="128" height="128">
          ${isMe && !p.avatar ? `<span class="pf-soon">${esc(t('profile.avatarSoon'))}</span>` : ''}
        </div>
        <h1 class="pf-name">${esc(p.displayName)}</h1>
        ${p.growStage ? `<span class="pf-stage">${chipHtml(optLabel('growStage', p.growStage), '●')}</span>` : ''}
        ${linksHtml(p)}
        <div class="pf-tags">
          ${since || setup ? `<span class="pf-since-row" data-since-row>
            ${since ? `<span class="pf-since" data-long="${esc(t('profile.memberSince', { date: since }))}" data-short="${esc(t('profile.sinceShort', { date: sinceShort }))}">${esc(t('profile.memberSince', { date: since }))}</span>` : ''}
            ${setup ? chipHtml(t(`setupShort.${setup.id}`), setup.icon) : ''}
          </span>` : ''}
          ${p.badges.includes('badge_heart') ? chipHtml(t('profile.founder'), '♥') : ''}
          ${setupList.length > 1 ? chipHtml(t('setups.more', { n: setupList.length - 1 })) : ''}
        </div>
        ${me && !isMe ? `<div class="pf-report">${reportButtonHtml({ userId: p.id })}</div>` : ''}
      </section>
      <div class="pf-banner" data-banner aria-hidden="true" hidden></div>
      ${reviewNotesHtml(reviews)}

      <section class="pf-stats">
        <div class="pf-stat"><b>${p.stats.battles ?? 0}</b><span>${esc(t('profile.statBattles'))}</span></div>
        <div class="pf-stat"><b>${esc(best)}</b><span>${esc(t('profile.statBest'))}</span></div>
        <div class="pf-stat"><b>${p.stats.votes_given ?? 0}</b><span>${esc(t('profile.statVotes'))}</span></div>
      </section>

      <section class="pf-card pf-setup">
        <h2>${setup ? `${setup.icon} ` : ''}${esc(t('profile.setupTitle'))}</h2>
        ${setupList.length || p.favStrain || p.bio || p.breeder || chipRows.length ? `
          ${setupList.length ? `<div class="pf-setup-list">${setupList.map((s, i) => [s, i]).sort((a, b) => b[0].main - a[0].main).map(([s, i]) => setupBlock(s, i, setupList)).join('')}</div>` : ''}
          ${p.favStrain || p.breeder ? `<dl class="pf-facts">
            ${p.favStrain ? fact(t('profile.favStrain'), p.favStrain) : ''}
            ${p.breeder ? fact(t('profile.breeder'), p.breeder) : ''}
          </dl>` : ''}
          ${chipRows.length ? `<div class="pf-chip-rows">${chipRows.map(([g, v]) => `
            <div class="pf-chip-row"><span class="pf-chip-label">${esc(t(`opt.${g}.title`))}</span>
              <span class="pf-chips">${(Array.isArray(v) ? v : [v]).map((x) => chipHtml(g === 'spaceSize' ? spaceLabel(p) : optLabel(g, x))).join('')}</span></div>`).join('')}
          </div>` : ''}
          ${p.bio ? `<p class="pf-bio">${esc(p.bio)}</p>` : ''}`
        : `<p class="muted small">${esc(t(isMe ? 'profile.setupEmptyMe' : 'profile.setupEmpty'))}</p>`}
      </section>

      <section class="pf-card">
        <div class="section-head"><h2>${esc(t('nav.badges'))}</h2><a class="link small" href="#/badges">${esc(t('profile.allBadges'))} →</a></div>
        ${badges.length ? `<ul class="pf-badges">${badges.map((b) => `
          <li><button type="button" class="badge-btn pf-badge" data-badge-name="${esc(tc(b.name))}" aria-label="${esc(tc(b.name))}">
            <img src="${esc(b.image)}" alt="" width="64" height="64" loading="lazy"></button>
            <span>${esc(tc(b.name))}</span></li>`).join('')}</ul>`
        : `<p class="muted small">${esc(t('profile.noBadges'))}</p>`}
      </section>

      <section class="pf-card">
        <h2>${esc(t('profile.history'))}</h2>
        ${p.history.length ? `<ul class="ncard-grid">${p.history.map((h) => {
          const battle = { number: h.number, theme: h.theme, isTest: false };
          return neonCardHtml({
            id: h.entryId, photoUrl: h.photoUrl, displayName: p.displayName, instagram: p.instagram, avatar: p.avatar, strain: h.strain,
          }, { eyebrow: `${battleLabel(battle)} · ${tc(h.theme)}`, pill: h.place ? `#${h.place}` : '', top: h.place === 1 && h.ended, compact: true,
            below: `<p class="pf-hist-cap"><a href="#/standings/${encodeURIComponent(h.battleId)}">${esc(battleLabel(battle))} · ${esc(tc(h.theme))}</a><br>
              <span class="muted">${h.place ? esc(t(h.ended ? 'profile.placeFinal' : 'profile.placeNow', { place: h.place })) : esc(t('profile.placeOpen'))}</span></p>` });
        }).join('')}</ul>`
        : `<p class="muted small">${esc(t('profile.noHistory'))}</p>`}
      </section>

      ${isMe ? `
        <section class="pf-card pf-match-tile">
          <h2>🧬 ${esc(t('profile.strainMatch'))}</h2>
          <p class="muted small">${esc(t('profile.strainMatchText'))}</p>
          <a class="btn btn-primary" href="#/strainmatch">${esc(t('match.open'))}</a>
        </section>
        <section class="pf-card" data-edit-slot>
          <button type="button" class="btn btn-primary btn-block" data-edit>${esc(t('profile.edit'))}</button>
        </section>
        <section class="pf-card">
          <h2>${esc(t('profile.account'))}</h2>
          <dl class="dates">
            <div class="date-row"><dt>${esc(t('auth.email'))}</dt><dd>${esc(me?.email || '')}</dd></div>
            ${me?.isAdmin || me?.isTester ? `<div class="date-row active"><dt>${esc(t('profile.role'))}</dt><dd>${esc([me.isAdmin && t('profile.admin'), me.isTester && t('profile.tester')].filter(Boolean).join(' · '))}</dd></div>` : ''}
          </dl>
          <p class="muted small">${esc(t('profile.emailPrivate'))}</p>
          <div class="actions">
            ${me?.isAdmin ? `<a class="btn btn-primary" href="#/admin">${esc(t('admin.open'))}</a>` : ''}
            <button class="btn btn-ghost" type="button" data-logout>${esc(t('auth.logout'))}</button>
          </div>
        </section>` : ''}
    </div>`;

  showLook(root, look);
  fitSinceRow(root);
  document.fonts?.ready.then(() => fitSinceRow(root));
  bindReportButtons(root);
  if (!isMe) return;
  reviews.filter((r) => r.status === 'rejected' && !r.seen).forEach((r) => ackImageReview(r.id).catch(() => {})); // note shown once
  root.querySelector('[data-logout]').addEventListener('click', async () => {
    await signOut();
    showWelcome('logout'); // "Bis bald, Grower!"
    onLogout?.();
  });
  root.querySelector('[data-edit]').addEventListener('click', () => openEditor(root, me, key, onLogout, look, reviews));
  let openNow = false;
  try { openNow = sessionStorage.getItem('bb.openEdit') === '1'; sessionStorage.removeItem('bb.openEdit'); } catch { /* ignore */ }
  if (openNow) openEditor(root, me, key, onLogout, look, reviews);
}

/** Page class: theme colours from the setup (the glow colour only changes the picture ring). */
function pfClass(setupId) {
  return `pf pf-theme-${setupId || 'none'}`;
}

/** "Mitglied seit …" + setup chip always on one line: smaller text first, then the short form. */
function fitSinceRow(root) {
  const row = root.querySelector('[data-since-row]');
  const since = row?.querySelector('.pf-since');
  if (!row || !since) return;
  const fits = () => row.scrollWidth <= row.clientWidth + 1;
  since.textContent = since.dataset.long;
  since.classList.remove('is-small');
  if (fits()) return;
  since.classList.add('is-small');
  if (fits()) return;
  since.textContent = since.dataset.short;
}

/** Strain Match sends people here to fill in their setup; after saving they go back. */
function takeReturnTo() {
  let to = null;
  try { to = sessionStorage.getItem('bb.returnTo'); sessionStorage.removeItem('bb.returnTo'); } catch { /* ignore */ }
  if (to && to.startsWith('#/')) { location.hash = to; return true; }
  return false;
}

/** One setup on the public profile: name, main tag, size/seeds/training chips, light + medium. */
function setupBlock(s, i, list) {
  const type = SETUPS.find((x) => x.id === s.type);
  const chips = [
    s.spaceSize ? spaceLabel(s) : '', s.seedType ? optLabel('seedType', s.seedType) : '',
    ...(s.training || []).map((x) => optLabel('training', x)),
  ].filter(Boolean);
  const meta = [s.lights ? `💡 ${s.lights}` : '', s.medium ? `🪴 ${t(`medium.${s.medium}`)}` : ''].filter(Boolean);
  return `<div class="pf-setup-item${s.main ? ' is-main' : ''}">
    <div class="pf-setup-item-head">
      <span class="pf-setup-item-icon" aria-hidden="true">${type ? type.icon : '🌱'}</span>
      <b>${esc(setupName(s, i, list, t))}</b>
      ${s.main && list.length > 1 ? `<span class="pf-main-tag">${esc(t('setups.main'))}</span>` : ''}
    </div>
    ${chips.length ? `<div class="pf-chips">${chips.map((c) => chipHtml(c)).join('')}</div>` : ''}
    ${meta.length ? `<p class="pf-setup-meta">${meta.map(esc).join(' · ')}</p>` : ''}
  </div>`;
}

/** One setup card in the editor. */
function setupCardHtml(s, i) {
  const custom = s.spaceSize === 'custom' || s.spaceSize === 'other';
  const val = (v) => esc(v ?? '');
  return `<section class="setup-card" data-setup-card>
    <div class="setup-card-head">
      <b class="setup-card-title" data-setup-title>${esc(t('setups.nth', { n: i + 1 }))}</b>
      <label class="setup-main"><input type="radio" name="setup-main" ${s.main ? 'checked' : ''}><span>${esc(t('setups.main'))}</span></label>
      <button type="button" class="setup-remove" data-remove-setup aria-label="${esc(t('setups.remove'))}" title="${esc(t('setups.remove'))}">✕</button>
    </div>
    <div class="field">
      <span class="label">${esc(t('profile.setup'))} <span class="muted small">${esc(t('profile.setupUnselect'))}</span></span>
      <div class="opt-chips">${SETUPS.map((x) => `<button type="button" class="bb-chip pf-setup-opt" data-setup="${x.id}" aria-pressed="${s.type === x.id}">
        <span class="bb-chip-icon" aria-hidden="true">${x.icon}</span>${esc(t(`setupShort.${x.id}`))}</button>`).join('')}</div>
    </div>
    <label class="field"><span class="label">${esc(t('setups.name'))} <span class="muted small">${esc(t('links.optional'))}</span></span>
      <input type="text" data-f="name" maxlength="24" placeholder="${esc(t('setups.namePh'))}" value="${val(s.name)}"></label>
    ${chipGroup('spaceSize', s.spaceSize === 'other' ? 'custom' : s.spaceSize)}
    <div class="space-custom" data-space-custom ${custom ? '' : 'hidden'}>
      <div class="space-row">
        <label><span>${esc(t('space.width'))}</span><input data-f="sw" type="number" inputmode="numeric" min="20" max="2000" placeholder="240" value="${val(s.spaceW)}"></label>
        <span class="space-x" aria-hidden="true">×</span>
        <label><span>${esc(t('space.depth'))}</span><input data-f="sd" type="number" inputmode="numeric" min="20" max="2000" placeholder="120" value="${val(s.spaceD)}"></label>
      </div>
      <div class="space-row">
        <label><span>${esc(t('space.heightFrom'))}</span><input data-f="sh1" type="number" inputmode="numeric" min="20" max="600" placeholder="150" value="${val(s.spaceHMin)}"></label>
        <span class="space-x" aria-hidden="true">–</span>
        <label><span>${esc(t('space.heightTo'))}</span><input data-f="sh2" type="number" inputmode="numeric" min="20" max="600" placeholder="180" value="${val(s.spaceHMax && s.spaceHMax !== s.spaceHMin ? s.spaceHMax : '')}"></label>
      </div>
      <p class="hint">${esc(t('space.heightHint'))}</p>
    </div>
    <label class="field"><span class="label">${esc(t('profile.lights'))}</span>
      <input type="text" data-f="lights" maxlength="40" placeholder="${esc(t('profile.lightsPh'))}" value="${val(s.lights)}"></label>
    <label class="field"><span class="label">${esc(t('profile.medium'))}</span>
      <select data-f="medium"><option value="">–</option>${MEDIA.map((m) => `<option value="${m}" ${s.medium === m ? 'selected' : ''}>${esc(t(`medium.${m}`))}</option>`).join('')}</select></label>
    ${chipGroup('seedType', s.seedType)}
    ${chipGroup('training', s.training)}
  </section>`;
}

/** Small link icons under the name; empty ones are hidden. */
function linksHtml(p) {
  const items = LINK_KINDS.filter((k) => p[k]);
  if (!items.length) return '';
  return `<div class="pf-links">${items.map((k) => {
    const label = `${t(`links.${k}`)}: ${k === 'growdiaries' ? 'GrowDiaries' : k === 'youtube' && !p[k].startsWith('@') ? p[k] : `@${p[k].replace(/^@/, '')}`}`;
    return `<a class="pf-link pf-link-${k}" href="${esc(linkUrl(k, p[k]))}" target="_blank" rel="noopener noreferrer nofollow" aria-label="${esc(label)}" title="${esc(label)}">${LINK_ICONS[k]}</a>`;
  }).join('')}</div>`;
}

function fact(label, value) {
  return `<div class="pf-fact"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
}

/** A row of tap-to-choose chips (single choice = tap again to clear). */
function chipGroup(group, current) {
  const { values, multi } = OPTIONS[group];
  const chosen = new Set(Array.isArray(current) ? current : current ? [current] : []);
  return `
    <fieldset class="field opt-group" data-group="${group}" data-multi="${multi ? 1 : 0}">
      <legend class="label">${esc(t(`opt.${group}.title`))}${multi ? ` <span class="muted small">${esc(t('opt.multi'))}</span>` : ''}</legend>
      ${(OPTIONS[group].groups || [{ values }]).map((g) => `
      ${g.id ? `<p class="opt-subtitle">${esc(t(`opt.${group}.group.${g.id}`))}</p>` : ''}
      <div class="opt-chips">
        ${g.values.map((v) => `<button type="button" class="bb-chip opt-chip" data-value="${v}" aria-pressed="${chosen.has(v)}">${esc(optLabel(group, v))}</button>`).join('')}
      </div>`).join('')}
    </fieldset>`;
}

/**
 * Shows the chosen background (top of the profile, fading into the page) and the
 * underbanner (thin strip under the header), and tints the profile with colours
 * measured from the picture. On 24.12 the Christmas Eve picture is shown instead.
 */
function showLook(root, look) {
  const pf = root.querySelector('.pf');
  const cover = root.querySelector('[data-cover]');
  const banner = root.querySelector('[data-banner]');
  if (!pf || !cover || !banner) return;
  const bgValue = effectiveBg(look);
  const bgUrl = lookUrl('bg', bgValue, profileImageUrl);
  const focus = bgValue.startsWith('p:') ? BG_FOCUS[bgValue.slice(2)] : '';
  const bannerUrl = lookUrl('banner', look?.banner || '', profileImageUrl);
  cover.innerHTML = bgUrl ? `<img src="${esc(bgUrl)}" alt="" decoding="async"${focus ? ` style="object-position: ${esc(focus)}"` : ''}>` : '';
  pf.classList.toggle('pf-has-cover', !!bgUrl);
  // the strip takes the picture's own shape (between 4:1 and 2:1), so the whole picture shows;
  // an own upload with an unusual shape is shown whole with a blurred copy filling the rest
  banner.innerHTML = bannerUrl ? `<img class="pf-banner-bg" src="${esc(bannerUrl)}" alt="" decoding="async">
    <img class="pf-banner-img" src="${esc(bannerUrl)}" alt="" decoding="async">` : '';
  banner.hidden = !bannerUrl;
  banner.style.aspectRatio = '3 / 1';
  const bimg = banner.querySelector('.pf-banner-img');
  if (bimg) {
    const fit = () => { if (bimg.naturalWidth) banner.style.aspectRatio = String(Math.min(4, Math.max(2, bimg.naturalWidth / bimg.naturalHeight))); };
    if (bimg.complete) fit(); else bimg.addEventListener('load', fit, { once: true });
  }
  const source = bgUrl || bannerUrl;
  pf.dataset.lookSrc = source;
  if (!source) { applyPalette(pf, null); return; }
  paletteFrom(source).then((pal) => { if (pf.isConnected && pf.dataset.lookSrc === source) applyPalette(pf, pal); });
}

/** "Your background is waiting for approval" / "… was not approved" (own profile only). */
function reviewNotesHtml(reviews) {
  const notes = reviews.filter((r) => r.status === 'pending' || (r.status === 'rejected' && !r.seen));
  if (!notes.length) return '';
  return `<div class="pf-review-notes">${notes.map((r) => `<p class="pf-review-note is-${r.status}" role="status">
    ${r.status === 'pending' ? '⏳' : '✕'} ${esc(t(`look.${r.status}.${r.kind}`))}</p>`).join('')}</div>`;
}

/** The own picture waiting for approval: shown in the row, but not choosable yet. */
function pendingOptHtml(kind, review) {
  if (!review || review.status !== 'pending') return '';
  return `<span class="look-opt is-pending" title="${esc(t(`look.pending.${kind}`))}">
    <img src="${esc(profileImageUrl(review.path))}" alt="" loading="lazy"><span class="look-wait">⏳</span></span>`;
}

/** One scrollable row of small previews: none, own picture (upload), presets. */
function lookRowHtml(kind, current, review) {
  const presets = kind === 'bg' ? BG_PRESETS : BANNER_PRESETS;
  const own = current?.startsWith('u:') ? current : '';
  const opt = (value, inner, label, cls = '') => `<button type="button" class="look-opt ${cls}" data-look-value="${esc(value)}"
    aria-pressed="${value === (current || '')}" aria-label="${esc(label)}" title="${esc(label)}">${inner}</button>`;
  return `
    <div class="look-row look-row-${kind}" data-look-row="${kind}" data-hscroll role="group">
      ${opt('', `<span class="look-none">${esc(t('look.none'))}</span>`, t('look.none'), 'look-opt-text')}
      <label class="look-opt look-opt-text look-upload" title="${esc(t('look.upload'))}">
        <input type="file" accept="image/*" data-look-file="${kind}" hidden>
        <span class="look-none">＋ ${esc(t('look.upload'))}</span>
      </label>
      <span data-pending-slot>${pendingOptHtml(kind, review)}</span>
      <span data-own-slot>${own ? opt(own, `<img src="${esc(lookUrl(kind, own, profileImageUrl))}" alt="" loading="lazy">`, t('look.own')) : ''}</span>
      ${presets.map((n) => opt(`p:${n}`, `<img src="${esc(lookUrl(kind, `p:${n}`, null, { thumb: true }))}" alt="" loading="lazy" width="${kind === 'bg' ? 96 : 120}" height="${kind === 'bg' ? 54 : 40}">`,
        t(`look.preset.${n}`))).join('')}
    </div>
    <p class="hint" data-look-status="${kind}" role="status">${review?.status === 'pending' ? `⏳ ${esc(t(`look.pending.${kind}`))}` : ''}</p>`;
}

function openEditor(root, me, key, onLogout, startLook = { bg: '', banner: '', xmas: true }, reviews = []) {
  const reviewOf = (kind) => reviews.find((r) => r.kind === kind);
  const slot = root.querySelector('[data-edit-slot]');
  const changedAt = me.usernameChangedAt ? new Date(me.usernameChangedAt) : null;
  const nextChange = changedAt ? new Date(changedAt.getTime() + NAME_CHANGE_DAYS * 864e5) : null;
  const nameLocked = !!(me.username && nextChange && nextChange > new Date());
  const fmt = (d) => new Intl.DateTimeFormat(getLang() === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  const startSetups = setupsOf(me);
  slot.innerHTML = `
    <form class="form pf-form" novalidate>
      <h2>${esc(t('profile.edit'))}</h2>
      <div class="field">
        <label class="label" for="pf-name">${esc(t('profile.nameLabel'))}</label>
        <input id="pf-name" type="text" maxlength="20" autocomplete="nickname" value="${esc(me.username || '')}" ${nameLocked ? 'disabled' : ''}>
        <p class="hint">${esc(nameLocked ? t('profile.nameLocked', { date: fmt(nextChange) }) : t('profile.nameRules'))}</p>
      </div>
      <fieldset class="field pf-link-fields">
        <legend class="label">${esc(t('links.title'))} <span class="muted small">${esc(t('links.optional'))}</span></legend>
        ${LINK_KINDS.map((k) => `<label class="pf-link-field">
          <span class="pf-link-ico" aria-hidden="true">${LINK_ICONS[k]}</span>
          <span class="sr-only">${esc(t(`links.${k}`))}</span>
          <input id="pf-link-${k}" type="text" inputmode="url" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="200"
            placeholder="${esc(t(`links.ph.${k}`))}" aria-label="${esc(t(`links.${k}`))}" value="${esc(linkInputValue(k, me[k]))}">
        </label>`).join('')}
        <p class="hint">${esc(t('links.hint'))}</p>
      </fieldset>
      <fieldset class="field setups-field">
        <legend class="label">${esc(t('setups.title'))} <span class="muted small">${esc(t('setups.max', { n: MAX_SETUPS }))}</span></legend>
        <div class="setup-list" data-setup-list>${(startSetups.length ? startSetups : [{ main: true }]).map((s, i) => setupCardHtml(s, i)).join('')}</div>
        <button type="button" class="btn btn-ghost btn-small" data-add-setup>＋ ${esc(t('setups.add'))}</button>
      </fieldset>
      ${chipGroup('growStage', me.growStage)}
      ${chipGroup('experience', me.experience)}
      ${chipGroup('growStyle', me.growStyle)}
      ${chipGroup('flavours', me.flavours)}
      <div class="field"><label class="label" for="pf-strain">${esc(t('profile.favStrain'))}</label>
        <input id="pf-strain" type="text" maxlength="40" value="${esc(me.favStrain || '')}"></div>
      <div class="field"><label class="label" for="pf-breeder">${esc(t('profile.breeder'))}</label>
        <input id="pf-breeder" type="text" maxlength="40" value="${esc(me.breeder || '')}"></div>
      <fieldset class="field">
        <legend class="label">${esc(t('profile.accent'))}</legend>
        <div class="accent-swatches">
          ${ACCENTS.map((a) => `<button type="button" class="accent-swatch pf-accent-${a}" data-accent="${a}" aria-pressed="${me.accent === a}" aria-label="${esc(t(`accent.${a}`))}" title="${esc(t(`accent.${a}`))}"><span></span></button>`).join('')}
        </div>
      </fieldset>
      <fieldset class="field look-field">
        <legend class="label">${esc(t('look.bgTitle'))}</legend>
        ${lookRowHtml('bg', startLook.bg, reviewOf('bg'))}
      </fieldset>
      <fieldset class="field look-field">
        <legend class="label">${esc(t('look.bannerTitle'))}</legend>
        ${lookRowHtml('banner', startLook.banner, reviewOf('banner'))}
      </fieldset>
      <label class="check"><input type="checkbox" id="pf-xmas" ${startLook.xmas !== false ? 'checked' : ''}><span>🎅 ${esc(t('look.xmas'))}</span></label>
      <div class="field"><label class="label" for="pf-bio">${esc(t('profile.bio'))}</label>
        <textarea id="pf-bio" rows="3" maxlength="${BIO_MAX}">${esc(me.bio || '')}</textarea>
        <span class="counter" data-count>${(me.bio || '').length}/${BIO_MAX}</span></div>
      <p class="error" role="alert" data-error hidden></p>
      <div class="actions">
        <button type="submit" class="btn btn-primary">${esc(t('auth.save'))}</button>
        <button type="button" class="btn btn-ghost" data-cancel>${esc(t('badges.cancel'))}</button>
      </div>
    </form>`;
  const form = slot.querySelector('form');
  const err = form.querySelector('[data-error]');
  const bio = form.querySelector('#pf-bio');
  bio.addEventListener('input', () => { form.querySelector('[data-count]').textContent = `${bio.value.length}/${BIO_MAX}`; });
  form.querySelectorAll('.pf-link-field input').forEach((i) => i.addEventListener('input', () => i.classList.remove('is-invalid')));
  const list = form.querySelector('[data-setup-list]');
  const addBtn = form.querySelector('[data-add-setup]');
  // theme preview follows the main setup's type
  const preview = () => {
    const mainCard = [...list.querySelectorAll('[data-setup-card]')].find((c) => c.querySelector('[name=setup-main]').checked);
    root.querySelector('.pf').className = pfClass(mainCard?.querySelector('[data-setup][aria-pressed="true"]')?.dataset.setup || '');
  };
  const renumber = () => {
    const cards = [...list.querySelectorAll('[data-setup-card]')];
    cards.forEach((c, i) => { c.querySelector('[data-setup-title]').textContent = t('setups.nth', { n: i + 1 }); });
    if (cards.length && !cards.some((c) => c.querySelector('[name=setup-main]').checked)) cards[0].querySelector('[name=setup-main]').checked = true;
    addBtn.hidden = cards.length >= MAX_SETUPS;
    cards.forEach((c) => { c.querySelector('[data-remove-setup]').hidden = cards.length < 2; });
    preview();
  };
  // all taps in one place (cards can be added later)
  form.addEventListener('click', (e) => {
    const chip = e.target.closest('.opt-chip');
    if (chip) {
      const g = chip.closest('.opt-group');
      const on = chip.getAttribute('aria-pressed') !== 'true';
      if (g.dataset.multi !== '1') g.querySelectorAll('.opt-chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
      chip.setAttribute('aria-pressed', String(on));
      if (g.dataset.group === 'spaceSize') {
        const box = g.closest('[data-setup-card]').querySelector('[data-space-custom]');
        box.hidden = !(on && chip.dataset.value === 'custom');
        if (!box.hidden) box.querySelector('[data-f=sw]').focus();
      }
      return;
    }
    const type = e.target.closest('[data-setup]');
    if (type) { // tap to choose, tap again to clear
      const card = type.closest('[data-setup-card]');
      const on = type.getAttribute('aria-pressed') !== 'true';
      card.querySelectorAll('[data-setup]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      type.setAttribute('aria-pressed', String(on));
      preview();
      return;
    }
    if (e.target.closest('[data-remove-setup]')) {
      e.target.closest('[data-setup-card]').remove();
      renumber();
    }
  });
  list.addEventListener('change', (e) => { if (e.target.name === 'setup-main') preview(); });
  addBtn.addEventListener('click', () => {
    const n = list.querySelectorAll('[data-setup-card]').length;
    if (n >= MAX_SETUPS) return;
    list.insertAdjacentHTML('beforeend', setupCardHtml({}, n));
    renumber();
    list.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  renumber();
  form.querySelectorAll('[data-accent]').forEach((b) => b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    form.querySelectorAll('[data-accent]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', String(on));
    root.querySelector('.pf-avatar').className = `pf-avatar pf-accent-${on ? b.dataset.accent : 'theme'}`;
  }));
  // profile look: tap a preview to choose it (live preview on the page above), or upload an own picture
  const look = { bg: startLook.bg || '', banner: startLook.banner || '', xmas: startLook.xmas !== false };
  const markLook = (kind) => form.querySelectorAll(`[data-look-row="${kind}"] [data-look-value]`)
    .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lookValue === look[kind])));
  form.querySelectorAll('[data-look-row]').forEach((row) => row.addEventListener('click', (e) => {
    const b = e.target.closest('[data-look-value]');
    if (!b) return;
    look[row.dataset.lookRow] = b.dataset.lookValue;
    markLook(row.dataset.lookRow);
    showLook(root, look);
  }));
  form.querySelectorAll('[data-look-file]').forEach((input) => input.addEventListener('change', async () => {
    const kind = input.dataset.lookFile;
    const status = form.querySelector(`[data-look-status="${kind}"]`);
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    status.className = 'hint'; status.textContent = t('look.uploading');
    try {
      const { blob, ext } = await prepareUpload(file, kind);
      const value = await uploadProfileImage(kind, blob, ext);
      await submitProfileImage(kind, value); // goes to the admin first; the current picture stays until then
      form.querySelector(`[data-look-row="${kind}"] [data-pending-slot]`).innerHTML = pendingOptHtml(kind, { status: 'pending', path: value.slice(2) });
      status.textContent = `⏳ ${t(`look.pending.${kind}`)}`;
    } catch (ex) {
      status.className = 'hint error'; status.textContent = t(ex.code || 'error.generic');
    }
  }));
  form.querySelector('#pf-xmas').addEventListener('change', (e) => { look.xmas = e.target.checked; showLook(root, look); });
  form.querySelector('[data-cancel]').addEventListener('click', () => {
    if (takeReturnTo()) return; // came from Strain Match: go back there
    renderProfilePage(root, key, { onLogout });
  });
  const chosenIn = (scope, group) => {
    const vals = [...scope.querySelectorAll(`[data-group="${group}"] .opt-chip[aria-pressed="true"]`)].map((c) => c.dataset.value);
    return OPTIONS[group].multi ? vals : vals[0] || '';
  };
  // grower-level options live outside the setup cards
  const chosen = (group) => {
    const own = [...form.querySelectorAll(`[data-group="${group}"]`)].find((g) => !g.closest('[data-setup-card]'));
    return own ? chosenIn(own.parentElement, group) : (OPTIONS[group].multi ? [] : '');
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const name = form.querySelector('#pf-name').value.trim();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    // links: only real links / handles for each site
    const links = {};
    for (const k of LINK_KINDS) {
      const input = form.querySelector(`#pf-link-${k}`);
      const v = normalizeLink(k, input.value);
      input.classList.toggle('is-invalid', v === null);
      if (v === null) {
        err.textContent = t('links.invalid', { site: t(`links.${k}`) }); err.hidden = false; btn.disabled = false;
        input.focus(); input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      links[k] = v;
    }
    // setups (up to 3); custom size: width × depth required, height optional (a range for sloping ceilings)
    const setups = [];
    for (const card of list.querySelectorAll('[data-setup-card]')) {
      const f = (k) => card.querySelector(`[data-f=${k}]`);
      const num = (k) => { const v = parseInt(f(k).value, 10); return Number.isFinite(v) ? v : null; };
      const s = {
        type: card.querySelector('[data-setup][aria-pressed="true"]')?.dataset.setup || null,
        name: f('name').value.trim() || null, spaceSize: chosenIn(card, 'spaceSize') || null,
        spaceW: null, spaceD: null, spaceHMin: null, spaceHMax: null,
        lights: f('lights').value.trim() || null, medium: f('medium').value || null,
        seedType: chosenIn(card, 'seedType') || null, training: chosenIn(card, 'training'),
        main: card.querySelector('[name=setup-main]').checked,
      };
      if (s.spaceSize === 'custom') {
        let sh1 = num('sh1'), sh2 = num('sh2');
        if (!sh1 && sh2) sh1 = sh2;
        if (sh1 && !sh2) sh2 = sh1;
        if (sh1 && sh2 && sh2 < sh1) [sh1, sh2] = [sh2, sh1];
        Object.assign(s, { spaceW: num('sw'), spaceD: num('sd'), spaceHMin: sh1, spaceHMax: sh2 });
        const okWD = (v) => v && v >= 20 && v <= 2000;
        const okH = (v) => !v || (v >= 20 && v <= 600);
        if (!okWD(s.spaceW) || !okWD(s.spaceD) || !okH(sh1) || !okH(sh2)) {
          err.textContent = t('error.spaceCustom'); err.hidden = false; btn.disabled = false;
          card.querySelector('[data-space-custom]').scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }
      if (s.type || s.name || s.spaceSize || s.lights || s.medium || s.seedType || s.training.length) setups.push(s);
    }
    if (setups.length && !setups.some((s) => s.main)) setups[0].main = true;
    try {
      if (!nameLocked && name && name !== me.username) await setProfileName(name);
      await updateProfileDetails({
        ...links,
        ...Object.fromEntries(Object.keys(OPTIONS).map((g) => [g, chosen(g)])),
        setups, ...legacyFields(setups), // the main setup also fills the single-setup fields
        favStrain: form.querySelector('#pf-strain').value,
        breeder: form.querySelector('#pf-breeder').value,
        bio: bio.value,
        accent: form.querySelector('[data-accent][aria-pressed="true"]')?.dataset.accent || '',
      });
      if (look.bg !== (startLook.bg || '') || look.banner !== (startLook.banner || '') || look.xmas !== (startLook.xmas !== false)) {
        await saveProfileLook(look, startLook);
      }
      if (takeReturnTo()) return; // came from Strain Match: go back with the new matches
      const fresh = await getCurrentUser();
      await renderProfilePage(root, fresh?.username || fresh?.id || key, { onLogout });
      window.scrollTo({ top: 0, behavior: 'smooth' }); // show the new look from the top
    } catch (ex) {
      err.textContent = t(ex.code || 'error.generic');
      err.hidden = false;
      btn.disabled = false;
    }
  });
  slot.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
