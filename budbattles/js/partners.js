// PARTNERS on the start page – the ONE list to edit.
//
//   role: 'main'      → the big "Battle #1 partner" card at the top (one partner)
//         'upcoming'  → the row "Upcoming battles with" (members only, see below)
//         'shop'      → "Shop partners" (members only), with a website button.
//                       shopKey = the id used later for "Available at" in Strain Match
//                       (it must match the shop ids in a strain's shops_available).
//   Order on the page = order in this list. To move a partner, move its line;
//   to add one, copy a line. No logo yet? Leave `logo` out: a neat name card is shown.
//   instagram (optional) adds an Instagram button.
//
// The "upcoming" row is only shown to logged-in members, because several partner
// names contain words like "seed" / "Samen" (visitors never see those words).
export const PARTNERS = [
  { id: 'cannapot', name: 'Cannapot', role: 'main', logo: 'assets/partner-cannapot.webp' },
  { id: 'seedstockers', name: 'Seedstockers', role: 'upcoming', logo: 'assets/partner-seedstockers.webp' }, // official logo, unchanged
  { id: 'hnny', name: 'HNNY', role: 'upcoming', logo: 'assets/partner-hnny.webp' },
  { id: 'huba', name: 'Huba Seed Bank', role: 'upcoming', logo: 'assets/partner-huba.webp', round: true },
  { id: 'chr_isgrowing', name: 'Chris Schmid', role: 'upcoming', logo: 'assets/partner-chr-isgrowing.webp', round: true,
    instagram: 'https://instagram.com/_chr_isgrowing' },
  { id: 'cannabissamen_nrw', name: 'Cannabissamen NRW', role: 'upcoming' },
  { id: 'superskunkgrow', name: 'Superskunk Grow', role: 'shop', shopKey: 'superskunkgrow', country: 'ES',
    logo: 'assets/partner-superskunkgrow.webp', website: 'https://superskunkgrow.com' },
];

/** Shop partners by their shopKey – ready for "Available at" in Strain Match (not shown there yet). */
export const SHOPS = Object.fromEntries(PARTNERS.filter((p) => p.role === 'shop').map((p) => [p.shopKey, p]));
