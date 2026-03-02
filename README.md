# Turdanoid Games

A collection of three retro-style browser games with a playful turd theme.

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

Tetris-style game with brown-themed pieces.

**Features:**
- Classic Tetris scoring
- High score persistence
- Responsive layout
- Touch controls: swipe to move, tap to rotate, swipe down to drop

**Controls:** Arrow keys or touch gestures.

### TurdAnoid

Simple brick-breaker with a turd ball using p5.js.

**Features:**
- Power-ups: Big Paddle, Extra Life, Slow Ball, Toilet Paper (shoots upward)
- Touch and mouse support
- Responsive canvas (resizes on window change)
- High score persistence
- "Tap to play again" on mobile

**Controls:** Mouse or touch to move paddle.

## Getting Started

1. Open `hub.html` in a browser to access all games from one place
2. Or open individual game files directly:
   - `index.html` - Neon Arkanoid
   - `turdtris.html` - Turdtris
   - `TurdAnoid.html` - TurdAnoid

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

The `.nojekyll` file ensures GitHub Pages serves the files as-is.

## Technical Notes

- **Neon Arkanoid**: Vanilla JavaScript (Canvas API)
- **Turdtris**: Vanilla JavaScript (Canvas API)
- **TurdAnoid**: p5.js

No build step required. Open in any modern browser.
