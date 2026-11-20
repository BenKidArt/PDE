// BATTLE PAGE (mobile first): banner · status line · partner ticker · rules (closed) ·
// Founding Member strip (Battle #1) · enter button · 2-column entries grid with voting · footer.
// Prize words (banner, prize card, winner rule) only for logged-in members.
import { t, tc, formatDate, getLang } from '../i18n.js';
import {
  getBattle, getCurrentBattle, battleStatus, countEntries, getSettings, getCurrentUser, getPrize, now, getStandings,
  getEntryByUser, getMyVote, castVote,
} from '../store.js';
import { mountTurnstile, turnstileEnabled } from '../turnstile.js';
import { PARTNERS } from '../partners.js';
import { esc, splitDuration } from '../ui.js';

// Big picture at the top of a battle page (behind the title), per battle.
const BATTLE_HEROES = {
  'draft-sesh-setup': 'assets/battles/sesh-setup.webp',
};

// Banner at the very top (members only when it shows the prize – see BANNER_HAS_PRIZE).
const BATTLE_BANNERS = { 'battle-1-frostiest-bud': 'assets/battles/budbattles_battle1_page_banner.jpg' };
const BANNER_HAS_PRIZE = { 'battle-1-frostiest-bud': true };
const FOUNDING_BADGE = 'assets/badges/badge_heart.webp';

export async function renderBattle(root, { id } = {}) {
  const battle = id ? await getBattle(id) : await getCurrentBattle();
  if (!battle) {
    root.innerHTML = `<section class="card"><p>${esc(t('battle.none'))}</p></section>`;
    return;
  }
  const status = battleStatus(battle);
  const [entryCount, settings, user] = await Promise.all([countEntries(battle.id), getSettings(), getCurrentUser()]);
  // prize words only for logged-in members (18+ confirmed at sign-up)
  const prize = user && settings.showPrize ? await getPrize(battle.id).catch(() => null) : null;
  const myEntry = user && status === 'open' ? await getEntryByUser(battle.id, user.id).catch(() => null) : null;
  const isB1 = battle.number === 1 && !battle.isTest;

  // 1) banner (the Battle #1 banner shows the prize → members only; others see the title)
  const banner = BATTLE_BANNERS[battle.id] && (!BANNER_HAS_PRIZE[battle.id] || user) ? BATTLE_BANNERS[battle.id] : '';
  const hero = BATTLE_HEROES[battle.id] || '';
  const titleHtml = `<p class="eyebrow">${esc(battleLabel(battle))}</p><h1 class="neon-title">${esc(tc(battle.theme))}</h1>
    ${tc(battle.subtitle) ? `<p class="hero-subtitle">${esc(tc(battle.subtitle))}</p>` : ''}`;
  const top = banner
    ? `<section class="bt1-banner"><img src="${esc(banner)}" alt="${esc(`${battleLabel(battle)} · ${tc(battle.theme)}`)}" width="1200" height="630" decoding="async" fetchpriority="high"></section>`
    : hero ? `<section class="battle-cover"><img src="${esc(hero)}" alt="" decoding="async" fetchpriority="high"><div class="battle-cover-text">${titleHtml}</div></section>`
      : `<section class="hero hero-small bt1-title">${titleHtml}<p class="hero-summary">${esc(tc(battle.summary))}</p></section>`;

  // 4) rules
  const rules = isB1 ? b1Rules(battle, !!user) : [...(tc(battle.rules) || []), t('rules.adults')];

  root.innerHTML = `<div class="bt1${battle.style === 'pink' ? ' battle-pink' : ''}">
    ${top}
    ${testNotice(battle)}

    <section class="bt1-status">
      <span class="pill pill-${status}">${esc(t(`bt1.pill.${status}`))}</span>
      <p class="bt1-status-line" data-status-line>${esc(statusLine(battle, status))}</p>
    </section>

    ${settings.showPartner ? partnerTicker(user, prize) : ''}


    <details class="card bt1-rules">
      <summary><h2>${esc(t('battle.rules'))}</h2></summary>
      <ol class="rules">${rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ol>
      ${prize && tc(prize.terms) ? `<p class="muted small">${esc(tc(prize.terms))}</p>` : ''}
    </details>

    ${foundingHtml(battle, status, entryCount)}

    ${enterButtonHtml(battle, status, user, myEntry)}

    <section class="bt1-entries" data-entries>
      <div class="section-head">
        <h2>${esc(t('battle.entries'))} <span class="muted small">(${entryCount})</span></h2>
        ${status === 'voting' && user ? `<span class="small" data-vote-note></span>` : ''}
      </div>
      <p class="muted small" data-vote-hint></p>
      <ul class="bt1-grid" data-grid><li class="muted small">${esc(t('app.loading'))}</li></ul>
    </section>

    <p class="bt1-foot">${esc(t('bt1.footer'))}</p>
  </div>`;

  // ticker pauses while a finger is on it
  const tk = root.querySelector('[data-ticker]');
  if (tk) {
    const hold = () => tk.classList.add('is-paused'), go = () => tk.classList.remove('is-paused');
    tk.addEventListener('pointerdown', hold); ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => tk.addEventListener(ev, go));
  }

  // status line: updates every 30 s; when the phase changes the page is drawn again
  const lineEl = root.querySelector('[data-status-line]');
  const tick = setInterval(() => {
    if (!lineEl.isConnected) { clearInterval(tick); return; }
    const st = battleStatus(battle);
    if (st !== status) { clearInterval(tick); renderBattle(root, { id: battle.id }); return; }
    lineEl.textContent = statusLine(battle, st);
  }, 30000);

  await drawGrid(root, battle, status, user);
}

/** "Entries open in 1d 4h" / "Entries close in …" / "Voting ends in …" / "Battle over" */
function statusLine(battle, status) {
  const target = { upcoming: battle.start, open: battle.entriesClose, voting: battle.votingEnds }[status];
  if (!target) return t('bt1.line.ended');
  const p = splitDuration(new Date(target) - now());
  const left = p.d > 0 ? `${p.d}${t('time.d')} ${p.h}${t('time.h')}` : p.h > 0 ? `${p.h}${t('time.h')} ${p.m}${t('time.m')}` : `${Math.max(1, p.m)}${t('time.m')}`;
  return t(`bt1.line.${status}`, { left });
}

function b1Rules(battle, member) {
  return [
    t('bt1.rule.photo'), t('bt1.rule.older'), t('bt1.rule.one'), t('bt1.rule.legal'), t('bt1.rule.review'),
    t('bt1.rule.votes'),
    t(member ? 'bt1.rule.winner' : 'bt1.rule.results', { date: dayOnly(battle.votingEnds) }),
  ];
}

/** "6 December" (Finnish calendar day – Battle #1 runs on Finnish time). */
function dayOnly(iso) {
  try { return new Date(iso).toLocaleDateString(getLang() === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'long', timeZone: 'Europe/Helsinki' }); }
  catch { return formatDate(iso); }
}

/** Partner ticker (under the status line): one thin row of logos scrolling left in an endless loop
 *  (pauses while touched). Cannapot = this battle's prize partner; all others are marked "Upcoming".
 *  Visitors see only the main partner (same rule as the home page: some partner names contain
 *  "seed" / "Samen"); members see all. Cannapot (main) gets a gold border + the prize for members. */
function partnerTicker(user, prize) {
  const list = PARTNERS.filter((p) => p.role === 'main' || user);
  if (!list.length) return '';
  let row = [...list];
  while (row.length < 8) row = row.concat(list); // repeat so the loop looks full
  const item = (p, hidden) => {
    const url = p.website || p.instagram || '';
    const inner = `${p.logo ? `<img src="${esc(p.logo)}" alt="${esc(p.name)}" loading="lazy" decoding="async">` : `<span class="bt1-tk-name">${esc(p.name)}</span>`}
      ${p.role === 'main' && prize ? `<span class="bt1-tk-prize">${esc(t('bt1.tickerPrize', { prize: tc(prize.text) }))}</span>` : ''}
      ${p.role !== 'main' ? `<span class="bt1-tk-up">${esc(t('bt1.upcoming'))}</span>` : ''}`;
    const cls = `bt1-tk-item${p.role === 'main' ? ' is-main' : ''}${p.round ? ' is-round' : ''}`;
    const aria = hidden ? ' aria-hidden="true" tabindex="-1"' : '';
    return url ? `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener noreferrer"${aria}>${inner}</a>`
      : `<span class="${cls}"${hidden ? ' aria-hidden="true"' : ''}>${inner}</span>`;
  };
  // the row twice → moving it by exactly half its width loops seamlessly
  return `<section class="bt1-ticker" aria-label="${esc(t('bt1.partners'))}" data-ticker>
    <div class="bt1-tk-track">${row.map((p) => item(p, false)).join('')}${row.map((p) => item(p, true)).join('')}</div>
  </section>`;
}

function enterButtonHtml(battle, status, user, myEntry) {
  if (status === 'voting' || status === 'ended') return '';
  if (myEntry) return `<div class="bt1-enter"><span class="btn btn-ghost bt1-in" aria-disabled="true">${esc(t('bt1.youreIn'))}</span></div>`;
  if (status === 'upcoming') return `<div class="bt1-enter"><button type="button" class="btn btn-go" disabled>${esc(t('bt1.enter'))}</button>
    <p class="muted small center">${esc(t('bt1.opensAt', { date: formatDate(battle.start) }))}</p></div>`;
  return `<div class="bt1-enter"><a class="btn btn-go" href="#/enter/${encodeURIComponent(battle.id)}">${esc(t('bt1.enter'))}</a></div>`;
}

/** 7) entries: 2 columns on phones; newest first while entries are open, most votes first while voting. */
async function drawGrid(root, battle, status, user) {
  const grid = root.querySelector('[data-grid]');
  const hint = root.querySelector('[data-vote-hint]');
  let entries, myVote = null;
  try {
    [entries, myVote] = await Promise.all([getStandings(battle.id), status === 'voting' && user ? getMyVote(battle.id) : null]);
  } catch {
    grid.innerHTML = `<li class="muted small">${esc(t('error.generic'))}</li>`;
    return;
  }
  if (!grid.isConnected) return;
  const showVotes = status === 'voting' || status === 'ended';
  if (status === 'upcoming' || status === 'open') entries.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  if (!entries.length) {
    grid.innerHTML = `<li class="muted small bt1-empty">${esc(t(status === 'upcoming' ? 'standings.emptyUpcoming' : 'standings.empty'))}</li>`;
    return;
  }
  hint.textContent = status !== 'voting' ? '' : !user ? t('vote.loginNeeded') : myVote ? `✓ ${t('vote.done')}` : t('vote.howTo');
  const canVote = status === 'voting' && user && !myVote;
  grid.innerHTML = entries.map((e) => `
    <li class="bt1-card" data-entry="${esc(e.id)}">
      <button type="button" class="bt1-photo" data-zoom aria-label="${esc(t('bt1.zoom'))}">
        <img src="${esc(e.photoUrl)}" alt="${esc(e.strain || e.displayName || '')}" loading="lazy" decoding="async">
      </button>
      <div class="bt1-card-body">
        ${e.profileKey ? `<a class="bt1-name" href="#/u/${encodeURIComponent(e.profileKey)}">${esc(e.displayName)}</a>` : `<span class="bt1-name">${esc(e.displayName)}</span>`}
        ${e.strain || e.breeder ? `<p class="bt1-strain">${esc([e.strain, e.breeder].filter(Boolean).join(' · '))}</p>` : ''}
        ${showVotes ? `<p class="bt1-votes"><b class="tabular">${e.votes}</b> ${esc(t(e.votes === 1 ? 'standings.vote' : 'standings.votes'))}</p>` : ''}
        ${canVote && !e.isMine ? `<button type="button" class="btn btn-vote btn-small" data-vote>${esc(t('vote.button'))}</button>` : ''}
        ${status === 'voting' && !user && !e.isMine ? `<a class="btn btn-ghost btn-small" href="#/profile">${esc(t('vote.button'))}</a>` : ''}
        ${e.id === myVote ? `<span class="your-vote small">✓ ${esc(t('vote.yourVote'))}</span>` : ''}
        ${e.isMine ? `<span class="pill pill-open">${esc(t('standings.yours'))}</span>` : ''}
        <div data-ts></div>
        <p class="error small" data-error hidden></p>
      </div>
    </li>`).join('');

  // tap a photo → full screen
  grid.querySelectorAll('[data-zoom]').forEach((b) => b.addEventListener('click', () => openPhoto(b.querySelector('img').src, b.querySelector('img').alt)));

  // vote: first tap arms, second tap (after the bot check) votes – same as the standings page
  let armedId = null, busy = false, botCheck = null;
  grid.querySelectorAll('[data-vote]').forEach((btn) => btn.addEventListener('click', async () => {
    const card = btn.closest('[data-entry]');
    const entryId = card.dataset.entry;
    const err = card.querySelector('[data-error]');
    err.hidden = true;
    if (armedId !== entryId) {
      grid.querySelectorAll('[data-vote].is-armed').forEach((b) => { b.classList.remove('is-armed'); b.textContent = t('vote.button'); });
      grid.querySelectorAll('[data-ts]').forEach((slot) => { slot.innerHTML = ''; });
      armedId = entryId;
      btn.classList.add('is-armed');
      btn.textContent = t('vote.confirmShort');
      botCheck = await mountTurnstile(card.querySelector('[data-ts]'), 'vote');
      return;
    }
    if (busy) return;
    const token = botCheck?.getToken();
    if (turnstileEnabled() && !token) { err.textContent = t('error.botCheckWait'); err.hidden = false; return; }
    busy = true; btn.disabled = true;
    try {
      await castVote(battle.id, entryId, token);
      await drawGrid(root, battle, status, user);
    } catch (e) {
      err.textContent = t(e.code || 'error.generic'); err.hidden = false; btn.disabled = false; botCheck?.reset();
    } finally { busy = false; }
  }));
}

function openPhoto(src, alt) {
  const box = document.createElement('div');
  box.className = 'bt1-zoom';
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
  box.innerHTML = `<img src="${esc(src)}" alt="${esc(alt || '')}"><button type="button" class="bt1-zoom-close" aria-label="${esc(t('spot.close'))}">✕</button>`;
  const close = () => { box.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  box.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(box);
  box.querySelector('button').focus();
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


/** Battle #1: Founding Member strip – the first 25 entries keep the badge forever. */
const FOUNDING_SPOTS = 25;
function foundingHtml(battle, status, entries) {
  if (battle.number !== 1 || battle.isTest || !['upcoming', 'open'].includes(status)) return '';
  const left = Math.max(0, FOUNDING_SPOTS - (entries || 0));
  if (!left) return '';
  return `<section class="bt1-founding"><img src="${esc(FOUNDING_BADGE)}" alt="" width="44" height="44">
    <p><b>${esc(t('bt1.foundingTitle'))}</b><br><span>${esc(t('bt1.foundingLeft', { left, total: FOUNDING_SPOTS }))}</span></p></section>`;
}
