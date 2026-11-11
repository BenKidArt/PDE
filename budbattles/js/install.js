// "INSTALL THE APP": Android/Chrome → the browser's real install prompt.
// iPhone/iPad → a short picture guide (Share → "Zum Home-Bildschirm").
// Hidden when the app is already installed. The Home banner can be closed for good.
import { t } from './i18n.js';
import { esc } from './ui.js';

const BANNER_KEY = 'bb.installBanner.closed';
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();            // we show our own button instead of the browser's mini bar
  deferredPrompt = e;
  window.dispatchEvent(new Event('bb-installable'));
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  window.dispatchEvent(new Event('bb-installable'));
});

export function isInstalled() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function isIOS() {
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Show the button at all? (Android/Chrome with a prompt ready, or iPhone; never when installed) */
export function canInstall() {
  return !isInstalled() && (!!deferredPrompt || isIOS());
}

export function bannerClosed() {
  try { return localStorage.getItem(BANNER_KEY) === '1'; } catch { return false; }
}
export function closeBanner() {
  try { localStorage.setItem(BANNER_KEY, '1'); } catch { /* ignore */ }
}

export async function startInstall() {
  if (deferredPrompt) {
    const p = deferredPrompt;
    deferredPrompt = null;
    p.prompt();
    try { await p.userChoice; } catch { /* closed */ }
    window.dispatchEvent(new Event('bb-installable'));
    return;
  }
  showIOSGuide();
}

const SHARE_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/></svg>';
const ADD_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';

export function showIOSGuide() {
  if (document.querySelector('.install-guide')) return;
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop install-guide';
  wrap.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="ig-title">
      <img class="ig-icon" src="icons/icon-192.png" alt="" width="72" height="72">
      <h2 id="ig-title" class="name-title">${esc(t('install.title'))}</h2>
      <ol class="ig-steps">
        <li><span class="ig-num">1</span><span>${esc(t('install.ios1'))}</span><span class="ig-pic">${SHARE_ICON}</span></li>
        <li><span class="ig-num">2</span><span>${esc(t('install.ios2'))}</span><span class="ig-pic">${ADD_ICON}</span></li>
        <li><span class="ig-num">3</span><span>${esc(t('install.ios3'))}</span><span class="ig-pic ig-add">${esc(t('install.add'))}</span></li>
      </ol>
      <p class="muted small">${esc(t('install.iosHint'))}</p>
      <button type="button" class="btn btn-primary btn-block" data-close>${esc(t('install.ok'))}</button>
    </div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.querySelector('[data-close]').addEventListener('click', close);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  wrap.querySelector('[data-close]').focus();
}
