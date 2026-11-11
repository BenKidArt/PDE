// WELCOME / LOGIN / LOGOUT POPUP ANIMATION (CSS + JS only, no video/GIF).
// Sign-up: kangaroo hops in (6-frame flipbook). Login: penguin drifts in on his ice block,
// toasts with his pipe and winks (6-frame flipbook).
// Logout: hippie waves, walks (flipbook) through the neon door, door slams shut.
// Tap to skip. Max 3 s (sign-up), 3.5 s (login), 4 s (logout).
// With "reduce motion" on the phone: a simple fade only.
// Shown only right after the action (sign-up, login, logout) – never on refresh.
// Frames are loaded only when the animation starts and never shown bigger than their real size.
import { t } from './i18n.js';
import { esc } from './ui.js';

const P = 'assets/popups/';
const range = (name) => [1, 2, 3, 4, 5, 6].map((i) => `${P}${name}_${i}.webp`);
// frames, shown size in CSS px (canvas ratio kept), total = gone after, max = hard limit, text = when the text pops
const KINDS = {
  signup: { frames: range('kangaroo_hop'), w: 110, h: 200, total: 2850, max: 3000 },
  login: { frames: range('penguin_drift'), w: 167, h: 230, total: 3450, max: 3500 },
  logout: { frames: range('hippie_walk'), w: 117, h: 250, total: 3850, max: 4000 },
};
const FRAME_MS = 125; // 8 frames per second

let current = Promise.resolve();
let expected = null; // { resolve } while a login/sign-up is in progress

/** Resolves when no welcome animation is running or about to run (the name popup waits for this). */
export function waitForWelcome() { return current; }

/** Call right BEFORE login / sign-up: other popups wait until the welcome has played. */
export function expectWelcome() {
  let resolve;
  current = new Promise((r) => { resolve = r; });
  expected = { resolve };
  setTimeout(() => cancelWelcome(), 7000); // safety: never block other popups for long
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
  const total = reduce ? 2000 : cfg.total;
  const flip = cfg.frames.length > 1;

  // load the frames only now (wait at most 700 ms so the popup is never late)
  await Promise.race([
    Promise.all(cfg.frames.map((src) => new Promise((res) => {
      const i = new Image(); i.onload = () => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()).then(res); i.onerror = res; i.src = src;
    }))),
    sleep(700),
  ]);

  const sub = kind === 'login' ? t('welcome.login.sub', { name: name || 'Grower' }) : t(`welcome.${kind}.sub`);
  const startFrame = reduce ? (kind === 'logout' ? 1 : 6) : 1;
  const charStyle = flip ? ` style="--cw:${cfg.w}px;--chh:${cfg.h}px"` : '';
  const el = document.createElement('div');
  el.className = `wl-overlay wl-${kind}${reduce ? ' wl-reduced' : ''}${flip ? ' wl-flip' : ''}`;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `
    <div class="wl-stage">
      <div class="wl-scene"${charStyle}>
        ${kind === 'logout' && !reduce ? DOOR : ''}
        <div class="wl-char"><div class="wl-glow"></div>
          <div class="wl-frames">${cfg.frames.map((src, i) => `<img src="${esc(src)}" alt="" class="${i + 1 === startFrame ? 'on' : ''}" draggable="false">`).join('')}</div>
        </div>
      </div>
      ${reduce ? '' : '<span class="wl-spark s1"></span><span class="wl-spark s2"></span><span class="wl-spark s3"></span><span class="wl-spark s4"></span><span class="wl-spark s5"></span><span class="wl-spark s6"></span>'}
      <p class="wl-text"><span class="wl-big">${esc(t(`welcome.${kind}.big`))}</span><span class="wl-sub">${esc(sub)}</span></p>
      <span class="wl-skip">${esc(t('welcome.skip'))}</span>
    </div>`;
  document.body.appendChild(el);

  const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  if (!reduce && kind === 'signup') kangarooHop(el, at);
  if (!reduce && kind === 'logout') hippieExit(el, at);
  if (!reduce && kind === 'login') penguinDrift(el, at);

  await new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      el.classList.add('wl-out');
      setTimeout(() => { el.remove(); resolve(); }, 250);
    };
    el.addEventListener('click', finish);                 // tap anywhere to skip
    setTimeout(finish, total - 250);                      // fades out by itself
    setTimeout(() => { if (!done) { el.remove(); resolve(); } }, cfg.max); // hard limit
  });
}

/** Show frame n (1-based) of the flipbook. */
function show(el, n) {
  el.querySelectorAll('.wl-frames img').forEach((im, i) => im.classList.toggle('on', i === n - 1));
}

// ---------- SIGN-UP: kangaroo, one big hop from the left edge to the centre ----------
function kangarooHop(el, at) {
  const char = el.querySelector('.wl-char');
  const frames = el.querySelector('.wl-frames');
  const scene = el.querySelector('.wl-scene');
  const sceneBox = scene.getBoundingClientRect();
  const w = char.offsetWidth;
  const startX = -(sceneBox.left + sceneBox.width / 2) + w / 2 + 6; // left edge of the screen
  const hop = { delay: 250, duration: FRAME_MS * 4, easing: 'cubic-bezier(.35,.55,.45,1)', fill: 'both' };
  char.animate([{ transform: `translateX(${startX}px)` }, { transform: 'translateX(0)' }], hop);
  at(250, () => show(el, 2));
  at(375, () => show(el, 3));
  at(500, () => show(el, 4));
  at(625, () => {
    show(el, 5); // landing: squash + dust puff
    frames.animate([
      { transform: 'scale(1, 1)' }, { transform: 'scale(1.1, .86)', offset: 0.35 },
      { transform: 'scale(.96, 1.05)', offset: 0.7 }, { transform: 'scale(1, 1)' },
    ], { duration: 320, easing: 'ease-out' });
    puff(scene, char);
  });
  at(875, () => show(el, 6)); // standing, tipping his hat
}

function puff(scene, char) {
  const box = char.getBoundingClientRect();
  const sb = scene.getBoundingClientRect();
  const x = box.left - sb.left + box.width / 2;
  const y = box.bottom - sb.top - 4;
  for (let i = 0; i < 9; i++) {
    const p = document.createElement('span');
    p.className = i % 3 === 2 ? 'wl-puff wl-puff-spark' : 'wl-puff';
    p.style.left = `${x}px`; p.style.top = `${y}px`;
    scene.appendChild(p);
    const dir = i % 2 ? 1 : -1;
    const dx = dir * (18 + Math.random() * 46);
    const dy = -(6 + Math.random() * 22);
    p.animate([
      { transform: 'translate(-50%, -50%) scale(.4)', opacity: 0.9 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.4)`, opacity: 0 },
    ], { duration: 520 + Math.random() * 200, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
  }
}

// ---------- LOGIN: penguin drifts in on his ice block, toasts, winks ----------
function penguinDrift(el, at) {
  const char = el.querySelector('.wl-char');
  const frames = el.querySelector('.wl-frames');
  const scene = el.querySelector('.wl-scene');
  const sb = scene.getBoundingClientRect();
  const w = char.offsetWidth;
  const startX = -(sb.left + sb.width / 2) + w / 2 + 4; // left edge of the screen
  // 1) fast slide in (frame 1, speed lines)
  char.animate([
    { transform: `translateX(${startX}px)` }, { transform: 'translateX(-16px)', offset: 0.6 }, { transform: 'translateX(0)' },
  ], { duration: 1000, easing: 'cubic-bezier(.2,.75,.3,1)', fill: 'both' });
  // 2) drift: the block swings sideways and back with an overshoot wobble + ice spray
  frames.animate([
    { transform: 'rotate(0)' }, { transform: 'rotate(-18deg)', offset: 0.28 }, { transform: 'rotate(-16deg)', offset: 0.5 },
    { transform: 'rotate(7deg)', offset: 0.7 }, { transform: 'rotate(-3deg)', offset: 0.86 }, { transform: 'rotate(0)' },
  ], { delay: 330, duration: 720, easing: 'ease-in-out' });
  at(420, () => spray(scene, char, 'ice'));
  at(600, () => spray(scene, char, 'ice'));
  // 3) stops in the centre: skid marks + small squash
  at(1050, () => {
    show(el, 2);
    frames.animate([{ transform: 'scale(1, 1)' }, { transform: 'scale(1.07, .92)', offset: 0.4 }, { transform: 'scale(1, 1)' }],
      { duration: 240, easing: 'ease-out' });
  });
  // 4) lifts the pipe and toasts like a gentleman
  at(1330, () => show(el, 3));
  at(1480, () => {
    show(el, 4);
    frames.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-10px)', offset: 0.4 }, { transform: 'translateY(0)' }],
      { duration: 300, easing: 'ease-out' });
    twinkle(scene, char, 0.8, 0.38, ['#3dff8a', '#ff3fa4']);
  });
  // 5) the wink – frame 6 is held for 0.4 s, with a twinkle next to the eye
  at(1800, () => show(el, 5));
  at(1940, () => { show(el, 6); twinkle(scene, char, 0.37, 0.21, ['#ffffff']); });
}

/** Little particles from the bottom of the character ('ice' spray or dust). */
function spray(scene, char, type) {
  const box = char.getBoundingClientRect();
  const sb = scene.getBoundingClientRect();
  for (let i = 0; i < 12; i++) {
    const p = document.createElement('span');
    p.className = `wl-puff wl-${type}`;
    const x = box.left - sb.left + box.width * (0.15 + Math.random() * 0.7);
    p.style.left = `${x}px`; p.style.top = `${box.bottom - sb.top - 6}px`;
    scene.appendChild(p);
    const dx = -(20 + Math.random() * 60); // sprays backwards (to the left)
    const dy = -(10 + Math.random() * 40);
    p.animate([
      { transform: 'translate(-50%, -50%) scale(.6)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.1)`, opacity: 0 },
    ], { duration: 450 + Math.random() * 250, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
  }
}

/** A small star twinkle at a spot on the character (fx, fy = 0–1 of its box). */
function twinkle(scene, char, fx, fy, colors) {
  const box = char.getBoundingClientRect();
  const sb = scene.getBoundingClientRect();
  colors.forEach((c, i) => {
    const s = document.createElement('span');
    s.className = 'wl-twinkle';
    s.textContent = '✦';
    s.style.color = c;
    s.style.textShadow = `0 0 6px ${c}, 0 0 14px ${c}`;
    s.style.left = `${box.left - sb.left + box.width * fx + i * 16}px`;
    s.style.top = `${box.top - sb.top + box.height * fy - i * 10}px`;
    scene.appendChild(s);
    s.animate([
      { transform: 'translate(-50%, -50%) scale(0) rotate(0)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1.3) rotate(45deg)', opacity: 1, offset: 0.35 },
      { transform: 'translate(-50%, -50%) scale(.9) rotate(90deg)', opacity: 1, offset: 0.7 },
      { transform: 'translate(-50%, -50%) scale(0) rotate(135deg)', opacity: 0 },
    ], { delay: i * 90, duration: 520, easing: 'ease-out', fill: 'both' });
  });
}

// ---------- LOGOUT: hippie waves, walks to the door, goes in, door slams ----------
function hippieExit(el, at) {
  const char = el.querySelector('.wl-char');
  const frames = el.querySelector('.wl-frames');
  const scene = el.querySelector('.wl-scene');
  const door = el.querySelector('.wl-door');
  const leaf = el.querySelector('.wl-door-leaf');
  const light = el.querySelector('.wl-door-light');
  const frame = el.querySelector('.wl-door-frame');
  const sb = scene.getBoundingClientRect();
  const db = door.getBoundingClientRect();
  const w = char.offsetWidth;
  const doorX = db.left + db.width / 2 - (sb.left + sb.width / 2); // door centre relative to scene centre
  const startX = Math.max(-(sb.left + sb.width / 2) + w / 2 + 10, -sb.width * 0.38); // near the left edge
  const atDoorX = doorX - db.width * 0.62;
  char.style.transform = `translateX(${startX}px)`;

  // 0–600 ms: waving with a small sway
  frames.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-3deg)' }, { transform: 'rotate(3deg)' }, { transform: 'rotate(-2deg)' }, { transform: 'rotate(0)' }],
    { duration: 600, easing: 'ease-in-out' });
  // 600–1600 ms: walk cycle 2→3→4→5, twice, moving to the door
  char.animate([{ transform: `translateX(${startX}px)` }, { transform: `translateX(${atDoorX}px)` }],
    { delay: 600, duration: FRAME_MS * 8, easing: 'linear', fill: 'both' });
  [2, 3, 4, 5, 2, 3, 4, 5].forEach((n, i) => at(600 + i * FRAME_MS, () => show(el, n)));
  // 1600–1900 ms: glancing back at the door
  at(1600, () => show(el, 6));
  // 1900–2150 ms: steps in, behind the door frame
  char.animate([
    { transform: `translateX(${atDoorX}px) scale(1)`, opacity: 1 },
    { transform: `translateX(${doorX}px) scale(.9)`, opacity: 0 },
  ], { delay: 1900, duration: 250, easing: 'ease-in', fill: 'forwards' });
  // 2150 ms: door SLAMS shut
  leaf.animate([{ transform: 'perspective(420px) rotateY(68deg)' }, { transform: 'perspective(420px) rotateY(0deg)' }],
    { delay: 2150, duration: 120, easing: 'cubic-bezier(.6,0,1,.6)', fill: 'forwards' });
  light.animate([{ opacity: 1 }, { opacity: 0 }], { delay: 2150, duration: 120, fill: 'forwards' });
  at(2270, () => {
    scene.animate([
      { transform: 'translate(0, 0)' }, { transform: 'translate(-6px, 3px)' }, { transform: 'translate(5px, -2px)' },
      { transform: 'translate(-3px, 1px)' }, { transform: 'translate(0, 0)' },
    ], { duration: 260, easing: 'ease-out' });
    frame.animate([
      { filter: 'brightness(2)' }, { filter: 'brightness(.3)' }, { filter: 'brightness(1.6)' },
      { filter: 'brightness(.5)' }, { filter: 'brightness(1.3)' }, { filter: 'none' },
    ], { duration: 450, easing: 'steps(6, end)' });
    burst(scene, db, sb);
  });
}

function burst(scene, db, sb) {
  const cx = db.left - sb.left + db.width / 2;
  const cy = db.top - sb.top + db.height / 2;
  for (let i = 0; i < 24; i++) {
    const s = document.createElement('span');
    s.className = `wl-burst${i % 2 ? ' pink' : ''}`;
    s.style.left = `${cx}px`; s.style.top = `${cy}px`;
    scene.appendChild(s);
    const a = (i / 24) * Math.PI * 2 + Math.random() * 0.3;
    const r = 70 + Math.random() * 80;
    s.animate([
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r}px)) scale(.3)`, opacity: 0 },
    ], { duration: 600 + Math.random() * 200, easing: 'cubic-bezier(.1,.8,.3,1)', fill: 'forwards' });
  }
}

// neon door drawn in code: frame (front), warm light inside, door leaf (open) that slams shut
const DOOR = `
  <div class="wl-door" aria-hidden="true">
    <div class="wl-door-light"></div>
    <div class="wl-door-leaf"><span class="wl-door-knob"></span></div>
    <div class="wl-door-frame"></div>
  </div>`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
