-- =====================================================================
-- BudBattles update 006: badges page, add badges in the app, trading prep
-- Paste into Supabase → SQL Editor → New query → Run. Run it once,
-- after 003_testers_and_badges.sql (004 and 005 are not required for this one).
-- =====================================================================

-- ---------- 1) Earned vs. tradeable ----------
-- earned    = won through the app (Welcome, Founding Member, places, Champion)
-- tradeable = may later be swapped badge-for-badge between members
--             (both confirm, no points or money). Earned badges never.
alter table public.badges add column earned boolean not null default false;
alter table public.badges add column tradeable boolean not null default false;
alter table public.badges add constraint earned_badges_not_tradeable check (not (earned and tradeable));

update public.badges set earned = true, tradeable = false
where id in ('badge_star', 'badge_heart', 'badge_bulldog', 'badge_rat', 'badge_panda',
             'badge_heir_son', 'badge_heir_daughter');

-- ---------- 2) Admins can add and edit badges in the app ----------
create policy "admin adds badges" on public.badges for insert to authenticated
  with check (public.is_admin());
create policy "admin edits badges" on public.badges for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant insert, update on public.badges to authenticated;

-- Badge pictures uploaded in the app (the app shrinks them to small icons first)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('badge-images', 'badge-images', true, 1048576, array['image/webp', 'image/png'])
on conflict (id) do nothing;

create policy "admin uploads badge images" on storage.objects for insert to authenticated
  with check (bucket_id = 'badge-images' and public.is_admin());
create policy "admin replaces badge images" on storage.objects for update to authenticated
  using (bucket_id = 'badge-images' and public.is_admin());
create policy "admin deletes badge images" on storage.objects for delete to authenticated
  using (bucket_id = 'badge-images' and public.is_admin());
