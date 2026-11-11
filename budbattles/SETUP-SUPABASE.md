# Setting up Supabase: step by step

Takes about 15 minutes. It works on a phone, but a computer is easier for step 3 (copy and paste).
Everything here is free.

## 1. Create an account
1. Go to **https://supabase.com** and tap **Start your project**.
2. Sign up with **GitHub** (easiest, because you already have it) or with your email.

## 2. Create the project
1. Tap **New project**. If it asks for an organisation, create one (any name, plan **Free**).
2. Fill in:
   - **Project name:** `budbattles`
   - **Database password:** tap **Generate a password**, then save it in your password manager.
     (The app doesn't need it, but you might later.)
   - **Region:** **Central EU (Frankfurt)** ← important for GDPR
3. Tap **Create new project** and wait about 2 minutes until it's ready.

## 3. Create the database (one copy and paste)
1. In the left menu, open **SQL Editor** (the `>_` icon).
2. Tap **New query**.
3. Open the file `budbattles/supabase/schema.sql` from GitHub, copy **all** of it, and paste it in.
4. Tap **Run**. You should see **"Success. No rows returned"**.
   If you see a red error instead, send me a screenshot.

## 4. Send me two values
1. Open **Project Settings** (gear icon) → **API Keys** (older screens: **API**).
2. Copy these two and send them to me in the chat:
   - **Project URL**, which looks like `https://abcdefgh.supabase.co`
     (sometimes shown under **Data API** or on the project's home page)
   - **Publishable key**, which starts with `sb_publishable_…`
     (older screens call it the **anon public** key)

   Both are meant to be public, so it's safe to send them.
   **Never** send the *secret* / *service_role* key.

I'll then put them into the app, and it switches from demo mode to the real database.

## 5. Make yourself admin (after the app is connected)
1. Sign up in the app with your own email and confirm the email.
2. In Supabase, open **Table Editor** → table **profiles**.
3. In your row, set **is_admin** to `TRUE` and save.

## Your on/off switches
In **Table Editor** → table **settings** (one row):
- `show_partner`: show the partner box
- `show_prize`: show the prize
- `show_strain`: ask for a strain name when entering

Set any of them to `FALSE` to hide it. You can also leave the prize or partner fields of a
single battle empty, and they're hidden for that battle only.

## Adding a new battle
**Table Editor** → **battles** → **Insert row**. Fill in both languages (`_de` and `_en`).
For the rules, put one rule per line. For the dates, entries open at `start_at`, close at
`entries_close_at`, and voting then runs until `voting_ends_at`.

## Good to know (before launch, not now)
- Supabase's built-in email sender only allows a few emails per hour. Before launch, we'll connect
  a proper email service (free tiers exist) and translate the email texts into German.
- Free projects are paused after 7 days without any visitors. Opening the dashboard wakes them up.

## Database updates
After `schema.sql`, run the files in `supabase/migrations/` in number order, each once
(SQL Editor → New query → paste → Run):
- `002_test_battles.sql`: hidden test battles that only admins can see (also creates one test battle)
- `003_testers_and_badges.sql`: tester role and badges
- `004_automatic_badges.sql`: Founding Member, place badges and Battle Champion are handed out automatically
- `005_place_badges.sql`: separate badges for 1st, 2nd and 3rd place
- `006_badge_page_and_trading_prep.sql`: add/edit badges in the app (Badges page, admins), earned/tradeable fields
- `007_collectible_badges.sql`: 18 collectible badges (active, tradeable later)
- `008_business_interest.sql`: "Interested?" email list on the Business page (Table Editor → business_interest)
- `009_dense_ranking.sql`: place badges use dense places (1, 2, 2, 3)
- `010_anticheat_and_profiles.sql`: anti-cheat voting, profile names + Instagram, big profiles
- `011_profile_options_and_strain_match.sql`: more profile options (experience, grow style, seeds, training, space, grow stage, flavours, breeder, glow colour) + the editable Strain Match list (table `strains`)

## Turnstile bot check (Cloudflare, free)
1. dash.cloudflare.com → sign up → **Turnstile** → **Add widget** → hostname `budbattles.netlify.app`, mode **Managed**.
2. Send the **site key** to Claude (public). Keep the **secret key** private.
3. Wait until the app update with the site key is live.
4. Supabase → **Authentication → Attack Protection** → enable **CAPTCHA**, provider **Turnstile**, paste the secret key.
5. Supabase → **Integrations → Vault** → **Add new secret**: name `turnstile_secret`, value = the secret key (for votes).

To remove the test battle and its photos later, run:
`delete from public.battles where id = 'test-battle';`
