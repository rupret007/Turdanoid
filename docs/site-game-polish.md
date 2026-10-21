# Arcade polish — October 21, 2026

Daily Dump remains removed. Existing records/save keys and the seven game cards
are retained. This pass adds:

- One primary Turdtris Play action, honoring the visible picker for pointer and
  keyboard activation. It waits for the mode module; optional Rules & tips and
  Resume run preserve a genuine active game. Classic/Sprint/Ultra records remain
  separate. `turdtris.html?mode=ultra` selects the existing two-minute mode;
  unknown query values retain Classic. A sibling hub link avoids nested anchors.
- Full accessible hub scores with Classic/Sprint/Ultra and Easy/Normal/Hard
  context. Badges read the existing keys and never rewrite player records.
- A brief Turdomania hint that survives hover/lone taps and disappears on the
  first successful pop. Its new completion flag is optional; denied storage
  stays playable. Compact toolbar icons keep accessible names and 44px controls.
- A shared actual-track status, with confirmed Apple Music links for Andrea and
  It’s Only Been 18. Other songs do not acquire guessed destinations. The single
  player retains preferences, gesture gating, replay and hidden-tab behavior.
  A slim landscape strip preserves the card games' control space. The legacy
  Neon difficulty picker is available in Run Menu instead of covering its controls.

Validation evidence is kept in the parent workspace's
`release-evidence/site-game-polish/`. First failures are preserved, including the
26px short-phone tile regression and landscape controls covered by the initial
music strip. The existing 32px short-phone tile assertion and 44px game controls
remain unchanged; layout and input behavior were corrected. A full local suite
passed 1,865 tests before the final input guards; final focused/mobile/smoke and
remote CI results must be checked on the actual release commit. Final focused
checks pass 190 tests and the full local mobile gate passes all 96 cases. The
first smoke caught the hub's new music status pushing a returning player's
seventh game below a 320×568 screen; the status now follows the game grid.
Actual screenshot review also found a landscape Turdtris board edge under the
music strip and a puzzle hint overlapping its stats. Both layouts are corrected;
the matrix now rejects play areas underneath the music strip, and a 568×320 hint
check covers tiles, HUD and controls. An initial Linux CI deal exposed Crapjack's
Bet Tools row covering the main chip rack after instant round completion. Optional
Bet Tools now live in Table Menu, preserving their existing actions. Four directed
opening outcomes verify the rotated chip targets and actual Max betting. The
first new menu test incorrectly attempted a duplicate chip shortcut intentionally
hidden on phones; it was corrected to exercise the real visible Max action.

StalemateSite imports committed source through its existing sync script and pins
the full source SHA. Merge source first with that commit reachable, then publish
the tested site import. No physical-phone acceptance or improved retention is
claimed.
