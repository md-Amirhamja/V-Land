// Pure geometry helpers (no DOM, no Leaflet) – lat/lng are [lat, lng] pairs.
const R = 6378137, D = Math.PI / 180;

export function project(latlngs) {
  const lat0 = latlngs.reduce((s, p) => s + p[0], 0) / latlngs.length;
  const lng0 = latlngs.reduce((s, p) => s + p[1], 0) / latlngs.length;
  const k = Math.cos(lat0 * D);
  return {
    pts: latlngs.map(([la, ln]) => [(ln - lng0) * D * R * k, (la - lat0) * D * R]),
    back: ([x, y]) => [lat0 + y / (R * D), lng0 + x / (R * D * k)],
  };
}

export function polyArea(p) {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

export function haversine(a, b) {
  const dLat = (b[0] - a[0]) * D, dLng = (b[1] - a[1]) * D;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * D) * Math.cos(b[0] * D) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const areaSqm = (ll) => (ll.length < 3 ? 0 : polyArea(project(ll).pts));

export function perimeter(ll, closed = true) {
  let s = 0;
  for (let i = 0; i < ll.length - (closed ? 0 : 1); i++) s += haversine(ll[i], ll[(i + 1) % ll.length]);
  return s;
}

// Sutherland–Hodgman against the half-plane  dot(p,d) <= t  (or >= t)
function clip(poly, d, t, keepLess) {
  const f = (p) => (keepLess ? t - (p[0] * d[0] + p[1] * d[1]) : (p[0] * d[0] + p[1] * d[1]) - t);
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) {
      const u = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
    }
  }
  return out;
}

/**
 * Split a polygon into strips whose areas follow `ratios` (e.g. [1,1,2]).
 * Cut lines are perpendicular to the longest side (or to its normal if `flip`).
 */
export function splitByRatios(latlngs, ratios, flip = false) {
  const { pts, back } = project(latlngs);
  let best = 0, ang = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > best) { best = len; ang = Math.atan2(b[1] - a[1], b[0] - a[0]); }
  }
  if (flip) ang += Math.PI / 2;
  const d = [Math.cos(ang), Math.sin(ang)];
  const proj = pts.map((p) => p[0] * d[0] + p[1] * d[1]);
  const lo = Math.min(...proj), hi = Math.max(...proj);
  const total = polyArea(pts), sum = ratios.reduce((a, b) => a + b, 0);

  const cuts = [lo];
  let acc = 0;
  for (let k = 0; k < ratios.length - 1; k++) {
    acc += ratios[k] / sum;
    let a = lo, b = hi;
    for (let it = 0; it < 60; it++) {
      const m = (a + b) / 2;
      if (polyArea(clip(pts, d, m, true)) < acc * total) a = m; else b = m;
    }
    cuts.push((a + b) / 2);
  }
  cuts.push(hi);

  const pieces = [];
  for (let k = 0; k < ratios.length; k++) {
    let p = clip(pts, d, cuts[k], false);
    p = clip(p, d, cuts[k + 1], true);
    pieces.push({ latlngs: p.map(back), sqm: polyArea(p) });
  }
  return pieces;
}

/** Returns a function mapping [lat,lng] -> local [x,y] metres, anchored on `latlngs`. */
export function projector(latlngs) {
  const lat0 = latlngs.reduce((s, p) => s + p[0], 0) / latlngs.length;
  const lng0 = latlngs.reduce((s, p) => s + p[1], 0) / latlngs.length;
  const k = Math.cos(lat0 * D);
  return ([la, ln]) => [(ln - lng0) * D * R * k, (la - lat0) * D * R];
}
