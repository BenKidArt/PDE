// TEST BATTLES: hidden battles for testers and admins (the database hides them from everyone else).
import { t, tc } from '../i18n.js';
import { getCurrentUser, getBattles, battleStatus } from '../store.js';
import { esc } from '../ui.js';

export async function renderTests(root) {
  const user = await getCurrentUser();
  const head = `<section class="hero hero-small"><p class="eyebrow">🧪 ${esc(t('battle.testLabel'))}</p>
    <h1 class="neon-title">${esc(t('nav.tests'))}</h1></section>`;
  if (!user?.canTest) {
    root.innerHTML = head + `<section class="card"><p>${esc(t('tests.noAccess'))}</p></section>`;
    return;
  }
  const tests = (await getBattles()).filter((b) => b.isTest);
  root.innerHTML = head + `<p class="muted small">${esc(t('tests.intro'))}</p>` + (tests.length ? tests.map((b) => {
    const id = encodeURIComponent(b.id);
    const status = battleStatus(b);
    return `<section class="card">
      <div class="battle-card-head"><h2 class="tests-title">${esc(tc(b.theme))}</h2>
        <span class="pill pill-${status}">${esc(t(`battle.status.${status}`))}</span></div>
      <div class="admin-links">
        <a class="bb-chip" href="#/battle/${id}">${esc(t('admin.openBattle'))} →</a>
        <a class="bb-chip" href="#/enter/${id}">${esc(t('admin.openEnter'))} →</a>
        <a class="bb-chip" href="#/standings/${id}">${esc(t('admin.openStandings'))} →</a>
      </div></section>`;
  }).join('') : `<section class="card"><p class="muted">${esc(t('tests.none'))}</p></section>`);
}
