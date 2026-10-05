# TurdSpades — Turdanoid 1000x (lane: turdspades)

Round-0 audit baseline: partnership Spades with Nil/bags, table continue, paced bot turns, blur pause, partner Nil cover, mascot quips — but **no dedicated SFX bank**, flat trick resolution, bag HUD reading wrong state keys, and bots with no readable intent.

## Deeper audit (round 2)

| Area | Honest read (after round 2) |
|------|-----------------------------|
| Gameplay | Unchanged scoring/rules; optional `turdspades_ai_difficulty_v1` (easy/normal/hard, default normal). |
| Feel | Felt arena, seat rings, deal burst, card flight, trick sweep, spades crack, round receipt count-up. |
| Graphics | SVG seat avatars, arced hand/back fans, trick well by seat, compact score strip. |
| Animation | Deal from center, play fly-in, sweep, receipt/trophy; instant when `prefers-reduced-motion`. |
| Audio | Round-1 WebAudio bank retained; gesture unlock + mute respected. |
| HUD | Always-visible Us/Them strip; six-tile details in collapsible drawer. |
| Mobile | 390×844: table + hand + dock tuned; bid chips scroll; ≥44px targets. |
| a11y | `aria-live` on strip, hints, receipt; drawer `aria-expanded`. |
| Onboarding | Guide unchanged; partner bid bubble + expected-tricks hint at bid. |
| AI | Module `turdspades-play-ai.js`: Nil/cover preserved; spade counting; avoid overtrumping partner when set. |
| Perf | FX on canvas/overlay; fan styles applied post-render; particle cap unchanged. |
| Save | `turdspades` v:1 core unchanged; optional `playedThisRound` on snapshot (ignored if missing). |

## Checklist

### Round 1 (done)
- [x] WebAudio SFX module (card, trick, spades broken, bid, bag, match) + mute + gesture unlock
- [x] Trick sweep animation to trick winner (skip when `prefers-reduced-motion`)
- [x] Spades-broken table pulse + shard burst (reduced → static lit border only)
- [x] Bid UI: team contract preview under dial
- [x] Bot play hints (`explainAiPlay`) on paced bot turns
- [x] Fix bag warning to use `state.bags[0/1]`
- [x] Unit tests for audio mute gating, FX reduced-motion, AI hints

### Round 2
- [x] Table-first layout: four-seat arena, arced fans, trick well by seat, score strip + details drawer
- [x] Card motion: deal burst, play fly-in, trick sweep, spades broken FX, trick stack counters
- [x] Bidding UX: 0–13 chips + Nil, expected-tricks hint, partner bid bubble, contract banner
- [x] Avatars & personality: SVG seats, mood on trick win, mascot quips retained
- [x] Round end: animated scoring receipt + match trophy overlay
- [x] AI: difficulty setting + stronger play module + unit tests
- [x] Mobile 320/390: compact arena, strip HUD, tap targets
- [ ] Shared SuiteAudio mixer (needs shared lane)
- [ ] Hub stat badge for Spades match score (needs shared lane)
- [ ] Drag-to-play / double-tap card (future opt-in)

## Needs shared change

- Optional central `SuiteAudio` so all card tables share one master bus (see round-0 shared targets).
- Larger shared card CSS lift at 390px if all four tables should match a new art pass.

## Verification

Run: `npx vitest run`, `npm run lint`, `PLAYWRIGHT_CHANNEL=chromium node smoke-runner.js 8156`.
