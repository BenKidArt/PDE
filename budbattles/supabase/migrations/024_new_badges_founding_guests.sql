-- =====================================================================
-- BudBattles update 024: new game badges + Founding Member for guest entries
-- Paste into Supabase → SQL Editor → New query → Run. Run once, after 023. Safe to run again.
--
--   • Banana Crown: beat your own Banana Toss high score 5 times (the first round ever doesn't count)
--   • Gorilla King: 300 BudPoints earned in Banana Toss (lifetime)
--   • Golden Nug:   600 BudPoints earned in Banana Toss (lifetime)
--     (these replace the earlier "free badge set"; numbers live in js/budpoints-config.js)
--   • Founding Member (badge_heart): the first 25 entries of Battle #1, counted in the order
--     they were added – including entries an admin adds for growers without an account.
--     Those are saved on the Instagram @handle; when someone with that @handle in their
--     profile signs up (or adds the @handle later), they get the badge automatically.
-- TODO (real launch): Banana Toss scores are reported by the browser – add server-side checks.
-- =====================================================================

-- ---------- the three new badges ----------
insert into public.badges (id, image, name_de, name_en, description_de, description_en, kind, active, earned, tradeable, sort) values
  ('badge_banana_crown', 'assets/badges/badge_banana_crown_5x_highscore.png', 'Banana Crown', 'Banana Crown',
   'Schlage deinen Banana-Toss-Highscore 5-mal.', 'Beat your Banana Toss high score 5 times.', 'award', true, true, false, 42),
  ('badge_gorilla_king', 'assets/badges/badge_gorilla_king_300pts.png', 'Gorilla King', 'Gorilla King',
   'Erreiche 300 BudPoints in Banana Toss.', 'Reach 300 BudPoints in Banana Toss.', 'award', true, true, false, 43),
  ('badge_golden_nug', 'assets/badges/badge_golden_nug_600pts.png', 'Golden Nug', 'Golden Nug',
   'Erreiche 600 BudPoints in Banana Toss.', 'Reach 600 BudPoints in Banana Toss.', 'award', true, true, false, 44)
on conflict (id) do nothing;

-- ---------- rules: replace the free set with Gorilla King / Golden Nug, add Banana Crown ----------
update public.bp_config set cfg = (cfg - 'freeSet')
  || jsonb_build_object('milestones', coalesce(cfg->'milestones', '{}'::jsonb) - 'freeSet' || '{"gorillaKing": 300, "goldenNug": 600}'::jsonb,
                        'milestoneBadges', '{"gorillaKing": "badge_gorilla_king", "goldenNug": "badge_golden_nug"}'::jsonb,
                        'crown', '{"badge": "badge_banana_crown", "beats": 5}'::jsonb),
  updated_at = now()
where id = 1;

/** Banana Toss badges from the lifetime total: Banana Blaster + every milestone badge reached. */
create or replace function public.bp_toss_badges() returns text[]
language plpgsql security definer set search_path = public as $$
declare c jsonb := public.bp_cfg(); earned int; got text[] := '{}'; k text; b text;
begin
  select toss_earned into earned from public.user_stats where user_id = auth.uid();
  if earned >= (c->'milestones'->>'blaster')::int then got := got || public.game_give_badge(c->>'blasterBadge'); end if;
  for k, b in select key, value from jsonb_each_text(coalesce(c->'milestoneBadges', '{}'::jsonb)) loop
    if (c->'milestones'->>k) is not null and earned >= (c->'milestones'->>k)::int then got := got || public.game_give_badge(b); end if;
  end loop;
  return array_remove(got, null);
end $$;

-- ---------- Banana Crown: personal best beaten 5 times ----------
alter table public.user_stats add column if not exists toss_best int;            -- best round score so far
alter table public.user_stats add column if not exists toss_best_beats int not null default 0;

/** End of a Banana Toss round. The first round only sets the best; every later new best counts. */
create or replace function public.game_toss_round(p_score int) returns json
language plpgsql security definer set search_path = public as $$
declare c jsonb := public.bp_cfg(); r public.user_stats; s int := greatest(0, least(coalesce(p_score, 0), 10000000));
  beat boolean := false; got text;
begin
  r := public.game_my_row();
  if r.toss_best is null then
    update public.user_stats set toss_best = s, updated_at = now() where user_id = auth.uid();
  elsif s > r.toss_best then
    beat := true;
    update public.user_stats set toss_best = s, toss_best_beats = toss_best_beats + 1, updated_at = now()
    where user_id = auth.uid() returning * into r;
    if r.toss_best_beats >= coalesce((c->'crown'->>'beats')::int, 5) then got := public.game_give_badge(c->'crown'->>'badge'); end if;
  end if;
  select * into r from public.user_stats where user_id = auth.uid();
  return (public.game_result(array[got])::jsonb
    || jsonb_build_object('newBest', beat, 'best', r.toss_best, 'beats', r.toss_best_beats,
                          'beatsNeeded', coalesce((c->'crown'->>'beats')::int, 5)))::json;
end $$;

/** Demo video: counts one more beaten high score (admins, own account). */
create or replace function public.game_demo_beat() returns json
language plpgsql security definer set search_path = public as $$
declare r public.user_stats;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  r := public.game_my_row();
  return public.game_toss_round(coalesce(r.toss_best, 0) + case when r.toss_best is null then 0 else 1 end);
end $$;

/** Demo video: removes all game / shop badges and every BudPoints record of the own account. */
create or replace function public.game_demo_reset() returns json
language plpgsql security definer set search_path = public as $$
declare c jsonb := public.bp_cfg();
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  perform public.game_my_row();
  delete from public.user_badges where user_id = auth.uid() and (
    badge_id in ('badge_login10_gorilla', c->>'blasterBadge', c->'crown'->>'badge',
                 'badge_kangaroo', 'badge_ninja', 'badge_pickle', 'badge_sloth', 'badge_troll', 'badge_hookah')
    or badge_id in (select jsonb_object_keys(c->'shop'))
    or badge_id in (select value from jsonb_each_text(coalesce(c->'milestoneBadges', '{}'::jsonb))));
  delete from public.bp_events where user_id = auth.uid();
  update public.user_stats set game_seconds = 0, login_days = 0, last_login_date = null, bud_points = 0, toss_earned = 0,
    game_points_day = null, game_points_today = 0, toss_best = null, toss_best_beats = 0, updated_at = now()
  where user_id = auth.uid();
  return public.game_result('{}');
end $$;

-- ---------- Founding Member for guest entries (saved on the @handle) ----------
create table if not exists public.guest_badges (
  handle text not null,                 -- Instagram handle, lower case, without @
  badge_id text not null references public.badges (id) on delete cascade,
  battle_id text references public.battles (id) on delete cascade,
  entry_id uuid references public.entries (id) on delete cascade,
  claimed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (handle, badge_id)
);
alter table public.guest_badges enable row level security;
drop policy if exists "guest badges readable" on public.guest_badges;
create policy "guest badges readable" on public.guest_badges for select using (true);
grant select on public.guest_badges to anon, authenticated;

/** Founding Member: the first 25 entries of Battle #1 (in the order they were added). */
create or replace function public.award_founding_member()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  place int;
begin
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
  if place > 25 then return new; end if;
  if new.user_id is not null then
    insert into public.user_badges (user_id, badge_id, source, battle_id)
    values (new.user_id, 'badge_heart', 'auto', new.battle_id)
    on conflict do nothing;
  elsif new.guest_handle is not null then
    insert into public.guest_badges (handle, badge_id, battle_id, entry_id)
    values (lower(new.guest_handle), 'badge_heart', new.battle_id, new.id)
    on conflict do nothing;
    -- someone already has this @handle in their profile: give it right away
    perform public.claim_guest_badges(p.id, p.instagram) from public.profiles p
    where lower(p.instagram) = lower(new.guest_handle) limit 1;
  end if;
  return new;
end $$;

/** Gives a member the badges saved on their Instagram @handle (each @handle's badges only once). */
create or replace function public.claim_guest_badges(p_user uuid, p_handle text) returns int
language plpgsql security definer set search_path = public as $$
declare h text := lower(trim(both '@ ' from coalesce(p_handle, ''))); n int := 0;
begin
  if p_user is null or h = '' then return 0; end if;
  insert into public.user_badges (user_id, badge_id, source, battle_id)
  select p_user, g.badge_id, 'auto', g.battle_id from public.guest_badges g
  where g.handle = h and (g.claimed_by is null or g.claimed_by = p_user)
  on conflict do nothing;
  get diagnostics n = row_count;
  update public.guest_badges set claimed_by = p_user where handle = h and claimed_by is null;
  return n;
end $$;
revoke execute on function public.claim_guest_badges(uuid, text) from public, anon, authenticated;

/** When a profile gets an Instagram @handle (sign-up or later), hand over the saved badges. */
create or replace function public.profiles_claim_guest_badges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.instagram is not null and (tg_op = 'INSERT' or new.instagram is distinct from old.instagram) then
    perform public.claim_guest_badges(new.id, new.instagram);
  end if;
  return new;
end $$;
drop trigger if exists profiles_claim_guest_badges on public.profiles;
create trigger profiles_claim_guest_badges
  after insert or update of instagram on public.profiles
  for each row execute function public.profiles_claim_guest_badges();

-- guest entries already approved in Battle #1: save their Founding Member badge now
insert into public.guest_badges (handle, badge_id, battle_id, entry_id)
select lower(e.guest_handle), 'badge_heart', e.battle_id, e.id
from public.entries e join public.battles b on b.id = e.battle_id and b.number = 1 and not b.is_test
where e.guest_handle is not null and e.status = 'approved'
  and (select count(*) from public.entries x where x.battle_id = e.battle_id and x.status <> 'rejected'
       and (x.created_at, x.id) <= (e.created_at, e.id)) <= 25
on conflict do nothing;

-- standings: guest entries show the badges saved on their @handle too
create or replace function public.get_standings(p_battle text)
returns table (entry_id uuid, photo_path text, width int, height int, strain text,
               description text, display_name text, votes int, is_mine boolean,
               created_at timestamptz, badges text[], username text, instagram text,
               avatar text, profile_key text, breeder text, is_guest boolean)
language sql stable security definer set search_path = public as $$
  select e.id, e.photo_path, e.width, e.height, e.strain, e.description,
         coalesce(p.username, p.display_name, '@' || e.guest_handle),
         (select count(*)::int from public.votes v where v.entry_id = e.id) as votes,
         coalesce(e.user_id = auth.uid(), false), e.created_at,
         case when e.user_id is not null then
           coalesce((select array_agg(ub.badge_id order by bd.sort, ub.awarded_at)
                     from public.user_badges ub join public.badges bd on bd.id = ub.badge_id
                     where ub.user_id = e.user_id and bd.active), '{}')
         else
           coalesce((select array_agg(g.badge_id order by bd.sort)
                     from public.guest_badges g join public.badges bd on bd.id = g.badge_id
                     where g.handle = lower(e.guest_handle) and bd.active), '{}')
         end,
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

grant execute on function public.game_toss_round(int), public.game_demo_beat(), public.game_demo_reset() to authenticated;
