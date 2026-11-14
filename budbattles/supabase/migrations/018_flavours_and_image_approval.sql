-- =====================================================================
-- BudBattles update 018:
--   1) 21 favourite flavours (was 6)
--   2) Own profile pictures (background / underbanner) need admin approval:
--      until then the member keeps the current picture; rejected = deleted + short note.
--      Presets need no approval.
-- Paste into Supabase → SQL Editor → New query → Run. Run it after 017. Safe to run again.
-- Does not touch battles, entries or votes.
-- =====================================================================

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profiles' and column_name = 'bg_image') then
    raise exception 'Please run update 017 (017_profile_look.sql) first, then this one.';
  end if;
end $$;

-- ---------- 1) Flavours ----------
alter table public.profiles drop constraint if exists flavours_values;
alter table public.profiles add constraint flavours_values check (flavours is null or flavours <@ array[
  'sweet', 'candy', 'creamy', 'chocolate', 'fruity', 'berry', 'tropical', 'citrus', 'sour',
  'earthy', 'herbal', 'woody', 'pine', 'floral', 'mint', 'gassy', 'skunk', 'cheese', 'haze', 'spicy', 'savory']);

-- ---------- 2) Approval of own pictures ----------
create table if not exists public.profile_image_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('bg', 'banner')),
  path text not null,                               -- '<member id>/<file>' in the bucket "profile-images"
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'replaced')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  seen boolean not null default false               -- the member has seen the result note
);
alter table public.profile_image_reviews enable row level security;   -- only through the functions below
create unique index if not exists profile_image_one_pending on public.profile_image_reviews (user_id, kind) where status = 'pending';

-- Member: send an uploaded picture for approval. Returns the path of a picture it replaces (to delete).
create or replace function public.submit_profile_image(p_kind text, p_value text)
returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  old_path text;
begin
  if me is null then raise exception 'login_required'; end if;
  if p_kind not in ('bg', 'banner') or coalesce(p_value, '') not like 'u:%' or not public.bb_look_valid(p_value, me) then
    raise exception 'look_invalid';
  end if;
  update public.profile_image_reviews set status = 'replaced', reviewed_at = now()
  where user_id = me and kind = p_kind and status = 'pending'
  returning path into old_path;
  insert into public.profile_image_reviews (user_id, kind, path) values (me, p_kind, substr(p_value, 3));
  return old_path;
end $$;
revoke execute on function public.submit_profile_image(text, text) from public;
grant execute on function public.submit_profile_image(text, text) to authenticated;

-- Member: the latest review per kind (waiting / approved / rejected) for the notes in the app
create or replace function public.my_image_reviews()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', r.id, 'kind', r.kind, 'path', r.path, 'status', r.status, 'seen', r.seen)), '[]'::json)
  from (select distinct on (kind) * from public.profile_image_reviews
        where user_id = auth.uid() and status <> 'replaced' order by kind, created_at desc) r
$$;
revoke execute on function public.my_image_reviews() from public;
grant execute on function public.my_image_reviews() to authenticated;

create or replace function public.ack_image_review(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.profile_image_reviews set seen = true where id = p_id and user_id = auth.uid()
$$;
revoke execute on function public.ack_image_review(uuid) from public;
grant execute on function public.ack_image_review(uuid) to authenticated;

-- Admin: list (pending first) and approve / reject
create or replace function public.admin_image_reviews()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return coalesce((select json_agg(json_build_object(
      'id', r.id, 'kind', r.kind, 'path', r.path, 'status', r.status, 'created_at', r.created_at,
      'user_id', r.user_id, 'username', coalesce(p.username, p.display_name))
      order by r.created_at desc)
    from public.profile_image_reviews r join public.profiles p on p.id = r.user_id
    where r.status in ('pending', 'approved', 'rejected') and r.created_at > now() - interval '60 days'), '[]'::json);
end $$;
revoke execute on function public.admin_image_reviews() from public;
grant execute on function public.admin_image_reviews() to authenticated;

-- approved → it becomes the member's picture; rejected → the app deletes the file
create or replace function public.admin_review_image(p_id uuid, p_status text)
returns json language plpgsql security definer set search_path = public as $$
declare
  r public.profile_image_reviews;
  old_value text;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_status not in ('approved', 'rejected') then raise exception 'invalid_status'; end if;
  update public.profile_image_reviews set status = p_status, reviewed_at = now(), seen = false
  where id = p_id and status in ('pending', 'approved', 'rejected') returning * into r;
  if not found then raise exception 'not_found'; end if;
  if p_status = 'approved' then
    select case when r.kind = 'bg' then bg_image else banner_image end into old_value from public.profiles where id = r.user_id;
    if r.kind = 'bg' then update public.profiles set bg_image = 'u:' || r.path where id = r.user_id;
    else update public.profiles set banner_image = 'u:' || r.path where id = r.user_id; end if;
  else -- rejected: take it off the profile if it was there
    update public.profiles set bg_image = '' where id = r.user_id and bg_image = 'u:' || r.path;
    update public.profiles set banner_image = '' where id = r.user_id and banner_image = 'u:' || r.path;
  end if;
  return json_build_object('path', r.path, 'replaced', case when old_value like 'u:%' and old_value <> 'u:' || r.path then substr(old_value, 3) end);
end $$;
revoke execute on function public.admin_review_image(uuid, text) from public;
grant execute on function public.admin_review_image(uuid, text) to authenticated;

-- Saving the look: a NEW own picture can only arrive through approval (presets and the
-- already approved own picture can be chosen freely)
create or replace function public.save_profile_look(p_bg text, p_banner text, p_xmas boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  cur public.profiles;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  if not public.bb_look_valid(coalesce(p_bg, ''), auth.uid()) or not public.bb_look_valid(coalesce(p_banner, ''), auth.uid()) then
    raise exception 'look_invalid';
  end if;
  select * into cur from public.profiles where id = auth.uid();
  if (coalesce(p_bg, '') like 'u:%' and p_bg <> cur.bg_image) or (coalesce(p_banner, '') like 'u:%' and p_banner <> cur.banner_image) then
    raise exception 'needs_approval';
  end if;
  update public.profiles set bg_image = coalesce(p_bg, ''), banner_image = coalesce(p_banner, ''), xmas_bg = coalesce(p_xmas, true)
  where id = auth.uid();
end $$;
revoke execute on function public.save_profile_look(text, text, boolean) from public;
grant execute on function public.save_profile_look(text, text, boolean) to authenticated;
