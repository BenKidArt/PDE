-- =====================================================================
-- New hidden TEST BATTLE (only admins and testers can see it).
-- Entries open now · voting opens in 24 hours · ends in 3 days.
-- Paste into Supabase → SQL Editor → New query → Run.
-- Each run creates a new one (the name contains date and time).
-- =====================================================================
insert into public.battles (id, number, is_test, theme_de, theme_en, summary_de, summary_en,
  rules_de, rules_en, start_at, entries_close_at, voting_ends_at)
values (
  'test-' || to_char(now() at time zone 'Europe/Berlin', 'YYYYMMDD-HH24MI'),
  null, true,
  'Test-Battle', 'Test Battle',
  'Nur für Admins und Tester sichtbar. Zum Ausprobieren von Upload, Freigabe, Abstimmung und Badges.',
  'Only visible to admins and testers. For trying out uploads, reviews, voting and badges.',
  E'Ein Foto pro Grower und Battle.\nEin Vote pro Mitglied und Battle. Für das eigene Foto kann man nicht stimmen.',
  E'One photo per grower per battle.\nOne vote per member per battle. You can''t vote for your own photo.',
  now() - interval '1 minute',     -- entries open now
  now() + interval '24 hours',     -- voting opens in 24 hours
  now() + interval '3 days'        -- battle ends in 3 days
)
returning id, start_at, entries_close_at, voting_ends_at;
