# TurdRummy — 1000x lane audit (round 3)

Lane: `turdrummy`. Owns `turdrummy.html`, `games/turdrummy-engine.js`, `tests/turdrummy*.test.js`,
the `turdrummy*AiMs` lines of `CARD_TABLE_FEEL` in `games/suite-feel.js`, the Turdrummy section of
`RULES.md`, and new `games/turdrummy-*.js` / `tests/turdrummy-*.test.js` files.

Round 1 (commit `ac3d453`, draft PR #38) added the SFX bank + sound toggle, discard-safety AI
tie-breaker, confetti/haptics and `aria-live`. The conductor's round-1 review said the result was
audio/logic-heavy but visually almost unchanged. This round is about the table itself.

## Honest audit (round 2 starting point)

### Gameplay
- Rules engine is correct and well covered: bitmask meld solver (`analyzeHand`), recursive layoff
  search (`applyLayoff`, `tests/turdrummy-layoff.test.js`), knock/gin/undercut scoring, stock
  exhaustion. Scoring must stay identical so match scores remain comparable.
- Gaps: no way to see *which* cards are melded vs deadwood except a tinted border; no round log;
  the match ends with a one-line message and no end-of-match moment.

### Layout / HUD (the biggest visual problem)
- The page reads as a dashboard of boxed panels: a 6-tile stat strip, three bordered `zone` panels,
  two bordered pile boxes, a wood-framed "Table Center" zone, a meld chip readout, and a fixed
  deadwood pill plus a mascot. The felt is only the backdrop of the `.table` grid, not the hero.
- The hand is a `flex-wrap` row of 42px cards at 390px: it wraps onto two rows, indices are cramped,
  and there is no sense of a held fan.
- Secondary information (meld readout, rules, stats) takes permanent vertical space above the dock.

### Melds / deadwood
- Melds are shown only as a tinted card border (`data-meld`) and a chip list below the hand. Cards are
  not grouped, so a player has to read the chips to see what the analyzer found.
- Deadwood total is a plain number that snaps on each render.
- The Knock and Gin buttons glow only when enabled; there is no "ready" state that draws the eye.

### Motion
- Only a stagger-in deal (`card-deal`), a discard-top flip (`card-flip`), a confetti burst and the
  mascot bounce exist. Draws and discards teleport: the card appears in the target with no sense of
  where it came from. The opponent's draws and discards teleport too.
- Knock/gin/undercut is a text change plus mascot. The opponent's hand is never revealed on the
  table, so the player does not see why the bot knocked or what the layoff did.

### Audio
- Round-1 SFX bank covers draw, discard, select, invalid, deal, AI move, knock, gin, undercut, round
  win/lose and match win/lose. No sound for layoffs, deadwood ticks, or the coach.

### Mobile / touch
- The 4+3 action dock is sound. The Knock and Gin buttons stay in the dock at 390/320.
- Cards are 42px wide at 390px, below the 44px tap target.
- A full re-render on every select drops keyboard focus on the hand, so arrow-key or Tab users lose
  their place on every tap.

### Accessibility
- `#messageBox` is `role="status" aria-live="polite"` (round 1). The HUD tiles have no description, so
  "Stock Left" and "Your Deadwood" are unexplained to a screen reader and a sighted new player.
- The card grid has no group semantics: melds are not announced.

### AI
- Plays correct Gin Rummy with deadwood minimisation and meld-potential discarding, plus round-1
  discard-safety. It knows nothing about what the human is building.
- It feeds the human: after the player takes a 7♥ from the discard, the AI happily discards 6♥ or 8♥.
- Single difficulty; knock threshold depends only on score gap and round number, not on stock size
  or how long the round has run.

### Onboarding
- A single text guide overlay on first visit. No first-round coach, no HUD tooltips.

### Performance
- Every action calls `renderAll()`, which re-renders the opponent, piles, hand and meld chips with
  `innerHTML` and writes `localStorage`. That is fine at 10 cards, but new animation hooks must not
  add per-frame DOM work. Confetti is already canvas and capped.

## Round 2 checklist

Each target is concrete and testable. `[x]` = done this round. `[ ]` = not done, with the reason.

### 1. Table-first layout
- [x] Felt is the hero: zones lose their boxes; piles sit on the felt; the centre is a felt well.
- [x] Opponent hand is a centred, overlapping, arced fan of card backs (`#opponentCards`, nth-child arc).
- [x] Stock and discard sit on the felt with depth/shadow (stock stack, discard drop-shadow).
- [ ] Discard pile shows a fanned top (two or three cards). Not done: the single top card with its
      flip keeps the pile readable, and a fan would need a second data source the page does not keep.
- [x] Your hand is an overlapping arced fan at the bottom. At 390px every card is 48px wide. A single
      row keeps at least 42% of each card visible; when that cannot fit, meld groups wrap onto a
      second row (`fanLayout`, `.is-wrapped`). Verified: no horizontal scroll at 320, 390 or desktop.
- [x] Meld readout, round log and stats move into a collapsible drawer (`#tableDrawer`), open by
      default on wide screens and folded on phones.
- [x] Every existing ID and button label that `browser-smoke.js` uses still exists.

### 2. Meld visuals
- [x] Hand is grouped by meld: each set or run is a contiguous group with a coloured bracket and label.
- [x] Deadwood cards sit slightly lower in their own grey group.
- [x] Deadwood counter eases to its new value (`setCounter`); instant under reduced motion.
- [x] Knock shows a ready glow when legal; Gin shows a shimmer sweep when gin is possible.

### 3. Card motion
- [x] Draw from stock or discard flies the card into its hand slot (fixed clone, WAAPI).
- [x] Discard flies from the hand to the discard pile.
- [x] Bot draws and discards fly from and to its fan.
- [ ] Round-start deal: unchanged. The existing staggered `card-deal` for both hands is kept, but no
      new deal flight was added, so the deal reads as before.
- [x] Card lift on hover and select is kept. Every flight, flip, tween and banner slide is skipped
      under `prefers-reduced-motion` (`motionOn`, `TurdRummyMotion.shouldAnimate`, CSS gate).

### 4. Big moments
- [x] Knock, gin and undercut: the bot's hand flips face-up with a staggered flip.
- [x] Laid-off cards fly from their owner's hand onto the knocker's melds (or the bot's fan).
- [x] Round banner counts up deadwood and points; it never takes clicks (`pointer-events: none`).
- [x] Match win: trophy panel with stats read from `turdrummy_stats_v1` (read-only), with Rematch and
      Keep Table.

### 5. AI
- [x] Tracks the human's discard-pile takes and infers the sets and runs they are building
      (`activeHumanTakes`, `computeFeedRisk`). Takes they threw back stop counting.
- [x] Discard scoring penalises feeding those sets and runs, weighted per difficulty.
- [x] Knock threshold adds a level offset and stock pressure (stock ≤ 4 after six bot turns).
- [x] Difficulty Easy / Normal / Sharp in the top bar, saved under `turdrummyDifficulty_v1`.
      Default Normal = the round-1 strength plus the feed-risk term.
- [x] Pure decisions unit-tested (`tests/turdrummy-ai.test.js`). The full discard choice is not
      unit-tested because it lives in the page script; it is covered by page tests and the browser check.

### 6. Onboarding
- [x] First-round coach: four steps (draw, discard, melds, knock). Each advances on the real action
      it teaches, with Next and Skip. Saved under `turdrummyCoach_v1`.
- [x] HUD tiles carry `title` tooltips that explain Stock Left, Your Deadwood, Target and the rest.

### 7. Mobile, a11y, feel
- [x] No horizontal scroll at 320px, 390px or desktop (measured).
- [x] Hand focus survives re-renders; arrow keys, Home and End move between cards.
- [x] Layoff sound and deadwood tick added to the SFX bank.
- [x] Reduced motion gates every flight, flip, tween, banner slide and confetti burst.
- [x] Hand cards are tapped on their visible strip when overlapped. Round 3 autoplay taps the left
      quarter of every card and the tap registers (see round 3, finding 1 for the swallowed-tap bug
      that was hiding this).

## Round 3 (quality, playtest, finish)

### Autoplay harness: `scripts/turdrummy-autoplay.mjs`
Not run by vitest. It serves the repo and plays through the real controls (taps on cards and
buttons, overlay buttons, Tab and arrow keys) at 390x844, 320x640, 1280x800, a reduced-motion
390x844 run, a continue round-trip (leave for the hub mid-round, come back, play on) and a
keyboard-only round. It records console errors, uncaught errors, stuck turns (10 s without a state
change), overlays that do not dismiss, horizontal scroll, controls cut off the viewport, taps that
cannot land, bot turn latency, first-screen hand fit, and flights under reduced motion.

    node scripts/turdrummy-autoplay.mjs [--scenarios=phone,small,desktop,reduced,continue,keyboard]
         [--rounds=2] [--match] [--seed=1] [--out=DIR] [--trace]

Run it with `--match` to play a whole match to the trophy. Screenshots go to `--out`.

### Findings from playtest (and what was done)
1. **Quick taps were swallowed (critical, shared cause).** `assets/turdsuite.js` cancels the click
   of any tap that follows another within 350 ms (double-tap-zoom guard). A select followed by a
   quick discard lost its second tap; a harness tap 150 ms after another never selected. The page
   now stops that listener (`turdrummy.html`, top of the script). `touch-action: manipulation` on
   the body already prevents double-tap zoom. Fixed on this page only; see Needs shared change.
2. **The hand was below the fold on a phone.** At 390x844 the hand started at y 767 with the dock
   at 700. Round one added a 145 px coach card to the table centre. Fixed: the coach is a
   two-column strip on phones and short screens, the header is compact (title line hidden, 3x2
   buttons), the status tiles are tighter and the centre trims its spacing. Measured on the first
   player turn: cards 618-702, dock top 702 at 390x844 (`hand-below-fold` finding in the harness).
3. **Floating widgets covered cards and status.** The mascot, its speech bubble and the fixed
   "Your deadwood" meter were appended to `<body>`, so on a phone they sat over the status line and
   the bot fan, and on desktop the meter floated over the table. The mascot and bubble now live in the
   bot's zone header, the meter in the hand header. Its stale `z-index` made the meter paint over the
   trophy buttons; cleared.
4. **Desktop hand clipped by the dock.** At 1280x800 the hand's bottom 34 px sat under the dock. A
   short-height desktop rule (`max-height: 860px`) trims the topbar, status, table and hand padding
   and hides the footer note. Measured: cards 640-739, dock top 743.
5. **320x640 cannot show the whole hand above the dock.** The screen is too short for the table and
   a 144 px dock together. The hand scrolls under the sticky dock. Accepted; the harness does not
   flag this size.
6. **Live region re-announced on every tap.** Every card selection re-rendered the table, which
   rewrote the one status box, so screen readers repeated the last status. The status box now skips
   the rewrite when its text is unchanged. Covered by `tests/turdrummy-a11y.test.js`.
7. **Flights were 220-560 ms.** Now 180-320 ms (`flightDuration`), pinned in `turdrummy-motion.test.js`.
8. **Sort and difficulty were silent.** They now play the select tick.
9. **Autoplay stall (unconfirmed).** Once, in a desktop run, the bot's turn never started (turn
   stayed on the player with no draw). Not reproduced in four later full sweeps. The page pauses the
   bot on window blur, so a headless focus change is the likely cause; the harness now brings the
   page to front before each scenario. Root cause not confirmed.

### Measured
- Full sweep (2 rounds each, seed 1): phone, small, desktop, reduced, continue and keyboard all clean.
- Full matches at 390x844: 7-10 rounds each, trophy shown, no findings.
- Bot turn latency: median about 610 ms; the slowest bot turn in the runs was about 1 s (one sample).
- Reduced motion: 0 flights, 0 confetti canvases across a 2-round run.
- Continue: a mid-round table left for the hub and reopened restores identically; the next move is accepted.

### Checklist (round 3)
- [x] Autoplay harness with all scenarios, reduced-motion run, continue round-trip, keyboard round.
- [x] Autoplay findings fixed (1-4, 6-8). Finding 5 accepted. Finding 9 open.
- [x] Screenshots reviewed at 390, 320 and 1280; the trophy frame included.
- [x] Save compatibility test loads the exact b3821b4 turdrummy entry and stats value through the live
      page: no card, score or message lost; the continue shape and the `{ stats }` envelope unchanged.
- [x] Card flights 180-320 ms; bot pacing about 0.6 s per turn; reduced motion instant.
- [x] Every player action has a visible and audible response (select, sort and difficulty included).
- [x] Keyboard-only round: Tab to the buttons, arrows along the hand, Enter to act, visible focus.
- [x] Status is one polite live region; bot moves and round results announce through it.
- [ ] Discard pile shows a fanned top. Not done (see round 2).
- [ ] Round-start deal flight. Not done; the staggered deal is unchanged.
- [ ] Hand fits above the dock at 320x640. Not done (finding 5).
- [ ] Physical phone check of motion and sound. Not run (no device here).

## Known limits (honest)
- Overlapped fan cards are tapped on their visible strip (the next card covers their right part).
  Cards are 48px wide on phones; a crowded hand wraps onto a second row rather than narrowing strips.
- The coach and the feed-risk memory are per device and per round. The memory resets on reload
  because the continue snapshot shape is frozen for save compatibility; the discard pile itself is
  still restored, so the bot's view of the discard is intact. The coach restarts at step 1 after a
  reload until it is finished.
- Layout and motion were checked in headless Chromium at 320, 390 and 1440px with the flights and
  banners running. They were not checked on a physical phone (no device here).

## Needs shared change (shared lane owns these files)
- `assets/turdsuite.js` `preventDoubleTapZoom()` cancels the click of any tap within 350 ms of
  the previous one, which swallowed quick second taps on every page that calls it (TurdRummy
  verified; the same guard applies to the other games). Suggested fix: drop the JS guard and rely on
  `touch-action: manipulation` (already on `suite-no-zoom`), or skip interactive targets (`button`,
  `[data-card-id]`, `a`, `[role=button]`). TurdRummy already opts out on its own page.
- `assets/turdsuite.css` could expose a shared `--suite-card-fan` helper; TurdRummy keeps its own
  fan math in `games/turdrummy-motion-core.js` for now.
- Hub 2.0 could read `turdrummy_stats_v1` for the cover badge (read-only, no format change).
