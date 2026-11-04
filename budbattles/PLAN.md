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
4. ⏳ **Real backend**: accounts, database, photo storage *(decision needed, see below)*
5. ⏳ **Sign-up / login**: email, 18+ checkbox, terms checkbox
6. ⏳ **Admin**: approve or reject
7. ⏳ **Voting + Standings**: one vote each, live ranking
8. ⏳ **Home + Profile**
9. ⏳ **Go live**: web address, privacy policy (Datenschutzerklärung), Impressum, terms

## Where we are now: "demo mode"

Right now everything is saved **only in the browser on your own phone**. This lets you
try out the screens and the upload safely. Nobody else can see your test photos yet.
Step 4 connects the app to a real online database, so that everyone shares the same
battles, entries and votes.

## Decisions I need from you (before step 4)

1. **Backend (where accounts, photos and votes are stored).**
   My recommendation is **Supabase** with servers in **Frankfurt (EU)**. It's free to start,
   handles email login, and keeps the data in Germany, which helps with GDPR.
   The alternative is Firebase (Google), which is also free to start but has its data mostly in the USA.
2. **Hosting (the web address).** Netlify or Cloudflare Pages are both free, and you'd need a domain
   such as `budbattles.de` (around €5–15 per year).
3. **Legal check.** The German Cannabis Act (KCanG §6) bans advertising and sponsorship
   for cannabis. Partner logos, prizes from partners and strain names could be a problem.
   Please get a short legal check from a lawyer before going live. The app keeps
   partner and prize as simple editable fields, so it's easy to change or remove them.
