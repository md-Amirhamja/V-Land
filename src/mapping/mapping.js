import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './mapping.css';
import './dock.js';
import { areaSqm, perimeter, haversine, splitByRatios, projector } from './geo.js';
import { REGIONS, BASE, chipsFor, sqmToUnit, breakdown, num, digits } from './units.js';
import { T, HEIR_NAMES } from './i18n.js';

const COLORS = ['#e2543a', '#3fa66a', '#4a8fd6', '#d9a53a', '#9b6bd1', '#2fb5b0'];
const KEY = 'mapping.v1';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * initMapping({ lang: 'bn' | 'en', insertBefore: '#some-selector' })
 * returns { open, close, setLang }
 */
export function initMapping(opts = {}) {
  const S = {
    lang: opts.lang || 'bn', region: 'standard', unit: 'decimal', base: 'sat',
    screen: 'home', homeView: 'list', pts: [], lands: [], editId: null, name: '', note: '',
    heirs: { n: 2, mode: 'equal', list: [] }, flip: false, pieces: null,
  };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    Object.assign(S, raw.settings || {}); S.lands = raw.lands || [];
  } catch { /* ignore */ }
  const persist = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        lands: S.lands, settings: { lang: S.lang, region: S.region, unit: S.unit },
      }));
    } catch { /* storage full / blocked */ }
  };
  const t = (k) => T[S.lang][k];
  const N = (n, dp) => num(n, S.lang, dp);

  /* ---------- DOM skeleton ---------- */
  const root = document.createElement('div');
  root.className = 'mp-root'; root.hidden = true;
  root.innerHTML = `
    <section class="mp-home"></section>
    <section class="mp-stage" hidden>
      <div class="mp-map"></div>
      <div class="mp-top"></div>
      <div class="mp-panel"></div>
    </section>
    <div class="mp-toast" hidden></div>
    <input type="file" accept="application/json" class="mp-file" hidden />`;
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const homeEl = $('.mp-home'), stageEl = $('.mp-stage'), topEl = $('.mp-top'), panelEl = $('.mp-panel');

  const fab = document.createElement('button');
  fab.className = 'mp-fab'; fab.type = 'button';
  const ref = opts.insertBefore && document.querySelector(opts.insertBefore);
  if (ref) { fab.classList.add('inline'); ref.parentNode.insertBefore(fab, ref); } else document.body.appendChild(fab);
  fab.addEventListener('click', open);
  const labelFab = () => { fab.innerHTML = `<span>🗺️</span> ${esc(t('title'))}`; };

  let toastTimer;
  const toast = (msg) => {
    const el = $('.mp-toast'); el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), 2200);
  };

  /* ---------- Leaflet ---------- */
  let map, tiles, poly, markers = [], edgeLayer, pieceLayer, meDot;
  const TILES = {
    sat: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 'Imagery © Esri'],
    map: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', '© OpenStreetMap contributors'],
  };
  function ensureMap() {
    if (map) return;
    map = L.map($('.mp-map'), { zoomControl: false, attributionControl: true, maxZoom: 20 }).setView([23.8103, 90.4125], 16);
    setBase(S.base);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    edgeLayer = L.layerGroup().addTo(map); pieceLayer = L.layerGroup().addTo(map);
    map.on('click', (e) => {
      if (S.screen !== 'draw') return;
      S.pts.push([e.latlng.lat, e.latlng.lng]); rebuildMarkers(); refreshShape(); renderPanel();
    });
  }
  function setBase(b) {
    S.base = b; if (tiles) map.removeLayer(tiles);
    tiles = L.tileLayer(TILES[b][0], { maxZoom: 20, maxNativeZoom: 19, attribution: TILES[b][1] }).addTo(map);
    tiles.bringToBack();
  }
  const ptIcon = (i) => L.divIcon({ className: 'mp-pt', html: `<b>${i + 1}</b>`, iconSize: [26, 26] });

  function rebuildMarkers() {
    markers.forEach((m) => map.removeLayer(m)); markers = [];
    if (S.screen !== 'draw') return;
    S.pts.forEach((p, i) => {
      const m = L.marker(p, { draggable: true, icon: ptIcon(i), keyboard: false }).addTo(map);
      m.on('drag', () => { const ll = m.getLatLng(); S.pts[i] = [ll.lat, ll.lng]; refreshShape(); updateLive(); });
      m.on('dragend', renderPanel);
      markers.push(m);
    });
  }
  function refreshShape() {
    if (poly) { map.removeLayer(poly); poly = null; }
    edgeLayer.clearLayers();
    if (S.pts.length >= 3) poly = L.polygon(S.pts, { color: '#ffffff', weight: 2, fillColor: '#3fa66a', fillOpacity: S.pieces ? 0 : 0.3 }).addTo(map);
    else if (S.pts.length === 2) poly = L.polyline(S.pts, { color: '#ffffff', weight: 2 }).addTo(map);
    const n = S.pts.length, closed = n >= 3;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = S.pts[i], b = S.pts[(i + 1) % n];
      const d = haversine(a, b);
      L.marker([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], {
        interactive: false,
        icon: L.divIcon({ className: 'mp-edge', html: `<span>${N(d, 1)} ${S.lang === 'bn' ? 'মি' : 'm'}</span>`, iconSize: [60, 18] }),
      }).addTo(edgeLayer);
    }
  }
  function drawPieces() {
    pieceLayer.clearLayers();
    if (!S.pieces) return;
    S.pieces.forEach((p, i) => {
      L.polygon(p.latlngs, { color: '#fff', weight: 2, fillColor: COLORS[i], fillOpacity: 0.55 })
        .bindTooltip(`${esc(S.heirs.list[i].name)}<br>${N(sqmToUnit(p.sqm, S.unit))} ${BASE[S.unit][S.lang]}`, { permanent: true, direction: 'center', className: 'mp-tip' })
        .addTo(pieceLayer);
    });
  }
  function fit() {
    if (S.pts.length < 2) return;
    const wide = window.innerWidth >= 800;
    map.fitBounds(L.latLngBounds(S.pts), {
      paddingTopLeft: [wide ? 460 : 30, 80], paddingBottomRight: [30, wide ? 40 : Math.round(window.innerHeight * 0.5)], maxZoom: 20,
    });
  }
  function updateLive() {
    const el = panelEl.querySelector('[data-live]');
    if (el) el.innerHTML = liveHTML();
    const f = panelEl.querySelector('[data-act=finish]'); if (f) f.disabled = S.pts.length < 3;
  }

  /* ---------- Screens ---------- */
  function setScreen(s) {
    S.screen = s;
    const home = s === 'home';
    homeEl.hidden = !home; stageEl.hidden = home;
    if (!home) { ensureMap(); setTimeout(() => map.invalidateSize(), 0); }
    S.pieces = s === 'split' ? S.pieces : null;
    if (map) { pieceLayer.clearLayers(); rebuildMarkers(); refreshShape(); if (s === 'split') drawPieces(); }
    renderTop(); renderPanel(); renderHome();
  }

  function renderHome() {
    if (S.screen !== 'home') return;
    if (S.homeView === 'settings') {
      homeEl.innerHTML = `
        <header><button class="mp-ic" data-act="home-list">←</button><h2>${t('settings')}</h2><span></span></header>
        <div class="mp-body">
          <h3>${t('region')}</h3>
          ${Object.entries(REGIONS).map(([id, r]) => `
            <button class="mp-opt ${S.region === id ? 'on' : ''}" data-act="region" data-v="${id}">
              <b>${r[S.lang]}</b><small>${r.hint[S.lang]}</small></button>`).join('')}
          <h3>${t('language')}</h3>
          <div class="mp-seg"><button class="${S.lang === 'bn' ? 'on' : ''}" data-act="lang" data-v="bn">বাংলা</button>
          <button class="${S.lang === 'en' ? 'on' : ''}" data-act="lang" data-v="en">English</button></div>
          <h3>${t('backup')}</h3>
          <button class="mp-btn primary" data-act="export">${t('export')}</button>
          <button class="mp-btn" data-act="import">${t('import')}</button>
          <p class="mp-small">${t('disclaimer')}</p>
        </div>`;
      return;
    }
    homeEl.innerHTML = `
      <header><button class="mp-ic" data-act="close">←</button><h2>${t('home')}</h2><button class="mp-ic" data-act="home-settings">⚙</button></header>
      <div class="mp-body">
        ${S.lands.length ? S.lands.map((l) => `
          <div class="mp-land" data-id="${l.id}">
            <div class="mp-thumb">${thumbSVG(l.pts)}</div>
            <div class="mp-land-info" data-act="open-land" data-id="${l.id}">
              <b>${esc(l.name)}</b>
              <span>${N(sqmToUnit(areaSqm(l.pts), S.unit))} ${BASE[S.unit][S.lang]}</span>
              <small>${digits(new Date(l.created).toLocaleDateString(S.lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), S.lang)}</small>
            </div>
            <button class="mp-ic danger" data-act="del-land" data-id="${l.id}" title="${t('delete')}">🗑</button>
          </div>`).join('') : `<p class="mp-empty">${t('empty')}</p>`}
      </div>
      <footer><button class="mp-btn primary" data-act="new">${t('newMap')}</button></footer>`;
  }

  function thumbSVG(ll) {
    const f = projector(ll), xy = ll.map(f);
    const xs = xy.map((p) => p[0]), ys = xy.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const s = 48 / Math.max(maxX - minX, maxY - minY, 1);
    const pts = xy.map(([x, y]) => `${(x - minX) * s + 6},${(maxY - y) * s + 6}`).join(' ');
    return `<svg viewBox="0 0 60 60"><polygon points="${pts}" fill="rgba(63,166,106,.35)" stroke="#9be0b5" stroke-width="1.5"/></svg>`;
  }

  function renderTop() {
    if (S.screen === 'home') return;
    topEl.innerHTML = `
      <button class="mp-ic" data-act="to-home">←</button>
      <form class="mp-search" data-act="search"><input name="q" placeholder="${esc(t('search'))}" autocomplete="off" /><button>${t('go')}</button></form>
      <div class="mp-seg small"><button class="${S.base === 'sat' ? 'on' : ''}" data-act="base" data-v="sat">${t('satellite')}</button>
      <button class="${S.base === 'map' ? 'on' : ''}" data-act="base" data-v="map">${t('map')}</button></div>`;
  }

  const unitLabel = (id) => BASE[id][S.lang];
  const total = () => areaSqm(S.pts);
  const liveHTML = () => S.pts.length < 3
    ? `<b>${t('tap')}</b><small>${t('tapSub')} · ${t('points')}: ${N(S.pts.length, 0)}</small>`
    : `<div class="mp-live"><strong>${N(sqmToUnit(total(), S.unit))}</strong> <em>${unitLabel(S.unit)}</em></div>
       <small>${t('points')}: ${N(S.pts.length, 0)} · ${t('perimeter')}: ${N(perimeter(S.pts), 1)} ${S.lang === 'bn' ? 'মি' : 'm'}</small>`;

  const chips = () => `<div class="mp-chips">${chipsFor(S.region).map((id) =>
    `<button class="${S.unit === id ? 'on' : ''}" data-act="unit" data-v="${id}">${unitLabel(id)}</button>`).join('')}</div>`;

  function renderPanel() {
    if (S.screen === 'home') return;
    if (S.screen === 'draw') {
      panelEl.innerHTML = `
        <div class="mp-card" data-live>${liveHTML()}</div>
        ${S.pts.length >= 3 ? chips() : ''}
        <div class="mp-tools">
          <button data-act="locate">◎<small>${t('locate')}</small></button>
          <button data-act="undo" ${S.pts.length ? '' : 'disabled'}>↶<small>${t('undo')}</small></button>
          <button data-act="clear" ${S.pts.length ? '' : 'disabled'}>🗑<small>${t('clear')}</small></button>
        </div>
        <button class="mp-btn primary" data-act="finish" ${S.pts.length < 3 ? 'disabled' : ''}>${t('finish')}</button>`;
    } else if (S.screen === 'result') {
      const a = total();
      panelEl.innerHTML = `
        <input class="mp-name" data-bind="name" value="${esc(S.name)}" placeholder="${t('name')}" />
        <div class="mp-big"><strong>${N(sqmToUnit(a, S.unit))}</strong><em>${unitLabel(S.unit)}</em></div>
        <div class="mp-break">${breakdown(a, S.region, S.lang)}</div>
        ${chips()}
        <div class="mp-meta"><span>${t('points')}: ${N(S.pts.length, 0)}</span><span>${t('perimeter')}: ${N(perimeter(S.pts), 1)} ${S.lang === 'bn' ? 'মি' : 'm'}</span>
          <span>${N(a, 1)} ${BASE.sqm[S.lang]} · ${N(sqmToUnit(a, 'sqft'), 0)} ${BASE.sqft[S.lang]}</span></div>
        <textarea data-bind="note" rows="2" placeholder="${esc(t('notePh'))}">${esc(S.note)}</textarea>
        <p class="mp-small">${t('disclaimer')}</p>
        <div class="mp-row"><button class="mp-btn primary" data-act="save">${t('save')}</button>
          <button class="mp-btn" data-act="split">${t('split')}</button></div>
        <div class="mp-row"><button class="mp-btn" data-act="share">${t('share')}</button>
          <button class="mp-btn" data-act="edit">${t('edit')}</button></div>`;
    } else if (S.screen === 'split') {
      ensureHeirs();
      const sum = S.heirs.list.reduce((s, h) => s + (S.heirs.mode === 'equal' ? 1 : h.ratio), 0);
      panelEl.innerHTML = `
        <div class="mp-h">${t('heirs')}</div>
        <div class="mp-chips">${[2, 3, 4, 5, 6].map((n) => `<button class="${S.heirs.n === n ? 'on' : ''}" data-act="heirs" data-v="${n}">${N(n, 0)}</button>`).join('')}</div>
        <div class="mp-h">${t('method')}</div>
        <div class="mp-seg"><button class="${S.heirs.mode === 'equal' ? 'on' : ''}" data-act="mode" data-v="equal">${t('equal')}</button>
          <button class="${S.heirs.mode === 'custom' ? 'on' : ''}" data-act="mode" data-v="custom">${t('custom')}</button></div>
        ${chips()}
        <div class="mp-heirs">${S.heirs.list.map((h, i) => {
          const r = S.heirs.mode === 'equal' ? 1 : h.ratio;
          return `<div class="mp-heir"><i style="background:${COLORS[i]}"></i>
            <input data-heir="${i}" value="${esc(h.name)}" />
            ${S.heirs.mode === 'custom' ? `<div class="mp-step"><button data-act="ratio" data-i="${i}" data-d="-1">−</button><b>${N(h.ratio, 0)}</b><button data-act="ratio" data-i="${i}" data-d="1">+</button></div>` : ''}
            <div class="mp-heir-a"><b>${N(sqmToUnit(S.pieces[i].sqm, S.unit))} ${unitLabel(S.unit)}</b><small>${N((r / sum) * 100, 1)}%</small></div></div>`;
        }).join('')}</div>
        <div class="mp-meta"><span>${t('total')}: ${N(sqmToUnit(total(), S.unit))} ${unitLabel(S.unit)}</span></div>
        <div class="mp-row"><button class="mp-btn" data-act="flip">⟳ ${t('flip')}</button><button class="mp-btn primary" data-act="share">${t('share')}</button></div>
        <button class="mp-btn" data-act="to-result">${t('back')}</button>`;
    }
  }

  /* ---------- Split logic ---------- */
  function ensureHeirs() {
    const H = S.heirs;
    while (H.list.length < H.n) H.list.push({ name: HEIR_NAMES[S.lang][H.list.length], ratio: 1 });
    H.list.length = H.n;
    recomputePieces();
  }
  function recomputePieces() {
    const ratios = S.heirs.list.map((h) => (S.heirs.mode === 'equal' ? 1 : Math.max(1, h.ratio)));
    S.pieces = splitByRatios(S.pts, ratios, S.flip);
    if (map) { pieceLayer.clearLayers(); drawPieces(); if (poly) poly.setStyle({ fillOpacity: 0 }); }
  }

  /* ---------- Share image ---------- */
  async function makeImage() {
    const rows = S.pieces ? S.pieces.map((p, i) => ({ name: S.heirs.list[i].name, sqm: p.sqm, c: COLORS[i] })) : [{ name: S.name || t('untitled'), sqm: total(), c: '#3fa66a' }];
    const W = 900, mapH = 520, H = 130 + mapH + 50 + rows.length * 46 + 90;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = '#0d1712'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#e8f5ec'; g.font = '700 34px system-ui, "Noto Sans Bengali", sans-serif';
    g.fillText(S.name || t('untitled'), 40, 60);
    g.fillStyle = '#9bb8a5'; g.font = '24px system-ui, "Noto Sans Bengali", sans-serif';
    g.fillText(`${N(sqmToUnit(total(), S.unit))} ${unitLabel(S.unit)}  ·  ${N(total(), 1)} ${BASE.sqm[S.lang]}`, 40, 98);

    const f = projector(S.pts), all = S.pts.map(f);
    const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const sc = Math.min((W - 160) / (maxX - minX || 1), (mapH - 60) / (maxY - minY || 1));
    const ox = (W - (maxX - minX) * sc) / 2, oy = 130 + (mapH - (maxY - minY) * sc) / 2;
    const tr = ([x, y]) => [ox + (x - minX) * sc, oy + (maxY - y) * sc];
    const path = (ll) => { g.beginPath(); ll.map(f).map(tr).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
    g.lineJoin = 'round';
    if (S.pieces) S.pieces.forEach((p, i) => { path(p.latlngs); g.fillStyle = COLORS[i] + 'aa'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); });
    else { path(S.pts); g.fillStyle = 'rgba(63,166,106,.45)'; g.fill(); }
    path(S.pts); g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke();
    g.font = '600 20px system-ui, "Noto Sans Bengali", sans-serif'; g.textAlign = 'center';
    S.pts.forEach((p, i) => { const q = S.pts[(i + 1) % S.pts.length]; const [x, y] = tr(f([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]));
      g.fillStyle = '#0d1712cc'; g.fillRect(x - 36, y - 15, 72, 26); g.fillStyle = '#fff'; g.fillText(`${N(haversine(p, q), 1)}`, x, y + 5); });
    g.textAlign = 'left';
    let y = 130 + mapH + 30;
    rows.forEach((r) => {
      g.fillStyle = r.c; g.fillRect(40, y, 10, 30);
      g.fillStyle = '#e8f5ec'; g.font = '600 26px system-ui, "Noto Sans Bengali", sans-serif'; g.fillText(r.name, 66, y + 25);
      g.textAlign = 'right'; g.fillText(`${N(sqmToUnit(r.sqm, S.unit))} ${unitLabel(S.unit)}`, W - 40, y + 25); g.textAlign = 'left';
      y += 46;
    });
    g.fillStyle = '#6f8c7a'; g.font = '18px system-ui, "Noto Sans Bengali", sans-serif'; g.fillText(t('disclaimer'), 40, H - 30);
    return new Promise((res) => cv.toBlob(res, 'image/png'));
  }
  async function shareImage() {
    const blob = await makeImage(), file = new File([blob], 'mapping.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: S.name || t('title') }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    download(blob, 'mapping.png');
  }
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------- Actions ---------- */
  const A = {
    close, 'home-list': () => { S.homeView = 'list'; renderHome(); }, 'home-settings': () => { S.homeView = 'settings'; renderHome(); },
    new: () => { S.pts = []; S.editId = null; S.name = ''; S.note = ''; S.pieces = null; setScreen('draw'); },
    'to-home': () => { S.homeView = 'list'; setScreen('home'); },
    'open-land': (el) => { const l = S.lands.find((x) => x.id === el.dataset.id); if (!l) return; S.pts = l.pts.map((p) => [...p]); S.editId = l.id; S.name = l.name; S.note = l.note || ''; setScreen('result'); setTimeout(fit, 60); },
    'del-land': (el) => { S.lands = S.lands.filter((l) => l.id !== el.dataset.id); persist(); renderHome(); },
    region: (el) => { S.region = el.dataset.v; S.unit = chipsFor(S.region)[0]; persist(); renderHome(); },
    lang: (el) => { setLang(el.dataset.v); },
    base: (el) => { setBase(el.dataset.v); renderTop(); },
    unit: (el) => { S.unit = el.dataset.v; persist(); if (S.pieces) drawPieces(); renderPanel(); },
    undo: () => { S.pts.pop(); rebuildMarkers(); refreshShape(); renderPanel(); },
    clear: () => { S.pts = []; rebuildMarkers(); refreshShape(); renderPanel(); },
    finish: () => { if (S.pts.length < 3) return; if (!S.name) S.name = `${t('untitled')} ${N(S.lands.length + 1, 0)}`; setScreen('result'); fit(); },
    edit: () => setScreen('draw'),
    'to-result': () => { S.pieces = null; setScreen('result'); },
    save: () => {
      const rec = { id: S.editId || String(Date.now()), name: S.name || t('untitled'), note: S.note, pts: S.pts, created: Date.now() };
      const i = S.lands.findIndex((l) => l.id === rec.id);
      if (i >= 0) { rec.created = S.lands[i].created; S.lands[i] = rec; } else S.lands.unshift(rec);
      S.editId = rec.id; persist(); toast(t('saved'));
    },
    split: () => { S.flip = false; ensureHeirs(); setScreen('split'); },
    heirs: (el) => { S.heirs.n = +el.dataset.v; ensureHeirs(); renderPanel(); },
    mode: (el) => { S.heirs.mode = el.dataset.v; recomputePieces(); renderPanel(); },
    ratio: (el) => { const h = S.heirs.list[+el.dataset.i]; h.ratio = Math.min(99, Math.max(1, h.ratio + +el.dataset.d)); recomputePieces(); renderPanel(); },
    flip: () => { S.flip = !S.flip; recomputePieces(); renderPanel(); },
    share: shareImage,
    locate: () => {
      if (!navigator.geolocation) return toast(t('noGps'));
      navigator.geolocation.getCurrentPosition((p) => {
        const ll = [p.coords.latitude, p.coords.longitude]; map.setView(ll, 19);
        if (meDot) map.removeLayer(meDot);
        meDot = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#2f7bff', fillOpacity: 1, interactive: false }).addTo(map);
      }, () => toast(t('noGps')), { enableHighAccuracy: true, timeout: 10000 });
    },
    export: () => download(new Blob([JSON.stringify({ app: 'mapping', version: 1, lands: S.lands }, null, 2)], { type: 'application/json' }), 'mapping-backup.json'),
    import: () => $('.mp-file').click(),
  };

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'FORM' || el.disabled) return;
    A[el.dataset.act]?.(el);
  });
  root.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = new FormData(e.target).get('q')?.toString().trim(); if (!q) return;
    try {
      const r = await (await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`)).json();
      if (!r[0]) return toast(t('noPlace'));
      map.setView([+r[0].lat, +r[0].lon], 18);
    } catch { toast(t('noPlace')); }
  });
  root.addEventListener('input', (e) => {
    const b = e.target.dataset.bind; if (b) S[b] = e.target.value;
    if (e.target.dataset.heir != null) { S.heirs.list[+e.target.dataset.heir].name = e.target.value; drawPieces(); }
  });
  $('.mp-file').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!Array.isArray(d.lands)) throw 0;
      const ids = new Set(S.lands.map((l) => l.id));
      d.lands.filter((l) => l && Array.isArray(l.pts) && !ids.has(l.id)).forEach((l) => S.lands.push(l));
      persist(); toast(t('imported'));
    } catch { toast(t('badFile')); }
  });

  /* ---------- Public API ---------- */
  function open() { root.hidden = false; document.body.classList.add('mp-lock'); S.homeView = 'list'; setScreen('home'); }
  function close() { root.hidden = true; document.body.classList.remove('mp-lock'); }
  function setLang(l) {
    S.lang = l === 'en' ? 'en' : 'bn'; S.heirs.list = []; persist(); labelFab();
    if (S.screen === 'split') ensureHeirs(); if (map) { renderTop(); refreshShape(); }
    renderHome(); renderPanel();
  }
  labelFab(); renderHome();
  return { open, close, setLang };
}
