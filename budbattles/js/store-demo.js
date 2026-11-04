// DEMO data layer: everything is saved in this browser only (IndexedDB +
// localStorage). Used when js/config.js has no Supabase details.
import { CONFIG } from './config.js';
import { StoreError, battleStatus } from './shared.js';

const DB_NAME = 'budbattles-demo';
const DB_VERSION = 1;
const SESSION_KEY = 'bb.demo.session';
const ACCOUNTS_KEY = 'bb.demo.accounts';
let dbPromise;
let battlesCache;
const listeners = new Set();

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const entries = req.result.createObjectStore('entries', { keyPath: 'id' });
        entries.createIndex('battleId', 'battleId');
        // "One photo per grower per battle", enforced by the database.
        entries.createIndex('battleUser', ['battleId', 'userId'], { unique: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction('entries', mode);
    const request = fn(t.objectStore('entries'));
    t.oncomplete = () => resolve(request.result);
    t.onerror = () => reject(t.error);
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

export async function initStore() {}

export async function getBattles() {
  if (!battlesCache) {
    const res = await fetch('data/battles.json');
    battlesCache = (await res.json()).battles;
  }
  return battlesCache;
}

export async function getSettings() {
  const f = CONFIG.features;
  return { showPartner: f.partner, showPrize: f.prize, showStrain: f.strain };
}

// ---------- Accounts (pretend, local only) ----------

export async function getCurrentUser() {
  return readJson(SESSION_KEY, null);
}

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
  const user = { id: crypto.randomUUID(), email: key, displayName: displayName.trim(), isAdmin: true };
  accounts[key] = { ...user, pw: await hash(password), termsVersion: CONFIG.termsVersion, ageConfirmedAt: new Date().toISOString() };
  writeJson(ACCOUNTS_KEY, accounts);
  writeJson(SESSION_KEY, user);
  emit('SIGNED_IN');
  return { needsConfirmation: false };
}

export async function signIn({ email, password }) {
  const acc = readJson(ACCOUNTS_KEY, {})[email.trim().toLowerCase()];
  if (!acc || acc.pw !== await hash(password)) throw new StoreError('error.loginFailed');
  const { id, displayName, isAdmin } = acc;
  writeJson(SESSION_KEY, { id, email: acc.email, displayName, isAdmin });
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
      displayName: r.displayName || accounts.find((a) => a.id === r.userId)?.displayName || '?',
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
    { name: 'NightOwl', strain: 'Northern Lights', desc: 'Woche 8, die Kälte bringt das Lila raus.', colors: ['#2a1442', '#b04bff'] },
    { name: 'BalkonBuds', strain: 'Gorilla Glue', desc: 'Outdoor auf dem Balkon, Herbstfarben.', colors: ['#3b2a0a', '#ff9d2e'] },
    { name: 'TentQueen', strain: 'Strawberry Kush', desc: 'Pink wie nie zuvor.', colors: ['#3a0b24', '#ff3fa4'] },
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
      createdAt: new Date().toISOString(),
    };
    try { await tx('readwrite', (s) => s.add(row)); } catch { /* already seeded */ }
  }
}

export async function withdrawEntry(entry) {
  await tx('readwrite', (s) => s.delete(entry.id));
}
