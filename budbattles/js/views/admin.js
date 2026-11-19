// ADMIN: approve or reject submitted photos. Built for one-handed use on a phone.
import { t, tc, getLang } from '../i18n.js';
import {
  getCurrentUser, getBattles, getCurrentBattle, listEntries, reviewEntry, seedDemoEntries, isDemo,
  getStandings, battleStatus, gameMyStats, gameDemoSetLoginDays, gameDemoNextLoginDay, gameDemoReset, gameDemoAddToss, gameSyncConfig } from '../store.js';
import { celebrate } from '../budpoints.js';
import { BUDPOINTS } from '../budpoints-config.js';
import { esc } from '../ui.js';
import { battleLabel } from './battle.js';
import { entryCardFile } from '../card.js';

const cardCache = new Map(); // finished card files, so switching tabs doesn't redraw them

const TABS = ['pending', 'approved', 'rejected'];
// Remembered while the app is open, so you land where you left off.
const state = { battleId: null, tab: 'pending' };

export async function renderAdmin(root) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    root.innerHTML = `<section class="hero hero-small"><h1 class="neon-title">${esc(t('admin.title'))}</h1></section>
      <section class="card"><p>${esc(t('admin.noAccess'))}</p>
      <a class="btn btn-ghost" href="#/profile">${esc(t('nav.profile'))}</a></section>`;
    return;
  }

  const battles = await getBattles();
  if (!state.battleId || !battles.some((b) => b.id === state.battleId)) {
    state.battleId = (await getCurrentBattle())?.id ?? battles.find((b) => !b.isDraft)?.id ?? battles[0]?.id ?? null;
  }
  if (!state.battleId) {
    root.innerHTML = `<section class="card"><p>${esc(t('battle.none'))}</p></section>`;
    return;
  }

  root.innerHTML = `
    <div class="admin-bar admin-bar-compact">
      <h1 class="admin-h1">${esc(t('admin.title'))}</h1>
      <label class="sr-only" for="admin-battle">${esc(t('nav.battle'))}</label>
      <select id="admin-battle" data-battle>
        ${battles.map((b) => `<option value="${esc(b.id)}" ${b.id === state.battleId ? 'selected' : ''}>${b.isDraft ? `${esc(t('battle.draftLabel'))} · ` : b.isTest ? `${esc(t('battle.testLabel'))} · ` : ''}${esc(tc(b.theme))}</option>`).join('')}
      </select>
      ${battles.some((b) => b.isDraft) ? `<div class="admin-drafts">
        <span class="admin-drafts-label">📝 ${esc(t('admin.drafts'))}</span>
        ${battles.filter((b) => b.isDraft).map((b) => `<a class="bb-chip bb-chip-pink" href="#/battle/${encodeURIComponent(b.id)}">${esc(tc(b.theme))} →</a>`).join('')}
      </div>` : ''}
      <div class="admin-links" data-links data-hscroll></div>
      <details class="admin-demo" data-demo>
        <summary>🎬 ${esc(t('demo.title'))}</summary>
        <p class="small muted admin-demo-stats" data-demo-stats></p>
        <div class="admin-demo-btns">
          <button type="button" class="bb-chip" data-demo-act="toss40">${esc(t('demo.toss40'))}</button>
          <button type="button" class="bb-chip" data-demo-act="days9">${esc(t('demo.setDays9'))}</button>
          <button type="button" class="bb-chip" data-demo-act="next">${esc(t('demo.nextDay'))}</button>
          <button type="button" class="bb-chip bb-chip-pink" data-demo-act="reset">${esc(t('demo.reset'))}</button>
          <a class="bb-chip" href="#/banana-toss">🍌 ${esc(t('demo.openGame'))} →</a>
        </div>
      </details>
      <div class="tabs tabs-3" role="tablist" data-tabs></div>
    </div>
    <div class="admin-list" data-list aria-live="polite"></div>
    <div class="toast" role="status" data-toast hidden></div>`;

  const linksEl = root.querySelector('[data-links]');
  const drawLinks = () => {
    const id = encodeURIComponent(state.battleId);
    linksEl.innerHTML = [['battle', 'admin.openBattle'], ['enter', 'admin.openEnter'], ['standings', 'admin.openStandings']]
      .map(([page, key]) => `<a class="bb-chip" href="#/${page}/${id}">${esc(t(key))} →</a>`).join('')
      + `<a class="bb-chip" href="#/votes">⚠ ${esc(t('votecheck.title'))} →</a>`
      + `<a class="bb-chip" href="#/pictures">🖼 ${esc(t('pictures.title'))} →</a>`
      + `<a class="bb-chip" href="#/spot-map">🗺 ${esc(t('spot.adminLink'))} →</a>`
      + `<a class="bb-chip" href="#/banana-toss">🍌 ${esc(t('game.adminLink'))} →</a>`
      + `<a class="bb-chip" href="#/reports">⚑ ${esc(t('reports.title'))} →</a>`;
  };
  drawLinks();

  // DEMO box (for recording a video): own account only
  gameSyncConfig(BUDPOINTS).catch(() => {}); // copies js/budpoints-config.js into the database
  const demoEl = root.querySelector('[data-demo]');
  const statsEl = root.querySelector('[data-demo-stats]');
  const showStats = (r) => {
    statsEl.textContent = r ? t('demo.stats2', { points: r.budPoints, toss: r.tossEarned, used: r.windowUsed, max: r.windowMax, days: r.loginDays })
      : t('demo.needSql');
  };
  try { demoEl.open = sessionStorage.getItem('bb.demoOpen') === '1'; } catch { /* ignore */ }
  demoEl.addEventListener('toggle', () => { try { sessionStorage.setItem('bb.demoOpen', demoEl.open ? '1' : '0'); } catch { /* ignore */ } });
  gameMyStats().then(showStats).catch(() => showStats(null));
  root.querySelectorAll('[data-demo-act]').forEach((b) => b.addEventListener('click', async () => {
    const act = b.dataset.demoAct;
    if (act === 'reset' && !window.confirm(t('demo.resetConfirm2'))) return;
    b.disabled = true;
    try {
      const r = act === 'toss40' ? await gameDemoAddToss(40) : act === 'days9' ? await gameDemoSetLoginDays(9)
        : act === 'next' ? await gameDemoNextLoginDay() : await gameDemoReset();
      showStats(r);
      celebrate(r);
    } catch { showStats(null); }
    b.disabled = false;
  }));

  root.querySelector('[data-battle]').addEventListener('change', (e) => {
    state.battleId = e.target.value;
    drawLinks();
    load();
  });

  const listEl = root.querySelector('[data-list]');
  const tabsEl = root.querySelector('[data-tabs]');
  const toastEl = root.querySelector('[data-toast]');
  let entries = [];
  let ranks = new Map(); // entry id → live rank (only once voting has started)
  let toastTimer;

  async function load() {
    listEl.innerHTML = `<p class="muted center">${esc(t('app.loading'))}</p>`;
    try {
      entries = await listEntries(state.battleId);
      const battle = battles.find((b) => b.id === state.battleId);
      ranks = new Map();
      if (battle && ['voting', 'ended'].includes(battleStatus(battle))) {
        (await getStandings(state.battleId)).forEach((s) => ranks.set(s.id, s.rank));
      }
    } catch (e) {
      listEl.innerHTML = `<p class="error">${esc(t(e.code || 'error.generic'))}</p>`;
      return;
    }
    draw();
  }

  function draw() {
    const counts = Object.fromEntries(TABS.map((s) => [s, entries.filter((e) => e.status === s).length]));
    tabsEl.innerHTML = TABS.map((s) => `
      <button type="button" role="tab" data-tab="${s}" aria-selected="${s === state.tab}">
        ${esc(t(`admin.tab.${s}`))} <span class="count">${counts[s]}</span>
      </button>`).join('');
    tabsEl.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
      state.tab = b.dataset.tab;
      draw();
    }));

    const shown = entries.filter((e) => e.status === state.tab);
    const seedButton = isDemo && seedDemoEntries && state.tab === 'pending'
      ? `<p class="center"><button class="btn btn-ghost btn-small" type="button" data-seed>${esc(t('admin.seedDemo'))}</button></p>` : '';
    listEl.innerHTML = shown.length
      ? `<div class="arow-list">${shown.map((e) => row(e)).join('')}</div>${seedButton}`
      : `<section class="card center"><p class="muted">${esc(t(`admin.empty.${state.tab}`))}</p>${seedButton}</section>`;
    listEl.querySelector('[data-seed]')?.addEventListener('click', async () => {
      await seedDemoEntries(state.battleId);
      load();
    });
    listEl.querySelectorAll('[data-show-card]').forEach((btn) => btn.addEventListener('click', () => {
      const entry = entries.find((x) => x.id === btn.closest('[data-entry]').dataset.entry);
      if (entry) openCard(entry);
    }));
    listEl.querySelectorAll('[data-action]').forEach((btn) => btn.addEventListener('click', () => {
      act(btn.closest('[data-entry]').dataset.entry, btn.dataset.action, btn);
    }));
  }

  /** Pill on the card: live rank once voting runs, else the entry number (approved only). */
  function pillOf(e) {
    if (ranks.has(e.id)) return `#${ranks.get(e.id)}`;
    if (e.status !== 'approved') return '';
    const approvedInOrder = entries.filter((x) => x.status === 'approved').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return `${t('card.entry')} #${approvedInOrder.indexOf(e) + 1}`;
  }

  /** "Show card": the full download card in a popup, with Download and Share. Made on demand, then cached. */
  async function openCard(e) {
    if (document.querySelector('.modal-backdrop')) return;
    const battle = battles.find((b) => b.id === state.battleId);
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `
      <div class="modal card-modal" role="dialog" aria-modal="true" aria-label="${esc(t('card.alt'))}">
        <div class="card-modal-img" data-card><p class="muted small share-card-wait">${esc(t('card.making'))}</p></div>
        ${e.description ? `<p class="small card-modal-desc">${esc(e.description)}</p>` : ''}
        <div class="share-card-actions" data-card-actions></div>
        <button type="button" class="link-button" data-close>${esc(t('app.close'))}</button>
      </div>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.querySelector('[data-close]').addEventListener('click', close);
    wrap.addEventListener('click', (ev) => { if (ev.target === wrap) close(); });
    document.addEventListener('keydown', function esc_(ev) { if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', esc_); } });
    const box = wrap.querySelector('[data-card]');
    const pill = pillOf(e);
    const key = `${e.id}|${pill}|${e.displayName}|${e.instagram}|${e.avatar}|${e.strain}|${getLang()}`;
    try {
      let file = cardCache.get(key);
      if (!file) {
        file = await entryCardFile({
          photoUrl: e.photoUrl, displayName: e.displayName, strain: e.strain, pill, avatar: e.avatar, instagram: e.instagram,
          eyebrow: `${battleLabel(battle)} · ${tc(battle.theme)}`,
        }, `budbattles-${(e.displayName || 'entry').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`);
        cardCache.set(key, file);
      }
      if (!box.isConnected) return;
      const url = URL.createObjectURL(file);
      const canShare = !!navigator.canShare?.({ files: [file] });
      box.innerHTML = `<img class="share-card-img" src="${url}" alt="${esc(t('card.alt'))}" width="1080" height="1350">`;
      const actions = wrap.querySelector('[data-card-actions]');
      actions.innerHTML = `
        <a class="btn btn-primary" href="${url}" download="${esc(file.name)}">⬇ ${esc(t('card.download'))}</a>
        ${canShare ? `<button type="button" class="btn btn-ghost" data-share>↗ ${esc(t('card.share'))}</button>` : ''}`;
      actions.querySelector('[data-share]')?.addEventListener('click', async () => {
        try { await navigator.share({ files: [file] }); } catch { /* closed by the user */ }
      });
    } catch (err) {
      console.error(err);
      if (box.isConnected) box.innerHTML = `<p class="error small">${esc(t('card.failed'))}</p>`;
    }
  }

  async function act(id, status, btn) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    const previous = entry.status;
    const cardEl = btn.closest('[data-entry]');
    cardEl.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try {
      await reviewEntry(id, status);
      entry.status = status;
      draw();
      showToast(t(`admin.done.${status}`, { name: entry.displayName }), async () => {
        await reviewEntry(id, previous);
        entry.status = previous;
        draw();
      });
    } catch (e) {
      cardEl.querySelectorAll('button').forEach((b) => { b.disabled = false; });
      showToast(t(e.code || 'error.generic'));
    }
  }

  function showToast(message, undo) {
    clearTimeout(toastTimer);
    toastEl.innerHTML = `<span>${esc(message)}</span>${undo ? `<button type="button" data-undo>${esc(t('admin.undo'))}</button>` : ''}`;
    toastEl.hidden = false;
    toastEl.querySelector('[data-undo]')?.addEventListener('click', async () => {
      toastEl.hidden = true;
      try { await undo(); } catch (e) { showToast(t(e.code || 'error.generic')); }
    });
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 6000);
  }

  await load();
}

/** One compact row: thumbnail, name, strain, date, "Show card", Approve / Reject. */
function row(e) {
  const date = new Intl.DateTimeFormat(getLang() === 'de' ? 'de-DE' : 'en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin',
  }).format(new Date(e.createdAt));
  const buttons = {
    pending: ['approved', 'rejected'],
    approved: ['rejected'],
    rejected: ['approved'],
  }[e.status];
  const name = e.username ? `<a href="#/u/${encodeURIComponent(e.username)}">${esc(e.displayName)}</a>` : esc(e.displayName);
  return `
    <article class="arow" data-entry="${esc(e.id)}">
      <button type="button" class="arow-thumb" data-show-card aria-label="${esc(t('admin.showCard'))}">
        <img class="arow-bg" src="${esc(e.photoUrl)}" alt="" aria-hidden="true" loading="lazy" decoding="async">
        <img class="arow-img" src="${esc(e.photoUrl)}" alt="${esc(e.strain || e.displayName)}" loading="lazy" decoding="async">
      </button>
      <div class="arow-info">
        <p class="arow-name">${name}</p>
        ${e.strain ? `<p class="arow-strain">${esc(e.strain)}</p>` : ''}
        <p class="arow-date">${esc(date)}${e.instagram ? ` · <a class="review-insta" href="https://instagram.com/${encodeURIComponent(e.instagram)}" target="_blank" rel="noopener noreferrer">@${esc(e.instagram)}</a>` : ''}</p>
        <button type="button" class="arow-card" data-show-card>▣ ${esc(t('admin.showCard'))}</button>
      </div>
      <div class="arow-actions">
        ${buttons.map((st) => `<button type="button" class="btn btn-xs ${st === 'approved' ? 'btn-primary' : 'btn-reject'}" data-action="${st}">
          ${st === 'approved' ? '✓' : '✕'} ${esc(t(`admin.action.${st}`))}</button>`).join('')}
      </div>
    </article>`;
}
