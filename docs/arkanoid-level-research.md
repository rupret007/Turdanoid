# Arkanoid (1986) level design — research note

Research done before the TurdAnoid "Arkanoid pass" (bigger bricks + hand-designed 30-round campaign).

## What Arkanoid does

| Topic | Arkanoid (Taito arcade, July 1986) | Source |
|---|---|---|
| Rounds | 33: 32 brick rounds, then the DOH boss (hit 16 times while dodging shots). | [1], [2] |
| Grid | Arcade field is **13 bricks wide** (16×8 px bricks, 2:1 ratio). The NES port uses **11 wide × up to 28 tall** cells. | [3], [5] |
| Colour bricks | One hit. Eight colours with rising points: white 50, orange 60, light blue 70, green 80, red 90, blue 100, pink 110, yellow 120. | [2], [4] |
| Silver bricks | Multi-hit. 2 hits in rounds 1–8, 3 in 9–16, 4 in 17–24, 5 in 25–32. Worth 50 × round. | [2] |
| Gold bricks | Indestructible. Don't count toward the clear; they channel the ball and gate parts of the wall. | [1], [2], [4] |
| Round 1 | A row of silver on top of **six flat rows of colour**: the whole lesson is "bounce and aim". | [1] |
| Difficulty curve | Early rounds are flat colour bands and simple blocks. Later rounds are **pictures** (shapes, invaders, fortresses), add more silver, gold walls that split the field or hide bricks, and the ball speeds up. Capsules (Slow, Catch, Expand, Disruption, Laser, Break, Player) soften it. | [1], [2], [4] |
| Colour use | Colours are consistent across rounds and drawn in **clusters** (a band or a block of one colour), so a wall reads as a picture, not noise. | [3], [4] |

## How clones push it further

- **DX-Ball / DX-Ball 2**: regular, multi-hit (usually 3 hits), invisible/hidden, indestructible, "almost invincible" (one hit turns it indestructible) and explosive bricks that chain. Indestructible bricks are used as barriers, with explosive bricks placed next to them so every board stays clearable. [6], [7]
- **Level-design archetypes** for Breakout-likes: classic rows, mesh/lattice, bumper clusters, split-screen walls (a breakable or indestructible divider), pictures, and moving formations. Unbreakable blocks exist to *limit access* and *channel the ball*. [8]

## What we took for TurdAnoid

1. **Bigger bricks.** 9 columns instead of 11 (Arkanoid's 13 is too dense on a 320 px phone). Bricks keep a wide ~10:7 shape. Measured: 320 px phone 28×20 px (was 19×17.5), 390 px 36×25 (was 25×23), desktop 39×27 (was 28×25). A test pins ≥ 28×20 at 320 px for every round.
2. **Colour bands first.** Rounds 1–4 use only 1-hit colour bricks (`a`–`f`) in bands and clusters, the way Arkanoid round 1 does. Every brick in a cluster is the same colour (no random tinting).
3. **Teach one new brick at a time**: 2-hit tiles (R5), steel = Arkanoid's gold (R6, Bathroom boss), metal 4-hit (R9), silver 2-hit (R10), slime drip hazard (R11), gold-material 3-hit and tar (R19).
4. **Pictures later.** Rounds 13–30 are shaped walls: swirl, invader, plunger, toilet, heart, castle, hourglass, diamond, skull, lattice, crown, split pipes, spiral, cathedral, fortress.
5. **Steel channels, never seals.** Every round is checked by `isClearable` (flood fill from below), so steel can split the board (R25) or bracket a core (R21) but never box in a required brick.
6. **Curve.** Total brick HP, drip count and ball speed never drop from one round to the next. Boss beats stay at 6/12/18/24/30.

## Sources

1. Games Explained, *Arkanoid (C64)* — https://gamesexplained.com/c64/arkanoid/
2. Arkanoid NES manual (silver hits per round, 33 rounds, scores) — https://atarihq.com/tsr/manuals/arkanoid.txt
3. Nick Aschenbach, *Arkanoid Game Levels* (NES maps, 11×28 grid, colour legend) — http://nick-aschenbach.github.io/blog/2015/04/27/arkanoid-game-levels/
4. Arkanoid (Tandy CoCo) manual, scoring table and brick types — https://colorcomputerarchive.com/repo/Documents/Manuals/Games/Arkanoid%20(Tandy).pdf
5. Wikipedia, *Arkanoid* — https://en.wikipedia.org/wiki/Arkanoid ; StrategyWiki stage list — https://strategywiki.org/wiki/Arkanoid/Walkthrough
6. NamuWiki, *DX-Ball* — https://en.namu.wiki/w/DX-Ball
7. Steam guide, *DX-Ball 2: A Complete Guide to Mechanics* — https://steamcommunity.com/sharedfiles/filedetails/?id=1573212121
8. Game Developer, *Breaking Down Breakout: System and Level Design for Breakout-style Games* — https://www.gamedeveloper.com/design/breaking-down-breakout-system-and-level-design-for-breakout-style-games
