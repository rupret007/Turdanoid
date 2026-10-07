# Crapjack 21 — Turdanoid 1000x (lane: crapjack)

Round 7 (table-first phones during play) on branch `cursor/turdanoid-1000x-crapjack`.

## Honest audit (round 7)

### Gameplay
- **Strong:** Unchanged rules, coach, continue, modals, and save keys.
- **Weak:** Chip-tray physics still out of scope.

### Feel
- **Strong:** Live hands on short/narrow phones keep the felt and pit in view; session stats live in Table Menu.
- **Weak:** Very tall narrow layouts (e.g. 390×1200) still show full chrome when not in table-first band.

### Graphics / art
- **Strong:** Compact title row + two-chip HUD row during play.
- **Weak:** Shared card faces (shared lane).

### Animation
- **Strong:** Play focus scroll uses `instant` when `prefers-reduced-motion` is set.
- **Weak:** —

### Audio
- **Strong:** Unchanged; gesture-gated.

### HUD / UI
- **Strong:** Bankroll + bet stay visible; hands/wins/Hi-Lo/etc. in Table Menu drawer mirrors.
- **Weak:** Desktop intel drawer still dense.

### Mobile / touch
- **Strong:** Fixed mobile pit during `jack-table-first`; dealer/player/totals/actions fit 320×640, 360×740, 390×844 without horizontal scroll.
- **Weak:** Toilet boss hidden during compact play (intentional).

### Accessibility
- **Strong:** Existing dialog/aria contracts preserved; stat mirrors are text-only duplicates.
- **Weak:** —

### Performance
- **Strong:** Layout toggles are class-based; mirrors sync on HUD update only.

### Onboarding / AI
- **Strong:** Unchanged from round 6.

## Checklist (round 7)

| Target | Status |
|--------|--------|
| [x] Round 7 audit + checklist in `docs/1000x/crapjack.md` |
| [x] `jack-table-first` chrome: compact title, 2-stat chip row, session stats in Table Menu |
| [x] `games/turdjack-layout.js` + `games/turdjack-play-focus.js` + unit tests |
| [x] Auto focus table/pit when a hand starts (no smooth scroll under reduced motion) |
| [x] Playwright viewport check + screenshots under `conductor/reviews/turdanoid-1000x/r7/crapjack/` |
| [x] `npx vitest run` / `npm run lint` / smoke 8153 |

## Prior rounds (summary)

Round 6: in-page confirm modals. Round 5: table-first layout foundations, chips, seat labels, totals.

## Needs shared change

Landed on the integration branch: Hub back pill is a top-left 44px icon on phones; `Suite.audio()` / `Suite.fx()` exist; shared card-face CSS is in `assets/turdsuite.css`. Nothing left for the shared lane from this Crapjack round.

## Save compatibility

No changes to existing `turdjack*` localStorage keys or continue snapshot `kind: turdjack v:1` fields.
