-- Make these people TESTERS (emails matched without caring about upper/lower case).
-- The result at the end shows every email: made tester, or not found.
with wanted(email) as (values
  ('xxjaninatorxx@gmail.com'),
  ('h.c.ziegler88@gmail.com'),
  ('chrilex1@gmx.de'),
  ('queenofterps@gmail.com'),
  ('s.riesenbeck@yahoo.com'),
  ('zzraggazz@yahoo.de'),
  ('krenzmrcel@gmail.com'),
  ('canucknomad@gmail.com'),
  ('growbotanik642@gmail.com')
),
made as (
  update public.profiles p
  set is_tester = true
  from auth.users u
  join wanted w on lower(u.email) = lower(w.email)
  where p.id = u.id
  returning lower(u.email) as email, p.display_name
)
select w.email,
       case when m.email is not null then '✅ tester'
            when exists (select 1 from auth.users u where lower(u.email) = lower(w.email)) then '⚠️ account without profile'
            else '❌ not found (not signed up yet?)' end as result,
       m.display_name
from wanted w
left join made m on m.email = lower(w.email)
order by (m.email is null), w.email;
