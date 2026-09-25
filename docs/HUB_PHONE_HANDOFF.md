# Phone launcher handoff

PRE_KAREN: one six-game door clarity slice from
`ceea5ccae5685f7edf08304352f1cdfea4d7ea0c`. Karen leftover + security review
remains required before Bob may consider an exact-tip leftover-squash.

## Player change

At 600px and narrower, the same six game links use compact rows instead of
large decorative covers. A short description identifies each game. The
full row opens its game with one tap; there is no extra selector or menu.
Desktop retains its cover-art grid.

Continue and Play again now use the dark text of the normal Play action.
Phone rows suppress the redundant decorative status badge but keep the
visible action, border mark, and existing accessible status label.
Descriptions truncate with ellipsis instead of wrapping to keep all six rows
in the first screen even when the wider "Continue" or "Play again" buttons
are present. The status edge stays visible without hover or focus, including
on a table that is both last played and in progress.

## Verification

The unchanged-main browser baseline at 390 × 844 put TurdSpades between
1,618px and 1,898px down the page. The new browser regressions require all
six touch targets in the first screen at 320 × 568 and 390 × 844, both on a
fresh visit and with four valid card-table saves plus each of the six possible
last-played games. At 200% text size, vertical scrolling is allowed while names
and launch actions must remain inside their rows without overlap.

The browser pass also taps all six destinations, checks that large text
does not overlap launch actions, follows keyboard focus through all six
games and presses Enter, and verifies the static launcher without scripts.
The existing suite covers the root/legacy routes, invalid saves, restored
table actions, and arcade last-played without inventing Continue.

Run `npm test`, `npm run lint`, and `PLAYWRIGHT_CHANNEL=chrome npm run test:smoke -- 8138`
locally. Hosted CI uses bundled Chromium. Exact local and hosted results
belong in the PR body and coordination AFTER receipt.

## PR #32 follow-up verification (2026-09-25)

- Fixed the inherited desktop sheen opacity that made phone resume edges
  invisible until hover/focus. The edges remain out of flow and always visible.
- `npm test -- --exclude '.claude/**'`: 15 files, 254 tests passed. The unfiltered
  command also discovered nested worktree suites and timed out in three of
  those tests; only this checkout is included in the passing result.
- `npm run lint`: passed without warnings.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:smoke -- 8138`: passed, including all
  six last-played variants at both phone sizes, 200% text, keyboard launch, and
  no-script layout. Bundled Chromium is absent locally; installed Chrome was used.
- Returning-player 320 × 568 screenshot: each row is 59.1px tall and TurdSpades
  ends at 527.6px, leaving 40.4px within the viewport. These are local Chrome
  measurements, not physical-device Safari acceptance.
- `node --check browser-smoke.js` and `git diff --check`: passed.

## Boundaries

Only index.html changes product behavior. No game files, shared JavaScript,
storage/continue validators, physics, rewards, dependencies, or workflows
change. hub.html remains redirect-only. No network input or dynamic HTML
rendering is added. Parked OPEN DRAFT #8 at `a3ece5a` is untouched.

No Pages, install, merge, tag, release, signing, spend, send, or live Cisco.
This draft does not publish the phone layout or claim physical-device Safari
acceptance; browser evidence is local/hosted Chromium. Stop for Karen.

BOB_NEW_SESSION_FREELANE_20260906_2216
OVERNIGHT_BOB_CONTINUE_20260907_0255
