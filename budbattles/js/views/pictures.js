// ADMIN: members' own profile pictures (background / underbanner) waiting for approval.
// Same compact rows as the entry review. Approved = goes live; rejected = deleted + note.
import { t, getLang } from '../i18n.js';
import { getCurrentUser, getImageReviews, reviewImage } from '../store.js';
import { esc } from '../ui.js';

const TABS = ['pending', 'approved', 'rejected'];
const state = { tab: 'pending' };

export async function renderPictures(root) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    root.innerHTML = `<section class="card"><p>${esc(t('admin.noAccess'))}</p></section>`;
    return;
  }
  root.innerHTML = `
    <div class="admin-bar admin-bar-compact">
      <h1 class="admin-h1">🖼 ${esc(t('pictures.title'))}</h1>
      <p class="small"><a class="link" href="#/admin">← ${esc(t('admin.title'))}</a></p>
      <div class="tabs tabs-3" role="tablist" data-tabs></div>
    </div>
    <div class="admin-list" data-list aria-live="polite"><p class="muted center">${esc(t('app.loading'))}</p></div>
    <div class="toast" role="status" data-toast hidden></div>`;
  const listEl = root.querySelector('[data-list]');
  const tabsEl = root.querySelector('[data-tabs]');
  const toastEl = root.querySelector('[data-toast]');
  let rows = [];

  async function load() {
    try { rows = await getImageReviews(); } catch (e) {
      listEl.innerHTML = `<p class="error">${esc(t(e.code || 'error.generic'))}</p>`;
      return;
    }
    draw();
  }

  function draw() {
    const counts = Object.fromEntries(TABS.map((s) => [s, rows.filter((r) => r.status === s).length]));
    tabsEl.innerHTML = TABS.map((s) => `<button type="button" role="tab" data-tab="${s}" aria-selected="${s === state.tab}">
      ${esc(t(`admin.tab.${s}`))} <span class="count">${counts[s]}</span></button>`).join('');
    tabsEl.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { state.tab = b.dataset.tab; draw(); }));
    const shown = rows.filter((r) => r.status === state.tab);
    const fmt = new Intl.DateTimeFormat(getLang() === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
    const buttons = { pending: ['approved', 'rejected'], approved: ['rejected'], rejected: [] };
    listEl.innerHTML = shown.length ? `<div class="arow-list">${shown.map((r) => `
      <article class="arow" data-id="${esc(r.id)}">
        <a class="arow-thumb" href="${esc(r.url)}" target="_blank" rel="noopener" aria-label="${esc(t('pictures.open'))}">
          <img class="arow-bg" src="${esc(r.url)}" alt="" aria-hidden="true" loading="lazy">
          <img class="arow-img" src="${esc(r.url)}" alt="" loading="lazy">
        </a>
        <div class="arow-info">
          <p class="arow-name"><a href="#/u/${encodeURIComponent(r.username || r.userId)}">${esc(r.username || '–')}</a></p>
          <p class="arow-strain">${esc(t(`pictures.kind.${r.kind}`))}</p>
          <p class="arow-date">${esc(fmt.format(new Date(r.createdAt)))}</p>
        </div>
        <div class="arow-actions">
          ${buttons[r.status].map((st) => `<button type="button" class="btn btn-xs ${st === 'approved' ? 'btn-primary' : 'btn-reject'}" data-action="${st}">
            ${st === 'approved' ? '✓' : '✕'} ${esc(t(`admin.action.${st}`))}</button>`).join('')}
        </div>
      </article>`).join('')}</div>`
      : `<section class="card center"><p class="muted">${esc(t(`pictures.empty.${state.tab}`))}</p></section>`;
    listEl.querySelectorAll('[data-action]').forEach((btn) => btn.addEventListener('click', async () => {
      const row = btn.closest('[data-id]');
      const item = rows.find((x) => x.id === row.dataset.id);
      row.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      try {
        await reviewImage(item.id, btn.dataset.action);
        item.status = btn.dataset.action;
        draw();
        toast(t(`pictures.done.${btn.dataset.action}`, { name: item.username || '' }));
      } catch (e) {
        row.querySelectorAll('button').forEach((b) => { b.disabled = false; });
        toast(t(e.code || 'error.generic'));
      }
    }));
  }

  let timer;
  function toast(msg) {
    clearTimeout(timer);
    toastEl.textContent = msg; toastEl.hidden = false;
    timer = setTimeout(() => { toastEl.hidden = true; }, 4000);
  }
  await load();
}
