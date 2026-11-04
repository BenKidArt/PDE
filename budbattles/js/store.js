// DATA LAYER (demo version).
//
// Right now this saves everything in the browser on this one device
// (IndexedDB). In the next step we swap this file for a real online backend.
// The rest of the app only uses the functions exported here, so that swap
// won't require changing the screens.

const DB_NAME = 'budbattles-demo';
const DB_VERSION = 1;
let dbPromise;
let battlesCache;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        const entries = db.createObjectStore('entries', { keyPath: 'id' });
        entries.createIndex('battleId', 'battleId');
        // Enforces "one photo per grower per battle" at the database level.
        entries.createIndex('battleUser', ['battleId', 'userId'], { unique: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(store, mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const request = fn(t.objectStore(store));
    t.oncomplete = () => resolve(request.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

// ---------- Battles ----------

export async function getBattles() {
  if (!battlesCache) {
    const res = await fetch('data/battles.json');
    battlesCache = (await res.json()).battles;
  }
  return battlesCache;
}

export async function getBattle(id) {
  return (await getBattles()).find((b) => b.id === id) || null;
}

/** The battle to show by default: the running one, else the next, else the latest. */
export async function getCurrentBattle(now = new Date()) {
  const list = await getBattles();
  const running = list.find((b) => new Date(b.start) <= now && now < new Date(b.votingEnds));
  if (running) return running;
  const upcoming = list.filter((b) => new Date(b.start) > now).sort((a, b) => new Date(a.start) - new Date(b.start));
  if (upcoming[0]) return upcoming[0];
  return [...list].sort((a, b) => new Date(b.votingEnds) - new Date(a.votingEnds))[0] || null;
}

/** 'upcoming' | 'open' (entries) | 'voting' | 'ended' */
export function battleStatus(b, now = new Date()) {
  if (now < new Date(b.start)) return 'upcoming';
  if (now < new Date(b.entriesClose)) return 'open';
  if (now < new Date(b.votingEnds)) return 'voting';
  return 'ended';
}

// ---------- Current user (placeholder until sign-up is built) ----------

export function getCurrentUser() {
  return { id: 'demo-user', displayName: 'Demo Grower', isAdmin: true };
}

// ---------- Entries ----------

export function getEntryByUser(battleId, userId) {
  return tx('entries', 'readonly', (s) => s.index('battleUser').get([battleId, userId]));
}

export function listEntries(battleId) {
  return tx('entries', 'readonly', (s) => s.index('battleId').getAll(battleId));
}

export async function countEntries(battleId) {
  return (await listEntries(battleId)).length;
}

export class StoreError extends Error {
  constructor(code) { super(code); this.code = code; }
}

/** Save a new entry. New entries always start as "pending" (waiting for admin review). */
export async function addEntry({ battleId, userId, strain, description, photo, width, height }) {
  const battle = await getBattle(battleId);
  if (!battle || battleStatus(battle) !== 'open') throw new StoreError('enter.closed');
  if (await getEntryByUser(battleId, userId)) throw new StoreError('error.alreadyEntered');

  const entry = {
    id: crypto.randomUUID(),
    battleId,
    userId,
    strain: strain.trim(),
    description: description.trim(),
    photo, // Blob, already cleaned of GPS/metadata
    width,
    height,
    status: 'pending', // pending | approved | rejected
    createdAt: new Date().toISOString(),
  };
  try {
    await tx('entries', 'readwrite', (s) => s.add(entry));
  } catch (e) {
    if (e && e.name === 'ConstraintError') throw new StoreError('error.alreadyEntered');
    throw e;
  }
  return entry;
}

/** Demo only: lets you delete your test entry and try again. */
export function deleteEntry(id) {
  return tx('entries', 'readwrite', (s) => s.delete(id));
}
