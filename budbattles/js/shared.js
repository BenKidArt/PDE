// Small pieces shared by both data layers.

export class StoreError extends Error {
  constructor(code) { super(code); this.code = code; } // code = a translation key
}

/** 'upcoming' | 'open' (entries) | 'voting' | 'ended' */
export function battleStatus(b, now = new Date()) {
  if (now < new Date(b.start)) return 'upcoming';
  if (now < new Date(b.entriesClose)) return 'open';
  if (now < new Date(b.votingEnds)) return 'voting';
  return 'ended';
}
