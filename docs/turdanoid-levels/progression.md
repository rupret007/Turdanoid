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

Arkanoid pass (see `docs/arkanoid-level-research.md`): all 30 walls are **9 columns** (was 11) so bricks are ~28×20 px on a 320 px phone and ~36×25 px at 390 px. Letters `a`–`f` are 1-hit colour bricks so early rounds read as colour bands and clusters. Speed is the existing `5.4 + min(level×0.16, 3.0)` curve. Drop chance is unchanged (32% → 12% floor).

| Lv | World | Name | Layout | HP | Speed | Drips | Steel | Pattern |
|---:|-------|------|--------|---:|------:|------:|------:|---------|
| 1 | Bathroom | Fresh Tiles | Two colour bands. Learn the bounce. | 21 | 5.56 | 0 | 0 | Lesson Bands |
| 2 | Bathroom | Rainbow Rows | Four bands with an aim gap. | 34 | 5.72 | 0 | 0 | Colour Bands |
| 3 | Bathroom | Soap Pyramid | First shaped wall. Work the sides in. | 34 | 5.88 | 0 | 0 | Pyramid |
| 4 | Bathroom | Four Corners | Four colour blocks and a cross. | 41 | 6.04 | 0 | 0 | Colour Clusters |
| 5 | Bathroom | Ripple | First 2-hit tiles ride the bands. | 45 | 6.20 | 0 | 0 | Wave |
| 6 | Bathroom | Tile Keep | Bathroom boss. Steel corners, 2-hit walls. | 50 | 6.36 | 0 | 6 | Fortress |
| 7 | Sewer | Downspout | Pipes of 2-hit tiles between bands. | 55 | 6.52 | 0 | 0 | Columns |
| 8 | Sewer | Manhole | A 2-hit ring around a soft core. | 57 | 6.68 | 0 | 0 | Ring |
| 9 | Sewer | Iron Joints | First metal fittings. Four hits each. | 61 | 6.84 | 0 | 0 | Metal Accents |
| 10 | Sewer | Sewer Maze | Silver spine, colour corridors. | 70 | 7.00 | 0 | 0 | Corridors |
| 11 | Sewer | Drip Line | First slime drip. Break it to stop the leak. | 71 | 7.16 | 1 | 0 | Hazard Bands |
| 12 | Sewer | Pump Station | Sewer boss. Two drips behind a steel frame. | 81 | 7.32 | 2 | 6 | Fortress |
| 13 | Lagoon | Soft Serve | The classic swirl, built in 3-hit tiles. | 86 | 7.48 | 2 | 0 | Swirl |
| 14 | Lagoon | Space Turd | An invader with drippy feet. | 110 | 7.64 | 2 | 0 | Invader |
| 15 | Lagoon | Plunger | Metal cup, 3-hit handle. | 115 | 7.80 | 2 | 0 | Plunger |
| 16 | Lagoon | Throne Room | Silver seat, steel feet. | 119 | 7.96 | 2 | 6 | Toilet |
| 17 | Lagoon | Love Log | A 4-hit heart that drips. | 158 | 8.12 | 3 | 0 | Heart |
| 18 | Lagoon | Porcelain Gate | Lagoon boss. Steel battlements, silver gate. | 168 | 8.28 | 3 | 9 | Castle |
| 19 | Candy | Tar Pit | Sticky tar bands, gold glints. | 173 | 8.40 | 4 | 0 | Tar Bands |
| 20 | Candy | Hourglass | Steel pinch in the middle. | 182 | 8.40 | 4 | 4 | Hourglass |
| 21 | Candy | Diamond Flush | A gold-cored diamond in steel brackets. | 185 | 8.40 | 4 | 8 | Diamond |
| 22 | Candy | Skull Bowl | 4-hit skull, gold eyes, dripping grin. | 221 | 8.40 | 4 | 0 | Skull |
| 23 | Candy | Clog Lattice | Steel lattice with tar pockets. | 232 | 8.40 | 4 | 15 | Mesh |
| 24 | Candy | Royal Flush | Candy boss. A crown of gold and steel. | 245 | 8.40 | 5 | 6 | Crown |
| 25 | Throne | Twin Pipes | Two steel pipes split the board. | 254 | 8.40 | 5 | 12 | Split |
| 26 | Throne | Sludge Spiral | Follow the spiral in to the gold core. | 259 | 8.40 | 5 | 0 | Spiral |
| 27 | Throne | Cathedral | Steel arches over gold windows. | 277 | 8.40 | 5 | 8 | Arches |
| 28 | Throne | Septic Fort | Every wall fights back. | 289 | 8.40 | 6 | 7 | Fortress |
| 29 | Throne | Last Wipe | Dense tar and gold before the king. | 299 | 8.40 | 6 | 5 | Gauntlet |
| 30 | Throne | Sewer King | Final boss. Gold, steel and eight drips. | 321 | 8.40 | 8 | 7 | Boss Wall |

Steel never counts toward a clear. Drip bricks leak sludge (the same hazard as Boss Flush) until they break. World-boss beats are 6 / 12 / 18 / 24 / 30.
