// REAL data layer: Supabase (database, photo storage and login), servers in Frankfurt.
import { CONFIG } from './config.js';
import { StoreError } from './shared.js';

const BUCKET = 'entry-photos';
let sb; // Supabase client
let profileCache = null; // { id, email, displayName, isAdmin }
let battlesCache = null;
const listeners = new Set();
const emit = (event) => listeners.forEach((cb) => cb(event));

function loadLibrary() {
  if (window.supabase) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'js/vendor/supabase-2.119.0.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export async function initStore() {
  // Links in confirmation / password emails come back with "type=recovery" etc. in the address.
  const cameFromRecovery = location.hash.includes('type=recovery');
  const cameFromEmail = /access_token=|error_description=/.test(location.hash);

  await loadLibrary();
  sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
  });
  let lastUserId; // undefined until the first event
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      location.hash = '#/new-password';
      emit('PASSWORD_RECOVERY');
      return;
    }
    // Phones re-send "signed in" when you come back to the app (e.g. after the camera).
    // Only react when the logged-in person really changes, so forms aren't wiped.
    const userId = session?.user?.id ?? null;
    if (lastUserId !== undefined && userId !== lastUserId) {
      profileCache = null;
      emit(userId ? 'SIGNED_IN' : 'SIGNED_OUT');
    }
    lastUserId = userId;
  });
  await sb.auth.getSession(); // waits until a login from an email link has been processed

  if (cameFromRecovery) history.replaceState(null, '', '#/new-password');
  else if (cameFromEmail) history.replaceState(null, '', '#/profile');
}

function fail(error) {
  console.error(error);
  const code = error?.code || '';
  const msg = (error?.message || '').toLowerCase();
  if (code === '23505') throw new StoreError('error.alreadyEntered');
  if (code === '42501' || msg.includes('row-level security')) throw new StoreError('enter.closed');
  if (code === 'invalid_credentials' || msg.includes('invalid login')) throw new StoreError('error.loginFailed');
  if (code === 'user_already_exists' || msg.includes('already registered')) throw new StoreError('error.emailTaken');
  if (code === 'email_not_confirmed' || msg.includes('not confirmed')) throw new StoreError('error.emailNotConfirmed');
  if (code === 'weak_password' || msg.includes('password should')) throw new StoreError('error.passwordWeak');
  if (code.startsWith('over_') || error?.status === 429) throw new StoreError('error.rateLimit');
  if (msg.includes('age_confirmation_required')) throw new StoreError('error.ageRequired');
  if (msg.includes('terms_acceptance_required')) throw new StoreError('error.termsRequired');
  throw new StoreError('error.generic');
}

// ---------- Battles & settings ----------

const lines = (text) => (text || '').split('\n').map((l) => l.trim()).filter(Boolean);

function toBattle(r) {
  return {
    id: r.id,
    theme: { de: r.theme_de, en: r.theme_en },
    summary: { de: r.summary_de, en: r.summary_en },
    prize: r.prize_de || r.prize_en ? { de: r.prize_de || r.prize_en, en: r.prize_en || r.prize_de } : null,
    partner: r.partner_name ? { name: r.partner_name, logo: r.partner_logo_url, url: r.partner_url } : null,
    rules: { de: lines(r.rules_de), en: lines(r.rules_en) },
    start: r.start_at,
    entriesClose: r.entries_close_at,
    votingEnds: r.voting_ends_at,
  };
}

export async function getBattles() {
  if (!battlesCache) {
    const { data, error } = await sb.from('battles').select('*').order('start_at', { ascending: false });
    if (error) fail(error);
    battlesCache = data.map(toBattle);
  }
  return battlesCache;
}

export async function getSettings() {
  const { data, error } = await sb.from('settings').select('*').eq('id', 1).maybeSingle();
  if (error || !data) return { showPartner: true, showPrize: true, showStrain: true };
  return { showPartner: data.show_partner, showPrize: data.show_prize, showStrain: data.show_strain };
}

// ---------- Accounts ----------

export async function getCurrentUser() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  if (profileCache?.id === session.user.id) return profileCache;
  const { data, error } = await sb.from('profiles').select('display_name, is_admin').eq('id', session.user.id).maybeSingle();
  if (error) fail(error);
  profileCache = {
    id: session.user.id,
    email: session.user.email,
    displayName: data?.display_name || '',
    isAdmin: !!data?.is_admin,
  };
  return profileCache;
}

export function onAuthEvent(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const backHere = () => location.origin + location.pathname;

export async function signUp({ email, password, displayName, ageConfirmed, termsAccepted }) {
  if (!ageConfirmed) throw new StoreError('error.ageRequired');
  if (!termsAccepted) throw new StoreError('error.termsRequired');
  const { data, error } = await sb.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: backHere(),
      data: { display_name: displayName.trim(), age_confirmed: true, terms_version: CONFIG.termsVersion },
    },
  });
  if (error) fail(error);
  return { needsConfirmation: !data.session };
}

export async function signIn({ email, password }) {
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) fail(error);
}

export async function signOut() {
  const { error } = await sb.auth.signOut();
  if (error) fail(error);
}

export async function requestPasswordReset(email) {
  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: backHere() });
  if (error) fail(error);
}

export async function updatePassword(password) {
  const { error } = await sb.auth.updateUser({ password });
  if (error) fail(error);
}

// ---------- Entries ----------

function toEntry(r) {
  if (!r) return null;
  return {
    id: r.id,
    battleId: r.battle_id,
    userId: r.user_id,
    strain: r.strain,
    description: r.description,
    status: r.status,
    width: r.width,
    height: r.height,
    photoPath: r.photo_path,
    photoUrl: sb.storage.from(BUCKET).getPublicUrl(r.photo_path).data.publicUrl,
    createdAt: r.created_at,
  };
}

export async function countEntries(battleId) {
  const { data, error } = await sb.rpc('entry_count', { p_battle: battleId });
  if (error) return 0;
  return data;
}

export async function getEntryByUser(battleId, userId) {
  const { data, error } = await sb.from('entries').select('*')
    .eq('battle_id', battleId).eq('user_id', userId).maybeSingle();
  if (error) fail(error);
  return toEntry(data);
}

export async function addEntry({ battleId, strain, description, photo, width, height }) {
  const user = await getCurrentUser();
  if (!user) throw new StoreError('enter.loginNeeded');
  if (await getEntryByUser(battleId, user.id)) throw new StoreError('error.alreadyEntered');

  const path = `${user.id}/${crypto.randomUUID()}.jpg`;
  const up = await sb.storage.from(BUCKET).upload(path, photo, { contentType: 'image/jpeg', upsert: false });
  if (up.error) fail(up.error);

  const { data, error } = await sb.from('entries').insert({
    battle_id: battleId, photo_path: path, width, height, strain: strain || null, description,
  }).select().single();
  if (error) {
    await sb.storage.from(BUCKET).remove([path]); // don't leave an orphan photo behind
    fail(error);
  }
  return toEntry(data);
}

// ---------- Admin (the database only allows this for admins) ----------

export async function listEntries(battleId) {
  const { data, error } = await sb.from('entries').select('*, profiles(display_name)')
    .eq('battle_id', battleId).order('created_at', { ascending: true });
  if (error) fail(error);
  return data.map((r) => ({ ...toEntry(r), displayName: r.profiles?.display_name || '?' }));
}

export async function reviewEntry(id, status) {
  const { data, error } = await sb.from('entries')
    .update({ status, reviewed_at: status === 'pending' ? null : new Date().toISOString() })
    .eq('id', id).select('id');
  if (error) fail(error);
  if (!data?.length) throw new StoreError('admin.noAccess'); // blocked by the database = not admin
}

export async function withdrawEntry(entry) {
  const { error } = await sb.from('entries').delete().eq('id', entry.id);
  if (error) fail(error);
  await sb.storage.from(BUCKET).remove([entry.photoPath]);
}
