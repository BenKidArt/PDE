// Small pieces shared by both data layers.

export class StoreError extends Error {
  constructor(code) { super(code); this.code = code; } // code = a translation key
}

// The app's clock. Always the real time, except in demo mode where you can
// jump to a battle phase to try things out (see store-demo.js).
let clockOffset = 0;
export function now() { return new Date(Date.now() + clockOffset); }
export function setClockOffset(ms) { clockOffset = ms; }

/** 'upcoming' | 'open' (entries) | 'voting' | 'ended' */
export function battleStatus(b, at = now()) {
  if (at < new Date(b.start)) return 'upcoming';
  if (at < new Date(b.entriesClose)) return 'open';
  if (at < new Date(b.votingEnds)) return 'voting';
  return 'ended';
}

/** Turns a badges table row into the app's badge shape. */
export function toBadge(r) {
  return {
    id: r.id,
    image: r.image,
    name: { de: r.name_de, en: r.name_en },
    description: { de: r.description_de, en: r.description_en },
    kind: r.kind, // 'award' | 'buyable'
    pricePoints: r.price_points ?? null, // only for 'buyable' (points come later)
    sort: r.sort,
  };
}

/** Adds a rank to a list sorted by votes (ties share a rank: 1, 1, 3). */
export function withRanks(list) {
  let rank = 0;
  return list.map((e, i) => {
    if (i === 0 || e.votes !== list[i - 1].votes) rank = i + 1;
    return { ...e, rank };
  });
}
