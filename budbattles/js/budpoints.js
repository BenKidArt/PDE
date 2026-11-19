// BUDPOINTS IN THE APP (rules: js/budpoints-config.js)
//   • listens for "bb:earn" (sent by js/store.js after a vote, an entry or a profile save)
//     and asks the database for the matching BudPoints → "+X BudPoints" + badge moments
//   • profileChecklist / visualDone: what "profile completed" and "profile look" mean
//   • progressText: "Next: Badge Shop at 120 (you have 84)"
import { t } from './i18n.js';
import { getCurrentUser, getProfileLook, gameAward } from './store.js';
import { BUDPOINTS, nextMilestone } from './budpoints-config.js';
import { showBadgeUnlock } from './gamebadges.js';

/** Floating "+X BudPoints" pill at the top of the screen (or a custom text). */
export function pointsToast(n, text) {
  const c = document.createElement('div');
  c.className = 'bp-chip bp-toast';
  c.textContent = text || t('game.plusPoints', { n });
  document.body.appendChild(c);
  setTimeout(() => c.remove(), 1700);
}

/** Show what a BudPoints call brought: "+X" and new badges. */
export function celebrate(r) {
  if (!r) return;
  if (r.granted > 0) pointsToast(r.granted);
  if (r.newBadges?.length) setTimeout(() => showBadgeUnlock(r.newBadges), r.granted > 0 ? 900 : 0);
}

/** Profile checklist: photo, username, bio, grow setup. Until avatars exist, an own
 *  background or banner photo also counts as the profile photo. */
export function profileChecklist(user, look) {
  const items = [
    ['photo', !!(user?.avatar || String(look?.bg || '').startsWith('u:') || String(look?.banner || '').startsWith('u:'))],
    ['username', !!String(user?.username || '').trim()],
    ['bio', !!String(user?.bio || '').trim()],
    ['setup', !!((Array.isArray(user?.setups) && user.setups.length) || String(user?.growSetup || '').trim())],
  ];
  return { items, complete: items.every(([, ok]) => ok) };
}
export function visualDone(user, look) {
  return !!(look?.bg || look?.banner || (user?.accent && user.accent !== 'theme'));
}

/** Checks both profile rewards (the database checks again and gives each only once). */
export async function checkProfileRewards() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return;
  const look = await getProfileLook(user.id).catch(() => null);
  if (profileChecklist(user, look).complete) celebrate(await gameAward('profile_complete').catch(() => null));
  if (visualDone(user, look)) celebrate(await gameAward('profile_visual').catch(() => null));
}

/** "Next: Badge Shop at 120 (you have 84)" – counts only BudPoints earned in Banana Toss. */
export function progressText(tossEarned) {
  const nx = nextMilestone(tossEarned || 0);
  if (!nx) return t('bp.allReached');
  return t('bp.next', { what: t(`bp.milestone.${nx[0]}`), at: nx[1], have: tossEarned || 0 });
}

/** "Points maxed – back in 3h 12m" or null while points can still be earned. */
export function maxedText(r) {
  if (!r?.windowResetAt || r.windowUsed < r.windowMax) return null;
  const ms = Math.max(0, new Date(r.windowResetAt).getTime() - Date.now());
  const h = Math.floor(ms / 3600000), m = Math.ceil((ms % 3600000) / 60000);
  return t('bp.maxed', { h: m === 60 ? h + 1 : h, m: m === 60 ? 0 : m });
}

export { BUDPOINTS };

let listening = false;
export function listenForEarnings() {
  if (listening) return;
  listening = true;
  window.addEventListener('bb:earn', async (e) => {
    const { kind, ref } = e.detail || {};
    if (kind === 'vote' || kind === 'enter') {
      if (!ref) return;
      celebrate(await gameAward(kind, ref).catch(() => null));
    } else if (kind === 'profile') {
      checkProfileRewards();
    }
  });
}
