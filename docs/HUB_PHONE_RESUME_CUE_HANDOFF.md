# Hub phone resume cue

Marker: OVERNIGHT_CLAUDE_TURDANOID_20260907_1710.
Base: `98441c297c58fe2b0982fd65397481d42ebf5dfb`, main after the hub Continue /
Play again label read (#29).

## The gap

The six-game launcher marks a card that has a live table or was opened last in
three ways:

1. a coloured `::after` badge on the heading — "In progress" / "Last played";
2. the `.play` verb switching to "Continue" / "Play again";
3. an `aria-label` spelling out game, blurb, action, and state.

At the 600px phone breakpoint `index.html` sets `display: none` on the badge
(alongside the cover art and emoji tile) because the compact rows have no room
for it. That is the right call for space, but it left a sighted phone player
returning to a live table with only cue **2**: the word "Continue" instead of
"Play", in a 0.65rem uppercase pill that is the same accent colour on every
row. In a ten-second scan of six near-identical rows, the one to resume does
not jump out. `.game-card.last-played` already carried a faint border/ring from
the shared (non-media) rule; `.game-card.in-progress` — the *more* important
state, a table actually waiting — had no card-level treatment at all once the
badge was hidden.

## The change

`index.html`, inside the existing `@media (max-width: 600px)` block, right after
the rule that hides the badge:

```css
.game-card.last-played,
.game-card.in-progress {
  border-left: 4px solid var(--gold);
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--gold) 13%, transparent), transparent 62%),
    linear-gradient(180deg, rgba(16, 30, 50, 0.82), rgba(8, 18, 34, 0.9));
}
.game-card.in-progress {
  border-left-color: var(--accent);
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--accent) 15%, transparent), transparent 62%),
    linear-gradient(180deg, rgba(16, 30, 50, 0.82), rgba(8, 18, 34, 0.9));
}
```

- Gold left edge + wash for the last game opened, live accent for a table still
  in progress, so the two states stay distinguishable without the badge.
- `.in-progress` is declared last, so a card that is both (the "prefers
  Continue" case) shows the accent edge — matching which action the player gets.
- `box-sizing: border-box` is global, so the 4px edge sits inside the row and
  shifts no layout; the smoke `scrollWidth` and touch-target checks are unmoved.
- Phone only. Desktop keeps the badge and its own `.last-played` ring.

## Tests

- `tests/hub.test.js` — a new case asserts the phone block still hides the
  badge and now also carries the `border-left` edge rules for both states.
- `browser-smoke.js` — the returning `hub-phone-*` pass now reads the computed
  `border-left-width` of a plain row, the in-progress row, and the last-played
  row, and fails unless both marked rows are visibly thicker than a plain one.

## Local validation

- `npm test` — 30 files, 483 tests pass.
- `npm run test:smoke` — "Browser smoke checks passed".
- `npm run lint` — 0 errors, 6 pre-existing unused-var warnings (unchanged).

## Boundaries

Only `index.html` CSS changes, and only the phone appearance of already-marked
hub cards. No game file, continue validator, storage key, JavaScript runtime,
physics, scoring, control, dependency, or workflow change. `hub.html` stays a
redirect, `neon-arkanoid.html` stays the secondary link, the six-game
`index.html` stays the front door. Parked OPEN DRAFT #8 is untouched. No Pages
enablement, merge, tag, signing, release, deploy, send, or spend. One leftover,
then stop for the Karen leftover + security review.
