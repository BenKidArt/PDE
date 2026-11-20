// ZILLAH BANANA TOSS (hidden admin page, #/banana-toss): the finished mini game from
// games/zillah-banana-toss.html, shown full-screen in an iframe. The game file is
// used unchanged; it reports to this page with window.postMessage:
//   { source:'zillah-banana-toss', type:'ready' }
//   { …, type:'throw', meters, rings, combo, comboEvents, … } → BudPoints (logged in only)
//   { …, type:'round', roundPoints, bestMeters }
// BudPoints per throw, limit (45 per 12 h) and the badges at 35 / 120 / 200 lifetime
// Banana Toss points: see js/budpoints-config.js (the database checks them).
// TODO (real launch): throws are reported by the browser – needs server-side checks against cheating.
// Partner codes inside the game are demo placeholders and are not connected.
import { t } from '../i18n.js';
import { esc } from '../ui.js';
import { getCurrentUser, gameTossThrow, gameTossRound, gameMyStats } from '../store.js';
import { showBadgeUnlock, pointsChip } from '../gamebadges.js';
import { progressText, maxedText, pointsToast } from '../budpoints.js';

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
      <div class="bt-status" data-status hidden></div>
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
  frame.addEventListener('load', () => {
    try { frame.contentWindow.focus(); } catch { /* ignore */ }
    setTimeout(() => placeStatus(), 300);
    // the game's end-of-round card covers the field: hide our status line while it is open
    try {
      const sheet = frame.contentDocument.getElementById('sheet');
      const sync = () => statusEl.classList.toggle('is-covered', !sheet.hidden);
      new MutationObserver(sync).observe(sheet, { attributes: true, attributeFilter: ['hidden'] });
      sync();
    } catch { /* ignore */ }
  });

  const statusEl = root.querySelector('[data-status]');
  let last = null, dbReady = true;
  // pill: balance · status line: "Next: Badge Shop at 120 (you have 84)" or "Points maxed – back in 3h 12m"
  const show = (r) => {
    last = r;
    pill.hidden = false;
    pill.innerHTML = `<b>${esc(Number(r.budPoints).toLocaleString())}</b> <span class="bp-word">${esc(t('game.budPoints'))}</span>`;
    pill.title = `${r.budPoints} ${t('game.budPoints')}`;
    placeStatus();
    const maxed = maxedText(r);
    statusEl.hidden = false;
    statusEl.classList.toggle('is-maxed', !!maxed);
    statusEl.textContent = maxed || progressText(r.tossEarned);
  };
  // the status line sits just under the game's hint box (its height changes with the text)
  function placeStatus() {
    try {
      const hint = frame.contentDocument?.querySelector('.bottom');
      const y = hint ? hint.getBoundingClientRect().bottom + 8 : 160;
      root.querySelector('.bt-game').style.setProperty('--bt-status-top', `${Math.round(y)}px`);
    } catch { /* ignore */ }
  }
  window.addEventListener('resize', placeStatus);
  const tick = setInterval(() => { if (!root.isConnected) { clearInterval(tick); window.removeEventListener('resize', placeStatus); return; } if (last) show(last); }, 30000);
  const follow = setInterval(() => { if (!root.isConnected) { clearInterval(follow); return; } placeStatus(); }, 2000);
  // not logged in: the game still works, one small note (can't happen on this admin page today,
  // but stays right when the page opens to everyone)
  if (!user) {
    pill.hidden = false;
    pill.innerHTML = `<a href="#/profile">${esc(t('game.loginToEarn'))}</a>`;
    pill.classList.add("bp-note");
  } else {
    gameMyStats().then(show).catch(() => { dbReady = false; });
  }

  let roundGranted = 0;
  function writeRoundLine() {
    try {
      const el = frame.contentDocument?.getElementById('appPts');
      if (!el) return;
      const maxed = last ? maxedText(last) : null;
      el.innerHTML = `${esc(t('game.roundEarned', { n: roundGranted }))}${maxed ? `<small>${esc(maxed)}</small>` : ''}`;
      el.hidden = false;
    } catch { /* ignore */ }
  }

  // one call at a time, in order
  let chain = Promise.resolve();
  const run = (fn) => { chain = chain.then(fn).catch(() => { /* ignore one failed call */ }); };

  function onMessage(e) {
    if (!root.isConnected) { window.removeEventListener('message', onMessage); return; }
    if (e.origin !== window.location.origin) return;
    const d = e.data;
    if (!d || typeof d !== 'object' || d.source !== SOURCE) return;
    if (!user || !dbReady) {
      if (d.type === 'round') try { const el = frame.contentDocument?.getElementById('appPts'); if (el) { el.textContent = t('game.loginToEarn'); el.hidden = false; } } catch { /* ignore */ }
      return;
    }
    if (d.type === 'round') {
      // end-of-round card in the game: "+12 BudBattles points" under the score (after all throws are counted)
      run(async () => {
        writeRoundLine(); roundGranted = 0;
        // Banana Crown: one play day per Finnish calendar day
        const r = await gameTossRound(d.roundPoints);
        if (r.newDay && r.days <= r.daysNeeded) pointsToast(0, t('bp.playDay', { n: r.days, max: r.daysNeeded }));
        if (r.newBadges?.length) setTimeout(() => showBadgeUnlock(r.newBadges), 900);
      });
    } else if (d.type === 'throw') {
      run(async () => {
        const wasShop = !!last?.shopUnlocked;
        const r = await gameTossThrow({ meters: d.meters, rings: d.rings, combo: d.combo === true });
        show(r);
        roundGranted += r.granted || 0;
        if (r.granted > 0) pointsChip(fx, r.granted);
        if (r.shopUnlocked && !wasShop) setTimeout(() => pointsToast(0, t('bp.shopOpen')), 700);
        if (r.newBadges?.length) setTimeout(() => showBadgeUnlock(r.newBadges), 900);
      });
    }
  }
  window.addEventListener('message', onMessage);
}
