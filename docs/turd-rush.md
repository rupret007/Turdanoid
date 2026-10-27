# Turd Rush — original browser runner

Three lanes, jump, slide, authored seeded obstacle patterns and a bounded speed
ramp. Original cartoon punk sewer/backstage setting and procedural character,
props, textures and effects. Inspired by the endless-runner genre; no commercial
game source, characters, art or music are included.

## Structure

- turdrush.html + assets/turdrush.css: accessible real controls, HUD, help, pause,
  results, shared music/effects and useful renderer failure/retry.
- games/turdrush-core.js: deterministic metre/second simulation at120Hz, separate
  from rendering/input/storage.30/60/120Hz equivalence, seeded action-aware route
  reachability and collision/resource invariants have focused tests.
- games/turdrush-renderer.js: Three.js original procedural scenery/mascot,
  instanced recurring geometry, pooled obstacles and bounded36-particle pickupFX.
- games/turdrush.js: native pointer swipes/buttons/keyboard, lifecycle gates,
  explicit pause/resume after interruption and one completed result per run.
- assets/vendor/three: official Three.js0.186.1 MIT build+license, self-hosted;
  npmSHA512 checked before extraction; exact provenance in README.txt.

## Intended gameplay

Arrows/WASD or swipes move one lane, jump and slide. Optional44px on-screen
controls and deliberate pause/resume remain available. OS key repeats do not
queue actions. First6seconds teach controls without hazards. Speakers require
sidestepping; crates can be jumped; low pipes require grounded slide or dodge.
After250m occasional full-width crate/pipe rows require jump/slide, with recovery
spacing proved at the capped24m/s speed. Ordinary rows have a reachable safe lane
and optional risk/reward pick trails. Pickups are visual; audio is optional.

A shield lasts8active seconds or absorbs one impact, then gives brief overlap
grace. A magnet attracts nearby picks for8active seconds. Paused time does not
advance physics, timers or score. Score is floor(metres×10)+50×picks. Terminal
results cannot settle twice. Runs are endless; there is no fabricated finish line.

Best scores, distance/pick goals and earned history are device-local through the
existing progress ledger, with exactly-once run receipts and sharing fallbacks.
Valid old8-game ledgers/saves remain compatible. Runs stay on the current page;
refresh starts a fresh run (no unsupported Continue claim). Denied/full storage
keeps play usable and discloses when results cannot persist.

## Integration/release contract

Build in this canonical source. Both band importers regenerate play/, add their
existing branding/audio and content-version leaf modules plus importing parents,
including both Three.js build files. Rad Dad uses the approved proceduralStudio
palette; Stalemate uses the existing five-song player. Respect Silent Mode and
browser gesture requirements. No server/accounts/multiplayer/hosting change.

New ninth-game inventories, hub links/cover, device progress, result sharing,
mobile/smoke and both site public checks must include Turd Rush. Existing8games,
accepted site content/structure/branding/record keys and intended rules remain.

The user authorized publication only after the game is good. Required source/site
checks, inspected real renders, actual native gameplay and changed public bytes
must qualify before source-first/site-main release. Persistent external release
status/evidence: parent TURD-RUSH-HANDOFF.md and release-evidence/turd-rush/.

## Verification limits

Emulated phone geometry and desktop browser/GPU measurements do not prove physical
iPhone/Android heat, battery, touch or frame rate. Local headless Chromium uses
SwiftShader software rendering; WebKit uses AppleGPU. Keep those performance
contexts separate. Reduced motion removes nonessential bob/shake/FX; forward
movement remains inherent to this runner. No retention/enjoyment or bug-free claim.
