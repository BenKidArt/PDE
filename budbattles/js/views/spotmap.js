// SPOT MAP (hidden preview page, #/spot-map): a real 3D map of Kreuzberg around
// Kottbusser Tor built with three.js from OpenStreetMap data. Spots rise when tapped.
// Map logic and data come unchanged from spot-map-berlin.html; only colours, fonts and
// the overlay follow the BudBattles style. Spots: js/spots.js. Map data: js/spotmap-data.js.
import { t } from '../i18n.js';
import { esc } from '../ui.js';
import { BDATA, ROADS, U1, U8, LAT0, LON0 } from '../spotmap-data.js';
import { SPOTS, SPOT_TYPES, FREE_LOT } from '../spots.js';

// three.js – pinned versions, loaded the same way as the original file
const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
const ORBIT_URL = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';

// the app's neon colours
const GREEN = '#a8ff3e';
const PINK = '#ff3d9a';
const COLOR = { green: GREEN, pink: PINK };
const RISE = 70; // metres a spot grows when tapped

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

export async function renderSpotMap(root) {
  root.innerHTML = `
    <div class="spotmap" data-spotmap>
      <div class="sm-stage" data-stage role="img" aria-label="${esc(t('spot.stageLabel'))}"></div>
      <div class="sm-loading" data-loading>${esc(t('spot.loading'))}</div>
      <div class="sm-top" data-top>
        <p class="eyebrow sm-eyebrow"><span class="sm-dot" aria-hidden="true"></span><span data-count>${esc(t('spot.title'))}</span></p>
        <nav class="sm-chips" aria-label="${esc(t('spot.filter'))}" data-chips data-hscroll></nav>
      </div>
      <div class="sm-ctl">
        <button type="button" class="sm-btn sm-btn-text" data-time aria-label="${esc(t('spot.light'))}">AUTO</button>
        <button type="button" class="sm-btn" data-zoom-in aria-label="${esc(t('spot.zoomIn'))}"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M8 2v12M2 8h12"/></svg></button>
        <button type="button" class="sm-btn" data-zoom-out aria-label="${esc(t('spot.zoomOut'))}"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M2 8h12"/></svg></button>
        <button type="button" class="sm-btn" data-spin aria-label="${esc(t('spot.spin'))}"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M16 9a6.5 6.5 0 1 0-1.8 5.2"/><path d="M16 3.5V9h-5.5"/></svg></button>
        <button type="button" class="sm-btn" data-reset aria-label="${esc(t('spot.reset'))}"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M9 1v4M9 13v4M1 9h4M13 9h4"/><circle cx="9" cy="9" r="3"/></svg></button>
      </div>
      <section class="sm-sheet" data-sheet aria-live="polite">
        <div class="sm-scroll">
        <div class="sm-view" data-v-idle>
          <p class="sm-label">${esc(t('spot.tapHint'))}</p>
          <div class="sm-list" data-list></div>
        </div>
        <div class="sm-view" data-v-spot hidden>
          <div class="sm-row">
            <div class="sm-tags"><span class="sm-tag" data-s-tag></span><span class="sm-tag sm-tag-partner" data-s-partner hidden>${esc(t('spot.partner'))}</span></div>
            <button type="button" class="sm-btn sm-close" data-close aria-label="${esc(t('spot.close'))}"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12"/></svg></button>
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
            <button type="button" class="sm-btn sm-close" data-close aria-label="${esc(t('spot.close'))}"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12"/></svg></button>
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

  try {
    await loadScript(THREE_URL);
    await loadScript(ORBIT_URL);
  } catch { /* handled below */ }
  if (!root.isConnected) return;
  if (!window.THREE || !window.THREE.OrbitControls) {
    q('[data-loading]').textContent = t('spot.engineFailed');
    return;
  }
  startMap(root, q, app, fit);
}

function startMap(root, q, app, fit) {
  const THREE = window.THREE;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MX = 111320 * Math.cos(LAT0 * Math.PI / 180), MY = 110540;
  const toLatLon = (x, y) => [LAT0 + y / MY, LON0 + x / MX];
  const TYPES = Object.fromEntries(Object.entries(SPOT_TYPES).map(([k, v]) => [k, { label: t(`spot.type.${k}`), col: COLOR[v.color] || GREEN }]));

  // ---------- parse buildings ----------
  const buildings = BDATA.split('|').map((s) => {
    const n = s.trim().split(/\s+/).map(Number);
    let x = n[1], y = n[2];
    const pts = [[x, y]];
    for (let i = 3; i + 1 < n.length; i += 2) { x += n[i]; y += n[i + 1]; pts.push([x, y]); }
    let cx = 0, cy = 0;
    pts.forEach((p) => { cx += p[0]; cy += p[1]; });
    cx /= pts.length; cy /= pts.length;
    let r = 0; pts.forEach((p) => { r = Math.max(r, Math.hypot(p[0] - cx, p[1] - cy)); });
    return { h: Math.max(n[0], 3), pts, cx, cy, r, d: Math.hypot(cx, cy) };
  });

  // ---------- spots on real buildings (js/spots.js) ----------
  const used = {};
  function nearest(at, ok) {
    let best = -1, bd = 1e9;
    buildings.forEach((b, i) => {
      if (used[i] || !ok(b)) return;
      const d = Math.hypot(b.cx - at[0], b.cy - at[1]);
      if (d < bd) { bd = d; best = i; }
    });
    if (best >= 0) used[best] = true;
    return best;
  }
  const spots = SPOTS.map((p) => ({ id: p.id, name: p.name, type: p.type, partner: !!p.partner, instagram: p.instagram || '',
    bi: nearest(p.at, (b) => b.h >= 13 && b.r > 6 && b.r < 30) })).filter((s) => s.bi >= 0);
  let lotBi = nearest(FREE_LOT.at, (b) => b.h <= 7 && b.r > 5 && b.r < 26);
  if (lotBi < 0) lotBi = nearest(FREE_LOT.at, (b) => b.h <= 10);
  if (lotBi >= 0) spots.push({ id: 'lot', name: t('spot.freeLot'), type: 'lot', lot: true, bi: lotBi });

  // ---------- three.js scene ----------
  const stage = q('[data-stage]');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0d0b, 520, 1150);
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 4000);
  const HOME_POS = new THREE.Vector3(300, 340, 400);
  camera.position.copy(HOME_POS);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minPolarAngle = 0.25; controls.maxPolarAngle = 1.22;
  controls.minDistance = 110; controls.maxDistance = 950;
  controls.screenSpacePanning = false;
  controls.autoRotate = !reduce; controls.autoRotateSpeed = 0.35;
  controls.target.set(0, 0, 0);
  const spinBtn = q('[data-spin]');
  let flyTo = null;
  const syncSpin = () => spinBtn.classList.toggle('on', controls.autoRotate);
  controls.addEventListener('start', () => { controls.autoRotate = false; flyTo = null; syncSpin(); });
  syncSpin();

  const hemi = new THREE.HemisphereLight(0x8fa0ff, 0x0a0a0a, 0.55);
  const sun = new THREE.DirectionalLight(0xc8d0ff, 0.55);
  sun.position.set(-220, 420, 160);
  scene.add(hemi, sun);

  // ground + grid
  const groundMat = new THREE.MeshBasicMaterial({ color: 0x0d120f });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const grid = new THREE.GridHelper(2400, 120, 0xe9fff2, 0xe9fff2);
  grid.material.transparent = true; grid.material.opacity = 0.05; grid.position.y = 0.05;
  scene.add(grid);

  // streets
  const inView = (x, y) => Math.abs(x) < 460 && Math.abs(y) < 380;
  const roadPos = [], centre = [];
  ROADS.forEach((r) => {
    const w = r[0] + 1.5;
    for (let i = 1; i + 3 < r.length; i += 2) {
      const x1 = r[i], y1 = r[i + 1], x2 = r[i + 2], y2 = r[i + 3];
      if (!inView(x1, y1) && !inView(x2, y2)) continue;
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
      const ex = dx / L * w / 2, ey = dy / L * w / 2; // extend for joints
      const nx = -dy / L * w / 2, ny = dx / L * w / 2;
      const ax = x1 - ex, ay = y1 - ey, bx = x2 + ex, by = y2 + ey;
      const quad = [[ax + nx, ay + ny], [ax - nx, ay - ny], [bx - nx, by - ny], [ax + nx, ay + ny], [bx - nx, by - ny], [bx + nx, by + ny]];
      quad.forEach((p) => { roadPos.push(p[0], 0.2, -p[1]); });
      if (r[0] >= 11) centre.push(x1, 0.45, -y1, x2, 0.45, -y2);
    }
  });
  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPos, 3));
  const roadMat = new THREE.MeshBasicMaterial({ color: 0x050706, side: THREE.DoubleSide });
  scene.add(new THREE.Mesh(roadGeo, roadMat));
  const cGeo = new THREE.BufferGeometry();
  cGeo.setAttribute('position', new THREE.Float32BufferAttribute(centre, 3));
  const cLines = new THREE.LineSegments(cGeo, new THREE.LineDashedMaterial({ color: PINK, dashSize: 6, gapSize: 9, transparent: true, opacity: 0.5 }));
  cLines.computeLineDistances();
  scene.add(cLines);

  // U8 underground, dashed blue
  const u8pts = [];
  for (let i = 0; i + 1 < U8.length; i += 2) u8pts.push(new THREE.Vector3(U8[i], 0.6, -U8[i + 1]));
  const u8 = new THREE.Line(new THREE.BufferGeometry().setFromPoints(u8pts), new THREE.LineDashedMaterial({ color: 0x4d8bff, dashSize: 8, gapSize: 6, transparent: true, opacity: 0.85 }));
  u8.computeLineDistances();
  scene.add(u8);

  // U1/U3 elevated viaduct
  const VIA_Y = 7.5;
  const viaMat = new THREE.MeshStandardMaterial({ color: 0x3a3b38, roughness: 0.9 });
  let u1pts = [];
  const u1len = [0];
  for (let i = 0; i + 1 < U1.length; i += 2) u1pts.push([U1[i], U1[i + 1]]);
  u1pts = u1pts.filter((p) => Math.abs(p[0]) < 520);
  for (let s1 = 1; s1 < u1pts.length; s1++) {
    const p0 = u1pts[s1 - 1], p1 = u1pts[s1];
    const ddx = p1[0] - p0[0], ddy = p1[1] - p0[1], LL = Math.hypot(ddx, ddy);
    u1len.push(u1len[s1 - 1] + LL);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(LL + 1, 1.4, 9), viaMat);
    deck.position.set((p0[0] + p1[0]) / 2, VIA_Y, -(p0[1] + p1[1]) / 2);
    deck.rotation.y = Math.atan2(ddy, ddx);
    scene.add(deck);
    for (let t1 = 0; t1 < LL; t1 += 22) {
      const px = p0[0] + ddx * t1 / LL, py = p0[1] + ddy * t1 / LL;
      const pil = new THREE.Mesh(new THREE.BoxGeometry(2.2, VIA_Y, 2.2), viaMat);
      pil.position.set(px, VIA_Y / 2, -py);
      scene.add(pil);
    }
  }
  const railPts = u1pts.map((p) => new THREE.Vector3(p[0], VIA_Y + 0.8, -p[1]));
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(railPts), new THREE.LineBasicMaterial({ color: GREEN, transparent: true, opacity: 0.8 })));
  const trainMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color('#F5D33B'), emissiveIntensity: 0.9 });
  const train = new THREE.Mesh(new THREE.BoxGeometry(36, 3.2, 3.6), trainMat);
  scene.add(train);
  const U1_TOTAL = u1len[u1len.length - 1];
  function pointOnU1(dist) {
    for (let k = 1; k < u1pts.length; k++) {
      if (dist <= u1len[k]) {
        const f = (dist - u1len[k - 1]) / (u1len[k] - u1len[k - 1]);
        const a = u1pts[k - 1], b = u1pts[k];
        return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
      }
    }
    const e = u1pts[u1pts.length - 1]; return { x: e[0], y: e[1], ang: 0 };
  }

  // station sign (app font and colours)
  function makeSign() {
    const c = document.createElement('canvas'); c.width = 640; c.height = 128;
    const g = c.getContext('2d');
    const font = getComputedStyle(document.body).fontFamily;
    g.fillStyle = '#0a0d0b'; g.fillRect(0, 0, 640, 128);
    g.strokeStyle = PINK; g.lineWidth = 6; g.strokeRect(3, 3, 634, 122);
    g.fillStyle = '#2E6BFF'; g.fillRect(16, 16, 96, 96);
    g.fillStyle = '#ffffff'; g.font = `700 76px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('U', 64, 68);
    g.textAlign = 'left'; g.fillStyle = '#e9fff2'; g.font = `700 44px ${font}`; g.fillText('KOTTBUSSER TOR', 132, 52);
    g.fillStyle = '#8fa699'; g.font = `700 26px ${font}`; g.fillText('U1 · U3 · U8', 132, 94);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
    sp.scale.set(70, 14, 1); sp.position.set(6, 36, -2); sp.renderOrder = 10;
    return sp;
  }
  scene.add(makeSign());

  // buildings
  const concrete = [
    new THREE.MeshStandardMaterial({ color: 0x4a4a45, roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ color: 0x55554f, roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ color: 0x3f3f3a, roughness: 0.95 }),
  ];
  const edgeMat = new THREE.LineBasicMaterial({ color: GREEN, transparent: true, opacity: 0.22 });
  const springs = [], pickables = [], spotByBi = {};
  spots.forEach((s) => { spotByBi[s.bi] = s; });

  function glowTexture(col) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  buildings.forEach((b, i) => {
    const shape = new THREE.Shape(b.pts.map((p) => new THREE.Vector2(p[0], p[1])));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: b.h, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const s = spotByBi[i];
    let mat, edges;
    if (s) {
      const col = s.lot ? GREEN : TYPES[s.type].col;
      s.col = col; s.h = b.h; s.b = b;
      if (s.lot) {
        mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.1, depthWrite: false });
        edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.9 }));
      } else {
        mat = new THREE.MeshStandardMaterial({ color: 0x121612, emissive: new THREE.Color(col), emissiveIntensity: 0.22, roughness: 0.6, transparent: true, opacity: 1 });
        edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.95 }));
      }
    } else {
      mat = concrete[i % 3];
      edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), edgeMat);
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.add(edges);
    mesh.userData.spotId = s ? s.id : null;
    scene.add(mesh);
    pickables.push(mesh);
    const sp = { mesh, c: reduce ? 1 : 0.001, v: 0, t: 1, delay: reduce ? 0 : 250 + b.d * 2.4 + (i % 7) * 18 };
    if (s && s.lot) sp.t = 0.25;
    if (s && s.partner) sp.t = (b.h + 10) / b.h;
    mesh.scale.y = sp.c;
    springs.push(sp);
    if (s) { s.mesh = mesh; s.spring = sp; s.mat = mat; s.edges = edges; }
  });

  // spot extras: pulse ring, base ring, ground glow, light beam, partner crown
  spots.forEach((s, k) => {
    const b = s.b, col = s.col, R = b.r + 4;
    const ringMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
    let base;
    if (s.lot) {
      base = new THREE.Group();
      for (let a = 0; a < 16; a++) base.add(new THREE.Mesh(new THREE.RingGeometry(R, R + 1.6, 4, 1, a / 16 * Math.PI * 2, Math.PI / 16), ringMat));
      base.rotation.x = -Math.PI / 2;
    } else {
      base = new THREE.Mesh(new THREE.RingGeometry(R, R + 1.4, 48), ringMat);
      base.rotation.x = -Math.PI / 2;
    }
    base.position.set(b.cx, 0.5, -b.cy);
    scene.add(base);
    const pulse = new THREE.Mesh(new THREE.RingGeometry(R, R + 2.2, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    pulse.rotation.x = -Math.PI / 2;
    pulse.position.set(b.cx, 0.6, -b.cy);
    pulse.userData.spotId = s.id;
    scene.add(pulse);
    pickables.push(pulse);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(R * 5, R * 5), new THREE.MeshBasicMaterial({ map: glowTexture(col), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.rotation.x = -Math.PI / 2; glow.position.set(b.cx, 0.7, -b.cy); glow.visible = false;
    scene.add(glow);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 5, 260, 16, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.set(b.cx, 200, -b.cy); beam.visible = false;
    scene.add(beam);
    let crown = null;
    if (s.partner) { // partner crown in the app's pink
      crown = new THREE.Mesh(new THREE.OctahedronGeometry(6), new THREE.MeshStandardMaterial({ color: 0x2a0f1c, emissive: new THREE.Color(PINK), emissiveIntensity: 1 }));
      crown.position.set(b.cx, b.h + 12, -b.cy);
      crown.add(new THREE.LineSegments(new THREE.EdgesGeometry(crown.geometry), new THREE.LineBasicMaterial({ color: 0xffffff })));
      scene.add(crown);
    }
    Object.assign(s, { base, pulse, glow, beam, crown, phase: k * 0.17 });
  });

  // ---------- light by time of day (night = the app's background tone) ----------
  const MODES = ['auto', 'morning', 'day', 'evening', 'night'];
  const LIGHT = {
    night: { sky: 'radial-gradient(90% 60% at 50% 25%, rgba(255,61,154,.10), transparent 70%), radial-gradient(ellipse at 50% 30%, #15211a 0%, #0a0d0b 70%)', fog: 0x0a0d0b, ground: 0x0d120f, road: 0x050706, grid: 0.05, bld: [0x4a4a45, 0x55554f, 0x3f3f3a], hemi: [0x8fa0ff, 0x0a0a0a, 0.55], sun: [0xc8d0ff, 0.55], edge: 0.22, train: 0.9 },
    evening: { sky: 'linear-gradient(to bottom,#FF7A59 0%,#7A2E6B 40%,#1E1328 80%)', fog: 0x2a1733, ground: 0x231a2a, road: 0x140d19, grid: 0.06, bld: [0x7a6680, 0x6b5872, 0x846f8a], hemi: [0xffb0a0, 0x1a0f20, 0.7], sun: [0xff9a70, 0.9], edge: 0.16, train: 0.8 },
    morning: { sky: 'linear-gradient(to bottom,#FFC9B0 0%,#C9A3C4 45%,#5E5574 90%)', fog: 0x8c7d99, ground: 0x4a4352, road: 0x352f3c, grid: 0.08, bld: [0xb4a9b6, 0xa79caa, 0xbfb4c0], hemi: [0xfff0e8, 0x403848, 0.8], sun: [0xffd2b8, 1.0], edge: 0.1, train: 0.6 },
    day: { sky: 'linear-gradient(to bottom,#D9E4E2 0%,#AEBDBA 60%,#7E8C88 100%)', fog: 0xaebdba, ground: 0x6a706a, road: 0x474c47, grid: 0.08, bld: [0xcfcdc4, 0xc2c0b7, 0xd8d6cd], hemi: [0xffffff, 0x606660, 0.9], sun: [0xffffff, 1.1], edge: 0.08, train: 0.5 },
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
    roadMat.color.setHex(L.road);
    grid.material.opacity = L.grid;
    concrete.forEach((c, i) => { c.color.setHex(L.bld[i]); });
    hemi.color.setHex(L.hemi[0]); hemi.groundColor.setHex(L.hemi[1]); hemi.intensity = L.hemi[2];
    sun.color.setHex(L.sun[0]); sun.intensity = L.sun[1];
    edgeMat.opacity = L.edge;
    trainMat.emissiveIntensity = L.train;
    timeBtn.textContent = t(`spot.mode.${MODES[timeIdx]}`);
    timeBtn.classList.toggle('on', timeIdx !== 0);
    timeBtn.setAttribute('aria-label', t('spot.lightLabel', { mode: (timeIdx === 0 ? `${t('spot.mode.auto')}, ` : '') + t(`spot.modeName.${m}`) }));
  }
  timeBtn.addEventListener('click', () => { timeIdx = (timeIdx + 1) % MODES.length; applyLight(); });
  applyLight();

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
  const renderChips = () => [...chipsEl.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === filter)));
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
  function applyFilter() {
    spots.forEach((s) => {
      const vis = shown(s);
      s.vis = vis ? 1 : 0;
      if (!s.lot) { s.mat.opacity = vis ? 1 : 0.18; s.edges.material.opacity = vis ? 0.95 : 0.15; }
      s.base.visible = vis;
    });
  }

  const vIdle = q('[data-v-idle]'), vSpot = q('[data-v-spot]'), vLot = q('[data-v-lot]');
  function select(id) {
    sel = id;
    let cur = null;
    spots.forEach((s) => {
      const on = s.id === id;
      if (on) cur = s;
      const base = s.lot ? 0.25 : s.partner ? (s.h + 10) / s.h : 1;
      s.spring.t = on ? (s.lot ? 45 / s.h : (s.h + RISE + (s.partner ? 25 : 0)) / s.h) : base;
      if (!s.lot) {
        s.mat.emissiveIntensity = on ? 0.95 : 0.22;
        s.mat.color.setHex(on ? 0x1a1a1a : 0x121612);
      } else {
        s.mat.opacity = on ? 0.18 : 0.1;
      }
      s.glow.visible = on;
      s.beam.visible = on && !s.lot;
    });
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
      controls.autoRotate = false; syncSpin();
      flyTo = new THREE.Vector3(cur.b.cx, 0, -cur.b.cy);
    }
    requestAnimationFrame(resize);
  }
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => select(null)));

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
    const hits = ray.intersectObjects(pickables, false);
    for (let h = 0; h < hits.length; h++) {
      const id = hits[h].object.userData.spotId;
      if (id) {
        const s = spots.find((x) => x.id === id);
        if (s && shown(s)) select(sel === id ? null : id);
        return;
      }
      if (hits[h].object.geometry.type === 'ExtrudeGeometry') return; // a normal building is in front
    }
  });

  // layout: keep the city centred in the space between the chips and the sheet
  const topEl = q('[data-top]'), sheetEl = q('[data-sheet]');
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
  }
  window.addEventListener('resize', resize);
  const ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
  if (ro) { ro.observe(sheetEl); ro.observe(topEl); }

  // leaving the page: stop drawing and free the 3D engine
  let raf = 0;
  function stop() {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    ro?.disconnect();
    controls.dispose();
    renderer.dispose();
    renderer.forceContextLoss?.();
    document.body.classList.remove('sm-open');
  }

  // ---------- animation loop ----------
  const t0 = performance.now(), clock = new THREE.Clock();
  function frame() {
    if (!root.isConnected) { stop(); return; }
    raf = requestAnimationFrame(frame);
    const now = performance.now(), el = now - t0, tt = clock.getElapsedTime();
    for (let i = 0; i < springs.length; i++) {
      const sp = springs[i];
      if (el < sp.delay) continue;
      if (sp.c === sp.t && sp.v === 0) continue;
      sp.v += (sp.t - sp.c) * 0.14;
      sp.v *= 0.74;
      sp.c += sp.v;
      if (Math.abs(sp.v) < 1e-4 && Math.abs(sp.t - sp.c) < 1e-3) { sp.c = sp.t; sp.v = 0; }
      sp.mesh.scale.y = Math.max(0.001, sp.c);
    }
    spots.forEach((s) => {
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
    const d0 = reduce ? U1_TOTAL / 2 : (() => { const cyc = (tt * 22) % (U1_TOTAL * 2); return cyc < U1_TOTAL ? cyc : U1_TOTAL * 2 - cyc; })();
    const pq = pointOnU1(d0);
    train.position.set(pq.x, VIA_Y + 2.6, -pq.y);
    train.rotation.y = pq.ang;
    if (flyTo) {
      const before = controls.target.clone();
      controls.target.lerp(flyTo, 0.07);
      camera.position.add(controls.target.clone().sub(before));
      if (controls.target.distanceTo(flyTo) < 0.5) flyTo = null;
    }
    controls.update();
    renderer.render(scene, camera);
  }

  renderChips(); applyFilter(); renderList();
  q('[data-count]').textContent = t('spot.count', { n: spots.length - 1 });
  q('[data-loading]').hidden = true;
  resize();
  frame();
}
