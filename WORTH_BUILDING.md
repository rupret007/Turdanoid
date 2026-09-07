# Worth building: six games within reach on a phone

Base: `ceea5ccae5685f7edf08304352f1cdfea4d7ea0c`, main after Mega Flush #26.

On a 390 × 844 phone viewport, the launcher showed two complete game cards.
TurdSpades began at 1,618 pixels and ended at 1,898 pixels. Most of the
collection was hidden below large decorative covers. Returning players also
saw gold Continue/Play again text against a bright action fill.

This slice makes the existing six anchors compact rows at phone widths,
with each game's name, a short description, and the existing honest action.
All six choices fit the first screen at 320 × 568 and 390 × 844 in the tested
fresh and returning states. Each entire row is a touch target. Text at 200%
can wrap and move its action below it; scrolling remains available. Desktop
keeps the illustrated collection. All action labels use the dark ink again.

No duplicate navigation, new storage, JavaScript runtime, game mechanics,
dependencies, workflow, or deployment changes. Existing table validation
still decides Continue; an arcade visit still means Play again. The root
index.html door, redirect-only hub.html, and parked #8 remain held.

Validation exercises real phone layout, fresh and four-table returning
states, all six tap destinations, large text, keyboard order/Enter, and a
script-disabled launcher alongside the existing full suite. One OPEN DRAFT
PRE_KAREN with hosted checks, AFTER/lease release, then stop for Karen.
