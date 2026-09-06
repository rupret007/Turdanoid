# TurdRummy chained-layoff fairness

Base: `5d5cd772301a7d27555c413c45f3a5dd5f48792f`, after #22.

## Real product defect

The live page's old `applyLayoff()` sorted deadwood descending and considered
each card only once. With a knocker's hearts 3–4–5 run, it rejected the defender's
7 before attaching the 6 and never reconsidered the 7. A complete-deck fixture
demonstrated the actual Knock button awarding the knocker 6 points instead of
the defender's 26-point undercut. Both desktop and phone browser journeys
reproduced the wrong winner; five of thirteen focused live-page unit regressions
failed before the change.

## Changed code and player outcome

Only the layoff search inside the existing `turdrummy.html` changes gameplay.
Each state considers every remaining card and every legal destination. Cards
that cannot attach yet remain available after another card extends a meld.
Competing set/run placements are explored rather than permanently committing
to the first attachment. Equivalent remaining-card/table states are memoized
with structured data, keeping alternate attachment orders from repeating work.

The returned receipt preserves an actual legal sequence of attachments, with
each original deadwood card either laid off once or retained once. Existing
round scoring, score labels and round-summary text consume that result for
both human and AI defenders. The next round retains that single corrected award.

## Deliberately unchanged

- Existing `analyzeHand()` selection of the defender's own melds. This fixes
  chained layoffs of its remaining deadwood; it is not a new meld-selection
  engine or a claim that every possible alternative defensive meld declaration
  is optimized jointly with layoffs.
- Knock limit, Gin/undercut bonuses, match target, AI draw/discard choices,
  storage format, deck generation, rules, controls, rendering and turn pacing.
- Gin's no-layoff rule, suit/rank legality, set capacity and Ace-low runs.
- The six-game launcher, legacy redirect, other games, #22 focus resume,
  and parked #8 arcade saves.

## Verification map

- `tests/turdrummy-layoff.test.js` executes the real HTML page, not the
  simplified standalone engine. Thirteen cases cover both run ends, dependent
  chains, competing destinations, input-order changes, immutable inputs, legal
  receipt replay and card accounting, non-attachments, actual human Knock and
  AI draw/discard/knock, visible scores, and no-layoff Gin for either side.
- `browser-smoke.js` adds actual Knock-button and next-round journeys on desktop
  and phone. The deterministic fixture accounts for all 52 unique physical
  cards and checks the displayed score and layoff receipt.
- `test-runner.ps1` replaces only its obsolete source-signature assertion with
  the new memoized-search anchors. This compatibility assertion is not a
  substitute for executable scoring regressions; Windows execution must be
  reported separately if available.
- Required gates remain `npm test`, `npm run lint`, and `npm run test:smoke`.
  This repository is static HTML/JS and has no compiler or packaging command.
  Exact-head hosted evidence and final executed counts belong in the PR and
  coordination AFTER, not a guessed build-success statement here.

All game state used for verification is synthetic and device-local. No provider,
network service, real user save, purchase or live deployment is required.

## Handoff

One OPEN DRAFT for Karen leftover + security. Review the exact tested tip; do
not merge, tag, sign, release or deploy Pages from this task. Jeff retains the
live rollout decision. No sends, posts, spending or credentials/settings changes.
Do not duplicate or reopen the completed focus-resume work or parked #8.

Made-with: Codex Astra Ultra
