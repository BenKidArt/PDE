-- =====================================================================
-- BudBattles update 013: profile links (GrowDiaries, YouTube, TikTok, Threads).
-- Paste into Supabase → SQL Editor → New query → Run. Run it after 012 (safe to run again).
-- Does not touch battles, entries or votes.
-- =====================================================================

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profiles' and column_name = 'space_w') then
    raise exception 'Please run update 012 (012_growbox_styles_custom_space.sql) first, then this one.';
  end if;
end $$;

-- Only the clean short form is stored: a handle, or the path after the site name
alter table public.profiles
  add column if not exists growdiaries text,
  add column if not exists youtube text,
  add column if not exists tiktok text,
  add column if not exists threads text;
alter table public.profiles
  drop constraint if exists growdiaries_format, drop constraint if exists youtube_format,
  drop constraint if exists tiktok_format, drop constraint if exists threads_format;
alter table public.profiles
  add constraint growdiaries_format check (growdiaries is null or growdiaries ~ '^[A-Za-z0-9][A-Za-z0-9/_.%-]{0,150}$'),
  add constraint youtube_format check (youtube is null or youtube ~ '^(@[A-Za-z0-9._-]{3,30}|(channel|c|user)/[A-Za-z0-9._-]{1,60})$'),
  add constraint tiktok_format check (tiktok is null or tiktok ~ '^[A-Za-z0-9._]{2,24}$'),
  add constraint threads_format check (threads is null or threads ~ '^[A-Za-z0-9._]{1,30}$');

-- Save profile: now also the links
create or replace function public.save_profile(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  arr_training text[] := case when jsonb_typeof(p -> 'training') = 'array'
    then array(select jsonb_array_elements_text(p -> 'training')) end;
  arr_flavours text[] := case when jsonb_typeof(p -> 'flavours') = 'array'
    then array(select jsonb_array_elements_text(p -> 'flavours')) end;
  arr_style text[] := case
    when jsonb_typeof(p -> 'grow_style') = 'array' then array(select jsonb_array_elements_text(p -> 'grow_style'))
    when coalesce(p ->> 'grow_style', '') <> '' then array[p ->> 'grow_style'] end;
  is_custom boolean := (p ->> 'space_size') = 'custom';
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  update public.profiles set
    instagram   = nullif(regexp_replace(trim(coalesce(p ->> 'instagram', '')), '^@', ''), ''),
    grow_setup  = nullif(p ->> 'grow_setup', ''),
    lights      = nullif(trim(coalesce(p ->> 'lights', '')), ''),
    medium      = nullif(p ->> 'medium', ''),
    fav_strain  = nullif(trim(coalesce(p ->> 'fav_strain', '')), ''),
    bio         = nullif(trim(coalesce(p ->> 'bio', '')), ''),
    experience  = nullif(p ->> 'experience', ''),
    grow_style  = nullif(arr_style, '{}'),
    seed_type   = nullif(p ->> 'seed_type', ''),
    training    = nullif(arr_training, '{}'),
    space_size  = nullif(p ->> 'space_size', ''),
    space_w     = case when is_custom then nullif(p ->> 'space_w', '')::smallint end,
    space_d     = case when is_custom then nullif(p ->> 'space_d', '')::smallint end,
    space_h_min = case when is_custom then nullif(p ->> 'space_h_min', '')::smallint end,
    space_h_max = case when is_custom then nullif(p ->> 'space_h_max', '')::smallint end,
    grow_stage  = nullif(p ->> 'grow_stage', ''),
    flavours    = nullif(arr_flavours, '{}'),
    breeder     = nullif(trim(coalesce(p ->> 'breeder', '')), ''),
    accent      = nullif(p ->> 'accent', ''),
    growdiaries = nullif(trim(coalesce(p ->> 'growdiaries', '')), ''),
    youtube     = nullif(trim(coalesce(p ->> 'youtube', '')), ''),
    tiktok      = nullif(regexp_replace(trim(coalesce(p ->> 'tiktok', '')), '^@', ''), ''),
    threads     = nullif(regexp_replace(trim(coalesce(p ->> 'threads', '')), '^@', ''), '')
  where id = auth.uid();
end $$;
revoke execute on function public.save_profile(jsonb) from public;
grant execute on function public.save_profile(jsonb) to authenticated;

-- Public profile now includes the links (still never the email)
create or replace function public.get_public_profile(p_key text)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  p public.profiles;
  result json;
begin
  select * into p from public.profiles
  where lower(username) = lower(p_key) or id::text = p_key
  limit 1;
  if not found then return null; end if;

  with my_entries as (
    select e.id, e.battle_id, e.photo_path, e.strain, e.created_at, b.number, b.theme_de, b.theme_en,
           b.entries_close_at, b.voting_ends_at,
           (select count(*) from public.votes v where v.entry_id = e.id)::int as votes
    from public.entries e join public.battles b on b.id = e.battle_id
    where e.user_id = p.id and e.status = 'approved' and not b.is_test
  ),
  placed as (
    select m.*,
      case when now() >= m.entries_close_at then
        (select count(distinct x.c) + 1 from (
           select (select count(*) from public.votes v where v.entry_id = o.id) c
           from public.entries o where o.battle_id = m.battle_id and o.status = 'approved') x
         where x.c > m.votes)::int end as place
    from my_entries m
  )
  select json_build_object(
    'id', p.id,
    'is_me', coalesce(p.id = auth.uid(), false),
    'username', p.username,
    'display_name', coalesce(p.username, p.display_name),
    'instagram', p.instagram,
    'avatar', p.avatar,
    'member_since', p.created_at,
    'grow_setup', p.grow_setup, 'lights', p.lights, 'medium', p.medium,
    'fav_strain', p.fav_strain, 'bio', p.bio,
    'experience', p.experience, 'grow_style', to_json(coalesce(p.grow_style, '{}')), 'seed_type', p.seed_type,
    'training', to_json(coalesce(p.training, '{}')), 'space_size', p.space_size, 'grow_stage', p.grow_stage,
    'flavours', to_json(coalesce(p.flavours, '{}')), 'breeder', p.breeder, 'accent', p.accent,
    'space_w', p.space_w, 'space_d', p.space_d, 'space_h_min', p.space_h_min, 'space_h_max', p.space_h_max,
    'growdiaries', p.growdiaries, 'youtube', p.youtube, 'tiktok', p.tiktok, 'threads', p.threads,
    'name_changed_at', case when p.id = auth.uid() then p.username_changed_at end,
    'badges', coalesce((select json_agg(ub.badge_id order by bd.sort, ub.awarded_at)
                        from public.user_badges ub join public.badges bd on bd.id = ub.badge_id
                        where ub.user_id = p.id and bd.active), '[]'::json),
    'stats', json_build_object(
      'battles', (select count(distinct battle_id) from my_entries),
      'best_place', (select min(place) from placed where now() >= voting_ends_at),
      'votes_given', (select count(*) from public.votes v join public.battles b on b.id = v.battle_id
                      where v.user_id = p.id and not b.is_test)),
    'history', coalesce((select json_agg(json_build_object(
        'entry_id', id, 'battle_id', battle_id, 'number', number, 'theme_de', theme_de, 'theme_en', theme_en,
        'photo_path', photo_path, 'strain', strain, 'votes', votes, 'place', place,
        'ended', now() >= voting_ends_at) order by created_at desc) from placed), '[]'::json)
  ) into result;
  return result;
end $$;
