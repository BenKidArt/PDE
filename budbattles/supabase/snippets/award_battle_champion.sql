-- =====================================================================
-- BATTLE CHAMPION badge for a battle winner (son or daughter version).
-- 1. Replace the email.
-- 2. Ask the winner which version they want and set it:
--      'badge_heir_son'  or  'badge_heir_daughter'
-- 3. Run. You should see 1 row (the badge they now have).
--    0 rows = email not found.
-- Safe to run again: for every new winner, or to switch the version.
-- =====================================================================

-- Adds the two badges the first time (does nothing after that)
insert into public.badges (id, image, name_de, name_en, description_de, description_en, kind, active, sort) values
  ('badge_heir_son',      'assets/badges/badge_heir_son.webp',      'Battle-Champion', 'Battle Champion', 'Top-Foto eines Battles.', 'Top photo of a battle.', 'award', true, 5),
  ('badge_heir_daughter', 'assets/badges/badge_heir_daughter.webp', 'Battle-Champion', 'Battle Champion', 'Top-Foto eines Battles.', 'Top photo of a battle.', 'award', true, 5)
on conflict (id) do nothing;

with choice as (
  select u.id as user_id, 'badge_heir_son'::text as badge_id      -- ← son or daughter
  from auth.users u
  where lower(u.email) = lower('winner@email.com')                  -- ← the winner's email
),
remove_other as (                                                   -- only one version per person
  delete from public.user_badges ub
  using choice c
  where ub.user_id = c.user_id
    and ub.badge_id in ('badge_heir_son', 'badge_heir_daughter')
    and ub.badge_id <> c.badge_id
)
insert into public.user_badges (user_id, badge_id, source)
select user_id, badge_id, 'award' from choice
on conflict (user_id, badge_id) do update set awarded_at = public.user_badges.awarded_at
returning badge_id;
