# Turdanoid 1000x — shared lane audit (round 3)

Base: round-0 audit `TURDANOID-1000X-AUDIT-1005.md`, tree `b3821b4` save contract.

## Honest audit (deeper)

| Area | Round 2 | Round 3 gap / action |
|------|---------|----------------------|
| Gameplay | Hub launcher + continue honest | No change to continue rules |
| Feel | Hub idle + ambient | **Back pill overlapped thumb docks** on 390/320 — fixed via top-left compact pill |
| Graphics | Card/felt tokens | Hub spacing/contrast pass at 320/390 |
| Animation | Idle covers + critters | Pause hub idle + logo glow when tab hidden |
| Audio | Preset bank | Unchanged |
| HUD | Stat chips (desktop) | **Boss best** + optional **Spades stats** keys |
| Mobile/touch | 320px phone rows | Back pill 44×44 top-left; docks unobstructed |
| a11y | Skip, announcer | Back pill keeps `aria-label="Back to game hub"` |
| Perf | FX cap | Vitest **30s** test/hook timeout under load (assertions unchanged) |
| Onboarding | Continue hero | Unchanged |
| AI | N/A | N/A |

Save/continue: **do not** change `turdsuite_continue_v1` shapes or existing localStorage keys.

## Suite.audio() API (for game lanes)

Load once after user gesture (hub mute or any `Suite.audio()` call):

```js
const audio = await Suite.audio();
audio.playPreset('tick');    // UI tick
audio.playPreset('snap');    // card land
audio.playPreset('card');    // alias snap
audio.playPreset('chip');    // double clack
audio.playPreset('shuffle'); // noise + riffle
audio.playPreset('win');     // fanfare (alias: fanfare)
audio.playPreset('lose');    // wah-wah (alias: wah)
audio.playPreset('blip');    // short UI
audio.playPreset('ding');    // two-tone OK
```

Honours `turdsuite_muted` and `Suite.setMuted()`. `masterVolume` is fixed at 1 in the runtime wrapper; games may use `playTone` for custom beeps.

## Back pill placement

- **Default:** bottom-left on wide viewports; **top-left 44×44 icon** at ≤520px, inset below the safe-area (`~58px` top) so header toolbars stay clear without per-page edits.
- **Override:** `body data-suite-back="bottom"` keeps bottom dock; `data-suite-back="top"` forces top on all widths.
- Helpers: `assets/suite-back-pill.js` (`resolveBackPillPlacement`, overlap math) for unit tests and Playwright overlap scripts.

## Checklist (testable)

### Round 1 (done)
- [x] `assets/suite-audio.js` — WebAudio preset bank, master volume, honours `turdsuite_muted`, unit tests
- [x] `assets/suite-fx.js` — shake/flash/confetti with `prefers-reduced-motion` gating, particle cap, unit tests
- [x] `assets/suite-a11y.js` — skip link helper, `aria-live` announcer, focus-visible utility, unit tests
- [x] `assets/suite-hub-stats.js` — read-only badges from existing keys, hub decoration, unit tests
- [x] Hub: skip link, suite mute toggle, stat badges on game cards (desktop + phone)
- [x] `turdsuite.js`: lazy `Suite.audio` / `Suite.fx` / hub hooks; `Suite.announce` for games
- [x] Favicon polish (procedural SVG)

### Round 2 (done)
- [x] Card art tokens: paper texture, toilet-crest back weave, shared index contrast clamps, selected/illegal hooks in `turdsuite.css`
- [x] Table felt + chips: `.suite-table-felt`, `.suite-felt-stitch`, `.suite-chip[data-denom]`, `.suite-slide-in` + reduced-motion fallbacks
- [x] Hub 2.0: idle cover motion (`suite-hub-attract.js`), attract header glow, hero Continue banner class, trophy stat chips
- [x] Ambient layer: parallax depth + rat/duck critters (`suite-ambient.js`), pause hidden tab + reduced motion
- [x] Suite audio: snap, shuffle, tick, richer win/lose; tests updated
- [x] Unit tests: `suite-ambient`, `suite-hub-attract`

### Round 3
- [x] Floating hub pill: top-left compact control ≤520px; `data-suite-back` opt-in; `suite-back-pill.js` + tests
- [x] Hub badges: `turdanoid_boss_best_v1`, `turdrummy_stats_v1` (malformed-safe), optional `turdspades_stats_v1`
- [x] `vitest.config.ts`: `testTimeout` / `hookTimeout` 30000 ms
- [x] Hub polish: 320/390 spacing; pause idle/attract when document hidden
- [ ] Per-game adoption of new audio presets (other lanes)
- [ ] Table layouts opt into `.suite-table-felt` on felt panels (card-game lanes)

## Needs shared change (other lanes)

_None — opt into `.suite-table-felt`, `.suite-chip`, and `Suite.audio()` presets from game pages._
