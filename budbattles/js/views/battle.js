// BATTLE PAGE: theme, dates, partner, rules, and the prize (members only).
import { t, tc, formatDate } from '../i18n.js';
import {
  getBattle, getCurrentBattle, battleStatus, countEntries, getSettings, getCurrentUser, getPrize, now,
} from '../store.js';
import { esc, splitDuration } from '../ui.js';

export async function renderBattle(root, { id } = {}) {
  const battle = id ? await getBattle(id) : await getCurrentBattle();
  if (!battle) {
    root.innerHTML = `<section class="card"><p>${esc(t('battle.none'))}</p></section>`;
    return;
  }

  const status = battleStatus(battle);
  const [entries, settings, user] = await Promise.all([countEntries(battle.id), getSettings(), getCurrentUser()]);
  // The prize is only ever requested for logged-in members (18+ confirmed at sign-up).
  const prize = user && settings.showPrize ? await getPrize(battle.id) : null;
  const showPartner = settings.showPartner && battle.partner;
  const rules = tc(battle.rules) || [];

  root.innerHTML = `
    <section class="hero">
      <p class="eyebrow">${esc(battleLabel(battle))}</p>
      <h1 class="neon-title">${esc(tc(battle.theme))}</h1>
      <p class="hero-summary">${esc(tc(battle.summary))}</p>
      <div class="hero-meta">
        <span class="pill pill-${status}">${esc(t(`battle.status.${status}`))}</span>
        <span class="muted">${esc(t('battle.entriesCount', { count: entries }))}</span>
      </div>
      ${countdownHtml(battle, status)}
      <div class="actions">
        ${status === 'open' ? `<a class="btn btn-primary" href="#/enter/${encodeURIComponent(battle.id)}">${esc(t('battle.ctaEnter'))}</a>` : ''}
        <a class="btn ${status === 'voting' ? 'btn-primary' : 'btn-ghost'}" href="#/standings/${encodeURIComponent(battle.id)}">
          ${esc(t(status === 'voting' ? 'battle.ctaVote' : 'battle.ctaStandings'))}</a>
      </div>
    </section>

    <section class="card">
      <h2>${esc(t('battle.dates'))}</h2>
      <dl class="dates">
        ${dateRow(t('battle.entriesOpen'), battle.start, status === 'upcoming')}
        ${dateRow(t('battle.entriesClose'), battle.entriesClose, status === 'open')}
        ${dateRow(t('battle.votingEnds'), battle.votingEnds, status === 'voting')}
      </dl>
    </section>

    ${prize ? `
    <section class="card card-pink">
      <h2>${esc(t('battle.prize'))}</h2>
      <p class="prize-text">${esc(tc(prize.text))}</p>
      ${tc(prize.terms) ? `<p class="muted small">${esc(tc(prize.terms))}</p>` : ''}
      <p class="muted small">${esc(t('battle.free'))}</p>
    </section>` : `
    <section class="card">
      <p class="muted small">${esc(t('battle.free'))}</p>
      ${user ? '' : `<p class="small"><a class="link" href="#/profile">${esc(t('battle.membersMore'))}</a></p>`}
    </section>`}

    ${showPartner ? `
    <section class="card partner">
      <h2>${esc(t('battle.partner'))}</h2>
      ${battle.partner.logo ? `<img class="partner-logo" src="${esc(battle.partner.logo)}" alt="${esc(battle.partner.name)}" loading="lazy">` : ''}
      <p class="partner-name">${esc(battle.partner.name)}</p>
      ${/^https:\/\//.test(battle.partner.url || '') ? `<a class="link" href="${esc(battle.partner.url)}" target="_blank" rel="noopener noreferrer">${esc(t('battle.partnerVisit'))} ↗</a>` : ''}
    </section>` : ''}

    ${rules.length ? `<section class="card">
      <h2>${esc(t('battle.rules'))}</h2>
      <ol class="rules">
        ${rules.map((r) => `<li>${esc(r)}</li>`).join('')}
      </ol>
    </section>` : ''}
  `;

  startCountdowns(root);
}

export function battleLabel(battle) {
  return battle.number ? t('battle.numbered', { n: battle.number }) : t('battle.title');
}

/** Countdown block for a battle; started by startCountdowns(). */
export function countdownHtml(battle, status = battleStatus(battle)) {
  const target = { upcoming: battle.start, open: battle.entriesClose, voting: battle.votingEnds }[status];
  if (!target) return `<div class="countdown"><span class="countdown-label">${esc(t('battle.countdown.ended'))}</span></div>`;
  return `<div class="countdown">
      <span class="countdown-label">${esc(t(`battle.countdown.${status}`))}</span>
      <span class="countdown-value" data-countdown="${esc(target)}"></span>
    </div>`;
}

export function startCountdowns(root) {
  root.querySelectorAll('[data-countdown]').forEach((el) => {
    const target = new Date(el.dataset.countdown);
    const tick = () => {
      if (!el.isConnected) { clearInterval(timer); return; } // user left the page
      const { d, h, m, s } = splitDuration(target - now());
      el.textContent = `${d}${t('time.d')} ${h}${t('time.h')} ${m}${t('time.m')} ${s}${t('time.s')}`;
    };
    const timer = setInterval(tick, 1000);
    tick();
  });
}

function dateRow(label, iso, active) {
  return `<div class="date-row${active ? ' active' : ''}"><dt>${esc(label)}</dt><dd><time datetime="${esc(iso)}">${esc(formatDate(iso))}</time></dd></div>`;
}
