-- =====================================================================
-- BudBattles update 032: test battles never hand out badges
-- Paste into Supabase → SQL Editor → New query → Run. Run once, after 031. Safe to run again.
--   • When a TEST battle ends, no 1st/2nd/3rd Place and no Battle Champion choice
--   • Open champion choices from test battles are removed (no "pick your badge" pop-up)
--   (Founding Member already ignored test battles.)
-- =====================================================================

create or replace function public.finalize_ended_battles()
returns int language plpgsql security definer set search_path = public as $$
declare
  b record;
  done int := 0;
begin
  for b in
    select id, is_test from public.battles
    where finalized_at is null and voting_ends_at <= now()
    for update skip locked
  loop
    if not b.is_test then
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
    end if;

    update public.battles set finalized_at = now() where id = b.id;
    done := done + 1;
  end loop;
  return done;
end $$;

delete from public.champion_choices c
using public.battles b
where b.id = c.battle_id and b.is_test and c.chosen_badge is null;
