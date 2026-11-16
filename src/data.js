// ---------------------------------------------------------------------------
// Data model — SCHEMATIC.
//
// The ONLY supplied reference values are the gross total areas (m²) and the
// approximate ~1.25 m ground-floor level difference between NAU 3 and NAU 4–6.
// Gross areas are TOTALS and may include upper floors / mezzanines: they are NOT
// footprints and NOT ground-floor areas. Everything else (footprint shapes and
// sizes, arrangement, orientation, heights, whether each unit has a mezzanine,
// mezzanine extent, per-floor areas, direction of the level step) is NOT known
// and is drawn for orientation only.
// ---------------------------------------------------------------------------

// All geometry below is in ARBITRARY MODEL UNITS, not metres. Nothing drawn is
// measured: every unit is drawn as the same-sized tile so that drawn size does
// NOT suggest area. Compare areas with the gross-area legend instead.
export const TILE_W = 22; // model units — identical for every unit, not a measured width
export const TILE_D = 30; // model units — identical for every unit, not a measured depth
export const WALL_HEIGHT = 6; // model units — real heights unknown
export const MEZZ_HEIGHT = 3.2; // model units — indicative deck level, real level unknown
export const MEZZ_FRACTION = 0.35; // share of tile drawn as an indicative (unconfirmed) mezzanine
export const LEVEL_STEP = 1.25; // m — supplied approx. NAU 3 vs NAU 4–6 level difference
// (in the 3D model it is applied as 1.25 model units; the sign/direction is ASSUMED)

export const NOTICE_ES = 'Reconstrucción esquemática, no es un plano de ingeniería.';

// group: 'row' units are drawn side by side; 'apart' units are drawn separately
// (their real relative position is not represented).
// level: relative ground-floor level in metres, or null when not specified.
const RAW = [
  { id: 'nau1', name: 'NAU 1', gross: 1236.1, group: 'row', level: null },
  { id: 'nau2', name: 'NAU 2', gross: 931.9, group: 'row', level: null },
  { id: 'nau3', name: 'NAU 3', gross: 881.2, group: 'row', level: 0 },
  { id: 'nau4', name: 'NAU 4', gross: 577.0, group: 'row', level: LEVEL_STEP },
  { id: 'nau5', name: 'NAU 5', gross: 589.8, group: 'row', level: LEVEL_STEP },
  { id: 'nau6', name: 'NAU 6', gross: 589.8, group: 'row', level: LEVEL_STEP },
  { id: 'nau16', name: 'NAU 16', gross: 810.05, group: 'apart', level: null },
  { id: 'fornal31', name: 'Fornal 31', gross: 1254.88, group: 'apart', level: null },
];

// Categorical palette (distinct hues, readable on light background).
const COLORS = ['#3b6fb6', '#d9822b', '#3a9a6a', '#b8455a', '#7a5cb8', '#2a9bb0', '#a07a2c', '#5d6b7a'];

const GAP = 2; // model units between tiles
const APART_OFFSET = TILE_D + 18; // model units — separation of the "apart" group

function layout() {
  let xRow = 0;
  let xApart = 0;
  return RAW.map((w, i) => {
    // Uniform schematic tile — deliberately NOT proportional to gross area.
    const width = TILE_W;
    const depth = TILE_D;
    let x;
    let z;
    if (w.group === 'row') {
      x = xRow;
      z = 0;
      xRow += width + GAP;
    } else {
      x = xApart;
      z = APART_OFFSET;
      xApart += width + GAP * 4;
    }
    return { ...w, color: COLORS[i], width, depth, x, z };
  });
}

export const WAREHOUSES = layout();
export const GROSS_TOTAL = WAREHOUSES.reduce((s, w) => s + w.gross, 0);

export const FLOORS = [
  { id: 'all', label: 'All levels' },
  { id: 'ground', label: 'Ground floor' },
  { id: 'mezz', label: 'Mezzanine (unconfirmed)' },
];

export const fmt = (n) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function levelText(w) {
  if (w.level === null) return 'Not specified (drawn at datum)';
  if (w.level === 0) return 'Reference (±0.00) for the NAU 3 / NAU 4–6 step';
  return `≈ ${w.level.toFixed(2)} m different from NAU 3 — drawn higher, but the direction of the step is assumed`;
}

export const MEZZ_STATUS =
  'Unconfirmed — presence, extent and per-floor areas are not known for this unit. The hatched deck is an indicative placeholder only.';

export function shortLevel(w) {
  if (w.level === null) return 'level n/s';
  if (w.level === 0) return 'level ref. ±0.00';
  return `≈ +${w.level.toFixed(2)} m · dir. assumed`;
}
