// SPOT MAP (hidden admin page, #/spot-map): a real 3D map of Kreuzberg, Neukölln,
// Friedrichshain and Mitte built with three.js from OpenStreetMap data.
//
// Data (made once by tools/build-map-tiles.mjs, see that file):
//   data/map/berlin/index.json      tile list + origin (Kottbusser Tor)
//   data/map/berlin/base.json       water, parks, U-Bahn (tunnels, elevated, stations)
//   data/map/berlin/tile_x_y.json   500 × 500 m: buildings, streets, rail, trees
// Only the tiles near the camera are loaded; far ones are removed again. Each tile
// "rises" out of the ground when it arrives.
// X-RAY button: the ground turns see-through and the U-Bahn tunnels glow below the
// streets as their own layer, with trains and station boxes; tapping a station flies
// back up to its street entrance.
// Spots: js/spots.js.
import { t } from '../i18n.js';
import { esc } from '../ui.js';
import { getCurrentUser } from '../store.js';
import { SPOTS, SPOT_TYPES, FREE_LOT } from '../spots.js';

// three.js – pinned versions
const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
const ORBIT_URL = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';
const MAP_DIR = 'data/map/berlin/';

// the app's neon colours
const GREEN = '#a8ff3e';
const PINK = '#ff3d9a';
const METRO = '#7fd3ff';
const COLOR = { green: GREEN, pink: PINK };
const RISE = 70; // metres a spot grows when tapped
const UG_Y = -46; // depth of the U-Bahn layer (X-ray)

function loadScript(src) {
  const done = document.querySelector(`script[data-src="${src}"]`);
  if (done) return done.dataset.ok === '1' ? Promise.resolve() : new Promise((res, rej) => { done.addEventListener('load', res); done.addEventListener('error', rej); });
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.dataset.src = src; s.crossOrigin = 'anonymous';
    s.addEventListener('load', () => { s.dataset.ok = '1'; res(); });
    s.addEventListener('error', rej);
    document.head.appendChild(s);
  });
}
const getJSON = (f) => fetch(MAP_DIR + f).then((r) => { if (!r.ok) throw new Error(f); return r.json(); });

/** Unpack "n, x0, y0, dx, dy, …" starting at i. Returns [points, next index]. */
function unpack(a, i, ox = 0, oy = 0) {
  const n = a[i]; let x = a[i + 1] + ox, y = a[i + 2] + oy;
  const pts = [[x, y]];
  let k = i + 3;
  for (let j = 1; j < n; j++, k += 2) { x += a[k]; y += a[k + 1]; pts.push([x, y]); }
  return [pts, k];
}
const ringArea = (p) => { let s = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return s / 2; };

const ICON = {
  plus: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M8 2v12M2 8h12"/></svg>',
  minus: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M2 8h12"/></svg>',
  spin: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M16 9a6.5 6.5 0 1 0-1.8 5.2"/><path d="M16 3.5V9h-5.5"/></svg>',
  reset: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M9 1v4M9 13v4M1 9h4M13 9h4"/><circle cx="9" cy="9" r="3"/></svg>',
  close: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12"/></svg>',
};

export async function renderSpotMap(root) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) { // hidden preview: admins only
    root.innerHTML = `<section class="card"><p>${esc(t('admin.noAccess'))}</p></section>`;
    return;
  }
  root.innerHTML = `
    <div class="spotmap" data-spotmap>
      <div class="sm-stage" data-stage role="img" aria-label="${esc(t('spot.stageLabel'))}"></div>
      <div class="sm-loading" data-loading>${esc(t('spot.loading'))}</div>
      <div class="sm-top" data-top>
        <p class="eyebrow sm-eyebrow"><span class="sm-dot" aria-hidden="true"></span><span data-count>${esc(t('spot.title'))}</span></p>
        <nav class="sm-chips" aria-label="${esc(t('spot.filter'))}" data-chips data-hscroll></nav>
      </div>
      <div class="sm-ctl" data-ctl>
        <button type="button" class="sm-btn sm-btn-text bb-chrome bb-chrome--soft" data-time aria-label="${esc(t('spot.light'))}">AUTO</button>
        <button type="button" class="sm-btn sm-btn-text bb-chrome bb-chrome--soft" data-xray aria-pressed="false" aria-label="${esc(t('spot.xrayLabel'))}">${esc(t('spot.xray'))}</button>
        <button type="button" class="sm-btn bb-chrome bb-chrome--soft" data-zoom-in aria-label="${esc(t('spot.zoomIn'))}">${ICON.plus}</button>
        <button type="button" class="sm-btn bb-chrome bb-chrome--soft" data-zoom-out aria-label="${esc(t('spot.zoomOut'))}">${ICON.minus}</button>
        <button type="button" class="sm-btn bb-chrome bb-chrome--soft" data-spin aria-label="${esc(t('spot.spin'))}">${ICON.spin}</button>
        <button type="button" class="sm-btn bb-chrome bb-chrome--soft" data-reset aria-label="${esc(t('spot.reset'))}">${ICON.reset}</button>
      </div>
      <section class="sm-sheet" data-sheet aria-live="polite">
        <div class="sm-scroll">
        <div class="sm-view" data-v-idle>
          <p class="sm-label" data-hint>${esc(t('spot.tapHint'))}</p>
          <div class="sm-list" data-list></div>
        </div>
        <div class="sm-view" data-v-spot hidden>
          <div class="sm-row">
            <div class="sm-tags"><span class="sm-tag" data-s-tag></span><span class="sm-tag sm-tag-partner" data-s-partner hidden>${esc(t('spot.partner'))}</span></div>
            <button type="button" class="sm-btn sm-close" data-close aria-label="${esc(t('spot.close'))}">${ICON.close}</button>
          </div>
          <h2 class="sm-name" data-s-name></h2>
          <p class="sm-small">[Shop name] · [Address] · [Opening hours]<br><span data-s-coords></span></p>
          <p class="sm-perk" data-s-perk hidden>[Partner perk for BudBattlers]</p>
          <div class="sm-btns">
            <a class="btn btn-go" data-s-route href="#" target="_blank" rel="noopener">${esc(t('spot.route'))}</a>
            <a class="btn btn-ghost" data-s-insta href="#" target="_blank" rel="noopener noreferrer">Instagram</a>
          </div>
        </div>
        <div class="sm-view" data-v-lot hidden>
          <div class="sm-row">
            <span class="sm-tag sm-tag-lot">${esc(t('spot.freeLot'))}</span>
            <button type="button" class="sm-btn sm-close" data-close aria-label="${esc(t('spot.close'))}">${ICON.close}</button>
          </div>
          <h2 class="sm-name">${esc(t('spot.lotTitle'))} <span class="sm-glow">${esc(t('spot.lotTitleHere'))}</span></h2>
          <p class="sm-small">${esc(t('spot.lotText'))}</p>
          <a class="btn btn-go" href="#/business">${esc(t('spot.becomePartner'))}</a>
        </div>
        </div>
        <div class="sm-foot">
          <span>${esc(t('spot.gestures'))}</span>
          <span>Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a></span>
        </div>
      </section>
    </div>`;

  const q = (sel) => root.querySelector(sel);
  const app = q('[data-spotmap]');
  // the map fills the space between the app's top bar and bottom bar
  const fit = () => {
    const top = Math.max(document.getElementById('topbar')?.getBoundingClientRect().bottom || 0,
      (() => { const d = document.getElementById('demo-banner'); return d && !d.hidden ? d.getBoundingClientRect().bottom : 0; })());
    const nav = document.getElementById('bottomnav')?.getBoundingClientRect();
    app.style.top = `${Math.round(top)}px`;
    app.style.bottom = nav ? `${Math.round(window.innerHeight - nav.top)}px` : '0px';
  };
  fit();
  document.body.classList.add('sm-open');
  const unlockZoom = lockPageZoom();

  let index, base;
  try {
    [index, base] = await Promise.all([getJSON('index.json'), getJSON('base.json'), loadScript(THREE_URL).then(() => loadScript(ORBIT_URL))]);
  } catch { /* handled below */ }
  if (!root.isConnected) { unlockZoom(); return; }
  if (!window.THREE || !window.THREE.OrbitControls || !index || !base) {
    q('[data-loading]').textContent = t('spot.engineFailed');
    return;
  }
  startMap(root, q, app, fit, index, base, unlockZoom);
}

/** While the map is open, two fingers move the map, never the page: page zoom is
 *  switched off (it pushed the control buttons off the screen). Returns "undo". */
function lockPageZoom() {
  const meta = document.querySelector('meta[name="viewport"]');
  const before = meta?.getAttribute('content');
  if (meta) meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
  const stopGesture = (e) => e.preventDefault(); // iOS Safari pinch on the overlay
  document.addEventListener('gesturestart', stopGesture);
  return () => {
    if (meta && before != null) meta.setAttribute('content', before);
    document.removeEventListener('gesturestart', stopGesture);
  };
}

function startMap(root, q, app, fit, index, base, unlockZoom) {
  const THREE = window.THREE;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LAT0 = index.lat0, LON0 = index.lon0, TILE = index.tile;
  const MX = 111320 * Math.cos(LAT0 * Math.PI / 180), MY = 110540;
  const toLatLon = (x, y) => [LAT0 + y / MY, LON0 + x / MX];
  const TYPES = Object.fromEntries(Object.entries(SPOT_TYPES).map(([k, v]) => [k, { label: t(`spot.type.${k}`), col: COLOR[v.color] || GREEN }]));
  const font = getComputedStyle(document.body).fontFamily;
  const [BX0, BY0, BX1, BY1] = index.bounds;

  // ---------- quality (lowered automatically if the phone is slow) ----------
  const Q = { loadR: 1250, treeR: 700, labelR: 360, signR: 900, dpr: Math.min(window.devicePixelRatio || 1, 2), level: 2 };

  // ---------- three.js scene ----------
  const stage = q('[data-stage]');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Q.dpr);
  renderer.setClearColor(0x000000, 0);
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0d0b, 700, 1700);
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 5000);
  const HOME_POS = new THREE.Vector3(300, 340, 400);
  camera.position.copy(HOME_POS);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minPolarAngle = 0.25; controls.maxPolarAngle = 1.22;
  controls.minDistance = 90; controls.maxDistance = 1300;
  controls.screenSpacePanning = false;
  controls.autoRotate = !reduce; controls.autoRotateSpeed = 0.35;
  controls.target.set(0, 0, 0);
  const spinBtn = q('[data-spin]');
  let flyTo = null, flyDist = 0;
  const syncSpin = () => spinBtn.classList.toggle('on', controls.autoRotate);
  controls.addEventListener('start', () => { controls.autoRotate = false; flyTo = null; syncSpin(); });
  syncSpin();

  const hemi = new THREE.HemisphereLight(0x8fa0ff, 0x0a0a0a, 0.55);
  const sun = new THREE.DirectionalLight(0xc8d0ff, 0.55);
  sun.position.set(-220, 420, 160);
  scene.add(hemi, sun);

  // ground: a big disc that fades into the sky with the fog (no visible edge)
  const groundMat = new THREE.MeshBasicMaterial({ color: 0x0d120f });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(20000, 48), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.renderOrder = -2;
  scene.add(ground);

  // shared materials (the light modes change their colours)
  const M = {
    bld: new THREE.MeshLambertMaterial({ color: 0x55554f, vertexColors: true }),
    edge: new THREE.LineBasicMaterial({ color: GREEN, transparent: true, opacity: 0.22 }),
    road: new THREE.MeshBasicMaterial({ color: 0x050706 }),
    centre: new THREE.LineDashedMaterial({ color: PINK, dashSize: 6, gapSize: 9, transparent: true, opacity: 0.5 }),
    rail: new THREE.LineBasicMaterial({ color: 0x9aa59f, transparent: true, opacity: 0.55 }),
    sbahn: new THREE.LineBasicMaterial({ color: GREEN, transparent: true, opacity: 0.45 }),
    park: new THREE.MeshLambertMaterial({ color: 0x0e2614 }),
    water: new THREE.MeshPhongMaterial({ color: 0x0a2246, specular: 0x7fb4ff, shininess: 70, emissive: 0x020a18 }),
    tree: new THREE.MeshLambertMaterial({ color: 0x1f4d24, emissive: new THREE.Color('#3f9d1c'), emissiveIntensity: 0.35 }),
    label: [],
  };

  // ---------- helpers that build merged geometry ----------
  function meshFrom(pos, mat, nor, col) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (nor) g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return new THREE.Mesh(g, mat);
  }
  function linesFrom(pos, mat, dashed) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const l = new THREE.LineSegments(g, mat);
    if (dashed) l.computeLineDistances();
    return l;
  }
  /** Flat polygons (with holes) at height y into pos/nor arrays. */
  function pushArea(pos, nor, rings, y) {
    const contour = rings[0].map((p) => new THREE.Vector2(p[0], p[1]));
    const holes = rings.slice(1).map((r) => r.map((p) => new THREE.Vector2(p[0], p[1])));
    const all = contour.concat(...holes);
    let tris;
    try { tris = THREE.ShapeUtils.triangulateShape(contour, holes); } catch { return; }
    tris.forEach((tri) => {
      const [a, b, c] = tri.map((i) => all[i]);
      const cw = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) < 0;
      (cw ? [a, c, b] : [a, b, c]).forEach((v) => { pos.push(v.x, y, -v.y); nor.push(0, 1, 0); });
    });
  }
  /** A box (non-indexed) rotated around Y. */
  function pushBox(pos, nor, cx, cy, cz, sx, sy, sz, rot) {
    const g = new THREE.BoxGeometry(sx, sy, sz).toNonIndexed();
    g.rotateY(rot); g.translate(cx, cy, cz);
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    g.dispose();
  }
  /** A glowing tube along a 3D polyline (non-indexed triangles). */
  function pushTube(pos, pts, r, seg = 6) {
    const V = THREE.Vector3, rings = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const tg = new V(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
      let side = new V().crossVectors(tg, new V(0, 1, 0));
      if (side.lengthSq() < 1e-6) side = new V(1, 0, 0);
      side.normalize();
      const up = new V().crossVectors(side, tg).normalize();
      const ring = [];
      for (let s = 0; s < seg; s++) {
        const an = (s / seg) * Math.PI * 2;
        ring.push([pts[i][0] + r * (Math.cos(an) * side.x + Math.sin(an) * up.x), pts[i][1] + r * (Math.cos(an) * side.y + Math.sin(an) * up.y), pts[i][2] + r * (Math.cos(an) * side.z + Math.sin(an) * up.z)]);
      }
      rings.push(ring);
    }
    for (let i = 0; i + 1 < rings.length; i++) {
      for (let s = 0; s < seg; s++) {
        const a = rings[i][s], b = rings[i][(s + 1) % seg], c = rings[i + 1][(s + 1) % seg], d = rings[i + 1][s];
        pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      }
    }
  }
  function textCanvas(lines, opts) {
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    const { w, h, draw } = opts(g);
    c.width = w; c.height = h;
    draw(g, lines);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
  }

  // ---------- water + parks (whole area, loaded once) ----------
  const areaGroup = new THREE.Group();
  scene.add(areaGroup);
  {
    const unpackPolys = (list) => list.map((poly) => poly.map((r) => unpack(r, 0)[0]));
    const wp = [], wn = [], pp = [], pn = [];
    unpackPolys(base.parks).forEach((rings) => pushArea(pp, pn, rings, 0.1));
    unpackPolys(base.water).forEach((rings) => pushArea(wp, wn, rings, 0.12));
    const parks = meshFrom(pp, M.park, pn); parks.renderOrder = -1;
    const water = meshFrom(wp, M.water, wn); water.renderOrder = -1;
    areaGroup.add(parks, water);
  }

  // ---------- U-Bahn: elevated viaduct (always) + tunnels/stations (X-ray) ----------
  const ugGroup = new THREE.Group(); ugGroup.visible = false; // the underground layer
  scene.add(ugGroup);
  const chains = base.metro.map((m) => ({ kind: m[0], z: m[1], pts: unpack(m, 2)[0] }));
  const tunnelY = (z) => UG_Y - (z <= -2 ? 8 : 0);
  // underground "slab" – the separate metro level below the city
  {
    const pad = 300, w = BX1 - BX0 + pad * 2, d = BY1 - BY0 + pad * 2;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 4, d), new THREE.MeshBasicMaterial({ color: 0x14181a, transparent: true, opacity: 0.85, depthWrite: false }));
    slab.position.set((BX0 + BX1) / 2, UG_Y - 12, -(BY0 + BY1) / 2);
    const grid = new THREE.GridHelper(Math.max(w, d), Math.round(Math.max(w, d) / 50), 0x7fd3ff, 0x7fd3ff);
    grid.material.transparent = true; grid.material.opacity = 0.07; grid.material.depthWrite = false;
    grid.position.set((BX0 + BX1) / 2, UG_Y - 9.9, -(BY0 + BY1) / 2);
    ugGroup.add(slab, grid);
  }
  const tubeMat = new THREE.MeshBasicMaterial({ color: METRO, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const coreMat = new THREE.LineBasicMaterial({ color: 0xcff0ff, transparent: true, opacity: 0.9 });
  {
    const tp = [], cp = [];
    chains.filter((c) => c.kind === 1).forEach((c) => {
      const y = tunnelY(c.z);
      const p3 = c.pts.map((p) => [p[0], y, -p[1]]);
      pushTube(tp, p3, 3.4);
      for (let i = 1; i < p3.length; i++) cp.push(...p3[i - 1], ...p3[i]);
    });
    ugGroup.add(meshFrom(tp, tubeMat), linesFrom(cp, coreMat));
  }
  // trains in the tunnels (only moved while X-ray is on)
  const lenOf = (pts) => { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return L; };
  const along = (c, d) => {
    const L = c.len;
    let k = 1; while (k < L.length - 1 && L[k] < d) k++;
    const f = (d - L[k - 1]) / ((L[k] - L[k - 1]) || 1), a = c.pts[k - 1], b = c.pts[k];
    return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  };
  chains.forEach((c) => { c.len = lenOf(c.pts); c.total = c.len[c.len.length - 1]; });
  const ugTrainMat = new THREE.MeshBasicMaterial({ color: 0xe8f7ff });
  const ugTrains = chains.filter((c) => c.kind === 1 && c.total > 260).sort((a, b) => b.total - a.total).slice(0, 26).map((c, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(34, 3, 3), ugTrainMat);
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: METRO })));
    ugGroup.add(m);
    return { m, c, off: i * 137.5, y: tunnelY(c.z) };
  });
  // elevated U1/U3: viaduct, green rail, yellow trains
  const VIA_Y = 7.5;
  const viaMat = new THREE.MeshStandardMaterial({ color: 0x3a3b38, roughness: 0.9 });
  const trainMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color('#F5D33B'), emissiveIntensity: 0.9 });
  const viaGroup = new THREE.Group();
  scene.add(viaGroup);
  const elevated = chains.filter((c) => c.kind === 2);
  {
    const vp = [], vn = [], rp = [], gp = [];
    elevated.forEach((c) => {
      const P = c.pts;
      for (let i = 1; i < P.length; i++) {
        const [ax, ay] = P[i - 1], [bx, by] = P[i];
        const L = Math.hypot(bx - ax, by - ay); if (L < 0.5) continue;
        const ang = Math.atan2(by - ay, bx - ax);
        pushBox(vp, vn, (ax + bx) / 2, VIA_Y, -(ay + by) / 2, L + 0.6, 1.4, 6, ang);
        rp.push(ax, VIA_Y + 0.8, -ay, bx, VIA_Y + 0.8, -by);
      }
      for (let d = 0; d < c.total; d += 24) {
        const p = along(c, d);
        pushBox(vp, vn, p.x, VIA_Y / 2, -p.y, 2.2, VIA_Y, 2.2, p.ang);
      }
    });
    chains.filter((c) => c.kind === 0).forEach((c) => { for (let i = 1; i < c.pts.length; i++) gp.push(c.pts[i - 1][0], 0.35, -c.pts[i - 1][1], c.pts[i][0], 0.35, -c.pts[i][1]); });
    viaGroup.add(meshFrom(vp, viaMat, vn), linesFrom(rp, new THREE.LineBasicMaterial({ color: GREEN, transparent: true, opacity: 0.8 })), linesFrom(gp, new THREE.LineBasicMaterial({ color: METRO, transparent: true, opacity: 0.6 })));
  }
  const elTrains = elevated.filter((c) => c.total > 300).sort((a, b) => b.total - a.total).slice(0, 4).map((c, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(36, 3.2, 3.6), trainMat);
    viaGroup.add(m);
    return { m, c, off: i * 211 };
  });
  const pingPong = (c, tt, speed, off) => {
    if (reduce) return c.total / 2;
    const cyc = (tt * speed + off) % (c.total * 2);
    return cyc < c.total ? cyc : c.total * 2 - cyc;
  };

  // stations: underground glowing box + shaft + stairs to the street, sign above ground
  const stationPick = [];
  const stationMat = new THREE.MeshBasicMaterial({ color: METRO, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending });
  const shaftMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending });
  const glowLine = new THREE.LineBasicMaterial({ color: 0xe8f7ff, transparent: true, opacity: 0.95 });
  const stations = base.stations.map((s) => ({ ...s, ex: s.en ? s.en[0] : s.x, ey: s.en ? s.en[1] : s.y }));
  stations.forEach((s) => {
    if (!s.u) return;
    // direction of the nearest tunnel
    let ang = 0, best = 1e9;
    chains.forEach((c) => { if (c.kind !== 1) return; for (let i = 1; i < c.pts.length; i++) {
      const p = c.pts[i]; const d = Math.hypot(p[0] - s.x, p[1] - s.y);
      if (d < best) { best = d; ang = Math.atan2(p[1] - c.pts[i - 1][1], p[0] - c.pts[i - 1][0]); }
    } });
    const box = new THREE.Mesh(new THREE.BoxGeometry(80, 9, 18), stationMat);
    box.position.set(s.x, UG_Y + 1, -s.y); box.rotation.y = ang;
    box.add(new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), glowLine));
    box.userData.station = s;
    const H = -UG_Y - 4;
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(5, H, 5), shaftMat);
    shaft.position.set(s.ex, UG_Y + 5 + H / 2 - 1, -s.ey);
    shaft.add(new THREE.LineSegments(new THREE.EdgesGeometry(shaft.geometry), glowLine));
    shaft.userData.station = s;
    // zig-zag stairs next to the shaft
    const st = [], steps = 6, sx = s.ex + 6, sy = s.ey;
    for (let k = 0; k < steps; k++) {
      const y0 = UG_Y + 6 + (k / steps) * (H - 2), y1 = UG_Y + 6 + ((k + 1) / steps) * (H - 2), dx = k % 2 ? -7 : 7;
      st.push(sx + (k % 2 ? 7 : 0), y0, -sy, sx + (k % 2 ? 7 : 0) + dx, y1, -sy);
    }
    const stairs = linesFrom(st, glowLine);
    ugGroup.add(box, shaft, stairs);
    stationPick.push(box, shaft);
  });
  // station signs (created when the camera comes close)
  function makeSign(s) {
    const tex = textCanvas(null, () => ({ w: 640, h: 128, draw: (g) => {
      g.fillStyle = 'rgba(10,13,11,.92)'; g.fillRect(0, 0, 640, 128);
      g.strokeStyle = PINK; g.lineWidth = 6; g.strokeRect(3, 3, 634, 122);
      g.fillStyle = '#2E6BFF'; g.fillRect(16, 16, 96, 96);
      g.fillStyle = '#ffffff'; g.font = `700 76px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('U', 64, 68);
      g.textAlign = 'left'; g.fillStyle = '#e9fff2';
      let fs = 44; g.font = `700 ${fs}px ${font}`;
      const name = s.n.toUpperCase();
      while (g.measureText(name).width > 490 && fs > 24) { fs -= 2; g.font = `700 ${fs}px ${font}`; }
      g.fillText(name, 132, s.l.length ? 52 : 66);
      if (s.l.length) { g.fillStyle = '#8fa699'; g.font = `700 26px ${font}`; g.fillText(s.l.join(' · '), 132, 94); }
    } }));
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.set(55, 11, 1); sp.position.set(s.ex, s.e ? 30 : 22, -s.ey); sp.renderOrder = 10;
    sp.userData.station = s;
    scene.add(sp);
    return sp;
  }

  // ---------- spots (js/spots.js) – placed on real buildings when their tile arrives ----------
  const spots = SPOTS.map((p) => ({ id: p.id, name: p.name, type: p.type, partner: !!p.partner, instagram: p.instagram || '', at: p.at,
    ok: (b) => b.h >= 13 && b.r > 6 && b.r < 30 }));
  spots.push({ id: 'lot', name: t('spot.freeLot'), type: 'lot', lot: true, at: FREE_LOT.at, ok: (b) => b.h <= 10 && b.r > 5 && b.r < 26 });
  spots.forEach((s) => { s.col = s.lot ? GREEN : TYPES[s.type].col; s.vis = 1; });
  const pickables = [];
  const springs = [];

  function glowTexture(col) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  /** A spot's own building (taken out of the merged tile so it can rise alone). */
  function buildSpot(s, b, k) {
    const shape = new THREE.Shape(b.pts.map((p) => new THREE.Vector2(p[0], p[1])));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: b.h, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const col = s.col;
    let mat, edges;
    if (s.lot) {
      mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.1, depthWrite: false });
      edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.9 }));
    } else {
      mat = new THREE.MeshStandardMaterial({ color: 0x121612, emissive: new THREE.Color(col), emissiveIntensity: 0.22, roughness: 0.6, transparent: true, opacity: 1 });
      edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.95 }));
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.add(edges);
    mesh.userData.spotId = s.id;
    scene.add(mesh);
    pickables.push(mesh);
    const sp = { mesh, c: reduce ? 1 : 0.001, v: 0, t: 1, delay: performance.now() + (reduce ? 0 : 500 + k * 90) };
    if (s.lot) sp.t = 0.25;
    if (s.partner) sp.t = (b.h + 10) / b.h;
    mesh.scale.y = sp.c;
    springs.push(sp);
    Object.assign(s, { mesh, spring: sp, mat, edges, h: b.h, b });
    // pulse ring, base ring, ground glow, light beam, partner crown
    const R = b.r + 4;
    const ringMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
    let baseRing;
    if (s.lot) {
      baseRing = new THREE.Group();
      for (let a = 0; a < 16; a++) baseRing.add(new THREE.Mesh(new THREE.RingGeometry(R, R + 1.6, 4, 1, a / 16 * Math.PI * 2, Math.PI / 16), ringMat));
    } else baseRing = new THREE.Mesh(new THREE.RingGeometry(R, R + 1.4, 48), ringMat);
    baseRing.rotation.x = -Math.PI / 2; baseRing.position.set(b.cx, 0.5, -b.cy);
    const pulse = new THREE.Mesh(new THREE.RingGeometry(R, R + 2.2, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    pulse.rotation.x = -Math.PI / 2; pulse.position.set(b.cx, 0.6, -b.cy); pulse.userData.spotId = s.id;
    pickables.push(pulse);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(R * 5, R * 5), new THREE.MeshBasicMaterial({ map: glowTexture(col), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.rotation.x = -Math.PI / 2; glow.position.set(b.cx, 0.7, -b.cy); glow.visible = false;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 5, 260, 16, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.set(b.cx, 200, -b.cy); beam.visible = false;
    scene.add(baseRing, pulse, glow, beam);
    let crown = null;
    if (s.partner) {
      crown = new THREE.Mesh(new THREE.OctahedronGeometry(6), new THREE.MeshStandardMaterial({ color: 0x2a0f1c, emissive: new THREE.Color(PINK), emissiveIntensity: 1 }));
      crown.position.set(b.cx, b.h + 12, -b.cy);
      crown.add(new THREE.LineSegments(new THREE.EdgesGeometry(crown.geometry), new THREE.LineBasicMaterial({ color: 0xffffff })));
      scene.add(crown);
    }
    Object.assign(s, { base: baseRing, pulse, glow, beam, crown, phase: k * 0.17 });
    applySpotState(s);
  }

  // ---------- tiles ----------
  const TILESET = new Set(index.tiles.map(([x, y]) => `${x}_${y}`));
  const tiles = new Map(); // key -> tile
  let loading = 0;
  const pending = []; // downloaded, waiting to be built (one per frame)

  function buildTile(key, d) {
    const ox = d.x * TILE, oy = d.y * TILE;
    const group = new THREE.Group();
    // buildings
    const blds = d.b.map((a) => {
      const pts = unpack(a, 1, ox, oy)[0];
      let cx = 0, cy = 0; pts.forEach((p) => { cx += p[0]; cy += p[1]; }); cx /= pts.length; cy /= pts.length;
      let r = 0; pts.forEach((p) => { r = Math.max(r, Math.hypot(p[0] - cx, p[1] - cy)); });
      return { h: Math.max(a[0], 3), pts, cx, cy, r };
    });
    // spots whose position lies in this tile take their nearest fitting building
    const own = new Set();
    spots.forEach((s, k) => {
      if (s.mesh || s.at[0] < ox || s.at[0] >= ox + TILE || s.at[1] < oy || s.at[1] >= oy + TILE) return;
      let best = -1, bd = 1e9;
      blds.forEach((b, i) => { if (own.has(i) || !s.ok(b)) return; const dd = Math.hypot(b.cx - s.at[0], b.cy - s.at[1]); if (dd < bd) { bd = dd; best = i; } });
      if (best >= 0) { own.add(best); buildSpot(s, blds[best], k); }
    });
    const P = [], N = [], C = [], E = [];
    blds.forEach((b, i) => {
      if (own.has(i)) return;
      let pts = b.pts;
      if (ringArea(pts) < 0) pts = pts.slice().reverse();
      const h = b.h, shade = 0.78 + ((i * 7919) % 23) / 100;
      const n = pts.length;
      for (let k = 0; k < n; k++) {
        const [ax, ay] = pts[k], [bx, by] = pts[(k + 1) % n];
        const L = Math.hypot(bx - ax, by - ay) || 1, nx = (by - ay) / L, nz = -(-(bx - ax) / L);
        P.push(ax, 0, -ay, bx, 0, -by, bx, h, -by, ax, 0, -ay, bx, h, -by, ax, h, -ay);
        for (let v = 0; v < 6; v++) { N.push(nx, 0, nz); C.push(shade, shade, shade); }
        E.push(ax, h, -ay, bx, h, -by);
        // vertical edge at sharp corners
        const [px, py] = pts[(k - 1 + n) % n];
        const turn = Math.abs(Math.atan2((ax - px) * (by - ay) - (ay - py) * (bx - ax), (ax - px) * (bx - ax) + (ay - py) * (by - ay)));
        if (turn > 0.45) E.push(ax, 0, -ay, ax, h, -ay);
      }
      let tris;
      try { tris = THREE.ShapeUtils.triangulateShape(pts.map((p) => new THREE.Vector2(p[0], p[1])), []); } catch { tris = []; }
      const rs = shade * 0.92;
      tris.forEach((tri) => {
        const [a, bb, c] = tri.map((j) => pts[j]);
        const cw = (bb[0] - a[0]) * (c[1] - a[1]) - (bb[1] - a[1]) * (c[0] - a[0]) < 0;
        (cw ? [a, c, bb] : [a, bb, c]).forEach((v) => { P.push(v[0], h, -v[1]); N.push(0, 1, 0); C.push(rs, rs, rs); });
      });
    });
    const bmesh = meshFrom(P, M.bld, N, C);
    bmesh.userData.isBuilding = true;
    group.add(bmesh, linesFrom(E, M.edge));
    // streets
    const R = [], CL = [];
    d.r.forEach((a) => {
      const w = a[0] + 1.5, y = 0.16 + a[0] * 0.002;
      const pts = unpack(a, 2, ox, oy)[0];
      for (let i = 1; i < pts.length; i++) {
        const [x1, y1] = pts[i - 1], [x2, y2] = pts[i];
        const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
        const ex = dx / L * w / 2, ey = dy / L * w / 2, nx = -dy / L * w / 2, ny = dx / L * w / 2;
        const ax = x1 - ex, ay = y1 - ey, bx = x2 + ex, by = y2 + ey;
        R.push(ax + nx, y, -(ay + ny), ax - nx, y, -(ay - ny), bx - nx, y, -(by - ny), ax + nx, y, -(ay + ny), bx - nx, y, -(by - ny), bx + nx, y, -(by + ny));
        if (a[0] >= 14) CL.push(x1, 0.45, -y1, x2, 0.45, -y2);
      }
    });
    const roads = meshFrom(R, M.road); roads.material.side = THREE.DoubleSide;
    group.add(roads, linesFrom(CL, M.centre, true));
    // surface rail (S-Bahn, trains, trams); bridges a bit higher
    const RL = [], SL = [];
    d.l.forEach((a) => {
      const y = a[1] ? 6 + a[1] * 2 : 0.4;
      const pts = unpack(a, 2, ox, oy)[0];
      const out = a[0] === 1 ? SL : RL;
      for (let i = 1; i < pts.length; i++) out.push(pts[i - 1][0], y, -pts[i - 1][1], pts[i][0], y, -pts[i][1]);
    });
    group.add(linesFrom(RL, M.rail), linesFrom(SL, M.sbahn));
    // trees (low-poly cones, neon tinted)
    let trees = null;
    const nT = d.t.length / 2;
    if (nT) {
      trees = new THREE.InstancedMesh(TREE_GEO, M.tree, nT);
      const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
      for (let i = 0; i < nT; i++) {
        const s = 0.75 + ((i * 2654435761) % 100) / 180;
        ps.set(ox + d.t[i * 2], 0, -(oy + d.t[i * 2 + 1])); sc.set(s, s * (0.9 + (i % 5) * 0.08), s);
        qq.setFromAxisAngle(UP, (i % 7) * 0.9);
        trees.setMatrixAt(i, m4.compose(ps, qq, sc));
      }
      group.add(trees);
    }
    const now = performance.now();
    const spring = { mesh: group, c: reduce ? 1 : 0.001, v: 0, t: 1, delay: now + (reduce ? 0 : 60) };
    group.scale.y = spring.c;
    springs.push(spring);
    scene.add(group);
    const cx = ox + TILE / 2, cy = oy + TILE / 2;
    const tile = tiles.get(key);
    Object.assign(tile, { state: 'ready', group, bmesh, trees, spring, data: d, cx, cy, labels: null });
    pickables.push(bmesh);
  }
  const TREE_GEO = new THREE.ConeGeometry(2.6, 7.5, 5, 1).translate(0, 4.6, 0);
  const UP = new THREE.Vector3(0, 1, 0);

  function disposeTile(key) {
    const tl = tiles.get(key);
    tiles.delete(key);
    if (!tl || tl.state !== 'ready') return;
    scene.remove(tl.group);
    tl.group.traverse((o) => { if (o.geometry && o.geometry !== TREE_GEO) o.geometry.dispose(); });
    tl.trees?.dispose?.();
    if (tl.labels) tl.labels.forEach((l) => { scene.remove(l); l.material.map.dispose(); l.material.dispose(); l.geometry.dispose(); });
    const pi = pickables.indexOf(tl.bmesh); if (pi >= 0) pickables.splice(pi, 1);
    const si = springs.indexOf(tl.spring); if (si >= 0) springs.splice(si, 1);
  }

  // street name labels: flat on the street, only when zoomed in close
  function makeLabels(tl) {
    const d = tl.data, ox = d.x * TILE, oy = d.y * TILE;
    tl.labels = d.lb.map(([ni, x, y, a]) => {
      const name = d.n[ni];
      const tex = textCanvas(null, (g0) => {
        g0.font = `700 30px ${font}`;
        const w = Math.min(1024, Math.ceil(g0.measureText(name.toUpperCase()).width) + 24);
        return { w, h: 44, draw: (g) => {
          g.font = `700 30px ${font}`; g.textBaseline = 'middle'; g.textAlign = 'center';
          g.lineWidth = 6; g.strokeStyle = 'rgba(5,7,6,.9)'; g.strokeText(name.toUpperCase(), w / 2, 23);
          g.fillStyle = 'rgba(233,255,242,.92)'; g.fillText(name.toUpperCase(), w / 2, 23);
        } };
      });
      const W = tex.image.width / 44 * 3.8;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(W, 3.8), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      m.rotation.set(-Math.PI / 2, 0, a * Math.PI / 180);
      m.position.set(ox + x, 0.8, -(oy + y));
      m.renderOrder = 5; m.visible = false;
      scene.add(m);
      return m;
    });
  }

  function wantTiles() {
    const tx = controls.target.x, ty = -controls.target.z;
    const camD = camera.position.distanceTo(controls.target);
    const R = Math.min(Q.loadR, Math.max(650, camD * 1.3));
    const need = [];
    for (let ix = Math.floor((tx - R) / TILE); ix <= Math.floor((tx + R) / TILE); ix++) {
      for (let iy = Math.floor((ty - R) / TILE); iy <= Math.floor((ty + R) / TILE); iy++) {
        const key = `${ix}_${iy}`;
        if (!TILESET.has(key)) continue;
        const dx = Math.max(ix * TILE - tx, 0, tx - (ix + 1) * TILE), dy = Math.max(iy * TILE - ty, 0, ty - (iy + 1) * TILE);
        const dist = Math.hypot(dx, dy);
        if (dist <= R) need.push([dist, key, ix, iy]);
      }
    }
    need.sort((a, b) => a[0] - b[0]);
    for (const [, key, ix, iy] of need) {
      if (loading >= 2) break;
      if (tiles.has(key)) continue;
      tiles.set(key, { state: 'loading' });
      loading++;
      getJSON(`tile_${ix}_${iy}.json`).then((d) => { pending.push([key, d]); }).catch(() => { tiles.delete(key); TILESET.delete(key); })
        .finally(() => { loading--; });
    }
    // remove far tiles
    for (const [key, tl] of tiles) {
      if (tl.state !== 'ready') continue;
      if (Math.hypot(tl.cx - tx, tl.cy - ty) > R + TILE * 1.2) disposeTile(key);
    }
    // level of detail: trees, labels, station signs only near the camera
    const close = camD < 380;
    let nLabels = 0;
    for (const tl of tiles.values()) {
      if (tl.state !== 'ready') continue;
      const dist = Math.hypot(tl.cx - tx, tl.cy - ty) - TILE * 0.7;
      if (tl.trees) tl.trees.visible = dist < Q.treeR;
      const showLabels = close && dist < Q.labelR;
      if (showLabels && !tl.labels) makeLabels(tl);
      if (tl.labels) tl.labels.forEach((l) => { const on = showLabels && nLabels < 60 && Math.hypot(l.position.x - tx, -l.position.z - ty) < Q.labelR; l.visible = on; if (on) nLabels++; });
    }
    stations.forEach((s) => {
      const near = Math.hypot(s.ex - tx, s.ey - ty) < Math.min(Q.signR, camD * 1.6 + 200);
      if (near && !s.sign) s.sign = makeSign(s);
      if (s.sign) s.sign.visible = near;
    });
  }

  // ---------- light by time of day (night = the app's background tone) ----------
  const MODES = ['auto', 'morning', 'day', 'evening', 'night'];
  const LIGHT = {
    night: { sky: 'radial-gradient(90% 60% at 50% 25%, rgba(255,61,154,.10), transparent 70%), radial-gradient(ellipse at 50% 30%, #15211a 0%, #0a0d0b 70%)', fog: 0x0a0d0b, ground: 0x0d120f, road: 0x050706, bld: 0x5a5a54, hemi: [0x8fa0ff, 0x0a0a0a, 0.55], sun: [0xc8d0ff, 0.55], edge: 0.22, train: 0.9, park: 0x0e2614, water: 0x0a2246, tree: 0.45 },
    evening: { sky: 'linear-gradient(to bottom,#FF7A59 0%,#7A2E6B 40%,#2a1733 80%)', fog: 0x2a1733, ground: 0x231a2a, road: 0x140d19, bld: 0x8a7590, hemi: [0xffb0a0, 0x1a0f20, 0.7], sun: [0xff9a70, 0.9], edge: 0.16, train: 0.8, park: 0x24302a, water: 0x2a2f5e, tree: 0.25 },
    morning: { sky: 'linear-gradient(to bottom,#FFC9B0 0%,#C9A3C4 45%,#8c7d99 90%)', fog: 0x8c7d99, ground: 0x4a4352, road: 0x352f3c, bld: 0xbfb4c0, hemi: [0xfff0e8, 0x403848, 0.8], sun: [0xffd2b8, 1.0], edge: 0.1, train: 0.6, park: 0x4d6a4f, water: 0x4a6a9a, tree: 0.12 },
    day: { sky: 'linear-gradient(to bottom,#D9E4E2 0%,#AEBDBA 60%,#aebdba 100%)', fog: 0xaebdba, ground: 0x6a706a, road: 0x474c47, bld: 0xd8d6cd, hemi: [0xffffff, 0x606660, 0.9], sun: [0xffffff, 1.1], edge: 0.08, train: 0.5, park: 0x5c7a58, water: 0x3d6f9e, tree: 0.08 },
  };
  let timeIdx = 0;
  const timeBtn = q('[data-time]');
  const currentMode = () => {
    if (timeIdx !== 0) return MODES[timeIdx];
    const h = new Date().getHours();
    return h >= 5 && h < 10 ? 'morning' : h >= 10 && h < 17 ? 'day' : h >= 17 && h < 21 ? 'evening' : 'night';
  };
  function applyLight() {
    const m = currentMode(), L = LIGHT[m];
    app.style.background = L.sky;
    scene.fog.color.setHex(L.fog);
    groundMat.color.setHex(L.ground);
    M.road.color.setHex(L.road);
    M.bld.color.setHex(L.bld);
    M.park.color.setHex(L.park);
    M.water.color.setHex(L.water);
    M.tree.emissiveIntensity = L.tree;
    hemi.color.setHex(L.hemi[0]); hemi.groundColor.setHex(L.hemi[1]); hemi.intensity = L.hemi[2];
    sun.color.setHex(L.sun[0]); sun.intensity = L.sun[1];
    M.edge.opacity = xray ? 0.5 : L.edge;
    trainMat.emissiveIntensity = L.train;
    timeBtn.textContent = t(`spot.mode.${MODES[timeIdx]}`);
    timeBtn.classList.toggle('on', timeIdx !== 0);
    timeBtn.setAttribute('aria-label', t('spot.lightLabel', { mode: (timeIdx === 0 ? `${t('spot.mode.auto')}, ` : '') + t(`spot.modeName.${m}`) }));
  }
  timeBtn.addEventListener('click', () => { timeIdx = (timeIdx + 1) % MODES.length; applyLight(); });

  // ---------- X-ray: see-through ground, glowing U-Bahn layer below ----------
  let xray = false;
  const xrayBtn = q('[data-xray]'), hintEl = q('[data-hint]');
  function setXray(on) {
    xray = on;
    ugGroup.visible = on;
    // see-through only while X-ray is on (solid is faster and draws labels correctly)
    [[groundMat, 0.3], [M.road, 0.35], [M.park, 0.3], [M.water, 0.3], [M.bld, 0.16], [viaMat, 0.5]].forEach(([m, op]) => {
      m.transparent = on; m.opacity = on ? op : 1; m.depthWrite = !on; m.needsUpdate = true;
    });
    M.tree.visible = !on;
    controls.maxPolarAngle = on ? 1.4 : 1.22;
    xrayBtn.classList.toggle('on', on);
    xrayBtn.setAttribute('aria-pressed', String(on));
    hintEl.textContent = t(on ? 'spot.xrayHint' : 'spot.tapHint');
    if (on) select(null);
    flyTo = new THREE.Vector3(controls.target.x, on ? UG_Y * 0.55 : 0, controls.target.z);
    applyLight();
  }
  xrayBtn.addEventListener('click', () => setXray(!xray));

  // ---------- UI ----------
  let filter = 'all', sel = null;
  const CHIPS = ['all', 'grow', 'lounge', 'munchies', 'head'];
  const chipsEl = q('[data-chips]');
  CHIPS.forEach((k) => {
    const bt = document.createElement('button');
    bt.type = 'button'; bt.className = 'bb-chip sm-chip'; bt.textContent = t(`spot.chip.${k}`); bt.dataset.k = k;
    bt.addEventListener('click', () => { filter = k; select(null); renderChips(); applyFilter(); renderList(); });
    chipsEl.appendChild(bt);
  });
  // the active filter chip gets the chrome look
  const renderChips = () => [...chipsEl.children].forEach((b) => { const on = b.dataset.k === filter; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('bb-chrome', on); });
  const shown = (s) => s.lot || filter === 'all' || s.type === filter;

  const listEl = q('[data-list]');
  function renderList() {
    listEl.innerHTML = '';
    spots.filter(shown).forEach((s) => {
      const bt = document.createElement('button');
      bt.type = 'button'; bt.className = `sm-item${s.lot ? ' lot' : ''}`;
      const sw = document.createElement('span'); sw.className = 'sm-sw';
      sw.style.cssText = s.lot ? `border:2px dashed ${s.col}` : `background:${s.col};box-shadow:0 0 10px ${s.col}`;
      const tx = document.createElement('span'); tx.style.minWidth = '0';
      const b1 = document.createElement('b'); b1.textContent = s.lot ? t('spot.freeLot') : s.name;
      const i1 = document.createElement('i'); i1.textContent = s.lot ? t('spot.lotShort') : TYPES[s.type].label + (s.partner ? ` · ${t('spot.partnerShort')}` : '');
      tx.append(b1, i1);
      bt.append(sw, tx);
      bt.addEventListener('click', () => select(s.id));
      listEl.appendChild(bt);
    });
  }
  function applySpotState(s) {
    if (!s.mesh) return;
    const vis = shown(s), on = s.id === sel;
    s.vis = vis ? 1 : 0;
    if (!s.lot) {
      s.mat.opacity = vis ? 1 : 0.18; s.edges.material.opacity = vis ? 0.95 : 0.15;
      s.mat.emissiveIntensity = on ? 0.95 : 0.22;
      s.mat.color.setHex(on ? 0x1a1a1a : 0x121612);
    } else s.mat.opacity = on ? 0.18 : 0.1;
    s.base.visible = vis;
    const baseT = s.lot ? 0.25 : s.partner ? (s.h + 10) / s.h : 1;
    s.spring.t = on ? (s.lot ? 45 / s.h : (s.h + RISE + (s.partner ? 25 : 0)) / s.h) : baseT;
    s.glow.visible = on;
    s.beam.visible = on && !s.lot;
  }
  const applyFilter = () => spots.forEach(applySpotState);

  const vIdle = q('[data-v-idle]'), vSpot = q('[data-v-spot]'), vLot = q('[data-v-lot]');
  function select(id) {
    sel = id;
    const cur = spots.find((s) => s.id === id && s.mesh) || null;
    if (!cur) sel = null;
    spots.forEach(applySpotState);
    vIdle.hidden = !!cur;
    vSpot.hidden = !(cur && !cur.lot);
    vLot.hidden = !(cur && cur.lot);
    if (cur && !cur.lot) {
      const ty = TYPES[cur.type];
      const tag = q('[data-s-tag]');
      tag.textContent = ty.label; tag.style.setProperty('--c', ty.col);
      q('[data-s-partner]').hidden = !cur.partner;
      q('[data-s-perk]').hidden = !cur.partner;
      q('[data-s-name]').textContent = cur.name;
      const ll = toLatLon(cur.b.cx, cur.b.cy);
      q('[data-s-coords]').textContent = `${t('spot.realBuilding')} · ${ll[0].toFixed(5)}, ${ll[1].toFixed(5)}`;
      q('[data-s-route]').href = `https://www.google.com/maps/dir/?api=1&destination=${ll[0].toFixed(6)},${ll[1].toFixed(6)}&travelmode=transit`;
      const insta = q('[data-s-insta]');
      insta.hidden = !cur.instagram; if (cur.instagram) insta.href = cur.instagram;
    }
    if (cur) {
      if (xray) setXray(false);
      controls.autoRotate = false; syncSpin();
      flyTo = new THREE.Vector3(cur.b.cx, 0, -cur.b.cy);
    }
    requestAnimationFrame(resize);
  }
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => select(null)));

  // a station was tapped: X-ray off, fly up to its street entrance
  let entranceFx = null;
  function flyToStation(s) {
    if (xray) setXray(false);
    controls.autoRotate = false; syncSpin();
    flyTo = new THREE.Vector3(s.ex, 0, -s.ey); flyDist = 230;
    if (!entranceFx) {
      entranceFx = new THREE.Mesh(new THREE.RingGeometry(7, 9, 40), new THREE.MeshBasicMaterial({ color: METRO, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
      entranceFx.rotation.x = -Math.PI / 2;
      scene.add(entranceFx);
    }
    entranceFx.position.set(s.ex, 0.9, -s.ey);
    entranceFx.userData.t0 = performance.now();
    entranceFx.visible = true;
  }

  // zoom / reset / spin
  function dolly(f) {
    const off = camera.position.clone().sub(controls.target);
    off.setLength(THREE.MathUtils.clamp(off.length() * f, controls.minDistance, controls.maxDistance));
    camera.position.copy(controls.target).add(off);
  }
  q('[data-zoom-in]').addEventListener('click', () => dolly(0.75));
  q('[data-zoom-out]').addEventListener('click', () => dolly(1.33));
  q('[data-reset]').addEventListener('click', () => {
    select(null);
    if (xray) setXray(false);
    flyTo = new THREE.Vector3(0, 0, 0);
    camera.position.copy(HOME_POS).add(controls.target);
  });
  spinBtn.addEventListener('click', () => { controls.autoRotate = !controls.autoRotate; syncSpin(); });

  // tap to pick
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let downAt = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) { downAt = null; return; }
    downAt = null;
    const rect = renderer.domElement.getBoundingClientRect();
    ptr.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ptr.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(ptr, camera);
    const signs = stations.filter((s) => s.sign && s.sign.visible).map((s) => s.sign);
    if (xray) { // in X-ray only the stations count
      const hit = ray.intersectObjects([...stationPick, ...signs], false)[0];
      if (hit) flyToStation(hit.object.userData.station);
      return;
    }
    const sHit = ray.intersectObjects(signs, false)[0];
    const hits = ray.intersectObjects(pickables, false);
    if (sHit && (!hits[0] || sHit.distance < hits[0].distance)) { flyToStation(sHit.object.userData.station); return; }
    for (let h = 0; h < hits.length; h++) {
      const id = hits[h].object.userData.spotId;
      if (id) {
        const s = spots.find((x) => x.id === id);
        if (s && shown(s)) select(sel === id ? null : id);
        return;
      }
      if (hits[h].object.userData.isBuilding) return; // a normal building is in front
    }
  });

  // layout: keep the city centred in the space between the chips and the sheet
  const topEl = q('[data-top]'), sheetEl = q('[data-sheet]'), ctlEl = q('[data-ctl]');
  function resize() {
    if (!root.isConnected) return;
    fit();
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const wide = w >= 760;
    const topH = topEl.getBoundingClientRect().height;
    const sheetH = wide ? 0 : sheetEl.getBoundingClientRect().height;
    camera.setViewOffset(w, h, wide ? -110 : 0, (sheetH - topH) / 2, w, h);
    camera.updateProjectionMatrix();
    // the control column sits between the chips and the sheet; a bit tighter on short screens
    const room = h - topH - sheetH - 16;
    ctlEl.style.top = `${Math.round(topH + 8)}px`;
    ctlEl.classList.toggle('is-tight', !wide && room < 6 * 50);
  }
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  const ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
  if (ro) { ro.observe(sheetEl); ro.observe(topEl); }

  // leaving the page: stop drawing and free the 3D engine
  let raf = 0;
  function stop() {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    window.visualViewport?.removeEventListener('resize', resize);
    ro?.disconnect();
    controls.dispose();
    renderer.dispose();
    renderer.forceContextLoss?.();
    document.body.classList.remove('sm-open');
    unlockZoom();
  }

  // ---------- animation loop ----------
  const clock = new THREE.Clock();
  let lastWant = 0, frames = 0, fpsT0 = performance.now();
  const lo = new THREE.Vector3(BX0 - 200, UG_Y, -(BY1 + 200)), hi = new THREE.Vector3(BX1 + 200, 0, -(BY0 - 200));
  function frame() {
    if (!root.isConnected) { stop(); return; }
    raf = requestAnimationFrame(frame);
    const now = performance.now(), tt = clock.getElapsedTime();
    // build at most one downloaded tile per frame (keeps it smooth)
    if (pending.length) { const [key, d] = pending.shift(); if (tiles.has(key)) buildTile(key, d); }
    if (now - lastWant > 250) { lastWant = now; wantTiles(); }
    for (let i = 0; i < springs.length; i++) {
      const sp = springs[i];
      if (now < sp.delay) continue;
      if (sp.c === sp.t && sp.v === 0) continue;
      sp.v += (sp.t - sp.c) * 0.14;
      sp.v *= 0.74;
      sp.c += sp.v;
      if (Math.abs(sp.v) < 1e-4 && Math.abs(sp.t - sp.c) < 1e-3) { sp.c = sp.t; sp.v = 0; }
      sp.mesh.scale.y = Math.max(0.001, sp.c);
    }
    spots.forEach((s) => {
      if (!s.mesh) return;
      const top = s.h * s.mesh.scale.y;
      s.beam.position.y = top + 130;
      if (s.crown) {
        s.crown.position.y = top + 12 + Math.sin(tt * 2) * 1.5;
        s.crown.rotation.y = tt * 1.4;
        s.crown.visible = s.vis !== 0;
      }
      const ph = reduce ? 0.4 : ((tt * 0.55 + s.phase) % 1);
      const on = s.id === sel;
      s.pulse.visible = s.vis !== 0 && !on;
      s.pulse.scale.set(1 + ph * 0.9, 1 + ph * 0.9, 1);
      s.pulse.material.opacity = (1 - ph) * 0.75;
      if (on) s.beam.material.opacity = 0.2 + Math.sin(tt * 3) * 0.08;
    });
    elTrains.forEach((tr) => { const p = along(tr.c, pingPong(tr.c, tt, 22, tr.off)); tr.m.position.set(p.x, VIA_Y + 2.6, -p.y); tr.m.rotation.y = p.ang; });
    if (xray) ugTrains.forEach((tr) => { const p = along(tr.c, pingPong(tr.c, tt, 18, tr.off)); tr.m.position.set(p.x, tr.y, -p.y); tr.m.rotation.y = p.ang; });
    if (entranceFx?.visible) {
      const k = (now - entranceFx.userData.t0) / 2600;
      if (k > 1) entranceFx.visible = false;
      else { const s = 1 + ((k * 3) % 1) * 1.6; entranceFx.scale.set(s, s, 1); entranceFx.material.opacity = 0.9 * (1 - k); }
    }
    if (flyTo) {
      const before = controls.target.clone();
      controls.target.lerp(flyTo, 0.07);
      camera.position.add(controls.target.clone().sub(before));
      if (flyDist) {
        const off = camera.position.clone().sub(controls.target);
        off.setLength(off.length() + (flyDist - off.length()) * 0.07);
        camera.position.copy(controls.target).add(off);
      }
      if (controls.target.distanceTo(flyTo) < 0.5) { flyTo = null; flyDist = 0; }
    }
    // stay above the map area
    const c0 = controls.target.clone();
    controls.target.clamp(lo, hi);
    camera.position.add(controls.target.clone().sub(c0));
    controls.update();
    renderer.render(scene, camera);
    // slow phone? lower detail far from the camera first, then the resolution
    frames++;
    if (now - fpsT0 > 3000) {
      const fps = frames * 1000 / (now - fpsT0);
      frames = 0; fpsT0 = now;
      if (fps < 38 && Q.level > 0) {
        Q.level--;
        Q.treeR = Q.level ? 420 : 250; Q.labelR = Q.level ? 260 : 180; Q.signR = Q.level ? 650 : 450; Q.loadR = Q.level ? 1000 : 800;
        if (Q.level === 0) { Q.dpr = Math.min(Q.dpr, 1.25); renderer.setPixelRatio(Q.dpr); resize(); }
      }
    }
  }

  renderChips(); renderList();
  applyLight();
  q('[data-count]').textContent = t('spot.count', { n: spots.length - 1 });
  q('[data-loading]').hidden = true;
  resize();
  frame();
}
