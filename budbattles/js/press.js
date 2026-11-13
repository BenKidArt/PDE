// PHYSICAL PRESS: buttons and chips sink in while pressed (CSS ".is-pressed") and
// spring back when released. On Android a tiny 10 ms vibration confirms the tap
// (iPhones don't allow web vibration, so they just get the visual press).
const TARGETS = '.btn, .bb-chip, .btn-vote, .tabs button, .lang button';
let pressed = null;

function release() {
  if (pressed) pressed.classList.remove('is-pressed');
  pressed = null;
}

document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest?.(TARGETS);
  if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
  release();
  pressed = el;
  el.classList.add('is-pressed');
  if (e.pointerType === 'touch' && navigator.vibrate) {
    try { navigator.vibrate(10); } catch { /* not allowed: ignore */ }
  }
}, { passive: true });

['pointerup', 'pointercancel', 'pointerleave', 'dragstart'].forEach((t) => document.addEventListener(t, release, { passive: true }));
window.addEventListener('blur', release);
document.addEventListener('scroll', release, { passive: true, capture: true }); // scrolling a list must not leave a button stuck

// keyboard: Enter / Space press the focused button the same way
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.(TARGETS) && !e.repeat) {
    release(); pressed = e.target; pressed.classList.add('is-pressed');
  }
});
document.addEventListener('keyup', release);
