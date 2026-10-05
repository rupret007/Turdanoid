# Crapjack 21 — Turdanoid 1000x (lane: crapjack)

Round 3 implementer pass on branch `cursor/turdanoid-1000x-crapjack`.

## Honest audit (round 3)

### Gameplay
- **Strong:** Full blackjack + coach/Smart unchanged; dealer now draws with paced steps instead of an instant batch.
- **Weak:** Streak bonus wrapper in the page enhancement layer still keys off status heuristics.

### Feel
- **Strong:** Deal flights tightened to ~180–320ms; dealer reveal ~520ms; per-hit delay ~340ms (0 under reduced motion).
- **Weak:** Very long dealer shoes can still feel slow when the dealer hits many times.

### Graphics / art
- **Strong:** Table-first desktop; mobile pit boss mascot hidden ≤980px so action buttons stay clear.
- **Weak:** Shared Hub pill overlap at 320px (shared lane); shared card face caps.

### Animation
- **Strong:** Hole suspense, chip settlement, moments unchanged; reduced motion instant paths preserved.

### Audio
- **Strong:** Drumroll/fanfare + per-hit card SFX on dealer draws.

### HUD / UI
- **Strong:** Focus-visible rings on pit controls; intel drawer unchanged.
- **Weak:** HUD stat grid still dense at 320px (vertical scroll only).

### Mobile / touch
- **Strong:** Autoplay harness opens **Bet Tools** before chip taps; Smart/Deal grid unobstructed.
- **Weak:** Bet chips live inside `<details>` on mobile (extra tap).

### Accessibility
- **Strong:** `jackLiveRegion` announces dealer reveal/hits and round results; keyboard shortcuts documented in guide.
- **Weak:** No dedicated vitest for a full keyboard-only round (covered by browser-smoke + manual key map).

### Performance
- **Strong:** No new per-frame DOM loops; dealer pacing uses bounded timeouts.

### Onboarding
- **Strong:** Welcome guide + Quick Start unchanged.

### AI / coach
- **Strong:** Smart + hint unchanged.

## Checklist (round 3)

| Target | Status |
|--------|--------|
| [x] Round 3 audit + checklist in `docs/1000x/crapjack.md` |
| [x] `scripts/crapjack-autoplay.mjs` (390×844, 320×640, 1280×800 + reduced motion, Continue) |
| [x] Autoplay screenshots under `conductor/reviews/turdanoid-1000x/r3/crapjack-autoplay/` |
| [x] Hide pit-boss mascot/bubble on ≤980px (no overlap with mobile pit) |
| [x] `tests/turdjack-continue-compat.test.js` (b3821b4 `validJackSnapshot` shape) |
| [x] `games/turdjack-a11y.js` + dealer live announcements |
| [x] Snappier deal/reveal timings (`turdjack-deal-anim.js`) |
| [x] Focus-visible on pit buttons |
| [x] Unit tests for a11y / continue / deal timing |
| [ ] Shared Hub pill position at 320px (shared lane) |
| [ ] Shared `SuiteAudio` / `SuiteFX` (shared lane) |
| [ ] Shared card face art upgrade (shared CSS) |

## Autoplay findings (round 3)

- **PASS** all six runs (three viewports × motion on/off): 0 console errors, 0 horizontal scroll, Continue restore + post-continue action OK.
- **Fixed during R3:** Mobile harness must open **Bet Tools** before `[data-chip]` clicks (desktop chips were hidden in the mobile layout).
- **Visual (320):** Hub back-pill still overlaps the player lane — tracked under shared lane, not modified here.

## Needs shared change

- **Hub pill / back control:** Overlaps player hand labels at 320px (`assets/turdsuite.css` or hub markup).
- **SuiteAudio / SuiteFX:** Central mixer and particle helpers.
- **Card art / shared flip paths:** Bigger indices in `assets/turdsuite.css` without breaking smoke DOM contracts.

## Save compatibility

No changes to `turdjackBankroll`, `turdjackStats`, `turdjackRules`, `turdjackLastBet`, `turdjackSoundOn_v1`, or continue snapshot `kind: turdjack v:1` fields. New module keys unchanged (`turdjack_practice_v1`, `turdjack_intel_seen_v1`).
