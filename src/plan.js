import { WAREHOUSES, SITES, DIMS, NOTICE_ES, OUTLINE_WARN, siteBox } from './data.js';
import { t, fmt, fmtLevel, fmtPct } from './i18n.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
};
const pts = (poly) => poly.map(([x, y]) => `${x},${y}`).join(' ');

function centroid(poly) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    const f = x1 * y2 - x2 * y1;
    a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f;
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/**
 * 2D plan in metres (1 SVG unit = 1 m). Each source drawing is a separate
 * framed sheet; gaps between sheets are arbitrary.
 */
export function createPlan(container, { onSelect }) {
  let svg;
  const units = new Map();
  let last = null;

  function build() {
    units.clear();
    container.replaceChildren();
    const boxes = SITES.map((s) => ({ s, b: siteBox(s.id) }));
    const minX = Math.min(...boxes.map((x) => x.b.x0)) - 2;
    const minY = Math.min(...boxes.map((x) => x.b.y0)) - 2;
    const maxX = Math.max(...boxes.map((x) => x.b.x1)) + 2;
    const maxY = Math.max(...boxes.map((x) => x.b.y1)) + 10;

    svg = el('svg', {
      viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img',
      'aria-label': `${t('siteA')}; ${t('siteB')}; ${t('siteC')}. ${t('noteSep')}`,
      class: 'plan-svg',
    });

    const defs = el('defs', {}, svg);
    const hatch = el('pattern', { id: 'mezz-hatch', width: 1.6, height: 1.6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    el('line', { x1: 0, y1: 0, x2: 0, y2: 1.6, stroke: '#1d2733', 'stroke-width': 0.35, 'stroke-opacity': 0.6 }, hatch);

    // Sheet frames
    for (const { s, b } of boxes) {
      el('rect', { x: b.x0, y: b.y0, width: b.x1 - b.x0, height: b.y1 - b.y0, class: `sheet sheet-${s.id}` }, svg);
      const title = el('text', { x: b.x0 + 1.2, y: b.y0 + 2.6, class: 'sheet-title' }, svg);
      title.textContent = t(s.titleKey);
      if (s.id !== 'A') {
        const c = el('text', { x: b.x0 + 1.2, y: b.y0 + 4.6, class: 'plan-caption' }, svg);
        c.textContent = t('sepCaption');
      }
    }

    // Units
    for (const w of WAREHOUSES) {
      const warn = Math.abs(w.outlineDiff) >= OUTLINE_WARN ? t('outlineWarnPlan')(fmtPct(w.outlineDiff)) : null;
      const g = el('g', {
        class: 'unit', tabindex: 0, role: 'button', 'data-id': w.id,
        'aria-label': `${w.name}: ${t('totalArea')} ${fmt(w.areas.total)} m²${warn ? `. ${warn}` : ''}`,
      }, svg);
      const ground = el('polygon', { points: pts(w.outline), fill: w.color, class: 'ground' }, g);
      for (const m of w.mezz) {
        el('polygon', { points: pts(m), fill: w.color, class: 'mezz-tint' }, g);
        el('polygon', { points: pts(m), fill: 'url(#mezz-hatch)', class: 'mezz' }, g);
      }
      const [cx, cy0] = centroid(w.outline);
      const small = w.bbox.y1 - w.bbox.y0 < 16;
      const cy = small ? cy0 - 2.2 : cy0;
      const line = (cls, txt, dy) => {
        const n = el('text', { x: cx, y: cy + dy, class: cls }, g);
        n.textContent = txt;
      };
      line('plan-name', w.name, 0);
      line('plan-area', `Σ ${fmt(w.areas.total)} m²`, 2.6);
      line('plan-level', `${fmt(w.areas.ground)} + ${fmt(w.areas.upper)}`, 4.5);
      line('plan-level', w.level ? `±0 = ${fmtLevel(w.level.v)}` : `${t('groundLevel')}: —`, 6.3);
      if (warn) line('plan-warn', warn, 8.3);

      const sel = () => onSelect(w.id);
      g.addEventListener('click', sel);
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sel(); }
      });
      units.set(w.id, { g, ground });
    }

    // Dimensions (measured = solid dark, derived = blue dashed with ≈)
    for (const d of DIMS) {
      const [x1, y1] = d.a; const [x2, y2] = d.b;
      const len = Math.hypot(x2 - x1, y2 - y1);
      const nx = -(y2 - y1) / len * d.off; const ny = (x2 - x1) / len * d.off;
      const cls = `dim dim-${d.p}`;
      el('line', { x1: x1 + nx, y1: y1 + ny, x2: x2 + nx, y2: y2 + ny, class: cls }, svg);
      for (const [px, py] of [[x1, y1], [x2, y2]]) {
        el('line', { x1: px + nx * 0.6, y1: py + ny * 0.6, x2: px + nx * 1.25, y2: py + ny * 1.25, class: cls }, svg);
      }
      let ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
      if (ang > 90) ang -= 180;
      if (ang < -90) ang += 180;
      const mx = (x1 + x2) / 2 + nx * 1.35; const my = (y1 + y2) / 2 + ny * 1.35;
      const tx = el('text', { x: mx, y: my, class: `dim-text dim-${d.p}`, transform: `rotate(${ang} ${mx} ${my})` }, svg);
      tx.textContent = d.text;
    }

    // Level step between NAU 1–3 (+221.65) and NAU 4–6 (+220.40), along x = 47.5
    el('line', { x1: 47.5, y1: 0, x2: 47.5, y2: 43.74, class: 'step-line' }, svg);
    const st = el('text', { x: 47.5, y: 47.6, class: 'step-text' }, svg);
    st.textContent = `NAU 4–6: ${t('step')}`;

    // Scale bar (10 m) and notes
    const sx = minX + 3; const sy = maxY - 6.5;
    el('rect', { x: sx, y: sy, width: 5, height: 0.8, class: 'scale-a' }, svg);
    el('rect', { x: sx + 5, y: sy, width: 5, height: 0.8, class: 'scale-b' }, svg);
    const sc = el('text', { x: sx + 11.5, y: sy + 0.9, class: 'plan-scale' }, svg);
    sc.textContent = t('scaleNote');
    const nb = el('text', { x: minX + 3, y: maxY - 2.6, class: 'plan-notice', lang: 'es' }, svg);
    nb.textContent = NOTICE_ES;

    container.appendChild(svg);
    if (last) update(last);
  }

  function update(state) {
    last = state;
    svg.dataset.floor = state.floor;
    for (const [id, u] of units) {
      const on = id === state.selected;
      u.g.classList.toggle('selected', on);
      u.g.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  build();
  return { update, rebuild: build };
}
