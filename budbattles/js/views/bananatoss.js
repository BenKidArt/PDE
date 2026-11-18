// ZILLAH BANANA TOSS (hidden admin page, #/banana-toss): the finished mini game from
// games/zillah-banana-toss.html, shown full-screen in an iframe. The game file is
// used unchanged. Points, badges and partner codes are NOT connected to accounts
// yet (the partner codes in the game are demo placeholders).
import { t } from '../i18n.js';
import { esc } from '../ui.js';
import { getCurrentUser } from '../store.js';

const GAME_URL = 'games/zillah-banana-toss.html';

export async function renderBananaToss(root) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) { // hidden preview: admins only
    root.innerHTML = `<section class="card"><p>${esc(t('admin.noAccess'))}</p></section>`;
    return;
  }
  root.innerHTML = `
    <div class="bt-game">
      <iframe class="bt-frame" src="${GAME_URL}" title="${esc(t('game.frameTitle'))}" allow="fullscreen; autoplay" scrolling="no"></iframe>
      <a class="sm-btn bb-chrome bb-chrome--soft bt-back" href="#/admin" aria-label="${esc(t('game.back'))}">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M11 3L5 9l6 6"/></svg>
      </a>
    </div>`;
  // the game gets the touches straight away (no extra tap needed on phones)
  root.querySelector('.bt-frame').addEventListener('load', (e) => { try { e.target.contentWindow.focus(); } catch { /* ignore */ } });
}
