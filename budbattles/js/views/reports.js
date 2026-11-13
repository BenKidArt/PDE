// ADMIN: reports from members (under 18 / fake / spam), open ones first.
import { t, formatDate } from '../i18n.js';
import { getCurrentUser, getReports, setReportStatus } from '../store.js';
import { esc } from '../ui.js';

export async function renderReports(root) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    root.innerHTML = `<section class="hero hero-small"><h1 class="neon-title">${esc(t('reports.title'))}</h1></section>
      <section class="card"><p>${esc(t('admin.noAccess'))}</p></section>`;
    return;
  }
  root.innerHTML = `
    <section class="hero hero-small">
      <p class="eyebrow">${esc(t('profile.admin'))}</p>
      <h1 class="neon-title">⚑ ${esc(t('reports.title'))}</h1>
      <p class="small"><a class="link" href="#/admin">← ${esc(t('admin.title'))}</a></p>
    </section>
    <ul class="report-list" data-list aria-live="polite"><li class="muted">${esc(t('app.loading'))}</li></ul>`;
  const listEl = root.querySelector('[data-list]');

  async function draw() {
    let rows;
    try { rows = await getReports(); } catch (e) {
      listEl.innerHTML = `<li class="card error">${esc(t(e.code || 'error.generic'))}</li>`;
      return;
    }
    if (!rows.length) { listEl.innerHTML = `<li class="card muted">${esc(t('reports.empty'))}</li>`; return; }
    listEl.innerHTML = rows.map((r) => `
      <li class="card report-row${r.status === 'done' ? ' is-done' : ''}">
        <div class="report-head">
          <span class="pill ${r.reason === 'underage' ? 'pill-danger' : 'pill-open'}">${esc(t(`report.reason.${r.reason}`))}</span>
          <span class="pill ${r.status === 'open' ? 'pill-voting' : 'pill-ended'}">${esc(t(r.status === 'open' ? 'reports.open' : 'reports.done'))}</span>
        </div>
        <div class="report-body">
          ${r.photoUrl ? `<img class="report-thumb" src="${esc(r.photoUrl)}" alt="" width="72" height="72" loading="lazy">` : ''}
          <div class="report-text">
            <p class="report-target">${esc(t(r.entryId ? 'reports.entry' : 'reports.profile'))}:
              <a class="link" href="#/u/${encodeURIComponent(r.target || r.targetId || '')}">${esc(r.target || '–')}</a></p>
            ${r.note ? `<p class="report-note">„${esc(r.note)}“</p>` : ''}
            <p class="muted small">${esc(t('reports.by', { name: r.reporter || '–' }))} · ${esc(formatDate(r.createdAt))}</p>
            ${r.targetOpen > 1 ? `<p class="small report-count">⚠ ${esc(t('reports.openCount', { n: r.targetOpen }))}</p>` : ''}
          </div>
        </div>
        <button type="button" class="btn btn-ghost btn-small" data-id="${esc(r.id)}" data-to="${r.status === 'open' ? 'done' : 'open'}">
          ${esc(t(r.status === 'open' ? 'reports.markDone' : 'reports.reopen'))}</button>
      </li>`).join('');
    listEl.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await setReportStatus(b.dataset.id, b.dataset.to); await draw(); } catch (e) {
        b.disabled = false; b.textContent = t(e.code || 'error.generic');
      }
    }));
  }
  await draw();
}
