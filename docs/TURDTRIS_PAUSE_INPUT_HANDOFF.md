# Turdtris pause releases held input

Base: `136ad2dd90382707f7224a089dc031a667bfbd51`.

Holding Down or a phone direction and then pausing left soft drop or its
repeat timer active. Resuming could continue that old input. The phone dock
also accepted movement while paused and could queue another repeat.

Pause and the help guide now release held input, using the same cleanup as
window blur. A paused phone dock accepts only Pause to resume. Movement and
soft drop work again on a fresh press. Gravity, scoring, run storage, the
six-game launcher and redirect, and the parked #8 branch remain unchanged.

Regression coverage runs the real page script for keyboard soft drop, phone
repeat cleanup at pause/guide/blur, paused input rejection, and fresh input
after resuming. Chromium smoke also exercises held pointer input across
keyboard pause/resume and the phone dock. Physical touch devices and other
browser engines remain for manual review. No new storage, network calls,
dependencies, or delivery behavior.

Local validation: all 241 tests in 15 files and the full Chromium browser
smoke suite pass. Lint passes with six existing unused-variable warnings.
Four new regression cases failed before the runtime fix. The existing
development dependency audit reports one moderate `@humanfs/node` advisory
(GHSA-p498-v437-472g); the dependency lock is unchanged in this slice.

OPEN DRAFT PRE_KAREN only: Karen leftover+security review before Bob considers
an exact-tip squash. No merge, release, signing, or Pages deployment here.

Markers: BOB_NEW_SESSION_FREELANE_20260906_2216 /
OVERNIGHT_BOB_CONTINUE_20260907_0633.
