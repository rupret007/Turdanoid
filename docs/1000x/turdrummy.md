# TurdRummy — 1000x lane audit (round 4)

Lane: `turdrummy`. Owns `turdrummy.html`, `games/turdrummy-engine.js`, `tests/turdrummy*.test.js`,
the `turdrummy*AiMs` lines of `CARD_TABLE_FEEL` in `games/suite-feel.js`, the Turdrummy section of
`RULES.md`, and new `games/turdrummy-*.js` / `tests/turdrummy-*.test.js` files.

Round 4 is the final polish pass: big-moment QA frames, desktop table hero with a side stats drawer,
a tighter 320 HUD, and skippable round-end presentation capped at ~3s.

## Honest audit (round 4 starting point)

### Gameplay
- Unchanged rules and scoring; match totals remain comparable. QA hooks (`?moment=` / `TurdRummyDev.playMoment`) drive knock, gin, undercut and match-win without touching save keys.

### Layout / HUD
- Round 3 folded melds/log/stats under the hand on phones; desktop still lost vertical space to that drawer and cards capped at ~62px inside a 1100px shell.
- Round 4: `table-stage` grid puts **Melds, log & stats** in a right-side panel from 921px up; felt + fan fill the left column at 1280×800 without page scroll. App shell widens to 1280px; desktop cards are 68px (62px on short viewports).
- 320px: HUD uses abbreviated labels (Rnd / You / Bot / Stk / DW / Tgt) in one low row so the hand sits higher; smoke IDs unchanged.

### Big moments
- Round 3 added flip reveal, layoff flights, counting banner and trophy. Banner ran 3.6s with no skip.
- Round 4: banner 2.8s, opponent flip stagger capped at 720ms, auto-skip at 3s; **Tap banner or Space** skips to final numbers (and trophy on match win). `scripts/turdrummy-autoplay.mjs --scenarios=moments` writes frames to `conductor/reviews/turdanoid-1000x/r4/turdrummy-moments/`.

### Touch
- Removed the in-page double-tap guard opt-out; shared lane owns the suite fix (no local workaround).

### Audio / AI / saves
- Unchanged from round 3; `turdrummy_stats_v1` and continue snapshot shapes untouched.

## Round 4 checklist

- [x] Big moments QA: seeded `?moment=knock|gin|undercut|match-win` + autoplay `moments` scenario; screenshots at 390 and 1280 under `conductor/reviews/turdanoid-1000x/r4/turdrummy-moments/`.
- [x] Round-end reveal skippable (tap / Space); presentation auto-capped at 3s; banner under 3s.
- [x] Desktop 1280×800: table hero, side drawer for melds/log/stats, larger cards, no horizontal scroll.
- [x] Phone 320: compact one-row HUD abbreviations; all smoke IDs/labels preserved.
- [x] Unit tests for presentation timing and moment fixtures (`tests/turdrummy-presentation.test.js`, `tests/turdrummy-moments.test.js`).
- [x] `npx vitest run`, `npm run lint`, `PLAYWRIGHT_CHANNEL=chromium node smoke-runner.js 8155` — PASS (round 4 finish).

## Prior rounds (summary)

Round 1–3 (through `515a769`, draft PR #38): SFX, AI feed-risk, table-first felt, meld brackets, flights, coach, autoplay harness, trophy, save-compat tests. See git history and earlier sections in this file’s commits for the full checklists.

## Autoplay harness

    node scripts/turdrummy-autoplay.mjs [--scenarios=phone,small,desktop,reduced,continue,keyboard,moments]
         [--rounds=2] [--match] [--seed=1] [--out=DIR] [--trace]

Moments scenario does not replace vitest; it only captures QA PNGs.

## Known limits
- 320×640 still scrolls the hand under the sticky dock (accepted in round 3).
- `TurdRummyDev` is for QA/autoplay only; not part of the player-facing UI.

## Needs shared change (shared lane owns these files)
- `assets/turdsuite.js` `preventDoubleTapZoom()` still cancels quick second taps on pages that call it. TurdRummy no longer opts out in-page; rely on suite fix + `touch-action: manipulation`.
- Hub 2.0 could read `turdrummy_stats_v1` for the cover badge (read-only).
