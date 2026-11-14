// FAVOURITE FLAVOURS: 21 options in 4 groups (several can be picked).
//
// Strain Match facts: the strain list only knows 6 flavour families (sweet, fruity,
// citrus, earthy, spicy, gassy), and only for part of the strains. A detailed
// favourite therefore matches its family (e.g. Pine → earthy); if a strain ever lists
// the detailed flavour itself (e.g. "pine"), that counts as an exact, stronger match.
// Favourites without a family in the data (floral, mint) are simply neutral.

export const FLAVOUR_GROUPS = [
  { id: 'sweet', values: ['sweet', 'candy', 'creamy', 'chocolate'] },
  { id: 'fruit', values: ['fruity', 'berry', 'tropical', 'citrus', 'sour'] },
  { id: 'earth', values: ['earthy', 'herbal', 'woody', 'pine', 'floral', 'mint'] },
  { id: 'funk', values: ['gassy', 'skunk', 'cheese', 'haze', 'spicy', 'savory'] },
];
export const FLAVOURS = FLAVOUR_GROUPS.flatMap((g) => g.values);

/** Which of the strain data's flavour families a favourite belongs to. */
export const FLAVOUR_FAMILY = {
  sweet: ['sweet'], candy: ['sweet'], creamy: ['sweet'], chocolate: ['earthy', 'sweet'],
  fruity: ['fruity'], berry: ['fruity'], tropical: ['fruity'], citrus: ['citrus'], sour: ['citrus'],
  earthy: ['earthy'], herbal: ['earthy'], woody: ['earthy'], pine: ['earthy'], floral: [], mint: [],
  gassy: ['gassy'], skunk: ['gassy'], cheese: ['gassy'], haze: ['spicy'], spicy: ['spicy'], savory: ['gassy'],
};

/** Strain flavour words that mean the same thing ("piney" = pine, "fuel" = gassy …). */
const SYNONYMS = { piney: 'pine', wood: 'woody', herb: 'herbal', herbs: 'herbal', fuel: 'gassy', diesel: 'gassy', incense: 'haze',
  vanilla: 'creamy', cream: 'creamy', coffee: 'chocolate', grape: 'berry', cherry: 'berry', garlic: 'savory', lemon: 'citrus', lime: 'citrus' };
export const normFlavour = (f) => SYNONYMS[String(f).toLowerCase()] || String(f).toLowerCase();

/**
 * How well one strain flavour fits the grower's favourites:
 * 1 = the same flavour, 0.85 = same family (e.g. strain "earthy", favourite "pine"), 0 = no.
 * (A family match stays above "no flavour data", which counts 0.75 in Strain Match.)
 */
const familyOf = (x) => (FLAVOUR_FAMILY[x] && FLAVOUR_FAMILY[x].length ? FLAVOUR_FAMILY[x] : [x]);
export function flavourFit(strainFlavour, favourites) {
  const f = normFlavour(strainFlavour);
  if (favourites.includes(f)) return 1;
  // same family either way: strain "earthy" ↔ favourite "pine", or strain "pine" ↔ favourite "woody"/"earthy"
  const fam = familyOf(f);
  if (favourites.some((x) => familyOf(x).some((y) => fam.includes(y)))) return 0.85;
  return 0;
}

/** Does any favourite have a family the strain data can show? (floral/mint alone: no) */
export const hasMatchableFavourite = (favourites) => favourites.length > 0;

/** How many different flavour wishes the favourites make (pine + woody = one wish: earthy). */
export function wishCount(favourites) {
  return new Set(favourites.flatMap((x) => {
    const fam = FLAVOUR_FAMILY[x];
    return fam && fam.length ? fam : [x];
  })).size;
}
