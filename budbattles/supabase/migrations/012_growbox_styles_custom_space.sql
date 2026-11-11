-- =====================================================================
-- BudBattles update 012: Growbox setup, several grow styles (+ Hybrid),
-- custom space size (width × depth × height in cm).
-- Paste into Supabase → SQL Editor → New query → Run. Run it after 011 (safe to run again).
-- Does not touch battles, entries or votes.
-- =====================================================================

do $$
begin
  if to_regclass('public.strains') is null then
    raise exception 'Please run update 011 (011_profile_options_and_strain_match.sql) first, then this one.';
  end if;
end $$;

-- Setup: new option "growbox"
alter table public.profiles drop constraint if exists grow_setup_values;
alter table public.profiles add constraint grow_setup_values
  check (grow_setup is null or grow_setup in ('zelt', 'raum', 'outdoor', 'gewaechshaus', 'balkon', 'growbox'));

-- Grow style: from one value to a list (existing choices are kept), new option "hybrid"
alter table public.profiles drop constraint if exists grow_style_values;
do $$
begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'grow_style') = 'text' then
    alter table public.profiles alter column grow_style type text[]
      using case when grow_style is null or grow_style = '' then null else array[grow_style] end;
  end if;
end $$;
alter table public.profiles add constraint grow_style_values
  check (grow_style is null or grow_style <@ array['organic', 'mineral', 'living_soil', 'hybrid']);

-- Space: new option "custom" with width, depth and height (from – to) in cm
alter table public.profiles
  add column if not exists space_w smallint,
  add column if not exists space_d smallint,
  add column if not exists space_h_min smallint,
  add column if not exists space_h_max smallint;
alter table public.profiles
  drop constraint if exists space_size_values, drop constraint if exists space_custom_values;
alter table public.profiles
  add constraint space_size_values check (space_size is null or space_size in ('60', '80', '100', '120', 'other', 'custom')),
  add constraint space_custom_values check (
        (space_w is null or space_w between 20 and 2000)
    and (space_d is null or space_d between 20 and 2000)
    and (space_h_min is null or space_h_min between 20 and 600)
    and (space_h_max is null or space_h_max between 20 and 600)
    and (space_h_min is null or space_h_max is null or space_h_min <= space_h_max));

-- Save profile: grow style may be a list (or one value from an older app), plus the custom size
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
    accent      = nullif(p ->> 'accent', '')
  where id = auth.uid();
end $$;
revoke execute on function public.save_profile(jsonb) from public;
grant execute on function public.save_profile(jsonb) to authenticated;

-- Public profile now includes the custom size (still never the email)
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
