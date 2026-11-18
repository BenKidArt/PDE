-- =====================================================================
-- BudBattles update 019: Zillah Banana Toss → BudPoints, play time,
-- login days and two new badges ("Banana Blaster", "10 Days Deep").
-- Paste into Supabase → SQL Editor → New query → Run. Run it once,
-- after 018. Safe to run again (it skips what already exists).
--
-- How it works:
--   • user_stats: one row per user (login days, play time, BudPoints).
--     Users can only READ their own row. Changes go through the functions
--     below, which check limits (50 game BudPoints per day, max 15 s play
--     time per call, one login day per calendar day) and hand out the badges.
--   • The badges use the existing badges / user_badges tables.
--   • game_demo_* functions: admins only, for recording a demo video.
-- TODO (real launch): points and play time are still counted in the browser.
--   Before launch, check them on the server (e.g. a signed round summary
--   from the game, rate limits per minute) so nobody can cheat.
-- =====================================================================

create table if not exists public.user_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  login_days int not null default 0,
  last_login_date date,
  game_seconds int not null default 0,
  bud_points int not null default 0,
  game_points_day date,
  game_points_today int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.user_stats enable row level security;
drop policy if exists "own stats readable" on public.user_stats;
create policy "own stats readable" on public.user_stats for select to authenticated using (user_id = auth.uid());
grant select on public.user_stats to authenticated;

-- the two new badges (pictures in assets/badges/)
insert into public.badges (id, image, name_de, name_en, description_de, description_en, kind, active, earned, tradeable, sort) values
  ('badge_banana_round', 'assets/badges/badge_banana_round.png', 'Banana Blaster', 'Banana Blaster',
   '60 Minuten Zillah Banana Toss gespielt.', 'Played 60 minutes of Zillah Banana Toss.', 'award', true, true, false, 40),
  ('badge_login10_gorilla', 'assets/badges/badge_login10_gorilla.png', '10 Days Deep', '10 Days Deep',
   'An 10 verschiedenen Tagen in BudBattles eingeloggt.', 'Logged in to BudBattles on 10 different days.', 'award', true, true, false, 41)
on conflict (id) do nothing;

-- ---------- helpers ----------
create or replace function public.game_today() returns date
language sql stable as $$ select (now() at time zone 'Europe/Berlin')::date $$;

/** The caller's stats row (created if missing). */
create or replace function public.game_my_row() returns public.user_stats
language plpgsql security definer set search_path = public as $$
declare r public.user_stats;
begin
  if auth.uid() is null then raise exception 'not logged in'; end if;
  insert into public.user_stats (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  select * into r from public.user_stats where user_id = auth.uid();
  return r;
end $$;

/** Gives a badge once; returns its id if it is new, else null. */
create or replace function public.game_give_badge(p_badge text) returns text
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.user_badges (user_id, badge_id, source) values (auth.uid(), p_badge, 'auto')
  on conflict do nothing;
  get diagnostics n = row_count;
  return case when n > 0 then p_badge else null end;
end $$;

/** What the app gets back from every function below. */
create or replace function public.game_result(p_new text[]) returns json
language plpgsql security definer set search_path = public as $$
declare r public.user_stats;
begin
  select * into r from public.user_stats where user_id = auth.uid();
  return json_build_object(
    'budPoints', r.bud_points, 'gameSeconds', r.game_seconds, 'loginDays', r.login_days,
    'todayPoints', case when r.game_points_day = public.game_today() then r.game_points_today else 0 end,
    'newBadges', coalesce(array_remove(p_new, null), '{}'));
end $$;

-- ---------- for every user ----------
/** BudPoints from a throw. Max 50 game BudPoints per user per day. */
create or replace function public.game_add_points(p_points int) returns json
language plpgsql security definer set search_path = public as $$
declare r public.user_stats; today date := public.game_today(); room int; add int;
begin
  r := public.game_my_row();
  if r.game_points_day is distinct from today then
    update public.user_stats set game_points_day = today, game_points_today = 0 where user_id = auth.uid();
    r.game_points_today := 0;
  end if;
  room := greatest(0, 50 - r.game_points_today);
  add := least(room, greatest(0, least(coalesce(p_points, 0), 50)));
  update public.user_stats set bud_points = bud_points + add, game_points_today = game_points_today + add, updated_at = now()
  where user_id = auth.uid();
  return public.game_result('{}');
end $$;

/** Active play time (the game reports every 10 s). Banana Blaster at 60 minutes.
 *  p_demo = true only counts for admins: then 1 minute is enough (demo video). */
create or replace function public.game_add_seconds(p_seconds int, p_demo boolean default false) returns json
language plpgsql security definer set search_path = public as $$
declare r public.user_stats; need int; got text;
begin
  perform public.game_my_row();
  update public.user_stats set game_seconds = game_seconds + greatest(0, least(coalesce(p_seconds, 0), 15)), updated_at = now()
  where user_id = auth.uid() returning * into r;
  need := case when p_demo and public.is_admin() then 60 else 3600 end;
  if r.game_seconds >= need then got := public.game_give_badge('badge_banana_round'); end if;
  return public.game_result(array[got]);
end $$;

/** Called when the app opens. Counts max. one login day per calendar day. 10 Days Deep on day 10. */
create or replace function public.game_login_day() returns json
language plpgsql security definer set search_path = public as $$
declare r public.user_stats; got text;
begin
  r := public.game_my_row();
  if r.last_login_date is distinct from public.game_today() then
    update public.user_stats set login_days = login_days + 1, last_login_date = public.game_today(), updated_at = now()
    where user_id = auth.uid() returning * into r;
  end if;
  if r.login_days >= 10 then got := public.game_give_badge('badge_login10_gorilla'); end if;
  return public.game_result(array[got]);
end $$;

/** Own stats without changing anything. */
create or replace function public.game_my_stats() returns json
language plpgsql security definer set search_path = public as $$
begin
  perform public.game_my_row();
  return public.game_result('{}');
end $$;

-- ---------- demo tools: admins only, own account only ----------
create or replace function public.game_demo_set_login_days(p_days int) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  perform public.game_my_row();
  update public.user_stats set login_days = greatest(0, p_days), last_login_date = public.game_today() where user_id = auth.uid();
  return public.game_result('{}');
end $$;

/** Pretends a new calendar day started: one more login day + badge check. */
create or replace function public.game_demo_next_login_day() returns json
language plpgsql security definer set search_path = public as $$
declare r public.user_stats; got text;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  perform public.game_my_row();
  update public.user_stats set login_days = login_days + 1, last_login_date = public.game_today(), updated_at = now()
  where user_id = auth.uid() returning * into r;
  if r.login_days >= 10 then got := public.game_give_badge('badge_login10_gorilla'); end if;
  return public.game_result(array[got]);
end $$;

/** Removes the two game badges and resets play time, login days and game BudPoints (own account). */
create or replace function public.game_demo_reset() returns json
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  perform public.game_my_row();
  delete from public.user_badges where user_id = auth.uid() and badge_id in ('badge_banana_round', 'badge_login10_gorilla');
  update public.user_stats set game_seconds = 0, login_days = 0, last_login_date = null, bud_points = 0,
    game_points_day = null, game_points_today = 0, updated_at = now() where user_id = auth.uid();
  return public.game_result('{}');
end $$;

revoke all on function public.game_my_row(), public.game_give_badge(text), public.game_result(text[]) from public, anon, authenticated;
grant execute on function public.game_add_points(int), public.game_add_seconds(int, boolean), public.game_login_day(),
  public.game_my_stats(), public.game_demo_set_login_days(int), public.game_demo_next_login_day(), public.game_demo_reset() to authenticated;
