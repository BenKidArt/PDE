// MULTIPLE SETUPS: a grower can list up to 3 setups (e.g. "Zelt 1", "Zelt 2",
// "Outdoor"), each with its own size, light, medium, seeds and training.
// One is the main setup: it decides the profile theme and also fills the older
// single-setup fields, so everything that still reads those keeps working.

export const MAX_SETUPS = 3;
export const SETUP_FIELDS = ['type', 'name', 'spaceSize', 'spaceW', 'spaceD', 'spaceHMin', 'spaceHMax', 'lights', 'medium', 'seedType', 'training'];

/** The setups of a profile; older profiles get one setup built from the single-setup fields. */
export function setupsOf(p) {
  if (Array.isArray(p?.setups) && p.setups.length) {
    const list = p.setups.slice(0, MAX_SETUPS).map(clean);
    if (!list.some((s) => s.main)) list[0].main = true;
    return list;
  }
  const legacy = clean({
    type: p?.growSetup, spaceSize: p?.spaceSize, spaceW: p?.spaceW, spaceD: p?.spaceD, spaceHMin: p?.spaceHMin,
    spaceHMax: p?.spaceHMax, lights: p?.lights, medium: p?.medium, seedType: p?.seedType, training: p?.training, main: true,
  });
  return hasContent(legacy) ? [legacy] : [];
}

export function mainSetup(list) { return list.find((s) => s.main) || list[0] || null; }

/** Does this setup hold anything worth showing / saving? */
export function hasContent(s) {
  return !!(s.type || s.name || s.spaceSize || s.lights || s.medium || s.seedType || (s.training && s.training.length));
}

/** Display name: own name, or the type (+ number when the same type appears twice), or "Setup 2". */
export function setupName(s, i, list, t) {
  if (s.name) return s.name;
  if (!s.type) return t('setups.nth', { n: i + 1 });
  const same = list.filter((x) => x.type === s.type && !x.name);
  const base = t(`setupShort.${s.type}`);
  return same.length > 1 ? `${base} ${same.indexOf(s) + 1}` : base;
}

/** The fields Strain Match needs: the grower's own (taste, experience, style) + one setup. */
export function matchProfile(user, s) {
  if (!s) return user;
  return {
    ...user,
    growSetup: s.type || null, spaceSize: s.spaceSize || null, spaceW: s.spaceW, spaceD: s.spaceD,
    spaceHMin: s.spaceHMin, spaceHMax: s.spaceHMax, seedType: s.seedType || null, training: s.training || [],
    lights: s.lights || null, medium: s.medium || null,
  };
}

/** Single-setup fields mirrored from the main setup (for older code and the database). */
export function legacyFields(list) {
  const m = mainSetup(list) || {};
  return {
    growSetup: m.type || '', spaceSize: m.spaceSize || '', spaceW: m.spaceW ?? null, spaceD: m.spaceD ?? null,
    spaceHMin: m.spaceHMin ?? null, spaceHMax: m.spaceHMax ?? null, lights: m.lights || '', medium: m.medium || '',
    seedType: m.seedType || '', training: m.training || [],
  };
}

/** App shape ⇄ database shape (snake_case). */
export function toDb(s) {
  return {
    type: s.type || null, name: s.name || null, space_size: s.spaceSize || null,
    space_w: s.spaceSize === 'custom' ? s.spaceW ?? null : null, space_d: s.spaceSize === 'custom' ? s.spaceD ?? null : null,
    space_h_min: s.spaceSize === 'custom' ? s.spaceHMin ?? null : null, space_h_max: s.spaceSize === 'custom' ? s.spaceHMax ?? null : null,
    lights: s.lights || null, medium: s.medium || null, seed_type: s.seedType || null, training: s.training || [], main: !!s.main,
  };
}
export function fromDb(r) {
  return clean({
    type: r.type, name: r.name, spaceSize: r.space_size, spaceW: r.space_w, spaceD: r.space_d, spaceHMin: r.space_h_min,
    spaceHMax: r.space_h_max, lights: r.lights, medium: r.medium, seedType: r.seed_type, training: r.training, main: r.main,
  });
}

function clean(s) {
  const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const int = (v) => (Number.isFinite(+v) && v !== null && v !== '' ? Math.round(+v) : null);
  return {
    type: str(s.type), name: str(s.name)?.slice(0, 24) || null, spaceSize: str(s.spaceSize),
    spaceW: int(s.spaceW), spaceD: int(s.spaceD), spaceHMin: int(s.spaceHMin), spaceHMax: int(s.spaceHMax),
    lights: str(s.lights)?.slice(0, 40) || null, medium: str(s.medium), seedType: str(s.seedType),
    training: Array.isArray(s.training) ? s.training.filter(Boolean) : [], main: !!s.main,
  };
}
