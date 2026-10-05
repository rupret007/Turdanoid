# Crapjack 21 — Turdanoid 1000x (lane: crapjack)

Round 4 (final) implementer pass on branch `cursor/turdanoid-1000x-crapjack`.

## Honest audit (round 4)

### Gameplay
- **Strong:** Full blackjack, coach/Smart, continue snapshots, dev scenarios for QA moments unchanged in rules/scoring.
- **Weak:** Insurance still uses native `confirm` (acceptable; dev hook bypasses for localhost QA only).

### Feel
- **Strong:** Dealer one-card pacing (~340ms/hit, instant under reduced motion); celebration banners capped at 1.2s and tap-to-skip.
- **Weak:** Long dealer hit sequences on soft-17 tables still take wall-clock time (by design).

### Graphics / art
- **Strong:** Desktop short-viewport layout locks table + chip rack + compact pit bar in one screen; mobile felt chip rack above pit between hands.
- **Weak:** Shared card face caps (shared lane); hub pill at 320px (shared lane).

### Animation
- **Strong:** Split/double action banners; moment UI module with dismiss; reduced-motion paths preserved.

### Audio
- **Strong:** Existing WebAudio bank; fanfare/bust/chip on moments.

### HUD / UI
- **Strong:** Desktop pit toolbar (Deal–Surrender) + overflow for Clear/Max/Rebet; `data-phase` toggles mobile felt chips.
- **Weak:** HUD still scrolls vertically on very short phones (320×640) — acceptable per prior rounds.

### Mobile / touch
- **Strong:** `#mobileFeltChipRack` (4 chips) visible when betting; Bet Tools keeps Rebet/Max without duplicate chips.
- **Weak:** Chip labels hidden on felt rack (aria-labels present).

### Accessibility
- **Strong:** Moment banner is focusable and dismissible; live region + focus-visible on pit controls unchanged.
- **Weak:** No dedicated keyboard-only vitest round (smoke + manual map).

### Performance
- **Strong:** No new per-frame DOM loops; viewport-fit uses flex, not JS layout.

### Onboarding
- **Strong:** Welcome guide unchanged; dev hook dismisses guide on localhost.

### AI / coach
- **Strong:** Smart + hint unchanged.

## Checklist (round 4)

| Target | Status |
|--------|--------|
| [x] Round 4 audit + checklist in `docs/1000x/crapjack.md` |
| [x] Desktop 1280×800 (also 1024×768 / 1440×900 via `max-height: 920px`): table + chips + compact pit, no page scroll mid-hand |
| [x] Mobile felt chip rack above `#mobilePit` when betting (390 / 320) |
| [x] `__turdjackDev` localhost hook + `scripts/crapjack-moments-capture.mjs` → `conductor/reviews/turdanoid-1000x/r4/crapjack-moments/` |
| [x] Moment banners ≤1.2s, skippable by tap; split/double action moments |
| [x] Dealer paced hits (340ms); reduced motion instant |
| [x] Unit tests: shoe seed, moment UI, dev scenarios |
| [x] `npx vitest run` / `npm run lint` / smoke 8153 |
| [ ] Shared Hub pill at 320px (shared lane) |
| [ ] Shared `SuiteAudio` / `SuiteFX` (shared lane) |
| [ ] Shared card face art upgrade (shared CSS) |

## Round 4 QA notes

- Viewport check (1280×800, active hand): `scrollHeight === clientHeight`, `scrollY === 0`.
- Moment screenshots: `conductor/reviews/turdanoid-1000x/r4/crapjack-moments/{scenario}-{390|1280}.png`.
- Autoplay harness uses `#mobileFeltChipRack` first (no Bet Tools open required for chips).

## Needs shared change

- **Hub pill / back control:** Overlaps player hand labels at 320px (`assets/turdsuite.css` or hub markup).
- **SuiteAudio / SuiteFX:** Central mixer and particle helpers.
- **Card art / shared flip paths:** Bigger indices in `assets/turdsuite.css` without breaking smoke DOM contracts.

## Save compatibility

No changes to `turdjackBankroll`, `turdjackStats`, `turdjackRules`, `turdjackLastBet`, `turdjackSoundOn_v1`, or continue snapshot `kind: turdjack v:1` fields. Optional keys unchanged (`turdjack_practice_v1`, `turdjack_intel_seen_v1`).
