# Arcade rules and recovery audit — 2026-10-26

## Scope and compatibility

Audit all eight accepted arcade games without changing content, structure, artwork,
rules variants or audio. Shared source is canonical; site play copies are generated.
Local browser checks use Chromium/WebKit and emulated screens, not physical phones.

## Confirmed corrections

- **Eights damaged Continue saves:** all 52 unique cards and a nonempty discard are
  required. A pending wild must be the human's held eight during an active human
  turn. Impossible saves follow the existing fresh-table fallback. Valid version-one
  saves, including pending wild choices, retain their shape and behavior.
- **Crapjack neutral split streaks:** one winning and one losing split hand is a
  neutral round. It now ends hot/cold streaks like a push, preventing a milestone
  bonus from being paid repeatedly. New milestones still pay the existing bonuses.
  Existing bankrolls, saves and records are retained. Historical bankrolls may include
  the excess bonuses; they are not retroactively reduced or directly comparable to
  corrected future play. No rules, payout rates or normal milestone amounts changed.

- **Crapjack hidden denominations:** the phone/short-screen CSS hid the existing
  chip amount text. Removing the two hiding overrides restores +$10/25/50/100
  while retaining chip artwork, dimensions, layout and betting behavior. Native
  browser regressions check painted text geometry and labeled betting amounts.

- **Rummy and Spades impossible active saves:** a missing Rummy hand could claim a
  one-card gin (+25 in the native reproduction), and a Spades turn with no playable
  hand could stall. Live saves now enforce Gin draw/discard hand sizes and drawn-card
  identity, plus Spades dealt-card counts and clockwise trick/turn consistency.
  Valid v1 formats and the captured historical Rummy save remain supported. The old
  hand-written Spades test fixture had physically impossible counts/turns; it is kept
  as a negative regression, with a legal v1 table used for positive compatibility.
  Invalid active tables follow existing fresh-game recovery; saves/records are not
  reformatted, and ended-table handling remains compatible.

## Evidence and coverage

Persistent full logs, failing reproductions, deterministic drivers and captures are
in the parent workspace release-evidence/arcade-logic-audit directory. These local
artifacts are not public site assets.

| Game | Rules and invariants exercised | Recovery/timing coverage |
| --- | --- | --- |
| Chess | Existing perft, special moves, mate/draw fixtures; 40 seeded legal sessions/3,934 moves, save replay, Undo, nonmutating intended claims | Existing real-worker cancellation/stale-output and browser navigation/reload tests |
| Crapjack | 18 actual-page complete-shoe fixtures per Chromium/WebKit: payouts, insurance/even money, surrender, double, split, split aces, H17/S17, multiple aces and neutral split bonuses | Duplicate settlement inputs; live-page reveal ownership; complete Continue inventory and pending-decision regressions |
| Eights | 50 seeded complete rounds per engine; 52-card conservation, declared special rules and winner scoring | Corrupt-save native reproduction/fallback; legacy saves, pending wild, duplicate draw, auto-pass, focus pause and finished-table regressions |
| Rummy | 500 independent exhaustive deadwood/partition checks per engine; existing live-page gin/knock/layoff/undercut fixtures | Existing exact legacy fixture, denied storage, discard restrictions and AI/focus tests |
| Spades | 50 complete rounds per engine; independent follow-suit/trump legality, AI legality, trick winners, 52-card conservation, nil/contract/bag scoring | Save validation throughout simulations; existing legacy/history, pause and UI tests |
| Turdtris | 100 seeded actual-page action sequences per engine; 10,968 actions/1,324 locks each, legal placements, finite monotonic score, one lock/action | Hold/pause input guards plus existing kicks, lock-reset exhaustion, scoring, mode clocks and held-input regressions |
| Turdomania | 1,000 boards/31,631 moves: independent component oracle, stable gravity, scoring, exact Undo, 49 clears/951 no-move results | Terminal moves rejected; existing browser replay, resizing, storage and progress tests |
| Turdanoid | 60 seeded physics/power sessions per engine: finite physics, bounded balls/lives and score; irregular manual deltas and combined powers | Existing actual-page collision, frame-rate, Catch/relaunch, loss/level/result, blur/pause and replay tests |

Spades intentionally counts failed-Nil tricks toward the partnership contract/bags,
as stated in its help. Preserve this variant. The unit-only Crapjack strategy port
has drift around soft-hand surrender; the active page already handles it correctly.
Isolated-port results alone are not proof of shipped behavior.

## Qualification status

Focused source checks and deterministic local audits pass. Full required checks,
canonical site imports, deployment and live verification are still pending at this
checkpoint. Do not treat this record as a completed-release claim.

Driver mistakes are retained separately: a Turdanoid probe incorrectly called the
internal step function after game over, bypassing the production loop's state guard;
a Crapjack fixture initially carried a legitimate hot streak between unrelated payout
cases. The corrected tests preserve those production behaviors. Initial lint found
missing braces in new tests; corrected without weakening assertions.
