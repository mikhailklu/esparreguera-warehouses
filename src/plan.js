import { WAREHOUSES, MEZZ_FRACTION, LEVEL_STEP, NOTICE_ES, fmt, shortLevel } from './data.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
};

/**
 * Schematic SVG plan. Responsive via viewBox. SVG units are arbitrary model
 * units (NOT metres): every unit is the same-sized tile, not a measured footprint.
 */
export function createPlan(container, { onSelect }) {
  const pad = 8;
  const minX = Math.min(...WAREHOUSES.map((w) => w.x)) - pad;
  const minZ = Math.min(...WAREHOUSES.map((w) => w.z)) - pad - 6;
  const maxX = Math.max(...WAREHOUSES.map((w) => w.x + w.width)) + pad;
  const maxZ = Math.max(...WAREHOUSES.map((w) => w.z + w.depth)) + pad + 12;

  const svg = el('svg', {
    viewBox: `${minX} ${minZ} ${maxX - minX} ${maxZ - minZ}`,
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'aria-label': `Schematic diagram of warehouse units, not to scale. ${NOTICE_ES}`,
    class: 'plan-svg',
  });

  const defs = el('defs', {}, svg);
  const hatch = el('pattern', { id: 'mezz-hatch', width: 2, height: 2, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  el('rect', { width: 2, height: 2, fill: 'rgba(255,255,255,0.35)' }, hatch);
  el('line', { x1: 0, y1: 0, x2: 0, y2: 2, stroke: '#1d2733', 'stroke-width': 0.6, 'stroke-opacity': 0.55 }, hatch);

  // Group captions
  const row = WAREHOUSES.filter((w) => w.group === 'row');
  const apart = WAREHOUSES.filter((w) => w.group === 'apart');
  const caption = (text, x, y) => {
    const t = el('text', { x, y, class: 'plan-caption' }, svg);
    t.textContent = text;
  };
  caption('NAU 1–6 · schematic arrangement, equal tiles, not to scale', row[0].x, row[0].z - 3);
  caption('Drawn separately — real relative position not represented', apart[0].x, apart[0].z - 3);

  const units = new Map();
  for (const w of WAREHOUSES) {
    const g = el('g', {
      class: 'unit',
      tabindex: 0,
      role: 'button',
      'aria-label': `${w.name}, gross total ${fmt(w.gross)} square metres, may include upper floors`,
      'data-id': w.id,
    }, svg);
    const ground = el('rect', { x: w.x, y: w.z, width: w.width, height: w.depth, fill: w.color, class: 'ground' }, g);
    const mezz = el('rect', {
      x: w.x, y: w.z, width: w.width, height: w.depth * MEZZ_FRACTION,
      fill: 'url(#mezz-hatch)', class: 'mezz',
    }, g);
    const mezzTint = el('rect', {
      x: w.x, y: w.z, width: w.width, height: w.depth * MEZZ_FRACTION,
      fill: w.color, class: 'mezz-tint',
    }, g);
    g.insertBefore(mezzTint, mezz);

    const cx = w.x + w.width / 2;
    const cy = w.z + w.depth * 0.62;
    const name = el('text', { x: cx, y: cy, class: 'plan-name' }, g);
    name.textContent = w.name;
    const area = el('text', { x: cx, y: cy + 3.6, class: 'plan-area' }, g);
    area.textContent = `${fmt(w.gross)} m²`;
    const grossNote = el('text', { x: cx, y: cy + 6.2, class: 'plan-level' }, g);
    grossNote.textContent = 'gross total, all floors';
    const lvl = el('text', { x: cx, y: cy + 8.8, class: 'plan-level' }, g);
    lvl.textContent = shortLevel(w);

    const sel = () => onSelect(w.id);
    g.addEventListener('click', sel);
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sel(); }
    });
    units.set(w.id, { g, ground, mezz, mezzTint });
  }

  // Level step annotation between NAU 3 and NAU 4
  const n3 = WAREHOUSES.find((w) => w.id === 'nau3');
  const n4 = WAREHOUSES.find((w) => w.id === 'nau4');
  const sx = (n3.x + n3.width + n4.x) / 2;
  const sy = n3.z + n3.depth;
  el('line', { x1: sx, y1: n3.z - 1, x2: sx, y2: sy + 4, class: 'step-line' }, svg);
  const st = el('text', { x: sx, y: sy + 7, class: 'step-text' }, svg);
  st.textContent = `≈ ${LEVEL_STEP.toFixed(2)} m level step (direction assumed)`;

  // No scale bar: the drawing is not to scale and not metric.
  const nb = el('text', { x: minX + 4, y: maxZ - 5, class: 'plan-notice', lang: 'es' }, svg);
  nb.textContent = NOTICE_ES;
  const nt = el('text', { x: minX + 4, y: maxZ - 2.4, class: 'plan-scale' }, svg);
  nt.textContent = 'Not to scale · tile size does not represent area · positions & orientation not represented · mezzanines unconfirmed';

  container.appendChild(svg);

  return {
    update({ selected, floor }) {
      svg.dataset.floor = floor;
      for (const [id, u] of units) {
        const on = id === selected;
        u.g.classList.toggle('selected', on);
        u.g.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    },
  };
}
