// BATTLE PAGE: theme, dates, partner, rules, and the prize (members only).
import { t, tc, formatDate } from '../i18n.js';
import {
  getBattle, getCurrentBattle, battleStatus, countEntries, getSettings, getCurrentUser, getPrize, now, getStandings,
} from '../store.js';
import { neonCardHtml, pillFor, cardEyebrow } from '../entrycard.js';
import { esc, splitDuration } from '../ui.js';

// Big picture at the top of a battle page (behind the title), per battle.
const BATTLE_HEROES = {
  'draft-sesh-setup': 'assets/battles/sesh-setup.webp',
};

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

  const fixedRules = [t('rules.adults'), ...(user ? [t('rules.winnersAge')] : [])]; // prize wording only for members
  const host = battle.partner?.kind === 'host' ? battle.partner : null;

  const heroImage = BATTLE_HEROES[battle.id] || '';
  const titleHtml = `
      <p class="eyebrow">${esc(battleLabel(battle))}</p>
      <h1 class="neon-title">${esc(tc(battle.theme))}</h1>
      ${tc(battle.subtitle) ? `<p class="hero-subtitle">${esc(tc(battle.subtitle))}</p>` : ''}`;

  root.innerHTML = `<div class="${battle.style === 'pink' ? 'battle-pink' : ''}">
    ${heroImage ? `<section class="battle-cover">
      <img src="${esc(heroImage)}" alt="" decoding="async" fetchpriority="high">
      <div class="battle-cover-text">${titleHtml}</div>
    </section>` : ''}
    ${testNotice(battle)}
    <section class="hero${heroImage ? ' hero-after-cover' : ''}">
      ${heroImage ? '' : titleHtml}
      <p class="hero-summary">${esc(tc(battle.summary))}</p>
      <div class="hero-meta">
        <span class="pill pill-${status}">${esc(t(`battle.status.${status}`))}</span>
        <span class="muted">${esc(t('battle.entriesCount', { count: entries }))}</span>
      </div>
      ${countdownHtml(battle, status)}
      ${foundingHtml(battle, status, entries)}
      <div class="actions">
        ${status === 'open' ? `<a class="btn btn-primary btn-go" href="#/enter/${encodeURIComponent(battle.id)}">${esc(t('battle.ctaEnter'))}</a>` : ''}
        <a class="btn ${status === 'voting' ? 'btn-primary btn-go' : 'btn-ghost'}" href="#/standings/${encodeURIComponent(battle.id)}">
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
      ${showPartner && battle.partner.logo ? `<div class="prize-partner"><img class="partner-logo" src="${esc(battle.partner.logo)}" alt="${esc(battle.partner.name)}" loading="lazy">
        <span>${esc(t('battle.prizePartner', { name: battle.partner.name }))}</span></div>` : ''}
      <p class="prize-text">${esc(tc(prize.text))}</p>
      ${tc(prize.terms) ? `<p class="muted small">${esc(tc(prize.terms))}</p>` : ''}
      <p class="muted small">${esc(t('battle.free'))}</p>
    </section>` : `
    <section class="card">
      <p class="muted small">${esc(t('battle.free'))}</p>
      ${user ? '' : `<p class="small"><a class="link" href="#/profile">${esc(t('battle.membersMore'))}</a></p>`}
    </section>`}

    ${host ? `
    <section class="card partner partner-host">
      <h2>${esc(t('battle.hostedWith'))}</h2>
      ${host.logo ? `<img class="partner-logo" src="${esc(host.logo)}" alt="${esc(host.name)}" loading="lazy">`
        : `<div class="logo-placeholder" aria-hidden="true">${esc(t('battle.logoPlaceholder'))}</div>`}
      <p class="partner-name">${esc(host.name)}</p>
      ${/^https:\/\//.test(host.url || '') ? `<a class="link" href="${esc(host.url)}" target="_blank" rel="noopener noreferrer">${esc(t('battle.partnerVisit'))} ↗</a>` : ''}
    </section>` : ''}

    ${showPartner && !host && !prize ? `
    <section class="card partner">
      <h2>${esc(t('battle.partner'))}</h2>
      ${battle.partner.logo ? `<img class="partner-logo" src="${esc(battle.partner.logo)}" alt="${esc(battle.partner.name)}" loading="lazy">` : ''}
      ${battle.partner.logo ? '' : `<p class="partner-name">${esc(battle.partner.name)}</p>`}
      ${/^https:\/\//.test(battle.partner.url || '') ? `<a class="link" href="${esc(battle.partner.url)}" target="_blank" rel="noopener noreferrer">${esc(t('battle.partnerVisit'))} ↗</a>` : ''}
    </section>` : ''}

    <section class="card">
      <h2>${esc(t('battle.rules'))}</h2>
      ${rules.length ? `<ol class="rules">
        ${rules.map((r) => `<li>${esc(r)}</li>`).join('')}
      </ol>` : ''}
      <ul class="rules-fixed">
        ${fixedRules.map((r) => `<li>🔞 ${esc(r)}</li>`).join('')}
      </ul>
    </section>

    <section class="home-section" data-entries hidden>
      <div class="section-head">
        <h2>${esc(t('battle.entries'))}</h2>
        <a class="link small" href="#/standings/${encodeURIComponent(battle.id)}">${esc(t(status === 'voting' ? 'battle.ctaVote' : 'battle.ctaStandings'))} →</a>
      </div>
      <ul class="ncard-grid" data-entry-list></ul>
    </section>
  </div>`;

  startCountdowns(root);

  // every approved entry as a neon card (loaded after the page is visible)
  try {
    const entries = await getStandings(battle.id);
    const box = root.querySelector('[data-entries]');
    if (!entries.length || !box?.isConnected) return;
    const eyebrow = cardEyebrow(battle);
    const showVotes = status === 'voting' || status === 'ended';
    box.querySelector('[data-entry-list]').innerHTML = entries.map((e) => neonCardHtml(e, {
      eyebrow, pill: pillFor(e, entries, status), top: showVotes && e.rank === 1 && e.votes > 0, compact: true,
    })).join('');
    box.hidden = false;
  } catch { /* the rest of the page still works */ }
}

export function battleLabel(battle) {
  if (battle.isDraft) return t('battle.draftLabel');
  if (battle.isTest) return t('battle.testLabel');
  return battle.number ? t('battle.numbered', { n: battle.number }) : t('battle.title');
}

/** Shown on every page of a hidden test battle. */
export function testNotice(battle) {
  if (battle?.isDraft) return `<p class="test-notice draft-notice" role="note">📝 ${esc(t('battle.draftNotice'))}</p>`;
  return battle?.isTest ? `<p class="test-notice" role="note">🧪 ${esc(t('battle.testNotice'))}</p>` : '';
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
    // Built once; afterwards only the digits change, and every number has a fixed
    // width (2 digits, tabular figures), so the box never jumps or wraps.
    el.innerHTML = ['d', 'h', 'm', 's'].map((u) => `<span class="cd-part"><span class="cd-num" data-u="${u}"></span><span class="cd-unit">${esc(t(`time.${u}`))}</span></span>`).join(' ');
    const nums = Object.fromEntries([...el.querySelectorAll('[data-u]')].map((n) => [n.dataset.u, n]));
    const tick = () => {
      if (!el.isConnected) { clearInterval(timer); return; } // user left the page
      const parts = splitDuration(target - now());
      for (const u of ['d', 'h', 'm', 's']) {
        const text = u === 'd' ? String(parts.d) : String(parts[u]).padStart(2, '0');
        if (nums[u].textContent !== text) {
          const first = !nums[u].textContent;
          nums[u].textContent = text;
          if (!first) { nums[u].classList.remove('cd-tick'); void nums[u].offsetWidth; nums[u].classList.add('cd-tick'); } // small flip when a number changes
        }
      }
    };
    const timer = setInterval(tick, 1000);
    tick();
  });
}

function dateRow(label, iso, active) {
  return `<div class="date-row${active ? ' active' : ''}"><dt>${esc(label)}</dt><dd><time datetime="${esc(iso)}">${esc(formatDate(iso))}</time></dd></div>`;
}

/** Battle #1: "🏅 Founding Member: X/25 left" (the first 25 entries keep the badge forever). */
const FOUNDING_SPOTS = 25;
function foundingHtml(battle, status, entries) {
  if (battle.number !== 1 || battle.isTest || !['upcoming', 'open'].includes(status)) return '';
  const left = Math.max(0, FOUNDING_SPOTS - (entries || 0));
  if (!left) return '';
  return `<p class="founding-left">🏅 ${esc(t('battle.foundingLeft', { left, total: FOUNDING_SPOTS }))}</p>`;
}
