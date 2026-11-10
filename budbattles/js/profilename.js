// "WÄHLE DEINEN PROFILNAMEN" – one-time popup for members without a profile name
// (everyone who signed up before profile names existed). "Später" asks again next visit.
import { t } from './i18n.js';
import { getCurrentUser, checkProfileName, setProfileName, updateProfileDetails } from './store.js';
import { esc } from './ui.js';

let askedThisVisit = false;

export function resetProfileNameCheck() { askedThisVisit = false; }

/** Shows the popup if needed. Resolves when it is closed (or not needed). */
export async function checkProfileName_popup(onDone) {
  const user = await getCurrentUser();
  if (!user || !user.hasProfileNames || user.username || askedThisVisit || document.querySelector('.modal-backdrop')) return;
  askedThisVisit = true;
  const suggestion = (user.displayName || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 20);
  await new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `
      <form class="modal name-modal" role="dialog" aria-modal="true" aria-labelledby="name-title" novalidate>
        <p class="eyebrow">${esc(t('nameModal.eyebrow'))}</p>
        <h2 id="name-title" class="name-title">${esc(t('nameModal.title'))}</h2>
        <p class="small">${esc(t('nameModal.text'))}</p>
        <div class="field">
          <label class="label" for="nm-name">${esc(t('profile.nameLabel'))}</label>
          <input id="nm-name" type="text" maxlength="20" autocomplete="nickname" value="${esc(suggestion)}">
          <p class="hint" data-hint>${esc(t('profile.nameRules'))}</p>
        </div>
        <div class="field">
          <label class="label" for="nm-insta">${esc(t('profile.instagram'))}</label>
          <input id="nm-insta" type="text" maxlength="31" autocomplete="off" placeholder="@deinname" value="${esc(user.instagram ? `@${user.instagram}` : '')}">
        </div>
        <p class="error small" data-error hidden></p>
        <button type="submit" class="btn btn-primary btn-block">${esc(t('auth.save'))}</button>
        <button type="button" class="link-button" data-later>${esc(t('champion.later'))}</button>
      </form>`;
    document.body.appendChild(wrap);
    const form = wrap.querySelector('form');
    const input = form.querySelector('#nm-name');
    const hint = form.querySelector('[data-hint]');
    const err = form.querySelector('[data-error]');
    const close = () => { wrap.remove(); resolve(); };
    input.focus();
    let timer;
    input.addEventListener('input', () => {
      err.hidden = true; // old error no longer applies
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const v = input.value.trim();
        const st = /^[A-Za-z0-9_]{3,20}$/.test(v) ? await checkProfileName(v) : 'invalid';
        hint.textContent = t(`profile.nameStatus.${st}`);
        hint.className = st === 'ok' ? 'hint badge-ok' : 'hint error';
      }, 350);
    });
    form.querySelector('[data-later]').addEventListener('click', close);
    wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.hidden = true;
      const btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      try {
        await setProfileName(input.value.trim());
        await updateProfileDetails({
          instagram: form.querySelector('#nm-insta').value, growSetup: user.growSetup, lights: user.lights,
          medium: user.medium, favStrain: user.favStrain, bio: user.bio,
        });
        close();
        onDone?.();
      } catch (ex) {
        err.textContent = t(ex.code || 'error.generic');
        err.hidden = false;
        btn.disabled = false;
      }
    });
  });
}
