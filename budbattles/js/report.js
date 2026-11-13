// REPORT: small popup to report a profile or an entry (under 18 / fake / spam).
// Reports go to the admin list (#/reports). Members only; visitors are sent to the login.
import { t } from './i18n.js';
import { getCurrentUser, reportContent } from './store.js';
import { esc } from './ui.js';

const REASONS = ['underage', 'fake', 'spam'];

/** Small "⚑ Report" button. Put data-report-user / data-report-entry on it. */
export function reportButtonHtml({ userId = '', entryId = '' } = {}) {
  return `<button type="button" class="report-btn" data-report-user="${esc(userId)}" data-report-entry="${esc(entryId)}">⚑ ${esc(t('report.button'))}</button>`;
}

/** Wires every report button inside root. */
export function bindReportButtons(root) {
  root.querySelectorAll('[data-report-user], [data-report-entry]').forEach((b) => {
    if (b.dataset.reportBound) return;
    b.dataset.reportBound = '1';
    b.addEventListener('click', () => openReport({ userId: b.dataset.reportUser || null, entryId: b.dataset.reportEntry || null }));
  });
}

export async function openReport({ userId = null, entryId = null }) {
  if (document.querySelector('.modal-backdrop')) return;
  const me = await getCurrentUser();
  if (!me) { location.hash = '#/profile'; return; }
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
    <form class="modal report-modal" role="dialog" aria-modal="true" aria-labelledby="report-title" novalidate>
      <h2 id="report-title" class="report-title">⚑ ${esc(t(entryId ? 'report.titleEntry' : 'report.titleUser'))}</h2>
      <fieldset class="report-reasons">
        ${REASONS.map((r) => `<label class="check report-reason"><input type="radio" name="reason" value="${r}"><span>${esc(t(`report.reason.${r}`))}</span></label>`).join('')}
      </fieldset>
      <div class="field">
        <label class="label" for="report-note">${esc(t('report.note'))}</label>
        <textarea id="report-note" name="note" rows="2" maxlength="300"></textarea>
      </div>
      <p class="error small" role="alert" data-error hidden></p>
      <p class="badge-ok small" role="status" data-ok hidden>✓ ${esc(t('report.sent'))}</p>
      <button type="submit" class="btn btn-primary btn-block" data-send>${esc(t('report.send'))}</button>
      <button type="button" class="link-button" data-cancel>${esc(t('report.cancel'))}</button>
    </form>`;
  document.body.appendChild(wrap);
  const form = wrap.querySelector('form');
  const err = form.querySelector('[data-error]');
  const close = () => wrap.remove();
  form.querySelector('[data-cancel]').addEventListener('click', close);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const reason = form.reason.value;
    if (!reason) { err.textContent = t('report.pickReason'); err.hidden = false; return; }
    const send = form.querySelector('[data-send]');
    send.disabled = true;
    try {
      await reportContent({ userId, entryId, reason, note: form.note.value.trim() });
      form.querySelector('[data-ok]').hidden = false;
      send.hidden = true;
      form.querySelector('[data-cancel]').textContent = t('app.close');
      setTimeout(close, 1600);
    } catch (ex) {
      err.textContent = t(ex.code || 'error.generic'); err.hidden = false; send.disabled = false;
    }
  });
}
