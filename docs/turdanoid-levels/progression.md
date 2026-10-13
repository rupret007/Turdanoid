# TurdAnoid campaign — level progression

Phone screenshots at 390×844 live beside this note (`before-lXX-390.png` / `after-lXX-390.png`).

## What shipped before this pass

Classic used **18 rotating stamps** (`(level-1) % 18`) on a grid that only grew taller (`4 + floor(level/2)` rows). HP, metal, and Funhouse holes were rolled with `Math.random`.

| Level | World | Stamp | What it actually did |
|------:|-------|--------|----------------------|
| 1 | Bathroom Tiles | Classic Wall | Full 4×8 1-hit rectangle |
| 2 | Bathroom Tiles | Checker | 50% holes, still 1-hit |
| 3–5 | Bathroom Tiles | Tunnel / Wave / Pyramid | Same stamps, random 2-hit sprinkles |
| 6 | Bathroom Tiles | Diamond | Shape only; first random metal |
| 7–11 | Sewer Pipes | Cross → Skull | More rows of the same 18 stamps |
| 12 | Sewer Pipes | Funhouse | Random swiss cheese |
| 13–17 | Toxic Lagoon | Sewer Maze → Columns | Recolored repeats |
| 18 | Toxic Lagoon | Drip Wall | Sine-cut stamp, not a real drip hazard |
| 19–23 | Candy Clog | Classic → Hourglass | First cycle repeat (L19 = L1 shape) |
| 24 | Candy Clog | Brick House | Offset checker |
| 25–29 | Golden Throne | Skull → Plunger X | More rows + random HP |
| 30 | Golden Throne | Funhouse | Same random stamp as L12 |

Difficulty rose mostly by **row count and RNG**, so mid and late walls could play the same. No steel, no campaign drips, no unique late-game fortress.

## What each level does now

All 30 walls are 11 columns, authored as a grid. Speed is the existing `5.4 + min(level×0.16, 3.0)` curve. Drop chance is unchanged (32% → 12% floor).

| Lv | World | Name | Layout | HP | Speed | Drips | Steel | Special |
|---:|-------|------|--------|---:|------:|------:|------:|---------|
| 1 | Bathroom | Fresh Tiles | Two solid 1-hit rows | 22 | 5.56 | 0 | 0 | Lesson |
| 2 | Bathroom | Aim Gaps | Three rows, two aim holes | 29 | 5.72 | 0 | 0 | Aiming |
| 3 | Bathroom | Soap Pyramid | Pyramid | 35 | 5.88 | 0 | 0 | First shape |
| 4 | Bathroom | Pipe Lane | Hollow pipe + strut | 37 | 6.04 | 0 | 0 | Tunnel |
| 5 | Bathroom | Ripple | Wave with first 2-hits | 42 | 6.20 | 0 | 0 | Multi-hit intro |
| 6 | Bathroom | Tile Keep | Fortress, steel corners | 48 | 6.36 | 0 | 6 | World boss |
| 7 | Sewer | Downspout | Vertical 2-hit pipes | 54 | 6.52 | 0 | 0 | Columns |
| 8 | Sewer | Manhole | Shoot-through ring | 56 | 6.68 | 0 | 0 | Ring |
| 9 | Sewer | Iron Joints | Four metal fittings | 63 | 6.84 | 0 | 0 | Metal intro |
| 10 | Sewer | Sewer Maze | Two shafts + corridors | 66 | 7.00 | 0 | 0 | Maze |
| 11 | Sewer | Drip Line | First slime drip | 73 | 7.16 | 1 | 0 | Hazard intro |
| 12 | Sewer | Pump Station | Dual drips, steel frame | 80 | 7.32 | 2 | 6 | World boss |
| 13 | Toxic | Lagoon Gem | 2-hit diamond, twin drips | 84 | 7.48 | 2 | 0 | Diamond |
| 14 | Toxic | Toxic Cross | 3-hit cross | 89 | 7.64 | 2 | 0 | Cross |
| 15 | Toxic | Hourglass Vat | Waist drips | 96 | 7.80 | 3 | 0 | Hourglass |
| 16 | Toxic | Iron Gate | Steel lanes | 105 | 7.96 | 3 | 14 | Steel lanes |
| 17 | Toxic | Eddy | 3-hit box around an eddy | 111 | 8.12 | 3 | 0 | Spiral |
| 18 | Toxic | Sludge Citadel | Steel citadel, four drips | 120 | 8.28 | 4 | 16 | World boss |
| 19 | Candy | Jawbreaker | Gold checker | 122 | 8.40 | 4 | 0 | Gold intro |
| 20 | Candy | Sugar Zig | Descending staircase | 132 | 8.40 | 4 | 0 | Zigzag |
| 21 | Candy | Sticky Swirl | Nested rings | 137 | 8.40 | 5 | 0 | Swirl |
| 22 | Candy | Candy Vault | Steel vault + gold | 145 | 8.40 | 5 | 16 | Vault |
| 23 | Candy | Caramel Wall | Dense 3-hit slab | 152 | 8.40 | 5 | 0 | Density |
| 24 | Candy | Cotton Keep | Gold turrets | 168 | 8.40 | 6 | 14 | World boss |
| 25 | Throne | Gilded Stairs | Gold steps | 169 | 8.40 | 6 | 0 | Steps |
| 26 | Throne | Royal Skull | 4-hit skull, gold eyes | 177 | 8.40 | 6 | 0 | Skull |
| 27 | Throne | Throne Guard | Steel posts, seven drips | 196 | 8.40 | 7 | 10 | Gauntlet |
| 28 | Throne | Crown Jewel | Framed gold gems | 196 | 8.40 | 7 | 16 | Crown |
| 29 | Throne | Royal Gauntlet | Three shafts, eight drips | 203 | 8.40 | 8 | 8 | Lanes |
| 30 | Throne | Golden Throne | Final fortress | 216 | 8.40 | 8 | 14 | Finale |

Steel never counts toward a clear. Drip bricks leak sludge (the same hazard as Boss Flush) until they break. World-boss beats are 6 / 12 / 18 / 24 / 30.
