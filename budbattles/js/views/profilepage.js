// BIG PROFILE PAGE – your own (#/profile) and everyone else's (#/u/<name>).
// The look follows the chosen grow setup. Email is never shown to others.
import { t, tc, getLang } from '../i18n.js';
import {
  getPublicProfile, getBadgeCatalog, getCurrentUser, signOut, setProfileName, updateProfileDetails,
} from '../store.js';
import { esc, avatarUrl } from '../ui.js';
import { neonCardHtml } from '../entrycard.js';
import { battleLabel } from './battle.js';

export const SETUPS = [
  { id: 'zelt', icon: '⛺' },
  { id: 'raum', icon: '💡' },
  { id: 'outdoor', icon: '☀️' },
  { id: 'gewaechshaus', icon: '🌿' },
  { id: 'balkon', icon: '🌆' },
];
const MEDIA = ['erde', 'coco', 'hydro', 'andere'];
const BIO_MAX = 150;
const NAME_CHANGE_DAYS = 30;

export async function renderProfilePage(root, key, { onLogout } = {}) {
  const [p, catalog, me] = await Promise.all([getPublicProfile(key), getBadgeCatalog(), getCurrentUser()]);
  if (!p) {
    root.innerHTML = `<section class="card"><p>${esc(t('profile.notFound'))}</p><a class="btn btn-ghost" href="#/">${esc(t('app.backHome'))}</a></section>`;
    return;
  }
  const isMe = p.isMe || (me && me.id === p.id);
  const setup = SETUPS.find((s) => s.id === p.growSetup);
  const badges = p.badges.map((id) => catalog.find((b) => b.id === id)).filter(Boolean).sort((a, b) => a.sort - b.sort);
  const since = p.memberSince ? new Intl.DateTimeFormat(getLang() === 'de' ? 'de-DE' : 'en-GB', { month: 'long', year: 'numeric' }).format(new Date(p.memberSince)) : null;
  const best = p.stats.best_place ? `#${p.stats.best_place}` : '–';

  root.innerHTML = `
    <div class="pf pf-theme-${esc(setup?.id || 'none')}">
      <section class="pf-head">
        <div class="pf-avatar">
          <img src="${esc(avatarUrl(p.avatar))}" alt="" width="128" height="128">
          ${isMe && !p.avatar ? `<span class="pf-soon">${esc(t('profile.avatarSoon'))}</span>` : ''}
        </div>
        <h1 class="pf-name">${esc(p.displayName)}</h1>
        ${p.instagram ? `<a class="pf-insta" href="https://instagram.com/${encodeURIComponent(p.instagram)}" target="_blank" rel="noopener noreferrer">@${esc(p.instagram)}</a>` : ''}
        <div class="pf-tags">
          ${since ? `<span class="pf-since">${esc(t('profile.memberSince', { date: since }))}</span>` : ''}
          ${p.badges.includes('badge_heart') ? `<span class="pf-tag pf-tag-founder">♥ ${esc(t('profile.founder'))}</span>` : ''}
          ${setup ? `<span class="pf-tag">${setup.icon} ${esc(t(`setup.${setup.id}`))}</span>` : ''}
        </div>
      </section>

      <section class="pf-stats">
        <div class="pf-stat"><b>${p.stats.battles ?? 0}</b><span>${esc(t('profile.statBattles'))}</span></div>
        <div class="pf-stat"><b>${esc(best)}</b><span>${esc(t('profile.statBest'))}</span></div>
        <div class="pf-stat"><b>${p.stats.votes_given ?? 0}</b><span>${esc(t('profile.statVotes'))}</span></div>
      </section>

      <section class="pf-card pf-setup">
        <h2>${setup ? `${setup.icon} ` : ''}${esc(t('profile.setupTitle'))}</h2>
        ${setup || p.lights || p.medium || p.favStrain || p.bio ? `
          <dl class="pf-facts">
            ${setup ? fact(t('profile.setup'), t(`setup.${setup.id}`)) : ''}
            ${p.lights ? fact(t('profile.lights'), p.lights) : ''}
            ${p.medium ? fact(t('profile.medium'), t(`medium.${p.medium}`)) : ''}
            ${p.favStrain ? fact(t('profile.favStrain'), p.favStrain) : ''}
          </dl>
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
          const card = neonCardHtml({
            id: h.entryId, photoUrl: h.photoUrl, displayName: p.displayName, instagram: p.instagram, avatar: p.avatar, strain: h.strain,
          }, { eyebrow: `${battleLabel(battle)} · ${tc(h.theme)}`, pill: h.place ? `#${h.place}` : '', top: h.place === 1 && h.ended, compact: true,
            below: `<p class="pf-hist-cap"><a href="#/standings/${encodeURIComponent(h.battleId)}">${esc(battleLabel(battle))} · ${esc(tc(h.theme))}</a><br>
              <span class="muted">${h.place ? esc(t(h.ended ? 'profile.placeFinal' : 'profile.placeNow', { place: h.place })) : esc(t('profile.placeOpen'))}</span></p>` });
          return card;
        }).join('')}</ul>`
        : `<p class="muted small">${esc(t('profile.noHistory'))}</p>`}
      </section>

      <section class="pf-card pf-soon-tile" aria-disabled="true">
        <h2>🧬 ${esc(t('profile.strainMatch'))}</h2>
        <p class="muted small">${esc(t('profile.strainMatchText'))}</p>
        <span class="pill pill-upcoming">${esc(t('soon.badge'))}</span>
      </section>

      ${isMe ? `
        <section class="pf-card" data-edit-slot>
          <button type="button" class="btn btn-primary btn-block" data-edit>✎ ${esc(t('profile.edit'))}</button>
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

  if (!isMe) return;
  root.querySelector('[data-logout]').addEventListener('click', async () => { await signOut(); onLogout?.(); });
  root.querySelector('[data-edit]').addEventListener('click', () => openEditor(root, me, p, key, onLogout));
}

function fact(label, value) {
  return `<div class="pf-fact"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
}

function openEditor(root, me, p, key, onLogout) {
  const slot = root.querySelector('[data-edit-slot]');
  const changedAt = me.usernameChangedAt ? new Date(me.usernameChangedAt) : null;
  const nextChange = changedAt ? new Date(changedAt.getTime() + NAME_CHANGE_DAYS * 864e5) : null;
  const nameLocked = !!(me.username && nextChange && nextChange > new Date());
  const fmt = (d) => new Intl.DateTimeFormat(getLang() === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  slot.innerHTML = `
    <form class="form pf-form" novalidate>
      <h2>${esc(t('profile.edit'))}</h2>
      <div class="field">
        <label class="label" for="pf-name">${esc(t('profile.nameLabel'))}</label>
        <input id="pf-name" type="text" maxlength="20" autocomplete="nickname" value="${esc(me.username || '')}" ${nameLocked ? 'disabled' : ''}>
        <p class="hint">${esc(nameLocked ? t('profile.nameLocked', { date: fmt(nextChange) }) : t('profile.nameRules'))}</p>
      </div>
      <div class="field">
        <label class="label" for="pf-insta">${esc(t('profile.instagram'))}</label>
        <input id="pf-insta" type="text" maxlength="31" autocomplete="off" placeholder="@deinname" value="${esc(me.instagram ? `@${me.instagram}` : '')}">
      </div>
      <fieldset class="field pf-setups">
        <legend class="label">${esc(t('profile.setup'))}</legend>
        ${SETUPS.map((s) => `<label class="pf-setup-opt pf-theme-${s.id}">
          <input type="radio" name="setup" value="${s.id}" ${me.growSetup === s.id ? 'checked' : ''}>
          <span>${s.icon}</span><b>${esc(t(`setup.${s.id}`))}</b></label>`).join('')}
      </fieldset>
      <div class="field"><label class="label" for="pf-lights">${esc(t('profile.lights'))}</label>
        <input id="pf-lights" type="text" maxlength="40" placeholder="${esc(t('profile.lightsPh'))}" value="${esc(me.lights || '')}"></div>
      <div class="field"><label class="label" for="pf-medium">${esc(t('profile.medium'))}</label>
        <select id="pf-medium"><option value="">–</option>${MEDIA.map((m) => `<option value="${m}" ${me.medium === m ? 'selected' : ''}>${esc(t(`medium.${m}`))}</option>`).join('')}</select></div>
      <div class="field"><label class="label" for="pf-strain">${esc(t('profile.favStrain'))}</label>
        <input id="pf-strain" type="text" maxlength="40" value="${esc(me.favStrain || '')}"></div>
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
  // preview the theme while choosing a setup
  form.querySelectorAll('input[name=setup]').forEach((r) => r.addEventListener('change', () => {
    const pf = root.querySelector('.pf');
    pf.className = `pf pf-theme-${r.value}`;
  }));
  form.querySelector('[data-cancel]').addEventListener('click', () => renderProfilePage(root, key, { onLogout }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const name = form.querySelector('#pf-name').value.trim();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      if (!nameLocked && name && name !== me.username) await setProfileName(name);
      await updateProfileDetails({
        instagram: form.querySelector('#pf-insta').value,
        growSetup: form.querySelector('input[name=setup]:checked')?.value || '',
        lights: form.querySelector('#pf-lights').value,
        medium: form.querySelector('#pf-medium').value,
        favStrain: form.querySelector('#pf-strain').value,
        bio: bio.value,
      });
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
