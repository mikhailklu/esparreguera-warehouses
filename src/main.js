import './style.css';
import {
  WAREHOUSES, TOTALS, SITE_BY_ID, WALL_HEIGHT, MEZZ_HEIGHT_DEFAULT, OUTLINE_WARN, OUTLINE_WARNED, NOTICE_ES, M, D, A,
} from './data.js';
import { t, fmt, fmtLevel, fmtPct, getLang, setLang } from './i18n.js';
import { createPlan } from './plan.js';

const FLOORS = [
  { id: 'all', key: 'floorAll' },
  { id: 'ground', key: 'floorGround' },
  { id: 'upper', key: 'floorUpper' },
];

const state = {
  selected: WAREHOUSES.some((w) => w.id === location.hash.slice(1)) ? location.hash.slice(1) : null,
  floor: 'all',
  view: 'plan',
};

const $ = (s) => document.querySelector(s);
const byId = (id) => WAREHOUSES.find((w) => w.id === id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tag = (p) => `<span class="tag t-${p}" title="${esc(t('provLong')[p])}">${p} · ${t('prov')[p]}</span>`;
// Compact marker for table cells whose value is not M (text stays readable for AT)
const miniTag = (p) => (p === M ? '' : ` <span class="tag mini t-${p}" title="${esc(t('provLong')[p])}">${p}<span class="sr-only"> · ${t('prov')[p]}</span></span>`);

function select(id) {
  state.selected = state.selected === id ? null : id;
  history.replaceState(null, '', state.selected ? `#${state.selected}` : location.pathname + location.search);
  render();
}

// ---- Static (language-dependent) chrome ------------------------------------
const list = $('#unit-list');
const floorSeg = $('#floor-seg');
const legend = $('#legend');

function buildChrome() {
  document.title = t('docTitle');
  for (const n of document.querySelectorAll('[data-i18n]')) n.textContent = t(n.dataset.i18n);
  floorSeg.setAttribute('aria-label', t('level'));

  // Always-visible caveats: assumed heights, outline discrepancies, derived upper areas
  $('#caveat-list').innerHTML = [
    `${tag(A)} ${esc(t('cavHeights')(fmt(WALL_HEIGHT, 0), fmt(MEZZ_HEIGHT_DEFAULT, 1)))}`,
    ...OUTLINE_WARNED.map((w) => `${tag(D)} ${esc(t('cavOutline')(w.name, fmt(w.drawnGround, 0), fmt(w.areas.ground), fmtPct(w.outlineDiff)))}`),
    `${tag(D)} ${esc(t('cavUpper'))}`,
  ].map((s) => `<li>${s}</li>`).join('');
  $('#notice3d-heights').textContent = t('notice3dHeights')(fmt(WALL_HEIGHT, 0), fmt(MEZZ_HEIGHT_DEFAULT, 1));

  list.replaceChildren();
  for (const w of WAREHOUSES) {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" data-id="${w.id}">
        <i class="sw" style="background:${w.color}"></i>
        <span class="nm">${w.name}</span>
        <span class="ar">${fmt(w.areas.total)} m²</span>
      </button>`;
    li.firstElementChild.addEventListener('click', () => select(w.id));
    list.appendChild(li);
  }

  floorSeg.replaceChildren();
  for (const f of FLOORS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.floor = f.id;
    b.textContent = t(f.key);
    b.addEventListener('click', () => { state.floor = f.id; render(); });
    floorSeg.appendChild(b);
  }

  const max = Math.max(...WAREHOUSES.map((w) => w.areas.total));
  legend.innerHTML = `
    <div class="table-scroll">
    <table>
      <thead><tr><th></th><th></th><th class="num">${t('colGround')}</th><th class="num">${t('colUpper')}</th><th class="num">${t('colTotal')}</th></tr></thead>
      <tbody>
        ${WAREHOUSES.map((w) => `
          <tr data-id="${w.id}">
            <th scope="row"><i class="sw" style="background:${w.color}"></i>${w.name}</th>
            <td class="bar"><span style="width:${(w.areas.total / max) * 100}%;background:${w.color}"></span></td>
            <td class="num">${fmt(w.areas.ground)}${miniTag(w.areasProv.ground)}</td>
            <td class="num">${fmt(w.areas.upper)}${miniTag(w.areasProv.upper)}</td>
            <td class="num"><strong>${fmt(w.areas.total)}</strong>${miniTag(w.areasProv.total)}</td>
          </tr>`).join('')}
      </tbody>
      <tfoot>
        <tr><th scope="row">${t('total')}${miniTag(D)}</th><td></td><td class="num">${fmt(TOTALS.ground)}</td><td class="num">${fmt(TOTALS.upper)}</td><td class="num">${fmt(TOTALS.total)}</td></tr>
      </tfoot>
    </table>
    </div>
    <p class="note">${t('sumsD')}</p>
    <ul class="key">
      <li>${tag(M)}<span>${t('provLong')[M]}</span></li>
      <li>${tag(D)}<span>${t('provLong')[D]}</span></li>
      <li>${tag(A)}<span>${t('provLong')[A]}</span></li>
      <li><i class="sw solid"></i><span>${t('keyOutline')}</span></li>
      <li><i class="sw hatch"></i><span>${t('keyMezz')}</span></li>
      <li><i class="sw step"></i><span>${t('keyStep')}</span></li>
    </ul>
    <p class="note">${t('noteAreas')}</p>
    <p class="note">${t('noteSep')}</p>
    <p class="note notice-es" lang="es">${NOTICE_ES}</p>`;
  for (const tr of legend.querySelectorAll('tbody tr')) {
    tr.addEventListener('click', () => select(tr.dataset.id));
  }

  for (const b of document.querySelectorAll('#lang-seg button')) {
    b.setAttribute('aria-pressed', String(b.dataset.lang === getLang()));
  }
}

for (const b of document.querySelectorAll('#lang-seg button')) {
  b.addEventListener('click', () => {
    setLang(b.dataset.lang);
    buildChrome();
    plan.rebuild();
    if (scene) scene.relabel();
    render();
  });
}

// ---- Details ---------------------------------------------------------------
function renderDetails() {
  const d = $('#details');
  const w = byId(state.selected);
  const floorLabel = t(FLOORS.find((f) => f.id === state.floor).key);
  if (!w) {
    d.innerHTML = `<h2>${t('details')}</h2>
      <p class="muted">${t('pickHint')}</p>
      <dl><dt>${t('nUnits')}</dt><dd>${WAREHOUSES.length}</dd>
      <dt>${t('combined')}</dt><dd>${fmt(TOTALS.total)} m² ${tag(D)}</dd>
      <dt>${t('showing')}</dt><dd>${floorLabel}</dd></dl>`;
    return;
  }
  const site = SITE_BY_ID[w.site];
  const pct = (a, b) => fmtPct((a - b) / b);
  const P = w.areasProv;
  const warnOutline = Math.abs(w.outlineDiff) >= OUTLINE_WARN
    ? `<br><strong class="warn-inline">⚠ ${esc(t('outlineWarnDetail'))}</strong>` : '';
  const upperLevel = w.mezzLevel
    ? `${fmtLevel(w.mezzLevel.v)} ${tag(M)}<br><span class="muted">${t('upperAbove')(w.mezzAbove.toFixed(2), t('prov')[D])}</span>`
    : `${t('levelNone')} ${tag(A)}<br><span class="muted">${t('upperAbove')(w.mezzAbove.toFixed(1), t('prov')[A])}</span>`;
  const facts = w.facts.map(([k, v, p, n]) => `
      <dt>${t(k)}</dt><dd>${esc(v)} ${tag(p)}${n ? `<br><span class="muted">${esc(t(n))}</span>` : ''}</dd>`).join('');

  d.innerHTML = `<h2><i class="sw" style="background:${w.color}"></i>${w.name}</h2>
    <dl>
      <dt>${t('sheet')}</dt><dd>${t(site.titleKey)}</dd>
      <dt>${t('groundArea')}</dt><dd><strong>${fmt(w.areas.ground)} m²</strong> ${tag(P.ground)}</dd>
      <dt>${t('upperArea')}</dt><dd><strong>${fmt(w.areas.upper)} m²</strong> ${tag(P.upper)}${P.upper === D ? `<br><span class="muted">${esc(t('nUpperSub'))}</span>` : ''}</dd>
      <dt>${t('totalArea')}</dt><dd><strong>${fmt(w.areas.total)} m²</strong> ${tag(P.total)}</dd>
      <dt>${t('drawnCheck')}</dt><dd>${t('drawnCheckVal')(fmt(w.drawnGround, 0), fmt(w.areas.ground), pct(w.drawnGround, w.areas.ground))} ${tag(D)}${warnOutline}<br>
        <span class="muted">${t('drawnCheckVal')(fmt(w.drawnUpper, 0), fmt(w.areas.upper), pct(w.drawnUpper, w.areas.upper))}</span></dd>
      <dt>${t('groundLevel')}</dt><dd>${w.level ? `${fmtLevel(w.level.v)} ${tag(M)}` : `${t('levelNone')}`}</dd>
      <dt>${t('upperLevel')}</dt><dd>${upperLevel}</dd>
      <dt>${t('mezzZone')}</dt><dd>${t(w.mezzKey)} ${tag(D)}</dd>
      <dt>${t('height')}</dt><dd>${t('heightVal')(WALL_HEIGHT)} ${tag(A)}</dd>
    </dl>
    <h3>${t('dims')}</h3>
    <dl>${facts}</dl>
    <p class="src"><span class="muted">${t('source')}:</span> ${esc(site.source)}</p>`;
}

// ---- Views -----------------------------------------------------------------
setLang(getLang());
buildChrome();
const plan = createPlan($('#plan-view'), { onSelect: select });
let scene = null; // lazily created on first 3D view

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
  else { state.selected = null; state.floor = 'all'; history.replaceState(null, '', location.pathname + location.search); render(); }
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
