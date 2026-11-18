// ZILLAH BANANA TOSS (hidden admin page, #/banana-toss): the finished mini game from
// games/zillah-banana-toss.html, shown full-screen in an iframe. The game file is
// used unchanged; it reports to this page with window.postMessage:
//   { source:'zillah-banana-toss', type:'ready' }
//   { …, type:'throw', meters, points, roundPoints, turbo }   → BudPoints (logged in only)
//   { …, type:'round', roundPoints, bestMeters }
//   { …, type:'playtime', seconds:10 }                       → play time → "Banana Blaster" badge
// BudPoints per throw: floor(points / 100), at least 1 if points > 0; max 50 a day.
// TODO (real launch): points are counted in the browser – needs server-side checks against cheating.
// Partner codes inside the game are demo placeholders and are not connected.
import { t } from '../i18n.js';
import { esc } from '../ui.js';
import { getCurrentUser, gameAddPoints, gameAddSeconds, gameMyStats } from '../store.js';
import { showBadgeUnlock, pointsChip, gameDemo } from '../gamebadges.js';

const GAME_URL = 'games/zillah-banana-toss.html';
const SOURCE = 'zillah-banana-toss';

export async function renderBananaToss(root) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) { // hidden preview: admins only
    root.innerHTML = `<section class="card"><p>${esc(t('admin.noAccess'))}</p></section>`;
    return;
  }
  root.innerHTML = `
    <div class="bt-game">
      <iframe class="bt-frame" src="${GAME_URL}" title="${esc(t('game.frameTitle'))}" allow="fullscreen; autoplay" scrolling="no"></iframe>
      <div class="bt-fx" data-fx aria-live="polite"></div>
      <div class="bt-side">
        <span class="bp-pill" data-pill hidden></span>
        <a class="sm-btn bb-chrome bb-chrome--soft bt-back" href="#/admin" aria-label="${esc(t('game.back'))}">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M11 3L5 9l6 6"/></svg>
        </a>
      </div>
    </div>`;
  const frame = root.querySelector('.bt-frame');
  const fx = root.querySelector('[data-fx]');
  const pill = root.querySelector('[data-pill]');
  // the game gets the touches straight away (no extra tap needed on phones)
  frame.addEventListener('load', () => { try { frame.contentWindow.focus(); } catch { /* ignore */ } });

  let total = null, capShown = false, dbReady = true;
  const showTotal = (n) => {
    total = n;
    pill.hidden = false;
    pill.innerHTML = `<b>${esc(Number(n).toLocaleString())}</b> ${esc(t('game.budPoints'))}`;
  };
  // not logged in: the game still works, one small note (can't happen on this admin page today,
  // but stays right when the page opens to everyone)
  if (!user) {
    pill.hidden = false;
    pill.innerHTML = `<a href="#/profile">${esc(t('game.loginToEarn'))}</a>`;
  } else {
    gameMyStats().then((r) => showTotal(r.budPoints)).catch(() => { dbReady = false; });
  }

  // one call at a time, in order
  let chain = Promise.resolve();
  const run = (fn) => { chain = chain.then(fn).catch(() => { /* ignore one failed call */ }); };

  function onMessage(e) {
    if (!root.isConnected) { window.removeEventListener('message', onMessage); return; }
    if (e.origin !== window.location.origin) return;
    const d = e.data;
    if (!d || typeof d !== 'object' || d.source !== SOURCE) return;
    if (!user || !dbReady) return;
    if (d.type === 'throw') {
      const pts = Number(d.points) || 0;
      const n = pts > 0 ? Math.max(1, Math.floor(pts / 100)) : 0;
      if (!n) return;
      run(async () => {
        const before = total ?? 0;
        const r = await gameAddPoints(n);
        const got = r.budPoints - before;
        showTotal(r.budPoints);
        if (got > 0) pointsChip(fx, got);
        else if (!capShown) { capShown = true; pointsChip(fx, 0); fx.lastChild.textContent = t('game.dailyMax'); }
      });
    } else if (d.type === 'playtime') {
      const s = Math.min(Number(d.seconds) || 0, 15);
      if (s <= 0) return;
      run(async () => {
        const r = await gameAddSeconds(s, gameDemo());
        if (r.newBadges?.length) showBadgeUnlock(r.newBadges);
      });
    }
  }
  window.addEventListener('message', onMessage);
}
