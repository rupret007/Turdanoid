# TurdRummy — 1000x lane audit (round 5)

Lane: `turdrummy`. Owns `turdrummy.html`, `games/turdrummy-engine.js`, `tests/turdrummy*.test.js`,
the `turdrummy*AiMs` lines of `CARD_TABLE_FEEL` in `games/suite-feel.js`, the Turdrummy section of
`RULES.md`, and new `games/turdrummy-*.js` / `tests/turdrummy-*.test.js` files.

Round 5 addresses conductor integration screenshots: 320 drawer/hand overlap, HUD height at ≤360px,
readable corner indices in the fan (including when a card is selected), and larger desktop hand cards
at 1280×800 without play scroll.

## Honest audit (round 5 starting point)

### Layout / HUD
- Round 4 put melds in a side drawer on desktop and a fold-under drawer on phones, but at 320px the
  drawer summary could sit on the bottom arc of the hand fan; the status + top bar still consumed
  noticeable height at ≤360px.
- Desktop cards were 68px (62px on short viewports) inside a wide shell — hand felt small vs felt.

### Hand readability
- Fan overlap math targeted a “readable strip” but did not enforce the 16×26px top-left index box;
  without per-card z-index, later cards could paint over neighbours’ corners. Selected lift was
  aggressive enough to steal index hits in tight fans.

### Gameplay / audio / saves / AI
- Unchanged from round 4; `turdrummy_stats_v1` and continue snapshot shapes untouched.

## Round 5 checklist

- [x] 320/≤360: compact HUD (tighter top bar + stats); drawer header clears hand fan (`gap` ≥ 2px).
- [x] Fan layout honours 16px minimum step via `indexStripPx` + `TurdRummyHandVisibility`; cards stack
  with `--fan-z` so top-left indices stay on top; gentler selected lift on phones.
- [x] Desktop 1280×800: hand cards 80px (74px if viewport height ≤860); hand zone grows in flex;
  smoke expects card width ≥ 72px and no play scroll.
- [x] Playwright: `turdrummy-hand-layout-{320,360,390}` + `turdrummy-desktop-hand-hero` in
  `browser-smoke.js` (corner index audit + drawer gap + selected-card re-audit).
- [x] Unit tests: `tests/turdrummy-hand-visibility.test.js`, meld `indexStripPx` wiring.
- [x] `npx vitest run`, `npm run lint`, `PLAYWRIGHT_CHANNEL=chromium node smoke-runner.js 8155` — PASS (round 5 finish).

## Prior rounds (summary)

Rounds 1–4 (through `81dc107`, draft PR #38): SFX, AI, table-first felt, moments QA, skippable
presentation, side drawer desktop layout. See git history for full checklists.

## Autoplay harness

    node scripts/turdrummy-autoplay.mjs [--scenarios=phone,small,desktop,reduced,continue,keyboard,moments]
         [--rounds=2] [--match] [--seed=1] [--out=DIR] [--trace]

## Known limits
- 320×640 may still need a small vertical scroll to see the full action dock + footer note together;
  the hand fan and drawer header are expected to clear each other without overlap.
- `TurdRummyDev.auditHandCornerIndices` is for QA/smoke only.

## Needs shared change (shared lane owns these files)
- `assets/turdsuite.js` `preventDoubleTapZoom()` still cancels quick second taps on pages that call it.
- Hub 2.0 could read `turdrummy_stats_v1` for the cover badge (read-only).
