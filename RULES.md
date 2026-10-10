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

TurdAnoid Turbo (`TurdAnoid.html`) is an Arkanoid-style brick breaker with 30 levels across five themed worlds (six levels each), 19 power-ups, optional **Boss Flush** (separate best score: `turdanoid_boss_best_v1`), and a unique "stink" mechanic. Classic campaign best remains `turdanoid_v2_best`. (The original 69-level Neon Arkanoid remains available directly at `neon-arkanoid.html`.)

### Controls

- **Mouse/Touch**: Move paddle; tap/click to launch and fire active powers
- **Space**: Start / Launch / Fire
- **A/D or Arrow Keys**: Move paddle
- **R**: Restart
- **P / Esc**: Pause/Resume (pause overlay shows control reminders)

### Scoring

| Action | Points |
|--------|--------|
| Brick hit | 10 + level × 2 |
| Brick destroyed | +5 × level |
| Combo multiplier | +0.5× per 4 combo hits |
| 💰 Gold Rush | 2× all brick points |
| Level clear bonus | 200 + level × 50 (shown on an animated tally screen; Space/tap to skip) |

### Power-Ups

Unlock progressively by level; bad pickups never appear before level 6.

| Power-Up | Effect |
|----------|--------|
| 📏 Enlarge | Widens paddle ~18% per pickup (stacks to 1.8×). Size lasts until the timer dies, including across a wall clear |
| 🐌 Slow | Slows all balls |
| 🧲 Catch | Ball sticks to paddle for re-launch |
| 🌀 Multiball | Splits into up to 3 balls |
| ❤️ Extra Life | +1 life (cap 7; +2500 points beyond) |
| 🔫 Laser | Paddle fires laser bolts |
| 🧻 Toilet Paper | Paddle fires TP rolls |
| 🛡️ Shield | Bottom barrier saves falling balls |
| 🔥 Fire | All balls burn through bricks (2 damage) |
| 💣 Bomb | Instant area blast. Destroyed bricks pay the destroy bonus, doubled during Gold Rush. Damaged survivors score nothing |
| 🪠 Plunger | Magnet pulls falling power-ups to paddle |
| 🚽 Mega Flush | Destroys the bottom brick row. Each removed brick pays 15 × level, doubled during Gold Rush, with a `+points` float and the usual pickup roll. Upper bricks stay on the wall |
| 🌭 Hot Dogs | Paddle fires explosive arcing sausages |
| 👻 Ghost | Ball phases through bricks, damaging them |
| 🦨 Skunk | Drops a stink cloud that chews through bricks |
| 💰 Gold Rush | 2× points for 6 seconds |
| 😬 Shrink (bad) | Shrinks paddle. Size lasts until the timer dies, including across a wall clear |
| 💨 Speed (bad) | Speeds up all balls |
| 🔄 Reverse (bad) | Mirrors controls |

### Level Progression

- **30 total levels**, 18 rotating wall patterns (13 classics + 5 new: Fortress, Ring, Columns, Plunger X, Drip Wall)
- Brick HP ramps up from level 3; metal bricks appear at level 6+
- Ball and paddle speed scale with level (capped)
- Enlarge and Shrink last until their timers die, including across a wall clear. Losing a life still resets the paddle
- Win by clearing level 30

---

## Turdtris (Tetris Clone)

### Overview

Tetris-style block stacking game with Guideline-inspired mechanics (7-bag, SRS kicks, combo system) across a 69-level run.

Classic is the default on every page load. In Run Menu, choose a challenge and press **Start selected mode** to begin a fresh run. **Sprint 40L** measures active time to clear 40 lines; only completed runs set a best time (`turdtrisSprint40BestMs_v1`). **Ultra 2:00** gives two minutes of active play to score; it saves a separate best (`turdtrisUltra120Best_v1`). Pausing stops either clock. Both challenges keep Classic scoring and speed progression but omit garbage. Challenge records never change `turdtrisHighScore`; Play Again repeats the current mode.

### Controls

- **←/→**: Move piece
- **↑ or X**: Rotate clockwise
- **↓**: Soft drop
- **Space**: Hard drop
- **Z**: Rotate counter-clockwise
- **C**: Hold piece
- **P**: Pause/Resume
- **M**: Toggle sound
- **Space / Enter** after a wipeout: Play Again

### Scoring

| Action | Points |
|--------|--------|
| Single line | 100 × level |
| Double | 300 × level |
| Triple | 500 × level |
| Tetris (4 lines) | 800 × level |
| Back-to-Back Tetris | 1.5× bonus |
| Combo | 50 × combo × level |
| T-spin (0 / 1 / 2 / 3 lines) | 100 / 400 / 800 / 1200 × level |
| Perfect clear | 1200 × level added to the clear |

### Mechanics

- **7-Bag**: All 7 pieces dealt before repeats
- **SRS (Super Rotation System)**: Wall kicks for rotation near walls
- **Lock Delay**: Piece locks after touching ground for 500ms
- **Move Resets**: Movement or rotation can restart lock delay up to 12 times per piece
- **Level Mutators**: Higher levels add changing garbage-row pressure
- **Next-level pulse**: Shows the exact remaining line goal and previews the next recorded modifier before it lands
- **Mobile play dock**: Move, rotate, hard drop, soft drop, hold, and pause stay on the thumb dock — none of them hide behind More Controls
- **Mobile Hold / Next**: The held piece and next piece stay on the thumb dock so a phone run can see the queue without scrolling. Hold dims after it is used this piece, and a second tap does not swap
- **Frame hitch clamp**: A stalled frame cannot dump extra gravity; motion stays capped to one 33ms step
- **End-run receipt**: Score, lines, max combo, Turdtrises, active time and pieces per second. Personal bests keep the existing `turdtrisHighScore` format. Space or Enter starts the next run
- **Board-first mobile**: At phone widths the side panel hides, the HUD compacts, and the playfield gets priority above the thumb dock
- **Level-up flash**: Clearing a level goal triggers a brief well flash and on-board level banner
- **Clear spectacle**: Rows swirl down a drain, larger clears produce more particles, and four lines take over the board with TURDTRIS! T-spin and perfect-clear scoring is unchanged; a single-line T-spin is correctly labeled SINGLE
- **Board gestures**: Tap to rotate; swipe horizontally up to five columns; slow down-swipes soft drop; quick up/down flicks hard drop. Ambiguous diagonal swipes do nothing. Toggle in Run Menu (`turdtrisGestures_v1`)
- **Audio**: Distinct synthesized actions, line-count arpeggios, danger heartbeat and a light music loop. Everything waits for a user gesture and respects `turdtrisSoundOn_v1` and `turdsuite_muted`. Music can be disabled separately (`turdtrisMusic_v1`); the loop stops during pause, guide, game over and tab blur
- **Movement tuning**: Run Menu pauses the game and offers keyboard DAS/ARR and soft-drop speed (`turdtrisInputFeel_v1`). Defaults preserve 156ms DAS, 33ms ARR and classic gravity/15 (minimum 20ms) soft drop. Thumb repeat keeps its existing timing
- **Desktop cabinet (≥981px)**: Centered tall well, Hold on the left, up to five upcoming pieces on the right, score/level/lines/combo/B2B in a side column, next-flush progress and status beneath, controls collapsed under a **?** drawer. Phone layout is unchanged
- **Attract screen**: First visit (or **How To Play**) shows a logo, classic best, mode picker, and reduced-motion-safe falling-piece backdrop; **Play** starts the selected mode, **Quick Start** starts a live run, and **Close Guide** dismisses the overlay without starting a new run
- **Landing feedback**: Ghost shimmer shows the landing position; a small meter shows the existing 500ms lock delay. A blocked rotation can carry into the next spawn for 120ms, once; pause, guide, blur and restart clear it
- **Art chapters**: Porcelain Palace (1–4), Midnight Sewer (5–8), Biolume Lagoon (9–12), Cosmic Commode (13–69), with cached glossy face tiles, spawn pop, lock squash and hard-drop streaks
- **Reduced motion**: No shaking, flashing, particles, haptics, background drift, ghost shimmer, tile transforms or sliding text. Static ghost, danger tint, lock meter and clear labels remain readable

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

Crapjack 21 (`turdjack.html`) is single-deck to 8-deck Blackjack with configurable rules, Hi-Lo card counting, and strategy hints. The hub name is Crapjack 21; this rules heading, the file, and storage keys stay `turdjack*`.

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
- **Continue**: A live hand is saved on this device. The deducted bet comes back with the cards; lifetime bankroll is not rewritten until the hand settles. Hidden dealer holes stay out of the count.

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

### Table feedback

- **Table layout:** Felt-first desktop view with discard tray (left), shoe (right), bet circle, and chip rack on the felt; round actions sit in the pit rail under the table.
- **Table Intel:** `📋 Table Intel` opens the slide-out drawer (strategy hint, history, rules, practice mode). Tap the hint line during a hand to pulse the recommended action.
- **Hand totals:** Large badges beside each score show hard/soft totals; the pip meter under your hand animates in the 17–21 bust-risk zone.
- **Moments:** Blackjack shows a **CRAPJACK!** banner with fanfare; busts crumble with flush SFX; hot/cold streaks appear on the table edge.
- **Shoe lane:** Cards remaining and cut-card distance by the shoe.
- **Practice mode:** Optional toggle in Table Intel flags basic-strategy mistakes without changing saved `turdjackStats` shape (optional fields only).
- **Sound:** `M` toggles `turdjackSoundOn_v1`; hub mute (`turdsuite_muted`) silences table SFX too.
- **Motion:** `prefers-reduced-motion` disables deal flight, chip fly, table shake, particle bursts, and most mascot animations.

### Strategy Hint

The game provides basic strategy advice based on:
- Player hand total (hard, soft, pairs)
- Dealer's up card
- Table rules (DAS, H17)

The hard-15/16 surrender recommendations do not apply to soft hands, where an
ace can still count as 11. Hint, Smart (including Enter) and Discipline feedback
use that same distinction. For example, Ace-five against a dealer nine is a
Hit, not an automatic surrender; the hint explains that the ace can count as 1.
Manual surrender remains a legal first decision when the table allows it.

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
- **Continue**: Leaving for the hub saves this device's match; returning restores hands, scores, and the current turn

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

- **Click/Tap**: Select a lit card, then use `Play Selected`; tap the selected card again to play. Use `Draw`, `Pass`, or `Smart` as available
- **Arrow keys / Home / End**: Browse your focused hand; Enter/Space selects the focused card
- **Sort: Suit / Rank**: Reorder the display without changing your cards
- **Wild wheel**: Choose a suit, with remaining card counts and a recommendation; Escape / Back to hand cancels before playing
- **Table details**: Open the paused rules, log, standings and bot difficulty drawer; Back to table / Escape resumes
- **Hand fan**: Every card stays on the table; large hands use additional rows to preserve touch targets. A selected card lifts above the fan
- **Points at risk**: Shows the value opponents collect from your hand if they go out
- **P**: Play selected card
- **D**: Draw
- **A / Enter**: Smart move
- **M**: Toggle sound

### AI Strategy

1. Plan suit continuity and rank bridges using only the bot's own hand and public information
2. Hold wild 8s as escape cards, but shed their 50-point risk when opponents are close to going out
3. Use draw-two, skip and reverse against visible threats, considering who receives the next turn
4. Infer weak suits from public draws/passes; these clues fade as more cards are played
5. Choose a wild suit using remaining cards and public clues; draw and pass when no legal play exists

Choose **Easy**, **Normal** (default), or **Sharp** in Table details. Easy plays simple matches. Normal retains the original fair strategy above. Sharp searches future suit/rank routes, saves bridging 8s, and plans consecutive Draw Two plays on future turns. Penalties still resolve immediately: Draw Twos cannot be stacked in response.

AI observations reset on round start or continue; existing saved tables load unchanged. `Smart` always uses Normal. Difficulty and new display-only personal stats are stored separately from the unchanged v1 match save. Scoring and the 200-point target are unchanged. The end-of-round receipt reveals and totals the opponents' leftovers; a match winner receives the Sewer Crown.

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
- **Continue**: A live table is saved on this device. Match scores without a table are not restored, so an abandoned round cannot skip ahead

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
5. Remembers every card seen in the discard pile: among near-tied discard choices, prefers to shed cards whose rank or same-suit run neighbors are already dead (less likely to feed the opponent a set or run)
6. Remembers what you took from the discard pile: a card that would help a set or run you are building (same rank, or same suit one or two ranks away) costs the bot extra to discard. Cards you threw back stop counting. This memory lives for the round and is not saved, so a reload forgets it
7. Knock timing adds stock pressure (Normal and Sharp): once the stock is down to 4 or fewer cards and the bot has taken six turns this round, it accepts one more point of deadwood before knocking

### Bot Difficulty

Use the **Bot** button in the top bar to cycle **Easy → Normal → Sharp**. The choice is saved on this device under its own key and applies from the next bot decision.

| Level | Behaviour |
|-------|-----------|
| Easy | Ignores what you are building and makes small scoring mistakes; knocks only with two points less deadwood than Normal |
| Normal | The strength above: discard-pile memory, what you took from the discard, stock pressure |
| Sharp | Leans harder on what you are building and will knock with one point more deadwood than Normal |

### Table & Coach

- Your hand is grouped by meld: each set or run sits under a coloured bracket, and deadwood cards sit lower in their own grey group. Arrow keys move between cards, and focus stays on the same card after each move
- Stats (rounds, wins, gins, undercuts) sit in a drawer under your hand, with the meld readout and a short log of recent moves. The drawer opens by default on wide screens and folds on phones
- Knock glows when a knock is legal; Gin shimmers when gin is possible
- When the round ends, the bot's hand turns face-up, laid-off cards fly onto the knocker's melds, and a banner counts up the deadwood and the points. The banner never takes clicks
- When the match ends, a trophy panel shows your saved stats for this device with **Rematch** and **Keep Table**
- The first round starts with a short coach (draw, discard, melds, knock). It advances on the actions it describes, can be skipped, and does not come back once finished
- Cards fly between the piles and the hands when they are drawn or discarded. Motion is off under the reduced-motion preference, and the game is fully playable without it

### Sound & Feel

- Sound is on by default; toggle with the topbar Sound button (independent of the other games' mute settings)
- Draw, discard, invalid-action, knock, gin, undercut and match-end each have a distinct synthesized cue; layoffs and the round-banner count-up have their own short cues
- Gin, undercut and match wins add a short confetti burst and a light haptic buzz on supported devices; both are skipped automatically when the OS-level reduced-motion preference is on

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
- Leaving for the hub saves the match on this device; returning continues the same bids, tricks, and score

### AI Strategy

1. Bid from spade strength and high cards; call Nil only with a tightly risk-gated weak hand
2. Track the partnership's remaining contract need
3. A Nil bidder sheds the highest card that can safely lose; its partner overtakes that Nil winner when a cheaper cover exists and still plays for the team contract
4. Use the lowest winning card when the team still needs tricks
5. Shed low cards when the contract is safe and trump when void if a trick is needed
6. **Difficulty** (top bar, stored as `turdspades_ai_difficulty_v1`): **Easy** mirrors classic heuristics; **Normal** (default) tracks played spades and avoids overtrumping a set partner; **Hard** is more conservative with trump when bags/contract are safe

### Controls

- **Bid**: +/- dial, bid chips, **N** for Nil, **Lock Bid** (or **Enter**)
- **Play**: Tap/select a legal card, **Play Selected** (or **Enter**); **←/→** move focus among legal cards
- **Round end**: **Next Round** or **Enter**
- Screen reader: live announcements for bot plays, trick wins, spades broken, and round scoring

### Table UI (1000x)

- Compact **Us vs Them** strip always visible; **Score details** expands the full stat tiles
- Bid with the dial, **0–13 chips**, or **N** for Nil; hand hint suggests expected tricks
- Seat avatars, trick stacks, deal/sweep motion (disabled with reduced motion)

### Presentation (1000x lane)

- WebAudio synth for card play, trick wins, spades broken, bids, bag penalties, and match end (respects `turdsuite_muted`; unlocks after first tap/key)
- Trick cards sweep toward the winner; spades broken triggers a felt pulse (animations respect `prefers-reduced-motion`)
- Bots briefly explain their line (Nil duck, cover, chase, slough) in an on-table hint bar

---

## Shared Utilities

### Suite modules (hub + opt-in games)

- **`assets/turdsuite.js`** — toast, hype, mute (`turdsuite_muted`), back pill (bottom on wide; **top-left icon ≤520px** unless `body data-suite-back="bottom"`), continue API, lazy **`Suite.audio()`** / **`Suite.fx()`** / **`Suite.announce()`**.
- **`assets/suite-touch.js`** — mobile touch policy: CSS `touch-action` only (no touchend `preventDefault` double-tap guard).
- **`assets/suite-back-pill.js`** — placement + overlap helpers for tests/tools.
- **`assets/suite-audio.js`** — WebAudio presets (`snap`, `chip`, `shuffle`, `tick`, `win`, `lose`, …); honours mute; see `docs/1000x/shared.md`.
- **`assets/suite-fx.js`** — screen shake, flash, confetti; respects `prefers-reduced-motion`.
- **`assets/suite-a11y.js`** — skip link + `aria-live` announcer.
- **`assets/suite-hub-stats.js`** — read-only stat chips (`turdanoid_v2_best`, `turdanoid_boss_best_v1`, `turdtrisHighScore`, bankroll/stats keys, `turdrummy_stats_v1`, optional `turdspades_stats_v1`).
- **`assets/suite-ambient.js`** — parallax sewer backdrop depth + critters; pauses when tab hidden or reduced motion.
- **`assets/suite-hub-attract.js`** — hub cover idle SVG motion (off-screen + hidden-tab pause).
- **`assets/turdsuite.css`** — shared card paper/back tokens, `.suite-table-felt`, `.suite-chip`, deal/slide motion classes.

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
