# TurdAnoid 1000x — breakout lane

Round 5 (final QA): power-up/boss readability, desktop theater layout, capture harness.

## Honest audit (round 5)

| Area | Round-4 | Round-5 |
|------|---------|---------|
| Gameplay | Stable | Unchanged scoring/levels; boss QA hooks only on localhost |
| Feel | Juice + caps | Unchanged |
| Graphics | Rainbow wall | Desktop side gutters + height-filled portrait shell @1280 |
| Power-ups | Capsule art | All types labeled on capsule (`lab`); HUD chips have tooltips; wide layout moves chip column |
| Boss | Phases + sludge | QA hook sets phase HP; capture script for phases/victory |
| HUD | Mobile glass | Side panels show classic/boss best on wide screens |
| Mobile/touch | Unchanged | Phone still full-bleed stage (no letterbox) |
| A11y | aria-live | Chip `title` tooltips; reduced-motion/mute unchanged |
| Onboarding | Coach | Unchanged |
| Perf | Device tiers | Wide mode uses same canvas pixel budget as tall phone (~390×844 aspect) |

## Checklist (round 5)

- [x] QA test hook: spawn capsule, activate power, boss phase, clear tally, game over (`window.__turdanoid` localhost only)
- [x] `scripts/turdanoid-qa-capture.mjs` → `conductor/reviews/turdanoid-1000x/r5/breakout-qa/` (390 + 1280 capsules, active chips, boss phases, tally, game over)
- [x] Power capsule `lab` on every type; HUD chip tooltips via `TurdanoidQA.displayName`
- [x] Desktop 1280×800: `TurdanoidLayout.computePlayfield` height-first portrait shell + side art/HUD gutters
- [x] Unit tests: `tests/turdanoid-layout.test.js`, `tests/turdanoid-qa.test.js`
- [x] Reduced-motion / mute: existing smoke + `turdanoid-fx` / audio tests green
- [x] Classic scoring compat tests green
- [ ] Shared `SuiteAudio` mixer (shared lane)

## Needs shared change

- Hub badge for `turdanoid_boss_best_v1` and classic best (shared hub 2.0).

## What to try on a phone

1. **START FLUSHING** — drag below the HUD; confirm rainbow bricks and glowing ball read clearly at arm’s length.
2. Catch a **🪠 plunger** — watch falling pickups curve toward the seat; chip column should not cover the paddle.
3. Stack **🌀 multiball + 🔥 fire** — three flaming turds; tap to fire lasers/TP/dogs when active.
4. **Boss Flush** from the title menu — dodge sludge; phases should announce in the announcer strip.
5. Toggle **🔇** before first tap if you want silence; respect system **Reduce motion** to calm shake/flash.

## Verification

| Check | Result |
|-------|--------|
| `npx vitest run` | PASS (309/309) |
| `npm run lint` | PASS (warnings only, pre-existing) |
| `PLAYWRIGHT_CHANNEL=chromium node smoke-runner.js 8151` | PASS |
| `node scripts/turdanoid-qa-capture.mjs 8151` | PASS |
