# BudBattles (MVP, demo mode)

Free photo competition for legal home growers (18+). See **PLAN.md** for the plan and open decisions.

## Try it
Use any simple web server in this folder, for example:

    python3 -m http.server 8000

Then open http://localhost:8000 on your computer. On a phone, open the published web address
and tap "Add to Home Screen".

## Where things are
- `locales/de.json`, `locales/en.json`: all texts (always change both files)
- `data/battles.json`: battle theme, dates, prize, partner, rules (German and English)
- `css/style.css`: colours and look
- `js/photo.js`: removes GPS and other metadata from photos on the phone
- `js/store.js`: data storage (demo: this device only; will be replaced by the real backend)
- `js/views/`: the screens
