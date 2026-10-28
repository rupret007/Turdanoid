# Stalemate Arcade release follow-up

The arcade release was merged in PR #90. This follow-up on
`codex/remove-daily-dump` starts from main `1c612ff` and removes The Daily Dump
at the user's request. Changes in this branch require review and a separate
StalemateSite synchronization before publication.

The integration and validation record for both repositories is maintained in
[StalemateSite's arcade progress record](https://github.com/rupret007/StalemateSite/blob/codex/arcade-release/docs/arcade-goal.md).
Actual candidate screenshots and retained first-run failures are in that site's
`pr-assets/arcade-release/` directory. Neither retention gains nor physical-phone
acceptance have been established.

## Daily Dump removed

The hub no longer advertises a daily challenge, and the challenge modules,
artwork, save handling, result sharing, and daily-only tests have been removed.
Old links containing `?daily=today` or a date now open ordinary Turdomania;
undo, new boards, difficulty selection and free-play best scores work normally.
Existing free-play preferences, records and supported table saves retain their
original namespaces. Old daily storage is left untouched and is no longer read.

The hub keeps all seven games, existing saved-table Continue links and real
personal-best chips. The shared kit, local OFL fonts, original SVG puzzle tiles,
mobile controls, faster onboarding, optional band playlist and gameplay fixes
remain. Browser regressions retain coverage for denied storage, animation
cancellation, small-screen tile/control access and ordinary undo/new-board behavior.

## Existing work reconciled

- Reuse #89 `fd744aef85c9fb49564c07d7f2c3f82b2611c383` mobile foundation.
- Reuse #75 `285e9e5a8be142db95e62d909ff6e70eb06cf92d` visual kit/fonts and
  nonblocking Turdanoid hint. Apply the kit across the seven games.
- Supersede #87/#88 competing control relocations/offsets with #89's single
  ownership model. Recheck equivalent overlap, card access and hit-testing cases.
- Include compact #73 Fire-expiration and #78 Boss Flush relaunch fixes and tests.
- Include #70 stale-pop cancellation and #71 denied-storage access fixes and tests.
- Reuse #69's accurate Crapjack phone-menu guidance.

## Music and validation

The shared playlist owns the music preference and track index. The site overlay
must not create a second player. Explicit game pause leaves the playlist playing;
hiding the tab pauses it. Replay retains the player and track position. Music and
sound preferences remain optional, and playback requires a browser gesture.

Use Node 22 for this repository's CI gates: `npm ci`, `npm run lint`, `npm test`,
`npm run test:smoke`, and `npm run test:mobile`. The site uses Node 24 and imports
committed source with its portable SHA-aware sync script. Repeating an import from
the same source revision must produce identical bytes. See the linked progress
record for final counts, runtime/browser versions, first failures and retries.

Removal checks with Node 22 passed 79 selected unit/page/music/hub tests and seven
actual Chromium browser cases. Those browser cases cover ordinary undo/new-board
and difficulty controls, old challenge URLs, existing records, all seven hub games,
denied storage, short-phone control access and stale-animation cancellation. Lint
passed with zero errors and the existing unused-variable warning. Full suite and
mobile/smoke gates remain part of review CI.
