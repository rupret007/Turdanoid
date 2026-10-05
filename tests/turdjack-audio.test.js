import { describe, expect, it } from 'vitest';
import { createTurdjackAudio, SFX_PROFILES } from '../games/turdjack-audio.js';

describe('turdjack-audio', () => {
  it('exposes sfx profiles', () => {
    expect(SFX_PROFILES.blackjack.f).toBeGreaterThan(900);
  });

  it('does not play when game sound is off', () => {
    const audio = createTurdjackAudio({
      getSoundEnabled: () => false,
      getSuiteMuted: () => false
    });
    expect(audio.shouldPlay()).toBe(false);
    audio.play('chip');
  });

  it('does not play when suite is muted', () => {
    const audio = createTurdjackAudio({
      getSoundEnabled: () => true,
      getSuiteMuted: () => true
    });
    expect(audio.shouldPlay()).toBe(false);
  });

  it('allows play when both gates are open', () => {
    const audio = createTurdjackAudio({
      getSoundEnabled: () => true,
      getSuiteMuted: () => false
    });
    expect(audio.shouldPlay()).toBe(true);
  });
});
