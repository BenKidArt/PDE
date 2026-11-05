-- =====================================================================
-- BudBattles update 004: automatic badges
-- Paste into Supabase → SQL Editor → New query → Run. Run it once,
-- after 003_testers_and_badges.sql. After this, no SQL is needed for:
--   • Founding Member: one of the first 25 Battle #1 entries gets approved
--   • Top 3:           places 1–3 when a battle's voting has ended
--   • Battle Champion: the #1 picks son or daughter in the app
-- =====================================================================

-- Champion badges (in case the earlier award snippet was never run)
insert into public.badges (id, image, name_de, name_en, description_de, description_en, kind, active, sort) values
  ('badge_heir_son',      'assets/badges/badge_heir_son.webp',      'Battle-Champion', 'Battle Champion', 'Top-Foto eines Battles.', 'Top photo of a battle.', 'award', true, 5),
  ('badge_heir_daughter', 'assets/badges/badge_heir_daughter.webp', 'Battle-Champion', 'Battle Champion', 'Top-Foto eines Battles.', 'Top photo of a battle.', 'award', true, 5)
on conflict (id) do nothing;

-- Which battle an automatic badge came from. Deleting a battle (e.g. the
-- test battle) also removes the badges it handed out.
alter table public.user_badges add column battle_id text references public.battles (id) on delete cascade;

-- ---------- 1) Founding Member: first 25 entries of Battle #1 ----------
create function public.award_founding_member()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  place int;
begin
  if new.status <> 'approved' or (tg_op = 'UPDATE' and old.status = 'approved') then
    return new;
  end if;
  if not exists (select 1 from public.battles b where b.id = new.battle_id and b.number = 1 and not b.is_test) then
    return new;
  end if;
  -- place by submission time, rejected entries don't count
  select count(*) into place
  from public.entries e
  where e.battle_id = new.battle_id and e.status <> 'rejected'
    and (e.created_at, e.id) <= (new.created_at, new.id);
  if place <= 25 then
    insert into public.user_badges (user_id, badge_id, source, battle_id)
    values (new.user_id, 'badge_heart', 'auto', new.battle_id)
    on conflict do nothing;
  end if;
  return new;
end $$;

create trigger entries_founding_member
  after insert or update of status on public.entries
  for each row execute function public.award_founding_member();

-- entries approved before this update
insert into public.user_badges (user_id, badge_id, source, battle_id)
select e.user_id, 'badge_heart', 'auto', e.battle_id
from public.entries e
join public.battles b on b.id = e.battle_id and b.number = 1 and not b.is_test
where e.status = 'approved'
  and (select count(*) from public.entries x
       where x.battle_id = e.battle_id and x.status <> 'rejected'
         and (x.created_at, x.id) <= (e.created_at, e.id)) <= 25
on conflict do nothing;

-- ---------- 2) When voting has ended: Top 3 + champion choice ----------
alter table public.battles add column finalized_at timestamptz;

create table public.champion_choices (
  battle_id text not null references public.battles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  chosen_badge text check (chosen_badge in ('badge_heir_son', 'badge_heir_daughter')),
  chosen_at timestamptz,
  primary key (battle_id, user_id)
);
alter table public.champion_choices enable row level security;
create policy "own champion choices" on public.champion_choices for select
  using (user_id = auth.uid() or public.is_admin());
grant select on public.champion_choices to authenticated;

-- Runs once per battle after voting ended. Safe to call any number of times;
-- the app calls it whenever someone opens it.
create function public.finalize_ended_battles()
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
    with ranked as (
      select e.user_id,
             rank() over (order by (select count(*) from public.votes v where v.entry_id = e.id) desc) as place,
             (select count(*) from public.votes v where v.entry_id = e.id) as votes
      from public.entries e
      where e.battle_id = b.id and e.status = 'approved'
    ),
    top3 as (
      insert into public.user_badges (user_id, badge_id, source, battle_id)
      select user_id, 'badge_bulldog', 'auto', b.id from ranked where place <= 3 and votes > 0
      on conflict do nothing
    )
    insert into public.champion_choices (battle_id, user_id)
    select b.id, user_id from ranked where place = 1 and votes > 0
    on conflict do nothing;

    update public.battles set finalized_at = now() where id = b.id;
    done := done + 1;
  end loop;
  return done;
end $$;

-- The logged-in member's champion choices that are still open
create function public.my_pending_champion()
returns table (battle_id text, number int, is_test boolean, theme_de text, theme_en text)
language sql stable security definer set search_path = public as $$
  select c.battle_id, b.number, b.is_test, b.theme_de, b.theme_en
  from public.champion_choices c
  join public.battles b on b.id = c.battle_id
  where c.user_id = auth.uid() and c.chosen_badge is null
  order by c.created_at
$$;

-- The champion picks son or daughter; the badge is given right away.
create function public.choose_champion_badge(p_battle text, p_badge text)
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
  -- one version per person
  delete from public.user_badges
  where user_id = auth.uid() and badge_id in ('badge_heir_son', 'badge_heir_daughter') and badge_id <> p_badge;
  insert into public.user_badges (user_id, badge_id, source, battle_id)
  values (auth.uid(), p_badge, 'auto', p_battle)
  on conflict (user_id, badge_id) do nothing;
  return p_badge;
end $$;

revoke execute on function public.finalize_ended_battles(), public.my_pending_champion(),
  public.choose_champion_badge(text, text) from public;
grant execute on function public.finalize_ended_battles() to anon, authenticated;
grant execute on function public.my_pending_champion(), public.choose_champion_badge(text, text) to authenticated;

-- Battles that already ended before this update are handled now
select public.finalize_ended_battles();
