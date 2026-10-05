# Crapjack 21 — Turdanoid 1000x (lane: crapjack)

Round 2 implementer pass on branch `cursor/turdanoid-1000x-crapjack`.

## Honest audit (round 2)

### Gameplay
- **Strong:** Full blackjack feature set unchanged; practice mode adds mistake callouts without altering legacy stat keys.
- **Weak:** Payout chip sweep from dealer is stylized (bet circle + HUD) rather than full physics sim.

### Feel
- **Strong:** Deal-from-shoe flight, dealer reveal drumroll beat, CRAPJACK banner, bust crumble, split slide, coach button pulse.
- **Weak:** Insurance win moment relies on status text heuristics.

### Graphics / art
- **Strong:** Table-first 1280 layout, discard tray, bet circle, felt chip stacks, edge streak readout.
- **Weak:** Shared card CSS still caps face art (shared lane).

### Animation
- **Strong:** Arc deal flight, 3D hole flip, chip fly to circle, bankroll tween, meter danger pulse.
- **Reduced motion:** Instant deal, no fly/chip/banner motion, no crumble.

### Audio
- **Strong:** Drumroll + fanfare profiles in `turdjack-audio.js`; existing action bank retained.

### HUD / UI
- **Strong:** Total badges, bet circle, desktop pit rail, intel slide-out (default closed until opened once).
- **Weak:** HUD stat grid still dense on 320px (scroll in shell only).

### Mobile / touch
- **Strong:** Mobile pit unchanged for smoke; table stage compacts under 980px; intel via menu.
- **Weak:** Bet circle hidden on narrow viewports (mobile pit chips only).

### Accessibility
- **Strong:** aria-live status, intel toggle `aria-expanded`, practice labeled checkbox.
- **Weak:** Coach pulse is visual only.

### Performance
- **Strong:** FX canvas particle cap; no per-frame DOM loop; deal flags cleared each round.

### Onboarding
- **Strong:** Welcome guide + Quick Start; intel drawer holds rules.

### AI / coach
- **Strong:** Smart + hint tap highlight optimal action with one-line why; practice flags deviations.

## Checklist (round 2)

| Target | Status |
|--------|--------|
| [x] Document audit + checklist in `docs/1000x/crapjack.md` |
| [x] Table-first desktop (felt hero, discard/shoe/bet circle/pit rail) |
| [x] Intel slide-out on desktop (default closed; `turdjack_intel_seen_v1`) |
| [x] Deal-from-shoe flight (`turdjack-deal-anim.js` + CSS) |
| [x] Dealer reveal suspense + drumroll SFX |
| [x] Hole flip + split slide (motion-gated) |
| [x] Chip fly to bet circle + felt stack (`turdjack-table-chips.js`) |
| [x] CRAPJACK / bust / push moments + edge streaks (`turdjack-moments.js`) |
| [x] Big total badges + meter pulse (`turdjack-totals.js`, hand meter) |
| [x] Coach pulse + practice mode (`turdjack-coach.js`, `turdjack_practice_v1`) |
| [x] Bankroll count tween |
| [x] Unit tests for new modules |
| [x] Lint cleanup in owned turdjack modules |
| [ ] Shared `SuiteAudio` / `SuiteFX` (shared lane) |
| [ ] Shared card face art upgrade (shared CSS) |
| [ ] Full dealer-to-player payout chip sweep (future polish) |

## Needs shared change

- **SuiteAudio / SuiteFX:** Central mixer and particle helpers (`assets/turdsuite.js` or new `games/suite-*.js`).
- **Card art / shared flip paths:** Bigger indices in `assets/turdsuite.css` without breaking smoke DOM contracts.

## Save compatibility

No changes to `turdjackBankroll`, `turdjackStats`, `turdjackRules`, `turdjackLastBet`, `turdjackSoundOn_v1`, or continue snapshot `kind: turdjack v:1` fields. New optional keys: `turdjack_practice_v1`, `turdjack_intel_seen_v1`.
