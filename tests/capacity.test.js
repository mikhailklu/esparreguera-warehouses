import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WAREHOUSES } from '../src/data.js';
import {
  BOX, GAP_H, DEFAULTS, LEVELS, stackHeight, requiredClearHeight, heightStatus, levelsUnder, computeAst,
  planPolygon, planUnit, planAll, totals, rectInPoly, rectHitsPoly, polyArea, pointInPoly,
  keptAfterReserve, reserveMask, AST_DEFAULT_BASIS,
} from '../src/capacity.js';
import { CAP_STR } from '../src/i18n-capacity.js';

const TOL = 1e-6;
const P = (o = {}) => ({ ...DEFAULTS, ...o });
const rectPoly = (w, h, x = 0, y = 0) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const overlap = (a, b) => a[0] < b[2] - TOL && b[0] < a[2] - TOL && a[1] < b[3] - TOL && b[1] < a[3] - TOL;
// Axis-aligned separation between two rects (0 if they overlap or touch).
const separation = (a, b) => Math.max(a[0] - b[2], b[0] - a[2], a[1] - b[3], b[1] - a[3]);

// Exercise a few parameter sets per unit, not just the defaults.
const CASES = [
  P(),
  P({ astMode: 'equipment', depth: 2, wallClear: 0.3, turnWidth: 4 }),
  P({ crossBothEnds: true, astFixed: 2.4, excludeUpper: false }),
];

// ---- Heights ------------------------------------------------------------------
test('stack heights follow n·1.10 + (n−1)·0.05', () => {
  assert.ok(Math.abs(stackHeight(4) - 4.55) < 1e-9);
  assert.ok(Math.abs(stackHeight(6) - 6.85) < 1e-9);
  assert.ok(Math.abs(requiredClearHeight(6, 0.5) - 7.35) < 1e-9);
  assert.equal(levelsUnder(4.55), 4);
  assert.equal(levelsUnder(4.54), 3);
  assert.equal(levelsUnder(6.85), 6);
});

test('height feasibility is UNKNOWN unless a measured height is supplied', () => {
  // 8 m would fit 6.85 + 0.5, but it is hypothetical → UNKNOWN, never "OK".
  assert.equal(heightStatus(6, P({ siteHeight: 8, heightMeasured: false })).status, 'UNKNOWN');
  assert.equal(heightStatus(6, P({ siteHeight: 8, heightMeasured: true })).status, 'FITS_GEOMETRICALLY');
  assert.equal(heightStatus(6, P({ siteHeight: 7, heightMeasured: true })).status, 'DOES_NOT_FIT');
});

// ---- Aisle width ----------------------------------------------------------------
test('equipment-mode Ast grows with load length (orientation-dependent)', () => {
  const p = P({ astMode: 'equipment' });
  assert.ok(computeAst(p, BOX.L) > computeAst(p, BOX.W));
  assert.equal(computeAst(P(), BOX.L), computeAst(P(), BOX.W)); // fixed mode: same planning value
});

test('aisle monotonicity: wider Ast never increases capacity (rectangle + all 8 units)', () => {
  const shapes = [{ name: 'rect 30×20', outline: rectPoly(30, 20), mezz: [] }, ...WAREHOUSES];
  for (const s of shapes) {
    for (const mode of ['fixed', 'equipment']) {
      let prev = Infinity;
      for (let a = 2.0; a <= 5.0 + 1e-9; a += 0.25) {
        const p = P({ astMode: mode, astFixed: a, wa: a - 1.2 });
        const n = planPolygon(s.outline, s.mezz, p).count;
        assert.ok(n <= prev, `${s.name} ${mode}: Ast ${a.toFixed(2)} gave ${n} > ${prev}`);
        prev = n;
      }
    }
  }
});

test('turning width and wall clearance are monotone too', () => {
  for (const w of WAREHOUSES) {
    let prev = Infinity;
    for (const t of [0, 2, 3, 3.5, 4.5, 6]) {
      const n = planPolygon(w.outline, w.mezz, P({ turnWidth: t })).count;
      assert.ok(n <= prev, `${w.name} turn ${t}`);
      prev = n;
    }
    const r = planUnit(w, P());
    assert.ok(r.low.count <= r.layout.count, `${w.name}: low end of range above high end`);
  }
});

// ---- Polygon boundary ------------------------------------------------------------
test('every stack lies inside its ground-floor polygon with wall clearance (exact Euclidean check)', () => {
  for (const p of CASES) {
    for (const w of WAREHOUSES) {
      const { layout } = planUnit(w, p);
      assert.ok(layout.count > 0, `${w.name}: no stacks placed`);
      for (const r of layout.stacks) {
        assert.ok(rectInPoly(r, w.outline, p.wallClear), `${w.name}: stack ${r.map((v) => v.toFixed(2))} outside / too close to wall`);
        if (p.excludeUpper) {
          for (const m of w.mezz) assert.ok(!rectHitsPoly(r, m, p.wallClear), `${w.name}: stack under upper-floor zone`);
        }
      }
    }
  }
});

test('concave (L-shaped) polygon: no stack in the notch', () => {
  // 20 × 20 square with the top-right 10 × 10 quadrant cut out.
  const L = [[0, 0], [10, 0], [10, 10], [20, 10], [20, 20], [0, 20]];
  const res = planPolygon(L, [], P({ wallClear: 0.2 }));
  assert.ok(res.count > 0);
  for (const r of res.stacks) {
    assert.ok(rectInPoly(r, L, 0.2));
    const cx = (r[0] + r[2]) / 2;
    const cy = (r[1] + r[3]) / 2;
    assert.ok(!(cx > 10 && cy < 10), 'stack placed in the notch');
    assert.ok(pointInPoly(cx, cy, L));
  }
});

// ---- Spacing --------------------------------------------------------------------------
test('neighbouring stacks keep ≥ 0.05 m; stacks never sit in aisles or the turning band', () => {
  for (const p of CASES) {
    for (const w of WAREHOUSES) {
      const { layout } = planUnit(w, p);
      const s = layout.stacks;
      for (let i = 0; i < s.length; i++) {
        const [x0, y0, x1, y1] = s[i];
        const dims = [x1 - x0, y1 - y0].map((d) => Math.round(d * 100) / 100).sort();
        assert.deepEqual(dims, [BOX.W, BOX.L], 'footprint must be 0.80 × 1.20');
        for (let j = i + 1; j < s.length; j++) {
          assert.ok(separation(s[i], s[j]) >= GAP_H - TOL, `${w.name}: stacks ${i},${j} closer than ${GAP_H} m`);
        }
        for (const a of [...layout.aisles, ...layout.cross]) assert.ok(!overlap(s[i], a), `${w.name}: stack in aisle`);
      }
      for (const a of layout.aisles) {
        const width = Math.min(a[2] - a[0], a[3] - a[1]);
        assert.ok(width >= layout.ast - TOL, `${w.name}: aisle ${width} < Ast ${layout.ast}`);
      }
      for (const c of layout.cross) assert.ok(Math.min(c[2] - c[0], c[3] - c[1]) >= p.turnWidth - TOL);
    }
  }
});

// ---- Area ---------------------------------------------------------------------------
test('hand-checked rectangle: 12.45 × 4.60 m with Ast 3.0 holds exactly 20 stacks', () => {
  // Long side along the aisle: 2 rows (0.80 + 3.00 + 0.80 = 4.60) × 10 stacks
  // ((12.45 + 0.05) / 1.25 = 10). Long side across: 4 rows × 5 along 4.60 = 20.
  const res = planPolygon(rectPoly(12.45, 4.6), [], P({ wallClear: 0, turnWidth: 0 }));
  assert.equal(res.perOrientation.longAlong.count, 20);
  assert.equal(res.perOrientation.longAcross.count, 20);
  assert.equal(res.count, 20);
});

test('occupied footprint never exceeds usable polygon area; reserve and levels are applied', () => {
  for (const w of WAREHOUSES) {
    const p = P();
    const r = planUnit(w, p);
    const usable = polyArea(w.outline) - w.mezz.reduce((a, m) => a + polyArea(m), 0);
    assert.ok(r.layout.count * BOX.L * BOX.W <= usable, `${w.name}: footprint > usable area`);
    assert.ok(r.footprintArea.hi <= w.areas.ground, `${w.name}: footprint > stated ground area`);
    assert.equal(r.stacks.hi, Math.floor((r.layout.count * (100 - p.reservePct)) / 100 + 1e-9));
    for (const n of LEVELS) assert.equal(r.boxes[n].hi, r.stacks.hi * n);
  }
});

test('upper-floor zones: excluded by default; if used, stacks below are capped by its height', () => {
  const w = WAREHOUSES.find((u) => u.id === 'nau16');
  const used = planUnit(w, P({ excludeUpper: false }));
  assert.ok(used.layout.count >= planUnit(w, P()).layout.count);
  assert.equal(used.capUnder, levelsUnder(w.mezzAbove - 0.3 - DEFAULTS.structClear));
  assert.ok(used.capUnder < 6);
  assert.ok(used.layout.caps.some((c) => c === used.capUnder), 'expected some stacks under the upper floor');
  assert.ok(used.boxes[6].hi < Math.floor(used.layout.count * 6 * 0.9));
});

test('totals add up across units', () => {
  const res = planAll(WAREHOUSES, P());
  const t = totals(res);
  assert.equal(res.size, 8);
  assert.equal(t.stacks.hi, [...res.values()].reduce((s, r) => s + r.stacks.hi, 0));
  assert.equal(t.boxes[6].lo, [...res.values()].reduce((s, r) => s + r.boxes[6].lo, 0));
});

// ---- Whole-stack invariants (reserve applied to physical positions) ------------
test('reserve floor policy: kept = floor(N·(100−r)/100); reserved positions are deterministic', () => {
  assert.equal(keptAfterReserve(100, 0), 100);
  assert.equal(keptAfterReserve(100, 10), 90);
  assert.equal(keptAfterReserve(100, 37), 63);
  assert.equal(keptAfterReserve(7, 10), 6); // 6.3 → 6: never rounds capacity up
  assert.equal(keptAfterReserve(29, 10), 26); // 26.1 → 26
  assert.equal(keptAfterReserve(10, 100), 0);
  const stacks = Array.from({ length: 23 }, (_, i) => [i * 1.25, 0, i * 1.25 + 1.2, 0.8]);
  for (const r of [0, 10, 37]) {
    const m = reserveMask(stacks, r);
    assert.equal(m.filter(Boolean).length, 23 - keptAfterReserve(23, r));
    assert.deepEqual(reserveMask([...stacks].reverse(), r).reverse(), m, 'mask must not depend on input order');
  }
});

// Same predicate the 2D plan and the 3D view use to draw a full n-level stack.
const drawnFull = (L, n) => L.stacks.filter((_, i) => !L.reserved[i] && L.caps[i] >= n).length;

test('all 8 units × 4/6 levels × reserve 0/10/37% × upper-floor mode: boxes are whole stacks', () => {
  for (const excludeUpper of [true, false]) {
    for (const reservePct of [0, 10, 37]) {
      const p = P({ reservePct, excludeUpper });
      const res = planAll(WAREHOUSES, p);
      assert.equal(res.size, 8);
      for (const w of WAREHOUSES) {
        const r = res.get(w.id);
        const L = r.layout;
        const tag = `${w.name} r=${reservePct}% excludeUpper=${excludeUpper}`;
        const N = L.stacks.length;
        assert.equal(L.count, N);
        assert.equal(L.kept, keptAfterReserve(N, reservePct), `${tag}: kept`);
        assert.equal(L.reserved.filter(Boolean).length, N - L.kept, `${tag}: reserved positions`);
        if (reservePct === 0) assert.equal(L.kept, N);
        assert.ok(r.stacks.lo <= L.kept && L.kept <= r.stacks.hi, `${tag}: displayed layout outside stack range`);
        for (const n of LEVELS) {
          for (const end of ['lo', 'hi']) {
            assert.equal(r.boxes[n][end] % n, 0, `${tag}: boxes(${n}).${end}=${r.boxes[n][end]} not a multiple of ${n}`);
            assert.equal(r.boxes[n][end], r.eligible[n][end] * n, `${tag}: boxes ≠ eligible × ${n}`);
            assert.ok(r.eligible[n][end] <= r.stacks[end], `${tag}: eligible(${n}) > floor stacks`);
          }
          // Displayed layout ↔ figures: the drawn full stacks × n are the layout's box count.
          assert.equal(drawnFull(L, n), L.eligible[n], `${tag}: drawn ≠ counted`);
          assert.equal(L.boxes[n], drawnFull(L, n) * n);
          assert.ok(r.boxes[n].lo <= L.boxes[n] && L.boxes[n] <= r.boxes[n].hi, `${tag}: drawn layout outside box range`);
          if (excludeUpper) {
            assert.deepEqual(r.eligible[n], r.stacks, `${tag}: with upper zones excluded every kept stack is eligible`);
            assert.equal(r.boxes[n].hi, r.stacks.hi * n);
            assert.equal(r.boxes[n].lo, r.stacks.lo * n);
          }
        }
        if (excludeUpper) assert.ok(L.caps.every((c) => c === Infinity));
      }
      // Totals are sums of the per-unit endpoints, so they stay multiples of n.
      const t = totals(res);
      for (const n of LEVELS) {
        for (const end of ['lo', 'hi']) {
          const sum = [...res.values()].reduce((s, r) => s + r.boxes[n][end], 0);
          assert.equal(t.boxes[n][end], sum);
          assert.equal(t.boxes[n][end] % n, 0, `total boxes(${n}).${end} not a multiple of ${n}`);
          assert.equal(t.boxes[n][end], t.eligible[n][end] * n);
        }
      }
      assert.equal(t.stacks.lo, [...res.values()].reduce((s, r) => s + r.stacks.lo, 0));
      assert.equal(t.stacks.hi, [...res.values()].reduce((s, r) => s + r.stacks.hi, 0));
    }
  }
});

test('reserve never increases capacity and 0% keeps every position', () => {
  for (const w of WAREHOUSES) {
    const [a, b, c] = [0, 10, 37].map((reservePct) => planUnit(w, P({ reservePct })));
    assert.equal(a.stacks.hi, a.layout.count);
    for (const n of LEVELS) {
      for (const end of ['lo', 'hi']) {
        assert.ok(a.boxes[n][end] >= b.boxes[n][end] && b.boxes[n][end] >= c.boxes[n][end], w.name);
      }
    }
  }
});

test('optional ground under upper floors: positions too low for a full stack are excluded, never partial', () => {
  // NAU 16: deck 5.50 m − slab 0.30 − clearance 0.50 = 4.70 m → 4 levels fit, 6 do not.
  const w = WAREHOUSES.find((u) => u.id === 'nau16');
  for (const reservePct of [0, 10, 37]) {
    const r = planUnit(w, P({ excludeUpper: false, reservePct }));
    const L = r.layout;
    const under = L.stacks.filter((_, i) => !L.reserved[i] && L.caps[i] < Infinity).length;
    assert.ok(under > 0, 'expected kept stacks under the upper floor');
    assert.equal(r.capUnder, 4);
    assert.equal(L.eligible[4], L.kept, '4 levels: every kept position takes a full 4-level stack');
    assert.equal(L.eligible[6], L.kept - under, '6 levels: under-floor positions excluded entirely');
    assert.equal(L.boxes[6], (L.kept - under) * 6);
  }
  // A lower deck (cap < 4) removes those positions from both scenarios.
  const low = planUnit({ ...w, mezzAbove: 4.0 }, P({ excludeUpper: false }));
  const L = low.layout;
  const capped = L.stacks.filter((_, i) => !L.reserved[i] && L.caps[i] < Infinity).length;
  assert.ok(low.capUnder < 4 && capped > 0);
  for (const n of LEVELS) assert.equal(L.eligible[n], L.kept - capped);
});

// ---- Height and Ast provenance --------------------------------------------------------
test('heightStatus stays UNKNOWN for 4 and 6 levels until a height is MEASURED', () => {
  assert.equal(DEFAULTS.heightMeasured, false);
  assert.equal(heightStatus(6, P()).status, 'UNKNOWN');
  for (const n of LEVELS) {
    for (const siteHeight of [0, 4, 7.35, 8, 12, 20, null]) {
      assert.equal(heightStatus(n, P({ siteHeight, heightMeasured: false })).status, 'UNKNOWN', `${n} @ ${siteHeight}`);
    }
    assert.equal(heightStatus(n, P({ siteHeight: null, heightMeasured: true })).status, 'UNKNOWN');
    assert.equal(heightStatus(n, P({ siteHeight: 0, heightMeasured: true })).status, 'UNKNOWN');
  }
  // Once measured it is at most a geometric fit, never "OK" / certified.
  assert.equal(heightStatus(6, P({ siteHeight: 7.35, heightMeasured: true })).status, 'FITS_GEOMETRICALLY');
  assert.equal(heightStatus(6, P({ siteHeight: 7.34, heightMeasured: true })).status, 'DOES_NOT_FIT');
});

test('Ast 3.0 m is an explicit planning assumption, never presented as normative', () => {
  assert.equal(DEFAULTS.astMode, 'fixed');
  assert.equal(DEFAULTS.astFixed, 3.0);
  assert.deepEqual({ ...AST_DEFAULT_BASIS }, {
    value: 3.0, provenance: 'A', basis: 'planning-assumption', normative: false, source: null,
  });
  const en = CAP_STR.en.capAisleFixed('3.00');
  assert.match(en, /planning assumption/);
  assert.match(en, /not a normative/);
  assert.match(en, /no universal value/i);
  const ru = CAP_STR.ru.capAisleFixed('3,00');
  assert.match(ru, /планировочное допущение/);
  assert.match(ru, /не нормативное/);
  for (const s of [en, ru, ...CAP_STR.en.capMethod, ...CAP_STR.ru.capMethod]) {
    assert.doesNotMatch(s, /required by|mandatory|per (the )?standard|normative value of/i);
  }
});
