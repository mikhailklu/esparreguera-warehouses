# Warehouse selector — Esparreguera

A static Vite + Three.js site for choosing between eight warehouse units: NAU 1–6, NAU 16 and Fornal 31. It has a 2D plan in metres, an orbitable 3D massing view, a box-capacity planning simulation, a floor selector (all / ground / upper floor "planta pis"), an area legend, and an EN / RU language switch (`?lang=ru` also works).

> **Basado en planos de proyecto; no es un levantamiento.** (Based on project drawings, not a survey.)
>
> **Not engineering precision. Before relying on any value, note:**
> - **Heights are assumed (A).** The 3D view uses an 8 m building height for every unit. It also places the upper floor 5.5 m above ground for every unit except NAU 16. NAU 16's 5.50 m comes from its spot levels. No sections or elevations were available.
> - **NAU 3's drawn outline is about 7% smaller than its stated area.** The outline encloses about 687 m², against the 737.90 m² stated. Outlines are approximate (±1 m at unlabelled corners), so rely on the stated areas, not on the drawn shapes.
> - **Upper-floor areas for NAU 1–6 are derived (D) as total − ground.** On the drawing, these labels are partly hidden by overprinted text.

The geometry and areas come from the project floor plans. The source documents are **not** part of this repository and are not published. Values in the details panel, the area table and the caveats box carry a provenance tag. Compact labels on the plan, the 3D view and the unit list do not; check the details panel for those values.

| Tag | Meaning |
|---|---|
| **M** measured | Read directly from a dimension, area or level label on a drawing |
| **D** derived | Calculated from measured values (shown at label precision), or scaled from the drawing image (shown with `≈`, rounded) |
| **A** assumed | Not in any readable source. Used only for visualisation |

## Sources used

| Sheet | Drawing | Content used |
|---|---|---|
| A | *Plano planta* (JPG). *Plano planta 20-5-26-3* (PDF) is the same drawing rotated 90° | NAU 1–6: per-floor areas, façade/party-wall dimensions, spot levels, dashed upper-floor lines |
| B | *16* (PDF, 2 sheets: ground and upper floor) | NAU 16: areas, widths, upper-floor depth, levels |
| C | *Plantes finals* (PDF). Plànol 3, 1:100, Feb 2006, Carrer Fornal 31, Pol. Ind. "Can Comelles Sud". The parcel number is deliberately left out, because it is unverified: the title block is too small to read reliably and two readings conflict | Fornal 31: area table, front/rear widths, upper-floor stores and offices |
| — | *Autocad_esparraguera_16_19* (DWG) | **Not read**: binary DWG, and no converter was available |

The three sheets are drawn as **separate framed areas**. Their real positions relative to each other are not documented, so the gaps between the frames are arbitrary.

## Areas (built m², with provenance per value)

These are built (constructed) areas, not usable areas.

- **NAU 16 and Fornal 31:** ground, upper and total are all legible labels (M). Ground + upper = total, which is an independent cross-check.
- **NAU 1–6 (sheet A):** ground and total are legible labels (M). The "Planta pis" (upper) labels are partly hidden by the large grey "NAU n" text printed over them. For example, NAU 5/6 can be read as 136,80, which would not add up (473.00 + 136.80 ≠ 589.80). The upper values below are therefore **total − ground (D)**. On this sheet, ground + upper = total holds by construction and is **not** a cross-check.
- The **Total** row is a sum (D).

| Unit | Ground (planta baixa) | Upper (planta pis) | Total | Drawn outline vs ground | Ground level |
|---|---:|---:|---:|---:|---|
| NAU 1 | 1,117.70 M | 118.40 D | 1,236.10 M | ≈ −1% | +221.65 |
| NAU 2 | 790.00 M | 141.90 D | 931.90 M | ≈ −1% | +221.65 |
| NAU 3 | 737.90 M | 143.30 D | 881.20 M | **≈ −7% ⚠** | +221.65 |
| NAU 4 | 476.80 M | 100.20 D | 577.00 M | ≈ 0% | +220.40 |
| NAU 5 | 473.00 M | 116.80 D | 589.80 M | ≈ 0% | +220.40 |
| NAU 6 | 473.00 M | 116.80 D | 589.80 M | ≈ −1% | +220.40 |
| NAU 16 | 711.25 M | 98.80 M | 810.05 M | ≈ −3% | +221.50 (upper floor +227.00) |
| Fornal 31 | 1,025.77 M | 229.11 M | 1,254.88 M | ≈ +2% | not given |
| **Total** | **5,805.42 D** | **1,065.31 D** | **6,870.73 D** | | |

The "drawn outline" column compares the simplified polygon in this model with the stated ground-floor area (D). The UI flags any unit whose outline differs by 5% or more. Only NAU 3 is flagged.

The floors of NAU 4–6 (+220.40) are **1.25 m lower** than NAU 1–3 (+221.65). This comes from the spot levels; it is no longer an assumed direction.

## Modelling conventions

- Units are metres. Each sheet keeps its drawing's orientation (x to the right, y down). No north arrow was found.
- Outlines are simplified polygons. Edges with dimension labels use the labelled values. Corners without labels were scaled from the drawing image (about ±1 m). The details panel compares each drawn outline area with the stated area.
- Building heights are **assumed** (8 m, A) because there are no sections or elevations. For NAU 16, the upper-floor deck is 5.50 m above ground. That figure is derived (D) from the measured spot levels +227.00 − +221.50. For every other unit, the deck height is an assumed 5.5 m (A). The UI shows these assumptions in an always-visible "Limits of this model" box, in the top banner, and in the 3D view overlay.
- Within sheet A, the 3D floor levels follow the measured spot levels. Each of sheets B and C uses its own datum.

## Box-capacity simulation (planning estimate, not engineering capacity)

> **Estimación de planificación; no es una capacidad certificada. Requiere verificación y aprobación de un técnico competente.**

The sidebar panel, the plan overlay and the 3D view (4 or 6 levels) estimate how many **non-pallet boxes 1.20 × 0.80 × 1.10 m** fit on the **ground floor** of each unit. Gaps of 0.05 m are kept between neighbouring stacks and between boxes in a stack. That gives stack heights of 4.55 m at 4 levels and 6.85 m at 6 levels, plus an adjustable structural clearance.

**Method** (`src/capacity.js`, pure and tested; runs in a Web Worker):

- Real footprints are placed inside each ground-floor polygon of this model, kept at least the wall clearance away from the outline. Positions under upper-floor (planta pis) zones are excluded by default.
- For each unit the planner tries both box orientations (long side along or across the aisle), aisles along x and along y, and the turning (cross) aisle at either end.
- Rows are packed analytically. Block positions across the unit are optimised exactly (dynamic programme on a 5 cm grid). Every block faces an aisle of at least **Ast**; back-to-back blocks keep 0.05 m. A stack only counts if its aisle connects to the turning aisle inside the polygon and outside excluded zones.
- **Reserve (whole positions).** Columns, doors and fire exits are not on the drawings, so a % of the *physical stack positions* is held back. Policy: kept = ⌊positions × (100 − reserve%) / 100⌋, rounded down so capacity is never rounded up. The reserved positions are spread evenly and deterministically over the layout: stacks are ranked by position, and rank k is reserved when ⌊(k+1)·R/N⌋ > ⌊k·R/N⌋. The 2D plan shows them as white dashed footprints and the 3D view as grey footprints, so the drawn stacks are exactly the counted ones.
- **Boxes = whole stacks × levels.** For the 4- or 6-level scenario only kept positions that take a *complete* stack of that height count. Boxes = those stacks × 4 or × 6, so every unit figure, and every total, is a multiple of 4 or 6. Partial stacks are never added.
- **Optional: ground under upper floors.** By default this ground is kept free. If the option is switched off, positions under an upper floor are capped by the assumed deck height (5.5 m; for NAU 16, 5.50 m D) − 0.30 m slab − structural clearance, which gives 4 levels with the defaults. These positions count in the 4-level column but are **left out entirely** of the 6-level column. The panel then marks the 6-level cells with † and lists the number of full 6-level stacks; the plan greys out the positions that are too low for the selected level count. The layout is optimised for the number of positions, not separately for each scenario.
- Results are **ranges**: the low end uses the outline inset by an extra tolerance (outlines are ±1 m), the high end the outline as drawn.
- **Ast is not universal.** It depends on the stacker model, the fork and load length, the load orientation and turning. No stacker model or datasheet was supplied, so no manufacturer value is cited. The default is an adjustable **3.0 m planning assumption** (provenance A). It is not taken from any standard, regulation or datasheet, and it is not a normative or required width. An "equipment" mode uses the simplified geometry Ast ≈ Wa + x + l6 + a, but the manufacturer's Ast for the actual model and load always prevails. Datasheet Ast values refer to pallets (800 × 1200 / 1000 × 1200), not to this box.
- **Height:** the 8 m site height is hypothetical. Feasibility shows **UNKNOWN** until a measured clear height is entered. Even then the result is only a geometric fit, not a certification.
- **Not counted:** upper floors (load rating and goods access not verified).
- **Warnings shown in the UI:** box weight, package compression (BCT), stack stability, slab and upper-floor loading, height, fire access and evacuation (must comply with the current applicable requirements in Spain, including the activity licence, verified by a competent professional; the tool does not certify compliance), and handling without a pallet. Approval by a competent professional is required.

Default results (Ast 3.0 m, turning aisle 3.5 m, 1 stack deep, wall clearance 0.5 m, tolerance 0.5 m, reserve 10%, upper-floor zones excluded):

| Unit | Floor stacks | Boxes at 4 levels | Boxes at 6 levels |
|---|---:|---:|---:|
| NAU 1 | ≈ 260–302 | ≈ 1,040–1,208 | ≈ 1,560–1,812 |
| NAU 2 | ≈ 175–180 | ≈ 700–720 | ≈ 1,050–1,080 |
| NAU 3 ⚠ outline −7% | ≈ 129–135 | ≈ 516–540 | ≈ 774–810 |
| NAU 4 | ≈ 81–90 | ≈ 324–360 | ≈ 486–540 |
| NAU 5 | ≈ 82–90 | ≈ 328–360 | ≈ 492–540 |
| NAU 6 | ≈ 82–90 | ≈ 328–360 | ≈ 492–540 |
| NAU 16 | ≈ 126–138 | ≈ 504–552 | ≈ 756–828 |
| Fornal 31 | ≈ 162–179 | ≈ 648–716 | ≈ 972–1,074 |
| **Total** | **≈ 1,097–1,204** | **≈ 4,388–4,816** | **≈ 6,582–7,224** |

"Floor stacks" are the physical positions kept after the reserve. With the default settings (upper-floor zones excluded) every kept position takes a full 4- or 6-level stack. Each box figure is therefore exactly floor stacks × 4 or × 6. The low and high ends come from two separate layouts (outline inset by the tolerance, and outline as drawn). Totals are the sums of the per-unit low ends and of the per-unit high ends.

The 4- and 6-level figures are conditional. Height feasibility is UNKNOWN until a clear height is measured, and the 3.0 m Ast is a planning assumption, not a normative value.

## Commands

```sh
npm install
npm run dev      # local dev server
npm run build    # static output in dist/
npm run preview  # serve dist/
npm test         # capacity tests (node:test, no extra dependencies)
```
