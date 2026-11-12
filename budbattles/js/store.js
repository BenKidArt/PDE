// DATA LAYER: the screens only talk to this file.
// It picks the demo version (this device only) or the real Supabase version,
// depending on whether js/config.js contains Supabase details.
import { isDemo } from './config.js';
import { StoreError, battleStatus, now } from './shared.js';

const impl = isDemo ? await import('./store-demo.js') : await import('./store-supabase.js');

/** Battle shape used everywhere:
 *  { id, number, theme:{de,en}, summary:{de,en}, partner:{name,logo,url}|null,
 *    rules:{de:[],en:[]}, start, entriesClose, votingEnds }
 *  Prizes are NOT part of it: they come from getPrize(), for members only. */

/** The battle to show by default: the running one, else the next, else the latest. */
export async function getCurrentBattle(at = now()) {
  const list = (await impl.getBattles()).filter((b) => !b.isTest); // test battles never become the default
  const running = list.find((b) => new Date(b.start) <= at && at < new Date(b.votingEnds));
  if (running) return running;
  const upcoming = list.filter((b) => new Date(b.start) > at).sort((a, b) => new Date(a.start) - new Date(b.start));
  if (upcoming[0]) return upcoming[0];
  return [...list].sort((a, b) => new Date(b.votingEnds) - new Date(a.votingEnds))[0] || null;
}

export async function getBattle(id) {
  return (await impl.getBattles()).find((b) => b.id === id) || null;
}

export const {
  initStore, // call once at start-up
  getBattles,
  getSettings, // { showPartner, showPrize, showStrain }
  getCurrentUser, // { id, email, displayName, isAdmin, isTester, canTest, badges:[ids] } or null
  getBadgeCatalog, // active badges: [{ id, image, name:{de,en}, description:{de,en} (= how to earn), kind, pricePoints, earned, tradeable, sort }]
  getAllBadges, // admin: all badges incl. inactive
  saveBadge, // admin: (fields, image|null) add or edit a badge
  onAuthEvent, // (cb) → cb('SIGNED_IN' | 'SIGNED_OUT' | 'PASSWORD_RECOVERY')
  signUp, // ({ email, password, displayName, ageConfirmed, termsAccepted }) → { needsConfirmation }
  signIn, // ({ email, password })
  signOut,
  requestPasswordReset, // (email)
  resendConfirmation, // (email, captchaToken) – sign-up confirmation email again
  updatePassword, // (newPassword)
  countEntries, // (battleId)
  getEntryByUser, // (battleId, userId) → entry or null
  addEntry, // ({ battleId, strain, description, photo, width, height }) → entry
  withdrawEntry, // (entry)
  listEntries, // (battleId) → all entries incl. displayName (admin only)
  reviewEntry, // (entryId, 'pending' | 'approved' | 'rejected') (admin only)
  getPrize, // (battleId) → { text:{de,en}, terms:{de,en} } or null. Members only.
  getStandings, // (battleId) → approved entries with votes, rank, isMine
  getMyVote, // (battleId) → entryId you voted for, or null
  castVote, // (battleId, entryId)
  listLatestApproved, // (limit) → newest approved entries
  finalizeBattles, // Top 3 + champion choices for ended battles (safe to call often)
  getPendingChampion, // [{ battleId, number, isTest, theme }] where you are #1 and must pick son/daughter
  chooseChampionBadge, // (battleId, 'badge_heir_son' | 'badge_heir_daughter')
  registerBusinessInterest, // ({ email, company, lang }) – Business page "Interested?" list
  checkProfileName, // (name) → 'ok' | 'invalid' | 'blocked' | 'taken'
  setProfileName, // (name) – max once every 30 days
  updateProfileDetails, // ({ instagram, growSetup, lights, medium, favStrain, bio })
  getPublicProfile, // (key) → public profile (never the email) or null
  getVoteReport, // admin: (battleId) → per entry vote statistics, flagged
  getEntryVotes, // admin: (entryId) → single votes
  cancelVote, // admin: (battleId, voterId, reason)
  getStrains, // Strain Match: strain info list (info only)
} = impl;

// Demo only (undefined with Supabase):
export const seedDemoEntries = impl.seedDemoEntries; // sample entries for the admin view
export const getDemoPhase = impl.getDemoPhase; // 'real' | 'open' | 'voting' | 'ended'
export const setDemoPhase = impl.setDemoPhase;

export { isDemo, StoreError, battleStatus, now };
