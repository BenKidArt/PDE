// PROFILE: shows login / sign-up when logged out, your account when logged in.
import { t, tc } from '../i18n.js';
import {
  getCurrentUser, signIn, signUp, signOut, requestPasswordReset, updatePassword, isDemo, getBadgeCatalog,
} from '../store.js';
import { esc, badgeIcons } from '../ui.js';

const PASSWORD_MIN = 8;

export async function renderProfile(root) {
  const user = await getCurrentUser();
  if (user) return renderAccount(root, user, await getBadgeCatalog());
  return renderAuth(root, 'login');
}

function renderAccount(root, user, catalog) {
  root.innerHTML = `
    <section class="hero hero-small">
      <p class="eyebrow">${esc(t('nav.profile'))}</p>
      <h1 class="neon-title profile-name">${esc(user.displayName)}${badgeIcons(user.badges, catalog, (b) => tc(b.name), 'large')}</h1>
    </section>
    <section class="card">
      <dl class="dates">
        <div class="date-row"><dt>${esc(t('auth.email'))}</dt><dd>${esc(user.email)}</dd></div>
        ${user.isAdmin || user.isTester ? `<div class="date-row active"><dt>${esc(t('profile.role'))}</dt><dd>${esc([user.isAdmin && t('profile.admin'), user.isTester && t('profile.tester')].filter(Boolean).join(' · '))}</dd></div>` : ''}
      </dl>
      <div class="actions">
        ${user.isAdmin ? `<a class="btn btn-primary" href="#/admin">${esc(t('admin.open'))}</a>` : ''}
        <button class="btn btn-ghost" type="button" data-logout>${esc(t('auth.logout'))}</button></div>
    </section>`;
  root.querySelector('[data-logout]').addEventListener('click', async () => {
    await signOut();
    renderProfile(root);
  });
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
        <p class="error" role="alert" data-error hidden></p>
        <p class="badge-ok" role="status" data-ok hidden></p>
        <button class="btn btn-primary btn-block" type="submit">${esc(t('auth.login'))}</button>
        <button class="link-button" type="button" data-forgot>${esc(t('auth.forgot'))}</button>
      </form>`,
    signup: `
      <form class="card form" novalidate data-form>
        ${tabs}
        ${field('displayName', 'text', t('auth.displayName'), 'nickname', 'maxlength="40" minlength="2"')}
        <p class="hint">${esc(t('auth.displayNameHint'))}</p>
        ${field('email', 'email', t('auth.email'), 'email')}
        ${field('password', 'password', t('auth.password'), 'new-password', `minlength="${PASSWORD_MIN}"`)}
        <p class="hint">${esc(t('auth.passwordHint', { min: PASSWORD_MIN }))}</p>
        <label class="check"><input type="checkbox" name="age"><span>${esc(t('auth.ageConfirm'))}</span></label>
        <label class="check"><input type="checkbox" name="terms"><span>${esc(t('auth.termsAcceptBefore'))}
          <a href="#/terms" target="_blank">${esc(t('auth.termsLink'))}</a>${esc(t('auth.termsAcceptAfter'))}</span></label>
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

  form.querySelector('[data-forgot]')?.addEventListener('click', async () => {
    const email = form.email.value.trim();
    if (!validEmail(email)) return showError('error.emailInvalid');
    try {
      await requestPasswordReset(email);
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
      if (displayName.length < 2) return showError('error.displayNameShort');
      if (password.length < PASSWORD_MIN) return showError('error.passwordShort', { min: PASSWORD_MIN });
      if (!form.age.checked) return showError('error.ageRequired');
      if (!form.terms.checked) return showError('error.termsRequired');
    } else if (!password) {
      return showError('error.passwordRequired');
    }

    submit.disabled = true;
    try {
      if (mode === 'signup') {
        const { needsConfirmation } = await signUp({
          email, password, displayName: form.displayName.value, ageConfirmed: true, termsAccepted: true,
        });
        if (needsConfirmation) {
          root.innerHTML = `<section class="hero hero-small"><h1 class="neon-title">${esc(t('auth.checkEmailTitle'))}</h1></section>
            <section class="card card-success"><p>${esc(t('auth.checkEmailText', { email }))}</p></section>`;
          return;
        }
      } else {
        await signIn({ email, password });
      }
      location.hash = '#/battle';
    } catch (e) {
      showError(e.code || 'error.generic');
    } finally {
      submit.disabled = false;
    }
  });
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

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
