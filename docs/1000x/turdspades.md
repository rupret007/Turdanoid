# TurdSpades — Turdanoid 1000x (lane: turdspades)

Round-0 audit baseline: partnership Spades with Nil/bags, table continue, paced bot turns, blur pause, partner Nil cover, mascot quips — but **no dedicated SFX bank**, flat trick resolution, bag HUD reading wrong state keys, and bots with no readable intent.

## Deeper audit (round 1)

| Area | Honest read |
|------|-------------|
| Gameplay | Solid Spades rules, 250 target, tiebreaker; AI bids with Nil gate, contract need, Nil duck/cover. |
| Feel | Seat glow, deal/pop anims, blur-safe bot pacing; trick win still instant in DOM. |
| Graphics | Strong felt/table CSS, card faces, bid dial; bot backs are stacked mini backs only. |
| Animation | pop-in on trick; missing sweep-to-winner and spades-broken beat. |
| Audio | Suite.toast/beep on messages only; no play/trick/bid synth layer. |
| HUD | Six stat tiles; bag warning broken (array vs scalar). |
| Mobile | Fixed bid dock ≤640px; smoke covers Nil targets. |
| a11y | Message bar; added live region + bot hint status. |
| Onboarding | Guide + quick start; partner mascot greeting. |
| AI | Good cover/Nil; no surfaced reasoning. |
| Perf | innerHTML re-render; FX capped, canvas particles bounded. |
| Save | `turdspades` v:1 unchanged. |

## Checklist

- [x] WebAudio SFX module (card, trick, spades broken, bid, bag, match) + mute + gesture unlock
- [x] Trick sweep animation to trick winner (skip when `prefers-reduced-motion`)
- [x] Spades-broken table pulse + shard burst (reduced → static lit border only)
- [x] Bid UI: team contract preview under dial
- [x] Bot play hints (`explainAiPlay`) on paced bot turns
- [x] Fix bag warning to use `state.bags[0/1]`
- [x] Unit tests for audio mute gating, FX reduced-motion, AI hints
- [x] `aria-live` on status message
- [ ] Shared SuiteAudio mixer (needs shared lane)
- [ ] Hub stat badge for Spades match score (needs shared lane)
- [ ] Drag-to-play / double-tap card (future opt-in)

## Needs shared change

- Optional central `SuiteAudio` so all card tables share one master bus (see round-0 shared targets).
- Larger shared card CSS lift at 390px if all four tables should match a new art pass.

## Verification

Run: `npx vitest run`, `npm run lint`, `PLAYWRIGHT_CHANNEL=chromium node smoke-runner.js 8156`.
