# Primetime readiness audit

Target: mobile `TurdAnoid.html` Performance ≥85, Total Blocking Time (TBT)
<600 ms, Accessibility ≥95, and touch controls at least 44 × 44 CSS pixels.
Gameplay rules and simulation remain unchanged.

## Measurement

Baseline commit: `2b856a8d1dc6a9c89b8b6424e8f2de6c9a17ac17`.
Three cold runs used Lighthouse 13.5.0, autodetected Google Chrome 155 in
headless mode, and an uncompressed local Python HTTP server. Lighthouse's
default mobile simulation used a 412 × 823 viewport, 4× CPU slowdown,
150 ms RTT, and 1,638.4 Kbps throughput. Storage reset remained enabled.
These are local lab measurements, not deployed-site or physical-phone results.

| Baseline run | Performance | Accessibility | TBT (ms) | FCP (ms) | LCP (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 84 | 100 | 0 | 2,979 | 3,140 |
| 2 | 87 | 100 | 63 | 3,110 | 3,223 |
| 3 | 87 | 100 | 57 | 3,055 | 3,162 |

Values are rounded from `/tmp/turd65-audit/reports/before-{1,2,3}.json`.
Baseline median Performance was 87; the lowest run missed the 85 target.
Every baseline run already met the TBT and Accessibility targets.
Raw reports remain outside the repository.

## Reproduce

From the repository root, run the local server in one terminal:

```sh
python3 -m http.server 8766 --bind 127.0.0.1
```

With Chrome installed, run the same CLI options in another terminal:

```sh
mkdir -p /tmp/turd65-audit/reports
npx --yes lighthouse http://127.0.0.1:8766/TurdAnoid.html \
  --only-categories=performance,accessibility \
  --chrome-flags='--headless' \
  --output=json \
  --output-path=/tmp/turd65-audit/reports/after-1.json \
  --quiet
```

Repeat with `after-2.json` and `after-3.json`. Each CLI invocation launches a
fresh browser session. The recorded runs used Lighthouse 13.5.0; pin
`lighthouse@13.5.0` when reproducing after the default npm version changes.
For the baseline, serve a separate checkout of the baseline commit on port
8765 and use that port with `before-1.json`, `before-2.json`, and
`before-3.json`. Keep browser version, throttling, server, and host conditions
consistent across comparisons.

The readiness job in `.github/workflows/ci.yml` repeats the baseline and updated
page on the same fresh Linux runner using `scripts/readiness-audit.mjs`. It
also checks Accessibility on all seven games, saves complete reports in the
`readiness-lighthouse` artifact, and enforces the requested budgets on every
updated TurdAnoid run. CI installs Chromium before unit tests so browser-backed
tests run as well as the browser smoke suite. See PR #65's results comment for
the final paired CI measurements; do not compare scores from different hosts.

## Changes

TurdAnoid's classic dependency scripts move below the title-screen markup,
keeping their execution order and placement before the inline game script.
This lets the browser parse the title screen before executing the dependencies
and gives it an opportunity to paint while they load. No game simulation code
changes are needed.

The title's decorative scenery is captured once at the canvas resolution,
while its ball and capsules continue animating. The title's 32 static bricks
also reuse a native-resolution sprite cache. Caches invalidate on resize and
relevant visual changes. Returning to gameplay always uses the full original
renderer; physics, scoring, controls, and active-play timing are unchanged.

Shared CSS gives controls minimum 44 × 44 CSS-pixel hit areas, including
compact menus and dialogs. Legacy Neon Arkanoid receives equivalent minimums
and visible keyboard focus. Crapjack's settings receive associated labels.
Touch layouts for Rummy and Spades expose complete card targets instead of
overlapping them; mouse layouts keep their fans. Rummy retains meld labels
on each card. Browser smoke tests verify real hit testing, selection, and
viewport clearance at 320, 360, and 390 pixels. Hidden blackjack drawers and
celebrations are inert, and keyboard dismissal does not trigger game actions.

All seven game pages, including legacy Neon Arkanoid, contain
`<meta name="robots" content="noindex">`. `robots.txt` disallows `/preview/`
and `/previews/`, plus their `/Turdanoid/` project-path equivalents. No preview
path convention was present in the repository. Crawlers consult robots.txt at
the origin root: GitHub Pages serving this file only at
`/Turdanoid/robots.txt` does not enforce these disallows. Game-page `noindex`
metadata remains available independently when those pages are crawled.

## Re-gate fixes (Karen re-gate of 2f523d3 / 2b856a8)

- `noindex` meta on all 9 HTML pages (adds `index.html` and `hub.html`);
  `robots.txt` now disallows everything (`Disallow: /`).
- `html,body` use `touch-action: manipulation`; the canvas uses `pinch-zoom`
  and ignores multi-touch, so one-finger paddle drags still never scroll while
  two-finger pinch zooms.
- Menu backdrop frame rate adapts to the real frame cost (script + raster),
  backing off up to 1.2 s per frame on slow devices; gameplay stays full rate.
- Hub "Latest Changelog" toggle is at least 44 px tall.
- Neon Arkanoid: single `minmax(0,1fr)` column on ≤1024 px, no sideways scroll.

Box lab runs (Lighthouse 13.5.0, default mobile, Chrome headless, 3 runs each):

| Build | Performance | TBT (ms) | TTI (ms) |
| --- | --- | --- | --- |
| 2f523d3 | 63 / 64 / 66 | 1359 / 1206 / 960 | 5527 / 5419 / 5071 |
| this commit (on 1b76593) | 87 / 88 / 88 | 0 / 0 / 0 | 3264 / 3155 / 3154 |
| this commit, before rebase | 81 / 83 / 85 | 300 / 233 / 179 | 3586 / 3515 / 3455 |
