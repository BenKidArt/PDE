-- =====================================================================
-- BudBattles update 029: fix the Badge Shop ("Something went wrong" when buying)
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run again.
-- The shop saved bought badges with source 'shop', but the badges table only allows
-- 'auto' | 'award' | 'purchase'. Now it uses 'purchase'. Nothing else changes.
-- =====================================================================
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
  insert into public.user_badges (user_id, badge_id, source) values (auth.uid(), p_badge, 'purchase');
  insert into public.bp_events (user_id, source, ref, points) values (auth.uid(), 'shop', p_badge, -price);
  return public.game_result(array[p_badge]);
end $$;
grant execute on function public.game_buy_badge(text) to authenticated;
