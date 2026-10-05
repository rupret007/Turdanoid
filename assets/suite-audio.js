/**
 * Shared WebAudio synth presets — honours turdsuite_muted via injected getters.
 */

export const MUTE_STORAGE_KEY = 'turdsuite_muted';

export const AUDIO_PRESETS = {
  blip: { freq: 660, dur: 0.06, type: 'triangle', vol: 0.05 },
  ding: { freq: 880, dur: 0.1, type: 'triangle', vol: 0.06 },
  chip: { freq: 420, dur: 0.05, type: 'square', vol: 0.04, slide: 80 },
  card: { freq: 320, dur: 0.07, type: 'sine', vol: 0.045, slide: -40 },
  win: { freq: 523, dur: 0.16, type: 'triangle', vol: 0.07 },
  lose: { freq: 180, dur: 0.2, type: 'sawtooth', vol: 0.06, slide: -90 }
};

/**
 * @param {{ isMuted: () => boolean, getContext: () => AudioContext | null, masterVolume?: number }} deps
 */
export function createSuiteAudio(deps) {
  const master = Math.max(0, Math.min(1, deps.masterVolume ?? 1));

  function playTone(freq, dur, type, vol, slide) {
    if (deps.isMuted()) return;
    const a = deps.getContext();
    if (!a) return;
    try {
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = type || 'triangle';
      o.frequency.value = freq;
      if (slide) {
        o.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), a.currentTime + dur);
      }
      const v = (vol || 0.05) * master;
      g.gain.value = v;
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
      o.connect(g).connect(a.destination);
      o.start();
      o.stop(a.currentTime + dur);
    } catch {
      /* ignore */
    }
  }

  return {
    masterVolume: master,
    playPreset(name) {
      const p = AUDIO_PRESETS[name];
      if (!p) return;
      playTone(p.freq, p.dur, p.type, p.vol, p.slide);
      if (name === 'ding') {
        setTimeout(() => playTone(990, 0.1, 'triangle', 0.05), 60);
      }
      if (name === 'win') {
        [659, 784, 1046].forEach((f, i) => {
          setTimeout(() => playTone(f, 0.16, 'triangle', 0.06), (i + 1) * 100);
        });
      }
    },
    playTone
  };
}

export function shouldPlaySound(isMuted) {
  return !isMuted;
}
