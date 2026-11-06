// "COMING SOON" pages (Gallery, Business). Placeholders until they are built.
// The Business page has a small "Interested?" form that saves an email.
import { t, getLang } from '../i18n.js';
import { registerBusinessInterest } from '../store.js';
import { esc } from '../ui.js';

export function renderSoon(key) {
  return async (root) => {
    root.innerHTML = `
      <section class="hero hero-small">
        <p class="eyebrow">${esc(t('soon.badge'))}</p>
        <h1 class="neon-title">${esc(t(`nav.${key}`))}</h1>
      </section>
      <section class="card">
        <p>${esc(t(`soon.${key}`))}</p>
        ${key === 'business' ? `<div class="actions"><button type="button" class="btn btn-primary" data-interest>${esc(t('interest.button'))}</button></div>` : ''}
        <div data-interest-slot></div>
        <a class="btn btn-ghost btn-small" href="#/">${esc(t('app.backHome'))}</a>
      </section>`;
    if (key === 'business') wireInterest(root);
  };
}

function wireInterest(root) {
  const slot = root.querySelector('[data-interest-slot]');
  const openBtn = root.querySelector('[data-interest]');
  openBtn.addEventListener('click', () => {
    openBtn.hidden = true;
    slot.innerHTML = `
      <form class="form interest-form" novalidate>
        <div class="field">
          <label class="label" for="i-email">${esc(t('auth.email'))}</label>
          <input id="i-email" type="email" autocomplete="email" maxlength="200" required>
        </div>
        <div class="field">
          <label class="label" for="i-company">${esc(t('interest.company'))}</label>
          <input id="i-company" type="text" autocomplete="organization" maxlength="120">
        </div>
        <label class="check"><input type="checkbox" id="i-consent"><span>${esc(t('interest.consent'))}</span></label>
        <p class="error" role="alert" data-error hidden></p>
        <button type="submit" class="btn btn-primary btn-block">${esc(t('interest.submit'))}</button>
      </form>`;
    const form = slot.querySelector('form');
    const err = form.querySelector('[data-error]');
    const show = (k) => { err.textContent = t(k); err.hidden = false; };
    form.querySelector('#i-email').focus();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.hidden = true;
      const email = form.querySelector('#i-email').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return show('error.emailInvalid');
      if (!form.querySelector('#i-consent').checked) return show('error.interestConsent');
      const btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      try {
        await registerBusinessInterest({ email, company: form.querySelector('#i-company').value.trim(), lang: getLang() });
        slot.innerHTML = `<p class="badge-ok interest-done">✓ ${esc(t('interest.thanks'))}</p>`;
      } catch (ex) {
        show(ex.code || 'error.generic');
        btn.disabled = false;
      }
    });
  });
}
