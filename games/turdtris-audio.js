/**
 * WebAudio SFX for Turdtris (no samples, synthesis only).
 */

const BASE_PROFILES = {
  rotate: { f: 520, dur: 0.05, wave: 'triangle', vol: 0.03 },
  hold: { f: 430, dur: 0.08, wave: 'triangle', vol: 0.04 },
  drop: { f: 280, dur: 0.08, wave: 'square', vol: 0.04 },
  lock: { f: 210, dur: 0.06, wave: 'sawtooth', vol: 0.03 },
  clear: { f: 760, dur: 0.11, wave: 'triangle', vol: 0.05 },
  level: { f: 900, dur: 0.14, wave: 'triangle', vol: 0.05 },
  pause: { f: 310, dur: 0.08, wave: 'square', vol: 0.035 },
  victory: { f: 1040, dur: 0.2, wave: 'triangle', vol: 0.06 },
  gameover: { f: 120, dur: 0.2, wave: 'sawtooth', vol: 0.055 }
};

const LINE_CLEAR_PITCH = [0, 0, 80, 140, 220];

export function isSoundBlocked({ soundEnabled, suiteMuted }) {
  if (!soundEnabled) {return true;}
  if (suiteMuted) {return true;}
  return false;
}

function playTone(ctx, profile, extras) {
  const p = { ...profile, ...extras };
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = p.wave;
  osc.frequency.setValueAtTime(p.f, now);
  if (p.slide) {
    osc.frequency.linearRampToValueAtTime(p.f + p.slide, now + p.dur);
  }
  gain.gain.setValueAtTime(p.vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + p.dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + p.dur + 0.02);
}

/**
 * @param {AudioContext} ctx
 * @param {string} type
 * @param {{ linesCleared?: number, level?: number }} [opts]
 */
export function playTurdtrisSfx(ctx, type, opts = {}) {
  if (!ctx || ctx.state !== 'running') {return;}

  const base = BASE_PROFILES[type] || BASE_PROFILES.lock;
  const lines = Math.max(0, Math.min(4, Math.floor(opts.linesCleared || 0)));

  if (type === 'clear' && lines > 0) {
    const pitch = LINE_CLEAR_PITCH[lines] || 0;
    playTone(ctx, base, { f: base.f + pitch, vol: base.vol + lines * 0.008 });
    if (lines >= 2) {
      playTone(ctx, BASE_PROFILES.clear, {
        f: base.f + pitch + 180,
        dur: 0.08,
        vol: base.vol * 0.65,
        slide: 40
      });
    }
    return;
  }

  if (type === 'level') {
    playTone(ctx, base, { slide: 120 });
    playTone(ctx, BASE_PROFILES.victory, { f: 660, dur: 0.1, vol: 0.035 });
    return;
  }

  if (type === 'drop') {
    playTone(ctx, base, { slide: -60 });
    return;
  }

  playTone(ctx, base, {});
}

export function createTurdtrisAudioPlayer(deps) {
  const getCtx = deps.getContext;
  const getSoundEnabled = deps.getSoundEnabled;
  const getSuiteMuted = deps.getSuiteMuted || (() => false);

  return {
    play(type, opts) {
      if (isSoundBlocked({ soundEnabled: getSoundEnabled(), suiteMuted: getSuiteMuted() })) {
        return;
      }
      const ctx = getCtx();
      playTurdtrisSfx(ctx, type, opts);
    }
  };
}
