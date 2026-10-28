# Arcade effects profiles

The default `classic` profile keeps Stalemate's music player and its original
recordings. Rad Dad's canonical importer opts the hub and eight promoted games
into `studio`; the legacy Neon game stays classic. Do not edit generated play/.

`assets/suite-sound.js` is the editable source for the studio palette and event
map. All sounds are original procedural synthesis: deterministic noise through
band-pass filters, plus short sine/triangle percussion envelopes. There are no
third-party recordings, samples, melodies, remote services or attribution
requirements introduced by this bank. Existing repository and chess licenses
remain applicable to their respective material.

No Rad Dad soundtrack is included in this release. No approved instrumental
recording with both established quality and rights was supplied. The complete
SFX pass stands alone; there are no empty music controls. Stalemate's playlist,
track labels, files and player are independent and must remain intact.

The studio scene drops unavailable, suspended, muted, hidden, paused or loading
cues rather than queuing them. Ordinary effects have 12 voice slots; results
can use four reserved slots, to an absolute scene cap of 16. Group cooldowns
suppress repetitive contacts and lower-priority duplicate results. Ended sources
are disconnected. Turdanoid's separate optional ambient drone is off by default,
shares the studio context/level and has a bounded fade-tail lifecycle.

Existing master and local preferences remain authoritative. The new effects
level defaults to 65%, clamped to 0–100%, under suite.effects.volume.v1. Denied
storage leaves settings page-local. Audio settings use a native dialog; action
games pause and require deliberate resume. Preview is explicit and never unmutes
a muted game. Studio playback never starts before a trusted user gesture.

Before release, use native browser lifecycle/mute/voice checks, actual rendered
PCM, ordinary/busy gameplay captures and a before/after listening sampler.
Mocks, code inspection and waveforms do not establish auditory quality. A human
listening review is required when the agent cannot audition audio. Do not publish
a main branch before that review and the required checks pass. Keep concrete
preview paths, browser versions and any physical-device limits in the handoff.
