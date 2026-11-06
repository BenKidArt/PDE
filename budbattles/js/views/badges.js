// BADGES PAGE: every active badge with its name and how to earn it.
// Badges you don't have yet are greyed out. Admins can add and edit badges here.
import { t, tc } from '../i18n.js';
import { getCurrentUser, getBadgeCatalog, getAllBadges, saveBadge } from '../store.js';
import { makeBadgeIcon } from '../photo.js';
import { esc } from '../ui.js';

export async function renderBadges(root) {
  const [user, catalog] = await Promise.all([getCurrentUser(), getBadgeCatalog()]);
  const own = new Set(user?.badges || []);

  // Badges with the same name and rule share one card (e.g. Champion son + daughter)
  const groups = [];
  for (const b of catalog) {
    const key = `${b.name.en}|${b.description.en}`;
    const g = groups.find((x) => x.key === key);
    if (g) g.badges.push(b); else groups.push({ key, badges: [b] });
  }
  const unlocked = groups.filter((g) => g.badges.some((b) => own.has(b.id))).length;

  root.innerHTML = `
    <section class="hero hero-small">
      <p class="eyebrow">${esc(t('badges.eyebrow'))}</p>
      <h1 class="neon-title">${esc(t('nav.badges'))}</h1>
      <p class="hero-summary">${esc(t('badges.intro'))}</p>
      ${user
        ? `<p class="badges-count"><strong>${unlocked}</strong> / ${groups.length} ${esc(t('badges.unlocked'))}</p>`
        : `<p class="small"><a class="link" href="#/profile">${esc(t('badges.loginToCollect'))} →</a></p>`}
    </section>
    ${user?.isAdmin ? `<div class="actions badges-admin-bar"><button type="button" class="btn btn-ghost btn-small" data-new>＋ ${esc(t('badges.add'))}</button></div><div data-form-slot></div>` : ''}
    <ul class="badge-grid">
      ${groups.map((g) => {
        const has = g.badges.some((b) => own.has(b.id));
        const first = g.badges[0];
        return `
        <li class="badge-card ${has ? 'is-unlocked' : 'is-locked'}">
          <div class="badge-card-imgs">${g.badges.map((b) => `<img src="${esc(b.image)}" alt="" width="64" height="64" loading="lazy">`).join('')}</div>
          <h2 class="badge-card-name">${esc(tc(first.name))}</h2>
          <p class="badge-card-rule">${esc(tc(first.description) || t('badges.noRule'))}</p>
          <p class="badge-card-state">${has ? `✓ ${esc(t('badges.have'))}` : `🔒 ${esc(t('badges.locked'))}`}</p>
          ${user?.isAdmin ? g.badges.map((b) => `<button type="button" class="link-button small" data-edit="${esc(b.id)}">${esc(t('badges.edit'))}${g.badges.length > 1 ? ` (${esc(b.id.replace('badge_', ''))})` : ''}</button>`).join('') : ''}
        </li>`;
      }).join('')}
    </ul>
    ${user?.isAdmin ? '<section class="badges-inactive" data-inactive></section>' : ''}`;

  if (!user?.isAdmin) return;

  // ---------- admin: inactive badges + add / edit form ----------
  const all = await getAllBadges();
  const inactive = all.filter((b) => !b.active);
  const inactiveEl = root.querySelector('[data-inactive]');
  if (inactive.length) {
    inactiveEl.innerHTML = `
      <h2>${esc(t('badges.inactiveTitle'))}</h2>
      <p class="muted small">${esc(t('badges.inactiveHint'))}</p>
      <ul class="badge-grid badge-grid-small">
        ${inactive.map((b) => `
          <li class="badge-card is-locked">
            <div class="badge-card-imgs"><img src="${esc(b.image)}" alt="" width="48" height="48" loading="lazy"></div>
            <p class="badge-card-name">${esc(tc(b.name))}</p>
            <button type="button" class="link-button small" data-edit="${esc(b.id)}">${esc(t('badges.edit'))}</button>
          </li>`).join('')}
      </ul>`;
  }

  const slot = root.querySelector('[data-form-slot]');
  root.querySelector('[data-new]').addEventListener('click', () => openForm(null));
  root.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', () => {
    openForm(all.find((b) => b.id === btn.dataset.edit));
  }));

  function openForm(badge) {
    const isNew = !badge;
    slot.innerHTML = `
      <form class="card form badge-form" novalidate>
        <h2>${esc(t(isNew ? 'badges.addTitle' : 'badges.editTitle'))}</h2>
        <div class="field">
          <span class="label">${esc(t('badges.image'))}</span>
          <label class="badge-drop">
            <input type="file" accept="image/png,image/webp,image/jpeg" data-file hidden>
            <img data-preview ${badge ? `src="${esc(badge.image)}"` : 'hidden'} alt="" width="96" height="96">
            <span data-pick>${esc(t(isNew ? 'badges.pickImage' : 'badges.changeImage'))}</span>
          </label>
          <p class="hint">${esc(t('badges.imageHint'))}</p>
        </div>
        <div class="field"><label class="label" for="bn-de">${esc(t('badges.nameDe'))}</label>
          <input id="bn-de" type="text" maxlength="40" value="${esc(badge?.name.de || '')}"></div>
        <div class="field"><label class="label" for="bn-en">${esc(t('badges.nameEn'))}</label>
          <input id="bn-en" type="text" maxlength="40" value="${esc(badge?.name.en || '')}"></div>
        <div class="field"><label class="label" for="br-de">${esc(t('badges.ruleDe'))}</label>
          <textarea id="br-de" rows="2" maxlength="160">${esc(badge?.description.de || '')}</textarea></div>
        <div class="field"><label class="label" for="br-en">${esc(t('badges.ruleEn'))}</label>
          <textarea id="br-en" rows="2" maxlength="160">${esc(badge?.description.en || '')}</textarea></div>
        <label class="check"><input type="checkbox" id="b-active" ${!badge || badge.active ? 'checked' : ''}><span>${esc(t('badges.active'))}</span></label>
        <label class="check"><input type="checkbox" id="b-trade" ${badge?.tradeable ? 'checked' : ''} ${badge?.earned ? 'disabled' : ''}>
          <span>${esc(t('badges.tradeable'))}${badge?.earned ? ` <span class="muted small">(${esc(t('badges.earnedNoTrade'))})</span>` : ''}</span></label>
        <p class="hint">${esc(t('badges.awardHint'))}</p>
        <p class="error" role="alert" data-error hidden></p>
        <div class="actions">
          <button type="submit" class="btn btn-primary">${esc(t('auth.save'))}</button>
          <button type="button" class="btn btn-ghost" data-cancel>${esc(t('badges.cancel'))}</button>
        </div>
      </form>`;
    const form = slot.querySelector('form');
    const errorEl = form.querySelector('[data-error]');
    const showError = (key) => { errorEl.textContent = t(key); errorEl.hidden = false; };
    let icon = null;

    form.querySelector('[data-cancel]').addEventListener('click', () => { slot.innerHTML = ''; });
    form.querySelector('[data-file]').addEventListener('change', async (e) => {
      errorEl.hidden = true;
      try {
        icon = await makeBadgeIcon(e.target.files[0]);
        const img = form.querySelector('[data-preview]');
        img.src = URL.createObjectURL(icon.blob);
        img.hidden = false;
      } catch (err) { icon = null; showError(err.code || 'error.photoRead'); }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      const name = { de: form.querySelector('#bn-de').value.trim(), en: form.querySelector('#bn-en').value.trim() };
      if (!name.de || !name.en) return showError('error.badgeName');
      if (isNew && !icon) return showError('error.badgeImage');
      const id = badge?.id || newBadgeId(name.en, all);
      const submit = form.querySelector('[type=submit]');
      submit.disabled = true;
      try {
        await saveBadge({
          id, isNew, image: badge?.image, earned: badge?.earned, sort: badge?.sort,
          name,
          description: { de: form.querySelector('#br-de').value.trim(), en: form.querySelector('#br-en').value.trim() },
          active: form.querySelector('#b-active').checked,
          tradeable: form.querySelector('#b-trade').checked,
        }, icon);
        renderBadges(root);
      } catch (err) {
        showError(err.code || 'error.generic');
        submit.disabled = false;
      }
    });
    slot.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/** badge_ + the English name in lower case, made unique. */
function newBadgeId(nameEn, all) {
  const base = `badge_${nameEn.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'new'}`.slice(0, 40);
  let id = base, n = 2;
  while (all.some((b) => b.id === id)) id = `${base}_${n++}`;
  return id;
}
