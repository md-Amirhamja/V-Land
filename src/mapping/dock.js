// Docks the Mapping button directly above the map-controls panel (found via its "+" button).
const SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6.5v13L9 17l6 3 6-2.5v-13L15 7z"/><path d="M9 4v13M15 7v13"/></svg>';

function findPanel() {
  const plus = [...document.querySelectorAll('button')].find(
    (b) => !b.closest('.mp-root') && !b.classList.contains('mp-fab') && b.textContent.trim() === '+'
  );
  if (!plus) return null;
  let p = plus.parentElement;
  while (p && p !== document.body && p.querySelectorAll('button').length < 10) p = p.parentElement;
  return p && p !== document.body ? p : null;
}

function place() {
  const fab = document.querySelector('.mp-fab');
  if (!fab) return;
  const set = (k, v) => fab.style.setProperty(k, v, 'important');

  // swap the emoji for the SVG icon (keeps the translated label)
  if (!fab.querySelector('svg')) {
    const label = fab.textContent.replace('🗺️', '').trim();
    fab.innerHTML = '<span>' + SVG + '</span> ' + label;
  }

  const panel = findPanel();
  const r = panel && panel.getBoundingClientRect();
  if (r && r.width > 0) {
    const s = Math.max(60, Math.round(r.width));
    set('width', s + 'px'); set('height', s + 'px');
    set('left', Math.round(r.left) + 'px'); set('right', 'auto');
    set('top', Math.max(8, Math.round(r.top - s - 10)) + 'px'); set('bottom', 'auto');
  } else {
    set('width', '74px'); set('height', '74px');
    set('right', '12px'); set('left', 'auto'); set('top', '110px');
  }
}
setInterval(place, 300);
window.addEventListener('resize', place);
place();
