// V-Land portal bridge - plain JS, no framework. Adds "Verify a Plot" + "Sign in" to the 3D map
// and the area sheet that main.js calls when an area is tapped. Reads the same `lang` key as the map.
import './portal-bridge.css';

const T = {
  bn: { verify: 'প্লট যাচাই করুন', signin: 'লগইন', citizen: 'নাগরিক', citizenSub: 'কেনার আগে যাচাই', admin: 'অ্যাডমিন', adminSub: 'অনুমোদিত কর্মকর্তা',
        verifyHere: 'এই এলাকার প্লট যাচাই করুন', sat: 'স্যাটেলাইট মানচিত্র খুলুন', close: 'বন্ধ করুন', area: 'এলাকা' },
  en: { verify: 'Verify a Plot', signin: 'Sign in', citizen: 'Citizen', citizenSub: 'Check before you buy', admin: 'Admin', adminSub: 'Authorised staff',
        verifyHere: 'Verify plots here', sat: 'Open satellite map', close: 'Close', area: 'Area' },
};
const ICON = {
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6.5v13L9 17l6 3 6-2.5v-13L15 7z"/><path d="M9 4v13M15 7v13"/></svg>',
};
const getLang = () => { try { return localStorage.getItem('lang') === 'en' ? 'en' : 'bn'; } catch (e) { return 'bn'; } };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let current = null;   // { key, label, crumbs, open }

function build() {
  const top = document.getElementById('top');
  if (!top || document.getElementById('vl-actions')) return;
  const box = document.createElement('div'); box.id = 'vl-actions';
  box.innerHTML =
    `<a class="vl-btn primary" id="vl-verify" href="/portal/verify">${ICON.shield}<span class="vl-label" data-k="verify"></span></a>` +
    `<div id="vl-signin"><button class="vl-btn" id="vl-signbtn" aria-haspopup="true" aria-expanded="false">${ICON.user}<span class="vl-label" data-k="signin"></span></button>` +
    `<div id="vl-menu" role="menu"><a role="menuitem" href="/portal/login"><b data-k="citizen"></b><small data-k="citizenSub"></small></a>` +
    `<a role="menuitem" href="/admin/login"><b data-k="admin"></b><small data-k="adminSub"></small></a></div></div>`;
  top.appendChild(box);

  const sheet = document.createElement('div'); sheet.id = 'vl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-live', 'polite');
  document.body.appendChild(sheet);

  const btn = box.querySelector('#vl-signbtn'), menu = box.querySelector('#vl-menu');
  const setMenu = (o) => { menu.classList.toggle('open', o); btn.setAttribute('aria-expanded', String(o)); };
  btn.addEventListener('click', (e) => { e.stopPropagation(); setMenu(!menu.classList.contains('open')); });
  document.addEventListener('click', (e) => { if (!e.target.closest('#vl-signin')) setMenu(false); });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (sheet.classList.contains('open')) { e.stopImmediatePropagation(); e.preventDefault(); closeSheet(); }
    else if (menu.classList.contains('open')) { setMenu(false); btn.focus(); }
  }, true);   // capture: so Escape closes the sheet instead of also stepping the 3D map back

  paint();
}

function paint() {
  const t = T[getLang()];
  document.querySelectorAll('#vl-actions [data-k]').forEach((el) => { el.textContent = t[el.dataset.k]; });
  const v = document.getElementById('vl-verify'); if (v) v.setAttribute('aria-label', t.verify);
  const s = document.getElementById('vl-signbtn'); if (s) s.setAttribute('aria-label', t.signin);
  if (current) renderSheet();
}

function renderSheet() {
  const t = T[getLang()], sh = document.getElementById('vl-sheet');
  sh.setAttribute('aria-label', current.label);
  sh.innerHTML =
    `<div class="vl-head"><div><h2>${esc(current.label)}</h2><div class="vl-sub">${esc(current.crumbs.slice(0, -1).join(' › '))}</div></div>` +
    `<button class="vl-x" aria-label="${esc(t.close)}">✕</button></div>` +
    `<div class="vl-row"><a class="vl-btn primary" id="vl-go" href="/portal/verify?area=${encodeURIComponent(current.key)}">${ICON.shield}<span>${esc(t.verifyHere)}</span></a>` +
    `<button class="vl-btn" id="vl-sat">${ICON.map}<span>${esc(t.sat)}</span></button></div>`;
  sh.querySelector('.vl-x').onclick = closeSheet;
  sh.querySelector('#vl-sat').onclick = () => { const o = current && current.open; closeSheet(); if (o) o(); };
}

function closeSheet() { current = null; const sh = document.getElementById('vl-sheet'); if (sh) sh.classList.remove('open'); }

// Called by main.js drill() when an area (level 3) is tapped.
window.__vlandAreaSheet = (info) => {
  build();
  current = info;
  renderSheet();
  const sh = document.getElementById('vl-sheet');
  requestAnimationFrame(() => { sh.classList.add('open'); const g = sh.querySelector('#vl-go'); if (g) g.focus({ preventScroll: true }); });
};

// stay in sync with the map's language switch (main.js saves `lang` before our handler runs) and other tabs
document.addEventListener('click', (e) => { if (e.target.closest('[data-l]')) setTimeout(paint, 0); });
addEventListener('storage', (e) => { if (e.key === 'lang') paint(); });

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
