-- =====================================================================
-- BudBattles update 009: "dense" places – ties share a place and the
-- next place is NOT skipped (1, 2, 2, 3, 3, 4). Same rule as the ranking.
-- Paste into Supabase → SQL Editor → New query → Run. Needs update 005.
-- Safe to run again. Battle #1 is not changed.
-- =====================================================================

do $$
begin
  if to_regprocedure('public.award_place_badges(text)') is null then
    raise exception 'Please run update 005 (005_place_badges.sql) first, then this one.';
  end if;
end $$;

-- 1st / 2nd / 3rd place badges, now with dense_rank instead of rank
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
  where place <= 3 and votes > 0
  on conflict (user_id, badge_id) do update set battle_id = excluded.battle_id
    -- a badge first earned in a test battle now belongs to this real battle,
    -- so deleting the test battle can't take it away
    where public.user_badges.battle_id in (select id from public.battles where is_test)
      and excluded.battle_id in (select id from public.battles where not is_test)
$$;
revoke execute on function public.award_place_badges(text) from public;

-- Battles that already ended: recalculate their place badges with the new rule
delete from public.user_badges ub
using public.battles b
where ub.battle_id = b.id and b.finalized_at is not null
  and ub.source = 'auto' and ub.badge_id in ('badge_bulldog', 'badge_rat', 'badge_panda');

select public.award_place_badges(id) from public.battles where finalized_at is not null;

-- (The champion choice for place 1 is the same with both rules, so it stays as it is.)
