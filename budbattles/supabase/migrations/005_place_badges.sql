-- =====================================================================
-- BudBattles update 005: 1st / 2nd / 3rd place badges
-- Paste into Supabase → SQL Editor → New query → Run. Run it once,
-- after 004_automatic_badges.sql.
--   1st place = badge_bulldog · 2nd place = badge_rat · 3rd place = badge_panda
--   Ties share a place (1, 1, 3 – like the ranking). #1 still gets the champion popup.
-- =====================================================================

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'battles' and column_name = 'finalized_at') then
    raise exception 'Please run update 004 (004_automatic_badges.sql) first, then this one.';
  end if;
end $$;

-- Names and order (sort decides the order next to a name)
update public.badges set name_de = '1. Platz', name_en = '1st Place',
  description_de = 'Platz 1 in einem Battle.', description_en = '1st place in a battle.', active = true, sort = 10
  where id = 'badge_bulldog';
update public.badges set name_de = '2. Platz', name_en = '2nd Place',
  description_de = 'Platz 2 in einem Battle.', description_en = '2nd place in a battle.', active = true, sort = 11
  where id = 'badge_rat';
update public.badges set name_de = '3. Platz', name_en = '3rd Place',
  description_de = 'Platz 3 in einem Battle.', description_en = '3rd place in a battle.', active = true, sort = 12
  where id = 'badge_panda';

-- Hands out the place badges of one battle (safe to repeat)
create function public.award_place_badges(p_battle text)
returns void language sql security definer set search_path = public as $$
  with counted as (
    select e.user_id, (select count(*) from public.votes v where v.entry_id = e.id) as votes
    from public.entries e
    where e.battle_id = p_battle and e.status = 'approved'
  ),
  ranked as (
    select user_id, votes, rank() over (order by votes desc) as place from counted
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

-- Same protection for the champion badge (rest as in update 004)
create or replace function public.choose_champion_badge(p_battle text, p_badge text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if p_badge not in ('badge_heir_son', 'badge_heir_daughter') then
    raise exception 'invalid_badge';
  end if;
  update public.champion_choices
  set chosen_badge = p_badge, chosen_at = now()
  where battle_id = p_battle and user_id = auth.uid() and chosen_badge is null;
  if not found then
    raise exception 'no_open_choice';
  end if;
  delete from public.user_badges
  where user_id = auth.uid() and badge_id in ('badge_heir_son', 'badge_heir_daughter') and badge_id <> p_badge;
  insert into public.user_badges (user_id, badge_id, source, battle_id)
  values (auth.uid(), p_badge, 'auto', p_battle)
  on conflict (user_id, badge_id) do update set battle_id = excluded.battle_id
    where public.user_badges.battle_id in (select id from public.battles where is_test)
      and excluded.battle_id in (select id from public.battles where not is_test);
  return p_badge;
end $$;

-- Same as in update 004, but with one badge per place
create or replace function public.finalize_ended_battles()
returns int language plpgsql security definer set search_path = public as $$
declare
  b record;
  done int := 0;
begin
  for b in
    select id from public.battles
    where finalized_at is null and voting_ends_at <= now()
    for update skip locked
  loop
    perform public.award_place_badges(b.id);

    insert into public.champion_choices (battle_id, user_id)
    select b.id, ranked.user_id
    from (select e.user_id,
                 (select count(*) from public.votes v where v.entry_id = e.id) as votes,
                 rank() over (order by (select count(*) from public.votes v where v.entry_id = e.id) desc) as place
          from public.entries e
          where e.battle_id = b.id and e.status = 'approved') ranked
    where ranked.place = 1 and ranked.votes > 0
    on conflict do nothing;

    update public.battles set finalized_at = now() where id = b.id;
    done := done + 1;
  end loop;
  return done;
end $$;

-- Battles that already ended: replace the old automatic "Top 3" badges with place badges
delete from public.user_badges ub
using public.battles b
where ub.battle_id = b.id and b.finalized_at is not null
  and ub.source = 'auto' and ub.badge_id in ('badge_bulldog', 'badge_rat', 'badge_panda');

select public.award_place_badges(id) from public.battles where finalized_at is not null;
