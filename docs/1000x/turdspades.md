# TurdSpades — Turdanoid 1000x (lane: turdspades)

Round-0 audit baseline: partnership Spades with Nil/bags, table continue, paced bot turns, blur pause, partner Nil cover, mascot quips — but **no dedicated SFX bank**, flat trick resolution, bag HUD reading wrong state keys, and bots with no readable intent.

## Deeper audit (round 3)

| Area | Honest read (after round 3) |
|------|-----------------------------|
| Gameplay | Unchanged scoring/rules; optional `turdspades_ai_difficulty_v1` (easy/normal/hard). |
| Feel | Snappier FX timings (280ms card flight, 480ms sweep, 600ms deal); receipt dismisses under reduced motion. |
| Graphics | Contract banner moved to table top (no trick overlap); bag warn non-blocking; desktop table hero height. |
| Animation | Same pipeline; instant when `prefers-reduced-motion`. |
| Audio | WebAudio bank + gesture unlock + mute. |
| HUD | Score strip + details drawer; bag warning read-only overlay. |
| Mobile | 320/390 overflow-x clamp; mascot/bubble reposition on your turn; ≥44px targets. |
| a11y | Screen-reader announcer for bot plays, trick wins, spades broken, round totals; focus-visible rings; arrow-key card focus. |
| Onboarding | Guide unchanged; keyboard Enter through bid/play/next round. |
| AI | `turdspades-play-ai.js` module + difficulty. |
| Perf | Particle cap; autoplay 220 turns × 3 viewports @ 60fps-friendly DOM. |
| Save | b3821b4 `turdspades` v:1 shape validated in `tests/turdspades-continue.test.js`; optional `playedThisRound`. |

## Checklist

### Round 4 audit and targets

The round 3 horizontal-scroll checks were insufficient: overflow clipping hid the rightmost cards, and the phone table remained a long stack of panels. The 390 screenshot also shows the mascot covering the hand and the Hub pill covering a dock control. Desktop art is usable, but the phone composition needs rebuilding rather than more overflow clamps.

| Area | Round 4 starting assessment |
|------|----------------------------|
| Gameplay / AI / saves | Preserve the shipped bidding, trick resolution, scoring, bot decisions and v:1 continue contract. The optional client currently reads an unexported global state; enabling that globally would also change AI behavior, outside this round's scope. |
| Feel / graphics | Seat panels dominate the phone; consolidate them into one felt surface with small avatars and a directional trick. |
| Animation / audio | Existing gesture-unlocked, mute-aware synthesized audio and reduced-motion FX remain; hand selection must lift without clipping. |
| HUD / onboarding | Full-width header controls and duplicate status consume the play area. Put secondary actions in a table menu; keep score, turn, legal-play guidance visible. |
| Mobile / touch | Fixed card overlap fails with 13 cards. Compute a bounded fan with readable indices and two staggered rows as needed. Reserve actual layout space for the dock. |
| Accessibility | Preserve keyboard/button contracts, label cards and expose selection. Keep touch surfaces at least 44px high; show legal and illegal cards distinctly. |
| Performance | Compute geometry on render/resize only. No animation loop, runtime network assets or new dependencies. |

- [ ] One compact four-seat felt at 390×844 and 320×640; play page fits the viewport.
- [ ] Width-aware 13-card hand; selected lift, legal glow, dimmed illegal cards, reachable exposed hit areas.
- [ ] Phone mascot and floating Hub cannot cover cards or buttons.
- [ ] Compact bid controls and round receipt fit both phone widths.
- [ ] Preserve smoke selectors, scoring, AI behavior and continue snapshots.
- [ ] Playwright screenshots for bidding, mid-trick and receipt at 390×844, 320×640 and 1280×800; geometry and hit-testing assertions.
- [ ] Full unit/browser tests, lint and required smoke pass; local commits only.

### Round 1 (done)
- [x] WebAudio SFX module (card, trick, spades broken, bid, bag, match) + mute + gesture unlock
- [x] Trick sweep animation to trick winner (skip when `prefers-reduced-motion`)
- [x] Spades-broken table pulse + shard burst (reduced → static lit border only)
- [x] Bid UI: team contract preview under dial
- [x] Bot play hints (`explainAiPlay`) on paced bot turns
- [x] Fix bag warning to use `state.bags[0/1]`
- [x] Unit tests for audio mute gating, FX reduced-motion, AI hints

### Round 2 (done)
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

### Round 3
- [x] Playwright autoplay harness (`scripts/turdspades-autoplay.mjs`) — 390×844, 320×640, 1280×800, reduced-motion, continue round-trip; screenshots + `report.json` under conductor reviews
- [x] Autoplay fixes: reduced-motion receipt dismiss; bag warn `pointer-events: none`; UI overlap (contract banner, mascot/bubble on 320)
- [x] Save compat vitest: b3821b4 fixture via `validateSpadesSnapshot` + `games/turdspades-snapshot.js`
- [x] Feel: FX duration tuning + `cardFlightDurationMs` test band 180–320ms
- [x] a11y: `tsTableAnnouncer`, keyboard arrows + Enter for round advance, focus-visible on cards/buttons

## Autoplay findings (round 3)

| Run | Result |
|-----|--------|
| 390×844 | PASS — 0 console errors, 0 stuck turns, 0 horizontal scroll |
| 320×640 | PASS |
| 1280×800 | PASS |
| 390×844 + `prefers-reduced-motion: reduce` | PASS (after receipt auto-dismiss fix) |
| Continue (hub detour mid-hand) | PASS — table restores and accepts play |

Artifacts: `/Users/jeffstory/Documents/bob-overnight-inject/conductor/reviews/turdanoid-1000x/r3/turdspades-autoplay/`.

## Needs shared change

- Optional central `SuiteAudio` so all card tables share one master bus (see round-0 shared targets).
- Larger shared card CSS lift at 390px if all four tables should match a new art pass.
- `suite-back-pill` hub link can overlap dock taps on very small viewports (shared `turdsuite.css`).

## Verification

Run: `npx vitest run`, `npm run lint`, `PLAYWRIGHT_CHANNEL=chromium node smoke-runner.js 8156`, `node scripts/turdspades-autoplay.mjs [port]`.
