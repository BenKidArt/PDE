// ADMIN: approve or reject submitted photos. Built for one-handed use on a phone.
import { t, tc, getLang } from '../i18n.js';
import {
  getCurrentUser, getBattles, getCurrentBattle, listEntries, reviewEntry, seedDemoEntries, isDemo,
} from '../store.js';
import { esc } from '../ui.js';

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
    state.battleId = (await getCurrentBattle())?.id ?? battles[0]?.id ?? null;
  }
  if (!state.battleId) {
    root.innerHTML = `<section class="card"><p>${esc(t('battle.none'))}</p></section>`;
    return;
  }

  root.innerHTML = `
    <section class="hero hero-small">
      <p class="eyebrow">${esc(t('profile.admin'))}</p>
      <h1 class="neon-title">${esc(t('admin.title'))}</h1>
    </section>
    <div class="admin-bar">
      <label class="label" for="admin-battle">${esc(t('nav.battle'))}</label>
      <select id="admin-battle" data-battle>
        ${battles.map((b) => `<option value="${esc(b.id)}" ${b.id === state.battleId ? 'selected' : ''}>${b.isTest ? `${esc(t('battle.testLabel'))} · ` : ''}${esc(tc(b.theme))}</option>`).join('')}
      </select>
      <div class="admin-links" data-links></div>
      <div class="tabs tabs-3" role="tablist" data-tabs></div>
    </div>
    <div class="admin-list" data-list aria-live="polite"></div>
    <div class="toast" role="status" data-toast hidden></div>`;

  const linksEl = root.querySelector('[data-links]');
  const drawLinks = () => {
    const id = encodeURIComponent(state.battleId);
    linksEl.innerHTML = [['battle', 'admin.openBattle'], ['enter', 'admin.openEnter'], ['standings', 'admin.openStandings']]
      .map(([page, key]) => `<a class="chip" href="#/${page}/${id}">${esc(t(key))} →</a>`).join('');
  };
  drawLinks();

  root.querySelector('[data-battle]').addEventListener('change', (e) => {
    state.battleId = e.target.value;
    drawLinks();
    load();
  });

  const listEl = root.querySelector('[data-list]');
  const tabsEl = root.querySelector('[data-tabs]');
  const toastEl = root.querySelector('[data-toast]');
  let entries = [];
  let toastTimer;

  async function load() {
    listEl.innerHTML = `<p class="muted center">${esc(t('app.loading'))}</p>`;
    try {
      entries = await listEntries(state.battleId);
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
      ? shown.map(card).join('') + seedButton
      : `<section class="card center"><p class="muted">${esc(t(`admin.empty.${state.tab}`))}</p>${seedButton}</section>`;
    listEl.querySelector('[data-seed]')?.addEventListener('click', async () => {
      await seedDemoEntries(state.battleId);
      load();
    });
    listEl.querySelectorAll('[data-zoom]').forEach((img) => img.addEventListener('click', () => img.classList.toggle('zoomed')));
    listEl.querySelectorAll('[data-action]').forEach((btn) => btn.addEventListener('click', () => {
      act(btn.closest('[data-entry]').dataset.entry, btn.dataset.action, btn);
    }));
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

function card(e) {
  const date = new Intl.DateTimeFormat(getLang() === 'de' ? 'de-DE' : 'en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin',
  }).format(new Date(e.createdAt));
  const buttons = {
    pending: ['rejected', 'approved'],
    approved: ['rejected'],
    rejected: ['approved'],
  }[e.status];
  return `
    <article class="card review" data-entry="${esc(e.id)}">
      <img class="review-photo" src="${esc(e.photoUrl)}" alt="${esc(e.strain || e.displayName)}" data-zoom
        width="${e.width}" height="${e.height}" loading="lazy">
      <div class="review-body">
        <p class="review-meta"><strong>${esc(e.displayName)}</strong> <span class="muted small">${esc(date)}</span></p>
        ${e.strain ? `<p class="review-strain">${esc(e.strain)}</p>` : ''}
        ${e.description ? `<p class="small">${esc(e.description)}</p>` : ''}
      </div>
      <div class="review-actions">
        ${buttons.map((s) => `<button type="button" class="btn ${s === 'approved' ? 'btn-primary' : 'btn-reject'}" data-action="${s}">
          ${s === 'approved' ? '✓' : '✕'} ${esc(t(`admin.action.${s}`))}</button>`).join('')}
      </div>
    </article>`;
}
