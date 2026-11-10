// A random ID for this browser, used only for the anti-cheat limits
// (max accounts per device, votes per device). Stored as a fingerprint in the database.
const KEY = 'bb.device';
let cached;

export function getDeviceId() {
  if (cached) return cached;
  try {
    cached = localStorage.getItem(KEY);
    if (!cached) { cached = crypto.randomUUID(); localStorage.setItem(KEY, cached); }
  } catch {
    cached = cached || crypto.randomUUID(); // storage blocked: random per visit
  }
  return cached;
}
