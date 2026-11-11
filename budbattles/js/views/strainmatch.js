// STRAIN MATCH PAGE: the top 5 strains for the member's profile, as neon cards.
// Pure information – no shops, prices, links or promotion.
import { t, getLang } from '../i18n.js';
import { getCurrentUser, getStrains } from '../store.js';
import { esc } from '../ui.js';
import { matchStrains, profileSignals } from '../strainmatch.js';

export async function renderStrainMatch(root) {
  const user = await getCurrentUser();
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
    root.innerHTML = `${head}<section class="card match-empty"><p>${esc(t('match.tooEmpty'))}</p>
      <a class="btn btn-primary" href="#/profile" data-go-edit>✎ ${esc(t('profile.edit'))}</a></section>${note}`;
    root.querySelector('[data-go-edit]').addEventListener('click', () => sessionStorageSet('bb.openEdit', '1'));
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

  root.innerHTML = `${head}
    <ol class="match-list${user.accent ? ` pf-chips-${esc(user.accent)}` : ''}">
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
            ${chips(s).map((c) => `<span class="pf-chip">${esc(c)}</span>`).join('')}
          </div>
          <p class="match-flavours">${(s.flavours || []).map((f) => `<span class="${(user.flavours || []).includes(f) ? 'is-fav' : ''}">${esc(t(`opt.flavours.${f}`))}</span>`).join(' · ')}</p>
          ${m.reasons.length ? `<ul class="match-why">${m.reasons.map((r) => `<li>✓ ${esc(reason(r))}</li>`).join('')}</ul>` : ''}
        </li>`;
      }).join('')}
    </ol>
    <p class="small"><a class="link" href="#/profile">${esc(t('match.better'))} →</a></p>
    ${note}`;
}

function sessionStorageSet(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } }
