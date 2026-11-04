// APP SHELL: menu, language switch, and choosing which screen to show.
// Addresses look like  #/battle/<id>  or  #/enter/<id>.
import { initI18n, setLang, getLang, t, LANGS } from './i18n.js';
import { initStore, getCurrentBattle, onAuthEvent, isDemo } from './store.js';
import { renderBattle } from './views/battle.js';
import { renderEnter } from './views/enter.js';
import { renderProfile, renderNewPassword } from './views/profile.js';
import { renderTerms } from './views/terms.js';
import { esc } from './ui.js';

const routes = {
  '': renderHomePlaceholder,
  battle: renderBattle,
  enter: renderEnter,
  standings: renderComingSoon('nav.standings'),
  profile: renderProfile,
  'new-password': renderNewPassword,
  terms: renderTerms,
};

const NAV = [
  { key: 'home', path: '', icon: '⌂' },
  { key: 'battle', path: 'battle', icon: '⚔' },
  { key: 'enter', path: 'enter', icon: '＋' },
  { key: 'standings', path: 'standings', icon: '★' },
  { key: 'profile', path: 'profile', icon: '◉' },
];

function parseHash() {
  const [, page = '', id] = (location.hash || '#/').split('/');
  return { page, id: id ? decodeURIComponent(id) : undefined };
}

async function render() {
  const { page, id } = parseHash();
  renderChrome(page);
  const main = document.getElementById('main');
  const view = routes[page];
  if (!view) {
    main.innerHTML = `<section class="card"><p>${esc(t('app.notFound'))}</p>
      <a class="btn btn-ghost" href="#/">${esc(t('app.backHome'))}</a></section>`;
    return;
  }
  main.innerHTML = `<p class="muted center">${esc(t('app.loading'))}</p>`;
  try {
    await view(main, { id });
  } catch (e) {
    console.error(e);
    main.innerHTML = `<section class="card"><p class="error">${esc(t('error.generic'))}</p></section>`;
  }
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function renderChrome(activePage) {
  document.title = t('app.name');
  document.getElementById('topbar').innerHTML = `
    <a class="brand" href="#/"><img src="icons/icon.svg" alt="" width="28" height="28"><span>Bud<b>Battles</b></span></a>
    <div class="lang" role="group" aria-label="${esc(t('lang.switch'))}">
      ${LANGS.map((l) => `<button type="button" data-lang="${l}" aria-pressed="${l === getLang()}" title="${esc(t(`lang.${l}`))}">${l.toUpperCase()}</button>`).join('')}
    </div>`;
  const banner = document.getElementById('demo-banner');
  banner.textContent = t('app.demoBanner');
  banner.hidden = !isDemo;
  document.getElementById('bottomnav').innerHTML = NAV.map((n) => `
    <a href="#/${n.path}" class="${n.path === activePage ? 'active' : ''}" ${n.path === activePage ? 'aria-current="page"' : ''}>
      <span class="nav-icon" aria-hidden="true">${n.icon}</span><span>${esc(t(`nav.${n.key}`))}</span>
    </a>`).join('');
}

// Temporary screens until they're built in later steps.
async function renderHomePlaceholder(root) {
  const battle = await getCurrentBattle();
  root.innerHTML = `
    <section class="hero">
      <p class="eyebrow">${esc(t('app.adultsOnly'))}</p>
      <h1 class="neon-title">${esc(t('app.name'))}</h1>
      <p class="hero-summary">${esc(t('app.tagline'))}</p>
      ${battle ? `<div class="actions"><a class="btn btn-primary" href="#/battle/${encodeURIComponent(battle.id)}">${esc(t('battle.title'))} →</a></div>` : ''}
    </section>`;
}

function renderComingSoon(titleKey) {
  return async (root) => {
    root.innerHTML = `<section class="hero hero-small"><h1 class="neon-title">${esc(t(titleKey))}</h1></section>
      <section class="card"><p class="muted">${esc(t('app.comingSoon'))}</p></section>`;
  };
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-lang]');
  if (!btn) return;
  await setLang(btn.dataset.lang);
  render();
});

window.addEventListener('hashchange', render);

(async () => {
  await initI18n();
  await initStore();
  onAuthEvent((event) => { if (event !== 'PASSWORD_RECOVERY') render(); });
  await render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW registration failed', err));
  }
})();
