import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTurdspadesAudio, readSuiteMuted } from '../games/turdspades-audio.js';

describe('turdspades-audio', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      store: {},
      getItem(k) {
        return this.store[k] ?? null;
      },
      setItem(k, v) {
        this.store[k] = String(v);
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('readSuiteMuted respects turdsuite_muted', () => {
    expect(readSuiteMuted()).toBe(false);
    localStorage.setItem('turdsuite_muted', '1');
    expect(readSuiteMuted()).toBe(true);
  });

  it('does not create audio before gesture unlock', () => {
    const audio = createTurdspadesAudio({ isMuted: () => false });
    expect(() => audio.playCardPlay({ suit: 'H', rank: 10 })).not.toThrow();
    expect(() => audio.playTrickWin()).not.toThrow();
  });

  it('honours mute callback', () => {
    let muted = true;
    const audio = createTurdspadesAudio({ isMuted: () => muted });
    audio.unlockFromGesture();
    expect(() => audio.playBidLock(true)).not.toThrow();
    muted = false;
    expect(() => audio.playBidLock(false)).not.toThrow();
  });
});
