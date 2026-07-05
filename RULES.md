# Turdanoid Game Rules

This document describes the game rules, scoring systems, and AI logic for each game in the Turdanoid collection.

---

## Table of Contents

1. [TurdAnoid (Arkanoid Clone)](#turdanoid-arkanoid-clone)
2. [Turdtris (Tetris Clone)](#turdtris-tetris-clone)
3. [Turdjack (Blackjack)](#turdjack-blackjack)
4. [Crapeights (Crazy Eights)](#crapeights-crazy-eights)
5. [Turdrummy (Gin Rummy)](#turdrummy-gin-rummy)
6. [Turdspades (Spades)](#turdspades)

---

## TurdAnoid (Arkanoid Clone)

### Overview

TurdAnoid Turbo (`TurdAnoid.html`) is an Arkanoid-style brick breaker with 30 levels, 19 power-ups, and a unique "stink" mechanic. (The legacy 69-level Neon Arkanoid remains available directly at `index.html`.)

### Controls

- **Mouse/Touch**: Move paddle; tap/click to launch and fire active powers
- **Space**: Start / Launch / Fire
- **A/D or Arrow Keys**: Move paddle
- **R**: Restart
- **P / Esc**: Pause/Resume

### Scoring

| Action | Points |
|--------|--------|
| Brick hit | 10 + level × 2 |
| Brick destroyed | +5 × level |
| Combo multiplier | +0.5× per 4 combo hits |
| 💰 Gold Rush | 2× all brick points |
| Level clear bonus | 200 + level × 50 |

### Power-Ups

Unlock progressively by level; bad pickups never appear before level 6.

| Power-Up | Effect |
|----------|--------|
| 📏 Enlarge | Widens paddle ~18% per pickup (stacks to 1.8×) |
| 🐌 Slow | Slows all balls |
| 🧲 Catch | Ball sticks to paddle for re-launch |
| 🌀 Multiball | Splits into up to 3 balls |
| ❤️ Extra Life | +1 life (cap 7; +2500 points beyond) |
| 🔫 Laser | Paddle fires laser bolts |
| 🧻 Toilet Paper | Paddle fires TP rolls |
| 🛡️ Shield | Bottom barrier saves falling balls |
| 🔥 Fire | All balls burn through bricks (2 damage) |
| 💣 Bomb | Instant area blast |
| 🪠 Plunger | Magnet pulls falling power-ups to paddle |
| 🚽 Mega Flush | Destroys bottom brick row |
| 🌭 Hot Dogs | Paddle fires explosive arcing sausages |
| 👻 Ghost | Ball phases through bricks, damaging them |
| 🦨 Skunk | Drops a stink cloud that chews through bricks |
| 💰 Gold Rush | 2× points for 6 seconds |
| 😬 Shrink (bad) | Shrinks paddle |
| 💨 Speed (bad) | Speeds up all balls |
| 🔄 Reverse (bad) | Mirrors controls |

### Level Progression

- **30 total levels**, 13 rotating wall patterns
- Brick HP ramps up from level 3; metal bricks appear at level 6+
- Ball and paddle speed scale with level (capped)
- Win by clearing level 30

---

## Turdtris (Tetris Clone)

### Overview

Tetris-style block stacking game with Guideline-inspired mechanics (7-bag, SRS kicks, combo system).

### Controls

- **←/→ or A/D**: Move piece
- **↑ or W**: Rotate clockwise
- **↓ or S**: Soft drop
- **Space**: Hard drop
- **Shift or Z**: Rotate counter-clockwise
- **C**: Hold piece

### Scoring

| Action | Points |
|--------|--------|
| Single line | 100 × level |
| Double | 300 × level |
| Triple | 500 × level |
| Tetris (4 lines) | 800 × level |
| Back-to-Back Tetris | 1.5× bonus |
| Combo | 50 × combo × level |

### Mechanics

- **7-Bag**: All 7 pieces dealt before repeats
- **SRS (Super Rotation System)**: Wall kicks for rotation near walls
- **Lock Delay**: Piece locks after touching ground for 500ms
- **Infinity Rotation**: Unlimited rotation before piece locks (within lock delay)

### Levels

- Level increases every 10 lines cleared
- Speed increases with level
- Max level is 15

---

## Turdjack (Blackjack)

### Overview

Single-deck to 8-deck Blackjack with configurable rules, Hi-Lo card counting, and strategy hints.

### Controls

- **N**: Deal new hand
- **H**: Hit
- **S**: Stand
- **D**: Double down
- **P**: Split pair
- **X**: Surrender (if enabled)
- **C**: Clear bet
- **B**: Rebet last amount
- **Enter**: Smart action (follows basic strategy)

### Rules Configuration

| Option | Values |
|--------|--------|
| Dealer hits soft 17 | Stand / Hit |
| Blackjack payout | 3:2 / 6:5 |
| Decks | 1, 2, 4, 6, 8 |
| Double after split | Yes / No |
| Late surrender | Yes / No |
| Insurance | Yes / No |
| Hit split aces | Yes / No |

### Scoring

- **Blackjack**: 3:2 payout (or 6:5 if configured)
- **Win**: 1:1 payout
- **Push**: Bet returned
- **Surrender**: Half bet returned

### Card Counting (Hi-Lo)

- **Low cards (2-6)**: +1
- **High cards (10, J, Q, K, A)**: -1
- **True Count**: Running count ÷ remaining decks

### Strategy Hint

The game provides basic strategy advice based on:
- Player hand total (hard, soft, pairs)
- Dealer's up card
- Table rules (DAS, H17)

---

## Crapeights (Crazy Eights)

### Overview

Classic Crazy Eights card game against a CPU opponent.

### Rules

- **Goal**: Be the first to play all cards
- **8s**: Wild - can be played anytime, allows suit declaration
- **Matching**: Play must match suit OR rank of top discard
- **Draw**: If no playable card, draw from deck

### Scoring

- No points during play
- Winner is first to empty their hand
- Opponent's cards count against them (simplified: just win/lose)

### Controls

- **Click card**: Play card (when valid)
- **Click deck**: Draw card

### AI Strategy

1. Play non-8 matches first (saves 8s for tough situations)
2. If must play 8, declare suit with most cards in hand
3. Draw when no playable cards

---

## Turdrummy (Gin Rummy)

### Overview

Gin Rummy card game against an AI opponent.

### Rules

- **Goal**: Form melds (sets of 3-4 same rank, runs of 3+ same suit)
- **Deadwood**: Unmatched cards count against you (J,Q,K = 10, A = 1)
- **Knock**: Declare when deadwood ≤ 10
- **Gin**: 0 deadwood - automatic win
- **Undercut**: If opponent knocks and you have less deadwood

### Hand Size

- 10 cards each
- Draw from stock or discard pile
- Discard after each turn

### Scoring

| Outcome | Points |
|---------|--------|
| Knock | Opponent deadwood - your deadwood |
| Gin | 25 bonus + opponent deadwood |
| Undercut | 25 bonus |
| Opponent Deadwood | Added to your score |

### AI Strategy

1. Prioritize forming sets over runs
2. Hold onto high cards for potential sets
3. Track discards for opponent's likely melds
4. Knock when safe (deadwood ≤ 10)

---

## Turdspades

### Overview

Partnership Spades trick-taking game against two CPU opponents.

### Rules

- **Goal**: Meet or exceed your declared tricks
- **Teams**: Players 0+2 vs Players 1+3
- **Leading**: Can lead any card
- **Following**: Must follow suit if possible
- **Spades**: Trump suit - wins non-spade tricks
- **Breaking Spades**: Cannot lead spade until a player is void in lead suit

### Scoring

| Outcome | Points |
|---------|--------|
| Made bid exactly | Bid value |
| Made bid + overtricks | Bid + overtricks |
| Failed bid | -Bid value |
| Sandbagging (exact) | Bid × 2 |

### Winning

- First team to 500 points wins
-bags (under 100 score) can result in bag penalty

### AI Strategy

1. Count cards played to track remaining suits
2. Save high spades for winning tricks
3. Lead strong suits early
4. Bid based on spade count and high cards

---

## Shared Utilities

### Card Representations

- **Ranks**: A, 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K
- **Suits**: S (Spades ♠), H (Hearts ♥), D (Diamonds ♦), C (Clubs ♣)

### Hi-Lo Card Counting Values

| Cards | Value |
|-------|-------|
| 2, 3, 4, 5, 6 | +1 |
| 7, 8, 9 | 0 |
| 10, J, Q, K, A | -1 |

---

## Engine Architecture

Each game has a decoupled JavaScript engine in `games/` that can be imported and tested independently:

```
games/
├── turdanoid_logic.js    # TurdAnoid physics/balance
├── turdtris-engine.js    # Tetris logic
├── turdjack-engine.js    # Blackjack logic  
├── crapeights-engine.js  # Crazy Eights logic
├── turdrummy-engine.js   # Gin Rummy logic
├── turdspades-engine.js  # Spades logic
└── cards.js             # Shared card utilities
```

### Running Tests

```bash
npm test           # Run all tests
npm run test:watch # Watch mode
npm run lint       # Lint code
npm run format     # Format code
```
