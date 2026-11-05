-- Make someone a TESTER (can use hidden test battles, no admin powers).
-- 1. Replace the email below.  2. Run.  You should see 1 row with is_tester = true.
update public.profiles
set is_tester = true
where id = (select id from auth.users where lower(email) = lower('your@email.com'))
returning display_name, is_tester;

-- To remove the tester role again, run the same with "set is_tester = false".
