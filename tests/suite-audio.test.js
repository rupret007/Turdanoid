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
    expect(AUDIO_PRESETS.chip.kind).toBe('chip');
    expect(AUDIO_PRESETS.shuffle.kind).toBe('shuffle');
    expect(AUDIO_PRESETS.snap.kind).toBe('snap');
  });

  it('plays chip preset without throwing when unmuted', () => {
    const start = vi.fn();
    const ctx = {
      createOscillator: () => ({
        type: 'square',
        frequency: { value: 0, linearRampToValueAtTime: vi.fn() },
        connect: () => ({ connect: () => ({}) }),
        start,
        stop: vi.fn()
      }),
      createGain: () => ({
        gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: () => ({})
      }),
      createBuffer: () => ({ getChannelData: () => new Float32Array(8) }),
      createBufferSource: () => ({ connect: () => ({ connect: () => ({}) }), start: vi.fn(), stop: vi.fn(), buffer: null }),
      createBiquadFilter: () => ({ type: 'bandpass', frequency: { value: 0 }, Q: { value: 0 }, connect: () => ({}) }),
      sampleRate: 44100,
      currentTime: 0,
      destination: {}
    };
    const audio = createSuiteAudio({ isMuted: () => false, getContext: () => ctx });
    audio.playPreset('chip');
    expect(start).toHaveBeenCalled();
  });
});
