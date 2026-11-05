// START PAGE: current battle with countdown, newest approved photos, how it works.
import { t, tc } from '../i18n.js';
import { getCurrentBattle, battleStatus, listLatestApproved } from '../store.js';
import { esc } from '../ui.js';
import { battleLabel, countdownHtml, startCountdowns } from './battle.js';

const LATEST = 6;

export async function renderHome(root) {
  const [battle, latest] = await Promise.all([getCurrentBattle(), listLatestApproved(LATEST)]);
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
        ${status === 'open' ? `<a class="btn btn-primary" href="#/enter/${enc(battle.id)}">${esc(t('battle.ctaEnter'))}</a>` : ''}
        ${status === 'voting' ? `<a class="btn btn-primary" href="#/standings/${enc(battle.id)}">${esc(t('battle.ctaVote'))}</a>` : ''}
        <a class="btn btn-ghost" href="#/battle/${enc(battle.id)}">${esc(t('home.details'))}</a>
      </div>
    </section>` : `<section class="card"><p>${esc(t('battle.none'))}</p></section>`}

    <section class="home-section">
      <div class="section-head">
        <h2>${esc(t('home.latest'))}</h2>
        ${latest.length && battle ? `<a class="link small" href="#/standings/${enc(battle.id)}">${esc(t('home.seeAll'))}</a>` : ''}
      </div>
      ${latest.length ? `
        <div class="thumb-grid">
          ${latest.map((e) => `
            <a class="thumb" href="#/standings/${enc(e.battleId)}">
              <img src="${esc(e.photoUrl)}" alt="${esc(e.strain || e.displayName)}" loading="lazy">
              <span class="thumb-caption">${esc(e.displayName)}</span>
            </a>`).join('')}
        </div>`
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
}
