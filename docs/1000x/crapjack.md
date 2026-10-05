# Crapjack 21 — Turdanoid 1000x (lane: crapjack)

Round 6 (final polish) on branch `cursor/turdanoid-1000x-crapjack`.

## Honest audit (round 6)

### Gameplay
- **Strong:** Rules, coach, continue, dev scenarios unchanged; insurance / even-money / reset outcomes match pre-modal behavior.
- **Weak:** No chip-tray physics (out of scope for this round).

### Feel
- **Strong:** Pit decisions stay on the felt via styled modal instead of native `confirm()`.
- **Weak:** H17 dealer chains still long by design.

### Graphics / art
- **Strong:** Confirm card matches welcome / table gold-green sewer palette.
- **Weak:** Shared card faces (shared lane).

### Animation
- **Strong:** Modal uses existing `suitePop`; disabled under `prefers-reduced-motion`.
- **Weak:** —

### Audio
- **Strong:** Unchanged WebAudio; no sound until gesture.

### HUD / UI
- **Strong:** Large Yes/No targets (48px min height); focus lands on “No” first (safe default).
- **Weak:** Intel drawer still dense on desktop.

### Mobile / touch
- **Strong:** Modal is full-screen overlay with touch-friendly buttons; no system dialog chrome.
- **Weak:** —

### Accessibility
- **Strong:** `role="dialog"`, `aria-modal`, labelled/described; Tab cycles Yes/No; Escape = decline.
- **Weak:** —

### Performance
- **Strong:** Modal is static DOM; no per-frame work.

### Onboarding / AI
- **Strong:** Unchanged from round 5.

## Checklist (round 6)

| Target | Status |
|--------|--------|
| [x] Round 6 audit + checklist in `docs/1000x/crapjack.md` |
| [x] Replace native `confirm()` for insurance, even money, reset bankroll with in-page modal |
| [x] Focus trap, Escape = decline, reduced-motion safe styling |
| [x] Unit tests: `games/turdjack-confirm-modal.js` + `tests/turdjack-confirm-modal.test.js` |
| [x] Smoke: `turdjack-confirm-modals` exercises insurance / even money / reset via modal (no native dialogs) |
| [x] Lint clean on owned turdjack engine/tests (no unused imports in `turdjack-engine.js` / `turdjack.test.js`) |
| [x] `npx vitest run` / `npm run lint` / smoke 8153 |

## Prior rounds (summary)

Round 5: table-first layout, chip flight cleanup, mobile bet circle, seat labels, totals aria.

## Needs shared change

- **Hub pill / back control** at 320px (`assets/turdsuite.css` or hub markup).
- **SuiteAudio / SuiteFX** (shared lane).
- **Card face art** in shared CSS.

## Save compatibility

No changes to existing `turdjack*` localStorage keys or continue snapshot `kind: turdjack v:1` fields.
