// PHYSICAL PRESS: buttons and chips sink in while pressed (CSS ".is-pressed") and
// spring back when released. The pressed look stays for at least 100 ms, so even a
// very quick tap is clearly visible.
//
// VIBRATION (Android; iPhones don't allow web vibration): a 20 ms buzz on every tap
// of anything tappable (buttons, links styled as buttons, chips, tabs, menu links).
// Chrome only allows navigator.vibrate() inside a real tap, and a finger's
// "pointerdown" doesn't count until the page has had its first full tap. So:
//   – once the page has been tapped before: buzz right at pointerdown (instant feel)
//   – the very first tap: buzz at pointerup, which Chrome does count as a tap
// Nothing else switches it off (no reduced-motion check; errors are ignored).
const PRESS_TARGETS = '.btn, .bb-chip, .btn-vote, .tabs button, .lang button, .report-btn, .bb-chrome';
const TAP_TARGETS = `${PRESS_TARGETS}, button, [role="button"], a[href], label.check, input[type="checkbox"], input[type="radio"], select, summary`;
const MIN_PRESS_MS = 100;
const VIBRATE_MS = 20;
let pressed = null;
let pressedAt = 0;
let buzzOnRelease = false;

function buzz() {
  try { if (typeof navigator.vibrate === 'function') navigator.vibrate(VIBRATE_MS); } catch { /* not allowed: ignore */ }
}

/** Has this page already had a real tap (so Chrome allows vibrate at pointerdown)? */
function tappedBefore() {
  const ua = navigator.userActivation;
  return ua ? ua.hasBeenActive : true; // browsers without the API decide themselves
}

function release() {
  const el = pressed;
  pressed = null;
  if (!el) return;
  const left = MIN_PRESS_MS - (performance.now() - pressedAt);
  if (left > 0) setTimeout(() => { if (pressed !== el) el.classList.remove('is-pressed'); }, left);
  else el.classList.remove('is-pressed');
}

function press(el) {
  release();
  pressed = el;
  pressedAt = performance.now();
  el.classList.add('is-pressed');
  shine(el);
}

// CHROME SHINE: main buttons get one light sweep per press (CSS ".is-shine").
const SHINE_TARGETS = '.btn-go, .btn-vote, .btn-primary, .bb-chrome';
function shine(el) {
  if (!el.matches(SHINE_TARGETS) || (el.matches('.btn-small, .btn-xs') && !el.matches('.bb-chrome'))) return;
  el.classList.remove('is-shine');
  void el.offsetWidth; // restart the sweep on a quick second tap
  el.classList.add('is-shine');
  clearTimeout(el._shineT);
  el._shineT = setTimeout(() => el.classList.remove('is-shine'), 700);
}

document.addEventListener('pointerdown', (e) => {
  buzzOnRelease = false;
  const tap = e.target.closest?.(TAP_TARGETS);
  if (!tap || tap.disabled || tap.getAttribute('aria-disabled') === 'true') return;
  const el = e.target.closest?.(PRESS_TARGETS);
  if (el && !el.disabled) press(el);
  if (e.pointerType === 'mouse') return; // vibration is for fingers (and pens)
  if (tappedBefore()) buzz();
  else buzzOnRelease = true;
}, { passive: true, capture: true });

document.addEventListener('pointerup', () => {
  if (buzzOnRelease) { buzzOnRelease = false; buzz(); } // first tap on the page
}, { passive: true, capture: true });
document.addEventListener('pointercancel', () => { buzzOnRelease = false; }, { passive: true, capture: true });

['pointerup', 'pointercancel', 'pointerleave', 'dragstart'].forEach((t) => document.addEventListener(t, release, { passive: true }));
window.addEventListener('blur', release);
document.addEventListener('scroll', release, { passive: true, capture: true }); // scrolling a list must not leave a button stuck

// keyboard: Enter / Space press the focused button the same way
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.(PRESS_TARGETS) && !e.repeat) {
    press(e.target);
  }
});
document.addEventListener('keyup', release);
