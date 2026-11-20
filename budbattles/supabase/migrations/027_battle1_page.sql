-- =====================================================================
-- BudBattles update 027: Battle #1 page – prize text + Cannapot link
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run again.
-- (The prize text is only shown to logged-in members.)
-- =====================================================================
update public.battle_prizes
set prize_de = '5 feminisierte Blue-Dream-Samen', prize_en = '5 feminized Blue Dream seeds'
where battle_id = 'battle-1-frostiest-bud';
update public.battles set partner_url = 'https://cannapot.com' where id = 'battle-1-frostiest-bud';
