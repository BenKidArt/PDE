-- =====================================================================
-- BudBattles update 011: more profile options + Strain Match
-- Paste into Supabase → SQL Editor → New query → Run. Run it after 010 (safe to run again).
-- Does not touch battles, entries or votes.
-- =====================================================================

do $$
begin
  if to_regprocedure('public.get_public_profile(text)') is null then
    raise exception 'Please run update 010 (010_anticheat_and_profiles.sql) first, then this one.';
  end if;
end $$;

-- ---------- More profile options (all optional) ----------
alter table public.profiles
  add column if not exists experience text,      -- beginner | grows_1_3 | veteran
  add column if not exists grow_style text,      -- organic | mineral | living_soil
  add column if not exists seed_type text,       -- auto | photo | both
  add column if not exists training text[],      -- lst, scrog, topping, defoliation, none
  add column if not exists space_size text,      -- 60 | 80 | 100 | 120 | other
  add column if not exists grow_stage text,      -- seedling | veg | flower | drying | curing | pause
  add column if not exists flavours text[],      -- fruity, gassy, earthy, sweet, citrus, spicy
  add column if not exists breeder text,
  add column if not exists accent text;          -- green | pink | gold | cyan | purple | orange
alter table public.profiles
  drop constraint if exists experience_values, drop constraint if exists grow_style_values,
  drop constraint if exists seed_type_values, drop constraint if exists training_values,
  drop constraint if exists space_size_values, drop constraint if exists grow_stage_values,
  drop constraint if exists flavours_values, drop constraint if exists breeder_length,
  drop constraint if exists accent_values;
alter table public.profiles
  add constraint experience_values check (experience is null or experience in ('beginner', 'grows_1_3', 'veteran')),
  add constraint grow_style_values check (grow_style is null or grow_style in ('organic', 'mineral', 'living_soil')),
  add constraint seed_type_values check (seed_type is null or seed_type in ('auto', 'photo', 'both')),
  add constraint training_values check (training is null or training <@ array['lst', 'scrog', 'topping', 'defoliation', 'none']),
  add constraint space_size_values check (space_size is null or space_size in ('60', '80', '100', '120', 'other')),
  add constraint grow_stage_values check (grow_stage is null or grow_stage in ('seedling', 'veg', 'flower', 'drying', 'curing', 'pause')),
  add constraint flavours_values check (flavours is null or flavours <@ array['fruity', 'gassy', 'earthy', 'sweet', 'citrus', 'spicy']),
  add constraint breeder_length check (breeder is null or char_length(breeder) <= 40),
  add constraint accent_values check (accent is null or accent in ('green', 'pink', 'gold', 'cyan', 'purple', 'orange'));

-- Saves all profile fields at once (the app sends them as one package)
create or replace function public.save_profile(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  arr_training text[] := case when jsonb_typeof(p -> 'training') = 'array'
    then array(select jsonb_array_elements_text(p -> 'training')) end;
  arr_flavours text[] := case when jsonb_typeof(p -> 'flavours') = 'array'
    then array(select jsonb_array_elements_text(p -> 'flavours')) end;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  update public.profiles set
    instagram  = nullif(regexp_replace(trim(coalesce(p ->> 'instagram', '')), '^@', ''), ''),
    grow_setup = nullif(p ->> 'grow_setup', ''),
    lights     = nullif(trim(coalesce(p ->> 'lights', '')), ''),
    medium     = nullif(p ->> 'medium', ''),
    fav_strain = nullif(trim(coalesce(p ->> 'fav_strain', '')), ''),
    bio        = nullif(trim(coalesce(p ->> 'bio', '')), ''),
    experience = nullif(p ->> 'experience', ''),
    grow_style = nullif(p ->> 'grow_style', ''),
    seed_type  = nullif(p ->> 'seed_type', ''),
    training   = nullif(arr_training, '{}'),
    space_size = nullif(p ->> 'space_size', ''),
    grow_stage = nullif(p ->> 'grow_stage', ''),
    flavours   = nullif(arr_flavours, '{}'),
    breeder    = nullif(trim(coalesce(p ->> 'breeder', '')), ''),
    accent     = nullif(p ->> 'accent', '')
  where id = auth.uid();
end $$;
revoke execute on function public.save_profile(jsonb) from public;
grant execute on function public.save_profile(jsonb) to authenticated;

-- Public profile now includes the new options (still never the email)
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
    'experience', p.experience, 'grow_style', p.grow_style, 'seed_type', p.seed_type,
    'training', to_json(coalesce(p.training, '{}')), 'space_size', p.space_size, 'grow_stage', p.grow_stage,
    'flavours', to_json(coalesce(p.flavours, '{}')), 'breeder', p.breeder, 'accent', p.accent,
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

-- ---------- Strain Match: strain info list ----------
-- Info only (no shops, prices or links). Edit, add or switch off strains in the Table Editor.
create table if not exists public.strains (
  id bigint generated always as identity primary key,
  name text not null unique,
  auto boolean not null default false,          -- an autoflower version exists
  photo boolean not null default true,          -- a photoperiod version exists
  type text not null check (type in ('indica', 'sativa', 'hybrid')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  height text not null check (height in ('short', 'medium', 'tall')),
  flower_min int not null check (flower_min between 5 and 20),   -- flowering time in weeks (typical)
  flower_max int not null check (flower_max between 5 and 20),
  flavours text[] not null default '{}' check (flavours <@ array['fruity', 'gassy', 'earthy', 'sweet', 'citrus', 'spicy']),
  small_space boolean not null default false,   -- good for small tents / balconies
  active boolean not null default true
);
alter table public.strains enable row level security;
drop policy if exists "strains readable by all" on public.strains;
create policy "strains readable by all" on public.strains for select using (active);
grant select on public.strains to anon, authenticated;

insert into public.strains (name, auto, photo, type, difficulty, height, flower_min, flower_max, flavours, small_space) values
  ('Northern Lights', true, true, 'indica', 'easy', 'short', 7, 8, array['earthy', 'sweet'], true),
  ('White Widow', true, true, 'hybrid', 'easy', 'medium', 8, 9, array['earthy', 'spicy'], false),
  ('Blue Dream', true, true, 'sativa', 'medium', 'tall', 9, 10, array['fruity', 'sweet'], false),
  ('Gorilla Glue', true, true, 'hybrid', 'medium', 'medium', 8, 9, array['gassy', 'earthy'], false),
  ('Girl Scout Cookies', true, true, 'hybrid', 'medium', 'medium', 9, 10, array['sweet', 'earthy'], false),
  ('Gelato', true, true, 'hybrid', 'medium', 'medium', 8, 9, array['sweet', 'fruity'], true),
  ('Wedding Cake', true, true, 'hybrid', 'medium', 'medium', 8, 9, array['sweet', 'earthy'], true),
  ('OG Kush', true, true, 'hybrid', 'medium', 'medium', 8, 9, array['gassy', 'citrus'], false),
  ('Sour Diesel', true, true, 'sativa', 'medium', 'tall', 10, 11, array['gassy', 'citrus'], false),
  ('Amnesia Haze', true, true, 'sativa', 'hard', 'tall', 10, 12, array['citrus', 'earthy'], false),
  ('Super Lemon Haze', true, true, 'sativa', 'medium', 'tall', 9, 10, array['citrus', 'sweet'], false),
  ('Lemon Haze', true, true, 'sativa', 'medium', 'tall', 9, 10, array['citrus'], false),
  ('Jack Herer', true, true, 'sativa', 'medium', 'tall', 8, 10, array['spicy', 'earthy'], false),
  ('AK-47', true, true, 'hybrid', 'easy', 'medium', 8, 9, array['earthy', 'spicy'], false),
  ('Critical', true, true, 'indica', 'easy', 'medium', 7, 8, array['sweet', 'earthy'], true),
  ('Critical Kush', true, true, 'indica', 'easy', 'short', 7, 8, array['earthy', 'spicy'], true),
  ('Skunk #1', true, true, 'hybrid', 'easy', 'medium', 8, 9, array['earthy', 'sweet'], false),
  ('Big Bud', true, true, 'indica', 'easy', 'medium', 7, 9, array['sweet', 'earthy'], false),
  ('Blueberry', true, true, 'indica', 'easy', 'short', 8, 9, array['fruity', 'sweet'], true),
  ('Strawberry Kush', true, true, 'hybrid', 'medium', 'medium', 8, 9, array['fruity', 'sweet'], false),
  ('Bubble Gum', true, true, 'hybrid', 'easy', 'short', 8, 9, array['sweet', 'fruity'], true),
  ('Purple Kush', true, true, 'indica', 'easy', 'short', 8, 9, array['earthy', 'sweet'], true),
  ('Granddaddy Purple', true, true, 'indica', 'medium', 'short', 8, 9, array['fruity', 'sweet'], true),
  ('Bubba Kush', true, true, 'indica', 'easy', 'short', 8, 9, array['earthy', 'gassy'], true),
  ('Hindu Kush', false, true, 'indica', 'easy', 'short', 7, 8, array['earthy', 'spicy'], true),
  ('Afghan Kush', true, true, 'indica', 'easy', 'short', 7, 8, array['earthy', 'spicy'], true),
  ('Durban Poison', true, true, 'sativa', 'medium', 'tall', 8, 9, array['sweet', 'spicy'], false),
  ('Green Crack', true, true, 'sativa', 'medium', 'tall', 8, 9, array['citrus', 'fruity'], false),
  ('Pineapple Express', true, true, 'hybrid', 'medium', 'medium', 8, 9, array['fruity', 'citrus'], false),
  ('Tangie', true, true, 'sativa', 'medium', 'tall', 9, 10, array['citrus', 'sweet'], false),
  ('Zkittlez', true, true, 'indica', 'medium', 'short', 8, 9, array['fruity', 'sweet'], true),
  ('Runtz', true, true, 'hybrid', 'medium', 'medium', 8, 9, array['sweet', 'fruity'], true),
  ('Do-Si-Dos', true, true, 'indica', 'medium', 'short', 8, 9, array['earthy', 'sweet'], true),
  ('Sherbet', true, true, 'hybrid', 'medium', 'medium', 8, 9, array['fruity', 'sweet'], true),
  ('Mimosa', true, true, 'sativa', 'medium', 'medium', 8, 9, array['citrus', 'fruity'], false),
  ('Banana Kush', true, true, 'hybrid', 'easy', 'short', 8, 9, array['fruity', 'sweet'], true),
  ('Mango Kush', true, true, 'hybrid', 'easy', 'medium', 8, 9, array['fruity', 'sweet'], false),
  ('Cheese', true, true, 'hybrid', 'easy', 'medium', 8, 9, array['earthy', 'spicy'], false),
  ('Chemdawg', true, true, 'hybrid', 'hard', 'medium', 9, 10, array['gassy', 'earthy'], false),
  ('GG4 Sherbet', true, true, 'hybrid', 'medium', 'medium', 8, 9, array['gassy', 'sweet'], false),
  ('Gelato 41', false, true, 'hybrid', 'medium', 'medium', 8, 9, array['sweet', 'fruity'], true),
  ('Ice Cream Cake', true, true, 'indica', 'medium', 'short', 8, 9, array['sweet', 'earthy'], true),
  ('Cookies and Cream', true, true, 'hybrid', 'medium', 'medium', 8, 9, array['sweet', 'earthy'], true),
  ('Lemon Kush', true, true, 'hybrid', 'easy', 'medium', 8, 9, array['citrus', 'earthy'], false),
  ('Cinderella 99', true, true, 'sativa', 'easy', 'short', 7, 9, array['fruity', 'citrus'], true),
  ('Power Plant', false, true, 'sativa', 'easy', 'tall', 7, 9, array['earthy', 'spicy'], false),
  ('Haze', false, true, 'sativa', 'hard', 'tall', 12, 14, array['spicy', 'citrus'], false),
  ('Super Silver Haze', true, true, 'sativa', 'hard', 'tall', 10, 11, array['citrus', 'spicy'], false),
  ('Trainwreck', true, true, 'hybrid', 'medium', 'tall', 8, 10, array['spicy', 'citrus'], false),
  ('Black Domina', false, true, 'indica', 'easy', 'short', 7, 8, array['earthy', 'spicy'], true),
  ('Kosher Kush', false, true, 'indica', 'medium', 'short', 8, 9, array['gassy', 'earthy'], true),
  ('Fat Banana', true, true, 'hybrid', 'easy', 'medium', 8, 9, array['fruity', 'sweet'], false),
  ('Sweet Tooth', true, true, 'indica', 'easy', 'short', 8, 9, array['sweet', 'fruity'], true),
  ('Somango', true, true, 'indica', 'easy', 'medium', 8, 9, array['fruity', 'sweet'], false),
  ('Frisian Dew', false, true, 'hybrid', 'easy', 'medium', 7, 8, array['earthy', 'fruity'], false),
  ('Durban Thai', false, true, 'sativa', 'hard', 'tall', 10, 12, array['citrus', 'spicy'], false),
  ('Watermelon Zkittlez', true, true, 'indica', 'medium', 'short', 8, 9, array['fruity', 'sweet'], true),
  ('Purple Punch', true, true, 'indica', 'easy', 'short', 8, 9, array['fruity', 'sweet'], true),
  ('Forbidden Fruit', true, true, 'indica', 'medium', 'short', 8, 9, array['fruity', 'citrus'], true),
  ('Tropicana Cookies', true, true, 'hybrid', 'medium', 'medium', 8, 9, array['citrus', 'fruity'], false)
on conflict (name) do nothing;
