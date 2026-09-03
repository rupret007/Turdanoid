# Turdanoid Games

A collection of six active browser games with a playful turd theme.

The repository root is the finished six-game launcher. The original Neon Arkanoid remains playable as a secondary direct link instead of acting as the product's front door.

## Version

- **Current build:** `v4.0.0`
- **Build date:** May 4, 2026

## Unreleased

- Made `index.html` the canonical six-game launcher so the root GitHub Pages URL opens the complete suite.
- Moved the original Neon Arkanoid to `neon-arkanoid.html` and kept `hub.html` as a compatibility redirect.
- Simplified the launcher's opening copy and added routing assertions to the browser smoke pass.
- Deepened TurdSpades with player/bot Nil bids, honest ±100 scoring receipts, Nil-aware bot play, and always-reachable mobile bidding controls.
- After Nil landed: TurdSpades bot cards play one at a time, tab-hide pauses those turns, and a partner overtakes a winning Nil card when it can. The hub marks the last opened game. The TurdAnoid test hook no longer ships on the public Pages host.

## Changelog (Latest)

- Suite-wide graphics pass (render/CSS only — no rules, scoring, physics, or controls changed):
  - Hub: inline-SVG cover art for all six games with hover motion, a 3×2 collection grid, and per-game accent colours.
  - Shared theme (`assets/turdsuite.css`): ambient sewer backdrop (brick tiles, rising bubbles, stink wisps, vignette) injected behind every page, plus shared tokens for card paper, card-back weave, felt grain, wooden rails, and glass panels.
  - TurdAnoid: pre-rendered sewer brick wall, shaded pipes, slime drips, a live sludge surface, vignette, smoke on brick kills, HP pips on tough bricks, glass HUD chips, gradient title screen.
  - Turdtris: HiDPI board, beveled glossy tiles, cracked-stone garbage rows, dashed ghost piece, lock flash, line-clear light sweep with sparks, framed board.
  - Crapjack 21 / Crappy Eights / TurdRummy / TurdSpades: real felt with grain and wooden rails, one shared card design (paper faces, gold-foil aces, ribbon court stickers, diamond-weave backs), casino chips, action-card badges, meld tints, four-seat Spades table with trick well and bid dial, deal/flip animations, glass HUD tiles, framed guides and overlays.
- TurdAnoid Turbo fixes and polish:
  - Fixed a level-clear bug that could award the clear bonus dozens of times and skip levels.
  - Shield now saves every ball during multiball.
  - Auto-pause when the tab loses focus.
  - Frame-rate independent physics (plays the same at 60/120/144 Hz).
  - New brick death animations, parallax sewer background, ball squash-and-stretch, paddle recoil.
- Testing overhaul: repaired the vitest suite, added real-game regression tests for TurdAnoid, cross-platform browser smoke runner (`npm run test:smoke`), and GitHub Actions CI.

Previous (v3.1):

- Hub refresh:
  - TurdAnoid moved to the top card in the game launcher.
  - Neon Arkanoid removed from hub card list.
  - New **TurdRummy** (Gin Rummy) added as the bottom hub card.
- New game added:
  - `crapeights.html` with Crazy Eights / Uno-style flow, 3 bot opponents, action-card effects (`2`, `J`, `Q`, `8`), and first-to-200 match scoring.
- New game added:
  - `turdrummy.html` with meld/deadwood analyzer, knock/gin scoring, layoff/undercut flow, and mobile-first action dock.
- New game added:
  - `turdspades.html` with 4-player partnership Spades, bidding flow, trick resolution, bag penalties, and match scoring.
- Regression checks expanded in `test-runner.ps1` for TurdRummy and updated hub link/order expectations.

## Games

### TurdAnoid

Silly Arkanoid variant (vanilla JavaScript + Canvas) with stink-based effects and capsule madness.

**Features:**
- Arkanoid-inspired capsules (Enlarge, Slow, Catch, Disruption, Laser, etc.)
- Distinct level patterns that get more complex over time
- Strongly visible stink/gas progression the longer the ball survives
- Stacking enlarge behavior (multiple length boosts actually stack)
- Touch and mouse support
- Responsive canvas (resizes on window change)
- High score persistence

**Controls:** Mouse or touch to move paddle.

### Turdtris

Tetris-inspired stacker with modern guideline-style mechanics and progressive chaos.

**Features:**
- 7-bag randomizer
- SRS-style wall kicks
- Hold and ghost piece systems
- Combo, back-to-back, T-Spin, and perfect-clear scoring
- Lock delay + gravity progression
- Level modifiers with themed progression and garbage pressure
- High score persistence

**Controls:** Arrow keys or touch gestures.

### Crapjack 21

Blackjack with a toilet-dealer vibe and persistent bankroll.

**Features:**
- Blackjack rules with dealer logic, blackjack payout, push handling, and double down/split/surrender support
- Betting chips and quick mobile action controls
- Persistent bankroll + stats in localStorage
- Responsive table layout and themed card rendering

**Controls:** Mouse/touch buttons, plus keyboard shortcuts (`N`, `H`, `S`, `D`, `C`).

### Crappy Eights

Crazy Eights with Uno-style pacing and themed table presentation.

**Features:**
- You vs 3 bot opponents
- Action cards:
  - `2` = draw two + skip
  - `J` = skip
  - `Q` = reverse direction
  - `8` = wild suit pick
- Smart move helper and keyboard shortcuts (`P`, `D`, `A`, `M`)
- Round scoring by opponents' leftover card values
- Match target race to 200 points
- Mobile-friendly controls, on-entry rules guide, and local stats persistence

**Controls:** Tap/click cards and actions, or keyboard (`P` play, `D` draw, `A` smart, `M` sound).

### TurdRummy

Gin Rummy game themed to match the rest of the hub.

**Features:**
- Real meld/deadwood hand analysis
- Knock and gin decisions from your selected discard
- Layoff and undercut scoring logic
- AI draw/discard logic tuned for reasonable play
- Fixed mobile control dock for draw/discard/knock/gin actions
- Round/match scoring with localStorage persistence

**Controls:** Tap/click cards to select discard, then use bottom action buttons.

### TurdSpades

Classic Spades (partnership trick-taking) themed for the Turdanoid hub.

**Features:**
- You + North partner vs West/East bot team
- Full bidding phase each round, including risk-gated Nil bids for people and bots
- Watchable bot play with tab-hide pause, plus partner cover when a Nil winner can be overtaken
- Trick-taking with suit-following and trump-spade rules
- Spades break logic
- Team contract scoring with transparent Nil bonuses/penalties, bags, and the 10-bag penalty
- Match target race and round summaries
- Mobile-friendly action dock and on-entry rules guide

**Controls:** Tap/click a card to select, then `Play Selected`. In the bid phase, use `-`/`+` or `Bid Nil`, then `Lock Bid`; keyboard players can press `N` for Nil and `Enter` to confirm.

## Legacy Game (Direct Link)

- `neon-arkanoid.html` - Neon Arkanoid (still available directly, not part of the six-card lineup)

## Getting Started

1. Open `index.html` (or the repository root when served) to access the current game lineup.
2. Or open an individual file:
   - `TurdAnoid.html` - TurdAnoid
   - `turdtris.html` - Turdtris
   - `turdjack.html` - Crapjack 21
   - `crapeights.html` - Crappy Eights
   - `turdrummy.html` - TurdRummy
   - `turdspades.html` - TurdSpades

## Mobile Support

All games support touch controls and responsive layouts, with primary actions placed for easier thumb reach.

## Testing

Install test tooling once:

```bash
npm install
```

Run the unit tests (Vitest, cross-platform):

```bash
npm test
```

Run the browser smoke pass (Playwright, cross-platform — serves the repo on a
local HTTP server and drives every game headlessly):

```bash
npx playwright install chromium   # one-time browser download
npm run test:smoke
```

Notes:
- The smoke pass defaults to the local Edge channel (Windows dev workflow).
  Set `PLAYWRIGHT_CHANNEL=""` to use Playwright's bundled Chromium instead
  (Linux/macOS/CI).
- Lint with `npm run lint` (covers `games/` and `tests/`).
- CI (`.github/workflows/ci.yml`) runs lint, unit tests, and the smoke pass
  on every push and pull request.

Windows-only wrappers are still available:

```powershell
powershell -ExecutionPolicy Bypass -File test-runner.ps1
powershell -ExecutionPolicy Bypass -File browser-smoke.ps1
```

## Play Online (GitHub Pages)

**Enable GitHub Pages** (one-time setup):

1. Go to https://github.com/rupret007/Turdanoid
2. Click **Settings** > **Pages**
3. Under "Build and deployment", set **Source** to "Deploy from a branch"
4. Set **Branch** to `main`, **Folder** to `/ (root)`
5. Click **Save**

After deployment:

- **Turdanoid:** https://rupret007.github.io/Turdanoid/
- **TurdAnoid:** https://rupret007.github.io/Turdanoid/TurdAnoid.html
- **Turdtris:** https://rupret007.github.io/Turdanoid/turdtris.html
- **Crapjack 21:** https://rupret007.github.io/Turdanoid/turdjack.html
- **Crappy Eights:** https://rupret007.github.io/Turdanoid/crapeights.html
- **TurdRummy:** https://rupret007.github.io/Turdanoid/turdrummy.html
- **TurdSpades:** https://rupret007.github.io/Turdanoid/turdspades.html
- **Neon Arkanoid (original):** https://rupret007.github.io/Turdanoid/neon-arkanoid.html

The `.nojekyll` file ensures GitHub Pages serves files as-is.

## Technical Notes

- **TurdAnoid**: Vanilla JavaScript (Canvas API), single file, delta-time game loop
- **Turdtris**: Vanilla JavaScript (Canvas API)
- **Crapjack 21**: Vanilla JavaScript + DOM/CSS card UI
- **Crappy Eights**: Vanilla JavaScript + DOM/CSS card UI
- **TurdRummy**: Vanilla JavaScript + DOM/CSS card UI
- **TurdSpades**: Vanilla JavaScript + DOM/CSS card UI
- **Neon Arkanoid (legacy)**: Vanilla JavaScript (Canvas API)

No build step required. Open in any modern browser.
