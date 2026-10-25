# Shared arcade polish

This pass starts from the accepted Chessground/Spatial source at `10a0e6e201946247ddf4a7ca06f3786a93e69805`. It preserves game rules, scoring, modes, saved-session keys, records, artwork, editorial content and site-specific audio. Stalemate and Rad Dad import the same committed gameplay source through their separate adapters. Do not edit only generated receiver files.

## Player-facing corrections

- Native Space/Enter activation stays with a focused control. Turdanoid's Boss/HowTo controls no longer start Classic through the global shortcut. Legacy Neon's Mute/phone controls and Turdtris result actions receive their intended keyboard action.
- Legacy Neon can initialize and toggle sound when storage reads are denied or writes exceed quota. Preferences remain session-local when persistence is unavailable; the game does not claim otherwise.
- Existing card-table guides/results keep keyboard focus inside the visible sheet, support Escape and restore a usable invoking/workflow control. Shared focus management preserves prior inert state and handles table redraws.
- Crappy Eights reveals a destination card's page before keyboard focus. Its paging state is reapplied after renders so hidden cards do not flash into the action area.
- Spades exposes its existing table state to its existing client module, restoring bid-chip input and the selected strength's legal-card picker instead of silently falling back.
- Crapjack locks player actions while the dealer resolves a hand, preventing rapid repeated Stand input from paying or recording that hand twice. Its optional in-flight save flag resumes dealer resolution once; older saves remain compatible. Desktop chips and actions keep separate space and actual action hit targets are checked.
- Existing game geometry is refined to keep cards, actions, fields, queues and HUD text clear of measured music controls and each other. Rad Dad's music-free adapter must not acquire an empty footer reservation. Original art and game identity are retained.
- Leaving the phone layout restores canvas dimensions owned by the responsive fitter. Turdtris and legacy Neon retain their proper board proportions and desktop size through repeated breakpoint changes, and Neon's visible dock accepts mouse input on narrow desktops.
- The existing chess worker now uses the proven shared delivery loader when a static host omits or mislabels the WASM content type. Native tests retain two real computer replies and one warm worker/download under both HTTP conditions.

## Implementation boundaries

Shared changes live in game pages, `game.js`, `assets/mobile-fit.*`, the small original `games/suite-dialog-focus.js` helper and the shared chess delivery loader. No new dependency or third-party artwork is added. Existing Chessground, Spatial, chess.js and Stockfish notices, pinned hashes and matching source archives remain unchanged. Stalemate's importer preserves the shared loader and retains its historical-source fallback; Rad Dad's sound-effect-only integration remains intentional.

Source tests cover behavior independently of either site. `tests/arcade-native-controls-browser.test.js` uses native browser input for focused controls, storage failures and actual result actions. Helper/pager tests cover inert-state restoration, DOM changes and reveal-before-focus. `scripts/card-ui-check.cjs` checks real guide/paging/layout behavior against an explicitly supplied existing server. Fixtures and accelerated clocks must be labeled distinctly from natural sessions.

Existing Crapjack/Rummy scenario entry points close the shared focus helper when directly hiding a guide, so controlled-position tests and supported moment links do not leave the board inert. The Rummy difficulty-layout test opens its real phone Table menu before checking reachable controls; stale rectangles from hidden baseline elements are not acceptance.

Receiving validation must exercise the generated result at both site configurations. A source-only pass is insufficient for footer differences, content security policies, clean/subpath routing or embedded media. The root workspace's `SUITE-POLISH-HANDOFF.md` and `release-evidence/suite-polish/REVIEW-MATRIX.md` track exact revisions, before/after screenshots, commands, first failures, required CI, actual publication and live QA. Qualification remains in progress until those records prove the full goal.

## References and acceptance

The [W3C modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) defines contained Tab traversal, Escape, initial focus and logical focus return. Focus must also remain visible in scrollable guides. Native HTML buttons/links retain their default keyboard activation rather than competing with global gameplay shortcuts.

Use the repository's existing `npm test`, `npm run lint`, `npm run test:mobile` and `npm run test:smoke` gates. The current source CI selects Node22; site receivers use their tested Node24 workflows. Keep first failures and distinguish real defects from driver/sandbox/precision issues. Do not lower assertions to make a run green.

Screenshots and native sessions cover representative desktop, narrow portrait, short landscape and tablet cases. They do not establish physical-device acceptance, every campaign or possible card position, real screen-reader behavior, calibrated chess strength, human enjoyment or retention.
