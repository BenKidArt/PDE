// Cloudflare Turnstile bot check (free). Used on sign-up, login, password reset
// and voting. Without a site key in config.js the check is switched off and
// nothing is loaded from Cloudflare.
import { CONFIG } from './config.js';
import { getLang } from './i18n.js';

let scriptPromise;

export const turnstileEnabled = () => !!CONFIG.turnstileSiteKey;

function loadScript() {
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = () => resolve(window.turnstile);
      s.onerror = () => { scriptPromise = null; reject(new Error('turnstile_load_failed')); };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

/**
 * Puts the check into `container`. Returns { getToken(), reset() }.
 * getToken() returns '' while the check isn't finished (or null when switched off).
 */
export async function mountTurnstile(container, action) {
  if (!turnstileEnabled()) return { getToken: () => null, reset() {} };
  container.classList.add('turnstile-slot');
  let token = '';
  let widgetId;
  try {
    const ts = await loadScript();
    widgetId = ts.render(container, {
      sitekey: CONFIG.turnstileSiteKey,
      action,
      theme: 'dark',
      size: 'flexible',
      language: getLang(),
      callback: (tk) => { token = tk; },
      'expired-callback': () => { token = ''; },
      'error-callback': () => { token = ''; },
    });
  } catch {
    container.textContent = '⚠️';
  }
  return {
    getToken: () => token,
    reset() { token = ''; try { window.turnstile?.reset(widgetId); } catch { /* ignore */ } },
  };
}
