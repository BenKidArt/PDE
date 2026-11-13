// PROFILE: login / sign-up when logged out, your big profile page when logged in.
import { t } from '../i18n.js';
import {
  getCurrentUser, signIn, signUp, requestPasswordReset, updatePassword, isDemo, checkProfileName,
} from '../store.js';
import { esc } from '../ui.js';
import { mountTurnstile, turnstileEnabled } from '../turnstile.js';
import { renderProfilePage } from './profilepage.js';
import { showWelcome, expectWelcome, cancelWelcome } from '../welcome.js';

const PASSWORD_MIN = 8;

export async function renderProfile(root) {
  const user = await getCurrentUser();
  if (user) return renderProfilePage(root, user.username || user.id, { onLogout: () => renderProfile(root) });
  return renderAuth(root, 'login');
}

/** Someone's public profile: #/u/<profile name> */
export async function renderUserProfile(root, { id } = {}) {
  return renderProfilePage(root, id || '', { onLogout: () => { location.hash = '#/profile'; } });
}

function renderAuth(root, mode) {
  const tabs = `
    <div class="tabs" role="tablist">
      <button type="button" role="tab" data-mode="login" aria-selected="${mode === 'login'}">${esc(t('auth.login'))}</button>
      <button type="button" role="tab" data-mode="signup" aria-selected="${mode === 'signup'}">${esc(t('auth.signup'))}</button>
    </div>`;

  const forms = {
    login: `
      <form class="card form" novalidate data-form>
        ${tabs}
        ${field('email', 'email', t('auth.email'), 'email')}
        ${field('password', 'password', t('auth.password'), 'current-password')}
        <div data-ts></div>
        <p class="error" role="alert" data-error hidden></p>
        <p class="badge-ok" role="status" data-ok hidden></p>
        <button class="btn btn-primary btn-block" type="submit">${esc(t('auth.login'))}</button>
        <button class="link-button" type="button" data-forgot>${esc(t('auth.forgot'))}</button>
      </form>`,
    signup: `
      <form class="card form" novalidate data-form>
        ${tabs}
        ${field('displayName', 'text', t('profile.nameLabel'), 'nickname', 'maxlength="20" minlength="3"')}
        <p class="hint" data-name-hint>${esc(t('profile.nameRules'))}</p>
        ${field('email', 'email', t('auth.email'), 'email')}
        ${field('password', 'password', t('auth.password'), 'new-password', `minlength="${PASSWORD_MIN}"`)}
        <p class="hint">${esc(t('auth.passwordHint', { min: PASSWORD_MIN }))}</p>
        <div class="field">
          <label class="label" for="f-birthDate">${esc(t('auth.birthDate'))}</label>
          <input id="f-birthDate" name="birthDate" type="date" required min="1900-01-01" max="${isoDate(new Date())}" autocomplete="bday">
        </div>
        <p class="hint">${esc(t('auth.birthDateHint'))}</p>
        <p class="adult-rule" role="note">🔞 ${esc(t('auth.adultRule'))}</p>
        <label class="check"><input type="checkbox" name="age"><span>${esc(t('auth.ageConfirm'))}</span></label>
        <label class="check"><input type="checkbox" name="terms"><span>${esc(t('auth.termsAcceptBefore'))}
          <a href="#/terms" target="_blank">${esc(t('auth.termsLink'))}</a>${esc(t('auth.termsAcceptAfter'))}</span></label>
        <div data-ts></div>
        <p class="error" role="alert" data-error hidden></p>
        <button class="btn btn-primary btn-block" type="submit">${esc(t('auth.signup'))}</button>
      </form>`,
  };

  root.innerHTML = `
    <section class="hero hero-small">
      <p class="eyebrow">${esc(t('app.adultsOnly'))}</p>
      <h1 class="neon-title">${esc(t(mode === 'login' ? 'auth.welcomeBack' : 'auth.join'))}</h1>
      ${isDemo ? `<p class="muted small">${esc(t('auth.demoNote'))}</p>` : ''}
    </section>
    ${forms[mode]}`;

  const form = root.querySelector('[data-form]');
  const errorEl = form.querySelector('[data-error]');
  const okEl = form.querySelector('[data-ok]');
  const submit = form.querySelector('[type=submit]');
  const showError = (key, vars) => { errorEl.textContent = t(key, vars); errorEl.hidden = false; if (okEl) okEl.hidden = true; };

  form.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => renderAuth(root, b.dataset.mode)));
  let botCheck = { getToken: () => null, reset() {} };
  mountTurnstile(form.querySelector('[data-ts]'), mode).then((w) => { botCheck = w; });
  const needToken = () => {
    const token = botCheck.getToken();
    if (turnstileEnabled() && !token) { showError('error.botCheckWait'); return undefined; }
    return token;
  };

  // profile name: live check while typing (letters, numbers, _ ; 3–20; unique; no bad words)
  const nameInput = form.querySelector('[name=displayName]');
  const nameHint = form.querySelector('[data-name-hint]');
  let nameTimer;
  nameInput?.addEventListener('input', () => {
    clearTimeout(nameTimer);
    nameTimer = setTimeout(async () => {
      const v = nameInput.value.trim();
      if (!v) { nameHint.textContent = t('profile.nameRules'); nameHint.className = 'hint'; return; }
      const st = /^[A-Za-z0-9_]{3,20}$/.test(v) ? await checkProfileName(v) : 'invalid';
      nameHint.textContent = t(`profile.nameStatus.${st}`);
      nameHint.className = st === 'ok' ? 'hint badge-ok' : 'hint error';
    }, 350);
  });

  form.querySelector('[data-forgot]')?.addEventListener('click', async () => {
    const email = form.email.value.trim();
    if (!validEmail(email)) return showError('error.emailInvalid');
    const token = needToken();
    if (token === undefined) return;
    try {
      await requestPasswordReset(email, token);
      botCheck.reset();
      errorEl.hidden = true;
      okEl.textContent = t('auth.resetSent');
      okEl.hidden = false;
    } catch (e) { showError(e.code || 'error.generic'); }
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    errorEl.hidden = true;
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!validEmail(email)) return showError('error.emailInvalid');

    if (mode === 'signup') {
      const displayName = form.displayName.value.trim();
      if (!/^[A-Za-z0-9_]{3,20}$/.test(displayName)) return showError('error.nameInvalid');
      const st = await checkProfileName(displayName);
      const nameErrors = { invalid: 'error.nameInvalid', blocked: 'error.nameBlocked', taken: 'error.nameTaken' };
      if (nameErrors[st]) return showError(nameErrors[st]);
      if (password.length < PASSWORD_MIN) return showError('error.passwordShort', { min: PASSWORD_MIN });
      const age = ageOn(form.birthDate.value);
      if (age === null) return showError(form.birthDate.value ? 'error.birthDateInvalid' : 'error.birthDateRequired');
      if (age < 18) return showError('error.underage');
      if (!form.age.checked) return showError('error.ageRequired');
      if (!form.terms.checked) return showError('error.termsRequired');
    } else if (!password) {
      return showError('error.passwordRequired');
    }

    const captchaToken = needToken();
    if (captchaToken === undefined) return;
    submit.disabled = true;
    expectWelcome();
    try {
      if (mode === 'signup') {
        const { needsConfirmation } = await signUp({
          email, password, displayName: form.displayName.value.trim(), birthDate: form.birthDate.value,
          ageConfirmed: true, termsAccepted: true, captchaToken,
        });
        if (needsConfirmation) { // only if email confirmation is ever switched on again
          cancelWelcome();
          renderAuth(root, 'login');
          const ok = root.querySelector('[data-ok]');
          ok.textContent = t('auth.createdLogin'); ok.hidden = false;
          return;
        }
        showWelcome('signup'); // "Willkommen bei BudBattles!"
      } else {
        await signIn({ email, password, captchaToken });
        const me = await getCurrentUser();
        showWelcome('login', me?.username || me?.displayName || ''); // "Willkommen zurück, …!"
      }
      location.hash = '#/battle';
    } catch (e) {
      cancelWelcome();
      botCheck.reset(); // a Turnstile token works only once
      showError(e.code || 'error.generic');
    } finally {
      submit.disabled = false;
    }
  });
}

/** An old sign-up confirmation link was opened. Confirming is no longer needed. */
export async function renderLinkExpired(root) {
  root.innerHTML = `
    <section class="hero hero-small">
      <h1 class="neon-title">${esc(t('confirm.expiredTitle'))}</h1>
    </section>
    <section class="card"><p>${esc(t('confirm.expiredText'))}</p>
      <a class="btn btn-ghost btn-block" href="#/profile">${esc(t('confirm.toLogin'))}</a></section>`;
}

/** Screen shown after clicking the "reset password" link in the email. */
export async function renderNewPassword(root) {
  const user = await getCurrentUser();
  if (!user) return renderAuth(root, 'login');
  root.innerHTML = `
    <section class="hero hero-small"><h1 class="neon-title">${esc(t('auth.newPasswordTitle'))}</h1></section>
    <form class="card form" novalidate data-form>
      ${field('password', 'password', t('auth.newPassword'), 'new-password', `minlength="${PASSWORD_MIN}"`)}
      <p class="error" role="alert" data-error hidden></p>
      <button class="btn btn-primary btn-block" type="submit">${esc(t('auth.save'))}</button>
    </form>`;
  const form = root.querySelector('[data-form]');
  const errorEl = form.querySelector('[data-error]');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (form.password.value.length < PASSWORD_MIN) {
      errorEl.textContent = t('error.passwordShort', { min: PASSWORD_MIN });
      errorEl.hidden = false;
      return;
    }
    try {
      await updatePassword(form.password.value);
      location.hash = '#/profile';
    } catch (e) {
      errorEl.textContent = t(e.code || 'error.generic');
      errorEl.hidden = false;
    }
  });
}

function field(name, type, label, autocomplete, extra = '') {
  return `<div class="field">
    <label class="label" for="f-${name}">${esc(label)}</label>
    <input id="f-${name}" name="${name}" type="${type}" autocomplete="${autocomplete}" required ${extra}>
  </div>`;
}

/** Full years of age today for a YYYY-MM-DD date, or null if it is not a real date. */
export function ageOn(iso, today = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d || y < 1900) return null;
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age -= 1;
  return age < 0 ? null : age;
}

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
