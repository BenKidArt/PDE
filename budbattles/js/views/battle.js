// BATTLE PAGE: theme, dates, prize, partner logo, rules.
import { t, tc, formatDate } from '../i18n.js';
import { getBattle, getCurrentBattle, battleStatus, countEntries, getSettings } from '../store.js';
import { esc, splitDuration } from '../ui.js';

export async function renderBattle(root, { id } = {}) {
  const battle = id ? await getBattle(id) : await getCurrentBattle();
  if (!battle) {
    root.innerHTML = `<section class="card"><p>${esc(t('battle.none'))}</p></section>`;
    return;
  }

  const status = battleStatus(battle);
  const [entries, settings] = await Promise.all([countEntries(battle.id), getSettings()]);
  const showPrize = settings.showPrize && battle.prize && tc(battle.prize);
  const showPartner = settings.showPartner && battle.partner;
  const rules = tc(battle.rules) || [];
  const target = { upcoming: battle.start, open: battle.entriesClose, voting: battle.votingEnds }[status];

  root.innerHTML = `
    <section class="hero">
      <p class="eyebrow">${esc(t('battle.title'))}</p>
      <h1 class="neon-title">${esc(tc(battle.theme))}</h1>
      <p class="hero-summary">${esc(tc(battle.summary))}</p>
      <div class="hero-meta">
        <span class="pill pill-${status}">${esc(t(`battle.status.${status}`))}</span>
        <span class="muted">${esc(t('battle.entriesCount', { count: entries }))}</span>
      </div>
      <div class="countdown" data-countdown>
        ${target ? `<span class="countdown-label">${esc(t(`battle.countdown.${status}`))}</span>
        <span class="countdown-value" data-countdown-value></span>` : `<span class="countdown-label">${esc(t('battle.countdown.ended'))}</span>`}
      </div>
      <div class="actions">
        ${status === 'open' ? `<a class="btn btn-primary" href="#/enter/${encodeURIComponent(battle.id)}">${esc(t('battle.ctaEnter'))}</a>` : ''}
        <a class="btn btn-ghost" href="#/standings/${encodeURIComponent(battle.id)}">${esc(t('battle.ctaStandings'))}</a>
      </div>
    </section>

    <section class="card">
      <h2>${esc(t('battle.dates'))}</h2>
      <dl class="dates">
        ${dateRow(t('battle.start'), battle.start, status === 'upcoming')}
        ${dateRow(t('battle.entriesClose'), battle.entriesClose, status === 'open')}
        ${dateRow(t('battle.votingEnds'), battle.votingEnds, status === 'voting')}
      </dl>
    </section>

    <section class="card card-pink">
      ${showPrize ? `<h2>${esc(t('battle.prize'))}</h2><p>${esc(tc(battle.prize))}</p>` : ''}
      <p class="muted small">${esc(t('battle.free'))}</p>
    </section>

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

  if (target) startCountdown(root.querySelector('[data-countdown-value]'), new Date(target));
}

function dateRow(label, iso, active) {
  return `<div class="date-row${active ? ' active' : ''}"><dt>${esc(label)}</dt><dd><time datetime="${esc(iso)}">${esc(formatDate(iso))}</time></dd></div>`;
}

function startCountdown(el, target) {
  const tick = () => {
    if (!el.isConnected) { clearInterval(timer); return; } // user left the page
    const { d, h, m, s } = splitDuration(target - Date.now());
    el.textContent = `${d}${t('time.d')} ${h}${t('time.h')} ${m}${t('time.m')} ${s}${t('time.s')}`;
  };
  const timer = setInterval(tick, 1000);
  tick();
}
