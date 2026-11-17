// ONE-TIME BUILD SCRIPT for the Spot Map (#/spot-map): downloads OpenStreetMap data
// with the Overpass API and writes small JSON files into data/map/berlin/.
//
//   node --use-env-proxy tools/build-map-tiles.mjs           (everything; already saved tiles are skipped)
//   node --use-env-proxy tools/build-map-tiles.mjs --base    (only index.json + base.json)
//   node --use-env-proxy tools/build-map-tiles.mjs --fresh   (download every tile again)
//
// Area: the Berlin "Ortsteile" Kreuzberg, Neukölln, Friedrichshain and Mitte, cut into
// square tiles of 500 × 500 m. Coordinates are metres from Kottbusser Tor (x = east, y = north).
//
// Overpass usage policy: one request at a time, a pause between requests, a clear
// User-Agent, and a longer wait when the server says it is busy.
//
// Files:
//   index.json        origin, tile size, list of tiles [ix, iy]
//   base.json         water + parks (areas), U-Bahn (tunnels, elevated, stations, entrances)
//   tile_ix_iy.json   buildings, streets (+ names/labels), surface rail lines, trees
// Map data © OpenStreetMap contributors (ODbL).
import { mkdir, writeFile, stat, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data/map/berlin');
const API = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter'; // or a mirror
const UA = 'BudBattles-map-build/1.0 (one-time build of static map tiles for a small hobby web app)';
const PAUSE_MS = Number(process.env.PAUSE_MS || 4000);
const LAT0 = 52.4990, LON0 = 13.4180; // Kottbusser Tor (same origin as before)
const TILE = 500;
const DISTRICTS = ['Kreuzberg', 'Neukölln', 'Friedrichshain', 'Mitte'];
const MAX_TREES = 500; // per tile

const args = new Set(process.argv.slice(2));
const MX = 111320 * Math.cos(LAT0 * Math.PI / 180), MY = 110540;
const toXY = (lat, lon) => [(lon - LON0) * MX, (lat - LAT0) * MY];
const toLatLon = (x, y) => [LAT0 + y / MY, LON0 + x / MX];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const r1 = (v) => Math.round(v);

// ---------- Overpass ----------
let lastCall = 0;
async function overpass(query, label) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const gap = Date.now() - lastCall;
    if (gap < PAUSE_MS) await wait(PAUSE_MS - gap);
    lastCall = Date.now();
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: 'data=' + encodeURIComponent(query),
      });
      if (res.status === 429 || res.status === 504 || res.status === 503) {
        const s = 30 * attempt;
        console.log(`  ${label}: server busy (${res.status}), waiting ${s}s`);
        await wait(s * 1000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return await res.json();
    } catch (e) {
      console.log(`  ${label}: ${e.message} (attempt ${attempt})`);
      await wait(15000 * attempt);
    }
  }
  throw new Error(`${label}: gave up`);
}

// ---------- geometry helpers ----------
function simplify(pts, tol) { // Douglas–Peucker on [x, y] arrays
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
    let best = -1, bd = tol;
    for (let i = a + 1; i < b; i++) {
      // closed ring (start = end): use the distance to that point instead of a line
      const d = L < 1e-6 ? Math.hypot(pts[i][0] - ax, pts[i][1] - ay) : Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L;
      if (d > bd) { bd = d; best = i; }
    }
    if (best > 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const geomXY = (g) => g.map((p) => toXY(p.lat, p.lon));
function inPoly(x, y, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function area(ring) { let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]); return a / 2; }
/** Join way pieces (arrays of {lat,lon}) into closed rings. */
function joinRings(pieces) {
  const key = (p) => `${p.lat.toFixed(7)},${p.lon.toFixed(7)}`;
  const left = pieces.filter((g) => g && g.length > 1).map((g) => g.slice());
  const rings = [];
  while (left.length) {
    let ring = left.shift();
    let guard = 0;
    while (key(ring[0]) !== key(ring[ring.length - 1]) && guard++ < 5000) {
      const end = key(ring[ring.length - 1]);
      const i = left.findIndex((g) => key(g[0]) === end || key(g[g.length - 1]) === end);
      if (i < 0) break;
      const g = left.splice(i, 1)[0];
      ring = ring.concat(key(g[0]) === end ? g.slice(1) : g.slice(0, -1).reverse());
    }
    if (key(ring[0]) === key(ring[ring.length - 1]) && ring.length > 3) rings.push(ring);
  }
  return rings;
}
/** Polygons of an element: [[outer, hole, …], …] in local metres. */
function polygonsOf(el) {
  if (el.type === 'way') return el.geometry && el.geometry.length > 3 ? [[geomXY(el.geometry)]] : [];
  if (el.type !== 'relation' || !el.members) return [];
  const outers = joinRings(el.members.filter((m) => m.type === 'way' && m.role !== 'inner').map((m) => m.geometry)).map(geomXY);
  const inners = joinRings(el.members.filter((m) => m.type === 'way' && m.role === 'inner').map((m) => m.geometry)).map(geomXY);
  return outers.map((o) => [o, ...inners.filter((h) => inPoly(h[0][0], h[0][1], o))]);
}
/** Flat int list: n, x0, y0, dx, dy, … (relative to ox/oy, closing point dropped for rings). */
function packPts(pts, ox = 0, oy = 0, ring = false) {
  let p = pts.map(([x, y]) => [r1(x - ox), r1(y - oy)]);
  p = p.filter((q, i) => i === 0 || q[0] !== p[i - 1][0] || q[1] !== p[i - 1][1]);
  if (ring && p.length > 1 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p.pop();
  const out = [p.length, p[0][0], p[0][1]];
  for (let i = 1; i < p.length; i++) out.push(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return out;
}

// ---------- 1. the four Ortsteile ----------
async function districts() {
  const q = `[out:json][timeout:120];
area["name"="Berlin"]["admin_level"="4"]->.b;
rel(area.b)["boundary"="administrative"]["admin_level"="10"]["name"~"^(${DISTRICTS.join('|')})$"];
out geom;`;
  const data = await overpass(q, 'districts');
  const polys = [];
  for (const el of data.elements) {
    const ps = polygonsOf(el).map((p) => p[0]);
    console.log(`  district ${el.tags?.name}: ${ps.length} ring(s)`);
    polys.push(...ps);
  }
  if (!polys.length) throw new Error('no districts found');
  return polys;
}

function tilesFor(polys) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  polys.forEach((r) => r.forEach(([x, y]) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }));
  const tiles = [];
  for (let ix = Math.floor(minX / TILE); ix <= Math.floor(maxX / TILE); ix++) {
    for (let iy = Math.floor(minY / TILE); iy <= Math.floor(maxY / TILE); iy++) {
      let hit = false;
      for (let a = 0; a <= 6 && !hit; a++) for (let b = 0; b <= 6 && !hit; b++) {
        const x = ix * TILE + (a / 6) * TILE, y = iy * TILE + (b / 6) * TILE;
        hit = polys.some((r) => inPoly(x, y, r));
      }
      if (hit) tiles.push([ix, iy]);
    }
  }
  return { tiles, bounds: [r1(minX), r1(minY), r1(maxX), r1(maxY)] };
}

function bboxOf(minX, minY, maxX, maxY) {
  const [s, w] = toLatLon(minX, minY), [n, e] = toLatLon(maxX, maxY);
  return `${s.toFixed(6)},${w.toFixed(6)},${n.toFixed(6)},${e.toFixed(6)}`;
}

// ---------- 2. base: water, parks, U-Bahn ----------
const isTunnel = (t) => (t.tunnel && t.tunnel !== 'no') || Number(t.layer) < 0 || t.location === 'underground' || Number(t.level) < 0;
const isBridge = (t) => (t.bridge && t.bridge !== 'no') || Number(t.layer) > 0;

async function base(bounds) {
  const pad = 400;
  const bb = bboxOf(bounds[0] - pad, bounds[1] - pad, bounds[2] + pad, bounds[3] + pad);
  const q = `[out:json][timeout:240][bbox:${bb}];
(
  way[natural=water]; rel[natural=water]; way[waterway=riverbank]; way[landuse=basin];
  way[leisure~"^(park|garden|playground)$"]; rel[leisure=park];
  way[landuse~"^(grass|recreation_ground|cemetery|village_green|meadow|forest|allotments)$"]; rel[landuse~"^(cemetery|forest|recreation_ground)$"];
  way[railway=subway];
  node[railway=station][station=subway]; node[public_transport=station][subway=yes];
  node[railway=subway_entrance];
);
out geom qt;
rel[route=subway](${bb});
out body qt;
node(r)(${bb});
out skel qt;`;
  const data = await overpass(q, 'base');
  const water = [], parks = [], metro = [], stationsRaw = [], entrances = [];
  const routes = [], stopNodes = new Map();
  for (const el of data.elements) {
    const t = el.tags || {};
    if (el.type === 'relation' && t.route === 'subway') { routes.push(el); continue; }
    if (el.type === 'node' && !el.tags) { stopNodes.set(el.id, toXY(el.lat, el.lon)); continue; }
    if (t.railway === 'subway' && el.type === 'way' && el.geometry) {
      const kind = isTunnel(t) ? 't' : isBridge(t) ? 'e' : 'g';
      metro.push({ k: kind, z: Number(t.layer) || 0, ids: el.nodes, pts: geomXY(el.geometry) });
      continue;
    }
    if (el.type === 'node' && t.railway === 'subway_entrance') { entrances.push(toXY(el.lat, el.lon)); continue; }
    if (el.type === 'node' && (t.station === 'subway' || t.subway === 'yes')) {
      if (t.name) stationsRaw.push({ name: t.name.replace(/^U\s+/, '').replace(/\s*\(Berlin\)$/, ''), xy: toXY(el.lat, el.lon) });
      continue;
    }
    const isWater = t.natural === 'water' || t.waterway === 'riverbank' || t.landuse === 'basin';
    const target = isWater ? water : parks;
    for (const poly of polygonsOf(el)) {
      const rings = poly.map((r) => simplify(r, isWater ? 1.2 : 1.5)).filter((r) => r.length > 3);
      if (!rings.length || Math.abs(area(rings[0])) < (isWater ? 60 : 300)) continue;
      target.push(rings.map((r) => packPts(r, 0, 0, true)));
    }
  }
  // stations: one per name (merge duplicates within 250 m), lines from the route relations
  const stations = [];
  for (const s of stationsRaw) {
    const dup = stations.find((o) => o.n === s.name && Math.hypot(o.x - s.xy[0], o.y - s.xy[1]) < 250);
    if (!dup) stations.push({ n: s.name, x: r1(s.xy[0]), y: r1(s.xy[1]), l: [] });
  }
  for (const rt of routes) {
    const ref = rt.tags?.ref; if (!ref || !/^U\d/.test(ref)) continue;
    for (const m of rt.members || []) {
      if (m.type !== 'node' || !stopNodes.has(m.ref)) continue;
      const [x, y] = stopNodes.get(m.ref);
      let best = null, bd = 220;
      stations.forEach((s) => { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s; } });
      if (best && !best.l.includes(ref)) best.l.push(ref);
    }
  }
  stations.forEach((s) => s.l.sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))));
  // underground / elevated station? (nearest U-Bahn track within 80 m)
  const near = (s, kind) => metro.some((m) => m.k === kind && m.pts.some(([x, y]) => Math.hypot(x - s.x, y - s.y) < 80));
  stations.forEach((s) => {
    s.u = near(s, 't') ? 1 : 0; s.e = near(s, 'e') ? 1 : 0;
    let best = null, bd = 160; // street entrance for the camera flight
    entrances.forEach(([x, y]) => { const d = Math.hypot(x - s.x, y - s.y); if (d < bd) { bd = d; best = [x, y]; } });
    if (best) s.en = [r1(best[0]), r1(best[1])];
  });
  // join track pieces of the same kind into long chains (for the trains)
  const chains = joinChains(metro);
  return {
    v: 1,
    water: water, parks: parks,
    metro: chains.map((c) => [c.k === 't' ? 1 : c.k === 'e' ? 2 : 0, c.z, ...packPts(simplify(c.pts, 0.8))]),
    stations: stations.filter((s) => s.u || s.e).map((s) => ({ n: s.n, x: s.x, y: s.y, l: s.l, u: s.u, e: s.e, ...(s.en ? { en: s.en } : {}) })),
  };
}

function joinChains(ways) {
  const left = ways.map((w) => ({ ...w, ids: w.ids.slice(), pts: w.pts.slice() }));
  const out = [];
  while (left.length) {
    const c = left.shift();
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = 0; i < left.length; i++) {
        const w = left[i];
        if (w.k !== c.k) continue;
        const a = c.ids[0], b = c.ids[c.ids.length - 1], wa = w.ids[0], wb = w.ids[w.ids.length - 1];
        if (b === wa) { c.ids.push(...w.ids.slice(1)); c.pts.push(...w.pts.slice(1)); }
        else if (b === wb) { c.ids.push(...w.ids.slice(0, -1).reverse()); c.pts.push(...w.pts.slice(0, -1).reverse()); }
        else if (a === wb) { c.ids.unshift(...w.ids.slice(0, -1)); c.pts.unshift(...w.pts.slice(0, -1)); }
        else if (a === wa) { c.ids.unshift(...w.ids.slice(1).reverse()); c.pts.unshift(...w.pts.slice(1).reverse()); }
        else continue;
        left.splice(i, 1); grew = true; break;
      }
    }
    out.push(c);
  }
  return out;
}

// ---------- 3. tiles ----------
const ROAD_W = { motorway: 20, motorway_link: 9, trunk: 18, trunk_link: 9, primary: 16, primary_link: 9, secondary: 14, secondary_link: 8,
  tertiary: 11, tertiary_link: 7, unclassified: 8, residential: 8, living_street: 6, pedestrian: 6, service: 4 };
const RAIL_K = { rail: 0, light_rail: 1, narrow_gauge: 0, tram: 2 };

function heightOf(t) {
  const h = parseFloat(String(t.height || '').replace(',', '.'));
  if (h > 0 && h < 400) return h;
  const lv = parseFloat(t['building:levels']);
  if (lv > 0 && lv < 90) return lv * 3.3 + (parseFloat(t['roof:levels']) || 0) * 2.5 + 1;
  const b = t.building;
  if (['garage', 'garages', 'shed', 'kiosk', 'carport', 'hut', 'container', 'toilets'].includes(b)) return 3.5;
  if (['house', 'detached', 'semidetached_house', 'bungalow'].includes(b)) return 8;
  if (['church', 'cathedral'].includes(b)) return 28;
  return 16; // typical Berlin "Altbau" block
}

async function tile(ix, iy) {
  const x0 = ix * TILE, y0 = iy * TILE;
  const bb = bboxOf(x0 - 2, y0 - 2, x0 + TILE + 2, y0 + TILE + 2);
  const q = `[out:json][timeout:120][bbox:${bb}];
(
  way[building][building!=roof]; rel[building][type=multipolygon];
  way[highway~"^(${Object.keys(ROAD_W).join('|')})$"][area!=yes];
  way[railway~"^(rail|light_rail|narrow_gauge|tram)$"];
  node[natural=tree];
);
out geom qt;`;
  const data = await overpass(q, `tile ${ix},${iy}`);
  const inT = (x, y) => x >= x0 && x < x0 + TILE && y >= y0 && y < y0 + TILE;
  const b = [], r = [], l = [], names = [], labels = new Map();
  let trees = [];
  const nameIdx = (n) => { if (!n) return -1; let i = names.indexOf(n); if (i < 0) { i = names.length; names.push(n); } return i; };
  for (const el of data.elements) {
    const t = el.tags || {};
    if (t.building) {
      const polys = polygonsOf(el);
      for (const poly of polys) {
        const ring = simplify(poly[0], 0.35);
        if (ring.length < 4) continue;
        let cx = 0, cy = 0; ring.slice(0, -1).forEach(([x, y]) => { cx += x; cy += y; });
        cx /= ring.length - 1; cy /= ring.length - 1;
        if (!inT(cx, cy) || Math.abs(area(ring)) < 8) continue;
        b.push([r1(heightOf(t)), ...packPts(ring, x0, y0, true)]);
      }
    } else if (t.highway && el.geometry) {
      const pts = geomXY(el.geometry), w = ROAD_W[t.highway] || 6;
      const ni = nameIdx(t.name);
      // keep only the parts of the road inside this tile (by segment middle)
      let run = [];
      const flush = () => { if (run.length > 1) r.push([w, ni, ...packPts(simplify(run, 0.6), x0, y0)]); run = []; };
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
        if (inT((ax + bx) / 2, (ay + by) / 2)) {
          if (!run.length) run.push(pts[i - 1]);
          run.push(pts[i]);
          const len = Math.hypot(bx - ax, by - ay);
          if (ni >= 0 && w >= 6 && len > 35 && (!labels.has(ni) || labels.get(ni)[3] < len)) {
            let ang = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
            if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
            labels.set(ni, [r1((ax + bx) / 2 - x0), r1((ay + by) / 2 - y0), r1(ang), len]);
          }
        } else flush();
      }
      flush();
    } else if (t.railway && el.geometry && !isTunnel(t)) {
      const pts = geomXY(el.geometry);
      let run = [];
      const flush = () => { if (run.length > 1) l.push([RAIL_K[t.railway] ?? 0, isBridge(t) ? Math.max(1, Number(t.layer) || 1) : 0, ...packPts(simplify(run, 0.6), x0, y0)]); run = []; };
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
        if (inT((ax + bx) / 2, (ay + by) / 2)) { if (!run.length) run.push(pts[i - 1]); run.push(pts[i]); } else flush();
      }
      flush();
    } else if (t.natural === 'tree' && el.type === 'node') {
      const [x, y] = toXY(el.lat, el.lon);
      if (inT(x, y)) trees.push([r1(x - x0), r1(y - y0)]);
    }
  }
  if (trees.length > MAX_TREES) { // even sample, so streets keep their rows of trees
    const step = trees.length / MAX_TREES;
    trees = Array.from({ length: MAX_TREES }, (_, i) => trees[Math.floor(i * step)]);
  }
  return {
    v: 1, x: ix, y: iy, b, r, n: names, l,
    lb: [...labels.entries()].map(([ni, [x, y, a]]) => [ni, x, y, a]),
    t: trees.flat(),
  };
}

// ---------- run ----------
async function exists(p) { try { await stat(p); return true; } catch { return false; } }

async function main() {
  await mkdir(OUT, { recursive: true });
  // the small starter set (Kottbusser Tor only) is always replaced completely
  try { if (JSON.parse(await readFile(join(OUT, 'index.json'), 'utf8')).starter) args.add('--fresh'); } catch { /* no index yet */ }
  console.log('1/3 districts');
  const polys = await districts();
  const { tiles, bounds } = tilesFor(polys);
  console.log(`  ${tiles.length} tiles of ${TILE} m, bounds ${bounds.join(', ')}`);
  const outline = polys.map((r) => packPts(simplify(r, 8), 0, 0, true));
  await writeFile(join(OUT, 'index.json'), JSON.stringify({ v: 1, lat0: LAT0, lon0: LON0, tile: TILE, bounds, tiles, districts: DISTRICTS, outline,
    credit: 'Map data © OpenStreetMap contributors (ODbL)', built: new Date().toISOString().slice(0, 10) }));
  if (args.has('--fresh') || !(await exists(join(OUT, 'base.json')))) {
    console.log('2/3 base (water, parks, U-Bahn)');
    await writeFile(join(OUT, 'base.json'), JSON.stringify(await base(bounds)));
  }
  if (args.has('--base')) return;
  console.log('3/3 tiles');
  let n = 0;
  for (const [ix, iy] of tiles) {
    n++;
    const file = join(OUT, `tile_${ix}_${iy}.json`);
    if (!args.has('--fresh') && await exists(file)) continue;
    const data = await tile(ix, iy);
    await writeFile(file, JSON.stringify(data));
    console.log(`  ${n}/${tiles.length} tile_${ix}_${iy}: ${data.b.length} buildings, ${data.r.length} streets, ${data.t.length / 2} trees`);
  }
  console.log('done');
}

main().catch((e) => { console.error(e); process.exit(1); });
