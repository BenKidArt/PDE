# BudBattles: Plan (MVP)

> A free photo competition for legal home growers (18+), mainly in Germany.
> Nothing is sold.

## What we're building

A **web app (PWA)**: a website that works like an app on your phone. People open a
link in their phone browser and can tap "Add to Home Screen", and then it has its own icon.
You don't need the App Store or Google Play.

## The screens

| Screen | What it does |
|---|---|
| **Home** | Welcome page, the current battle, and buttons to the other screens |
| **Battle** | Theme, dates, prize, partner logo, and rules |
| **Enter** | Upload one photo per battle, with the strain name and a short description |
| **Standings** | Live ranking of photos by number of votes |
| **Profile** | Your name, your entries, language switch, log out |
| **Admin** (only you) | Approve or reject photos from your phone |

## Rules built into the app

- One photo per grower per battle.
- One vote per member per battle. The photo with the most votes wins.
- New photos stay hidden until you approve them in Admin.
- Sign-up needs an email address, an 18+ confirmation, and acceptance of the terms.
- **Location data (GPS) is removed from every photo automatically**, on the phone,
  before anything is uploaded.
- All texts come in German and English. Every word lives in a language file
  (`locales/de.json`, `locales/en.json`), so nothing is hard-coded.

## Look

Dark background with neon green and pink highlights. It uses the phone's own fonts and
loads nothing from Google, which is better for GDPR.

## Build order (steps)

1. ✅ **App shell**: menu, language switch, dark neon style, installable (PWA)
2. ✅ **Battle page**: theme, dates with countdown, prize, partner, rules
3. ✅ **Photo upload (Enter)**: GPS removal, one entry per battle, strain and description
4. ✅ **Real backend prepared**: Supabase (Frankfurt). Database, security rules and photo storage are ready in `supabase/schema.sql`. *Waiting for your project (see SETUP-SUPABASE.md).*
5. ✅ **Sign-up / login**: email + password, 18+ checkbox, terms checkbox, forgot password
5b. ✅ **On/off switches** for partner, prize and strain
6. ✅ **Admin**: approve or reject from your phone, with undo (Profile → Review photos)
6b. ✅ **Logo + Battle #1 "Frostiest Bud"** (22.–29.11. entries, voting until 6.12.2026, partner Cannapot); prize visible to members only
7. ✅ **Voting + Standings**: one vote each (tap twice to confirm, final), live ranking refreshing every 15 s, top photo featured
8. ✅ **Start page** (battle card, latest photos, how it works) · ⏳ Profile extras
8b. ⏳ **Gallery, Business**: "Coming soon" pages are in the menu
9. ⏳ **Go live**: web address, privacy policy (Datenschutzerklärung), Impressum, terms

## Where we are now
- **Preview (demo mode):** https://claude.ai/artifact/21gB1PsSgBjhL8QanDU7ik
  Data stays on the device you test with. It's private: only you can open it unless you share it.
- **Next:** create your Supabase project (`SETUP-SUPABASE.md`), send me the two values, and then
  the app uses the real database.

## Decisions made
- Backend: **Supabase, Frankfurt (EU)** ✅
- Partner, prize and strain: optional, with on/off switches ✅
- Real hosting with your own web address: comes with step 9 (Netlify or Cloudflare Pages, both free).

## Small choices I made (tell me if you want them different)
- Login uses **email + password** (works the same in the browser and in the installed app).
- Members **cannot vote for their own photo**.
- A vote is **final** (can't be changed later).
- Members can **withdraw** their photo while entries are still open.
- Display names are public. The sign-up form asks people not to use their real name.
- Visitors never see prize wording: the prize lives in a members-only table/file, and public texts
  (rules, terms, how it works) say "featured" instead of "win". Prize conditions (Germany only,
  no cash) are shown to members next to the prize.
- Vote counts are hidden while entries are open and shown from the start of voting.
- The demo preview has a "Phase" switch to try entries, voting and the end before the real dates.
