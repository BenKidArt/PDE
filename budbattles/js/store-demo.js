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

export async function withdrawEntry(entry) {
  await tx('readwrite', (s) => s.delete(entry.id));
}
