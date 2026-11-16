// SPOT MAP – the list of spots. Edit this file to add a shop later.
//
// Each spot:
//   id       short unique id
//   name     shown on the map and in the list
//   type     'grow' | 'lounge' | 'munchies' | 'head'   (see SPOT_TYPES)
//   partner  true = BudBattles partner: slightly taller building + crown on top
//   at       [x, y] in metres from Kottbusser Tor (x = east, y = north). The spot is
//            placed on the nearest real building there (from the OpenStreetMap data).
//   instagram (optional) link for the Instagram button
//
// These are DEMO spots ("Spot 01" …) until real shops are added.

export const SPOT_TYPES = {
  grow: { color: 'green' },
  lounge: { color: 'pink' },
  munchies: { color: 'pink' },
  head: { color: 'green' },
};

export const SPOTS = [
  { id: 's0', name: 'Spot 01', type: 'grow', partner: true, at: [-70, 60] },
  { id: 's1', name: 'Spot 02', type: 'lounge', at: [95, -60] },
  { id: 's2', name: 'Spot 03', type: 'grow', at: [-150, -30] },
  { id: 's3', name: 'Spot 04', type: 'munchies', at: [160, 120] },
  { id: 's4', name: 'Spot 05', type: 'head', at: [30, 180] },
  { id: 's5', name: 'Spot 06', type: 'lounge', at: [-40, -160] },
];

// The free building: "Your shop here" (a low building near this point).
export const FREE_LOT = { at: [120, 40] };
