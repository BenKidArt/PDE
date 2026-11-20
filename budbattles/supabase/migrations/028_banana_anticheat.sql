-- =====================================================================
-- BudBattles update 028: Banana Toss protection against faked throws
-- Paste into Supabase → SQL Editor → New query → Run. Run once, after 027. Safe to run again.
--
-- The game runs in the player's browser, so someone with technical skill could send
-- made-up throws to the database. These checks make that useless:
--   • impossible throws (farther than the course, more rings than possible) → 0 points
--   • throws closer than 2 seconds apart (a real throw + landing takes longer) → 0 points
--   • more than 15 throws a minute → 0 points
--   • max 30 BudPoints from one throw, and the existing 200 per 12 hours
-- Every rejected throw is counted ("flags"). Admins see these players on the Admin page
-- ("Banana Toss check") and can clear the flags or take back their Banana Toss points.
-- All limits live in js/budpoints-config.js (toss.*); the Admin page keeps them in sync.
-- =====================================================================

alter table public.user_stats add column if not exists last_throw_at timestamptz;
alter table public.user_stats add column if not exists throw_minute_start timestamptz;
alter table public.user_stats add column if not exists throw_minute_count int not null default 0;
alter table public.user_stats add column if not exists toss_flags int not null default 0;
alter table public.user_stats add column if not exists toss_flag_reason text;
alter table public.user_stats add column if not exists toss_flagged_at timestamptz;

update public.bp_config set cfg = jsonb_set(cfg, '{toss}', (cfg->'toss')
  || '{"maxMeters": 6000, "maxRings": 20, "maxPerThrow": 30, "minGapSeconds": 2, "maxThrowsPerMinute": 15}'::jsonb),
  updated_at = now()
where id = 1;

/** One Banana Toss throw, checked first. */
create or replace function public.game_toss_throw(p_meters numeric, p_rings int, p_combo boolean) returns json
language plpgsql security definer set search_path = public as $$
declare c jsonb := public.bp_cfg(); r public.user_stats; per_m int; worth int := 0; add int := 0; res json;
  max_m numeric := coalesce((c->'toss'->>'maxMeters')::numeric, 6000);
  max_r int := coalesce((c->'toss'->>'maxRings')::int, 20);
  max_pt int := coalesce((c->'toss'->>'maxPerThrow')::int, 30);
  gap numeric := coalesce((c->'toss'->>'minGapSeconds')::numeric, 2);
  per_min int := coalesce((c->'toss'->>'maxThrowsPerMinute')::int, 15);
  reason text;
begin
  r := public.game_my_row();
  -- throws per minute
  if r.throw_minute_start is null or r.throw_minute_start < now() - interval '1 minute' then
    update public.user_stats set throw_minute_start = now(), throw_minute_count = 1 where user_id = auth.uid();
  else
    update public.user_stats set throw_minute_count = throw_minute_count + 1 where user_id = auth.uid() returning * into r;
    if r.throw_minute_count > per_min then reason := 'too_many'; end if;
  end if;
  if reason is null and r.last_throw_at is not null and r.last_throw_at > now() - make_interval(secs => gap) then reason := 'too_fast'; end if;
  if reason is null and (coalesce(p_meters, 0) < 0 or coalesce(p_meters, 0) > max_m or coalesce(p_rings, 0) < 0 or coalesce(p_rings, 0) > max_r) then
    reason := 'impossible';
  end if;
  update public.user_stats set last_throw_at = now() where user_id = auth.uid();

  if reason is not null then
    update public.user_stats set toss_flags = toss_flags + 1, toss_flag_reason = reason, toss_flagged_at = now() where user_id = auth.uid();
  else
    per_m := greatest(1, coalesce((c->'toss'->>'metersPerPoint')::int, 250));
    worth := least(max_pt,
               floor(coalesce(p_meters, 0) / per_m)::int
             + coalesce(p_rings, 0) * (c->'toss'->>'perRing')::int
             + case when p_combo then (c->'toss'->>'combo')::int else 0 end);
    add := least(worth, greatest(0, (c->'toss'->>'windowMax')::int - public.bp_window_used()));
    if add > 0 then
      insert into public.bp_events (user_id, source, points) values (auth.uid(), 'toss', add);
      update public.user_stats set bud_points = bud_points + add, toss_earned = toss_earned + add, updated_at = now()
      where user_id = auth.uid();
    end if;
  end if;
  res := public.game_result(public.bp_toss_badges());
  return (res::jsonb || jsonb_build_object('granted', add, 'worth', worth, 'rejected', reason))::json;
end $$;

/** Admin: players with rejected throws. */
create or replace function public.admin_toss_suspects() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  return coalesce((select json_agg(json_build_object(
      'user_id', s.user_id, 'username', p.username, 'display_name', p.display_name,
      'flags', s.toss_flags, 'reason', s.toss_flag_reason, 'flagged_at', s.toss_flagged_at,
      'toss_earned', s.toss_earned, 'bud_points', s.bud_points) order by s.toss_flagged_at desc)
    from public.user_stats s left join public.profiles p on p.id = s.user_id
    where s.toss_flags > 0), '[]'::json);
end $$;

/** Admin: clear a player's flags; with p_take_back also remove all their Banana Toss points and game badges. */
create or replace function public.admin_toss_clear(p_user uuid, p_take_back boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare c jsonb := public.bp_cfg(); pts int;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_take_back then
    select coalesce(sum(points), 0) into pts from public.bp_events where user_id = p_user and source = 'toss';
    delete from public.bp_events where user_id = p_user and source = 'toss';
    delete from public.user_badges where user_id = p_user and (badge_id in (c->>'blasterBadge', c->'crown'->>'badge')
      or badge_id in (select value from jsonb_each_text(coalesce(c->'milestoneBadges', '{}'::jsonb))));
    update public.user_stats set bud_points = greatest(0, bud_points - pts), toss_earned = 0 where user_id = p_user;
  end if;
  update public.user_stats set toss_flags = 0, toss_flag_reason = null, toss_flagged_at = null where user_id = p_user;
end $$;

revoke execute on function public.admin_toss_suspects(), public.admin_toss_clear(uuid, boolean) from public, anon;
grant execute on function public.game_toss_throw(numeric, int, boolean), public.admin_toss_suspects(), public.admin_toss_clear(uuid, boolean) to authenticated;
