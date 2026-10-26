# Personal goals and completed results

The arcade hub offers an optional **Your progress** dialog after the same eight
games. It combines existing game records, up to ten new completed results per
game, and twelve permanent optional skill goals. No account, tracking, daily
deadline, currency or locked gameplay is introduced.

The badges are original SVG line artwork with text labels and explicit criteria.
Measurable goals show their best progress from completed runs. A selected goal
links to the existing game/mode; recording progress never opens a dialog,
steals focus, interrupts a decision or starts audio.

## Exact goals

- Turdanoid: clear a Classic stage; reach a five-hit combo.
- Turdtris: clear ten Classic lines; finish the forty-line Sprint.
- Crapjack: finish a profitable settled deal; win a natural-blackjack deal.
- Crappy Eights: win a round; win a match under its existing first-to-200 rules.
- TurdRummy: achieve player Gin.
- TurdSpades: You + North make a positive team contract in one round.
- Turdomania: clear a board at any difficulty.
- Royal Flush Chess: complete a game after at least one half-move, including
  accurately labeled local and assisted practice.

Neon's existing achievements remain independent and unchanged.

## Identity, compatibility and storage

`games/suite-progress-core.js` is a pure classic-script core;
`assets/suite-progress.js` provides the synchronous browser adapter and optional
hub dialog. Load both before game adapters. `newRunId(game)` allocates
`p1.<namespace>.<game>.<ordinal>` at an actual attempt's start. `record(event)`
validates completed outcomes and returns the stored entry, newly earned goals,
compatible improvement and storage status.

History uses settled Crapjack **deals**, full Eights/Rummy/Spades **matches**,
action/puzzle runs and completed chess games. Separate goal-only card round
events do not masquerade as full matches. A split deal's net includes all hands
and insurance. Legacy deals without a starting bankroll say net was not
recorded. Mid-match bot strength changes are labeled mixed.

Existing game saves keep their version and data. Optional validated card
`progressMeta` and chess `progressId` preserve identities across Continue.
Damaged optional metadata is dropped without discarding a valid playable game.
Old completed saves do not fabricate new history. Only legacy statistics that
prove an exact goal can recover its badge; no historical runs/dates are invented.

The independent `arcade_progress_v1` store retains ten display entries per game
plus compressed completion receipts, best-result comparisons, goal progress
and earned provenance. Receipts survive history eviction. Turdomania Undo keeps
the same identity: a later finish updates that board's result and can earn a
newly met goal once, without adding another run or re-awarding a badge.

Storage is bounded at 128K serialized characters, 4096 receipt intervals,
64 namespace/game scopes and 64 comparison buckets. Capacity preserves existing
receipts and reports that new progress cannot be saved. Denied storage uses
an honest in-page fallback; gameplay remains available. Existing save/stat keys
are never cleared. Progress is local to the current browser and site.

Score improvements compare completed peers within game, mode and unchanged
difficulty. Mixed or unknown difficulties are excluded. Turdomania additionally
requires the same recorded board dimensions; Sprint compares lower times only
for completed forty-line peers. Cards and chess receive no invented score ranking.

## Replay and sharing

The existing sharing utility now describes all eight games, with completed
outcomes, accurate mode/difficulty/assistance, site branding and clean game
links. Existing replay actions retain their mode. Only allowlisted setup
parameters are read; links never import a saved game, FEN or arbitrary result.
Native sharing, downloadable PNG, clipboard and selectable-text fallbacks remain
gesture-driven, with deliberate cancellation and stale-image invalidation.
Rad Dad's canonical importer supplies its own name and blue result-card accent.

See the workspace ARCADE-PROGRESS-HANDOFF.md and release evidence for current
qualification/publication state. Automated native checks and emulated viewports
do not prove physical-device behavior, human enjoyment or increased retention.
