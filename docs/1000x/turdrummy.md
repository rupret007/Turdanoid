# TurdRummy — 1000x lane audit (round 2)

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
- [ ] Hand cards are tapped on their visible strip when overlapped (a card's left part is covered by
      the next one). Every card is 48px wide on a phone; the strip is narrower only in the 11-card,
      four-group case, which wraps to two rows instead.

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
- `assets/turdsuite.css` could expose a shared `--suite-card-fan` helper; TurdRummy keeps its own
  fan math in `games/turdrummy-motion-core.js` for now.
- Hub 2.0 could read `turdrummy_stats_v1` for the cover badge (read-only, no format change).
