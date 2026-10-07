# Turdanoid

Six browser games, one sewer. Open `index.html` and pick a stall.

This repository is **public**. GitHub Pages already serves **`main`**:
[https://rupret007.github.io/Turdanoid/](https://rupret007.github.io/Turdanoid/).
This branch is the **Turdanoid 1000x** integration (draft
[PR #41](https://github.com/rupret007/Turdanoid/pull/41)) — same six titles,
richer tables, and phone/320px layout work. It is **not** deployed.

No sign-in. Progress lives in `localStorage` on this device.

## Games

The hub lineup, in order:

| Game | File | What you get |
|------|------|----------------|
| **TurdAnoid Turbo** | `TurdAnoid.html` | Brick-breaker, five worlds, 19 capsules, optional Boss Flush, coach |
| **Turdtris** | `turdtris.html` | Guideline stacker, Sprint 40L / Ultra 2:00, desktop 5-piece cabinet |
| **Crapjack 21** | `turdjack.html` | Blackjack, chips on felt, in-page pit modals, table-first phones |
| **Crappy Eights** | `crapeights.html` | You vs 3 bots, action cards, three AI levels, race to 200 |
| **TurdRummy** | `turdrummy.html` | Gin rummy, meld-grouped fan, layoff/undercut, 320px corner indices |
| **TurdSpades** | `turdspades.html` | Partnership Spades, Nil, phone trick well, device-local continue |

Legacy (not in the six-card grid): `neon-arkanoid.html`. `hub.html` redirects to `index.html`.

Card tables (Eights, Rummy, Spades) and a live Crapjack hand save on this device;
the hub says **Continue** when a playable table is waiting. Arcade mid-run saves
stay parked with PR #8.

## Phone / 320px

- Hub at ≤600px (including 320px): compact rows so all six games fit the first screen. Desktop keeps cover cards.
- Returning rows get a coloured left edge (live Continue vs last played). Mute and Hub-back are named 44px controls; on phones the back pill is a top-left icon.
- Tables go table-first on a narrow phone: Crapjack collapses chrome during a hand; TurdRummy keeps meld-fan corner indices on screen; TurdSpades keeps a stable trick well and readable index corners.

Known 320px nits (not claimed fixed): Crapjack’s between-hands stats grid still pushes the felt down; TurdSpades’ second hand row can overlap the first by about half a card (indices stay visible). Physical phone feel is **NOT RUN** — Jeff to judge.

## Quick start

No build step. Open `index.html` in a modern browser, or any game file above.

CI uses **Node 22**. Test tooling:

```bash
npm ci                 # or npm install
npm run lint
npm test               # Vitest; 30s timeouts. Serial (`npx vitest run --maxWorkers=1`) if parallel flakes
npx playwright install chromium   # one-time
PLAYWRIGHT_CHANNEL='' npm run test:smoke
```

There is no `npm run build`. Lint covers `games/` and `tests/`. Smoke serves the
repo locally and drives every game in Playwright. Empty `PLAYWRIGHT_CHANNEL`
uses bundled Chromium (Linux/macOS/CI); the default channel is local Edge for
the Windows workflow.

Windows wrappers: `test-runner.ps1`, `browser-smoke.ps1`.

CI (`.github/workflows/ci.yml`) runs lint, unit tests, and smoke on every pull request.

## Play online (`main` / Pages)

- Hub: https://rupret007.github.io/Turdanoid/
- TurdAnoid: https://rupret007.github.io/Turdanoid/TurdAnoid.html
- Turdtris: https://rupret007.github.io/Turdanoid/turdtris.html
- Crapjack 21: https://rupret007.github.io/Turdanoid/turdjack.html
- Crappy Eights: https://rupret007.github.io/Turdanoid/crapeights.html
- TurdRummy: https://rupret007.github.io/Turdanoid/turdrummy.html
- TurdSpades: https://rupret007.github.io/Turdanoid/turdspades.html
- Neon Arkanoid: https://rupret007.github.io/Turdanoid/neon-arkanoid.html

`.nojekyll` keeps Pages from running Jekyll. Those URLs are **`main`**, not this 1000x branch.

## Status

- Draft PR #41. Do not merge, undraft, or point Pages at this branch from this pass.
- Rules and save-key shapes stay compatible with the `b3821b4` / `main` pin.
- Lane notes: `docs/1000x/*.md`. Curated before/after shots: `docs/1000x/screenshots/`.
- Game rules: `RULES.md` (blackjack section heading is **Turdjack**, matching `turdjack.html` and storage keys; the hub card is Crapjack 21).

Vanilla HTML + JS. No bundler.
