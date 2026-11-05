-- =====================================================================
-- BudBattles update 002: hidden test battles (admins only)
-- Paste into Supabase → SQL Editor → New query → Run. Run it once.
-- Battle #1 is not changed.
-- =====================================================================

-- 1) Battles can be marked as test battles (default: normal battle)
alter table public.battles add column is_test boolean not null default false;

-- 2) Test battles are visible to admins only
grant execute on function public.is_admin() to anon;  -- returns false for visitors
drop policy "battles readable by all" on public.battles;
create policy "battles readable" on public.battles for select
  using (not is_test or public.is_admin());

-- 3) Public numbers never include test battles (unless you are admin)
create or replace function public.entry_count(p_battle text)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
  from public.entries e
  join public.battles b on b.id = e.battle_id
  where e.battle_id = p_battle and e.status <> 'rejected'
    and (not b.is_test or public.is_admin())
$$;

create or replace function public.get_standings(p_battle text)
returns table (entry_id uuid, photo_path text, width int, height int, strain text,
               description text, display_name text, votes int, is_mine boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select e.id, e.photo_path, e.width, e.height, e.strain, e.description, p.display_name,
         (select count(*)::int from public.votes v where v.entry_id = e.id) as votes,
         coalesce(e.user_id = auth.uid(), false), e.created_at
  from public.entries e
  join public.profiles p on p.id = e.user_id
  join public.battles b on b.id = e.battle_id
  where e.battle_id = p_battle and e.status = 'approved'
    and (not b.is_test or public.is_admin())
  order by votes desc, e.created_at asc
$$;

create or replace function public.latest_entries(p_limit int default 6)
returns table (entry_id uuid, battle_id text, photo_path text, width int, height int,
               strain text, display_name text)
language sql stable security definer set search_path = public as $$
  select e.id, e.battle_id, e.photo_path, e.width, e.height, e.strain, p.display_name
  from public.entries e
  join public.profiles p on p.id = e.user_id
  join public.battles b on b.id = e.battle_id
  where e.status = 'approved' and not b.is_test
  order by coalesce(e.reviewed_at, e.created_at) desc
  limit least(greatest(p_limit, 1), 24)
$$;

-- 4) The test battle: entries open now, voting opens in 30 minutes, ends in 24 hours
insert into public.battles (id, number, is_test, theme_de, theme_en, summary_de, summary_en,
  rules_de, rules_en, start_at, entries_close_at, voting_ends_at)
values (
  'test-battle', null, true,
  'Test-Battle', 'Test Battle',
  'Nur für Admins sichtbar. Zum Ausprobieren von Upload, Freigabe und Abstimmung.',
  'Only visible to admins. For trying out uploads, reviews and voting.',
  E'Ein Foto pro Grower und Battle.\nEin Vote pro Mitglied und Battle. Für das eigene Foto kann man nicht stimmen.',
  E'One photo per grower per battle.\nOne vote per member per battle. You can''t vote for your own photo.',
  now() - interval '1 minute',
  now() + interval '30 minutes',
  now() + interval '1 day'
);
