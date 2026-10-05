# TurdAnoid 1000x — breakout lane

Round 3: quality, playtest harness, polish (extends rounds 1–2).

## Honest audit (round 3)

| Area | Round-2 | Round-3 |
|------|---------|---------|
| Gameplay | Boss + worlds | Level-clear **score tally** (skippable); horizontal-rail ball nudge |
| Feel | Shards, confetti | Tally pacing; boss **phase announcer** (aria-live) |
| Graphics | Material sprites | HUD legibility @320px; power capsule label stroke |
| Animation | Clear party | End-screen stat stagger; animated clear bonus count-up |
| Audio | SFX profiles | Unchanged (mute-safe) |
| HUD | Run stats | Tighter mobile chips; less overlap with pause buttons |
| Mobile/touch | HUD-relative drag | Unchanged |
| A11y | Coach | `:focus-visible` rings; Enter on title/pause/end; boss phase messages |
| Perf | Sprite cache | **Device-tier** particle/shard/confetti caps (`turdanoid-perf-core.js`) |
| Onboarding | Coach | Keyboard path title → play → pause → game over |
| Playtest | Manual | **`scripts/turdanoid-autoplay.mjs`** + screenshots |

## Checklist (round 3)

- [x] Self-playtest Playwright harness (`scripts/turdanoid-autoplay.mjs`) → `conductor/reviews/turdanoid-1000x/r3/breakout-autoplay/`
- [x] Screenshot-driven HUD/power readability tweaks
- [x] Level-clear animated tally (bricks, combo, time, lives stars) — Space/tap skip
- [x] Game-over stat card entrance polish
- [x] Perf caps by DPR / `hardwareConcurrency`; pool trimming in hot loop
- [x] Scoring compat vitest (`tests/turdanoid-scoring-compat.test.js`) pins b3821b4 formulas + `turdanoid_v2_best` contract
- [x] Keyboard/focus flow + boss phase announcer
- [x] Horizontal-loop softlock mitigation (`FEEL_MIN_BALL_VERTICAL` / `nudgeBallOffHorizontalRail`)
- [ ] Shared `SuiteAudio` mixer (shared lane)

## Autoplay findings (2026-10-05, port 8153)

| Session | Avg FPS | Min FPS | Console | Stuck-ball heuristic | H-loop |
|---------|---------|---------|---------|----------------------|--------|
| Classic 390×844 | 57.1 | 227* | 0 | 1 brief | 0 |
| Classic 1280×800 | 68.9 | 200* | 0 | 0 | 0 |
| Boss 390×844 | 70.0 | 179* | 0 | 0 | 0 (state `gameover`, score 840) |

\*Min FPS from single-frame rAF spikes (tab compositor), not sustained drops.

No console errors in any session. Boss run completed a full fight (player died). One classic-mobile stuck heuristic fired during a tight horizontal segment; post-fix nudge keeps `horizontalLoops: 0`.

## Needs shared change

- Hub badge for `turdanoid_boss_best_v1` and classic best (shared hub 2.0).

## Verification

| Check | Result |
|-------|--------|
| `npx vitest run` | PASS (300/300; use `--maxWorkers=1` if parallel runs time out on loaded CI) |
| `npm run lint` | PASS (warnings only, pre-existing) |
| `PLAYWRIGHT_CHANNEL=chromium node smoke-runner.js 8151` | PASS |
| `node scripts/turdanoid-autoplay.mjs 8153` | PASS (see table above) |
