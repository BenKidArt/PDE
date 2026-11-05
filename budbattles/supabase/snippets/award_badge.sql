-- Give a BADGE to someone.
-- 1. Replace the email and pick the badge:
--      badge_star = Welcome · badge_heart = Founding Member
--      badge_bulldog = 1st Place · badge_rat = 2nd Place · badge_panda = 3rd Place
--      (Founding Member and the places are normally given automatically)
-- 2. Run. You should see 1 row (the badge). 0 rows = email not found or badge already given.
insert into public.user_badges (user_id, badge_id, source)
select u.id, 'badge_heart', 'award'
from auth.users u
where lower(u.email) = lower('their@email.com')
on conflict do nothing
returning badge_id;

-- Take a badge away again (remove the two dashes at the start of each line to use it):
-- delete from public.user_badges
-- where badge_id = 'badge_heart'
--   and user_id = (select id from auth.users where lower(email) = lower('their@email.com'));

-- Founding Member for the first 25 Battle #1 entries (oldest first), in one go:
-- insert into public.user_badges (user_id, badge_id, source)
-- select user_id, 'badge_heart', 'award'
-- from (select user_id from public.entries
--       where battle_id = 'battle-1-frostiest-bud' and status <> 'rejected'
--       order by created_at limit 25) first25
-- on conflict do nothing;
