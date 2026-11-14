// PARTNERS on the start page – the ONE list to edit.
//
//   role: 'main'      → the big "Battle #1 partner" card at the top (one partner)
//         'upcoming'  → the row "Upcoming battles with" (members only, see below)
//   Order on the page = order in this list. To move a partner, move its line;
//   to add one, copy a line. No logo yet? Leave `logo` out: a neat name card is shown.
//   instagram (optional) adds an Instagram button.
//
// The "upcoming" row is only shown to logged-in members, because several partner
// names contain words like "seed" / "Samen" (visitors never see those words).
export const PARTNERS = [
  { id: 'cannapot', name: 'Cannapot', role: 'main', logo: 'assets/partner-cannapot.webp' },
  { id: 'seedstockers', name: 'Seedstockers', role: 'upcoming' },
  { id: 'hnny', name: 'HNNY', role: 'upcoming' },
  { id: 'huba', name: 'Huba Seed Bank', role: 'upcoming' },
  { id: 'chr_isgrowing', name: 'Chris Schmid', role: 'upcoming', logo: 'assets/partner-chr-isgrowing.webp', round: true,
    instagram: 'https://instagram.com/_chr_isgrowing' },
  { id: 'cannabissamen_nrw', name: 'Cannabissamen NRW', role: 'upcoming' },
];
