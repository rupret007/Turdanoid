# Worth building: TurdAnoid Bomb pays for kills

Base: `2b1864fa118962abf98c5cf34acdbf58f4f1d699`, main after leftover-squash #24.

TurdAnoid's Bomb already shakes the screen and deletes bricks in the blast,
but `detonate()` never added score, never rolled a pickup, and never updated
the HUD. A player who grabbed 💣 watched the wall explode while the
scoreboard stayed still. Hot-dog explosions already pay the destroy bonus
(Gold Rush 2×). Bomb did not.

A live-page regression on unchanged main reproduced the leftover: a 1-HP
brick at court center scored 0 instead of `5 × level`. Gold Rush still paid
0. Splash-only chips and far-court survivors already behaved correctly.

This slice completes one player journey: catch a Bomb, see `+points` on the
bricks it actually kills, watch the HUD move, and still have the usual
pickup roll. Gold Rush doubles that destroy bonus. Damaged survivors score
nothing. A leftover far brick still prevents a fake wall clear.

Validation uses the shipped `TurdAnoid.html` script plus a Chromium pickup
journey. Existing paddle-size carry, blur pause, level-clear bonus, and
parked arcade mid-run saves remain outside the change. No new storage,
network, public test hook on Pages, dependency or workflow is introduced.
The six-game `index.html` door and redirect-only `hub.html` remain held, as
does parked #8.

One OPEN DRAFT for Karen, local suite and exact-tip hosted CI, then PRE_KAREN
leftover+security and coordination AFTER/release. No merge, tag, signing,
deployment, Pages or publication.
