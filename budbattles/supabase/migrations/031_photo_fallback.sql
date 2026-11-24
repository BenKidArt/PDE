-- =====================================================================
-- BudBattles update 031: photo upload fallback + photo problem log
-- Paste into Supabase → SQL Editor → New query → Run. Run once, after 030. Safe to run again.
--
--   • When a phone can't clean a photo itself, the ORIGINAL goes into a PRIVATE folder
--     (entry-originals: only the grower and admins can open it). The entry is marked
--     photo_raw = true and can't be approved until the Admin page has cleaned it
--     (GPS & co. removed) and moved the clean JPEG into the public photo folder.
--   • photo_issues: what went wrong on which phone (file type, size, steps) – admins only.
-- =====================================================================

-- private folder for originals (max 40 MB, any picture type)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('entry-originals', 'entry-originals', false, 41943040, null)
on conflict (id) do update set public = false, file_size_limit = 41943040, allowed_mime_types = null;

drop policy if exists "originals: upload own" on storage.objects;
create policy "originals: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'entry-originals' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "originals: read own or admin" on storage.objects;
create policy "originals: read own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'entry-originals' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "originals: delete own or admin" on storage.objects;
create policy "originals: delete own or admin" on storage.objects for delete to authenticated
  using (bucket_id = 'entry-originals' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- admins may put the cleaned photo into the grower's folder of the public photo folder
drop policy if exists "admin uploads entry photos" on storage.objects;
create policy "admin uploads entry photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'entry-photos' and public.is_admin());

alter table public.entries add column if not exists photo_raw boolean not null default false;

-- a photo that still has its metadata can never be approved
create or replace function public.entries_block_raw_approval() returns trigger
language plpgsql as $$
begin
  if new.status = 'approved' and new.photo_raw then
    raise exception 'photo not cleaned yet';
  end if;
  return new;
end $$;
drop trigger if exists entries_block_raw_approval on public.entries;
create trigger entries_block_raw_approval before insert or update on public.entries
  for each row execute function public.entries_block_raw_approval();

/** Admin page: the original was cleaned → point the entry to the clean public JPEG. Returns the old private path. */
create or replace function public.admin_finish_clean(p_entry uuid, p_path text, p_width int, p_height int) returns text
language plpgsql security definer set search_path = public as $$
declare old text;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  select photo_path into old from public.entries where id = p_entry and photo_raw for update;
  if old is null then raise exception 'not a raw photo'; end if;
  update public.entries set photo_path = p_path, width = greatest(1, p_width), height = greatest(1, p_height), photo_raw = false
  where id = p_entry;
  return old;
end $$;
revoke execute on function public.admin_finish_clean(uuid, text, int, int) from public, anon;
grant execute on function public.admin_finish_clean(uuid, text, int, int) to authenticated;

-- what went wrong while preparing a photo (helps to find phone-specific problems)
create table if not exists public.photo_issues (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid() references public.profiles (id) on delete set null,
  outcome text not null check (char_length(outcome) <= 20),   -- 'heic' | 'bytes' | 'raw' | 'failed' | 'admin-failed'
  kind text check (char_length(kind) <= 10),                   -- jpeg / heic / png / …
  mime text check (char_length(mime) <= 60),
  size_kb int,
  steps text check (char_length(steps) <= 600),
  device text check (char_length(device) <= 300),
  created_at timestamptz not null default now()
);
alter table public.photo_issues enable row level security;
drop policy if exists "log own photo issues" on public.photo_issues;
create policy "log own photo issues" on public.photo_issues for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "admins read photo issues" on public.photo_issues;
create policy "admins read photo issues" on public.photo_issues for select to authenticated using (public.is_admin());
