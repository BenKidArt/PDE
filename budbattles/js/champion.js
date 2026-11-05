// CHAMPION POPUP: the #1 of an ended battle picks the son or daughter version
// of the Battle Champion badge. "Later" asks again the next time the app opens.
import { t, tc } from './i18n.js';
import { finalizeBattles, getPendingChampion, chooseChampionBadge } from './store.js';
import { esc } from './ui.js';

const CHOICES = [
  { id: 'badge_heir_son', label: 'champion.son' },
  { id: 'badge_heir_daughter', label: 'champion.daughter' },
];
let shownThisVisit = new Set(); // battles already asked during this visit

/** Call after start-up and after logging in. onDone re-draws the page. */
export async function checkChampion(onDone) {
  try {
    // let the end-of-battle check finish first (but never wait more than 4 s)
    await Promise.race([finalizeBattles(), new Promise((r) => setTimeout(r, 4000))]);
    const pending = (await getPendingChampion()).filter((p) => !shownThisVisit.has(p.battleId));
    if (pending.length && !document.querySelector('.modal-backdrop')) show(pending[0], onDone);
  } catch (e) {
    console.warn('champion check', e);
  }
}

export function resetChampionCheck() { shownThisVisit = new Set(); }

function show(item, onDone) {
  shownThisVisit.add(item.battleId);
  const label = item.isTest ? t('battle.testLabel') : (item.number ? t('battle.numbered', { n: item.number }) : t('battle.title'));
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
    <div class="modal champion-modal" role="dialog" aria-modal="true" aria-labelledby="champion-title">
      <p class="eyebrow champion-eyebrow">🏆 ${esc(label)}</p>
      <h2 id="champion-title" class="champion-title">${esc(t('champion.title'))}</h2>
      <p>${esc(t('champion.text', { battle: tc(item.theme) }))}</p>
      <div class="choice-grid">
        ${CHOICES.map((c) => `
          <button type="button" class="choice" data-choose="${c.id}">
            <img src="assets/badges/${c.id}.webp" alt="" width="96" height="96">
            <span>${esc(t(c.label))}</span>
          </button>`).join('')}
      </div>
      <p class="error small" data-error hidden></p>
      <button type="button" class="link-button" data-later>${esc(t('champion.later'))}</button>
    </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('[data-choose]').focus();

  const close = () => wrap.remove();
  wrap.querySelector('[data-later]').addEventListener('click', close);
  wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  wrap.querySelectorAll('[data-choose]').forEach((btn) => btn.addEventListener('click', async () => {
    wrap.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try {
      await chooseChampionBadge(item.battleId, btn.dataset.choose);
      const modal = wrap.querySelector('.modal');
      modal.innerHTML = `
        <img class="champion-picked" src="assets/badges/${esc(btn.dataset.choose)}.webp" alt="" width="96" height="96">
        <h2 class="champion-title">${esc(t('champion.doneTitle'))}</h2>
        <p>${esc(t('champion.done'))}</p>
        <button type="button" class="btn btn-primary btn-block" data-ok>${esc(t('champion.ok'))}</button>`;
      modal.querySelector('[data-ok]').focus();
      modal.querySelector('[data-ok]').addEventListener('click', () => { close(); onDone?.(); });
    } catch (e) {
      const err = wrap.querySelector('[data-error]');
      err.textContent = t(e.code || 'error.generic');
      err.hidden = false;
      wrap.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    }
  }));
}
