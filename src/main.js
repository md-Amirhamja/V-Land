import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import * as Blood from './blood.js';
import * as Bld from './buildings3d.js';
import BN_LIST, { EN_FIX } from './names-bn.js'; 

/* ------------------------------------------------------------------ *
 * MODEL NAMING RULE (Blender object names, separator = two underscores)
 *   divisions.glb  -> Dhaka
 *   districts.glb  -> Dhaka__Gazipur
 *   areas.glb      -> Dhaka__Dhaka__Mohammadpur   (Division__District__Area)
 * ------------------------------------------------------------------ */
const SEP = '__';
// ---------- language (Bangla / English) ----------
const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '');
const BN = {}; BN_LIST.forEach(([bn, ...en]) => en.forEach((e) => (BN[norm(e)] = bn)));
let lang = 'bn';                                  // default language: 'bn' or 'en'
try { lang = localStorage.getItem('lang') || 'bn'; } catch (e) {}
const missingBn = new Set(); window.__missingBn = () => [...missingBn];
const tr = (name) => {
  const clean = name.replace(/\s+\d+$/, '');
  if (lang !== 'bn') return (EN_FIX && EN_FIX[clean]) || clean;
  const b = BN[norm(clean)];
  if (!b) missingBn.add(clean);
  return b || clean;
};

const FILES = {
  1: '/models/divisions.glb',
  2: '/models/districts.glb',
  3: '/models/areas.glb',
};
const LEVEL_NAME = { 1: 'Bangladesh', 2: 'Division', 3: 'District', 4: 'Area' };

// ---------- three.js basics ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = true;
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };

scene.add(new THREE.HemisphereLight(0xffffff, 0x335544, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(-1, 2, 1.5);
scene.add(sun);

const draco = new DRACOLoader();
draco.setDecoderPath('/draco/');
const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

// ---------- state ----------
const cache = {};            // level -> THREE.Group
let level = 1;
let path = [];               // ["Dhaka","Gazipur"] etc.
let shown = [];              // currently interactive meshes
let hovered = null;
let busy = false;
let preloading = true;
let areaMode = null;                 // 3D buildings view of one area
const home = { pos: new THREE.Vector3(), target: new THREE.Vector3() };

const $ = (id) => document.getElementById(id);
const pretty = (s) => s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
const partsOf = (m) => m.name.split(SEP).map(pretty);
const lastOf = (m) => partsOf(m).slice(-1)[0];
function toast(t, ms = 3500) { const m = $('msg'); m.textContent = t; m.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => (m.style.display = 'none'), ms); }

// ---------- loading ----------
const pending = {};
function loadLevel(l, quiet = false) {
  if (cache[l]) return Promise.resolve(cache[l]);
  if (!pending[l]) {
    pending[l] = loadLevelNow(l, quiet).then((r) => { if (!r) delete pending[l]; return r; });
  } else if (!quiet) {
    $('loadtxt').textContent = 'Loading map…';
    $('loading').classList.remove('hide');
    pending[l].then(() => $('loading').classList.add('hide'));
  }
  return pending[l];
}
async function loadLevelNow(l, quiet) {
  if (cache[l]) return cache[l];
  if (!quiet) {
    $('loadtxt').textContent = `Loading ${LEVEL_NAME[l + 1] || ''} map…`;
    $('loading').classList.remove('hide');
  }
  try {
    const gltf = await Promise.race([
      loader.loadAsync(FILES[l], (e) => console.log('[load]', FILES[l], e.loaded, '/', e.total)),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout 30s: model or Draco decoder stalled')), 30000)),
    ]);
    console.log('[load] done', FILES[l]);
    const root = gltf.scene;
    const _meshes = [];
    root.traverse((o) => { if (o.isMesh && !o.isLineSegments2) _meshes.push(o); });
    let _t = performance.now();
    for (const o of _meshes) {
      {
        o.material = o.material.clone();           // own material = own highlight
        if (l > 1) tint(o);
        o.userData.base = o.material.color.clone();
        if (l === 1) {                       // stack divisions in fixed order so overlapping tops never tie
          const ORDER = ['dhaka','chittagong','khulna','rangpur','rajshahi','sylhet','barisal','mymensingh'];
          const k = ORDER.indexOf(lastOf(o).toLowerCase());
          o.position.y += 0.004 * (k < 0 ? 4 : k);
        }
        o.userData.baseY = o.position.y;
        addOutline(o, l);
        o.visible = false;
      }
      if (performance.now() - _t > 8) { await new Promise((r) => setTimeout(r, 0)); _t = performance.now(); }
    }
    console.log('[load] meshes ready', FILES[l]);
    if (l > 1) {                           // separate overlapping pieces by real height (greedy layering)
      root.updateMatrixWorld(true);
      const ms = meshesOf(root).map((o) => ({ o, b: new THREE.Box3().setFromObject(o) }));
      const area = (b) => (b.max.x - b.min.x) * (b.max.z - b.min.z);
      ms.sort((a, b) => area(b.b) - area(a.b));
      let maxC = 0;
      ms.forEach((m, i) => {
        const used = new Set();
        for (let j = 0; j < i; j++) {
          const n = ms[j].b;
          if (m.b.min.x < n.max.x && m.b.max.x > n.min.x && m.b.min.z < n.max.z && m.b.max.z > n.min.z) used.add(ms[j].c);
        }
        let c = 0; while (used.has(c)) c++;
        m.c = c; maxC = Math.max(maxC, c);
      });
      const thick = ms.length ? ms[0].b.max.y - ms[0].b.min.y : 1;
      const eps = Math.min(thick * 0.006, (thick * 0.12) / Math.max(1, maxC));
      ms.forEach((m) => { m.o.position.y += eps * m.c; m.o.userData.baseY = m.o.position.y; });
      console.log('layers', l, maxC + 1, 'eps', eps);
    }
    scene.add(root);
    cache[l] = root;
    if (l === 1) Blood.setMap(root);
    return root;
  } catch (e) {
    console.error(e);
    toast(`Could not load ${FILES[l]} – check the file exists in public/models/ (${e && e.message})`, 7000);
    return null;
  } finally {
    if (!quiet) $('loading').classList.add('hide');
  }
}

function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
function tint(o) {                                  // give every district / area its own shade
  const hsl = {}; o.material.color.getHSL(hsl);
  const a = hashStr(o.name), b = hashStr(o.name + 'x'), c = hashStr(o.name + 'y');
  o.material.color.setHSL(
    (hsl.h + (b - 0.5) * 0.06 + 1) % 1,
    Math.min(0.85, Math.max(0.2, hsl.s + (c - 0.5) * 0.25)),
    Math.min(0.68, Math.max(0.2, hsl.l + (a - 0.5) * 0.32)));
}
function addOutline(o, l) {                         // thick border line (blood vein) around every piece
  const line = Blood.makeLine(o.geometry, l);
  o.add(line); o.userData.line = line;
}
function setAlpha(m, a) {
  m.material.opacity = a;
  const L = m.userData.line; if (L) L.material.opacity = L.userData.baseOpacity * a;
}

function meshesOf(root) { const a = []; root.traverse((o) => o.isMesh && !o.isLineSegments2 && a.push(o)); return a; }

// ---------- camera ----------
let anim = null;
function flyTo(box, { tilt = 0.9, fit = 1.25, instant = false } = {}) {
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.z, size.y) * 0.5;
  const dist = (radius * fit) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dir = new THREE.Vector3(0, Math.sin(tilt), Math.cos(tilt) * 0.55 + 0.001).normalize();
  const toPos = center.clone().addScaledVector(dir, dist);
  controls.minDistance = dist * 0.05;
  controls.maxDistance = dist * 4;
  camera.near = dist / 500; camera.far = dist * 50; camera.updateProjectionMatrix();
  if (instant) { camera.position.copy(toPos); controls.target.copy(center); controls.update(); return Promise.resolve(); }
  const p0 = camera.position.clone(), t0 = controls.target.clone();
  return tween(900, (k) => {
    camera.position.lerpVectors(p0, toPos, k);
    controls.target.lerpVectors(t0, center, k);
  });
}
function tween(ms, fn) {
  return new Promise((res) => {
    const s = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - s) / ms);
      const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      fn(k);
      t < 1 ? requestAnimationFrame(step) : res();
    };
    requestAnimationFrame(step);
  });
}
function boxOf(list) { const b = new THREE.Box3(); list.forEach((m) => b.expandByObject(m)); return b; }

// ---------- navigation ----------
function show(list) {
  shown.forEach((m) => (m.visible = false));
  shown = list;
  list.forEach((m) => { m.visible = true; m.position.y = m.userData.baseY; m.material.transparent = false; setAlpha(m, 1); });
}

async function goHome(instant = false) {
  if (busy) return; busy = true;
  clearArea();
  level = 1; path = [];
  const root = await loadLevel(1);
  if (root) { show(meshesOf(root)); await flyTo(boxOf(shown), { instant }); if (instant) { home.pos.copy(camera.position); home.target.copy(controls.target); } }
  renderCrumbs(); busy = false;
}

async function drill(mesh) {
  if (busy) return; busy = true;
  const name = lastOf(mesh);
  const nextLevel = level + 1;          // 2 = districts, 3 = areas
  if (level === 3) {                    // area clicked -> google map
    busy = false; return enterArea(mesh);
  }
  // 1) lift the clicked piece + fade the others
  const h = boxOf([mesh]).getSize(new THREE.Vector3()).length() * 0.12;
  const others = shown.filter((m) => m !== mesh);
  others.forEach((m) => (m.material.transparent = true));
  await tween(450, (k) => { mesh.position.y = mesh.userData.baseY + h * k; others.forEach((m) => setAlpha(m, 1 - 0.85 * k)); });

  // 2) load next level and keep only children of the clicked piece
  const root = await loadLevel(nextLevel);
  if (!root) { show(shown); busy = false; return; }
  const prefix = [...path, name].map((s) => s.toLowerCase());
  const kids = meshesOf(root).filter((m) => {
    const p = partsOf(m).map((s) => s.toLowerCase());
    return p.length > prefix.length && prefix.every((v, i) => p[i] === v);
  });
  if (!kids.length) {
    toast(`No ${LEVEL_NAME[nextLevel + 1] || 'sub'} meshes named "${[...path, name].join(SEP)}${SEP}…" found in ${FILES[nextLevel]}`, 8000);
    show(shown); busy = false; return;
  }
  path.push(name); level = nextLevel;
  mesh.visible = false;
  show(kids);
  kids.forEach((m) => { m.position.y = m.userData.baseY - h; m.material.transparent = true; setAlpha(m, 0); });
  const fly = flyTo(boxOf(kids));
  tween(700, (k) => kids.forEach((m) => { m.position.y = m.userData.baseY - h * (1 - k); setAlpha(m, k); }))
    .then(() => kids.forEach((m) => (m.material.transparent = false)));
  await fly;
  renderCrumbs(); busy = false;
}

async function goToLevel(l) {      // breadcrumb jump
  if (busy || l === level) return;
  if (l === 1) return goHome();
  clearArea();
  busy = true;
  const target = path.slice(0, l - 1);
  const root = await loadLevel(l);
  const prefix = target.map((s) => s.toLowerCase());
  const kids = meshesOf(root).filter((m) => { const p = partsOf(m).map((s) => s.toLowerCase()); return p.length > prefix.length && prefix.every((v, i) => p[i] === v); });
  path = target; level = l; show(kids); await flyTo(boxOf(kids)); renderCrumbs(); busy = false;
}

function back() { if (areaMode) return exitArea(); if (level > 1) goToLevel(level - 1); }

function renderCrumbs() {
  const c = $('crumbs'); c.innerHTML = '';
  const items = [lang === 'bn' ? 'বাংলাদেশ' : 'Bangladesh', ...path.map(tr)];
  items.forEach((t, i) => {
    if (i) c.insertAdjacentHTML('beforeend', '<i>›</i>');
    const last = i === items.length - 1;
    const el = document.createElement(last ? 'span' : 'button');
    el.textContent = t; if (last) el.className = 'cur'; else el.onclick = () => goToLevel(i + 1);
    c.appendChild(el);
  });
  const hint = (lang === 'bn' ? { 1: 'একটি বিভাগে ট্যাপ করুন', 2: 'একটি জেলায় ট্যাপ করুন', 3: 'একটি এলাকায় ট্যাপ করুন' } : { 1: 'Tap a division', 2: 'Tap a district', 3: 'Tap an area' })[level];
  c.insertAdjacentHTML('beforeend', `<i>·</i><span style="opacity:.65">${hint}</span>`);
}

// ---------- google map ----------
let bounds = null, curMap = null;
function geoOf(mesh) {                  // approximate lat/lng from the 3D position (north = -Z in the glb)
  const root = cache[3]; root.updateMatrixWorld(true);
  if (!bounds) bounds = new THREE.Box3().setFromObject(root);
  const c = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
  const u = (c.x - bounds.min.x) / (bounds.max.x - bounds.min.x);
  const v = (c.z - bounds.min.z) / (bounds.max.z - bounds.min.z);
  return { lat: (26.63 - v * (26.63 - 20.74)).toFixed(4), lng: (88.03 + u * (92.67 - 88.03)).toFixed(4) };
}
function showEmbed(url, link) { $('gmap').src = url; $('openg').href = link; }
function mapByName(q) {
  const e = encodeURIComponent(q);
  showEmbed(`https://maps.google.com/maps?q=${e}&z=13&output=embed`, `https://www.google.com/maps/search/?api=1&query=${e}`);
}
function mapByPos(zoom) {
  const { lat, lng } = curMap.geo;
  showEmbed(`https://maps.google.com/maps?q=${lat},${lng}&ll=${lat},${lng}&z=${zoom || 12}&output=embed`,
            `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
}
(function buildMapBar() {
  const bar = document.querySelector('.maphead');
  const input = document.createElement('input'); input.id = 'mapq'; input.placeholder = 'Search place…';
  const bs = document.createElement('button'); bs.textContent = 'Search';
  const bp = document.createElement('button'); bp.textContent = '📍 3D position';
  bs.onclick = () => mapByName(input.value);
  bp.onclick = () => curMap && mapByPos();
  input.addEventListener('keydown', (e) => e.key === 'Enter' && mapByName(input.value));
  bar.insertBefore(bp, $('openg')); bar.insertBefore(bs, bp); bar.insertBefore(input, bs);
})();
// find the real place: OSM search limited to a box around the 3D estimate, so same-named places elsewhere are ignored
async function geocodeArea(clean, dist, geo) {
  const lat = +geo.lat, lng = +geo.lng, d = 1.0;
  const vb = [lng - d, lat + d, lng + d, lat - d].join(',');
  const tries = [
    'q=' + encodeURIComponent(clean) + '&viewbox=' + vb + '&bounded=1',
    'q=' + encodeURIComponent(clean + ', ' + dist),
    'q=' + encodeURIComponent(clean + ', Bangladesh'),
  ];
  for (const t of tries) {
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=bd&accept-language=en&' + t);
      const j = await r.json();
      if (j && j[0]) return { lat: (+j[0].lat).toFixed(5), lng: (+j[0].lon).toFixed(5), name: j[0].display_name };
    } catch (e) { /* try next */ }
  }
  return null;
}
function openMap(parts, mesh, realGeo) {
  const [div, dist, area] = parts;
  const clean = area.replace(/\s+\d+$/, '');      // drop the "_2" added for duplicate names
  curMap = { geo: realGeo || geoOf(mesh) };
  $('maptitle').textContent = `${clean} · ${dist} · ${div}`;
  $('mapq').value = `${clean}, ${dist}, Bangladesh`;
  $('mapview').hidden = false;
  console.log('MAP', JSON.stringify(parts), JSON.stringify(curMap.geo));
  const tapped = parts.join('/');
  if (realGeo) { mapByPos(16); return; }
  mapByPos(13);
  geocodeArea(clean, dist, curMap.geo).then((g) => {
    console.log('GEOCODE', clean, g);
    if (g && !$('mapview').hidden && $('maptitle').textContent.startsWith(clean)) { curMap.geo = g; mapByPos(15); }
  });
}
$('closemap').onclick = () => { $('mapview').hidden = true; $('gmap').src = 'about:blank'; };

// ---------- picking ----------
const ray = new THREE.Raycaster();
const mouse = new THREE.Vector2();
function pick(e) {
  const r = canvas.getBoundingClientRect();
  mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hits = ray.intersectObjects(shown, false);
  if (!hits.length) return null;
  const first = hits[0].object, pt = hits[0].point;
  const bb = (m) => m.userData._bb || (m.userData._bb = new THREE.Box3().setFromObject(m));
  const near = shown.filter((m) => { const b = bb(m); return pt.x >= b.min.x && pt.x <= b.max.x && pt.z >= b.min.z && pt.z <= b.max.z; });
  if (near.length < 2) return first;
  const down = new THREE.Raycaster(new THREE.Vector3(pt.x, 1e5, pt.z), new THREE.Vector3(0, -1, 0));
  const objs = [...new Set(down.intersectObjects(near, false).map((h) => h.object))];
  if (!objs.includes(first)) return first;
  const size = (m) => { const b = bb(m); return (b.max.x - b.min.x) * (b.max.z - b.min.z); };
  objs.sort((a, b) => size(a) - size(b));
  return objs[0];
}
function setHover(m, e) {
  if (hovered && hovered !== m && hovered.material.emissive) hovered.material.emissive.setHex(0x000000);
  hovered = m;
  const tip = $('tip');
  if (m) {
    m.material.emissive?.setHex(0x2a6a4a);
    tip.textContent = tr(lastOf(m)); tip.style.opacity = 1;
    tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px';
    canvas.style.cursor = 'pointer';
  } else { tip.style.opacity = 0; canvas.style.cursor = 'grab'; }
}
canvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && !busy) setHover(pick(e), e); });
let down = null;
canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY, t: performance.now() }));
canvas.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  down = null;
  if (moved > 6 || busy) return;          // it was a drag, not a tap
  if (areaMode) { const bi = pickBuilding3D(e); if (bi !== null) return selectBuilding(bi); }
  const m = pick(e); if (m) drill(m);
});

// ---------- toolbar (Blender-like) ----------
const act = {
  rotL: () => orbit(-0.25, 0), rotR: () => orbit(0.25, 0),
  tiltU: () => orbit(0, -0.18), tiltD: () => orbit(0, 0.18),
  panL: () => pan(-1, 0), panR: () => pan(1, 0), panU: () => pan(0, 1), panD: () => pan(0, -1),
  zoomIn: () => dolly(0.8), zoomOut: () => dolly(1.25),
  reset: () => { if (!busy) flyTo(boxOf(shown)); },
};
function orbit(dTheta, dPhi) {
  const off = camera.position.clone().sub(controls.target);
  const s = new THREE.Spherical().setFromVector3(off);
  s.theta += dTheta; s.phi = THREE.MathUtils.clamp(s.phi + dPhi, 0.05, Math.PI - 0.05);
  const to = new THREE.Vector3().setFromSpherical(s).add(controls.target);
  const from = camera.position.clone();
  tween(250, (k) => camera.position.lerpVectors(from, to, k));
}
function pan(x, y) {
  const d = camera.position.distanceTo(controls.target) * 0.18;
  const v = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0).multiplyScalar(x * d)
    .add(new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1).multiplyScalar(y * d));
  const p0 = camera.position.clone(), t0 = controls.target.clone();
  tween(250, (k) => { camera.position.copy(p0).addScaledVector(v, k); controls.target.copy(t0).addScaledVector(v, k); });
}
function dolly(f) {
  const off = camera.position.clone().sub(controls.target);
  const len = THREE.MathUtils.clamp(off.length() * f, controls.minDistance, controls.maxDistance);
  const to = controls.target.clone().add(off.setLength(len)), from = camera.position.clone();
  tween(250, (k) => camera.position.lerpVectors(from, to, k));
}
document.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => act[b.dataset.act]()));
$('home').onclick = () => goHome();
$('back').onclick = back;

// ---------- labels on the map + language toggle ----------
(function injectStyle() {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@600;700&display=swap';
  document.head.appendChild(link);
  const st = document.createElement('style');
  st.textContent = `
#labels{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:0}
.lb{position:absolute;left:0;top:0;white-space:nowrap;font-weight:700;color:#fff;
  font-family:'Noto Sans Bengali','Kalpurush','Nirmala UI','Bangla Sangam MN',system-ui,sans-serif;
  text-shadow:1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,0 0 6px rgba(0,0,0,.8);will-change:transform}
.lb.l1{font-size:19px}.lb.l2{font-size:15px}.lb.l3{font-size:12.5px}
@media (max-width:700px){.lb.l1{font-size:15px}.lb.l2{font-size:12px}.lb.l3{font-size:10.5px}}
#langtoggle{position:fixed;top:14px;right:14px;z-index:20;display:flex;gap:2px;padding:3px;border-radius:999px;
  background:rgba(10,30,22,.78);border:1px solid rgba(255,255,255,.25);backdrop-filter:blur(6px)}
#langtoggle button{border:0;background:transparent;color:#cfe9db;padding:6px 14px;border-radius:999px;cursor:pointer;
  font:600 13px 'Noto Sans Bengali','Nirmala UI','Bangla Sangam MN',system-ui,sans-serif}
#langtoggle button.on{background:#2a9d62;color:#fff}`;
  document.head.appendChild(st);
})();

const labelsEl = document.createElement('div'); labelsEl.id = 'labels';
canvas.insertAdjacentElement('afterend', labelsEl);
let lItems = [], lShown = null, lDirty = true;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _p = new THREE.Vector3();

function topCentroid(m) {                 // centre of the top face (area-weighted), so the name sits on the piece
  m.updateWorldMatrix(true, false);
  const pos = m.geometry.attributes.position, idx = m.geometry.index;
  const n = idx ? idx.count : pos.count;
  let maxY = -Infinity, minY = Infinity;
  for (let i = 0; i < pos.count; i++) {
    _a.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
    if (_a.y > maxY) maxY = _a.y; if (_a.y < minY) minY = _a.y;
  }
  const lim = maxY - (maxY - minY) * 0.05 - 1e-6;
  const get = (k, out) => out.fromBufferAttribute(pos, idx ? idx.getX(k) : k).applyMatrix4(m.matrixWorld);
  let sx = 0, sz = 0, sa = 0; const tris = [];
  for (let k = 0; k + 2 < n; k += 3) {
    get(k, _a); get(k + 1, _b); get(k + 2, _c);
    if (_a.y < lim || _b.y < lim || _c.y < lim) continue;
    const ar = Math.abs((_b.x - _a.x) * (_c.z - _a.z) - (_c.x - _a.x) * (_b.z - _a.z)) / 2;
    tris.push(_a.x, _a.z, _b.x, _b.z, _c.x, _c.z); sx += ar * (_a.x + _b.x + _c.x) / 3; sz += ar * (_a.z + _b.z + _c.z) / 3; sa += ar;
  }
  if (!sa) { const c = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()); return { x: c.x, y: maxY, z: c.z, area: 0, y0: m.position.y }; }
  const pp = poleOf(tris, sx / sa, sz / sa); return { x: pp.x, y: maxY, z: pp.z, area: sa, y0: m.position.y };
}

function poleOf(tris, fx, fz) {            // point farthest from the piece's border (always inside the shape)
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < tris.length; i += 2) { x0 = Math.min(x0, tris[i]); x1 = Math.max(x1, tris[i]); z0 = Math.min(z0, tris[i + 1]); z1 = Math.max(z1, tris[i + 1]); }
  const span = Math.max(x1 - x0, z1 - z0);
  if (!(span > 0)) return { x: fx, z: fz };
  const N = 96, s = span / N, W = Math.ceil((x1 - x0) / s) + 3, H = Math.ceil((z1 - z0) / s) + 3;
  const g = new Uint8Array(W * H);
  for (let t = 0; t < tris.length; t += 6) {
    const ax = tris[t], az = tris[t + 1], bx = tris[t + 2], bz = tris[t + 3], cx = tris[t + 4], cz = tris[t + 5];
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - x0) / s)), i1 = Math.min(W - 1, Math.ceil((Math.max(ax, bx, cx) - x0) / s) + 1);
    const j0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - z0) / s)), j1 = Math.min(H - 1, Math.ceil((Math.max(az, bz, cz) - z0) / s) + 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = x0 + (i - 1 + 0.5) * s, pz = z0 + (j - 1 + 0.5) * s;
      const d1 = (px - bx) * (az - bz) - (ax - bx) * (pz - bz);
      const d2 = (px - cx) * (bz - cz) - (bx - cx) * (pz - cz);
      const d3 = (px - ax) * (cz - az) - (cx - ax) * (pz - az);
      if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) g[j * W + i] = 1;
    }
  }
  const d = new Float32Array(W * H);
  for (let k = 0; k < d.length; k++) d[k] = g[k] ? 1e9 : 0;
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
    const k = j * W + i; if (!g[k]) continue;
    d[k] = Math.min(d[k], d[k - 1] + 1, d[k - W] + 1, d[k - W - 1] + 1.414, d[k - W + 1] + 1.414);
  }
  let best = 0, bi = -1, bj = -1;
  for (let j = H - 2; j >= 1; j--) for (let i = W - 2; i >= 1; i--) {
    const k = j * W + i; if (!g[k]) continue;
    d[k] = Math.min(d[k], d[k + 1] + 1, d[k + W] + 1, d[k + W + 1] + 1.414, d[k + W - 1] + 1.414);
    if (d[k] > best) { best = d[k]; bi = i; bj = j; }
  }
  if (bi < 0) return { x: fx, z: fz };
  return { x: x0 + (bi - 1 + 0.5) * s, z: z0 + (bj - 1 + 0.5) * s };
}

function rebuildLabels() {
  labelsEl.innerHTML = ''; lItems = []; lShown = shown; lDirty = false;
  shown.forEach((m) => {
    if (!m.userData.lc) m.userData.lc = topCentroid(m);
    const el = document.createElement('div');
    el.className = 'lb l' + level; el.textContent = tr(lastOf(m));
    labelsEl.appendChild(el);
    lItems.push({ m, el, lc: m.userData.lc, w: 0, h: 0 });
  });
  lItems.forEach((it) => { it.w = it.el.offsetWidth; it.h = it.el.offsetHeight; });
  lItems.sort((a, b) => b.lc.area - a.lc.area);        // big pieces get their label first
}

function updateLabels() {
  if (shown !== lShown || lDirty) rebuildLabels();
  const W = innerWidth, H = innerHeight, placed = [];
  for (const it of lItems) {
    const { m, el, lc } = it;
    _p.set(lc.x, lc.y + (m.position.y - lc.y0), lc.z).project(camera);
    let ok = m.visible && _p.z > -1 && _p.z < 1 && Math.abs(_p.x) < 1.05 && Math.abs(_p.y) < 1.05;
    let x = 0, y = 0;
    if (ok) {
      x = (_p.x * 0.5 + 0.5) * W; y = (-_p.y * 0.5 + 0.5) * H;
      const r = { x0: x - it.w / 2 - 3, x1: x + it.w / 2 + 3, y0: y - it.h / 2 - 1, y1: y + it.h / 2 + 1 };
      if (placed.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0)) ok = false; else placed.push(r);
    }
    if (!ok) { if (it.on !== false) { el.style.opacity = 0; it.on = false; } continue; }
    it.on = true;
    el.style.opacity = Math.min(1, m.material.opacity);
    el.style.transform = `translate(${(x - it.w / 2).toFixed(1)}px,${(y - it.h / 2).toFixed(1)}px)`;
  }
}

const langBox = document.createElement('div'); langBox.id = 'langtoggle';
langBox.innerHTML = '<button data-l="bn">বাংলা</button><button data-l="en">English</button>';
document.body.appendChild(langBox);
function setLang(l) {
  lang = l;
  try { localStorage.setItem('lang', l); } catch (e) {}
  document.documentElement.lang = l;
  langBox.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.l === l));
  lDirty = true; renderCrumbs();
  lItems.forEach((it) => { it.el.textContent = tr(lastOf(it.m)); it.w = it.el.offsetWidth; it.h = it.el.offsetHeight; });
}
langBox.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { setLang(b.dataset.l); toast('Language: ' + b.dataset.l + ' · ' + lItems.length + ' labels on map', 4000); } });
setLang(lang);

// ---------- loop ----------
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
renderer.setAnimationLoop(() => { controls.update(); Blood.update(performance.now() / 1000, level, shown); renderer.render(scene, camera); try { updateLabels(); } catch (e) { if (!window.__lblErr) { window.__lblErr = 1; console.error(e); toast('Label error: ' + e.message, 15000); } } });

async function startup() {
  await goHome(true);                         // front page appears after level 1 only
  $('loading').classList.add('hide');
  const idle = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 1500 }) : setTimeout(f, 300));
  for (const l of [2, 3]) {                   // districts, then areas, quietly
    await new Promise((r) => idle(r));
    await loadLevel(l, true);
  }
}
startup();


// ---------- 3D buildings inside an area (OpenStreetMap) ----------
const GEO = (window.__geo = window.__geo || { latN: 26.63, latS: 20.74, lngW: 88.03, lngE: 92.67 });
function worldBounds() { const root = cache[3]; root.updateMatrixWorld(true); if (!bounds) bounds = new THREE.Box3().setFromObject(root); return bounds; }
function geo2xz(lat, lng) {
  const b = worldBounds();
  return { x: b.min.x + ((lng - GEO.lngW) / (GEO.lngE - GEO.lngW)) * (b.max.x - b.min.x),
           z: b.min.z + ((GEO.latN - lat) / (GEO.latN - GEO.latS)) * (b.max.z - b.min.z) };
}
function xz2geo(x, z) {
  const b = worldBounds();
  return { lat: GEO.latN - ((z - b.min.z) / (b.max.z - b.min.z)) * (GEO.latN - GEO.latS),
           lng: GEO.lngW + ((x - b.min.x) / (b.max.x - b.min.x)) * (GEO.lngE - GEO.lngW) };
}
(function bldStyle() {
  const st = document.createElement('style');
  st.textContent = `
#bldhud{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:25;display:none;align-items:center;gap:10px;
  padding:8px 14px;border-radius:999px;background:rgba(10,30,22,.85);border:1px solid rgba(255,255,255,.25);color:#e8f7ef;
  backdrop-filter:blur(6px);font:600 13px 'Noto Sans Bengali',system-ui,sans-serif;max-width:94vw}
#bldhud button{border:0;border-radius:999px;padding:6px 12px;cursor:pointer;background:#2a9d62;color:#fff;font:inherit}
#bldhud small{opacity:.6;font-weight:400}
.maphead a.bldlink{display:none;padding:6px 10px;border-radius:8px;background:#2a9d62;color:#fff;text-decoration:none;font:600 13px system-ui;margin-right:6px;white-space:nowrap}`;
  document.head.appendChild(st);
})();
const bldHud = document.createElement('div'); bldHud.id = 'bldhud'; document.body.appendChild(bldHud);
const bldLinks = (function () {
  const bar = document.querySelector('.maphead'), mk = (t) => { const a = document.createElement('a'); a.className = 'bldlink'; a.target = '_blank'; a.rel = 'noopener'; a.textContent = t; return a; };
  const street = mk('🚶 Street view'), earth = mk('🌍 Google Earth');
  if (bar) { bar.insertBefore(earth, $('openg')); bar.insertBefore(street, earth); }
  return { street, earth };
})();

function clearArea() {
  if (!areaMode) return;
  scene.remove(areaMode.obj); areaMode.obj.geometry.dispose(); areaMode.obj.material.dispose();
  areaMode = null; bldHud.style.display = 'none'; labelsEl.style.display = '';
  show(shown);
}
function exitArea() { clearArea(); return flyTo(boxOf(shown)); }

// real boundary of the tapped area from OpenStreetMap (so the 3D buildings and the Google map use the same true place)
async function realBox(name, dist, est) {
  const clean = name.replace(/\s+\d+$/, '');
  try {
    const q = encodeURIComponent(clean + ', ' + dist + ', Bangladesh');
    const ck = 'rb|' + q; let j = null;
    try { j = JSON.parse(localStorage.getItem(ck) || 'null'); } catch (e) {}
    if (!j) {
      const _c = new AbortController(); setTimeout(() => _c.abort(), 6000);
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=8&countrycodes=bd&accept-language=en&q=' + q, { signal: _c.signal });
      j = await r.json();
      try { localStorage.setItem(ck, JSON.stringify(j)); } catch (e) {}
    }
    const d = String(dist).toLowerCase();
    const hit = j.find((x) => String(x.display_name).toLowerCase().includes(d) && x.boundingbox) || j.find((x) => x.boundingbox);
    if (!hit) return null;
    let [s, n, w, e] = hit.boundingbox.map(Number);
    const cy = (s + n) / 2, cx = (w + e) / 2, MAX = 0.025, MIN = 0.006;
    if (n - s > 2 * MAX) { s = cy - MAX; n = cy + MAX; }
    if (e - w > 2 * MAX) { w = cx - MAX; e = cx + MAX; }
    if (n - s < 2 * MIN) { s = cy - MIN; n = cy + MIN; }
    if (e - w < 2 * MIN) { w = cx - MIN; e = cx + MIN; }
    const c = { lat: (s + n) / 2, lng: (w + e) / 2 };
    return { bbox: { s, n, w, e }, c, dLat: est.lat - c.lat, dLng: est.lng - c.lng, label: hit.display_name };
  } catch (err) { console.warn('realBox failed', err); return null; }
}

async function enterArea(mesh) {
  if (busy) return;
  if (areaMode && areaMode.mesh === mesh) { flyTo(areaMode.box, { tilt: 0.5, fit: 0.95 }); return; }
  busy = true; clearArea();
  const name = lastOf(mesh);
  try {
    const others = shown.filter((m) => m !== mesh);
    others.forEach((m) => (m.material.transparent = true));
    tween(500, (k) => others.forEach((m) => setAlpha(m, 1 - 0.8 * k)));
    const box = boxOf([mesh]);
    const _t0 = performance.now(); const flyP = flyTo(box, { tilt: 0.7, fit: 1.1 });
    const a = xz2geo(box.min.x, box.min.z), c = xz2geo(box.max.x, box.max.z);
    const estBbox = { n: a.lat, w: a.lng, s: c.lat, e: c.lng };
    const real = await realBox(name, path[1] || '', { lat: (a.lat + c.lat) / 2, lng: (a.lng + c.lng) / 2 });
    console.log('REALBOX', name, real && real.label, real && JSON.stringify(real.bbox), 'est', JSON.stringify(estBbox));
    const bbox = real ? real.bbox : estBbox;
    window.__realGeo = real ? { lat: real.c.lat.toFixed(5), lng: real.c.lng.toFixed(5) } : null;
    const g2 = real ? (la, ln) => geo2xz(la + real.dLat, ln + real.dLng) : geo2xz;
    toast(lang === 'bn' ? 'ভবন লোড হচ্ছে…' : 'Loading buildings…', 60000);
    const all = await Bld.fetchFootprints(bbox, [...path, name].join('/').toLowerCase(), (t) => toast(t, 60000));
    console.log('T fetched', Math.round(performance.now() - _t0), 'ms');
    let kept = real ? all : await Bld.filterInside(all, geo2xz, mesh), note = ''; console.log("COUNT fetched",all.length,"kept",kept.length);
    if (kept.length < 5 && all.length > 50) { kept = all; note = ' (area outline did not line up with the map, showing the whole box)'; }
    if (!kept.length) { toast(lang === 'bn' ? 'এই এলাকায় OSM-এ কোনো ভবন নেই' : 'No buildings mapped in OpenStreetMap here', 6000); show(shown); busy = false; return; }
    let estN = await Bld.estimateCount(bbox, real ? null : g2, mesh); if (estN != null && estN < kept.length) estN = kept.length;
    await flyP;
    const wb = worldBounds();
    const upm = (wb.max.z - wb.min.z) / ((GEO.latN - GEO.latS) * 111320);        // scene units per metre
    const origin = box.getCenter(new THREE.Vector3());
    const topY = mesh.userData.lc ? mesh.userData.lc.y + (mesh.position.y - mesh.userData.lc.y0) : box.max.y;
    const _med = (a) => { a = a.slice().sort((x, y) => x - y); return a[a.length >> 1]; };
    window.__areaGeo = { lat: _med(kept.map((f) => f.c[0])).toFixed(5), lng: _med(kept.map((f) => f.c[1])).toFixed(5) };
    const built = Bld.buildMesh(kept, { geo2xz: g2, origin, upm, exag: 2 });
    console.log('T mesh built', Math.round(performance.now() - _t0), 'ms,', kept.length, 'buildings');
    built.obj.position.set(origin.x, topY, origin.z);
    scene.add(built.obj);
    const fbox = new THREE.Box3(new THREE.Vector3(box.min.x, topY, box.min.z), new THREE.Vector3(box.max.x, topY + built.maxH, box.max.z));
    areaMode = { mesh, name, box: fbox, ...built };
    labelsEl.style.display = 'none';
    $('msg').style.display = 'none';
    bldHud.innerHTML = `<span>${tr(name)} · ${kept.length.toLocaleString()} ${lang === 'bn' ? 'ম্যাপ করা ভবন' : 'mapped buildings'}${estN ? (lang === 'bn' ? ' / আনুমানিক ~' : ' / est. ~') + estN.toLocaleString() : ''} — ${lang === 'bn' ? 'একটি ভবনে ট্যাপ করুন' : 'tap one'}</span>` +
      `<button id="bldmap">🗺 ${lang === 'bn' ? 'এলাকার ম্যাপ' : 'Area map'}</button><button id="bldexit">✕</button><small>© OpenStreetMap</small>`;
    bldHud.style.display = 'flex';
    $('bldexit').onclick = () => exitArea();
    $('bldmap').onclick = () => { bldLinks.street.style.display = bldLinks.earth.style.display = 'none'; openMap([...path, name], mesh, window.__realGeo || window.__areaGeo); };
    if (note) toast(note, 7000);
    await flyTo(fbox, { tilt: 0.5, fit: 0.95 });
  } catch (e) {
    console.error(e);
    toast('Could not load buildings: ' + (e && e.message ? e.message : e), 8000);
    show(shown);
  }
  busy = false;
}

function pickBuilding3D(e) {
  if (!areaMode) return null;
  const r = canvas.getBoundingClientRect();
  mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObject(areaMode.obj, false)[0];
  if (!hit) return null;
  const i = Bld.rangeIndex(areaMode.ranges, hit.faceIndex * 3);
  return i < 0 ? null : i;
}

function selectBuilding(i) {
  const r = areaMode.ranges[i];
  Bld.setSelected(areaMode, i);
  const bx = areaMode.obj.position.x + r.cx, bz = areaMode.obj.position.z + r.cz;
  // bearing from the 3D camera to the building (north = -Z), so Google opens looking the same way
  const heading = Math.round((((Math.atan2(bx - camera.position.x, -(bz - camera.position.z)) * 180) / Math.PI) + 360) % 360);
  const L = Bld.googleLinks(r.lat, r.lng, heading);
  curMap = { geo: { lat: r.lat.toFixed(6), lng: r.lng.toFixed(6) } };
  $('maptitle').textContent = `${r.name || (lang === 'bn' ? 'ভবন' : 'Building')} · ${tr(areaMode.name)}`;
  $('mapq').value = `${r.lat.toFixed(6)}, ${r.lng.toFixed(6)}`;
  $('mapview').hidden = false;
  showEmbed(L.satEmbed, L.pin);
  bldLinks.street.href = L.street; bldLinks.earth.href = L.earth;
  bldLinks.street.style.display = bldLinks.earth.style.display = 'inline-block';
}


// ---------- Mapping (land measuring tool) ----------
import { initMapping } from './mapping/mapping.js';
const mapping = initMapping({ lang: (typeof lang !== 'undefined' && lang) || 'bn' });
// keep it in sync with the বাংলা / English switch
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-l]');
  if (b && (b.dataset.l === 'bn' || b.dataset.l === 'en')) mapping.setLang(b.dataset.l);
});

// ---------- keyboard controls ----------
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  const t = e.target;
  if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
  const mv = document.getElementById('mapview');
  if (mv && !mv.hidden) return;                       // Google map view is open
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const HOLD = { ArrowLeft: 'rotL', ArrowRight: 'rotR', ArrowUp: 'tiltU', ArrowDown: 'tiltD',
                 a: 'panL', d: 'panR', w: 'panU', s: 'panD', '+': 'zoomIn', '=': 'zoomIn', '-': 'zoomOut', '_': 'zoomOut' };
  const ONCE = { r: '[data-act="reset"]', h: '#home', Home: '#home', Escape: '#back', Backspace: '#back' };
  let btn = null;
  if (HOLD[k]) btn = document.querySelector('#tools [data-act="' + HOLD[k] + '"]');
  else if (ONCE[k] && !e.repeat) btn = document.querySelector('#tools ' + ONCE[k]);
  if (!btn) return;
  e.preventDefault();
  btn.click();
});

import './portal-bridge.js';
