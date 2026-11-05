// APP SHELL: header with logo and menu, bottom navigation, demo phase switch,
// and choosing which screen to show. Addresses look like  #/battle/<id>.
import { initI18n, setLang, getLang, t, LANGS } from './i18n.js';
import {
  initStore, onAuthEvent, isDemo, getCurrentUser, getDemoPhase, setDemoPhase,
} from './store.js';
import { renderHome } from './views/home.js';
import { renderBattle } from './views/battle.js';
import { renderEnter } from './views/enter.js';
import { renderStandings } from './views/standings.js';
import { renderProfile, renderNewPassword } from './views/profile.js';
import { renderTerms } from './views/terms.js';
import { renderAdmin } from './views/admin.js';
import { renderSoon } from './views/soon.js';
import { renderTests } from './views/tests.js';
import { checkChampion, resetChampionCheck } from './champion.js';
import { esc } from './ui.js';

const routes = {
  '': renderHome,
  battle: renderBattle,
  enter: renderEnter,
  standings: renderStandings,
  gallery: renderSoon('gallery'),
  business: renderSoon('business'),
  profile: renderProfile,
  'new-password': renderNewPassword,
  terms: renderTerms,
  admin: renderAdmin,
  tests: renderTests,
};

// Bottom bar: the five things people use most.
const NAV = [
  { key: 'home', path: '', icon: '⌂' },
  { key: 'battle', path: 'battle', icon: '⚔' },
  { key: 'enter', path: 'enter', icon: '＋' },
  { key: 'standings', path: 'standings', icon: '★' },
  { key: 'profile', path: 'profile', icon: '◉' },
];

// Full menu (☰ in the header): everything, including pages that are coming soon.
const MENU = [
  { key: 'home', path: '' },
  { key: 'battle', path: 'battle' },
  { key: 'enter', path: 'enter' },
  { key: 'standings', path: 'standings' },
  { key: 'gallery', path: 'gallery', soon: true },
  { key: 'business', path: 'business', soon: true },
  { key: 'profile', path: 'profile' },
  { key: 'tests', path: 'tests', testersOnly: true },
  { key: 'admin', path: 'admin', adminOnly: true },
  { key: 'terms', path: 'terms' },
];

const DEMO_PHASES = ['real', 'open', 'voting', 'ended'];

function parseHash() {
  const [, page = '', id] = (location.hash || '#/').split('/');
  return { page, id: id ? decodeURIComponent(id) : undefined };
}

// Pages that belong to one battle. While you look at one, the bottom bar's
// Battle / Enter / Standings buttons open THAT battle (also a test battle).
const BATTLE_PAGES = ['battle', 'enter', 'standings'];

async function render() {
  const { page, id } = parseHash();
  await renderChrome(page, BATTLE_PAGES.includes(page) ? id : undefined);
  const main = document.getElementById('main');
  const view = routes[page];
  if (!view) {
    main.innerHTML = `<section class="card"><p>${esc(t('app.notFound'))}</p>
      <a class="btn btn-ghost" href="#/">${esc(t('app.backHome'))}</a></section>`;
    return;
  }
  // Each visit gets a fresh container. If you tap on before a slow screen has
  // loaded, that screen keeps drawing into its old (now detached) container
  // and can't paint over the screen you actually opened.
  const container = document.createElement('div');
  container.innerHTML = `<p class="muted center">${esc(t('app.loading'))}</p>`;
  main.replaceChildren(container);
  try {
    await view(container, { id });
  } catch (e) {
    console.error(e);
    container.innerHTML = `<section class="card"><p class="error">${esc(t('error.generic'))}</p></section>`;
  }
  if (!container.isConnected) return;
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

async function renderChrome(activePage, battleId) {
  document.title = t('app.name');
  const user = await getCurrentUser();
  const isActive = (path) => path === activePage || (path === 'profile' && activePage === 'admin');

  document.getElementById('topbar').innerHTML = `
    <a class="brand" href="#/" aria-label="${esc(t('app.name'))} – ${esc(t('nav.home'))}">
      <img src="assets/logo-full.webp" alt="${esc(t('app.name'))}" width="640" height="189">
    </a>
    <div class="topbar-tools">
      <div class="lang" role="group" aria-label="${esc(t('lang.switch'))}">
        ${LANGS.map((l) => `<button type="button" data-lang="${l}" aria-pressed="${l === getLang()}" title="${esc(t(`lang.${l}`))}">${l.toUpperCase()}</button>`).join('')}
      </div>
      <button type="button" class="menu-button" data-menu-open aria-expanded="false" aria-controls="menu" aria-label="${esc(t('menu.open'))}">☰</button>
    </div>`;

  document.getElementById('menu').innerHTML = `
    <div class="menu-backdrop" data-menu-close></div>
    <nav class="menu-sheet" aria-label="${esc(t('menu.title'))}">
      <div class="menu-head">
        <span class="eyebrow">${esc(t('menu.title'))}</span>
        <button type="button" class="menu-button" data-menu-close aria-label="${esc(t('menu.close'))}">✕</button>
      </div>
      ${MENU.filter((m) => (!m.adminOnly || user?.isAdmin) && (!m.testersOnly || user?.canTest)).map((m) => `
        <a href="#/${m.path}" class="menu-link ${isActive(m.path) ? 'active' : ''}" data-menu-close>
          <span>${esc(t(`nav.${m.key}`))}</span>
          ${m.soon ? `<span class="pill pill-upcoming">${esc(t('soon.badge'))}</span>` : ''}
        </a>`).join('')}
    </nav>`;

  const banner = document.getElementById('demo-banner');
  banner.hidden = !isDemo;
  if (isDemo) {
    const phase = getDemoPhase();
    banner.innerHTML = `
      <span>${esc(t('app.demoBanner'))}</span>
      <label class="demo-phase">${esc(t('demo.phase'))}
        <select data-demo-phase>
          ${DEMO_PHASES.map((p) => `<option value="${p}" ${p === phase ? 'selected' : ''}>${esc(t(`demo.phase.${p}`))}</option>`).join('')}
        </select>
      </label>`;
  }

  const navHref = (n) => (battleId && BATTLE_PAGES.includes(n.path) ? `#/${n.path}/${encodeURIComponent(battleId)}` : `#/${n.path}`);
  document.getElementById('bottomnav').innerHTML = NAV.map((n) => `
    <a href="${navHref(n)}" class="${isActive(n.path) ? 'active' : ''}" ${n.path === activePage ? 'aria-current="page"' : ''}>
      <span class="nav-icon" aria-hidden="true">${n.icon}</span><span>${esc(t(`nav.${n.key}`))}</span>
    </a>`).join('');
}

function setMenu(open) {
  const menu = document.getElementById('menu');
  menu.hidden = !open;
  document.querySelector('[data-menu-open]')?.setAttribute('aria-expanded', String(open));
  if (open) menu.querySelector('.menu-link')?.focus();
}

// Badge name bubble: tap a badge icon to see what it is.
let tipTimer;
function showBadgeTip(btn) {
  let tip = document.getElementById('badge-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'badge-tip';
    tip.className = 'badge-tip';
    tip.setAttribute('role', 'status');
    document.body.appendChild(tip);
  }
  tip.textContent = btn.dataset.badgeName;
  tip.hidden = false;
  const r = btn.getBoundingClientRect();
  const w = tip.offsetWidth;
  tip.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
  tip.style.top = `${Math.max(8, r.top - tip.offsetHeight - 8)}px`;
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => { tip.hidden = true; }, 2500);
}
function hideBadgeTip() {
  const tip = document.getElementById('badge-tip');
  if (tip) tip.hidden = true;
}
window.addEventListener('scroll', hideBadgeTip, { passive: true });

document.addEventListener('click', async (e) => {
  const badge = e.target.closest('.badge-btn');
  if (badge) { e.preventDefault(); e.stopPropagation(); return showBadgeTip(badge); }
  hideBadgeTip();
  if (e.target.closest('[data-menu-open]')) return setMenu(true);
  if (e.target.closest('[data-menu-close]')) return setMenu(false);
  const btn = e.target.closest('[data-lang]');
  if (!btn) return;
  await setLang(btn.dataset.lang);
  render();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setMenu(false);
});

document.addEventListener('change', async (e) => {
  if (!e.target.matches('[data-demo-phase]')) return;
  await setDemoPhase(e.target.value);
  render();
});

window.addEventListener('hashchange', () => { setMenu(false); render(); });

(async () => {
  await initI18n();
  await initStore();
  onAuthEvent((event) => {
    if (event === 'PASSWORD_RECOVERY') return;
    render();
    if (event === 'SIGNED_IN') { resetChampionCheck(); checkChampion(render); } // "on their next login"
  });
  await render();
  checkChampion(render); // also hands out Top 3 / champion choices for battles that just ended
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW registration failed', err));
  }
})();
