# Worth building: return to a paused card table

Base: `57e16afacc82a0f6ea56bbf9d95116cdfe2cce2e`, main after #21.

TurdSpades, TurdRummy and Crappy Eights cancel pending turns on `window.blur`,
but current main only resumes them on `visibilitychange`. Switching to another
app or window while the page stays visible does not require a visibility
change when returning. The table can remain frozen even though its status
promises the bot will move on return.

A regression suite loading the real inline page scripts reproduced the issue
in all three games before implementation. It also exposed timers that could
advance after the page became hidden but before its visibility event, and
guide/focus ordering that could lose the paused turn. The initial regression
run had 10 failures among 18 tests; the existing 146-test suite passed.

This slice completes one player journey: leave during an automatic turn,
return to the same table, and watch the pending move continue once. Focus and
tab-return events share recovery; hidden pages and open guides retain pause;
reset/finished rounds retire old work. Crappy Eights' automatic pass belongs
to the same journey and must survive an intervening guide.

Validation uses the shipped page scripts with controlled timers plus actual
Chromium pages and real bot moves. Existing suite routing, saved-table rules,
scoring, decks and pacing remain outside the change. No new storage, network,
public test hook, dependency or workflow is introduced. The six-game
`index.html` door and redirect-only `hub.html` remain held, as does parked #8.

One OPEN DRAFT for Karen, local suite and exact-tip hosted CI, then PRE_KAREN
leftover+security and coordination AFTER/release. No merge, tag, signing,
deployment, Pages or publication.
