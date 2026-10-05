# TurdRummy — 1000x lane audit (round 1)

Lane: `turdrummy`. Owns `turdrummy.html`, `games/turdrummy-engine.js`, `tests/turdrummy*.test.js`,
the `turdrummy*AiMs` lines of `CARD_TABLE_FEEL` in `games/suite-feel.js`, the Turdrummy section of
`RULES.md`, and new `games/turdrummy-*.js` / `tests/turdrummy-*.test.js` files.

## Starting point (deeper read than the round-0 audit)

The round-0 audit (`TURDANOID-1000X-AUDIT-1005.md`) called TurdRummy's gaps "no SFX, cramped hand
at 390px, melds only tinted, flat knock/gin moment, basic AI." After actually reading
`turdrummy.html` end to end, the real picture is more specific — a prior feel pass (see
`docs/SIX_GAME_FEEL_PASS_LAB_HANDOFF.md` / `docs/TURDRUMMY_LAYOFF_HANDOFF.md`) already landed a lot
of this game's visual polish:

- **Gameplay**: full two-player Gin Rummy with a correct bitmask meld solver (`analyzeHand`), a real
  recursive layoff search (`applyLayoff`, covered by `tests/turdrummy-layoff.test.js`), knock/gin/
  undercut scoring, stock-exhaustion draws, and a `turdsuite_continue_v1` table snapshot. This part
  is solid and well tested.
- **Graphics/animation**: cards already have suit-colored foils, ace/court sticker badges, deal-in
  and flip-in keyframes, a fanned opponent hand, a felt table, a bracketed meld-chip readout, a
  segmented "deadwood gauge" HUD, and a "Toilet Boss" mascot that reacts to match events with mood
  emoji, speech bubbles and banners. This is well beyond "melds only tinted."
- **Audio**: **confirmed gap**. The only sounds are the shared `Suite.hype/toast/win/fart` calls
  triggered from a `setMessage` wrapper for a handful of big moments (gin, knock, undercut, match
  win/lose). There is no sound for drawing, discarding, selecting a card, an invalid action, dealing
  a new round, or any AI move — and no on-page mute control (every other table game has its own
  `data-sound-toggle` button and `<game>SoundOn_v1` key; TurdRummy had neither).
- **AI**: plays correct Gin Rummy (deadwood minimization, meld-potential-aware discarding, a
  score-relative knock threshold) but is *purely reactive* — it only ever looks at its own hand. It
  never uses the discard pile as memory, so it is happy to feed the player a card whose neighbors
  it just watched the player discard.
- **Accessibility**: only 5 `aria-*` attributes in the whole page (card buttons' `aria-label`, the
  hub-link label, two `aria-hidden` decorative flags). No `aria-live` region, so the status message
  (which *is* the turn-by-turn narration of the game) is silent to screen readers.
- **Mobile/touch**: tap-to-select + a 4×2 button dock already covers the full input surface at
  390px/320px; sort-suit/sort-rank buttons substitute for drag-reorder. No haptics anywhere.
- **Reduced motion**: already gated for the existing deal/flip/pulse animations
  (`@media (prefers-reduced-motion: reduce)` block), but nothing emits particles today so there was
  nothing to gate there yet.

## Prioritized checklist

### Audio (biggest real gap)
- [x] Add a synthesized SFX bank (`games/turdrummy-audio-core.js` + ESM wrapper `turdrummy-audio.js`)
      covering draw-from-stock, draw-from-discard, card select, discard, invalid action, deal/shuffle,
      a quiet AI-move tick, knock, gin, undercut, round win/lose, match win/lose.
- [x] Independent on-page sound toggle (`#soundToggleBtn`, `data-sound-toggle`, `aria-pressed`),
      persisted under its own new key `turdrummySoundOn_v1` (default on), matching the existing
      per-game pattern (`turdjackSoundOn_v1`, `crapeightsSoundOn_v1`, `turdtrisSoundOn_v1`) rather than
      the shared `turdsuite_muted` flag.
- [x] AudioContext is created lazily and only ever starts oscillators from a real user gesture path
      (button clicks) or after a one-time `pointerdown`/`keydown` unlock, matching the existing
      `assets/turdsuite.js` boot() convention. Never autoplays.
- [x] Unit tests for the pure SFX-spec lookup and the sound-preference load/save round trip
      (`tests/turdrummy-audio.test.js`).

### AI ("tracks discards")
- [x] `games/turdrummy-ai-core.js`: `computeDiscardSafety(discardHistory, card)` — a pure function
      that scores how "dead" a card's rank/run-neighborhood already is in the visible discard pile
      (no new state needed; `state.discard` already *is* the full discard history for the round).
      Wired into the AI's existing `scoreDiscardCandidate` as a small tie-breaking bonus
      (`discardSafetyBias`) — deadwood minimization still dominates; memory only matters on close
      calls, where it now makes the AI noticeably less willing to feed a live run/set.
- [x] Unit tests for the pure safety function (`tests/turdrummy-ai.test.js`): no-history baseline,
      same-rank dead cards, same-suit neighbor-within-2 dead cards, cross-suit cards ignored, and a
      combined case.

### Knock/gin celebration + haptics
- [x] `games/turdrummy-fx-core.js`: pure confetti particle math (`createBurst`, `stepParticles`,
      gravity + drag, dt-clamped) with an ESM wrapper and unit tests
      (`tests/turdrummy-fx.test.js`). The canvas burst (gin, undercut-in-your-favor, match win) is
      only ever created when `prefers-reduced-motion` does *not* match — no canvas, no particles, no
      `requestAnimationFrame` loop at all for reduced-motion users.
- [x] Light `navigator.vibrate` haptics on knock/gin/undercut/match-end, feature-detected, wrapped in
      try/catch.

### Accessibility
- [x] `#messageBox` now has `role="status" aria-live="polite"` — the existing turn narration is
      announced automatically instead of being silent to screen readers.
- [x] New sound toggle exposes `aria-pressed`.

### Not done this round (judged lower ROI than the above, or already adequately covered)
- [ ] Drag-to-reorder the hand. Tap-to-select plus Sort Suit/Sort Rank already cover hand organization
      well; a real drag implementation risks conflicting with the existing tap-to-select/discard flow
      and the 44px mobile dock for a mostly-cosmetic win. Left for a future round if there's appetite.
- [ ] Dedicated brick-by-brick "AI is thinking" indicator — the existing dimmed/desaturated hand during
      the AI's turn plus the turn-meta pill already communicate this; a thinking spinner felt like
      noise on top of the new per-action SFX.
- [ ] Shared `SuiteFX`/`SuiteAudio` modules mentioned in the shared lane's targets do not exist yet, so
      TurdRummy's audio/FX are self-contained in `games/turdrummy-*-core.js`. If the shared lane ships
      `SuiteAudio`/`SuiteFX`, a later round could migrate TurdRummy onto them — tracked as a **Needs
      shared change** below, not attempted here to avoid depending on another lane's in-flight work.

## Needs shared change (shared lane owns these files)

- If/when the shared lane ships `SuiteAudio`/`SuiteFX` (per the round-0 shared-lane targets), it would
  be worth migrating TurdRummy's new `games/turdrummy-audio-core.js` / `games/turdrummy-fx-core.js`
  onto the shared primitives instead of a bespoke per-game AudioContext/canvas, for consistency with
  the other card tables. Not done in this round because the shared modules don't exist yet and this
  lane cannot edit shared files.
- Hub 2.0 per-game stat badges (shared lane target) could surface TurdRummy's `turdrummy_stats_v1`
  (rounds played, gins, undercuts) on the hub card — read-only, no format change needed on this end.
