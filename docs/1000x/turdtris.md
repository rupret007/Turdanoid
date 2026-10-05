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
