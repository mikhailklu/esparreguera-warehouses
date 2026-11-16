// Sidebar panel + per-unit details for the box-capacity simulation.
import { WAREHOUSES, OUTLINE_WARN, A, D } from './data.js';
import {
  DEFAULTS, LEVELS, BOX, stackHeight, topBoxUnderside, heightStatus, computeAst, loadFigures, totals,
} from './capacity.js';
import { CAP_ES } from './i18n-capacity.js';
import { t, fmt } from './i18n.js';

const KEY = 'capParams.v1';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tag = (p) => `<span class="tag t-${p}" title="${esc(t('provLong')[p])}">${p} · ${t('prov')[p]}</span>`;
const int = (n) => fmt(n, 0);
const range = (r) => (r.lo === r.hi ? `≈ ${int(r.hi)}` : `≈ ${int(r.lo)}–${int(r.hi)}`);

export function loadParams() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved === 'object') {
      return Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, k in saved ? saved[k] : DEFAULTS[k]]));
    }
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}
export function saveParams(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

// [key, labelKey, type, min, max, step]
const FIELDS = [
  ['astMode', 'pAstMode', 'mode'],
  ['astFixed', 'pAstFixed', 'num', 1.5, 6, 0.05, 'fixed'],
  ['wa', 'pWa', 'num', 0.8, 3.5, 0.05, 'equipment'],
  ['x', 'pX', 'num', 0, 1.5, 0.05, 'equipment'],
  ['safety', 'pSafety', 'num', 0, 1, 0.05, 'equipment'],
  ['turnWidth', 'pTurn', 'num', 0, 8, 0.1],
  ['crossBothEnds', 'pBoth', 'bool'],
  ['depth', 'pDepth', 'num', 1, 6, 1],
  ['wallClear', 'pWall', 'num', 0, 3, 0.05],
  ['geomTol', 'pTol', 'num', 0, 3, 0.1],
  ['reservePct', 'pReserve', 'num', 0, 60, 1],
  ['structClear', 'pStruct', 'num', 0, 2, 0.05],
  ['siteHeight', 'pHeight', 'num', 0, 20, 0.05],
  ['heightMeasured', 'pMeasured', 'bool'],
  ['boxKg', 'pKg', 'num', 0, 5000, 1, null, true],
  ['excludeUpper', 'pExclude', 'bool'],
];

/**
 * @param root    <section> element to fill
 * @param opts    { getParams, onParams(p), onSelect(id) }
 */
export function createCapacityPanel(root, { getParams, onParams, onSelect }) {
  let results = null;
  let busy = false;
  let selected = null;

  function form(p) {
    return FIELDS.map(([k, lk, type, min, max, step, mode, optional]) => {
      if (mode && p.astMode !== mode) return '';
      const id = `cap-${k}`;
      if (type === 'mode') {
        return `<label class="cap-f" for="${id}"><span>${t(lk)} ${tag(A)}</span>
          <select id="${id}" data-k="${k}">
            <option value="fixed"${p.astMode === 'fixed' ? ' selected' : ''}>${t('pAstModeFixed')}</option>
            <option value="equipment"${p.astMode === 'equipment' ? ' selected' : ''}>${t('pAstModeEquip')}</option>
          </select></label>`;
      }
      if (type === 'bool') {
        return `<label class="cap-f cap-b" for="${id}"><input type="checkbox" id="${id}" data-k="${k}"${p[k] ? ' checked' : ''}>
          <span>${t(lk)}${k === 'excludeUpper' ? `<br><small class="muted">${t('pExcludeHint')}</small>` : ''}</span></label>`;
      }
      const v = p[k] == null ? '' : p[k];
      return `<label class="cap-f" for="${id}"><span>${t(lk)}${optional ? '' : ` ${tag(A)}`}</span>
        <input type="number" inputmode="decimal" id="${id}" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${v}"${optional ? ' placeholder="—"' : ''}></label>`;
    }).join('');
  }

  function read(el) {
    const p = { ...getParams() };
    const k = el.dataset.k;
    const f = FIELDS.find((x) => x[0] === k);
    if (f[2] === 'bool') p[k] = el.checked;
    else if (f[2] === 'mode') p[k] = el.value;
    else {
      const raw = el.value.trim();
      if (raw === '' && f[7]) p[k] = null;
      else {
        const n = Number(raw);
        if (!Number.isFinite(n)) return null;
        p[k] = Math.min(f[4], Math.max(f[3], k === 'depth' ? Math.round(n) : n));
      }
    }
    return p;
  }

  // Scenario n counts fewer full stacks than the physical floor-stack column.
  const differs = (r, n) => r.eligible[n].lo !== r.stacks.lo || r.eligible[n].hi !== r.stacks.hi;

  function resultsTable() {
    if (!results) return `<p class="muted">${t('capComputing')}</p>`;
    const tot = totals(results);
    const rows = WAREHOUSES.map((w) => {
      const r = results.get(w.id);
      const warn = Math.abs(w.outlineDiff) >= OUTLINE_WARN ? ' <span class="warn-inline" title="outline">⚠</span>' : '';
      return `<tr data-id="${w.id}" class="${w.id === selected ? 'selected' : ''}">
        <th scope="row"><i class="sw" style="background:${w.color}"></i>${w.name}${warn}</th>
        <td class="num">${range(r.stacks)}</td>
        ${LEVELS.map((n) => `<td class="num">${range(r.boxes[n])}${differs(r, n) ? '<sup>†</sup>' : ''}</td>`).join('')}</tr>`;
    }).join('');
    const notes = LEVELS.map((n) => {
      const list = WAREHOUSES.filter((w) => differs(results.get(w.id), n))
        .map((w) => `${w.name}: ${range(results.get(w.id).eligible[n])}`).join('; ');
      return list ? `<p class="note">${esc(t('capEligNote')(n, list))}</p>` : '';
    }).join('');
    return `<div class="table-scroll"><table class="cap-table${busy ? ' busy' : ''}">
      <thead><tr><th>${t('capColUnit')}</th><th class="num">${t('capColStacks')}</th>
        ${LEVELS.map((n) => `<th class="num">${t('capColBoxes')(n)}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><th scope="row">${t('capTotal')}</th><td class="num">${range(tot.stacks)}</td>
        ${LEVELS.map((n) => `<td class="num">${range(tot.boxes[n])}</td>`).join('')}</tr></tfoot>
    </table></div>${notes}`;
  }

  function heightBlock(p) {
    const rows = LEVELS.map((n) => {
      const h = heightStatus(n, p);
      return `<li><span>${esc(t('capHeightRow')(n, fmt(stackHeight(n)), fmt(h.need)))}</span>
        <strong class="cap-status s-${h.status}">${esc(t('capStatus')[h.status])}</strong></li>`;
    }).join('');
    const hyp = p.heightMeasured ? t('capHeightMeasured')(fmt(p.siteHeight)) : t('capHeightHyp')(fmt(p.siteHeight, p.siteHeight % 1 ? 2 : 0));
    return `<h3>${t('capHeightTitle')}</h3><ul class="cap-list">${rows}</ul>
      <p class="note">${esc(hyp)} ${tag(p.heightMeasured ? D : A)}</p>
      <p class="note">${esc(t('capLift')(fmt(topBoxUnderside(4)), fmt(topBoxUnderside(6))))}</p>`;
  }

  function aisleBlock(p) {
    const txt = p.astMode === 'equipment'
      ? t('capAisleEquip')(fmt(computeAst(p, BOX.W)), fmt(computeAst(p, BOX.L)))
      : t('capAisleFixed')(fmt(p.astFixed));
    return `<h3>${t('capAisleTitle')}</h3><p class="note">${esc(txt)} ${tag(A)}</p>
      <p class="note cap-ask">${esc(t('capAskManual'))}</p>`;
  }

  function warnings(p) {
    const items = [];
    const l4 = loadFigures(4, p.boxKg);
    const l6 = loadFigures(6, p.boxKg);
    items.push(l4 ? t('wWeight')(fmt(p.boxKg, 0), fmt(l4.bottomBoxKg, 0), fmt(l6.bottomBoxKg, 0), fmt(l4.footprintKPa, 1), fmt(l6.footprintKPa, 1)) : t('wWeightUnknown'));
    for (const k of ['wCompression', 'wStability', 'wSlab', 'wUpper', 'wHeight', 'wFire', 'wPallet', 'wPro']) items.push(t(k));
    return `<h3>${t('capWarnTitle')}</h3><ul class="cap-warn">${items.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`;
  }

  const dynamic = (p) => `<p class="note">${esc(t('capRangeNote')(fmt(p.geomTol), fmt(p.reservePct, 0)))}</p>
    ${heightBlock(p)}${aisleBlock(p)}${warnings(p)}`;

  function render() {
    const p = getParams();
    const open = root.querySelector('details.cap-params')?.open ?? false;
    const openM = root.querySelector('details.cap-method')?.open ?? false;
    root.innerHTML = `
      <h2 id="cap-title">${t('capTitle')}</h2>
      <p class="cap-badge">${t('capBadge')}</p>
      <p class="note cap-es" lang="es">${CAP_ES}</p>
      <p class="note">${t('capIntro')}</p>
      <ul class="key cap-key">
        <li><i class="sw cap-sw-stack"></i><span>${t('capKeyStack')}</span></li>
        <li><i class="sw cap-sw-aisle"></i><span>${t('capKeyAisle')}</span></li>
        <li><i class="sw cap-sw-cross"></i><span>${t('capKeyCross')}</span></li>
        <li><i class="sw cap-sw-reserved"></i><span>${t('capKeyReserved')}</span></li>
        ${p.excludeUpper ? '' : `<li><i class="sw cap-sw-short"></i><span>${t('capKeyShort')}</span></li>`}
      </ul>
      <div class="cap-results" aria-live="polite" aria-busy="${busy}">${resultsTable()}</div>
      <div class="cap-dyn">${dynamic(p)}</div>
      <details class="cap-params"${open ? ' open' : ''}><summary>${t('capParams')}</summary>
        <div class="cap-form">${form(p)}</div>
        <button type="button" class="btn cap-reset">${t('capReset')}</button>
      </details>
      <details class="cap-method"${openM ? ' open' : ''}><summary>${t('capMethodTitle')}</summary>
        ${t('capMethod').map((s) => `<p class="note">${esc(s)}</p>`).join('')}
      </details>`;

    for (const el of root.querySelectorAll('[data-k]')) {
      el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
        const np = read(el);
        if (!np) return;
        // Mode switch changes the visible fields → full re-render.
        onParams(np, { rerender: el.dataset.k === 'astMode' });
      });
    }
    root.querySelector('.cap-reset').addEventListener('click', () => onParams({ ...DEFAULTS }, { rerender: true }));
    bindRows();
  }

  function bindRows() {
    for (const tr of root.querySelectorAll('.cap-table tbody tr')) tr.addEventListener('click', () => onSelect(tr.dataset.id));
  }

  // Update only the dynamic parts (keeps focus in the form while typing).
  function refresh() {
    const p = getParams();
    const box = root.querySelector('.cap-results');
    if (!box) return render();
    box.innerHTML = resultsTable();
    box.setAttribute('aria-busy', String(busy));
    bindRows();
    root.querySelector('.cap-dyn').innerHTML = dynamic(p);
  }

  return {
    render,
    setResults(r) { results = r; busy = false; refresh(); },
    setBusy(b) { busy = b; const tb = root.querySelector('.cap-table'); if (tb) tb.classList.toggle('busy', b); },
    setSelected(id) {
      selected = id;
      for (const tr of root.querySelectorAll('.cap-table tbody tr')) tr.classList.toggle('selected', tr.dataset.id === id);
    },
    refresh,
  };
}

/** Capacity block for the selected unit's details panel. */
export function capacityDetailsHTML(w, r, p) {
  if (!r) return `<h3>${t('capDetailTitle')}</h3><p class="muted">${t('capComputing')}</p>`;
  const L = r.layout;
  const po = L.perOrientation;
  const pct = (a) => `${Math.round((a / w.areas.ground) * 100)}%`;
  const fpLo = r.footprintArea.lo;
  const fpHi = r.footprintArea.hi;
  return `<h3>${t('capDetailTitle')}</h3>
    <p class="cap-badge small">${t('capBadge')}</p>
    <dl>
      <dt>${t('capStacksR')}</dt><dd><strong>${range(r.stacks)}</strong> ${tag(D)}</dd>
      <dt>${t('capReservedR')}</dt><dd>${range(r.reserved)} ${tag(A)}</dd>
      ${LEVELS.map((n) => `<dt>${t('capEligR')(n)}</dt><dd>${range(r.eligible[n])}</dd>`).join('')}
      ${LEVELS.map((n) => `<dt>${t('capBoxesR')(n)}</dt><dd><strong>${range(r.boxes[n])}</strong> ${tag(D)}<br><span class="muted">${esc(t('capStatus')[heightStatus(n, p).status])}</span></dd>`).join('')}
      <dt>${t('capRaw')}</dt><dd>${int(r.low.count)}–${int(L.count)}</dd>
      <dt>${t('capBest')}</dt><dd>${t('capOrient')[L.orientation]}; ${t('capDir')[L.dir]}; ${t('capCrossEnd')[L.crossEnd]}; Ast ${fmt(L.ast)} m ${tag(A)}</dd>
      <dt>${t('capPerOrient')}</dt><dd>${Object.entries(po).map(([k, v]) => `${t('capOrient')[k]}: ${int(v.count)} (Ast ${fmt(v.ast)} m)`).join('<br>')}</dd>
      <dt>${t('capFootprint')}</dt><dd>${t('capFootprintVal')(`${fmt(fpLo, 0)}–${fmt(fpHi, 0)}`, `${pct(fpLo)}–${pct(fpHi)}`)}</dd>
      ${r.exclArea ? `<dt>${t('capExcluded')}</dt><dd>≈ ${fmt(r.exclArea, 0)} m² ${tag(D)}</dd>` : ''}
    </dl>
    ${r.capUnder != null ? `<p class="note">${esc(t('capUnder')(r.capUnder))} ${tag(A)}</p>` : ''}
    ${Math.abs(w.outlineDiff) >= OUTLINE_WARN ? `<p class="warn-inline">⚠ ${esc(t('capOutlineNote'))}</p>` : ''}`;
}
