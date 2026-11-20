-- =====================================================================
-- BudBattles update 026: new badge rules
-- Paste into Supabase → SQL Editor → New query → Run. Run once, after 025. Safe to run again.
--   • Gorilla King: 500 BudPoints earned in Banana Toss (was 300)
--   • Golden Nug:   3000 BudPoints earned in Banana Toss (was 600)
--   • Banana Crown: play Banana Toss on 3 different days (Finnish time) – replaces "beat your high score 5 times"
-- (numbers live in js/budpoints-config.js; the Admin page keeps them in sync)
-- =====================================================================

update public.badges set image = 'assets/badges/badge_gorilla_king_500pts.png',
  description_de = 'Erreiche 500 BudPoints in Banana Toss.', description_en = 'Reach 500 BudPoints in Banana Toss.'
where id = 'badge_gorilla_king';
update public.badges set image = 'assets/badges/badge_golden_nug_3000pts.png',
  description_de = 'Erreiche 3000 BudPoints in Banana Toss.', description_en = 'Reach 3000 BudPoints in Banana Toss.'
where id = 'badge_golden_nug';
update public.badges set image = 'assets/badges/badge_banana_crown_3days.png',
  description_de = 'Spiele Banana Toss an 3 verschiedenen Tagen.', description_en = 'Play Banana Toss on 3 different days.'
where id = 'badge_banana_crown';

update public.bp_config set cfg = cfg
  || jsonb_build_object('milestones', coalesce(cfg->'milestones', '{}'::jsonb) || '{"gorillaKing": 500, "goldenNug": 3000}'::jsonb,
                        'crown', '{"badge": "badge_banana_crown", "days": 3}'::jsonb),
  updated_at = now()
where id = 1;

-- days on which Banana Toss was played (Finnish calendar day)
alter table public.user_stats add column if not exists toss_play_days int not null default 0;
alter table public.user_stats add column if not exists toss_last_play_day date;

create or replace function public.game_helsinki_today() returns date
language sql stable as $$ select (now() at time zone 'Europe/Helsinki')::date $$;

/** End of a Banana Toss round: counts today as a play day (once per Finnish calendar day).
 *  Banana Crown when the number of play days reaches crown.days. */
create or replace function public.game_toss_round(p_score int) returns json
language plpgsql security definer set search_path = public as $$
declare c jsonb := public.bp_cfg(); r public.user_stats; today date := public.game_helsinki_today();
  new_day boolean := false; got text; need int := coalesce((c->'crown'->>'days')::int, 3);
begin
  r := public.game_my_row();
  if r.toss_last_play_day is distinct from today then
    new_day := true;
    update public.user_stats set toss_play_days = toss_play_days + 1, toss_last_play_day = today, updated_at = now()
    where user_id = auth.uid() returning * into r;
  end if;
  if r.toss_play_days >= need then got := public.game_give_badge(c->'crown'->>'badge'); end if;
  return (public.game_result(array[got])::jsonb
    || jsonb_build_object('newDay', new_day, 'days', r.toss_play_days, 'daysNeeded', need))::json;
end $$;

/** Demo video: pretends a new day of play (admins, own account). */
create or replace function public.game_demo_play_day() returns json
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  perform public.game_my_row();
  update public.user_stats set toss_last_play_day = public.game_helsinki_today() - 1 where user_id = auth.uid();
  return public.game_toss_round(0);
end $$;
drop function if exists public.game_demo_beat();

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
    game_points_day = null, game_points_today = 0, toss_best = null, toss_best_beats = 0,
    toss_play_days = 0, toss_last_play_day = null, updated_at = now()
  where user_id = auth.uid();
  return public.game_result('{}');
end $$;

grant execute on function public.game_toss_round(int), public.game_demo_play_day(), public.game_demo_reset() to authenticated;
