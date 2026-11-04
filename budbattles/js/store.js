// DATA LAYER: the screens only talk to this file.
// It picks the demo version (this device only) or the real Supabase version,
// depending on whether js/config.js contains Supabase details.
import { isDemo } from './config.js';
import { StoreError, battleStatus } from './shared.js';

const impl = isDemo ? await import('./store-demo.js') : await import('./store-supabase.js');

/** Battle shape used everywhere:
 *  { id, theme:{de,en}, summary:{de,en}, prize:{de,en}|null,
 *    partner:{name,logo,url}|null, rules:{de:[],en:[]}, start, entriesClose, votingEnds } */

/** The battle to show by default: the running one, else the next, else the latest. */
export async function getCurrentBattle(now = new Date()) {
  const list = await impl.getBattles();
  const running = list.find((b) => new Date(b.start) <= now && now < new Date(b.votingEnds));
  if (running) return running;
  const upcoming = list.filter((b) => new Date(b.start) > now).sort((a, b) => new Date(a.start) - new Date(b.start));
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
  getCurrentUser, // { id, email, displayName, isAdmin } or null
  onAuthEvent, // (cb) → cb('SIGNED_IN' | 'SIGNED_OUT' | 'PASSWORD_RECOVERY')
  signUp, // ({ email, password, displayName, ageConfirmed, termsAccepted }) → { needsConfirmation }
  signIn, // ({ email, password })
  signOut,
  requestPasswordReset, // (email)
  updatePassword, // (newPassword)
  countEntries, // (battleId)
  getEntryByUser, // (battleId, userId) → entry or null
  addEntry, // ({ battleId, strain, description, photo, width, height }) → entry
  withdrawEntry, // (entry)
} = impl;

export { isDemo, StoreError, battleStatus };
