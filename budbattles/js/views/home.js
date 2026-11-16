// START PAGE: current battle with countdown, newest approved photos, how it works.
import { t, tc } from '../i18n.js';
import { getCurrentBattle, battleStatus, getStandings, getCurrentUser } from '../store.js';
import { neonCardHtml, pillFor, cardEyebrow } from '../entrycard.js';
import { canInstall, bannerClosed, closeBanner, startInstall } from '../install.js';
import { esc } from '../ui.js';
import { PARTNERS } from '../partners.js';
import { LINK_ICONS } from '../links.js';
import { battleLabel, countdownHtml, startCountdowns } from './battle.js';

const LATEST = 10;

export async function renderHome(root) {
  const [battle, user] = await Promise.all([getCurrentBattle(), getCurrentUser()]);
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
    </section>

    ${partnersHtml(PARTNERS.filter((p) => p.role === 'main'), user ? PARTNERS.filter((p) => p.role === 'upcoming') : [],
      user ? PARTNERS.filter((p) => p.role === 'shop') : [])}`;

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


/** Battle #1 partner + "Upcoming battles with" + "Shop partners" (both members only: names contain "seed").
 *  All partner cards share one compact style; links are the same small round button on every card. */
function partnersHtml(main, upcoming, shops = []) {
  const logo = (p) => (p.logo
    ? `<img class="partner-logo-img${p.round ? ' is-round' : ''}${p.tile ? ' is-tile' : ''}" src="${esc(p.logo)}" alt="${esc(p.name)}" loading="lazy" decoding="async">`
    : `<span class="partner-placeholder" aria-hidden="true">${esc(monogram(p.name))}</span>`);
  const links = (p) => {
    const l = [];
    if (p.instagram) l.push(`<a class="partner-link" href="${esc(p.instagram)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(`${t('home.partnerInstagram')}: ${p.name}`)}" title="${esc(t('home.partnerInstagram'))}">${LINK_ICONS.instagram}</a>`);
    if (p.website) l.push(`<a class="partner-link" href="${esc(p.website)}" target="_blank" rel="noopener noreferrer sponsored" aria-label="${esc(`${t('home.partnerWebsite')}: ${p.name}`)}" title="${esc(t('home.partnerWebsite'))}">${WEB_ICON}</a>`);
    return l.length ? `<span class="partner-links">${l.join('')}</span>` : '';
  };
  const card = (p) => `<li class="partner-card">${logo(p)}<p class="partner-card-name">${esc(p.name)}</p>${links(p)}</li>`;
  return `
    ${main.length ? `<section class="home-section">
      <h2>${esc(t('home.partnerMain'))}</h2>
      ${main.map((p) => `<div class="partner-main">${logo(p)}<p class="partner-main-name">${esc(p.name)}</p>${links(p)}</div>`).join('')}
    </section>` : ''}
    ${upcoming.length ? `<section class="home-section">
      <h2>${esc(t('home.partnerUpcoming'))}</h2>
      <ul class="partner-row" data-hscroll>${upcoming.map(card).join('')}</ul>
    </section>` : ''}
    ${shops.length ? `<section class="home-section">
      <h2>${esc(t('home.partnerShops'))}</h2>
      <ul class="partner-row" data-hscroll>${shops.map(card).join('')}</ul>
    </section>` : ''}`;
}

const WEB_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>';
/** Placeholder until a logo arrives: short names as they are, else initials (Huba Seed Bank → HSB). */
function monogram(name) {
  const words = name.split(/\s+/).filter(Boolean);
  if (name.length <= 5) return name.toUpperCase();
  if (words.length > 1) return words.slice(0, 3).map((w) => w[0]).join('').toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
