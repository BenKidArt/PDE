-- =====================================================================
-- BudBattles update 021: new BudPoints rules
-- Paste into Supabase → SQL Editor → New query → Run. Run it once, after 019
-- (and 020). Safe to run again.
--
--   • Banana Toss: points per throw (100 m / rings / combo), max 45 per rolling
--     12 hours, counted here. Badges from LIFETIME Banana Toss points:
--     35 = Banana Blaster, 120 = Badge Shop opens, 200 = free badge set.
--     (Replaces the old 50-a-day cap and the 60-minutes-of-play badge.)
--   • Other ways to earn (same balance, not part of the Banana Toss limit/badges):
--     profile completed, profile look changed, voting / entering a battle.
--   • Badge Shop: buy badges with BudPoints (balance goes down, lifetime stays).
--   • All numbers live in js/budpoints-config.js. When an admin opens the Admin
--     page, the app copies them into the table bp_config below.
-- BudPoints have no money or cash value.
-- TODO (real launch): Banana Toss throws are still reported by the browser –
--   add server-side checks (signed round summary, rate limits) against cheating.
-- =====================================================================

-- ---------- rules (copied from js/budpoints-config.js by the Admin page) ----------
create table if not exists public.bp_config (
  id int primary key default 1 check (id = 1),
  cfg jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.bp_config enable row level security;
drop policy if exists "bp config readable" on public.bp_config;
create policy "bp config readable" on public.bp_config for select using (true);
grant select on public.bp_config to anon, authenticated;
insert into public.bp_config (id, cfg) values (1, '{
  "toss": {"per100m": 1, "perRing": 3, "combo": 3, "windowHours": 12, "windowMax": 45},
  "milestones": {"blaster": 35, "shop": 120, "freeSet": 200},
  "blasterBadge": "badge_banana_round",
  "shop": {"badge_clown": 30, "badge_cow": 30, "badge_donkey": 30, "badge_elephant": 30, "badge_farmer": 30, "badge_goat": 30},
  "freeSet": ["badge_kangaroo", "badge_ninja", "badge_pickle", "badge_sloth", "badge_troll", "badge_hookah"],
  "extra": {"profile_complete": 7, "profile_visual": 3, "vote": 2, "enter": 2}
}') on conflict (id) do nothing;

-- ---------- lifetime Banana Toss points + a list of every point change ----------
alter table public.user_stats add column if not exists toss_earned int not null default 0;
create table if not exists public.bp_events (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null,          -- toss | profile_complete | profile_visual | vote | enter | shop
  ref text,                      -- battle id (vote/enter), badge id (shop), '' (profile)
  points int not null,           -- negative for purchases
  created_at timestamptz not null default now()
);
create index if not exists bp_events_user_source_time on public.bp_events (user_id, source, created_at);
create unique index if not exists bp_events_once on public.bp_events (user_id, source, ref)
  where source in ('profile_complete', 'profile_visual', 'vote', 'enter');
alter table public.bp_events enable row level security;
drop policy if exists "own bp events readable" on public.bp_events;
create policy "own bp events readable" on public.bp_events for select to authenticated using (user_id = auth.uid());
grant select on public.bp_events to authenticated;

create or replace function public.bp_cfg() returns jsonb
language sql stable security definer set search_path = public as $$ select cfg from public.bp_config where id = 1 $$;

/** Banana Toss points in the current rolling window. */
create or replace function public.bp_window_used() returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(points), 0)::int from public.bp_events
  where user_id = auth.uid() and source = 'toss'
    and created_at > now() - make_interval(hours => (public.bp_cfg()->'toss'->>'windowHours')::int)
$$;

-- ---------- what the app gets back from every BudPoints / game function ----------
-- (same name as in update 019, so the login-day functions return the new fields too)
create or replace function public.game_result(p_new text[]) returns json
language plpgsql security definer set search_path = public as $$
declare r public.user_stats; c jsonb := public.bp_cfg(); used int := public.bp_window_used(); reset_at timestamptz;
begin
  select * into r from public.user_stats where user_id = auth.uid();
  if used >= (c->'toss'->>'windowMax')::int then
    select min(created_at) + make_interval(hours => (c->'toss'->>'windowHours')::int) into reset_at
    from public.bp_events where user_id = auth.uid() and source = 'toss'
      and created_at > now() - make_interval(hours => (c->'toss'->>'windowHours')::int);
  end if;
  return json_build_object(
    'budPoints', r.bud_points, 'tossEarned', r.toss_earned, 'gameSeconds', r.game_seconds, 'loginDays', r.login_days,
    'windowUsed', used, 'windowMax', (c->'toss'->>'windowMax')::int, 'windowResetAt', reset_at,
    'shopUnlocked', r.toss_earned >= (c->'milestones'->>'shop')::int,
    'done', json_build_object(
      'profileComplete', exists (select 1 from public.bp_events where user_id = auth.uid() and source = 'profile_complete'),
      'profileVisual', exists (select 1 from public.bp_events where user_id = auth.uid() and source = 'profile_visual')),
    'granted', 0,
    'newBadges', coalesce(array_remove(p_new, null), '{}'));
end $$;

/** Hands out the Banana Toss badges the lifetime total has reached. Returns the new ones. */
create or replace function public.bp_toss_badges() returns text[]
language plpgsql security definer set search_path = public as $$
declare c jsonb := public.bp_cfg(); earned int; got text[] := '{}'; b text;
begin
  select toss_earned into earned from public.user_stats where user_id = auth.uid();
  if earned >= (c->'milestones'->>'blaster')::int then got := got || public.game_give_badge(c->>'blasterBadge'); end if;
  if earned >= (c->'milestones'->>'freeSet')::int then
    for b in select jsonb_array_elements_text(c->'freeSet') loop got := got || public.game_give_badge(b); end loop;
  end if;
  return array_remove(got, null);
end $$;

-- ---------- Banana Toss: one throw ----------
create or replace function public.game_toss_throw(p_meters numeric, p_rings int, p_combo boolean) returns json
language plpgsql security definer set search_path = public as $$
declare c jsonb := public.bp_cfg(); worth int; add int; res json;
begin
  perform public.game_my_row();
  worth := floor(least(greatest(coalesce(p_meters, 0), 0), 5000) / 100)::int * (c->'toss'->>'per100m')::int
         + least(greatest(coalesce(p_rings, 0), 0), 20) * (c->'toss'->>'perRing')::int
         + case when p_combo then (c->'toss'->>'combo')::int else 0 end;
  add := least(worth, greatest(0, (c->'toss'->>'windowMax')::int - public.bp_window_used()));
  if add > 0 then
    insert into public.bp_events (user_id, source, points) values (auth.uid(), 'toss', add);
    update public.user_stats set bud_points = bud_points + add, toss_earned = toss_earned + add, updated_at = now()
    where user_id = auth.uid();
  end if;
  res := public.game_result(public.bp_toss_badges());
  return (res::jsonb || jsonb_build_object('granted', add, 'worth', worth))::json;
end $$;

-- ---------- other ways to earn (checked here, once each) ----------
create or replace function public.game_award(p_kind text, p_ref text default '') returns json
language plpgsql security definer set search_path = public as $$
declare c jsonb := public.bp_cfg(); pts int; ok boolean := false; n int := 0; ref text := coalesce(p_ref, '');
begin
  perform public.game_my_row();
  pts := (c->'extra'->>p_kind)::int;
  if pts is null then raise exception 'unknown kind'; end if;
  if p_kind = 'profile_complete' then
    ref := '';
    select (coalesce(p.avatar, '') <> '' or p.bg_image like 'u:%' or p.banner_image like 'u:%')
       and coalesce(trim(p.username), '') <> '' and coalesce(trim(p.bio), '') <> ''
       and (jsonb_array_length(coalesce(p.setups, '[]'::jsonb)) > 0 or coalesce(trim(p.grow_setup), '') <> '')
      into ok from public.profiles p where p.id = auth.uid();
  elsif p_kind = 'profile_visual' then
    ref := '';
    select (coalesce(p.bg_image, '') <> '' or coalesce(p.banner_image, '') <> '' or coalesce(p.accent, '') not in ('', 'theme'))
      into ok from public.profiles p where p.id = auth.uid();
  elsif p_kind = 'vote' then
    ok := exists (select 1 from public.votes v where v.battle_id = ref and v.user_id = auth.uid());
  elsif p_kind = 'enter' then
    ok := exists (select 1 from public.entries e where e.battle_id = ref and e.user_id = auth.uid());
  end if;
  if coalesce(ok, false) then
    insert into public.bp_events (user_id, source, ref, points) values (auth.uid(), p_kind, ref, pts) on conflict do nothing;
    get diagnostics n = row_count;
    if n > 0 then update public.user_stats set bud_points = bud_points + pts, updated_at = now() where user_id = auth.uid(); end if;
  end if;
  return (public.game_result('{}')::jsonb || jsonb_build_object('granted', case when n > 0 then pts else 0 end, 'kind', p_kind))::json;
end $$;

-- ---------- Badge Shop ----------
create or replace function public.game_buy_badge(p_badge text) returns json
language plpgsql security definer set search_path = public as $$
declare c jsonb := public.bp_cfg(); price int; r public.user_stats;
begin
  r := public.game_my_row();
  price := (c->'shop'->>p_badge)::int;
  if price is null then raise exception 'not in shop'; end if;
  if r.toss_earned < (c->'milestones'->>'shop')::int then raise exception 'shop locked'; end if;
  if exists (select 1 from public.user_badges where user_id = auth.uid() and badge_id = p_badge) then raise exception 'already owned'; end if;
  if r.bud_points < price then raise exception 'not enough BudPoints'; end if;
  update public.user_stats set bud_points = bud_points - price, updated_at = now() where user_id = auth.uid();
  insert into public.user_badges (user_id, badge_id, source) values (auth.uid(), p_badge, 'shop');
  insert into public.bp_events (user_id, source, ref, points) values (auth.uid(), 'shop', p_badge, -price);
  return public.game_result(array[p_badge]);
end $$;

-- ---------- old rules switched off ----------
drop function if exists public.game_add_points(int); -- old 50-a-day cap
/** Play time is still counted (for later), but no longer gives a badge. */
create or replace function public.game_add_seconds(p_seconds int, p_demo boolean default false) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform public.game_my_row();
  update public.user_stats set game_seconds = game_seconds + greatest(0, least(coalesce(p_seconds, 0), 15)), updated_at = now()
  where user_id = auth.uid();
  return public.game_result('{}');
end $$;

-- ---------- admin ----------
/** The Admin page copies js/budpoints-config.js here. */
create or replace function public.game_sync_config(p_cfg jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_cfg is null or p_cfg->'toss' is null or p_cfg->'milestones' is null or p_cfg->'shop' is null or p_cfg->'extra' is null then
    raise exception 'incomplete rules';
  end if;
  update public.bp_config set cfg = p_cfg, updated_at = now() where id = 1 and cfg is distinct from p_cfg;
end $$;

/** Demo video: adds Banana Toss points outside the 12-hour window (own account). */
create or replace function public.game_demo_add_toss(p_points int) returns json
language plpgsql security definer set search_path = public as $$
declare c jsonb := public.bp_cfg(); add int := greatest(0, least(coalesce(p_points, 0), 500));
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  perform public.game_my_row();
  insert into public.bp_events (user_id, source, points, created_at)
  values (auth.uid(), 'toss', add, now() - make_interval(hours => (c->'toss'->>'windowHours')::int + 1));
  update public.user_stats set bud_points = bud_points + add, toss_earned = toss_earned + add, updated_at = now() where user_id = auth.uid();
  return (public.game_result(public.bp_toss_badges())::jsonb || jsonb_build_object('granted', add))::json;
end $$;

/** Demo video: removes all game / shop badges and every BudPoints record of the own account. */
create or replace function public.game_demo_reset() returns json
language plpgsql security definer set search_path = public as $$
declare c jsonb := public.bp_cfg();
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  perform public.game_my_row();
  delete from public.user_badges where user_id = auth.uid() and (
    badge_id in ('badge_login10_gorilla', c->>'blasterBadge')
    or badge_id in (select jsonb_object_keys(c->'shop'))
    or badge_id in (select jsonb_array_elements_text(c->'freeSet')));
  delete from public.bp_events where user_id = auth.uid();
  update public.user_stats set game_seconds = 0, login_days = 0, last_login_date = null, bud_points = 0, toss_earned = 0,
    game_points_day = null, game_points_today = 0, updated_at = now() where user_id = auth.uid();
  return public.game_result('{}');
end $$;

revoke all on function public.bp_cfg(), public.bp_window_used(), public.bp_toss_badges() from public, anon, authenticated;
grant execute on function public.game_toss_throw(numeric, int, boolean), public.game_award(text, text), public.game_buy_badge(text),
  public.game_add_seconds(int, boolean), public.game_sync_config(jsonb), public.game_demo_add_toss(int), public.game_demo_reset() to authenticated;
