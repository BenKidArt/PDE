// ENTER PAGE: one photo per grower per battle, strain name (optional switch), short description.
import { t, tc } from '../i18n.js';
import {
  getBattle, getCurrentBattle, battleStatus, getCurrentUser, getEntryByUser, addEntry, withdrawEntry, getSettings,
} from '../store.js';
import { cleanPhoto } from '../photo.js';
import { esc } from '../ui.js';
import { testNotice } from './battle.js';

const STRAIN_MAX = 60;
const DESC_MAX = 280;

export async function renderEnter(root, { id } = {}) {
  const battle = id ? await getBattle(id) : await getCurrentBattle();
  if (!battle) {
    root.innerHTML = `<section class="card"><p>${esc(t('battle.none'))}</p></section>`;
    return;
  }
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);

  const header = `${testNotice(battle)}
    <section class="hero hero-small">
      <p class="eyebrow">${esc(tc(battle.theme))}</p>
      <h1 class="neon-title">${esc(t('enter.title'))}</h1>
    </section>`;

  if (!user) {
    root.innerHTML = header + `<section class="card">
      <p>${esc(t('enter.loginNeeded'))}</p>
      <div class="actions"><a class="btn btn-primary" href="#/profile">${esc(t('auth.loginOrSignup'))}</a></div></section>`;
    return;
  }

  const existing = await getEntryByUser(battle.id, user.id);
  const isOpen = battleStatus(battle) === 'open';
  if (existing) {
    root.innerHTML = header + entryCard(existing, t('enter.already.title'), t('enter.already.text'), { canWithdraw: isOpen });
    wireWithdraw(root, existing, battle.id);
    return;
  }
  if (!isOpen) {
    root.innerHTML = header + `<section class="card"><p>${esc(t('enter.closed'))}</p>
      <a class="btn btn-ghost" href="#/battle/${encodeURIComponent(battle.id)}">${esc(t('nav.battle'))}</a></section>`;
    return;
  }

  root.innerHTML = header + `
    <form class="card form" novalidate data-form>
      <p>${esc(t('enter.intro'))}</p>

      <div class="field">
        <span class="label">${esc(t('enter.photo'))}</span>
        <label class="dropzone" data-dropzone>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" data-file hidden>
          <img alt="" data-preview hidden>
          <span class="dropzone-text" data-pick-text>📷 ${esc(t('enter.pick'))}</span>
        </label>
        <p class="hint">🛡️ ${esc(t('enter.gpsNote'))}</p>
        <p class="badge-ok" data-clean-status hidden></p>
      </div>

      ${settings.showStrain ? `<div class="field">
        <label class="label" for="strain">${esc(t('enter.strain'))}</label>
        <input id="strain" name="strain" type="text" maxlength="${STRAIN_MAX}" required autocomplete="off"
          placeholder="${esc(t('enter.strainPlaceholder'))}">
      </div>` : ''}

      <div class="field">
        <label class="label" for="description">${esc(t('enter.description'))}</label>
        <textarea id="description" name="description" rows="3" maxlength="${DESC_MAX}"
          placeholder="${esc(t('enter.descriptionPlaceholder'))}"></textarea>
        <span class="counter" data-counter>${esc(t('enter.chars', { used: 0, max: DESC_MAX }))}</span>
      </div>

      <label class="check">
        <input type="checkbox" name="confirm" required>
        <span>${esc(t('enter.confirmOwn'))}</span>
      </label>

      <p class="error" role="alert" data-error hidden></p>
      <button class="btn btn-primary btn-go btn-block" type="submit" data-submit>${esc(t('enter.submit'))}</button>
    </form>`;

  const form = root.querySelector('[data-form]');
  const fileInput = form.querySelector('[data-file]');
  const preview = form.querySelector('[data-preview]');
  const pickText = form.querySelector('[data-pick-text]');
  const cleanStatus = form.querySelector('[data-clean-status]');
  const errorEl = form.querySelector('[data-error]');
  const submitBtn = form.querySelector('[data-submit]');
  const desc = form.querySelector('#description');
  const counter = form.querySelector('[data-counter]');
  let cleaned = null; // result of cleanPhoto()
  let previewUrl = null;

  const showError = (key, vars) => {
    errorEl.textContent = t(key, vars);
    errorEl.hidden = false;
  };
  const clearError = () => { errorEl.hidden = true; };

  desc.addEventListener('input', () => {
    counter.textContent = t('enter.chars', { used: desc.value.length, max: DESC_MAX });
  });

  fileInput.addEventListener('change', async () => {
    clearError();
    cleaned = null;
    cleanStatus.hidden = true;
    const file = fileInput.files[0];
    if (!file) return;
    pickText.textContent = t('enter.processing');
    submitBtn.disabled = true;
    try {
      cleaned = await cleanPhoto(file);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(cleaned.blob);
      preview.src = previewUrl;
      preview.hidden = false;
      pickText.textContent = t('enter.change');
      cleanStatus.textContent = `✓ ${t(cleaned.hadGps ? 'enter.cleanedGps' : 'enter.cleaned')}`;
      cleanStatus.hidden = false;
    } catch (e) {
      pickText.textContent = `📷 ${t('enter.pick')}`;
      preview.hidden = true;
      showError(e.code || 'error.photoRead', e.vars);
    } finally {
      submitBtn.disabled = false;
    }
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    clearError();
    const strain = settings.showStrain ? form.strain.value.trim() : '';
    if (!cleaned) return showError('error.photoRequired');
    if (settings.showStrain && !strain) return showError('error.strainRequired');
    if (!form.confirm.checked) return showError('error.confirmRequired');

    submitBtn.disabled = true;
    submitBtn.textContent = t('enter.submitting');
    try {
      const entry = await addEntry({
        battleId: battle.id,
        strain: strain.slice(0, STRAIN_MAX),
        description: desc.value.trim().slice(0, DESC_MAX),
        photo: cleaned.blob,
        width: cleaned.width,
        height: cleaned.height,
      });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      root.innerHTML = header + entryCard(entry, t('enter.success.title'), t('enter.success.text'), { success: true, canWithdraw: true });
      wireWithdraw(root, entry, battle.id);
    } catch (e) {
      console.error(e);
      showError(e.code || 'error.generic');
      submitBtn.disabled = false;
      submitBtn.textContent = t('enter.submit');
    }
  });
}

function entryCard(entry, title, text, { success = false, canWithdraw = false } = {}) {
  return `
    <section class="card ${success ? 'card-success' : ''}">
      <h2>${esc(title)}</h2>
      <p>${esc(text)}</p>
      <figure class="entry">
        <img src="${esc(entry.photoUrl)}" alt="${esc(entry.strain || '')}">
        <figcaption>
          ${entry.strain ? `<strong>${esc(entry.strain)}</strong>` : ''}
          ${entry.description ? `<p>${esc(entry.description)}</p>` : ''}
          <p class="small">${esc(t('enter.statusLabel'))}:
            <span class="pill pill-${esc(entry.status)}">${esc(t(`enter.status.${entry.status}`))}</span></p>
        </figcaption>
      </figure>
      ${canWithdraw ? `<button class="btn btn-ghost btn-small" type="button" data-withdraw>${esc(t('enter.withdraw'))}</button>` : ''}
    </section>`;
}

function wireWithdraw(root, entry, battleId) {
  const btn = root.querySelector('[data-withdraw]');
  if (!btn) return;
  let armed = false; // first tap asks, second tap withdraws (no browser pop-ups needed)
  btn.addEventListener('click', async () => {
    if (!armed) {
      armed = true;
      btn.textContent = t('enter.withdrawConfirm');
      btn.classList.add('btn-danger');
      return;
    }
    btn.disabled = true;
    try {
      await withdrawEntry(entry);
      renderEnter(root, { id: battleId });
    } catch (e) {
      btn.disabled = false;
      btn.textContent = t(e.code || 'error.generic');
    }
  });
}
