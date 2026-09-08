# Hub masthead resume shortcut

Marker: OVERNIGHT_CLAUDE_TURDANOID_20260907_2007.
Base: `7c1064191dd5c96848fb0fd0febac3c6e401be8f`, main after the phone
resume-cue edge accent (#30).

## The gap

A returning player who has a live table lands on the six-game launcher and
still has to *find* it. Every cue for "you were here" lives inside the grid:

- the `::after` badge on the card heading ("In progress" / "Last played"),
  hidden at the 600px phone breakpoint;
- the `.play` verb switching to "Continue" / "Play again";
- the card `aria-label`;
- on phones, the coloured left edge added in #30.

All four are per-card, mid-grid, behind the masthead. On a 320-wide phone the
in-progress row can be the sixth one down. Nothing at the top of the page — the
first thing a player reads — acknowledges that a match is waiting or offers a
way straight to it. The ten-second scan is "read six near-identical rows, spot
the one whose button says Continue".

## The change

`assets/turdsuite.js` — `markHubProgress` now calls a new `markHubResume`
after it decorates the cards. When `Suite.table.list()` reports at least one
live table, it swaps the static `.hero-badge` ("No sign-in • works on phone and
desktop") for an anchor to the best pick-up target:

- the last game opened, when that table is still live (`turdsuite_last_game`
  ∈ the live list); otherwise
- the first table waiting (`Suite.table.list()[0]`).

The link text is `↩ Continue <Game>`, where `<Game>` is read from the matching
card's `<h2>`. Its `aria-label` is `Continue your <Game> game in progress`. The
badge keeps its `hero-badge` class (so all existing sizing, including the phone
overrides, still applies) plus `hero-resume`, and the guard skips a badge that
already carries `hero-resume`, so a re-run is a no-op.

`index.html` — one `a.hero-badge.hero-resume` rule: accent border, dark-teal
fill, accent text, no underline, plus a hover/focus ring. A
`prefers-reduced-motion` block drops the lift. No layout box changes — the
anchor occupies the same slot as the `<p>` it replaces, so no card moves and
the phone first-screen check is unaffected.

Nothing else moves: the continue validators, storage keys, the per-card marks
and their verbs, the desktop `.last-played` ring, and the grid itself are
untouched. First visits (no live table) and the no-JS render keep the original
reassurance badge.

## Tests

- `tests/hub.test.js` — a new `describe` block: the badge stays a `<p>` with
  "No sign-in" when nothing is in progress; a live last-played table promotes
  the badge to an `<a href>` naming the game, with one badge and six cards
  still in the masthead/grid; a live table elsewhere is used when the last game
  opened has no save; a finished match does not promote the badge.
- `browser-smoke.js` — `root-hub` asserts no `.hero-resume` on a first visit;
  the returning `hub-phone-*` pass asserts the masthead carries an `<a>` resume
  link pointing at one of the four live tables and reading "Continue";
  `hub-last-played` asserts the desktop masthead surfaces the TurdSpades resume
  link (tag, href, text) alongside the existing card mark.

## Local validation

- `npm test` — 15 files, 246 tests pass.
- `npm run test:smoke` — bundled-Chromium pass, "Browser smoke checks passed".
- `npm run lint` — 0 errors, 6 pre-existing unused-var warnings (unchanged).
- Browser pane, 375-wide and 1440-wide: with a saved TurdSpades table the
  masthead shows "↩ Continue TurdSpades" as an accent pill linking to
  `turdspades.html`; with storage cleared it shows "No sign-in • works on phone
  and desktop" as before.

## Boundaries

Only `assets/turdsuite.js` changes product behaviour, and only the masthead
badge of the hub for a returning player who already has a validated live table.
No game file, continue validator, snapshot string surfaced, physics, scoring,
control, storage key, dependency, or workflow change. `hub.html` stays a
redirect, `neon-arkanoid.html` stays the secondary link, the six-game
`index.html` stays the front door. Parked OPEN DRAFT #8 is untouched. No Pages
enablement, merge, tag, signing, release, deploy, send, or spend. One leftover,
then stop for the Karen leftover + security review.
