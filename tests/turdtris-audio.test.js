import { describe, it, expect } from 'vitest';
import { isSoundBlocked, playTurdtrisSfx } from '../games/turdtris-audio.js';

describe('turdtris-audio', () => {
  it('blocks audio when game or suite mute is on', () => {
    expect(isSoundBlocked({ soundEnabled: false, suiteMuted: false })).toBe(true);
    expect(isSoundBlocked({ soundEnabled: true, suiteMuted: true })).toBe(true);
    expect(isSoundBlocked({ soundEnabled: true, suiteMuted: false })).toBe(false);
  });

  it('plays layered clear tones without throwing', () => {
    const stops = [];
    const ctx = {
      state: 'running',
      currentTime: 0,
      destination: {},
      createOscillator: () => ({
        type: 'triangle',
        frequency: { setValueAtTime() {}, linearRampToValueAtTime() {} },
        connect() { return this; },
        start() {},
        stop() { stops.push(1); }
      }),
      createGain: () => ({
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() { return this; }
      })
    };
    playTurdtrisSfx(ctx, 'clear', { linesCleared: 4 });
    expect(stops.length).toBeGreaterThan(0);
  });
});
