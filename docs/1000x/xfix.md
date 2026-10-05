# Turdanoid 1000x — lane `xfix` (integration cross-suite)

Integration QA lane: all seven games merged; fix cross-suite layout, continue/hub, and harness regressions.

## Audit (round 2)

| Area | Finding |
|------|---------|
| Gameplay / rules | No rule, scoring, AI, or save-format changes. |
| Desktop TurdRummy | Round-2 CSS left `.table-stage { display: block }` at all widths, collapsing the desktop side drawer under the felt and causing back-pill overlap with melds/dock at 1280×800. |
| Crapjack 1280×800 | Bet-zone chips stacked vertically into the pit rail; tossed chips blocked Deal clicks; autoplay could not place bets. |
| TurdRummy phone | Hand could sit under the sticky dock (autoplay `hand-below-fold`); 320px smoke failed corner-index audits when the fan sat under the dock. |
| TurdSpades 320–360 | Trick-pile seat labels could overlap at the narrowest width. |
| Harness / flake | Playwright browser tests (TurdSpades geometry) can flake under max parallelism; full `vitest run` may need a retry on a loaded machine. |

## Checklist (round 2)

- [x] Run all `scripts/*` harnesses on integrated tree; fix failures
- [x] `suite-overlap-check` — hub + 6 games @ 390/320/1280 (incl. TurdRummy desktop drawer)
- [x] TurdRummy: restore desktop `grid` side drawer; phone fold + 320 corner-index fit
- [x] Crapjack: short-desktop bet row + chip `pointer-events` during toss
- [x] TurdSpades: tighter trick-seat layout ≤360px
- [x] Hub continue + stat badges + b3821b4 save restore (integration test)
- [x] `tests/xfix-round2-integration.test.js` (desktop drawer, save compat, no early AudioContext on hub)
- [x] `npx vitest run` / `npm run lint` / `PLAYWRIGHT_CHANNEL=chromium node smoke-runner.js 8158`

## Script results (round 2)

| Script | Result |
|--------|--------|
| `node scripts/suite-overlap-check.mjs` | PASS (after TurdRummy desktop grid fix) |
| `node scripts/turdanoid-autoplay.mjs` | PASS (~210s classic+boss sessions) |
| `node scripts/turdanoid-qa-capture.mjs` | PASS |
| `PLAYWRIGHT_CHANNEL=chromium node scripts/turdtris-autoplay.mjs --seconds=12` | PASS (all five variants) |
| `node scripts/crapjack-autoplay.mjs` | PASS (after bet-zone / chip fixes) |
| `node scripts/crapjack-moments-capture.mjs` | PASS |
| `PLAYWRIGHT_CHANNEL=chromium node scripts/crapeights-autoplay.mjs --rounds 1` | PASS |
| `node scripts/turdspades-autoplay.mjs` | PASS |
| `node scripts/turdrummy-autoplay.mjs --scenarios=phone,reduced,continue --rounds=1` | PASS (after phone layout) |

## Verification (round 2)

| Check | Result |
|-------|--------|
| `npx vitest run` | PASS — 95 files, 814 tests |
| `npm run lint` | PASS |
| `node scripts/suite-overlap-check.mjs` | PASS |
| `PLAYWRIGHT_CHANNEL=chromium node smoke-runner.js 8158` | PASS |

## Round 1 (retained)

- [x] Shared `--suite-back-reserve-x` + overlap harness (`assets/suite-back-pill.js`, `scripts/suite-overlap-check.mjs`)

## Needs shared change

None this round.
