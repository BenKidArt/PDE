// BUDPOINTS RULES – the ONE place to change point amounts, limits, thresholds,
// shop prices and badge lists. Change a number here and that's it: when an admin
// opens the Admin page, the app copies these rules into the database (Supabase),
// which uses them to check every point and purchase.
//
// BudPoints have no money or cash value and can't be exchanged for prizes.

export const BUDPOINTS = {
  // Zillah Banana Toss – per throw
  toss: {
    metersPerPoint: 250, // 1 BudPoint per full 250 m thrown (floor(meters / 250))
    perRing: 1,          // BudPoints per ring hit
    combo: 2,            // BudPoints if the throw had a combo
    // (goal: reaching the 45 below takes about 20–30 minutes of play)
    windowHours: 12,   // rolling window …
    windowMax: 45,     // … max BudPoints from Banana Toss in that window (per user)
  },

  // Badges from LIFETIME BudPoints earned in Banana Toss (not the current balance)
  milestones: {
    blaster: 50,       // "Banana Blaster" badge, given automatically
    shop: 150,         // the Badge Shop unlocks
    gorillaKing: 500,  // "Gorilla King" badge, given automatically
    goldenNug: 3000,   // "Golden Nug" badge, given automatically
  },
  milestoneBadges: { gorillaKing: 'badge_gorilla_king', goldenNug: 'badge_golden_nug' },

  // Banana Crown: play Banana Toss on this many different days (Finnish calendar day)
  crown: { badge: 'badge_banana_crown', days: 3 },
  blasterBadge: 'badge_banana_round', // picture: assets/badges/badge_golden_bananas.png

  // Badge Shop: badge id → price in BudPoints (buying lowers the balance, not "lifetime earned")
  shop: {
    badge_clown: 30,
    badge_cow: 30,
    badge_donkey: 30,
    badge_elephant: 30,
    badge_farmer: 30,
    badge_goat: 30,
  },

  // Other ways to earn (same balance; they do NOT count for the Banana Toss limit or badges)
  extra: {
    profile_complete: 7, // once per user: profile photo, username, bio and grow setup filled in
    profile_visual: 3,   // once per user: background photo / banner / colour changed from default
    vote: 2,             // once per battle per user
    enter: 2,            // once per battle per user
  },
};

/** All badges that "Reset my demo badges" removes again. */
export const DEMO_BADGES = ['badge_banana_round', 'badge_login10_gorilla', BUDPOINTS.crown.badge, ...Object.keys(BUDPOINTS.shop),
  ...Object.values(BUDPOINTS.milestoneBadges), 'badge_kangaroo', 'badge_ninja', 'badge_pickle', 'badge_sloth', 'badge_troll', 'badge_hookah'];

/** BudPoints for one throw (before the 12-hour limit). */
export function tossPoints({ meters, rings, combo }) {
  const c = BUDPOINTS.toss;
  return Math.floor(Math.max(0, Math.min(Number(meters) || 0, 5000)) / c.metersPerPoint)
    + Math.max(0, Math.min(Number(rings) || 0, 20)) * c.perRing
    + (combo === true ? c.combo : 0);
}

/** The next Banana Toss milestone for a lifetime total, or null when all are reached. */
export function nextMilestone(earned) {
  return Object.entries(BUDPOINTS.milestones).sort((a, b) => a[1] - b[1]).find(([, at]) => earned < at) || null;
}
