// WELCOME / LOGIN / LOGOUT POPUP ANIMATION (CSS + JS only, no video/GIF).
// Sign-up: kangaroo hops in. Login: penguin slides in on his ice block (part of the picture).
// Logout: hippie walks through a neon door. Tap to skip.
// Max 2.5 s (sign-up, login) / 3.5 s (logout, because of the door).
// With "reduce motion" on the phone: a simple fade only.
// Shown only right after the action (sign-up, login, logout) – never on refresh.
import { t } from './i18n.js';
import { esc } from './ui.js';

// img = character picture, total = when it is gone, max = hard limit
const KINDS = {
  signup: { img: 'popup_kangaroo', total: 2400, max: 2500 },
  login: { img: 'popup_penguin', total: 2300, max: 2500 },
  logout: { img: 'popup_hippie', total: 3400, max: 3500 },
};
let current = Promise.resolve();
let expected = null; // { resolve } while a login/sign-up is in progress

/** Resolves when no welcome animation is running or about to run (the name popup waits for this). */
export function waitForWelcome() { return current; }

/** Call right BEFORE login / sign-up: other popups wait until the welcome has played. */
export function expectWelcome() {
  let resolve;
  current = new Promise((r) => { resolve = r; });
  expected = { resolve };
  setTimeout(() => cancelWelcome(), 6000); // safety: never block other popups for long
}

/** The login / sign-up failed: nothing to wait for. */
export function cancelWelcome() {
  if (expected) { expected.resolve(); expected = null; }
}

/** kind: 'signup' | 'login' | 'logout'; name: profile name for 'login'. */
export function showWelcome(kind, name = '') {
  const waiting = expected;
  expected = null;
  current = run(kind, name).catch(() => {}).finally(() => waiting?.resolve());
  return current;
}

async function run(kind, name) {
  document.querySelector('.wl-overlay')?.remove();
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const cfg = KINDS[kind] || KINDS.signup;
  const total = reduce ? Math.min(cfg.total, 2000) : cfg.total;
  const src = `assets/popups/${cfg.img}.webp`;
  // load the picture only now (wait at most 400 ms so the popup is never late)
  await Promise.race([new Promise((res) => { const i = new Image(); i.onload = res; i.onerror = res; i.src = src; }), sleep(400)]);

  const sub = kind === 'login' ? t('welcome.login.sub', { name: name || 'Grower' }) : t(`welcome.${kind}.sub`);
  const el = document.createElement('div');
  el.className = `wl-overlay wl-${kind}${reduce ? ' wl-reduced' : ''}`;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `
    <div class="wl-stage">
      <div class="wl-scene">
        ${kind === 'logout' ? DOOR : ''}
        <div class="wl-char"><div class="wl-glow"></div><img src="${esc(src)}" alt="" width="170" height="255"></div>
      </div>
      ${reduce ? '' : '<span class="wl-spark s1"></span><span class="wl-spark s2"></span><span class="wl-spark s3"></span><span class="wl-spark s4"></span><span class="wl-spark s5"></span><span class="wl-spark s6"></span>'}
      <p class="wl-text"><span class="wl-big">${esc(t(`welcome.${kind}.big`))}</span><span class="wl-sub">${esc(sub)}</span></p>
      <span class="wl-skip">${esc(t('welcome.skip'))}</span>
    </div>`;
  document.body.appendChild(el);

  await new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.classList.add('wl-out');
      setTimeout(() => { el.remove(); resolve(); }, 250);
    };
    el.addEventListener('click', finish);                 // tap anywhere to skip
    setTimeout(finish, total - 250);                      // fades out by itself
    setTimeout(() => { if (!done) { el.remove(); resolve(); } }, cfg.max); // hard limit
  });
}

// neon door drawn in code: frame (front), warm light inside, door leaf that swings shut
const DOOR = `
  <div class="wl-door" aria-hidden="true">
    <div class="wl-door-light"></div>
    <div class="wl-door-leaf"><span class="wl-door-knob"></span></div>
    <div class="wl-door-frame"></div>
  </div>`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
