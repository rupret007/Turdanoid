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
visible action, border mark, and existing accessible status label. Larger
text wraps naturally; the action can move below the description.

## Verification

The unchanged-main browser baseline at 390 × 844 put TurdSpades between
1,618px and 1,898px down the page. The new browser regressions require all
six touch targets in the first screen at 320 × 568 and 390 × 844, both on a
fresh visit and with four valid card-table saves plus arcade last-played.

The browser pass also taps all six destinations, checks that large text
does not overlap launch actions, follows keyboard focus through all six
games and presses Enter, and verifies the static launcher without scripts.
The existing suite covers the root/legacy routes, invalid saves, restored
table actions, and arcade last-played without inventing Continue.

Run `npm test`, `npm run lint`, and `PLAYWRIGHT_CHANNEL=chrome npm run test:smoke -- 8138`
locally. Hosted CI uses bundled Chromium. Exact local and hosted results
belong in the PR body and coordination AFTER receipt.

## Boundaries

Only index.html changes product behavior. No game files, shared JavaScript,
storage/continue validators, physics, rewards, dependencies, or workflows
change. hub.html remains redirect-only. No network input or dynamic HTML
rendering is added. Parked OPEN DRAFT #8 at `0fefa012` is untouched.

No Pages, install, merge, tag, release, signing, spend, send, or live Cisco.
This draft does not publish the phone layout or claim physical-device Safari
acceptance; browser evidence is local/hosted Chromium. Stop for Karen.

BOB_NEW_SESSION_FREELANE_20260906_2216
OVERNIGHT_BOB_CONTINUE_20260907_0255
