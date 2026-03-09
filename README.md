# Turdanoid Games

A collection of four browser games with a playful turd theme.

## Version

- **Current build:** `v2.8.0`
- **Build date:** March 9, 2026

## Changelog (Latest)

- Mobile UX pass across all games:
  - Compact mobile menus for top actions.
  - Sticky/fixed mobile control areas for faster thumb access.
  - Crapjack mobile pit now supports quick betting and core round actions without scrolling.
- Onboarding pass:
  - Added quick-start entry buttons to game welcome overlays.
- Progression and balancing upgrades:
  - TurdAnoid: expanded late-game pattern pool and mutator variety.
  - Turdtris: richer level mutators beyond simple garbage injection.
  - Neon Arkanoid: balance constants and stronger late-wave mutator pressure.
- Regression checks expanded in `test-runner.ps1` for new mobile/UX hooks.

## Games

### Neon Arkanoid

Classic brick-breaker with neon aesthetics. Break blocks with the ball, collect power-ups, and level up!

**Features:**
- Combo multiplier for consecutive block hits (displayed in UI)
- Power-ups: Toilet Paper, Multi-Ball, Big/Small Paddle, Slow Motion, Extra Life, Laser, Magnet, Ghost Ball, Fire Ball
- Screen shake on life loss and level clear
- Level-up celebration particles
- Sound effects with mute toggle
- High score persistence (localStorage)
- Responsive canvas and touch support
- "How to play" hint on first visit

**Controls:** Mouse or touch to move paddle. Space or P to pause. R to restart (when implemented). Mute button in UI.

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
- Responsive layout
- Touch controls: swipe to move, tap to rotate, swipe down to drop

**Controls:** Arrow keys or touch gestures.

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
- "Tap to play again" on mobile

**Controls:** Mouse or touch to move paddle.

### Crapjack 21

Blackjack with a toilet-dealer vibe and persistent bankroll.

**Features:**
- 21 rules with dealer logic, blackjack payout, push handling, and double down
- Betting chips, max/clear bet, keyboard shortcuts
- Persistent bankroll + hand stats in localStorage
- Responsive table layout and themed card rendering

**Controls:** Mouse/touch buttons, plus keyboard shortcuts (`N`, `H`, `S`, `D`, `C`).

## Getting Started

1. Open `hub.html` in a browser to access all games from one place
2. Or open individual game files directly:
   - `index.html` - Neon Arkanoid
   - `turdtris.html` - Turdtris
   - `TurdAnoid.html` - TurdAnoid
- `turdjack.html` - Crapjack 21

## Mobile Support

All games support:
- Touch controls
- Responsive layouts
- Viewport scaling for small screens

## Play Online (GitHub Pages)

**Enable GitHub Pages** (one-time setup):

1. Go to https://github.com/rupret007/Turdanoid
2. Click **Settings** > **Pages**
3. Under "Build and deployment", set **Source** to "Deploy from a branch"
4. Set **Branch** to `main`, **Folder** to `/ (root)`
5. Click **Save**

After a minute or two, your games will be live at:

- **Game Hub:** https://rupret007.github.io/Turdanoid/hub.html
- **Neon Arkanoid:** https://rupret007.github.io/Turdanoid/index.html
- **Turdtris:** https://rupret007.github.io/Turdanoid/turdtris.html
- **TurdAnoid:** https://rupret007.github.io/Turdanoid/TurdAnoid.html
- **Crapjack 21:** https://rupret007.github.io/Turdanoid/turdjack.html

The `.nojekyll` file ensures GitHub Pages serves the files as-is.

## Technical Notes

- **Neon Arkanoid**: Vanilla JavaScript (Canvas API)
- **Turdtris**: Vanilla JavaScript (Canvas API)
- **TurdAnoid**: p5.js
- **Crapjack 21**: Vanilla JavaScript + DOM/CSS card UI

No build step required. Open in any modern browser.
