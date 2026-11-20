// REAL data layer: Supabase (database, photo storage and login), servers in Frankfurt.
import { CONFIG } from './config.js';
import { toDb, fromDb } from './setups.js';
import { getDeviceId } from './device.js';
import { StoreError, withRanks, toBadge } from './shared.js';
import { DEMO_BADGES } from './budpoints-config.js';

const BUCKET = 'entry-photos';
let sb; // Supabase client
let profileCache = null; // { id, email, displayName, isAdmin, isTester, canTest, badges }
let badgeCache = null;
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
  // an old or already used confirmation link comes back with an error in the address
  const linkExpired = /error_code=otp_expired|error_description=[^&]*(expired|invalid)/i.test(location.hash + location.search);

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
      battlesCache = null; // admins see more battles (test battles) than visitors
      emit(userId ? 'SIGNED_IN' : 'SIGNED_OUT');
    }
    lastUserId = userId;
  });
  await sb.auth.getSession(); // waits until a login from an email link has been processed

  if (linkExpired) history.replaceState(null, '', location.pathname + '#/link-expired');
  else if (cameFromRecovery) history.replaceState(null, '', '#/new-password');
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
  if (msg.includes('underage')) throw new StoreError('error.underage');
  if (msg.includes('birth_date_invalid')) throw new StoreError('error.birthDateInvalid');
  if (msg.includes('database error saving new user')) throw new StoreError('error.signupBlocked');
  if (msg.includes('terms_acceptance_required')) throw new StoreError('error.termsRequired');
  throw new StoreError('error.generic');
}

// ---------- Battles & settings ----------

const lines = (text) => (text || '').split('\n').map((l) => l.trim()).filter(Boolean);

function toBattle(r) {
  return {
    id: r.id,
    number: r.number,
    isTest: !!r.is_test, // hidden test battle: the database only shows it to admins
    isDraft: !!r.is_draft, // hidden draft battle: the database only shows it to admins
    style: r.style || '', // '' = green, 'pink'
    subtitle: { de: r.subtitle_de || '', en: r.subtitle_en || '' },
    theme: { de: r.theme_de, en: r.theme_en },
    summary: { de: r.summary_de, en: r.summary_en },
    partner: r.partner_name ? { name: r.partner_name, logo: r.partner_logo_url, url: r.partner_url, kind: r.partner_kind || 'partner' } : null,
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

/** Active badges, sorted. Inactive ones are never shown. */
export async function getBadgeCatalog() {
  if (!badgeCache) {
    const { data, error } = await sb.from('badges').select('*').eq('active', true).order('sort');
    badgeCache = error ? [] : data.map(toBadge);
  }
  return badgeCache;
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
  let [{ data, error }, own] = await Promise.all([
    sb.from('profiles').select('display_name, is_admin, is_tester, username, username_changed_at, instagram, avatar, grow_setup, lights, medium, fav_strain, bio, created_at, experience, grow_style, seed_type, training, space_size, grow_stage, flavours, breeder, accent, space_w, space_d, space_h_min, space_h_max, growdiaries, youtube, tiktok, threads, setups').eq('id', session.user.id).maybeSingle(),
    sb.from('user_badges').select('badge_id').eq('user_id', session.user.id),
  ]);
  let dbLevel = 14; // which database update has run (decides what can be saved)
  if (error) {
    dbLevel = 13;
    // Safety net: database update 014 not run yet → load without the setups list.
    ({ data, error } = await sb.from('profiles').select('display_name, is_admin, is_tester, username, username_changed_at, instagram, avatar, grow_setup, lights, medium, fav_strain, bio, created_at, experience, grow_style, seed_type, training, space_size, grow_stage, flavours, breeder, accent, space_w, space_d, space_h_min, space_h_max, growdiaries, youtube, tiktok, threads').eq('id', session.user.id).maybeSingle());
  }
  if (error) {
    dbLevel = 12;
    // Safety net: database update 013 not run yet → load without the profile links.
    ({ data, error } = await sb.from('profiles').select('display_name, is_admin, is_tester, username, username_changed_at, instagram, avatar, grow_setup, lights, medium, fav_strain, bio, created_at, experience, grow_style, seed_type, training, space_size, grow_stage, flavours, breeder, accent, space_w, space_d, space_h_min, space_h_max').eq('id', session.user.id).maybeSingle());
  }
  if (error) {
    dbLevel = 11;
    // Safety net: database update 012 not run yet → load without the custom space size.
    ({ data, error } = await sb.from('profiles').select('display_name, is_admin, is_tester, username, username_changed_at, instagram, avatar, grow_setup, lights, medium, fav_strain, bio, created_at, experience, grow_style, seed_type, training, space_size, grow_stage, flavours, breeder, accent').eq('id', session.user.id).maybeSingle());
  }
  if (error) {
    // Safety net: database update 011 not run yet → load without the newest profile options.
    ({ data, error } = await sb.from('profiles').select('display_name, is_admin, is_tester, username, username_changed_at, instagram, avatar, grow_setup, lights, medium, fav_strain, bio, created_at').eq('id', session.user.id).maybeSingle());
  }
  if (error) {
    // Safety net: database update 010 / 003 not run yet → load without the newer profile fields.
    ({ data, error } = await sb.from('profiles').select('display_name, is_admin, is_tester').eq('id', session.user.id).maybeSingle());
  }
  if (error) {
    ({ data, error } = await sb.from('profiles').select('display_name, is_admin').eq('id', session.user.id).maybeSingle());
  }
  if (error) fail(error);
  profileCache = {
    id: session.user.id,
    email: session.user.email,
    displayName: data?.display_name || '',
    isAdmin: !!data?.is_admin,
    isTester: !!data?.is_tester,
    canTest: !!(data?.is_admin || data?.is_tester), // may see and use hidden test battles
    badges: (own.data || []).map((b) => b.badge_id),
    username: data?.username ?? null, // null = must still choose a profile name
    hasProfileNames: !!data && 'username' in data, // false until database update 010 ran
    usernameChangedAt: data?.username_changed_at ?? null,
    instagram: data?.instagram ?? null,
    avatar: data?.avatar ?? null,
    growSetup: data?.grow_setup ?? null,
    lights: data?.lights ?? null,
    medium: data?.medium ?? null,
    favStrain: data?.fav_strain ?? null,
    bio: data?.bio ?? null,
    memberSince: data?.created_at ?? null,
    ...profileOptions(data),
    dbLevel,
  };
  sb.rpc('register_device', { p_device: getDeviceId() }).then(() => {}, () => {}); // for the anti-cheat limits
  return profileCache;
}

export function onAuthEvent(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const backHere = () => location.origin + location.pathname;

export async function signUp({ email, password, displayName, birthDate, ageConfirmed, termsAccepted, captchaToken }) {
  if (!ageConfirmed) throw new StoreError('error.ageRequired');
  if (!birthDate) throw new StoreError('error.birthDateRequired');
  if (!termsAccepted) throw new StoreError('error.termsRequired');
  const devCount = await sb.rpc('device_account_count', { p_device: getDeviceId() });
  if (!devCount.error && devCount.data >= CONFIG.accountsPerDevice) throw new StoreError('error.tooManyAccounts');
  const { data, error } = await sb.auth.signUp({
    email: email.trim(),
    password,
    options: {
      captchaToken: captchaToken || undefined,
      emailRedirectTo: backHere(),
      // birth_date stays in the private account data; the database refuses under-18s
      data: { display_name: displayName.trim(), birth_date: birthDate, age_confirmed: true, terms_version: CONFIG.termsVersion },
    },
  });
  if (error) fail(error);
  return { needsConfirmation: !data.session };
}

export async function signIn({ email, password, captchaToken }) {
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password, options: { captchaToken: captchaToken || undefined } });
  if (error) fail(error);
}

/** Sends the sign-up confirmation email again. */
export async function resendConfirmation(email, captchaToken) {
  const { error } = await sb.auth.resend({
    type: 'signup', email: email.trim(),
    options: { emailRedirectTo: backHere(), captchaToken: captchaToken || undefined },
  });
  if (error) fail(error);
}

export async function signOut() {
  const { error } = await sb.auth.signOut();
  if (error) fail(error);
}

export async function requestPasswordReset(email, captchaToken) {
  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: backHere(), captchaToken: captchaToken || undefined });
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
    breeder: r.breeder ?? null,
    guestHandle: r.guest_handle ?? null, // entry added by an admin for a grower without the app
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

export async function addEntry({ battleId, strain, breeder, description, photo, width, height }) {
  const user = await getCurrentUser();
  if (!user) throw new StoreError('enter.loginNeeded');
  if (await getEntryByUser(battleId, user.id)) throw new StoreError('error.alreadyEntered');

  const path = `${user.id}/${crypto.randomUUID()}.jpg`;
  const up = await sb.storage.from(BUCKET).upload(path, photo, { contentType: 'image/jpeg', upsert: false });
  if (up.error) fail(up.error);

  const { data, error } = await sb.from('entries').insert({
    battle_id: battleId, photo_path: path, width, height, strain: strain || null, description,
    ...(breeder ? { breeder } : {}),
  }).select().single();
  if (error) {
    await sb.storage.from(BUCKET).remove([path]); // don't leave an orphan photo behind
    fail(error);
  }
  return toEntry(data);
}

// ---------- Admin (the database only allows this for admins) ----------

export async function listEntries(battleId) {
  // entries + the grower's profile in one request (profiles!entries_user_id_fkey = the grower)
  let { data, error } = await sb.from('entries').select('*, profiles!entries_user_id_fkey(display_name, username, instagram, avatar)')
    .eq('battle_id', battleId).order('created_at', { ascending: true });
  if (error) {
    // safety net: load the entries alone and their growers' profiles separately, so the
    // admin list never breaks because of how the two tables are linked
    ({ data, error } = await sb.from('entries').select('*').eq('battle_id', battleId).order('created_at', { ascending: true }));
    if (error) fail(error);
    const ids = [...new Set(data.map((r) => r.user_id).filter(Boolean))];
    let profs = [];
    if (ids.length) {
      let res = await sb.from('profiles').select('id, display_name, username, instagram, avatar').in('id', ids);
      if (res.error) res = await sb.from('profiles').select('id, display_name').in('id', ids);
      profs = res.data || [];
    }
    data = data.map((r) => ({ ...r, profiles: profs.find((x) => x.id === r.user_id) || null }));
  }
  return data.map((r) => ({
    ...toEntry(r),
    displayName: r.profiles?.username || r.profiles?.display_name || (r.guest_handle ? `@${r.guest_handle}` : '?'),
    username: r.profiles?.username ?? null,
    instagram: r.profiles?.instagram ?? r.guest_handle ?? null,
    avatar: r.profiles?.avatar ?? null,
  }));
}

export async function reviewEntry(id, status) {
  const { data, error } = await sb.from('entries')
    .update({ status, reviewed_at: status === 'pending' ? null : new Date().toISOString() })
    .eq('id', id).select('id');
  if (error) fail(error);
  if (!data?.length) throw new StoreError('admin.noAccess'); // blocked by the database = not admin
}

// ---------- Prize (members only: the database refuses visitors) ----------

export async function getPrize(battleId) {
  if (!(await getCurrentUser())) return null;
  const { data, error } = await sb.from('battle_prizes').select('*').eq('battle_id', battleId).maybeSingle();
  if (error || !data || !(data.prize_de || data.prize_en)) return null;
  return {
    text: { de: data.prize_de || data.prize_en, en: data.prize_en || data.prize_de },
    terms: { de: data.terms_de, en: data.terms_en },
  };
}

// ---------- Voting & standings ----------

const publicUrl = (path) => sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

export async function getStandings(battleId) {
  const { data, error } = await sb.rpc('get_standings', { p_battle: battleId });
  if (error) fail(error);
  return withRanks(data.map((r) => ({
    id: r.entry_id,
    battleId,
    photoUrl: publicUrl(r.photo_path),
    width: r.width,
    height: r.height,
    strain: r.strain,
    description: r.description,
    displayName: r.display_name,
    votes: r.votes,
    isMine: r.is_mine,
    createdAt: r.created_at,
    badges: r.badges || [],
    username: r.username ?? null,
    instagram: r.instagram ?? null,
    avatar: r.avatar ?? null,
    profileKey: r.profile_key ?? null, // opens #/u/<key> (none for guest entries)
    breeder: r.breeder ?? null,
    isGuest: !!r.is_guest,
  })));
}

export async function getMyVote(battleId) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const { data, error } = await sb.from('votes').select('entry_id').eq('battle_id', battleId).maybeSingle();
  if (error) return null;
  return data?.entry_id ?? null;
}

const VOTE_ERRORS = {
  already_voted: 'error.alreadyVoted', voting_closed: 'error.voteClosed', invalid_entry: 'error.voteClosed',
  vote_cancelled: 'error.voteCancelled', email_not_confirmed: 'error.voteEmailConfirm', account_too_new: 'error.voteTooNew',
  too_many_accounts: 'error.tooManyAccounts', rate_limited: 'error.voteRateLimited', bot_check_failed: 'error.botCheck',
  login_required: 'vote.loginNeeded',
};

/** Votes go through the database function cast_vote(), which runs all anti-cheat checks. */
export async function castVote(battleId, entryId, captchaToken) {
  if (!(await getCurrentUser())) throw new StoreError('vote.loginNeeded');
  const { error } = await sb.rpc('cast_vote', { p_battle: battleId, p_entry: entryId, p_token: captchaToken || null, p_device: getDeviceId() });
  if (!error) return;
  console.error(error);
  const key = Object.keys(VOTE_ERRORS).find((k) => (error.message || '').includes(k));
  if (key) throw new StoreError(VOTE_ERRORS[key]);
  if (error.code === '23505') throw new StoreError('error.alreadyVoted');
  fail(error);
}

export async function listLatestApproved(limit = 6) {
  const { data, error } = await sb.rpc('latest_entries', { p_limit: limit });
  if (error) return [];
  return data.map((r) => ({
    id: r.entry_id, battleId: r.battle_id, photoUrl: publicUrl(r.photo_path),
    width: r.width, height: r.height, strain: r.strain, displayName: r.display_name,
  }));
}

export async function withdrawEntry(entry) {
  const { error } = await sb.from('entries').delete().eq('id', entry.id);
  if (error) fail(error);
  await sb.storage.from(BUCKET).remove([entry.photoPath]);
}

// ---------- Automatic badges (database update 004) ----------

/** Hands out Top 3 badges and champion choices for battles whose voting ended. Safe to call often. */
export async function finalizeBattles() {
  const { error } = await sb.rpc('finalize_ended_battles');
  if (error) console.warn('finalize_ended_battles', error.message); // e.g. update 004 not run yet
}

/** Battles where the logged-in member is #1 and still has to pick son or daughter. */
export async function getPendingChampion() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return [];
  const { data, error } = await sb.rpc('my_pending_champion');
  if (error) return [];
  return data.map((r) => ({
    battleId: r.battle_id, number: r.number, isTest: r.is_test, theme: { de: r.theme_de, en: r.theme_en },
  }));
}

export async function chooseChampionBadge(battleId, badgeId) {
  const { error } = await sb.rpc('choose_champion_badge', { p_battle: battleId, p_badge: badgeId });
  if (error) { console.error(error); throw new StoreError('error.championChoice'); }
  profileCache = null; // reload the profile so the new badge shows
}

// ---------- Badges admin (database update 006) ----------

/** Every badge incl. inactive ones (for the admin part of the Badges page). */
export async function getAllBadges() {
  const { data, error } = await sb.from('badges').select('*').order('sort');
  if (error) fail(error);
  return data.map(toBadge);
}

/**
 * Add or edit a badge. image: { blob, ext } from makeBadgeIcon(), or null to keep the old one.
 * fields: { id, isNew, name:{de,en}, description:{de,en}, tradeable, active, sort, earned }
 */
export async function saveBadge(fields, image) {
  let imageUrl = fields.image;
  if (image) {
    const path = `${fields.id}-${Date.now()}.${image.ext}`; // new name each time → no stale cache
    const up = await sb.storage.from('badge-images').upload(path, image.blob, { contentType: image.blob.type, upsert: false });
    if (up.error) fail(up.error);
    imageUrl = sb.storage.from('badge-images').getPublicUrl(path).data.publicUrl;
  }
  const row = {
    image: imageUrl,
    name_de: fields.name.de, name_en: fields.name.en,
    description_de: fields.description.de, description_en: fields.description.en,
    tradeable: !!fields.tradeable && !fields.earned,
    active: !!fields.active,
    sort: fields.sort ?? 50,
  };
  const { error } = fields.isNew
    ? await sb.from('badges').insert({ id: fields.id, kind: 'award', earned: false, ...row })
    : await sb.from('badges').update(row).eq('id', fields.id);
  if (error) {
    if (error.code === '23505') throw new StoreError('error.badgeExists');
    if (error.code === '23514') throw new StoreError('error.badgeTradeEarned');
    fail(error);
  }
  badgeCache = null;
}

// ---------- Business page "Interested?" list (database update 008) ----------
export async function registerBusinessInterest({ email, company, lang }) {
  const { error } = await sb.rpc('register_business_interest', { p_email: email, p_company: company || null, p_lang: lang });
  if (error) {
    if (error.code === '23514') throw new StoreError('error.emailInvalid');
    fail(error);
  }
}

// ---------- Profile name, profile details, public profiles (database update 010) ----------

/** 'ok' | 'invalid' | 'blocked' | 'taken' */
export async function checkProfileName(name) {
  const { data, error } = await sb.rpc('profile_name_available', { p_name: name });
  // the final check happens when saving; an unexpected answer must not block the form
  if (error || !['ok', 'invalid', 'blocked', 'taken'].includes(data)) return 'ok';
  return data;
}

const NAME_ERRORS = { name_invalid: 'error.nameInvalid', name_blocked: 'error.nameBlocked', name_taken: 'error.nameTaken', name_change_too_soon: 'error.nameTooSoon' };

export async function setProfileName(name) {
  const { error } = await sb.rpc('set_profile_name', { p_name: name });
  if (error) {
    const key = Object.keys(NAME_ERRORS).find((k) => (error.message || '').includes(k));
    if (key) throw new StoreError(NAME_ERRORS[key]);
    fail(error);
  }
  profileCache = null;
}

/** The extra profile options (update 011) in app form. */
function profileOptions(r) {
  return {
    // grow style is a list since update 012 (before: one value)
    experience: r?.experience ?? null, growStyle: Array.isArray(r?.grow_style) ? r.grow_style : r?.grow_style ? [r.grow_style] : [],
    seedType: r?.seed_type ?? null,
    spaceW: r?.space_w ?? null, spaceD: r?.space_d ?? null, spaceHMin: r?.space_h_min ?? null, spaceHMax: r?.space_h_max ?? null,
    growdiaries: r?.growdiaries ?? null, youtube: r?.youtube ?? null, tiktok: r?.tiktok ?? null, threads: r?.threads ?? null,
    setups: Array.isArray(r?.setups) ? r.setups.map(fromDb) : [],
    training: r?.training || [], spaceSize: r?.space_size ?? null, growStage: r?.grow_stage ?? null,
    flavours: r?.flavours || [], breeder: r?.breeder ?? null, accent: r?.accent ?? null,
  };
}

/** Saves profile fields. Fields not given keep their current value. */
export async function updateProfileDetails(changes) {
  const cur = await getCurrentUser();
  const d = { ...cur, ...changes };
  // never pretend to save what the database can't store yet: tell the admin which update is missing
  const lvl = cur?.dbLevel ?? 14;
  if (lvl < 14 && (d.setups || []).length > 1) throw new StoreError('error.dbUpdateSetups');
  if (lvl < 13 && ['growdiaries', 'youtube', 'tiktok', 'threads'].some((k) => changes[k])) throw new StoreError('error.dbUpdateLinks');
  if (lvl < 12 && (d.growSetup === 'growbox' || d.spaceSize === 'custom' || (Array.isArray(d.growStyle) && d.growStyle.length > 1)
    || (d.setups || []).some((s) => s.type === 'growbox' || s.spaceSize === 'custom'))) throw new StoreError('error.dbUpdateBasics');
  const styles = Array.isArray(d.growStyle) ? d.growStyle : d.growStyle ? [d.growStyle] : [];
  const custom = d.spaceSize === 'custom';
  const payload = {
    instagram: d.instagram || '', grow_setup: d.growSetup || '', lights: d.lights || '', medium: d.medium || '',
    fav_strain: d.favStrain || '', bio: d.bio || '', experience: d.experience || '', grow_style: styles,
    seed_type: d.seedType || '', training: d.training || [], space_size: d.spaceSize || '', grow_stage: d.growStage || '',
    flavours: d.flavours || [], breeder: d.breeder || '', accent: d.accent || '',
    space_w: custom ? d.spaceW : null, space_d: custom ? d.spaceD : null,
    space_h_min: custom ? d.spaceHMin : null, space_h_max: custom ? d.spaceHMax : null,
    growdiaries: d.growdiaries || '', youtube: d.youtube || '', tiktok: d.tiktok || '', threads: d.threads || '',
    setups: (d.setups || []).map(toDb),
  };
  let { error: e2 } = await sb.rpc('save_profile', { p: payload });
  if (e2?.code === '23514' && /grow_setup|grow_style|space_/.test(e2.message || '')) {
    // database update 012 not run yet: save in the older shape (one grow style, no growbox, no custom size)
    ({ error: e2 } = await sb.rpc('save_profile', { p: { ...payload, grow_style: styles[0] || '',
      grow_setup: payload.grow_setup === 'growbox' ? '' : payload.grow_setup, space_size: custom ? 'other' : payload.space_size } }));
  }
  if (!e2) { profileCache = null; return; }
  if (e2.code === '23514') throw new StoreError((e2.message || '').includes('instagram') ? 'error.instagramInvalid' : 'error.profileInvalid');
  // before database update 011: only the older fields can be saved
  const { error } = await sb.rpc('update_profile_details', {
    p_instagram: d.instagram ?? '', p_grow_setup: d.growSetup ?? '', p_lights: d.lights ?? '',
    p_medium: d.medium ?? '', p_fav_strain: d.favStrain ?? '', p_bio: d.bio ?? '',
  });
  if (error) {
    if (error.code === '23514') throw new StoreError((error.message || '').includes('instagram') ? 'error.instagramInvalid' : 'error.profileInvalid');
    fail(error);
  }
  profileCache = null;
}

/** Anyone's public profile (no email). key = profile name or account id. */
export async function getPublicProfile(key) {
  const { data, error } = await sb.rpc('get_public_profile', { p_key: key });
  if (error) fail(error);
  if (!data) return null;
  return {
    id: data.id, isMe: !!data.is_me, username: data.username, displayName: data.display_name,
    instagram: data.instagram, avatar: data.avatar, memberSince: data.member_since,
    growSetup: data.grow_setup, lights: data.lights, medium: data.medium, favStrain: data.fav_strain, bio: data.bio,
    nameChangedAt: data.name_changed_at, badges: data.badges || [], stats: data.stats || {},
    ...profileOptions(data),
    history: (data.history || []).map((h) => ({
      entryId: h.entry_id, battleId: h.battle_id, number: h.number, theme: { de: h.theme_de, en: h.theme_en },
      photoUrl: publicUrl(h.photo_path), strain: h.strain, votes: h.votes, place: h.place, ended: h.ended,
    })),
  };
}

// ---------- Admin: suspicious votes ----------

export async function getVoteReport(battleId) {
  const { data, error } = await sb.rpc('admin_vote_report', { p_battle: battleId });
  if (error) fail(error);
  return data.map((r) => ({
    entryId: r.entry_id, displayName: r.username || r.display_name, votes: r.votes, newAccountVotes: r.new_account_votes,
    maxSameNetwork: r.max_same_network, maxSameDevice: r.max_same_device, flagged: r.flagged,
  }));
}

export async function getEntryVotes(entryId) {
  const { data, error } = await sb.rpc('admin_entry_votes', { p_entry: entryId });
  if (error) fail(error);
  return data.map((r) => ({
    voterId: r.voter_id, voterName: r.voter_name, votedAt: r.voted_at, ageHours: r.voter_age_hours,
    sameNetwork: r.same_network_votes, sameDevice: r.same_device_votes,
  }));
}

export async function cancelVote(battleId, voterId, reason) {
  const { error } = await sb.rpc('admin_cancel_vote', { p_battle: battleId, p_voter: voterId, p_reason: reason || '' });
  if (error) fail(error);
}

// ---------- Strain Match: strain info list (database update 011) ----------
let strainCache;
export async function getStrains() {
  if (!strainCache) {
    const { data, error } = await sb.from('strains').select('*').order('name');
    // database list with breeders (update 015) → use it; older/missing table → built-in list
    if (!error && data?.length && data.some((r) => r.breeder)) strainCache = data;
    else strainCache = (await (await fetch('data/strains.json')).json()).strains.filter((x) => x.active !== false);
  }
  return strainCache;
}


// ---------- Reports (underage / fake / spam) ----------

const REPORT_ERRORS = {
  login_required: 'report.loginFirst', cannot_report_self: 'report.self', rate_limited: 'error.rateLimit', invalid_reason: 'report.pickReason',
};

/** Report a profile (userId) or an entry (entryId). Each person reports the same thing only once. */
export async function reportContent({ userId = null, entryId = null, reason, note = '' }) {
  const { error } = await sb.rpc('report_content', { p_user: userId, p_entry: entryId, p_reason: reason, p_note: note || null });
  if (error) {
    const hit = Object.keys(REPORT_ERRORS).find((c) => (error.message || '').includes(c));
    if (hit) throw new StoreError(REPORT_ERRORS[hit]);
    fail(error);
  }
}

/** Admin: all reports, open ones first. */
export async function getReports() {
  const { data, error } = await sb.rpc('admin_reports');
  if (error) fail(error);
  return (data || []).map((r) => ({
    id: r.id, reason: r.reason, note: r.note, status: r.status, createdAt: r.created_at, reporter: r.reporter,
    targetId: r.target_id, target: r.target, entryId: r.entry_id, battleId: r.battle_id,
    photoUrl: r.photo_path ? publicUrl(r.photo_path) : null, targetOpen: r.target_open,
  }));
}

export async function setReportStatus(id, status) {
  const { error } = await sb.rpc('admin_set_report', { p_id: id, p_status: status });
  if (error) fail(error);
}

// ---------- Profile look (background + underbanner) ----------

const LOOK_BUCKET = 'profile-images';

/** Address of an own uploaded profile picture (path = '<member id>/<file>'). */
export function profileImageUrl(path) {
  return sb.storage.from(LOOK_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Anyone's look: { bg, banner, xmas }. Before database update 017: nothing chosen, Christmas on. */
export async function getProfileLook(key) {
  const { data, error } = await sb.rpc('get_profile_look', { p_key: key });
  if (error || !data) return { bg: '', banner: '', xmas: true };
  return { bg: data.bg || '', banner: data.banner || '', xmas: data.xmas !== false };
}

/** Uploads an own picture (already compressed) and returns its stored value 'u:<path>'. */
export async function uploadProfileImage(kind, blob, ext) {
  const me = await getCurrentUser();
  if (!me) throw new StoreError('vote.loginNeeded');
  const path = `${me.id}/${kind}-${Date.now().toString(36)}.${ext}`;
  const { error } = await sb.storage.from(LOOK_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) {
    if (/bucket not found/i.test(error.message || '')) throw new StoreError('error.dbUpdateLook');
    if (/exceeded|too large|payload/i.test(error.message || '')) throw new StoreError('error.photoTooBig', { max: 1 });
    fail(error);
  }
  return `u:${path}`;
}

/** Saves the look; own uploads that are no longer used are deleted. */
export async function saveProfileLook({ bg = '', banner = '', xmas = true }, previous = {}) {
  const { error } = await sb.rpc('save_profile_look', { p_bg: bg, p_banner: banner, p_xmas: xmas });
  if (error) {
    if (error.code === 'PGRST202' || /save_profile_look/.test(error.message || '')) throw new StoreError('error.dbUpdateLook');
    if (/look_invalid/.test(error.message || '')) throw new StoreError('error.profileInvalid');
    if (/needs_approval/.test(error.message || '')) throw new StoreError('look.needsApproval');
    fail(error);
  }
  const unused = [previous.bg, previous.banner].filter((v) => v?.startsWith('u:') && v !== bg && v !== banner).map((v) => v.slice(2));
  if (unused.length) sb.storage.from(LOOK_BUCKET).remove(unused).then(() => {}, () => {});
}

// ---------- Own profile pictures: approval by an admin ----------

/** Sends an uploaded picture ('u:<path>') for approval; a picture it replaces is deleted. */
export async function submitProfileImage(kind, value) {
  const { data, error } = await sb.rpc('submit_profile_image', { p_kind: kind, p_value: value });
  if (error) {
    if (error.code === 'PGRST202' || /submit_profile_image/.test(error.message || '')) throw new StoreError('error.dbUpdateApproval');
    fail(error);
  }
  if (data) sb.storage.from(LOOK_BUCKET).remove([data]).then(() => {}, () => {});
}

/** Own latest review per kind: [{ id, kind, path, status: 'pending'|'approved'|'rejected', seen }]. */
export async function getMyImageReviews() {
  const { data, error } = await sb.rpc('my_image_reviews');
  return error ? [] : data || [];
}

export async function ackImageReview(id) {
  await sb.rpc('ack_image_review', { p_id: id });
}

/** Admin: uploaded profile pictures (last 60 days), newest first. */
export async function getImageReviews() {
  const { data, error } = await sb.rpc('admin_image_reviews');
  if (error) fail(error);
  return (data || []).map((r) => ({ id: r.id, kind: r.kind, path: r.path, status: r.status, createdAt: r.created_at,
    userId: r.user_id, username: r.username, url: profileImageUrl(r.path) }));
}

/** Admin: approve (goes live) or reject (file deleted, the member gets a note). */
export async function reviewImage(id, status) {
  const { data, error } = await sb.rpc('admin_review_image', { p_id: id, p_status: status });
  if (error) fail(error);
  const remove = [status === 'rejected' ? data?.path : null, data?.replaced].filter(Boolean);
  if (remove.length) await sb.storage.from(LOOK_BUCKET).remove(remove).catch(() => {});
}

// ---------- BudPoints + game badges (database updates 019 + 021; rules in js/budpoints-config.js) ----------
// Every call returns { budPoints, tossEarned, windowUsed, windowMax, windowResetAt, shopUnlocked,
//   done: { profileComplete, profileVisual }, granted, newBadges: [ids], gameSeconds, loginDays }.
// The database checks every limit and condition.
// TODO (real launch): Banana Toss throws are still reported by the browser – add server-side checks against cheating.
async function gameRpc(fn, args) {
  const { data, error } = await sb.rpc(fn, args || {});
  if (error) fail(error);
  if (profileCache && data?.newBadges?.length) profileCache.badges = [...new Set([...profileCache.badges, ...data.newBadges])];
  if (profileCache && fn === 'game_demo_reset') profileCache.badges = profileCache.badges.filter((b) => !DEMO_BADGES.includes(b));
  return data;
}
export const gameTossThrow = ({ meters, rings, combo }) => gameRpc('game_toss_throw', { p_meters: Number(meters) || 0, p_rings: rings | 0, p_combo: combo === true });
export const gameAward = (kind, ref = '') => gameRpc('game_award', { p_kind: kind, p_ref: String(ref || '') });
export const gameBuyBadge = (badgeId) => gameRpc('game_buy_badge', { p_badge: badgeId });
export const gameAddSeconds = (seconds) => gameRpc('game_add_seconds', { p_seconds: seconds });
export const gameLoginDay = () => gameRpc('game_login_day');
export const gameMyStats = () => gameRpc('game_my_stats');
export const gameSyncConfig = async (cfg) => { const { error } = await sb.rpc('game_sync_config', { p_cfg: cfg }); if (error) fail(error); };
export const gameDemoAddToss = (points) => gameRpc('game_demo_add_toss', { p_points: points });
export const gameDemoSetLoginDays = (days) => gameRpc('game_demo_set_login_days', { p_days: days });
export const gameDemoNextLoginDay = () => gameRpc('game_demo_next_login_day');
export const gameDemoReset = () => gameRpc('game_demo_reset');

// ---------- Admin: entry for a grower who doesn't use the app (database update 023) ----------
/** ({ battleId, handle, strain, breeder, photo, width, height }) → entry id. Shown with the @handle, approved straight away. */
export async function adminAddEntry({ battleId, handle, strain, breeder, photo, width, height }) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) throw new StoreError('admin.noAccess');
  const path = `${user.id}/guest-${crypto.randomUUID()}.jpg`;
  const up = await sb.storage.from(BUCKET).upload(path, photo, { contentType: 'image/jpeg', upsert: false });
  if (up.error) fail(up.error);
  const { data, error } = await sb.rpc('admin_add_entry', {
    p_battle: battleId, p_handle: handle, p_strain: strain || null, p_breeder: breeder || null,
    p_photo_path: path, p_width: width, p_height: height,
  });
  if (error) {
    await sb.storage.from(BUCKET).remove([path]);
    if (/already entered/.test(error.message)) throw new StoreError('guest.already');
    if (/instagram handle/.test(error.message)) throw new StoreError('guest.badHandle');
    fail(error);
  }
  return data;
}
