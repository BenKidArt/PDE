// STRAIN MATCH – pure information. Compares the member's profile with the strain
// list and returns the best matches with an honest match % and reasons that are
// specific to each strain. No shops, prices or links. Only for legal home growing.
import { flavourFit, hasMatchableFavourite, wishCount } from './flavours.js';

/** Which profile fields count, and whether enough are filled in for useful matches. */
export function profileSignals(p) {
  const s = {
    setup: p.growSetup || null,
    space: p.spaceSize || null,
    // custom size in cm (height: the LOWEST point counts, e.g. under a sloping ceiling)
    w: p.spaceSize === 'custom' ? p.spaceW || null : null,
    d: p.spaceSize === 'custom' ? p.spaceD || null : null,
    h: p.spaceSize === 'custom' ? p.spaceHMin || p.spaceHMax || null : null,
    experience: p.experience || null,
    seeds: p.seedType || null,
    styles: Array.isArray(p.growStyle) ? p.growStyle : p.growStyle ? [p.growStyle] : [],
    flavours: Array.isArray(p.flavours) ? p.flavours : [],
  };
  const filled = ['setup', 'space', 'experience', 'seeds'].filter((k) => s[k]).length + (s.flavours.length ? 1 : 0);
  return { ...s, filled, enough: filled >= 2 };
}

const SIZE = { 60: '60×60', 80: '80×80', 100: '100×100', 120: '120×120' };

/** How much room the member has: 'small' | 'mid' | 'big' | null. */
function roomOf(s) {
  if (s.w && s.d) { // real floor size
    const m2 = (s.w * s.d) / 10000;
    if (m2 <= 0.7) return 'small';
    if (m2 <= 1.2) return 'mid';
    return 'big';
  }
  if (s.setup === 'balkon' || s.setup === 'growbox' || s.space === '60' || s.space === '80') return 'small';
  if (s.space === '100') return 'mid';
  if (s.space === '120' || ['raum', 'outdoor', 'gewaechshaus'].includes(s.setup)) return 'big';
  if (s.setup === 'zelt') return 'mid';
  return null;
}

/**
 * Where the member grows, as reason text variables (the view turns it into
 * "deinen Balkon", "dein 80×80 Zelt", "Outdoor" …). Never says tent for a balcony.
 */
export function placeOf(s) {
  const size = s.w && s.d ? `${s.w}×${s.d}` : SIZE[s.space] || '';
  if (s.setup === 'zelt') return { key: size ? 'match.place.zeltSize' : 'match.place.zelt', size };
  if (s.setup === 'growbox') return { key: 'match.place.growbox', size: '' };
  if (s.w && s.d && !s.setup) return { key: 'match.place.space', size };
  if (s.setup) return { key: `match.place.${s.setup}`, size: '' };
  if (SIZE[s.space]) return { key: 'match.place.space', size: SIZE[s.space] };
  return null;
}

// height fit per room size (0–1)
const HEIGHT_FIT = {
  small: { short: 1, medium: 0.45, tall: 0 },
  mid: { short: 0.85, medium: 1, tall: 0.35 },
  big: { short: 0.6, medium: 0.9, tall: 1 },
};
// height fit by usable height in cm (the lowest point): low ceilings want short plants
function ceilingFit(h, height) {
  if (!h) return null;
  if (h < 120) return { short: 1, medium: 0.1, tall: 0 }[height];
  if (h < 160) return { short: 1, medium: 0.45, tall: 0 }[height];
  if (h < 200) return { short: 1, medium: 0.85, tall: 0.35 }[height];
  return null; // tall enough for anything
}
// difficulty fit per experience (0–1)
const SKILL_FIT = {
  beginner: { easy: 1, medium: 0.4, hard: 0 },
  grows_1_3: { easy: 0.75, medium: 1, hard: 0.35 },
  veteran: { easy: 0.45, medium: 0.8, hard: 1 },
};

/**
 * Two kinds of strain data live in the list:
 *  - the first 60 (no breeder): height, difficulty, flavours, flowering weeks
 *  - the strains.csv ones (with breeder): auto/photo, genetics, days, and the
 *    tags fast / long / balcony_ok / small_space. Autoflower days = seed to harvest,
 *    photoperiod days = flowering time.
 * A fact a strain has no data for counts as 75 % of a perfect fit: a known match
 * beats an unknown, an unknown beats a known mismatch.
 * "partner" and "shops_available" are never read here: ranking is only about fit.
 */
const UNKNOWN_FIT = 0.75;

/** Small stable number per strain + grower, used only to break exact ties fairly
 *  (not alphabetical, never by partner status). */
function tieHash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}
const isNew = (x) => !!x.breeder;
const stretchy = (x) => x.photo && !x.auto && (x.genetics === 'sativa' || x.genetics === 'sativa-dominant');

/** Room fit (0–1) + reason for the new (csv) strains. */
function roomFitNew(x, room, setup, place) {
  const small = !!x.small_space;
  if (room === 'small') {
    if (setup === 'balkon') {
      const fit = x.balcony_ok ? (small ? 1 : 0.85) : (small ? 0.6 : 0.2);
      return [fit, x.balcony_ok ? { key: 'match.why.balconyOk' } : null];
    }
    const fit = small ? 1 : stretchy(x) ? 0.15 : 0.3;
    return [fit, small && place ? { key: 'match.why.smallOk', vars: { place } } : null];
  }
  if (room === 'mid') return [small ? 1 : stretchy(x) ? 0.6 : 0.9, small && place ? { key: 'match.why.smallOk', vars: { place } } : null];
  // big room / outdoor / greenhouse: plants that need space use it
  return [small ? 0.7 : 1, !small && place ? { key: 'match.why.roomForIt', vars: { place } } : null];
}
/** Usable height in cm (lowest point) for the new strains. */
function ceilingFitNew(h, x) {
  if (!h || h >= 200) return null;
  const base = x.small_space ? 1 : h < 120 ? 0.1 : h < 160 ? 0.3 : 0.7;
  return Math.max(0, base - (stretchy(x) && !x.small_space ? 0.2 : 0));
}
/** Season fit (outdoor, balcony, greenhouse): must be done before autumn. */
function seasonFitNew(x) {
  if (!x.days) return null;
  const d = x.days;
  let fit = x.auto
    ? (d <= 70 ? 1 : d <= 80 ? 0.85 : d <= 90 ? 0.65 : 0.45) // seed to harvest
    : (d <= 56 ? 1 : d <= 63 ? 0.85 : d <= 70 ? 0.6 : d <= 77 ? 0.35 : 0.1); // flowering
  if (x.long) fit = Math.min(fit, 0.3);
  return fit;
}

/**
 * Scores every strain. Each part only counts when the member filled in that
 * part of the profile, so the % is "how well it fits what we know about you".
 * Returns [{ strain, percent, reasons: [{ key, vars, points }] }] best first.
 */
export function matchStrains(strains, profile, limit = 5) {
  const s = profileSignals(profile);
  const room = roomOf(s);
  const place = placeOf(s);
  const outdoorish = ['outdoor', 'balkon', 'gewaechshaus'].includes(s.setup);

  const scored = strains.filter((x) => x.active !== false && (x.auto || x.photo))
    // never suggest plants that clearly don't fit under a low ceiling
    .filter((x) => !(s.h && s.h < 160 && (x.height === 'tall' || (isNew(x) && stretchy(x) && !x.small_space))))
    .map((x) => {
    let got = 0;
    let max = 0;
    const reasons = [];
    const part = (weight, fit, reason) => {
      got += weight * fit;
      max += weight;
      if (reason && (fit >= 0.7 || reason.always)) reasons.push({ points: weight * fit, ...reason });
    };
    const fresh = isNew(x);
    const weeks = `${x.flower_min}–${x.flower_max}`;

    // favourite flavours (strongest signal) – the first 60 strains and the Huba catalogue strains have flavour data
    // a detailed favourite (e.g. pine) matches its family in the data (earthy) a bit less than the same flavour
    if (s.flavours.length) {
      if (!(x.flavours || []).length || !hasMatchableFavourite(s.flavours)) part(30, UNKNOWN_FIT, null);
      else {
        // the strain's main flavour (listed first) counts more than its side note
        const fits = x.flavours.map((f) => flavourFit(f, s.flavours));
        const hit = x.flavours.filter((f, i) => fits[i] > 0);
        const mainFit = fits[0];
        const sideFit = fits.slice(1).reduce((a, b) => a + b, 0);
        // one favourite: main flavour = full match, side note = partial; several: main + side notes add up
        // several favourites of the same family (pine + woody) count as one wish
        // any matching note (main or side) always counts more than "no flavour data" (0.75)
        const best = Math.max(mainFit, Math.max(0, ...fits.slice(1)) * 0.94);
        const fit = wishCount(s.flavours) === 1
          ? (mainFit ? mainFit : best * 0.85)
          : Math.max(mainFit * 0.65 + sideFit * 0.35, best * 0.8);
        part(30, Math.min(1, fit), hit.length ? { key: hit.length >= Math.min(s.flavours.length, 2) ? 'match.why.flavourAll' : 'match.why.flavour', vars: { flavours: hit }, always: true } : null);
      }
    }

    // plant size vs. room (+ low ceiling)
    if (room) {
      if (fresh) {
        const [fit, why] = roomFitNew(x, room, s.setup, place);
        const ceil = ceilingFitNew(s.h, x);
        part(25, ceil === null ? fit : Math.min(fit, ceil), why);
      } else {
        const fit = Math.min(1, HEIGHT_FIT[room][x.height] + (room === 'small' && x.small_space ? 0.1 : 0) - (room === 'small' && !x.small_space && x.height === 'short' ? 0.1 : 0));
        const key = room === 'small' ? 'match.why.compact' : x.height === 'tall' && !(s.h && s.h < 200) ? 'match.why.roomy' : 'match.why.fitsSpace';
        const ceil = ceilingFit(s.h, x.height); // a low ceiling limits the room, however big the floor is
        const roomFit = ceil === null ? fit : Math.min(fit, ceil);
        part(25, Math.max(0, roomFit), place && roomFit >= 0.7 ? { key, vars: { place } } : null);
      }
    }
    // usable height (custom size): low ceiling = prefer compact strains
    if (s.h && s.h < 200) {
      if (fresh) {
        const cf = ceilingFitNew(s.h, x);
        part(25, cf, x.small_space ? { key: 'match.why.lowCeilingOk', vars: { height: s.h } } : null);
      } else {
        const cf = ceilingFit(s.h, x.height);
        part(25, cf, x.height !== 'tall' ? { key: 'match.why.lowCeiling', vars: { height: s.h } } : null);
        if (room === 'small' && x.small_space) reasons.push({ points: 6, key: 'match.why.smallSpace' });
      }
    }

    // difficulty vs. experience – only the first 60 strains have difficulty data
    if (s.experience) {
      if (fresh || !x.difficulty) part(20, UNKNOWN_FIT, null);
      else {
        const fit = SKILL_FIT[s.experience][x.difficulty];
        const key = { beginner: 'match.why.beginner', grows_1_3: x.difficulty === 'easy' ? 'match.why.easyGoing' : 'match.why.someExperience', veteran: x.difficulty === 'hard' ? 'match.why.veteran' : 'match.why.veteranOk' }[s.experience];
        part(20, fit, { key });
      }
    }

    // seeds: autoflower / photoperiod
    if (s.seeds === 'auto') part(20, x.auto ? 1 : 0, { key: 'match.why.auto' });
    else if (s.seeds === 'photo') part(20, x.photo ? 1 : 0, { key: 'match.why.photo' });
    else if (s.seeds === 'both') part(8, x.auto && x.photo ? 1 : 0.6, null);

    // timing: outdoors it must finish before autumn, indoors a short cycle is a small plus
    if (fresh) {
      if (outdoorish) {
        const fit = seasonFitNew(x);
        if (fit === null) part(15, UNKNOWN_FIT, null);
        else part(15, fit, { key: x.auto ? 'match.why.autoSeason' : 'match.why.beforeAutumnDays', vars: { days: x.days } });
      } else if (!x.days) part(8, UNKNOWN_FIT, null);
      else part(8, x.fast ? 1 : x.long ? 0.3 : 0.8, x.fast ? { key: x.auto ? 'match.why.fastAutoDays' : 'match.why.fastDays', vars: { days: x.days } } : null);
    } else if (outdoorish) {
      part(15, Math.max(0, Math.min(1, 1 - (x.flower_max - 8) * 0.3 - (x.flower_min - 7) * 0.1)), { key: 'match.why.beforeAutumn', vars: { weeks } });
    } else {
      part(8, Math.max(0, Math.min(1, 1 - (x.flower_max - 8) * 0.25)), x.flower_max <= 8 ? { key: 'match.why.fastFlower', vars: { weeks } } : null);
    }

    // grow style (several can be chosen) – needs difficulty data, neutral otherwise
    const soft = s.styles.some((v) => v === 'organic' || v === 'living_soil');
    const precise = s.styles.includes('mineral');
    if ((soft || precise || s.styles.includes('hybrid')) && (fresh || !x.difficulty)) part(8, UNKNOWN_FIT, null);
    else if (s.styles.includes('hybrid') || (soft && precise)) {
      part(8, { easy: 0.9, medium: 1, hard: 0.85 }[x.difficulty], x.difficulty === 'medium' ? { key: 'match.why.hybridStyle' } : null);
    } else if (soft) {
      const organicKey = s.styles.includes('organic') ? 'match.why.organic' : 'match.why.livingSoil';
      part(8, { easy: 1, medium: 0.7, hard: 0.3 }[x.difficulty], x.difficulty === 'easy' ? { key: organicKey } : null);
    } else if (precise) {
      part(8, { easy: 0.7, medium: 0.9, hard: 1 }[x.difficulty], x.difficulty !== 'easy' ? { key: 'match.why.mineral' } : null);
    }

    const score = max ? got / max : 0.5;
    const percent = Math.max(1, Math.min(99, Math.round(score * 100)));
    reasons.sort((a, b) => b.points - a.points);
    return { strain: x, percent, score, reasons };
  });

  // Best fit first. Exact ties: where timing matters (outdoor, balcony, greenhouse) the shorter
  // cycle first; then a fixed shuffle per strain + grower – never alphabetical, never by partner.
  const who = JSON.stringify([s.setup, s.space, s.w, s.d, s.h, s.experience, s.seeds, s.styles, s.flavours]);
  const cycle = (x) => x.days || (x.flower_max ? x.flower_max * 7 : 999);
  scored.forEach((r) => { r.tie = tieHash(`${r.strain.name}|${r.strain.breeder || ''}|${who}`); });
  scored.sort((a, b) => (Math.round(b.score * 1000) - Math.round(a.score * 1000))
    || (outdoorish ? cycle(a.strain) - cycle(b.strain) : 0)
    || a.tie - b.tie);

  // Variety: never show the same name twice, nor two strains that look the same on paper
  // (old data: same height, difficulty and main flavour; new data: same genetics, type,
  // tags and about the same days) – the next best different one moves up.
  const seen = new Set();
  const picked = [];
  for (const r of scored) {
    const x = r.strain;
    const sigs = [`name:${x.name.trim().toLowerCase()}`, ...(isNew(x)
      ? [`new:${x.genetics}|${x.auto ? 'a' : 'p'}|${!!x.small_space}|${!!x.balcony_ok}|${x.days ? Math.round(x.days / 7) : '?'}`]
      : [`${x.height}|${x.difficulty}|${(x.flavours || [])[0]}`, `${x.height}|${x.difficulty}|${[...(x.flavours || [])].sort()}`])];
    if (sigs.some((g) => seen.has(g))) continue;
    sigs.forEach((g) => seen.add(g));
    picked.push(r);
    if (picked.length === limit) break;
  }
  // Reasons: up to 3 true reasons per strain – the strongest first, then ones not already shown above.
  const shown = new Set();
  for (const r of picked) {
    const sig = (q) => q.key + JSON.stringify(q.vars?.flavours || '');
    const [best, ...rest] = r.reasons; // the strongest reason always stays first
    r.reasons = best ? [best, ...rest.sort((a, b) => (shown.has(sig(a)) - shown.has(sig(b))) || b.points - a.points).slice(0, 2)] : [];
    r.reasons.forEach((q) => shown.add(sig(q)));
  }
  return picked;
}
