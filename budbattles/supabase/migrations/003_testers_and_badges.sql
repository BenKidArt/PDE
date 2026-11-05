-- =====================================================================
-- BudBattles update 003: tester role + badges
-- Paste into Supabase → SQL Editor → New query → Run. Run it once,
-- after 002_test_battles.sql. Battle #1 is not changed.
-- =====================================================================

-- ---------- 1) Tester role ----------
-- Testers can see and use hidden test battles (enter, vote) but have no admin powers.
alter table public.profiles add column is_tester boolean not null default false;

-- true for admins and testers
create function public.can_test()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin or is_tester from public.profiles where id = auth.uid()), false)
$$;
revoke execute on function public.can_test() from public;
grant execute on function public.can_test() to anon, authenticated;  -- returns false for visitors

drop policy "battles readable" on public.battles;
create policy "battles readable" on public.battles for select
  using (not is_test or public.can_test());

create or replace function public.entry_count(p_battle text)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
  from public.entries e
  join public.battles b on b.id = e.battle_id
  where e.battle_id = p_battle and e.status <> 'rejected'
    and (not b.is_test or public.can_test())
$$;

-- ---------- 2) Badges ----------
-- kind 'award'   = only given by an admin (or automatically), price_points stays empty
-- kind 'buyable' = can later be bought for price_points (points are not built yet)
create table public.badges (
  id text primary key check (id ~ '^[a-z0-9_]+$'),
  image text not null,
  name_de text not null,
  name_en text not null,
  description_de text not null default '',
  description_en text not null default '',
  kind text not null default 'award' check (kind in ('award', 'buyable')),
  price_points int,
  active boolean not null default true,      -- inactive badges are never shown
  sort int not null default 100,             -- order next to a name (small first)
  check ((kind = 'award' and price_points is null) or (kind = 'buyable' and price_points is not null and price_points > 0))
);

create table public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_id text not null references public.badges (id) on delete cascade,
  source text not null default 'award' check (source in ('auto', 'award', 'purchase')),
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);
create index user_badges_user on public.user_badges (user_id);

alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
create policy "badges readable by all" on public.badges for select using (true);
create policy "own badges readable" on public.user_badges for select
  using (user_id = auth.uid() or public.is_admin());
create policy "admin awards badges" on public.user_badges for insert to authenticated
  with check (public.is_admin());
create policy "admin removes badges" on public.user_badges for delete to authenticated
  using (public.is_admin());
grant select on public.badges to anon, authenticated;
grant select, insert, delete on public.user_badges to authenticated;

insert into public.badges (id, image, name_de, name_en, description_de, description_en, kind, active, sort) values
  ('badge_star',    'assets/badges/badge_star.webp',    'Willkommen',        'Welcome',         'Für alle, die sich registriert haben.', 'For everyone who signed up.', 'award', true, 30),
  ('badge_heart',   'assets/badges/badge_heart.webp',   'Gründungsmitglied', 'Founding Member', 'Eine der ersten 25 Einsendungen in Battle #1.', 'One of the first 25 entries in Battle #1.', 'award', true, 20),
  ('badge_bulldog', 'assets/badges/badge_bulldog.webp', 'Top 3',             'Top 3',           'Unter den besten drei eines Battles.', 'Finished in the top three of a battle.', 'award', true, 10),
  -- uploaded, not used yet (inactive until you give them a name and switch them on)
  ('badge_monkey',  'assets/badges/badge_monkey.webp',  'Monkey',  'Monkey',  '', '', 'award', false, 100),
  ('badge_skunk',   'assets/badges/badge_skunk.webp',   'Skunk',   'Skunk',   '', '', 'award', false, 100),
  ('badge_panda',   'assets/badges/badge_panda.webp',   'Panda',   'Panda',   '', '', 'award', false, 100),
  ('badge_octopus', 'assets/badges/badge_octopus.webp', 'Octopus', 'Octopus', '', '', 'award', false, 100),
  ('badge_rat',     'assets/badges/badge_rat.webp',     'Rat',     'Rat',     '', '', 'award', false, 100),
  ('badge_mobster', 'assets/badges/badge_mobster.webp', 'Mobster', 'Mobster', '', '', 'award', false, 100);

-- "Welcome" for every new member, automatically at sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce((new.raw_user_meta_data ->> 'age_confirmed')::boolean, false) is not true then
    raise exception 'age_confirmation_required';
  end if;
  if coalesce(new.raw_user_meta_data ->> 'terms_version', '') = '' then
    raise exception 'terms_acceptance_required';
  end if;
  insert into public.profiles (id, display_name, age_confirmed_at, terms_accepted_at, terms_version)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Grower'), 40),
    now(), now(),
    new.raw_user_meta_data ->> 'terms_version'
  );
  insert into public.user_badges (user_id, badge_id, source) values (new.id, 'badge_star', 'auto')
    on conflict do nothing;
  return new;
end $$;

-- ... and for everyone who is already a member
insert into public.user_badges (user_id, badge_id, source)
  select id, 'badge_star', 'auto' from public.profiles
  on conflict do nothing;

-- ---------- 3) Standings now include each grower's badges ----------
drop function public.get_standings(text);
create function public.get_standings(p_battle text)
returns table (entry_id uuid, photo_path text, width int, height int, strain text,
               description text, display_name text, votes int, is_mine boolean,
               created_at timestamptz, badges text[])
language sql stable security definer set search_path = public as $$
  select e.id, e.photo_path, e.width, e.height, e.strain, e.description, p.display_name,
         (select count(*)::int from public.votes v where v.entry_id = e.id) as votes,
         coalesce(e.user_id = auth.uid(), false), e.created_at,
         coalesce((select array_agg(ub.badge_id order by bd.sort, ub.awarded_at)
                   from public.user_badges ub join public.badges bd on bd.id = ub.badge_id
                   where ub.user_id = e.user_id and bd.active), '{}')
  from public.entries e
  join public.profiles p on p.id = e.user_id
  join public.battles b on b.id = e.battle_id
  where e.battle_id = p_battle and e.status = 'approved'
    and (not b.is_test or public.can_test())
  order by votes desc, e.created_at asc
$$;
revoke execute on function public.get_standings(text) from public;
grant execute on function public.get_standings(text) to anon, authenticated;
