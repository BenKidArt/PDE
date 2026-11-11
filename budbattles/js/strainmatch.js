// STRAIN MATCH – pure information. Compares the member's profile with the strain
// list and returns the best matches with an honest match % and reasons that are
// specific to each strain. No shops, prices or links. Only for legal home growing.

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
 * Scores every strain. Each part only counts when the member filled in that
 * part of the profile, so the % is "how well it fits what we know about you".
 * Returns [{ strain, percent, reasons: [{ key, vars, points }] }] best first.
 */
export function matchStrains(strains, profile, limit = 5) {
  const s = profileSignals(profile);
  const room = roomOf(s);
  const place = placeOf(s);
  const outdoorish = ['outdoor', 'balkon', 'gewaechshaus'].includes(s.setup);

  const scored = strains.filter((x) => x.active !== false)
    .filter((x) => !(s.h && s.h < 160 && x.height === 'tall')) // never suggest tall plants for a low ceiling
    .map((x) => {
    let got = 0;
    let max = 0;
    const reasons = [];
    const part = (weight, fit, reason) => {
      got += weight * fit;
      max += weight;
      if (reason && (fit >= 0.7 || reason.always)) reasons.push({ points: weight * fit, ...reason });
    };
    const weeks = `${x.flower_min}–${x.flower_max}`;

    // favourite flavours (strongest signal): share of the member's flavours this strain has
    if (s.flavours.length) {
      // the strain's main flavour (listed first) counts more than its side note
      const hit = (x.flavours || []).filter((f) => s.flavours.includes(f));
      const main = s.flavours.includes((x.flavours || [])[0]);
      const fit = (main ? 0.65 : 0) + (hit.length - (main ? 1 : 0)) * 0.35 * (s.flavours.length > 1 ? 1 : 0.6);
      part(30, Math.min(1, fit), hit.length ? { key: hit.length >= Math.min(s.flavours.length, 2) ? 'match.why.flavourAll' : 'match.why.flavour', vars: { flavours: hit }, always: true } : null);
    }

    // plant height vs. room
    if (room) {
      const fit = Math.min(1, HEIGHT_FIT[room][x.height] + (room === 'small' && x.small_space ? 0.1 : 0) - (room === 'small' && !x.small_space && x.height === 'short' ? 0.1 : 0));
      const key = room === 'small' ? 'match.why.compact' : x.height === 'tall' && !(s.h && s.h < 200) ? 'match.why.roomy' : 'match.why.fitsSpace';
      const ceil = ceilingFit(s.h, x.height); // a low ceiling limits the room, however big the floor is
      const roomFit = ceil === null ? fit : Math.min(fit, ceil);
      part(25, Math.max(0, roomFit), place && roomFit >= 0.7 ? { key, vars: { place } } : null);
    }
    // usable height (custom size): low ceiling = prefer short strains
    const cf = ceilingFit(s.h, x.height);
    if (cf !== null) {
      part(25, cf, x.height !== 'tall' ? { key: 'match.why.lowCeiling', vars: { height: s.h } } : null);
      if (room === 'small' && x.small_space) reasons.push({ points: 6, key: 'match.why.smallSpace' });
    }

    // difficulty vs. experience
    if (s.experience) {
      const fit = SKILL_FIT[s.experience][x.difficulty];
      const key = { beginner: 'match.why.beginner', grows_1_3: x.difficulty === 'easy' ? 'match.why.easyGoing' : 'match.why.someExperience', veteran: x.difficulty === 'hard' ? 'match.why.veteran' : 'match.why.veteranOk' }[s.experience];
      part(20, fit, { key });
    }

    // seeds: autoflower / photoperiod
    if (s.seeds === 'auto') part(20, x.auto ? 1 : 0, { key: 'match.why.auto' });
    else if (s.seeds === 'photo') part(20, x.photo ? 1 : 0, { key: 'match.why.photo' });
    else if (s.seeds === 'both') part(8, x.auto && x.photo ? 1 : 0.6, null);

    // flowering time: outdoors it must finish before autumn, indoors shorter is a small plus
    if (outdoorish) {
      part(15, Math.max(0, Math.min(1, 1 - (x.flower_max - 8) * 0.3 - (x.flower_min - 7) * 0.1)), { key: 'match.why.beforeAutumn', vars: { weeks } });
    } else {
      part(8, Math.max(0, Math.min(1, 1 - (x.flower_max - 8) * 0.25)), x.flower_max <= 8 ? { key: 'match.why.fastFlower', vars: { weeks } } : null);
    }

    // grow style
    // (several can be chosen; hybrid = organic + mineral, fits robust and demanding strains alike)
    const soft = s.styles.some((v) => v === 'organic' || v === 'living_soil');
    const precise = s.styles.includes('mineral');
    if (s.styles.includes('hybrid') || (soft && precise)) {
      part(8, { easy: 0.9, medium: 1, hard: 0.85 }[x.difficulty], x.difficulty === 'medium' ? { key: 'match.why.hybridStyle' } : null);
    } else if (soft) {
      const organicKey = s.styles.includes('organic') ? 'match.why.organic' : 'match.why.livingSoil';
      part(8, { easy: 1, medium: 0.7, hard: 0.3 }[x.difficulty], x.difficulty === 'easy' ? { key: organicKey } : null);
    } else if (precise) {
      part(8, { easy: 0.7, medium: 0.9, hard: 1 }[x.difficulty], x.difficulty !== 'easy' ? { key: 'match.why.mineral' } : null);
    }

    const percent = max ? Math.max(1, Math.min(99, Math.round((got / max) * 100))) : 50;
    reasons.sort((a, b) => b.points - a.points);
    return { strain: x, percent, score: got / (max || 1), reasons };
  });

  scored.sort((a, b) => b.score - a.score || a.strain.name.localeCompare(b.strain.name));

  // Variety: never show two strains that look the same on paper (same height,
  // difficulty and main flavour) – the next best different one moves up.
  const seen = new Set();
  const picked = [];
  for (const r of scored) {
    const x = r.strain;
    const sigs = [`${x.height}|${x.difficulty}|${(x.flavours || [])[0]}`, `${x.height}|${x.difficulty}|${[...(x.flavours || [])].sort()}`];
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
