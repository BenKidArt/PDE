-- =====================================================================
-- BudBattles update 007: 18 collectible badges
-- Paste into Supabase → SQL Editor → New query → Run.
-- Needs update 006 first. Safe to run again.
--   • 14 new badges are added
--   • monkey, skunk, octopus, mobster (already there, inactive) get their names
--     and are switched on
--   • all 18: active, collectible (not earned), tradeable later
--   • Welcome, Founding Member, places and Champion are not touched
-- =====================================================================

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'badges' and column_name = 'tradeable') then
    raise exception 'Please run update 006 (006_badge_page_and_trading_prep.sql) first, then this one.';
  end if;
end $$;

insert into public.badges (id, image, name_de, name_en, description_de, description_en, kind, active, earned, tradeable, sort) values
  ('badge_monkey', 'assets/badges/badge_monkey.webp', 'Frecher Affe', 'Cheeky Monkey', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 100),
  ('badge_skunk', 'assets/badges/badge_skunk.webp', 'Stinktier', 'Skunk', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 101),
  ('badge_octopus', 'assets/badges/badge_octopus.webp', 'Tentakel-Fan', 'Tentacle Fan', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 102),
  ('badge_mobster', 'assets/badges/badge_mobster.webp', 'Der Pate', 'The Boss', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 103),
  ('badge_macaque', 'assets/badges/badge_macaque.webp', 'Ups', 'Oops', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 104),
  ('badge_ayeaye', 'assets/badges/badge_ayeaye.webp', 'Nervöser Dreher', 'Nervous Roller', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 105),
  ('badge_banana', 'assets/badges/badge_banana.webp', 'Peace-Banane', 'Peace Banana', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 106),
  ('badge_rabbit_brown', 'assets/badges/badge_rabbit_brown.webp', 'Fresskoma', 'Munchies', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 107),
  ('badge_rabbit_grey', 'assets/badges/badge_rabbit_grey.webp', 'Hasenhunger', 'Bunny Munchies', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 108),
  ('badge_squirrel', 'assets/badges/badge_squirrel.webp', 'Ast-Queen', 'Branch Queen', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 109),
  ('badge_doctor', 'assets/badges/badge_doctor.webp', 'Dr. Grün', 'Dr. Green', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 110),
  ('badge_bear', 'assets/badges/badge_bear.webp', 'Blonder Bär', 'Blonde Bear', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 111),
  ('badge_cat_trippy', 'assets/badges/badge_cat_trippy.webp', 'Neugierige Katze', 'Nosy Cat', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 112),
  ('badge_penguin', 'assets/badges/badge_penguin.webp', 'Frostiger Pinguin', 'Frosty Penguin', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 113),
  ('badge_santa_elf', 'assets/badges/badge_santa_elf.webp', 'Weihnachtsrauch', 'Xmas Smoke', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 114),
  ('badge_fatman', 'assets/badges/badge_fatman.webp', 'Onkel Dicki', 'Uncle Chubby', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 115),
  ('badge_granny', 'assets/badges/badge_granny.webp', 'Oma Turbo', 'Turbo Granny', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 116),
  ('badge_bouquet', 'assets/badges/badge_bouquet.webp', 'Strauß der Liebe', 'Bouquet of Love', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 117)
on conflict (id) do update set
  name_de = excluded.name_de, name_en = excluded.name_en,
  description_de = excluded.description_de, description_en = excluded.description_en,
  active = true, tradeable = true, sort = excluded.sort
where not public.badges.earned;   -- never changes an earned badge

select count(*) as collectible_badges from public.badges where active and not earned and tradeable;
