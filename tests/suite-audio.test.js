import { describe, expect, it, vi } from 'vitest';

import { AUDIO_PRESETS, createSuiteAudio, shouldPlaySound } from '../assets/suite-audio.js';

describe('suite-audio', () => {
  it('shouldPlaySound respects mute flag', () => {
    expect(shouldPlaySound(false)).toBe(true);
    expect(shouldPlaySound(true)).toBe(false);
  });

  it('does not touch audio context when muted', () => {
    const start = vi.fn();
    const stop = vi.fn();
    const ctx = {
      createOscillator: () => ({
        type: 'square',
        frequency: { value: 0, linearRampToValueAtTime: vi.fn() },
        connect: () => ({ connect: () => ({}) }),
        start,
        stop
      }),
      createGain: () => ({
        gain: { value: 0, exponentialRampToValueAtTime: vi.fn() },
        connect: () => ({})
      }),
      currentTime: 0,
      destination: {}
    };
    const audio = createSuiteAudio({
      isMuted: () => true,
      getContext: () => ctx
    });
    audio.playPreset('chip');
    expect(start).not.toHaveBeenCalled();
  });

  it('exposes named presets', () => {
    expect(AUDIO_PRESETS.chip.slide).toBeGreaterThan(0);
    expect(AUDIO_PRESETS.card.slide).toBeLessThan(0);
  });
});
