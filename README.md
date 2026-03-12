# Turdanoid Games

A collection of six active browser games with a playful turd theme.

## Version

- **Current build:** `v3.1.0`
- **Build date:** March 12, 2026

## Changelog (Latest)

- Hub refresh:
  - TurdAnoid moved to the top card in `hub.html`.
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

Silly Arkanoid variant using p5.js with stink-based effects and capsule madness.

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
- Full bidding phase each round
- Trick-taking with suit-following and trump-spade rules
- Spades break logic
- Team scoring with bags and 10-bag penalty
- Match target race and round summaries
- Mobile-friendly action dock and on-entry rules guide

**Controls:** Tap/click card to select, then `Play Selected`; use bid controls (`-`, `+`, `Lock Bid`) in bid phase.

## Legacy Game (Direct Link)

- `index.html` - Neon Arkanoid (still available directly, no longer surfaced in hub cards)

## Getting Started

1. Open `hub.html` in a browser to access the current game lineup.
2. Or open an individual file:
   - `TurdAnoid.html` - TurdAnoid
   - `turdtris.html` - Turdtris
   - `turdjack.html` - Crapjack 21
   - `crapeights.html` - Crappy Eights
   - `turdrummy.html` - TurdRummy
   - `turdspades.html` - TurdSpades

## Mobile Support

All games support touch controls and responsive layouts, with primary actions placed for easier thumb reach.

## Play Online (GitHub Pages)

**Enable GitHub Pages** (one-time setup):

1. Go to https://github.com/rupret007/Turdanoid
2. Click **Settings** > **Pages**
3. Under "Build and deployment", set **Source** to "Deploy from a branch"
4. Set **Branch** to `main`, **Folder** to `/ (root)`
5. Click **Save**

After deployment:

- **Game Hub:** https://rupret007.github.io/Turdanoid/hub.html
- **TurdAnoid:** https://rupret007.github.io/Turdanoid/TurdAnoid.html
- **Turdtris:** https://rupret007.github.io/Turdanoid/turdtris.html
- **Crapjack 21:** https://rupret007.github.io/Turdanoid/turdjack.html
- **Crappy Eights:** https://rupret007.github.io/Turdanoid/crapeights.html
- **TurdRummy:** https://rupret007.github.io/Turdanoid/turdrummy.html
- **TurdSpades:** https://rupret007.github.io/Turdanoid/turdspades.html
- **Neon Arkanoid (legacy):** https://rupret007.github.io/Turdanoid/index.html

The `.nojekyll` file ensures GitHub Pages serves files as-is.

## Technical Notes

- **TurdAnoid**: p5.js
- **Turdtris**: Vanilla JavaScript (Canvas API)
- **Crapjack 21**: Vanilla JavaScript + DOM/CSS card UI
- **Crappy Eights**: Vanilla JavaScript + DOM/CSS card UI
- **TurdRummy**: Vanilla JavaScript + DOM/CSS card UI
- **TurdSpades**: Vanilla JavaScript + DOM/CSS card UI
- **Neon Arkanoid (legacy)**: Vanilla JavaScript (Canvas API)

No build step required. Open in any modern browser.
