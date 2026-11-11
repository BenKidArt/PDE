// REAL data layer: Supabase (database, photo storage and login), servers in Frankfurt.
import { CONFIG } from './config.js';
import { getDeviceId } from './device.js';
import { StoreError, withRanks, toBadge } from './shared.js';

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
    number: r.number,
    isTest: !!r.is_test, // hidden test battle: the database only shows it to admins
    theme: { de: r.theme_de, en: r.theme_en },
    summary: { de: r.summary_de, en: r.summary_en },
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
    sb.from('profiles').select('display_name, is_admin, is_tester, username, username_changed_at, instagram, avatar, grow_setup, lights, medium, fav_strain, bio, created_at, experience, grow_style, seed_type, training, space_size, grow_stage, flavours, breeder, accent, space_w, space_d, space_h_min, space_h_max, growdiaries, youtube, tiktok, threads').eq('id', session.user.id).maybeSingle(),
    sb.from('user_badges').select('badge_id').eq('user_id', session.user.id),
  ]);
  if (error) {
    // Safety net: database update 013 not run yet → load without the profile links.
    ({ data, error } = await sb.from('profiles').select('display_name, is_admin, is_tester, username, username_changed_at, instagram, avatar, grow_setup, lights, medium, fav_strain, bio, created_at, experience, grow_style, seed_type, training, space_size, grow_stage, flavours, breeder, accent, space_w, space_d, space_h_min, space_h_max').eq('id', session.user.id).maybeSingle());
  }
  if (error) {
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
  };
  sb.rpc('register_device', { p_device: getDeviceId() }).then(() => {}, () => {}); // for the anti-cheat limits
  return profileCache;
}

export function onAuthEvent(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const backHere = () => location.origin + location.pathname;

export async function signUp({ email, password, displayName, ageConfirmed, termsAccepted, captchaToken }) {
  if (!ageConfirmed) throw new StoreError('error.ageRequired');
  if (!termsAccepted) throw new StoreError('error.termsRequired');
  const devCount = await sb.rpc('device_account_count', { p_device: getDeviceId() });
  if (!devCount.error && devCount.data >= CONFIG.accountsPerDevice) throw new StoreError('error.tooManyAccounts');
  const { data, error } = await sb.auth.signUp({
    email: email.trim(),
    password,
    options: {
      captchaToken: captchaToken || undefined,
      emailRedirectTo: backHere(),
      data: { display_name: displayName.trim(), age_confirmed: true, terms_version: CONFIG.termsVersion },
    },
  });
  if (error) fail(error);
  return { needsConfirmation: !data.session };
}

export async function signIn({ email, password, captchaToken }) {
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password, options: { captchaToken: captchaToken || undefined } });
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
  let { data, error } = await sb.from('entries').select('*, profiles(display_name, username, instagram, avatar)')
    .eq('battle_id', battleId).order('created_at', { ascending: true });
  if (error) { // before database update 010
    ({ data, error } = await sb.from('entries').select('*, profiles(display_name)').eq('battle_id', battleId).order('created_at', { ascending: true }));
  }
  if (error) fail(error);
  return data.map((r) => ({
    ...toEntry(r),
    displayName: r.profiles?.username || r.profiles?.display_name || '?',
    username: r.profiles?.username ?? null,
    instagram: r.profiles?.instagram ?? null,
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
    profileKey: r.profile_key ?? null, // opens #/u/<key>
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
    training: r?.training || [], spaceSize: r?.space_size ?? null, growStage: r?.grow_stage ?? null,
    flavours: r?.flavours || [], breeder: r?.breeder ?? null, accent: r?.accent ?? null,
  };
}

/** Saves profile fields. Fields not given keep their current value. */
export async function updateProfileDetails(changes) {
  const cur = await getCurrentUser();
  const d = { ...cur, ...changes };
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
    if (!error && data?.length) strainCache = data;
    else strainCache = (await (await fetch('data/strains.json')).json()).strains; // before update 011
  }
  return strainCache;
}

