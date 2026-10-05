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

Each target is concrete and testable. `[x]` = done this round, `[ ]` = not done.

### 1. Table-first layout
- [ ] Felt is the hero: the `.table` surface is the only panel chrome; zones lose their boxes.
- [ ] Opponent hand is a centred, overlapping, arced fan of card backs across the top.
- [ ] Stock and discard sit on the felt with depth/shadow; discard shows a fanned top.
- [ ] Your hand is an overlapping arced fan at the bottom; at 390px every card is at least 44px wide
      and the indices stay legible (overlap is capped so no card shows less than ~0.3 of its width).
- [ ] Meld readout, round log and stats move into a collapsible drawer (`#tableDrawer`).
- [ ] Every existing ID and button label that `browser-smoke.js` uses still exists.

### 2. Meld visuals
- [ ] Hand is grouped by meld: each set/run is a contiguous group with a coloured bracket and label.
- [ ] Deadwood cards sit slightly lower in their own grey group.
- [ ] Deadwood counter tweens to its new value instead of snapping (instant under reduced motion).
- [ ] Knock shows a "ready" glow when legal; Gin shows a shimmer sweep when gin is possible.

### 3. Card motion
- [ ] Draw from stock or discard flies the card into its hand slot.
- [ ] Discard flies from the hand to the discard pile.
- [ ] Opponent draws and discards fly from/to its fan.
- [ ] Deal staggers both hands at round start.
- [ ] Card lift on hover/select is kept; all flights are skipped under `prefers-reduced-motion`.

### 4. Big moments
- [ ] Knock/gin/undercut: the bot's hand flips face-up card by card on the table.
- [ ] Laid-off cards fly onto the knocker's side.
- [ ] A round banner counts up deadwood totals and the round score; it never blocks the dock.
- [ ] Match win: a trophy panel shows match stats read from `turdrummy_stats_v1` (read-only) with
      Rematch and Keep Table buttons.

### 5. AI
- [ ] Tracks the human's discard-pile takes and infers the sets/runs they are building.
- [ ] Discard scoring penalises feeding those sets/runs (feed risk), tunable per difficulty.
- [ ] Knock threshold adds turn-count and stock-pressure terms.
- [ ] Difficulty Easy / Normal / Sharp in the topbar, persisted under the new key
      `turdrummyDifficulty_v1` (default Normal = previous strength plus the feed-risk term).
- [ ] Pure decisions covered by unit tests (`tests/turdrummy-ai.test.js`).

### 6. Onboarding
- [ ] First-round coach: four steps that highlight stock, hand, melds and knock; each step advances
      on the real action, with Next/Skip. Remembered under the new key `turdrummyCoach_v1`.
- [ ] HUD tiles carry `title` tooltips that explain Stock Left, Deadwood, Target and so on.

### 7. Mobile, a11y, feel
- [ ] No horizontal scroll at 320px, 390px or desktop.
- [ ] Hand focus survives re-renders (arrow keys move through cards; Enter/Space selects).
- [ ] Layoff sound and deadwood tick added to the SFX bank.
- [ ] Reduced motion gates every flight, flip, tween, banner slide and confetti burst.

## Known limits (honest)
- Overlapped fan cards are tapped on their visible strip (a card's left part is covered by the next
  one). Cards themselves are 44px+ wide; the strip is narrower at 320px with 11 cards.
- The coach and the feed-risk memory are per-device and per-round. The memory resets on reload
  because the continue snapshot shape is frozen for save compatibility; the discard pile itself is
  still restored, so the AI's view of the discard is intact.

## Needs shared change (shared lane owns these files)
- `assets/turdsuite.css` could expose a shared `--suite-card-fan` helper; TurdRummy keeps its own
  fan math in `games/turdrummy-motion-core.js` for now.
- Hub 2.0 could read `turdrummy_stats_v1` for the cover badge (read-only, no format change).
