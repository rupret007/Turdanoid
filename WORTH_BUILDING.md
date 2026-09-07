# Worth building: TurdAnoid Mega Flush pays for the row

Base: `da07dfa9568de7b2749ec426ec410778a2a7c94d`, main after leftover-squash #25.

TurdAnoid's Mega Flush already deleted the bottom brick row and added
`15 × level` to `score`, but `megaFlush()` never floated `+points`, never
rolled a pickup, never refreshed the HUD, and ignored Gold Rush. A player
who grabbed 🚽 watched the bottom row vanish while the score chip stayed
still and no capsules fell. Bomb already completes that destroy journey.
Flush did not.

A live-page regression on unchanged main reproduced the leftover: a 1-HP
bottom brick scored `15` in memory while the HUD stayed `0`, floated
nothing, dropped no pickup even with `Math.random = 0`, and Gold Rush still
paid `15` instead of `30`. An upper brick already survived.

This slice completes one player journey: catch Mega Flush, see `+points` on
the bottom-row bricks it actually removes, watch the HUD move, and still
have the usual pickup roll. Gold Rush doubles that existing 15 × level
flush bonus. Upper bricks score nothing and still prevent a fake wall clear.
High-HP bottom bricks still die — Flush is an instant row wipe.

Validation uses the shipped `TurdAnoid.html` script plus a Chromium pickup
journey. Existing Bomb scoring, paddle-size carry, blur pause, level-clear
bonus, and parked arcade mid-run saves remain outside the change. No new
storage, network, public test hook on Pages, dependency or workflow is
introduced. The six-game `index.html` door and redirect-only `hub.html`
remain held, as does parked #8.

One OPEN DRAFT for Karen, local suite and exact-tip hosted CI, then PRE_KAREN
leftover+security and coordination AFTER/release. No merge, tag, signing,
deployment, Pages or publication.
