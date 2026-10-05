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

- [ ] Replace dashboard with a distinctive sewer card-room table: three spatial seats, visible fans, central piles, compact score strip, contextual turn banner.
- [ ] Make the table and controls fit 320px / 390px without horizontal page scroll; enlarge cards and touch controls; preserve zoom.
- [ ] Add an illustrated quick guide, a four-way suit wheel with remaining suit counts, and contextual hand guidance.
- [ ] Add card travel from the acting seat to the pile, targeted action feedback, and a bounded round-win celebration; disable motion on reduced-motion preference.
- [ ] Add layered synthesized deal / card / action / result audio, gated by user input, local sound, master mute, and visibility.
- [ ] Add fair AI using suit continuity, public pass inference, visible opponent counts, direction-aware denial, and wild risk management.
- [ ] Preserve keyboard focus, add card names / selection state, dialog semantics / focus traps, live status, and keyboard hand navigation.
- [ ] Add meaningful unit tests for AI, presentation gating, legacy engine fixes, and unchanged old saves.
- [ ] Update this game's RULES section with controls and AI behavior without changing scoring.
- [ ] Run full Vitest, lint, and Chromium smoke on port 8154; verify layouts / console / save restore / reduced motion.
- [ ] Commit implementation and final evidence locally on the current lane branch.

## Needs shared change

None identified yet. Lane-specific helpers remain opt-in and do not change shared files.

## Validation

Pending implementation. Physical phone audio / tactile testing is unavailable in this environment.
