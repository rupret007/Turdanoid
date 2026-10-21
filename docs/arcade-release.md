# Stalemate Arcade release candidate

Prepared October 21, 2026 on `codex/arcade-release`, based on main
`76b7bc8e8f017f2b68062636e764b91a4ed924b5`. This is a review candidate;
main and public deployment have not been updated.

The integration and validation record for both repositories is maintained in
[StalemateSite's arcade progress record](https://github.com/rupret007/StalemateSite/blob/codex/arcade-release/docs/arcade-goal.md).
Actual candidate screenshots and retained first-run failures are in that site's
`pr-assets/arcade-release/` directory. Neither retention gains nor physical-phone
acceptance have been established.

## Daily Dump v1

Open `turdomania.html?daily=today`, or a dated link such as
`turdomania.html?daily=2026-10-21&v=1`. Invalid, future and unsupported-version
links explain the problem and offer today's challenge without changing free play.

- Challenge identity pins date, rules 1, generator 1, normal difficulty, 8 columns,
  10 rows, four kinds and a deterministic seed. Viewport fitting changes rendering.
- The Chicago calendar determines reset, including 23/25-hour DST days. The URL
  freezes the selected date and a running board remains that challenge at midnight.
- Every pop in the first run is final. Replay after completion is labeled practice;
  practice allows undo and never replaces the first completed result.
- Saves contain identity and legal move coordinates. Restore replays the canonical
  generator and rules instead of trusting supplied boards or scores. Unsupported,
  corrupt and denied-storage cases keep the game playable with visible guidance.
- Separate per-challenge keys preserve older runs. A bounded 30-date index discovers
  unfinished runs; older stored runs remain available through their dated links.
- Daily keys use `stalemate_daily_dump_*_v1`; existing free-play and table-save
  namespaces are unchanged. Storage is browser/device local and can be cleared.
  This is a friendly client-side challenge, without server-verified competition.
- Share includes game, date, rules, result, branding and the current deployment's
  challenge URL. PNG sharing is optional; text, clipboard and selectable text
  fallbacks handle unavailable APIs, denied clipboard and share cancellation.

The hub extends existing saved-table Continue links and personal-best chips with
real Daily progress and results. The kit uses local OFL fonts and original SVG
puzzle tiles with distinct silhouettes. No achievement or band-score placeholders
were introduced.

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
