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

TurdAnoid Turbo (`TurdAnoid.html`) is an Arkanoid-style brick breaker with 30 levels, 19 power-ups, and a unique "stink" mechanic. (The original 69-level Neon Arkanoid remains available directly at `neon-arkanoid.html`.)

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

Tetris-style block stacking game with Guideline-inspired mechanics (7-bag, SRS kicks, combo system) across a 69-level run.

### Controls

- **←/→ or A/D**: Move piece
- **↑ or W**: Rotate clockwise
- **↓ or S**: Soft drop
- **Space**: Hard drop
- **Shift or Z**: Rotate counter-clockwise
- **C**: Hold piece
- **P**: Pause/Resume
- **M**: Toggle sound

### Scoring

| Action | Points |
|--------|--------|
| Single line | 100 × level |
| Double | 300 × level |
| Triple | 500 × level |
| Tetris (4 lines) | 800 × level |
| Back-to-Back Tetris | 1.5× bonus |
| Combo | 50 × combo × level |
| Perfect clear | 1200 × level |

### Mechanics

- **7-Bag**: All 7 pieces dealt before repeats
- **SRS (Super Rotation System)**: Wall kicks for rotation near walls
- **Lock Delay**: Piece locks after touching ground for 500ms
- **Move Resets**: Movement or rotation can restart lock delay up to 12 times per piece
- **Level Mutators**: Higher levels add changing garbage-row pressure

### Levels

- Levels 1-5 require 8 lines each
- Levels 6-15 require 10 lines each
- Levels 16-30 require 12 lines each
- Levels 31-45 require 14 lines each
- Levels 46-60 require 16 lines each
- Levels 61-69 require 18 lines each
- Speed increases with level
- Max level is 69

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
- **Dealer hole card**: Enters the count only when it is revealed

### Strategy Hint

The game provides basic strategy advice based on:
- Player hand total (hard, soft, pairs)
- Dealer's up card
- Table rules (DAS, H17)

---

## Crapeights (Crazy Eights)

### Overview

Crazy Eights match for you and three bot opponents.

### Rules

- **Goal**: Empty your hand to win rounds; the first player to 200 points wins the match
- **8s**: Wild - can be played anytime, allows suit declaration
- **Matching**: Play must match suit OR rank of top discard
- **2**: Next player draws 2 cards and loses their turn
- **J**: Skips the next player
- **Q**: Reverses play direction
- **Draw**: Draw once, then play the drawn card when legal or pass

### Scoring

The round winner receives the value of every card left in the other three hands:

| Card | Points |
|------|--------|
| 8 | 50 |
| 10, J, Q, K | 10 |
| A | 1 |
| 2-9 (except 8) | Face value |

The first player to reach 200 points wins the match.

### Controls

- **Click/Tap**: Select a card, then use `Play Selected`; use `Draw`, `Pass`, or `Smart` as available
- **P**: Play selected card
- **D**: Draw
- **A / Enter**: Smart move
- **M**: Toggle sound

### AI Strategy

1. Score legal choices by action value and the bot's remaining hand
2. Save or play wild 8s according to the best available move
3. When playing an 8, declare the suit most represented in hand
4. Draw and pass when no legal play is available

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
- **Layoff**: After a non-gin knock, the defender may add deadwood cards to the knocker's melds before scoring
- **Match**: First to 100 points wins

### Hand Size

- 10 cards each
- Draw from stock or discard pile
- Discard after each turn

### Scoring

| Outcome | Points |
|---------|--------|
| Knock | Defender deadwood after layoffs - knocker deadwood |
| Gin | 25 + defender deadwood; no layoffs |
| Undercut | 25 + the deadwood advantage held by the defender |

### AI Strategy

1. Evaluate each draw and discard by resulting deadwood and meld potential
2. Prefer useful discard-pile cards and shed expensive deadwood when safe
3. Adjust the knock threshold to the match score and round length
4. Call gin at 0 deadwood and knock only within the current threshold

---

## Turdspades

### Overview

Partnership Spades trick-taking game against two CPU opponents.

### Rules

- **Goal**: Meet or exceed your declared tricks
- **Teams**: You + North vs West + East
- **Bidding**: Each player bids 1-13 tricks or calls Nil; partners' non-Nil bids form the team contract
- **Nil**: A player calling Nil must take zero tricks. Nil tricks still count toward the team contract and overtrick bags
- **Leading**: Lead any non-spade until spades are broken; an all-spade hand may lead spades
- **Following**: Must follow suit if possible
- **Spades**: Trump suit - wins non-spade tricks
- **Breaking Spades**: A spade played while void in the lead suit breaks spades

### Scoring

| Outcome | Points |
|---------|--------|
| Make team bid | 10 × team bid + 1 per overtrick |
| Miss team bid | -10 × team bid |
| Make Nil (take zero tricks) | +100 points |
| Miss Nil (take one or more tricks) | -100 points |
| Overtrick | +1 point and +1 bag |
| 10 accumulated bags | -100 points; bag count rolls over |

### Winning

- First team to 250 points wins
- If both teams tie at or above 250, play one tiebreaker round

### AI Strategy

1. Bid from spade strength and high cards; call Nil only with a tightly risk-gated weak hand
2. Track the partnership's remaining contract need
3. A Nil bidder sheds the highest card that can safely lose; its partner overtakes that Nil winner when a cheaper cover exists and still plays for the team contract
4. Use the lowest winning card when the team still needs tricks
5. Shed low cards when the contract is safe and trump when void if a trick is needed

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
