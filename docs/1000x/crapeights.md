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

- The full lint command exits successfully with four existing `no-unused-vars` warnings outside this lane: `games/turdjack-engine.js` imports `RANKS`, `SUITS`, and `hiLoValue`; `tests/turdjack.test.js` imports `MIN_BET`. The shared/conductor or Crapjack lane should remove those unused imports for a completely warning-free suite. Crappy Eights files lint without warnings.
- No shared runtime, storage, or smoke assertion changes are required. The only shared-file edits are the authorized Crapeights rules section and `crapeightsAiMs` line (760 ms).

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
