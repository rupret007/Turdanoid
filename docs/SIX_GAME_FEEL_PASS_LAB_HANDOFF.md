# Six-game feel pass — lab handoff

Marker: `LOCAL_CURSOR_TURDANOID_20261005T031635`.

Prior player-feel tip on this branch: `7ec1bcbc86ca7b0de892fb5a2cb36e9ecd032cc9`
(Fix feel-pass validation and respect reduced motion).

This document tracks the **scoped lab continuation** after that tip: regression locks,
compatibility checks, and what still needs a human device.

## What players already feel (branch through `7ec1bcb`)

These shipped in earlier commits on PR #33 (`45fd34e`, `d6f281f`, `7ec1bcb`); this
handoff commit does **not** change gameplay numbers again.

| Surface | Player-facing delta (vs pre–feel-pass main) |
| --- | --- |
| **Hub** | Phone rows stay scannable; masthead **↩ Continue** when a live table exists (unchanged keys). |
| **TurdAnoid** | Snappier touch paddle follow, wider english, combo window 105f, brick hit-stop + shake, bottom danger vignette, light haptic on breaks; **reduced motion** disables shake pulse and danger flicker. |
| **Turdtris** | Stack danger HUD pulse from `FEEL_DANGER_HUD_RATIO`; canvas danger tint; held-input pause behavior unchanged; reduced motion disables pulse animations. |
| **Crapjack 21** | Soft-hand guidance / smart hints (see `docs/CRAPJACK_SOFT_HAND_HANDOFF.md`); live-hand continue unchanged. |
| **Crappy Eights** | Slightly tighter bot pacing (600 ms turn delay); pressure/status motion respects reduced motion. |
| **TurdRummy** | Quick AI 180 ms / normal 540 ms; layoff scoring unchanged (see `docs/TURDRUMMY_LAYOFF_HANDOFF.md`). |
| **TurdSpades** | Bot turn pacing 400 ms; focus/blur suspend unchanged. |

Canonical tuning for arcade/card pacing lives in `games/suite-feel.js`; shipped pages
mirror the `FEEL_*` / `AI_TURN_MS` literals inline (locked by unit tests).

## Save / continue compatibility (must not drift)

| Key / contract | Purpose |
| --- | --- |
| `turdsuite_continue_v1` | Four live tables: Crapjack, Eights, Rummy, Spades (`games/table-continue-core.js`). |
| `turdsuite_guides_seen_v1` | Returning-player welcome guides. |
| `turdsuite_last_game` | Hub “last opened” + masthead resume pick. |
| `turdsuite_muted` | Suite mute (hub shell). |
| `turdanoid_v2_best`, `turdanoid_v2_sound` | TurdAnoid best score + sound (no mid-run continue). |
| `turdtrisHighScore`, `turdtrisSoundOn_v1` | Turdtris best + sound. |
| `turdjackBankroll`, `turdjackStats`, `turdjackSoundOn_v1` | Crapjack lifetime stats; bankroll written only when hand settles. |
| `crapeightsStats`, `crapeightsSoundOn_v1` | Eights lifetime stats + sound. |
| `turdrummy_stats_v1` | Rummy lifetime stats only (match scores without a table are not restored). |

Scoring rules remain documented in `RULES.md` and guarded by `tests/rules-docs.test.js`
and game-specific suites (e.g. `tests/turdrummy-layoff.test.js`, `tests/turdanoid.test.js`).

## Verified on this handoff commit

- `npm run lint` — pass (existing warnings only).
- `npm test` — Vitest, including new `tests/suite-feel.test.js` HTML↔`suite-feel.js`
  parity and storage-key presence checks.
- `tests/table-continue.test.js` — six-game door, validators, hub wiring unchanged.
- Manual code review: no edits to validator payloads, `CONTINUE_VERSION`, or scoring
  functions in this continuation slice.

Record the **exact commit SHA** for this handoff in the PR body after push.

### Browser smoke (`npm run test:smoke`)

CI runs Playwright Chromium on Ubuntu after `npx playwright install --with-deps chromium`.

Local Mac Mini (2026-10-04): `PLAYWRIGHT_CHANNEL='' npm run test:smoke -- 8138` — **pass**
(Playwright Chromium 149, ~72s).

```bash
PLAYWRIGHT_CHANNEL='' npm run test:smoke -- 8138
```

## NOT RUN (requires Jeff / physical lab)

- **Real phone Safari / Chrome** — touch drag, haptic availability, safe-area, and
  “does it feel right” for paddle follow, Turdtris D-pad hold, and card-table taps.
- **Reduced motion on device** — OS setting + in-game pulse/haptic subjective check.
- **Long-session continue** — multi-day restore of four table types plus hub resume
  shortcut after OS storage eviction (browser smoke covers happy path only).

Do not claim device acceptance until those are exercised.

## Boundaries

- Work stays in `Turdanoid-feel-1002` / PR #33 draft; no merge, Pages, tag, or release.
- Do not edit RadDadSite, GitHub Pages copy, or `/Users/jeffstory/Turdanoid`.
- No secrets in docs or commits.

## Related handoffs

- Hub phone layout: `docs/HUB_PHONE_HANDOFF.md`
- Masthead resume: `docs/HUB_RESUME_SHORTCUT_HANDOFF.md`
- Turdtris pause + held input: `docs/TURDTRIS_PAUSE_INPUT_HANDOFF.md`
