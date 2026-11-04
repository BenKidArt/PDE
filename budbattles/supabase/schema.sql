-- =====================================================================
-- BudBattles database setup for Supabase
-- How to use: Supabase dashboard → SQL Editor → New query → paste this
-- whole file → Run. Safe to run once on a fresh project.
-- =====================================================================

-- ---------- Settings: switches you can flip in the Table Editor ----------
create table public.settings (
  id int primary key default 1 check (id = 1),   -- exactly one row
  show_partner boolean not null default true,
  show_prize   boolean not null default true,
  show_strain  boolean not null default true
);
insert into public.settings (id) values (1);

-- ---------- Profiles (one per member) ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  is_admin boolean not null default false,
  age_confirmed_at timestamptz not null,
  terms_accepted_at timestamptz not null,
  terms_version text not null,
  created_at timestamptz not null default now()
);

-- Creates the profile when someone signs up. Sign-up FAILS unless the
-- 18+ box and the terms box were ticked.
create function public.handle_new_user()
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
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- ---------- Battles ----------
-- Edit these in the Table Editor. Rules: one rule per line.
-- Leave prize / partner fields empty to hide them for that battle.
create table public.battles (
  id text primary key check (id ~ '^[a-z0-9-]+$'),   -- e.g. 2026-12-winter
  theme_de text not null,
  theme_en text not null,
  summary_de text not null default '',
  summary_en text not null default '',
  prize_de text not null default '',
  prize_en text not null default '',
  partner_name text not null default '',
  partner_logo_url text not null default '',
  partner_url text not null default '',
  rules_de text not null default '',
  rules_en text not null default '',
  start_at timestamptz not null,
  entries_close_at timestamptz not null,
  voting_ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (start_at < entries_close_at and entries_close_at < voting_ends_at)
);

-- ---------- Entries (one photo per grower per battle) ----------
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  battle_id text not null references public.battles (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  photo_path text not null,
  width int not null check (width > 0),
  height int not null check (height > 0),
  strain text check (strain is null or char_length(strain) <= 60),
  description text not null default '' check (char_length(description) <= 280),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (battle_id, user_id)
);
create index entries_battle_status on public.entries (battle_id, status);

-- ---------- Votes (one vote per member per battle) ----------
create table public.votes (
  battle_id text not null references public.battles (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  entry_id uuid not null references public.entries (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (battle_id, user_id)
);
create index votes_entry on public.votes (entry_id);

-- ---------- Security: who may see and change what ----------
alter table public.settings enable row level security;
alter table public.profiles enable row level security;
alter table public.battles  enable row level security;
alter table public.entries  enable row level security;
alter table public.votes    enable row level security;

create policy "settings readable by all" on public.settings for select using (true);
create policy "battles readable by all"  on public.battles  for select using (true);

create policy "own profile readable" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy "own profile editable" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Everyone sees approved photos; you also see your own; admin sees all.
create policy "entries readable" on public.entries for select
  using (status = 'approved' or user_id = auth.uid() or public.is_admin());
-- Members may enter only while entries are open, and always start as pending.
create policy "enter while open" on public.entries for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and reviewed_at is null
    and exists (select 1 from public.battles b
                where b.id = battle_id and now() >= b.start_at and now() < b.entries_close_at)
  );
-- Only the admin can approve / reject.
create policy "admin reviews" on public.entries for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- Members may withdraw their own entry while entries are open; admin may always delete.
create policy "withdraw own or admin" on public.entries for delete to authenticated
  using (
    public.is_admin()
    or (user_id = auth.uid() and exists (select 1 from public.battles b
         where b.id = battle_id and now() < b.entries_close_at))
  );

-- Votes are private; only totals are public (see get_standings below).
create policy "own votes readable" on public.votes for select using (user_id = auth.uid());
create policy "vote during voting" on public.votes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.battles b
                where b.id = battle_id and now() >= b.entries_close_at and now() < b.voting_ends_at)
    and exists (select 1 from public.entries e
                where e.id = entry_id and e.battle_id = votes.battle_id
                  and e.status = 'approved' and e.user_id <> auth.uid())
  );

-- Table permissions (Row Level Security above narrows these down further).
grant usage on schema public to anon, authenticated;
grant select on public.settings, public.battles to anon, authenticated;
grant select, insert, delete on public.entries to authenticated;
grant update (status, reviewed_at) on public.entries to authenticated;
grant select, insert on public.votes to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

-- ---------- Public numbers without exposing private data ----------
-- Number of entries in a battle (pending + approved).
create function public.entry_count(p_battle text)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.entries where battle_id = p_battle and status <> 'rejected'
$$;

-- Live ranking: approved entries with vote totals and the grower's name.
create function public.get_standings(p_battle text)
returns table (entry_id uuid, photo_path text, width int, height int, strain text,
               description text, display_name text, votes int)
language sql stable security definer set search_path = public as $$
  select e.id, e.photo_path, e.width, e.height, e.strain, e.description, p.display_name,
         (select count(*)::int from public.votes v where v.entry_id = e.id) as votes
  from public.entries e
  join public.profiles p on p.id = e.user_id
  where e.battle_id = p_battle and e.status = 'approved'
  order by votes desc, e.created_at asc
$$;

revoke execute on function public.entry_count(text), public.get_standings(text), public.is_admin() from public;
grant execute on function public.entry_count(text), public.get_standings(text) to anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------- Photo storage ----------
-- Photos are stored as  <member id>/<random id>.jpg  and only JPEG up to 5 MB
-- is accepted (the app always sends a cleaned JPEG without GPS).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('entry-photos', 'entry-photos', true, 5242880, array['image/jpeg']);

create policy "upload into own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'entry-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own photo or admin" on storage.objects for delete to authenticated
  using (bucket_id = 'entry-photos'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ---------- First battle (example, edit or delete in the Table Editor) ----------
insert into public.battles (id, theme_de, theme_en, summary_de, summary_en, prize_de, prize_en,
  partner_name, partner_logo_url, partner_url, rules_de, rules_en, start_at, entries_close_at, voting_ends_at)
values (
  '2026-11-frost',
  'Frost & Farben', 'Frost & Colours',
  'Zeig uns die schönsten Farben deiner Pflanze in der späten Blüte: Lila, Pink, Orange, alles ist erlaubt.',
  'Show us your plant''s best colours in late flower: purple, pink, orange, anything goes.',
  'Ein Growzelt-Set (nur Zubehör, keine Samen oder Pflanzen), gestellt vom Partner.',
  'A grow tent kit (accessories only, no seeds or plants), provided by the partner.',
  '', '', '',
  E'Teilnahme ab 18 Jahren mit bestätigter E-Mail-Adresse.\nEin Foto pro Grower und Battle.\nNur eigene Fotos von legalem Eigenanbau (KCanG).\nKeine Personen, Adressen, Kennzeichen oder Verkaufsangebote auf dem Foto.\nJedes Foto wird vor der Veröffentlichung geprüft.\nEin Vote pro Mitglied und Battle. Die meisten Stimmen gewinnen.',
  E'You must be 18+ with a confirmed email address.\nOne photo per grower per battle.\nOnly your own photos of a legal home grow (German KCanG).\nNo people, addresses, licence plates or sales offers in the photo.\nEvery photo is reviewed before it is published.\nOne vote per member per battle. Most votes wins.',
  '2026-11-01 00:00+01', '2026-11-21 23:59+01', '2026-11-30 23:59+01'
);
