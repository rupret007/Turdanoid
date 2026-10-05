# TurdAnoid 1000x — breakout lane

Round 4: in-play visual pop (rendering only; HP/scoring/levels unchanged).

## Honest audit (round 4)

| Area | Round-3 | Round-4 focus |
|------|---------|---------------|
| Gameplay | Tally, nudge | Unchanged |
| Feel | Coach, perf caps | Brick chip puff + hit flash; impact rings on all wall hits |
| Graphics | Title great; **in-play wall flat mint** | Rainbow rows per world; stronger brick bevel; gold/metal read; world wall tint |
| Animation | Clear party | Ball glow/trail; paddle plunger redesign; brick white flash on hit |
| Audio | Mute-safe | Unchanged |
| HUD | Mobile chips | Unchanged |
| Mobile/touch | HUD drag | Ball/paddle/bricks readability @320–390 |
| A11y | aria-live | Unchanged |
| Perf | Device tiers | Sprite cache keyed by color (correctness + no wrong tints) |
| Onboarding | Coach | Unchanged |
| Playtest | r3 autoplay | r4 screenshots @390 + 1280 |

**Root cause (r3):** `brickColors` always applied `MATERIAL_PALETTES.sewer` for ~75% of bricks, and sprite cache keys omitted `c1`/`c2` so the first mint sprite was reused for the whole wall.

## Checklist (round 4)

- [x] Row/world rainbow brick hues (≥4 distinct hues per wall); special materials unchanged
- [x] Stronger brick sprites: bevel, specular, bottom lip, visible cracks, gold/metal
- [x] Sprite cache keys include fill colors
- [x] Ball: larger draw radius (`BALL_VISUAL_SCALE`), glow halo, brighter trail
- [x] Paddle: red plunger cup + teal rim + handle; power glow retained
- [x] Per-world `playWallTint` behind brick field in play
- [x] Hit feedback: brick flash-white, chip puff, modest shake; impact ring on hits
- [x] Unit tests for row hues, world rotation, sprite keys
- [x] Autoplay screenshots → `conductor/reviews/turdanoid-1000x/r4/breakout-autoplay/`
- [ ] Shared `SuiteAudio` mixer (shared lane)

## Needs shared change

- Hub badge for `turdanoid_boss_best_v1` and classic best (shared hub 2.0).

## Autoplay findings (2026-10-05, port 8151)

| Session | Avg FPS | Console | Stuck | H-loop |
|---------|---------|---------|-------|--------|
| Classic 390×844 | ~70 | 0 | 0 | 0 |
| Classic 1280×800 | 71.4 | 0 | 0 | 0 |
| Boss 390×844 | 72.3 | 0 | 0 | 0 |

Screenshots: `conductor/reviews/turdanoid-1000x/r4/breakout-autoplay/` (bob-overnight-inject clone).

## Verification

| Check | Result |
|-------|--------|
| `npx vitest run` | PASS (303/303) |
| `npm run lint` | PASS (warnings only, pre-existing) |
| `PLAYWRIGHT_CHANNEL=chromium node smoke-runner.js 8151` | PASS |
| `node scripts/turdanoid-autoplay.mjs 8151 …/r4/breakout-autoplay/` | PASS |
