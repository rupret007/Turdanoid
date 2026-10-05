# Crapjack 21 — Turdanoid 1000x (lane: crapjack)

Round 5 (final) implementer pass on branch `cursor/turdanoid-1000x-crapjack`.

## Honest audit (round 5)

### Gameplay
- **Strong:** Unchanged rules, coach, continue, dev scenarios.
- **Weak:** Insurance still uses native `confirm` (unchanged).

### Feel
- **Strong:** Chip flight cleared on deal; felt bet circle hidden mid-hand on phones so the oval stack never sits over cards.
- **Weak:** Long dealer hit chains on H17 tables (by design).

### Graphics / art
- **Strong:** Desktop short viewport uses flatter hand rails so dealer/player read as one felt surface; compact bet circle.
- **Weak:** Shared card face caps (shared lane).

### Animation
- **Strong:** Flying-chip timeout + phase guard; shoe/discard fade during phone play.

### Audio
- **Strong:** Unchanged WebAudio bank.

### HUD / UI
- **Strong:** One total badge per hand on ≤980px (score pill kept for SR/tests only); short seat titles (“You”, “Split”) with full `aria-label`.
- **Weak:** HUD still scrolls on very short 320×640 (acceptable).

### Mobile / touch
- **Strong:** Bet circle only while betting; chips remain in HUD bet tile during play.

### Accessibility
- **Strong:** Total badges expose `aria-label`; live region unchanged.

### Performance
- **Strong:** CSS-only responsive chrome; no new per-frame loops.

### Onboarding / AI
- **Strong:** Unchanged from round 4.

## Checklist (round 5)

| Target | Status |
|--------|--------|
| [x] Round 5 audit + checklist in `docs/1000x/crapjack.md` |
| [x] Fix stray oval/pill over cards (chip flight cleanup, hide felt bet circle + flying chips while playing on mobile) |
| [x] Short seat titles at narrow widths; full names for screen readers |
| [x] Remove duplicate “Score: N” pill on phones (SR-only pill; total badge visible) |
| [x] Desktop 1280×800: unified felt hands + smaller bet circle in short-viewport layout |
| [x] Moments capture → `conductor/reviews/turdanoid-1000x/r5/crapjack-moments/` |
| [x] Unit tests: layout, seat labels, chip flight, totals aria |
| [x] `npx vitest run` / `npm run lint` / smoke 8153 |

## Needs shared change

- **Hub pill / back control** at 320px (`assets/turdsuite.css` or hub markup).
- **SuiteAudio / SuiteFX** (shared lane).
- **Card face art** in shared CSS.

## Save compatibility

No changes to existing `turdjack*` localStorage keys or continue snapshot `kind: turdjack v:1` fields.
