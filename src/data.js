// ---------------------------------------------------------------------------
// Data model — grounded in the supplied architectural drawings.
//
// Every value carries a provenance tag:
//   M  measured — read directly from a dimension / area / level label on a drawing
//   D  derived  — computed from measured values, or scaled off a drawing image
//                 (rounded; never more precise than the drawing supports)
//   A  assumed  — not in any readable source; placeholder for visualisation only
//
// Geometry is in METRES, in the local frame of each source drawing, oriented as
// drawn on the sheet (x → right, y → down). No north arrow was found, so true
// orientation is unknown. Outlines are simplified polygons: straight edges where
// the drawing shows them, corners scaled from the drawing image where no label
// exists (≈ ±1 m). Wall thicknesses, columns, stairs, doors are not modelled.
//
// The three groups come from THREE SEPARATE DRAWINGS. Their relative position is
// NOT documented, so they are laid out as separate "sheets" with wide gaps.
// ---------------------------------------------------------------------------

export const M = 'M';
export const D = 'D';
export const A = 'A';

export const WALL_HEIGHT = 8; // A — no section/elevation available for any unit
export const MEZZ_HEIGHT_DEFAULT = 5.5; // A — by analogy with NAU 16 (+227.00 − +221.50)

// Sites = one per source drawing. `origin` places the sheet in the combined
// layout (metres); gaps between sheets are arbitrary and NOT real distances.
export const SITES = [
  {
    id: 'A',
    titleKey: 'siteA',
    source: 'Plano planta (JPG) = Plano planta 20-5-26-3 (PDF, same drawing rotated 90°)',
    origin: [0, 0],
    datum: 220.4, // lowest measured spot level on the sheet (NAU 4–6)
  },
  {
    id: 'B',
    titleKey: 'siteB',
    source: '16 (PDF, 2 sheets: planta baixa + planta pis)',
    origin: [118, 0],
    datum: 221.5,
  },
  {
    id: 'C',
    titleKey: 'siteC',
    source: 'Plantes finals (PDF) — plànol 3, E 1/100, febrer 2006',
    origin: [118, 36],
    datum: null, // no level on the drawing
  },
];

// Categorical palette (distinct hues, readable on light background).
const COLORS = ['#3b6fb6', '#d9822b', '#3a9a6a', '#b8455a', '#7a5cb8', '#2a9bb0', '#a07a2c', '#5d6b7a'];

// ---- Units -----------------------------------------------------------------
// areas: ground (planta baixa), upper (planta pis), total (sup. construïda
//        total), in m² as labelled on the drawing.
// areasProv: provenance per area. Sheet A (NAU 1–6): the "Planta pis" figures
//        are partly overprinted by the large grey "NAU n" text, so their middle
//        digit(s) are not reliably legible (e.g. NAU 5/6 can read as 136,80).
//        They are taken as total − ground → D. Ground and total labels are
//        legible → M. Because upper is derived from the other two, ground +
//        upper = total on sheet A is NOT an independent cross-check.
//        Sheets B and C: all three figures legible (NAU 16 label, Fornal 31
//        "SUPERFÍCIES" table) → M, and their sums do cross-check.
const AREA_PROV_A = { ground: M, upper: D, total: M };
const AREA_PROV_ALL_M = { ground: M, upper: M, total: M };
// level: finished ground-floor spot level (m, project datum) or null.
// outline / mezz: polygons in site-local metres (see header).
// facts: [labelKey, value, provenance, noteKey?]
const RAW = [
  {
    id: 'nau1', name: 'NAU 1', site: 'A',
    areas: { ground: 1117.7, upper: 118.4, total: 1236.1 },
    level: { v: 221.65, p: M },
    outline: [[0, 0], [15.8, 0], [15.8, 59.0], [-4.9, 62.2]],
    mezz: [[[-4.35, 55.0], [15.8, 55.0], [15.8, 59.0], [-4.9, 62.2]]],
    mezzKey: 'mezzSouth',
    facts: [
      ['fNorth', '15.80 m', M],
      ['fSouth', '21.32 m', M],
      ['fPartyE', '55.10 m', M],
      ['fWest', '≈ 62 m', D, 'nIllegible'],
      ['fMezzDepth', '≈ 6 m', D, 'nScaledDash'],
    ],
  },
  {
    id: 'nau2', name: 'NAU 2', site: 'A',
    areas: { ground: 790.0, upper: 141.9, total: 931.9 },
    level: { v: 221.65, p: M },
    outline: [[15.8, 0], [32.25, 0], [32.25, 46.3], [15.8, 49.1]],
    mezz: [[[15.8, 39.2], [32.25, 39.2], [32.25, 46.3], [15.8, 49.1]]],
    mezzKey: 'mezzSouth',
    facts: [
      ['fNorth', '16.45 m', M],
      ['fPartyE', '46.31 m', M],
      ['fPartyW', '≈ 49 m', D, 'nSlope'],
      ['fMezzEdge', '39.20 m', M],
    ],
  },
  {
    id: 'nau3', name: 'NAU 3', site: 'A',
    areas: { ground: 737.9, upper: 143.3, total: 881.2 },
    level: { v: 221.65, p: M },
    outline: [[32.25, 0], [47.5, 0], [47.5, 43.74], [32.25, 46.3]],
    mezz: [[[32.25, 36.5], [47.5, 36.5], [47.5, 43.74], [32.25, 46.3]]],
    mezzKey: 'mezzSouth',
    facts: [
      ['fNorth', '15.25 m', M],
      ['fPartyW', '46.28 m', M],
      ['fPartyE', '43.74 m', M],
      ['fMezzEdge', '≈ 36.5 m', D, 'nScaledDash'],
    ],
  },
  {
    id: 'nau4', name: 'NAU 4', site: 'A',
    areas: { ground: 476.8, upper: 100.2, total: 577.0 },
    level: { v: 220.4, p: M },
    outline: [[47.5, 27.35], [81.9, 27.35], [81.9, 38.61], [47.5, 43.74]],
    mezz: [[[73.2, 27.35], [81.9, 27.35], [81.9, 38.61], [73.2, 39.9]]],
    mezzKey: 'mezzEast',
    facts: [
      ['fInnerW', '16.27 m', M, 'nWestEnd'],
      ['fInnerL', '34.00 m', M],
      ['fBlockE', '38.61 m', M],
      ['fMezzStrip', '≈ 8.7 m', D, 'nStrip'],
    ],
  },
  {
    id: 'nau5', name: 'NAU 5', site: 'A',
    areas: { ground: 473.0, upper: 116.8, total: 589.8 },
    level: { v: 220.4, p: M },
    outline: [[47.5, 13.6], [81.9, 13.6], [81.9, 27.35], [47.5, 27.35]],
    mezz: [[[73.2, 13.6], [81.9, 13.6], [81.9, 27.35], [73.2, 27.35]]],
    mezzKey: 'mezzEast',
    facts: [
      ['fInnerW', '13.55 m', M],
      ['fInnerL', '33.66–33.99 m', M, 'nTwoLabels'],
      ['fToCore', '25.69 m', M],
      ['fMezzStrip', '≈ 8.7 m', D, 'nStrip'],
    ],
  },
  {
    id: 'nau6', name: 'NAU 6', site: 'A',
    areas: { ground: 473.0, upper: 116.8, total: 589.8 },
    level: { v: 220.4, p: M },
    outline: [[47.5, 0], [81.9, 0], [81.9, 13.6], [47.5, 13.6]],
    mezz: [[[73.2, 0], [81.9, 0], [81.9, 13.6], [73.2, 13.6]]],
    mezzKey: 'mezzEast',
    facts: [
      ['fInnerW', '13.45 m', M],
      ['fBlockN', '34.40 m', M],
      ['fToCore', '25.64 m', M],
      ['fMezzStrip', '≈ 8.7 m', D, 'nStrip'],
    ],
  },
  {
    id: 'nau16', name: 'NAU 16', site: 'B',
    areas: { ground: 711.25, upper: 98.8, total: 810.05 },
    level: { v: 221.5, p: M },
    mezzLevel: { v: 227.0, p: M },
    outline: [[0, 0], [49.3, 0], [47.1, 14.3], [0, 14.3]],
    mezz: [[[0, 0], [7.1, 0], [7.1, 14.3], [0, 14.3]]],
    mezzKey: 'mezzWest',
    facts: [
      ['fWidthW', '14.30 m', M],
      ['fWidthE', '14.45 m', M, 'nSlanted'],
      ['fLength', '≈ 47–49 m', D, 'nNotDim'],
      ['fMezzDepth', '7.10 m', M],
      ['fMezzAbove', '5.50 m', D, 'nFromLevels'],
      ['fNeighbours', '—', M, 'nNeighbours'],
    ],
  },
  {
    id: 'fornal31', name: 'Fornal 31', site: 'C',
    areas: { ground: 1025.77, upper: 229.11, total: 1254.88 },
    level: null,
    outline: [[0, 0], [17.86, 0], [17.86, 34.1], [26.8, 34.4], [22.76, 51.7], [0, 51.7]],
    mezz: [
      [[8.9, 0.3], [17.86, 0.3], [17.86, 8.9], [8.9, 8.9]],
      [[8.9, 25.7], [17.86, 25.7], [17.86, 34.6], [8.9, 34.6]],
      [[17.5, 34.9], [25.3, 34.9], [23.6, 43.2], [17.5, 43.2]],
    ],
    mezzKey: 'mezzFornal',
    facts: [
      ['fFront', '17.86 m', M],
      ['fRear', '22.76 m', M, 'nLegibility'],
      ['fLength', '≈ 52 m', D, 'nNotDimF'],
      ['fStores', '77.58 + 154.47 m²', M, 'nStores'],
      ['fScale', '1:100', M],
      ['fCompart', '—', M, 'nCompart'],
    ],
  },
];

// Shoelace area of a polygon (m²)
export function polyArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

export const SITE_BY_ID = Object.fromEntries(SITES.map((s) => [s.id, s]));

export const WAREHOUSES = RAW.map((w, i) => {
  const site = SITE_BY_ID[w.site];
  const shift = ([x, y]) => [x + site.origin[0], y + site.origin[1]];
  const outline = w.outline.map(shift);
  const mezz = w.mezz.map((p) => p.map(shift));
  const xs = outline.map((p) => p[0]);
  const ys = outline.map((p) => p[1]);
  // 3D base: relative to the site datum (only meaningful within one sheet)
  const base = w.level && site.datum != null ? w.level.v - site.datum : 0;
  const mezzAbove = w.mezzLevel && w.level ? w.mezzLevel.v - w.level.v : MEZZ_HEIGHT_DEFAULT;
  return {
    ...w,
    areasProv: w.site === 'A' ? AREA_PROV_A : AREA_PROV_ALL_M,
    color: COLORS[i],
    outline,
    mezz,
    base,
    mezzAbove,
    mezzAboveProv: w.mezzLevel ? D : A,
    drawnGround: polyArea(w.outline),
    drawnUpper: w.mezz.reduce((s, p) => s + polyArea(p), 0),
    bbox: { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) },
  };
});

// Outline-vs-label discrepancy (ground floor). Units at or above this threshold
// get a visible warning in the plan, the details panel and the caveats box.
export const OUTLINE_WARN = 0.05;
for (const w of WAREHOUSES) w.outlineDiff = (w.drawnGround - w.areas.ground) / w.areas.ground;
export const OUTLINE_WARNED = WAREHOUSES.filter((w) => Math.abs(w.outlineDiff) >= OUTLINE_WARN);

// Column sums are arithmetic on the labels → always D (never M).
export const TOTALS = WAREHOUSES.reduce(
  (t, w) => ({ ground: t.ground + w.areas.ground, upper: t.upper + w.areas.upper, total: t.total + w.areas.total }),
  { ground: 0, upper: 0, total: 0 },
);

// Site bounding boxes (layout metres) — used for sheet frames
export function siteBox(siteId, pad = 6) {
  const us = WAREHOUSES.filter((w) => w.site === siteId);
  return {
    x0: Math.min(...us.map((u) => u.bbox.x0)) - pad,
    x1: Math.max(...us.map((u) => u.bbox.x1)) + pad,
    y0: Math.min(...us.map((u) => u.bbox.y0)) - pad - 3,
    y1: Math.max(...us.map((u) => u.bbox.y1)) + pad,
  };
}

// Dimension annotations drawn on the plan (site-local metres).
// [site, x1, y1, x2, y2, text, provenance, offset (perpendicular, m)]
const DIMS_RAW = [
  ['A', 0, 0, 15.8, 0, '15.80', M, -2.2],
  ['A', 15.8, 0, 32.25, 0, '16.45', M, -2.2],
  ['A', 32.25, 0, 47.5, 0, '15.25', M, -2.2],
  ['A', 47.5, 0, 81.9, 0, '34.40', M, -2.2],
  ['A', 81.9, 0, 81.9, 38.61, '38.61', M, -2.2],
  ['A', -4.9, 62.2, 15.8, 59.0, '21.32', M, -2.2],
  ['A', 47.5, 0, 47.5, 43.74, '43.74', M, 2.2],
  ['B', 0, 0, 0, 14.3, '14.30', M, 2.2],
  ['B', 0, 0, 7.1, 0, '7.10', M, -2.2],
  ['B', 7.1, 0, 49.3, 0, '≈ 42', D, -2.2],
  ['C', 0, 0, 17.86, 0, '17.86', M, -2.2],
  ['C', 0, 51.7, 22.76, 51.7, '22.76', M, 2.6],
  ['C', 0, 0, 0, 51.7, '≈ 52', D, 2.2],
];

export const DIMS = DIMS_RAW.map(([s, x1, y1, x2, y2, text, p, off]) => {
  const [ox, oy] = SITE_BY_ID[s].origin;
  return { a: [x1 + ox, y1 + oy], b: [x2 + ox, y2 + oy], text, p, off };
});

export const NOTICE_ES = 'Basado en planos de proyecto; no es un levantamiento. Cotas «≈» derivadas, no medidas.';
