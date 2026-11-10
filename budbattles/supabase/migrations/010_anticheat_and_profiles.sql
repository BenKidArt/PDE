-- =====================================================================
-- BudBattles update 010: anti-cheat voting + profile names + big profiles
-- Paste into Supabase → SQL Editor → New query → Run. Run it once,
-- after updates 004–009. Battle #1 is not changed.
-- =====================================================================

do $$
begin
  if to_regprocedure('public.award_place_badges(text)') is null then
    raise exception 'Please run updates 004, 005 and 009 first, then this one.';
  end if;
end $$;

-- Lets the database ask Cloudflare whether a vote came from a human (Turnstile)
create extension if not exists http with schema extensions;

-- ---------- Settings you can change in the Table Editor (settings table) ----------
alter table public.settings
  add column if not exists min_account_age_hours int not null default 24,   -- account must be this old to vote
  add column if not exists votes_per_ip_per_hour int not null default 10,   -- votes from one network per hour
  add column if not exists votes_per_device_per_battle int not null default 3,
  add column if not exists accounts_per_device int not null default 3;

-- ---------- Profile name, Instagram, picture slot, grow setup ----------
alter table public.profiles
  add column if not exists username text,
  add column if not exists username_changed_at timestamptz,
  add column if not exists instagram text,
  add column if not exists avatar text,          -- later: a badge/character id; empty = default BB avatar
  add column if not exists grow_setup text,
  add column if not exists lights text,
  add column if not exists medium text,
  add column if not exists fav_strain text,
  add column if not exists bio text;
alter table public.profiles
  add constraint username_format check (username is null or username ~ '^[A-Za-z0-9_]{3,20}$'),
  add constraint instagram_format check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  add constraint grow_setup_values check (grow_setup is null or grow_setup in ('zelt', 'raum', 'outdoor', 'gewaechshaus', 'balkon')),
  add constraint medium_values check (medium is null or medium in ('erde', 'coco', 'hydro', 'andere')),
  add constraint lights_length check (lights is null or char_length(lights) <= 40),
  add constraint fav_strain_length check (fav_strain is null or char_length(fav_strain) <= 40),
  add constraint bio_length check (bio is null or char_length(bio) <= 150);
create unique index if not exists profiles_username_unique on public.profiles (lower(username));

-- Words that may not appear in a profile name. Add more in the Table Editor.
create table if not exists public.blocked_words (word text primary key check (word = lower(word)));
alter table public.blocked_words enable row level security;   -- nobody reads it directly
insert into public.blocked_words (word) values
  ('fuck'), ('shit'), ('cunt'), ('bitch'), ('whore'), ('nazi'), ('hitler'), ('heil'), ('ss_'),
  ('nigg'), ('neger'), ('kanake'), ('fotze'), ('hure'), ('nutte'), ('wichser'), ('schlampe'),
  ('spast'), ('missgeburt'), ('arschloch'), ('hurensohn'), ('admin'), ('budbattles'), ('moderator'),
  ('dealer'), ('verkauf'), ('kaufen'), ('sale')
on conflict do nothing;

create or replace function public.profile_name_status(p_name text, p_self uuid default null)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p_name is null or p_name !~ '^[A-Za-z0-9_]{3,20}$' then 'invalid'
    when exists (select 1 from public.blocked_words w where position(w.word in lower(p_name)) > 0) then 'blocked'
    when exists (select 1 from public.profiles p where lower(p.username) = lower(p_name)
                 and p.id is distinct from p_self) then 'taken'
    else 'ok' end
$$;

-- For the sign-up form: is this name free? ('ok' | 'invalid' | 'blocked' | 'taken')
create or replace function public.profile_name_available(p_name text)
returns text language sql stable security definer set search_path = public as $$
  select public.profile_name_status(p_name, auth.uid())
$$;

-- Choose / change the profile name (max once every 30 days)
create or replace function public.set_profile_name(p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  st text;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then raise exception 'login_required'; end if;
  st := public.profile_name_status(p_name, me.id);
  if st <> 'ok' then raise exception 'name_%', st; end if;
  if me.username is not null and lower(me.username) = lower(p_name) then
    update public.profiles set username = p_name, display_name = p_name where id = me.id;  -- only upper/lower case
    return p_name;
  end if;
  if me.username_changed_at is not null and me.username_changed_at > now() - interval '30 days' then
    raise exception 'name_change_too_soon';
  end if;
  update public.profiles
  set username = p_name, display_name = p_name, username_changed_at = now()
  where id = me.id;
  return p_name;
end $$;

-- Instagram, grow setup and the short profile fields
create or replace function public.update_profile_details(
  p_instagram text, p_grow_setup text, p_lights text, p_medium text, p_fav_strain text, p_bio text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  update public.profiles set
    instagram  = nullif(regexp_replace(trim(coalesce(p_instagram, '')), '^@', ''), ''),
    grow_setup = nullif(p_grow_setup, ''),
    lights     = nullif(trim(coalesce(p_lights, '')), ''),
    medium     = nullif(p_medium, ''),
    fav_strain = nullif(trim(coalesce(p_fav_strain, '')), ''),
    bio        = nullif(trim(coalesce(p_bio, '')), '')
  where id = auth.uid();
end $$;

-- Names only change through set_profile_name now (rules above)
revoke update on public.profiles from authenticated;

-- New sign-ups: the name from the form becomes the profile name if it is valid and free
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  wanted text := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Grower'), 40);
begin
  if coalesce((new.raw_user_meta_data ->> 'age_confirmed')::boolean, false) is not true then
    raise exception 'age_confirmation_required';
  end if;
  if coalesce(new.raw_user_meta_data ->> 'terms_version', '') = '' then
    raise exception 'terms_acceptance_required';
  end if;
  insert into public.profiles (id, display_name, age_confirmed_at, terms_accepted_at, terms_version,
                               username, username_changed_at)
  values (new.id, wanted, now(), now(), new.raw_user_meta_data ->> 'terms_version',
          case when public.profile_name_status(wanted, null) = 'ok' then wanted end,
          case when public.profile_name_status(wanted, null) = 'ok' then now() end);
  insert into public.user_badges (user_id, badge_id, source) values (new.id, 'badge_star', 'auto')
    on conflict do nothing;
  return new;
end $$;

-- ---------- Devices and networks (stored only as scrambled fingerprints) ----------
create or replace function public.fingerprint(p_value text)
returns text language sql immutable as $$
  select case when nullif(trim(p_value), '') is null then null
              else encode(sha256(convert_to('budbattles:' || trim(p_value), 'UTF8')), 'hex') end
$$;

create or replace function public.request_ip()
returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip',
    split_part(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ',', 1),
    nullif(current_setting('request.headers', true), '')::json ->> 'x-real-ip')
$$;

create table if not exists public.user_devices (
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_hash text not null,
  ip_hash text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (user_id, device_hash)
);
alter table public.user_devices enable row level security;   -- admins read it through the report functions

create or replace function public.register_device(p_device text)
returns void language sql security definer set search_path = public as $$
  insert into public.user_devices (user_id, device_hash, ip_hash)
  select auth.uid(), public.fingerprint(p_device), public.fingerprint(public.request_ip())
  where auth.uid() is not null and public.fingerprint(p_device) is not null
  on conflict (user_id, device_hash) do update
    set last_seen = now(), ip_hash = coalesce(excluded.ip_hash, public.user_devices.ip_hash)
$$;

-- For the sign-up form: how many accounts already used this device?
create or replace function public.device_account_count(p_device text)
returns int language sql stable security definer set search_path = public as $$
  select count(distinct user_id)::int from public.user_devices where device_hash = public.fingerprint(p_device)
$$;

-- ---------- Voting only through cast_vote() with all checks ----------
alter table public.votes
  add column if not exists ip_hash text,
  add column if not exists device_hash text,
  add column if not exists voter_age_hours int;

create table if not exists public.cancelled_votes (
  battle_id text not null references public.battles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  entry_id uuid,
  reason text,
  cancelled_by uuid,
  cancelled_at timestamptz not null default now(),
  primary key (battle_id, user_id)
);
alter table public.cancelled_votes enable row level security;

drop policy if exists "vote during voting" on public.votes;
revoke insert on public.votes from authenticated;

create or replace function public.cast_vote(p_battle text, p_entry uuid, p_token text, p_device text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  cfg public.settings;
  acct record;
  age_h int;
  ip text := public.fingerprint(public.request_ip());
  dev text := public.fingerprint(p_device);
  secret text;
  resp record;
begin
  if me is null then raise exception 'login_required'; end if;
  select * into cfg from public.settings where id = 1;

  if not exists (select 1 from public.battles b where b.id = p_battle
                 and now() >= b.entries_close_at and now() < b.voting_ends_at
                 and (not b.is_test or public.can_test())) then
    raise exception 'voting_closed';
  end if;
  if not exists (select 1 from public.entries e where e.id = p_entry and e.battle_id = p_battle
                 and e.status = 'approved' and e.user_id <> me) then
    raise exception 'invalid_entry';
  end if;
  if exists (select 1 from public.votes v where v.battle_id = p_battle and v.user_id = me) then
    raise exception 'already_voted';
  end if;
  if exists (select 1 from public.cancelled_votes c where c.battle_id = p_battle and c.user_id = me) then
    raise exception 'vote_cancelled';
  end if;

  -- email confirmed + account old enough
  select email_confirmed_at, created_at into acct from auth.users where id = me;
  if acct.email_confirmed_at is null then raise exception 'email_not_confirmed'; end if;
  age_h := floor(extract(epoch from now() - acct.created_at) / 3600);
  if age_h < cfg.min_account_age_hours then raise exception 'account_too_new'; end if;

  -- device / network limits
  if dev is not null and (select count(distinct d.user_id) from public.user_devices d
                          where d.device_hash = dev and d.user_id <> me) >= cfg.accounts_per_device then
    raise exception 'too_many_accounts';
  end if;
  if ip is not null and (select count(*) from public.votes v
                         where v.ip_hash = ip and v.created_at > now() - interval '1 hour') >= cfg.votes_per_ip_per_hour then
    raise exception 'rate_limited';
  end if;
  if dev is not null and (select count(*) from public.votes v
                          where v.device_hash = dev and v.battle_id = p_battle) >= cfg.votes_per_device_per_battle then
    raise exception 'rate_limited';
  end if;

  -- Turnstile bot check (only once the secret is saved in Supabase Vault as "turnstile_secret")
  begin
    select decrypted_secret into secret from vault.decrypted_secrets where name = 'turnstile_secret' limit 1;
  exception when others then secret := null;
  end;
  if secret is not null then
    if coalesce(p_token, '') = '' then raise exception 'bot_check_failed'; end if;
    select * into resp from extensions.http_post(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      'secret=' || extensions.urlencode(secret) || '&response=' || extensions.urlencode(p_token),
      'application/x-www-form-urlencoded');
    if resp.status <> 200 or coalesce((resp.content::json ->> 'success')::boolean, false) is not true then
      raise exception 'bot_check_failed';
    end if;
  end if;

  insert into public.votes (battle_id, user_id, entry_id, ip_hash, device_hash, voter_age_hours)
  values (p_battle, me, p_entry, ip, dev, age_h);
  if dev is not null then
    insert into public.user_devices (user_id, device_hash, ip_hash) values (me, dev, ip)
    on conflict (user_id, device_hash) do update set last_seen = now();
  end if;
end $$;

-- ---------- Admin: suspicious votes ----------
-- Per entry: votes, votes from accounts younger than 3 days, biggest group of votes
-- from one network / one device. "flagged" = worth a look.
create or replace function public.admin_vote_report(p_battle text)
returns table (entry_id uuid, display_name text, username text, votes int, new_account_votes int,
               max_same_network int, max_same_device int, flagged boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
  with v as (select * from public.votes where battle_id = p_battle),
  per_entry as (
    select e.id, p.display_name, p.username,
      (select count(*) from v where v.entry_id = e.id)::int as votes,
      (select count(*) from v where v.entry_id = e.id and v.voter_age_hours < 72)::int as new_votes,
      coalesce((select max(c) from (select count(*) c from v where v.entry_id = e.id and v.ip_hash is not null group by v.ip_hash) x), 0)::int as net,
      coalesce((select max(c) from (select count(*) c from v where v.entry_id = e.id and v.device_hash is not null group by v.device_hash) x), 0)::int as dev
    from public.entries e join public.profiles p on p.id = e.user_id
    where e.battle_id = p_battle and e.status = 'approved'
  )
  select pe.id, pe.display_name, pe.username, pe.votes, pe.new_votes, pe.net, pe.dev,
         (pe.new_votes >= 3 or (pe.votes >= 5 and pe.new_votes * 100 >= pe.votes * 40) or pe.net >= 3 or pe.dev >= 2)
  from per_entry pe
  order by 8 desc, pe.votes desc;
end $$;

-- The single votes of one entry (never emails)
create or replace function public.admin_entry_votes(p_entry uuid)
returns table (voter_id uuid, voter_name text, voted_at timestamptz, voter_age_hours int,
               same_network_votes int, same_device_votes int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
  select v.user_id, coalesce(p.username, p.display_name), v.created_at, v.voter_age_hours,
         (select count(*) from public.votes x where x.battle_id = v.battle_id and x.ip_hash = v.ip_hash)::int,
         (select count(*) from public.votes x where x.battle_id = v.battle_id and x.device_hash = v.device_hash)::int
  from public.votes v join public.profiles p on p.id = v.user_id
  where v.entry_id = p_entry
  order by v.created_at;
end $$;

-- Cancel one vote. That member cannot vote again in this battle.
create or replace function public.admin_cancel_vote(p_battle text, p_voter uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  old_entry uuid;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  delete from public.votes where battle_id = p_battle and user_id = p_voter returning entry_id into old_entry;
  if old_entry is null then raise exception 'vote_not_found'; end if;
  insert into public.cancelled_votes (battle_id, user_id, entry_id, reason, cancelled_by)
  values (p_battle, p_voter, old_entry, left(p_reason, 200), auth.uid())
  on conflict (battle_id, user_id) do nothing;
end $$;

-- ---------- Standings: profile name, Instagram, picture + link to the profile ----------
drop function if exists public.get_standings(text);
create function public.get_standings(p_battle text)
returns table (entry_id uuid, photo_path text, width int, height int, strain text,
               description text, display_name text, votes int, is_mine boolean,
               created_at timestamptz, badges text[], username text, instagram text,
               avatar text, profile_key text)
language sql stable security definer set search_path = public as $$
  select e.id, e.photo_path, e.width, e.height, e.strain, e.description, coalesce(p.username, p.display_name),
         (select count(*)::int from public.votes v where v.entry_id = e.id) as votes,
         coalesce(e.user_id = auth.uid(), false), e.created_at,
         coalesce((select array_agg(ub.badge_id order by bd.sort, ub.awarded_at)
                   from public.user_badges ub join public.badges bd on bd.id = ub.badge_id
                   where ub.user_id = e.user_id and bd.active), '{}'),
         p.username, p.instagram, p.avatar, coalesce(p.username, p.id::text)
  from public.entries e
  join public.profiles p on p.id = e.user_id
  join public.battles b on b.id = e.battle_id
  where e.battle_id = p_battle and e.status = 'approved'
    and (not b.is_test or public.can_test())
  order by votes desc, e.created_at asc
$$;
revoke execute on function public.get_standings(text) from public;
grant execute on function public.get_standings(text) to anon, authenticated;

-- ---------- Public profile (never the email) ----------
create or replace function public.get_public_profile(p_key text)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  p public.profiles;
  result json;
begin
  select * into p from public.profiles
  where lower(username) = lower(p_key) or id::text = p_key
  limit 1;
  if not found then return null; end if;

  with my_entries as (
    select e.id, e.battle_id, e.photo_path, e.strain, e.created_at, b.number, b.theme_de, b.theme_en,
           b.entries_close_at, b.voting_ends_at,
           (select count(*) from public.votes v where v.entry_id = e.id)::int as votes
    from public.entries e join public.battles b on b.id = e.battle_id
    where e.user_id = p.id and e.status = 'approved' and not b.is_test
  ),
  placed as (
    select m.*,
      case when now() >= m.entries_close_at then
        (select count(distinct x.c) + 1 from (
           select (select count(*) from public.votes v where v.entry_id = o.id) c
           from public.entries o where o.battle_id = m.battle_id and o.status = 'approved') x
         where x.c > m.votes)::int end as place
    from my_entries m
  )
  select json_build_object(
    'id', p.id,
    'is_me', coalesce(p.id = auth.uid(), false),
    'username', p.username,
    'display_name', coalesce(p.username, p.display_name),
    'instagram', p.instagram,
    'avatar', p.avatar,
    'member_since', p.created_at,
    'grow_setup', p.grow_setup, 'lights', p.lights, 'medium', p.medium,
    'fav_strain', p.fav_strain, 'bio', p.bio,
    'name_changed_at', case when p.id = auth.uid() then p.username_changed_at end,
    'badges', coalesce((select json_agg(ub.badge_id order by bd.sort, ub.awarded_at)
                        from public.user_badges ub join public.badges bd on bd.id = ub.badge_id
                        where ub.user_id = p.id and bd.active), '[]'::json),
    'stats', json_build_object(
      'battles', (select count(distinct battle_id) from my_entries),
      'best_place', (select min(place) from placed where now() >= voting_ends_at),
      'votes_given', (select count(*) from public.votes v join public.battles b on b.id = v.battle_id
                      where v.user_id = p.id and not b.is_test)),
    'history', coalesce((select json_agg(json_build_object(
        'entry_id', id, 'battle_id', battle_id, 'number', number, 'theme_de', theme_de, 'theme_en', theme_en,
        'photo_path', photo_path, 'strain', strain, 'votes', votes, 'place', place,
        'ended', now() >= voting_ends_at) order by created_at desc) from placed), '[]'::json)
  ) into result;
  return result;
end $$;

-- ---------- Who may call what ----------
revoke execute on function public.profile_name_status(text, uuid), public.profile_name_available(text),
  public.set_profile_name(text), public.update_profile_details(text, text, text, text, text, text),
  public.register_device(text), public.device_account_count(text),
  public.cast_vote(text, uuid, text, text), public.admin_vote_report(text), public.admin_entry_votes(uuid),
  public.admin_cancel_vote(text, uuid, text), public.get_public_profile(text) from public;
grant execute on function public.profile_name_available(text), public.device_account_count(text),
  public.get_public_profile(text) to anon, authenticated;
grant execute on function public.set_profile_name(text), public.update_profile_details(text, text, text, text, text, text),
  public.register_device(text), public.cast_vote(text, uuid, text, text),
  public.admin_vote_report(text), public.admin_entry_votes(uuid), public.admin_cancel_vote(text, uuid, text)
  to authenticated;

-- Existing members choose their profile name in the app (one-time popup on next login).
