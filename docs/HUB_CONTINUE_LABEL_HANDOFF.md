# Hub Continue / Play again label honesty

Marker: OVERNIGHT_CLAUDE_TURDANOID_20260907_1117.
Base: `f3396c3822b138b776c2a621935c6bab2f11b353`, main after Turdtris pause
input #28.

## The gap

On the six-game launcher, a card that has a live table or was opened last is
marked two ways: a coloured `::after` pill ("In progress" / "Last played") and
the `.play` verb switching to "Continue" / "Play again". `decorateHubCard` in
`assets/turdsuite.js` also set an `aria-label` on the whole anchor.

`aria-label` replaces the element's entire accessible name. The old value was
just `"<Game>, in progress"` or `"<Game>, last played"`. So a screen-reader
player tabbing the launcher heard the game name and a state word, but not the
one-line blurb (`"Spades: bid tricks or Nil."`) and not the action verb the
sighted player reads on the button. The `::after` pill is `display: none` at
the 600px phone breakpoint, so on a phone this label was the *only* Continue /
Play again cue, and it was the weakest form of it.

## The change

`assets/turdsuite.js` — `decorateHubCard` now builds the label from the same
pieces a sighted player sees, in reading order:

```
<Game>. <blurb>. Continue — in progress
<Game>. <blurb>. Play again — last played
```

The blurb is read from the card's existing `.game-info p`. Empty parts are
dropped. Nothing else moves: classes, the visible pill, the `.play` verb, the
continue/last-played rules, storage, and layout are untouched. The guard still
skips any card that already carries an author-set `aria-label` (none do today).

## Tests

- `tests/hub.test.js` — the last-played case now asserts the label contains the
  game, the blurb text, "Play again", and "last played"; the in-progress case
  asserts the blurb text and "Continue — in progress".
- `browser-smoke.js` — the `hub-last-played` check reads the marked card's
  `aria-label` on the real page and fails unless it carries the blurb and
  "Continue — in progress".

## Local validation

- `npm test` — 15 files, 241 tests pass.
- `npm run lint` — 0 errors, 6 pre-existing unused-var warnings (unchanged).
- `npm run test:smoke` — bundled-Chromium six-game pass, "Browser smoke checks
  passed".

## Boundaries

Only `assets/turdsuite.js` changes product behaviour, and only the accessible
name of already-marked hub cards. No game file, continue validator, physics,
scoring, control, storage key, dependency, or workflow change. `hub.html` stays
a redirect, `neon-arkanoid.html` stays the secondary link, the six-game
`index.html` stays the front door. Parked OPEN DRAFT #8 is untouched. No Pages
enablement, merge, tag, signing, release, deploy, send, or spend. One leftover,
then stop for the Karen leftover + security review.
