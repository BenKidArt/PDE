-- =====================================================================
-- BudBattles update 017: profile look
--   – background picture and underbanner (a preset or your own upload)
--   – Christmas Eve background on 24.12 can be switched off
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run again.
-- Does not touch battles, entries or votes.
-- =====================================================================

-- Values: ''                       = none
--         'p:<name>'               = one of the app's presets (assets/profile/…)
--         'u:<member id>/<file>'   = your own upload (storage bucket "profile-images")
alter table public.profiles add column if not exists bg_image text not null default '';
alter table public.profiles add column if not exists banner_image text not null default '';
alter table public.profiles add column if not exists xmas_bg boolean not null default true;

create or replace function public.bb_look_valid(v text, owner uuid)
returns boolean language sql immutable as $$
  select v = ''
      or v ~ '^p:[a-z0-9_]{1,40}$'
      or (v ~ '^u:[0-9a-f-]{36}/[a-z0-9_-]{1,60}\.(webp|jpg)$' and split_part(substr(v, 3), '/', 1) = owner::text)
$$;
alter table public.profiles drop constraint if exists bg_image_valid;
alter table public.profiles add constraint bg_image_valid check (public.bb_look_valid(bg_image, id));
alter table public.profiles drop constraint if exists banner_image_valid;
alter table public.profiles add constraint banner_image_valid check (public.bb_look_valid(banner_image, id));

-- Save your own look
create or replace function public.save_profile_look(p_bg text, p_banner text, p_xmas boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  if not public.bb_look_valid(coalesce(p_bg, ''), auth.uid()) or not public.bb_look_valid(coalesce(p_banner, ''), auth.uid()) then
    raise exception 'look_invalid';
  end if;
  update public.profiles set bg_image = coalesce(p_bg, ''), banner_image = coalesce(p_banner, ''), xmas_bg = coalesce(p_xmas, true)
  where id = auth.uid();
end $$;
revoke execute on function public.save_profile_look(text, text, boolean) from public;
grant execute on function public.save_profile_look(text, text, boolean) to authenticated;

-- Anyone's look (shown on their public profile; nothing private)
create or replace function public.get_profile_look(p_key text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('bg', p.bg_image, 'banner', p.banner_image, 'xmas', p.xmas_bg)
  from public.profiles p
  where lower(p.username) = lower(p_key) or p.id::text = p_key
  limit 1
$$;
revoke execute on function public.get_profile_look(text) from public;
grant execute on function public.get_profile_look(text) to anon, authenticated;

-- Own uploads: <member id>/<file>.webp or .jpg, up to 700 KB (the app compresses them first)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-images', 'profile-images', true, 716800, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "profile image upload into own folder" on storage.objects;
create policy "profile image upload into own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "profile image delete own or admin" on storage.objects;
create policy "profile image delete own or admin" on storage.objects for delete to authenticated
  using (bucket_id = 'profile-images' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
