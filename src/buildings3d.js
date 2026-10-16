// buildings3d.js - live OpenStreetMap buildings for one area (thana), extruded with three.js
import * as THREE from 'three';

const MIRRORS = [
  ...(/^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname) ? [] : ['/api/overpass']),
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];
const MAX_BUILDINGS = 15000;

// ---------- cache (IndexedDB) ----------
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('vland-buildings', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('areas');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function cacheGet(k) {
  try {
    const db = await idb();
    return await new Promise((res) => {
      const q = db.transaction('areas').objectStore('areas').get(k);
      q.onsuccess = () => res(q.result || null);
      q.onerror = () => res(null);
    });
  } catch (e) { return null; }
}
async function cacheSet(k, v) {
  try { const db = await idb(); db.transaction('areas', 'readwrite').objectStore('areas').put(v, k); } catch (e) {}
}

// ---------- download ----------
async function overpass(query, onStatus) {
  let lastErr;
  for (let round = 0; round < 2; round++) {
    for (const url of MIRRORS) {
      try {
        if (onStatus) onStatus('Loading buildings… (' + new URL(url).host + ')');
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 25000);
        const r = await fetch(url, {
          method: 'POST',
          body: 'data=' + encodeURIComponent(query),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          signal: ctl.signal,
        });
        clearTimeout(t);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return await r.json();
      } catch (e) { lastErr = e; }
    }
    await new Promise((r) => setTimeout(r, 3000 * (round + 1)));
  }
  throw lastErr || new Error('Overpass failed');
}

function hash01(n) { let h = (Number(n) || 1) * 2654435761 % 4294967296; h ^= h >>> 13; h = Math.imul(h, 1274126177) >>> 0; return h / 4294967295; }

function heightOf(tags, id) {
  tags = tags || {};
  const h = parseFloat(String(tags.height || '').replace(',', '.'));
  if (h > 0) return Math.max(3, h);
  const lv = parseFloat(tags['building:levels']);
  if (lv > 0) return Math.max(3, lv * 3.2);
  const r = hash01(id);
  return 4 + 14 * r * r;                       // unknown height: estimated 4-18 m
}

function parse(json) {
  const out = [];
  for (const el of json.elements || []) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 4) continue;
    const g = []; let sa = 0, so = 0;
    for (const p of el.geometry) { g.push(+p.lat.toFixed(6), +p.lon.toFixed(6)); sa += p.lat; so += p.lon; }
    const n = el.geometry.length;
    const tags = el.tags || {};
    out.push({ i: el.id, h: heightOf(tags, el.id), g, c: [sa / n, so / n], n: tags.name || tags['addr:housename'] || '' });
  }
  return out;
}

async function staticFootprints(bbox) {
  try {
    const idx = await (await fetch('/buildings/index.json')).json();
    const cy = (bbox.n + bbox.s) / 2, cx = (bbox.e + bbox.w) / 2;
    for (const f of idx) {
      if (cy >= f.s && cy <= f.n && cx >= f.w && cx <= f.e) {
        const arr = await (await fetch('/buildings/' + f.file)).json();
        return arr
          .filter((b) => b.c[0] >= bbox.s && b.c[0] <= bbox.n && b.c[1] >= bbox.w && b.c[1] <= bbox.e)
          .map((b) => ({ ...b, h: b.h > 0 ? Math.max(3, b.h) : heightOf({}, b.i) }));
      }
    }
  } catch (e) { console.warn('static buildings unavailable', e); }
  return null;
}

const TILE_BASE = 'https://aginpbyaazzrcyoyhvsk.supabase.co/storage/v1/object/public/tiles/t/';
async function fetchTile(k) {
  try {
    const r = await fetch(TILE_BASE + k + '.json.gz');
    if (!r.ok) throw new Error(r.status);
    return await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json();
  } catch (e) {
    try { const r2 = await fetch('/buildings/t/' + k + '.json'); return r2.ok ? await r2.json() : []; } catch (e2) { return []; }
  }
}
// ---------- tiled static buildings (public/buildings/t/*.json) ----------
let _tileIdx;
async function tileFootprints(bbox) {
  try {
    if (_tileIdx === undefined) {
      const r = await fetch('/buildings/index.json');
      const j = r.ok ? await r.json() : null;
      _tileIdx = j && j.tiles ? { step: j.step, set: new Set(j.tiles) } : null;
    }
    if (!_tileIdx) return null;
    const K = Math.round(1 / _tileIdx.step);
    const y0 = Math.floor(bbox.s * K), y1 = Math.floor(bbox.n * K), x0 = Math.floor(bbox.w * K), x1 = Math.floor(bbox.e * K);
    const jobs = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = y + '_' + x;
      if (_tileIdx.set.has(k)) jobs.push(fetchTile(k));
    }
    let out = [];
    for (const rows of await Promise.all(jobs)) for (const [i, h, n, g] of rows) {
      const m = g.length / 2 - 1; let sa = 0, so = 0;
      for (let j = 0; j < m * 2; j += 2) { sa += g[j]; so += g[j + 1]; }
      const c = [sa / m, so / m];
      if (c[0] < bbox.s || c[0] > bbox.n || c[1] < bbox.w || c[1] > bbox.e) continue;
      out.push({ i, h: h > 0 ? Math.max(3, h) : heightOf({}, i), g, c, n });
    }
    const MAXS = 25000;
    if (out.length > MAXS) { const st = out.length / MAXS; out = Array.from({ length: MAXS }, (_, q) => out[Math.floor(q * st)]); }
    return out;
  } catch (e) { console.warn('tile buildings unavailable', e); return null; }
}

// ---------- satellite-AI estimate (public/buildings/est.json) ----------
let _est;
export async function estimateCount(bbox, geo2xz, mesh) {
  try {
    if (_est === undefined) { const r = await fetch('/buildings/est.json'); _est = r.ok ? await r.json() : null; }
    if (!_est) return null;
    const st = _est.step, c = _est.cells, pts = [];
    for (let i = 0; i < c.length; i += 3) {
      const lat = (c[i] + 0.5) * st, lon = (c[i + 1] + 0.5) * st;
      if (lat < bbox.s || lat > bbox.n || lon < bbox.w || lon > bbox.e) continue;
      pts.push({ c: [lat, lon], n: c[i + 2] });
    }
    const inside = geo2xz ? await filterInside(pts, geo2xz, mesh) : pts;
    const n = inside.reduce((a, q) => a + q.n, 0);
    return n >= 1000 ? Math.round(n / 100) * 100 : n;
  } catch (e) { return null; }
}

export async function fetchFootprints(bbox, key, onStatus) {
  const st = await tileFootprints(bbox); if (st) { console.log("STATIC buildings", st.length); return st; }
  const ck = 'v2|' + key + '|' + [bbox.s, bbox.w, bbox.n, bbox.e].map((v) => v.toFixed(3)).join(',');
  const hit = await cacheGet(ck);
  if (hit && hit.fps) return hit.fps;
  const STEP = 0.012, MAX_TILES = 64;
  const rows = Math.min(8, Math.max(1, Math.ceil((bbox.n - bbox.s) / STEP)));
  const cols = Math.min(8, Math.max(1, Math.ceil((bbox.e - bbox.w) / STEP)));
  const dh = (bbox.n - bbox.s) / rows, dw = (bbox.e - bbox.w) / cols;
  const seen = new Map();
  let done = 0; const total = Math.min(rows * cols, MAX_TILES);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (done >= MAX_TILES) break;
      const s0 = bbox.s + r * dh, n0 = s0 + dh, w0 = bbox.w + c * dw, e0 = w0 + dw;
      const q = '[out:json][timeout:60];(way["building"](' + [s0, w0, n0, e0].map((v) => v.toFixed(5)).join(',') + '););out geom;';
      if (onStatus) onStatus('Loading buildings… tile ' + (done + 1) + '/' + total);
      try {
        for (const f of parse(await overpass(q, null))) seen.set(f.i, f);
      } catch (e) { console.warn('tile failed', r, c, e); }
      done++;
    }
  }
  const fps = [...seen.values()];
  if (fps.length) cacheSet(ck, { fps, t: Date.now() });
  return fps;
}

// keep only buildings whose centre lies on the tapped area's top surface
export async function filterInside(fps, geo2xz, mesh) {
  mesh.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(mesh);
  const ray = new THREE.Raycaster();
  const dir = new THREE.Vector3(0, -1, 0), org = new THREE.Vector3();
  const kept = [];
  let t = performance.now();
  for (const f of fps) {
    const p = geo2xz(f.c[0], f.c[1]);
    if (p.x >= box.min.x && p.x <= box.max.x && p.z >= box.min.z && p.z <= box.max.z) {
      org.set(p.x, box.max.y + 1, p.z); ray.set(org, dir);
      if (ray.intersectObject(mesh, false).length) kept.push(f);
    }
    if (performance.now() - t > 12) { await new Promise((r) => setTimeout(r, 0)); t = performance.now(); }
  }
  return kept;
}

// ---------- mesh ----------
const WALLS = ['#d9c9a8', '#c98b6b', '#bfb8ad', '#e6d5a0', '#a9bfc4', '#cfa38a', '#9aa585'];
const ROOFS = ['#7a7d80', '#8a4b38', '#5e6a73', '#a8a49c', '#6b5a4a'];
const SELECT = new THREE.Color('#ffd54a');

export function buildMesh(fps, { geo2xz, origin, upm, exag = 2 }) {
  const pos = [], col = [], ranges = [];
  let maxH = 0;
  const wc = WALLS.map((h) => new THREE.Color(h)), rc = ROOFS.map((h) => new THREE.Color(h));
  for (const f of fps) {
    const g = f.g.slice();
    if (g.length > 4 && g[0] === g[g.length - 2] && g[1] === g[g.length - 1]) g.length -= 2;
    const ring = [];
    for (let i = 0; i < g.length; i += 2) { const p = geo2xz(g[i], g[i + 1]); ring.push(new THREE.Vector2(p.x - origin.x, p.z - origin.z)); }
    if (ring.length < 3) continue;
    let A = 0;
    for (let i = 0; i < ring.length; i++) { const j = (i + 1) % ring.length; A += ring[i].x * ring[j].y - ring[j].x * ring[i].y; }
    if (A > 0) ring.reverse();                       // walls below face outward when area < 0
    const H = f.h * upm * exag;
    if (H > maxH) maxH = H;
    const v0 = pos.length / 3;
    const w = wc[Math.floor(hash01(f.i) * wc.length) % wc.length];
    const r = rc[Math.floor(hash01(f.i + 7) * rc.length) % rc.length];
    const push = (x, y, z, c) => { pos.push(x, y, z); col.push(c.r, c.g, c.b); };
    let tris = [];
    try { tris = THREE.ShapeUtils.triangulateShape(ring, []); } catch (e) { tris = []; }
    for (const t of tris) {
      let a = ring[t[0]], b = ring[t[1]], c = ring[t[2]];
      const cy = (b.y - a.y) * (c.x - a.x) - (b.x - a.x) * (c.y - a.y);
      if (cy < 0) { const s = b; b = c; c = s; }     // roof must face up
      push(a.x, H, a.y, r); push(b.x, H, b.y, r); push(c.x, H, c.y, r);
    }
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const p = ring[i], q = ring[(i + 1) % n];
      push(p.x, 0, p.y, w); push(q.x, 0, q.y, w); push(q.x, H, q.y, w);
      push(p.x, 0, p.y, w); push(q.x, H, q.y, w); push(p.x, H, p.y, w);
    }
    let cx = 0, cz = 0; ring.forEach((p) => { cx += p.x; cz += p.y; });
    ranges.push({ v0, v1: pos.length / 3, lat: f.c[0], lng: f.c[1], cx: cx / n, cz: cz / n, h: f.h, name: f.n, id: f.i });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  const colors = new Float32Array(col);
  geo.setAttribute('color', new THREE.BufferAttribute(colors.slice(), 3));
  geo.computeVertexNormals();
  const obj = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  return { obj, ranges, orig: colors, maxH, sel: -1 };
}

export function rangeIndex(ranges, v) {
  let lo = 0, hi = ranges.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (v < ranges[m].v0) hi = m - 1; else if (v >= ranges[m].v1) lo = m + 1; else return m;
  }
  return -1;
}

export function setSelected(area, idx) {
  const attr = area.obj.geometry.attributes.color, arr = attr.array;
  const paint = (i, c) => {
    const r = area.ranges[i];
    for (let v = r.v0; v < r.v1; v++) {
      if (c) { arr[v * 3] = c.r; arr[v * 3 + 1] = c.g; arr[v * 3 + 2] = c.b; }
      else { arr[v * 3] = area.orig[v * 3]; arr[v * 3 + 1] = area.orig[v * 3 + 1]; arr[v * 3 + 2] = area.orig[v * 3 + 2]; }
    }
  };
  if (area.sel >= 0) paint(area.sel, null);
  area.sel = idx;
  if (idx >= 0) paint(idx, SELECT);
  attr.needsUpdate = true;
}

export function googleLinks(lat, lng, heading) {
  const la = lat.toFixed(6), lo = lng.toFixed(6);
  return {
    satEmbed: 'https://maps.google.com/maps?q=' + la + ',' + lo + '&ll=' + la + ',' + lo + '&t=k&z=20&output=embed',
    pin: 'https://www.google.com/maps/search/?api=1&query=' + la + ',' + lo,
    street: 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + la + ',' + lo + '&heading=' + heading + '&pitch=8&fov=85',
    earth: 'https://earth.google.com/web/@' + la + ',' + lo + ',8a,220d,35y,' + heading + 'h,72t,0r',
  };
}
