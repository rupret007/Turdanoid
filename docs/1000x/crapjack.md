# Crapjack 21 — Turdanoid 1000x (lane: crapjack)

Round 1 implementer pass on branch `cursor/turdanoid-1000x-crapjack`.

## Honest audit (round 1)

### Gameplay
- **Strong:** Full blackjack feature set (split, double, surrender, insurance, even money), Hi-Lo count with hidden-hole discipline, basic-strategy hints and Smart/Enter, configurable rules, continue snapshots, bankroll/stats persistence.
- **Weak:** Table still shares vertical space with a dense sidebar on desktop; streak bonus payouts are flavour (not core BJ EV) but add casino chaos.

### Feel
- **Strong:** Status tones/badges, toilet boss quips, hot/cold streak banners, chip toss CSS, deal/flip card motion.
- **Weak:** Win/blackjack moments lacked a unified “table celebration” layer before this pass.

### Graphics / art
- **Strong:** Felt table, sewer card backs, procedural felt inlay SVG, chip stacks, shoe lane visual.
- **Weak:** Shared card CSS still caps polish vs a dedicated art pass (shared lane).

### Animation
- **Strong:** `suiteDealIn` / hole flip, chip toss, boss mascot animations.
- **Added (R1):** Canvas confetti bursts + subtle table shake on bust/blackjack (gated by `prefers-reduced-motion`).

### Audio
- **Strong:** Per-action WebAudio profiles in page.
- **Added (R1):** `games/turdjack-audio.js` — layered blackjack/win/chip tones; honours `turdjackSoundOn_v1` **and** `turdsuite_muted`.

### HUD / UI
- **Strong:** 10-stat HUD, mobile pit dock, bet chip tray.
- **Added (R1):** Bust-risk hand meter (21 pips), shoe lane readout, chip stack on bet pill via module, collapsible “Strategy, history & rules” drawer on narrow viewports.

### Mobile / touch
- **Strong:** Bottom pit, bet tools in details, table-first layout under 980px.
- **Weak:** Long scroll on very small phones if intel drawer opened; pit remains primary play surface.

### Accessibility
- **Added (R1):** `aria-live` announcer for status line; hand meter marked `aria-hidden` (decorative); reduced-motion cuts shake/particles/boss motion.
- **Weak:** No skip-link (shared lane target); limited aria on controls (pre-existing).

### Performance
- **Strong:** No per-frame DOM in main loop; FX canvas capped particles (36 → 8 reduced).
- **Watch:** MutationObservers on HUD stats (cosmetic flash only).

### Onboarding
- **Strong:** Welcome guide, Quick Start, keyboard cheats in sidebar.

### AI
- N/A (dealer follows rules; “AI” is basic-strategy coach — already solid).

## Checklist

| Target | Status |
|--------|--------|
| [x] Document audit + checklist in `docs/1000x/crapjack.md` |
| [x] Extract chip stack logic → `games/turdjack-chips.js` + tests |
| [x] Extract felt inlay SVG → `games/turdjack-felt.js` + tests |
| [x] WebAudio module with suite mute gate → `games/turdjack-audio.js` + tests |
| [x] Table canvas FX (win/BJ/bust/push) + reduced motion → `games/turdjack-fx.js` + tests |
| [x] Hand bust-risk meter → `games/turdjack-hand-meter.js` + tests |
| [x] Page kit wiring → `games/turdjack-page-kit.js` |
| [x] `aria-live` status announcer |
| [x] Shoe lane HUD (cards remaining / cut card) |
| [x] Mobile intel drawer (strategy/history/rules collapsed by default ≤980px) |
| [x] Table shake + particle celebrations (motion-safe) |
| [ ] Shared `SuiteAudio` / `SuiteFX` modules (shared lane) |
| [ ] Shared card face art upgrade (shared CSS) |
| [ ] Drag-to-bet / chip flight to felt (future) |
| [ ] Deal-from-shoe positional animation (future) |

## Needs shared change

- **SuiteAudio / SuiteFX:** Central mixer and particle helpers referenced in conductor audit (`assets/turdsuite.js` or new `games/suite-*.js`).
- **Card art / deal keyframes:** Bigger indices and shared flip paths in `assets/turdsuite.css` without breaking smoke DOM contracts.

## Save compatibility

No changes to `turdjackBankroll`, `turdjackStats`, `turdjackRules`, `turdjackLastBet`, `turdjackSoundOn_v1`, or continue snapshot `kind: turdjack v:1` fields.
