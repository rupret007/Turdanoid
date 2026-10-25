# Royal Flush Chess polish

October 24, 2026. Builds on reusable source3b26c41 and the independently published Rad Dad preview version5. PR103/66 have been marked ready externally; their branches/status are preserved. This work uses codex/chess-polish and a separate receiving branch, with new stacked draft PRs. Only the existing independent Rad Dad preview may be published; established sites, main branches, hosting/DNS and production gates are outside scope.

## Audit and changes

No critical/high defect was established during the initial audit. Reproductions before changes are retained in workspace release-evidence/chess-polish/regressions-before.log (five failing native regressions) and help-before.log (phone help scroll849px instead of0).

| Severity | Reproduced defect | Resulting behavior |
|---|---|---|
| Medium | Cancelling New game with Keep playing leaves setup visible and the board hidden | Returns to the original unfinished board, retaining its exact saved moves and resuming its computer if needed |
| Medium | Backgrounding during promotion leaves a modal over Continue playing and permits a move while paused | Backgrounding cancels pending modal actions, preserves the position and exposes explicit resumption; stale promotion events cannot commit |
| Low | Black pawn promotion shows White choice artwork | Promotion title/art use the moving side; all four choices remain available |
| Low | Finished board announces the next turn; historical review promises a return to play | Completed board announces the result; review returns to Final board and preserves immutable results |
| Low | Hidden Black computer-side setting changes local starting orientation | Local starts/rematches begin with White at the bottom; Flip remains available |
| Low | Phone help initially scrolls to its final focusable button | Heading receives initial focus, each opening starts at the top, and a visible Close action stays reachable |
| Low | Rendered WebKit opponent/side selects are27px tall despite an authored44px minimum | Native select behavior keeps an authored trigger/caret; actual controls are44px or taller and can grow with text |
| Low | A long computer label wraps in568×320 and pushes the board bottom to321.78px; lower player strips also clip | Compact landscape labels/counts and a210px minimum board retain both strips within the viewport; full capture details remain in Moves & review |

The user then explicitly requested graphics enhancements and an obvious two-player choice. Native, fully labeled radio cards now expose 1 player and 2 players on the opening screen; the primary action names the chosen mode. Computer settings disappear for local play, and the latter starts without engine requests. Homepage/hub copy explicitly says two players share one device. Desktop setup art, illustrated match cards, a beveled board frame and light/dark player markers extend the existing blue/lime visual language without changing standard piece recognition or board geometry.

Two small assistance improvements are included: an optional illustrated reference for all six pieces, and contextual movement reminders after illegal actions/in quiet hints. Existing legal-move cues and the mature rules generator remain authoritative. Reminders explain movement rules; they do not claim a tactical evaluation or a strategic reason the engine preferred a move. Other special moves, draw claims, keyboard help and practice-aid rules remain accessible in optional disclosures. No forced tutorial, new game, rating, account, network opponent or service was added.

## Research and decisions

- [Chess.com official welcome/help](https://support.chess.com/en/articles/8615318-welcome-to-chess-com) documents bot difficulty, move suggestions, undo and basic learning. We preserve optional assistance and make match selection direct; we do not copy its platform or analysis claims.
- [Lichess Chess Basics](https://lichess.org/learn) groups piece movement and special moves. This supports a compact optional visual reference. The browser-readable page omits some interactive content; the indexed official lesson descriptions supplied additional context.
- [chess.js1.4.0 documentation](https://jhlywa.github.io/chess.js/) remains the source for move generation/validation. No private API or new rules implementation is introduced; existing claimable versus automatic draw handling remains intact.
- [FIDE rules3.7–3.9 and9](https://handbook.fide.com/chapter/e012023) support promotion, castling safety, king safety and draw explanations. Castling help now explicitly covers unmoved king/rook and a clear safe path.
- [MDN dialog documentation](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog) describes initial focus/autofocus. The long guide now focuses its heading instead of its final button.
- [October2026 player feedback](https://www.reddit.com/r/chessbeginners/comments/1wygpm3/can_you_guess_which_move_i_played_next/) describes a beginner inspecting highlighted moves and learning stalemate. Retrieved as an indexed first-person excerpt; direct page fetch failed. This is one anecdote, not representative evidence or proof of retention. It supports keeping move cues, optional explanations and honest draw terminology.

No third-party code/assets or dependency versions were added or changed. Original SVG silhouettes are reused for the new art/reference. Existing chess.js/Stockfish licenses, exact source archive/network and integrity metadata remain unchanged. Friendly's description names its actual shortest search/lowest skill and acknowledges it can spot tactics, rather than promising frequent mistakes. No Elo calibration or compiler rebuild is claimed.

## Verification and checkpoints

Native regressions cover all six defects, visible two-player selection/no engine download, illustrated help, contextual feedback and real Back navigation/save/mute. Existing rules/perft, all four promotions, worker cancellation/reuse, storage, engine failure, actual touch checkmate and keyboard cases remain. Early in-progress runs hit selectors that assumed the last details element was Game options; optional guide disclosures made that assumption invalid. Tests now target the named Game options disclosure. Two new drivers also repeated an already-selected source square; clearing selection fixes those drivers without changing move semantics. Failed logs remain.

The complete local source checkpoint passed143 files/2029 tests, mobile104 cases and full eight-game smoke. Receiving-site review passed21 viewport games,3 real computer flows and3 labeled promotion/background fixtures across Chromium/Firefox/WebKit. Rendered screenshots then exposed WebKit's27px select trigger; the authored appearance correction is checked explicitly in the final matrix. Natural computer gameplay reached a45-half-move win and4-half-move loss with retained PGNs; winning-player choices were engine assisted, with no assigned game state/outcome. Final exact-head CI and publication still qualify the candidate. Workspace RADDAD-ADDITIONS-POLISH-HANDOFF.md and release-evidence/chess-polish/ record final receipts without forcing source-SHA churn.

Physical phones, real screen readers, speaker quality and browser-toolbar zoom are not established by headless/touch/viewport tests. Simulated visibility is labeled accordingly. Standard material draws remain supported; exhaustive blocked-position deadness is unchanged and not claimed.

## Hosted landscape follow-up

The first isolated publication, version6, passed194 response/source comparisons,21 local-game viewport cases,3 computer desktop flows and132 site visits. The stricter release flow then caught computer-mode clipping after portrait-to-landscape rotation. It was a real stable layout defect, not a timing issue: scrollY0 and the same321.78px board bottom after two animation frames. The earlier matrix did not cover that mode/viewport combination. The goal remains active until a corrected exact-head candidate is published and independently verified.

New regressions cover computer/local play through three short-landscape rotations and both board orientations, plus a legal capture/promotion layout fixture. They require the entire board and both player strips to fit. Landscape capture totals remain beside the board; complete piece names are preserved in the move panel and accessible text. Duplicate level text moves out of the tight strip while remaining visible in the control panel. Primary controls stay44px, and Flip returns focus/view to the board. The210px board minimum leaves cells above24px rather than shrinking them below the established minimum. Before failures/PNG/metrics are retained in workspace evidence.
