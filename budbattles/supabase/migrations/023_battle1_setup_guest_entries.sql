-- =====================================================================
-- BudBattles update 023: Battle #1 setup + entries added by an admin for
-- growers who don't use the app ("guest entries")
-- Paste into Supabase → SQL Editor → New query → Run. Run once. Safe to run again.
--
--   1) Battle #1 "Frostiest Bud" times (Finnish time, Europe/Helsinki):
--      entries open Sun 22.11 00:00 · entries close 29.11 23:59 · voting until 6.12 23:59
--   2) Prize text (members only): winner gets a pack of 5 seeds from Cannapot
--   3) Entries get an optional breeder / seed bank
--   4) Guest entries: no app account, shown with the Instagram @handle. They are
--      voted on like any other entry; badges only go to growers with an account.
-- Existing entries and votes are not changed.
-- =====================================================================

-- ---------- 1) Battle #1 times ----------
update public.battles set
  start_at = timestamptz '2026-11-22 00:00 Europe/Helsinki',
  entries_close_at = timestamptz '2026-11-29 23:59 Europe/Helsinki',
  voting_ends_at = timestamptz '2026-12-06 23:59 Europe/Helsinki'
where id = 'battle-1-frostiest-bud';

-- ---------- 2) prize (only members can read battle_prizes) ----------
insert into public.battle_prizes (battle_id, prize_de, prize_en)
values ('battle-1-frostiest-bud', 'Der Gewinner bekommt eine Packung mit 5 Samen von Cannapot.', 'The winner gets a pack of 5 seeds from Cannapot.')
on conflict (battle_id) do update set prize_de = excluded.prize_de, prize_en = excluded.prize_en;
update public.battles set partner_name = 'Cannapot', partner_logo_url = 'assets/partner-cannapot.webp'
where id = 'battle-1-frostiest-bud';

-- ---------- 3) + 4) entries: breeder, guest entries ----------
alter table public.entries add column if not exists breeder text;
alter table public.entries add column if not exists guest_handle text;
alter table public.entries add column if not exists added_by uuid; -- admin who added a guest entry (no link to profiles:
-- a second link from entries to profiles made the app's admin photo list fail)
alter table public.entries drop constraint if exists entries_added_by_fkey;
alter table public.entries alter column user_id drop not null;
do $$ begin
  alter table public.entries add constraint entries_breeder_len check (breeder is null or char_length(breeder) <= 60);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.entries add constraint entries_guest_handle_ok check (guest_handle is null or guest_handle ~ '^[A-Za-z0-9._]{1,30}$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.entries add constraint entries_has_owner check (user_id is not null or guest_handle is not null);
exception when duplicate_object then null; end $$;
-- one entry per Instagram handle per battle (accounts: the existing unique (battle_id, user_id))
create unique index if not exists entries_guest_once on public.entries (battle_id, lower(guest_handle)) where guest_handle is not null;

/** Admin: add an entry for a grower without the app. The photo is uploaded first (own folder). */
create or replace function public.admin_add_entry(p_battle text, p_handle text, p_strain text, p_breeder text,
  p_photo_path text, p_width int, p_height int) returns uuid
language plpgsql security definer set search_path = public as $$
declare h text := lower(trim(both '@ ' from coalesce(p_handle, ''))); new_id uuid;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if h !~ '^[a-z0-9._]{1,30}$' then raise exception 'invalid instagram handle'; end if;
  if not exists (select 1 from public.battles where id = p_battle and voting_ends_at > now()) then raise exception 'battle is over'; end if;
  if exists (select 1 from public.entries where battle_id = p_battle and lower(guest_handle) = h) then raise exception 'already entered'; end if;
  insert into public.entries (battle_id, user_id, guest_handle, added_by, photo_path, width, height, strain, breeder, description, status, reviewed_at)
  values (p_battle, null, h, auth.uid(), p_photo_path, p_width, p_height,
          nullif(trim(coalesce(p_strain, '')), ''), nullif(trim(coalesce(p_breeder, '')), ''), '', 'approved', now())
  returning id into new_id;
  return new_id;
end $$;
revoke execute on function public.admin_add_entry(text, text, text, text, text, int, int) from public, anon;
grant execute on function public.admin_add_entry(text, text, text, text, text, int, int) to authenticated;

-- standings: guests show as @handle (no profile page), breeder included
drop function if exists public.get_standings(text);
create function public.get_standings(p_battle text)
returns table (entry_id uuid, photo_path text, width int, height int, strain text,
               description text, display_name text, votes int, is_mine boolean,
               created_at timestamptz, badges text[], username text, instagram text,
               avatar text, profile_key text, breeder text, is_guest boolean)
language sql stable security definer set search_path = public as $$
  select e.id, e.photo_path, e.width, e.height, e.strain, e.description,
         coalesce(p.username, p.display_name, '@' || e.guest_handle),
         (select count(*)::int from public.votes v where v.entry_id = e.id) as votes,
         coalesce(e.user_id = auth.uid(), false), e.created_at,
         coalesce((select array_agg(ub.badge_id order by bd.sort, ub.awarded_at)
                   from public.user_badges ub join public.badges bd on bd.id = ub.badge_id
                   where ub.user_id = e.user_id and bd.active), '{}'),
         p.username, coalesce(p.instagram, e.guest_handle), p.avatar,
         case when p.id is null then null else coalesce(p.username, p.id::text) end,
         e.breeder, e.user_id is null
  from public.entries e
  left join public.profiles p on p.id = e.user_id
  join public.battles b on b.id = e.battle_id
  where e.battle_id = p_battle and e.status = 'approved'
    and (not b.is_test or public.can_test())
  order by votes desc, e.created_at asc
$$;
revoke execute on function public.get_standings(text) from public;
grant execute on function public.get_standings(text) to anon, authenticated;

create or replace function public.latest_entries(p_limit int default 6)
returns table (entry_id uuid, battle_id text, photo_path text, width int, height int,
               strain text, display_name text)
language sql stable security definer set search_path = public as $$
  select e.id, e.battle_id, e.photo_path, e.width, e.height, e.strain,
         coalesce(p.display_name, '@' || e.guest_handle)
  from public.entries e
  left join public.profiles p on p.id = e.user_id
  join public.battles b on b.id = e.battle_id
  where e.status = 'approved' and not b.is_test
  order by coalesce(e.reviewed_at, e.created_at) desc
  limit least(greatest(p_limit, 1), 24)
$$;

-- badges only for growers with an account (guest entries still count for the places)
create or replace function public.award_founding_member()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  place int;
begin
  if new.user_id is null then return new; end if;
  if new.status <> 'approved' or (tg_op = 'UPDATE' and old.status = 'approved') then
    return new;
  end if;
  if not exists (select 1 from public.battles b where b.id = new.battle_id and b.number = 1 and not b.is_test) then
    return new;
  end if;
  select count(*) into place
  from public.entries e
  where e.battle_id = new.battle_id and e.status <> 'rejected'
    and (e.created_at, e.id) <= (new.created_at, new.id);
  if place <= 25 then
    insert into public.user_badges (user_id, badge_id, source, battle_id)
    values (new.user_id, 'badge_heart', 'auto', new.battle_id)
    on conflict do nothing;
  end if;
  return new;
end $$;

create or replace function public.award_place_badges(p_battle text)
returns void language sql security definer set search_path = public as $$
  with counted as (
    select e.user_id, (select count(*) from public.votes v where v.entry_id = e.id) as votes
    from public.entries e
    where e.battle_id = p_battle and e.status = 'approved'
  ),
  ranked as (
    select user_id, votes, dense_rank() over (order by votes desc) as place from counted
  )
  insert into public.user_badges (user_id, badge_id, source, battle_id)
  select user_id,
         case place when 1 then 'badge_bulldog' when 2 then 'badge_rat' else 'badge_panda' end,
         'auto', p_battle
  from ranked
  where place <= 3 and votes > 0 and user_id is not null
  on conflict (user_id, badge_id) do update set battle_id = excluded.battle_id
    where public.user_badges.battle_id in (select id from public.battles where is_test)
      and excluded.battle_id in (select id from public.battles where not is_test)
$$;
revoke execute on function public.award_place_badges(text) from public;

create or replace function public.finalize_ended_battles()
returns int language plpgsql security definer set search_path = public as $$
declare
  b record;
  done int := 0;
begin
  for b in
    select id from public.battles
    where finalized_at is null and voting_ends_at <= now()
    for update skip locked
  loop
    perform public.award_place_badges(b.id);

    insert into public.champion_choices (battle_id, user_id)
    select b.id, ranked.user_id
    from (select e.user_id,
                 (select count(*) from public.votes v where v.entry_id = e.id) as votes,
                 rank() over (order by (select count(*) from public.votes v where v.entry_id = e.id) desc) as place
          from public.entries e
          where e.battle_id = b.id and e.status = 'approved') ranked
    where ranked.place = 1 and ranked.votes > 0 and ranked.user_id is not null
    on conflict do nothing;

    update public.battles set finalized_at = now() where id = b.id;
    done := done + 1;
  end loop;
  return done;
end $$;

-- voting: guest entries (no account) can be voted on; your own entry still can't
-- (same as update 010, only "is distinct from" so an entry without an account counts as "not yours")
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
                 and e.status = 'approved' and e.user_id is distinct from me) then
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
