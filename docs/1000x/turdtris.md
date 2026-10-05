# Turdtris — 1000x lane (round 1)

## Round-0 audit (deeper)

### Gameplay
- **Strong:** 7-bag, SRS kicks, hold, ghost, lock delay + move resets, T-spin detection, B2B on tetris/t-spin, combo scoring, clutch bonus, 69-level run with escalating garbage mutators, spawn recovery, frame hitch clamp (33ms).
- **Weak:** No visible T-spin mini/single taxonomy in HUD; DAS/ARR only mirrored in HTML (not wired to `DasTracker` module); no hard-drop finesse stats; mutators are fair but telegraphed only in status text.

### Feel
- **Strong:** Scene shake on big clears, lock flash, line-clear shrink + sweep, spark bursts, float text for perfect/clutch, danger vignette on stack, Plunger Boss mascot + danger border, combo card pulses near overflow.
- **Weak:** Level-up moment is mostly status/hype text; B2B/combo not always shown as board callouts; shake/sparks not centrally capped for reduced motion.

### Graphics / art
- **Strong:** HiDPI canvas, beveled glossy tiles, garbage cracks, themed wells per level band, ghost outline, preview polish.
- **Weak:** No parallax/backdrop animation on board; pieces are generic guideline colors (on-brand but not “character” silhouettes).

### Animation
- **Strong:** Clear FX, overlay pop, mobile dock, pb-boss reactions.
- **Weak:** No dedicated level-up flash band on the well; HUD tiles don’t pop on score milestones.

### Audio
- **Strong:** Per-action WebAudio profiles, sound pref `turdtrisSoundOn_v1`.
- **Weak:** Single-oscillator beeps; no line-count pitch ladder; does not honor hub `turdsuite_muted`; no soft ambient loop (acceptable for scope).

### HUD / UI
- **Strong:** Six-tile HUD, next-flush progress with honest modifier preview, game-over receipt with new-best, desktop side panel.
- **Weak:** Mobile: tagline + 6 HUD tiles push board down before dock; status block is verbose.

### Mobile / touch
- **Strong:** Fixed thumb dock (all actions visible), hold/next on dock, hold dim + refuse second swap, pointer repeat on D-pad, canvas swipe/tap gestures.
- **Weak:** Gestures always on (no toggle); board-first 390×844 still tight without compact header mode.

### Accessibility
- **Strong:** progressbar ARIA on level pulse, aria-label on dock previews, reduced-motion on stack-danger card and pb-danger.
- **Weak:** No aria-live on status/hype; guide is visual-only; sound toggle not linked to suite master mute.

### Performance
- **Strong:** Spark/clear lists capped in render loop; DPR clamp 3; single canvas playfield.
- **Weak:** Up to 26 sparks per clear every time — needs reduced-motion cap.

### Onboarding
- **Strong:** Welcome guide, quick start, Suite.guide persistence.
- **Weak:** Guide doesn’t mention swipe controls or gesture toggle.

### AI
- N/A (single-player).

## Checklist (round 1)

- [x] `games/turdtris-fx.js` — reduced-motion gating, spark caps, shake decay, clear callouts, level-up flash timing
- [x] `games/turdtris-audio.js` — layered WebAudio SFX + suite mute respect
- [x] `games/turdtris-layout.js` — mobile board-first CSS class helper
- [x] Extend `TURDTRIS_FEEL` in `games/suite-feel.js` + HTML constant sync test
- [x] Board-first mobile layout (compact topbar/HUD, larger board cap)
- [x] Level-up canvas flash + callout text
- [x] Combo / B2B floating callouts on clears
- [x] Richer clear/rotate/drop SFX wired through audio module
- [x] Honor `turdsuite_muted` when playing SFX
- [x] Opt-in gesture toggle (`turdtrisGestures_v1`) in run menu + guide line
- [x] Unit tests for fx, audio, layout, suite-feel alignment
- [x] Update Turdtris section of `RULES.md`
- [ ] Shared `SuiteAudio` mixer (owned by **shared** lane — see below)
- [ ] Hub per-game stat badge for `turdtrisHighScore` (**shared**)

## Needs shared change

- Hub should read `turdtrisHighScore` for cover badges (shared lane).
- Optional global `SuiteAudio` module to dedupe oscillator code across games (shared lane).
- Round 2 repository lint exits successfully but has six pre-existing unused-import warnings outside this lane: `RANKS`, `SUITS`, `hiLoValue` in `games/turdjack-engine.js`; `RANKS`, `SUITS` in `tests/crapeights.test.js`; `MIN_BET` in `tests/turdjack.test.js`. Route cleanup to the owning lanes for a warning-free repository lint. Turdtris files have zero warnings/errors.

## Round 2: deeper audit and implementation targets

Read the conductor's round-0 audit and the live inline engine. The engine in `turdtris.html` is authoritative; `turdtris-engine.js` is a simplified test engine, so changing that alone would not upgrade gameplay.

- **Gameplay:** The live game already awards T-spins, perfect clears, combo and B2B; those amounts and the decimal-string `turdtrisHighScore` contract must remain intact. The old single-line callout incorrectly says MINI for every single. Rotation detection needs direct compatibility coverage. No AI applies to this single-player game.
- **Feel / animation:** Existing tile gradients are rebuilt every frame. Ghost is static, hard drop teleports, and locks only flash. Clear rows collapse in logic immediately (keep this responsiveness), but their visual snapshots share a shifted row index and lack a convincing flush. Spawn feedback is mostly invisible above the board.
- **Art:** Color palettes and a tiled gradient are present, but no recognizable environments or piece personalities. Cached procedural materials and four illustrated environments will provide the largest visible change.
- **Audio:** Existing SFX have some layers but no movement/soft-drop identity, heartbeat, or music. Audio context creation can be reached from automatic events; explicitly gate all new audio on a gesture and stop music at every pause boundary.
- **HUD / meta:** Live score fields are readable but occupy too much vertical space on phones. Existing game-over receipt lacks time, pieces per second, peak combo and tetrises. No separate challenge mode exists; classic stays default.
- **Mobile:** Board width currently depends on viewport width without reserving the fixed dock's height. At short phone heights its bottom can sit behind the dock. Hold/Next already live in the dock and all smoke-tested labels must stay. Slow down-swipes currently slam unintentionally; distinguish deliberate flicks from soft drops.
- **Accessibility / onboarding:** Motion preferences are partly observed, but float text, overlay pops and shrinking rows still move. Settings need visible labels, keyboard access, and safe focus handling; screen-reader announcements should change only on gameplay events. Teach ghost, lock meter and gesture differences concisely.
- **Performance:** Retain one RAF, pre-render art, cap all particle/effect queues, avoid frame-by-frame DOM updates. Use clamped game delta for gravity and measured active time for the run receipt. No runtime network assets or added dependencies.

### Round 2 checklist

- [x] Cached per-piece jelly / porcelain / slime sprites, highlights, texture, faces, and garbage material.
- [x] Animated ghost shimmer, visible spawn pop, lock squash, hard-drop streaks and bounded impact dust.
- [x] Distinct drain-flush row animation, line-scaled bursts and readable TURDTRIS takeover.
- [x] Tested live-compatible T-spin and perfect-clear detection; accurate callouts, unchanged scoring.
- [x] Bathroom → sewer → lagoon → space toilet environments, restrained ambient animation, danger pulse and heartbeat.
- [x] Gesture-gated synth music with level tempo, new opt-out key, immediate mute/pause/visibility shutdown; distinct action SFX.
- [x] Run-menu DAS / ARR / soft-drop settings with existing defaults, validated new settings key.
- [x] Lock-delay meter and one-shot short rotate-on-spawn buffer; pause clears pending input.
- [x] 390×844 board + Hold/Next + dock fit; 320×640 usable board; ≥44px thumb controls, press feedback and reduced-motion-aware haptics.
- [x] Tested gestures: tap rotate, horizontal swipe, slow down soft drop, fast vertical flick hard drop; guide updated.
- [x] Game-over receipt: max combo, tetrises, active time, PPS, personal-best celebration; old high-score key unchanged.
- [x] Reduced-motion policies and unit tests for every new effect family; legacy score/settings compatibility tests.
- [x] Full Vitest suite, lint, and Chromium smoke (including held-input-pause) pass; see the shared lint warnings and host-load test invocation below.
- [x] Optional separate Sprint 40L / Ultra 2-minute modes (completed in round 3 with isolated records).


### Round 2 implementation notes

- Added a cached procedural sprite/background renderer (eight materials with faces; four illustrated chapters). Art is rendered once per material/theme; ghost, spawn, squash, drop, drain, takeover and danger policies have direct reduced-motion tests. Maximum retained clear/dust particles: 72, drop trails: 3, clear rows/lock groups/float labels: 12 each. No runtime network assets.
- Replaced overlapping global hype banners with canvas clear callouts and a readable personal-best receipt. Phone layouts reserve the dock height explicitly; the existing Hub shortcut moves into the phone header, keeping the shared navigation escape visible without obscuring board cells.
- At 390×844, measured board = 257×514, bottom 640, dock top 665. At 320×640, board = 169×338, bottom 450, dock top 461. Both have 48px controls, zero horizontal or vertical document overflow, all Hold/Next/controls visible, and no console errors. Desktop 1280×900 also fits the entire board without overflow. Physical-device audio/tactile feel remains unverified.
- Input and music keys are additive: `turdtrisInputFeel_v1` and `turdtrisMusic_v1`. Old high scores remain decimal strings; no continuation snapshot formats were touched. Classic scoring matches live-page tests for single/double/triple/tetris, each perfect-clear bonus, and T-spin no-line. No scoring changes or challenge modes were introduced.
- Music is armed only by a trusted gesture and stops on pause/guide/blur/game over. Page sound and suite mute silence it and all game SFX; legacy duplicate Suite sound calls were removed. Music opt-out retains action sounds and the danger heartbeat.
- New settings are accessible from desktop and phone Run Menu. Opening pauses; closing resumes only when the menu itself paused the run. Explicit Resume/Restart closes the menu. Native settings keys and keyboard activation of dock buttons work without game-key interference.
- Optional Sprint/Ultra remain deferred: the required visual, audio, input, accessibility and compatibility work is complete; classic remains the only mode with unchanged comparable scores.

### Round 2 validation

- Targeted module tests: PASS (art, audio, FX, layout, presentation).
- Live-page integration tests: PASS (38 tests before final full-suite run), including gesture-only audio, music opt-out, all pause boundaries and blocked-storage mute fallback.
- In-memory Chromium visual/geometry checks: PASS at 320×640, 390×844 and 1280×900; four-row flush/perfect-clear receipt and settings pause/restart checked. No screenshot assets added to the repository.
- Full Vitest: PASS — 22 files / 351 tests, using `VITEST_MAX_WORKERS=1 npx vitest run --testTimeout=30000`. The initial plain `npx vitest run` and two-worker retry hit only 5-second timeouts in unchanged hub/card suites under heavy host load (load average rose above 60); assertions and repository configuration were not changed. The serial full run passed in 333.5 seconds.
- `npm run lint`: PASS exit 0, zero errors. Six pre-existing warnings in other lanes remain listed under Needs shared change; all Turdtris modules/tests are clean.
- `PLAYWRIGHT_CHANNEL=chromium node smoke-runner.js 8152`: first run caught the hidden phone Hub escape plus a held-repeat timing check under host load. Hub escape restored visibly in the header; repeat timing remains the original 148ms / 52ms. In the permitted Turdtris-only smoke block, the press and 70ms observation now execute in one browser evaluation: host round trips were stretching the intended 70ms sample beyond 148ms. All immediate-move, pending-repeat, active-repeat, release and pause assertions remain. Final rerun: PASS — `Browser smoke checks passed`, including phone Hub navigation and `turdtris-held-input-pause`.
- Physical-phone audio, haptics and frame-rate profiling: NOT RUN.

Round 2 complete: 13 / 14 targets done; only the optional Sprint/Ultra stretch target remains. All changes are committed locally on the lane branch.

## Round 3 — quality, playtest, finish

### Honest audit before implementation

- **Gameplay:** Classic's live inline scoring differs from the simplified engine module. Compatibility must exercise the HTML against b3821b4, including combo indexing, B2B ordering, drop points and the actual gravity curve. Separate timed/line challenges remain absent.
- **Feel / graphics / animation:** The procedural cabinet and four chapters are established. Short-phone overlays and legibility need screenshot review during sustained play, rather than only initial-state geometry checks. Busy clear effects can obscure the landing zone.
- **Audio:** Gesture and mute gating have unit coverage; the sustained browser exercise must include a persisted mute and verify that no audio context starts there.
- **HUD / mobile:** The dock fits both phone sizes in prior measurements, but sustained score growth, pause/menu transitions and end receipts still need automated coverage at 320px. Preserve smoke-tested controls and labels.
- **Accessibility / onboarding:** Reduced-motion behavior exists but needs a complete browser run. Guide/menu pause ownership must be checked while movement is held; keyboard focus must not accidentally drive the board.
- **Performance:** Cached material artwork exists, but the renderer still constructs a Map each frame, copies particle arrays, creates option/envelope objects per tile and builds gradients for trails. These are measurable optimization targets, not grounds to claim 60fps before profiling.
- **AI:** No opponent AI applies. A simple placement bot is useful as a sustained gameplay test driver, with real input paths and progress assertions.

### Round 3 checklist

- [x] Standalone autoplay harness: ~90s each at 390×844, 320×640, 1280×800, reduced-motion and muted; screenshots every ~10s plus machine-readable FPS, long tasks, errors and state checks.
- [x] Inspect captured screenshots; fix cramped/overlapping HUD, overlays, dock targets and poor tile/environment contrast.
- [x] Pin live Classic scoring and speed/level progression to b3821b4 in Vitest.
- [x] Remove avoidable steady-frame render allocations and verify sprite/background caching with tests and browser measurements.
- [x] Opt-in Sprint 40L and Ultra 2-minute modes with isolated new best keys and specific completion receipts.
- [x] Full `npx vitest run`, `npm run lint`, and Chromium smoke on 8152; document measured FPS and remaining limitations.

The explicitly requested `scripts/turdtris-autoplay.mjs` and this lane report are the only additions outside the lane's game/test file patterns. Generated evidence goes to the conductor's explicitly requested screenshot directory; no other checkout is modified.

### Changes and evidence

- **Screenshot-led fixes:** Inspected actual 320px onboarding, active play, pause, menu, end receipts and environment fixtures. Phone overlays now span the cabinet instead of squeezing inside the 169px board; calm opaque panels replace competing tile patterns. Guide actions remain visible while instructions scroll. Sprint's time fields and five-digit scores exposed HUD ellipses; weighted columns and responsive tabular type fix those, with explicit overflow checks in autoplay. Ghost outlines now retain approximately a full CSS pixel of stroke on the smallest phone board; solid tiles remain distinct in all four environments.
- **Modes:** Classic loads by default and retains its decimal-string best unchanged. Run Menu explicitly starts Sprint (40 lines, completed runs only, best milliseconds in `turdtrisSprint40BestMs_v1`) or Ultra (120 active seconds, best score in `turdtrisUltra120Best_v1`). Challenges use existing score/speed progression without garbage and have mode-specific receipts. Pause, guide and blur exclude inactive time. Independent active-time checks before scoring input prevent overtime drops during a delayed animation frame and preserve Sprint's final partial frame. No continuation keys or snapshot shapes changed.
- **Classic pins:** 44 actual-page tests derive expectations directly from `git show b3821b4:turdtris.html`, not the simplified exported engine. They pin line awards, T-spins, perfect clears, clutch, combo indexing, B2B ordering/persistence, both drop paths, the complete gravity table, level goals and surplus lines. The historical held gravity soft-drop path remains worth zero extra points; discrete soft drops are one point per cell and hard drops two.
- **Rendering:** All 29 fixed-resolution assets (16 tiles/ghosts, eight trails, four environments, danger veil) rasterize once at factory initialization, then scale for board/preview/resize. Pixel backing is approximately 4.2 MiB. Reusable cell buffers and drawing arguments replace per-frame maps, option/envelope objects, effect-array copies, tile lookup arrays and trail gradients. Audio queues compact in place. Clear/spawn events and new WebAudio voices still allocate bounded objects; this is not a claim that the entire browser or every game event is allocation-free.
- **Harness:** `PLAYWRIGHT_CHANNEL=chromium node scripts/turdtris-autoplay.mjs` serves only this checkout on 8152 and closes its browser/server. Five serial 90-second variants use real dock/keyboard inputs and a simple placement heuristic, with state/error/overflow/canvas-cache/audio checks and raw frame/long-task samples. Screenshots every ~10s plus onboarding/pause/menu. Clearly labeled, post-measurement synthetic fixtures cover topout/replay, Sprint completion, Ultra timeout, isolated records and all four environments; their scores/levels are never claimed as bot achievements.
- **Full tests PASS:** Final plain **`npx vitest run`: 24 files / 439 tests PASS**, 19.84s, after the autoplay fixes. An earlier plain run had 11 timeout-only failures in unchanged hub/card/breakout suites under host load (~36); a serial retry also passed all 439 tests in 249.63s. No assertions or shared test configuration were weakened. Targeted scoring/mode tests: 82/82 PASS; final art/FX checks: 20/20 PASS.
- **Lint PASS with shared warnings:** `npm run lint` exits 0, zero errors; the same six pre-existing shared warnings listed above remain. Turdtris modules/tests are clean. `node --check scripts/turdtris-autoplay.mjs` and `git diff --check` also pass.
- **First sustained playtest:** Four variants passed; reduced motion exposed a leftover positive shake budget after level changes, although the renderer already suppressed the movement. Set the Turdtris reduced-motion shake cap to zero and pin that behavior explicitly. Visual review also widened the small Sprint Combo column. An apparently shifted 390px receipt was a capture during its reveal; waiting 800ms for post-measurement receipt screenshots produces the correctly centered panel. First-pass reports are retained under `first-pass/`; the final complete five-variant rerun passes.

### Final measured autoplay — PASS

Recorded 2026-10-05 08:19 UTC with headless Chromium. Each scenario ran for at least 90 seconds, serially, without concurrent tests. These are browser rAF pacing measurements on this host, **not physical-phone GPU or tactile/audio validation**.

| Scenario | Measured seconds | Mean rAF FPS | P95 frame (ms) | Long tasks (>50ms) | Bot placements | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 390×844 | 90.473 | 73.50 | 26.3 | 0 | 170 | PASS |
| 320×640 | 90.056 | 69.49 | 26.4 | 1 (59ms) | 163 | PASS |
| 1280×800 | 90.232 | 70.40 | 22.1 | 0 | 311 | PASS |
| Reduced motion, 390×844 | 90.036 | 70.19 | 22.4 | 0 | 233 | PASS |
| Muted, 390×844 | 90.206 | 73.38 | 26.9 | 0 | 188 | PASS |

- **Zero** console errors, page errors, unexpected dialogs, horizontal overflow, stale pause/guide overlays, stuck runs, undersized touch targets, or cache growth across all five runs. Exactly 29 created canvases before and after each measured segment. The muted scenario started **zero** oscillators. Reduced motion retained no shake, particles or trails. Desktop, reduced-motion and muted runs also exercised natural topouts and successful replays.
- At 390×844, the board is 257×514 at y=125 (bottom 639); dock starts at 665. At 320×640, it is 169×338 at y=109 (bottom 447); dock starts at 461. All seven dock actions are at least 44×44px. Final screenshot review confirms complete Sprint times, five-digit scores and Combo labels, centered receipts, legible ghosts and all four environment contrasts.
- The output root is `/Users/jeffstory/Documents/bob-overnight-inject/conductor/reviews/turdanoid-1000x/r3/turdtris-autoplay/`. `summary.md`/`summary.json` contain the final five PASS results; each scenario includes raw `measurements.json`, its state/error `report.json`, gameplay screenshots every ~10s, and labeled synthetic receipt/environment fixtures. Earlier diagnostic captures remain under `probe/` and `first-pass/`.
- Physical phone audio, vibration and GPU frame-rate testing: **NOT RUN**. No new shared code change is required for these features; the six existing shared lint warnings and optional prior hub/audio work remain under Needs shared change.

### Final smoke and completion

- **Smoke PASS:** `PLAYWRIGHT_CHANNEL=chromium node smoke-runner.js 8152` printed `Browser smoke checks passed` with exit 0, including `turdtris-held-input-pause`, mobile dock and restart/receipt checks. Run once after all fixes; no smoke assertions or shared smoke files changed this round.
- **Final lint PASS:** `npm run lint` again exited 0 with zero errors and only the six pre-existing out-of-lane warnings. Script syntax and final whitespace checks pass.
- **Round 3 checklist: 6 / 6 done.** Implementation, tests, harness and report are committed locally on `cursor/turdanoid-1000x-turdtris`. Classic save/score compatibility is intact; optional challenge bests use new keys only.
