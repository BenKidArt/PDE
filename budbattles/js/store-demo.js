// DEMO data layer: everything is saved in this browser only (IndexedDB +
// localStorage). Used when js/config.js has no Supabase details.
import { CONFIG } from './config.js';
import { StoreError, battleStatus, setClockOffset, withRanks, toBadge } from './shared.js';

const DB_NAME = 'budbattles-demo';
const DB_VERSION = 2;
const PHASE_KEY = 'bb.demo.phase';
const SESSION_KEY = 'bb.demo.session';
const ACCOUNTS_KEY = 'bb.demo.accounts';
let dbPromise;
let battlesCache;
const listeners = new Set();

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (ev) => {
        const db = req.result;
        if (ev.oldVersion < 1) {
          const entries = db.createObjectStore('entries', { keyPath: 'id' });
          entries.createIndex('battleId', 'battleId');
          // "One photo per grower per battle", enforced by the database.
          entries.createIndex('battleUser', ['battleId', 'userId'], { unique: true });
        }
        if (ev.oldVersion < 2) {
          // "One vote per member per battle": the key is (battle, member).
          const votes = db.createObjectStore('votes', { keyPath: ['battleId', 'userId'] });
          votes.createIndex('entryId', 'entryId');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(mode, fn, storeName = 'entries') {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const request = fn(t.objectStore(storeName));
    t.oncomplete = () => resolve(request.result);
    // The request's own error says what went wrong (e.g. ConstraintError = duplicate).
    t.onerror = (ev) => reject(ev.target?.error || t.error);
    t.onabort = () => reject(t.error);
  }));
}

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}
async function hash(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const emit = (event) => listeners.forEach((cb) => cb(event));

export async function initStore() {
  await applyDemoPhase(getDemoPhase());
}

// ---------- Demo clock: jump to a phase of the current battle ----------

export function getDemoPhase() {
  try { return localStorage.getItem(PHASE_KEY) || 'real'; } catch { return 'real'; }
}

export async function setDemoPhase(phase) {
  try { localStorage.setItem(PHASE_KEY, phase); } catch { /* ignore */ }
  await applyDemoPhase(phase);
}

async function applyDemoPhase(phase) {
  const battle = [...(await getBattles())].sort((a, b) => new Date(a.start) - new Date(b.start))[0];
  const day = 24 * 3600 * 1000;
  const target = battle && {
    open: new Date(battle.start).getTime() + day,
    voting: new Date(battle.entriesClose).getTime() + day,
    ended: new Date(battle.votingEnds).getTime() + day,
  }[phase];
  setClockOffset(target ? target - Date.now() : 0);
}

export async function getBattles() {
  if (!battlesCache) {
    const res = await fetch('data/battles.json');
    battlesCache = (await res.json()).battles;
  }
  return battlesCache;
}

// Demo: badges from data/badges.json plus the ones added/edited on this device.
const BADGE_EDITS_KEY = 'bb.demo.badgeEdits';
async function demoBadgeRows() {
  const res = await fetch('data/badges.json');
  const rows = (await res.json()).badges;
  const edits = readJson(BADGE_EDITS_KEY, {});
  const merged = rows.map((r) => (edits[r.id] ? { ...r, ...edits[r.id] } : r));
  Object.values(edits).forEach((e) => { if (!rows.some((r) => r.id === e.id)) merged.push(e); });
  return merged.sort((a, b) => a.sort - b.sort);
}
export async function getBadgeCatalog() {
  return (await demoBadgeRows()).filter((b) => b.active).map(toBadge);
}
export async function getAllBadges() {
  return (await demoBadgeRows()).map(toBadge);
}
export async function saveBadge(fields, image) {
  const rows = await demoBadgeRows();
  if (fields.isNew && rows.some((r) => r.id === fields.id)) throw new StoreError('error.badgeExists');
  if (fields.earned && fields.tradeable) throw new StoreError('error.badgeTradeEarned');
  const imageUrl = image
    ? await new Promise((resolve) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.readAsDataURL(image.blob); })
    : fields.image;
  const edits = readJson(BADGE_EDITS_KEY, {});
  const old = rows.find((r) => r.id === fields.id) || { kind: 'award', price_points: null, earned: false };
  edits[fields.id] = {
    ...old, id: fields.id, image: imageUrl,
    name_de: fields.name.de, name_en: fields.name.en,
    description_de: fields.description.de, description_en: fields.description.en,
    tradeable: !!fields.tradeable && !old.earned, active: !!fields.active, sort: fields.sort ?? old.sort ?? 50,
  };
  writeJson(BADGE_EDITS_KEY, edits);
}

export async function getSettings() {
  const f = CONFIG.features;
  return { showPartner: f.partner, showPrize: f.prize, showStrain: f.strain };
}

// ---------- Accounts (pretend, local only) ----------

// The logged-in demo account (with its profile fields, read fresh each time).
export async function getCurrentUser() {
  const session = readJson(SESSION_KEY, null);
  if (!session) return null;
  const acc = Object.values(readJson(ACCOUNTS_KEY, {})).find((a) => a.id === session.id);
  return acc ? toUser(acc) : session;
}

function toUser(acc) {
  return {
    id: acc.id, email: acc.email, displayName: acc.username || acc.displayName,
    isAdmin: !!acc.isAdmin, isTester: !!acc.isTester, canTest: true, badges: acc.badges || ['badge_star'],
    username: acc.username ?? null, hasProfileNames: true, usernameChangedAt: acc.usernameChangedAt ?? null,
    instagram: acc.instagram ?? null, avatar: acc.avatar ?? null, growSetup: acc.growSetup ?? null,
    lights: acc.lights ?? null, medium: acc.medium ?? null, favStrain: acc.favStrain ?? null, bio: acc.bio ?? null,
    memberSince: acc.memberSince ?? acc.ageConfirmedAt ?? null,
    ...demoOptions(acc),
  };
}

const OPTION_KEYS = ['experience', 'growStyle', 'seedType', 'training', 'spaceSize', 'growStage', 'flavours', 'breeder', 'accent', 'spaceW', 'spaceD', 'spaceHMin', 'spaceHMax', 'growdiaries', 'youtube', 'tiktok', 'threads', 'setups'];
function demoOptions(acc) {
  return {
    experience: acc?.experience ?? null, seedType: acc?.seedType ?? null,
    growStyle: Array.isArray(acc?.growStyle) ? acc.growStyle : acc?.growStyle ? [acc.growStyle] : [],
    spaceW: acc?.spaceW ?? null, spaceD: acc?.spaceD ?? null, spaceHMin: acc?.spaceHMin ?? null, spaceHMax: acc?.spaceHMax ?? null,
    growdiaries: acc?.growdiaries ?? null, youtube: acc?.youtube ?? null, tiktok: acc?.tiktok ?? null, threads: acc?.threads ?? null,
    setups: Array.isArray(acc?.setups) ? acc.setups : [],
    training: acc?.training || [], spaceSize: acc?.spaceSize ?? null, growStage: acc?.growStage ?? null,
    flavours: acc?.flavours || [], breeder: acc?.breeder ?? null, accent: acc?.accent ?? null,
  };
}

function updateAccount(id, patch) {
  const accounts = readJson(ACCOUNTS_KEY, {});
  const key = Object.keys(accounts).find((k) => accounts[k].id === id);
  if (!key) throw new StoreError('error.generic');
  accounts[key] = { ...accounts[key], ...patch };
  writeJson(ACCOUNTS_KEY, accounts);
  return accounts[key];
}

/** Profile key used in links (#/u/<key>): the profile name, else the account id. */
const profileKeyOf = (acc) => acc?.username || acc?.id;

export function onAuthEvent(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function signUp({ email, password, displayName, ageConfirmed, termsAccepted }) {
  if (!ageConfirmed) throw new StoreError('error.ageRequired');
  if (!termsAccepted) throw new StoreError('error.termsRequired');
  const accounts = readJson(ACCOUNTS_KEY, {});
  const key = email.trim().toLowerCase();
  if (accounts[key]) throw new StoreError('error.emailTaken');
  // Demo accounts are admins so every screen can be tried. Everyone gets the Welcome badge.
  const wanted = displayName.trim();
  const nameOk = (await checkProfileName(wanted)) === 'ok';
  const now = new Date().toISOString();
  const user = { id: crypto.randomUUID(), email: key, displayName: wanted, isAdmin: true, isTester: false, canTest: true, badges: ['badge_star'] };
  accounts[key] = { ...user, pw: await hash(password), termsVersion: CONFIG.termsVersion, ageConfirmedAt: now, memberSince: now,
    username: nameOk ? wanted : null, usernameChangedAt: nameOk ? now : null };
  writeJson(ACCOUNTS_KEY, accounts);
  writeJson(SESSION_KEY, { id: user.id });
  emit('SIGNED_IN');
  return { needsConfirmation: false };
}

export async function signIn({ email, password }) {
  const acc = readJson(ACCOUNTS_KEY, {})[email.trim().toLowerCase()];
  if (!acc || acc.pw !== await hash(password)) throw new StoreError('error.loginFailed');
  writeJson(SESSION_KEY, { id: acc.id });
  emit('SIGNED_IN');
}

export async function signOut() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  emit('SIGNED_OUT');
}

export async function requestPasswordReset() {
  // Demo mode can't send emails.
}

export async function updatePassword() {}

// ---------- Entries ----------

function toEntry(row) {
  if (!row) return null;
  const { photo, ...rest } = row;
  return { ...rest, photoUrl: URL.createObjectURL(photo) };
}

export async function getEntryByUser(battleId, userId) {
  return toEntry(await tx('readonly', (s) => s.index('battleUser').get([battleId, userId])));
}

export async function countEntries(battleId) {
  const all = await tx('readonly', (s) => s.index('battleId').getAll(battleId));
  return all.filter((e) => e.status !== 'rejected').length;
}

export async function addEntry({ battleId, strain, description, photo, width, height }) {
  const user = await getCurrentUser();
  if (!user) throw new StoreError('enter.loginNeeded');
  const battle = (await getBattles()).find((b) => b.id === battleId);
  if (!battle || battleStatus(battle) !== 'open') throw new StoreError('enter.closed');

  const row = {
    id: crypto.randomUUID(),
    battleId,
    userId: user.id,
    strain: strain || null,
    description,
    photo, // Blob, already cleaned of GPS/metadata
    width,
    height,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  try {
    await tx('readwrite', (s) => s.add(row));
  } catch (e) {
    if (e && e.name === 'ConstraintError') throw new StoreError('error.alreadyEntered');
    throw e;
  }
  return toEntry(row);
}

// ---------- Admin ----------

/** All entries of a battle (admin view), oldest first, with the grower's display name. */
export async function listEntries(battleId) {
  const accounts = Object.values(readJson(ACCOUNTS_KEY, {}));
  const rows = await tx('readonly', (s) => s.index('battleId').getAll(battleId));
  return rows
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((r) => ({
      ...toEntry(r),
      displayName: r.displayName || nameOf(accounts.find((a) => a.id === r.userId)),
      ...profileBits(r, accounts),
    }));
}

/** Set an entry's status: 'pending' | 'approved' | 'rejected'. */
export async function reviewEntry(id, status) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const t = db.transaction('entries', 'readwrite');
    const store = t.objectStore('entries');
    const get = store.get(id);
    get.onsuccess = () => {
      if (!get.result) return;
      store.put({ ...get.result, status, reviewedAt: status === 'pending' ? null : new Date().toISOString() });
    };
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}

/** Demo only: adds a few sample entries from pretend growers, so there is something to review. */
export async function seedDemoEntries(battleId) {
  const samples = [
    { name: 'NightOwl', strain: 'Northern Lights', desc: 'Woche 9, voller Frost.', colors: ['#1c2a33', '#d8f3ff'], votes: 12, badges: ['badge_bulldog', 'badge_heart', 'badge_star'] },
    { name: 'BalkonBuds', strain: 'Gorilla Glue', desc: 'Harzig wie nie.', colors: ['#20301f', '#e9ffe0'], votes: 7, badges: ['badge_heart', 'badge_star'] },
    { name: 'TentQueen', strain: 'Wedding Cake', desc: 'Nahaufnahme mit Makrolinse.', colors: ['#2e1b2a', '#ffe3f4'], votes: 7, badges: ['badge_star'] },
    { name: 'GrowOpa', strain: 'Blue Dream', desc: 'Erster Grow, erstes Battle.', colors: ['#141e2e', '#bcd6ff'], votes: 3, badges: ['badge_star'] },
  ];
  for (const sample of samples) {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1200;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(450, 520, 40, 450, 600, 700);
    g.addColorStop(0, sample.colors[1]);
    g.addColorStop(1, sample.colors[0]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 900, 1200);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DEMO', 450, 620);
    const photo = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.8));
    const row = {
      id: crypto.randomUUID(),
      battleId,
      userId: `demo-${sample.name}`,
      displayName: sample.name,
      strain: sample.strain,
      description: sample.desc,
      photo,
      width: 900,
      height: 1200,
      status: 'pending',
      baseVotes: sample.votes, // pretend votes from other members
      badges: sample.badges, // pretend badges
      createdAt: new Date().toISOString(),
    };
    try { await tx('readwrite', (s) => s.add(row)); } catch { /* already seeded */ }
  }
}

// ---------- Prize (members only) ----------

export async function getPrize(battleId) {
  if (!(await getCurrentUser())) return null; // never loaded for visitors
  const res = await fetch('data/prizes.json');
  const p = (await res.json()).prizes[battleId];
  if (!p) return null;
  return { text: { de: p.de, en: p.en }, terms: { de: p.terms_de, en: p.terms_en } };
}

// ---------- Voting & standings ----------

function allVotes(battleId) {
  return tx('readonly', (s) => s.getAll(IDBKeyRange.bound([battleId, ''], [battleId, '\uffff'])), 'votes');
}

export async function getStandings(battleId) {
  const [user, rows, votes] = await Promise.all([
    getCurrentUser(),
    tx('readonly', (s) => s.index('battleId').getAll(battleId)),
    allVotes(battleId),
  ]);
  const accounts = Object.values(readJson(ACCOUNTS_KEY, {}));
  const list = rows.filter((r) => r.status === 'approved').map((r) => ({
    ...toEntry(r),
    displayName: r.displayName || nameOf(accounts.find((a) => a.id === r.userId)),
      ...profileBits(r, accounts),
    votes: (r.baseVotes || 0) + votes.filter((v) => v.entryId === r.id).length,
    isMine: !!user && r.userId === user.id,
    badges: r.badges || accounts.find((a) => a.id === r.userId)?.badges || [],
  }));
  list.sort((a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt));
  return withRanks(list);
}

export async function getMyVote(battleId) {
  const user = await getCurrentUser();
  if (!user) return null;
  const vote = await tx('readonly', (s) => s.get([battleId, user.id]), 'votes');
  return vote?.entryId ?? null;
}

export async function castVote(battleId, entryId) { // (the bot check only exists with the real database)
  const user = await getCurrentUser();
  if (!user) throw new StoreError('vote.loginNeeded');
  const battle = (await getBattles()).find((b) => b.id === battleId);
  if (!battle || battleStatus(battle) !== 'voting') throw new StoreError('error.voteClosed');
  const entry = await tx('readonly', (s) => s.get(entryId));
  if (!entry || entry.battleId !== battleId || entry.status !== 'approved') throw new StoreError('error.generic');
  if (entry.userId === user.id) throw new StoreError('error.voteOwn');
  try {
    await tx('readwrite', (s) => s.add({ battleId, userId: user.id, entryId, createdAt: new Date().toISOString() }), 'votes');
  } catch (e) {
    if (e && e.name === 'ConstraintError') throw new StoreError('error.alreadyVoted');
    throw e;
  }
}

export async function listLatestApproved(limit = 6) {
  const accounts = Object.values(readJson(ACCOUNTS_KEY, {}));
  const rows = await tx('readonly', (s) => s.getAll());
  return rows
    .filter((r) => r.status === 'approved')
    .sort((a, b) => (b.reviewedAt || b.createdAt).localeCompare(a.reviewedAt || a.createdAt))
    .slice(0, limit)
    .map((r) => ({ ...toEntry(r), displayName: r.displayName || nameOf(accounts.find((a) => a.id === r.userId)), ...profileBits(r, accounts) }));
}

export async function withdrawEntry(entry) {
  await tx('readwrite', (s) => s.delete(entry.id));
}

// Automatic badges only exist with the real database.
export async function finalizeBattles() {}
export async function getPendingChampion() { return []; }
export async function chooseChampionBadge() {}

// Demo: the "Interested?" list is kept on this device only.
export async function registerBusinessInterest({ email, company, lang }) {
  const list = readJson('bb.demo.businessInterest', []).filter((x) => x.email !== email.toLowerCase());
  list.push({ email: email.toLowerCase(), company: company || null, lang, createdAt: new Date().toISOString() });
  writeJson('bb.demo.businessInterest', list);
}

// ---------- Profile names, details, public profiles (demo) ----------

const nameOf = (acc) => acc?.username || acc?.displayName || '?';
function profileBits(r, accounts) {
  const acc = accounts.find((a) => a.id === r.userId);
  if (!acc) return { username: r.displayName || null, instagram: r.instagram || null, avatar: null, profileKey: r.displayName || null };
  return { username: acc.username ?? null, instagram: acc.instagram ?? null, avatar: acc.avatar ?? null, profileKey: profileKeyOf(acc) };
}

const DEMO_BLOCKED = ['fuck', 'shit', 'nazi', 'hitler', 'fotze', 'hure', 'nutte', 'wichser', 'admin', 'budbattles'];
export async function checkProfileName(name) {
  if (!/^[A-Za-z0-9_]{3,20}$/.test(name || '')) return 'invalid';
  if (DEMO_BLOCKED.some((w) => name.toLowerCase().includes(w))) return 'blocked';
  const me = readJson(SESSION_KEY, null)?.id;
  const accounts = Object.values(readJson(ACCOUNTS_KEY, {}));
  const seeded = ['NightOwl', 'BalkonBuds', 'TentQueen', 'GrowOpa'];
  if (accounts.some((a) => a.id !== me && (a.username || '').toLowerCase() === name.toLowerCase())
    || seeded.some((n) => n.toLowerCase() === name.toLowerCase())) return 'taken';
  return 'ok';
}

export async function setProfileName(name) {
  const user = await getCurrentUser();
  if (!user) throw new StoreError('vote.loginNeeded');
  const st = await checkProfileName(name);
  if (st !== 'ok') throw new StoreError({ invalid: 'error.nameInvalid', blocked: 'error.nameBlocked', taken: 'error.nameTaken' }[st]);
  if (user.username && user.username.toLowerCase() === name.toLowerCase()) { updateAccount(user.id, { username: name }); return; }
  if (user.usernameChangedAt && Date.now() - new Date(user.usernameChangedAt) < 30 * 864e5) throw new StoreError('error.nameTooSoon');
  updateAccount(user.id, { username: name, usernameChangedAt: new Date().toISOString() });
}

export async function updateProfileDetails(changes) {
  const user = await getCurrentUser();
  if (!user) throw new StoreError('vote.loginNeeded');
  const d = { ...user, ...changes }; // fields not given keep their value
  const insta = (d.instagram || '').trim().replace(/^@/, '');
  if (insta && !/^[A-Za-z0-9._]{1,30}$/.test(insta)) throw new StoreError('error.instagramInvalid');
  updateAccount(user.id, {
    instagram: insta || null, growSetup: d.growSetup || null, lights: (d.lights || '').trim() || null,
    medium: d.medium || null, favStrain: (d.favStrain || '').trim() || null, bio: (d.bio || '').trim().slice(0, 150) || null,
    ...Object.fromEntries(OPTION_KEYS.map((k) => [k, Array.isArray(d[k]) ? d[k] : (typeof d[k] === 'string' ? d[k].trim() || null : d[k] ?? null)])),
  });
}

export async function getPublicProfile(key) {
  const me = readJson(SESSION_KEY, null)?.id;
  const accounts = Object.values(readJson(ACCOUNTS_KEY, {}));
  const acc = accounts.find((a) => a.id === key || (a.username || '').toLowerCase() === String(key).toLowerCase());
  const rows = await tx('readonly', (s) => s.getAll());
  const votesAll = await tx('readonly', (s) => s.getAll(), 'votes');
  const battles = await getBattles();
  const mine = rows.filter((r) => r.status === 'approved' && (acc ? r.userId === acc.id : r.displayName === key));
  if (!acc && !mine.length) return null;
  const history = [];
  for (const r of mine) {
    const b = battles.find((x) => x.id === r.battleId);
    const st = (await getStandings(r.battleId)).find((e) => e.id === r.id);
    const phase = b ? battleStatus(b) : 'ended';
    history.push({ entryId: r.id, battleId: r.battleId, number: b?.number, theme: b?.theme || { de: r.battleId, en: r.battleId },
      photoUrl: URL.createObjectURL(r.photo), strain: r.strain, votes: st?.votes ?? 0,
      place: phase === 'voting' || phase === 'ended' ? st?.rank ?? null : null, ended: phase === 'ended' });
  }
  const ended = history.filter((h) => h.ended && h.place);
  return {
    id: acc?.id || key, isMe: !!acc && acc.id === me, username: acc?.username ?? key, displayName: acc ? nameOf(acc) : key,
    instagram: acc?.instagram ?? null, avatar: acc?.avatar ?? null, memberSince: acc?.memberSince ?? null,
    growSetup: acc?.growSetup ?? null, lights: acc?.lights ?? null, medium: acc?.medium ?? null, favStrain: acc?.favStrain ?? null, bio: acc?.bio ?? null,
    nameChangedAt: acc && acc.id === me ? acc.usernameChangedAt ?? null : null,
    ...demoOptions(acc),
    badges: acc ? acc.badges || ['badge_star'] : mine[0]?.badges || [],
    stats: { battles: new Set(mine.map((r) => r.battleId)).size, best_place: ended.length ? Math.min(...ended.map((h) => h.place)) : null,
      votes_given: acc ? votesAll.filter((v) => v.userId === acc.id).length : 0 },
    history,
  };
}

// ---------- Admin: suspicious votes (demo: only the votes made on this device) ----------
export async function getVoteReport(battleId) {
  const standings = await getStandings(battleId);
  const votes = await tx('readonly', (s) => s.getAll(), 'votes');
  return standings.map((e) => ({ entryId: e.id, displayName: e.displayName, votes: e.votes,
    newAccountVotes: votes.filter((v) => v.entryId === e.id).length, maxSameNetwork: 0, maxSameDevice: votes.filter((v) => v.entryId === e.id).length,
    flagged: false }));
}
export async function getEntryVotes(entryId) {
  const accounts = Object.values(readJson(ACCOUNTS_KEY, {}));
  const votes = (await tx('readonly', (s) => s.getAll(), 'votes')).filter((v) => v.entryId === entryId);
  return votes.map((v) => ({ voterId: v.userId, voterName: nameOf(accounts.find((a) => a.id === v.userId)), votedAt: v.createdAt, ageHours: 0, sameNetwork: 1, sameDevice: votes.length }));
}
export async function cancelVote(battleId, voterId) {
  await tx('readwrite', (s) => s.delete([battleId, voterId]), 'votes');
}

let demoStrains;
export async function getStrains() {
  if (!demoStrains) demoStrains = (await (await fetch('data/strains.json')).json()).strains.filter((s) => s.active !== false);
  return demoStrains;
}

