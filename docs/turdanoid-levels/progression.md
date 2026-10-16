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

Arkanoid pass (see `docs/arkanoid-level-research.md`; Oct 2026 progression redesign in `docs/turdanoid-levels/arkanoid-progression-research.md`): all 30 walls are **9 columns** (was 11) so bricks are ~28×20 px on a 320 px phone and ~36×25 px at 390 px. Letters `a`–`f` are 1-hit colour bricks so early rounds read as colour bands and clusters. Speed is the existing `5.4 + min(level×0.16, 3.0)` curve. Drop chance is unchanged (32% → 12% floor).

| Lv | World | Name | Layout | HP | Speed | Drips | Steel | Pattern |
|---:|-------|------|--------|---:|------:|------:|------:|---------|
| 1 | Bathroom | Fresh Tiles | A plain Arkanoid wall. Learn the bounce. | 21 | 5.56 | 0 | 0 | Classic Wall |
| 2 | Bathroom | Rainbow Rows | Three full bands. Aim for the corners. | 27 | 5.72 | 0 | 0 | Colour Bands |
| 3 | Bathroom | Soap Pyramid | First shaped wall. Work the sides in. | 34 | 5.88 | 0 | 0 | Pyramid |
| 4 | Bathroom | Diamond Mine | A rainbow diamond with corner studs. | 45 | 6.04 | 0 | 0 | Diamond |
| 5 | Bathroom | Ripple | First 2-hit tiles ride the wave. | 51 | 6.20 | 0 | 0 | Wave |
| 6 | Bathroom | Tile Keep | Bathroom boss. Steel corners, 2-hit walls. | 59 | 6.36 | 0 | 6 | Fortress |
| 7 | Sewer | Chevrons | Stacked arrows point the way up. | 63 | 6.52 | 0 | 0 | Arrows |
| 8 | Sewer | Bullseye | Rings around a 2-hit bull. | 81 | 6.68 | 0 | 0 | Target |
| 9 | Sewer | Space Turd | The classic invader. Metal eyes. | 89 | 6.84 | 0 | 0 | Invader |
| 10 | Sewer | Up Arrow | A silver arrowhead on a 2-hit shaft. | 93 | 7.00 | 0 | 0 | Arrow |
| 11 | Sewer | Drip Line | Two waves and the first slime drip. | 99 | 7.16 | 1 | 0 | Twin Waves |
| 12 | Sewer | Pump Station | Sewer boss. Steel towers, silver gate. | 108 | 7.32 | 1 | 4 | Castle |
| 13 | Lagoon | Crossfire | Two diagonals cross at a silver heart. | 110 | 7.48 | 2 | 0 | X Cross |
| 14 | Lagoon | Soft Serve | The classic swirl in 3-hit tiles. | 114 | 7.64 | 2 | 0 | Swirl |
| 15 | Lagoon | Checkmate | Punk checkerboard. Every other tile fights back. | 146 | 7.80 | 2 | 0 | Checkerboard |
| 16 | Lagoon | Butterfly | Wings out, steel body. | 166 | 7.96 | 2 | 5 | Butterfly |
| 17 | Lagoon | Love Log | A 4-hit heart that drips. | 167 | 8.12 | 3 | 0 | Heart |
| 18 | Lagoon | Porcelain Gate | Lagoon boss. Steel battlements, silver gate. | 168 | 8.28 | 3 | 9 | Castle |
| 19 | Candy | Tar Pit | Gold-cored hexagon in sticky tar. | 171 | 8.40 | 4 | 0 | Hexagon |
| 20 | Candy | Hourglass | Steel pinch in the middle. | 180 | 8.40 | 5 | 4 | Hourglass |
| 21 | Candy | Diamond Flush | A gold-cored diamond in steel brackets. | 180 | 8.40 | 5 | 8 | Diamond |
| 22 | Candy | Pinwheel | Four arms whirl round a gold hub. | 190 | 8.40 | 5 | 0 | Spiral Arms |
| 23 | Candy | Starburst | A gold star blasts out in eight rays. | 208 | 8.40 | 5 | 0 | Star |
| 24 | Candy | Royal Flush | Candy boss. A crown of gold and steel. | 245 | 8.40 | 5 | 6 | Crown |
| 25 | Throne | Close Encounter | A big grey alien head. Black almond eyes. | 246 | 8.40 | 5 | 0 | Alien |
| 26 | Throne | Skull Bowl | 4-hit skull, gold eyes, dripping grin. | 247 | 8.40 | 6 | 0 | Skull |
| 27 | Throne | Sludge Spiral | Follow the spiral in to the gold core. | 262 | 8.40 | 6 | 0 | Spiral |
| 28 | Throne | Septic Fort | Every wall fights back. | 262 | 8.40 | 6 | 7 | Fortress |
| 29 | Throne | Last Wipe | Dense tar and gold before the king. | 263 | 8.40 | 6 | 5 | Gauntlet |
| 30 | Throne | Anarchy Throne | Final boss. Smash the anarchy sign. | 280 | 8.40 | 8 | 0 | Anarchy |

Steel never counts toward a clear. Drip bricks leak sludge (the same hazard as Boss Flush) until they break. World-boss beats are 6 / 12 / 18 / 24 / 30.
