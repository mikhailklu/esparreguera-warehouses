# Warehouse selector — Esparreguera

A static Vite + Three.js site for choosing between eight warehouse units: NAU 1–6, NAU 16 and Fornal 31. It has a 2D plan in metres, an orbitable 3D massing view, a floor selector (all / ground / upper floor "planta pis"), an area legend, and an EN / RU language switch (`?lang=ru` also works).

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

## Commands

```sh
npm install
npm run dev      # local dev server
npm run build    # static output in dist/
npm run preview  # serve dist/
```
