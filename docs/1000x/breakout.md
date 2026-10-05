# TurdAnoid 1000x — breakout lane

Round 2 implementer audit (extends round 1).

## Honest audit

| Area | Round-1 | Round-2 |
|------|---------|---------|
| Gameplay | 30 levels, 19 powers, combos | +Boss Flush opt-in; classic scoring unchanged |
| Feel | Shake, hit-stop, FX gating | Impact rings, paddle squash, shard debris, level-clear stars |
| Graphics | Row gradients, crack stages | Pre-rendered material sprites; 5 themed worlds (6 levels each) |
| Animation | Ball trail, dying husks | Title demo canvas; power capsule labels; confetti on clear |
| Audio | Combo ladder, ambient (default on) | SFX profiles (wall/paddle/metal/gold/clear); ambient default **off** (`turdanoid_v3_ambient=1` to enable) |
| HUD | Power timer bars | End-screen run stats (bricks, max combo, time) |
| Mobile/touch | Drag + launch | Relative drag below HUD (~56px); haptics gated (`turdanoid_v3_haptic`, respects reduced motion) |
| A11y | aria-live announcer | Coach dialog with labelled steps |
| Perf | FX cap, HiDPI wall | Sprite cache; shard/confetti caps via `TurdanoidFX` |
| Onboarding | How-to overlay | 3-step coach (`turdanoid_v3_coach_v1`) |
| AI | N/A | Boss attack phases (sludge intervals) |

## Checklist (round 2)

- [x] `docs/1000x/breakout.md` audit + checklist
- [x] ART: glossy brick sprites + crack decals (`turdanoid-brick-sprite-core.js`)
- [x] Brick shatter shards with physics + cap (`turdanoid-shards-core.js`)
- [x] Five themed worlds, parallax/sky tints (`turdanoid-worlds-core.js`)
- [x] Ball motion trail + impact rings; multiball hue coding
- [x] Paddle squash + power-active edge glow
- [x] Power capsules: icons + letter labels; HUD chips unchanged contract
- [x] Expanded WebAudio SFX + level-clear confetti/stars
- [x] Game-over run stats on end overlay
- [x] Boss Flush mode + `turdanoid_boss_best_v1`
- [x] Mobile HUD-relative drag + haptics gating
- [x] Title attract demo + 3-step coach overlay
- [x] Ambient hum default off, mute-safe
- [x] Reduced-motion gates shards/confetti/juice (unit tests)
- [ ] Shared `SuiteAudio` mixer (shared lane)

## Needs shared change

- Hub badge for `turdanoid_boss_best_v1` and classic best (shared hub 2.0).

## Verification

`npx vitest run`, `npm run lint`, `PLAYWRIGHT_CHANNEL=chromium node smoke-runner.js 8151`.
