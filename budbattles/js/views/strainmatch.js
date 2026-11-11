// STRAIN MATCH PAGE: the top 5 strains for the member's profile, as neon cards.
// Pure information – no shops, prices, links or promotion.
import { t, getLang } from '../i18n.js';
import { getCurrentUser, getStrains } from '../store.js';
import { esc, chipHtml } from '../ui.js';
import { matchStrains, profileSignals } from '../strainmatch.js';
import { setupsOf, mainSetup, setupName, matchProfile } from '../setups.js';

const PICK_KEY = 'bb.matchSetup';
const SETUP_ICONS = { zelt: '⛺', raum: '💡', outdoor: '☀️', gewaechshaus: '🌿', balkon: '🌆', growbox: '🗄️' };

export async function renderStrainMatch(root) {
  const me = await getCurrentUser();
  // several setups: the member picks which one to match for (default: the main setup)
  const setups = me ? setupsOf(me) : [];
  let pick = setups.indexOf(mainSetup(setups));
  try { const saved = parseInt(sessionStorage.getItem(PICK_KEY), 10); if (saved >= 0 && saved < setups.length) pick = saved; } catch { /* ignore */ }
  const user = me && setups.length ? matchProfile(me, setups[pick]) : me;
  const picker = setups.length > 1 ? `
    <div class="match-picker" role="group" aria-label="${esc(t('setups.matchFor'))}">
      <span class="label">${esc(t('setups.matchFor'))}</span>
      <div class="opt-chips">${setups.map((s, i) => `<button type="button" class="bb-chip" data-pick="${i}" aria-pressed="${i === pick}">
        <span class="bb-chip-icon" aria-hidden="true">${SETUP_ICONS[s.type] || '🌱'}</span>${esc(setupName(s, i, setups, t))}</button>`).join('')}</div>
    </div>` : '';
  const bindPicker = () => root.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
    try { sessionStorage.setItem(PICK_KEY, b.dataset.pick); } catch { /* ignore */ }
    renderStrainMatch(root);
  }));
  const head = `
    <section class="hero hero-small">
      <p class="eyebrow">🧬 ${esc(t('match.eyebrow'))}</p>
      <h1 class="neon-title">${esc(t('profile.strainMatch'))}</h1>
      <p class="muted small">${esc(t('match.intro'))}</p>
    </section>`;
  const note = `<p class="muted small match-note">${esc(t('match.note'))}</p>`;
  if (!user) {
    root.innerHTML = `${head}<section class="card"><p>${esc(t('match.login'))}</p>
      <a class="btn btn-primary" href="#/profile">${esc(t('auth.loginOrSignup'))}</a></section>${note}`;
    return;
  }
  const signals = profileSignals(user);
  if (!signals.enough) {
    root.innerHTML = `${head}${picker}<section class="card match-empty"><p>${esc(t('match.tooEmpty'))}</p>
      <a class="btn btn-primary" href="#/profile" data-go-edit>✎ ${esc(t('profile.edit'))}</a></section>${note}`;
    root.querySelector('[data-go-edit]').addEventListener('click', goEdit);
    bindPicker();
    return;
  }

  const strains = await getStrains();
  const results = matchStrains(strains, user, 5);
  const flavourList = (arr) => new Intl.ListFormat(getLang() === 'de' ? 'de' : 'en', { type: 'conjunction' })
    .format(arr.map((f) => t(`opt.flavours.${f}`)));
  const reason = (r) => t(r.key, {
    ...r.vars,
    flavours: r.vars?.flavours ? flavourList(r.vars.flavours) : '',
    place: r.vars?.place ? t(r.vars.place.key, { size: r.vars.place.size }) : '',
  });
  // seed chip: only what applies to this strain and what the member grows
  const seedChip = (s) => {
    if (user.seedType === 'auto') return s.auto ? t('opt.seedType.auto') : '';
    if (user.seedType === 'photo') return s.photo ? t('opt.seedType.photo') : '';
    if (s.auto && s.photo) return t('match.seeds.both');
    return s.auto ? t('opt.seedType.auto') : t('opt.seedType.photo');
  };
  const chips = (s) => [
    t(`match.type.${s.type}`), seedChip(s), t(`match.diff.${s.difficulty}`), t(`match.height.${s.height}`),
    `⏱ ${t('match.weeks', { weeks: `${s.flower_min}–${s.flower_max}` })}`,
    s.small_space ? t('match.smallSpace') : '',
  ].filter(Boolean);

  root.innerHTML = `${head}${picker}
    <ol class="match-list">
      ${results.map((m, i) => {
        const s = m.strain;
        return `
        <li class="match-card">
          <div class="match-top">
            <span class="match-rank">#${i + 1}</span>
            <h2 class="match-name">${esc(s.name)}</h2>
            <span class="match-pct"><b>${m.percent}%</b><small>${esc(t('match.fit'))}</small></span>
          </div>
          <div class="match-tags">
            ${chips(s).map((c) => chipHtml(c)).join('')}
          </div>
          <p class="match-flavours">${(s.flavours || []).map((f) => `<span class="${(user.flavours || []).includes(f) ? 'is-fav' : ''}">${esc(t(`opt.flavours.${f}`))}</span>`).join(' · ')}</p>
          ${m.reasons.length ? `<ul class="match-why">${m.reasons.map((r) => `<li>✓ ${esc(reason(r))}</li>`).join('')}</ul>` : ''}
        </li>`;
      }).join('')}
    </ol>
    <p class="small"><a class="link" href="#/profile" data-go-edit>${esc(t('match.better'))} →</a></p>
    ${note}`;
  root.querySelector('[data-go-edit]').addEventListener('click', goEdit);
  bindPicker();
}

function sessionStorageSet(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } }

/** Open the profile editor directly; after saving (or cancelling) come back here. */
function goEdit() {
  sessionStorageSet('bb.openEdit', '1');
  sessionStorageSet('bb.returnTo', '#/strainmatch');
}
