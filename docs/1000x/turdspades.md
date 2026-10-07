# TurdSpades — Turdanoid 1000x (lane: turdspades)

Round-0 audit baseline: partnership Spades with Nil/bags, table continue, paced bot turns, blur pause, partner Nil cover, mascot quips — but **no dedicated SFX bank**, flat trick resolution, bag HUD reading wrong state keys, and bots with no readable intent.

## Deeper audit (round 5)

| Area | Honest read (after round 5) |
|------|-----------------------------|
| Gameplay | Unchanged scoring/rules; optional `turdspades_ai_difficulty_v1` (easy/normal/hard). |
| Feel | Phone hand uses true row stride (card height + gap); selection lift is shallow (6px) + scale so indices stay readable. |
| Graphics | 7+6 centered rows; front row staggered; index corners guarded in layout math. |
| Animation | Deal/play FX unchanged; phone cards no longer inherit desktop fan transforms. |
| Audio | WebAudio bank + gesture unlock + mute. |
| HUD | Hand sits above dock with ≥2px clearance; guidance no longer steals index hits. |
| Mobile | 320 / 360 / 390: bounded hand height ≤160px; dock does not cover row 2. |
| a11y | Index regions checked in Playwright (geometry + elementFromPoint when unselected). |
| Onboarding | Guide unchanged. |
| AI | `turdspades-play-ai.js` + difficulty. |
| Perf | Layout on render/resize only. |
| Save | b3821b4 `turdspades` v:1 shape unchanged. |

## Checklist

### Round 5 (final phone hand polish)

- [x] 320×640: 13-card hand in neat 7+6 rows; each card’s 18×28 index region clear of higher-z peers.
- [x] 360×780 and 390×844: same index visibility; full hand above action dock (no row hidden behind dock).
- [x] Selected-card lift does not break index rules (geometry check with 6px lift).
- [x] `games/turdspades-phone-hand.js`: row stride = card height + gap; `phoneHandIndexRegionsClear` / DOM helper + unit tests.
- [x] Playwright screenshots + index/dock assertions → `conductor/reviews/turdanoid-1000x/r5/turdspades/`.
- [x] Vitest, lint, smoke green; local commits only.

### Round 4 (done)
- [x] One compact four-seat felt at 390×844 and 320×640; play page fits the viewport.
- [x] Width-aware 13-card hand; selected lift, legal glow, dimmed illegal cards, reachable exposed hit areas.
- [x] Phone mascot and floating Hub cannot cover cards or buttons.
- [x] Compact bid controls and round receipt fit both phone widths.
- [x] Preserve smoke selectors, scoring, AI behavior and continue snapshots.
- [x] Playwright screenshots for bidding, mid-trick and receipt at 390×844, 320×640 and 1280×800; geometry and hit-testing assertions.
- [x] Full unit/browser tests, lint and required smoke pass; local commits only.

### Round 1–3 (done)
- [x] WebAudio SFX, trick sweep, spades-broken FX, bid UI, bot hints, bag fix, table-first layout, AI module, autoplay harness, save compat vitest, a11y announcer
- [ ] Shared SuiteAudio mixer (needs shared lane)
- [ ] Hub stat badge for Spades match score (needs shared lane)

## Needs shared change

Shared round 3–4 landed `Suite.audio()`, optional hub `turdspades_stats_v1` chips, and a top-left 44px Hub pill on phones (no bottom-dock overlap). Nothing left for the shared lane from this Spades round.

## Verification

Run: `npx vitest run`, `npm run lint`, `PLAYWRIGHT_CHANNEL=chromium node smoke-runner.js 8156`, `TURDSPADES_SCREENSHOTS=1 PLAYWRIGHT_CHANNEL=chromium npx vitest run tests/turdspades-phone-browser.test.js`.
