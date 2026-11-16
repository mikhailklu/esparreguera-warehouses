# Warehouse selector (schematic)

A static Vite + Three.js site that lets you pick between eight warehouse units (NAU 1–6, NAU 16, Fornal 31). It has a responsive 2D schematic diagram, an orbitable 3D view, a level selector (all / ground floor / mezzanine) and an area legend.

> **Reconstrucción esquemática, no es un plano de ingeniería.**
> (Schematic reconstruction — not an engineering drawing.)
>
> The only reference values are the gross total areas and an approximate 1.25 m ground-floor level difference between NAU 3 and NAU 4–6. Everything drawn is illustrative and not to scale.
>
> - **Gross areas are totals.** They may include upper floors or mezzanines. They are **not** measured footprints and **not** ground-floor areas.
> - **Mezzanines are unconfirmed for every unit.** Whether each unit has one, how big it is, and the area on each floor are all unknown. The hatched deck is a placeholder.
> - **The step direction is assumed.** NAU 4–6 are drawn higher than NAU 3, but the source does not say which side is higher.
> - Footprint shapes and sizes, positions, orientation and heights are not known.

| Unit | Gross m² |
|---|---|
| NAU 1 | 1,236.10 |
| NAU 2 | 931.90 |
| NAU 3 | 881.20 |
| NAU 4 | 577.00 |
| NAU 5 | 589.80 |
| NAU 6 | 589.80 |
| NAU 16 | 810.05 |
| Fornal 31 | 1,254.88 |
| **Total** | **6,870.73** |

## Commands

```sh
npm install
npm run dev      # local dev server
npm run build    # static output in dist/
npm run preview  # serve dist/
```

`dist/` uses relative paths, so you can host it from any static server or subfolder.

## Schematic conventions

- Geometry uses arbitrary model units, not metres. There is no scale bar.
- Every unit is drawn as the same-sized placeholder tile, so drawn size says nothing about area. To compare sizes, use the gross-area legend (bars and percentages).
- On-screen labels show only the gross total (marked "gross total, all floors"). They show no widths, depths or per-floor areas.
- NAU 3 is the reference (±0.00). NAU 4–6 are drawn about 1.25 higher, but that direction is assumed. Other units have no level given and are drawn at the datum.
- Wall and mezzanine-deck heights are placeholders in model units. Every unit gets the same indicative mezzanine deck, and its presence, extent and per-floor area are unconfirmed. When you pick the "Ground floor" or "Mezzanine" level, per-level area is shown as not known.
- NAU 16 and Fornal 31 are drawn apart from the NAU 1–6 row. Their real position is not shown.
