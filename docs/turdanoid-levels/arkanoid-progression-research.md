# Turdanoid: Arkanoid-style progression and "what makes breakout fun"

Research done before the October 2026 level redesign, as Jeff asked. The direction: start very basic like Arkanoid, get progressively crazier, make the walls **look cool** (symmetric classic shapes), keep the punk theme light (one checkerboard, one anarchy sign), and make it genuinely fun.

## Sources

- Arkanoid NES manual (Taito): silver bricks take 2 hits in rounds 1-8, 3 in 9-16, 4 in 17-24 and 5 in 25-32, gold bricks can't be broken, 33 rounds ending with DOH. https://www.digitpress.com/library/manuals/nes/Arkanoid.pdf
- Wikipedia, *Arkanoid*: power-up capsules, multi-hit and indestructible bricks, a new pattern every round. https://en.wikipedia.org/wiki/Arkanoid
- PrimeTime Amusements, "Getting Good: Arkanoid": the ball speeds up as you play, the Slow capsule is a relief valve, and silver bricks are worth 50 x round. https://primetimeamusements.com/getting-good-arkanoid/
- KANI's Arkanoid round maps (shows the layouts round by round). https://kani.no.coocan.jp/arkanoid/round_tabletag.htm
- StrategyWiki, *Revenge of Doh* walkthrough and gameplay: 34 stages with two route choices, silver hits go up every 8 stages, regenerating and moving bricks, two boss stages. https://strategywiki.org/wiki/Arkanoid:_Revenge_of_Doh/Walkthrough and https://strategywiki.org/wiki/Arkanoid:_Revenge_of_Doh/Gameplay
- Retrocean, *Revenge of DOH*: the ball speeds up much harder than in the original, and rounds can be cleared without breaking the regenerating bricks. https://retrocean.com/arcade/arkanoid-revenge-of-doh/
- The Cutting Room Floor, *Revenge of DOH*: the US version swapped in an easier round 1 full of power-ups. https://tcrf.net/Arkanoid:_Revenge_of_DOH_(Arcade)
- Jonasson and Purho, "Juice it or lose it" (2012), a Breakout clone made juicy: tweening, particles, screen shake, a different sound for each kind of hit, and combo pitch that climbs. https://www.youtube.com/watch?v=Fy0aCDmgnxg (notes: https://devblog.heisarzola.com/gdcr-juice-it-or-lose-it/)
- Jan Willem Nijman (Vlambeer), "The Art of Screenshake" (2013): hit-stop/"sleep" of about 20 ms, shake, impact effects and permanence. https://www.youtube.com/watch?v=AJdEqssNZ-U
- Game Developer, "Shatter solved The Breakout Problem": long dead stretches spent chasing the last bricks, fixed by giving the player limited influence over the ball. https://www.gamedeveloper.com/design/shatter-solved-the-breakout-problem-please-don-t-keep-making-the-same-mistake-
- Chris George, brick-breaker research: the last few bricks are where the whole genre gets frustrating, and Arkanoid power-ups feel easy to lose. https://chrisgeorgegames.com/2019/04/14/unscientific-results-from-unscientific-research-on-brick-breakers/
- Cinquemani, "Breaking Brix": the last brick needs too much precision, so add a limited pull mechanic. http://www.cinquemani.it/2016/05/16/breaking-brix-breaking-down-a-design-exercise/
- DX-Ball 2 guide and wiki: good (blue) vs bad (red) power-ups, Fireball and Thru-brick are strong but cost something. https://steamcommunity.com/sharedfiles/filedetails/?id=1573212121
- Forbes review of *Breakout: Recharged*: power-ups vs bricks that fight back, "nearly always fair". https://www.forbes.com/sites/mattgardner1/2022/02/07/breakout-recharged-review-old-dog-new-bricks/

## What the research says

1. **Difficulty climbs on several dials at once, in small steps.** Arkanoid raises silver brick toughness every 8 rounds, adds gold (unbreakable) bricks for blocking and routing, and speeds the ball up. *Revenge of Doh* adds new brick behaviour per block of rounds. It's never one big jump.
2. **Round 1 is a plain wall.** Classic Arkanoid opens on flat colour bands. *Revenge of Doh* US even made round 1 easier and full of power-ups. The first minutes teach the bounce and nothing else.
3. **Layouts are pictures.** Arkanoid's rounds are bold, mostly mirror-symmetric shapes (pyramids, diamonds, invaders, arrows, waves). Symmetry and a few colour clusters make a wall readable in a second, and the player can plan "go up the sides" or "tunnel in".
4. **Unbreakable bricks are routing tools, not walls.** Gold or regenerating bricks never count toward the clear, and they shape the angles you have to find.
5. **Boss and set-piece beats** break up the campaign (DOH, and the brain in *Revenge*).
6. **Juice sells every hit** (Juice it or lose it, Art of Screenshake): different sounds per surface, combo pitch climbing, particles and shards, shake scaled to the event, about 20 ms of hit-stop on breaks, and a ball trail.
7. **Power-ups need good and bad, plus a cost** (DX-Ball 2, Recharged). Strong clears like Fireball/Thru-brick are fun but should be limited. Arkanoid power-ups are easy to lose, so the fun sits in the moments you catch one.
8. **The genre's biggest fun killer is the last few bricks** (Shatter, George, Cinquemani): long stretches watching the ball miss one brick in a corner. More power-ups only soften it. The fix is giving the player a bit of influence.
9. **Speed is the pacing knob.** *Revenge* speeds the ball up harder, which turns Slow into a tool rather than a handicap.

## What we applied (this PR)

| # | Lesson | Applied how |
|---|--------|-------------|
| 1 | Plain round 1 | Round 1 "Fresh Tiles" is a plain 3-row, 1-hit classic wall (21 HP). Round 2 is three full bands. |
| 2 | One new idea at a time | Shape (3 pyramid, 4 diamond), then 2-hit (5), steel (6), arrows/targets with 2-hit (7-8), metal (9), silver (10), the first drip (11), 3-hit (13+), 4-hit (17+), gold and tar (19). Tests pin that order. |
| 3 | Pictures, mirror symmetry | 28 of 30 rounds are mirror-symmetric pictures: pyramid, diamond, wave, fortress, chevrons, bullseye, invader, arrow, twin waves, castle, X-cross, swirl, butterfly, heart, hexagon, hourglass, starburst, crown, skull, spiral, and more. Pinwheel and spiral are rotational. A test requires at least 26 mirror-symmetric rounds. |
| 4 | Light punk nods | Round 15 "Checkmate" checkerboard, and round 30 "Anarchy Throne": a gold Ⓐ inside a silver ring, with drips. Everything else is classic shapes. |
| 5 | Several dials ramp together | Total HP never dips across 30 rounds (21 → 280), the share of multi-hit bricks climbs (test: under 60% in rounds 1-10, over 90% in 21-30), steel and drips grow, and ball speed follows the existing curve (5.56 → 8.4). |
| 6 | Steel routes, never blocks | Every round passes the clearability flood test. Steel never seals off a breakable brick. |
| 7 | Set pieces | Boss beats stay on rounds 6, 12, 18, 24 and 30. The anarchy sign is the finale. |
| 8 | Fix the last-bricks slog | New **last-bricks assist**: with 3 or fewer breakable bricks left and about 6 s with no brick touched, a rising ball bends at most about 2° per frame toward the nearest remaining brick. Its speed stays the same and it never goes nearly flat. A one-time "SNIFFING OUT THE LAST ONES" cue shows. It's off on the boss. Unit tests cover it and the live wiring. |
| 9 | Juice | Already in the game and kept: per-material sounds, combo pitch ladder, shards, impact rings, scaled shake, hit-stop on breaks, ball trail, reduced-motion respected. No changes needed. |
| 10 | Power-up balance | All 21 power-ups unchanged (good/bad mix, timers reset per round like Arkanoid). Not retuned in this PR. |

Not applied (ideas for later): a player-triggered limited pull or push like Shatter, and branching routes like *Revenge of Doh*.
