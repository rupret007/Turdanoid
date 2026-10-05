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
- [ ] Optional separate Sprint 40L / Ultra 2-minute modes (stretch; classic compatibility takes priority).


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
