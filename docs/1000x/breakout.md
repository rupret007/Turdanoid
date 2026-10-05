# TurdAnoid 1000x — breakout lane

Round 1 implementer audit (extends conductor round-0 review).

## Honest audit

| Area | Round-0 baseline | Round-1 notes |
|------|------------------|---------------|
| Gameplay | Strong: 30 levels, 19 powers, combos, metal bricks, stink cloud | +5 wall patterns; material variety on bricks; scoring unchanged |
| Feel | Shake, hit-stop, paddle english, danger vignette | FX module gates shake/flash/parallax/particles under `prefers-reduced-motion` |
| Graphics | Neon row gradients, toilet paddle, parallax sewer | Material palettes (porcelain/slime/tar/candy), crack stages, level intro banner |
| Animation | Dying brick husks, ball trail, slime drips | Level intro fade on canvas; power chip timer bars |
| Audio | WebAudio SFX, fart death | Combo pitch ladder module; optional sewer ambient (`turdanoid_v3_ambient`, default on) |
| HUD | Glass chips, combo center, power chips | Timer bars on active powers; aria-live announcer for level/clear/start |
| Mobile/touch | Drag + launch button, no horizontal scroll | Unchanged contracts; pause shows touch hints |
| A11y | HUD `aria-hidden`; minimal live regions | `#announcer` polite live region; pause control help |
| Perf | FX cap 160, HiDPI wall pattern | Burst clamp when reduced motion; no extra DOM per frame |
| Onboarding | Title + How To Play | Pause overlay quick reference |
| AI | N/A | N/A |

## Checklist

- [x] `docs/1000x/breakout.md` audit + checklist
- [x] Brick materials + crack stages (`games/turdanoid-brick-core.js`)
- [x] Five new handcrafted layouts (`games/turdanoid-levels-core.js`)
- [x] Reduced-motion FX gating (`games/turdanoid-fx-core.js`) + unit tests
- [x] Combo SFX pitch ladder (`games/turdanoid-audio-core.js`) + tests
- [x] Power-up timer bars on HUD chips
- [x] Pause overlay controls help
- [x] aria-live announcer (level intro, clear, start)
- [x] Canvas level intro banner
- [x] Ambient sewer hum (new opt-out key `turdanoid_v3_ambient`)
- [x] RULES.md pattern count + pause note
- [ ] Boss/special stage (deferred — needs design)
- [ ] Shared `SuiteAudio` mixer (shared lane — see below)

## Needs shared change

- Hub per-game best badge reading `turdanoid_v2_best` (shared lane hub 2.0).
- Optional global `SuiteFX` if other arcade games want the same shake/flash helpers without copy-paste.

## Verification

Run before merge: `npx vitest run`, `npm run lint`, `PLAYWRIGHT_CHANNEL=chromium node smoke-runner.js 8151`.
