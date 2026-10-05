# Turdanoid 1000x — shared lane audit (round 1)

Base: round-0 audit `TURDANOID-1000X-AUDIT-1005.md`, tree `b3821b4` save contract.

## Honest audit (deeper)

| Area | Current state | Gap |
|------|---------------|-----|
| Gameplay | Hub is a launcher only; continue/last-played logic is solid | No per-game progress surfaced on cards; feels like a static list |
| Feel | Toast/hype/quips, card deal/flip CSS, ambient bg | No shared particle/shake layer; games duplicate WebAudio beeps |
| Graphics | Strong v4 hub SVG covers, sewer tokens | Phone rows hide art; cards still small in table HUDs (game lanes) |
| Animation | Cover hover sheen, logo bob, SVG micro-motion | Hub not “arcade busy”; reduced-motion mostly OK |
| Audio | `turdsuite.js` basic tones + mute key | No shared preset bank or master gain; per-game inconsistency |
| HUD | Masthead resume shortcut, phone edge accents | No suite mute control on door; no stat chips |
| Mobile/touch | Compact phone rows, safe areas, no horizontal scroll | Stat text must not wrap layout at 320px |
| a11y | Card `aria-label` for continue state | No skip link; no shared live region; focus rings uneven |
| Perf | CSS ambient, `contain` on bg | FX module must cap particles and avoid per-frame DOM |
| Onboarding | “No sign-in” badge | First visit could use subtle identity (sound tip) — optional |
| AI | N/A (shared) | N/A |

Save/continue: **do not** change `turdsuite_continue_v1` shapes or existing localStorage keys. Hub stats are **read-only**.

## Checklist (testable)

- [x] `assets/suite-audio.js` — WebAudio preset bank, master volume, honours `turdsuite_muted`, unit tests
- [x] `assets/suite-fx.js` — shake/flash/confetti with `prefers-reduced-motion` gating, particle cap, unit tests
- [x] `assets/suite-a11y.js` — skip link helper, `aria-live` announcer, focus-visible utility, unit tests
- [x] `assets/suite-hub-stats.js` — read-only badges from existing keys, hub decoration, unit tests
- [x] Hub: skip link, suite mute toggle, stat badges on game cards (desktop + phone)
- [x] `turdsuite.js`: lazy `Suite.audio` / `Suite.fx` / hub hooks; `Suite.announce` for games
- [x] `turdsuite.css`: global playing-card index contrast + focus-visible; skip/mute/stat styles
- [x] `games/suite-feel.js`: `prefersReducedMotion` helper (+ test)
- [x] `README.md` + `RULES.md` Shared Utilities note
- [x] Favicon polish (procedural SVG)
- [ ] Per-game adoption of `Suite.fx` / `Suite.audio` presets (other lanes)
- [ ] Larger card hit targets in table layouts at 390px (card-game lanes — CSS in their HTML)

## Needs shared change (other lanes)

_None for round 1 — stat badges and FX/audio are opt-in via `Suite.audio()` / `Suite.fx()`._
