// "COMING SOON" pages (Gallery, Business). Placeholders until they are built.
import { t } from '../i18n.js';
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
        <a class="btn btn-ghost btn-small" href="#/">${esc(t('app.backHome'))}</a>
      </section>`;
  };
}
