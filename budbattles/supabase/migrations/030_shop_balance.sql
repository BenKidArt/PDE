-- =====================================================================
-- BudBattles update 030: Badge Shop balance + badge descriptions
-- Paste into Supabase → SQL Editor → New query → Run. Run once, after 029. Safe to run again.
--   • Shop badges cost 150 BudPoints each (was 30)
--   • The shop opens once a user has earned 150 BudPoints IN TOTAL (any source) –
--     counted as current balance + BudPoints already spent in the shop
--   • Badge descriptions match the rules (Banana Blaster, Banana Crown, Gorilla King, Golden Nug)
-- =====================================================================

update public.bp_config set cfg = jsonb_set(
    jsonb_set(cfg, '{milestones}', (cfg->'milestones') - 'shop'),
    '{shop}', (select jsonb_object_agg(key, 150) from jsonb_each(cfg->'shop')))
  || '{"shopUnlockAt": 150}'::jsonb,
  updated_at = now()
where id = 1;

/** Everything a user has earned so far: current balance + what was spent in the shop. */
create or replace function public.bp_total_earned() returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select bud_points from public.user_stats where user_id = auth.uid()), 0)
       + coalesce((select -sum(points) from public.bp_events where user_id = auth.uid() and source = 'shop'), 0)::int
$$;
revoke all on function public.bp_total_earned() from public, anon, authenticated;

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
    'totalEarned', public.bp_total_earned(),
    'shopUnlocked', public.bp_total_earned() >= coalesce((c->>'shopUnlockAt')::int, 150),
    'done', json_build_object(
      'profileComplete', exists (select 1 from public.bp_events where user_id = auth.uid() and source = 'profile_complete'),
      'profileVisual', exists (select 1 from public.bp_events where user_id = auth.uid() and source = 'profile_visual')),
    'granted', 0,
    'newBadges', coalesce(array_remove(p_new, null), '{}'));
end $$;


create or replace function public.game_buy_badge(p_badge text) returns json
language plpgsql security definer set search_path = public as $$
declare c jsonb := public.bp_cfg(); price int; r public.user_stats;
begin
  r := public.game_my_row();
  price := (c->'shop'->>p_badge)::int;
  if price is null then raise exception 'not in shop'; end if;
  if public.bp_total_earned() < coalesce((c->>'shopUnlockAt')::int, 150) then raise exception 'shop locked'; end if;
  if exists (select 1 from public.user_badges where user_id = auth.uid() and badge_id = p_badge) then raise exception 'already owned'; end if;
  if r.bud_points < price then raise exception 'not enough BudPoints'; end if;
  update public.user_stats set bud_points = bud_points - price, updated_at = now() where user_id = auth.uid();
  insert into public.user_badges (user_id, badge_id, source) values (auth.uid(), p_badge, 'purchase');
  insert into public.bp_events (user_id, source, ref, points) values (auth.uid(), 'shop', p_badge, -price);
  return public.game_result(array[p_badge]);
end $$;
grant execute on function public.game_buy_badge(text) to authenticated;

-- descriptions = the rules
update public.badges set description_de = 'Dein erstes Spiel-Badge: sammle 50 BudPoints in Zillah Banana Toss.',
  description_en = 'Your first game badge: earn 50 BudPoints in Zillah Banana Toss.' where id = 'badge_banana_round';
update public.badges set description_de = 'Spiele Banana Toss an 3 verschiedenen Tagen.', description_en = 'Play Banana Toss on 3 different days.' where id = 'badge_banana_crown';
update public.badges set description_de = 'Erreiche 500 BudPoints in Banana Toss.', description_en = 'Reach 500 BudPoints in Banana Toss.' where id = 'badge_gorilla_king';
update public.badges set description_de = 'Erreiche 3000 BudPoints in Banana Toss.', description_en = 'Reach 3000 BudPoints in Banana Toss.' where id = 'badge_golden_nug';
update public.badges set description_de = 'Für alle, die sich registriert haben.', description_en = 'For everyone who signed up.' where id = 'badge_star';
update public.badges set description_de = 'Einer der ersten 25 Beiträge in Battle #1.', description_en = 'One of the first 25 entries in Battle #1.' where id = 'badge_heart';
update public.badges set description_de = 'Shop-Badge – 150 BudPoints.', description_en = 'Shop badge – 150 BudPoints.'
where id in ('badge_clown', 'badge_cow', 'badge_donkey', 'badge_elephant', 'badge_farmer', 'badge_goat');
