# Turdanoid 1000x — lane `xfix` (integration cross-suite)

Round 1 focus: back-to-hub pill overlap on phones after shared lane moved the control to top-left.

## Audit (round 1)

| Area | Finding |
|------|---------|
| Gameplay / rules | No rule changes this round. |
| Feel / UX | Top-left `←` pill (≤520px) covered score HUD (TurdAnoid), card-game titles/kickers, TurdRummy stat strip, Crapjack pit rail (desktop bottom pill). |
| Graphics | N/A (layout fix). |
| Animation / audio | Unchanged. |
| HUD / mobile | Reserve space via shared `--suite-back-reserve-x`; TurdSpades keeps top pill ≤920px with compact 44px control. |
| a11y | Pill keeps `aria-label="Back to game hub"` and ≥44px target. |
| Perf | CSS-only reserves; overlap script uses leaf/interactive targets to avoid padding false positives. |
| Onboarding / AI | Overlap script dismisses guides/coaches before capture. |

## Checklist

- [x] Shared `--suite-back-reserve-x` + per-game selectors in `assets/turdsuite.css` (TurdAnoid HUD, Crappy Eights topbar, TurdRummy topbar/status/table, Crapjack topbar/HUD + desktop pit rail, Turdtris board-focus topbar, TurdSpades ≤920 title + compact pill)
- [x] `assets/suite-back-pill.js` — `backPillReserveX`, overlap helpers + unit tests
- [x] `scripts/suite-overlap-check.mjs` — hub + 6 games × 390/320/1280, horizontal scroll + console errors + pill overlap; screenshots under conductor `xfix/`
- [x] Remove redundant TurdSpades inline pill override (shared CSS owns compact top pill)
- [x] Turdtris: drop hard-coded `margin-left: 50px` on title (use shared reserve on topbar)
- [ ] Needs shared change: none this round

## Verification (round 1)

| Check | Result |
|-------|--------|
| `npx vitest run` | PASS — 90 files, 796 tests |
| `npm run lint` | PASS |
| `node scripts/suite-overlap-check.mjs` | PASS |
| `PLAYWRIGHT_CHANNEL=chromium node smoke-runner.js 8158` | PASS |

## Needs shared change

None — all fixes are in `assets/turdsuite.css`, `assets/suite-back-pill.js`, minimal game HTML/CSS, and `scripts/suite-overlap-check.mjs`.
