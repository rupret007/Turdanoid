# Turdanoid 1000x — shared lane audit (round 2)

Base: round-0 audit `TURDANOID-1000X-AUDIT-1005.md`, tree `b3821b4` save contract.

## Honest audit (deeper)

| Area | Round 1 | Round 2 gap / action |
|------|---------|----------------------|
| Gameplay | Hub launcher + continue honest | Hero Continue banner + trophy stat chips |
| Feel | Opt-in FX/audio modules | Hub idle SVG motion; ambient parallax + critters |
| Graphics | v4 covers, basic card indices | Paper texture, toilet-crest backs, felt/chip utilities, court/ace via game CSS + shared vars |
| Animation | Hover-only cover motion | Idle cover loops (pause off-screen / reduced motion); deal/slide utility classes |
| Audio | Basic preset bank | Richer snap/shuffle/chip/fanfare/wah + documented API |
| HUD | Mute + stat chips | Trophy styling; Continue masthead pulse |
| Mobile/touch | 320px phone rows | Focus rings on game cards; larger shared index clamps |
| a11y | Skip link, announcer | Landmarks unchanged; focus-visible on hub cards |
| Perf | FX cap | Ambient uses transform-only; critters capped at 2 |
| Onboarding | No sign-in badge | Continue hero when table live |
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

## Checklist (testable)

### Round 1 (done)
- [x] `assets/suite-audio.js` — WebAudio preset bank, master volume, honours `turdsuite_muted`, unit tests
- [x] `assets/suite-fx.js` — shake/flash/confetti with `prefers-reduced-motion` gating, particle cap, unit tests
- [x] `assets/suite-a11y.js` — skip link helper, `aria-live` announcer, focus-visible utility, unit tests
- [x] `assets/suite-hub-stats.js` — read-only badges from existing keys, hub decoration, unit tests
- [x] Hub: skip link, suite mute toggle, stat badges on game cards (desktop + phone)
- [x] `turdsuite.js`: lazy `Suite.audio` / `Suite.fx` / hub hooks; `Suite.announce` for games
- [x] Favicon polish (procedural SVG)

### Round 2
- [x] Card art tokens: paper texture, toilet-crest back weave, shared index contrast clamps, selected/illegal hooks in `turdsuite.css`
- [x] Table felt + chips: `.suite-table-felt`, `.suite-felt-stitch`, `.suite-chip[data-denom]`, `.suite-slide-in` + reduced-motion fallbacks
- [x] Hub 2.0: idle cover motion (`suite-hub-attract.js`), attract header glow, hero Continue banner class, trophy stat chips
- [x] Ambient layer: parallax depth + rat/duck critters (`suite-ambient.js`), pause hidden tab + reduced motion
- [x] Suite audio: snap, shuffle, tick, richer win/lose; tests updated
- [x] Unit tests: `suite-ambient`, `suite-hub-attract`
- [ ] Per-game adoption of new audio presets (other lanes)
- [ ] Table layouts opt into `.suite-table-felt` on felt panels (card-game lanes)

## Needs shared change (other lanes)

_None — opt into `.suite-table-felt`, `.suite-chip`, and `Suite.audio()` presets from game pages._
