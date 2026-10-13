// Blood pumped through the BORDERS of every division / district / area.
// Every 3 seconds a pump pushes a pulse of blood from the top (north) of the map to the bottom (south).
import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

const CYCLE = 3.0;        // seconds between pumps
const TRAVEL = 1.8;       // seconds the pulse takes to run from top to bottom
const U = { uTime: { value: 0 }, uOn: { value: 1 }, uZ0: { value: 0 }, uZ1: { value: 1 } };
const RES = new THREE.Vector2(innerWidth, innerHeight);
const BASE_W = { 1: 7, 2: 5, 3: 3 };                 // border thickness in pixels per level
const LW = { 1: { value: BASE_W[1] }, 2: { value: BASE_W[2] }, 3: { value: BASE_W[3] } };

let enabled = true;
try { enabled = localStorage.getItem('blood2') !== '0'; } catch (e) {}
let last = 0, lastShown = null;

const FRAG_DECL = `varying float vWz;
uniform float uTime, uOn, uZ0, uZ1;
`;
const FLOW = `
  {
    float v = clamp((vWz - uZ0) / max(uZ1 - uZ0, 0.000001), 0.0, 1.0);     // 0 = top (north), 1 = bottom (south)
    float s = mod(uTime, ${CYCLE.toFixed(1)});
    float f = s / ${TRAVEL.toFixed(1)} * 1.35 - 0.05;                        // front of the pulse, starts above the map
    float lead = 1.0 - smoothstep(f - 0.05, f, v);                           // nothing below the front yet
    float trail = exp(-max(f - v, 0.0) / 0.22);                              // fades behind the front
    float blood = lead * trail;
    vec3 red = mix(vec3(0.60, 0.0, 0.03), vec3(1.0, 0.12, 0.10), blood);
    red += vec3(0.5, 0.2, 0.1) * pow(blood, 6.0);                            // glossy hot head of the pulse
    diffuseColor.rgb = red;
    alpha *= clamp(blood * 1.4, 0.0, 1.0) * uOn;                             // invisible between pumps
  }
`;

function patchLine(material) {
  material.onBeforeCompile = (shader) => {
    if (!/diffuseColor/.test(shader.fragmentShader) || !/gl_FragColor\s*=\s*vec4\(\s*diffuseColor\.rgb\s*,\s*alpha\s*\)\s*;/.test(shader.fragmentShader)) { material.visible = false; return; }   // unknown layout: no blood overlay
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader.replace(/void\s+main\s*\(\s*\)\s*\{/,
      'varying float vWz;\nvoid main() {\n  vWz = (modelMatrix * vec4(position.y < 0.5 ? instanceStart : instanceEnd, 1.0)).z;');
    shader.fragmentShader = shader.fragmentShader
      .replace(/void\s+main\s*\(\s*\)\s*\{/, FRAG_DECL + 'void main() {')
      .replace(/gl_FragColor\s*=\s*vec4\(\s*diffuseColor\.rgb\s*,\s*alpha\s*\)\s*;/, FLOW + '  gl_FragColor = vec4( diffuseColor.rgb, alpha );');
  };
  material.customProgramCacheKey = () => 'bloodpump';
}

// thick border line for one map piece (only the top outline, so the side walls stay clean)
function makeFatLine(geometry, level) {
  const e = new THREE.EdgesGeometry(geometry, 25);
  const pos = e.attributes.position.array;
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const cut = bb.max.y - (bb.max.y - bb.min.y) * 0.2;
  const keep = [];
  for (let i = 0; i + 5 < pos.length; i += 6) if (pos[i + 1] >= cut && pos[i + 4] >= cut) for (let k = 0; k < 6; k++) keep.push(pos[i + k]);
  const g = new LineSegmentsGeometry();
  g.setPositions(keep.length ? keep : Array.from(pos));
  e.dispose();
  const m = new LineMaterial({ color: 0xc4101c, linewidth: BASE_W[level] || 3.5, transparent: true, opacity: 1, depthWrite: false, worldUnits: false });
  m.uniforms.resolution.value = RES;
  m.uniforms.linewidth = LW[level] || LW[3];
  m.polygonOffset = true; m.polygonOffsetFactor = -4; m.polygonOffsetUnits = -4;
  patchLine(m);
  const line = new LineSegments2(g, m);
  line.frustumCulled = false;
  line.renderOrder = 5;
  return line;
}

// normal thin white border (as before) with the blood overlay riding on top of it
export function makeLine(geometry, level) {
  const base = level === 1 ? 0.35 : 0.85;
  const thin = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25),
    new THREE.LineBasicMaterial({ color: 0xf4fff7, transparent: true, opacity: base }));
  thin.userData.baseOpacity = base;
  try {
    const fat = makeFatLine(geometry, level);
    thin.add(fat);
    let o = base;                                   // keep the blood overlay fading together with the border
    Object.defineProperty(thin.material, 'opacity', { configurable: true, get: () => o, set: (v) => { o = v; fat.material.opacity = Math.min(1, v / base); } });
  } catch (err) {
    console.error('Blood line failed:', err);
    const box = document.getElementById('msg');
    if (box && !window.__bloodErr) { window.__bloodErr = 1; box.textContent = 'Blood effect error: ' + err.message; box.style.display = 'block'; }
  }
  return thin;
}

export const mesh = () => {};       // faces keep their normal colours
export const setMap = () => {};

(function buildToggle() {
  const st = document.createElement('style');
  st.textContent = `#bloodtoggle{position:fixed;top:14px;right:178px;z-index:20;border-radius:999px;padding:7px 14px;cursor:pointer;
    font:600 13px system-ui,sans-serif;color:#fff;background:rgba(10,30,22,.78);border:1px solid rgba(255,255,255,.25);backdrop-filter:blur(6px)}
    #bloodtoggle.on{background:#b3121f;border-color:#ff6b73}`;
  document.head.appendChild(st);
  const b = document.createElement('button'); b.id = 'bloodtoggle';
  const paint = () => { b.textContent = '\u2764 Blood ' + (enabled ? 'ON' : 'OFF'); b.classList.toggle('on', enabled); };
  b.onclick = () => { enabled = !enabled; paint(); try { localStorage.setItem('blood2', enabled ? '1' : '0'); } catch (e) {} };
  paint(); document.body.appendChild(b);
})();

function fitBounds(shown) {                     // top / bottom of whatever is on screen now
  const b = new THREE.Box3();
  shown.forEach((m) => b.expandByObject(m));
  if (b.isEmpty()) return;
  U.uZ0.value = b.min.z; U.uZ1.value = b.max.z;
}

export function update(t, lvl, shown) {
  const dt = Math.min(0.1, t - last); last = t;
  RES.set(innerWidth, innerHeight);
  U.uTime.value = t;
  if (shown && shown.length && shown !== lastShown) { lastShown = shown; fitBounds(shown); }
  U.uOn.value += ((enabled ? 1 : 0) - U.uOn.value) * Math.min(1, dt * 5);
  const s = t % CYCLE;                                                        // the pump squeezes (lub-dub) at the start of each cycle
  const squeeze = Math.exp(-Math.pow(s / 0.15, 2)) + 0.6 * Math.exp(-Math.pow((s - 0.30) / 0.10, 2));
  const w = (0.45 + 0.55 * U.uOn.value) * (1 + 0.3 * squeeze * U.uOn.value);
  for (const k of [1, 2, 3]) LW[k].value = BASE_W[k] * w;
}
