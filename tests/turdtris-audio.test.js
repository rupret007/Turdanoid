import { describe, it, expect, vi } from 'vitest';
import { canPlayTurdtrisMusic, createTurdtrisAudioPlayer, isSoundBlocked, musicTempoForLevel, playTurdtrisSfx } from '../games/turdtris-audio.js';

function fakeContext() {
  const voices = [];
  return {
    state: 'running', currentTime: 0, destination: {}, voices,
    createOscillator() {
      const oscillator = {
        frequency: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
        connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn()
      };
      voices.push(oscillator);
      return oscillator;
    },
    createGain: () => ({
      gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() },
      connect: vi.fn(), disconnect: vi.fn()
    })
  };
}

function playerFixture() {
  const ctx = fakeContext();
  const prefs = { sound: true, muted: false, music: true };
  const getContext = vi.fn(() => ctx);
  const player = createTurdtrisAudioPlayer({
    getContext,
    getSoundEnabled: () => prefs.sound,
    getSuiteMuted: () => prefs.muted,
    getMusicEnabled: () => prefs.music
  });
  return { ctx, prefs, player, getContext };
}

describe('turdtris-audio', () => {
  it('blocks audio when game or suite mute is on', () => {
    expect(isSoundBlocked({ soundEnabled: false, suiteMuted: false })).toBe(true);
    expect(isSoundBlocked({ soundEnabled: true, suiteMuted: true })).toBe(true);
    expect(isSoundBlocked({ soundEnabled: true, suiteMuted: false })).toBe(false);
  });

  it('gives one through four line clears distinct escalating arpeggios', () => {
    const counts = [1, 2, 3, 4].map(linesCleared => {
      const ctx = fakeContext();
      playTurdtrisSfx(ctx, 'clear', { linesCleared });
      return ctx.voices.length;
    });
    expect(counts).toEqual([2, 3, 4, 6]);
    const ctx = fakeContext();
    playTurdtrisSfx(ctx, 'clear4');
    expect(ctx.voices).toHaveLength(6);
  });

  it('gives every action a distinct sound and disconnects finished voices', () => {
    const signatures = ['move', 'soft', 'rotate', 'hold', 'drop', 'lock', 'level', 'gameover', 'heartbeat'].map(type => {
      const ctx = fakeContext();
      playTurdtrisSfx(ctx, type);
      const first = ctx.voices[0];
      first.onended();
      expect(first.disconnect).toHaveBeenCalledOnce();
      return `${first.frequency.setValueAtTime.mock.calls[0][0]}-${first.type}-${ctx.voices.length}`;
    });
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it('never creates a context or emits a sound before a user gesture', () => {
    const { player, ctx, getContext } = playerFixture();
    player.play('drop');
    player.update({ active: true, danger: true });
    expect(getContext).not.toHaveBeenCalled();
    expect(ctx.voices).toHaveLength(0);
    player.arm();
    player.update({ active: true });
    expect(ctx.voices.length).toBeGreaterThan(0);
  });

  it.each(['sound', 'muted', 'music'])('silences active music immediately on %s preference changes', preference => {
    const { player, ctx, prefs } = playerFixture();
    player.arm();
    player.update({ active: true });
    const voices = [...ctx.voices];
    prefs[preference] = preference === 'muted';
    ctx.currentTime = 0.01;
    player.update({ active: true });
    expect(ctx.voices).toHaveLength(voices.length);
    voices.forEach(voice => expect(voice.stop).toHaveBeenLastCalledWith(0.015));
  });

  it('stops the loop while paused or finished and restarts cleanly', () => {
    const { player, ctx } = playerFixture();
    player.arm();
    player.update({ active: true });
    const count = ctx.voices.length;
    ctx.currentTime = 0.01;
    player.update({ active: false });
    ctx.voices.forEach(voice => expect(voice.stop).toHaveBeenCalledTimes(2));
    ctx.currentTime = 5;
    player.update({ active: false });
    expect(ctx.voices).toHaveLength(count);
    player.update({ active: true });
    expect(ctx.voices.length).toBeGreaterThan(count);
  });

  it('does not allocate catch-up music after a stalled frame', () => {
    const { player, ctx } = playerFixture();
    player.arm();
    player.update({ active: true });
    const count = ctx.voices.length;
    ctx.currentTime = 500;
    player.update({ active: true, level: 30 });
    expect(ctx.voices.length - count).toBeLessThanOrEqual(2);
    const after = ctx.voices.length;
    player.update({ active: true });
    expect(ctx.voices).toHaveLength(after);
  });

  it('throttles repeating movement/drop audio and honors muted SFX', () => {
    const { player, ctx, prefs } = playerFixture();
    player.arm();
    for (let i = 0; i < 100; i++) {player.play('soft');}
    expect(ctx.voices).toHaveLength(1);
    ctx.currentTime = 0.1;
    player.play('soft');
    expect(ctx.voices).toHaveLength(2);
    prefs.muted = true;
    player.play('rotate');
    expect(ctx.voices).toHaveLength(2);
    expect(ctx.voices[1].stop).toHaveBeenCalledTimes(2);
  });

  it('keeps the heartbeat audible with music disabled and bounds its repetition', () => {
    const { player, ctx, prefs } = playerFixture();
    prefs.music = false;
    player.arm();
    player.update({ active: true, danger: true });
    expect(ctx.voices).toHaveLength(2);
    ctx.currentTime = 0.4;
    player.update({ active: true, danger: true });
    expect(ctx.voices).toHaveLength(2);
    ctx.currentTime = 1.2;
    player.update({ active: true, danger: true });
    expect(ctx.voices).toHaveLength(4);
  });

  it('does not emit music or effects into a suspended audio context', () => {
    const { player, ctx } = playerFixture();
    player.arm();
    ctx.state = 'suspended';
    player.play('drop');
    player.update({ active: true });
    expect(ctx.voices).toHaveLength(0);
  });

  it('scales tempo safely and checks every music gate', () => {
    expect(musicTempoForLevel(1)).toBe(88);
    expect(musicTempoForLevel(8)).toBe(109);
    expect(musicTempoForLevel(100)).toBe(144);
    expect(musicTempoForLevel(NaN)).toBe(88);
    expect(musicTempoForLevel(-3)).toBe(88);
    const valid = { armed: true, active: true, soundEnabled: true, suiteMuted: false, musicEnabled: true };
    expect(canPlayTurdtrisMusic(valid)).toBe(true);
    ['armed', 'active', 'soundEnabled', 'musicEnabled'].forEach(key => {
      expect(canPlayTurdtrisMusic({ ...valid, [key]: false })).toBe(false);
    });
    expect(canPlayTurdtrisMusic({ ...valid, suiteMuted: true })).toBe(false);
  });
});
