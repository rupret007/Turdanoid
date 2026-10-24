# Game startup and small-screen polish

The shared loading helper runs before parser-blocking dependencies. Each of the seven main games calls `window.SuiteLoading?.ready()` after its required modules and controls initialize. Failed required entry modules, initial script errors or a 12-second boot deadline offer a native recovery dialog. Retry reloads the same URL without clearing storage; Escape and the visible exit return to the hub. A late successful boot retires the dialog. Cosmetic assets with working fallbacks do not block a ready game.

Keep the helper before other game scripts when editing these pages. Mark required module entry scripts `data-game-required`; do not report ready merely because the title screen painted. Native modal focus and game-shortcut isolation are covered by browser regressions, including a stalled head script before the body exists.

Rummy gives coach text a readable column and stable 44px actions. Phone settings use the existing Table menu; the stats drawer moves there during coaching or landscape and returns below the hand after portrait coaching. Its scrollable details can receive keyboard focus. The 320px Crappy Eights hand now uses the existing pager, and short portrait tables reserve space for the complete action row. Page headings, main content, navigation and score feedback retain useful accessibility semantics when compact chrome hides visible titles.

Rules, scoring, save formats and keys are unchanged. Site-specific music policies belong in the receiving site's importer; these upstream changes retain the existing shared player.

Desktop Rummy cards retain their fan geometry while hovered or pressed. Previously, an exposed card edge moved between pointerdown and pointerup, releasing over a neighbour and losing the click. Shadow feedback remains on hover; selection still lifts the card after activation. A saved table captured from normal play reproduces the failure with a real browser pointer, and passes with the stable geometry.

Turdanoid replay and the R shortcut restart the current mode. Boss Flush previously called the Classic entry point on replay; it now resets the run without changing the selected mode. Regression coverage checks both winning and losing Boss results.

Crapjack and Spades leave native link/form activation to the browser. Enter on Hub previously triggered a game shortcut, and keyboard Quick Play in Crapjack dismissed help without dealing. Focused action buttons now activate their own commands; Spades retains Enter-to-play for a selected hand card. Named chip/opponent groups and small-screen headings retain their accessibility semantics. Crappy Eights hides its table skip link while the table is inert behind a modal, and restores it when the table becomes usable.

Validation commands (matching CI's Node 22 runtime):

```sh
npm ci
npx playwright install chromium
npm run lint
npm test
npm run test:mobile
PLAYWRIGHT_CHANNEL='' npm run test:smoke
```

The mobile matrix includes 320px portrait and short landscape, real touch hit tests, four coach steps, paging, menu controls, draw/discard and live rotation. Run `MOBILE_BROWSER=webkit node scripts/mobile-fit.cjs` for the corresponding optional WebKit matrix after installing that engine. Browser emulation does not establish physical-phone acceptance.

Rad Dad integrates this branch through its pinned public importer. No upstream main merge or public deployment is part of preparing the review candidate.
