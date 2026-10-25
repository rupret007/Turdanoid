# Replacement board acceptance criteria

Recorded before product implementation, October24,2026. The actual playing board is the priority. Compare Chessground with cm-chessboard in rendered examples, then integrate the strongest suitable option. Chessground is preferred by the goal.

- Replace the renderer with the selected pinned open-source library and professional art. Comparable gameplay screenshots must show visibly stronger pieces, scale, board palette, coordinates and framing.
- Native dragging, tapping, clicking and keyboard play use the existing chess.js rules. Invalid/outside drops restore the piece; stale events, backgrounding, computer turns and dialogs cannot commit moves.
- Accessible square names, arrow-key navigation, Enter/Escape, turn/status feedback and reduced motion remain available. At320px and short landscape, all64 squares stay square and both player strips fit.
- Preserve one/two-player selection, local Flip/rematch, Stockfish worker isolation, difficulty choices, rules/draws, hint/undo, promotion/cancel, review/PGN, saves/results and loading recovery.
- Record code and artwork licenses separately, exact pins, attribution and corresponding-source/build material. Self-host runtime files. Repeated receiving-site import must preserve the integration.
- Exercise both modes and special moves, natural outcomes and separately labeled fixtures in Chromium/Firefox/WebKit. Check actual rendered contrast, focus and enlarged text. Required local/CI gates qualify the exact release commits before preview publication.
- Preserve all other games and band content. Publish only the existing independent public preview and verify its source, routes, gameplay and private-file exclusions anonymously. Physical-device/human/AT gaps remain explicit.

Official research: https://github.com/lichess-org/chessground and https://github.com/shaack/cm-chessboard. Candidate pins, visual comparison, choice and license evidence will be added after inspection.

## Choice and primary references

Both pinned local demos accepted a native e2-e4 drag and rejected e7-e3; screenshots and resulting chess.js positions are retained in workspace release-evidence/chess-board/comparison.*. Chessground10.5.0 is pinned at b4f605018e1043640c917e82a74b214cb58e4a05; cm-chessboard8.15.4 at2069b9ef3c10f1e2f005dad9eb9a2c35ee60a865. Both have clean board surfaces and click/drag input. Chessground was selected for its established Lichess interaction/animation layer, configuration and dependency-free runtime. cm-chessboard's accessibility extension offers a move-entry form/list; neither demo supplies this arcade's existing arrow-key square-button experience. The integration retains those real buttons over the same rendered squares, with one canonical rules state.

The user additionally requested studying leading chess games' actual gameplay. Anonymous Lichess analysis and Chess.com computer screens were opened and inspected; local native demos and official input guidance informed the interaction choices. Reference screenshots are comparisons, not copied assets. Chess.com browser input was attempted during its bot intro; its recorded screen remained at Starting Position, so this is not claimed as a completed reference game. Lichess accepted native e2/e4 input. These are design references, not a universal ranking or player study.

- https://support.chess.com/en/articles/8708726-how-do-i-make-moves-in-live-chess describes both dragging and click/tap movement. Both are supported here.
- https://support.chess.com/en/articles/8708625-how-do-i-turn-on-off-the-legal-moves-dots-on-the-board describes the legal destination dots shown to new players. This integration preserves dots and distinct capture rings.
- https://lichess.org/analysis and Chessground's official README/source informed the large board, immediate turn/check/last-move cues, short animation, invalid-drop restoration and review controls. No accounts, clocks, premoves, platform UI or proprietary artwork were added.

## Artwork and distribution

Spatial artwork by Maurizio Monge is pinned at d8705d8bc9879fef44208de19e2a20c937409e1f from https://github.com/maurimo/chess-art, under MIT. Its configurable source explicitly supports gradient/stroke/shadow changes. The twelve SVGs use configured ivory/navy gradients/strokes with baked shadows and editor metadata removed; CSS adds a restrained shadow. Full copyright/license is served, and credits name the artist. Board colors/framing are original CSS, with no third-party texture. This avoids assuming every piece set displayed on a chess site has the board library's license.

Chessground is GPL-3.0-or-later; the new chess interface was already GPL-3.0-or-later. Public credits link the matching TypeScript/original artwork/build archive, readable adapters/styles, licenses and exact hashes. Runtime assets are self-hosted. scripts/build-chessboard-vendor.mjs and build-chessboard-art.py reproduce them from the pinned checkouts with rolldown1.2.15. A rebuild from the published source archive produced identical library bytes and all twelve configured SVGs (workspace vendor-rebuild.json). Existing chess.js and Stockfish files and source remain unchanged.

## Integration findings

Chessground's public callbacks are queued, and drag movement is sampled on animation frames. Tests now observe resulting UI/render frames instead of assuming a synchronous click callback. Outcome/legality assertions remain. A real rapid-local-input issue was fixed by preserving ordered selection callbacks across ordinary local turns while tying drag commits to their original FEN; interruption, game, view and orientation changes invalidate stale input. The existing native promotion dialog is exempted from the board's modal input lock only for a valid pending promotion; cancellation/backgrounding still reject stale actions. Intermediate failing runs are retained in native-first/second/third.log. Final qualification and publication receipts belong in the new board-release handoff/evidence, not older polish counts.

A native invalid/outside-drop sequence exposed a real stale cleanup race: the delayed cleanup of the previous invalid gesture could cancel a newly started drag at the same FEN. Cleanup is now tied to its own monotonically increasing gesture token. The regression keeps the immediate next drag and its successful move assertion.

The final focused native run passed all36cases. Eight varied opening starts and one deliberate early-mate fixture were searched with the existing Friendly engine setting; all responses were legal and bounded. This does not establish suitability for human beginners or calibrated strength, so the four existing levels and honest descriptions remain. The broader exact-head suites, browser matrix and release receipts are recorded in the workspace handoff as qualification completes.

Receiving-site tests caught a modal-close input race: the guide became invisible before its queued close event re-enabled pointer input. Guide/promotion cancellation now reconciles the board synchronously, with a native immediate-next-move regression. The new externally hosted SVG pieces and required board styles are checked before Play is enabled; a failed asset uses the existing deliberate Retry UI and preserves saves/mute. New recovery cases with failed SVG/CSS/library requests retain actual loading failures. This is part of qualifying the replacement, not a final completion claim.

Further reproduction proved the primary post-help pointer failure was stale cached geometry: the live board was at y98.17 while Chessground's cache still said y-696.83 after native modal focus restored scrolling. Pointer-start capture now clears that bounds memo before the library's hit-test. This preserves the mature library's input while avoiding a dependence on when the browser dispatches its scroll event. The previous paragraph records the earlier partial fix; both synchronous modal reconciliation and fresh hit-testing are retained. Missing stylesheet recovery also checks for actual CSS rules because a failed stylesheet can still have a truthy empty sheet object.
