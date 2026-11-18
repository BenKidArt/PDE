// GAME POINTS + BADGE MOMENTS (Zillah Banana Toss, login days)
//   showBadgeUnlock(ids)   full-screen "badge unlocked" moment (queued, one after another)
//   pointsChip(host, n)    small "+n BudPoints" pill that floats up for ~1.5 s
//   checkLoginDay()        once per app start: counts today's login day (10 Days Deep on day 10)
//   gameDemo()             admin "Demo mode" switch (localStorage): Banana Blaster after 1 minute
import { t, getLang } from './i18n.js';
import { esc } from './ui.js';
import { getCurrentUser, getBadgeCatalog, gameLoginDay } from './store.js';

const DEMO_KEY = 'bb.gameDemo';
export function gameDemo() { try { return localStorage.getItem(DEMO_KEY) === '1'; } catch { return false; } }
export function setGameDemo(on) { try { localStorage.setItem(DEMO_KEY, on ? '1' : '0'); } catch { /* ignore */ } }

// ---------- badge unlock moment ----------
const queue = [];
let showing = false;
export function showBadgeUnlock(ids) {
  (ids || []).forEach((id) => { if (!queue.includes(id)) queue.push(id); });
  if (!showing) next();
}
async function next() {
  const id = queue.shift();
  if (!id) { showing = false; return; }
  showing = true;
  const badge = (await getBadgeCatalog().catch(() => [])).find((b) => b.id === id);
  const lang = getLang();
  const name = badge?.name?.[lang] || badge?.name?.en || id;
  const img = badge?.image || '';
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const el = document.createElement('div');
  el.className = `bu${reduce ? ' bu-calm' : ''}`;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'bu-name');
  const COLORS = ['var(--neon-green)', 'var(--neon-pink)', '#ffd43b', '#ffffff'];
  const sparks = reduce ? '' : Array.from({ length: 26 }, (_, i) => {
    const a = (i / 26) * 360 + (i % 3) * 7, d = 120 + (i * 37) % 110, s = 4 + (i % 4) * 2;
    return `<i style="--a:${a}deg;--d:${d}px;--s:${s}px;--c:${COLORS[i % 4]};--t:${(i % 5) * 40}ms"></i>`;
  }).join('');
  el.innerHTML = `
    <div class="bu-box">
      <p class="bu-kicker">${esc(t('game.badgeUnlocked'))}</p>
      <div class="bu-stage" aria-hidden="true">
        <span class="bu-rays"></span><span class="bu-ring"></span><span class="bu-sparks">${sparks}</span>
        ${img ? `<img class="bu-img" src="${esc(img)}" alt="">` : ''}
      </div>
      <h2 class="bu-name" id="bu-name">${esc(name)}</h2>
      <p class="bu-sub">${esc(t('game.addedToProfile'))}</p>
      <button type="button" class="btn btn-go bu-ok">${esc(t('game.nice'))}</button>
    </div>`;
  document.body.appendChild(el);
  try { navigator.vibrate?.([30, 60, 40]); } catch { /* ignore */ }
  const ok = el.querySelector('.bu-ok');
  setTimeout(() => ok.focus({ preventScroll: true }), reduce ? 50 : 1300);
  const close = () => {
    el.classList.add('bu-out');
    setTimeout(() => { el.remove(); next(); }, reduce ? 0 : 260);
  };
  ok.addEventListener('click', close, { once: true });
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

// ---------- "+X BudPoints" chip ----------
export function pointsChip(host, n) {
  const c = document.createElement('div');
  c.className = 'bp-chip';
  c.textContent = t('game.plusPoints', { n });
  host.appendChild(c);
  setTimeout(() => c.remove(), 1600);
}

// ---------- login days (once per page load) ----------
let loginChecked = false;
export async function checkLoginDay() {
  if (loginChecked) return;
  const user = await getCurrentUser().catch(() => null);
  if (!user) return;
  loginChecked = true;
  try {
    const r = await gameLoginDay();
    if (r?.newBadges?.length) showBadgeUnlock(r.newBadges);
  } catch { /* database update 019 not run yet: no login days */ }
}
