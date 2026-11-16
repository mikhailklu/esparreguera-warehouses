// ---------------------------------------------------------------------------
// Box-capacity planning simulation (pure module: no DOM, runs in Node tests).
//
// PLANNING ESTIMATE ONLY. Places real box footprints inside each ground-floor
// polygon, with neighbour gaps, stacker aisles, a turning / cross aisle, wall
// clearance and exclusion zones (upper-floor footprints). It does NOT verify
// structure, slab load, box compression, fire safety or the stacker's real
// aisle requirement. Every input that is not on a drawing is an adjustable
// assumption (provenance A).
//
// Geometry is in metres in the same frame as data.js (x → right, y → down).
// ---------------------------------------------------------------------------

// The user's box (not a pallet): length × width × height, metres.
export const BOX = Object.freeze({ L: 1.2, W: 0.8, H: 1.1 });
// Neighbour gaps given by the user: horizontal (between stacks) and vertical
// (between boxes in a stack).
export const GAP_H = 0.05;
export const GAP_V = 0.05;
export const LEVELS = [4, 6];
// Thickness assumed for an upper-floor slab when the ground below it is used
// (only relevant if "exclude ground under upper floor" is switched off).
export const UPPER_SLAB = 0.3;

// Every default below is an ASSUMPTION (A) — adjustable in the UI.
export const DEFAULTS = Object.freeze({
  astMode: 'fixed', //   'fixed' = one planning Ast for both orientations; 'equipment' = from truck geometry
  astFixed: 3.0, //      m — planning assumption until the stacker manual is available
  wa: 1.5, //            m — turning radius Wa (equipment mode, placeholder)
  x: 0.45, //            m — load distance x, fork face to axle (equipment mode, placeholder)
  safety: 0.2, //        m — operating clearance a (equipment mode)
  turnWidth: 3.5, //     m — cross / turning aisle at the end of the aisles
  crossBothEnds: false, // cross aisle at both ends (shorter dead ends)
  wallClear: 0.5, //     m — wall thickness + clearance to the drawn outline
  geomTol: 0.5, //       m — extra inset for the low end of the range (outline ≈ ±1 m)
  reservePct: 10, //     % — columns, doors, fire exits, extinguishers, unknown obstacles
  depth: 1, //           stacks deep per side of an aisle (1 = every stack faces an aisle)
  structClear: 0.5, //   m — clearance above the top box to beams / lights / sprinklers
  siteHeight: 8, //      m — HYPOTHETICAL, not measured
  heightMeasured: false,
  boxKg: null, //        kg per box — unknown
  excludeUpper: true, // do not place stacks under upper-floor (planta pis) zones
});

// The default Ast is a PLANNING ASSUMPTION (provenance A). It is not taken from
// any standard, regulation or manufacturer datasheet and must not be presented
// as a normative or required aisle width.
export const AST_DEFAULT_BASIS = Object.freeze({
  value: DEFAULTS.astFixed,
  provenance: 'A',
  basis: 'planning-assumption',
  normative: false,
  source: null, // no stacker model / datasheet supplied
});

import { polyArea } from './data.js';

const EPS = 1e-9;

// ---- Heights ----------------------------------------------------------------
/** Stack height of n boxes with vertical gaps: n·H + (n−1)·gapV. */
export const stackHeight = (n, h = BOX.H, g = GAP_V) => (n > 0 ? n * h + (n - 1) * g : 0);
/** Clear height needed: stack + structural clearance. */
export const requiredClearHeight = (n, structClear) => stackHeight(n) + structClear;
/** Fork height needed to set the top box: underside of the top box. */
export const topBoxUnderside = (n) => (n - 1) * (BOX.H + GAP_V);
/** How many levels fit under a clear height (≥ 0). */
export const levelsUnder = (clear) => Math.max(0, Math.floor((clear + GAP_V + EPS) / (BOX.H + GAP_V)));

/**
 * Height feasibility. Without a MEASURED clear height the answer is always
 * UNKNOWN; with one it is at most a geometric fit, never a certification.
 */
export function heightStatus(n, p) {
  const need = requiredClearHeight(n, p.structClear);
  if (!p.heightMeasured || !(p.siteHeight > 0)) return { status: 'UNKNOWN', need };
  return { status: need <= p.siteHeight + EPS ? 'FITS_GEOMETRICALLY' : 'DOES_NOT_FIT', need };
}

// ---- Aisle width ------------------------------------------------------------
export const ORIENTATIONS = Object.freeze({
  // long side of the box runs along the aisle → forks / load length = 0.80 m
  longAlong: { along: BOX.L, deep: BOX.W },
  // long side across the aisle → load length = 1.20 m
  longAcross: { along: BOX.W, deep: BOX.L },
});

/**
 * Working-aisle width Ast for a load of length `loadLen` (dimension
 * perpendicular to the aisle). 'fixed' mode returns the planning assumption.
 * 'equipment' mode uses the simplified right-angle-stacking geometry
 * Ast = Wa + x + l6 + a (symbols as in VDI 2198 truck datasheets). That is an
 * approximation; the manufacturer's stated Ast for the actual model and load
 * always prevails.
 */
export function computeAst(p, loadLen) {
  if (p.astMode === 'equipment') return p.wa + p.x + loadLen + p.safety;
  return p.astFixed;
}

// ---- Polygon geometry ---------------------------------------------------------
export { polyArea };
export function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const cross = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
function segsIntersect(a, b, c, d) {
  const d1 = cross(c[0], c[1], d[0], d[1], a[0], a[1]);
  const d2 = cross(c[0], c[1], d[0], d[1], b[0], b[1]);
  const d3 = cross(a[0], a[1], b[0], b[1], c[0], c[1]);
  const d4 = cross(a[0], a[1], b[0], b[1], d[0], d[1]);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  const on = (p, q, r) => Math.min(p[0], q[0]) - EPS <= r[0] && r[0] <= Math.max(p[0], q[0]) + EPS
    && Math.min(p[1], q[1]) - EPS <= r[1] && r[1] <= Math.max(p[1], q[1]) + EPS;
  if (Math.abs(d1) < EPS && on(c, d, a)) return true;
  if (Math.abs(d2) < EPS && on(c, d, b)) return true;
  if (Math.abs(d3) < EPS && on(a, b, c)) return true;
  if (Math.abs(d4) < EPS && on(a, b, d)) return true;
  return false;
}

function pointSegDist(px, py, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2)) : 0;
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}
const pointRectDist = (px, py, r) => Math.hypot(Math.max(r[0] - px, 0, px - r[2]), Math.max(r[1] - py, 0, py - r[3]));
const rectCorners = (r) => [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]];

/** Distance between a segment and an axis-aligned rect [x0,y0,x1,y1]; 0 if they touch. */
export function segRectDist(a, b, r) {
  if (pointRectDist(a[0], a[1], r) === 0 || pointRectDist(b[0], b[1], r) === 0) return 0;
  const c = rectCorners(r);
  for (let i = 0; i < 4; i++) if (segsIntersect(a, b, c[i], c[(i + 1) % 4])) return 0;
  return Math.min(
    pointRectDist(a[0], a[1], r), pointRectDist(b[0], b[1], r),
    ...c.map(([x, y]) => pointSegDist(x, y, a, b)),
  );
}

// Distance from an axis-aligned rect to a segment's bounding box: a cheap lower
// bound on the true distance, used to skip far-away edges.
const segBoxGap = (a, b, r) => Math.hypot(
  Math.max(r[0] - Math.max(a[0], b[0]), 0, Math.min(a[0], b[0]) - r[2]),
  Math.max(r[1] - Math.max(a[1], b[1]), 0, Math.min(a[1], b[1]) - r[3]),
);

/** Min distance from rect to the polygon boundary (stops early below `stopBelow`). */
export function rectBoundaryDist(r, poly, stopBelow = -Infinity) {
  let m = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (segBoxGap(a, b, r) >= m) continue;
    m = Math.min(m, segRectDist(a, b, r));
    if (m < stopBelow) return m;
  }
  return m;
}

/** Rect fully inside a simple polygon with at least `clear` to its boundary. */
export function rectInPoly(r, poly, clear = 0) {
  const s = [r[0] + 1e-7, r[1] + 1e-7, r[2] - 1e-7, r[3] - 1e-7];
  const need = Math.max(clear - 1e-7, 1e-12);
  if (!pointInPoly((s[0] + s[2]) / 2, (s[1] + s[3]) / 2, poly)) return false;
  return rectBoundaryDist(s, poly, need) >= need;
}

/** Rect overlaps the polygon or comes closer than `clear` to it. */
export function rectHitsPoly(r, poly, clear = 0, bbox = bboxOf(poly)) {
  const s = [r[0] + 1e-7, r[1] + 1e-7, r[2] - 1e-7, r[3] - 1e-7];
  const need = Math.max(clear - 1e-7, 1e-12);
  if (segBoxGap([bbox[0], bbox[1]], [bbox[2], bbox[3]], s) >= need) return false;
  if (rectCorners(s).some(([x, y]) => pointInPoly(x, y, poly))) return true;
  if (poly.some(([x, y]) => x > s[0] && x < s[2] && y > s[1] && y < s[3])) return true;
  return rectBoundaryDist(s, poly, need) < need;
}

const rectOverlap = (a, b) => a[0] < b[2] - EPS && b[0] < a[2] - EPS && a[1] < b[3] - EPS && b[1] < a[3] - EPS;
function bboxOf(poly) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}


// ---- Layout in a normalised frame ---------------------------------------------
// Frame (u, v): aisles run along u; blocks of stacks and aisles alternate along
// v. The cross / turning aisle is a band at the low-u end (optionally also at
// the high-u end).
//
// A block is `depth` rows of stacks and faces an aisle on one side. Between
// consecutive blocks the clear distance must be ≥ Ast if either block's aisle
// lies between them, otherwise ≥ the 0.05 m back-to-back gap.
//
// Rows: for a row band, the u-intervals where a stack fits are computed
// analytically (polygon edges projected onto u; clearance applied as a square,
// which is conservative on slanted walls), minus exclusion zones. A stack only
// counts if its aisle band, from the cross aisle up to the stack, lies inside
// the polygon and outside exclusion zones (the stacker must be able to reach
// it). Stacks are packed greedily from the start of each interval (optimal in
// 1-D).
//
// Block positions: exact dynamic programme over a 0.05 m grid across v. The set
// of feasible layouts only grows when Ast, the turning band or the wall
// clearance shrink, so capacity is monotone in each of them.
export const GRID = 0.05;

// u-ranges of polygon edges crossing the open band (V0, V1).
function edgeSpans(poly, V0, V1) {
  const lo = V0 + 1e-9;
  const hi = V1 - 1e-9;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    const ymin = Math.min(y1, y2);
    const ymax = Math.max(y1, y2);
    if (ymax < lo || ymin > hi) continue;
    if (y1 === y2) { out.push([Math.min(x1, x2), Math.max(x1, x2)]); continue; }
    const xa = x1 + ((x2 - x1) * (Math.max(lo, ymin) - y1)) / (y2 - y1);
    const xb = x1 + ((x2 - x1) * (Math.min(hi, ymax) - y1)) / (y2 - y1);
    out.push([Math.min(xa, xb), Math.max(xa, xb)]);
  }
  return out;
}

function subtract(free, forb) {
  let cur = free;
  for (const [a, b] of forb) {
    const next = [];
    for (const [p, q] of cur) {
      if (b <= p || a >= q) { next.push([p, q]); continue; }
      if (a > p) next.push([p, a]);
      if (b < q) next.push([b, q]);
    }
    cur = next;
  }
  return cur;
}

/**
 * u-intervals [p, q] such that the rect [p, q] × [V0, V1] lies inside `poly`
 * with (square) clearance `clear`, and keeps `exClear` from every exclusion.
 */
export function bandFree(poly, pb, excl, V0, V1, clear, exClear) {
  const B0 = V0 - clear;
  const B1 = V1 + clear;
  let free = subtract([[pb[0] - 1, pb[2] + 1]], edgeSpans(poly, B0, B1))
    .filter(([p, q]) => q - p > 1e-9 && pointInPoly((p + q) / 2, (B0 + B1) / 2, poly))
    .map(([p, q]) => [p + clear, q - clear])
    .filter(([p, q]) => q - p > 1e-9);
  for (const e of excl) {
    const sp = edgeSpans(e, V0 - exClear, V1 + exClear);
    if (!sp.length) continue;
    let a = Infinity;
    let b = -Infinity;
    for (const [s0, s1] of sp) { a = Math.min(a, s0); b = Math.max(b, s1); }
    free = subtract(free, [[a - exClear, b + exClear]]);
  }
  return free.filter(([p, q]) => q - p > 1e-9);
}

function packRow(free, ranges, along, gap) {
  const out = [];
  for (const [p, q] of free) {
    for (const [lo, hi] of ranges) {
      const a = Math.max(p, lo);
      const b = Math.min(q, hi);
      if (b - a < along - 1e-9) continue;
      const n = Math.floor((b - a - along + 1e-9) / (along + gap)) + 1;
      for (let i = 0; i < n; i++) out.push(a + i * (along + gap));
    }
  }
  return out;
}

export function layoutFrame(poly, excl, c) {
  const pb = bboxOf(poly);
  const umin = pb[0] + c.clear;
  const umax = pb[2] - c.clear;
  const vmin = pb[1] + c.clear;
  const vmax = pb[3] - c.clear;
  const crossA = [umin, umin + c.turn];
  const crossB = c.bothEnds ? [umax - c.turn, umax] : null;
  const uStart = crossA[1];
  const uEnd = crossB ? crossB[0] : umax;
  const depth = c.depth;
  const pitchV = c.deep + c.gap;
  const T = depth * c.deep + (depth - 1) * c.gap;
  const N = uEnd - uStart < c.along ? 0 : Math.max(0, Math.floor((vmax - c.deep - vmin) / GRID + 1e-6) + 1);
  const vAt = (i) => vmin + i * GRID;

  const rowCache = new Map();
  const rowFree = (v) => {
    const k = Math.round(((v - vmin) / GRID) * 1000);
    if (!rowCache.has(k)) {
      rowCache.set(k, v + c.deep > vmax + 1e-9 ? [] : bandFree(poly, pb, excl, v, v + c.deep, c.clear, c.clear));
    }
    return rowCache.get(k);
  };
  // u-ranges a stack may occupy if served by the aisle band [A0, A1].
  const reachRanges = (A0, A1) => {
    const free = bandFree(poly, pb, excl, A0, A1, 0, 0);
    const out = [];
    const ia = free.find(([p, q]) => p <= crossA[0] + 1e-6 && q >= uStart - 1e-6);
    if (ia) out.push([uStart, Math.min(uEnd, ia[1])]);
    if (crossB) {
      const ib = free.find(([p, q]) => q >= crossB[1] - 1e-6 && p <= uEnd + 1e-6);
      if (ib) out.push([Math.max(uStart, ib[0]), uEnd]);
    }
    if (out.length === 2 && out[1][0] <= out[0][1]) return [[uStart, uEnd]];
    return out;
  };
  const aisleOf = (i, f) => (f > 0 ? [vAt(i) + T, vAt(i) + T + c.ast] : [vAt(i) - c.ast, vAt(i)]);
  const blockRows = (i, f) => {
    const [A0, A1] = aisleOf(i, f);
    const ranges = reachRanges(A0, A1);
    const rows = [];
    if (!ranges.length) return rows;
    for (let s = 0; s < depth; s++) {
      const v0 = vAt(i) + s * pitchV;
      rows.push({ v0, us: packRow(rowFree(v0), ranges, c.along, c.gap) });
    }
    return rows;
  };

  // DP over block start positions. Face index 0 → aisle on the high-v side,
  // 1 → aisle on the low-v side.
  const F = [1, -1];
  const cnt = [new Float64Array(N), new Float64Array(N)];
  for (let i = 0; i < N; i++) {
    for (let fi = 0; fi < 2; fi++) cnt[fi][i] = blockRows(i, F[fi]).reduce((s, r) => s + r.us.length, 0);
  }
  const dp = [new Float64Array(N), new Float64Array(N)];
  const from = [new Int32Array(N), new Int32Array(N)]; // predecessor idx*2+face, −1 none
  const pm = [new Float64Array(N), new Float64Array(N)]; // prefix max of dp
  const pmArg = [new Int32Array(N), new Int32Array(N)];
  const steps = (sep) => Math.ceil((T + sep) / GRID - 1e-6);
  for (let j = 0; j < N; j++) {
    for (let g = 0; g < 2; g++) {
      let best = 0;
      let arg = -1;
      for (let f = 0; f < 2; f++) {
        const sep = F[f] > 0 || F[g] < 0 ? c.ast : c.gap;
        const k = j - steps(sep);
        if (k >= 0 && pm[f][k] > best) { best = pm[f][k]; arg = pmArg[f][k] * 2 + f; }
      }
      dp[g][j] = cnt[g][j] + best;
      from[g][j] = arg;
    }
    for (let f = 0; f < 2; f++) {
      if (j === 0 || dp[f][j] > pm[f][j - 1]) { pm[f][j] = dp[f][j]; pmArg[f][j] = j; } else { pm[f][j] = pm[f][j - 1]; pmArg[f][j] = pmArg[f][j - 1]; }
    }
  }

  // Reconstruct the best chain of blocks.
  let cur = -1;
  if (N) {
    const f = pm[0][N - 1] >= pm[1][N - 1] ? 0 : 1;
    if (pm[f][N - 1] > 0) cur = pmArg[f][N - 1] * 2 + f;
  }
  const stacks = [];
  const aisles = [];
  while (cur >= 0) {
    const i = cur >> 1;
    const f = cur & 1;
    let a0 = Infinity;
    let a1 = -Infinity;
    for (const r of blockRows(i, F[f])) {
      for (const u of r.us) {
        stacks.push([u, r.v0, u + c.along, r.v0 + c.deep]);
        a0 = Math.min(a0, u); a1 = Math.max(a1, u + c.along);
      }
    }
    if (a1 > a0) {
      const [A0, A1] = aisleOf(i, F[f]);
      const fromA = reachRanges(A0, A1).some(([lo]) => lo <= uStart + 1e-9);
      aisles.push(fromA ? [crossA[0], A0, a1, A1] : [a0, A0, crossB[1], A1]);
    }
    cur = from[f][i];
  }
  const vs = aisles.flatMap((a) => [a[1], a[3]]).concat(stacks.flatMap((r) => [r[1], r[3]]));
  const crossRects = stacks.length
    ? [crossA, ...(crossB ? [crossB] : [])].map(([a, b]) => [a, Math.min(...vs), b, Math.max(...vs)])
    : [];
  return { stacks, aisles, cross: crossRects };
}

function transform(dir, mu) {
  const fwd = ([x, y]) => {
    const u = dir === 'x' ? x : y;
    const v = dir === 'x' ? y : x;
    return [mu ? -u : u, v];
  };
  const back = ([u, v]) => {
    const uu = mu ? -u : u;
    return dir === 'x' ? [uu, v] : [v, uu];
  };
  const rectBack = (r) => {
    const a = back([r[0], r[1]]);
    const b = back([r[2], r[3]]);
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
  };
  return { fwd, rectBack };
}

/**
 * Best layout of one polygon over aisle direction (x / y), box orientation
 * (long side along / across the aisle) and cross-aisle end. Returns the best
 * layout plus the best count for each orientation.
 */
export function planPolygon(poly, exclusions, p, clear = p.wallClear) {
  let best = null;
  const perOrientation = {};
  for (const [oKey, o] of Object.entries(ORIENTATIONS)) {
    const ast = computeAst(p, o.deep);
    perOrientation[oKey] = { count: 0, ast };
    for (const dir of ['x', 'y']) {
      for (const mu of [false, true]) {
        if (p.crossBothEnds && mu) continue; // symmetric
        const T = transform(dir, mu);
        const lay = layoutFrame(poly.map(T.fwd), exclusions.map((e) => e.map(T.fwd)), {
          along: o.along, deep: o.deep, ast, gap: GAP_H, depth: Math.max(1, Math.round(p.depth)),
          clear, turn: p.turnWidth, bothEnds: p.crossBothEnds,
        });
        const n = lay.stacks.length;
        if (n > perOrientation[oKey].count) perOrientation[oKey].count = n;
        if (!best || n > best.count) {
          best = {
            count: n,
            orientation: oKey,
            dir,
            crossEnd: mu ? 'high' : 'low',
            ast,
            stacks: lay.stacks.map(T.rectBack),
            aisles: lay.aisles.map(T.rectBack),
            cross: lay.cross.map(T.rectBack),
          };
        }
      }
    }
  }
  best.perOrientation = perOrientation;
  return best;
}


// ---- Reserve and box counts ----------------------------------------------------
// Reserve policy (deterministic, whole physical positions):
//   kept     = ⌊N · (100 − reserve%) / 100⌋   (floor: never round capacity up)
//   reserved = N − kept
// The reserved positions are spread evenly over the layout: stacks are ranked
// by position (y, then x, as drawn) and rank k (0-based) is reserved when
// ⌊(k+1)·R/N⌋ > ⌊k·R/N⌋. The same positions are greyed out in 2D and 3D.
//
// Box counts are FULL stacks only: for an n-level scenario a kept position is
// eligible only if a complete n-level stack fits there (positions under an
// upper floor, when that ground is used, may be capped lower). Boxes(n) =
// eligible(n) × n, so every figure is a multiple of n. Partial stacks are never
// added to a scenario total.

/** Positions kept after the reserve (floor policy, integer). */
export function keptAfterReserve(n, pct) {
  const r = Math.min(Math.max(Number(pct) || 0, 0), 100);
  return Math.floor((n * (100 - r)) / 100 + EPS);
}

/** Boolean per stack: true = reserved (spread evenly, deterministic). */
export function reserveMask(stacks, pct) {
  const N = stacks.length;
  const R = N - keptAfterReserve(N, pct);
  const mask = new Array(N).fill(false);
  if (!R) return mask;
  const key = (r) => [Math.round(((r[1] + r[3]) / 2) * 1000), Math.round(((r[0] + r[2]) / 2) * 1000)];
  const order = stacks.map((r, i) => [key(r), i]).sort((a, b) => a[0][0] - b[0][0] || a[0][1] - b[0][1] || a[1] - b[1]);
  order.forEach(([, i], k) => { if (Math.floor(((k + 1) * R) / N) > Math.floor((k * R) / N)) mask[i] = true; });
  return mask;
}

/** Annotate a layout with caps, reserve mask and per-scenario full-stack counts. */
function scoreLayout(L, caps, pct) {
  L.caps = caps;
  L.reserved = reserveMask(L.stacks, pct);
  L.kept = L.stacks.length - L.reserved.filter(Boolean).length;
  L.eligible = {};
  L.boxes = {};
  for (const n of LEVELS) {
    let e = 0;
    for (let i = 0; i < L.stacks.length; i++) if (!L.reserved[i] && caps[i] >= n) e++;
    L.eligible[n] = e;
    L.boxes[n] = e * n;
  }
  return L;
}

/**
 * Plan one warehouse unit (object shaped like data.js WAREHOUSES entries:
 * outline, mezz, mezzAbove, areas.ground).
 */
export function planUnit(w, p) {
  const excl = p.excludeUpper ? w.mezz : [];
  // Under an upper floor (if used at all) the stack is capped by its height.
  const capUnder = levelsUnder(w.mezzAbove - UPPER_SLAB - p.structClear);
  const capsOf = (stacks) => stacks.map((r) => (
    !p.excludeUpper && w.mezz.some((m) => rectHitsPoly(r, m, 0)) ? capUnder : Infinity));

  const hi = planPolygon(w.outline, excl, p, p.wallClear);
  const lo = planPolygon(w.outline, excl, p, p.wallClear + Math.max(0, p.geomTol));
  scoreLayout(hi, capsOf(hi.stacks), p.reservePct);
  scoreLayout(lo, capsOf(lo.stacks), p.reservePct);
  const range = (f) => {
    const a = f(lo);
    const b = f(hi);
    return { lo: Math.min(a, b), hi: Math.max(a, b) };
  };
  // Each endpoint is one whole layout's count, so boxes stay multiples of n.
  const stacks = range((L) => L.kept);
  const eligible = Object.fromEntries(LEVELS.map((n) => [n, range((L) => L.eligible[n])]));
  const boxes = Object.fromEntries(LEVELS.map((n) => [n, range((L) => L.boxes[n])]));
  const footprint = BOX.L * BOX.W;
  const exclArea = p.excludeUpper ? w.mezz.reduce((s, m) => s + polyArea(m), 0) : 0;
  return {
    id: w.id,
    layout: hi,
    low: { count: lo.count, kept: lo.kept, orientation: lo.orientation, dir: lo.dir },
    stacks,
    eligible,
    boxes,
    reserved: range((L) => L.count - L.kept),
    capUnder: p.excludeUpper ? null : capUnder,
    footprintArea: { lo: stacks.lo * footprint, hi: stacks.hi * footprint },
    drawnArea: polyArea(w.outline),
    exclArea,
    statedGround: w.areas?.ground ?? null,
  };
}

/** Load figures (only when a box weight is supplied). */
export function loadFigures(n, kg) {
  if (!(kg > 0)) return null;
  const g = 9.81 / 1000; // kN per kg
  return {
    bottomBoxKg: (n - 1) * kg, // load resting on the bottom box
    stackKN: n * kg * g,
    footprintKPa: (n * kg * g) / (BOX.L * BOX.W), // kN/m² under one stack footprint
  };
}

export function planAll(units, p) {
  return new Map(units.map((w) => [w.id, planUnit(w, p)]));
}

/** Sum of the per-unit ranges. */
export function totals(results) {
  const z = () => Object.fromEntries(LEVELS.map((n) => [n, { lo: 0, hi: 0 }]));
  const t = { stacks: { lo: 0, hi: 0 }, eligible: z(), boxes: z() };
  for (const r of results.values()) {
    t.stacks.lo += r.stacks.lo; t.stacks.hi += r.stacks.hi;
    for (const n of LEVELS) {
      t.eligible[n].lo += r.eligible[n].lo; t.eligible[n].hi += r.eligible[n].hi;
      t.boxes[n].lo += r.boxes[n].lo; t.boxes[n].hi += r.boxes[n].hi;
    }
  }
  return t;
}

export { rectOverlap };
