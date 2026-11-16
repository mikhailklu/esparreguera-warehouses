import './style.css';
import { WAREHOUSES, GROSS_TOTAL, FLOORS, NOTICE_ES, MEZZ_STATUS, fmt, levelText } from './data.js';
import { createPlan } from './plan.js';

const state = {
  selected: WAREHOUSES.some((w) => w.id === location.hash.slice(1)) ? location.hash.slice(1) : null,
  floor: 'all',
  view: 'plan',
};

const $ = (s) => document.querySelector(s);
const byId = (id) => WAREHOUSES.find((w) => w.id === id);

function select(id) {
  state.selected = state.selected === id ? null : id;
  history.replaceState(null, '', state.selected ? `#${state.selected}` : location.pathname + location.search);
  render();
}

// ---- Unit list -------------------------------------------------------------
const list = $('#unit-list');
for (const w of WAREHOUSES) {
  const li = document.createElement('li');
  li.innerHTML = `<button type="button" data-id="${w.id}">
      <i class="sw" style="background:${w.color}"></i>
      <span class="nm">${w.name}</span>
      <span class="ar">${fmt(w.gross)} m²</span>
    </button>`;
  li.firstElementChild.addEventListener('click', () => select(w.id));
  list.appendChild(li);
}

// ---- Floor selector --------------------------------------------------------
const floorSeg = $('#floor-seg');
for (const f of FLOORS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.floor = f.id;
  b.textContent = f.label;
  b.addEventListener('click', () => { state.floor = f.id; render(); });
  floorSeg.appendChild(b);
}

// ---- Legend ----------------------------------------------------------------
const legend = $('#legend');
const max = Math.max(...WAREHOUSES.map((w) => w.gross));
legend.innerHTML = `
  <table>
    <tbody>
      ${WAREHOUSES.map((w) => `
        <tr data-id="${w.id}">
          <th scope="row"><i class="sw" style="background:${w.color}"></i>${w.name}</th>
          <td class="bar"><span style="width:${(w.gross / max) * 100}%;background:${w.color}"></span></td>
          <td class="num">${fmt(w.gross)}</td>
          <td class="pct">${((w.gross / GROSS_TOTAL) * 100).toFixed(1)}%</td>
        </tr>`).join('')}
    </tbody>
    <tfoot>
      <tr><th scope="row">Total</th><td></td><td class="num">${fmt(GROSS_TOTAL)}</td><td class="pct">100%</td></tr>
    </tfoot>
  </table>
  <ul class="key">
    <li><i class="sw solid"></i>Unit tile — equal-sized placeholder, not a measured footprint; size does not represent area</li>
    <li><i class="sw hatch"></i>Mezzanine — indicative placeholder; presence, extent and per-floor areas unconfirmed for every unit</li>
    <li><i class="sw step"></i>≈ 1.25 m ground-floor level difference, NAU 3 vs NAU 4–6 (direction assumed)</li>
  </ul>
  <p class="note">Gross totals are the supplied reference values. They are <strong>total</strong> areas that may include upper floors or mezzanines — they are <strong>not</strong> footprints and <strong>not</strong> ground-floor areas. The split between floors is not known and is not shown.</p>
  <p class="note notice-es" lang="es">${NOTICE_ES}</p>`;
for (const tr of legend.querySelectorAll('tbody tr')) {
  tr.addEventListener('click', () => select(tr.dataset.id));
}

// ---- Details ---------------------------------------------------------------
function renderDetails() {
  const d = $('#details');
  const w = byId(state.selected);
  const floorLabel = FLOORS.find((f) => f.id === state.floor).label;
  if (!w) {
    d.innerHTML = `<h2>Selection</h2>
      <p class="muted">Select a unit from the list, plan or 3D view.</p>
      <dl><dt>Units</dt><dd>${WAREHOUSES.length}</dd>
      <dt>Combined gross</dt><dd>${fmt(GROSS_TOTAL)} m²</dd>
      <dt>Showing</dt><dd>${floorLabel}</dd></dl>`;
    return;
  }
  const levelArea = state.floor === 'all'
    ? `${fmt(w.gross)} m² gross total (may include upper floors)`
    : 'Not known — only the gross total is known';
  d.innerHTML = `<h2><i class="sw" style="background:${w.color}"></i>${w.name}</h2>
    <dl>
      <dt>Gross total</dt><dd><strong>${fmt(w.gross)} m²</strong><br><span class="muted">All floors; not a footprint or ground-floor area</span></dd>
      <dt>Share of portfolio</dt><dd>${((w.gross / GROSS_TOTAL) * 100).toFixed(1)}%</dd>
      <dt>${floorLabel} area</dt><dd>${levelArea}</dd>
      <dt>Ground-floor level</dt><dd>${levelText(w)}</dd>
      <dt>Mezzanine</dt><dd>${MEZZ_STATUS}</dd>
      <dt>Footprint</dt><dd>Not known — drawn as an equal-sized placeholder tile</dd>
      <dt>Heights</dt><dd>Unknown — drawn schematically</dd>
    </dl>`;
}

// ---- Views -----------------------------------------------------------------
const plan = createPlan($('#plan-view'), { onSelect: select });
let scene = null; // lazily created on first 3D view to keep initial load light

async function ensureScene() {
  if (scene) return scene;
  const { createScene } = await import('./scene3d.js');
  scene = createScene($('#three-view'), { onSelect: select });
  return scene;
}

async function setView(v) {
  state.view = v;
  $('#plan-view').hidden = v !== 'plan';
  $('#three-view').hidden = v !== '3d';
  for (const b of document.querySelectorAll('#view-seg button')) {
    b.setAttribute('aria-pressed', String(b.dataset.view === v));
  }
  if (v === '3d') {
    const s = await ensureScene();
    s.setActive(true);
    s.update(state);
  } else if (scene) {
    scene.setActive(false);
  }
}

for (const b of document.querySelectorAll('#view-seg button')) {
  b.addEventListener('click', () => setView(b.dataset.view));
}
$('#reset').addEventListener('click', () => {
  if (state.view === '3d' && scene) scene.resetView();
  else { state.selected = null; state.floor = 'all'; render(); }
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.selected) select(state.selected);
});

// ---- Render ----------------------------------------------------------------
function render() {
  for (const b of list.querySelectorAll('button')) {
    b.setAttribute('aria-pressed', String(b.dataset.id === state.selected));
  }
  for (const b of floorSeg.querySelectorAll('button')) {
    b.setAttribute('aria-pressed', String(b.dataset.floor === state.floor));
  }
  for (const tr of legend.querySelectorAll('tbody tr')) {
    tr.classList.toggle('selected', tr.dataset.id === state.selected);
  }
  renderDetails();
  plan.update(state);
  if (scene) scene.update(state);
}

render();
setView('plan');
