// STANDINGS: live ranking of approved photos, and voting (one vote per member per battle).
import { t, tc, formatDate } from '../i18n.js';
import {
  getBattle, getCurrentBattle, battleStatus, getStandings, getMyVote, castVote, getCurrentUser,
} from '../store.js';
import { esc } from '../ui.js';
import { battleLabel, testNotice } from './battle.js';

const REFRESH_MS = 15000; // "live": refresh every 15 seconds while the page is open

export async function renderStandings(root, { id } = {}) {
  const battle = id ? await getBattle(id) : await getCurrentBattle();
  if (!battle) {
    root.innerHTML = `<section class="card"><p>${esc(t('battle.none'))}</p></section>`;
    return;
  }
  const user = await getCurrentUser();

  root.innerHTML = `${testNotice(battle)}
    <section class="hero hero-small">
      <p class="eyebrow">${esc(battleLabel(battle))} · ${esc(tc(battle.theme))}</p>
      <h1 class="neon-title">${esc(t('standings.title'))}</h1>
      <p class="muted small" data-phase></p>
    </section>
    <div data-notice></div>
    <ol class="ranking" data-list aria-live="polite"></ol>
    <p class="muted small center" data-updated></p>`;

  const listEl = root.querySelector('[data-list]');
  const noticeEl = root.querySelector('[data-notice]');
  const phaseEl = root.querySelector('[data-phase]');
  const updatedEl = root.querySelector('[data-updated]');
  let armedId = null; // first tap arms a vote, second tap confirms it
  let busy = false;

  async function refresh() {
    if (!root.isConnected) return false;
    const status = battleStatus(battle);
    const [entries, myVote] = await Promise.all([getStandings(battle.id), getMyVote(battle.id)]);
    if (!root.isConnected) return false;
    draw(status, entries, myVote);
    updatedEl.textContent = status === 'ended' ? '' : t('standings.updated', {
      time: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    });
    return true;
  }

  function draw(status, entries, myVote) {
    phaseEl.textContent = {
      upcoming: t('standings.phase.upcoming', { date: formatDate(battle.start) }),
      open: t('standings.phase.open', { date: formatDate(battle.entriesClose) }),
      voting: t('standings.phase.voting', { date: formatDate(battle.votingEnds) }),
      ended: t('standings.phase.ended'),
    }[status];

    let notice = '';
    if (status === 'voting' && !user) {
      notice = `<section class="card notice"><p>${esc(t('vote.loginNeeded'))}</p>
        <a class="btn btn-primary btn-small" href="#/profile">${esc(t('auth.loginOrSignup'))}</a></section>`;
    } else if (status === 'voting' && myVote) {
      notice = `<section class="card notice notice-ok"><p>✓ ${esc(t('vote.done'))}</p></section>`;
    } else if (status === 'voting') {
      notice = `<section class="card notice"><p>${esc(t('vote.howTo'))}</p></section>`;
    }
    noticeEl.innerHTML = notice;

    if (!entries.length) {
      listEl.innerHTML = `<li class="card muted">${esc(t(status === 'upcoming' ? 'standings.emptyUpcoming' : 'standings.empty'))}</li>`;
      return;
    }

    const showVotes = status === 'voting' || status === 'ended';
    const canVote = status === 'voting' && user && !myVote;
    listEl.innerHTML = entries.map((e) => `
      <li class="rank-item ${e.rank === 1 && showVotes && e.votes > 0 ? 'rank-top' : ''} ${e.id === myVote ? 'rank-voted' : ''}" data-entry="${esc(e.id)}">
        ${showVotes ? `<span class="rank-num" aria-label="${esc(t('standings.rank', { rank: e.rank }))}">${e.rank}</span>` : ''}
        <img class="rank-photo" src="${esc(e.photoUrl)}" alt="${esc(e.strain || e.displayName)}" loading="lazy" data-zoom>
        <div class="rank-body">
          <p class="rank-name"><strong>${esc(e.displayName)}</strong>
            ${e.isMine ? `<span class="pill pill-open">${esc(t('standings.yours'))}</span>` : ''}
            ${status === 'ended' && e.rank === 1 && e.votes > 0 ? `<span class="pill pill-voting">★ ${esc(t('standings.featured'))}</span>` : ''}</p>
          ${e.strain ? `<p class="rank-strain">${esc(e.strain)}</p>` : ''}
          ${e.description ? `<p class="small muted">${esc(e.description)}</p>` : ''}
          ${showVotes ? `<p class="rank-votes"><span class="tabular">${e.votes}</span> ${esc(t(e.votes === 1 ? 'standings.vote' : 'standings.votes'))}</p>` : ''}
          ${e.id === myVote ? `<p class="small rank-myvote">✓ ${esc(t('vote.yourVote'))}</p>` : ''}
          ${canVote && !e.isMine ? `<button type="button" class="btn ${armedId === e.id ? 'btn-primary' : 'btn-ghost'} btn-small" data-vote>
            ${esc(t(armedId === e.id ? 'vote.confirm' : 'vote.button'))}</button>` : ''}
          <p class="error small" data-error hidden></p>
        </div>
      </li>`).join('');

    listEl.querySelectorAll('[data-zoom]').forEach((img) => img.addEventListener('click', () => {
      img.closest('.rank-item').classList.toggle('expanded');
    }));
    listEl.querySelectorAll('[data-vote]').forEach((btn) => btn.addEventListener('click', async () => {
      const entryId = btn.closest('[data-entry]').dataset.entry;
      if (armedId !== entryId) {
        armedId = entryId;
        draw(status, entries, myVote);
        return;
      }
      if (busy) return;
      busy = true;
      btn.disabled = true;
      try {
        await castVote(battle.id, entryId);
        armedId = null;
        await refresh();
      } catch (e) {
        const err = btn.parentElement.querySelector('[data-error]');
        err.textContent = t(e.code || 'error.generic');
        err.hidden = false;
        btn.disabled = false;
      } finally {
        busy = false;
      }
    }));
  }

  await refresh();
  if (battleStatus(battle) === 'ended') return;
  const timer = setInterval(async () => {
    if (document.hidden || busy || armedId) return; // don't redraw while you're choosing
    try {
      if (!(await refresh())) clearInterval(timer);
    } catch { /* try again next time */ }
  }, REFRESH_MS);
}
