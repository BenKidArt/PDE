// STRAIN MATCH – pure information. Compares the member's profile with the strain
// list and returns the best matches with a match % and short reasons.
// No shops, prices or links. Only for legal home growing where permitted.

/** Which profile fields count, and whether enough are filled in for useful matches. */
export function profileSignals(p) {
  const s = {
    setup: p.growSetup || null,
    space: p.spaceSize || null,
    experience: p.experience || null,
    seeds: p.seedType || null,
    style: p.growStyle || null,
    flavours: Array.isArray(p.flavours) ? p.flavours : [],
  };
  const filled = ['setup', 'space', 'experience', 'seeds'].filter((k) => s[k]).length + (s.flavours.length ? 1 : 0);
  return { ...s, filled, enough: filled >= 2 };
}

const SMALL_SPACES = ['60', '80'];

/**
 * Scores every strain. Each part only counts when the member filled in that
 * part of the profile, so the % is "how well it fits what we know about you".
 * Returns [{ strain, percent, reasons: [{ key, vars }] }] best first.
 */
export function matchStrains(strains, profile, limit = 5) {
  const s = profileSignals(profile);
  const small = SMALL_SPACES.includes(s.space) || s.setup === 'balkon';
  const outdoorish = s.setup === 'outdoor' || s.setup === 'balkon' || s.setup === 'gewaechshaus';

  const results = strains.filter((x) => x.active !== false).map((x) => {
    let got = 0;
    let max = 0;
    const reasons = [];
    const add = (points, of, reason) => { got += points; max += of; if (reason && points > 0) reasons.push({ points, ...reason }); };

    // seeds: autoflower / photoperiod
    if (s.seeds === 'auto') add(x.auto ? 25 : 0, 25, { key: 'match.why.auto' });
    else if (s.seeds === 'photo') add(x.photo ? 25 : 0, 25, { key: 'match.why.photo' });
    else if (s.seeds === 'both') add(x.auto && x.photo ? 10 : 6, 10, { key: 'match.why.both' });

    // space: short plants for small tents and balconies
    if (s.space || s.setup) {
      if (small) {
        const pts = x.small_space ? 25 : x.height === 'short' ? 18 : x.height === 'medium' ? 8 : 0;
        add(pts, 25, { key: s.setup === 'balkon' && !SMALL_SPACES.includes(s.space) ? 'match.why.smallBalcony' : 'match.why.smallTent', vars: { size: s.space ? `${s.space}×${s.space}` : '' } });
      } else if (s.space === '120' || s.space === '100' || s.setup === 'raum') {
        add(x.height === 'tall' ? 12 : x.height === 'medium' ? 15 : 10, 15, { key: 'match.why.roomy' });
      }
    }

    // experience
    if (s.experience === 'beginner') add({ easy: 25, medium: 10, hard: 0 }[x.difficulty], 25, { key: 'match.why.beginner' });
    else if (s.experience === 'grows_1_3') add({ easy: 15, medium: 20, hard: 8 }[x.difficulty], 20, { key: 'match.why.someExperience' });
    else if (s.experience === 'veteran') add({ easy: 8, medium: 12, hard: 15 }[x.difficulty], 15, { key: 'match.why.veteran' });

    // outdoors / balcony in Central Europe: shorter flowering finishes before autumn
    if (outdoorish) add(x.flower_max <= 9 ? 15 : x.flower_max <= 10 ? 8 : 0, 15, { key: 'match.why.shortFlower', vars: { weeks: `${x.flower_min}–${x.flower_max}` } });

    // grow style: organic / living soil like robust, forgiving plants
    if (s.style === 'organic' || s.style === 'living_soil') add(x.difficulty !== 'hard' ? 8 : 3, 8, { key: 'match.why.organic' });
    else if (s.style === 'mineral') add(x.difficulty !== 'easy' ? 8 : 6, 8, null);

    // favourite flavours
    if (s.flavours.length) {
      const hit = (x.flavours || []).filter((f) => s.flavours.includes(f));
      add(Math.min(30, hit.length * 18), 30, hit.length ? { key: 'match.why.flavour', vars: { flavours: hit } } : null);
    }

    const percent = max ? Math.round(45 + (got / max) * 54) : 50; // 45–99 %
    reasons.sort((a, b) => b.points - a.points);
    return { strain: x, percent, reasons: reasons.slice(0, 3) };
  });

  results.sort((a, b) => b.percent - a.percent || a.strain.name.localeCompare(b.strain.name));
  return results.slice(0, limit);
}
