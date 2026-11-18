-- =====================================================================
-- BudBattles update 020: 13 more collectible badges (set 3)
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run again.
-- Pictures: assets/badges/badge_*.webp
-- =====================================================================
insert into public.badges (id, image, name_de, name_en, description_de, description_en, kind, active, earned, tradeable, sort) values
  ('badge_clown', 'assets/badges/badge_clown.webp', 'Bank-Clown', 'Bench Clown', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 118),
  ('badge_cow', 'assets/badges/badge_cow.webp', 'Verrückte Kuh', 'Crazy Cow', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 119),
  ('badge_donkey', 'assets/badges/badge_donkey.webp', 'Dampf-Esel', 'Steam Donkey', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 120),
  ('badge_elephant', 'assets/badges/badge_elephant.webp', 'Dicke Umarmung', 'Big Hug', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 121),
  ('badge_farmer', 'assets/badges/badge_farmer.webp', 'Bauer Joe', 'Farmer Joe', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 122),
  ('badge_goat', 'assets/badges/badge_goat.webp', 'Chill-Ziege', 'Chill Goat', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 123),
  ('badge_hookah', 'assets/badges/badge_hookah.webp', 'Shisha-Onkel', 'Hookah Uncle', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 124),
  ('badge_kangaroo', 'assets/badges/badge_kangaroo.webp', 'Sir Känguru', 'Sir Kangaroo', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 125),
  ('badge_ninja', 'assets/badges/badge_ninja.webp', 'Schleich-Ninja', 'Stealth Ninja', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 126),
  ('badge_pickle', 'assets/badges/badge_pickle.webp', 'Schock-Gurke', 'Shocked Pickle', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 127),
  ('badge_police', 'assets/badges/badge_police.webp', 'Wachtmeister', 'Officer Shades', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 128),
  ('badge_sloth', 'assets/badges/badge_sloth.webp', 'Faultier', 'Slow Sloth', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 129),
  ('badge_troll', 'assets/badges/badge_troll.webp', 'Friedens-Troll', 'Peace Troll', 'Sammelbadge – bald verfügbar.', 'Collectible – coming soon.', 'award', true, false, true, 130)
on conflict (id) do nothing;
