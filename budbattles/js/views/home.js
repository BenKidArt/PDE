// START PAGE: current battle with countdown, newest approved photos, how it works.
import { t, tc } from '../i18n.js';
import { getCurrentBattle, battleStatus, getStandings } from '../store.js';
import { neonCardHtml, pillFor, cardEyebrow } from '../entrycard.js';
import { canInstall, bannerClosed, closeBanner, startInstall } from '../install.js';
import { esc } from '../ui.js';
import { battleLabel, countdownHtml, startCountdowns } from './battle.js';

const LATEST = 10;

export async function renderHome(root) {
  const battle = await getCurrentBattle();
  let entries = [];
  try { entries = battle ? await getStandings(battle.id) : []; } catch { /* start page still shows */ }
  const status = battle && battleStatus(battle);
  const enc = (id) => encodeURIComponent(id);

  root.innerHTML = `
    <figure class="home-hero-media">
      <img src="assets/hero-trophy.webp" alt="${esc(t('home.heroAlt'))}" width="860" height="894" fetchpriority="high" decoding="async">
    </figure>
    <section class="hero home-hero">
      <p class="eyebrow">${esc(t('app.adultsOnly'))}</p>
      <h1 class="home-title">${esc(t('home.title'))}</h1>
      <p class="hero-summary">${esc(t('app.tagline'))}</p>
    </section>

    ${canInstall() && !bannerClosed() ? `
    <aside class="install-banner" data-install-banner>
      <img src="icons/icon-192.png" alt="" width="44" height="44">
      <div class="install-banner-text"><b>${esc(t('install.bannerTitle'))}</b><span>${esc(t('install.bannerText'))}</span></div>
      <button type="button" class="btn btn-primary btn-small" data-install-go>${esc(t('install.button'))}</button>
      <button type="button" class="install-close" data-install-close aria-label="${esc(t('install.close'))}">✕</button>
    </aside>` : ''}

    ${battle ? `
    <section class="card battle-card">
      <div class="battle-card-head">
        <p class="eyebrow">${esc(battleLabel(battle))}</p>
        <span class="pill pill-${status}">${esc(t(`battle.status.${status}`))}</span>
      </div>
      <h2 class="battle-card-title">${esc(tc(battle.theme))}</h2>
      <p>${esc(tc(battle.summary))}</p>
      ${countdownHtml(battle, status)}
      <div class="actions">
        ${status === 'open' ? `<a class="btn btn-primary btn-go" href="#/enter/${enc(battle.id)}">${esc(t('battle.ctaEnter'))}</a>` : ''}
        ${status === 'voting' ? `<a class="btn btn-primary btn-go" href="#/standings/${enc(battle.id)}">${esc(t('battle.ctaVote'))}</a>` : ''}
        <a class="btn btn-ghost" href="#/battle/${enc(battle.id)}">${esc(t('home.details'))}</a>
      </div>
    </section>` : `<section class="card"><p>${esc(t('battle.none'))}</p></section>`}

    <section class="home-section">
      <div class="section-head">
        <h2>${esc(t('home.latest'))}</h2>
        ${entries.length && battle ? `<a class="link small" href="#/standings/${enc(battle.id)}">${esc(t('home.seeAll'))}</a>` : ''}
      </div>
      ${entries.length ? `
        <ul class="ncard-scroller">
          ${homeOrder(entries, status).slice(0, LATEST).map((e) => neonCardHtml(e, {
            eyebrow: cardEyebrow(battle), pill: pillFor(e, entries, status), compact: true,
            top: (status === 'voting' || status === 'ended') && e.rank === 1 && e.votes > 0,
          })).join('')}
        </ul>`
      : `<p class="muted card">${esc(t('home.latestEmpty'))}</p>`}
    </section>

    <section class="home-section">
      <h2>${esc(t('home.howTitle'))}</h2>
      <ol class="steps">
        ${[1, 2, 3].map((n) => `
          <li class="step">
            <span class="step-num" aria-hidden="true">${n}</span>
            <div><strong>${esc(t(`home.step${n}.title`))}</strong><p class="muted small">${esc(t(`home.step${n}.text`))}</p></div>
          </li>`).join('')}
      </ol>
    </section>`;

  startCountdowns(root);
  root.querySelector('[data-install-go]')?.addEventListener('click', () => startInstall());
  root.querySelector('[data-install-close]')?.addEventListener('click', () => {
    closeBanner();
    root.querySelector('[data-install-banner]')?.remove();
  });
}

/** Before voting: newest first. From voting on: in ranking order. */
function homeOrder(entries, status) {
  if (status === 'voting' || status === 'ended') return entries;
  return [...entries].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

