// PHYSICAL PRESS: buttons and chips sink in while pressed (CSS ".is-pressed") and
// spring back when released. The pressed look stays for at least 100 ms, so even a
// very quick tap is clearly visible. On Android a short 18 ms vibration confirms the
// tap (iPhones don't allow web vibration, so they just get the visual press).
const TARGETS = '.btn, .bb-chip, .btn-vote, .tabs button, .lang button, .report-btn';
const MIN_PRESS_MS = 100;
const VIBRATE_MS = 18;
let pressed = null;
let pressedAt = 0;

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
}

document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest?.(TARGETS);
  if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
  press(el);
  if (e.pointerType === 'touch' && navigator.vibrate) {
    try { navigator.vibrate(VIBRATE_MS); } catch { /* not allowed: ignore */ }
  }
}, { passive: true });

['pointerup', 'pointercancel', 'pointerleave', 'dragstart'].forEach((t) => document.addEventListener(t, release, { passive: true }));
window.addEventListener('blur', release);
document.addEventListener('scroll', release, { passive: true, capture: true }); // scrolling a list must not leave a button stuck

// keyboard: Enter / Space press the focused button the same way
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.(TARGETS) && !e.repeat) {
    press(e.target);
  }
});
document.addEventListener('keyup', release);
