// ADMIN: SUSPICIOUS VOTES. Per entry: votes, votes from brand-new accounts and
// the biggest group of votes from one network / one device. Admins can cancel
// single votes. Only admins see this; the public ranking stays as it is.
import { t, tc, getLang } from '../i18n.js';
import { getCurrentUser, getBattles, getCurrentBattle, getVoteReport, getEntryVotes, cancelVote } from '../store.js';
import { esc } from '../ui.js';

let battleId = null;

export async function renderVoteCheck(root) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    root.innerHTML = `<section class="card"><p>${esc(t('admin.noAccess'))}</p></section>`;
    return;
  }
  const battles = await getBattles();
  if (!battleId || !battles.some((b) => b.id === battleId)) battleId = (await getCurrentBattle())?.id ?? battles[0]?.id;

  root.innerHTML = `
    <section class="hero hero-small">
      <p class="eyebrow">${esc(t('profile.admin'))}</p>
      <h1 class="neon-title">${esc(t('votecheck.title'))}</h1>
      <p class="muted small">${esc(t('votecheck.intro'))}</p>
    </section>
    <div class="admin-bar">
      <label class="label" for="vc-battle">${esc(t('nav.battle'))}</label>
      <select id="vc-battle">${battles.map((b) => `<option value="${esc(b.id)}" ${b.id === battleId ? 'selected' : ''}>${b.isTest ? `${esc(t('battle.testLabel'))} · ` : ''}${esc(tc(b.theme))}</option>`).join('')}</select>
      <div class="admin-links"><a class="bb-chip" href="#/admin">← ${esc(t('admin.title'))}</a></div>
    </div>
    <div data-list><p class="muted center">${esc(t('app.loading'))}</p></div>`;

  const listEl = root.querySelector('[data-list]');
  root.querySelector('#vc-battle').addEventListener('change', (e) => { battleId = e.target.value; load(); });

  async function load() {
    listEl.innerHTML = `<p class="muted center">${esc(t('app.loading'))}</p>`;
    let rows;
    try { rows = await getVoteReport(battleId); } catch (e) {
      listEl.innerHTML = `<p class="error">${esc(t(e.code || 'error.generic'))}</p>`;
      return;
    }
    if (!rows.length) { listEl.innerHTML = `<section class="card"><p class="muted">${esc(t('standings.empty'))}</p></section>`; return; }
    const flagged = rows.filter((r) => r.flagged).length;
    listEl.innerHTML = `
      <p class="small ${flagged ? 'error' : 'muted'}">${esc(t(flagged ? 'votecheck.flaggedCount' : 'votecheck.allClear', { n: flagged }))}</p>
      <ul class="vc-list">${rows.map((r) => `
        <li class="card vc-row ${r.flagged ? 'vc-flagged' : ''}" data-entry="${esc(r.entryId)}">
          <div class="vc-head">
            <strong>${esc(r.displayName)}</strong>
            ${r.flagged ? `<span class="pill pill-rejected">⚠ ${esc(t('votecheck.flag'))}</span>` : ''}
          </div>
          <dl class="vc-nums">
            <div><dt>${esc(t('standings.votes'))}</dt><dd>${r.votes}</dd></div>
            <div><dt>${esc(t('votecheck.newAccounts'))}</dt><dd>${r.newAccountVotes}</dd></div>
            <div><dt>${esc(t('votecheck.sameNetwork'))}</dt><dd>${r.maxSameNetwork}</dd></div>
            <div><dt>${esc(t('votecheck.sameDevice'))}</dt><dd>${r.maxSameDevice}</dd></div>
          </dl>
          <button type="button" class="link-button small" data-open>${esc(t('votecheck.showVotes'))}</button>
          <div data-votes></div>
        </li>`).join('')}</ul>`;
    listEl.querySelectorAll('[data-open]').forEach((btn) => btn.addEventListener('click', () => openVotes(btn.closest('[data-entry]'))));
  }

  async function openVotes(rowEl) {
    const box = rowEl.querySelector('[data-votes]');
    box.innerHTML = `<p class="muted small">${esc(t('app.loading'))}</p>`;
    const votes = await getEntryVotes(rowEl.dataset.entry);
    const fmt = new Intl.DateTimeFormat(getLang() === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    box.innerHTML = votes.length ? `<ul class="vc-votes">${votes.map((v) => `
      <li data-voter="${esc(v.voterId)}">
        <div><b>${esc(v.voterName)}</b> <span class="muted small">${esc(fmt.format(new Date(v.votedAt)))}</span><br>
          <span class="small ${v.ageHours != null && v.ageHours < 72 ? 'error' : 'muted'}">${esc(t('votecheck.accountAge', { h: v.ageHours ?? '?' }))}</span>
          ${v.sameNetwork > 1 ? `<span class="small error"> · ${esc(t('votecheck.netShared', { n: v.sameNetwork }))}</span>` : ''}
          ${v.sameDevice > 1 ? `<span class="small error"> · ${esc(t('votecheck.devShared', { n: v.sameDevice }))}</span>` : ''}
        </div>
        <button type="button" class="btn btn-reject btn-small" data-cancel>${esc(t('votecheck.cancel'))}</button>
      </li>`).join('')}</ul>` : `<p class="muted small">${esc(t('votecheck.noVotes'))}</p>`;
    box.querySelectorAll('[data-cancel]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!btn.classList.contains('is-armed')) { btn.classList.add('is-armed'); btn.textContent = t('votecheck.cancelConfirm'); return; }
      btn.disabled = true;
      try {
        await cancelVote(battleId, btn.closest('[data-voter]').dataset.voter, 'admin');
        await load();
      } catch (e) { btn.disabled = false; btn.textContent = t(e.code || 'error.generic'); }
    }));
  }

  await load();
}
