# Arcade sizing, clarity and pacing

Goal started2026-10-26 from source786f624. Preserve both accepted sites, game
rules/scoring/modes/state and the approved audio release. Qualification pending;
workspace ARCADE-VISUAL-FEEL-HANDOFF.md records exact commits and final evidence.

## Decisions grounded in the current games

- Turdomania: a wide viewport uses a board beside the existing HUD/controls/help.
  Display cells can reach72px; logical initial dimensions/generator and active
  board state are unchanged. Phone layouts keep their existing fitting behavior.
  Hover/keyboard group selection shows its real tile count/score in the existing
  desktop tagline, without moving controls or adding a mobile toolbar row.
- Turdtris: native held Space reproduced repeated hard drops; held P/M also
  toggled repeatedly. Discrete actions now ignore OS-repeat, while held lateral
  movement retains existing DAS/ARR and soft drop. Physics, lock delay, handling
  preferences and scoring are unchanged. Three regressions failed before the
  fix; unit and native real-repeat checks pass afterward.
- Crapjack: at1440×1000 the initial table pushed primary actions below the
  window. Desktop reserves its measured footer, keeps main decisions in a stable
  rail and uses a smaller bet marker. Hands can scroll in constrained space;
  cards and controls are retained rather than clipped. Existing compact/tablet
  and phone layouts remain scoped separately.
- Crappy Eights: tall desktop/tablet body padding exceeded the shell's vertical
  budget by12px. Matching that budget removes document overflow. Hand resizing
  is coalesced on an animation frame to prevent synchronous WebKit observer loops.
- Rummy: short desktops reserve the full player fan above the action dock, with
  opponent and central piles alongside one another. Logical hands and scoring
  are unchanged through portrait/landscape and phone-to-desktop transitions.
- Turdanoid: a steadier high-contrast ball edge survives reduced motion;
  capsule labels gain a dark backing, larger type and a textual warning marker
  for negative effects. Artwork/physics/collision radii and power-up rules stay
  unchanged. No new particle system or asset dependency.
- Chess: a fine light silhouette edge separates Black pieces from dark squares
  without modifying licensed Spatial SVGs. The existing160ms move animation is
  shared with reply pacing. Warm actual Friendly replies took13.4ms in Chromium
  and16ms in WebKit in the before sample, shorter than the player's animation;
  a reply can now wait only for that animation's remainder. Search time counts
  toward the bound, and reduced motion/hints add no delay. Cancellation/generation
  guards still run before committing a reply. This changes readability, not AI.
  Ordinary short desktop windows also measure the available board height after
  header/player strips. Chessground's existing resize observer updates its own
  geometry; rebuilding the renderer would disrupt focus and active gestures.

## Primary-source comparisons

Accessed2026-10-26. These are specific observed affordances, not evidence our
games match competitor quality or that players enjoy these changes.

- [TETR.IO](https://tetr.io/) exposes DAS/ARR and an accidental hard-drop safeguard.
  Existing Turdtris handling settings remain; fix the reproduced repeat issue
  instead of changing everyone's movement speeds.
- [CardGames.io Crazy Eights](https://cardgames.io/crazyeights/) exposes game-speed
  options and clear play/draw controls. Our existing bot pacing/Quick options are
  retained: no evidence yet supports a blanket speedup or a new settings system.
- [Stockfish's official FAQ](https://official-stockfish.github.io/docs/stockfish-wiki/Stockfish-FAQ.html)
  explains skill weakening, search depth limitations and rating caveats. Friendly
  already uses minimum Skill Level0/depth2. Keep this bounded setting and stronger
  options; do not claim a beginner Elo, guarantee misses or insert a custom
  random-blunder algorithm. Human calibration remains on Jeff's checklist.
- [Lichess basics](https://lichess.org/learn) separates optional instruction and
  practice from playing. Existing visual piece guide/legal-move help is retained;
  no forced tutorial or new account flow is needed.
- [Same Game's author manual](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/doc/samegame.html)
  documents contiguous groups, grid parameters and(n−2)² scoring. Indexed manual
  content was available; direct fetch timed out. Use group/score clarity while
  preserving this suite's generator/rules and single-tap control contract.

No vendor code/artwork/license or binary changes are needed for these refinements.
No scoring or AI-strength changes: existing records remain comparable.

## Human playtest checklist

Jeff is collecting real-person feedback separately. For each session record the
game, phone/tablet/computer, browser and difficulty; avoid collecting identities.

1. Can the player start and explain the next action without coaching?
2. Are pieces/cards/power-ups and selected/active states easy to recognize?
3. Do movement and taps respond as expected? Note accidental actions or misses.
4. Is the beginner opponent approachable? Which exact turn/level feels unfair,
   too easy or slow? Include the position or screenshot when possible.
5. Are results, replay and Continue clear? Would they choose another round, and why?

Browser tests are emulation, not physical acceptance or proof of enjoyment.

## Mobile follow-up from Jeff's playtest

- Jeff confirmed Rad Dad Turdomania became audible when he disabled iPhone
  Silent Mode, then requested keeping that normal device behavior. Preserve the
  ambient effects session; no playback-session override or silent media loop.
  [WebKit's explanation](https://bugs.webkit.org/show_bug.cgi?id=237322) describes
  the default distinction between WebAudio effects and media playback.
- Separate native regressions reproduce effects recovery failures after an
  interrupted or closed context. Studio effects now attempt to resume either
  suspended or interrupted contexts, and recreate a closed one only when a
  fresh allowed cue requests sound. Mute, zero volume, gesture/pause/visibility
  gates and dropped-cue/no-replay behavior remain. Classic Stalemate routing,
  playlist and the approved synth/levels are unchanged. The interrupted-state
  fixture models the condition documented in [WebKit's interruption report](https://bugs.webkit.org/show_bug.cgi?id=276016);
  it does not establish physical iPhone recovery on every OS version.
- The Catch relaunch pill covered the paddle/caught ball on portrait, landscape
  and narrow phones. Position it above that lane with a one-line label and the
  existing 56px touch target; keep the first-play hint and active power badges clear of the pill. Native
  geometry/release regressions failed before the fix. Physics and Catch rules
  remain unchanged; before/after canonical-site captures are retained.
