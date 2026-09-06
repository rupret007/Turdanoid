# Crapjack soft-hand guidance — September 6, 2026

## Product result

The existing Hint, Smart and Discipline surfaces now distinguish soft 15/16
from hard surrender totals. A soft total contains an ace still counted as 11;
the same ace can fall back to 1. The Hit explanation names the current soft
total and explains that flexibility in plain language.

On base `600b96caa3064368f44cc8b79eb8c97950211fee`, the shipped page computed
`soft` but ran hard-hand surrender rules before the soft-hand branch without
checking it. Smart therefore surrendered Ace-five versus a dealer nine,
ending the hand and forfeiting half the play-money bet. The hint recommended
the same wrong action, and Discipline rewarded it.

The correction gates only those surrender recommendations on `!soft` and
reuses the existing soft-hand strategy. There is no second engine or new
strategy store. Manual surrender remains legal when the current rules allow
it. Hard-hand surrender, split precedence, soft doubling/standing, card
counting, payouts and save/continue behavior remain unchanged.

## Evidence and regression coverage

- Before changing product code, the new real-page suite had **12 failures
  among 33 cases**. Existing boundary cases passed.
- Actual desktop Enter and phone Smart reproduced the wrong action in
  Chromium: a $100 bet from a $1,000 starting bankroll ended at $950 after an
  automatic surrender, with a misleading 100% Discipline score.
- The corrected path draws the next fixture card (two), keeps soft 18 live
  with $900 remaining, keeps the dealer hole hidden, and records one correct
  Hit decision with zero losses or surrenders.
- `tests/turdjack-page.test.js` boots the actual inline page scripts, not the
  simplified standalone engine. It covers soft 15/16 against nine/ten/ace
  under both soft-17 settings, real input handlers, hint and Discipline
  agreement, manual surrender, and surrounding hard/split/double/stand rules.
- Fixtures reuse the existing card-deck helper and account for all 52 cards.
  Browser fixtures use the real shoe/deal functions. The phone regression
  reloads a saved hand before pressing Smart, proving Continue recomputes
  guidance from the restored live hand rather than caching old advice.
- Required final gates: full unit suite, lint and the existing six-game
  Chromium smoke pass. Frozen tip, actual hosted execution and results belong
  in the draft PR and coordination AFTER.

## Boundaries and handoff

This is a specific correction to the current game's rules, not a complete
mathematical audit of every strategy/deck option or a guarantee of winning.
The unused `games/turdjack-engine.js` still has its pre-existing soft-surrender
issue; the shipped page does not import it. Do not promote that experimental
engine into a live screen without reconciling its behavior with page tests.
All bankroll values are fictional in-game state; no payment or gambling
provider is involved. No new network, credential, storage, dependency,
workflow, public test hook or analytics surface was introduced.

The six-game index door, redirect-only hub, other games and parked PR #8 are
untouched. This static app has no compiler/package build step: browser loading
and smoke tests validate the actual shipped HTML/JS/CSS. Do not describe that
as a newly built native binary, a Windows-wrapper run or a live Pages deploy.

Deliver one OPEN DRAFT with local and executed hosted proof, PRE_KAREN
leftover/security review request, and coordination AFTER/release. No merge,
tag, signing, release or Pages deployment is authorized by this slice. Then
stop for Bob conductor; do not start another improvement round.
