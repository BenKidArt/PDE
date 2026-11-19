-- =====================================================================
-- BudBattles update 022: Banana Toss points are slower to earn
-- Paste into Supabase → SQL Editor → New query → Run. Run once, after 021.
--   1 point per 250 m (was 100 m), 1 per ring (was 3), 2 per combo (was 3).
--   Max 45 per 12 hours and the badge goals (35 / 120 / 200) stay the same.
-- (The numbers live in js/budpoints-config.js; the Admin page keeps them in sync.)
-- =====================================================================
update public.bp_config
set cfg = jsonb_set(cfg, '{toss}', (cfg->'toss') - 'per100m' || '{"metersPerPoint": 250, "perRing": 1, "combo": 2}'::jsonb),
    updated_at = now()
where id = 1;

create or replace function public.game_toss_throw(p_meters numeric, p_rings int, p_combo boolean) returns json
language plpgsql security definer set search_path = public as $$
declare c jsonb := public.bp_cfg(); per_m int; worth int; add int; res json;
begin
  perform public.game_my_row();
  per_m := greatest(1, coalesce((c->'toss'->>'metersPerPoint')::int, 250));
  worth := floor(least(greatest(coalesce(p_meters, 0), 0), 5000) / per_m)::int
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
