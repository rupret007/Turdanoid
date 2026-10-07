# Crappy Eights — round 1

## Deeper audit

Read the conductor's round-0 audit and play-read the four-player page, two-player legacy engine, continue fixtures, rules, and smoke contracts. The live page is the authoritative four-player rules implementation; the exported engine implements a separate older two-player game. Scores (200-point target and leftover-card values) and all existing storage shapes must remain unchanged.

- **Gameplay:** Action rules are clear and automatic penalties prevent stacking ambiguity. Human selections rebuild the entire hand, losing keyboard focus. The wild wrapper currently celebrates even when a suit has not been confirmed. The legacy engine fails to finish/switch after a CPU plays its draw and can push undefined when exhausted.
- **Feel / animation:** Hand deals and pile flips exist but bots teleport cards. Multiple pulsing widgets compete for attention; oversized fixed callouts obscure play. Turn changes lack a coherent spatial path.
- **Graphics:** Attractive card details sit inside a dashboard: seven HUD boxes, three equal opponent tiles, two large empty pile columns, and a permanent rules sidebar. There is no convincing seating arrangement. Emoji avatars are small and visually inconsistent.
- **Audio:** Brief oscillator tones share little character. Local audio can create a context before input and does not directly honor the suite master mute. Shared celebrations can duplicate local win cues.
- **HUD / onboarding:** Instructions repeat across a large guide and sidebar. No persistent concise explanation of the current legal choice, hand risk, or opponent target. Standings are plain text.
- **Mobile / touch:** Existing rail scrolls but small cards and tall chrome bury play. No touch shortcut beyond select then button. Browser zoom is disabled. Essential targets need 44px sizing and a compact phone table.
- **Accessibility:** Cards lack descriptive accessible names / selected state; dialogs lack semantics, focus trapping and restoration. Global Enter hijacks focused buttons. Status changes lack a live region. Reduced-motion styles exist but the late personality effects are incompletely covered.
- **Performance:** No game loop is necessary. Rendering is event-driven, but repeated hand creation and forced-layout flashes are wasteful. Cosmetic card flights should use transforms, read geometry once, and cap nodes.
- **AI:** Current heuristics overvalue action cards without considering who receives the next turn. Bots do not infer weak suits from public passes. Wild preservation ignores the 50-point liability when someone is about to finish. Fair decisions must use own hand and public information only.
- **Compatibility:** Existing `kind: crapeights, v: 1` snapshots and keys must remain byte-shape compatible. New AI observations will be ephemeral and reset on restore; no migration of existing saves is necessary.

## Prioritized targets

- [x] Replace dashboard with a distinctive sewer card-room table: three spatial seats, visible fans, central piles, compact score strip, contextual turn banner.
- [x] Make the table and controls fit 320px / 390px without horizontal page scroll; enlarge cards and touch controls; preserve zoom.
- [x] Add an illustrated quick guide, a four-way suit wheel with remaining suit counts, and contextual hand guidance.
- [x] Add card travel from the acting seat to the pile, targeted action feedback, and a bounded round-win celebration; disable motion on reduced-motion preference.
- [x] Add layered synthesized deal / card / action / result audio, gated by user input, local sound, master mute, and visibility.
- [x] Add fair AI using suit continuity, public pass inference, visible opponent counts, direction-aware denial, and wild risk management.
- [x] Preserve keyboard focus, add card names / selection state, dialog semantics / focus traps, live status, and keyboard hand navigation.
- [x] Add meaningful unit tests for AI, presentation gating, legacy engine fixes, and unchanged old saves.
- [x] Update this game's RULES section with controls and AI behavior without changing scoring.
- [x] Run full Vitest, lint, and Chromium smoke on port 8154; verify layouts / console / save restore / reduced motion. All checks pass; full-suite lint retains four pre-existing warnings outside this lane.
- [x] Commit implementation and final evidence locally on the current lane branch.

## Needs shared change

Historical note from round 1: unused-import lint warnings in Crapjack files were later cleaned up; `npm run lint` on the integration head is clean. No shared runtime, storage, or smoke assertion changes were required from this round.

## Validation

- **PASS — unit/integration tests:** `npx vitest run --maxWorkers=1 --testTimeout=30000`: 22 files / 312 tests. Initial parallel targeted run timed out in six JSDOM startup cases (including unchanged Spades and Rummy) under host load ~40; the complete serial run passes without skipped tests or changed assertions.
- **PASS — lint exit / lane cleanliness:** `npm run lint`: zero errors; four pre-existing warnings in Crapjack-owned files listed above. Removed the two unused imports in this lane's existing test.
- **PASS — manual Chromium layout:** desktop 1280×1000, 390×844, and 320×844: zero console errors, document width equals viewport. At 390px and 320px, main play controls end at approximately y=767 and y=764 respectively. Oversized hands scroll inside their rail.
- **PASS — accessibility / motion browser checks:** 320px wild wheel fits; shell is inert during modal; pending wild persists; Escape returns without losing a card. Dynamic reduced-motion preference yields zero running animations and `flyCard` returns false.
- **PASS — final focus regression:** all 11 actual-page tests pass after recommended-suit initial focus correction.
- **PASS — save compatibility:** the unmodified old v1 fixture loads and round-trips all card IDs, scores, state and snapshot keys through actual page code. AI observations are deliberately ephemeral. No storage keys, value formats, scoring rules or match targets changed.
- **PASS — full Chromium smoke:** `PLAYWRIGHT_CHANNEL=chromium node smoke-runner.js 8154` reports **Browser smoke checks passed**. The first run exposed the new dialog covering the Hub escape and normal-motion hooks expected by existing checks. Fixed within the page: dialogs sit below the Hub pill and include accessible Hub links; the hooks use subtle motion with full reduced-motion suppression. No smoke assertions were edited.
- **NOT RUN — physical phone / audible listening / tactile evaluation:** no real phone hardware or listening setup available. Audio event sequencing, mute/gesture gates, bounded nodes and live reduced-motion cancellation are covered by tests.

## Implementation notes

The Dirty Deck now uses a seated table layout, inline SVG sewer regulars, capped fanned card backs, card flights, targeted action notices, four-way wild wheel, illustrated onboarding, hand sorting, repeat-tap play, contextual legal-move guidance, score meters and hand liability. Keyboard and modal handling preserve native activation and focus. Synthesized cues respect local and suite mute; all FX are optional cosmetics. The legacy two-player engine fixes only broken draw/win behavior.

The new local modules are classic scripts with testable deterministic helpers. The page retains graceful basic play if optional enhancement scripts are unavailable, which also preserves the existing standalone inline-script focus harness. No dependencies, network assets, browser-smoke edits, tags, pushes or PR actions.

## Local commits

- `a1c32a4` — initial audit and concrete targets.
- `68b36ce` — fair public-memory AI and legacy draw fixes.
- `57c0906` — table, art, guidance, controls, audio, FX and regression coverage.
- `2395980` — Hub escape, native modal focus and motion contracts.
- Final documentation commit records completed checklist and passing validation.

# Round 2 — the living Dirty Deck

## Deeper follow-up audit

Re-read the round-0 conductor audit and current live page, AI, presentation helpers, save tests and smoke contracts. Round 1 substantially improved identity and fairness, but its scrolling hand rail still hides cards on phones; simply enlarging cards worsens that problem. Desktop table height is fixed while standings consume space below it. Seats have portraits and a subtle turn pulse but no character reactions or idle expression. Action feedback is still mostly a text banner and a single flight. Results explain the total but do not reveal the cards behind it. Existing audio is already layered, gesture/mute gated and bounded; preserve it and prioritize visual timing. Existing keyboard/modal work and old-save tests are good foundations. Layout changes need explicit bounds and hit-target checks, and full-round browser play is needed to catch stalled decisions. CSS-only idle motion and capped event effects should retain the event-driven performance model.

## Round 2 targets

- [x] Fitted arced hand, larger readable cards, selected lift, clear legality, every card reachable with 44px targets; large hands use additional fan rows instead of horizontal clipping.
- [x] Desktop table fills available viewport; rules/log/standings/settings live in an accessible drawer.
- [x] Three blinking/bobbing characters, speech/reactions, active-seat ring and thinking card tease.
- [x] Targeted two-card penalty flight/counter, Skip stamp, Reverse swirl, wild bloom/pile wash, ONE LEFT alert; reduced-motion equivalents.
- [x] Leftover-card scoring receipt, points collection, match trophy/confetti and separate display-only round-2 stats.
- [x] Easy / Normal / Sharp selector persisted in a new key; Normal remains existing fair AI; difficulty decision tests.
- [x] Unit tests for fan geometry, effects/motion/stats, difficulty and actual page integration; unchanged old v1 save fixture still loads.
- [x] Full-round Playwright autoplay at 390 and 1280, screenshots/error/stuck-turn evidence, extra 320px layout coverage.
- [x] Run all required checks and commit locally: full Vitest 347 tests PASS, Chromium smoke on 8154 PASS, lint exit PASS with four pre-existing other-lane warnings; Crappy Eights files are clean.

## Round 2 scope interpretation / Needs shared change

The explicit workflow authorizes this lane document and round-2 focus authorizes `scripts/crapeights-autoplay.mjs`, in addition to the listed game files. The hard rule forbids writing outside this worktree, so autoplay evidence is saved inside `docs/1000x/crapeights-autoplay/`. The conductor must copy these artifacts to its requested external `reviews/turdanoid-1000x/r2/crapeights-autoplay/` directory. The round-0 external audit was read only as expressly requested. No shared runtime change is planned.

## Round 2 validation

- **PASS — full unit suite:** `npx vitest run --maxWorkers=1 --testTimeout=30000`, 24 files / 347 tests. Serial execution and longer per-test timeout accommodate simultaneous work on this host; no skipped tests. Includes unchanged b3821b4 v1 fixture, old completed receipts without duplicated stats, drawer focus/pause behavior and Smart-after-draw regression.
- **PASS — lint exit / lane clean:** `npm run lint`, zero errors and zero Crappy Eights warnings. The same four pre-existing Crapjack warnings listed above remain outside this lane's ownership.
- **PASS — full-round autoplay:** `PLAYWRIGHT_CHANNEL=chromium node scripts/crapeights-autoplay.mjs --rounds 2`, two complete rounds at 390×844 and two at 1280×900. 28 Smart actions, 8 Draw actions, 5 Pass actions; zero console/page errors, 10-second stalls, horizontal overflow, clipped hand cards or under-44px hand boxes. Report and screenshots are in `docs/1000x/crapeights-autoplay/`. Initial harness 1.5s click timeout caused false failures under host load; the committed harness allows 5s and recognizes actions that already changed the state.
- **PASS — full Chromium smoke:** `PLAYWRIGHT_CHANNEL=chromium node smoke-runner.js 8154` reports **Browser smoke checks passed**. No smoke assertions were changed.
- **PASS — default AI compatibility:** Normal decisions and suit choices matched the previous committed AI over 1,000 seeded public states. Difficulty tests additionally cover legal deterministic play, Easy simplicity, Sharp wild preservation, emergency point shedding and future Draw-Two routes.
- **NOT RUN — physical phone / listening / measured phone frame rate:** browser checks cover geometry, actual touch input, mute gating and motion cancellation; hardware evaluation remains for the conductor.

### Round 2 implementation details

The fitted hand uses bounded deterministic geometry with at least 48px horizontal spacing and 84px cards on phones (up to 100px desktop). Extra rows retain readable faces and visible tap lanes; selected/focused cards lift 28px. The table owns desktop space, while an inert-background dialog pauses play for rules, standings, log and difficulty. New storage keys are `crapeights_difficulty_v1` and `crapeights_stats_v1`; no fields were added to existing snapshots. Personal upgrade stats are display-only.

Blink/bob animation, thinking card tease, reaction speech and action stamps use bounded local effects. Draw Two flies two cards into its actual recipient; Skip stamps the skipped seat; Reverse orbits arrows; wilds bloom the suit wheel and wash the pile. The receipt reconstructs all leftover cards from the existing hands, preserving exact scoring; loading a finished old save does not count another round. All new dynamic effects gate/cancel motion and preserve text equivalents. Existing layered synthesized audio and mute/gesture safeguards remain intact.

### Round 2 final layout checks

- Desktop controls are visible at 1280×800, 1280×900 and 1280×1000; center-seat fans, piles and suit indicators have separate space. A compact header, sideways center-seat fan and shallower hand support short desktops without shrinking tap targets. Final desktop captures fit exactly within both 800px and 900px viewport heights.
- At 320×740 and 390×844, there is no horizontal overflow. Every card in a 20-card hand stays within the viewport and the last row is vertically reachable. The 320px phone requires vertical scrolling for the dock; the 390px opening dock is visible. Redundant phone suit chips are hidden to reveal the pile counts; the active suit remains in the HUD and turn guidance.
- Drawer focus/inert behavior and wild-wheel selection pass at all three widths. Dynamic reduced motion reaches zero running animations and removes transient effects, including at 320px. Speech/text remains.
- Screenshots are local artifacts. Earlier `spot-*` shots document issues discovered; `spot-final-*` shots show the short-desktop fixes. Fresh final phone captures include the suit-row cleanup.

### Remaining shared work

The fixed shared Hub pill can cover a small part of the lower-left hand/control area on short phone screens. Its existing accessible Hub route and smoke contract are retained; the shared lane should provide an in-flow or safe-area-aware placement across card games. Copy the local autoplay artifacts to the conductor's requested external review directory. The four pre-existing Crapjack lint warnings also remain the owning lane's responsibility.

### Round 2 local commits

- `74733f8` — follow-up audit and measurable targets.
- `6d8ab04` / `ef5baa2` — foreground real-input autoplay and timeout handling.
- `db380ac` — fair difficulty levels and decision coverage.
- `081ec02` — bounded reactions, receipt and display-only stats helpers.
- `86f9e9b` — fitted fans, living table, drawer integration and save/input regressions.
- `a6a0273` — short desktop composition and phone pile-label cleanup.
- Final evidence commit contains this completed report, full-round timelines and inspected screenshots. No push, PR, release, tag, shared engine or existing save-format changes.


### Final review artifacts

PNG dumps from this autoplay run were trimmed from the repo (JSON kept). Curated before/after shots live in `docs/1000x/screenshots/` (`after-crapeights-320-play.jpg`, `after-crapeights-390-play.jpg`, `after-crapeights-desktop-play.jpg`).

- [full autoplay report](crapeights-autoplay/report.json)

# Round 3 — quality, playtest and finish

## Honest finishing audit

Re-read the round-0 audit, current live page, local presentation/AI/save modules, existing autoplay, fixtures and smoke contracts. Gameplay, the seated table, opponents, receipts, difficulty levels and old-save coverage are in place. The remaining risk is interaction quality across complete real rounds, especially the short 320px phone: the previous harness only ran 390px and a taller desktop, used Smart almost exclusively, and took few screenshots. Continue was tested separately rather than during endurance play. Keyboard controls exist but a complete keyboard-only round needs proof. Card selection, passing and utility actions lack distinct immediate audio feedback. The current 320ms flights are within target but can be tighter; live switching to reduced motion also needs to finish the receipt counter immediately. The results announcement currently lives behind the modal's inert background. Desktop composition and small-phone card/overlay spacing require fresh screenshot inspection. No scoring, AI fairness, existing stats format or snapshot changes are warranted.

## Round 3 targets

- [x] Extend foreground real-UI autoplay to 390×844, 320×640, 1280×800, reduced motion and a keyboard-only complete round; mix legal-card taps, Smart and Draw/Pass.
- [x] Detect console errors, 10-second stalled turns, overlays that fail to dismiss, horizontal scroll, inaccessible cards; capture screenshots every few turns.
- [x] Exercise Hub/Continue mid-round and verify exact restored table plus an accepted action.
- [x] Inspect fresh screenshots and fix cramped, clipped, misaligned or low-contrast presentation.
- [x] Confirm exact b3821b4 fixture fidelity through the live page, continued action and unchanged legacy/new stats key formats.
- [x] Tighten flights and input feedback, retain readable bot pacing, and make reduced-motion effects instant.
- [x] Verify full-round keyboard play, visible focus, bot announcements and non-inert round-result announcements.
- [x] Run required full Vitest, lint and Chromium smoke at 8154; record final evidence and commit locally after each logical chunk.

## Round 3 scope / Needs shared change

This explicitly requested lane document and autoplay script are authorized exceptions to the initial owned-file list. The absolute hard rule to work only in this checkout takes precedence over the requested external artifact directory: round-3 evidence goes in `docs/1000x/crapeights-autoplay-r3/`. The conductor must copy it to `/Users/jeffstory/Documents/bob-overnight-inject/conductor/reviews/turdanoid-1000x/r3/crapeights-autoplay/`. The required external audit was read only. Existing shared Hub-pill overlap and out-of-lane lint warnings will be rechecked, not changed in this lane.

### Autoplay findings and fixes

- The stronger dialog check found decorative `::after` glow extending 32px outside every modal's scrolling box. Contained the glow; entrances now last 240ms.
- Actual rapid touch input exposed the shared `preventDoubleTapZoom` document handler: every second touch within 350ms cancels native activation on cards, buttons, summaries and links. This broke card → Play, Table Menu → Hub and drawer open → close. Protected this game's interactive surfaces locally, using native `touch-action: manipulation` and retaining non-control event propagation. Added regression coverage; no artificial input delays conceal the defect.
- Improved harness assertions to reject ignored card selections/actions and identify the exact failing Continue navigation stage.
- Screenshot review found 390px opponent fans crossing pile headings, redundant action banners crowding stamps, and an end-round stamp covering the scoring receipt. Reduced phone fans, removed duplicate enhanced-table notices, and clear table effects before the result dialog; retained the receipt's own effects. Compact phone selection text also removes an unnecessary line from the table height.
- Fixed keyboard focus falling to the body when its card is played, added a live result summary inside the dialog, and verified two full desktop keyboard rounds with Continue during the discovery run.
- Reduced-motion changes now immediately settle the receipt total and cancel outstanding tally timers. Card flights are 260ms, while the existing readable 760ms bot pacing is retained. Added gated selection, pass and utility sounds.

### Additional Needs shared change

Shared round 4 later removed the document-level `touchend` `preventDefault` (CSS `touch-action: manipulation` only) and moved the Hub pill to a top-left 44px icon on phones. Those asks are closed on the integration branch.

### Round 3 final autoplay evidence

- **PASS — real UI, four scenarios:** `PLAYWRIGHT_CHANNEL=chromium node scripts/crapeights-autoplay.mjs --port 8154`. Two complete rounds each at 390×844 touch, 320×640 touch, 1280×800 keyboard-only, and 390×844 with `page.emulateMedia({ reducedMotion: 'reduce' })`. Eight rounds total; zero console/page errors, stuck turns, horizontal overflow, out-of-bounds or under-44px hand boxes. Every run tested guide/details/result dismissal, exact mid-round Hub → Continue restoration, and an accepted resumed action. Eights has no bidding phase.
- **PASS — full match:** `PLAYWRIGHT_CHANNEL=chromium node scripts/crapeights-autoplay.mjs --port 8154 --scenario phone --rounds 2 --matches 1 --output docs/1000x/crapeights-autoplay-r3/match`. Eight more rounds, final scores 142 / 125 / 167 / 201, all eight receipt totals checked against actual leftover cards, trophy captured, New Match dismissed into a fresh live deal. Zero errors or layout issues.
- **PASS — keyboard and reduced motion:** the desktop rounds used 104 Tabs, 23 Enter activations, nine arrow moves and five selected-card play shortcuts, with 28 visible-focus checks. Live bot/result status changes were recorded. Both reduced-motion rounds had zero running animations; unit coverage additionally verifies immediate tally settlement when the preference changes during a receipt.
- **PASS — screenshot inspection:** reviewed opening tables, guide, in-play action states, 320px hand rows, keyboard focus, wild picker, scoring receipts and full-match trophy. Phone fans now clear pile headings; result receipts have no lingering table stamps; desktop remains table-first at 1280×800. The 320×640 hand and controls are vertically reachable, with no horizontal scrolling. Transient action stamps and speech can briefly overlap seat artwork/text, without blocking input; the fixed shared Hub pill remains the known placement issue noted above.
- **PASS — save/stat contract:** exact unmodified `validEightsSnapshot()` from the b3821b4 fixture is compared against every live/restored field, then played and reloaded. Draw/skip penalties, pending wild, selection, history and finished overlays are covered. Both `crapeightsStats` and `crapeights_stats_v1` retain their existing field formats; continued wins increment once and restored finished rounds write neither stats key. No scoring, existing storage key or snapshot format changed.

Representative artifacts: round-3 PNGs were trimmed from the repo. JSON remains: [four-scenario report](crapeights-autoplay-r3/report.json), [full-match report](crapeights-autoplay-r3/match/report.json). Curated shots: `docs/1000x/screenshots/after-crapeights-*-play.jpg`.

- **NOT RUN — physical phone, listening, screen-reader hardware and measured phone frame rate:** browser checks verify native touch/keyboard behavior, visible focus, announcement semantics, overflow and motion/audio gates. Hardware review remains separate.

# Round 4 — conductor screenshot polish

## Focus

Conductor r4-stage screenshots flagged two remaining presentation issues: at **320px**, bot reaction speech and **+2 CARDS** stamps overlapped opponent names, card counts, and avatars; at **1280×800**, the hand could read larger and the arena should consume more vertical space without shrinking tap targets.

## Round 4 targets

- [x] Move phone reaction speech below opponent tiles so names, meta counts, and mini fans stay uncovered.
- [x] Anchor penalty stamps in the seat label band below avatars (exported `stampAnchor` + unit test).
- [x] Short-desktop (≤900px height): taller flex arena, tighter chrome, **108px** full fan cards (compact fan only at ≤760px height, **92px** cards).
- [x] Re-run foreground autoplay at 390 / 320 / 1280 (+ reduced-motion control); zero errors or stalls.
- [x] Full Vitest, lint (lane-clean), and Chromium smoke on **8154**.

## Round 4 validation

- **PASS — unit suite:** `npx vitest run --maxWorkers=1 --testTimeout=30000`, 24 files / **361** tests (adds `stampAnchor` regression).
- **PASS — lint:** `npm run lint`, zero errors; four pre-existing Crapjack warnings outside this lane (not in `tests/crapeights.test.js`, which is clean).
- **PASS — autoplay:** `PLAYWRIGHT_CHANNEL=chromium node scripts/crapeights-autoplay.mjs --port 8154 --scenario all --output docs/1000x/crapeights-autoplay-r4` — phone **390**, small **320**, keyboard **1280×800**, and reduced-motion: **0** console/page errors, **0** layout failures, Continue exercised each run. Artifacts: [report](crapeights-autoplay-r4/report.json).
- **PASS — smoke:** `PLAYWRIGHT_CHANNEL=chromium node smoke-runner.js 8154` → **Browser smoke checks passed**.

## Needs shared change

Shared round 4 landed the double-tap fix (`touch-action: manipulation`, no `touchend` `preventDefault`) and moved the Hub pill to a top-left 44px icon on phones. No remaining shared-lane ask from this Eights round.

## Round 4 local commits

- `e979889` — speech/stamp layout, short-desktop arena and hand sizing.
- Final docs/evidence commit records round-four checklist and validation.


### Round 3 final verification

- **PASS — full unit suite:** `npx vitest run --maxWorkers=1 --testTimeout=30000`, 24 files / 360 tests, no skipped tests. The earlier default full run passed 357 tests; the final default-parallel run encountered four 5-second JSDOM timeouts across Eights, Spades, Crapjack and Rummy under host load above 20. The complete serial run passes unchanged assertions, including all three new rapid-touch cases.
- **PASS — lint exit / lane clean:** `npm run lint`, zero errors. Four pre-existing `no-unused-vars` warnings remain in `games/turdjack-engine.js` (`RANKS`, `SUITS`, `hiLoValue`) and `tests/turdjack.test.js` (`MIN_BET`); these are outside this lane's edit permission and are listed under Needs shared change. The whole suite is not warning-free.
- No new dependencies, runtime network assets, smoke assertion edits, shared storage/rules changes, pushes, PRs, tags or releases. Replaced the broken external dependency symlink with a local lockfile install so validation did not write into another worktree.
